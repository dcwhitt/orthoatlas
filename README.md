# OrthoAtlas

**Markerless Motion Assessment**

Clinic-fast browser ROM capture. OrthoAtlas runs locally; no video is uploaded or stored. Video frames are processed in memory and only high-confidence landmark-derived ROM values are retained for export.

## v3.0 changes

- Restricted the joint menu to the current working clinic set only:
  - Shoulder abduction
  - Shoulder flexion
  - Elbow flexion/extension
  - Forearm supination/pronation
  - Hip flexion/extension
  - Knee flexion/extension
  - Ankle dorsiflexion/plantarflexion
- Removed all other joint options for now.
- Added the hand model back only for forearm supination/pronation.
- Results now show the selected joint's ROM values, not a general all-joint arc grid.
- Elbow, knee, and hip use clinical convention: full extension is 0°, flexion increases from 0°.
- Recording only keeps frames with high-confidence landmark chains for the selected joint/side.
- Live overlay highlights only the selected joint and selected side.

## Run locally

```bash
npm config set registry https://registry.npmjs.org/
npm install
npm run dev
```

For a cache-safe local test:

```bash
npm run dev -- --port 5174 --strictPort
```

Open `http://localhost:5174/`.

## Build

```bash
npm run build
```

Cloudflare Pages:

- Framework preset: Vite
- Build command: `npm run build`
- Build output directory: `dist`
