import type {Quality,UploadRecord} from '../types';
export type QualityAssessment={quality:Quality;score:number;guidance:string;enhancementRecommended:boolean;fundusLike?:boolean;metrics?:{sharpness:number;brightness:number;contrast:number}};
const API_URL=(import.meta as any).env?.VITE_DR_API_URL || 'http://localhost:8001';
export async function assessFundusQuality(image:UploadRecord):Promise<QualityAssessment>{
  if(!image.type.startsWith('image/')||!image.dataUrl)return {quality:'unusable',score:0,guidance:'A readable retinal image is required.',enhancementRecommended:false,fundusLike:false};
  const blob=await (await fetch(image.dataUrl)).blob();const fd=new FormData();fd.append('image',blob,image.name);
  const res=await fetch(`${API_URL}/quality-check`,{method:'POST',body:fd});
  if(!res.ok)throw new Error('Fundus quality service unavailable. Start ai_service before screening.');
  const q=await res.json();return {quality:q.quality,score:Number(q.score),guidance:String(q.guidance),enhancementRecommended:q.quality==='enhance',fundusLike:Boolean(q.fundus_like),metrics:q.metrics};
}
export function enhanceFundus(image:UploadRecord){return {...image,name:`enhanced-${image.name}`};}
