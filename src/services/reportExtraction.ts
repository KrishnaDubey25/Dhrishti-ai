import * as pdfjsLib from 'pdfjs-dist';
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import {createWorker} from 'tesseract.js';
import type {ClinicalExtractionKey,DiabetesReportAnalysis,ExtractedClinicalField} from '../types';

(pdfjsLib.GlobalWorkerOptions as any).workerSrc=pdfWorker;

const normalize=(s:string)=>s.replace(/\u00a0/g,' ').replace(/[\t ]+/g,' ').replace(/\r/g,'\n').replace(/\n{3,}/g,'\n\n').trim();
const clamp=(n:number,a=0,b=100)=>Math.max(a,Math.min(b,n));

function snippet(text:string,index:number,len=110){const a=Math.max(0,index-45),b=Math.min(text.length,index+len);return normalize(text.slice(a,b)).replace(/\n/g,' ')}
function put(fields:Partial<Record<ClinicalExtractionKey,ExtractedClinicalField>>,key:ClinicalExtractionKey,value:string,confidence:number,text:string,index:number){if(!value||fields[key])return;fields[key]={value:value.trim(),confidence:clamp(confidence),sourceSnippet:snippet(text,index)}}
function match(text:string,re:RegExp){const m=re.exec(text);return m?{m,index:m.index}:null}

function parseStructured(textRaw:string,method:DiabetesReportAnalysis['method'],ocrConfidence?:number):DiabetesReportAnalysis{
  const text=normalize(textRaw);const fields:Partial<Record<ClinicalExtractionKey,ExtractedClinicalField>>={};
  const base=method==='pdf-text'?94:method==='hybrid'?86:Math.round(ocrConfidence||76);
  const specs:[ClinicalExtractionKey,RegExp,(m:RegExpExecArray)=>string,number][]=[
    ['hba1c',/(?:hba1c|hb\s*a1c|glycated\s+hemoglobin|glycosylated\s+hemoglobin)[^\d]{0,28}(\d{1,2}(?:\.\d{1,2})?)\s*%?/i,m=>`${m[1]}%`,0],
    ['fastingGlucose',/(?:fasting\s+(?:blood\s+)?(?:glucose|sugar)|\bfbs\b|\bfbg\b)[^\d]{0,28}(\d{2,3}(?:\.\d+)?)\s*(?:mg\/?dl)?/i,m=>`${m[1]} mg/dL`,1],
    ['postMealGlucose',/(?:post\s*(?:meal|prandial)|ppbs|ppbg|2\s*hr(?:s)?\s*(?:pp|postprandial))[^\d]{0,30}(\d{2,3}(?:\.\d+)?)\s*(?:mg\/?dl)?/i,m=>`${m[1]} mg/dL`,1],
    ['randomGlucose',/(?:random\s+(?:blood\s+)?(?:glucose|sugar)|\brbs\b|\brbg\b)[^\d]{0,28}(\d{2,3}(?:\.\d+)?)\s*(?:mg\/?dl)?/i,m=>`${m[1]} mg/dL`,2],
    ['cholesterol',/(?:total\s+cholesterol|cholesterol\s*[-:]?\s*total|\bcholesterol\b)[^\d]{0,25}(\d{2,3}(?:\.\d+)?)\s*(?:mg\/?dl)?/i,m=>`${m[1]} mg/dL`,2],
    ['creatinine',/(?:serum\s+)?creatinine[^\d]{0,25}(\d(?:\.\d{1,2})?)\s*(?:mg\/?dl)?/i,m=>`${m[1]} mg/dL`,2],
    ['diabetesDuration',/(?:duration\s+of\s+diabetes|diabetes\s+duration|diabetic\s+for)[^\d]{0,30}(\d+(?:\.\d+)?)\s*(years?|yrs?|months?)/i,m=>`${m[1]} ${m[2]}`,4],
  ];
  for(const [key,re,fmt,penalty] of specs){const found=match(text,re);if(found)put(fields,key,fmt(found.m),base-penalty,text,found.index)}
  const bp=match(text,/(?:blood\s*pressure|\bbp\b)[^\d]{0,20}(\d{2,3})\s*\/\s*(\d{2,3})\s*(?:mmhg)?/i)||match(text,/\b(\d{2,3})\s*\/\s*(\d{2,3})\s*mmhg\b/i);
  if(bp){put(fields,'systolicBP',`${bp.m[1]} mmHg`,base-2,text,bp.index);put(fields,'diastolicBP',`${bp.m[2]} mmHg`,base-2,text,bp.index)}

  const lines=text.split('\n').map(x=>x.trim()).filter(Boolean);
  const treatmentLine=lines.find(x=>/(treatment|therapy|insulin|metformin|oral hypogly|antidiabetic)/i.test(x)&&x.length<180);
  if(treatmentLine){const idx=text.indexOf(treatmentLine);put(fields,'diabetesTreatment',treatmentLine.replace(/^.*?(treatment|therapy)\s*[:\-]?\s*/i,'').trim()||treatmentLine,base-9,text,idx)}
  const medLine=lines.find(x=>/(medication|medicines?|drugs?|insulin|metformin|glimepiride|sitagliptin|empagliflozin)/i.test(x)&&x.length<220);
  if(medLine){const idx=text.indexOf(medLine);put(fields,'currentMedicines',medLine.replace(/^.*?(medications?|medicines?|drugs?)\s*[:\-]?\s*/i,'').trim()||medLine,base-10,text,idx)}

  const foundCount=Object.keys(fields).length;
  const warnings:string[]=[];
  if(foundCount===0)warnings.push('No supported diabetes/lab values could be extracted automatically. Review the source report manually.');
  if(method!=='pdf-text')warnings.push('OCR-derived values can contain recognition errors; compare them with the uploaded report before clinical use.');
  if(!fields.hba1c)warnings.push('HbA1c was not confidently found in the report.');
  const avg=foundCount?Math.round(Object.values(fields).reduce((a,v)=>a+(v?.confidence||0),0)/foundCount):0;
  return {status:foundCount?'completed':'partial',extractedAt:new Date().toISOString(),method,overallConfidence:avg,fields,warnings,rawTextPreview:text.slice(0,1200)};
}

async function ocrSource(source:File|HTMLCanvasElement):Promise<{text:string;confidence:number}>{
  const worker=await createWorker('eng',1,{logger:()=>{}} as any);
  try{const out=await worker.recognize(source as any);return {text:out.data.text||'',confidence:Number(out.data.confidence||0)}}finally{await worker.terminate()}
}

async function pdfText(file:File):Promise<{text:string;canvases:HTMLCanvasElement[]}>{
  const data=new Uint8Array(await file.arrayBuffer());const pdf=await pdfjsLib.getDocument({data}).promise;let text='';const canvases:HTMLCanvasElement[]=[];
  const pages=Math.min(pdf.numPages,4);
  for(let i=1;i<=pages;i++){
    const page=await pdf.getPage(i);const content=await page.getTextContent();const pageText=(content.items as any[]).map((x:any)=>x.str||'').join(' ');text+=`\n${pageText}`;
    if(pageText.trim().length<80){const viewport=page.getViewport({scale:1.45});const canvas=document.createElement('canvas');canvas.width=Math.ceil(viewport.width);canvas.height=Math.ceil(viewport.height);const ctx=canvas.getContext('2d',{willReadFrequently:true});if(ctx){await page.render({canvasContext:ctx,viewport,canvas} as any).promise;canvases.push(canvas)}}
  }
  return {text:normalize(text),canvases};
}

export async function extractDiabetesReport(file:File):Promise<DiabetesReportAnalysis>{
  try{
    if(file.type==='application/pdf'||file.name.toLowerCase().endsWith('.pdf')){
      const pdf=await pdfText(file);
      if(pdf.text.length>=140)return parseStructured(pdf.text,'pdf-text');
      let ocrText=pdf.text;let confs:number[]=[];
      for(const canvas of pdf.canvases.slice(0,3)){const o=await ocrSource(canvas);ocrText+=`\n${o.text}`;confs.push(o.confidence)}
      const conf=confs.length?confs.reduce((a,b)=>a+b,0)/confs.length:0;return parseStructured(ocrText,pdf.text.length?'hybrid':'ocr',conf);
    }
    if(file.type.startsWith('image/')){const o=await ocrSource(file);return parseStructured(o.text,'ocr',o.confidence)}
    return {status:'failed',method:'none',overallConfidence:0,fields:{},warnings:['Unsupported report type. Upload a PDF, PNG, JPG or WEBP report.'],rawTextPreview:''};
  }catch(e:any){return {status:'failed',method:'none',overallConfidence:0,fields:{},warnings:[e?.message||'Automatic report extraction failed.'],rawTextPreview:''}}
}
