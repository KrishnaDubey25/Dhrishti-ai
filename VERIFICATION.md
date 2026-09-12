# DRISHTI-AI PHC Extraction + Fundus Quality Fix

## Fixed in this build
- Diabetes-report OCR now supports table-style lab reports and common OCR variants such as `HbA Ic`.
- Auto-captures a full measurement table (parameter, measured value, unit, reference range, OCR confidence).
- Key diabetes fields are still auto-filled separately for PHC review: HbA1c, fasting glucose, BP, cholesterol, creatinine and other supported values.
- FBG in mmol/L is preserved and also converted approximately to mg/dL for context.
- HbA1c OCR values such as `64` next to decimal reference ranges are cautiously normalized to `6.4%` with reduced extraction confidence.
- Browser-only fundus pre-check no longer hard-rejects ordinary fundus exports just because color/focus heuristics are atypical.
- Blank/extremely exposed/very low-resolution fundus uploads remain blocked.
- Trained CNN remains the primary gradability gate when the AI backend is connected.
- PDF.js worker uses the locally copied `/public/pdfjs/pdf.worker.min.mjs` asset to avoid the previous Vite `?url` build failure.

## Static checks
- All `src/**/*.ts` and `src/**/*.tsx` files transpile with 0 syntax diagnostics using TypeScript transpileModule.
- `ai_service/app.py` passes `python -m py_compile`.

## Medical safety
OCR values must be reviewed against the source document. Browser image quality is a pre-check, not a clinical gradability model. DR severity is generated only by the trained fundus model service and still requires clinician review.
