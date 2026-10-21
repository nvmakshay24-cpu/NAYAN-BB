import React, { useState, useEffect, useRef } from 'react';
import { 
  Home, Video, MapPin, Car, AlertTriangle, BarChart3, Settings, 
  ChevronDown, Search, Clock, CheckCircle2, 
  Eye, Camera as CameraIcon, Navigation, FileSearch, 
  ShieldAlert, Activity, RefreshCw, Zap, Laptop, Database
} from 'lucide-react';
import { api } from '../lib/api';

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

  // Dropdown states
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const navRef = useRef<HTMLDivElement | null>(null);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (navRef.current && !navRef.current.contains(e.target as Node)) {
        setOpenDropdown(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Live clocks
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

  // Backend health polling
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
    setOpenDropdown(null);
    try {
      const res = await api.loadDemoData();
      setActionNotice(`Demo dataset loaded (${res.demo_vehicles_count} vehicles, 5,000+ reads).`);
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
    setOpenDropdown(null);
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

  // Active state determinations
  const isOverviewActive = currentTab === 'dashboard';
  const isCamerasActive = currentTab === 'camera' || currentTab === 'cameras' || currentTab === 'live-anpr';
  const isGisMapActive = currentTab === 'map';
  const isVehicleIntelActive = currentTab === 'vehicles' || currentTab === 'trajectory' || currentTab === 'investigation' || currentTab === 'search';
  const isIncidentsActive = currentTab === 'alerts' || currentTab === 'blacklist';
  const isAnalyticsActive = currentTab === 'analytics';
  const isSettingsActive = currentTab === 'system' || currentTab === 'settings';

  const toggleDropdown = (name: string) => {
    setOpenDropdown(prev => prev === name ? null : name);
  };

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-[#f1f5f9] text-slate-800 font-sans antialiased">
      {/* ------------------------------------------------------------- */}
      {/* 1. TOP HEADER & MODERN FLOATING HORIZONTAL NAVBAR              */}
      {/* ------------------------------------------------------------- */}
      <header className="bg-white border-b border-slate-200/90 shadow-xs z-30 select-none shrink-0 px-4 py-2.5">
        <div className="max-w-[1700px] mx-auto flex items-center justify-between gap-4">
          
          {/* LEFT: BRAND IDENTITY */}
          <div 
            onClick={() => onSelectTab('dashboard')}
            className="flex items-center space-x-3 cursor-pointer group shrink-0"
          >
            <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center text-white font-bold text-base shadow-xs group-hover:bg-blue-700 transition-colors">
              N
            </div>
            <div>
              <div className="font-extrabold tracking-wider text-slate-900 text-sm leading-tight flex items-center gap-1.5">
                NAYAN
                <span className="text-[9px] font-mono font-bold px-1.5 py-0.2 rounded bg-blue-50 text-blue-600 border border-blue-200/70">
                  ATMS
                </span>
              </div>
              <div className="text-[8.5px] font-mono tracking-wider text-slate-400 uppercase truncate font-medium">
                Autonomous Vehicle Intelligence
              </div>
            </div>
          </div>

          {/* CENTER: THE EXACT REFERENCE HORIZONTAL NAVBAR */}
          <nav 
            ref={navRef}
            className="bg-white rounded-2xl border border-slate-200 shadow-xs px-2 py-1.5 flex items-center space-x-1 relative"
          >
            {/* 1. OVERVIEW */}
            <button
              onClick={() => { setOpenDropdown(null); onSelectTab('dashboard'); }}
              className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all duration-150 cursor-pointer ${
                isOverviewActive
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-800 hover:text-blue-600 hover:bg-slate-100/70'
              }`}
            >
              <Home className={`w-4 h-4 shrink-0 ${isOverviewActive ? 'text-white' : 'text-slate-700'}`} strokeWidth={2} />
              <span>Overview</span>
            </button>

            {/* 2. LIVE CAMERAS (Dropdown) */}
            <div className="relative">
              <button
                onClick={() => toggleDropdown('cameras')}
                className={`flex items-center space-x-1.5 px-3.5 py-2 rounded-xl text-xs font-medium transition-all duration-150 cursor-pointer ${
                  isCamerasActive
                    ? 'bg-blue-600 text-white shadow-xs font-semibold'
                    : 'text-slate-800 hover:text-blue-600 hover:bg-slate-100/70'
                }`}
              >
                <Video className={`w-4 h-4 shrink-0 ${isCamerasActive ? 'text-white' : 'text-slate-700'}`} strokeWidth={2} />
                <span>Live Cameras</span>
                <ChevronDown className={`w-3 h-3 ml-0.5 transition-transform ${openDropdown === 'cameras' ? 'rotate-180' : ''} ${isCamerasActive ? 'text-white' : 'text-slate-500'}`} />
              </button>

              {openDropdown === 'cameras' && (
                <div className="absolute top-full left-0 mt-2 w-56 bg-white rounded-xl shadow-lg border border-slate-200 py-1.5 z-50 animate-fadeIn">
                  <button
                    onClick={() => { setOpenDropdown(null); onSelectTab('camera'); }}
                    className={`w-full flex items-center space-x-2.5 px-3.5 py-2 text-xs text-left cursor-pointer transition-colors ${
                      currentTab === 'camera' ? 'bg-blue-50 text-blue-600 font-bold' : 'text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <Eye className="w-4 h-4 text-blue-600" />
                    <div>
                      <div className="font-semibold">Device Optical ANPR</div>
                      <div className="text-[10px] text-slate-400">Webcam & Real-time Plate OCR</div>
                    </div>
                  </button>
                  <button
                    onClick={() => { setOpenDropdown(null); onSelectTab('cameras'); }}
                    className={`w-full flex items-center space-x-2.5 px-3.5 py-2 text-xs text-left cursor-pointer transition-colors ${
                      currentTab === 'cameras' ? 'bg-blue-50 text-blue-600 font-bold' : 'text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <CameraIcon className="w-4 h-4 text-blue-600" />
                    <div>
                      <div className="font-semibold">Camera Sensor Grid</div>
                      <div className="text-[10px] text-slate-400">20 Delhi Junction CCTV Nodes</div>
                    </div>
                  </button>
                </div>
              )}
            </div>

            {/* SEPARATOR */}
            <div className="h-4 w-px bg-slate-200/80 mx-1"></div>

            {/* 3. GIS MAP */}
            <button
              onClick={() => { setOpenDropdown(null); onSelectTab('map'); }}
              className={`flex items-center space-x-2 px-3.5 py-2 rounded-xl text-xs font-medium transition-all duration-150 cursor-pointer ${
                isGisMapActive
                  ? 'bg-blue-600 text-white shadow-xs font-semibold'
                  : 'text-slate-800 hover:text-blue-600 hover:bg-slate-100/70'
              }`}
            >
              <MapPin className={`w-4 h-4 shrink-0 ${isGisMapActive ? 'text-white' : 'text-slate-700'}`} strokeWidth={2} />
              <span>GIS Map</span>
            </button>

            {/* 4. VEHICLE INTELLIGENCE (Dropdown) */}
            <div className="relative">
              <button
                onClick={() => toggleDropdown('vehicle')}
                className={`flex items-center space-x-1.5 px-3.5 py-2 rounded-xl text-xs font-medium transition-all duration-150 cursor-pointer ${
                  isVehicleIntelActive
                    ? 'bg-blue-600 text-white shadow-xs font-semibold'
                    : 'text-slate-800 hover:text-blue-600 hover:bg-slate-100/70'
                }`}
              >
                <Car className={`w-4 h-4 shrink-0 ${isVehicleIntelActive ? 'text-white' : 'text-slate-700'}`} strokeWidth={2} />
                <span>Vehicle Intelligence</span>
                <ChevronDown className={`w-3 h-3 ml-0.5 transition-transform ${openDropdown === 'vehicle' ? 'rotate-180' : ''} ${isVehicleIntelActive ? 'text-white' : 'text-slate-500'}`} />
              </button>

              {openDropdown === 'vehicle' && (
                <div className="absolute top-full left-0 mt-2 w-60 bg-white rounded-xl shadow-lg border border-slate-200 py-1.5 z-50 animate-fadeIn">
                  <button
                    onClick={() => { setOpenDropdown(null); onSelectTab('vehicles'); }}
                    className={`w-full flex items-center space-x-2.5 px-3.5 py-2 text-xs text-left cursor-pointer transition-colors ${
                      currentTab === 'vehicles' ? 'bg-blue-50 text-blue-600 font-bold' : 'text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <Search className="w-4 h-4 text-blue-600" />
                    <div>
                      <div className="font-semibold">Vehicle Query & Dossier</div>
                      <div className="text-[10px] text-slate-400">Search plates, sighting records</div>
                    </div>
                  </button>
                  <button
                    onClick={() => { setOpenDropdown(null); onSelectTab('trajectory'); }}
                    className={`w-full flex items-center space-x-2.5 px-3.5 py-2 text-xs text-left cursor-pointer transition-colors ${
                      currentTab === 'trajectory' ? 'bg-blue-50 text-blue-600 font-bold' : 'text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <Navigation className="w-4 h-4 text-blue-600" />
                    <div>
                      <div className="font-semibold">Trajectory Reconstruction</div>
                      <div className="text-[10px] text-slate-400">Animated corridor timeline</div>
                    </div>
                  </button>
                  <button
                    onClick={() => { setOpenDropdown(null); onSelectTab('investigation'); }}
                    className={`w-full flex items-center space-x-2.5 px-3.5 py-2 text-xs text-left cursor-pointer transition-colors ${
                      currentTab === 'investigation' ? 'bg-blue-50 text-blue-600 font-bold' : 'text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <FileSearch className="w-4 h-4 text-blue-600" />
                    <div>
                      <div className="font-semibold">Vehicle Investigation</div>
                      <div className="text-[10px] text-slate-400">Web intelligence & correlation</div>
                    </div>
                  </button>
                </div>
              )}
            </div>

            {/* SEPARATOR */}
            <div className="h-4 w-px bg-slate-200/80 mx-1"></div>

            {/* 5. INCIDENTS (with Red Notification Badge) */}
            <div className="relative">
              <button
                onClick={() => toggleDropdown('incidents')}
                className={`flex items-center space-x-1.5 px-3.5 py-2 rounded-xl text-xs font-medium transition-all duration-150 cursor-pointer ${
                  isIncidentsActive
                    ? 'bg-blue-600 text-white shadow-xs font-semibold'
                    : 'text-slate-800 hover:text-blue-600 hover:bg-slate-100/70'
                }`}
              >
                <AlertTriangle className={`w-4 h-4 shrink-0 ${isIncidentsActive ? 'text-white' : 'text-slate-700'}`} strokeWidth={2} />
                <span>Incidents</span>
                
                {/* Red Circular Badge */}
                <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-rose-500 text-white min-w-[18px] text-center leading-tight shadow-xs">
                  {activeAlertCount > 0 ? activeAlertCount : 8}
                </span>

                <ChevronDown className={`w-3 h-3 ml-0.5 transition-transform ${openDropdown === 'incidents' ? 'rotate-180' : ''} ${isIncidentsActive ? 'text-white' : 'text-slate-500'}`} />
              </button>

              {openDropdown === 'incidents' && (
                <div className="absolute top-full left-0 mt-2 w-56 bg-white rounded-xl shadow-lg border border-slate-200 py-1.5 z-50 animate-fadeIn">
                  <button
                    onClick={() => { setOpenDropdown(null); onSelectTab('alerts'); }}
                    className={`w-full flex items-center space-x-2.5 px-3.5 py-2 text-xs text-left cursor-pointer transition-colors ${
                      currentTab === 'alerts' ? 'bg-blue-50 text-blue-600 font-bold' : 'text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <AlertTriangle className="w-4 h-4 text-rose-600" />
                    <div>
                      <div className="font-semibold">Threat Incidents</div>
                      <div className="text-[10px] text-slate-400">Speed anomalies & blacklist hits</div>
                    </div>
                  </button>
                  <button
                    onClick={() => { setOpenDropdown(null); onSelectTab('blacklist'); }}
                    className={`w-full flex items-center space-x-2.5 px-3.5 py-2 text-xs text-left cursor-pointer transition-colors ${
                      currentTab === 'blacklist' ? 'bg-blue-50 text-blue-600 font-bold' : 'text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <ShieldAlert className="w-4 h-4 text-amber-600" />
                    <div>
                      <div className="font-semibold">Watchlist Registry</div>
                      <div className="text-[10px] text-slate-400">Flagged vehicle management</div>
                    </div>
                  </button>
                </div>
              )}
            </div>

            {/* 6. ANALYTICS */}
            <button
              onClick={() => { setOpenDropdown(null); onSelectTab('analytics'); }}
              className={`flex items-center space-x-2 px-3.5 py-2 rounded-xl text-xs font-medium transition-all duration-150 cursor-pointer ${
                isAnalyticsActive
                  ? 'bg-blue-600 text-white shadow-xs font-semibold'
                  : 'text-slate-800 hover:text-blue-600 hover:bg-slate-100/70'
              }`}
            >
              <BarChart3 className={`w-4 h-4 shrink-0 ${isAnalyticsActive ? 'text-white' : 'text-slate-700'}`} strokeWidth={2} />
              <span>Analytics</span>
            </button>

            {/* SEPARATOR */}
            <div className="h-4 w-px bg-slate-200/80 mx-1"></div>

            {/* 7. SYSTEM SETTINGS (Dropdown) */}
            <div className="relative">
              <button
                onClick={() => toggleDropdown('settings')}
                className={`flex items-center space-x-1.5 px-3.5 py-2 rounded-xl text-xs font-medium transition-all duration-150 cursor-pointer ${
                  isSettingsActive
                    ? 'bg-blue-600 text-white shadow-xs font-semibold'
                    : 'text-slate-800 hover:text-blue-600 hover:bg-slate-100/70'
                }`}
              >
                <Settings className={`w-4 h-4 shrink-0 ${isSettingsActive ? 'text-white' : 'text-slate-700'}`} strokeWidth={2} />
                <span>System Settings</span>
                <ChevronDown className={`w-3 h-3 ml-0.5 transition-transform ${openDropdown === 'settings' ? 'rotate-180' : ''} ${isSettingsActive ? 'text-white' : 'text-slate-500'}`} />
              </button>

              {openDropdown === 'settings' && (
                <div className="absolute top-full right-0 mt-2 w-64 bg-white rounded-xl shadow-lg border border-slate-200 py-2 z-50 animate-fadeIn">
                  <div className="px-3.5 py-1 text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400">
                    System Configuration
                  </div>
                  <button
                    onClick={() => { setOpenDropdown(null); onSelectTab('system'); }}
                    className={`w-full flex items-center space-x-2.5 px-3.5 py-2 text-xs text-left cursor-pointer transition-colors ${
                      currentTab === 'system' ? 'bg-blue-50 text-blue-600 font-bold' : 'text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <Activity className="w-4 h-4 text-blue-600" />
                    <div>
                      <div className="font-semibold">System Health & Telemetry</div>
                      <div className="text-[10px] text-slate-400">Services, memory, inference FPS</div>
                    </div>
                  </button>
                  <button
                    onClick={() => { setOpenDropdown(null); onSelectTab('settings'); }}
                    className={`w-full flex items-center space-x-2.5 px-3.5 py-2 text-xs text-left cursor-pointer transition-colors ${
                      currentTab === 'settings' ? 'bg-blue-50 text-blue-600 font-bold' : 'text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <Settings className="w-4 h-4 text-blue-600" />
                    <div>
                      <div className="font-semibold">Application Preferences</div>
                      <div className="text-[10px] text-slate-400">OCR thresholds & sound chimes</div>
                    </div>
                  </button>

                  <div className="my-1.5 border-t border-slate-100"></div>

                  <div className="px-3.5 py-1 text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400">
                    Operation Environment
                  </div>
                  <div className="px-3.5 py-1.5 flex items-center justify-between">
                    <span className="text-xs text-slate-700 font-medium">Mode</span>
                    <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg text-[10px] font-bold">
                      <button
                        onClick={() => onToggleMode('live')}
                        className={`px-2 py-0.5 rounded ${mode === 'live' ? 'bg-emerald-500 text-white shadow-xs' : 'text-slate-600'}`}
                      >
                        LIVE
                      </button>
                      <button
                        onClick={() => onToggleMode('demo')}
                        className={`px-2 py-0.5 rounded ${mode === 'demo' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-600'}`}
                      >
                        DEMO
                      </button>
                    </div>
                  </div>

                  <div className="px-3.5 pt-1 space-y-1">
                    <button
                      onClick={handleLoadDemo}
                      disabled={isDemoLoading}
                      className="w-full text-center py-1.5 px-2 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg text-xs font-semibold cursor-pointer transition-colors"
                    >
                      {isDemoLoading ? 'Loading...' : 'Populate Demo Dataset'}
                    </button>
                    <button
                      onClick={handleClearDemo}
                      disabled={isDemoLoading}
                      className="w-full text-center py-1.5 px-2 bg-slate-50 hover:bg-rose-50 text-slate-600 hover:text-rose-600 rounded-lg text-xs font-medium cursor-pointer transition-colors"
                    >
                      Purge Dataset (Clean Live)
                    </button>
                  </div>
                </div>
              )}
            </div>
          </nav>

          {/* RIGHT: SEARCH BAR & STATUS CLOCKS */}
          <div className="flex items-center space-x-3 shrink-0">
            {/* Quick Search Input */}
            <form onSubmit={handleSearchSubmit} className="hidden xl:flex relative max-w-xs w-52">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={globalSearch}
                onChange={e => setGlobalSearch(e.target.value)}
                placeholder="Search plate (e.g. DL99...)"
                className="w-full pl-8 pr-7 py-1.5 rounded-xl border border-slate-200 bg-slate-50 text-xs font-mono placeholder:text-slate-400 focus:outline-none focus:bg-white focus:border-blue-500 transition-colors shadow-2xs"
              />
              <kbd className="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] font-mono text-slate-400 bg-slate-200/70 px-1 rounded">
                ↵
              </kbd>
            </form>

            {/* Action Notice Toast */}
            {actionNotice && (
              <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-mono animate-fadeIn">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span className="truncate max-w-[180px]">{actionNotice}</span>
              </div>
            )}

            {/* Dual Time Display */}
            <div className="hidden md:flex items-center space-x-2 text-[11px] font-mono text-slate-600 bg-slate-50 px-2.5 py-1.5 rounded-xl border border-slate-200">
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              <span><b>{timeStr}</b> <span className="text-[9px] text-slate-400">IST</span></span>
              <span className="text-slate-300">|</span>
              <span className="text-slate-500">{utcTimeStr} <span className="text-[9px] text-slate-400">UTC</span></span>
            </div>

            {/* Live Indicator */}
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[10px] font-mono font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span className="hidden sm:inline">ONLINE</span>
            </div>
          </div>

        </div>
      </header>

      {/* ------------------------------------------------------------- */}
      {/* 2. FULL-WIDTH ENTERPRISE WORKSPACE CONTENT                     */}
      {/* ------------------------------------------------------------- */}
      <main className="flex-1 overflow-y-auto p-4 md:p-6 bg-[#f8fafc]">
        <div className="max-w-[1700px] mx-auto space-y-4">
          {children}
        </div>
      </main>
    </div>
  );
};

export default DashboardLayout;
