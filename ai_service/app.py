import base64, io, os
from pathlib import Path
from typing import Literal
import numpy as np
from PIL import Image, ImageEnhance, ImageFilter
from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

MODEL_REPO='manudaza/retinal-triage-efficientnetb0'
MODEL_FILE='efficientnetb0_finetuned_patched.keras'
MODEL_DIR=Path(__file__).resolve().parent/'model'
MODEL_PATH=MODEL_DIR/MODEL_FILE
LABELS=['No DR','Mild NPDR','Moderate NPDR','Severe NPDR','Proliferative DR']

app=FastAPI(title='DRISHTI-AI Trained DR Inference Service',version='2.0')
app.add_middleware(CORSMiddleware,allow_origins=['*'],allow_credentials=False,allow_methods=['GET','POST'],allow_headers=['*'])

_model=None
_keras=None

class AnalyzeRequest(BaseModel):
    right_image:str
    left_image:str
    right_quality:Literal['good','enhance','unusable']='good'
    left_quality:Literal['good','enhance','unusable']='good'

def _decode(data_url:str)->Image.Image:
    try:
        raw=data_url.split(',',1)[1] if ',' in data_url else data_url
        return Image.open(io.BytesIO(base64.b64decode(raw))).convert('RGB')
    except Exception as exc:
        raise HTTPException(400,f'Invalid fundus image: {exc}')

def _enhance(img:Image.Image)->Image.Image:
    # CLAHE on luminance + conservative unsharp mask. This improves visibility but never creates clinical findings.
    try:
        import cv2
        arr=np.asarray(img)
        lab=cv2.cvtColor(arr,cv2.COLOR_RGB2LAB)
        l,a,b=cv2.split(lab)
        clahe=cv2.createCLAHE(clipLimit=2.0,tileGridSize=(8,8))
        l2=clahe.apply(l)
        out=cv2.cvtColor(cv2.merge((l2,a,b)),cv2.COLOR_LAB2RGB)
        return Image.fromarray(out).filter(ImageFilter.UnsharpMask(radius=1.0,percent=70,threshold=3))
    except Exception:
        img=ImageEnhance.Contrast(img).enhance(1.10)
        return img.filter(ImageFilter.UnsharpMask(radius=1.0,percent=70,threshold=3))

def _fundus_quality(img:Image.Image):
    """Objective image-quality gate using image statistics. Not a clinical quality model."""
    import cv2
    rgb=np.asarray(img.resize((512,512),Image.Resampling.LANCZOS))
    gray=cv2.cvtColor(rgb,cv2.COLOR_RGB2GRAY)
    sharpness=float(cv2.Laplacian(gray,cv2.CV_64F).var())
    brightness=float(gray.mean())
    contrast=float(gray.std())
    h,w=gray.shape
    yy,xx=np.ogrid[:h,:w]; cy,cx=h/2,w/2; rad=min(h,w)*0.42
    circle=(xx-cx)**2+(yy-cy)**2 <= rad**2
    center=float(gray[circle].mean())
    corners=np.concatenate([gray[:70,:70].ravel(),gray[:70,-70:].ravel(),gray[-70:,:70].ravel(),gray[-70:,-70:].ravel()])
    corner=float(corners.mean())
    red=float(rgb[:,:,0][circle].mean()); green=float(rgb[:,:,1][circle].mean()); blue=float(rgb[:,:,2][circle].mean())
    fundus_like=(center-corner>18) and (red>green*1.05) and (red>blue*1.15) and center>45
    if not fundus_like:
        quality='unusable'; guidance='Image does not look like a gradable color fundus photograph — recapture/import required.'
    elif brightness<48 or brightness>205 or contrast<25 or sharpness<35:
        quality='unusable'; guidance='Image Ungradable — recapture required because illumination/focus/contrast is outside the quality gate.'
    elif brightness<65 or brightness>185 or contrast<38 or sharpness<75:
        quality='enhance'; guidance='Borderline fundus quality — enhancement/review recommended before analysis.'
    else:
        quality='good'; guidance='Fundus-like image with acceptable illumination, contrast and focus for model input.'
    score=int(max(0,min(100, 45 + min(sharpness,160)/5 + min(contrast,70)/3 - abs(brightness-120)/4))) if fundus_like else 15
    return {'quality':quality,'score':score,'guidance':guidance,'fundus_like':bool(fundus_like),'metrics':{'sharpness':round(sharpness,1),'brightness':round(brightness,1),'contrast':round(contrast,1)}}

def _load_model():
    global _model,_keras
    if _model is not None:return _model
    try:
        os.environ.setdefault('KERAS_BACKEND','tensorflow')
        import keras
        _keras=keras
        if MODEL_PATH.exists():
            _model=keras.saving.load_model(str(MODEL_PATH),compile=False)
        else:
            # Downloads the published trained model once, then Hugging Face caches it locally.
            _model=keras.saving.load_model(f'hf://{MODEL_REPO}',compile=False)
        return _model
    except Exception as exc:
        raise RuntimeError(f'Unable to load trained DR model: {exc}') from exc

def _prepare(img:Image.Image):
    img=img.resize((224,224),Image.Resampling.LANCZOS)
    arr=np.asarray(img,dtype=np.float32)
    # EfficientNet Keras preprocessing is intentionally identity for 0..255 RGB in recent Keras.
    return np.expand_dims(arr,0)

def _predict(img:Image.Image):
    model=_load_model()
    pred=np.asarray(model.predict(_prepare(img),verbose=0))[0].astype(float)
    if pred.ndim!=1 or len(pred)!=5: raise RuntimeError(f'Unexpected model output shape: {pred.shape}')
    # The published model has a 5-way softmax head. Normalize defensively.
    if np.any(pred<0) or not np.isclose(pred.sum(),1.0,atol=.05):
        e=np.exp(pred-np.max(pred)); pred=e/e.sum()
    grade=int(np.argmax(pred)); conf=float(pred[grade])
    return {'severity':grade,'label':LABELS[grade],'confidence':conf,'probabilities':[float(x) for x in pred]}

def _gradcam(img:Image.Image):
    try:
        import tensorflow as tf
        model=_load_model()
        conv=None
        for layer in reversed(model.layers):
            try:
                shape=layer.output.shape
                if len(shape)==4:
                    conv=layer; break
            except Exception: pass
        if conv is None:return None
        grad_model=tf.keras.models.Model(model.inputs,[conv.output,model.output])
        x=tf.convert_to_tensor(_prepare(img))
        with tf.GradientTape() as tape:
            conv_out,preds=grad_model(x,training=False)
            cls=tf.argmax(preds[0]); score=preds[:,cls]
        grads=tape.gradient(score,conv_out)
        weights=tf.reduce_mean(grads,axis=(0,1,2))
        cam=tf.reduce_sum(conv_out[0]*weights,axis=-1)
        cam=tf.maximum(cam,0); mx=tf.reduce_max(cam)
        cam=(cam/(mx+1e-8)).numpy()
        heat=Image.fromarray(np.uint8(cam*255)).resize(img.size,Image.Resampling.BILINEAR)
        # Heatmap-only grayscale avoids claiming lesion segmentation.
        buff=io.BytesIO(); heat.save(buff,format='PNG')
        return 'data:image/png;base64,'+base64.b64encode(buff.getvalue()).decode()
    except Exception:
        return None

@app.get('/health')
def health():
    try:
        _load_model()
        return {'ok':True,'model':MODEL_REPO,'classes':LABELS}
    except Exception as exc:
        raise HTTPException(503,str(exc))

@app.post('/quality-check')
async def quality_check(image: UploadFile = File(...)):
    try:
        raw=await image.read()
        img=Image.open(io.BytesIO(raw)).convert('RGB')
        return _fundus_quality(img)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(400,f'Unable to assess fundus quality: {exc}')

@app.post('/analyze')
def analyze(req:AnalyzeRequest):
    if req.right_quality=='unusable' or req.left_quality=='unusable':
        raise HTTPException(422,'Image Ungradable — Recapture Required. AI analysis is blocked.')
    right=_decode(req.right_image); left=_decode(req.left_image)
    rq=_fundus_quality(right); lq=_fundus_quality(left)
    if rq['quality']=='unusable' or lq['quality']=='unusable':
        raise HTTPException(422,{'message':'Image Ungradable / non-fundus input — recapture required.','right_quality':rq,'left_quality':lq})
    if req.right_quality=='enhance' or rq['quality']=='enhance': right=_enhance(right)
    if req.left_quality=='enhance' or lq['quality']=='enhance': left=_enhance(left)
    try:
        r=_predict(right); l=_predict(left)
    except Exception as exc:
        raise HTTPException(503,str(exc))
    overall=max(r['severity'],l['severity'])
    chosen=r if r['severity']>=l['severity'] else l
    confidence=chosen['confidence']
    return {
        'severity':overall,
        'confidence':confidence,
        'referable':overall>=2,
        'findings':[f"Right eye model grade: {r['label']}",f"Left eye model grade: {l['label']}"],
        'explanation':'Severity is produced by the trained 5-class fundus classifier for each eye; overall screening severity uses the more severe eye. Grad-CAM, when available, highlights image regions influencing the classifier and is not lesion segmentation.',
        'disclaimer':'AI Screening Recommendation from a research-trained model. It is not a standalone diagnosis and requires ophthalmologist review before clinical action.',
        'model':{'name':'Fine-tuned EfficientNetB0 DR grader','source':MODEL_REPO,'version':'published Keras checkpoint'},
        'per_eye':{'right':r,'left':l},
        'heatmaps':{'right':_gradcam(right),'left':_gradcam(left)}
    }

@app.post('/eye-check')
async def eye_check(image: UploadFile = File(...)):
    """Capture-readiness check only. This endpoint does not assess diabetic retinopathy."""
    try:
        import cv2
        raw=await image.read()
        arr=np.frombuffer(raw,dtype=np.uint8)
        frame=cv2.imdecode(arr,cv2.IMREAD_COLOR)
        if frame is None: raise ValueError('Unreadable image')
        gray=cv2.cvtColor(frame,cv2.COLOR_BGR2GRAY)
        eye_cascade=cv2.CascadeClassifier(cv2.data.haarcascades+'haarcascade_eye.xml')
        eyes=eye_cascade.detectMultiScale(gray,scaleFactor=1.1,minNeighbors=5,minSize=(36,36))
        brightness=float(gray.mean())
        sharpness=float(cv2.Laplacian(gray,cv2.CV_64F).var())
        quality_ok=45 <= brightness <= 215 and sharpness >= 45
        h,w=gray.shape[:2]
        bbox=None
        centered=False
        if len(eyes):
            x,y,ew,eh=max(eyes,key=lambda r:int(r[2])*int(r[3]))
            cx=(x+ew/2)/w; cy=(y+eh/2)/h
            # Normalized coordinates let the browser crop the final photo to the detected eye only.
            bbox={'x':round(x/w,5),'y':round(y/h,5),'w':round(ew/w,5),'h':round(eh/h,5)}
            centered=0.22 <= cx <= 0.78 and 0.20 <= cy <= 0.80
        ready=bool(len(eyes)>=1 and quality_ok and centered)
        return {'eye_detected':len(eyes)>=1,'quality_ok':quality_ok,'centered':centered,'ready':ready,'eye_count':int(len(eyes)),'eye_bbox':bbox,'brightness':round(brightness,1),'sharpness':round(sharpness,1),'purpose':'capture-readiness and eye-only crop guidance; not DR diagnosis'}
    except Exception as exc:
        raise HTTPException(400,f'Unable to assess capture frame: {exc}')
