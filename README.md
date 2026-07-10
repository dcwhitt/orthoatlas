# OrthoAtlas v4.2

Clinic-fast browser-based markerless motion assessment.

## v4.0 changes

- Added **All Joints** to the joint dropdown.
- All Joints overlays every currently supported joint chain at once:
  - shoulder abduction
  - shoulder flexion
  - elbow flexion/extension
  - forearm supination/pronation using the hand model
  - hip flexion/extension
  - knee flexion/extension
  - ankle dorsiflexion/plantarflexion
- Added live overlay smoothing to reduce jitter while keeping recorded ROM restricted to high-confidence green values.
- Summary/results/export logic now supports selected single-joint mode and All Joints mode.
- Desktop camera remains embedded; phone/tablet can use full-screen capture.

## Run locally

```bash
npm config set registry https://registry.npmjs.org/
npm install
npm run dev
```

## Deploy

Cloudflare Pages settings:

- Build command: `npm run build`
- Build output directory: `dist`


## v4.0 changes

- Added visible 21-point hand skeleton overlay for **Forearm supination/pronation**.
- Added visible hand overlay in **All Joints** mode.
- Added hand detection status in the live overlay badge.
- Added palm orientation cue using index MCP → pinky MCP and wrist → palm-center vectors.
- Hand overlay uses the same contain/cover mapping and front-camera mirroring as pose landmarks.
- If the hand model is not detected, the camera shows a clear prompt to show the palm, wrist, and fingers.


## v4.0 update

- Added measurement correctness/debug values panel.
- Added live capture guidance over the camera with high-confidence readiness messaging.
- Polished results card so selected-joint ROM is visually dominant.
- Updated ankle convention: neutral tibia-foot proxy = 0°, dorsiflexion positive, plantarflexion negative.
- Live overlay remains smoothed; only green/high-confidence values are recorded for ROM.


## v4.0 changes
- Live capture guidance can now be toggled on/off while the camera is active.
- Removed the bold palm-orientation bars from the hand overlay. The 21-point hand skeleton remains visible in forearm and All Joints modes.
- Hand overlay now uses a simpler wrist label only, reducing visual clutter.


## v4.0 UI cleanup

- Removed the persistent “Overlay active / hands 0/2 / green values recorded” badge from the camera overlay.
- Removed noisy hand quality labels such as “R hand poor” and “L hand poor” from the hand skeleton overlay.
- Green/yellow/red confidence still controls what is recorded; only high-confidence values are saved for ROM.
