import React, { useState, useEffect } from 'react';
import { 
  ShieldAlert, Camera as CameraIcon, Search, Navigation, 
  BarChart3, AlertTriangle, Eye, 
  Activity, Clock, ChevronRight, CheckCircle2,
  MapPin, FileSearch
} from 'lucide-react';
import { api } from '../lib/api';

interface NavItem {
  id: string;
  code: string;
  label: string;
  icon: React.ElementType;
  badge?: number;
}

interface DashboardLayoutProps {
  currentTab: string;
  onSelectTab: (tab: string, param?: string) => void;
  activeAlertCount?: number;
  mode: 'live' | 'demo';
  onToggleMode: (newMode: 'live' | 'demo') => void;
  onReloadData?: () => void;
  children: React.ReactNode;
}

export const DashboardLayout: React.FC<DashboardLayoutProps> = ({
  currentTab,
  onSelectTab,
  activeAlertCount = 0,
  mode,
  onToggleMode,
  onReloadData,
  children
}) => {
  const [timeStr, setTimeStr] = useState<string>('');
  const [utcTimeStr, setUtcTimeStr] = useState<string>('');
  const [backendOnline, setBackendOnline] = useState<boolean>(true);
  const [isDemoLoading, setIsDemoLoading] = useState<boolean>(false);
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const [globalSearch, setGlobalSearch] = useState<string>('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTimeStr(now.toLocaleTimeString('en-GB', { hour12: false }));
      setUtcTimeStr(now.toISOString().slice(11, 19));
    };
    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    api.getHealth()
      .then(() => setBackendOnline(true))
      .catch(() => setBackendOnline(false));

    const poll = setInterval(() => {
      api.getHealth()
        .then(() => setBackendOnline(true))
        .catch(() => setBackendOnline(false));
    }, 20000);
    return () => clearInterval(poll);
  }, []);

  const handleLoadDemo = async () => {
    setIsDemoLoading(true);
    try {
      const res = await api.loadDemoData();
      setActionNotice(`Demo dataset populated (${res.demo_vehicles_count} vehicles, 5,000+ reads).`);
      onToggleMode('demo');
      if (onReloadData) onReloadData();
      setTimeout(() => setActionNotice(null), 3500);
    } catch (err: any) {
      console.error('Failed to load demo data:', err);
    } finally {
      setIsDemoLoading(false);
    }
  };

  const handleClearDemo = async () => {
    setIsDemoLoading(true);
    try {
      await api.clearDemoData();
      setActionNotice('Demo dataset purged. Pure live operations active.');
      onToggleMode('live');
      if (onReloadData) onReloadData();
      setTimeout(() => setActionNotice(null), 3500);
    } catch (err: any) {
      console.error('Failed to clear demo data:', err);
    } finally {
      setIsDemoLoading(false);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!globalSearch.trim()) return;
    const query = globalSearch.trim().toUpperCase();
    onSelectTab('vehicles', query);
  };

  const navSections = [
    {
      title: 'PERCEPTION & GRID',
      items: [
        { id: 'dashboard', code: '01', label: 'Command Overview', icon: Activity },
        { id: 'camera', code: '02', label: 'Device Optical ANPR', icon: Eye },
        { id: 'map', code: '03', label: 'Surveillance GIS Map', icon: MapPin },
        { id: 'cameras', code: '04', label: 'Camera Sensor Grid', icon: CameraIcon },
      ]
    },
    {
      title: 'VEHICLE INTELLIGENCE',
      items: [
        { id: 'vehicles', code: '05', label: 'Vehicle Query & Dossier', icon: Search },
        { id: 'trajectory', code: '06', label: 'Trajectory Reconstruction', icon: Navigation },
        { id: 'investigation', code: '07', label: 'Vehicle Investigation', icon: FileSearch },
      ]
    },
    {
      title: 'OPERATIONS & THREATS',
      items: [
        { id: 'alerts', code: '08', label: 'Threat Incidents', icon: AlertTriangle, badge: activeAlertCount },
        { id: 'blacklist', code: '09', label: 'Watchlist Registry', icon: ShieldAlert },
        { id: 'analytics', code: '10', label: 'Traffic Flow Analytics', icon: BarChart3 }
      ]
    }
  ];

  const allNavItems = navSections.flatMap(s => s.items);
  const currentNav = allNavItems.find(i => i.id === currentTab) || allNavItems[0];

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#f1f5f9] text-slate-800 font-sans antialiased">
      {/* ------------------------------------------------------------- */}
      {/* 1. PROFESSIONAL COMMAND WHITE SIDEBAR                         */}
      {/* ------------------------------------------------------------- */}
      <aside className="w-64 flex-shrink-0 bg-white border-r border-slate-200/90 flex flex-col z-30 select-none shadow-xs">
        {/* Logo & Brand Identity */}
        <div 
          onClick={() => onSelectTab('dashboard')}
          className="h-16 px-4 flex items-center space-x-3 cursor-pointer hover:bg-slate-50/60 transition-colors shrink-0"
        >
          <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white font-sans font-bold text-base shadow-xs shrink-0">
            N
          </div>
          <div className="min-w-0 flex-1">
            <div className="font-bold tracking-wider text-slate-900 text-sm leading-tight">
              NAYAN
            </div>
            <div className="text-[8.5px] font-mono tracking-wider text-slate-400 mt-1 uppercase truncate font-medium">
              Networked AI Yield & ANPR
            </div>
          </div>
        </div>

        {/* Navigation Links with Section Headers */}
        <nav className="px-3 py-2 space-y-5 overflow-y-auto custom-scrollbar flex-1">
          {navSections.map((section, sIdx) => (
            <div key={sIdx} className="space-y-1">
              <div className="px-3 pb-1.5 text-[9.5px] font-mono font-bold uppercase tracking-widest text-slate-400">
                {section.title}
              </div>
              <div className="space-y-1">
                {section.items.map((item) => {
                  const Icon = item.icon;
                  const isActive = currentTab === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => onSelectTab(item.id)}
                      className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs transition-colors cursor-pointer group ${
                        isActive
                          ? 'bg-[#edf5ff] text-blue-600 font-bold relative before:absolute before:left-0 before:top-2 before:bottom-2 before:w-[3.5px] before:bg-blue-600 before:rounded-r-full'
                          : 'text-slate-700 hover:text-slate-900 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center space-x-3 min-w-0">
                        <Icon 
                          className={`w-5 h-5 shrink-0 transition-colors ${
                            isActive ? 'text-blue-600' : 'text-slate-400 group-hover:text-slate-600'
                          }`} 
                          strokeWidth={1.8}
                        />
                        <span className={`truncate text-xs ${isActive ? 'font-bold' : 'font-medium'}`}>
                          {item.label}
                        </span>
                      </div>

                      {item.badge !== undefined && item.badge > 0 && (
                        <div className="flex items-center gap-1 shrink-0 ml-1">
                          <span className="px-1.5 py-0.2 rounded font-mono text-[9px] font-bold bg-rose-100 text-rose-700 border border-rose-200">
                            {item.badge}
                          </span>
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
      </aside>

      {/* ------------------------------------------------------------- */}
      {/* 2. MAIN LAYOUT SHELL                                          */}
      {/* ------------------------------------------------------------- */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* COMPACT ENTERPRISE TOP CONTROL HEADER (52px) */}
        <header className="h-[52px] bg-white border-b border-slate-200 px-5 flex items-center justify-between z-20 shrink-0">
          {/* Section Breadcrumb & Status */}
          <div className="flex items-center space-x-2.5 min-w-0">
            <h2 className="text-sm font-bold text-slate-900 tracking-tight truncate">
              {currentNav.label}
            </h2>
            <span className="hidden md:inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-50 text-emerald-700 border border-emerald-200/70">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              SURVEILLANCE ACTIVE
            </span>
          </div>

          {/* Integrated Global Quick Search */}
          <div className="hidden md:flex items-center max-w-sm w-full mx-4">
            <form onSubmit={handleSearchSubmit} className="relative w-full">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={globalSearch}
                onChange={e => setGlobalSearch(e.target.value)}
                placeholder="Lookup plate or node (e.g. DL 99 ZZ 0001)..."
                className="w-full pl-8 pr-8 py-1.5 rounded border border-slate-200 bg-slate-50 text-xs font-mono placeholder:text-slate-400 focus:outline-none focus:bg-white focus:border-blue-500 transition-colors"
              />
              <kbd className="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] font-mono text-slate-400 bg-slate-200/70 px-1 py-0.2 rounded">
                ↵
              </kbd>
            </form>
          </div>

          {/* Right Operational Controls & Clocks */}
          <div className="flex items-center space-x-3 shrink-0">
            {/* Live Action Notice banner */}
            {actionNotice && (
              <div className="hidden xl:flex items-center gap-1.5 px-2.5 py-1 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-mono animate-fadeIn">
                <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" />
                <span className="truncate max-w-xs">{actionNotice}</span>
              </div>
            )}

            {/* Dual Time Readout (IST / UTC) */}
            <div className="hidden lg:flex items-center space-x-2 text-[11px] font-mono text-slate-600 bg-slate-50 px-2.5 py-1 rounded border border-slate-200">
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              <span><b>{timeStr}</b> <span className="text-[9px] text-slate-400">IST</span></span>
              <span className="text-slate-300">|</span>
              <span className="text-slate-500">{utcTimeStr} <span className="text-[9px] text-slate-400">UTC</span></span>
            </div>
          </div>
        </header>

        {/* WORKSPACE CONTENT AREA */}
        <main className="flex-1 overflow-y-auto p-4 md:p-5 bg-[#f1f5f9]">
          <div className="max-w-[1600px] mx-auto space-y-4">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};

export default DashboardLayout;
