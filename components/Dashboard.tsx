
import React, { useState, useEffect, useMemo } from 'react';
import { ServiceCategory, VisaApplication } from '../types';
import { SERVICES } from '../constants';
import { getApplications } from '../services/dataStore';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, 
  ResponsiveContainer, Cell, PieChart, Pie, Legend, AreaChart, Area
} from 'recharts';

interface DashboardProps {
  onSelectService: (serviceId: string) => void;
  forceVisaView?: boolean;
}

const Dashboard: React.FC<DashboardProps> = ({ onSelectService, forceVisaView }) => {
  const [drillDown, setDrillDown] = useState<string | null>(forceVisaView ? 'visa' : null);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [apps, setApps] = useState<VisaApplication[]>([]);

  useEffect(() => {
    setApps(getApplications());
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

  // --- Financials ---
  const totalRevenue = useMemo(() => apps.reduce((sum, app) => sum + parseNum(app.price), 0), [apps]);
  const totalProfit = useMemo(() => apps.reduce((sum, app) => sum + (parseNum(app.price) - parseNum(app.costPrice)), 0), [apps]);

  // --- Monthly Analysis Logic (Targeting People Count) ---
  const monthlyStats = useMemo(() => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    const thisMonthApps = apps.filter(a => {
      const date = new Date(a.createdAt);
      return date.getMonth() === currentMonth && date.getFullYear() === currentYear;
    });

    const easyPassApps = thisMonthApps.filter(a => a.serviceCategory === ServiceCategory.EASY_PASS);
    
    // Group by Visa Type (Counting PEOPLE/PAX)
    const visaTypeMap = new Map<string, number>();
    // Group by Port/Airport (Counting PEOPLE/PAX)
    const portMap = new Map<string, number>();

    easyPassApps.forEach(app => {
      const vType = app.visaType || 'Arrival (VOA)';
      const port = app.destination || app.embarkation || 'BKK';
      const pax = app.paxCount || 1;

      visaTypeMap.set(vType, (visaTypeMap.get(vType) || 0) + pax);
      portMap.set(port, (portMap.get(port) || 0) + pax);
    });

    const visaData = Array.from(visaTypeMap.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);

    const portData = Array.from(portMap.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);

    return {
      totalPax: easyPassApps.reduce((sum, a) => sum + (a.paxCount || 1), 0),
      visaData,
      portData,
      monthName: now.toLocaleString('default', { month: 'long' })
    };
  }, [apps]);

  // --- 30 Day Daily People Count (Preserving the specific requested chart) ---
  const dailyPeopleTrend = useMemo(() => {
    const data = [];
    const now = new Date();
    for (let i = 29; i >= 0; i--) {
      const d = new Date();
      d.setDate(now.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      
      // We sum paxCount to show "Day by Day People Count"
      const dayPax = apps
        .filter(a => a.createdAt.startsWith(dateStr))
        .reduce((sum, a) => sum + (a.paxCount || 1), 0);

      data.push({
        date: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        count: dayPax
      });
    }
    return data;
  }, [apps]);

  const revenuePerformance = useMemo(() => {
    return Object.values(ServiceCategory).map(cat => ({
      name: cat.replace(' Services', '').replace(' Extension', ''),
      revenue: apps.filter(a => a.serviceCategory === cat).reduce((sum, app) => sum + parseNum(app.price), 0)
    })).filter(item => item.revenue > 0);
  }, [apps]);

  const COLORS = isDarkMode 
    ? ['#60a5fa', '#818cf8', '#34d399', '#fbbf24', '#f87171', '#c084fc', '#2dd4bf']
    : ['#3b82f6', '#6366f1', '#10b981', '#f59e0b', '#ef4444', '#a855f7', '#14b8a6'];

  const Card = ({ title, count, onClick, icon, colorClass }: any) => (
    <button
      onClick={onClick}
      className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-sm hover:shadow-2xl hover:border-blue-300 dark:hover:border-blue-600 transition-all group flex flex-col items-center text-center space-y-4"
    >
      <div className={`p-5 rounded-3xl ${colorClass} group-hover:scale-110 transition-transform shadow-lg`}>
        {icon}
      </div>
      <div>
        <h3 className="text-xl font-black text-slate-900 dark:text-slate-100 uppercase tracking-tight">{title}</h3>
        <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 mt-1 uppercase tracking-widest">{count} Records</p>
      </div>
    </button>
  );

  const MainMenu = () => (
    <div className="space-y-12 animate-fadeIn">
      {/* KPI Overview */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="bg-gradient-to-br from-blue-700 to-blue-900 p-8 rounded-[2.5rem] text-white shadow-2xl relative overflow-hidden group">
          <div className="absolute -right-8 -top-8 w-32 h-32 bg-white/10 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-700"></div>
          <p className="text-blue-200 text-[10px] font-black uppercase tracking-[0.2em]">Current Portfolio Revenue</p>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-4xl font-black tracking-tighter">฿{totalRevenue.toLocaleString()}</span>
          </div>
        </div>

        <div className="bg-gradient-to-br from-indigo-600 to-purple-800 p-8 rounded-[2.5rem] text-white shadow-2xl relative overflow-hidden group">
          <div className="absolute -right-8 -top-8 w-32 h-32 bg-white/10 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-700"></div>
          <p className="text-indigo-100 text-[10px] font-black uppercase tracking-[0.2em]">Estimated Net Profit</p>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-4xl font-black tracking-tighter">฿{totalProfit.toLocaleString()}</span>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 flex flex-col justify-between shadow-xl">
          <div>
            <p className="text-slate-400 dark:text-slate-500 text-[10px] font-black uppercase tracking-[0.2em]">Global PAX Traffic</p>
            <div className="mt-4 flex items-baseline gap-2">
                <span className="text-4xl font-black text-slate-900 dark:text-white tracking-tighter">
                  {apps.reduce((sum, a) => sum + (a.paxCount || 1), 0)}
                </span>
                <span className="text-[10px] font-black text-slate-400 uppercase ml-2 tracking-widest">Total Travelers</span>
            </div>
          </div>
        </div>
      </section>

      {/* Monthly Analysis Section ( centerpiece as requested ) */}
      <section className="space-y-8 bg-slate-50 dark:bg-slate-900/40 p-10 rounded-[4rem] border border-slate-200/60 dark:border-slate-800/60">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex items-center gap-5">
                <div className="w-14 h-14 bg-blue-600 text-white rounded-[1.5rem] flex items-center justify-center shadow-xl shadow-blue-500/20">
                    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
                </div>
                <div>
                    <h3 className="text-3xl font-black text-slate-900 dark:text-white uppercase tracking-tight">Monthly Analysis</h3>
                    <p className="text-[11px] font-black text-slate-400 uppercase tracking-[0.3em]">Easy Pass Performance: {monthlyStats.monthName}</p>
                </div>
            </div>
            <div className="bg-white dark:bg-slate-800 px-8 py-4 rounded-[2rem] border border-slate-100 dark:border-slate-700 shadow-md text-center">
                <span className="text-[10px] font-black text-slate-400 uppercase block mb-1">Total Pax (Monthly)</span>
                <span className="text-3xl font-black text-blue-600 dark:text-blue-400">{monthlyStats.totalPax}</span>
            </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
            {/* Analysis by Visa Type */}
            <div className="bg-white dark:bg-slate-900 p-8 rounded-[3rem] border border-slate-100 dark:border-slate-800 shadow-xl flex flex-col">
                <div className="flex items-center justify-between mb-8">
                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Visa Type Breakdown (People Count)</h4>
                  <span className="text-[8px] font-bold bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-full text-slate-400 uppercase">Interactive</span>
                </div>
                <div className="h-72 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <Pie
                                data={monthlyStats.visaData}
                                cx="50%"
                                cy="50%"
                                innerRadius={70}
                                outerRadius={100}
                                paddingAngle={8}
                                dataKey="value"
                            >
                                {monthlyStats.visaData.map((_, index) => (
                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} stroke="transparent" />
                                ))}
                            </Pie>
                            <Tooltip 
                              cursor={{fill: 'transparent'}}
                              contentStyle={{ borderRadius: '20px', border: 'none', backgroundColor: isDarkMode ? '#0f172a' : '#fff', fontSize: '12px', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
                            />
                            <Legend iconType="circle" verticalAlign="bottom" wrapperStyle={{ fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase', paddingTop: '20px' }} />
                        </PieChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Analysis by Landing Port */}
            <div className="bg-white dark:bg-slate-900 p-8 rounded-[3rem] border border-slate-100 dark:border-slate-800 shadow-xl flex flex-col">
                <div className="flex items-center justify-between mb-8">
                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">People by Landing Airport</h4>
                  <span className="text-[8px] font-bold bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-full text-slate-400 uppercase">Live Metrics</span>
                </div>
                <div className="h-72 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={monthlyStats.portData} layout="vertical" margin={{ left: 20 }}>
                            <XAxis type="number" hide />
                            <YAxis 
                                dataKey="name" 
                                type="category" 
                                axisLine={false} 
                                tickLine={false} 
                                tick={{ fontSize: 10, fill: '#64748b', fontWeight: 'black' }} 
                                width={80} 
                            />
                            <Tooltip 
                                formatter={(v) => `${v} Travelers`} 
                                contentStyle={{ borderRadius: '20px', border: 'none', backgroundColor: isDarkMode ? '#0f172a' : '#fff', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }} 
                            />
                            <Bar dataKey="value" radius={[0, 15, 15, 0]} barSize={30}>
                                {monthlyStats.portData.map((_, index) => (
                                    <Cell key={`port-${index}`} fill={COLORS[(index + 2) % COLORS.length]} />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>
        </div>
      </section>

      {/* Day by Day People Count ( preserved as requested ) */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="bg-white dark:bg-slate-900 p-8 rounded-[3rem] border border-slate-100 dark:border-slate-800 shadow-xl">
                <div className="flex flex-col mb-10">
                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Day-by-Day People Count (30D)</h4>
                  <p className="text-[8px] font-bold text-blue-500 uppercase mt-1">Sum of Daily Passengers (PAX)</p>
                </div>
                <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={dailyPeopleTrend}>
                            <defs>
                                <linearGradient id="colorPax" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4}/>
                                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDarkMode ? "#1e293b" : "#f1f5f9"} />
                            <XAxis 
                                dataKey="date" 
                                axisLine={false} 
                                tickLine={false} 
                                tick={{ fontSize: 8, fill: '#64748b' }} 
                                minTickGap={30} 
                            />
                            <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: '#64748b' }} />
                            <Tooltip 
                                labelStyle={{ fontWeight: 'black', marginBottom: '5px' }}
                                formatter={(v) => [`${v} People`, 'Daily Traffic']}
                                contentStyle={{ borderRadius: '20px', border: 'none', backgroundColor: isDarkMode ? '#0f172a' : '#fff', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }} 
                            />
                            <Area 
                                type="monotone" 
                                dataKey="count" 
                                stroke="#3b82f6" 
                                strokeWidth={5} 
                                fillOpacity={1} 
                                fill="url(#colorPax)" 
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            </div>

            <div className="bg-white dark:bg-slate-900 p-8 rounded-[3rem] border border-slate-100 dark:border-slate-800 shadow-xl">
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-10">Revenue Allocation Matrix</h4>
                <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={revenuePerformance}>
                            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 8, fill: '#64748b', fontWeight: 'bold' }} />
                            <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: '#64748b' }} />
                            <Tooltip 
                                formatter={(v) => `฿${v.toLocaleString()}`} 
                                contentStyle={{ borderRadius: '20px', border: 'none', backgroundColor: isDarkMode ? '#0f172a' : '#fff', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }} 
                            />
                            <Bar dataKey="revenue" radius={[12, 12, 0, 0]} barSize={40}>
                                {revenuePerformance.map((_, index) => (
                                    <Cell key={`bar-${index}`} fill={COLORS[index % COLORS.length]} />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>
      </section>

      {/* Operational Units Grid */}
      <section>
        <div className="flex justify-between items-center mb-8">
          <div className="flex items-center gap-3">
             <div className="w-2 h-8 bg-blue-600 rounded-full"></div>
             <h3 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tight">Active Operational Units</h3>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          <Card title="Visa Extension" count={apps.filter(a => a.serviceCategory === ServiceCategory.VISA_EXTENSION).length} colorClass="bg-blue-100 dark:bg-blue-900/40 text-blue-600" onClick={() => setDrillDown('visa')} icon={<svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>} />
          <Card title="Letter Portal" count={apps.filter(a => a.serviceCategory === ServiceCategory.LETTER).length} colorClass="bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600" onClick={() => onSelectService('letter')} icon={<svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>} />
          <Card title="TM30 Tracking" count={apps.filter(a => a.serviceCategory === ServiceCategory.TM30).length} colorClass="bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600" onClick={() => onSelectService('tm30')} icon={<svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>} />
          <Card title="Easy Pass Hub" count={apps.filter(a => a.serviceCategory === ServiceCategory.EASY_PASS).length} colorClass="bg-amber-100 dark:bg-amber-900/40 text-amber-600" onClick={() => onSelectService('easypass')} icon={<svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>} />
          <Card title="Ticket Matrix" count={apps.filter(a => a.serviceCategory === ServiceCategory.TICKETING).length} colorClass="bg-rose-100 dark:bg-rose-900/40 text-rose-600" onClick={() => onSelectService('ticketing')} icon={<svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 012-2h10a2 2 0 012 2v14a2 2 0 01-2 2H7a2 2 0 01-2-2V5z" /></svg>} />
        </div>
      </section>
    </div>
  );

  const VisaSubMenu = () => (
    <div className="space-y-8 animate-fadeIn">
      {!forceVisaView && (
        <button onClick={() => setDrillDown(null)} className="flex items-center gap-3 text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 font-black uppercase text-[10px] tracking-widest transition-all">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
          Return to Command Center
        </button>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        <Card title="Walk In - IT" count={apps.filter(a => a.subService === 'Walk In Extension' && a.office === 'IT').length} colorClass="bg-blue-50 dark:bg-blue-900/30 text-blue-500" onClick={() => onSelectService('walk-in-it')} icon={<svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>} />
        <Card title="Walk In - GC" count={apps.filter(a => a.subService === 'Walk In Extension' && a.office === 'GC').length} colorClass="bg-blue-50 dark:bg-blue-900/30 text-blue-500" onClick={() => onSelectService('walk-in-gc')} icon={<svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>} />
        <Card title="VIP - IT" count={apps.filter(a => a.subService === 'VIP Extension' && a.office === 'IT').length} colorClass="bg-purple-50 dark:bg-purple-900/30 text-purple-500" onClick={() => onSelectService('vip-it')} icon={<svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-7.714 2.143L11 21l-2.286-6.857L1 12l7.714-2.143L11 3z" /></svg>} />
        <Card title="VIP - GC" count={apps.filter(a => a.subService === 'VIP Extension' && a.office === 'GC').length} colorClass="bg-purple-50 dark:bg-purple-900/30 text-purple-500" onClick={() => onSelectService('vip-gc')} icon={<svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-7.714 2.143L11 21l-2.286-6.857L1 12l7.714-2.143L11 3z" /></svg>} />
        <Card title="E Extension" count={apps.filter(a => a.subService === 'E Extension').length} colorClass="bg-cyan-50 dark:bg-cyan-900/30 text-cyan-500" onClick={() => onSelectService('e-ext-gc')} icon={<svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M12 11c0 3.517-1.009 6.799-2.753 9.571m-3.44-4.514A9.01 9.01 0 0012 20.399a9.003 9.003 0 0012-8.41c0-1.12-.205-2.192-.58-3.181M12 11V3m0 8c1.657 0 3-1.343 3-3S13.657 5 12 5 9 6.343 9 8s1.343 3 3 3z" /></svg>} />
      </div>
    </div>
  );

  return (
    <div className="space-y-10 pb-20">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
            <h2 className="text-4xl font-black text-slate-900 dark:text-white tracking-tighter uppercase">
            {drillDown === 'visa' ? 'Visa Operations' : 'Master Command Panel'}
            </h2>
            <p className="text-slate-400 dark:text-slate-500 text-lg font-medium mt-1">
            {drillDown === 'visa' 
                ? 'Department workflow and deployment logs.' 
                : 'Central intelligence hub for multi-service management.'}
            </p>
        </div>
        <div className="flex items-center gap-3 bg-white dark:bg-slate-900 p-2 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm">
            <div className="px-4 py-2 bg-blue-50 dark:bg-blue-900/30 rounded-xl text-[10px] font-black text-blue-600 uppercase tracking-widest">
                Status: Systems Operational
            </div>
        </div>
      </header>

      {drillDown === 'visa' ? <VisaSubMenu /> : <MainMenu />}
    </div>
  );
};

export default Dashboard;
