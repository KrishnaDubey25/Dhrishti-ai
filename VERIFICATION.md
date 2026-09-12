# DRISHTI-AI Verification Notes

- PHC Today’s Bookings page now filters to the current day.
- Appointment detail shows patient identity, contact/profile information, diabetes history, eye history, symptoms, preliminary patient-side risk, and attached patient reports.
- Detailed fundus workspace requires Right + Left fundus images.
- Fundus images pass through the existing quality service / trained CNN quality gate; unusable images hard-block DR inference.
- Diabetes/medical report upload is required for the detailed PHC report workflow.
- PHC staff must verify the structured clinical values used in the contextual report.
- AI grade remains fundus-model-derived; systemic values add risk/follow-up context and do not overwrite retinal severity.
- Detailed report stores per-eye grade, confidence, image quality, systemic context, recommendation, priority, limitations, and is downloadable as PDF.
- Report is submitted to the existing ophthalmologist review workflow.
- `ai_service/app.py` Python compile check passed.
- Modified TS/TSX parse check found no non-import diagnostics after fixes.
- Full npm dependency install could not be completed in the build sandbox because registry installation timed out; run `npm install && npm run build` locally before deploy.
