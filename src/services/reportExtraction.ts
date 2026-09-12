import * as pdfjsLib from 'pdfjs-dist';
import {createWorker} from 'tesseract.js';
import type {ClinicalExtractionKey,DiabetesReportAnalysis,ExtractedClinicalField,ExtractedMeasurement} from '../types';

(pdfjsLib.GlobalWorkerOptions as any).workerSrc='/pdfjs/pdf.worker.min.mjs';

const normalize=(s:string)=>s.replace(/\u00a0/g,' ').replace(/[\t ]+/g,' ').replace(/\r/g,'\n').replace(/\n{3,}/g,'\n\n').trim();
const clamp=(n:number,a=0,b=100)=>Math.max(a,Math.min(b,n));
const num=(s:string)=>Number(String(s).replace(',','.').replace(/[^0-9.\-]/g,''));
function snippet(text:string,index:number,len=150){const a=Math.max(0,index-55),b=Math.min(text.length,index+len);return normalize(text.slice(a,b)).replace(/\n/g,' ')}
function put(fields:Partial<Record<ClinicalExtractionKey,ExtractedClinicalField>>,key:ClinicalExtractionKey,value:string,confidence:number,text:string,index:number){if(!value||fields[key])return;fields[key]={value:value.trim(),confidence:clamp(confidence),sourceSnippet:snippet(text,index)}}
function match(text:string,re:RegExp){const m=re.exec(text);return m?{m,index:m.index}:null}

const canonicalRows:[string,RegExp][]=[
  ['Blood pressure',/^(?:blood\s*pressure|\bbp\b)/i],
  ['Pulse rate',/^pulse(?:\s*rate)?/i],
  ['Body temperature',/^(?:axillary\s+)?(?:body\s+)?temperature/i],
  ['Fasting blood glucose (FBG)',/^(?:fbg|fbs|fasting\s+(?:blood\s+)?(?:glucose|sugar))/i],
  ['HbA1c',/^(?:hba\s*[1il]\s*c|hb\s*a\s*[1il]\s*c|glycated\s+h(?:a|e)emoglobin|glycosylated\s+h(?:a|e)emoglobin)/i],
  ['WBC',/^(?:wbc|white\s+blood\s+cell)/i],
  ['RBC',/^(?:rbc|red\s+blood\s+cell)/i],
  ['Hemoglobin',/^(?:hb\b|hgb\b|haemoglobin|hemoglobin)/i],
  ['Platelets',/^(?:plt\b|platelets?)/i],
  ['PCV / Hematocrit',/^(?:pcv\b|hematocrit|haematocrit|hct\b)/i],
  ['CRP',/^(?:crp\b|c[- ]?reactive\s+protein)/i],
  ['Prothrombin time',/^(?:pt\s*\(?(?:s|sec|seconds?)\)?\b|prothrombin\s+time)/i],
  ['PT%',/^(?:pt\s*%|pt%)/i],
  ['Total cholesterol',/^(?:total\s+cholesterol|cholesterol\s*[-:]?\s*total|cholesterol\b)/i],
  ['LDL cholesterol',/^ldl\b/i],
  ['HDL cholesterol',/^hdl\b/i],
  ['Triglycerides',/^(?:triglycerides?|tg\b)/i],
  ['Creatinine',/^(?:serum\s+)?creatinine/i],
  ['eGFR',/^e\s*gfr\b/i],
  ['Urea / BUN',/^(?:urea|bun\b|blood\s+urea)/i],
];

function cleanOcrLine(line:string){return line.replace(/[“”]/g,'"').replace(/[′’`]/g,"'").replace(/[ᵃª]/g,'').replace(/\s+/g,' ').trim()}
function rowNumbers(line:string){
  const out:string[]=[]; const re=/[<>]?\s*\d+(?:[.,]\d+)?(?:\s*\/\s*\d+(?:[.,]\d+)?)?/g; let m:RegExpExecArray|null;
  while((m=re.exec(line))!==null){const before=line.slice(Math.max(0,m.index-4),m.index).toLowerCase(); if(/10\s*\^?$/.test(before))continue; out.push(m[0].replace(/\s+/g,''));}
  return out;
}
function unitFromLine(line:string){
  const m=line.match(/\(([^)]{1,22})\)/); if(!m)return '';
  const u=m[1].trim(); if(/^10/i.test(u))return u; return u;
}
function normalizeHba1c(raw:string,reference:string){
  let v=num(raw); if(!Number.isFinite(v))return raw;
  if(v>20&&v<200&&!raw.includes('.')&&/[.]/.test(reference)){v=v/10;return `${v.toFixed(1)}%`}
  return `${v}${raw.includes('%')?'':'%'}`;
}
function normalizeKnownMeasurement(name:string,raw:string,reference:string){
  const cleaned=raw.replace(/[<>]/g,'').trim();let v=num(cleaned);if(!Number.isFinite(v))return raw;
  if(name==='HbA1c')return normalizeHba1c(cleaned,reference);
  if(name==='PCV / Hematocrit'&&v>100&&v<1000&&!cleaned.includes('.'))return (v/10).toFixed(1);
  if(name==='CRP'&&/^0\d$/.test(cleaned)&&reference.includes('.'))return `${cleaned[0]}.${cleaned[1]}`;
  if(name==='PT%'&&v>300&&v<3000&&!cleaned.includes('.'))return cleaned.slice(0,-1);
  return cleaned;
}
function normalizeKnownReference(name:string,reference:string){
  const m=reference.match(/([<>]?)\s*(\d+(?:\.\d+)?)\s*[–-]\s*(\d+(?:\.\d+)?)/);
  if(!m)return reference;let a=Number(m[2]),b=Number(m[3]);
  if((name==='WBC'||name==='RBC')&&a>=20&&b>=20&&!m[2].includes('.')&&!m[3].includes('.'))return `${(a/10).toFixed(1)}–${(b/10).toFixed(1)}`;
  return reference;
}
function extractMeasurementRows(text:string,base:number):ExtractedMeasurement[]{
  const rows:ExtractedMeasurement[]=[];const seen=new Set<string>();
  for(const rawLine of text.split('\n')){
    const line=cleanOcrLine(rawLine); if(line.length<5)continue;
    const hit=canonicalRows.find(([,re])=>re.test(line)); if(!hit)continue;
    const [name]=hit; if(seen.has(name))continue;
    const values=rowNumbers(line); if(!values.length)continue;
    let measured=values[0],reference='';
    if(name==='Blood pressure'){
      measured=values.find(v=>v.includes('/'))||values[0];
      reference=values.slice(values.indexOf(measured)+1).join(' – ');
    }else{
      // The first numeric group inside scientific units such as 10^9/L can be OCR'd as a value.
      const unit=unitFromLine(line);
      const candidates=values.filter(v=>!(unit&&unit.includes(v.replace(/[<>]/g,''))&&/^10/.test(unit)));
      measured=candidates[0]||values[0];reference=candidates.slice(1).join(' – ');
    }
    const unit=unitFromLine(line);
    measured=normalizeKnownMeasurement(name,measured,reference);
    reference=normalizeKnownReference(name,reference);
    const idx=text.indexOf(rawLine);
    const normalizedPenalty=(measured!==values[0])?12:5;
    rows.push({name,value:measured,unit,referenceRange:reference||undefined,confidence:clamp(base-normalizedPenalty),sourceSnippet:snippet(text,Math.max(0,idx))});seen.add(name);
  }
  return rows;
}
function findMeasurement(rows:ExtractedMeasurement[],names:string[]){return rows.find(r=>names.some(n=>r.name.toLowerCase().includes(n.toLowerCase())))}
function fbgDisplay(row?:ExtractedMeasurement){
  if(!row)return '';
  const v=num(row.value);const unit=(row.unit ?? '').toLowerCase();
  if(Number.isFinite(v)&&unit.includes('mmol'))return `${v.toFixed(2)} mmol/L (≈${Math.round(v*18.0182)} mg/dL)`;
  return `${row.value}${row.unit?` ${row.unit}`:''}`;
}

function parseStructured(textRaw:string,method:DiabetesReportAnalysis['method'],ocrConfidence?:number):DiabetesReportAnalysis{
  const text=normalize(textRaw);const fields:Partial<Record<ClinicalExtractionKey,ExtractedClinicalField>>={};
  const base=method==='pdf-text'?95:method==='hybrid'?87:Math.max(55,Math.round(ocrConfidence||76));
  const measurements=extractMeasurementRows(text,base);

  // Prefer row-aware extraction for table reports.
  const bpRow=findMeasurement(measurements,['Blood pressure']);
  if(bpRow?.value.includes('/')){const [sys,dia]=bpRow.value.replace(/[<>]/g,'').split('/');const idx=text.toLowerCase().indexOf('blood pressure');put(fields,'systolicBP',`${sys} mmHg`,bpRow.confidence,text,Math.max(0,idx));put(fields,'diastolicBP',`${dia} mmHg`,bpRow.confidence,text,Math.max(0,idx))}
  const hba=findMeasurement(measurements,['HbA1c']);if(hba){const idx=text.toLowerCase().search(/hba\s*[1il]\s*c|hb\s*a\s*[1il]\s*c/);put(fields,'hba1c',hba.value.includes('%')?hba.value:`${hba.value}%`,hba.confidence,text,Math.max(0,idx))}
  const fbg=findMeasurement(measurements,['Fasting blood glucose']);if(fbg){const idx=text.toLowerCase().search(/\bfbg\b|\bfbs\b|fasting/);put(fields,'fastingGlucose',fbgDisplay(fbg),fbg.confidence,text,Math.max(0,idx))}
  const chol=findMeasurement(measurements,['Total cholesterol']);if(chol){const idx=text.toLowerCase().indexOf('cholesterol');put(fields,'cholesterol',`${chol.value}${chol.unit?` ${chol.unit}`:''}`,chol.confidence,text,Math.max(0,idx))}
  const creat=findMeasurement(measurements,['Creatinine']);if(creat){const idx=text.toLowerCase().indexOf('creatinine');put(fields,'creatinine',`${creat.value}${creat.unit?` ${creat.unit}`:''}`,creat.confidence,text,Math.max(0,idx))}

  // Flexible free-text extraction for non-table reports.
  const specs:[ClinicalExtractionKey,RegExp,(m:RegExpExecArray)=>string,number][]=[
    ['hba1c',/(?:hba\s*[1il]\s*c|hb\s*a\s*[1il]\s*c|glycated\s+h(?:a|e)emoglobin|glycosylated\s+h(?:a|e)emoglobin)[^\d]{0,35}(\d{1,3}(?:\.\d{1,2})?)\s*%?/i,m=>normalizeHba1c(m[1],''),3],
    ['fastingGlucose',/(?:fasting\s+(?:blood\s+)?(?:glucose|sugar)|\bfbs\b|\bfbg\b)[^\d]{0,40}(\d{1,3}(?:\.\d+)?)\s*(mmol\/?l|mg\/?dl)?/i,m=>{const v=Number(m[1]);return (m[2]||'').toLowerCase().includes('mmol')?`${v} mmol/L (≈${Math.round(v*18.0182)} mg/dL)`:`${m[1]} mg/dL`},2],
    ['postMealGlucose',/(?:post\s*(?:meal|prandial)|ppbs|ppbg|2\s*hr(?:s)?\s*(?:pp|postprandial))[^\d]{0,35}(\d{1,3}(?:\.\d+)?)\s*(mmol\/?l|mg\/?dl)?/i,m=>`${m[1]} ${(m[2]||'mg/dL')}`,2],
    ['randomGlucose',/(?:random\s+(?:blood\s+)?(?:glucose|sugar)|\brbs\b|\brbg\b)[^\d]{0,35}(\d{1,3}(?:\.\d+)?)\s*(mmol\/?l|mg\/?dl)?/i,m=>`${m[1]} ${(m[2]||'mg/dL')}`,3],
    ['cholesterol',/(?:total\s+cholesterol|cholesterol\s*[-:]?\s*total|\bcholesterol\b)[^\d]{0,30}(\d{1,3}(?:\.\d+)?)\s*(?:mg\/?dl|mmol\/?l)?/i,m=>`${m[1]}`,3],
    ['creatinine',/(?:serum\s+)?creatinine[^\d]{0,30}(\d{1,3}(?:\.\d{1,2})?)\s*(?:mg\/?dl|µmol\/?l|umol\/?l)?/i,m=>`${m[1]}`,3],
    ['diabetesDuration',/(?:duration\s+of\s+diabetes|diabetes\s+duration|diabetic\s+for)[^\d]{0,35}(\d+(?:\.\d+)?)\s*(years?|yrs?|months?)/i,m=>`${m[1]} ${m[2]}`,5],
  ];
  for(const [key,re,fmt,penalty] of specs){if(fields[key])continue;const found=match(text,re);if(found)put(fields,key,fmt(found.m),base-penalty,text,found.index)}
  if(!fields.systolicBP||!fields.diastolicBP){const bp=match(text,/(?:blood\s*pressure|\bbp\b)[^\d]{0,30}(\d{2,3})\s*\/\s*(\d{2,3})\s*(?:mmhg)?/i)||match(text,/\b(\d{2,3})\s*\/\s*(\d{2,3})\s*mmhg\b/i);if(bp){put(fields,'systolicBP',`${bp.m[1]} mmHg`,base-2,text,bp.index);put(fields,'diastolicBP',`${bp.m[2]} mmHg`,base-2,text,bp.index)}}

  const lines=text.split('\n').map(x=>x.trim()).filter(Boolean);
  const treatmentLine=lines.find(x=>/(treatment|therapy|insulin|metformin|oral hypogly|antidiabetic)/i.test(x)&&x.length<180);
  if(treatmentLine){const idx=text.indexOf(treatmentLine);put(fields,'diabetesTreatment',treatmentLine.replace(/^.*?(treatment|therapy)\s*[:\-]?\s*/i,'').trim()||treatmentLine,base-9,text,idx)}
  const medLine=lines.find(x=>/(medication|medicines?|drugs?|insulin|metformin|glimepiride|sitagliptin|empagliflozin)/i.test(x)&&x.length<220);
  if(medLine){const idx=text.indexOf(medLine);put(fields,'currentMedicines',medLine.replace(/^.*?(medications?|medicines?|drugs?)\s*[:\-]?\s*/i,'').trim()||medLine,base-10,text,idx)}

  const foundCount=Object.keys(fields).length;const measurementCount=measurements.length;const warnings:string[]=[];
  if(foundCount===0&&measurementCount===0)warnings.push('No supported clinical values could be extracted automatically. Review the source report manually.');
  if(method!=='pdf-text')warnings.push('OCR-derived values can contain recognition errors. Auto-captured values must be compared with the source report before clinical use.');
  if(!fields.hba1c)warnings.push('HbA1c was not confidently found in the report.');
  const confValues=[...Object.values(fields).map(v=>v?.confidence||0),...measurements.map(v=>v.confidence)].filter(Boolean);const avg=confValues.length?Math.round(confValues.reduce((a,b)=>a+b,0)/confValues.length):0;
  return {status:(foundCount||measurementCount)?'completed':'partial',extractedAt:new Date().toISOString(),method,overallConfidence:avg,fields,allMeasurements:measurements,warnings,rawTextPreview:text.slice(0,1800)};
}

async function imageToEnhancedCanvas(file:File):Promise<HTMLCanvasElement>{
  const bitmap=await createImageBitmap(file);const maxW=1800;const scale=Math.min(3,maxW/Math.max(1,bitmap.width));const w=Math.max(bitmap.width,Math.round(bitmap.width*scale));const h=Math.max(bitmap.height,Math.round(bitmap.height*scale));const c=document.createElement('canvas');c.width=w;c.height=h;const ctx=c.getContext('2d',{willReadFrequently:true})!;ctx.drawImage(bitmap,0,0,w,h);const im=ctx.getImageData(0,0,w,h);const d=im.data;let min=255,max=0;for(let i=0;i<d.length;i+=4){const y=Math.round(.299*d[i]+.587*d[i+1]+.114*d[i+2]);if(y<min)min=y;if(y>max)max=y;d[i]=d[i+1]=d[i+2]=y}const span=Math.max(20,max-min);for(let i=0;i<d.length;i+=4){const y=Math.max(0,Math.min(255,Math.round((d[i]-min)*255/span)));d[i]=d[i+1]=d[i+2]=y}ctx.putImageData(im,0,0);return c}

async function ocrSource(source:File|HTMLCanvasElement):Promise<{text:string;confidence:number}>{
  const worker=await createWorker('eng',1,{logger:()=>{}} as any);
  try{try{await worker.setParameters({tessedit_pageseg_mode:'6' as any,preserve_interword_spaces:'1'} as any)}catch{}const out=await worker.recognize(source as any);return {text:out.data.text||'',confidence:Number(out.data.confidence||0)}}finally{await worker.terminate()}
}
async function ocrImage(file:File){
  const first=await ocrSource(file);if(first.text.length>180&&first.confidence>=55)return first;
  try{const canvas=await imageToEnhancedCanvas(file);const second=await ocrSource(canvas);return second.text.length>first.text.length?second:first}catch{return first}
}

async function pdfText(file:File):Promise<{text:string;canvases:HTMLCanvasElement[]}>{
  const data=new Uint8Array(await file.arrayBuffer());const pdf=await pdfjsLib.getDocument({data}).promise;let text='';const canvases:HTMLCanvasElement[]=[];const pages=Math.min(pdf.numPages,6);
  for(let i=1;i<=pages;i++){
    const page=await pdf.getPage(i);const content=await page.getTextContent();const pageText=(content.items as any[]).map((x:any)=>x.str||'').join(' ');text+=`\n${pageText}`;
    if(pageText.trim().length<120){const viewport=page.getViewport({scale:1.8});const canvas=document.createElement('canvas');canvas.width=Math.ceil(viewport.width);canvas.height=Math.ceil(viewport.height);const ctx=canvas.getContext('2d',{willReadFrequently:true});if(ctx){await page.render({canvasContext:ctx,viewport,canvas} as any).promise;canvases.push(canvas)}}
  }
  return {text:normalize(text),canvases};
}

export async function extractDiabetesReport(file:File):Promise<DiabetesReportAnalysis>{
  try{
    if(file.type==='application/pdf'||file.name.toLowerCase().endsWith('.pdf')){
      const pdf=await pdfText(file);if(pdf.text.length>=180){const parsed=parseStructured(pdf.text,'pdf-text');if(Object.keys(parsed.fields).length||parsed.allMeasurements?.length)return parsed}
      let ocrText=pdf.text;let confs:number[]=[];for(const canvas of pdf.canvases.slice(0,4)){const o=await ocrSource(canvas);ocrText+=`\n${o.text}`;confs.push(o.confidence)}const conf=confs.length?confs.reduce((a,b)=>a+b,0)/confs.length:0;return parseStructured(ocrText,pdf.text.length?'hybrid':'ocr',conf);
    }
    if(file.type.startsWith('image/')){const o=await ocrImage(file);return parseStructured(o.text,'ocr',o.confidence)}
    return {status:'failed',method:'none',overallConfidence:0,fields:{},allMeasurements:[],warnings:['Unsupported report type. Upload a PDF, PNG, JPG or WEBP report.'],rawTextPreview:''};
  }catch(e:any){return {status:'failed',method:'none',overallConfidence:0,fields:{},allMeasurements:[],warnings:[e?.message||'Automatic report extraction failed.'],rawTextPreview:''}}
}
