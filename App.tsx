
import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import ApplicationList from './components/ApplicationList';
import { SERVICES } from './constants';

type Theme = 'light' | 'dark' | 'system';

const App: React.FC = () => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [activeView, setActiveView] = useState('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [theme, setTheme] = useState<Theme>(() => {
    const saved = localStorage.getItem('theme') as Theme;
    return saved || 'system';
  });

  useEffect(() => {
    const root = window.document.documentElement;
    const applyTheme = (t: Theme) => {
      root.classList.remove('light', 'dark');
      if (t === 'system') {
        const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
        root.classList.add(systemTheme);
      } else {
        root.classList.add(t);
      }
    };

    applyTheme(theme);
    localStorage.setItem('theme', theme);

    if (theme === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const handleChange = () => applyTheme('system');
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    }
  }, [theme]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (loginEmail && loginPassword) {
      setIsLoggedIn(true);
    }
  };

  const renderContent = () => {
    if (activeView === 'dashboard' || activeView === 'visa-portal') {
      return <Dashboard onSelectService={setActiveView} forceVisaView={activeView === 'visa-portal'} />;
    }

    const selectedService = SERVICES.find(s => s.id === activeView);
    if (selectedService) {
      return (
        <div className="animate-fadeIn">
          <button 
            onClick={() => setActiveView(selectedService.category === 'Visa Extension' ? 'visa-portal' : 'dashboard')}
            className="mb-6 flex items-center gap-2 text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 font-medium transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
            Back to Portal
          </button>
          <ApplicationList service={selectedService} />
        </div>
      );
    }

    return (
      <div className="flex items-center justify-center h-[60vh] text-slate-400">
        View not implemented yet.
      </div>
    );
  };

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-6">
        <div className="w-full max-w-md bg-white dark:bg-slate-800 rounded-[2.5rem] shadow-2xl p-10 space-y-8 animate-slideUp">
          <div className="text-center space-y-2">
            <div className="w-20 h-20 bg-blue-600 rounded-3xl mx-auto flex items-center justify-center text-white shadow-xl shadow-blue-500/30">
              <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 11c0 3.517-1.009 6.799-2.753 9.571m-3.44-4.514A9.01 9.01 0 0012 20.399a9.003 9.003 0 0012-8.41c0-1.12-.205-2.192-.58-3.181M12 11V3m0 8c1.657 0 3-1.343 3-3S13.657 5 12 5 9 6.343 9 8s1.343 3 3 3z" /></svg>
            </div>
            <h1 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tight">VisaCMS Admin Panel</h1>
            <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">Authorized Access Only</p>
          </div>
          <form onSubmit={handleLogin} className="space-y-4">
            <input 
              type="email" 
              placeholder="Admin Email" 
              className="w-full px-6 py-4 rounded-2xl bg-slate-50 dark:bg-slate-700 border-2 border-slate-100 dark:border-slate-600 outline-none focus:border-blue-500 transition-all text-sm font-medium"
              value={loginEmail}
              onChange={(e) => setLoginEmail(e.target.value)}
              required
            />
            <input 
              type="password" 
              placeholder="Password" 
              className="w-full px-6 py-4 rounded-2xl bg-slate-50 dark:bg-slate-700 border-2 border-slate-100 dark:border-slate-600 outline-none focus:border-blue-500 transition-all text-sm font-medium"
              value={loginPassword}
              onChange={(e) => setLoginPassword(e.target.value)}
              required
            />
            <button type="submit" className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white font-black uppercase tracking-widest rounded-2xl shadow-lg transition-all transform active:scale-95">
              Secure Login
            </button>
          </form>
          <p className="text-center text-[10px] text-slate-400 font-bold uppercase tracking-widest">Powered by Gemini Intelligent Systems</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-slate-50 dark:bg-slate-950 relative overflow-x-hidden transition-colors duration-300">
      <Sidebar 
        onSelectView={setActiveView} 
        activeView={activeView} 
        isOpen={isSidebarOpen} 
        onClose={() => setIsSidebarOpen(false)} 
        theme={theme}
        onThemeChange={setTheme}
      />
      
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile Top Header */}
        <header className="lg:hidden bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 py-3 flex items-center justify-between sticky top-0 z-30 transition-colors">
          <div className="flex items-center gap-2 font-bold text-blue-800 dark:text-blue-400">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            <span>VisaCMS</span>
          </div>
          <button 
            onClick={() => setIsSidebarOpen(true)}
            className="p-2 bg-slate-50 dark:bg-slate-800 rounded-lg text-slate-600 dark:text-slate-300"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16m-7 6h7" /></svg>
          </button>
        </header>

        <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto">
          <div className="max-w-7xl mx-auto">
            {renderContent()}
          </div>
        </main>
      </div>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fadeIn { animation: fadeIn 0.4s ease-out forwards; }
        .animate-slideUp { animation: slideUp 0.3s cubic-bezier(0, 0, 0.2, 1) forwards; }
        
        @media (max-width: 640px) {
          .overflow-x-auto {
            -webkit-overflow-scrolling: touch;
          }
        }
      `}</style>
    </div>
  );
};

export default App;
