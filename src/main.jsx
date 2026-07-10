import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Camera, Download, FlipHorizontal, HelpCircle, Loader2, Play, RotateCcw, Square } from 'lucide-react';
import './styles/app.css';
import { buildFullExport, buildSummaryExport, downloadCsv, downloadJson, downloadLongCsv, downloadReportHtml } from './lib/exporters.js';
import { APP_VERSION, DATA_DICTIONARY, DEFAULT_SMOOTHING_CONFIG, JOINT_CONFIG, PROTOCOLS, computeFrameAngles, defaultResults, summarizeRomFrames } from './lib/measurements.js';
import { detectFrame, drawLandmarks, loadMediaPipeModels } from './lib/mediapipe.js';

const SIDES = ['auto/bilateral', 'left', 'right'];
const CAMERA_MODES = [{ key: 'environment', label: 'Rear camera' }, { key: 'user', label: 'Front camera' }];

function todayIso() { return new Date().toISOString().slice(0, 10); }
function sanitize(value) { return String(value || '').replace(/[^a-zA-Z0-9_-]+/g, '_').replace(/^_+|_+$/g, '') || 'TEST'; }
function shouldUseFullscreenCapture() {
  const smallScreen = window.matchMedia?.('(max-width: 900px)').matches;
  const touchDevice = window.matchMedia?.('(pointer: coarse)').matches;
  const mobileUA = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent || '');
  return Boolean(smallScreen || (touchDevice && mobileUA));
}

function App() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const loopRef = useRef(null);
  const modelsRef = useRef(null);
  const recordingRef = useRef(false);
  const framesRef = useRef([]);
  const recordingStartedAtRef = useRef(null);
  const sideFlippedRef = useRef(false);
  const videoFitModeRef = useRef('contain');
  const debugOpenRef = useRef(false);
  const sessionRef = useRef(null);
  const lastLiveUiUpdateRef = useRef(0);

  const [session, setSession] = useState({
    patientId: '',
    date: todayIso(),
    joint: 'all',
    affectedSide: 'auto/bilateral',
    involvedSide: '',
    notes: '',
    cameraFacing: 'environment'
  });
  const [cameraActive, setCameraActive] = useState(false);
  const [captureFullscreen, setCaptureFullscreen] = useState(false);
  const [recording, setRecording] = useState(false);
  const [modelsReady, setModelsReady] = useState(false);
  const [loadingModels, setLoadingModels] = useState(false);
  const [modelError, setModelError] = useState('');
  const [status, setStatus] = useState('Ready. Start camera when you are ready to capture ROM.');
  const [sideFlipped, setSideFlipped] = useState(false);
  const [captureMeta, setCaptureMeta] = useState({ startedAt: null, stoppedAt: null, resolution: null });
  const [results, setResults] = useState(defaultResults());
  const [reviewOpen, setReviewOpen] = useState(false);
  const [protocolHelpOpen, setProtocolHelpOpen] = useState(false);
  const [endpointOverrides, setEndpointOverrides] = useState({});
  const [scrubFrame, setScrubFrame] = useState(0);
  const [wakeLock, setWakeLock] = useState(null);
  const [videoFitMode, setVideoFitMode] = useState('contain');
  const [debugOpen, setDebugOpen] = useState(false);
  const [guidanceOpen, setGuidanceOpen] = useState(true);
  const [liveDiagnostics, setLiveDiagnostics] = useState({ ready: false, message: 'Start camera to check landmark readiness.', angles: {}, confidence: {}, recordedFrameCount: 0 });

  useEffect(() => { sideFlippedRef.current = sideFlipped; }, [sideFlipped]);
  useEffect(() => { videoFitModeRef.current = videoFitMode; }, [videoFitMode]);
  useEffect(() => { sessionRef.current = session; }, [session]);
  useEffect(() => { debugOpenRef.current = debugOpen; }, [debugOpen]);

  useEffect(() => {
    // Old builds used a service worker. During local testing that can keep stale UI around.
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations?.().then(regs => regs.forEach(reg => reg.unregister())).catch(() => {});
    }
    if ('caches' in window) {
      caches.keys?.().then(keys => keys.forEach(key => caches.delete(key))).catch(() => {});
    }
  }, []);

  const selectedJoint = JOINT_CONFIG.find(j => j.key === session.joint) ?? JOINT_CONFIG[0];
  const protocol = PROTOCOLS[session.joint] ?? PROTOCOLS.elbow;
  const frameCount = framesRef.current.length;
  const fileStem = useMemo(() => `OrthoAtlas_${sanitize(session.patientId)}_${session.date}_${sanitize(selectedJoint.short)}`, [session.patientId, session.date, selectedJoint.short]);

  function updateSession(key, value) { setSession(prev => ({ ...prev, [key]: value })); }

  async function initializeModels() {
    setLoadingModels(true);
    setModelError('');
    setStatus('Loading motion-tracking models. First load can take 10–30 seconds.');
    try {
      modelsRef.current = await loadMediaPipeModels();
      setModelsReady(true);
      setStatus(`Models ready (${modelsRef.current?.delegate ?? 'active'}). Start camera when ready.`);
      return true;
    } catch (error) {
      console.error(error);
      const message = `Model loading failed: ${error?.message ?? 'unknown error'}. Try Safari or check internet access.`;
      setModelError(message);
      setModelsReady(false);
      setStatus(message);
      return false;
    } finally {
      setLoadingModels(false);
    }
  }

  async function startCamera() {
    try {
      if (!modelsRef.current) {
        const ok = await initializeModels();
        if (!ok) return;
      }
      setStatus('Requesting camera permission...');
      if (!navigator.mediaDevices?.getUserMedia) {
        setStatus('Browser unsupported: camera access is not available. Try Safari/Chrome on a current device.');
        return;
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: session.cameraFacing }, width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 } },
        audio: false
      });
      const video = videoRef.current;
      if (video) {
        video.srcObject = stream;
        await video.play();
      }
      setCameraActive(true);
      // Desktop keeps the stable embedded capture view. Phones/tablets open native-camera-style full-screen.
      setCaptureFullscreen(shouldUseFullscreenCapture());
      setCaptureMeta(meta => ({ ...meta, resolution: video ? { width: video.videoWidth, height: video.videoHeight } : null }));
      await requestWakeLock();
      setStatus('Camera active. Position the limb, then press Record. No video is uploaded or stored.');
      startProcessingLoop();
    } catch (error) {
      console.error(error);
      const message = error?.name === 'NotAllowedError'
        ? 'Camera permission denied. Allow camera access in the browser and reload.'
        : error?.name === 'NotFoundError'
          ? 'No camera found. Connect a camera or use a supported phone/laptop.'
          : 'Camera failed. Check browser permissions, HTTPS/local dev access, or try Safari.';
      setStatus(message);
    }
  }

  function stopCamera() {
    stopRecording();
    cancelAnimationFrame(loopRef.current);
    const stream = videoRef.current?.srcObject;
    if (stream) stream.getTracks().forEach(track => track.stop());
    if (videoRef.current) videoRef.current.srcObject = null;
    const canvas = canvasRef.current;
    if (canvas) canvas.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height);
    setCameraActive(false);
    setCaptureFullscreen(false);
    releaseWakeLock();
    setStatus('Camera stopped. No video saved.');
  }

  async function requestWakeLock() {
    try {
      if ('wakeLock' in navigator) setWakeLock(await navigator.wakeLock.request('screen'));
    } catch { /* optional */ }
  }
  function releaseWakeLock() { try { wakeLock?.release?.(); } catch { /* noop */ } setWakeLock(null); }

  function startProcessingLoop() {
    const tick = () => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const models = modelsRef.current;
      if (video && canvas && models && video.readyState >= 2) {
        const activeSession = sessionRef.current ?? session;
        const detection = detectFrame(models, video);
        drawLandmarks(canvas, video, detection, {
          selectedJoint: activeSession.joint,
          selectedSide: activeSession.affectedSide,
          sideFlipped: sideFlippedRef.current,
          cameraFacing: activeSession.cameraFacing,
          mirrorX: activeSession.cameraFacing === 'user',
          fitMode: videoFitModeRef.current,
          debugOverlay: debugOpenRef.current,
          smoothing: { enabled: true, alpha: 0.22 }
        });
        if (detection) {
          const frameIndex = framesRef.current.length;
          const frame = compactFrame(detection, frameIndex);
          const measured = computeFrameAngles(frame, { selectedJoint: activeSession.joint, selectedSide: activeSession.affectedSide, minConfidence: 0.7 });
          const now = performance.now();
          if (now - lastLiveUiUpdateRef.current > 250) {
            lastLiveUiUpdateRef.current = now;
            setLiveDiagnostics(buildLiveDiagnostics(frame, measured, activeSession, framesRef.current.length));
          }
          if (recordingRef.current && Object.keys(measured.angles).length > 0) {
            frame.angles = measured.angles;
            frame.confidence = measured.confidence;
            framesRef.current.push(frame);
          }
        }
      }
      loopRef.current = requestAnimationFrame(tick);
    };
    cancelAnimationFrame(loopRef.current);
    loopRef.current = requestAnimationFrame(tick);
  }

  function startRecording() {
    if (!cameraActive) return;
    framesRef.current = [];
    recordingRef.current = true;
    recordingStartedAtRef.current = performance.now();
    setRecording(true);
    setResults(defaultResults());
    setScrubFrame(0);
    setEndpointOverrides({});
    setCaptureMeta(meta => ({ ...meta, startedAt: new Date().toISOString(), stoppedAt: null }));
    setStatus('Recording landmarks. Move through ROM and pause at terminal limits. No video is saved.');
  }

  function stopRecording() {
    if (!recordingRef.current) return;
    recordingRef.current = false;
    setRecording(false);
    setCaptureMeta(meta => ({ ...meta, stoppedAt: new Date().toISOString(), resolution: canvasResolution() }));
    const next = summarizeRomFrames(framesRef.current, { smoothing: DEFAULT_SMOOTHING_CONFIG, selectedJoint: session.joint, selectedSide: session.affectedSide, minConfidence: 0.7 });
    setResults(next);
    setScrubFrame(0);
    setStatus(`Recording stopped. ${framesRef.current.length} landmark frames captured. Review/export when ready.`);
  }

  function resetCapture() {
    framesRef.current = [];
    setResults(defaultResults());
    setEndpointOverrides({});
    setScrubFrame(0);
    setStatus('Capture reset. Ready for a new recording.');
  }

  function toggleSideFlip() {
    setSideFlipped(prev => !prev);
    setStatus('Side labels flipped. This correction will be stored in exports.');
  }

  function payloadSummary() {
    return buildSummaryExport({ session, results, sideFlipped, captureMeta, endpointOverrides, smoothing: DEFAULT_SMOOTHING_CONFIG, frames: framesRef.current });
  }
  function payloadFull() {
    return buildFullExport({ session, results, sideFlipped, captureMeta, endpointOverrides, smoothing: DEFAULT_SMOOTHING_CONFIG, frames: framesRef.current });
  }

  function copyRomResults() {
    const note = romNote(session, results);
    navigator.clipboard?.writeText(note).then(() => setStatus('ROM Results copied.')).catch(() => setStatus(note));
  }

  return (
    <main className="app-shell">
      <section className="hero">
        <div className="brand">ORTHOATLAS</div>
        <h1>Markerless Motion Assessment</h1>
        <p>Browser tool for clinic-fast ROM capture</p>
        <div className="privacy-banner">OrthoAtlas runs locally, no video is uploaded or stored.</div>
      </section>

      <section className="top-grid single">
        <SessionCard session={session} updateSession={updateSession} protocol={protocol} selectedJoint={selectedJoint} helpOpen={protocolHelpOpen} setHelpOpen={setProtocolHelpOpen} />
      </section>

      <section className={`card capture-card ${cameraActive && captureFullscreen ? 'capture-fullscreen' : ''}`}>
        <div className="section-head capture-head">
          <div className="capture-title">
            <h2>Capture</h2>
            <p>No video is uploaded or stored. Only landmarks/results are retained locally until export or refresh.</p>
          </div>
          <div className="capture-controls">
            <select value={session.cameraFacing} onChange={e => updateSession('cameraFacing', e.target.value)} disabled={cameraActive}>
              {CAMERA_MODES.map(mode => <option key={mode.key} value={mode.key}>{mode.label}</option>)}
            </select>
            {!cameraActive ? <button onClick={startCamera} className="primary"><Camera size={18} /> Start Camera</button> : <button onClick={stopCamera} className="danger">Stop Camera</button>}
            {cameraActive && (!recording ? <button onClick={startRecording} className="primary record-control"><Play size={18} /> Record</button> : <button onClick={stopRecording} className="danger record-control"><Square size={18} /> Stop Recording</button>)}
            {cameraActive && <button onClick={() => setCaptureFullscreen(v => !v)} className="secondary focus-toggle">{captureFullscreen ? 'Done' : 'Full-screen camera'}</button>}
            {cameraActive && <button onClick={() => setVideoFitMode(m => m === 'contain' ? 'cover' : 'contain')} className="secondary fit-toggle">{videoFitMode === 'contain' ? 'Fit: contain' : 'Fit: fill'}</button>}
            {cameraActive && <button onClick={() => setGuidanceOpen(v => !v)} className="secondary">{guidanceOpen ? 'Hide guidance' : 'Show guidance'}</button>}
            {cameraActive && <button onClick={() => setDebugOpen(v => !v)} className="secondary">{debugOpen ? 'Hide debug' : 'Debug values'}</button>}
            <button onClick={toggleSideFlip} className="secondary"><FlipHorizontal size={18} /> Flip Sides</button>
          </div>
        </div>

        <div className="video-wrap">
          <video ref={videoRef} playsInline muted className={`video fit-${videoFitMode} ${session.cameraFacing === 'user' ? 'mirror' : ''}`} />
          <canvas ref={canvasRef} className="overlay" />
          {!cameraActive && <div className="video-placeholder">Camera preview will appear here</div>}
          <span className="video-pill">No video saved</span>
          {recording && <span className="recording-pill">Recording landmarks</span>}
          {cameraActive && guidanceOpen && <CameraGuidance session={session} protocol={protocol} diagnostics={liveDiagnostics} recording={recording} />}
          {cameraActive && captureFullscreen && <div className="mobile-record-dock">
            {!recording ? <button onClick={startRecording} className="record-shutter" aria-label="Record"><Play size={34} /></button> : <button onClick={stopRecording} className="record-shutter recording" aria-label="Stop recording"><Square size={30} /></button>}
            <button onClick={() => setCaptureFullscreen(false)} className="dock-button">Done</button>
          </div>}
        </div>
        <div className="status-row">
          <span>{status}</span>
          {cameraActive && <span className="mini-status">Overlay mapping: {videoFitMode === 'contain' ? 'contain/no crop' : 'fill/crop'}{session.cameraFacing === 'user' ? ' • mirrored front camera' : ''}</span>}
          {loadingModels && <span><Loader2 className="spin" size={16} /> Loading models</span>}
          {modelError && <span className="error-text">{modelError}</span>}
          {modelsReady && !modelError && <span className="good-text">Models ready</span>}
        </div>
        {debugOpen && <DebugValuesPanel diagnostics={liveDiagnostics} frameCount={frameCount} results={results} session={session} />}
      </section>

      <section className="results-export-grid">
        <ResultsCard results={results} session={session} selectedJoint={selectedJoint} onCopy={copyRomResults} />
        <ExportCard
          fileStem={fileStem}
          payloadSummary={payloadSummary}
          payloadFull={payloadFull}
          frameCount={frameCount}
          resetCapture={resetCapture}
        />
      </section>

      <section className="card review-toggle-card">
        <button className="secondary" onClick={() => setReviewOpen(o => !o)}>{reviewOpen ? 'Hide Endpoint Review + Traces' : 'Show Endpoint Review + Traces'}</button>
        <span className="mini-status">Review is optional. Use it only when you need to verify terminal frames or inspect traces.</span>
      </section>

      {reviewOpen && <ReviewPanel frames={framesRef.current} results={results} scrubFrame={scrubFrame} setScrubFrame={setScrubFrame} endpointOverrides={endpointOverrides} setEndpointOverrides={setEndpointOverrides} />}
    </main>
  );
}


function CameraGuidance({ session, protocol, diagnostics, recording }) {
  const ready = diagnostics?.ready;
  const guidance = liveGuidanceText(session, protocol, diagnostics);
  return <div className={`camera-guidance ${ready ? 'ready' : 'not-ready'} ${recording ? 'recording' : ''}`}>
    <strong>{ready ? 'Ready: green landmarks are being recorded' : 'Not ready yet'}</strong>
    <span>{guidance}</span>
  </div>;
}

function DebugValuesPanel({ diagnostics, frameCount, results, session }) {
  const angleRows = Object.entries(diagnostics?.angles ?? {});
  const confRows = Object.entries(diagnostics?.confidence ?? {});
  return <div className="debug-panel">
    <div className="section-head"><h3>Debug values</h3><span className={diagnostics?.ready ? 'good-text' : 'error-text'}>{diagnostics?.ready ? 'green/high confidence' : 'waiting for required landmarks'}</span></div>
    <div className="debug-grid">
      <Metric label="Selected joint" value={session.joint} />
      <Metric label="Selected side" value={session.affectedSide} />
      <Metric label="Live status" value={diagnostics?.message ?? '--'} />
      <Metric label="Recorded frames" value={frameCount} />
      <Metric label="Usable frames" value={results.quality?.usable_frames ?? 0} />
      <Metric label="Percent usable" value={results.quality?.percent_usable_frames == null ? '--' : `${results.quality.percent_usable_frames}%`} />
    </div>
    <div className="debug-table-wrap">
      <table className="debug-table"><thead><tr><th>Measurement</th><th>Clinical value</th><th>Confidence</th></tr></thead><tbody>
        {angleRows.length ? angleRows.map(([key, value]) => <tr key={key}><td>{key.replaceAll('_', ' ')}</td><td>{deg(value)}</td><td>{formatConfidence(diagnostics?.confidence?.[key])}</td></tr>) : <tr><td colSpan="3">No high-confidence values yet. Move back, improve lighting, and keep required landmarks visible.</td></tr>}
      </tbody></table>
    </div>
    {confRows.length > angleRows.length && <p className="mini-status">Only green values ≥ 0.70 are recorded. Yellow/red overlay values are shown only for troubleshooting.</p>}
  </div>;
}

function buildLiveDiagnostics(frame, measured, session, recordedFrameCount = 0) {
  const angles = measured?.angles ?? {};
  const confidence = measured?.confidence ?? {};
  const ready = Object.keys(angles).length > 0;
  const jointLabel = JOINT_CONFIG.find(j => j.key === session.joint)?.label ?? session.joint;
  const sideLabel = session.affectedSide === 'auto/bilateral' ? 'left or right' : session.affectedSide;
  return {
    ready,
    angles,
    confidence,
    recordedFrameCount,
    message: ready
      ? `${jointLabel}: required ${sideLabel} landmark chain detected at high confidence.`
      : `${jointLabel}: waiting for green/high-confidence required landmarks.`
  };
}

function liveGuidanceText(session, protocol, diagnostics) {
  if (diagnostics?.ready) {
    if (session.joint === 'forearm') return 'Start thumb-up neutral, rotate palm up/down, and pause at each endpoint.';
    if (session.joint === 'all') return 'Move one joint plane at a time and pause briefly at terminal limits.';
    return 'Move through ROM slowly and pause at each terminal endpoint.';
  }
  const required = protocol?.required_landmarks?.join(', ') || 'the required landmarks';
  if (session.joint === 'forearm') return 'Show elbow, wrist, full hand, and fingers. Green hand/forearm values will be recorded.';
  return `Move back or adjust the camera until these are visible: ${required}.`;
}

function formatConfidence(v) {
  if (!Number.isFinite(v)) return '--';
  const label = v >= 0.7 ? 'green' : v >= 0.45 ? 'yellow' : 'red';
  return `${Math.round(v * 100)}% (${label})`;
}

function SessionCard({ session, updateSession, protocol, selectedJoint, helpOpen, setHelpOpen }) {
  return <section className="card session-card">
    <h2>Session</h2>
    <div className="form-grid">
      <label>Patient ID<input value={session.patientId} onChange={e => updateSession('patientId', e.target.value)} placeholder="ABC123" /></label>
      <label>Date<input type="date" value={session.date} onChange={e => updateSession('date', e.target.value)} /></label>
      <label className="joint-label">Joint
        <div className="joint-select-row">
          <select value={session.joint} onChange={e => updateSession('joint', e.target.value)}>{JOINT_CONFIG.map(j => <option key={j.key} value={j.key}>{j.label}</option>)}</select>
          <button type="button" className="help-only" aria-label="Recording help" onClick={() => setHelpOpen(!helpOpen)}><HelpCircle size={22} /></button>
        </div>
      </label>
      <label>Side<select value={session.affectedSide} onChange={e => updateSession('affectedSide', e.target.value)}>{SIDES.map(s => <option key={s} value={s}>{s}</option>)}</select></label>
      <label>Involved side<select value={session.involvedSide} onChange={e => updateSession('involvedSide', e.target.value)}><option value="">Not set</option><option value="left">Left</option><option value="right">Right</option></select></label>
    </div>
    {helpOpen && <div className="inline-help">
      <div className="section-head"><div><h3>{protocol.title}</h3><span className="pill">{selectedJoint.short}</span></div></div>
      <div className="protocol-detail compact"><p><strong>Camera:</strong> {protocol.camera_position}</p><p><strong>Patient:</strong> {protocol.patient_position}</p><p><strong>Start:</strong> {protocol.start_position}</p><p><strong>Pause:</strong> {protocol.endpoint_pause_duration}; <strong>Reps:</strong> {protocol.recommended_repetitions}</p><p><strong>Required landmarks:</strong> {protocol.required_landmarks.join(' • ')}</p><ol>{protocol.steps.map(step => <li key={step}>{step}</li>)}</ol><p className="watchout"><strong>Common problems:</strong> {protocol.common_failure_warnings.join(' • ')}</p></div>
    </div>}
    <label className="notes-label">Notes<textarea value={session.notes} onChange={e => updateSession('notes', e.target.value)} placeholder="Do not enter PHI" /></label>
  </section>;
}

function ResultsCard({ results, session, selectedJoint, onCopy }) {
  const sides = session.affectedSide === 'left' || session.affectedSide === 'right' ? [session.affectedSide] : ['left', 'right'];
  const rows = selectedRomRows(results, session.joint, sides);
  const hasResults = rows.some(row => row.measured);
  const primary = primaryResultSummary(rows, session, selectedJoint, results);
  return <section className="card results-card-polished">
    <div className="section-head"><h2>Results</h2><span className={`quality ${results.quality?.overall}`}>{results.quality?.overall ?? 'not measured'}</span></div>
    <div className={`big-result-card ${hasResults ? 'measured' : ''}`}>
      <div>
        <span className="result-kicker">{primary.kicker}</span>
        <h3>{primary.title}</h3>
        <p>{primary.subtitle}</p>
      </div>
      <strong>{primary.main}</strong>
    </div>
    <div className="selected-rom-table">
      {rows.length ? rows.map(row => <div className={`rom-row ${row.measured ? 'measured' : ''}`} key={`${row.side}-${row.jointKey}`}>
        <div className="rom-row-head"><h3>{capitalize(row.side)} {row.label}</h3>{row.measured && <span className="pill">{row.samples ? `${row.samples} frames` : 'measured'}</span>}</div>
        {row.measured ? <div className="rom-values">{row.values.map(item => <Metric key={item.label} label={item.label} value={item.value} />)}</div> : <p className="mini-status">No high-confidence green ROM values recorded yet for this side/joint.</p>}
      </div>) : <p className="mini-status">Select a joint and record a high-confidence motion to see ROM values.</p>}
    </div>
    <BilateralCard bilateral={filterBilateralForJoint(results.bilateral, session.joint)} />
    <button className="secondary big" onClick={onCopy}>Copy ROM Results</button>
  </section>;
}


function primaryResultSummary(rows, session, selectedJoint, results) {
  const measured = rows.filter(r => r.measured);
  if (!measured.length) {
    return { kicker: selectedJoint.label, title: 'No ROM recorded yet', main: '--', subtitle: 'Record a green/high-confidence motion to generate ROM values.' };
  }
  if (session.joint === 'all') {
    return { kicker: 'All Joints', title: `${measured.length} ROM measurements captured`, main: `${measured.length}`, subtitle: `${results.quality?.usable_frames ?? 0} high-confidence frames used.` };
  }
  const row = measured[0];
  const arc = valueForLabel(row, 'Arc');
  const subtitle = row.values.map(v => `${v.label}: ${v.value}`).join(' • ');
  if (session.joint === 'forearm') {
    return { kicker: `${capitalize(row.side)} forearm`, title: 'Supination / Pronation ROM', main: arc ?? '--', subtitle };
  }
  if (session.joint === 'ankle') {
    return { kicker: `${capitalize(row.side)} ankle`, title: 'Dorsiflexion / Plantarflexion ROM', main: arc ?? '--', subtitle };
  }
  return { kicker: `${capitalize(row.side)} ${row.label}`, title: 'Clinical ROM', main: arc ?? '--', subtitle };
}
function valueForLabel(row, label) { return row?.values?.find(v => v.label === label)?.value; }

function selectedRomRows(results, joint, sides) {
  const jointKeys = joint === 'all'
    ? ['shoulder_abduction', 'shoulder_flexion', 'elbow', 'forearm', 'hip', 'knee', 'ankle']
    : [joint];
  return sides.flatMap(side => jointKeys.map(j => selectedRomRow(results?.[side], j, side)).filter(Boolean));
}

function selectedRomRow(sideResults, joint, side) {
  const values = [];
  const s = sideResults ?? {};
  const label = JOINT_CONFIG.find(j => j.key === joint)?.label ?? joint;
  if (joint === 'shoulder_flexion') values.push({ label: 'Min', value: deg(s.shoulder_flexion?.flexion_min_deg) }, { label: 'Max flexion', value: deg(s.shoulder_flexion?.flexion_max_deg) }, { label: 'Arc', value: deg(s.shoulder_flexion?.arc_deg) });
  if (joint === 'shoulder_abduction') values.push({ label: 'Min', value: deg(s.shoulder_abduction?.abduction_min_deg) }, { label: 'Max abduction', value: deg(s.shoulder_abduction?.abduction_max_deg) }, { label: 'Arc', value: deg(s.shoulder_abduction?.arc_deg) });
  if (joint === 'elbow') values.push({ label: 'Extension', value: deg(s.elbow?.extension_min_deg) }, { label: 'Flexion', value: deg(s.elbow?.flexion_max_deg) }, { label: 'Arc', value: deg(s.elbow?.arc_deg) });
  if (joint === 'forearm') values.push({ label: 'Supination', value: deg(s.forearm?.supination_max_deg) }, { label: 'Pronation', value: deg(s.forearm?.pronation_max_deg) }, { label: 'Arc', value: deg(s.forearm?.arc_deg) });
  if (joint === 'hip') values.push({ label: 'Extension', value: deg(s.hip?.extension_min_deg) }, { label: 'Flexion', value: deg(s.hip?.flexion_max_deg) }, { label: 'Arc', value: deg(s.hip?.arc_deg) });
  if (joint === 'knee') values.push({ label: 'Extension', value: deg(s.knee?.extension_min_deg) }, { label: 'Flexion', value: deg(s.knee?.flexion_max_deg) }, { label: 'Arc', value: deg(s.knee?.arc_deg) });
  if (joint === 'ankle') values.push({ label: 'Plantarflexion', value: deg(s.ankle?.ankle_min_deg) }, { label: 'Dorsiflexion', value: deg(s.ankle?.ankle_max_deg) }, { label: 'Arc', value: deg(s.ankle?.arc_deg) });
  const source = s[joint] ?? (joint === 'shoulder_flexion' ? s.shoulder_flexion : joint === 'shoulder_abduction' ? s.shoulder_abduction : null);
  return { side, jointKey: joint, label, values, measured: values.some(v => v.value !== '--'), samples: source?.samples ?? null };
}

function filterBilateralForJoint(bilateral, joint) {
  const map = {
    shoulder_flexion: 'shoulder_flexion_arc_deg',
    shoulder_abduction: 'shoulder_abduction_arc_deg',
    elbow: 'elbow_arc_deg',
    forearm: 'forearm_arc_deg',
    hip: 'hip_arc_deg',
    knee: 'knee_arc_deg',
    ankle: 'ankle_arc_deg'
  };
  if (joint === 'all') return bilateral ?? { metrics: {} };
  const key = map[joint];
  return { metrics: key && bilateral?.metrics?.[key] ? { [key]: bilateral.metrics[key] } : {} };
}

function BilateralCard({ bilateral }) {
  const rows = Object.entries(bilateral?.metrics ?? {});
  if (!rows.length) return <div className="bilateral-card"><h3>Bilateral comparison</h3><p className="mini-status">Bilateral metrics appear when left and right values are available.</p></div>;
  return <div className="bilateral-card"><h3>Bilateral comparison</h3><table><thead><tr><th>Metric</th><th>Left</th><th>Right</th><th>Difference</th><th>Symmetry</th></tr></thead><tbody>{rows.map(([key, v]) => <tr key={key}><td>{key.replaceAll('_', ' ')}</td><td>{deg(v.left)}</td><td>{deg(v.right)}</td><td>{deg(v.difference)}</td><td>{v.percent_symmetry == null ? '--' : `${v.percent_symmetry}%`}</td></tr>)}</tbody></table></div>;
}

function ExportCard({ fileStem, payloadSummary, payloadFull, frameCount, resetCapture }) {
  return <section className="card"><h2>Export</h2><p>Exports download locally. No video is uploaded or stored.</p><div className="button-grid"><button onClick={() => downloadJson(payloadSummary(), `${fileStem}_summary.json`)}><Download size={18} /> Summary JSON</button><button onClick={() => downloadJson(payloadFull(), `${fileStem}_full.json`)}><Download size={18} /> Full JSON</button><button onClick={() => downloadCsv(payloadSummary(), `${fileStem}_summary.csv`)}><Download size={18} /> Summary CSV</button><button onClick={() => downloadLongCsv(payloadFull(), `${fileStem}_long.csv`)}><Download size={18} /> Long CSV</button><button onClick={() => downloadReportHtml(payloadSummary(), `${fileStem}_report.html`)}><Download size={18} /> Clean HTML/PDF Report</button><button className="secondary" onClick={resetCapture}><RotateCcw size={18} /> Reset capture</button></div><p className="mini-status">Frame count: {frameCount}. Full JSON/long CSV include landmark frames and frame-level angles.</p></section>;
}

function ReviewPanel({ frames, results, scrubFrame, setScrubFrame, endpointOverrides, setEndpointOverrides }) {
  const max = Math.max(0, frames.length - 1);
  return <section className="card review-panel"><h2>Endpoint Review + Traces</h2><p className="mini-status">Scrub through saved landmark frames and inspect angle traces. The scrubber never saves video frames.</p><label>Frame scrubber<input type="range" min="0" max={max} value={Math.min(scrubFrame, max)} onChange={e => setScrubFrame(Number(e.target.value))} /></label><p><strong>Frame:</strong> {frames.length ? Math.min(scrubFrame, max) : '--'}</p><div className="endpoint-grid"><EndpointCard title="Left elbow" result={results.left.elbow} /><EndpointCard title="Right elbow" result={results.right.elbow} /><EndpointCard title="Left knee" result={results.left.knee} /><EndpointCard title="Right knee" result={results.right.knee} /></div><TraceList traces={results.traces} /></section>;
}

function EndpointCard({ title, result }) {
  return <div className="endpoint-card"><h3>{title}</h3><div><span>Extension/min frame</span><strong>{result.terminal_extension_frame ?? result.terminal_min_frame ?? '--'}</strong></div><div><span>Flexion/max frame</span><strong>{result.terminal_flexion_frame ?? result.terminal_max_frame ?? '--'}</strong></div><div><span>ROM</span><strong>{result.arc_deg == null ? '--' : `${result.arc_deg}° arc`}</strong></div><p className="mini-status">Samples: {result.samples ?? 0}</p></div>;
}

function TraceList({ traces }) {
  const entries = Object.entries(traces ?? {}).filter(([, t]) => t?.length).slice(0, 8);
  if (!entries.length) return <div className="empty-trace">Angle traces will appear after recording.</div>;
  return <div className="trace-grid">{entries.map(([key, trace]) => <div className="trace-card" key={key}><strong>{key.replaceAll('_', ' ')}</strong><svg viewBox="0 0 300 80" preserveAspectRatio="none"><polyline points={traceToPoints(trace)} fill="none" stroke="currentColor" strokeWidth="3" /></svg></div>)}</div>;
}

function Metric({ label, value, suffix = '' }) { return <div className="metric"><span>{label}</span><strong>{value == null || value === '' ? '--' : `${value}${suffix}`}</strong></div>; }
function deg(v) { return v == null ? '--' : `${v}°`; }
function romNote(session, results) {
  const sides = session.affectedSide === 'left' || session.affectedSide === 'right' ? [session.affectedSide] : ['left', 'right'];
  const parts = sides.flatMap(side => selectedRomRows(results, session.joint, [side]).map(row => {
    if (!row?.measured) return `${capitalize(side)} ${row?.label ?? ''}: not measured`;
    return `${capitalize(side)} ${row.label}: ${row.values.map(v => `${v.label} ${v.value}`).join(', ')}`;
  }));
  const q = results.quality?.overall ?? 'not measured';
  return `ROM assessed using OrthoAtlas markerless browser-based capture. ${parts.join('. ')}. Tracking quality ${q}. No video was saved.`;
}
function capitalize(s) { return s ? s[0].toUpperCase() + s.slice(1) : ''; }
function traceToPoints(trace) { const values = trace.map(p => p.processed_value ?? p.value).filter(Number.isFinite); if (!values.length) return ''; const min = Math.min(...values), max = Math.max(...values), span = max - min || 1; return trace.map((p, i) => { const value = p.processed_value ?? p.value; const x = trace.length === 1 ? 0 : (i / (trace.length - 1)) * 300; const y = 75 - ((value - min) / span) * 70; return `${x},${Number.isFinite(y) ? y : 75}`; }).join(' '); }
function canvasResolution() { const canvas = document.querySelector('canvas'); return canvas ? { width: canvas.width, height: canvas.height } : null; }
function compactPoint(p) { if (!p) return null; return { x: round3(p.x), y: round3(p.y), z: round3(p.z), visibility: round3(p.visibility ?? p.presence ?? 1) }; }
function compactFrame(detection, frameIndex) { return { frame_index: frameIndex, time_sec: recordingStartedAtGlobal(frameIndex), timestamp_ms: Math.round(detection.timestampMs ?? performance.now()), pose_landmarks: (detection.pose?.landmarks ?? []).map(pose => pose.map(compactPoint)), hand_landmarks: (detection.hands?.landmarks ?? []).map(hand => hand.map(compactPoint)), hand_handedness: compactHandedness(detection.hands), angles: {}, confidence: {} }; }
function compactHandedness(hands) { return (hands?.handednesses ?? hands?.handedness ?? []).map(list => { const best = Array.isArray(list) ? list[0] : list; return { categoryName: best?.categoryName ?? best?.displayName ?? best?.label ?? '', score: round3(best?.score ?? 1) }; }); }
function recordingStartedAtGlobal(frameIndex) { return Math.round((frameIndex / 30) * 100) / 100; }
function round3(v) { return Number.isFinite(v) ? Math.round(v * 1000) / 1000 : null; }

createRoot(document.getElementById('root')).render(<App />);
