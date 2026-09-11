# DRISHTI-AI — Connected Diabetic Retinopathy Screening Platform

Production-style React/Vite/TypeScript prototype for a three-role retinal screening pathway:

**Patient → PHC Center → Trained DR screening model → Retina Specialist/Ophthalmologist → care plan / referral / follow-up**

## What is implemented

### Public / login experience
- Premium healthcare landing/login experience with the solution explained through the workflow.
- Three workspaces only: **Patient**, **PHC Center**, **Retina Specialist**.
- Watch Demo remains separate from real user-created records.

### Patient
- Account creation and persistent profile.
- First-login health questionnaire.
- Evidence-informed **screening urgency** layer based on established DR risk factors such as known diabetes, duration, HbA1c when known, systolic BP, previous DR/retinal history and current visual symptoms.
- The risk layer intentionally does **not** claim to be a validated personal disease probability.
- Live browser camera with positioning UI, red/green state and 3-second auto-capture when the local capture-readiness service detects an eye and acceptable image quality.
- Manual capture fallback.
- Important: external-eye webcam images are **not** used for DR diagnosis.
- Fundus-image upload can call the trained retinal classifier.
- Registered PHC discovery and date/time booking.
- Existing diabetes/eye report upload is optional; patient can explicitly continue without a report.
- Final specialist-reviewed results, referrals, care plan and video consultation visibility.

### PHC Center
- Center-based registration.
- Appointments, walk-in patient registration and shared patient record.
- Right/left fundus-image screening workspace.
- JPEG/PNG import today; adapter boundary is designed for DICOM/filesystem/device-specific integrations.
- Quality gate: good / enhance / unusable. Ungradable images block AI analysis.
- Structured retinal observations and staff notes.
- Trained 5-class DR inference, confidence and Grad-CAM when available.
- Referral coordination.
- Remote retina-specialist video consultation scheduling.

### Retina Specialist / Ophthalmologist
- Pending review queue and priority cases.
- Patient history, fundus images, PHC observations, AI grade, confidence and Grad-CAM.
- Confirm or modify AI severity/referability.
- Final clinical notes, referral and follow-up.
- Longitudinal patient view.
- Specialist-entered medicines/treatment instructions, diet, routine, monitoring, precautions and goals.
- Remote video consultation workflow.

## Trained retinal model

The included inference service is wired for the public Hugging Face model:

`manudaza/retinal-triage-efficientnetb0`

- EfficientNetB0, 5-class ICDR-style DR severity grading.
- 224×224 RGB fundus photographs.
- Trained on APTOS 2019 (3,662 labelled fundus images).
- Model card reports validation QWK 0.7987, Grade 0 recall 0.952, Grade 3 recall 0.690 and Grade 4 recall 0.455.
- Model card explicitly states it is a **triage assistant, not a diagnostic device** and that performance on other populations/camera types is unverified.
- License shown by the model repository: **CC BY-NC 4.0**. Confirm licensing before any commercial deployment.

The service can load the model through Keras `hf://...` support or a local `.keras` checkpoint.

## Why normal webcam photos do not diagnose DR

Diabetic retinopathy is assessed from the retina/fundus. A normal laptop/phone camera looking at the external eye does not provide a clinical retinal photograph. DR image inference is therefore enabled only for a true fundus image. The webcam workflow is limited to capture readiness / positioning.

## Fundus camera integration

Real devices vary. Common integration patterns include:
- USB/file export
- Wi-Fi transfer on portable devices
- JPEG/PNG export
- DICOM / DICOM Web / PACS integration
- vendor SDK/API

The UI therefore uses a `camera/import adapter` boundary instead of pretending every fundus camera supports Bluetooth. Replace it with the actual device SDK or DICOM route used by the target PHC.

## Run frontend

```bash
npm install
npm run dev
```

## Run trained-model / capture-readiness service

```bash
cd ai_service
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app:app --host 0.0.0.0 --port 8001
```

The first model load can download the published checkpoint from Hugging Face if it is not already cached.

## Prototype telemedicine

Video consultation links currently use a replaceable Jitsi-room adapter. For real healthcare deployment, connect an organization-approved telemedicine solution with appropriate privacy, consent, retention, encryption and local regulatory controls.

## Data / security boundary

This runnable prototype uses browser localStorage for workflow persistence and mock local authentication. Do **not** use this storage/auth adapter for real patient health information. Production deployment needs a secure backend, encrypted storage, verified identities, access logs, consent handling, retention controls and applicable healthcare/privacy compliance.

## Clinical safety boundary

DRISHTI-AI must be described as screening / decision support. It does not provide a 100% guarantee. No clinically responsible AI system can promise perfect diagnostic accuracy across all patients, camera types and image conditions. Final diagnosis/treatment decisions belong to a qualified clinician.


## Eye-only guided camera capture
- Patient camera detects an eye for capture readiness only; it does **not** diagnose diabetic retinopathy from an external-eye photo.
- When one eye is centered with acceptable brightness/sharpness for two consecutive checks, the guide turns green, a short beep sounds, and a 3 → 2 → 1 auto-capture begins.
- If alignment is lost during the countdown, auto-capture is cancelled.
- Auto-capture crops around the detected eye instead of storing the full camera frame.
- Manual capture is always available and saves the central eye-guide crop.
- Actual DR inference remains restricted to compatible retinal/fundus images.

## Patient camera flow (updated)
- After first-login health quiz completion, the patient is redirected directly to `/patient/eye-capture`.
- Eye readiness runs in-browser with MediaPipe Face Landmarker; it no longer depends on `http://localhost:8001/eye-check` for the green capture state.
- The guide becomes green only when one eye is centered, at a usable distance, with acceptable lighting and frame sharpness, and held stable.
- On stable green: beep -> 3 -> 2 -> 1 -> automatic eye-area crop capture.
- Manual capture and retake remain available.
- This external-eye capture is positioning/capture support only; DR grading still requires a true retinal/fundus image.
