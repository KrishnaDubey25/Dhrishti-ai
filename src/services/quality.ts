import type {Quality,UploadRecord} from '../types';
export type QualityAssessment={quality:Quality;score:number;guidance:string;enhancementRecommended:boolean;fundusLike?:boolean;metrics?:{sharpness:number;brightness:number;contrast:number};cnn?:{gradable:boolean;confidence:number;threshold:number;architecture:string;training_data:string[];source:string};decisionSource?:string};
const configured=(import.meta as any).env?.VITE_DR_API_URL as string|undefined;
const API_URL=configured||((typeof location!=='undefined'&&(location.hostname==='localhost'||location.hostname==='127.0.0.1'))?'http://localhost:8001':'');
async function browserPrecheck(image:UploadRecord):Promise<QualityAssessment>{
  if(!image.dataUrl)return {quality:'unusable',score:0,guidance:'No image data was available.',enhancementRecommended:false,decisionSource:'browser-precheck'};
  const img=new Image();img.src=image.dataUrl;await img.decode();
  if(img.naturalWidth<160||img.naturalHeight<160)return {quality:'unusable',score:15,guidance:'Image resolution is too small for retinal screening. Import the original fundus-camera export.',enhancementRecommended:false,decisionSource:'browser-precheck'};
  const c=document.createElement('canvas');c.width=320;c.height=320;const x=c.getContext('2d',{willReadFrequently:true})!;x.drawImage(img,0,0,320,320);const d=x.getImageData(0,0,320,320).data;
  let sum=0,sum2=0,grad=0,n=0,prev=0,red=0,green=0,blue=0,dark=0,bright=0;
  for(let i=0;i<d.length;i+=4){const y=.299*d[i]+.587*d[i+1]+.114*d[i+2];sum+=y;sum2+=y*y;if(n%320!==0)grad+=Math.abs(y-prev);prev=y;red+=d[i];green+=d[i+1];blue+=d[i+2];if(y<18)dark++;if(y>245)bright++;n++}
  const brightness=sum/n,contrast=Math.sqrt(Math.max(0,sum2/n-brightness*brightness)),sharpness=grad/Math.max(1,n-1),darkRatio=dark/n,brightRatio=bright/n;
  const r=red/n,g=green/n,b=blue/n;const redDominant=r>g*1.02&&r>b*1.08;const obviouslyBlank=(contrast<5)||(brightRatio>.96)||(darkRatio>.96)||(brightness<8)||(brightness>250);
  if(obviouslyBlank)return {quality:'unusable',score:20,guidance:'The imported image is nearly blank/fully dark/fully overexposed. Re-export or recapture the fundus image.',enhancementRecommended:false,fundusLike:redDominant,metrics:{sharpness,brightness,contrast},decisionSource:'browser-precheck'};
  const rawScore=Math.round(52+Math.min(22,contrast*.32)+Math.min(13,sharpness*.9)+(redDominant?8:0)-Math.min(12,Math.abs(brightness-115)*.07));const score=Math.max(45,Math.min(92,rawScore));
  const quality:Quality=(redDominant&&contrast>=20&&sharpness>=2.2&&brightness>=28&&brightness<=225)?'good':'enhance';
  const guidance=quality==='good'
    ?'Image loaded and browser capture checks are acceptable. The trained CNN quality service should still confirm gradability before clinical inference.'
    :'Image loaded. Browser checks found a borderline/non-confirmed fundus pattern, but this pre-check will not falsely reject it. The trained CNN quality gate will make the clinical gradability decision when the AI backend is connected.';
  return {quality,score,guidance,enhancementRecommended:quality==='enhance',fundusLike:redDominant,metrics:{sharpness,brightness,contrast},decisionSource:'browser-precheck'};
}
export async function assessFundusQuality(image:UploadRecord):Promise<QualityAssessment>{
  if(!image.type.startsWith('image/')||!image.dataUrl)return {quality:'unusable',score:0,guidance:'A readable retinal image is required.',enhancementRecommended:false,fundusLike:false,decisionSource:'validation'};
  if(!API_URL)return browserPrecheck(image);
  try{const blob=await (await fetch(image.dataUrl)).blob();const fd=new FormData();fd.append('image',blob,image.name);const res=await fetch(`${API_URL}/quality-check`,{method:'POST',body:fd});if(!res.ok)throw new Error('quality service returned an error');const q=await res.json();return {quality:q.quality,score:Number(q.score),guidance:String(q.guidance),enhancementRecommended:q.quality==='enhance',fundusLike:Boolean(q.fundus_like),metrics:q.metrics,cnn:q.cnn,decisionSource:q.decision_source||'trained-cnn'};}catch(e){console.warn('CNN quality service unavailable; using browser pre-check.',e);return browserPrecheck(image)}
}
export function enhanceFundus(image:UploadRecord){return {...image,name:`enhanced-${image.name}`};}
