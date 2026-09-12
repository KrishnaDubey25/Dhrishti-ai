import type {OnboardingData,RiskAssessment} from '../types';

/**
 * Evidence-informed screening urgency for patient routing.
 * This is NOT a validated probability of diabetic retinopathy and must not be
 * presented as a diagnosis. It uses established risk/context variables to
 * prioritize who should receive retinal/fundus screening sooner.
 */
export function assessScreeningUrgency(o:OnboardingData):RiskAssessment{
  let score=0; const reasons:string[]=[];
  const add=(n:number,r:string)=>{score+=n;reasons.push(r)};

  if(o.diabetesStatus==='Yes') add(2,'Known diabetes');
  if(o.diabetesStatus==='Not sure') add(1,'Diabetes status is uncertain');
  if(o.duration==='5–10 years') add(2,'Diabetes duration 5–10 years');
  if(o.duration==='More than 10 years') add(4,'Diabetes duration over 10 years');

  const h=Number(String(o.hba1c||'').replace(/[^0-9.]/g,''));
  if(h>=9) add(4,'HbA1c is markedly elevated');
  else if(h>=8) add(3,'HbA1c is elevated');
  else if(h>=7) add(1,'HbA1c is above a common treatment target');

  const bp=Number(String(o.systolicBP||'').replace(/[^0-9.]/g,''));
  if(bp>=160) add(3,'Markedly elevated systolic blood pressure');
  else if(bp>=140) add(2,'Elevated systolic blood pressure');

  if(o.drHistory==='Yes') add(5,'Previous diabetic retinopathy/retinal history');
  if(o.symptoms==='Sudden vision change') add(7,'Sudden vision change needs prompt clinical assessment');
  else if(o.symptoms==='Floaters') add(4,'Floaters reported');
  else if(o.symptoms==='Blurred vision') add(3,'Blurred vision reported');
  else if(o.symptoms==='Difficulty seeing at night') add(2,'Difficulty seeing at night reported');

  if(o.previousEyeExam==='No') add(1,'No previous eye examination');
  if(o.medicalContext.includes('Hypertension')) add(2,'Hypertension reported');
  if(o.medicalContext.includes('Kidney')) add(2,'Kidney disease reported');
  if(o.medicalContext.includes('Pregnancy') && o.diabetesStatus==='Yes') add(2,'Pregnancy with diabetes requires closer retinal follow-up');

  const band=score>=14?'critical':score>=9?'high':score>=4?'moderate':'low';
  const nextStep=band==='critical'
    ?'Arrange prompt in-person eye/retinal assessment. If vision changed suddenly or severely, seek urgent clinical care.'
    :band==='high'
      ?'Arrange retinal/fundus screening soon and route the result for clinician review.'
      :band==='moderate'
        ?'Book a routine PHC/eye-care fundus screening in the near term.'
        :(o.diabetesStatus==='Yes'||o.diabetesStatus==='Not sure')
          ?'No urgent PHC referral from this preliminary triage. Repeat the DRISHTI self-check in 6 months and keep routine retinal screening according to clinician guidance.'
          :'No PHC visit is recommended from this preliminary triage right now. Repeat the DRISHTI self-check in 12 months, or sooner if diabetes status or vision symptoms change.';
  return {
    band,score,reasons,nextStep,calculatedAt:new Date().toISOString(),
    method:'Evidence-informed screening urgency index; not a validated disease probability or diagnosis'
  };
}
