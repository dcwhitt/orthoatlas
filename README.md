# OrthoAtlas v3.9

Clinic-fast browser-based markerless motion assessment.

## v3.9 changes

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


## v3.9 changes

- Added visible 21-point hand skeleton overlay for **Forearm supination/pronation**.
- Added visible hand overlay in **All Joints** mode.
- Added hand detection status in the live overlay badge.
- Added palm orientation cue using index MCP → pinky MCP and wrist → palm-center vectors.
- Hand overlay uses the same contain/cover mapping and front-camera mirroring as pose landmarks.
- If the hand model is not detected, the camera shows a clear prompt to show the palm, wrist, and fingers.


## v3.9 update

- Added measurement correctness/debug values panel.
- Added live capture guidance over the camera with high-confidence readiness messaging.
- Polished results card so selected-joint ROM is visually dominant.
- Updated ankle convention: neutral tibia-foot proxy = 0°, dorsiflexion positive, plantarflexion negative.
- Live overlay remains smoothed; only green/high-confidence values are recorded for ROM.


## v3.9 changes
- Live capture guidance can now be toggled on/off while the camera is active.
- Removed the bold palm-orientation bars from the hand overlay. The 21-point hand skeleton remains visible in forearm and All Joints modes.
- Hand overlay now uses a simpler wrist label only, reducing visual clutter.
