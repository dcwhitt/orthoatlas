import { FilesetResolver, HandLandmarker, PoseLandmarker, DrawingUtils } from '@mediapipe/tasks-vision';

let cache = null;
const overlaySmoothingState = new Map();

const MODEL_URLS = {
  pose: 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/latest/pose_landmarker_lite.task',
  hand: 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/latest/hand_landmarker.task'
};

export async function loadMediaPipeModels(options = {}) {
  if (cache) return cache;

  const vision = await FilesetResolver.forVisionTasks('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/wasm');
  const preferredDelegate = options.delegate ?? 'GPU';
  const delegates = preferredDelegate === 'GPU' ? ['GPU', 'CPU'] : [preferredDelegate, 'CPU'];
  let lastError = null;

  for (const delegate of [...new Set(delegates)]) {
    try {
      const [poseLandmarker, handLandmarker] = await Promise.all([
        PoseLandmarker.createFromOptions(vision, {
          baseOptions: { modelAssetPath: options.poseModelUrl ?? MODEL_URLS.pose, delegate },
          runningMode: 'VIDEO',
          numPoses: 2,
          minPoseDetectionConfidence: 0.45,
          minPosePresenceConfidence: 0.45,
          minTrackingConfidence: 0.45
        }),
        HandLandmarker.createFromOptions(vision, {
          baseOptions: { modelAssetPath: options.handModelUrl ?? MODEL_URLS.hand, delegate },
          runningMode: 'VIDEO',
          numHands: 2,
          minHandDetectionConfidence: 0.45,
          minHandPresenceConfidence: 0.45,
          minTrackingConfidence: 0.45
        })
      ]);

      cache = { vision, poseLandmarker, handLandmarker, DrawingUtils, modelUrls: MODEL_URLS, delegate };
      return cache;
    } catch (error) {
      lastError = error;
      console.warn(`MediaPipe ${delegate} delegate failed`, error);
    }
  }

  throw lastError ?? new Error('MediaPipe model loading failed.');
}

export function detectFrame(models, video, timestampMs = performance.now()) {
  if (!models || !video || video.readyState < 2) return null;
  return {
    pose: models.poseLandmarker?.detectForVideo(video, timestampMs) ?? null,
    hands: models.handLandmarker?.detectForVideo(video, timestampMs) ?? null,
    timestampMs
  };
}

export function drawLandmarks(canvas, video, detection, overlays = {}) {
  if (!canvas || !video) return;

  const ctx = prepareOverlayCanvas(canvas);
  if (!ctx) return;

  const size = getCanvasCssSize(canvas);
  const fitMode = overlays.fitMode === 'cover' ? 'cover' : 'contain';
  const mirrorX = Boolean(overlays.mirrorX);
  const drawRect = getVideoDrawRect(video, size.width, size.height, fitMode);
  const mapper = makeLandmarkMapper(drawRect, { mirrorX, smoothing: overlays.smoothing, namespace: `${overlays.selectedJoint || 'joint'}-${overlays.selectedSide || 'both'}-${mirrorX ? 'mirror' : 'normal'}` });

  ctx.clearRect(0, 0, size.width, size.height);
  if (drawRect.letterboxed) drawLetterboxGuides(ctx, drawRect, size);

  const poses = detection?.pose?.landmarks ?? [];
  for (const landmarks of poses) {
    drawPoseSkeleton(ctx, landmarks, mapper, overlays);
  }

  const shouldDrawHands = overlays.selectedJoint === 'forearm' || overlays.selectedJoint === 'all';
  if (shouldDrawHands) {
    const hands = detection?.hands?.landmarks ?? [];
    const handedness = detection?.hands?.handednesses ?? detection?.hands?.handedness ?? [];
    const primaryPose = poses?.[0] ?? null;
    drawForearmHands(ctx, hands, handedness, mapper, { ...overlays, poseLandmarks: primaryPose });
  }

  // Camera overlay intentionally stays clean: no persistent status/debug badge.
}

export function getVideoDrawRect(video, containerWidth, containerHeight, fitMode = 'contain') {
  const videoWidth = video?.videoWidth || containerWidth || 1;
  const videoHeight = video?.videoHeight || containerHeight || 1;
  const videoAspect = videoWidth / videoHeight;
  const containerAspect = containerWidth / containerHeight;
  const contain = fitMode !== 'cover';

  let width;
  let height;
  if (contain ? videoAspect > containerAspect : videoAspect < containerAspect) {
    width = containerWidth;
    height = width / videoAspect;
  } else {
    height = containerHeight;
    width = height * videoAspect;
  }

  const x = (containerWidth - width) / 2;
  const y = (containerHeight - height) / 2;
  return {
    x,
    y,
    width,
    height,
    videoWidth,
    videoHeight,
    containerWidth,
    containerHeight,
    fitMode,
    letterboxed: contain && (Math.abs(x) > 0.5 || Math.abs(y) > 0.5),
    cropped: !contain && (x < -0.5 || y < -0.5)
  };
}

export function mapLandmarkToCanvas(point, drawRect, options = {}) {
  if (!point) return null;
  const normalizedX = options.mirrorX ? 1 - point.x : point.x;
  return {
    x: drawRect.x + normalizedX * drawRect.width,
    y: drawRect.y + point.y * drawRect.height
  };
}

function prepareOverlayCanvas(canvas) {
  const rect = canvas.getBoundingClientRect();
  const width = Math.max(1, Math.round(rect.width));
  const height = Math.max(1, Math.round(rect.height));
  const dpr = window.devicePixelRatio || 1;
  const targetWidth = Math.max(1, Math.round(width * dpr));
  const targetHeight = Math.max(1, Math.round(height * dpr));
  if (canvas.width !== targetWidth) canvas.width = targetWidth;
  if (canvas.height !== targetHeight) canvas.height = targetHeight;
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return ctx;
}

function getCanvasCssSize(canvas) {
  const rect = canvas.getBoundingClientRect();
  return { width: Math.max(1, rect.width), height: Math.max(1, rect.height) };
}

function makeLandmarkMapper(drawRect, options = {}) {
  return (point, key = '') => {
    const mapped = mapLandmarkToCanvas(point, drawRect, options);
    if (!mapped || !options.smoothing?.enabled) return mapped;
    const alpha = Number(options.smoothing.alpha ?? 0.32);
    const stateKey = `${options.namespace || 'overlay'}:${key || point?.index || ''}:${round4(point?.x)}:${round4(point?.y)}`;
    // Landmark x/y jitter is reduced by smoothing by semantic draw key when supplied.
    const stableKey = key ? `${options.namespace || 'overlay'}:${key}` : stateKey;
    const previous = overlaySmoothingState.get(stableKey);
    const smoothed = previous
      ? { x: alpha * mapped.x + (1 - alpha) * previous.x, y: alpha * mapped.y + (1 - alpha) * previous.y }
      : mapped;
    overlaySmoothingState.set(stableKey, smoothed);
    return smoothed;
  };
}
function round4(v) { return Number.isFinite(v) ? Math.round(v * 10000) / 10000 : ''; }

function drawLetterboxGuides(ctx, drawRect, size) {
  ctx.save();
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.20)';
  ctx.lineWidth = 1;
  ctx.setLineDash([8, 8]);
  ctx.strokeRect(drawRect.x, drawRect.y, drawRect.width, drawRect.height);
  ctx.restore();
}

const HAND_EDGES = [
  [0,1],[1,2],[2,3],[3,4],
  [0,5],[5,6],[6,7],[7,8],
  [0,9],[9,10],[10,11],[11,12],
  [0,13],[13,14],[14,15],[15,16],
  [0,17],[17,18],[18,19],[19,20],
  [5,9],[9,13],[13,17]
];

function drawPoseSkeleton(ctx, landmarks, mapPoint, overlays = {}) {
  const good = 'rgba(34,197,94,0.95)';
  const warn = 'rgba(250,204,21,0.95)';
  const bad = 'rgba(239,68,68,0.95)';
  const selectedJoint = overlays.selectedJoint ?? 'elbow';
  const selectedSide = overlays.selectedSide ?? 'auto/bilateral';
  const sides = selectedSide === 'left' || selectedSide === 'right' ? [selectedSide] : ['left', 'right'];
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  const jointSpecs = [];
  for (const side of sides) {
    const L = side === 'left';
    if (selectedJoint === 'all' || selectedJoint === 'elbow') jointSpecs.push([L ? 11 : 12, L ? 13 : 14, L ? 15 : 16, `${L ? 'L' : 'R'} elbow`, true]);
    if (selectedJoint === 'all' || selectedJoint === 'knee') jointSpecs.push([L ? 23 : 24, L ? 25 : 26, L ? 27 : 28, `${L ? 'L' : 'R'} knee`, true]);
    if (selectedJoint === 'all' || selectedJoint === 'shoulder_flexion') jointSpecs.push([L ? 23 : 24, L ? 11 : 12, L ? 13 : 14, `${L ? 'L' : 'R'} shoulder flex`, false]);
    if (selectedJoint === 'all' || selectedJoint === 'shoulder_abduction') jointSpecs.push([L ? 23 : 24, L ? 11 : 12, L ? 13 : 14, `${L ? 'L' : 'R'} shoulder abd`, false]);
    if (selectedJoint === 'all' || selectedJoint === 'hip') jointSpecs.push([L ? 11 : 12, L ? 23 : 24, L ? 25 : 26, `${L ? 'L' : 'R'} hip`, true]);
    if (selectedJoint === 'all' || selectedJoint === 'ankle') jointSpecs.push([L ? 25 : 26, L ? 27 : 28, L ? 31 : 32, `${L ? 'L' : 'R'} ankle`, 'ankle']);
  }

  for (const [proximalIdx, jointIdx, distalIdx, label, clinicalFlexion] of jointSpecs) {
    drawJointAngle(ctx, landmarks, mapPoint, proximalIdx, jointIdx, distalIdx, label, good, warn, bad, clinicalFlexion);
  }
}

function drawForearmHands(ctx, hands, handedness, mapPoint, overlays = {}) {
  const selectedSide = overlays.selectedSide ?? 'auto/bilateral';
  const sides = selectedSide === 'left' || selectedSide === 'right' ? [selectedSide] : ['left', 'right'];
  const poseLandmarks = overlays.poseLandmarks ?? null;

  if (!hands?.length) {
    drawHandHint(ctx, 'Hand not detected — show palm, wrist, and fingers.', 14, 84);
    return;
  }

  let drawnCount = 0;
  hands.forEach((hand, idx) => {
    if (!hand?.length) return;
    const side = handSideFromPose(hand, poseLandmarks) ?? handSide(hand, handedness?.[idx]);
    const isSelected = !side || sides.includes(side);

    // In single-side mode, only highlight the selected side. If handedness is uncertain,
    // still draw the hand so users can see the model is working, but label it unknown.
    if (side && !isSelected) return;

    const prefix = `hand:${side || idx}`;
    const stroke = isSelected ? 'rgba(168,85,247,0.96)' : 'rgba(148,163,184,0.55)';
    drawHandSkeleton(ctx, hand, mapPoint, prefix, stroke);
    // Hand skeleton only; no L/R hand quality text labels.
    drawnCount += 1;
  });

  if (!drawnCount) {
    drawHandHint(ctx, `Hand detected, but not on selected side (${selectedSide}). Use Auto/Bilateral or Flip Sides if needed.`, 14, 84);
  }
}

function handSideFromPose(hand, poseLandmarks) {
  if (!poseLandmarks?.length || !hand?.[0]) return null;
  const wrist = hand[0];
  const leftWrist = poseLandmarks[15];
  const rightWrist = poseLandmarks[16];
  if (!leftWrist || !rightWrist) return null;
  const dl = dist2(wrist, leftWrist);
  const dr = dist2(wrist, rightWrist);
  if (!Number.isFinite(dl) || !Number.isFinite(dr)) return null;
  return dl <= dr ? 'left' : 'right';
}

function dist2(a, b) {
  if (!a || !b) return Infinity;
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
}

function drawHandHint(ctx, text, x, y) {
  ctx.font = 'bold 13px system-ui, -apple-system, sans-serif';
  const metrics = ctx.measureText(text);
  ctx.fillStyle = 'rgba(88,28,135,0.86)';
  roundRect(ctx, x, y, metrics.width + 20, 28, 10);
  ctx.fill();
  ctx.fillStyle = 'white';
  ctx.fillText(text, x + 10, y + 19);
}

function handSide(hand, handness) {
  const label = String(handness?.[0]?.categoryName ?? handness?.categoryName ?? handness?.[0]?.label ?? handness?.label ?? '').toLowerCase();
  if (label.includes('left')) return 'left';
  if (label.includes('right')) return 'right';
  const wrist = hand?.[0];
  if (!wrist) return null;
  return wrist.x < 0.5 ? 'left' : 'right';
}

function normalizeAngle180(deg) {
  let v = deg;
  while (v > 180) v -= 360;
  while (v <= -180) v += 360;
  return v;
}

function drawHandSkeleton(ctx, landmarks, mapPoint, keyPrefix = 'hand', stroke = 'rgba(168,85,247,0.95)') {
  for (const [a, b] of HAND_EDGES) {
    const pa = landmarks[a];
    const pb = landmarks[b];
    if (!pa || !pb) continue;
    drawSegment(ctx, pa, pb, mapPoint, stroke, 3, `${keyPrefix}:${a}`, `${keyPrefix}:${b}`);
  }
  landmarks.forEach((p, i) => {
    const c = mapPoint(p, `${keyPrefix}:${i}`);
    const radius = i === 0 ? 6 : ([4,8,12,16,20].includes(i) ? 5 : 4);
    drawPoint(ctx, c.x, c.y, radius, 'rgba(255,255,255,0.96)', stroke);
  });
}




function drawJointAngle(ctx, landmarks, mapPoint, proximalIdx, jointIdx, distalIdx, label, good, warn, bad, clinicalFlexion = false) {
  const a = landmarks[proximalIdx];
  const b = landmarks[jointIdx];
  const c = landmarks[distalIdx];
  if (!a || !b || !c) return;
  const minVis = Math.min(conf(a), conf(b), conf(c));
  // Live overlay is intentionally more permissive than recording.
  // Green/high-confidence values (>=0.70) are the only values saved for ROM.
  if (minVis < 0.30) return;
  const color = minVis >= 0.70 ? good : minVis >= 0.45 ? warn : bad;
  const width = minVis >= 0.70 ? 8 : 5;
  drawSegment(ctx, a, b, mapPoint, color, width, `${label}:prox`, `${label}:joint`);
  drawSegment(ctx, b, c, mapPoint, color, width, `${label}:joint`, `${label}:dist`);
  const bCanvas = mapPoint(b, `${label}:joint`);
  drawPoint(ctx, bCanvas.x, bCanvas.y, minVis >= 0.70 ? 11 : 8, color, 'rgba(15,23,42,0.75)');
  const rawAngle = angleDeg(a, b, c);
  if (!Number.isFinite(rawAngle)) return;
  const displayAngle = clinicalFlexion === 'ankle' ? 90 - rawAngle : clinicalFlexion ? 180 - rawAngle : rawAngle;
  const confLabel = minVis >= 0.70 ? '' : minVis >= 0.45 ? ' · low' : ' · poor';
  drawLabel(ctx, `${label}: ${Math.round(displayAngle)}°${confLabel}`, bCanvas.x + 12, bCanvas.y - 14, color);
  drawArcHint(ctx, a, b, c, mapPoint, color, label);
}

function drawArcHint(ctx, a, b, c, mapPoint, color, keyPrefix = 'arc') {
  const ac = mapPoint(a, `${keyPrefix}:arc:a`);
  const bc = mapPoint(b, `${keyPrefix}:arc:b`);
  const cc = mapPoint(c, `${keyPrefix}:arc:c`);
  const a1 = Math.atan2(ac.y - bc.y, ac.x - bc.x);
  const a2 = Math.atan2(cc.y - bc.y, cc.x - bc.x);
  ctx.beginPath();
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.arc(bc.x, bc.y, 28, a1, a2);
  ctx.stroke();
}

function drawSegment(ctx, a, b, mapPoint, strokeStyle, lineWidth = 4, aKey = '', bKey = '') {
  const ac = mapPoint(a, aKey);
  const bc = mapPoint(b, bKey);
  ctx.strokeStyle = strokeStyle;
  ctx.lineWidth = lineWidth;
  ctx.beginPath();
  ctx.moveTo(ac.x, ac.y);
  ctx.lineTo(bc.x, bc.y);
  ctx.stroke();
}

function drawPoint(ctx, x, y, radius, fill, stroke) {
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = stroke;
  ctx.stroke();
}

function drawLabel(ctx, text, x, y, color = 'rgba(14,165,233,0.95)') {
  ctx.font = 'bold 18px system-ui, -apple-system, sans-serif';
  const padding = 8;
  const metrics = ctx.measureText(text);
  const safeX = Math.max(8, Math.min(x, ctx.canvas.width / (window.devicePixelRatio || 1) - metrics.width - 24));
  const safeY = Math.max(32, Math.min(y, ctx.canvas.height / (window.devicePixelRatio || 1) - 8));
  ctx.fillStyle = 'rgba(15,23,42,0.78)';
  roundRect(ctx, safeX - padding, safeY - 24, metrics.width + padding * 2, 32, 10);
  ctx.fill();
  ctx.fillStyle = 'white';
  ctx.fillText(text, safeX, safeY);
}


function conf(p) {
  return Number.isFinite(p?.visibility) ? p.visibility : Number.isFinite(p?.presence) ? p.presence : 1;
}

function angleDeg(a, b, c) {
  const bax = a.x - b.x;
  const bay = a.y - b.y;
  const bcx = c.x - b.x;
  const bcy = c.y - b.y;
  const dot = bax * bcx + bay * bcy;
  const mag = Math.hypot(bax, bay) * Math.hypot(bcx, bcy);
  if (!mag) return null;
  return Math.acos(Math.max(-1, Math.min(1, dot / mag))) * 180 / Math.PI;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
