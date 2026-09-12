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
_quality_ensemble=None
_quality_device='cpu'

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

def _engineering_quality_metrics(img:Image.Image):
    """Secondary explainability/safety metrics. CNN gradability remains the primary quality decision."""
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
    fundus_like=(center-corner>18) and (red>green*1.03) and (red>blue*1.10) and center>40
    return {
        'sharpness':round(sharpness,1),'brightness':round(brightness,1),'contrast':round(contrast,1),
        'fundus_like':bool(fundus_like)
    }

def _load_quality_ensemble():
    global _quality_ensemble
    if _quality_ensemble is not None:
        return _quality_ensemble
    try:
        import fundus_image_toolbox as fit
        # Official pretrained 10-model ResNet/EfficientNet ensemble. Weights are downloaded/cached by the package.
        _quality_ensemble=fit.load_quality_ensemble(device=_quality_device)
        return _quality_ensemble
    except Exception as exc:
        raise RuntimeError(f'Unable to load trained fundus quality CNN ensemble: {exc}') from exc

def _cnn_fundus_quality(img:Image.Image):
    """Primary gradability gate using a pretrained CNN ensemble; engineering metrics explain borderline/reject reasons."""
    try:
        import fundus_image_toolbox as fit
        ensemble=_load_quality_ensemble()
        confs,labels=fit.ensemble_predict_quality(ensemble,[img],threshold=0.5,img_size=512)
        confidence=float(np.asarray(confs).reshape(-1)[0])
        raw_label=np.asarray(labels).reshape(-1)[0]
        if isinstance(raw_label,(np.bool_,bool)):
            gradable=bool(raw_label)
        elif isinstance(raw_label,(np.integer,int,np.floating,float)):
            gradable=bool(int(raw_label))
        else:
            gradable=str(raw_label).strip().lower() in {'1','true','good','gradable','gradeable','usable'}
    except Exception as exc:
        raise RuntimeError(f'CNN image-quality inference failed: {exc}') from exc

    metrics=_engineering_quality_metrics(img)
    # The pretrained model is binary (gradable/ungradable). We expose a conservative 3-state UI:
    # high-confidence gradable -> good; lower-confidence gradable or engineering warning -> enhance; reject -> unusable.
    severe_engineering=(not metrics['fundus_like'] or metrics['brightness']<40 or metrics['brightness']>220 or metrics['contrast']<18 or metrics['sharpness']<20)
    borderline_engineering=(metrics['brightness']<58 or metrics['brightness']>195 or metrics['contrast']<30 or metrics['sharpness']<55)
    if not gradable or severe_engineering:
        quality='unusable'
        guidance='CNN quality model considers this image ungradable, or secondary safety checks found a severe capture problem. Recapture/import a clear full-field fundus image.'
    elif confidence < 0.70 or borderline_engineering:
        quality='enhance'
        guidance='CNN considers the image gradable but confidence/capture metrics are borderline. Enhancement plus human review is recommended before DR analysis.'
    else:
        quality='good'
        guidance='CNN quality ensemble considers this fundus image gradable with acceptable secondary capture metrics.'
    return {
        'quality':quality,
        'score':int(round(max(0.0,min(1.0,confidence))*100)),
        'guidance':guidance,
        'fundus_like':bool(metrics['fundus_like']),
        'metrics':{k:v for k,v in metrics.items() if k!='fundus_like'},
        'cnn':{
            'gradable':gradable,
            'confidence':round(confidence,4),
            'threshold':0.5,
            'architecture':'10-model ResNet + EfficientNet ensemble',
            'training_data':['DeepDRiD','DrimDB'],
            'source':'berenslab/fundus_image_toolbox'
        },
        'decision_source':'trained_cnn_ensemble_with_secondary_safety_metrics'
    }

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
        _load_quality_ensemble()
        return {'ok':True,'dr_model':MODEL_REPO,'quality_model':'berenslab/fundus_image_toolbox 10-model CNN ensemble','classes':LABELS}
    except Exception as exc:
        raise HTTPException(503,str(exc))

@app.post('/quality-check')
async def quality_check(image: UploadFile = File(...)):
    try:
        raw=await image.read()
        img=Image.open(io.BytesIO(raw)).convert('RGB')
        return _cnn_fundus_quality(img)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(400,f'Unable to assess fundus quality: {exc}')

@app.post('/analyze')
def analyze(req:AnalyzeRequest):
    if req.right_quality=='unusable' or req.left_quality=='unusable':
        raise HTTPException(422,'Image Ungradable — Recapture Required. AI analysis is blocked.')
    right=_decode(req.right_image); left=_decode(req.left_image)
    rq=_cnn_fundus_quality(right); lq=_cnn_fundus_quality(left)
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
        'quality_assessment':{'right':rq,'left':lq},
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
        eyes=eye_cascade.detectMultiScale(gray,scaleFactor=1.1,minNeighbors=5,minSize=(24,24))
        brightness=float(gray.mean())
        sharpness=float(cv2.Laplacian(gray,cv2.CV_64F).var())
        quality_ok=45 <= brightness <= 215 and sharpness >= 45
        return {'eye_detected':len(eyes)>=1,'quality_ok':quality_ok,'eye_count':int(len(eyes)),'brightness':round(brightness,1),'sharpness':round(sharpness,1),'purpose':'capture-readiness only; not DR diagnosis'}
    except Exception as exc:
        raise HTTPException(400,f'Unable to assess capture frame: {exc}')
