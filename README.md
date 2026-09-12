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
