# OrthoAtlas

Clinic-fast browser app for markerless ROM capture. OrthoAtlas runs locally in the browser; no video is uploaded or stored.

## Current version

v3.2.0 — precise overlay mapping

## What is included

- Phone-first clinic ROM capture
- Full-screen mobile camera mode
- MediaPipe Pose + Hands model loading
- Selected-joint, selected-side live overlay
- High-confidence-only ROM capture
- Clinical ROM convention for elbow/knee/hip extension: full extension = 0°
- ROM results for the selected joint only
- Summary JSON, full JSON, summary CSV, long CSV, and clean HTML report export

## v3.2 overlay mapping changes

- One shared landmark-to-canvas mapping function
- Overlay canvas size now follows the actual displayed preview size and device pixel ratio
- `contain` is default for measurement accuracy, so the full camera image is visible without cropping
- Optional `Fit: fill` toggle for a more native camera look when desired
- Front camera preview is mirrored, and overlay x-coordinates are mirrored the same way
- Debug overlay shows video size, canvas size, fit mode, and mirror status
- Embedded and full-screen camera modes use the same mapping logic

## Run locally

```bash
npm config set registry https://registry.npmjs.org/
npm install
npm run dev
```

For a fresh local test on another port:

```bash
npm run dev -- --port 5174 --strictPort
```

## Build

```bash
npm run build
npm test
```

## Cloudflare Pages settings

- Build command: `npm run build`
- Build output directory: `dist`
- Root directory: blank or `/` if the repo root contains `index.html`, `package.json`, `src/`, and `public/`
