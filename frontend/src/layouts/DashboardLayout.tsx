import React, { useState, useEffect } from 'react';
import { 
  ShieldAlert, Camera as CameraIcon, Search, Navigation, 
  BarChart3, AlertTriangle, Radio, Settings, Eye, 
  Activity, Clock, ChevronRight, User, Download, Trash2, CheckCircle2,
  MapPin, Terminal, Server, Database, Cpu
} from 'lucide-react';
import { api } from '../lib/api';
import { isSupabaseConfigured } from '../lib/supabase';

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

  const navItems: NavItem[] = [
    { id: 'dashboard', code: '01', label: 'Command Overview', icon: Activity },
    { id: 'camera', code: '02', label: 'Device Optical ANPR', icon: Eye },
    { id: 'map', code: '03', label: 'Surveillance GIS Map', icon: MapPin },
    { id: 'cameras', code: '04', label: 'Camera Sensor Grid', icon: CameraIcon },
    { id: 'vehicles', code: '05', label: 'Vehicle Query & Dossier', icon: Search },
    { id: 'trajectory', code: '06', label: 'Trajectory Reconstruction', icon: Navigation },
    { id: 'alerts', code: '07', label: 'Threat Incidents', icon: AlertTriangle, badge: activeAlertCount },
    { id: 'blacklist', code: '08', label: 'Watchlist Registry', icon: ShieldAlert },
    { id: 'analytics', code: '09', label: 'Traffic Flow Analytics', icon: BarChart3 },
    { id: 'system', code: '10', label: 'Hardware Telemetry', icon: Radio },
    { id: 'settings', code: '11', label: 'System Configuration', icon: Settings },
  ];

  const currentNav = navItems.find(i => i.id === currentTab) || navItems[0];

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#f1f5f9] text-slate-800 font-sans antialiased">
      {/* ------------------------------------------------------------- */}
      {/* 1. PROFESSIONAL COMMAND NAVY SIDEBAR (#090E1A)                */}
      {/* ------------------------------------------------------------- */}
      <aside className="w-64 flex-shrink-0 bg-[#090e1a] border-r border-slate-800 flex flex-col justify-between z-30 select-none">
        <div className="flex flex-col flex-1 min-h-0">
          {/* Logo & Brand Identity */}
          <div 
            onClick={() => onSelectTab('dashboard')}
            className="h-14 border-b border-slate-800/90 px-4 flex items-center space-x-3 cursor-pointer hover:bg-slate-900/60 transition-colors"
          >
            <div className="w-7 h-7 rounded bg-blue-600 flex items-center justify-center text-white font-mono font-black text-sm border border-blue-400/40 shadow-xs">
              N
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 leading-none">
                <span className="font-mono font-black tracking-wider text-white text-sm">NAYAN</span>
                <span className="text-[9px] font-mono font-bold px-1.5 py-0.2 rounded bg-blue-950 text-blue-300 border border-blue-800/80">
                  ATMS
                </span>
              </div>
              <div className="text-[8px] font-mono tracking-tight text-slate-400 mt-1 uppercase truncate">
                Networked AI Yield & ANPR
              </div>
            </div>
          </div>

          {/* Sub-header status strip */}
          <div className="px-4 py-1.5 bg-[#060a12] border-b border-slate-800/70 flex items-center justify-between text-[9px] font-mono text-slate-400">
            <span className="flex items-center gap-1">
              <span className={`w-1.5 h-1.5 rounded-full ${backendOnline ? 'bg-emerald-500' : 'bg-rose-500'}`} />
              CORE {backendOnline ? 'NOMINAL' : 'FAULT'}
            </span>
            <span className="text-slate-400 uppercase font-semibold">STATION-01</span>
          </div>

          {/* Navigation Links */}
          <nav className="p-2 space-y-0.5 overflow-y-auto flex-1 custom-scrollbar">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => onSelectTab(item.id)}
                  className={`w-full flex items-center justify-between px-2.5 py-2 rounded text-xs transition-colors cursor-pointer group ${
                    isActive
                      ? 'bg-blue-950/60 text-blue-300 font-semibold border-l-2 border-blue-500 pl-2'
                      : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/50 border-l-2 border-transparent'
                  }`}
                >
                  <div className="flex items-center space-x-2.5 min-w-0">
                    <Icon className={`w-3.5 h-3.5 shrink-0 transition-colors ${
                      isActive ? 'text-blue-400' : 'text-slate-400 group-hover:text-slate-300'
                    }`} />
                    <span className="truncate text-[11px] tracking-tight">{item.label}</span>
                  </div>

                  <div className="flex items-center gap-1 shrink-0 ml-1">
                    {item.badge !== undefined && item.badge > 0 ? (
                      <span className="px-1.5 py-0.2 rounded font-mono text-[9px] font-bold bg-rose-950/80 text-rose-300 border border-rose-700/60">
                        {item.badge}
                      </span>
                    ) : (
                      <span className="text-[9px] font-mono text-slate-400 group-hover:text-slate-400">
                        {item.code}
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </nav>
        </div>

        {/* System Telemetry Footnote */}
        <div className="p-3 border-t border-slate-800 bg-[#060a12] text-[10px] text-slate-400 font-mono space-y-1">
          <div className="text-[9px] uppercase tracking-wider text-slate-400 font-bold mb-1">
            Hardware Stack
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-400 flex items-center gap-1">
              <Server className="w-3 h-3 text-slate-400" /> API Engine
            </span>
            <span className="font-semibold text-emerald-400">v1.0 Ready</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-400 flex items-center gap-1">
              <Database className="w-3 h-3 text-slate-400" /> PostgreSQL
            </span>
            <span className="text-slate-300">
              {isSupabaseConfigured ? 'Sync Live' : 'Deterministic'}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-400 flex items-center gap-1">
              <Cpu className="w-3 h-3 text-slate-400" /> Vision OCR
            </span>
            <span className="text-blue-400">OpenCV Heuristic</span>
          </div>
        </div>
      </aside>

      {/* ------------------------------------------------------------- */}
      {/* 2. MAIN LAYOUT SHELL                                          */}
      {/* ------------------------------------------------------------- */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* COMPACT ENTERPRISE TOP CONTROL HEADER (52px) */}
        <header className="h-[52px] bg-white border-b border-slate-200 px-5 flex items-center justify-between z-20 shrink-0">
          {/* Section Breadcrumb & Status */}
          <div className="flex items-center space-x-2.5 min-w-0">
            <div className="flex items-center gap-1.5 text-xs font-mono text-slate-500 shrink-0">
              <span className="font-bold text-slate-400">OPS-{currentNav.code}</span>
              <ChevronRight className="w-3.5 h-3.5 text-slate-300" />
            </div>
            <h2 className="text-sm font-bold text-slate-900 tracking-tight truncate">
              {currentNav.label}
            </h2>
            <span className="hidden md:inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-100 text-slate-600 border border-slate-200">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              SURVEILLANCE ACTIVE
            </span>
          </div>

          {/* Integrated Global Quick Search */}
          <div className="hidden md:flex items-center max-w-xs w-full mx-4">
            <form onSubmit={handleSearchSubmit} className="relative w-full">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={globalSearch}
                onChange={e => setGlobalSearch(e.target.value)}
                placeholder="Lookup plate or node (e.g. DL 99 ZZ 0002)..."
                className="w-full pl-8 pr-8 py-1 rounded border border-slate-200 bg-slate-50 text-xs font-mono placeholder:text-slate-400 focus:outline-none focus:bg-white focus:border-blue-500 transition-colors"
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

            {/* Live Operational Status Badge */}
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-emerald-950/80 text-emerald-400 border border-emerald-500/30 text-[11px] font-mono font-bold tracking-wider">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span>LIVE</span>
            </div>

            {/* Dual Time Readout (IST / UTC) */}
            <div className="hidden lg:flex items-center space-x-2 text-[11px] font-mono text-slate-600 bg-slate-50 px-2.5 py-1 rounded border border-slate-200">
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              <span><b>{timeStr}</b> <span className="text-[9px] text-slate-400">IST</span></span>
              <span className="text-slate-300">|</span>
              <span className="text-slate-500">{utcTimeStr} <span className="text-[9px] text-slate-400">UTC</span></span>
            </div>

            {/* Operator Identifier Badge */}
            <div className="flex items-center space-x-1.5 pl-2 border-l border-slate-200 text-xs">
              <div className="w-6 h-6 rounded bg-slate-100 border border-slate-300 flex items-center justify-center text-slate-700 font-bold text-[10px]">
                <User className="w-3.5 h-3.5" />
              </div>
              <span className="hidden sm:inline font-mono font-semibold text-slate-800 text-[11px]">
                OPS-01
              </span>
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
