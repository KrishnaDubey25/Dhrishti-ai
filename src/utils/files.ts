import type {UploadRecord} from '../types';import {uid} from '../services/db';
export async function toUpload(file:File,kind:'report'|'fundus'='report'):Promise<UploadRecord>{
 const allowed=kind==='fundus'?file.type.startsWith('image/'):(file.type.startsWith('image/')||file.type==='application/pdf');
 if(!allowed) throw new Error(kind==='fundus'?'Fundus import must be an image.':'Only PDF or image reports are supported.');
 if(file.size>750*1024) throw new Error('File is larger than the 750 KB local-development limit. Use a compressed image/PDF; production storage can replace this adapter.');
 const dataUrl=await new Promise<string>((res,rej)=>{const r=new FileReader();r.onload=()=>res(String(r.result));r.onerror=()=>rej(r.error);r.readAsDataURL(file)});
 return{id:uid('file'),name:file.name,type:file.type,size:file.size,dataUrl,uploadedAt:new Date().toISOString()}
}
