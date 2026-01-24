
import { VisaApplication, ServiceCategory } from '../types';

const STORAGE_KEY = 'thai_visa_cms_data';

export const getApplications = (): VisaApplication[] => {
  const data = localStorage.getItem(STORAGE_KEY);
  return data ? JSON.parse(data) : [];
};

/**
 * Aggressively normalizes flight numbers for comparison.
 */
export const normalizeFlight = (fn: string | undefined) => {
  if (!fn) return '';
  return fn.toUpperCase().replace(/[^A-Z0-9]/g, '').trim();
};

export const saveApplication = (app: VisaApplication) => {
  const apps = getApplications();
  const existingIndexById = apps.findIndex(a => a.id === app.id);

  if (existingIndexById > -1) {
    apps[existingIndexById] = app;
  } else {
    const currentFlight = normalizeFlight(app.flightNo);
    const currentIdentity = (app.passportNumber || app.clientName || '').toUpperCase().trim();
    
    const existingDupIndex = apps.findIndex(a => {
      const isSameFlight = normalizeFlight(a.flightNo) === currentFlight;
      const isSameDate = a.arrivalDate === app.arrivalDate;
      const isSameIdentity = (a.passportNumber?.toUpperCase().trim() === currentIdentity) || 
                             (a.clientName?.toUpperCase().trim() === currentIdentity);
      
      return isSameFlight && isSameDate && isSameIdentity && app.flightNo && app.arrivalDate;
    });

    if (existingDupIndex > -1) {
      const existing = apps[existingDupIndex];
      apps[existingDupIndex] = { 
        ...existing, 
        ...app, 
        id: existing.id,
        createdAt: existing.createdAt 
      };
    } else {
      apps.push(app);
    }
  }
  
  localStorage.setItem(STORAGE_KEY, JSON.stringify(apps));
};

/**
 * Updates status for all matching flights and returns the count of affected records.
 */
export const updateStatusByFlight = (
  flightNo: string, 
  status: VisaApplication['status'],
  category?: ServiceCategory
): number => {
  const apps = getApplications();
  const target = normalizeFlight(flightNo);
  let count = 0;
  
  const updatedApps = apps.map(app => {
    const matchesFlight = app.flightNo && normalizeFlight(app.flightNo) === target;
    const matchesCategory = !category || app.serviceCategory === category;

    if (matchesFlight && matchesCategory && app.status !== status) {
      count++;
      return { 
        ...app, 
        status: status, 
        completedAt: status === 'Completed' ? new Date().toISOString() : app.completedAt 
      };
    }
    return app;
  });
  
  if (count > 0) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedApps));
  }
  return count;
};

export const deleteApplication = (id: string) => {
  const apps = getApplications().filter(a => a.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(apps));
};

export const clearAllDuplicates = () => {
  const apps = getApplications();
  if (apps.length === 0) return 0;
  
  const unique = new Map<string, VisaApplication>();
  
  apps.forEach(app => {
    const identity = (app.passportNumber || app.clientName || app.id).toUpperCase().trim();
    const flightKey = normalizeFlight(app.flightNo) || 'NOFLIGHT';
    const dateKey = app.arrivalDate || 'NODATE';
    const key = `${app.serviceCategory}-${flightKey}-${dateKey}-${identity}`;
      
    if (!unique.has(key)) {
      unique.set(key, { ...app });
    } else {
      const existing = unique.get(key)!;
      if (app.status === 'Completed' && existing.status !== 'Completed') {
        existing.status = 'Completed';
        existing.completedAt = app.completedAt || new Date().toISOString();
      }
    }
  });
  
  const cleaned = Array.from(unique.values());
  localStorage.setItem(STORAGE_KEY, JSON.stringify(cleaned));
  return apps.length - cleaned.length;
};
