
import { VisaApplication } from '../types';

const STORAGE_KEY = 'thai_visa_cms_data';

export const getApplications = (): VisaApplication[] => {
  const data = localStorage.getItem(STORAGE_KEY);
  return data ? JSON.parse(data) : [];
};

export const saveApplication = (app: VisaApplication) => {
  const apps = getApplications();
  const existingIndex = apps.findIndex(a => a.id === app.id);
  if (existingIndex > -1) {
    apps[existingIndex] = app;
  } else {
    apps.push(app);
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(apps));
};

export const deleteApplication = (id: string) => {
  const apps = getApplications().filter(a => a.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(apps));
};
