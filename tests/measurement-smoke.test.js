import assert from 'node:assert/strict';
import { smoothNumericSeries, DEFAULT_SMOOTHING_CONFIG, CLINICAL_CONVENTIONS, DATA_DICTIONARY } from '../src/lib/measurements.js';

const smoothed = smoothNumericSeries([0, 2, 100, 4, 6], { ...DEFAULT_SMOOTHING_CONFIG, preset: 'custom', method: 'median', enabled: true, window: 3 });
assert.equal(smoothed.length, 5);
assert.ok(CLINICAL_CONVENTIONS.elbow.includes('extension'));
assert.ok(DATA_DICTIONARY.some((row) => row.variable_name === 'patient_id'));
console.log('OrthoAtlas measurement smoke tests passed.');
