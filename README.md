# DRISHTI-AI

Premium three-role diabetic-retinopathy screening and referral workflow:

**Patient -> PHC Center -> Retina Specialist / Ophthalmologist**

This codebase is intentionally human-in-the-loop. AI output is screening decision support; final clinical assessment remains with a qualified ophthalmologist.

## Patient flow
1. Create patient profile with identity/contact details.
2. Complete first-login health/risk questionnaire.
3. Go directly to Guided Eye Capture.
4. Start camera: align one eye in oval -> green readiness -> buzzer -> visible 3-2-1 -> automatic eye-area crop. Manual capture and Test sound are available.
5. See questionnaire-based screening urgency/next step.
6. If a real fundus image is available, submit it to the trained retinal model; otherwise use live PHC discovery and booking.
7. View screenings, finalized specialist results, reports, referrals, care plan and remote-consult updates.

The normal webcam/external-eye photo is never treated as a retinal image and is never used to diagnose/grade DR.

## Live PHC discovery
The patient can grant browser geolocation permission. Nearby mapped healthcare centres are retrieved live from OpenStreetMap/Overpass and sorted by distance. Only PHCs registered inside DRISHTI can receive an in-app appointment.

PHC center registration supports center coordinates so nearby public facilities can be matched to DRISHTI-connected workspaces.

## PHC workflow
Appointment -> registration -> right/left fundus import -> image-quality gate -> observations -> trained DR analysis -> specialist queue.

Quality cannot be manually forced to Good. When the Python AI backend is connected, the trained CNN quality ensemble is the primary quality decision. If it is unavailable, the browser may provide a clearly-labelled capture pre-check only; no fake CNN result is claimed.

## Retina Specialist workflow
Review patient history, fundus images, quality, AI severity/confidence/Grad-CAM when available, then confirm/modify severity, enter clinical notes, referral/follow-up and finalize the report. Longitudinal care plans include clinician-entered medicines/treatment instructions, diet, routine, monitoring, precautions and goals.

## Frontend setup
```bash
npm install
npm run dev
```

Build:
```bash
npm run build
```

## AI backend (separate service)
The Python service is intentionally separate from the Vercel frontend because TensorFlow/CNN dependencies are large.

```bash
cd ai_service
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app:app --host 0.0.0.0 --port 8001
```

Local frontend uses `http://localhost:8001` automatically. For a deployed frontend, configure:

```env
VITE_DR_API_URL=https://YOUR-AI-BACKEND
```

No trained DR result is fabricated when the backend is not connected.

## Vercel frontend
`.vercelignore` excludes `ai_service` from the frontend function bundle and `vercel.json` handles React SPA routes.

```bash
npm install
npm run build
vercel --prod --force
```

See `VERIFICATION.md` for checks and known environment limitations.


## Patient report flow
After guided eye capture, DRISHTI-AI now automatically generates and saves a **Preliminary Screening Report** containing only patient-entered health context, questionnaire-based screening urgency, capture status, and the recommended next step. It is clearly labelled as non-diagnostic. If a real fundus image is analyzed by the configured trained DR backend, a separate **AI Retinal Screening Report** is generated with severity, referable status, model confidence, and explanation. Both generated PDFs appear in the Patient Reports area.

## Patient advanced eye-capture flow

The patient flow after the health questionnaire is:

1. Start camera (HTTPS + browser camera permission required).
2. Place only one eye inside the oval guide.
3. MediaPipe eye landmarks are used when available; a guided fallback keeps the workflow usable if the detector CDN/model is unavailable.
4. When alignment is stable the frame turns green, a high two-tone buzzer sounds, then a visible 3 → 2 → 1 countdown runs.
5. The saved image is cropped to the eye region; full-face frames are not used as the screening image.
6. A shutter tone confirms capture, followed by an animated scan/processing stage.
7. The patient receives a **Preliminary Screening Urgency** result (Low / Moderate / High / Critical), a triage-index donut chart, external-eye image-quality score, reasons, next action, and downloadable PDF report.
8. Live nearby health centres can be discovered with browser geolocation; DRISHTI-connected PHCs can be booked from the booking workflow.
9. A real retinal/fundus image can optionally be uploaded for the trained DR model. The external-eye camera photo is never sent to the DR classifier.

### Important clinical boundary

The normal phone/laptop camera image cannot visualize the retina and therefore is **not used to diagnose diabetic retinopathy**. Patient-side Low/Moderate/High/Critical is a screening-urgency category derived primarily from the entered health/risk context. The eye photo contributes eye-presence/alignment and external-image-quality evidence only. A PHC fundus image is required for retinal model screening, followed by ophthalmologist review for the final clinical assessment.

## Camera reliability update
- Auto-capture now requires MediaPipe eye-landmark tracking; guided fallback never blind-auto-captures.
- The eye must remain stable before and throughout the 3-2-1 countdown. Center drift or eye-size change cancels the countdown and returns to alignment mode.
- Start Camera unlocks the Web Audio context; a dedicated Enable / test sound control verifies buzzer audio. The auto sequence uses a loud double buzzer, per-count tone, vibration where supported, and a synthesized shutter effect.
- The captured crop is tighter around one eye. Manual capture remains available as a guided fallback.
- After capture, the app actually scans the saved crop pixels for brightness, contrast, sharpness/detail, glare and dark-area ratio before generating the report.
- The post-capture Low / Moderate / High / Critical category is a screening-urgency result from Q&A after image-quality verification, not a retinal diagnosis.
- LOW: no urgent PHC recommendation is shown. The UI gives the next DRISHTI self-check interval (6 months when diabetes is present/uncertain, otherwise 12 months) and keeps routine retinal-screening guidance separate.
- MODERATE/HIGH/CRITICAL: PHC/clinical next steps and nearby PHC discovery are shown.
