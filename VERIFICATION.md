# DRISHTI-AI Verification

## Patient production pass
- Gmail-only patient registration: implemented at UI and data-service layers.
- Strong password rules: 10+ chars, uppercase, lowercase, number, special character, confirm password.
- Required patient identity fields: implemented.
- Mandatory first-login Q&A: implemented; skip removed.
- Previous report upload: optional.
- Left/right eye selection: retained and separately persisted.
- Camera/upload pixel-quality scan: retained.
- Poor-quality image retake gate: implemented; preliminary guidance/report is blocked for `Retake recommended` images.
- Longer post-capture scan pipeline: implemented (~5+ seconds before final result under normal browser timing).
- Low-risk follow-up interval without urgent PHC recommendation: retained.
- Patient premium auth/onboarding/profile UI: implemented.

## Static QA performed in this environment
- TypeScript/TSX syntax/transpile check: 20 files, 0 errors.
- Python AI service `py_compile`: passed.
- Old `setFont(undefined, ...)` regression: absent.
- `Skip for now` onboarding bypass: absent.

## Environment limitation
A full dependency-resolved `npm run build` could not be completed in the assistant environment because `npm install` timed out while accessing the package registry. Run `npm install && npm run build` on the target machine before deployment.

## Clinical boundary
The external-eye camera flow performs capture guidance and real image-quality analysis. It does not detect retinal lesions or claim a diabetic-retinopathy diagnosis. Actual DR grading remains tied to fundus/retinal imaging and clinician review.
