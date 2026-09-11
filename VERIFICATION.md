# DRISHTI-AI — Verification Notes

## Checks completed in this build workspace

- Python inference service syntax check: **PASS** (`python -m py_compile`).
- TypeScript application structural/type pass with local external-package declaration stubs: **PASS**, after fixing application-level errors.
- Route scan confirms Patient / PHC / Retina Specialist role portals and protected route groups.
- Shared persistent workflow: patient booking → PHC appointment → fundus screening → trained-model result → specialist review → final result/referral.
- New connected data objects: care plan, consultation and follow-up-ready models.
- Patient webcam path is explicitly separated from retinal inference.
- Fundus analysis requires retinal image data.
- Pixel-based fundus quality gate checks sharpness, illumination, contrast and a fundus-like field before inference.
- The inference backend independently re-checks image gradability/non-fundus input; frontend state cannot bypass the gate.
- Ungradable image blocks trained-model analysis.
- Patient report is optional during booking, matching the revised workflow.
- PHC tele-ophthalmology consultation can be scheduled and is visible to specialist/patient workflows.
- Specialist care plan supports medicines, diet, routine, monitoring, precautions and goals; these fields are clinician-entered, not AI-generated.
- No Admin portal was added.

## Environment limitation

The workspace could not complete `npm install` because the package registry request timed out, so a real Vite production bundle could not be executed here. The source tree passed a TypeScript structural check using temporary dependency stubs; those stubs are **not included** in the final project.

On a networked development machine run:

```bash
npm install
npm run build
```

Then run the Python service separately as described in README.

## Clinical/model limitation

The wired trained model is a research/triage model trained on APTOS 2019. It is not a certified diagnostic device and is not 100% accurate. Its model card notes unverified performance across different populations/camera types. The application therefore always separates **AI Screening Recommendation** from **Ophthalmologist Final Assessment**.

## Eye camera upgrade verification
- Backend `/eye-check` now returns eye bounding-box, centering, brightness, sharpness and a single `ready` signal.
- Frontend requires stable green state before auto-capture.
- Beep + 3/2/1 sequence implemented with Web Audio.
- Countdown cancels if readiness is lost.
- Auto capture uses detected eye crop; manual capture uses central eye-guide crop.
- Python backend compile check passed after this change.
- Full TypeScript build could not be executed in this sandbox because npm dependencies are not installed; global `tsc` reports missing React/router packages rather than an application-specific compile result.

## Camera flow revision
- Removed deployed-camera dependence on localhost `/eye-check` for green readiness.
- Added browser-side MediaPipe eye/face landmark tracking.
- First-login quiz completion now redirects directly to the eye-capture route.
- Auto-capture requires stable green readiness and uses beep + 3-2-1 countdown.
- Manual capture remains available and saves a central/detected eye crop rather than the whole frame.
- Dependency installation/build could not be completed in this environment because npm install timed out; run `npm install && npm run build` locally before deployment.
