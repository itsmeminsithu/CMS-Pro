
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { ServiceConfig, VisaApplication, ServiceCategory } from '../types';
import { getApplications, saveApplication, deleteApplication } from '../services/dataStore';
import ApplicationForm from './ApplicationForm';
import { analyzeNotes, extractEasyPassData } from '../services/geminiService';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';

interface ApplicationListProps {
  service: ServiceConfig;
}

type SortConfig = {
  key: keyof VisaApplication | 'profit';
  direction: 'asc' | 'desc';
} | null;

const ApplicationList: React.FC<ApplicationListProps> = ({ service }) => {
  const [apps, setApps] = useState<VisaApplication[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [showMagicImport, setShowMagicImport] = useState(false);
  const [magicText, setMagicText] = useState('');
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractedData, setExtractedData] = useState<any[] | null>(null);
  
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [showStaleOnly, setShowStaleOnly] = useState<boolean>(false);
  const [passCommand, setPassCommand] = useState('');
  const [passFeedback, setPassFeedback] = useState<{msg: string, type: 'success' | 'error'} | null>(null);
  
  const [showToolsMenu, setShowToolsMenu] = useState(false);
  const [editingApp, setEditingApp] = useState<VisaApplication | undefined>();
  const [analysis, setAnalysis] = useState<{ text: string; client: string } | null>(null);
  const [analyzingId, setAnalyzingId] = useState<string | null>(null);
  const [sortConfig, setSortConfig] = useState<SortConfig>(null);
  
  const toolsMenuRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isEasyPass = service.category === ServiceCategory.EASY_PASS;

  const isStale = (createdAt: string) => {
    const created = new Date(createdAt).getTime();
    const now = new Date().getTime();
    const diffDays = (now - created) / (1000 * 3600 * 24);
    return diffDays > 7;
  };

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
    if (statusFilter !== 'All') result = result.filter(a => a.status === statusFilter);
    if (showStaleOnly) result = result.filter(a => a.status === 'Pending' && isStale(a.createdAt));

    const config = sortConfig || (isEasyPass ? { key: 'arrivalDate', direction: 'asc' } : { key: 'createdAt', direction: 'desc' });
    
    if (config) {
      result.sort((a, b) => {
        let aValue: any;
        let bValue: any;

        if (config.key === 'profit') {
          aValue = parseNum(a.price) - parseNum(a.costPrice);
          bValue = parseNum(b.price) - parseNum(b.costPrice);
        } else if (config.key === 'arrivalDate') {
          aValue = `${a.arrivalDate || ''} ${a.arrivalTime || ''}`.toLowerCase();
          bValue = `${b.arrivalDate || ''} ${b.arrivalTime || ''}`.toLowerCase();
        } else if (config.key === 'price' || config.key === 'costPrice' || config.key === 'paxCount') {
          aValue = config.key === 'paxCount' ? (a.paxCount || 1) : parseNum(a[config.key] as string);
          bValue = config.key === 'paxCount' ? (b.paxCount || 1) : parseNum(b[config.key] as string);
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
  }, [apps, sortConfig, statusFilter, showStaleOnly, isEasyPass]);

  const requestSort = (key: keyof VisaApplication | 'profit') => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const maskPassport = (num: string) => {
    if (!num || num === 'TBA' || num.length < 5) return num;
    return `${num.substring(0, 2)}****${num.substring(num.length - 2)}`;
  };

  const exportExcel = () => {
    const dataToExport = apps.map(app => ({
      ID: app.id,
      Client: isEasyPass ? `Passenger Of ${app.flightNo}` : app.clientName,
      Passport: app.passportNumber,
      Nationality: app.nationality,
      Status: app.status,
      Pax: app.paxCount || 1,
      Revenue: parseNum(app.price),
      Cost: parseNum(app.costPrice),
      Profit: parseNum(app.price) - parseNum(app.costPrice),
      Created: app.createdAt
    }));
    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "ServiceData");
    XLSX.writeFile(workbook, `${service.title}_Export_${new Date().toISOString().split('T')[0]}.xlsx`);
    setShowToolsMenu(false);
  };

  const restoreFromExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const data = new Uint8Array(event.target?.result as ArrayBuffer);
      const workbook = XLSX.read(data, { type: 'array' });
      const jsonData = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]) as any[];
      
      jsonData.forEach(item => {
        // Basic mapping back to type if headers match
        if (item.ID && (item.Client || item.clientName)) {
           const app: VisaApplication = {
             id: item.ID || item.id,
             clientName: item.Client || item.clientName,
             passportNumber: item.Passport || item.passportNumber || 'TBA',
             nationality: item.Nationality || item.nationality || 'TBA',
             status: item.Status || item.status || 'Pending',
             price: (item.Revenue || item.price || '0').toString(),
             costPrice: (item.Cost || item.costPrice || '0').toString(),
             serviceCategory: service.category,
             subService: service.subService,
             createdAt: item.Created || item.createdAt || new Date().toISOString(),
             notes: item.Notes || item.notes || '',
             paxCount: parseInt(item.Pax || item.paxCount) || 1
           };
           saveApplication(app);
        }
      });
      loadData();
      alert('Sync successful.');
    };
    reader.readAsArrayBuffer(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
    setShowToolsMenu(false);
  };

  const exportPDF = () => {
    const doc = new jsPDF('l', 'mm', 'a4');
    doc.setFontSize(18);
    doc.setTextColor(30, 64, 175);
    doc.text(`${service.title.toUpperCase()} REPORT`, 14, 18);
    
    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139);
    doc.text(`Generated on ${new Date().toLocaleString()}`, 14, 25);
    
    const headers = [['Client Info', 'Passport', 'Pax', 'Status', 'Processed At', 'Sale (THB)', 'Profit']];
    const data = filteredAndSortedApps.map(app => [
      isEasyPass ? `Passenger Of ${app.flightNo}` : app.clientName,
      app.passportNumber,
      `${app.paxCount || 1} Pax`,
      app.status.toUpperCase(),
      app.completedAt ? new Date(app.completedAt).toLocaleDateString() : '-',
      parseNum(app.price).toLocaleString(),
      (parseNum(app.price) - parseNum(app.costPrice)).toLocaleString()
    ]);

    (doc as any).autoTable({
      head: headers,
      body: data,
      startY: 32,
      theme: 'striped',
      styles: { fontSize: 8, cellPadding: 4 },
      headStyles: { fillColor: [30, 64, 175], textColor: [255, 255, 255], fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      margin: { top: 32 }
    });

    doc.save(`${service.title}_Report_${new Date().getTime()}.pdf`);
    setShowToolsMenu(false);
  };

  const handleMagicImport = async () => {
    if (!magicText.trim()) return;
    setIsExtracting(true);
    const todayStr = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    const result = await extractEasyPassData(magicText, todayStr);
    if (result && Array.isArray(result)) {
      setExtractedData(result);
    }
    setIsExtracting(false);
  };

  const saveExtracted = () => {
    if (!extractedData) return;
    extractedData.forEach(item => {
      const isDone = item.process?.toLowerCase() === 'done';
      const newApp: VisaApplication = {
        id: `EP-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        clientName: `Passenger Of ${item.flightNo || 'TBA'}`, 
        passportNumber: 'TBA',
        nationality: 'TBA',
        serviceCategory: ServiceCategory.EASY_PASS,
        status: isDone ? 'Completed' : 'Pending',
        completedAt: isDone ? new Date().toISOString() : undefined,
        createdAt: new Date().toISOString(),
        arrivalDate: item.date,
        arrivalTime: item.time,
        visaType: item.visaType || 'Arrival',
        notes: `AI Auto-Imported from manifest. ${item.remarks || ''}`,
        price: '0',
        costPrice: '0',
        flightNo: item.flightNo,
        embarkation: item.airport,
        office: 'ALL',
        paxCount: item.paxCount || 1
      };
      saveApplication(newApp);
    });
    setExtractedData(null);
    setShowMagicImport(false);
    loadData();
  };

  const handlePassCommand = (e: React.FormEvent) => {
    e.preventDefault();
    if (!passCommand.trim()) return;
    const match = passCommand.match(/([A-Z0-9]+)/i);
    if (!match) return;
    const flightToFind = match[1].toUpperCase();
    let count = 0;
    const all = getApplications();
    all.forEach(app => {
      if (app.flightNo?.toUpperCase() === flightToFind && app.status !== 'Completed') {
        app.status = 'Completed';
        app.completedAt = new Date().toISOString();
        saveApplication(app);
        count++;
      }
    });
    if (count > 0) {
      setPassFeedback({ msg: `${count} records marked as Completed`, type: 'success' });
      loadData();
    }
    setPassCommand('');
    setTimeout(() => setPassFeedback(null), 3000);
  };

  const handleDelete = (id: string) => {
    if (confirm('Permanently delete this record?')) {
      deleteApplication(id);
      loadData();
    }
  };

  const handleNew = () => {
    setEditingApp(undefined);
    setShowForm(true);
  };

  const handleEdit = (app: VisaApplication) => {
    setEditingApp(app);
    setShowForm(true);
  };

  const SortBtn = ({ label, columnKey }: { label: string, columnKey: keyof VisaApplication | 'profit' }) => (
    <button 
      onClick={() => requestSort(columnKey)} 
      className={`group/btn flex items-center gap-2 px-2 py-1 rounded-lg transition-all hover:bg-slate-100 dark:hover:bg-slate-800 uppercase tracking-widest text-[10px] font-black ${sortConfig?.key === columnKey ? 'text-blue-600' : 'text-slate-400'}`}
    >
      {label}
      <div className="flex flex-col -space-y-1">
        <span className={`text-[8px] transition-colors ${sortConfig?.key === columnKey && sortConfig.direction === 'asc' ? 'text-blue-600' : 'text-slate-300 group-hover/btn:text-slate-500'}`}>▲</span>
        <span className={`text-[8px] transition-colors ${sortConfig?.key === columnKey && sortConfig.direction === 'desc' ? 'text-blue-600' : 'text-slate-300 group-hover/btn:text-slate-500'}`}>▼</span>
      </div>
    </button>
  );

  return (
    <div className="space-y-6 lg:space-y-8 animate-fadeIn pb-12">
      <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] p-6 lg:p-10 border border-slate-100 dark:border-slate-800 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-6 transition-all">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
             <span className="px-3 py-1 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400 text-[10px] font-black uppercase tracking-[0.2em]">
               {service.category}
             </span>
          </div>
          <h2 className="text-2xl lg:text-4xl font-black text-slate-900 dark:text-white tracking-tight">{service.title}</h2>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="relative" ref={toolsMenuRef}>
            <button 
              onClick={() => setShowToolsMenu(!showToolsMenu)} 
              className="px-6 py-4 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-black text-xs uppercase tracking-widest flex items-center gap-3 transition-all hover:bg-slate-100 dark:hover:bg-slate-700 shadow-sm"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" /></svg>
              Operations Tools
            </button>
            {showToolsMenu && (
              <div className="absolute right-0 mt-4 w-72 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.15)] z-50 overflow-hidden py-3 animate-slideUp">
                <button onClick={exportExcel} className="w-full px-6 py-4 text-left text-xs font-black uppercase tracking-widest hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-4 text-emerald-600 transition-colors">
                  <div className="p-2 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg></div>
                  Export Excel Data
                </button>
                <button onClick={exportPDF} className="w-full px-6 py-4 text-left text-xs font-black uppercase tracking-widest hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-4 text-rose-500 transition-colors">
                  <div className="p-2 bg-rose-50 dark:bg-rose-900/20 rounded-lg"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"/></svg></div>
                  Generate PDF Report
                </button>
                <div className="border-t border-slate-100 dark:border-slate-800 mx-4 my-2"></div>
                <button onClick={() => fileInputRef.current?.click()} className="w-full px-6 py-4 text-left text-xs font-black uppercase tracking-widest hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-4 text-amber-600 transition-colors">
                  <div className="p-2 bg-amber-50 dark:bg-amber-900/20 rounded-lg"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg></div>
                  Restore / Sync DB
                </button>
              </div>
            )}
          </div>
          {isEasyPass && (
            <button onClick={() => setShowMagicImport(true)} className="px-6 py-4 rounded-2xl bg-slate-900 dark:bg-slate-800 border border-slate-800 text-white font-black text-xs uppercase tracking-widest flex items-center gap-3 hover:bg-black transition-all shadow-lg active:scale-95">
              <svg className="w-5 h-5 text-cyan-400 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
              AI Manifest Scan
            </button>
          )}
          <button onClick={handleNew} className="px-8 py-4 rounded-2xl bg-blue-600 text-white font-black text-xs uppercase tracking-widest flex items-center gap-3 hover:bg-blue-700 transition-all shadow-xl shadow-blue-500/20 active:scale-95">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4" /></svg>
            Add Record
          </button>
        </div>
      </div>

      <input type="file" ref={fileInputRef} className="hidden" accept=".xlsx, .xls" onChange={restoreFromExcel} />

      {/* AI Intelligence Block */}
      {analysis && (
        <div className="bg-white dark:bg-slate-900 border-2 border-blue-500/30 p-10 rounded-[2.5rem] shadow-2xl animate-slideUp relative group overflow-hidden">
          <div className="absolute top-0 right-0 p-8">
            <button onClick={() => setAnalysis(null)} className="p-3 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-2xl transition-all">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
          <div className="flex items-center gap-6 mb-8">
             <div className="w-16 h-16 rounded-2xl bg-blue-600 flex items-center justify-center text-white shadow-xl shadow-blue-500/20">
                <svg className="w-10 h-10 animate-bounce" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
             </div>
             <div>
                <h4 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tight">AI Case Insights</h4>
                <p className="text-xs font-bold text-blue-600 uppercase tracking-widest mt-1">Operational Profile: {analysis.client}</p>
             </div>
          </div>
          <div className="bg-slate-50 dark:bg-slate-800/60 p-10 rounded-[2rem] border border-slate-100 dark:border-slate-800 text-slate-700 dark:text-slate-300 text-base leading-relaxed whitespace-pre-line shadow-inner">
            {analysis.text}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        {isEasyPass && (
          <form onSubmit={handlePassCommand} className="md:col-span-5 relative group">
            <input value={passCommand} onChange={(e) => setPassCommand(e.target.value)} placeholder="Quick Pass: Flight ID (e.g. EK384)" className="w-full bg-slate-950 border-2 border-slate-800 focus:border-cyan-600 text-cyan-400 font-mono pl-8 pr-24 py-5 rounded-2xl outline-none shadow-xl transition-all" />
            <button className="absolute right-3 top-3 bg-cyan-600 hover:bg-cyan-500 text-white px-5 py-3 rounded-xl text-[10px] font-black uppercase shadow-lg transition-colors tracking-widest">Execute</button>
            {passFeedback && <div className={`absolute -top-12 left-0 px-4 py-2 text-[10px] font-black uppercase rounded-xl border animate-fadeIn shadow-lg ${passFeedback.type === 'success' ? 'bg-emerald-50 text-emerald-600 border-emerald-200' : 'bg-rose-50 text-rose-600 border-rose-200'}`}>{passFeedback.msg}</div>}
          </form>
        )}
        <div className={`${isEasyPass ? 'md:col-span-4' : 'md:col-span-8'} flex items-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-6 rounded-2xl shadow-sm`}>
           <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mr-6">Filter View:</span>
           <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="w-full bg-transparent py-5 text-xs font-bold text-slate-700 dark:text-slate-200 outline-none cursor-pointer">
             <option value="All">All Case Records</option>
             <option value="Pending">Queue: Pending</option>
             <option value="In Progress">Processing: Active</option>
             <option value="Completed">Archive: Completed</option>
           </select>
        </div>
        <button onClick={() => setShowStaleOnly(!showStaleOnly)} className={`md:col-span-3 px-6 py-5 rounded-2xl font-black text-[10px] uppercase border-2 transition-all tracking-widest ${showStaleOnly ? 'bg-amber-50 border-amber-300 text-amber-700 shadow-inner' : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-400 hover:border-amber-300'}`}>
          Stale Alerts (>7d)
        </button>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col transition-all">
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left border-collapse min-w-[1600px]">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/50">
                <th className="sticky top-0 z-40 bg-slate-50 dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 px-8 py-6"><SortBtn label="Client Info" columnKey="clientName" /></th>
                <th className="sticky top-0 z-40 bg-slate-50 dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 px-6 py-6"><SortBtn label="Passport Ref" columnKey="passportNumber" /></th>
                <th className="border-b px-6 py-6"><SortBtn label="Capacity (Pax)" columnKey="paxCount" /></th>
                {isEasyPass && (
                  <>
                    <th className="border-b px-6 py-6"><SortBtn label="Arrival Date" columnKey="arrivalDate" /></th>
                    <th className="border-b px-6 py-6"><SortBtn label="Type" columnKey="visaType" /></th>
                  </>
                )}
                <th className="border-b px-6 py-6"><SortBtn label="Current Status" columnKey="status" /></th>
                {isEasyPass && <th className="border-b px-6 py-6"><SortBtn label="Finalized At" columnKey="completedAt" /></th>}
                <th className="border-b px-6 py-6"><SortBtn label="Sale (THB)" columnKey="price" /></th>
                <th className="border-b px-6 py-6"><SortBtn label="Net Profit" columnKey="profit" /></th>
                <th className="border-b px-8 py-6 text-right text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Row Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
              {filteredAndSortedApps.length > 0 ? (
                filteredAndSortedApps.map((app) => {
                  const profit = parseNum(app.price) - parseNum(app.costPrice);
                  const stale = app.status === 'Pending' && isStale(app.createdAt);
                  const isAnalyzing = analyzingId === app.id;
                  const isDone = app.status === 'Completed';
                  
                  return (
                    <tr key={app.id} className={`group hover:bg-blue-50/80 dark:hover:bg-blue-900/20 transition-all cursor-default ${stale ? 'bg-amber-50/40 dark:bg-amber-900/10' : ''}`}>
                      <td className="px-8 py-6 border-l-4 border-transparent group-hover:border-blue-600 transition-all">
                        <div className="flex flex-col">
                          <span className={`font-black text-slate-900 dark:text-slate-100 text-sm truncate max-w-[220px] ${isDone ? 'line-through decoration-slate-300 opacity-60' : ''}`}>
                            {isEasyPass ? `Passenger Of ${app.flightNo || 'TBA'}` : app.clientName}
                          </span>
                          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">{app.nationality}</span>
                        </div>
                      </td>
                      <td className="px-6 py-6">
                        <span className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-mono text-xs font-black text-slate-600 tracking-tighter shadow-sm">
                          {maskPassport(app.passportNumber)}
                        </span>
                      </td>
                      <td className="px-6 py-6">
                        <span className="px-4 py-1 bg-blue-50 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400 text-[10px] font-black rounded-lg border border-blue-100 dark:border-blue-800 uppercase tracking-widest">
                          {app.paxCount || 1} Pax
                        </span>
                      </td>
                      {isEasyPass && (
                        <>
                          <td className="px-6 py-6">
                            <div className="flex flex-col"><span className="text-xs font-black text-slate-800 dark:text-slate-200">{app.flightNo}</span><span className="text-[9px] text-slate-400 uppercase tracking-widest">{app.arrivalDate} @ {app.arrivalTime}</span></div>
                          </td>
                          <td className="px-6 py-6">
                            <span className="text-[9px] font-black bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 px-3 py-1 rounded-lg border border-indigo-100 dark:border-indigo-800 uppercase tracking-widest">
                              {app.visaType || 'Arrival'}
                            </span>
                          </td>
                        </>
                      )}
                      <td className="px-6 py-6">
                        <span className={`text-[9px] font-black uppercase px-3 py-1 rounded-full border tracking-widest shadow-sm ${
                          isDone ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 
                          app.status === 'Pending' ? 'bg-amber-50 text-amber-600 border-amber-100' :
                          'bg-blue-50 text-blue-600 border-blue-100'
                        }`}>
                          {app.status}
                        </span>
                      </td>
                      {isEasyPass && (
                        <td className="px-6 py-6">
                          {app.completedAt ? (
                            <div className="flex flex-col">
                              <span className="text-[10px] font-black text-blue-700 dark:text-blue-400 uppercase">{new Date(app.completedAt).toLocaleDateString()}</span>
                              <span className="text-[8px] text-slate-400 uppercase mt-0.5">{new Date(app.completedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                            </div>
                          ) : <span className="text-[10px] text-slate-300 italic">No Data</span>}
                        </td>
                      )}
                      <td className="px-6 py-6 font-mono text-sm font-black text-slate-900 dark:text-slate-100">฿{parseNum(app.price).toLocaleString()}</td>
                      <td className="px-6 py-6">
                        <span className={`text-[11px] font-black px-4 py-1.5 rounded-full shadow-sm ${profit >= 0 ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-rose-50 text-rose-600 border border-rose-100'}`}>
                          {profit >= 0 ? '+' : ''}{profit.toLocaleString()}
                        </span>
                      </td>
                      <td className="px-8 py-6 text-right">
                         <div className="flex items-center justify-end gap-3 opacity-0 group-hover:opacity-100 transition-all transform translate-x-4 group-hover:translate-x-0">
                           <button 
                             onClick={() => { 
                               setAnalyzingId(app.id); 
                               analyzeNotes(app.notes, app.clientName).then(t => { 
                                 setAnalysis({ text: t, client: app.clientName }); 
                                 setAnalyzingId(null); 
                                 window.scrollTo({ top: 0, behavior: 'smooth' }); 
                               }); 
                             }} 
                             className={`p-3 rounded-2xl transition-all shadow-md hover:scale-125 hover:shadow-lg ${isAnalyzing ? 'bg-blue-600 text-white animate-spin' : 'text-blue-600 bg-blue-50 hover:bg-blue-600 hover:text-white'}`}
                             title="AI Analysis"
                           >
                             <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                           </button>
                           <button onClick={() => handleEdit(app)} className="p-3 text-slate-500 bg-slate-100 hover:bg-slate-900 hover:text-white rounded-2xl transition-all shadow-md hover:scale-125 hover:shadow-lg" title="Edit">
                             <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2.25 2.25 0 113.182 3.182L12.75 22.511l-4.509 1.252 1.252-4.509L21.586 4.586z" /></svg>
                           </button>
                           <button onClick={() => handleDelete(app.id)} className="p-3 text-rose-500 bg-rose-50 hover:bg-rose-600 hover:text-white rounded-2xl transition-all shadow-md hover:scale-125 hover:shadow-lg" title="Delete">
                             <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                           </button>
                         </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr><td colSpan={13} className="px-8 py-32 text-center text-slate-400 font-black uppercase tracking-[0.4em] italic opacity-40">Operational Database Empty</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showForm && (
        <ApplicationForm 
          service={service} 
          onSave={(a) => { 
            const existing = apps.find(x => x.id === a.id);
            if (a.status === 'Completed' && (!existing || existing.status !== 'Completed')) {
              a.completedAt = new Date().toISOString();
            } else if (a.status !== 'Completed') {
              a.completedAt = undefined;
            }
            saveApplication(a); 
            setShowForm(false); 
            loadData(); 
          }} 
          onCancel={() => setShowForm(false)} 
          initialData={editingApp} 
        />
      )}

      {showMagicImport && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-md" onClick={() => setShowMagicImport(false)} />
          <div className="relative w-full max-w-4xl bg-slate-900 border border-slate-700 rounded-[3rem] p-12 shadow-[0_30px_100px_rgba(0,0,0,0.6)] animate-slideUp overflow-hidden">
            <h3 className="text-3xl font-black text-white uppercase tracking-widest mb-10 flex items-center gap-6">
               <div className="p-4 bg-cyan-600 rounded-3xl shadow-xl shadow-cyan-600/30"><svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M13 10V3L4 14h7v7l9-11h-7z" /></svg></div>
               Immigration Manifest Intelligence
            </h3>
            {!extractedData ? (
              <div className="space-y-8">
                <textarea 
                   value={magicText} 
                   onChange={(e) => setMagicText(e.target.value)} 
                   placeholder="PASTE ARRIVAL MANIFEST HERE..." 
                   className="w-full h-80 bg-slate-950 border-2 border-slate-800 text-cyan-50 font-mono text-sm p-8 rounded-[2.5rem] outline-none focus:border-cyan-600 transition-all shadow-inner resize-none custom-scrollbar" 
                />
                <button 
                   onClick={handleMagicImport} 
                   disabled={isExtracting || !magicText.trim()} 
                   className="w-full py-6 bg-cyan-600 hover:bg-cyan-500 text-white font-black uppercase tracking-[0.3em] rounded-2xl transition-all shadow-2xl shadow-cyan-900/40 disabled:opacity-50 flex items-center justify-center gap-3"
                >
                  {isExtracting ? (
                    <><svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> Parsing Neural Data...</>
                  ) : 'Start Intelligent Extraction'}
                </button>
              </div>
            ) : (
              <div className="space-y-8">
                <div className="bg-slate-950 rounded-[2rem] border border-slate-800 p-10 max-h-80 overflow-y-auto custom-scrollbar shadow-inner">
                   <p className="text-[10px] font-black text-slate-500 mb-6 uppercase tracking-[0.4em]">Extracted Manifest Records ({extractedData.length})</p>
                   {extractedData.map((d, i) => (
                     <div key={i} className="py-4 border-b border-slate-800 text-xs font-mono flex justify-between items-center group/row">
                       <span className={`${d.process === 'done' ? 'text-slate-500 line-through opacity-50' : 'text-cyan-400'} font-bold flex items-center gap-3`}>
                         <div className={`w-2 h-2 rounded-full ${d.process === 'done' ? 'bg-slate-700' : 'bg-cyan-500 shadow-[0_0_10px_rgba(6,182,212,0.5)]'}`}></div>
                         {d.flightNo} (Pax: {d.paxCount || 1}) {d.process === 'done' ? '[ARCHIVED]' : ''}
                       </span>
                       <span className="text-slate-500 group-hover/row:text-slate-300 transition-colors uppercase tracking-widest">{d.date} @ {d.time}</span>
                     </div>
                   ))}
                </div>
                <div className="flex gap-4">
                  <button onClick={() => setExtractedData(null)} className="flex-1 py-5 bg-slate-800 text-white text-xs font-black uppercase tracking-[0.2em] rounded-2xl hover:bg-slate-700 transition-all border border-slate-700">New Scan</button>
                  <button 
                     onClick={saveExtracted} 
                     className="flex-[2] py-5 bg-emerald-600 hover:bg-emerald-500 text-white font-black uppercase tracking-[0.3em] rounded-2xl transition-all shadow-2xl shadow-emerald-900/40"
                  >
                    Commit Verified Records
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { height: 10px; width: 8px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: #f8fafc; }
        .dark .custom-scrollbar::-webkit-scrollbar-track { background: #0f172a; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 20px; border: 3px solid #f8fafc; }
        .dark .custom-scrollbar::-webkit-scrollbar-thumb { background: #334155; border: 3px solid #0f172a; }
      `}</style>
    </div>
  );
};

export default ApplicationList;
