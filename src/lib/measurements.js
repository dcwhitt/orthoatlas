export const APP_VERSION = '3.0.0';
export const SCHEMA_VERSION = '3.0.0';
export const MEASUREMENT_ALGORITHM_VERSION = 'orthoatlas-measurements-3.0.0';

export const JOINT_CONFIG = [
  { key: 'shoulder_abduction', label: 'Shoulder abduction', short: 'shoulder-abduction', group: 'shoulder' },
  { key: 'shoulder_flexion', label: 'Shoulder flexion', short: 'shoulder-flexion', group: 'shoulder' },
  { key: 'elbow', label: 'Elbow flexion/extension', short: 'elbow', group: 'elbow' },
  { key: 'forearm', label: 'Forearm supination/pronation', short: 'forearm', group: 'forearm' },
  { key: 'hip', label: 'Hip flexion/extension', short: 'hip', group: 'hip' },
  { key: 'knee', label: 'Knee flexion/extension', short: 'knee', group: 'knee' },
  { key: 'ankle', label: 'Ankle dorsiflexion/plantarflexion', short: 'ankle', group: 'ankle' }
];

export const PROTOCOLS = {
  all: {
    title: 'All visible joints',
    camera_position: 'Phone/computer perpendicular to the dominant motion plane; fill the frame with the limb(s).',
    patient_position: 'Comfortable seated or standing position based on the joint being captured.',
    required_landmarks: ['Joint above and below each measured joint', 'Full limb segment visible'],
    start_position: 'Begin from a comfortable neutral or terminal position and pause before moving.',
    motion_instructions: 'Move one plane at a time. Avoid compound rotation unless intentionally testing forearm/wrist.',
    endpoint_pause_duration: '1 second at each endpoint',
    recommended_repetitions: '2–3 cycles per motion',
    common_failure_warnings: ['Poor lighting', 'Body part leaving frame', 'Out-of-plane rotation', 'Loose clothing obscuring landmarks'],
    steps: ['Keep the full limb visible.', 'Move one plane at a time.', 'Pause at each terminal limit.', 'Use Review if terminal frames need correction.']
  },
  elbow: {
    title: 'Elbow flexion/extension',
    camera_position: 'Side view perpendicular to elbow flexion-extension plane.',
    patient_position: 'Seated or standing with shoulder, elbow, and wrist visible.',
    required_landmarks: ['shoulder', 'elbow', 'wrist'],
    start_position: 'Terminal extension if tolerated.',
    motion_instructions: 'Move from extension to flexion and back; pause at each terminal limit.',
    endpoint_pause_duration: '1 second',
    recommended_repetitions: '3',
    common_failure_warnings: ['Shoulder hidden', 'Wrist hidden', 'Motion too fast', 'Forearm out of plane'],
    steps: ['Show shoulder, elbow, and wrist.', 'Move from terminal extension to terminal flexion.', 'Pause briefly at each terminal position.']
  },
  knee: {
    title: 'Knee flexion/extension',
    camera_position: 'Side view perpendicular to knee flexion-extension plane.',
    patient_position: 'Standing, seated, or supine depending on exam; show hip, knee, and ankle.',
    required_landmarks: ['hip', 'knee', 'ankle'],
    start_position: 'Terminal extension if tolerated.',
    motion_instructions: 'Flex and extend the knee through available range; pause at endpoints.',
    endpoint_pause_duration: '1 second',
    recommended_repetitions: '3',
    common_failure_warnings: ['Hip hidden', 'Ankle hidden', 'Camera not perpendicular', 'Loose pants obscuring knee'],
    steps: ['Show hip, knee, and ankle.', 'Move through flexion/extension in one plane.', 'Pause at full extension and full flexion.']
  },
  shoulder_flexion: {
    title: 'Shoulder flexion',
    camera_position: 'Side or 45° oblique view with trunk, shoulder, elbow, and wrist visible.',
    patient_position: 'Standing or seated upright; minimize trunk lean.',
    required_landmarks: ['hip/trunk', 'shoulder', 'elbow', 'wrist'],
    start_position: 'Arm at side.',
    motion_instructions: 'Raise arm forward into flexion to maximum available ROM, pause, then return.',
    endpoint_pause_duration: '1 second',
    recommended_repetitions: '3',
    common_failure_warnings: ['Trunk extension substitution', 'Wrist leaves frame', 'Shoulder hidden by clothing'],
    steps: ['Show trunk, shoulder, elbow, and wrist.', 'Raise arm forward in sagittal plane.', 'Pause at maximum elevation.']
  },
  shoulder_abduction: {
    title: 'Shoulder abduction',
    camera_position: 'Front-facing camera view with trunk and whole arm visible.',
    patient_position: 'Standing or seated upright facing camera.',
    required_landmarks: ['trunk/hips', 'shoulder', 'elbow', 'wrist'],
    start_position: 'Arm at side.',
    motion_instructions: 'Raise arm out to the side to maximum abduction, pause, then return.',
    endpoint_pause_duration: '1 second',
    recommended_repetitions: '3',
    common_failure_warnings: ['Scaption instead of abduction', 'Trunk side-bending', 'Arm leaves frame'],
    steps: ['Face camera.', 'Show trunk and whole arm.', 'Abduct arm in coronal plane.', 'Pause at endpoint.']
  },
  shoulder: {
    title: 'Shoulder ROM',
    camera_position: 'Perpendicular to the motion plane.',
    patient_position: 'Upright seated/standing.',
    required_landmarks: ['hip/trunk', 'shoulder', 'elbow', 'wrist'],
    start_position: 'Arm at side.',
    motion_instructions: 'Capture forward elevation and abduction as separate clips when possible.',
    endpoint_pause_duration: '1 second',
    recommended_repetitions: '3',
    common_failure_warnings: ['Trunk lean', 'Elbow/wrist leaving frame', 'Scapular compensation'],
    steps: ['Camera perpendicular to movement plane.', 'Show trunk, shoulder, elbow, and wrist.', 'Capture one plane at a time.']
  },
  hip: {
    title: 'Hip ROM',
    camera_position: 'Side view for flexion/extension; front view for abduction/adduction.',
    patient_position: 'Standing, supine, or seated based on protocol.',
    required_landmarks: ['shoulder/trunk', 'hip', 'knee', 'ankle'],
    start_position: 'Neutral hip position.',
    motion_instructions: 'Capture flexion/extension or abduction/adduction as separate clips when possible.',
    endpoint_pause_duration: '1 second',
    recommended_repetitions: '3',
    common_failure_warnings: ['Pelvic rotation', 'Knee hidden', 'Out-of-plane motion'],
    steps: ['Show trunk, hip, knee, and ankle.', 'Avoid camera tilt.', 'Capture one plane at a time.']
  },
  ankle: {
    title: 'Ankle dorsiflexion/plantarflexion',
    camera_position: 'Side view focused on knee, ankle, heel, and forefoot.',
    patient_position: 'Seated, standing lunge, or supine depending on protocol.',
    required_landmarks: ['knee', 'ankle', 'heel/foot landmarks'],
    start_position: 'Neutral ankle position.',
    motion_instructions: 'Move from dorsiflexion to plantarflexion; pause at endpoints.',
    endpoint_pause_duration: '1 second',
    recommended_repetitions: '3',
    common_failure_warnings: ['Foot landmarks hidden', 'Shoe obscures foot', 'Camera not side-on'],
    steps: ['Show knee, ankle, and foot.', 'Use side view.', 'Pause at maximum dorsiflexion and plantarflexion.']
  },
  forearm: {
    title: 'Forearm supination/pronation',
    camera_position: 'Camera facing patient, centered on elbow/hand.',
    patient_position: 'Elbow flexed 90°, arm at side.',
    required_landmarks: ['elbow', 'wrist', 'hand visible'],
    start_position: 'Neutral thumb-up.',
    motion_instructions: 'Rotate to full supination, pause, then full pronation, pause.',
    endpoint_pause_duration: '1 second',
    recommended_repetitions: '3',
    common_failure_warnings: ['Palm occluded', 'Elbow not flexed near 90°', 'Hand not visible'],
    steps: ['Elbow flexed 90°.', 'Arm at side.', 'Camera facing patient.', 'Start neutral, then full supination and pronation.']
  },
  wrist_fe: {
    title: 'Wrist flexion/extension',
    camera_position: 'Side view of forearm and hand.',
    patient_position: 'Forearm supported if possible; hand free.',
    required_landmarks: ['elbow/wrist/hand'],
    start_position: 'Neutral wrist.',
    motion_instructions: 'Move from wrist flexion to extension while keeping forearm still.',
    endpoint_pause_duration: '1 second',
    recommended_repetitions: '3',
    common_failure_warnings: ['Forearm rotates', 'Hand hidden', 'Camera not side-on'],
    steps: ['Show forearm, wrist, and hand.', 'Keep forearm still.', 'Flex and extend wrist only.']
  },
  wrist_dev: {
    title: 'Wrist radial/ulnar deviation',
    camera_position: 'Top-down or front view of forearm and hand.',
    patient_position: 'Forearm supported palm down if possible.',
    required_landmarks: ['wrist/hand'],
    start_position: 'Neutral wrist.',
    motion_instructions: 'Move from radial to ulnar deviation while keeping forearm still.',
    endpoint_pause_duration: '1 second',
    recommended_repetitions: '3',
    common_failure_warnings: ['Forearm rotates', 'Hand hidden', 'Camera angle oblique'],
    steps: ['Show wrist and hand.', 'Keep forearm still.', 'Move side-to-side only.']
  }
};

export const CLINICAL_CONVENTIONS = {
  elbow: 'Elbow extension: 0° is full extension; positive values indicate extension deficit; hyperextension may be negative if manually confirmed.',
  knee: 'Knee extension: 0° is full extension; positive values indicate flexion contracture/extension deficit; hyperextension may be negative if manually confirmed.',
  shoulder: 'Shoulder elevation is measured relative to the trunk/hip-shoulder axis rather than raw image vertical.',
  ankle: 'Ankle dorsiflexion/plantarflexion uses a tibia-foot proxy and should be interpreted as a screening ROM value.',
  wrist: 'Wrist and forearm measures use hand/forearm landmark proxies and should be captured with standardized camera position.'
};

export const DATA_DICTIONARY = [
  { variable_name: 'patient_id', label: 'Patient ID', type: 'text', units: '', allowed_values: '', description: 'Clinic identifier entered by user.', example: 'ABC123', missing_value_meaning: 'Not entered' },
  { variable_name: 'date', label: 'Date', type: 'date', units: '', allowed_values: 'YYYY-MM-DD', description: 'Date of ROM capture.', example: '2026-07-07', missing_value_meaning: 'Not entered' },
  { variable_name: 'joint_selection', label: 'Joint selection', type: 'categorical', units: '', allowed_values: JOINT_CONFIG.map(j => j.key).join(';'), description: 'Selected protocol/joint.', example: 'elbow', missing_value_meaning: 'All visible joints' },
  { variable_name: 'side', label: 'Side', type: 'categorical', units: '', allowed_values: 'left;right;auto/bilateral', description: 'Side selected by user.', example: 'left', missing_value_meaning: 'Auto/bilateral' },
  { variable_name: 'arc_deg', label: 'Arc of motion', type: 'numeric', units: 'degrees', allowed_values: '', description: 'Maximum minus minimum processed ROM value.', example: '127.4', missing_value_meaning: 'Not measured' }
];

export const SMOOTHING_METHODS = [
  { key: 'none', label: 'None / raw angles' },
  { key: 'median', label: 'Median filter' },
  { key: 'moving_average', label: 'Moving average' },
  { key: 'ema', label: 'Exponential moving average' },
  { key: 'median_ema', label: 'Median + EMA' }
];

export const DEFAULT_SMOOTHING_CONFIG = {
  preset: 'live_fast',
  enabled: false,
  method: 'none',
  window: 5,
  emaAlpha: 0.35,
  minConfidence: 0.7
};

export function defaultResults() {
  return {
    left: emptySide(),
    right: emptySide(),
    bilateral: { metrics: {} },
    quality: { overall: 'not measured', score: null, warnings: [], frame_count: 0, percent_usable_frames: null },
    traces: {}
  };
}

function emptySide() {
  return {
    shoulder_flexion: {}, shoulder_abduction: {}, elbow: {}, forearm: {}, hip: {}, knee: {}, ankle: {}
  };
}

const IDX = {
  left: { shoulder: 11, elbow: 13, wrist: 15, hip: 23, knee: 25, ankle: 27, heel: 29, foot: 31 },
  right: { shoulder: 12, elbow: 14, wrist: 16, hip: 24, knee: 26, ankle: 28, heel: 30, foot: 32 }
};

export function computeFrameAngles(frame, options = {}) {
  const pose = frame?.pose_landmarks?.[0] ?? frame?.pose_landmarks ?? null;
  const hands = frame?.hand_landmarks ?? [];
  const handedness = frame?.hand_handedness ?? [];
  const angles = {};
  const confidence = {};
  const minConfidence = Number(options.minConfidence ?? options.smoothing?.minConfidence ?? DEFAULT_SMOOTHING_CONFIG.minConfidence ?? 0.7);
  const selectedJoint = options.selectedJoint ?? options.joint ?? 'elbow';
  const selectedSide = options.selectedSide ?? options.side ?? 'auto/bilateral';
  const sides = selectedSide === 'left' || selectedSide === 'right' ? [selectedSide] : ['left', 'right'];

  if (pose) {
    for (const side of sides) {
      const i = IDX[side];
      if (selectedJoint === 'elbow') addClinicalFlexion(angles, confidence, `${side}_elbow_flexion_deg`, pose, i.shoulder, i.elbow, i.wrist, minConfidence);
      if (selectedJoint === 'knee') addClinicalFlexion(angles, confidence, `${side}_knee_flexion_deg`, pose, i.hip, i.knee, i.ankle, minConfidence);
      if (selectedJoint === 'shoulder_flexion') addShoulderMotion(angles, confidence, `${side}_shoulder_flexion_deg`, pose, i.hip, i.shoulder, i.elbow, minConfidence);
      if (selectedJoint === 'shoulder_abduction') addShoulderMotion(angles, confidence, `${side}_shoulder_abduction_deg`, pose, i.hip, i.shoulder, i.elbow, minConfidence);
      if (selectedJoint === 'hip') addClinicalFlexion(angles, confidence, `${side}_hip_flexion_deg`, pose, i.shoulder, i.hip, i.knee, minConfidence);
      if (selectedJoint === 'ankle') addAnkleMotion(angles, confidence, `${side}_ankle_df_pf_deg`, pose, i.knee, i.ankle, i.foot, minConfidence);
    }
  }

  if (selectedJoint === 'forearm') {
    addForearmRotation(angles, confidence, hands, handedness, sides, minConfidence);
  }
  return { angles, confidence };
}

function addClinicalFlexion(angles, confidence, key, pts, a, b, c, minConfidence = 0.7) {
  const p1 = pts[a], p2 = pts[b], p3 = pts[c];
  const conf = Math.min(pointConf(p1), pointConf(p2), pointConf(p3));
  if (!p1 || !p2 || !p3 || conf < minConfidence) return;
  const raw = angleDeg(p1, p2, p3);
  if (Number.isFinite(raw)) {
    angles[key] = round1(180 - raw);
    confidence[key] = round2(conf);
  }
}

function addShoulderMotion(angles, confidence, key, pts, trunkIdx, shoulderIdx, elbowIdx, minConfidence = 0.7) {
  const trunk = pts[trunkIdx], shoulder = pts[shoulderIdx], elbow = pts[elbowIdx];
  const conf = Math.min(pointConf(trunk), pointConf(shoulder), pointConf(elbow));
  if (!trunk || !shoulder || !elbow || conf < minConfidence) return;
  const raw = angleDeg(trunk, shoulder, elbow);
  if (Number.isFinite(raw)) {
    angles[key] = round1(raw);
    confidence[key] = round2(conf);
  }
}

function addAnkleMotion(angles, confidence, key, pts, kneeIdx, ankleIdx, footIdx, minConfidence = 0.7) {
  const knee = pts[kneeIdx], ankle = pts[ankleIdx], foot = pts[footIdx];
  const conf = Math.min(pointConf(knee), pointConf(ankle), pointConf(foot));
  if (!knee || !ankle || !foot || conf < minConfidence) return;
  const raw = angleDeg(knee, ankle, foot);
  if (Number.isFinite(raw)) {
    // This is a clinically convenient tibia-foot proxy. Neutral is not assumed; ROM uses min/max values.
    angles[key] = round1(raw);
    confidence[key] = round2(conf);
  }
}

function addForearmRotation(angles, confidence, hands, handedness, sides, minConfidence = 0.7) {
  if (!hands?.length) return;
  for (let h = 0; h < hands.length; h++) {
    const hand = hands[h];
    if (!hand?.length) continue;
    const side = handSide(hand, handedness?.[h]);
    if (!side || !sides.includes(side)) continue;
    const wrist = hand[0], indexMcp = hand[5], pinkyMcp = hand[17];
    const conf = Math.min(pointConf(wrist), pointConf(indexMcp), pointConf(pinkyMcp));
    if (!wrist || !indexMcp || !pinkyMcp || conf < minConfidence) continue;
    const roll = Math.atan2(pinkyMcp.y - indexMcp.y, pinkyMcp.x - indexMcp.x) * 180 / Math.PI;
    if (Number.isFinite(roll)) {
      angles[`${side}_forearm_rotation_deg`] = round1(normalizeAngle180(roll));
      confidence[`${side}_forearm_rotation_deg`] = round2(conf);
    }
  }
}

function handSide(hand, handness) {
  const label = String(handness?.categoryName ?? handness?.label ?? '').toLowerCase();
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

export function summarizeRomFrames(frames, options = {}) {
  const results = defaultResults();
  const usableFrames = [];
  const traces = {};

  frames.forEach((frame) => {
    const { angles, confidence } = computeFrameAngles(frame, options);
    frame.angles = angles;
    frame.confidence = confidence;
    if (Object.keys(angles).length) usableFrames.push(frame.frame_index);
    for (const [key, value] of Object.entries(angles)) {
      if (!traces[key]) traces[key] = [];
      traces[key].push({ frame_index: frame.frame_index, value, confidence: confidence[key] ?? null });
    }
  });

  for (const key of Object.keys(traces)) {
    const values = traces[key].map(p => p.value);
    const processed = smoothNumericSeries(values, options.smoothing ?? DEFAULT_SMOOTHING_CONFIG);
    traces[key] = traces[key].map((p, idx) => ({ ...p, processed_value: processed[idx] }));
  }

  for (const side of ['left', 'right']) {
    summarizeFlexion(results[side].elbow, traces[`${side}_elbow_flexion_deg`]);
    summarizeFlexion(results[side].knee, traces[`${side}_knee_flexion_deg`]);
    summarizeGeneric(results[side].shoulder_flexion = {}, traces[`${side}_shoulder_flexion_deg`], 'flexion');
    summarizeGeneric(results[side].shoulder_abduction = {}, traces[`${side}_shoulder_abduction_deg`], 'abduction');
    summarizeFlexion(results[side].hip, traces[`${side}_hip_flexion_deg`]);
    summarizeGeneric(results[side].ankle, traces[`${side}_ankle_df_pf_deg`], 'ankle');
    summarizeForearm(results[side].forearm, traces[`${side}_forearm_rotation_deg`]);
  }

  results.traces = traces;
  results.quality = buildQuality(frames, usableFrames, traces);
  results.bilateral = buildBilateral(results);
  return results;
}

function summarizeFlexion(target, trace = []) {
  if (!trace.length) return;
  const values = trace.map(p => ({ frame: p.frame_index, value: p.processed_value ?? p.value })).filter(p => Number.isFinite(p.value));
  if (!values.length) return;
  const min = values.reduce((a, b) => b.value < a.value ? b : a, values[0]);
  const max = values.reduce((a, b) => b.value > a.value ? b : a, values[0]);
  target.extension_min_deg = round1(min.value);
  target.flexion_max_deg = round1(max.value);
  target.arc_deg = round1(max.value - min.value);
  target.terminal_extension_frame = min.frame;
  target.terminal_flexion_frame = max.frame;
  target.samples = values.length;
}

function summarizeGeneric(target, trace = [], prefix = 'rom') {
  if (!trace.length) return;
  const values = trace.map(p => ({ frame: p.frame_index, value: p.processed_value ?? p.value })).filter(p => Number.isFinite(p.value));
  if (!values.length) return;
  const min = values.reduce((a, b) => b.value < a.value ? b : a, values[0]);
  const max = values.reduce((a, b) => b.value > a.value ? b : a, values[0]);
  target[`${prefix}_min_deg`] = round1(min.value);
  target[`${prefix}_max_deg`] = round1(max.value);
  target.arc_deg = round1(max.value - min.value);
  target.terminal_min_frame = min.frame;
  target.terminal_max_frame = max.frame;
  target.samples = values.length;
}

function buildQuality(frames, usableFrames, traces) {
  const frameCount = frames.length;
  const percent = frameCount ? round1((usableFrames.length / frameCount) * 100) : null;
  const measuredTraceCount = Object.values(traces).filter(t => t.length > 0).length;
  const warnings = [];
  if (!frameCount) warnings.push('No recorded frames.');
  if (frameCount > 0 && percent < 50) warnings.push('Few usable landmark frames. Try better lighting and keep the full limb in frame.');
  if (frameCount > 0 && measuredTraceCount === 0) warnings.push('No measurable joint chain detected.');
  const score = frameCount ? Math.max(0, Math.min(1, (percent ?? 0) / 100)) : null;
  const overall = !frameCount ? 'not measured' : score >= 0.85 ? 'good' : score >= 0.6 ? 'acceptable' : 'poor';
  return { overall, score: score == null ? null : round2(score), warnings, frame_count: frameCount, usable_frames: usableFrames.length, percent_usable_frames: percent };
}

function buildBilateral(results) {
  const metrics = {};
  const pairs = [
    ['shoulder_flexion_arc_deg', results.left.shoulder_flexion?.arc_deg, results.right.shoulder_flexion?.arc_deg],
    ['shoulder_abduction_arc_deg', results.left.shoulder_abduction?.arc_deg, results.right.shoulder_abduction?.arc_deg],
    ['elbow_arc_deg', results.left.elbow.arc_deg, results.right.elbow.arc_deg],
    ['forearm_arc_deg', results.left.forearm.arc_deg, results.right.forearm.arc_deg],
    ['hip_arc_deg', results.left.hip.arc_deg, results.right.hip.arc_deg],
    ['knee_arc_deg', results.left.knee.arc_deg, results.right.knee.arc_deg],
    ['ankle_arc_deg', results.left.ankle.arc_deg, results.right.ankle.arc_deg]
  ];
  for (const [key, left, right] of pairs) {
    if (Number.isFinite(left) && Number.isFinite(right)) {
      const larger = Math.max(Math.abs(left), Math.abs(right));
      metrics[key] = { left, right, difference: round1(left - right), percent_symmetry: larger ? round1((Math.min(Math.abs(left), Math.abs(right)) / larger) * 100) : null };
    }
  }
  return { metrics };
}

function summarizeForearm(target, trace = []) {
  if (!trace.length) return;
  const values = trace.map(p => ({ frame: p.frame_index, value: p.processed_value ?? p.value })).filter(p => Number.isFinite(p.value));
  if (!values.length) return;
  const first = values[0].value;
  const normalized = values.map(p => ({ frame: p.frame, value: round1(normalizeAngle180(p.value - first)) }));
  const min = normalized.reduce((a, b) => b.value < a.value ? b : a, normalized[0]);
  const max = normalized.reduce((a, b) => b.value > a.value ? b : a, normalized[0]);
  target.supination_max_deg = round1(max.value);
  target.pronation_max_deg = round1(min.value);
  target.arc_deg = round1(max.value - min.value);
  target.neutral_frame = values[0].frame;
  target.terminal_supination_frame = max.frame;
  target.terminal_pronation_frame = min.frame;
  target.samples = values.length;
}

export function smoothNumericSeries(values, config = DEFAULT_SMOOTHING_CONFIG) {
  if (!config?.enabled || config.method === 'none') return [...values];
  const window = Math.max(1, Number(config.window) || 1);
  if (config.method === 'median') return rolling(values, window, median);
  if (config.method === 'moving_average') return rolling(values, window, mean);
  if (config.method === 'ema') return ema(values, Number(config.emaAlpha) || 0.35);
  if (config.method === 'median_ema') return ema(rolling(values, window, median), Number(config.emaAlpha) || 0.35);
  return [...values];
}

function rolling(values, window, reducer) {
  const half = Math.floor(window / 2);
  return values.map((_, i) => {
    const chunk = values.slice(Math.max(0, i - half), Math.min(values.length, i + half + 1)).filter(Number.isFinite);
    return chunk.length ? round1(reducer(chunk)) : values[i];
  });
}
function ema(values, alpha) {
  let previous = null;
  return values.map((value) => {
    if (!Number.isFinite(value)) return value;
    previous = previous == null ? value : alpha * value + (1 - alpha) * previous;
    return round1(previous);
  });
}
function mean(arr) { return arr.reduce((a, b) => a + b, 0) / arr.length; }
function median(arr) { const s = [...arr].sort((a, b) => a - b); const mid = Math.floor(s.length / 2); return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2; }
function pointConf(p) { return Number.isFinite(p?.visibility) ? p.visibility : Number.isFinite(p?.presence) ? p.presence : 1; }
function angleDeg(a, b, c) { const bax = a.x - b.x, bay = a.y - b.y, bcx = c.x - b.x, bcy = c.y - b.y; const dot = bax * bcx + bay * bcy; const mag = Math.hypot(bax, bay) * Math.hypot(bcx, bcy); if (!mag) return null; return Math.acos(Math.max(-1, Math.min(1, dot / mag))) * 180 / Math.PI; }
export function round1(v) { return Number.isFinite(v) ? Math.round(v * 10) / 10 : null; }
function round2(v) { return Number.isFinite(v) ? Math.round(v * 100) / 100 : null; }
