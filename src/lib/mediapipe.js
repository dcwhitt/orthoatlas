import { FilesetResolver, HandLandmarker, PoseLandmarker, DrawingUtils } from '@mediapipe/tasks-vision';

let cache = null;

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
  const mapper = makeLandmarkMapper(drawRect, { mirrorX });

  ctx.clearRect(0, 0, size.width, size.height);
  if (drawRect.letterboxed) drawLetterboxGuides(ctx, drawRect, size);

  const poses = detection?.pose?.landmarks ?? [];
  for (const landmarks of poses) {
    drawPoseSkeleton(ctx, landmarks, mapper, overlays);
  }

  if (overlays.selectedJoint === 'forearm') {
    const hands = detection?.hands?.landmarks ?? [];
    const handedness = detection?.hands?.handednesses ?? detection?.hands?.handedness ?? [];
    drawForearmHands(ctx, hands, handedness, mapper, overlays);
  }

  drawStatusBadge(ctx, detection, size.width, size.height, overlays, drawRect);
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
  return (point) => mapLandmarkToCanvas(point, drawRect, options);
}

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
    if (selectedJoint === 'elbow') jointSpecs.push([L ? 11 : 12, L ? 13 : 14, L ? 15 : 16, `${L ? 'L' : 'R'} elbow`, true]);
    if (selectedJoint === 'knee') jointSpecs.push([L ? 23 : 24, L ? 25 : 26, L ? 27 : 28, `${L ? 'L' : 'R'} knee`, true]);
    if (selectedJoint === 'shoulder_flexion') jointSpecs.push([L ? 23 : 24, L ? 11 : 12, L ? 13 : 14, `${L ? 'L' : 'R'} shoulder flex`, false]);
    if (selectedJoint === 'shoulder_abduction') jointSpecs.push([L ? 23 : 24, L ? 11 : 12, L ? 13 : 14, `${L ? 'L' : 'R'} shoulder abd`, false]);
    if (selectedJoint === 'hip') jointSpecs.push([L ? 11 : 12, L ? 23 : 24, L ? 25 : 26, `${L ? 'L' : 'R'} hip`, true]);
    if (selectedJoint === 'ankle') jointSpecs.push([L ? 25 : 26, L ? 27 : 28, L ? 31 : 32, `${L ? 'L' : 'R'} ankle`, false]);
  }

  for (const [proximalIdx, jointIdx, distalIdx, label, clinicalFlexion] of jointSpecs) {
    drawJointAngle(ctx, landmarks, mapPoint, proximalIdx, jointIdx, distalIdx, label, good, warn, bad, clinicalFlexion);
  }
}

function drawForearmHands(ctx, hands, handedness, mapPoint, overlays = {}) {
  const selectedSide = overlays.selectedSide ?? 'auto/bilateral';
  const sides = selectedSide === 'left' || selectedSide === 'right' ? [selectedSide] : ['left', 'right'];
  hands.forEach((hand, idx) => {
    const side = handSide(hand, handedness?.[idx]);
    if (side && !sides.includes(side)) return;
    drawHandSkeleton(ctx, hand, mapPoint);
    const indexMcp = hand?.[5];
    const pinkyMcp = hand?.[17];
    const wrist = hand?.[0];
    const minVis = Math.min(conf(indexMcp), conf(pinkyMcp), conf(wrist));
    if (!indexMcp || !pinkyMcp || !wrist || minVis < 0.7) return;
    drawSegment(ctx, indexMcp, pinkyMcp, mapPoint, 'rgba(34,197,94,0.98)', 8);
    const roll = Math.atan2(pinkyMcp.y - indexMcp.y, pinkyMcp.x - indexMcp.x) * 180 / Math.PI;
    const wristCanvas = mapPoint(wrist);
    drawLabel(ctx, `${side ? side[0].toUpperCase() : ''} forearm: ${Math.round(normalizeAngle180(roll))}°`, wristCanvas.x + 12, wristCanvas.y - 16, 'rgba(34,197,94,0.95)');
  });
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

function drawHandSkeleton(ctx, landmarks, mapPoint) {
  for (const [a, b] of HAND_EDGES) {
    const pa = landmarks[a];
    const pb = landmarks[b];
    if (!pa || !pb) continue;
    drawSegment(ctx, pa, pb, mapPoint, 'rgba(168,85,247,0.95)', 3);
  }
  landmarks.forEach((p, i) => {
    const c = mapPoint(p);
    drawPoint(ctx, c.x, c.y, i === 0 ? 6 : 4, 'rgba(255,255,255,0.96)', 'rgba(109,40,217,0.9)');
  });
}

function drawJointAngle(ctx, landmarks, mapPoint, proximalIdx, jointIdx, distalIdx, label, good, warn, bad, clinicalFlexion = false) {
  const a = landmarks[proximalIdx];
  const b = landmarks[jointIdx];
  const c = landmarks[distalIdx];
  if (!a || !b || !c) return;
  const minVis = Math.min(conf(a), conf(b), conf(c));
  if (minVis < 0.7) return;
  const color = good;
  drawSegment(ctx, a, b, mapPoint, color, 8);
  drawSegment(ctx, b, c, mapPoint, color, 8);
  const bCanvas = mapPoint(b);
  drawPoint(ctx, bCanvas.x, bCanvas.y, 11, color, 'rgba(15,23,42,0.75)');
  const rawAngle = angleDeg(a, b, c);
  if (!Number.isFinite(rawAngle)) return;
  const displayAngle = clinicalFlexion ? 180 - rawAngle : rawAngle;
  drawLabel(ctx, `${label}: ${Math.round(displayAngle)}°`, bCanvas.x + 12, bCanvas.y - 14, color);
  drawArcHint(ctx, a, b, c, mapPoint, color);
}

function drawArcHint(ctx, a, b, c, mapPoint, color) {
  const ac = mapPoint(a);
  const bc = mapPoint(b);
  const cc = mapPoint(c);
  const a1 = Math.atan2(ac.y - bc.y, ac.x - bc.x);
  const a2 = Math.atan2(cc.y - bc.y, cc.x - bc.x);
  ctx.beginPath();
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.arc(bc.x, bc.y, 28, a1, a2);
  ctx.stroke();
}

function drawSegment(ctx, a, b, mapPoint, strokeStyle, lineWidth = 4) {
  const ac = mapPoint(a);
  const bc = mapPoint(b);
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

function drawStatusBadge(ctx, detection, width, height, overlays = {}, drawRect = null) {
  const poseCount = detection?.pose?.landmarks?.length ?? 0;
  const text = poseCount ? `High-confidence overlay active` : 'No body landmarks detected';
  ctx.font = 'bold 13px system-ui, -apple-system, sans-serif';
  const metrics = ctx.measureText(text);
  ctx.fillStyle = poseCount ? 'rgba(22,101,52,0.86)' : 'rgba(146,64,14,0.88)';
  roundRect(ctx, 14, height - 42, metrics.width + 20, 28, 10);
  ctx.fill();
  ctx.fillStyle = 'white';
  ctx.fillText(text, 24, height - 23);

  if (!poseCount) {
    const help = 'Move back until the full limb/joint chain is visible.';
    const m2 = ctx.measureText(help);
    ctx.fillStyle = 'rgba(15,23,42,0.78)';
    roundRect(ctx, 14, height - 76, m2.width + 20, 28, 10);
    ctx.fill();
    ctx.fillStyle = 'white';
    ctx.fillText(help, 24, height - 57);
  }

  if (overlays.debugOverlay !== false && drawRect) {
    const debug = `video ${drawRect.videoWidth}×${drawRect.videoHeight} → canvas ${Math.round(width)}×${Math.round(height)} • ${drawRect.fitMode}${overlays.mirrorX ? ' • mirrored' : ''}`;
    const m = ctx.measureText(debug);
    ctx.fillStyle = 'rgba(15,23,42,0.72)';
    roundRect(ctx, 14, 14, m.width + 20, 28, 10);
    ctx.fill();
    ctx.fillStyle = 'white';
    ctx.fillText(debug, 24, 33);
  }
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
