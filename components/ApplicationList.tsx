
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { ServiceConfig, VisaApplication, ServiceCategory } from '../types';
import { getApplications, saveApplication, deleteApplication, clearAllDuplicates, updateStatusByFlight, normalizeFlight } from '../services/dataStore';
import ApplicationForm from './ApplicationForm';
import { extractEasyPassData, lookupFlightDetails } from '../services/geminiService';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

interface ApplicationListProps {
  service: ServiceConfig;
}

type SortConfig = {
  key: keyof VisaApplication | 'profit';
  direction: 'asc' | 'desc';
} | null;

const maskPassport = (passport: string) => {
  if (!passport) return 'N/A';
  if (passport.length < 4) return passport;
  return `${passport.slice(0, 2)}****${passport.slice(-2)}`;
};

/**
 * Robustly converts varied date/time strings into a sortable number.
 */
const getSortableTimestamp = (dateStr: string | undefined, timeStr: string | undefined) => {
  if (!dateStr) return 0;
  try {
    let year = new Date().getFullYear();
    let normalizedDate = dateStr.trim();
    
    // Check if it's "Month Day" format (e.g. Jan 24)
    const parts = normalizedDate.split(/\s+/);
    if (parts.length === 2 && isNaN(parseInt(parts[0]))) {
      normalizedDate = `${normalizedDate} ${year}`;
    }

    let dateTimeStr = normalizedDate;
    if (timeStr) {
      // Clean time string (remove PM/AM for standard parsing)
      const cleanTime = timeStr.replace(/(AM|PM)/i, '').trim();
      dateTimeStr += ` ${cleanTime}`;
    }

    const d = new Date(dateTimeStr);
    return isNaN(d.getTime()) ? 0 : d.getTime();
  } catch (e) {
    return 0;
  }
};

const ApplicationList: React.FC<ApplicationListProps> = ({ service }) => {
  const [apps, setApps] = useState<VisaApplication[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [showMagicImport, setShowMagicImport] = useState(false);
  const [magicText, setMagicText] = useState('');
  const [flightFinder, setFlightFinder] = useState('');
  const [passCommand, setPassCommand] = useState('');
  const [passFeedback, setPassFeedback] = useState<string | null>(null);
  const [isExtracting, setIsExtracting] = useState(false);
  const [isSyncingAll, setIsSyncingAll] = useState(false);
  const [recentlyCompleted, setRecentlyCompleted] = useState<string[]>([]);
  
  const [syncProgress, setSyncProgress] = useState<{
    current: number; 
    total: number; 
    updated: number; 
    failed: number;
    status: string; 
    currentFlight?: string;
  } | null>(null);

  const [extractedData, setExtractedData] = useState<any[] | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [showToolsMenu, setShowToolsMenu] = useState(false);
  const [editingApp, setEditingApp] = useState<VisaApplication | undefined>();
  // Default to Descending (Newest first) for Easy Pass
  const [sortConfig, setSortConfig] = useState<SortConfig>(
    service.category === ServiceCategory.EASY_PASS 
      ? { key: 'arrivalDate', direction: 'desc' } 
      : null
  );
  
  const toolsMenuRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isEasyPass = service.category === ServiceCategory.EASY_PASS;

  const loadData = () => {
    const all = getApplications();
    const filtered = all.filter(a => 
      a.serviceCategory === service.category && 
      (!service.subService || a.subService === service.subService) &&
      (service.offices.includes('ALL') || a.office === service.offices[0])
    );
    setApps(filtered);
  };

  useEffect(() => {
    loadData();
    const handleClickOutside = (event: MouseEvent) => {
      if (toolsMenuRef.current && !toolsMenuRef.current.contains(event.target as Node)) {
        setShowToolsMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [service]);

  const parseNum = (str: string | undefined) => parseFloat(str?.replace(/,/g, '') || '0') || 0;

  const filteredAndSortedApps = useMemo(() => {
    let result = [...apps];
    
    if (statusFilter === 'Pending') result = result.filter(a => a.status === 'Pending');
    else if (statusFilter === 'Completed') result = result.filter(a => a.status === 'Completed');
    else if (statusFilter === 'Cancelled') result = result.filter(a => a.status === 'Cancelled');
    else if (statusFilter === 'Remarks') result = result.filter(a => (a.notes && a.notes.trim().length > 0));
    
    if (flightFinder.trim()) {
      const search = normalizeFlight(flightFinder);
      result = result.filter(a => normalizeFlight(a.flightNo).includes(search));
    }

    const config = sortConfig || (isEasyPass ? { key: 'arrivalDate', direction: 'desc' } : { key: 'createdAt', direction: 'desc' });
    
    if (config) {
      result.sort((a, b) => {
        if (config.key === 'arrivalDate') {
          const aTime = getSortableTimestamp(a.arrivalDate, a.arrivalTime);
          const bTime = getSortableTimestamp(b.arrivalDate, b.arrivalTime);
          return config.direction === 'asc' ? aTime - bTime : bTime - aTime;
        }

        let aValue: any;
        let bValue: any;
        if (config.key === 'profit') {
          const priceA = parseNum(a.price);
          const priceB = parseNum(b.price);
          aValue = priceA - parseNum(a.costPrice);
          bValue = priceB - parseNum(b.costPrice);
        } else {
          const valA = a[config.key as keyof VisaApplication];
          const valB = b[config.key as keyof VisaApplication];
          aValue = (valA || '').toString().toLowerCase();
          bValue = (valB || '').toString().toLowerCase();
        }

        if (aValue < bValue) return config.direction === 'asc' ? -1 : 1;
        if (aValue > bValue) return config.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }
    return result;
  }, [apps, sortConfig, statusFilter, flightFinder, isEasyPass]);

  const requestSort = (key: keyof VisaApplication | 'profit') => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') direction = 'desc';
    setSortConfig({ key, direction });
  };

  const handlePassCommand = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && passCommand.trim()) {
      const inputVal = passCommand.trim();
      const normalizedInput = normalizeFlight(inputVal);
      const updatedCount = updateStatusByFlight(normalizedInput, 'Completed', service.category);
      
      if (updatedCount > 0) {
        setPassFeedback(`PASS: ${normalizedInput} (${updatedCount} COMPLETED)`);
        setPassCommand('');
        const affectedIds = apps
          .filter(a => normalizeFlight(a.flightNo) === normalizedInput)
          .map(a => a.id);
        setRecentlyCompleted(affectedIds);
        loadData();
        setTimeout(() => {
          setPassFeedback(null);
          setRecentlyCompleted([]);
        }, 4000);
      } else {
        setPassFeedback(`NOT FOUND: ${normalizedInput}`);
        setTimeout(() => setPassFeedback(null), 3000);
      }
    }
  };

  /**
   * Enhanced Sync Logic:
   * Covers Completed flights to fill up Origin/Destination data.
   */
  const syncAllFlightData = async () => {
    const targetApps = apps.filter(a => a.flightNo && a.status !== 'Cancelled');
    if (targetApps.length === 0) {
      alert('Alert: No active deployments require flight status synchronization.');
      return;
    }
    
    setIsSyncingAll(true);
    setShowToolsMenu(false);
    setSyncProgress({ 
      current: 0, 
      total: targetApps.length, 
      updated: 0, 
      failed: 0,
      status: 'Populating Manifest Telemetry...',
      currentFlight: ''
    });
    
    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < targetApps.length; i++) {
      const app = targetApps[i];
      const flightTag = normalizeFlight(app.flightNo);
      
      setSyncProgress(prev => prev ? { 
        ...prev, 
        current: i + 1,
        status: `Deep Sync: ${flightTag}`,
        currentFlight: flightTag
      } : null);
      
      try {
        const result = await lookupFlightDetails(flightTag, app.arrivalDate);
        if (result && result.data) {
          const d = result.data;
          const updatedApp: VisaApplication = { 
            ...app,
            airline: (d.airline && d.airline !== 'TBA') ? d.airline : app.airline,
            origin: (d.origin && d.origin !== 'TBA') ? d.origin : app.origin,
            destination: (d.destination && d.destination !== 'TBA') ? d.destination : app.destination,
            departCountry: (d.departCountry && d.departCountry !== 'TBA') ? d.departCountry : app.departCountry,
            arrivalDate: (d.arrivalDate && d.arrivalDate !== 'TBA') ? d.arrivalDate : app.arrivalDate,
            arrivalTime: (d.arrivalTime && d.arrivalTime !== 'TBA') ? d.arrivalTime : app.arrivalTime,
          };
          
          const flightStatus = d.status?.toLowerCase() || '';
          if (app.status !== 'Completed' && ['landed', 'arrived', 'completed', 'at gate'].some(s => flightStatus.includes(s))) {
            updatedApp.status = 'Completed';
            updatedApp.completedAt = new Date().toISOString();
          }
          
          saveApplication(updatedApp);
          successCount++;
        } else {
          failCount++;
        }
      } catch (err) { 
        failCount++;
      }
      
      setSyncProgress(prev => prev ? { 
        ...prev, 
        updated: successCount,
        failed: failCount
      } : null);

      await new Promise(r => setTimeout(r, 800));
    }
    
    setIsSyncingAll(false);
    loadData();
    setSyncProgress(prev => prev ? { ...prev, status: 'Manifest Data Populated' } : null);
    setTimeout(() => setSyncProgress(null), 8000);
  };

  /**
   * Advanced Excel Export for Backup
   */
  const exportExcel = () => {
    // We include all fields for a perfect restoration
    const dataToExport = apps.map(app => ({
      ...app,
      'InternalID': app.id, // For tracking
    }));

    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Database_Backup");
    XLSX.writeFile(wb, `Thai_Visa_CMS_Backup_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  /**
   * Robust Excel Restore functionality
   */
  const handleRestore = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws) as any[];
        
        data.forEach(item => {
          const restoredApp: VisaApplication = {
            id: item.InternalID || item.id || Date.now().toString(),
            clientName: item.clientName || 'Restored User',
            passportNumber: item.passportNumber || '',
            nationality: item.nationality || '',
            serviceCategory: item.serviceCategory as ServiceCategory,
            subService: item.subService,
            office: item.office,
            status: item.status,
            createdAt: item.createdAt || new Date().toISOString(),
            arrivalDate: item.arrivalDate,
            arrivalTime: item.arrivalTime,
            notes: item.notes || '',
            price: item.price?.toString() || '0',
            costPrice: item.costPrice?.toString() || '0',
            flightNo: item.flightNo,
            airline: item.airline,
            origin: item.origin,
            destination: item.destination,
            paxCount: item.paxCount || 1
          };
          saveApplication(restoredApp);
        });
        
        loadData();
        alert(`Successfully synchronized ${data.length} records.`);
      } catch (err) {
        alert("Restore Failed: Invalid file format or corrupted data.");
      }
    };
    reader.readAsBinaryString(file);
    e.target.value = ''; // Reset input
  };

  /**
   * Professional PDF Export Layout
   */
  const exportPDF = () => {
    const doc = new jsPDF('l', 'mm', 'a4');
    // Fix: Explicitly typed as a tuple [number, number, number] to allow spreading into doc.setFillColor.
    const primaryColor: [number, number, number] = [15, 23, 42]; // Navy Slate
    
    // Header
    // Fix: Using spread operator on the tuple primaryColor.
    doc.setFillColor(...primaryColor);
    doc.rect(0, 0, 297, 35, 'F');
    
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(22);
    doc.setFont('helvetica', 'bold');
    doc.text(`OPERATIONAL MANIFEST: ${service.title.toUpperCase()}`, 15, 18);
    
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(`DATE GENERATED: ${new Date().toLocaleString()}`, 15, 28);
    doc.text(`TOTAL DEPLOYMENTS: ${filteredAndSortedApps.length}`, 240, 28);
    
    const tableData = filteredAndSortedApps.map(app => [
      app.clientName,
      app.passportNumber || 'N/A',
      app.flightNo || '-',
      `${app.origin || '??'} ➔ ${app.destination || '??'}`,
      `${app.arrivalDate || 'TBA'} ${app.arrivalTime || ''}`,
      app.status.toUpperCase(),
      `฿${parseNum(app.price).toLocaleString()}`
    ]);

    autoTable(doc, {
      head: [['PASSENGER', 'PASSPORT', 'FLIGHT', 'ROUTE', 'SCHEDULED ARRIVAL', 'STATUS', 'REVENUE']],
      body: tableData,
      startY: 45,
      styles: { fontSize: 8, cellPadding: 4, overflow: 'linebreak' },
      columnStyles: {
        0: { cellWidth: 50, fontStyle: 'bold' },
        1: { cellWidth: 30 },
        2: { cellWidth: 30, fontStyle: 'bold' },
        3: { cellWidth: 40 },
        4: { cellWidth: 45 },
        5: { cellWidth: 30 },
        6: { cellWidth: 30, halign: 'right' },
      },
      headStyles: { 
        fillColor: [37, 99, 235], // Blue-600
        textColor: 255, 
        fontStyle: 'bold',
        halign: 'center'
      },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      margin: { left: 15, right: 15 },
      didDrawPage: (data) => {
        // Footer
        doc.setFontSize(8);
        doc.setTextColor(150);
        doc.text(`Confidential - Thai Visa CMS Internal Documentation - Page ${data.pageNumber}`, 15, 200);
      }
    });

    doc.save(`Manifest_${service.id}_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  const handleMagicImport = async () => {
    if (!magicText.trim()) return;
    setIsExtracting(true);
    const todayStr = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    try {
      const result = await extractEasyPassData(magicText, todayStr);
      if (result && Array.isArray(result)) setExtractedData(result);
    } catch (err) { alert("AI Extraction Error."); }
    finally { setIsExtracting(false); }
  };

  const saveExtracted = () => {
    if (!extractedData) return;
    const now = new Date();
    extractedData.forEach(item => {
      const flightTag = item.flightNo ? normalizeFlight(item.flightNo) : 'TBA';
      const landingPort = item.airport || 'BKK';
      saveApplication({
        id: `EP-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        clientName: `Passenger of ${flightTag}`, 
        passportNumber: '',
        nationality: '',
        visaType: item.visaType || 'Arrival (VOA)',
        serviceCategory: ServiceCategory.EASY_PASS,
        status: 'Pending',
        createdAt: new Date().toISOString(),
        arrivalDate: item.date,
        arrivalTime: item.time,
        notes: item.remarks || '',
        price: '0',
        costPrice: '0',
        flightNo: flightTag,
        embarkation: landingPort,
        origin: 'TBA',
        destination: landingPort,
        paxCount: item.paxCount || 1
      });
    });
    setExtractedData(null);
    setShowMagicImport(false);
    loadData();
  };

  const SortBtn = ({ label, columnKey }: { label: string, columnKey: keyof VisaApplication | 'profit' }) => (
    <button onClick={() => requestSort(columnKey)} className={`flex items-center gap-2 uppercase tracking-widest text-[9px] font-black ${sortConfig?.key === columnKey ? 'text-blue-600' : 'text-slate-400'}`}>
      {label} {sortConfig?.key === columnKey && (<span>{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>)}
    </button>
  );

  const FilterTab = ({ label, count }: { label: string, count?: number }) => (
    <button onClick={() => setStatusFilter(label)} className={`px-6 py-4 text-[11px] font-black uppercase tracking-widest transition-all relative border-b-2 ${statusFilter === label ? 'text-blue-600 border-blue-600 bg-blue-50/50' : 'text-slate-500 border-transparent hover:bg-slate-800/20'}`}>
      {label} {count !== undefined && count > 0 && <span className="ml-2 bg-slate-200 dark:bg-slate-700 px-1.5 py-0.5 rounded text-[8px]">{count}</span>}
    </button>
  );

  return (
    <div className="space-y-6 lg:space-y-8 animate-fadeIn pb-12">
      {syncProgress && (
        <div className="fixed top-24 left-1/2 -translate-x-1/2 z-[300] w-full max-w-xl px-4 animate-slideUp">
          <div className="bg-slate-900 dark:bg-black rounded-3xl p-6 shadow-2xl border border-blue-500/30 backdrop-blur-md">
            <div className="flex justify-between items-center mb-4">
               <div>
                 <h4 className="text-white text-xs font-black uppercase tracking-widest">{syncProgress.status}</h4>
                 <p className="text-blue-400 text-[10px] font-bold mt-1">Flight: {syncProgress.currentFlight || 'Scanning...'}</p>
               </div>
               <span className="text-slate-500 text-[10px] font-black">{Math.round((syncProgress.current / syncProgress.total) * 100)}%</span>
            </div>
            <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
               <div className="bg-blue-600 h-full transition-all duration-500" style={{ width: `${(syncProgress.current / syncProgress.total) * 100}%` }}></div>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] p-6 lg:p-10 border border-slate-100 dark:border-slate-800 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-1">
          <span className="px-3 py-1 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400 text-[10px] font-black uppercase tracking-widest">{service.category}</span>
          <h2 className="text-2xl lg:text-3xl font-black text-slate-900 dark:text-white tracking-tight">{service.title}</h2>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {isEasyPass && (
            <>
              <div className="flex items-center bg-slate-100 dark:bg-slate-800 rounded-full px-5 py-2.5 border border-slate-200 dark:border-slate-700 focus-within:border-blue-500 transition-all shadow-inner">
                <input value={flightFinder} onChange={(e) => setFlightFinder(e.target.value)} placeholder="FLIGHT FINDER" className="bg-transparent border-none outline-none text-[10px] font-black uppercase tracking-widest w-32 placeholder:text-slate-400 text-slate-700 dark:text-slate-200" />
              </div>
              <div className="flex items-center bg-slate-100 dark:bg-slate-800 rounded-full px-5 py-2.5 border border-slate-200 dark:border-slate-700 focus-within:border-blue-500 transition-all shadow-inner">
                <input value={passCommand} onChange={(e) => setPassCommand(e.target.value.toUpperCase())} onKeyDown={handlePassCommand} placeholder={passFeedback || "PASS BOX (ENTER)"} className="bg-transparent border-none outline-none text-[10px] font-black uppercase tracking-widest w-40 placeholder:text-slate-400 text-slate-700 dark:text-slate-200" />
              </div>
              <button onClick={() => setShowMagicImport(true)} className="px-5 py-2.5 rounded-2xl bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-800 text-[10px] font-black uppercase tracking-widest">AI MANIFEST</button>
            </>
          )}

          <div className="relative" ref={toolsMenuRef}>
            <button onClick={() => setShowToolsMenu(!showToolsMenu)} className="px-5 py-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-bold text-[10px] uppercase tracking-widest">OPS</button>
            {showToolsMenu && (
              <div className="absolute right-0 mt-4 w-64 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl z-50 overflow-hidden py-2 animate-slideUp">
                <button onClick={syncAllFlightData} disabled={isSyncingAll} className="w-full px-4 py-3 text-left text-xs font-bold uppercase hover:bg-slate-50 dark:hover:bg-slate-800 text-blue-600">Deep Telemetry Sync</button>
                <div className="border-t border-slate-100 dark:border-slate-800 my-1"></div>
                <button onClick={exportExcel} className="w-full px-4 py-3 text-left text-xs font-bold uppercase hover:bg-slate-50 dark:hover:bg-slate-800 text-emerald-600">Excel Backup</button>
                <button onClick={() => fileInputRef.current?.click()} className="w-full px-4 py-3 text-left text-xs font-bold uppercase hover:bg-slate-50 dark:hover:bg-slate-800 text-indigo-600">Restore Data</button>
                <button onClick={exportPDF} className="w-full px-4 py-3 text-left text-xs font-bold uppercase hover:bg-slate-50 dark:hover:bg-slate-800 text-rose-600">PDF Manifest</button>
              </div>
            )}
          </div>
          <button onClick={() => { setEditingApp(undefined); setShowForm(true); }} className="px-6 py-2.5 rounded-2xl bg-blue-600 text-white font-black text-[10px] uppercase tracking-widest shadow-lg">Add Record</button>
        </div>
      </div>

      <input type="file" ref={fileInputRef} className="hidden" accept=".xlsx, .xls" onChange={handleRestore} />

      <div className="flex border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-t-[2.5rem] px-4 overflow-x-auto no-scrollbar">
        <FilterTab label="All" />
        <FilterTab label="Pending" count={apps.filter(a => a.status === 'Pending').length} />
        <FilterTab label="Completed" count={apps.filter(a => a.status === 'Completed').length} />
        <FilterTab label="Remarks" count={apps.filter(a => a.notes && a.notes.trim().length > 0).length} />
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-b-[2.5rem] border-x border-b border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden">
        <div className="overflow-x-auto custom-scrollbar-horizontal scroll-smooth">
          <table className="w-full text-left border-collapse min-w-[1200px]">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800">
                <th className="px-6 py-5 w-[240px]"><SortBtn label="Passenger Name" columnKey="clientName" /></th>
                <th className="px-6 py-5 w-[140px]"><SortBtn label="Passport" columnKey="passportNumber" /></th>
                <th className="px-4 py-5 text-center text-[9px] font-black text-slate-400 uppercase w-[60px]">Pax</th>
                <th className="px-6 py-5 w-[140px]"><SortBtn label="Flight ID" columnKey="flightNo" /></th>
                <th className="px-6 py-5 w-[160px] text-[9px] font-black text-slate-400 uppercase">Route Detail</th>
                <th className="px-6 py-5 w-[140px]"><SortBtn label="Arrival Log" columnKey="arrivalDate" /></th>
                <th className="px-6 py-5 w-[140px] text-[9px] font-black text-slate-400 uppercase">Workflow</th>
                <th className="px-6 py-5 w-[120px] text-right text-[9px] font-black text-slate-400 uppercase">Revenue</th>
                <th className="px-6 py-5 w-[100px] text-right text-[9px] font-black text-slate-400 uppercase">Ops</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredAndSortedApps.map((app) => (
                <tr key={app.id} className={`group hover:bg-blue-50/30 dark:hover:bg-blue-900/10 transition-all duration-300 ${recentlyCompleted.includes(app.id) ? 'bg-emerald-500/10' : ''}`}>
                  <td className="px-6 py-4">
                    <div className="flex flex-col">
                      <span className={`font-black text-slate-900 dark:text-slate-100 text-[13px] ${app.status === 'Completed' ? 'line-through opacity-40' : ''}`}>{app.clientName || 'UNNAMED'}</span>
                      <span className="text-[8px] text-blue-600 font-black uppercase mt-0.5">{app.visaType || 'ARRIVAL'}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded font-mono text-[10px] font-bold text-slate-500">{maskPassport(app.passportNumber)}</span>
                  </td>
                  <td className="px-4 py-4 text-center">
                    <span className="text-sm font-black text-slate-400">{app.paxCount || 1}</span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col">
                      <span className="text-xs font-black text-slate-900 dark:text-white uppercase">{app.flightNo || '-'}</span>
                      <span className="text-[8px] text-slate-400 uppercase font-black">{app.airline || 'CARRIER'}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                     <div className="flex flex-col">
                        <span className="text-[14px] font-black text-blue-600 dark:text-blue-400 uppercase leading-none tracking-tight">
                          {app.destination || app.origin || 'BKK'}
                        </span>
                        <span className="text-[8px] font-black text-slate-400 uppercase mt-1 opacity-60">
                          {app.origin ? `${app.origin} ➔ ${app.destination}` : 'TBA ➔ Thailand'}
                        </span>
                     </div>
                  </td>
                  <td className="px-6 py-4">
                     <div className="flex flex-col">
                        <span className="text-[10px] font-bold text-slate-700 dark:text-slate-300 whitespace-nowrap">{app.arrivalDate || 'TBA'}</span>
                        <span className="text-[9px] text-blue-500 font-black uppercase mt-0.5">{app.arrivalTime || '--:--'}</span>
                     </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`text-[9px] font-black uppercase px-3 py-1.5 rounded-full border ${
                      app.status === 'Completed' ? 'bg-emerald-50 text-emerald-600 border-emerald-200' : 'bg-amber-50 text-amber-600 border-amber-200'
                    }`}>
                      {app.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 font-mono text-xs font-bold text-right">฿{parseNum(app.price).toLocaleString()}</td>
                  <td className="px-6 py-4 text-right">
                     <div className="flex items-center justify-end gap-1">
                        <button onClick={() => { setEditingApp(app); setShowForm(true); }} className="p-2 text-slate-400 hover:text-blue-600"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2.25 2.25 0 113.182 3.182L12.75 22.511l-4.509 1.252 1.252-4.509L21.586 4.586z" /></svg></button>
                        <button onClick={() => { if(confirm('Remove deployment?')) { deleteApplication(app.id); loadData(); } }} className="p-2 text-slate-400 hover:text-rose-600"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg></button>
                     </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showMagicImport && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-md" onClick={() => setShowMagicImport(false)} />
          <div className="relative w-full max-w-4xl bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-8 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
              <h3 className="text-2xl font-black text-slate-900 dark:text-white uppercase">AI Manifest Intelligence</h3>
              <button onClick={() => setShowMagicImport(false)} className="text-slate-400">✕</button>
            </div>
            <div className="p-8 space-y-6 overflow-y-auto">
              {!extractedData ? (
                <>
                  <textarea value={magicText} onChange={(e) => setMagicText(e.target.value)} placeholder="Paste arrival text here..." className="w-full h-64 p-6 bg-slate-50 dark:bg-slate-800 rounded-3xl border-2 border-slate-100 focus:border-emerald-500 outline-none font-mono text-xs" />
                  <button onClick={handleMagicImport} disabled={isExtracting} className="w-full py-5 bg-emerald-600 text-white rounded-3xl font-black uppercase tracking-widest shadow-xl">
                    {isExtracting ? 'DECODING...' : 'EXTRACT DATA'}
                  </button>
                </>
              ) : (
                <div className="space-y-4">
                  <span className="text-[10px] font-black text-emerald-600 uppercase">Detection Complete: {extractedData.length} Records Found</span>
                  <button onClick={saveExtracted} className="w-full py-5 bg-blue-600 text-white rounded-3xl font-black uppercase tracking-widest shadow-xl">DEPLOY TO DATABASE</button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {showForm && (
        <ApplicationForm service={service} onSave={(a) => { saveApplication(a); setShowForm(false); loadData(); }} onCancel={() => setShowForm(false)} initialData={editingApp} />
      )}
    </div>
  );
};

export default ApplicationList;
