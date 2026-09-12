# DRISHTI-AI verification

- PHC dual-source flow present: diabetes report extraction + bilateral fundus analysis + detailed report.
- PDF text extraction is preferred; OCR is fallback for scanned PDF/image reports.
- Auto-captured diabetes fields are stored with extraction confidence and remain editable.
- Fundus image quality remains a hard gate; ungradable images block DR inference.
- Diabetes values do not change/fabricate retinal model severity.
- Detailed clinical rows that were not actually measured remain `Not performed / not entered`.
- Modified TypeScript/TSX files were syntax-transpiled with the TypeScript compiler: 0 syntax diagnostics.
- Full dependency-resolved Vite build could not complete in the generation environment because npm installation timed out; run `npm install && npm run build` locally before deployment.
