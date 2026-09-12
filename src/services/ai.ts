import type {AIResult,Screening,Severity} from '../types';
const configured=(import.meta as any).env?.VITE_DR_API_URL as string|undefined;
const API_URL=configured||((typeof location!=='undefined'&&(location.hostname==='localhost'||location.hostname==='127.0.0.1'))?'http://localhost:8001':'');
export async function runTrainedDRModel(screening:Screening):Promise<AIResult>{
  if(screening.right.quality==='unusable'||screening.left.quality==='unusable')throw new Error('Image Ungradable — Recapture Required.');
  if(!screening.right.image?.dataUrl||!screening.left.image?.dataUrl)throw new Error('Both right and left fundus images are required.');
  if(!API_URL)throw new Error('The trained DR inference service is not connected to this deployment. Configure VITE_DR_API_URL with the separate AI backend URL. No fake clinical result was generated.');
  const res=await fetch(`${API_URL}/analyze`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({right_image:screening.right.image.dataUrl,left_image:screening.left.image.dataUrl,right_quality:screening.right.quality,left_quality:screening.left.quality})});
  const payload=await res.json().catch(()=>({}));if(!res.ok)throw new Error(payload?.detail?.message||payload?.detail||payload?.message||'Trained DR model service failed.');
  return {severity:payload.severity as Severity,confidence:Number(payload.confidence),referable:Boolean(payload.referable),findings:Array.isArray(payload.findings)?payload.findings:[],explanation:String(payload.explanation||''),disclaimer:String(payload.disclaimer||'AI Screening Recommendation — decision support only. Ophthalmologist review is required.'),simulated:false,model:{name:String(payload.model?.name||'EfficientNetB0 DR'),source:String(payload.model?.source||''),version:String(payload.model?.version||'')},perEye:payload.per_eye,heatmaps:payload.heatmaps};
}
export async function checkDRModelHealth(){if(!API_URL)throw new Error('AI backend URL is not configured');const res=await fetch(`${API_URL}/health`);if(!res.ok)throw new Error('DR model service unavailable');return res.json();}
