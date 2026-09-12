# DRISHTI-AI — Truth-First Premium UX Update

## Changes in this build

- Patient questionnaire medical-report upload is explicitly optional and never blocks completion.
- Patient PHC booking no longer requires a report or a "continue without report" checkbox.
- PHC medical/diabetes report is optional and no longer blocks bilateral retinal AI analysis.
- PHC AI processing stages now correspond to real operations:
  1. backend health check
  2. right/left fundus quality re-check
  3. trained per-eye DR model inference
  4. structured clinical report generation
- Removed artificial timeout-based PHC analysis stages.
- Patient home retinal analysis now requires separate right and left fundus images; it no longer duplicates one image into both eyes.
- Patient fundus images go through the real quality service before trained model inference.
- External-eye preliminary scan no longer uses artificial delay steps; progress advances with actual pixel scan, risk calculation and report generation.
- Added premium UI polish for portal cards, sidebar, controls, tables, optional-report states, bilateral fundus uploads and real analysis pipeline visualization.
- Existing routes, auth roles, patient/PHC/doctor portals, OCR/report extraction, booking storage, specialist review, referral and video consultation flows remain in place.

## Clinical boundary

DRISHTI-AI remains screening/triage decision support. Model confidence is not accuracy. Final diagnosis and management remain with a qualified ophthalmologist.
