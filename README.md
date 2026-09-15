# NAYAN — Networked AI for Yield & ANPR Navigation
### Smart India Hackathon 2026 | Problem Statement 26127 | Team ByteBrains

NAYAN (*Networked AI for Yield & ANPR Navigation*) is an enterprise-grade, real-time Automatic Number Plate Recognition (ANPR), vehicle movement tracking, and intelligent traffic management platform designed for Smart Cities, Law Enforcement, and Advanced Traffic Management Systems (ATMS).

The application operates seamlessly in real time utilizing OpenCV computer vision pipelines, HTML5 hardware camera streams, Leaflet GIS spatial mapping, and a FastAPI backend with Supabase cloud persistence.

---

## 🚀 Key Architectural Capabilities

1. **Hardware Camera ANPR & Optical Reticle HUD**:
   - Live browser/CCTV video feeds via `navigator.mediaDevices.getUserMedia()`, IP cameras, and RTSP streams.
   - Interactive viewfinder brackets, dynamic target reticles, bounding box overlays, and real-time FPS/latency telemetry.

2. **Modular Vision & Pluggable OCR Pipeline**:
   - Frame-by-frame preprocessing (bilateral filtering, adaptive thresholding, Otsu binarization, morphological gradient analysis).
   - High-precision OCR extraction with MoRTH-compliant regex validation and positional confusion correction (e.g. `0/O`, `1/I`, `8/B`, `5/S`, `2/Z`).

3. **2-Step Threat Verification & Smart Deduplication**:
   - Distinguishes between initial vehicle detection and verified OCR plate reads.
   - Blacklist and e-challan checks trigger **only** after high-confidence plate identification.
   - 60-second cooldown deduplication window prevents duplicate alert floods.

4. **GIS Surveillance Grid & Camera Registry**:
   - Interactive Leaflet map surveillance grid across high-density arterial corridors.
   - Instant camera hardware registration, live coordinate editing, and GPS autofill capabilities.

5. **Kinematic Trajectory Reconstruction & Anomaly Detection**:
   - Reconstructs chronological vehicle hops using Haversine distance calculations and velocity telemetry.
   - Detects spatial anomalies including impossible speeds (>120 km/h) and physically improbable corridor jumps.

6. **Traffic Density & Origin-Destination Analytics**:
   - Flow volume trends, corridor density indices, vehicle classification breakdowns, and live threat queues.

---

## 🛠️ Technology Stack

- **Frontend**: React 18, TypeScript, Vite, Tailwind CSS, Lucide Icons, Leaflet GIS
- **Backend**: Python 3.10+, FastAPI, Uvicorn, OpenCV, NumPy, Pydantic
- **Database / Cloud**: Supabase (PostgreSQL with Row Level Security & Audit Logging)
- **Deployment & Ingress**: Cloudflare Named/Ephemeral Tunnels (HTTP/2 persistent protocol)

---

## ⚡ Quick Start (Local Setup)

### 1. Backend Setup
```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\activate
pip install -r requirements.txt
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

### 2. Frontend Setup
```powershell
cd frontend
npm install
npm run dev -- --host 0.0.0.0 --port 5173
```

### 3. One-Click Windows Launcher
Run `start.bat` directly from the root directory to spawn both backend and frontend concurrently.
