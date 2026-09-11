import type {OnboardingData,RiskAssessment} from '../types';

/** Evidence-informed triage layer. It deliberately does NOT output a disease probability.
 * Factors reflect established DR risk variables (duration, HbA1c, BP, prior DR) and urgent visual symptoms.
 */
export function assessScreeningUrgency(o:OnboardingData):RiskAssessment{
  let score=0; const reasons:string[]=[];
  const add=(n:number,r:string)=>{score+=n;reasons.push(r)};
  if(o.diabetesStatus==='Yes') add(2,'Known diabetes');
  if(o.duration==='5–10 years') add(2,'Diabetes duration 5–10 years');
  if(o.duration==='More than 10 years') add(4,'Diabetes duration over 10 years');
  const h=Number(String(o.hba1c||'').replace(/[^0-9.]/g,''));
  if(h>=8) add(3,'HbA1c is elevated'); else if(h>=7) add(1,'HbA1c above common treatment target');
  const bp=Number(String(o.systolicBP||'').replace(/[^0-9.]/g,''));
  if(bp>=160) add(3,'Markedly elevated systolic blood pressure'); else if(bp>=140) add(2,'Elevated systolic blood pressure');
  if(o.drHistory==='Yes') add(5,'Previous diabetic retinopathy/retinal history');
  if(['Blurred vision','Floaters','Sudden vision change'].includes(o.symptoms)) add(3,'Current visual symptoms');
  if(o.previousEyeExam==='No') add(1,'No previous eye examination');
  if(o.medicalContext.includes('Hypertension')) add(2,'Hypertension reported');
  if(o.medicalContext.includes('Kidney')) add(2,'Kidney disease reported');
  const band=score>=9?'high':score>=4?'moderate':'low';
  const nextStep=band==='high'?'Arrange prompt retinal/fundus screening and clinician review.':band==='moderate'?'Book a retinal screening at a PHC/eye-care centre.':'Continue routine diabetes eye screening according to clinician guidance.';
  return {band,score,reasons,nextStep,calculatedAt:new Date().toISOString(),method:'Evidence-informed screening urgency; not a validated diagnostic probability'};
}
