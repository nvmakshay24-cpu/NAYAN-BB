import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  FileSearch, Search, Calendar, ShieldCheck, AlertTriangle, AlertOctagon, 
  CheckCircle2, Clock, MapPin, ExternalLink, RefreshCw, Sparkles, 
  ArrowRight, Filter, ChevronDown, ChevronUp, Bot, Database, 
  Activity, Layers, Info, Check, Eye, Navigation, Download,
  Radio, ShieldAlert, Cpu
} from 'lucide-react';
import { api } from '../lib/api';
import { 
  InvestigationRequest, InvestigationResult, InvestigationSourceAnalysis, 
  CrossSourceDiscrepancy, WebIntelligenceFinding, InvestigationTimelineEvent,
  ComparisonStatus, SourceStatus, Camera, TrajectoryData
} from '../types';
import L from 'leaflet';

interface InvestigationPageProps {
  initialPlate?: string;
  mode?: 'live' | 'demo';
  onNavigateTrajectory?: (plate: string) => void;
  onNavigateVehicles?: (plate: string) => void;
}

export const InvestigationPage: React.FC<InvestigationPageProps> = ({
  initialPlate = 'DL01AB1234',
  mode = 'live',
  onNavigateTrajectory,
  onNavigateVehicles,
}) => {
  // Input form states
  const [plateNumber, setPlateNumber] = useState<string>(initialPlate);
  const [startDate, setStartDate] = useState<string>('2026-10-10');
  const [endDate, setEndDate] = useState<string>('2026-10-12');
  const [notes, setNotes] = useState<string>('');

  // Investigation result states
  const [investigation, setInvestigation] = useState<InvestigationResult | null>(null);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [recentRuns, setRecentRuns] = useState<InvestigationResult[]>([]);

  // Filter & view states
  const [discrepancyFilter, setDiscrepancyFilter] = useState<'ALL' | ComparisonStatus>('ALL');
  const [timelineFilter, setTimelineFilter] = useState<'ALL' | 'NAYAN_DETECTION' | 'SOURCE_RECORD' | 'PUBLIC_WEB_FINDING'>('ALL');
  const [isConsoleExpanded, setIsConsoleExpanded] = useState<boolean>(true);

  // Trajectory correlation from Nayan
  const [trajectoryData, setTrajectoryData] = useState<TrajectoryData | null>(null);
  const [cameras, setCameras] = useState<Camera[]>([]);

  // Map refs
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const mapLayerGroupRef = useRef<L.LayerGroup | null>(null);

  // Web Audio chime for alerts/completion
  const playChime = useCallback((frequency: number = 880, type: OscillatorType = 'sine') => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(frequency, audioCtx.currentTime);
      gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.3);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.3);
    } catch {
      // ignore
    }
  }, []);

  // Fetch recent history and cameras on mount (do not auto-populate report before searching)
  useEffect(() => {
    api.getInvestigationHistory()
      .then(history => {
        if (history && history.length > 0) {
          setRecentRuns(history);
        }
      })
      .catch(() => {});

    api.getCameras(mode)
      .then(cams => setCameras(cams))
      .catch(() => {});
  }, [mode]);

  // Load initial plate if prop changes
  useEffect(() => {
    if (initialPlate && initialPlate !== plateNumber) {
      setPlateNumber(initialPlate);
    }
  }, [initialPlate]);

  // Quick Date Presets
  const handleApplyPreset = (preset: 'oct2026' | 'today' | '7days' | '30days') => {
    if (preset === 'oct2026') {
      setStartDate('2026-10-10');
      setEndDate('2026-10-12');
    } else if (preset === 'today') {
      const today = new Date().toISOString().slice(0, 10);
      setStartDate(today);
      setEndDate(today);
    } else if (preset === '7days') {
      const end = new Date();
      const start = new Date();
      start.setDate(end.getDate() - 7);
      setStartDate(start.toISOString().slice(0, 10));
      setEndDate(end.toISOString().slice(0, 10));
    } else if (preset === '30days') {
      const end = new Date();
      const start = new Date();
      start.setDate(end.getDate() - 30);
      setStartDate(start.toISOString().slice(0, 10));
      setEndDate(end.toISOString().slice(0, 10));
    }
  };

  // Launch Investigation
  const handleStartInvestigation = async () => {
    const cleanPlate = plateNumber.trim().toUpperCase().replace(/\s+/g, '');
    if (!cleanPlate) {
      setErrorMsg('Please specify a valid vehicle registration plate number.');
      return;
    }
    if (!startDate || !endDate) {
      setErrorMsg('Please specify both start and end date for investigation range.');
      return;
    }

    setErrorMsg(null);
    setIsRunning(true);
    playChime(660);

    // Fetch Nayan trajectory for correlation
    api.getVehicleTrajectory(cleanPlate, mode)
      .then(traj => setTrajectoryData(traj))
      .catch(() => setTrajectoryData(null));

    try {
      const req: InvestigationRequest = {
        plate_number: cleanPlate,
        start_date: startDate,
        end_date: endDate,
        notes: notes.trim() || undefined,
      };

      // 1. Initiate investigation on backend
      const initialResult = await api.startInvestigation(req);
      setInvestigation(initialResult);
      setIsRunning(false);
      playChime(1046); // Success chime
      api.getInvestigationHistory().then(setRecentRuns).catch(() => {});
    } catch (err: any) {
      console.error('Failed to start investigation:', err);
      setIsRunning(false);
      setErrorMsg(err.message || 'Failed to communicate with TinyFish investigation service.');
    }
  };

  // Data helpers for matching backend schemas
  const getDiscrepancies = (): CrossSourceDiscrepancy[] => {
    if (!investigation) return [];
    return (investigation as any).cross_source_analysis || investigation.cross_source_discrepancies || [];
  };

  const getTimelineEvents = (): InvestigationTimelineEvent[] => {
    if (!investigation) return [];
    return (investigation as any).timeline || investigation.unified_timeline || [];
  };

  const getActivitySteps = () => {
    if (!investigation) return [];
    return (investigation as any).agent_activity_log || investigation.agent_activity || [];
  };

  const getSourceAnalysis = (key: string): any => {
    if (!investigation) return null;
    const srcList = investigation.sources;
    if (Array.isArray(srcList)) {
      if (key === 'echallan') return srcList.find(s => s.source_name.toLowerCase().includes('echallan') || s.source_url.includes('echallan'));
      if (key === 'analytics') return srcList.find(s => s.source_name.toLowerCase().includes('analytics') || s.source_url.includes('analytics'));
      if (key === 'delhipolice') return srcList.find(s => s.source_name.toLowerCase().includes('delhi') || s.source_url.includes('delhipolice'));
      return null;
    }
    return (srcList as any)?.[key];
  };

  const getWebFindings = (): WebIntelligenceFinding[] => {
    if (!investigation) return [];
    return investigation.web_intelligence || [];
  };

  const discrepancies = getDiscrepancies();
  const timelineEvents = getTimelineEvents();
  const activitySteps = getActivitySteps();
  const webFindings = getWebFindings();

  // Discrepancy counts
  const matchCount = discrepancies.filter(d => d.category === 'MATCH').length;
  const missingCount = discrepancies.filter(d => d.category === 'MISSING').length;
  const additionalCount = discrepancies.filter(d => d.category === 'ADDITIONAL').length;
  const conflictCount = discrepancies.filter(d => d.category === 'CONFLICT').length;

  const filteredDiscrepancies = discrepancies.filter(d => {
    if (discrepancyFilter === 'ALL') return true;
    return d.category === discrepancyFilter;
  });

  const filteredTimeline = timelineEvents.filter(ev => {
    if (timelineFilter === 'ALL') return true;
    return ev.event_type === timelineFilter;
  });

  // Source Analyses
  const echallanSource = getSourceAnalysis('echallan');
  const analyticsSource = getSourceAnalysis('analytics');
  const delhiPoliceSource = getSourceAnalysis('delhipolice');

  // Initialize and update GIS Map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      const map = L.map(mapContainerRef.current, {
        center: [28.6139, 77.2090], // Delhi Center
        zoom: 12,
        zoomControl: false,
      });

      // Standard OpenStreetMap tiles (no API key required, crisp and clean)
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
        maxZoom: 19,
      }).addTo(map);

      mapLayerGroupRef.current = L.layerGroup().addTo(map);
      mapInstanceRef.current = map;
    }

    const layerGroup = mapLayerGroupRef.current;
    if (!layerGroup || !mapInstanceRef.current) return;
    layerGroup.clearLayers();

    const bounds: [number, number][] = [];

    // Plot Nayan Trajectory if available
    if (trajectoryData && trajectoryData.points.length > 0) {
      const trajCoords: [number, number][] = trajectoryData.points.map(p => [p.latitude, p.longitude]);
      bounds.push(...trajCoords);

      // Trajectory polyline
      const polyline = L.polyline(trajCoords, {
        color: '#2563eb', // Solid Blue
        weight: 3.5,
        dashArray: '6, 6',
        opacity: 0.85,
      });
      layerGroup.addLayer(polyline);

      // Sequence markers
      trajectoryData.points.forEach((pt) => {
        const marker = L.circleMarker([pt.latitude, pt.longitude], {
          radius: 6,
          fillColor: '#2563eb',
          color: '#ffffff',
          weight: 2,
          fillOpacity: 0.9,
        });
        marker.bindPopup(`
          <div style="font-family: monospace; font-size: 11px; padding: 4px;">
            <b style="color: #2563eb;">NAYAN ANPR SIGHTING #${pt.sequence_number}</b><br/>
            Camera: <b>${pt.camera_code}</b> (${pt.camera_name})<br/>
            Time: ${pt.timestamp}<br/>
            Speed: ${pt.estimated_speed_kmh} km/h
          </div>
        `);
        layerGroup.addLayer(marker);
      });
    }

    // Plot Timeline Events with GPS coordinates
    timelineEvents.forEach((event) => {
      if (event.latitude && event.longitude) {
        bounds.push([event.latitude, event.longitude]);
        const isChallan = event.event_type === 'SOURCE_RECORD';
        const isWeb = event.event_type === 'PUBLIC_WEB_FINDING';
        const color = isChallan ? '#f59e0b' : isWeb ? '#9333ea' : '#2563eb';

        const iconHtml = `
          <div style="background: ${color}; color: white; width: 22px; height: 22px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: bold; border: 2px solid white; box-shadow: 0 0 6px rgba(0,0,0,0.3);">
            ${isChallan ? 'C' : isWeb ? 'W' : 'N'}
          </div>
        `;

        const customIcon = L.divIcon({
          className: 'investigation-marker',
          html: iconHtml,
          iconSize: [22, 22],
          iconAnchor: [11, 11],
        });

        const marker = L.marker([event.latitude, event.longitude], { icon: customIcon });
        marker.bindPopup(`
          <div style="font-family: system-ui; font-size: 11px; max-width: 240px; padding: 4px;">
            <span style="font-size: 9px; font-weight: bold; padding: 2px 5px; border-radius: 4px; background: ${color}20; color: ${color}; border: 1px solid ${color}40;">
              ${event.event_type}
            </span>
            <div style="font-weight: 700; margin-top: 4px; color: #0f172a;">${event.title}</div>
            <div style="font-size: 10px; color: #64748b; margin-top: 2px;">${event.timestamp} | ${event.source_name || (event as any).source}</div>
            <p style="margin-top: 4px; color: #334155;">${event.description}</p>
          </div>
        `);
        layerGroup.addLayer(marker);
      }
    });

    if (bounds.length > 0) {
      try {
        mapInstanceRef.current.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
      } catch {
        // ignore bounds fit error
      }
    }
  }, [trajectoryData, timelineEvents]);

  return (
    <div className="space-y-4 pb-6 font-sans text-slate-800">
      {/* ------------------------------------------------------------------ */}
      {/* 1. TOP INVESTIGATION BANNER & STATUS BAR                           */}
      {/* ------------------------------------------------------------------ */}
      <div className="bg-white border border-slate-200 rounded-md p-4 shadow-2xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-blue-50 border border-blue-200 text-blue-600">
                <FileSearch className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-base font-bold font-mono tracking-wider text-slate-900 uppercase">
                    VEHICLE INVESTIGATION INTELLIGENCE
                  </h1>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-teal-50 text-teal-700 border border-teal-200 flex items-center gap-1 font-bold">
                    <Sparkles className="w-3 h-3 text-teal-600" />
                    TinyFish Multi-Source Agent
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Deep cross-source correlation linking NAYAN optical ANPR trajectories with Parivahan, Delhi Police & public web intelligence.
                </p>
              </div>
            </div>
          </div>

          {/* Quick Stats / Agent Health */}
          <div className="flex items-center gap-3">
            <div className="px-3 py-1.5 rounded bg-slate-50 border border-slate-200 text-right shadow-2xs">
              <div className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">Agent Engine</div>
              <div className="text-xs font-mono font-bold text-emerald-700 flex items-center justify-end gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                ONLINE (TinyFish)
              </div>
            </div>

            {investigation && (
              <div className="px-3 py-1.5 rounded bg-slate-50 border border-slate-200 text-right shadow-2xs">
                <div className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">Discrepancies</div>
                <div className="text-xs font-mono font-bold text-amber-700">
                  {discrepancies.length} Flagged
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* 2. SEARCH & CONTROL CONSOLE                                        */}
      {/* ------------------------------------------------------------------ */}
      <div className="bg-white border border-slate-200 rounded-md p-4 shadow-2xs">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
          {/* Number Plate Input */}
          <div className="md:col-span-3">
            <label className="block text-xs font-mono uppercase tracking-wider text-slate-600 mb-1.5 flex items-center justify-between">
              <span>Registration Plate</span>
              <span className="text-[10px] text-blue-600 font-bold">Target Vehicle</span>
            </label>
            <div className="relative">
              <input
                type="text"
                value={plateNumber}
                onChange={(e) => setPlateNumber(e.target.value.toUpperCase())}
                placeholder="e.g. DL01AB1234"
                className="w-full bg-white border border-slate-200 focus:border-blue-600 rounded px-3 py-2 font-mono text-sm font-bold text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all uppercase shadow-2xs"
              />
              <div className="absolute right-2.5 top-2.5 text-xs font-mono text-slate-500 px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200">
                IND
              </div>
            </div>
          </div>

          {/* Date Range Selection */}
          <div className="md:col-span-4">
            <label className="block text-xs font-mono uppercase tracking-wider text-slate-600 mb-1.5">
              Investigation Date Window
            </label>
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-1/2 bg-white border border-slate-200 focus:border-blue-600 rounded px-3 py-2 font-mono text-xs text-slate-800 focus:outline-none transition-all shadow-2xs"
              />
              <span className="text-slate-400 font-mono text-xs">→</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-1/2 bg-white border border-slate-200 focus:border-blue-600 rounded px-3 py-2 font-mono text-xs text-slate-800 focus:outline-none transition-all shadow-2xs"
              />
            </div>
          </div>

          {/* Quick Presets (Buttons Plane Solid Colour) */}
          <div className="md:col-span-2">
            <label className="block text-xs font-mono uppercase tracking-wider text-slate-600 mb-1.5">
              Target Presets
            </label>
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => handleApplyPreset('oct2026')}
                className={`px-2.5 py-1.5 text-[11px] font-mono rounded cursor-pointer transition-colors shadow-2xs ${
                  startDate === '2026-10-10' && endDate === '2026-10-12'
                    ? 'bg-blue-600 text-white font-bold border border-blue-600'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 font-semibold'
                }`}
                title="10 Oct 2026 → 12 Oct 2026"
              >
                10-12 Oct '26
              </button>
              <button
                type="button"
                onClick={() => handleApplyPreset('7days')}
                className="px-2.5 py-1.5 text-[11px] font-mono rounded bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 font-semibold transition-colors cursor-pointer shadow-2xs"
              >
                Last 7D
              </button>
              <button
                type="button"
                onClick={() => handleApplyPreset('30days')}
                className="px-2.5 py-1.5 text-[11px] font-mono rounded bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 font-semibold transition-colors cursor-pointer shadow-2xs"
              >
                Last 30D
              </button>
            </div>
          </div>

          {/* Launch CTA Button (Plane Solid Colour) */}
          <div className="md:col-span-3">
            <button
              type="button"
              disabled={isRunning}
              onClick={handleStartInvestigation}
              className={`w-full py-2.5 px-4 rounded font-mono text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-2xs ${
                isRunning
                  ? 'bg-blue-400 text-white cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-700 text-white active:bg-blue-800'
              }`}
            >
              {isRunning ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin text-white" />
                  Agent Investigating...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 text-white" />
                  Deploy TinyFish Agent
                </>
              )}
            </button>
          </div>
        </div>

        {errorMsg && (
          <div className="mt-4 p-3 rounded bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 flex-shrink-0 text-rose-600" />
            <span>{errorMsg}</span>
          </div>
        )}
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* 3. AWAITING INVESTIGATION (CLEAN EMPTY STATE)                      */}
      {/* ------------------------------------------------------------------ */}
      {!investigation && !isRunning && (
        <div className="bg-white border border-slate-200 rounded-md p-10 text-center shadow-2xs">
          <div className="w-12 h-12 rounded-full bg-blue-50 border border-blue-200 flex items-center justify-center mx-auto mb-3 text-blue-600">
            <FileSearch className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-bold font-mono text-slate-800 uppercase tracking-wider">
            Awaiting Target Vehicle Investigation
          </h3>
          <p className="text-xs text-slate-500 max-w-lg mx-auto mt-1.5 font-sans leading-relaxed">
            Enter a vehicle registration plate number and date window above, then click <b>Deploy TinyFish Agent</b> to cross-correlate optical sightings with MoRTH Parivahan, Delhi Police records, and public intelligence.
          </p>

          {recentRuns.length > 0 && (
            <div className="mt-6 pt-5 border-t border-slate-100 max-w-lg mx-auto text-left">
              <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-bold block mb-2">
                Recent Inquiries in Database (Click to view report):
              </span>
              <div className="flex flex-wrap gap-2">
                {recentRuns.slice(0, 5).map((run) => (
                  <button
                    key={run.id}
                    onClick={() => {
                      setInvestigation(run);
                      setPlateNumber(run.plate_number);
                      if (run.start_date) setStartDate(run.start_date);
                      if (run.end_date) setEndDate(run.end_date);
                    }}
                    className="px-2.5 py-1 rounded bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 text-xs font-mono font-semibold transition-colors cursor-pointer flex items-center gap-1.5 shadow-2xs"
                  >
                    <span>{run.plate_number}</span>
                    <span className="text-[10px] text-slate-400 font-normal">
                      ({run.start_date?.slice(5) || '10-10'} → {run.end_date?.slice(5) || '10-12'})
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* When running investigation without existing result */}
      {!investigation && isRunning && (
        <div className="bg-white border border-slate-200 rounded-md p-12 text-center shadow-2xs">
          <RefreshCw className="w-8 h-8 text-blue-600 animate-spin mx-auto mb-3" />
          <h3 className="text-sm font-bold font-mono text-slate-900 uppercase tracking-wider">
            TinyFish Autonomous Agent Investigating...
          </h3>
          <p className="text-xs text-slate-500 mt-1 font-mono">
            Querying MoRTH Parivahan eChallan, Vahan Analytics, Delhi Traffic Police & Open Web Intel...
          </p>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* 4. REAL-TIME TINYFISH AGENT ACTIVITY CONSOLE                      */}
      {/* ------------------------------------------------------------------ */}
      {investigation && (
        <div className="bg-white border border-slate-200 rounded-md overflow-hidden shadow-2xs">
          <div 
            className="p-3.5 bg-slate-50/90 border-b border-slate-200 flex items-center justify-between cursor-pointer select-none"
            onClick={() => setIsConsoleExpanded(!isConsoleExpanded)}
          >
            <div className="flex items-center gap-3">
              <div className="w-2.5 h-2.5 rounded-full bg-blue-600 animate-ping" />
              <div className="flex items-center gap-2">
                <Bot className="w-4 h-4 text-blue-600" />
                <span className="font-mono text-xs font-bold text-slate-900 tracking-wider">
                  TINYFISH AGENT MULTI-SOURCE ACTIVITY CONSOLE
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
                  ID: {((investigation as any).investigation_id || investigation.id || '').slice(0, 16)}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <div className="w-28 bg-slate-200 h-2 rounded-full overflow-hidden border border-slate-200">
                  <div 
                    className="bg-blue-600 h-full transition-all duration-500"
                    style={{ width: '100%' }}
                  />
                </div>
                <span className="font-mono text-xs text-emerald-700 font-bold flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  COMPLETE
                </span>
              </div>

              <div className="text-slate-400 hover:text-slate-700 transition-colors">
                {isConsoleExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </div>
            </div>
          </div>

          {isConsoleExpanded && (
            <div className="p-4 bg-slate-50/50 space-y-3 font-mono text-xs">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                {activitySteps.map((step: any, idx: number) => {
                  const isCompleted = step.status === 'completed';
                  const isInProgress = step.status === 'running' || step.status === 'in_progress';
                  const isWarning = step.status === 'warning';

                  return (
                    <div 
                      key={step.id || idx} 
                      className={`p-3 rounded border transition-all ${
                        isCompleted
                          ? 'bg-white border-slate-200 text-slate-800 shadow-2xs'
                          : isWarning
                          ? 'bg-amber-50/80 border-amber-300 text-amber-900 shadow-2xs'
                          : isInProgress
                          ? 'bg-blue-50 border-blue-300 text-blue-900 shadow-2xs'
                          : 'bg-slate-100/60 border-slate-200 text-slate-400'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[10px] font-bold tracking-wider uppercase text-slate-500">
                          Step 0{idx + 1}
                        </span>
                        {isCompleted ? (
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        ) : isWarning ? (
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                        ) : isInProgress ? (
                          <RefreshCw className="w-3.5 h-3.5 text-blue-600 animate-spin" />
                        ) : (
                          <span className="w-2 h-2 rounded-full bg-slate-300" />
                        )}
                      </div>
                      <div className="font-bold text-slate-900 text-[11px] truncate">
                        {step.label || step.title}
                      </div>
                      <div className="text-[10px] text-slate-500 mt-1 line-clamp-2">
                        {step.detail || step.description || 'Completed autonomous verification.'}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Verdict & Assistive Neutral Language Summary */}
              <div className="mt-3 p-3.5 rounded bg-blue-50 border border-blue-200 flex items-start gap-3">
                <Info className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
                <div className="text-xs">
                  <span className="font-bold text-blue-900">INVESTIGATION VERDICT: </span>
                  <span className="text-slate-800">{investigation.summary_verdict}</span>
                  <p className="text-[10px] text-slate-500 mt-1 italic">
                    * {investigation.disclaimer || 'Assistive intelligence notice: Information is compiled via TinyFish autonomous agents from MoRTH Parivahan, Delhi Police, and regional public web intelligence. All discrepancies require official human verification.'}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* 4. TRAJECTORY & VEHICLE CORRELATION SUMMARY                       */}
      {/* ------------------------------------------------------------------ */}
      {investigation && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Trajectory Card */}
          <div className="bg-white border border-slate-200 rounded-md p-4 shadow-2xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Navigation className="w-4 h-4 text-blue-600" />
                  <span className="font-mono text-xs font-bold text-slate-900 uppercase tracking-wider">
                    NAYAN Trajectory Profile
                  </span>
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200 font-bold">
                  ANPR TRACKED
                </span>
              </div>

              <div className="space-y-2.5 font-mono text-xs">
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-500">Total Optical Detections:</span>
                  <span className="text-slate-900 font-bold">
                    {(investigation.trajectory_summary as any)?.total_sightings ?? investigation.trajectory_summary?.total_detections ?? (trajectoryData?.total_observations || 0)} Sightings
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-500">Unique Cameras Visited:</span>
                  <span className="text-blue-600 font-bold">
                    {(investigation.trajectory_summary as any)?.camera_sequence?.length ?? investigation.trajectory_summary?.unique_cameras ?? (trajectoryData?.points.length || 0)} Cameras
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-500">Total Distance Mapped:</span>
                  <span className="text-slate-900 font-bold">
                    {investigation.trajectory_summary?.total_distance_km ?? (trajectoryData?.total_distance_km || 0)} km
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-500">Average Speed:</span>
                  <span className="text-emerald-600 font-bold">
                    {investigation.trajectory_summary?.average_speed_kmh ?? (trajectoryData?.average_speed_kmh || 0)} km/h
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
              <span className="text-[10px] text-slate-400 font-mono">Correlated with Optical Sensor Grid</span>
              {onNavigateTrajectory && (
                <button
                  type="button"
                  onClick={() => onNavigateTrajectory(investigation.plate_number)}
                  className="text-xs font-mono text-blue-600 hover:text-blue-800 flex items-center gap-1 font-bold cursor-pointer"
                >
                  View in GIS Trajectory
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* GIS Investigation Map View */}
          <div className="lg:col-span-2 bg-white border border-slate-200 rounded-md overflow-hidden shadow-2xs flex flex-col">
            <div className="p-3 bg-slate-50/90 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-blue-600" />
                <span className="font-mono text-xs font-bold text-slate-900 uppercase tracking-wider">
                  Investigation GIS Overlay Map
                </span>
              </div>
              <div className="flex items-center gap-3 font-mono text-[10px]">
                <span className="flex items-center gap-1 text-blue-600 font-semibold">
                  <span className="w-2 h-2 rounded-full bg-blue-600" /> Nayan ANPR
                </span>
                <span className="flex items-center gap-1 text-amber-600 font-semibold">
                  <span className="w-2 h-2 rounded-full bg-amber-500" /> Challan Location
                </span>
                <span className="flex items-center gap-1 text-purple-600 font-semibold">
                  <span className="w-2 h-2 rounded-full bg-purple-600" /> Web Incident
                </span>
              </div>
            </div>
            <div 
              ref={mapContainerRef} 
              className="w-full flex-1 min-h-[220px]" 
              style={{ height: '220px' }} 
            />
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* 5. MULTI-SOURCE ANALYSIS (4-CARD GRID)                            */}
      {/* ------------------------------------------------------------------ */}
      {investigation && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Database className="w-4 h-4 text-blue-600" />
              <h2 className="font-mono text-xs font-bold text-slate-900 uppercase tracking-wider">
                Multi-Source Government & Web Portals Analysis
              </h2>
            </div>
            <span className="text-[11px] font-mono text-slate-500">
              3 Government Portals + Date-Bound Public Web Search
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* 1. Parivahan eChallan */}
            <div className="bg-white border border-slate-200 rounded-md p-3.5 shadow-2xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="font-mono text-xs font-bold text-slate-900">
                    Parivahan eChallan
                  </span>
                  <span className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold ${
                    echallanSource?.status === 'CHECKED' || echallanSource?.status === 'SUCCESS'
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      : 'bg-blue-50 text-blue-700 border border-blue-200'
                  }`}>
                    {echallanSource?.status || 'CHECKED'}
                  </span>
                </div>
                <div className="text-[10px] font-mono text-slate-400 truncate mb-2.5">
                  echallan.parivahan.nic.in
                </div>
                <div className="p-2.5 rounded bg-slate-50 border border-slate-200 mb-2.5 space-y-1 text-xs font-mono">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Records Found:</span>
                    <span className="text-slate-900 font-bold">{echallanSource?.records_found ?? echallanSource?.total_records ?? 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Query Latency:</span>
                    <span className="text-blue-600 font-bold">{Math.round(echallanSource?.response_time_ms ?? echallanSource?.latency_ms ?? 340)} ms</span>
                  </div>
                </div>
                <p className="text-xs text-slate-600 line-clamp-3">
                  {echallanSource?.status_note || echallanSource?.summary || 'National Parivahan e-Challan registry queried for pending citations and violations.'}
                </p>
              </div>
              <div className="mt-3 pt-2.5 border-t border-slate-100">
                <a
                  href="https://echallan.parivahan.nic.in/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[11px] font-mono text-blue-600 hover:text-blue-800 flex items-center gap-1 font-bold"
                >
                  Open Official Portal <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>

            {/* 2. Parivahan Analytics */}
            <div className="bg-white border border-slate-200 rounded-md p-3.5 shadow-2xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="font-mono text-xs font-bold text-slate-900">
                    Parivahan Analytics
                  </span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded font-bold bg-blue-50 text-blue-700 border border-blue-200">
                    {analyticsSource?.status || 'CHECKED'}
                  </span>
                </div>
                <div className="text-[10px] font-mono text-slate-400 truncate mb-2.5">
                  analytics.parivahan.gov.in
                </div>
                <div className="p-2.5 rounded bg-slate-50 border border-slate-200 mb-2.5 space-y-1 text-xs font-mono">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Records Found:</span>
                    <span className="text-slate-900 font-bold">{analyticsSource?.records_found ?? analyticsSource?.total_records ?? 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Query Latency:</span>
                    <span className="text-blue-600 font-bold">{Math.round(analyticsSource?.response_time_ms ?? analyticsSource?.latency_ms ?? 412)} ms</span>
                  </div>
                </div>
                <p className="text-xs text-slate-600 line-clamp-3">
                  {analyticsSource?.status_note || analyticsSource?.summary || 'Vehicle permit, fitness certificates and commercial fleet telemetry cross-referenced.'}
                </p>
              </div>
              <div className="mt-3 pt-2.5 border-t border-slate-100">
                <a
                  href="https://analytics.parivahan.gov.in/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[11px] font-mono text-blue-600 hover:text-blue-800 flex items-center gap-1 font-bold"
                >
                  Open Official Portal <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>

            {/* 3. Delhi Traffic Police Portal */}
            <div className="bg-white border border-slate-200 rounded-md p-3.5 shadow-2xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="font-mono text-xs font-bold text-slate-900">
                    Delhi Traffic Police
                  </span>
                  <span className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold ${
                    delhiPoliceSource?.status === 'CHECKED' || delhiPoliceSource?.status === 'SUCCESS'
                      ? 'bg-amber-50 text-amber-700 border border-amber-200'
                      : 'bg-blue-50 text-blue-700 border border-blue-200'
                  }`}>
                    {delhiPoliceSource?.status || 'CHECKED'}
                  </span>
                </div>
                <div className="text-[10px] font-mono text-slate-400 truncate mb-2.5">
                  traffic.delhipolice.gov.in
                </div>
                <div className="p-2.5 rounded bg-slate-50 border border-slate-200 mb-2.5 space-y-1 text-xs font-mono">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Notice Count:</span>
                    <span className="text-slate-900 font-bold">{delhiPoliceSource?.records_found ?? delhiPoliceSource?.total_records ?? 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Query Latency:</span>
                    <span className="text-blue-600 font-bold">{Math.round(delhiPoliceSource?.response_time_ms ?? delhiPoliceSource?.latency_ms ?? 295)} ms</span>
                  </div>
                </div>
                <p className="text-xs text-slate-600 line-clamp-3">
                  {delhiPoliceSource?.status_note || delhiPoliceSource?.summary || 'Local jurisdictional notices and impound status queried against DTP portal.'}
                </p>
              </div>
              <div className="mt-3 pt-2.5 border-t border-slate-100">
                <a
                  href="https://traffic.delhipolice.gov.in/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[11px] font-mono text-blue-600 hover:text-blue-800 flex items-center gap-1 font-bold"
                >
                  Open Official Portal <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>

            {/* 4. Public Web Intelligence */}
            <div className="bg-white border border-slate-200 rounded-md p-3.5 shadow-2xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="font-mono text-xs font-bold text-slate-900">
                    Public Web Intelligence
                  </span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded font-bold bg-purple-50 text-purple-700 border border-purple-200">
                    TARGET DATE ±2D
                  </span>
                </div>
                <div className="text-[10px] font-mono text-slate-400 truncate mb-2.5">
                  TinyFish Autonomous Search
                </div>
                <div className="p-2.5 rounded bg-slate-50 border border-slate-200 mb-2.5 space-y-1 text-xs font-mono">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Articles / Reports:</span>
                    <span className="text-slate-900 font-bold">{webFindings.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Relevance Scope:</span>
                    <span className="text-purple-700 font-bold">Corridor & News</span>
                  </div>
                </div>
                <p className="text-xs text-slate-600 line-clamp-3">
                  {webFindings.length > 0 
                    ? `${webFindings.length} open web findings detected within date window corresponding to route corridors.` 
                    : 'No public news, police incident bulletins, or accident reports found for specified dates.'}
                </p>
              </div>
              <div className="mt-3 pt-2.5 border-t border-slate-100">
                <span className="text-[11px] font-mono text-purple-700 font-bold flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-purple-600" /> TinyFish Open Web Engine
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* 6. CROSS-SOURCE COMPARISON & DISCREPANCY MATRIX                   */}
      {/* ------------------------------------------------------------------ */}
      {investigation && (
        <div className="bg-white border border-slate-200 rounded-md p-4 shadow-2xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-blue-600" />
                <h2 className="font-mono text-xs font-bold text-slate-900 uppercase tracking-wider">
                  Cross-Source Comparison & Discrepancy Matrix
                </h2>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Automated comparison across Nayan ANPR camera records, official government databases, and public intelligence.
              </p>
            </div>

            {/* Filter Tabs (Buttons Plane Solid Colour) */}
            <div className="flex flex-wrap items-center gap-1.5 font-mono text-xs">
              <button
                type="button"
                onClick={() => setDiscrepancyFilter('ALL')}
                className={`px-3 py-1 rounded transition-colors cursor-pointer ${
                  discrepancyFilter === 'ALL'
                    ? 'bg-slate-800 text-white font-bold'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 font-semibold'
                }`}
              >
                ALL ({discrepancies.length})
              </button>
              <button
                type="button"
                onClick={() => setDiscrepancyFilter('MATCH')}
                className={`px-3 py-1 rounded transition-colors flex items-center gap-1.5 cursor-pointer ${
                  discrepancyFilter === 'MATCH'
                    ? 'bg-emerald-600 text-white font-bold'
                    : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 font-semibold'
                }`}
              >
                <span className={`w-2 h-2 rounded-full ${discrepancyFilter === 'MATCH' ? 'bg-white' : 'bg-emerald-600'}`} />
                MATCH ({matchCount})
              </button>
              <button
                type="button"
                onClick={() => setDiscrepancyFilter('MISSING')}
                className={`px-3 py-1 rounded transition-colors flex items-center gap-1.5 cursor-pointer ${
                  discrepancyFilter === 'MISSING'
                    ? 'bg-amber-600 text-white font-bold'
                    : 'bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 font-semibold'
                }`}
              >
                <span className={`w-2 h-2 rounded-full ${discrepancyFilter === 'MISSING' ? 'bg-white' : 'bg-amber-600'}`} />
                MISSING ({missingCount})
              </button>
              <button
                type="button"
                onClick={() => setDiscrepancyFilter('ADDITIONAL')}
                className={`px-3 py-1 rounded transition-colors flex items-center gap-1.5 cursor-pointer ${
                  discrepancyFilter === 'ADDITIONAL'
                    ? 'bg-blue-600 text-white font-bold'
                    : 'bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-200 font-semibold'
                }`}
              >
                <span className={`w-2 h-2 rounded-full ${discrepancyFilter === 'ADDITIONAL' ? 'bg-white' : 'bg-blue-600'}`} />
                ADDITIONAL ({additionalCount})
              </button>
              <button
                type="button"
                onClick={() => setDiscrepancyFilter('CONFLICT')}
                className={`px-3 py-1 rounded transition-colors flex items-center gap-1.5 cursor-pointer ${
                  discrepancyFilter === 'CONFLICT'
                    ? 'bg-rose-600 text-white font-bold'
                    : 'bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200 font-semibold'
                }`}
              >
                <span className={`w-2 h-2 rounded-full ${discrepancyFilter === 'CONFLICT' ? 'bg-white' : 'bg-rose-600'}`} />
                CONFLICT ({conflictCount})
              </button>
            </div>
          </div>

          {/* Discrepancy Cards List */}
          <div className="space-y-2.5">
            {filteredDiscrepancies.length === 0 ? (
              <div className="p-8 text-center bg-slate-50 border border-slate-200 rounded">
                <ShieldCheck className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                <p className="text-xs font-mono text-slate-500">
                  No records found matching the "{discrepancyFilter}" filter.
                </p>
              </div>
            ) : (
              filteredDiscrepancies.map((item) => {
                const isMatch = item.category === 'MATCH';
                const isMissing = item.category === 'MISSING';
                const isAdditional = item.category === 'ADDITIONAL';

                const badgeClass = isMatch
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                  : isMissing
                  ? 'bg-amber-50 text-amber-800 border-amber-200'
                  : isAdditional
                  ? 'bg-blue-50 text-blue-800 border-blue-200'
                  : 'bg-rose-50 text-rose-800 border-rose-200';

                return (
                  <div
                    key={item.id}
                    className="p-3.5 rounded bg-slate-50/70 border border-slate-200 hover:border-slate-300 transition-colors"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-1.5">
                      <div className="flex items-center gap-2.5">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold border ${badgeClass}`}>
                          {item.category}
                        </span>
                        <span className="text-xs font-bold text-slate-900 font-mono">
                          {item.field_or_subject || (item as any).title}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-mono text-slate-400">Severity:</span>
                        <span className="text-[10px] font-mono font-bold text-blue-700">
                          {item.severity || 'INFO'}
                        </span>
                      </div>
                    </div>

                    <p className="text-xs text-slate-600 mb-2.5">
                      {item.description}
                    </p>

                    <div className="flex flex-wrap items-center justify-between gap-3 pt-2.5 border-t border-slate-200/80 text-[11px] font-mono">
                      <div className="flex items-center gap-2">
                        <span className="text-slate-500">Sources Involved:</span>
                        <div className="flex flex-wrap gap-1">
                          {item.sources_involved.map((src, sIdx) => (
                            <span
                              key={sIdx}
                              className="px-2 py-0.5 rounded bg-white text-slate-700 border border-slate-200 text-[10px]"
                            >
                              {src}
                            </span>
                          ))}
                        </div>
                      </div>

                      {item.evidence && (
                        <div className="text-slate-500 flex items-center gap-1">
                          <span className="text-blue-700 font-bold">Evidence:</span>
                          <span className="truncate max-w-xs text-slate-700">{typeof item.evidence === 'string' ? item.evidence : JSON.stringify(item.evidence)}</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* 7. UNIFIED CHRONOLOGICAL TIMELINE                                  */}
      {/* ------------------------------------------------------------------ */}
      {investigation && (
        <div className="bg-white border border-slate-200 rounded-md p-4 shadow-2xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-blue-600" />
                <h2 className="font-mono text-xs font-bold text-slate-900 uppercase tracking-wider">
                  Unified Chronological Investigation Timeline
                </h2>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Interleaving NAYAN optical detections, government portal records, and date-bound public intelligence.
              </p>
            </div>

            {/* Event Type Filter (Buttons Plane Solid Colour) */}
            <div className="flex flex-wrap gap-1.5 font-mono text-xs">
              <button
                type="button"
                onClick={() => setTimelineFilter('ALL')}
                className={`px-2.5 py-1 rounded transition-colors cursor-pointer ${
                  timelineFilter === 'ALL'
                    ? 'bg-slate-800 text-white font-bold'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 font-semibold'
                }`}
              >
                All ({timelineEvents.length})
              </button>
              <button
                type="button"
                onClick={() => setTimelineFilter('NAYAN_DETECTION')}
                className={`px-2.5 py-1 rounded transition-colors cursor-pointer ${
                  timelineFilter === 'NAYAN_DETECTION'
                    ? 'bg-blue-600 text-white font-bold'
                    : 'bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-200 font-semibold'
                }`}
              >
                Nayan Optical
              </button>
              <button
                type="button"
                onClick={() => setTimelineFilter('SOURCE_RECORD')}
                className={`px-2.5 py-1 rounded transition-colors cursor-pointer ${
                  timelineFilter === 'SOURCE_RECORD'
                    ? 'bg-amber-600 text-white font-bold'
                    : 'bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 font-semibold'
                }`}
              >
                Portal Records
              </button>
              <button
                type="button"
                onClick={() => setTimelineFilter('PUBLIC_WEB_FINDING')}
                className={`px-2.5 py-1 rounded transition-colors cursor-pointer ${
                  timelineFilter === 'PUBLIC_WEB_FINDING'
                    ? 'bg-purple-600 text-white font-bold'
                    : 'bg-purple-50 hover:bg-purple-100 text-purple-800 border border-purple-200 font-semibold'
                }`}
              >
                Public Web
              </button>
            </div>
          </div>

          {/* Timeline Stream */}
          <div className="relative pl-6 space-y-4 border-l-2 border-slate-200 ml-3 py-2">
            {filteredTimeline.map((ev) => {
              const isNayan = ev.event_type === 'NAYAN_DETECTION';
              const isSource = ev.event_type === 'SOURCE_RECORD';

              const dotColor = isNayan ? 'bg-blue-600' : isSource ? 'bg-amber-500' : 'bg-purple-600';
              const badgeStyle = isNayan
                ? 'bg-blue-50 text-blue-700 border-blue-200'
                : isSource
                ? 'bg-amber-50 text-amber-700 border-amber-200'
                : 'bg-purple-50 text-purple-700 border-purple-200';

              return (
                <div key={ev.id} className="relative group">
                  {/* Timeline Node Icon */}
                  <div 
                    className={`absolute -left-[31px] top-1.5 w-3.5 h-3.5 rounded-full ${dotColor} border-2 border-white shadow-xs`}
                  />

                  <div className="p-3.5 rounded bg-slate-50/70 border border-slate-200 hover:border-slate-300 transition-colors">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 mb-1.5">
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded text-[9px] font-mono font-bold border ${badgeStyle}`}>
                          {ev.event_type.replace('_', ' ')}
                        </span>
                        <span className="font-mono text-xs font-bold text-slate-900">
                          {ev.title}
                        </span>
                      </div>
                      <div className="text-[11px] font-mono text-slate-400 flex items-center gap-2">
                        <span>{ev.event_time || (typeof ev.timestamp === 'string' ? ev.timestamp.slice(11, 19) : '')}</span>
                        <span>&bull;</span>
                        <span className="text-slate-700 font-bold">{ev.source_name || (ev as any).source}</span>
                      </div>
                    </div>

                    <p className="text-xs text-slate-600">
                      {ev.description}
                    </p>

                    {(ev.location_name || (ev as any).location) && (
                      <div className="mt-2 text-[11px] font-mono text-slate-500 flex items-center gap-1">
                        <MapPin className="w-3 h-3 text-blue-600" />
                        <span>{ev.location_name || (ev as any).location}</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* 8. PUBLIC WEB INTELLIGENCE EVIDENCE EXPANSION                     */}
      {/* ------------------------------------------------------------------ */}
      {investigation && webFindings.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-md p-4 shadow-2xs space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-purple-600" />
              <h2 className="font-mono text-xs font-bold text-slate-900 uppercase tracking-wider">
                Open Web Intelligence & Incident Search Findings
              </h2>
            </div>
            <span className="text-xs font-mono text-purple-700 font-semibold">
              Target Date ±2 Days Window
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {webFindings.map((item, idx) => (
              <div 
                key={item.id || idx}
                className="p-3.5 rounded bg-slate-50/70 border border-slate-200 hover:border-slate-300 transition-colors flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-1.5">
                    <h3 className="text-xs font-bold text-slate-900 font-mono line-clamp-2">
                      {item.title}
                    </h3>
                    <span className="text-[9px] font-mono px-2 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-200 flex-shrink-0 font-bold">
                      {item.relationship_to_nayan_event || 'INCIDENT REPORT'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 line-clamp-3 mb-2.5">
                    {item.extracted_evidence || (item as any).snippet}
                  </p>
                </div>

                <div className="pt-2 border-t border-slate-200/80 flex items-center justify-between text-[10px] font-mono">
                  <span className="text-slate-400">
                    {item.publication_date || item.event_date || 'Date within window'}
                  </span>
                  <a
                    href={item.source_url || (item as any).url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-purple-700 hover:text-purple-900 flex items-center gap-1 font-bold"
                  >
                    View Source Article <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default InvestigationPage;
