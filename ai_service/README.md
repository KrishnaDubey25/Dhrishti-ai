# DRISHTI-AI inference service

FastAPI service for three separate tasks:

1. **Eye capture readiness** (`POST /eye-check`) — OpenCV eye detection + brightness/sharpness checks for the patient camera UI. This does NOT assess diabetic retinopathy.
2. **Fundus image quality gate** (`POST /quality-check`) — objective sharpness, illumination, contrast and fundus-like field checks. It is a safety/engineering gate, not a certified clinical quality model.
3. **Trained DR screening inference** (`POST /analyze`) — 5-class EfficientNetB0 model from `manudaza/retinal-triage-efficientnetb0`. Backend re-checks fundus quality and rejects non-fundus/ungradable inputs before inference.

Run:

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app:app --host 0.0.0.0 --port 8001
```

The DR model is a research/triage model, not a diagnostic medical device. See the root README for model-card metrics, limitations and licensing notes.
