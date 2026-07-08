import { APP_VERSION, SCHEMA_VERSION, MEASUREMENT_ALGORITHM_VERSION } from './measurements.js';

export function buildSummaryExport({ session, results, sideFlipped, captureMeta, endpointOverrides = {}, smoothing, frames = [] }) {
  return {
    schema_version: SCHEMA_VERSION,
    app_name: 'OrthoAtlas',
    app_version: APP_VERSION,
    mediapipe_model_version: '@mediapipe/tasks-vision web runtime',
    measurement_algorithm_version: MEASUREMENT_ALGORITHM_VERSION,
    browser_device: typeof navigator !== 'undefined' ? { user_agent: navigator.userAgent, language: navigator.language } : {},
    created_at: new Date().toISOString(),
    mode: 'clinic_fast',
    privacy: {
      video_uploaded: false,
      video_stored: false,
      processing: 'local browser memory'
    },
    session: {
      patient_id: session.patientId,
      date: session.date,
      joint_selection: session.joint,
      side: session.affectedSide,
      involved_side: session.involvedSide,
      notes: session.notes,
      phi_warning: 'Do not enter names, MRNs, DOBs, or other PHI.'
    },
    capture: {
      source: 'browser_camera',
      camera_facing: session.cameraFacing,
      resolution: captureMeta?.resolution ?? null,
      started_at: captureMeta?.startedAt ?? null,
      stopped_at: captureMeta?.stoppedAt ?? null,
      frame_count: frames.length
    },
    side_detection: {
      manual_flip_applied: sideFlipped
    },
    manual_review: {
      endpoint_overrides
    },
    smoothing,
    results
  };
}

export function buildFullExport(args) {
  return {
    ...buildSummaryExport(args),
    frames: args.frames ?? [],
    frame_schema: {
      frame_index: 'integer',
      time_sec: 'seconds from recording start',
      pose_landmarks: 'MediaPipe pose landmarks, compacted',
      hand_landmarks: 'MediaPipe hand landmarks, compacted',
      angles: 'frame-level calculated angles in degrees',
      confidence: 'frame-level measurement confidence'
    }
  };
}

export function downloadJson(payload, filename) {
  triggerDownload(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }), filename);
}

export function downloadCsv(payload, filename) {
  const rows = flattenSummary(payload);
  downloadRows(rows, filename);
}

export function downloadLongCsv(payload, filename) {
  const rows = [];
  for (const frame of payload.frames ?? []) {
    for (const [measurement, value] of Object.entries(frame.angles ?? {})) {
      rows.push({
        patient_id: payload.session.patient_id,
        date: payload.session.date,
        frame_index: frame.frame_index,
        time_sec: frame.time_sec,
        measurement,
        value_deg: value,
        confidence: frame.confidence?.[measurement] ?? ''
      });
    }
  }
  downloadRows(rows.length ? rows : [{ patient_id: payload.session.patient_id, date: payload.session.date, frame_index: '', time_sec: '', measurement: '', value_deg: '', confidence: '' }], filename);
}

export function downloadReportHtml(payload, filename) {
  const rows = flattenSummary(payload);
  const resultRows = rows.map((row) => `
    <tr><td>${escapeHtml(row.side)}</td><td>${escapeHtml(row.motion)}</td><td>${escapeHtml(row.rom_min_deg)}</td><td>${escapeHtml(row.rom_max_deg)}</td><td>${escapeHtml(row.arc_deg)}</td></tr>`).join('');
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>OrthoAtlas Report</title><style>body{font-family:system-ui,-apple-system,sans-serif;margin:40px;color:#0f172a}h1{margin-bottom:0}.muted{color:#64748b}.card{border:1px solid #e2e8f0;border-radius:16px;padding:18px;margin:18px 0}table{border-collapse:collapse;width:100%}td,th{border-bottom:1px solid #e2e8f0;padding:10px;text-align:left}</style></head><body><h1>OrthoAtlas ROM Report</h1><p class="muted">Markerless motion assessment. No video uploaded or stored.</p><div class="card"><strong>Patient ID:</strong> ${escapeHtml(payload.session.patient_id || '')}<br><strong>Date:</strong> ${escapeHtml(payload.session.date || '')}<br><strong>Joint:</strong> ${escapeHtml(payload.session.joint_selection || '')}<br><strong>Tracking quality:</strong> ${escapeHtml(payload.results.quality?.overall || '')}<br><strong>Notes:</strong> ${escapeHtml(payload.session.notes || '')}</div><div class="card"><h2>Selected ROM Results</h2><table><thead><tr><th>Side</th><th>Motion</th><th>Min/extension/pronation</th><th>Max/flexion/supination</th><th>Arc</th></tr></thead><tbody>${resultRows}</tbody></table></div></body></html>`;
  triggerDownload(new Blob([html], { type: 'text/html' }), filename);
}

function flattenSummary(payload) {
  const base = {
    app_version: payload.app_version,
    schema_version: payload.schema_version,
    patient_id: payload.session.patient_id,
    date: payload.session.date,
    joint_selection: payload.session.joint_selection,
    selected_side: payload.session.side,
    involved_side: payload.session.involved_side,
    video_uploaded: false,
    video_stored: false,
    side_flip_applied: payload.side_detection.manual_flip_applied,
    tracking_quality: payload.results.quality?.overall ?? '',
    percent_usable_frames: payload.results.quality?.percent_usable_frames ?? '',
    notes: payload.session.notes ?? ''
  };
  const sides = payload.session.side === 'left' || payload.session.side === 'right' ? [payload.session.side] : ['left', 'right'];
  return sides.map((side) => ({ ...base, side, ...selectedExportValues(payload.results?.[side] ?? {}, payload.session.joint_selection) }));
}

function selectedExportValues(r, joint) {
  if (joint === 'shoulder_flexion') return { motion: 'shoulder flexion', rom_min_deg: r.shoulder_flexion?.flexion_min_deg ?? '', rom_max_deg: r.shoulder_flexion?.flexion_max_deg ?? '', arc_deg: r.shoulder_flexion?.arc_deg ?? '' };
  if (joint === 'shoulder_abduction') return { motion: 'shoulder abduction', rom_min_deg: r.shoulder_abduction?.abduction_min_deg ?? '', rom_max_deg: r.shoulder_abduction?.abduction_max_deg ?? '', arc_deg: r.shoulder_abduction?.arc_deg ?? '' };
  if (joint === 'elbow') return { motion: 'elbow flexion/extension', extension_deg: r.elbow?.extension_min_deg ?? '', flexion_deg: r.elbow?.flexion_max_deg ?? '', rom_min_deg: r.elbow?.extension_min_deg ?? '', rom_max_deg: r.elbow?.flexion_max_deg ?? '', arc_deg: r.elbow?.arc_deg ?? '' };
  if (joint === 'forearm') return { motion: 'forearm supination/pronation', pronation_deg: r.forearm?.pronation_max_deg ?? '', supination_deg: r.forearm?.supination_max_deg ?? '', rom_min_deg: r.forearm?.pronation_max_deg ?? '', rom_max_deg: r.forearm?.supination_max_deg ?? '', arc_deg: r.forearm?.arc_deg ?? '' };
  if (joint === 'hip') return { motion: 'hip flexion/extension', extension_deg: r.hip?.extension_min_deg ?? '', flexion_deg: r.hip?.flexion_max_deg ?? '', rom_min_deg: r.hip?.extension_min_deg ?? '', rom_max_deg: r.hip?.flexion_max_deg ?? '', arc_deg: r.hip?.arc_deg ?? '' };
  if (joint === 'knee') return { motion: 'knee flexion/extension', extension_deg: r.knee?.extension_min_deg ?? '', flexion_deg: r.knee?.flexion_max_deg ?? '', rom_min_deg: r.knee?.extension_min_deg ?? '', rom_max_deg: r.knee?.flexion_max_deg ?? '', arc_deg: r.knee?.arc_deg ?? '' };
  if (joint === 'ankle') return { motion: 'ankle dorsiflexion/plantarflexion', rom_min_deg: r.ankle?.ankle_min_deg ?? '', rom_max_deg: r.ankle?.ankle_max_deg ?? '', arc_deg: r.ankle?.arc_deg ?? '' };
  return { motion: joint, rom_min_deg: '', rom_max_deg: '', arc_deg: '' };
}

function downloadRows(rows, filename) {
  const headers = Object.keys(rows[0] ?? { empty: '' });
  const csv = [headers.join(','), ...rows.map(row => headers.map(key => csvEscape(row[key])).join(','))].join('\n');
  triggerDownload(new Blob([csv], { type: 'text/csv' }), filename);
}
function csvEscape(value) { const text = String(value ?? ''); return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text; }
function triggerDownload(blob, filename) { const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url); }
function escapeHtml(value) { return String(value ?? '').replace(/[&<>'"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c])); }
