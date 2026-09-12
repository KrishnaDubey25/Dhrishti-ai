# DRISHTI-AI verification notes

## Consolidated workflow in this edition
- Patient account -> first-login health questionnaire -> guided eye capture -> screening guidance -> live PHC discovery/booking.
- Guided capture uses a deterministic camera state machine: camera permission -> preview -> detector loading -> MediaPipe eye lock when available -> transparent guided fallback when unavailable -> green hold -> audible countdown -> auto capture. Manual capture and Test sound are always available while the camera is active.
- External-eye capture is never used for DR grading. Real DR grading requires a fundus/retinal image.
- Live nearby healthcare discovery uses browser geolocation + OpenStreetMap/Overpass. In-app booking is restricted to DRISHTI-registered PHCs.
- PHC registration can save center GPS coordinates for nearby matching.
- PHC fundus workflow stores right/left images, model/pre-check driven quality, clinical observations and screening records.
- The Python AI service includes the trained fundus-quality CNN ensemble integration and the trained 5-class DR model adapter. Ungradable images block DR inference.
- Doctor workspace separates AI recommendation from final ophthalmologist assessment and supports referral, follow-up, care plans and video-consultation handoff.
- SPA Vercel routing is configured with vercel.json. Heavy Python AI service is excluded from the Vercel frontend bundle via .vercelignore and must be deployed separately for trained-model inference.

## Static checks run in the artifact workspace
- All 20 TypeScript/TSX source files were parsed/transpiled with the TypeScript compiler API: 0 syntax diagnostics.
- `python3 -m py_compile ai_service/app.py`: passed.
- Recurring jsPDF `setFont(undefined, ...)` build issue removed from PatientPortal and DoctorPortal.
- Old generic camera error text removed.
- Vercel SPA rewrite and `.vercelignore` included.

## Environment limitation
The artifact environment cannot currently complete `npm install` from npm registry, so a real dependency-resolved `npm run build` could not be executed here. Run `npm install && npm run build` locally before deployment. The source-level syntax pass above is not a substitute for the final dependency-resolved build.

## Production AI requirement
The Vercel frontend deliberately does not invent clinical outputs if `VITE_DR_API_URL` is absent. Configure it to the separately deployed AI backend. Browser-side quality fallback is explicitly labelled as a pre-check and is not presented as the trained CNN.

- Camera capture now creates a persisted Preliminary Screening Report PDF and exposes it immediately after capture and in Patient > Reports.
- Real fundus model analysis creates a separate AI Retinal Screening Report PDF; external-eye camera captures are never treated as retinal DR diagnoses.
