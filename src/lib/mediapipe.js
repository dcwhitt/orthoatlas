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
  const rect = video.getBoundingClientRect();
  const width = video.videoWidth || rect.width || 1280;
  const height = video.videoHeight || rect.height || 720;
  if (canvas.width !== width) canvas.width = width;
  if (canvas.height !== height) canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, width, height);

  const poses = detection?.pose?.landmarks ?? [];
  for (const landmarks of poses) {
    drawPoseSkeleton(ctx, landmarks, width, height, overlays);
  }

  if (overlays.selectedJoint === 'forearm') {
    const hands = detection?.hands?.landmarks ?? [];
    const handedness = detection?.hands?.handednesses ?? detection?.hands?.handedness ?? [];
    drawForearmHands(ctx, hands, handedness, width, height, overlays);
  }

  drawStatusBadge(ctx, detection, width, height, overlays);
}

const POSE_EDGES = [
  [11, 13], [13, 15], [12, 14], [14, 16],
  [11, 12], [11, 23], [12, 24], [23, 24],
  [23, 25], [25, 27], [24, 26], [26, 28],
  [27, 31], [28, 32], [27, 29], [28, 30]
];

const HAND_EDGES = [
  [0,1],[1,2],[2,3],[3,4],
  [0,5],[5,6],[6,7],[7,8],
  [0,9],[9,10],[10,11],[11,12],
  [0,13],[13,14],[14,15],[15,16],
  [0,17],[17,18],[18,19],[19,20],
  [5,9],[9,13],[13,17]
];

function drawPoseSkeleton(ctx, landmarks, width, height, overlays = {}) {
  const warn = 'rgba(250,204,21,0.95)';
  const good = 'rgba(34,197,94,0.95)';
  const bad = 'rgba(239,68,68,0.95)';
  const selectedJoint = overlays.selectedJoint ?? 'all';
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
    drawJointAngle(ctx, landmarks, width, height, proximalIdx, jointIdx, distalIdx, label, good, warn, bad, clinicalFlexion);
  }
}


function drawForearmHands(ctx, hands, handedness, width, height, overlays = {}) {
  const selectedSide = overlays.selectedSide ?? 'auto/bilateral';
  const sides = selectedSide === 'left' || selectedSide === 'right' ? [selectedSide] : ['left', 'right'];
  hands.forEach((hand, idx) => {
    const side = handSide(hand, handedness?.[idx]);
    if (side && !sides.includes(side)) return;
    drawHandSkeleton(ctx, hand, width, height);
    const indexMcp = hand?.[5];
    const pinkyMcp = hand?.[17];
    const wrist = hand?.[0];
    const minVis = Math.min(conf(indexMcp), conf(pinkyMcp), conf(wrist));
    if (!indexMcp || !pinkyMcp || !wrist || minVis < 0.7) return;
    drawSegment(ctx, indexMcp, pinkyMcp, width, height, 'rgba(34,197,94,0.98)', 8);
    const roll = Math.atan2(pinkyMcp.y - indexMcp.y, pinkyMcp.x - indexMcp.x) * 180 / Math.PI;
    drawLabel(ctx, `${side ? side[0].toUpperCase() : ''} forearm: ${Math.round(normalizeAngle180(roll))}°`, wrist.x * width + 12, wrist.y * height - 16, 'rgba(34,197,94,0.95)');
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

function drawHandSkeleton(ctx, landmarks, width, height) {
  for (const [a, b] of HAND_EDGES) {
    const pa = landmarks[a];
    const pb = landmarks[b];
    if (!pa || !pb) continue;
    drawSegment(ctx, pa, pb, width, height, 'rgba(168,85,247,0.95)', 3);
  }
  landmarks.forEach((p, i) => drawPoint(ctx, p.x * width, p.y * height, i === 0 ? 6 : 4, 'rgba(255,255,255,0.96)', 'rgba(109,40,217,0.9)'));
}

function drawJointAngle(ctx, landmarks, width, height, proximalIdx, jointIdx, distalIdx, label, good, warn, bad, clinicalFlexion = false) {
  const a = landmarks[proximalIdx];
  const b = landmarks[jointIdx];
  const c = landmarks[distalIdx];
  if (!a || !b || !c) return;
  const minVis = Math.min(conf(a), conf(b), conf(c));
  if (minVis < 0.7) return;
  const color = good;
  drawSegment(ctx, a, b, width, height, color, 8);
  drawSegment(ctx, b, c, width, height, color, 8);
  drawPoint(ctx, b.x * width, b.y * height, 11, color, 'rgba(15,23,42,0.75)');
  const rawAngle = angleDeg(a, b, c);
  if (!Number.isFinite(rawAngle)) return;
  const displayAngle = clinicalFlexion ? 180 - rawAngle : rawAngle;
  const x = b.x * width;
  const y = b.y * height;
  drawLabel(ctx, `${label}: ${Math.round(displayAngle)}°`, x + 12, y - 14, color);
  drawArcHint(ctx, a, b, c, width, height, color);
}

function drawArcHint(ctx, a, b, c, width, height, color) {
  const bx = b.x * width;
  const by = b.y * height;
  const a1 = Math.atan2(a.y * height - by, a.x * width - bx);
  const a2 = Math.atan2(c.y * height - by, c.x * width - bx);
  ctx.beginPath();
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.arc(bx, by, 28, a1, a2);
  ctx.stroke();
}

function drawSegment(ctx, a, b, width, height, strokeStyle, lineWidth = 4) {
  ctx.strokeStyle = strokeStyle;
  ctx.lineWidth = lineWidth;
  ctx.beginPath();
  ctx.moveTo(a.x * width, a.y * height);
  ctx.lineTo(b.x * width, b.y * height);
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
  ctx.font = 'bold 22px system-ui, -apple-system, sans-serif';
  const padding = 8;
  const metrics = ctx.measureText(text);
  ctx.fillStyle = 'rgba(15,23,42,0.78)';
  roundRect(ctx, x - padding, y - 24, metrics.width + padding * 2, 32, 10);
  ctx.fill();
  ctx.fillStyle = 'white';
  ctx.fillText(text, x, y);
}

function drawStatusBadge(ctx, detection, width, height, overlays = {}) {
  const poseCount = detection?.pose?.landmarks?.length ?? 0;
  const text = poseCount ? `High-confidence overlay active` : 'No body landmarks detected';
  ctx.font = 'bold 18px system-ui, -apple-system, sans-serif';
  const metrics = ctx.measureText(text);
  ctx.fillStyle = poseCount ? 'rgba(22,101,52,0.86)' : 'rgba(146,64,14,0.88)';
  roundRect(ctx, 18, height - 52, metrics.width + 24, 34, 12);
  ctx.fill();
  ctx.fillStyle = 'white';
  ctx.fillText(text, 30, height - 29);

  if (!poseCount) {
    const help = 'Move back until the full limb/joint chain is visible.';
    const m2 = ctx.measureText(help);
    ctx.fillStyle = 'rgba(15,23,42,0.78)';
    roundRect(ctx, 18, height - 92, m2.width + 24, 34, 12);
    ctx.fill();
    ctx.fillStyle = 'white';
    ctx.fillText(help, 30, height - 69);
  }
}

function visible(p) {
  return p && conf(p) >= 0.25 && Number.isFinite(p.x) && Number.isFinite(p.y);
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

function drawOverlayLine(ctx, line, strokeStyle, lineWidth, label) {
  if (!line?.length) return;
  ctx.strokeStyle = strokeStyle;
  ctx.fillStyle = strokeStyle;
  ctx.lineWidth = lineWidth;
  if (line.length === 1) {
    ctx.beginPath();
    ctx.arc(line[0][0], line[0][1], 7, 0, Math.PI * 2);
    ctx.fill();
    return;
  }
  ctx.beginPath();
  ctx.moveTo(line[0][0], line[0][1]);
  ctx.lineTo(line[1][0], line[1][1]);
  ctx.stroke();
  ctx.font = 'bold 18px system-ui';
  ctx.fillText(label, line[1][0] + 8, line[1][1] - 8);
}
