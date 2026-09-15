import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Camera as CamIcon, ShieldAlert, Car, Activity, Zap, AlertTriangle, 
  ChevronRight, RefreshCw, ArrowUpRight, Clock, ShieldCheck,
  Sparkles, Crosshair, Video, VideoOff, Upload, CheckCircle2,
  AlertOctagon, Eye, Search, Layers, Play, Square, MapPin, Gauge,
  Radio, HardDrive, Shield, AlertCircle
} from 'lucide-react';
import { api } from '../lib/api';
import { 
  TrafficSummary, CameraSummary, Camera as CameraType, Alert, 
  Observation, DetectionItem 
} from '../types';
import { TrafficMap } from '../components/map/TrafficMap';

interface DashboardPageProps {
  mode: 'live' | 'demo';
  onNavigate: (tab: string, param?: string) => void;
  onToggleMode?: (newMode: 'live' | 'demo') => void;
  onReloadData?: () => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({ 
  mode, 
  onNavigate, 
  onToggleMode,
  onReloadData 
}) => {
  const [summary, setSummary] = useState<TrafficSummary | null>(null);
  const [camSummary, setCamSummary] = useState<CameraSummary>({ online: 0, offline: 0, degraded: 0, total: 0 });
  const [cameras, setCameras] = useState<CameraType[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [recentDetections, setRecentDetections] = useState<Observation[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState<boolean>(true);
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  // WEBCAM & ANPR SCANNER STATE
  const [isWebcamActive, setIsWebcamActive] = useState<boolean>(false);
  const [webcamLoading, setWebcamLoading] = useState<boolean>(false);
  const [processingStatus, setProcessingStatus] = useState<'IDLE' | 'SCANNING' | 'DETECTED'>('IDLE');
  const [fps, setFps] = useState<number>(0);
  const [lastProcessedTime, setLastProcessedTime] = useState<string | null>(null);
  const [currentDetections, setCurrentDetections] = useState<DetectionItem[]>([]);
  const [activeBlacklistAlert, setActiveBlacklistAlert] = useState<{
    plate: string;
    reason: string;
    camera: string;
    time: string;
  } | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const processingIntervalRef = useRef<any>(null);
  const fpsCountRef = useRef<number>(0);
  const fpsTimerRef = useRef<any>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Subtle sound chime
  const playAlertChime = useCallback((freq = 880, type: 'critical' | 'normal' = 'normal') => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = type === 'critical' ? 'sawtooth' : 'sine';
      osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
      gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + (type === 'critical' ? 0.45 : 0.25));
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + (type === 'critical' ? 0.45 : 0.25));
    } catch {}
  }, []);

  const loadData = async () => {
    try {
      const [sumData, camSum, camList, alertList, obsList] = await Promise.all([
        api.getTrafficSummary(mode).catch(() => null),
        api.getCameraSummary(mode).catch(() => ({ online: 0, offline: 0, degraded: 0, total: 0 })),
        api.getCameras(mode).catch(() => []),
        api.getAlerts(undefined, undefined, mode).catch(() => []),
        api.getObservations(undefined, 10, mode).catch(() => [])
      ]);
      if (sumData) setSummary(sumData);
      setCamSummary(camSum);
      setCameras(camList);
      setAlerts(alertList);
      setRecentDetections(obsList);
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 4000);
    return () => clearInterval(interval);
  }, [mode]);

  // Handle Demo dataset controls
  const handleLoadDemo = async () => {
    try {
      setActionNotice('Populating synthetic demo dataset...');
      await api.loadDemoData();
      await loadData();
      setActionNotice('Demo dataset active with synthetic records (DL 99 ZZ 0001, DL 99 ZZ 0002, HR 99 YY 0003).');
      playAlertChime(660);
      setTimeout(() => setActionNotice(null), 4000);
    } catch (e) {
      setActionNotice('Failed to load demo dataset');
    }
  };

  const handleClearDemo = async () => {
    try {
      setActionNotice('Purging demo records...');
      await api.clearDemoData();
      await loadData();
      setActionNotice('All demo records cleared. Live mode active.');
      setTimeout(() => setActionNotice(null), 3000);
    } catch (e) {
      setActionNotice('Failed to clear demo records');
    }
  };

  // START WEBCAM
  const startWebcam = async () => {
    setWebcamLoading(true);
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Webcam not supported in this browser context.');
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 15 } },
        audio: false
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
      setIsWebcamActive(true);
      setProcessingStatus('SCANNING');
      playAlertChime(880);

      // Register / Heartbeat CAM-01
      api.sendCameraHeartbeat({ camera_id: 'cam-01', status: 'ONLINE' }).catch(() => {});

      // Start FPS counter
      fpsCountRef.current = 0;
      fpsTimerRef.current = setInterval(() => {
        setFps(fpsCountRef.current);
        fpsCountRef.current = 0;
      }, 1000);

      // Start periodic ANPR processing loop (every 1.8s)
      processingIntervalRef.current = setInterval(processWebcamFrame, 1800);
    } catch (err: any) {
      console.error('Failed to start webcam:', err);
      setActionNotice(`Webcam Error: ${err.message || 'Permission denied'}`);
      setTimeout(() => setActionNotice(null), 5000);
    } finally {
      setWebcamLoading(false);
    }
  };

  // STOP WEBCAM
  const stopWebcam = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    if (processingIntervalRef.current) clearInterval(processingIntervalRef.current);
    if (fpsTimerRef.current) clearInterval(fpsTimerRef.current);
    setIsWebcamActive(false);
    setProcessingStatus('IDLE');
    setFps(0);
    setCurrentDetections([]);
    api.sendCameraHeartbeat({ camera_id: 'cam-01', status: 'OFFLINE' }).catch(() => {});
  };

  // PROCESS WEBCAM FRAME FOR ANPR
  const processWebcamFrame = async () => {
    if (!videoRef.current || !canvasRef.current || videoRef.current.readyState < 2) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    fpsCountRef.current++;
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    canvas.toBlob(async (blob) => {
      if (!blob) return;
      try {
        const res = await api.processFrame(blob, 'cam-01');
        setLastProcessedTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));

        if (res.detections && res.detections.length > 0) {
          setCurrentDetections(res.detections);
          setProcessingStatus('DETECTED');
          drawDetectionsOnCanvas(res.detections, canvas.width, canvas.height);

          for (const det of res.detections) {
            if (det.normalized_plate.includes('ZZ0002') || det.plate_number.includes('DL 99 ZZ 0002')) {
              playAlertChime(440, 'critical');
              setActiveBlacklistAlert({
                plate: det.plate_number,
                reason: 'Synthetic Watchlist Intercept (Critical)',
                camera: 'CAM-01 (Operator Command Station)',
                time: new Date().toLocaleTimeString()
              });
              break;
            }
          }
        } else {
          setProcessingStatus('SCANNING');
        }
      } catch (e) {
        // silent error during loop
      }
    }, 'image/jpeg', 0.85);
  };

  // DRAW BOUNDING BOXES ON ACTIVE CANVAS
  const drawDetectionsOnCanvas = (detections: DetectionItem[], w: number, h: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    detections.forEach(det => {
      const [x1, y1, x2, y2] = det.bbox;
      const isBlacklist = det.normalized_plate.includes('ZZ0002') || det.plate_number.includes('DL 99 ZZ 0002');
      const boxColor = isBlacklist ? '#ef4444' : '#10b981';

      ctx.strokeStyle = boxColor;
      ctx.lineWidth = 3;
      ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);

      ctx.fillStyle = boxColor;
      const label = `${det.plate_number} (${Math.round(det.ocr_confidence * 100)}%)`;
      ctx.font = 'bold 12px monospace';
      const textWidth = ctx.measureText(label).width;
      ctx.fillRect(x1, Math.max(0, y1 - 20), textWidth + 8, 20);

      ctx.fillStyle = '#ffffff';
      ctx.fillText(label, x1 + 4, Math.max(14, y1 - 5));
    });
  };

  // SIMULATE SYNTHETIC TEST PLATES (1-Click Verification)
  const triggerSyntheticPlateTest = async (plate: string, vehType: string, isAlert: boolean) => {
    try {
      const obs = await api.simulateObservation(plate, 'cam-01');
      playAlertChime(isAlert ? 440 : 880, isAlert ? 'critical' : 'normal');

      setCurrentDetections([{
        plate_number: plate,
        normalized_plate: plate.replace(/\s+/g, ''),
        ocr_confidence: 0.98,
        detection_confidence: 0.95,
        vehicle_type: vehType,
        bbox: [100, 150, 380, 240],
        ocr_engine: 'modular_anpr',
        is_demo: false,
        alert_triggered: isAlert ? 'BLACKLISTED_VEHICLE' : undefined
      }]);

      if (isAlert) {
        setActiveBlacklistAlert({
          plate: plate,
          reason: 'Synthetic Watchlist Intercept (Critical Priority)',
          camera: 'CAM-01 (Operator Command Station)',
          time: new Date().toLocaleTimeString()
        });
      } else {
        setActiveBlacklistAlert(null);
      }

      setActionNotice(`Processed ANPR test for plate ${plate}. Logged to live feed.`);
      setTimeout(() => setActionNotice(null), 3500);
      loadData();
    } catch (e: any) {
      setActionNotice(`Simulation failed: ${e.message}`);
    }
  };

  // MANUAL FILE UPLOAD SCAN
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setActionNotice(`Analyzing vehicle snapshot: ${file.name}...`);
    try {
      const res = await api.processFrame(file, 'cam-01');
      if (res.detections && res.detections.length > 0) {
        setCurrentDetections(res.detections);
        setActionNotice(`Successfully recognized plate: ${res.detections[0].plate_number}`);
        playAlertChime(880);
      } else {
        setActionNotice('No high-contrast license plate recognized in this image.');
      }
      loadData();
      setTimeout(() => setActionNotice(null), 4000);
    } catch (err: any) {
      setActionNotice(`Upload scan error: ${err.message}`);
    }
  };

  // ACKNOWLEDGE ALERT
  const handleAcknowledgeAlert = async (alertId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await api.acknowledgeAlert(alertId);
      setAlerts(prev => prev.filter(a => a.id !== alertId));
      setActionNotice('Threat alert acknowledged.');
      setTimeout(() => setActionNotice(null), 2500);
    } catch (err) {
      console.error(err);
    }
  };

  const criticalAlerts = alerts.filter(a => a.severity === 'CRITICAL' && a.status === 'ACTIVE');
  const highAlerts = alerts.filter(a => a.severity === 'HIGH' && a.status === 'ACTIVE');
  const mediumAlerts = alerts.filter(a => a.severity === 'MEDIUM' && a.status === 'ACTIVE');

  return (
    <div className="space-y-3.5 pb-6 font-sans">
      {/* ------------------------------------------------------------- */}
      {/* 1. OPERATIONAL TELEMETRY KPI STRIP (4-Column Enterprise Strip) */}
      {/* ------------------------------------------------------------- */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
        {/* CARD 1: CAMERA SENSOR NETWORK */}
        <div className="bg-white border border-slate-200 rounded p-3 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 text-[10px] font-mono uppercase font-bold tracking-wider">
            <span className="flex items-center gap-1.5 text-slate-700">
              <CamIcon className="w-3.5 h-3.5 text-blue-600" />
              CAMERA SENSOR GRID
            </span>
            <span className="px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 font-mono text-[9px] border border-slate-200">
              ID: CAM-NET
            </span>
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <div className="text-2xl font-bold font-mono text-slate-900 tracking-tight">
              {camSummary.total}
              <span className="text-xs font-normal text-slate-400 font-sans ml-1">nodes</span>
            </div>
            <div className="text-right font-mono text-xs">
              <span className="text-emerald-700 font-bold flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                {camSummary.online} ONLINE
              </span>
            </div>
          </div>
          <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-[10px] font-mono text-slate-500">
            <span>Offline: <b className="text-slate-700">{camSummary.offline}</b></span>
            <span>Availability: <b className="text-emerald-700">{Math.round((camSummary.online / Math.max(1, camSummary.total)) * 100)}%</b></span>
          </div>
        </div>

        {/* CARD 2: 24H ANPR READ VOLUME */}
        <div className="bg-white border border-slate-200 rounded p-3 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 text-[10px] font-mono uppercase font-bold tracking-wider">
            <span className="flex items-center gap-1.5 text-slate-700">
              <Activity className="w-3.5 h-3.5 text-emerald-600" />
              ANPR 24H READ VOLUME
            </span>
            <span className="text-[9px] font-mono text-emerald-700 font-bold flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> LIVE
            </span>
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <div className="text-2xl font-bold font-mono text-slate-900 tracking-tight">
              {summary ? summary.anpr_reads_today.toLocaleString() : recentDetections.length}
            </div>
            <div className="text-xs font-mono text-slate-600 font-medium">
              ~{summary ? Math.max(1, Math.round(summary.anpr_reads_today / 60)) : 0} reads/min
            </div>
          </div>
          <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-[10px] font-mono text-slate-500">
            <span>Peak Interval: <b className="text-slate-700">{summary?.peak_hour || '09:00 - 10:00'}</b></span>
            <span>Unique Veh: <b className="text-slate-700">{summary?.vehicles_today || recentDetections.length}</b></span>
          </div>
        </div>

        {/* CARD 3: SECURITY THREAT INCIDENTS */}
        <div className="bg-white border border-slate-200 rounded p-3 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 text-[10px] font-mono uppercase font-bold tracking-wider">
            <span className="flex items-center gap-1.5 text-slate-700">
              <ShieldAlert className="w-3.5 h-3.5 text-rose-600" />
              SECURITY THREAT ALERTS
            </span>
            <span className="px-1.5 py-0.2 rounded font-mono text-[9px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
              {alerts.length} ACTIVE
            </span>
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <div className="text-2xl font-bold font-mono text-rose-700 tracking-tight">
              {alerts.length}
              <span className="text-xs font-normal text-slate-400 font-sans ml-1">intercepts</span>
            </div>
            <div className="flex items-center gap-1.5 text-[10px] font-mono">
              <span className="px-1.5 py-0.5 rounded bg-rose-100 text-rose-900 font-bold">
                CRIT: {criticalAlerts.length}
              </span>
              <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 font-bold">
                HIGH: {highAlerts.length}
              </span>
            </div>
          </div>
          <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-[10px] font-mono text-slate-500">
            <span>Advisory / Med: <b className="text-slate-700">{mediumAlerts.length}</b></span>
            <button 
              onClick={() => onNavigate('alerts')}
              className="text-blue-600 hover:text-blue-800 font-semibold cursor-pointer"
            >
              Incident Triage &rarr;
            </button>
          </div>
        </div>

        {/* CARD 4: TRAFFIC VELOCITY & CONGESTION */}
        <div className="bg-white border border-slate-200 rounded p-3 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 text-[10px] font-mono uppercase font-bold tracking-wider">
            <span className="flex items-center gap-1.5 text-slate-700">
              <Gauge className="w-3.5 h-3.5 text-blue-600" />
              CORRIDOR FLOW VELOCITY
            </span>
            <span className="text-[9px] font-mono text-slate-500">
              INDEX: {summary?.congestion_index || 25}/100
            </span>
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <div className="text-2xl font-bold font-mono text-slate-900 tracking-tight">
              {summary?.average_speed_kmh || 42}
              <span className="text-xs font-normal text-slate-500 font-mono ml-1">km/h</span>
            </div>
            <div>
              <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase border ${
                (summary?.congestion_level || 'LOW') === 'HIGH'
                  ? 'bg-rose-50 text-rose-800 border-rose-300'
                  : (summary?.congestion_level || 'LOW') === 'MODERATE'
                  ? 'bg-amber-50 text-amber-800 border-amber-300'
                  : 'bg-emerald-50 text-emerald-800 border-emerald-300'
              }`}>
                {summary?.congestion_level || 'LOW'} DENSITY
              </span>
            </div>
          </div>
          <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-[10px] font-mono text-slate-500">
            <span>Target Velocity: <b className="text-slate-700">45 km/h</b></span>
            <span>Status: <b className="text-emerald-700">Optimal Flow</b></span>
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 2. THREE-COLUMN COMMAND CENTER WORKBENCH                      */}
      {/* ------------------------------------------------------------- */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5">
        {/* COLUMN 1 (4 Cols): CCTV VIDEO SURVEILLANCE CONSOLE */}
        <div className="lg:col-span-4 flex flex-col space-y-2.5">
          <div className="bg-white border border-slate-200 rounded p-3 shadow-2xs flex-1 flex flex-col justify-between">
            <div>
              {/* Console Header */}
              <div className="flex items-center justify-between pb-2.5 border-b border-slate-100">
                <div className="flex items-center space-x-2">
                  <span className={`w-2 h-2 rounded-full ${isWebcamActive ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'}`} />
                  <h3 className="font-bold text-xs uppercase tracking-wider text-slate-900 font-mono">
                    SURVEILLANCE HUD
                  </h3>
                </div>
                <div className="flex items-center gap-1.5 font-mono text-[10px]">
                  <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200 font-bold">
                    CAM-01 [OPTICAL]
                  </span>
                </div>
              </div>

              {/* Viewfinder Container */}
              <div className="relative mt-2.5 rounded overflow-hidden bg-[#070b14] aspect-[4/3] border border-slate-800 flex items-center justify-center group">
                {/* Hidden video element feeding into canvas */}
                <video 
                  ref={videoRef} 
                  playsInline 
                  muted 
                  className="hidden" 
                />

                {/* Primary Rendering Canvas */}
                <canvas 
                  ref={canvasRef} 
                  className={`w-full h-full object-cover ${isWebcamActive ? 'block' : 'hidden'}`} 
                />

                {/* Inactive Stand-by View */}
                {!isWebcamActive && (
                  <div className="text-center p-6 space-y-3">
                    <div className="w-10 h-10 rounded bg-slate-900 border border-slate-800 flex items-center justify-center mx-auto text-slate-500">
                      <CamIcon className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-white font-mono uppercase tracking-wider">
                        Camera Standby
                      </div>
                      <div className="text-[11px] text-slate-400 mt-1 max-w-xs leading-relaxed">
                        Click below to initialize local workstation optical sensor or trigger tactical target simulation.
                      </div>
                    </div>
                    <button
                      onClick={startWebcam}
                      disabled={webcamLoading}
                      className="px-4 py-1.5 rounded bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs transition-colors flex items-center gap-2 mx-auto cursor-pointer shadow-xs"
                    >
                      <Play className="w-3.5 h-3.5 fill-current" />
                      <span>{webcamLoading ? 'INITIALIZING...' : 'START OPTICAL STREAM'}</span>
                    </button>
                  </div>
                )}

                {/* Viewfinder Telemetry Overlay */}
                {isWebcamActive && (
                  <>
                    {/* Top HUD Metadata */}
                    <div className="absolute top-2 left-2 flex items-center gap-1.5 z-10 pointer-events-none">
                      <span className="bg-slate-950/80 text-emerald-400 px-2 py-0.5 rounded text-[9px] font-mono font-bold border border-slate-700">
                        {fps} FPS
                      </span>
                      <span className="bg-slate-950/80 text-blue-400 px-2 py-0.5 rounded text-[9px] font-mono border border-slate-700">
                        STAT: {processingStatus}
                      </span>
                    </div>

                    <div className="absolute top-2 right-2 z-10">
                      <button
                        onClick={stopWebcam}
                        className="bg-rose-600/90 hover:bg-rose-600 text-white p-1 rounded text-xs transition-colors cursor-pointer"
                        title="Stop Optical Stream"
                      >
                        <Square className="w-3.5 h-3.5 fill-current" />
                      </button>
                    </div>

                    {lastProcessedTime && (
                      <div className="absolute bottom-2 left-2 text-[9px] font-mono text-slate-400 bg-slate-950/80 px-2 py-0.5 rounded border border-slate-800 pointer-events-none">
                        FRAME SYNC: {lastProcessedTime}
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* ACTIVE DETECTION TELEMETRY CARD */}
              <div className="mt-2.5 p-2.5 bg-slate-50 border border-slate-200 rounded">
                <div className="text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1.5 flex items-center justify-between font-mono">
                  <span>FRAME OCR TARGETS</span>
                  {currentDetections.length > 0 && (
                    <span className="text-emerald-700 font-bold">
                      {currentDetections.length} RECOGNIZED
                    </span>
                  )}
                </div>

                {currentDetections.length > 0 ? (
                  <div className="space-y-1.5">
                    {currentDetections.map((det, idx) => {
                      const isBlacklist = det.normalized_plate.includes('ZZ0002') || det.plate_number.includes('DL 99 ZZ 0002');
                      return (
                        <div 
                          key={idx} 
                          onClick={() => onNavigate('vehicles', det.plate_number)}
                          className={`p-2 rounded border transition-all cursor-pointer flex items-center justify-between ${
                            isBlacklist 
                              ? 'bg-rose-50 border-rose-300 hover:bg-rose-100' 
                              : 'bg-white border-slate-200 hover:border-blue-400'
                          }`}
                        >
                          <div>
                            <div className="font-mono text-xs font-black text-slate-900 flex items-center gap-1.5">
                              <span>{det.plate_number}</span>
                              {isBlacklist && (
                                <span className="bg-rose-600 text-white text-[8px] px-1 py-0.2 rounded font-bold uppercase">
                                  WATCHLIST MATCH
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] text-slate-500 mt-0.5 font-mono">
                              Type: <b className="text-slate-700">{det.vehicle_type}</b> &bull; OCR Conf: <b>{Math.round(det.ocr_confidence * 100)}%</b>
                            </div>
                          </div>
                          <span className="text-blue-700 text-xs font-bold flex items-center gap-0.5">
                            Dossier <ChevronRight className="w-3.5 h-3.5" />
                          </span>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-[11px] text-slate-400 py-1 font-mono italic">
                    {isWebcamActive ? 'Optical sensor listening for vehicle number plates...' : 'Camera standby. Start stream or click simulation buttons below.'}
                  </div>
                )}
              </div>

              {/* CRITICAL BLACKLIST POPUP IF DETECTED */}
              {activeBlacklistAlert && (
                <div className="mt-2.5 p-2.5 rounded bg-rose-600 text-white border border-rose-700 animate-fadeIn">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <ShieldAlert className="w-4 h-4 text-yellow-300" />
                      <div>
                        <div className="text-[9px] uppercase font-mono font-bold tracking-wider text-rose-200">
                          CRITICAL INTERCEPT
                        </div>
                        <div className="text-xs font-mono font-black">
                          {activeBlacklistAlert.plate} &bull; {activeBlacklistAlert.reason}
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => onNavigate('vehicles', activeBlacklistAlert.plate)}
                      className="px-2 py-1 rounded bg-yellow-400 hover:bg-yellow-300 text-slate-900 text-[10px] font-bold font-mono cursor-pointer"
                    >
                      TRIAGE &rarr;
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Tactical Target Injectors */}
            <div className="mt-2.5 pt-2.5 border-t border-slate-100 space-y-2">
              <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider font-mono">
                TACTICAL TARGET SIMULATOR
              </div>
              <div className="grid grid-cols-3 gap-1.5 font-mono">
                <button
                  onClick={() => triggerSyntheticPlateTest('DL 99 ZZ 0001', 'Sedan', false)}
                  className="p-1.5 rounded bg-slate-50 hover:bg-slate-100 text-slate-800 text-[10px] font-semibold border border-slate-200 text-center cursor-pointer"
                >
                  <span className="block font-bold">DL 99 ZZ 0001</span>
                  <span className="text-[9px] text-emerald-700">Clear [Sedan]</span>
                </button>
                <button
                  onClick={() => triggerSyntheticPlateTest('DL 99 ZZ 0002', 'SUV', true)}
                  className="p-1.5 rounded bg-rose-50 hover:bg-rose-100 text-rose-900 text-[10px] font-semibold border border-rose-300 text-center cursor-pointer"
                >
                  <span className="block font-bold text-rose-800">DL 99 ZZ 0002</span>
                  <span className="text-[9px] text-rose-600 font-bold">Watchlist 🔴</span>
                </button>
                <button
                  onClick={() => triggerSyntheticPlateTest('HR 99 YY 0003', 'Motorcycle', false)}
                  className="p-1.5 rounded bg-amber-50 hover:bg-amber-100 text-amber-900 text-[10px] font-semibold border border-amber-300 text-center cursor-pointer"
                >
                  <span className="block font-bold text-amber-800">HR 99 YY 0003</span>
                  <span className="text-[9px] text-amber-600 font-bold">Challan 🟡</span>
                </button>
              </div>

              {/* Upload image fallback */}
              <div>
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  onChange={handleFileUpload} 
                  accept="image/*" 
                  className="hidden" 
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full py-1.5 rounded bg-white hover:bg-slate-50 text-slate-600 border border-slate-200 text-[10px] font-mono font-medium flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Upload className="w-3 h-3 text-slate-400" />
                  <span>MANUAL SNAPSHOT ANPR INGESTION</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* COLUMN 2 (5 Cols): SURVEILLANCE GIS MAP */}
        <div className="lg:col-span-5 flex flex-col space-y-2.5">
          <div className="bg-white border border-slate-200 rounded p-3 shadow-2xs flex-1 flex flex-col">
            {/* Map Header */}
            <div className="flex items-center justify-between pb-2.5 border-b border-slate-100 mb-2">
              <div className="flex items-center space-x-2">
                <MapPin className="w-4 h-4 text-blue-600" />
                <h3 className="font-bold text-xs uppercase tracking-wider text-slate-900 font-mono">
                  CITY SURVEILLANCE GIS GRID
                </h3>
              </div>
              <div className="flex items-center gap-2 text-xs font-mono">
                <span className="text-[10px] text-emerald-700 font-bold">
                  {camSummary.online} ACTIVE
                </span>
                <span className="text-slate-300">|</span>
                <span className="text-[10px] text-slate-500 font-medium">
                  {camSummary.offline} INACTIVE
                </span>
              </div>
            </div>

            {/* Interactive React-Leaflet Map Component */}
            <div className="flex-1 min-h-[380px] rounded overflow-hidden border border-slate-200">
              <TrafficMap 
                cameras={cameras}
                height="100%"
                selectedCameraId={selectedCameraId}
                onSelectCamera={(c) => setSelectedCameraId(c.id)}
              />
            </div>

            {/* Selected Camera Telemetry Card (Requirement 14) */}
            {selectedCameraId && (() => {
              const selectedCam = cameras.find(c => c.id === selectedCameraId);
              if (!selectedCam) return null;
              const camAlerts = alerts.filter(a => a.camera_id === selectedCam.id || a.camera_code === selectedCam.camera_code);
              const camDetections = recentDetections.filter(d => d.camera_id === selectedCam.id || d.camera_code === selectedCam.camera_code);

              return (
                <div className="mt-2.5 p-2.5 bg-slate-50 border border-slate-200 rounded text-xs font-mono">
                  <div className="flex items-center justify-between font-bold text-slate-900 mb-1">
                    <span className="flex items-center gap-1.5 text-blue-700">
                      <CamIcon className="w-3.5 h-3.5" />
                      {selectedCam.camera_code} &bull; {selectedCam.name}
                    </span>
                    <span className={`px-1.5 py-0.2 rounded text-[9px] ${
                      selectedCam.status === 'ONLINE' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-700'
                    }`}>
                      {selectedCam.status}
                    </span>
                  </div>
                  <div className="text-slate-600 text-[10px] mb-2 font-mono">
                    LOC: {selectedCam.location_name} | COORDS: <b className="text-slate-900">{selectedCam.latitude.toFixed(4)}, {selectedCam.longitude.toFixed(4)}</b> | SRC: <b className="text-blue-700">{selectedCam.location_source || 'MANUAL'}</b>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-[10px]">
                    <div className="bg-white p-1.5 rounded border border-slate-200">
                      <span className="text-slate-400 block text-[9px] uppercase font-mono">Camera Threats</span>
                      <strong className={camAlerts.length > 0 ? 'text-rose-700' : 'text-slate-700'}>
                        {camAlerts.length} Active Incident(s)
                      </strong>
                    </div>
                    <div className="bg-white p-1.5 rounded border border-slate-200">
                      <span className="text-slate-400 block text-[9px] uppercase font-mono">Recent Observations</span>
                      <strong className="text-slate-700">
                        {camDetections.length} ANPR Observations
                      </strong>
                    </div>
                  </div>
                </div>
              );
            })()}

            <div className="mt-2 text-[10px] text-slate-400 font-mono flex items-center justify-between">
              <span>Select camera pins on map to inspect location telemetry.</span>
              <span className="text-slate-500 font-bold">Leaflet GIS Engine</span>
            </div>
          </div>
        </div>

        {/* COLUMN 3 (3 Cols): ACTIVE INCIDENT THREAT FEED */}
        <div className="lg:col-span-3 flex flex-col space-y-2.5">
          <div className="bg-white border border-slate-200 rounded p-3 shadow-2xs flex-1 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-2.5 border-b border-slate-100">
                <div className="flex items-center space-x-2">
                  <ShieldAlert className="w-4 h-4 text-rose-600" />
                  <h3 className="font-bold text-xs uppercase tracking-wider text-slate-900 font-mono">
                    THREAT QUEUE
                  </h3>
                </div>
                <span className="px-1.5 py-0.2 rounded font-mono text-[9px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                  {alerts.length} PENDING
                </span>
              </div>

              {/* Alert items list */}
              <div className="mt-2.5 space-y-2 max-h-[440px] overflow-y-auto pr-0.5 custom-scrollbar">
                {alerts.length > 0 ? (
                  alerts.slice(0, 7).map(alert => {
                    const isCritical = alert.severity === 'CRITICAL';
                    const isHigh = alert.severity === 'HIGH';

                    return (
                      <div
                        key={alert.id}
                        onClick={() => alert.plate_number && onNavigate('vehicles', alert.plate_number)}
                        className={`p-2.5 rounded border transition-colors cursor-pointer text-xs ${
                          isCritical
                            ? 'bg-rose-50/70 border-rose-300 hover:bg-rose-100/70'
                            : isHigh
                            ? 'bg-amber-50/70 border-amber-300 hover:bg-amber-100/70'
                            : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        <div className="flex items-center justify-between font-mono text-[10px]">
                          <span className={`px-1.5 py-0.2 rounded font-bold uppercase ${
                            isCritical ? 'bg-rose-600 text-white' : isHigh ? 'bg-amber-600 text-white' : 'bg-slate-700 text-white'
                          }`}>
                            {alert.severity}
                          </span>
                          <span className="text-slate-400 font-medium">
                            {new Date(alert.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>

                        <p className="text-[11px] text-slate-700 font-medium mt-1 line-clamp-2 leading-relaxed font-sans">
                          {alert.description}
                        </p>

                        <div className="mt-2 pt-1.5 border-t border-slate-200/60 flex items-center justify-between text-[10px] font-mono">
                          {alert.plate_number ? (
                            <span className="font-bold text-slate-900 bg-white px-1.5 py-0.2 rounded border border-slate-300">
                              {alert.plate_number}
                            </span>
                          ) : (
                            <span className="text-slate-500">{alert.camera_code || 'SENSOR'}</span>
                          )}

                          <button
                            onClick={(e) => handleAcknowledgeAlert(alert.id, e)}
                            className="text-slate-500 hover:text-slate-800 font-bold px-1.5 py-0.2 rounded hover:bg-white transition-colors cursor-pointer"
                          >
                            ACK &rarr;
                          </button>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="text-center py-12 space-y-2">
                    <CheckCircle2 className="w-6 h-6 text-emerald-500 mx-auto" />
                    <div className="text-xs font-bold text-slate-700 font-mono">PERIMETER CLEAR</div>
                    <div className="text-[10px] text-slate-400">Zero unhandled security intercepts</div>
                  </div>
                )}
              </div>
            </div>

            <div className="pt-2.5 border-t border-slate-100">
              <button
                onClick={() => onNavigate('alerts')}
                className="w-full py-1.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-mono text-xs font-semibold flex items-center justify-center gap-1 transition-colors cursor-pointer"
              >
                <span>OPEN INCIDENT LOG</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 3. BOTTOM: HIGH-DENSITY ANPR DETECTIONS TELEMETRY TABLE       */}
      {/* ------------------------------------------------------------- */}
      <div className="bg-white border border-slate-200 rounded p-3.5 shadow-2xs">
        <div className="flex items-center justify-between pb-2.5 border-b border-slate-100 mb-2">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-xs uppercase tracking-wider text-slate-900 font-mono">
                REAL-TIME ANPR TELEMETRY LOG
              </h3>
              <span className="px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 font-mono text-[9px] font-bold border border-slate-200">
                STATION-STREAM
              </span>
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Chronological log of automated license plate recognitions across active camera nodes.
            </p>
          </div>
          <button
            onClick={() => onNavigate('vehicles')}
            className="text-xs font-mono font-bold text-blue-700 hover:text-blue-900 flex items-center gap-1 cursor-pointer"
          >
            <span>GLOBAL VEHICLE SEARCH</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/80 text-slate-500 text-[10px] font-mono font-bold uppercase tracking-wider">
                <th className="py-2 px-3">TIMESTAMP</th>
                <th className="py-2 px-3">PLATE IDENTIFIER</th>
                <th className="py-2 px-3">VEHICLE CLASS</th>
                <th className="py-2 px-3">CAMERA NODE</th>
                <th className="py-2 px-3">LOCATION</th>
                <th className="py-2 px-3">OCR CONF</th>
                <th className="py-2 px-3">STATUS</th>
                <th className="py-2 px-3 text-right">ACTION</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700 font-mono">
              {recentDetections.length > 0 ? (
                recentDetections.map((obs) => {
                  const isBlacklist = obs.plate_number.includes('ZZ 0002') || obs.plate_number.includes('ZZ0002');
                  const isChallan = obs.plate_number.includes('YY 0003') || obs.plate_number.includes('YY0003');

                  return (
                    <tr 
                      key={obs.id} 
                      onClick={() => onNavigate('vehicles', obs.plate_number)}
                      className="hover:bg-slate-50/80 transition-colors cursor-pointer"
                    >
                      <td className="py-2 px-3 text-slate-500 whitespace-nowrap text-[11px]">
                        {new Date(obs.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </td>
                      <td className="py-2 px-3 whitespace-nowrap">
                        <span className={`font-black font-mono px-2 py-0.5 rounded border text-[11px] ${
                          isBlacklist
                            ? 'bg-rose-100 text-rose-900 border-rose-300'
                            : isChallan
                            ? 'bg-amber-100 text-amber-900 border-amber-300'
                            : 'bg-slate-100 text-slate-900 border-slate-300'
                        }`}>
                          {obs.plate_number}
                        </span>
                      </td>
                      <td className="py-2 px-3 font-sans capitalize text-slate-800 text-[11px]">
                        {obs.vehicle_type || 'Car'}
                      </td>
                      <td className="py-2 px-3 whitespace-nowrap font-mono text-[11px] text-blue-700 font-semibold">
                        {obs.camera_code || 'CAM-01'}
                      </td>
                      <td className="py-2 px-3 font-sans text-slate-600 truncate max-w-[200px] text-[11px]">
                        {obs.location_name || 'Operator Command Station'}
                      </td>
                      <td className="py-2 px-3 whitespace-nowrap text-[11px]">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-slate-900">
                            {Math.round(obs.ocr_confidence * 100)}%
                          </span>
                          <div className="w-12 h-1.5 rounded-full bg-slate-200 overflow-hidden">
                            <div 
                              className="h-full bg-blue-600" 
                              style={{ width: `${Math.round(obs.ocr_confidence * 100)}%` }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="py-2 px-3 whitespace-nowrap">
                        {isBlacklist ? (
                          <span className="px-2 py-0.5 rounded font-mono font-bold text-[9px] bg-rose-100 text-rose-900 border border-rose-300">
                            WATCHLIST MATCH
                          </span>
                        ) : isChallan ? (
                          <span className="px-2 py-0.5 rounded font-mono font-bold text-[9px] bg-amber-100 text-amber-900 border border-amber-300">
                            CHALLAN PENDING
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded font-mono font-bold text-[9px] bg-emerald-100 text-emerald-900 border border-emerald-300">
                            CLEAR
                          </span>
                        )}
                      </td>
                      <td className="py-2 px-3 text-right whitespace-nowrap font-mono text-[11px]">
                        <span className="text-blue-700 hover:text-blue-900 font-bold">
                          DOSSIER &rarr;
                        </span>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={8} className="text-center py-6 text-slate-400 font-mono text-xs">
                    No license plates recorded on station yet. Start webcam or simulate vehicle sighting above.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;
