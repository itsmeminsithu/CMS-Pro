
import React, { useState, useEffect } from 'react';
import { ServiceCategory } from '../types';
import { SERVICES } from '../constants';
import { getApplications } from '../services/dataStore';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, PieChart, Pie } from 'recharts';

interface DashboardProps {
  onSelectService: (serviceId: string) => void;
  forceVisaView?: boolean;
}

const Dashboard: React.FC<DashboardProps> = ({ onSelectService, forceVisaView }) => {
  const [drillDown, setDrillDown] = useState<string | null>(forceVisaView ? 'visa' : null);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const apps = getApplications();

  useEffect(() => {
    const observer = new MutationObserver(() => {
      setIsDarkMode(document.documentElement.classList.contains('dark'));
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    setIsDarkMode(document.documentElement.classList.contains('dark'));
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (forceVisaView) setDrillDown('visa');
    else setDrillDown(null);
  }, [forceVisaView]);

  const parseNum = (val: string | undefined) => {
    if (!val) return 0;
    return parseFloat(val.replace(/,/g, '')) || 0;
  };

  const totalRevenue = apps.reduce((sum, app) => sum + parseNum(app.price), 0);
  const totalProfit = apps.reduce((sum, app) => sum + (parseNum(app.price) - parseNum(app.costPrice)), 0);

  const revenueByCategory = Object.values(ServiceCategory).map(cat => ({
    name: cat,
    revenue: apps
      .filter(a => a.serviceCategory === cat)
      .reduce((sum, app) => sum + parseNum(app.price), 0)
  })).filter(item => item.revenue > 0);

  const getCount = (categoryId: string) => {
    if (!drillDown) {
      return apps.filter(a => {
        if (categoryId === 'visa') return a.serviceCategory === ServiceCategory.VISA_EXTENSION;
        if (categoryId === 'letter') return a.serviceCategory === ServiceCategory.LETTER;
        if (categoryId === 'tm30') return a.serviceCategory === ServiceCategory.TM30;
        if (categoryId === 'easypass') return a.serviceCategory === ServiceCategory.EASY_PASS;
        if (categoryId === 'ticketing') return a.serviceCategory === ServiceCategory.TICKETING;
        return false;
      }).length;
    }
    const service = SERVICES.find(s => s.id === categoryId);
    if (!service) return 0;
    return apps.filter(a => 
      a.serviceCategory === service.category && 
      a.subService === service.subService &&
      (service.offices.includes('ALL') || a.office === service.offices[0])
    ).length;
  };

  const exportGlobalData = () => {
    const headers = [
      "ID", "Client Name", "Passport", "Nationality", "Category", 
      "SubService", "Office", "Status", "Sale Price", "Cost Price", "Profit", "Created At", "Notes"
    ];
    
    const rows = apps.map(app => {
      const profit = parseNum(app.price) - parseNum(app.costPrice);
      return [
        app.id,
        `"${app.clientName}"`,
        app.passportNumber,
        app.nationality,
        app.serviceCategory,
        app.subService || 'N/A',
        app.office || 'ALL',
        app.status,
        app.price,
        app.costPrice,
        profit.toString(),
        app.createdAt,
        `"${(app.notes || '').replace(/"/g, '""').replace(/\n/g, ' ')}"`
      ];
    });

    const csvContent = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Global_Report_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const COLORS = isDarkMode 
    ? ['#60a5fa', '#818cf8', '#34d399', '#fbbf24', '#f87171']
    : ['#3b82f6', '#6366f1', '#10b981', '#f59e0b', '#ef4444'];

  const Card = ({ title, count, onClick, icon, colorClass }: any) => (
    <button
      onClick={onClick}
      className="bg-white dark:bg-slate-900 p-8 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-xl hover:border-blue-300 dark:hover:border-blue-600 transition-all group flex flex-col items-center text-center space-y-4"
    >
      <div className={`p-4 rounded-xl ${colorClass} group-hover:scale-110 transition-transform`}>
        {icon}
      </div>
      <div>
        <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100">{title}</h3>
        <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mt-1">{count} Active Records</p>
      </div>
    </button>
  );

  const MainMenu = () => (
    <div className="space-y-12">
      <section className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-fadeIn">
        <div className="bg-gradient-to-br from-blue-600 to-blue-800 p-6 rounded-2xl text-white shadow-lg shadow-blue-500/20">
          <p className="text-blue-100 text-sm font-medium uppercase tracking-wider">Total Revenue</p>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-bold">{totalRevenue.toLocaleString()}</span>
            <span className="text-sm opacity-80 font-mono">THB</span>
          </div>
          <div className="mt-4 text-xs bg-blue-500/30 inline-block px-2 py-1 rounded">Gross Inflow</div>
        </div>

        <div className="bg-gradient-to-br from-emerald-500 to-emerald-700 p-6 rounded-2xl text-white shadow-lg shadow-emerald-500/20">
          <p className="text-emerald-50 text-sm font-medium uppercase tracking-wider brightness-150">Total Net Profit</p>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-bold">{totalProfit.toLocaleString()}</span>
            <span className="text-sm opacity-80 font-mono">THB</span>
          </div>
          <div className="mt-4 text-xs bg-white/20 inline-block px-2 py-1 rounded">Margin Calculation</div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 flex flex-col justify-between shadow-sm">
          <div>
            <p className="text-slate-500 dark:text-slate-400 text-sm font-medium uppercase tracking-wider">Total Applications</p>
            <span className="text-3xl font-bold text-slate-800 dark:text-slate-100">{apps.length}</span>
          </div>
          <div className="mt-4 h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
            <div className="h-full bg-blue-500" style={{ width: `${Math.min(100, (apps.length / 100) * 100)}%` }}></div>
          </div>
        </div>
      </section>

      <section>
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>
            Service Departments
          </h3>
          <button 
            onClick={exportGlobalData}
            className="text-xs font-bold text-slate-400 hover:text-blue-600 flex items-center gap-1.5 transition-colors uppercase tracking-widest"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
            Master Excel Export
          </button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-fadeIn">
          <Card 
            title="Visa Extension" 
            count={getCount('visa')}
            colorClass="bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400"
            onClick={() => setDrillDown('visa')}
            icon={<svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>}
          />
          <Card title="Letter Services" count={getCount('letter')} colorClass="bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400" onClick={() => onSelectService('letter')} icon={<svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>} />
          <Card title="TM30 Services" count={getCount('tm30')} colorClass="bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400" onClick={() => onSelectService('tm30')} icon={<svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>} />
          <Card title="Easy Pass Services" count={getCount('easypass')} colorClass="bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400" onClick={() => onSelectService('easypass')} icon={<svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>} />
          <Card title="Ticketing Services" count={getCount('ticketing')} colorClass="bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400" onClick={() => onSelectService('ticketing')} icon={<svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 012-2h10a2 2 0 012 2v14a2 2 0 01-2 2H7a2 2 0 01-2-2V5z" /></svg>} />
        </div>
      </section>

      <section className="bg-white dark:bg-slate-900 p-8 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm animate-fadeIn">
        <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-8 flex items-center gap-2">
          <svg className="w-6 h-6 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
          Revenue Breakdown
        </h3>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={revenueByCategory} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={isDarkMode ? "#1e293b" : "#f1f5f9"} />
                <XAxis type="number" tickFormatter={(val) => `${val / 1000}k`} stroke={isDarkMode ? "#64748b" : "#94a3b8"} />
                <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 12, fill: isDarkMode ? "#94a3b8" : "#475569" }} />
                <Tooltip 
                  formatter={(value) => [`${parseFloat(value as string).toLocaleString()} THB`, 'Revenue']}
                  contentStyle={{ 
                    borderRadius: '12px', 
                    border: 'none', 
                    backgroundColor: isDarkMode ? '#0f172a' : '#fff',
                    color: isDarkMode ? '#f1f5f9' : '#1e293b',
                    boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' 
                  }}
                  itemStyle={{ color: isDarkMode ? '#f1f5f9' : '#1e293b' }}
                />
                <Bar dataKey="revenue" radius={[0, 4, 4, 0]}>
                  {revenueByCategory.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="flex flex-col items-center justify-center">
             <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={revenueByCategory} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={8} dataKey="revenue" stroke="none">
                      {revenueByCategory.map((entry, index) => (
                        <Cell key={`cell-pie-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip 
                      formatter={(val) => `${parseFloat(val as string).toLocaleString()} THB`}
                      contentStyle={{ 
                        borderRadius: '12px', 
                        border: 'none', 
                        backgroundColor: isDarkMode ? '#0f172a' : '#fff',
                        boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' 
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
             </div>
          </div>
        </div>
      </section>
    </div>
  );

  const VisaSubMenu = () => (
    <div className="space-y-6 animate-fadeIn">
      {!forceVisaView && (
        <button onClick={() => setDrillDown(null)} className="flex items-center gap-2 text-slate-500 hover:text-blue-600 dark:hover:text-blue-400 font-medium transition-colors">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
          Back to Portal
        </button>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <Card title="Walk In - IT" count={getCount('walk-in-it')} colorClass="bg-blue-50 dark:bg-blue-900/20 text-blue-500" onClick={() => onSelectService('walk-in-it')} icon={<svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>} />
        <Card title="Walk In - GC" count={getCount('walk-in-gc')} colorClass="bg-blue-50 dark:bg-blue-900/20 text-blue-500" onClick={() => onSelectService('walk-in-gc')} icon={<svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>} />
        <Card title="VIP - IT" count={getCount('vip-it')} colorClass="bg-purple-50 dark:bg-purple-900/20 text-purple-500" onClick={() => onSelectService('vip-it')} icon={<svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-7.714 2.143L11 21l-2.286-6.857L1 12l7.714-2.143L11 3z" /></svg>} />
        <Card title="VIP - GC" count={getCount('vip-gc')} colorClass="bg-purple-50 dark:bg-purple-900/20 text-purple-500" onClick={() => onSelectService('vip-gc')} icon={<svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-7.714 2.143L11 21l-2.286-6.857L1 12l7.714-2.143L11 3z" /></svg>} />
        <Card title="E Extension" count={getCount('e-ext-gc')} colorClass="bg-cyan-50 dark:bg-cyan-900/20 text-cyan-500" onClick={() => onSelectService('e-ext-gc')} icon={<svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M12 11c0 3.517-1.009 6.799-2.753 9.571m-3.44-4.514A9.01 9.01 0 0012 20.399a9.003 9.003 0 0012-8.41c0-1.12-.205-2.192-.58-3.181M12 11V3m0 8c1.657 0 3-1.343 3-3S13.657 5 12 5 9 6.343 9 8s1.343 3 3 3z" /></svg>} />
      </div>
    </div>
  );

  return (
    <div className="space-y-8 pb-12">
      <header>
        <h2 className="text-3xl font-bold text-slate-800 dark:text-white">
          {drillDown === 'visa' ? 'Visa Extension Offices' : 'Business Control Panel'}
        </h2>
        <p className="text-slate-500 dark:text-slate-400 text-lg">
          {drillDown === 'visa' 
            ? 'Select a specific office or extension type to manage applications.' 
            : 'Complete overview of operations and net profitability.'}
        </p>
      </header>

      {drillDown === 'visa' ? <VisaSubMenu /> : <MainMenu />}
    </div>
  );
};

export default Dashboard;
