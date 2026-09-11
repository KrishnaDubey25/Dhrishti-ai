import {useEffect,useMemo,useRef,useState} from 'react';
import {Link,useNavigate} from 'react-router-dom';
import jsPDF from 'jspdf';
import {Bell,CalendarDays,Camera,CheckCircle2,FileDown,FileText,HeartPulse,MapPin,ShieldAlert,Upload,Video} from 'lucide-react';
import {Empty,PageTitle,PortalLayout,Status} from '../components/Common';
import {useAuth} from '../contexts/AuthContext';
import {addAppointment,markUserOnboarded,readDB,uid,updatePatient,writeDB} from '../services/db';
import {assessScreeningUrgency} from '../services/risk';
import {runTrainedDRModel} from '../services/ai';
import type {AIResult,OnboardingData,PatientProfile,UploadRecord} from '../types';
import {toUpload} from '../utils/files';

const links=[{to:'/patient/dashboard',label:'Dashboard',icon:'dashboard'},{to:'/patient/profile',label:'Profile',icon:'profile'},{to:'/patient/medical-history',label:'Health & Risk'},{to:'/patient/eye-capture',label:'Eye / Fundus Capture'},{to:'/patient/book-screening',label:'Find PHC & Book'},{to:'/patient/screenings',label:'Screenings'},{to:'/patient/results',label:'Results'},{to:'/patient/reports',label:'Reports',icon:'reports'},{to:'/patient/referrals',label:'Referrals'},{to:'/patient/notifications',label:'Notifications'}];
const defaults:OnboardingData={diabetesStatus:'',duration:'',treatment:'',medication:'',hba1c:'',systolicBP:'',cholesterol:'',previousEyeExam:'',eyeProblems:'',symptoms:'',drHistory:'',medicalContext:'',currentTreatment:'',uploadedReports:[]};
export function PatientShell({view}:{view:string}){const {user,setUser}=useAuth();const navigate=useNavigate();const[,refresh]=useState(0);useEffect(()=>{const f=()=>refresh(x=>x+1);window.addEventListener('drishti-db',f);return()=>window.removeEventListener('drishti-db',f)},[]);const db=readDB();const p=db.patients.find(x=>x.userId===user?.id);if(!user||!p)return null;const body:any={dashboard:<Dashboard p={p}/>,profile:<Profile p={p}/>,history:<HealthRisk p={p}/>,reports:<Reports p={p}/>,book:<Book p={p}/>,capture:<PatientEyeCapture p={p}/>,screenings:<Screenings p={p}/>,results:<Results p={p}/>,referrals:<Referrals p={p}/>,notifications:<Notifications p={p}/>}[view];return <PortalLayout role="Patient" links={links}>{user.firstLogin&&<Onboarding p={p} onDone={()=>{markUserOnboarded(user.id);setUser({...user,firstLogin:false});navigate('/patient/eye-capture',{replace:true})}}/>}{body}</PortalLayout>}
function Dashboard({p}:{p:PatientProfile}){const d=readDB();const apps=d.appointments.filter(a=>a.patientId===p.id);const screens=d.screenings.filter(s=>s.patientId===p.id);const refs=d.referrals.filter(r=>r.patientId===p.id);const care=d.carePlans.find(c=>c.patientId===p.id);const risk=p.onboarding?.risk;return <><PageTitle title={`Hello, ${p.name}`} sub="Your screening status, next action and specialist follow-up." action={<Link className="btn primary" to="/patient/book-screening">Find a PHC</Link>}/><div className="grid grid-4"><K t="Profile" n={`${p.profileComplete}%`}/><K t="Screening urgency" n={risk?.band?.toUpperCase()||'NOT SET'}/><K t="Bookings" n={apps.length}/><K t="Reviewed cases" n={screens.filter(s=>s.doctorReview).length}/></div><div className="grid grid-2" style={{marginTop:16}}><div className="card action-card"><span className="eyebrow">Recommended next action</span><h3>{risk?.nextStep||'Complete your health questions to receive screening guidance.'}</h3><p className="muted">This is screening triage, not a diagnosis.</p><div className="hero-ctas"><Link className="btn primary" to="/patient/medical-history">Health & risk</Link><Link className="btn ghost" to="/patient/eye-capture">Camera / fundus</Link></div></div><div className="card"><h3>Specialist care plan</h3>{care?<><p><b>Medicines:</b> {care.medicines||'—'}</p><p><b>Routine:</b> {care.routine||'—'}</p><p className="small">Updated {new Date(care.updatedAt).toLocaleString()}</p></>:<p className="muted">No specialist care plan has been created yet.</p>}</div></div><div className="card" style={{marginTop:16}}><h3>Safety note</h3><p className="muted">A normal phone/laptop camera can help with eye positioning but cannot see the retina well enough to diagnose diabetic retinopathy. DR image analysis requires a retinal/fundus image from a compatible camera or adapter.</p></div></>}
function Profile({p}:{p:PatientProfile}){const[f,setF]=useState(p);function save(){updatePatient(p.userId,{...f,profileComplete:Math.max(60,p.profileComplete)});alert('Profile saved')}return <><PageTitle title="Patient profile" sub="Identity and contact details used across PHC and specialist workflows."/><div className="card"><div className="grid grid-2"><F label="Full name" v={f.name} set={v=>setF({...f,name:v})}/><F label="Phone" v={f.phone||''} set={v=>setF({...f,phone:v})}/><F label="Date of birth" type="date" v={f.dob||''} set={v=>setF({...f,dob:v})}/><F label="Gender" v={f.gender||''} set={v=>setF({...f,gender:v})}/><F label="Emergency contact" v={f.emergencyContact||''} set={v=>setF({...f,emergencyContact:v})}/></div><F label="Address" v={f.address||''} set={v=>setF({...f,address:v})}/><button className="btn primary" onClick={save}>Save profile</button></div></>}
function HealthRisk({p}:{p:PatientProfile}){const o=p.onboarding;if(!o)return <><PageTitle title="Health & screening urgency"/><Empty title="Health history not completed" body="Complete your first-login questionnaire or reopen it from your profile."/></>;return <><PageTitle title="Health & screening urgency" sub="Evidence-informed triage from the information you entered—not a DR diagnosis."/><div className={`risk-hero ${o.risk?.band||'low'}`}><span>Screening urgency</span><h2>{o.risk?.band?.toUpperCase()||'NOT CALCULATED'}</h2><p>{o.risk?.nextStep}</p></div><div className="grid grid-2" style={{marginTop:16}}><div className="card"><h3>Why this level?</h3>{o.risk?.reasons.length?o.risk.reasons.map(x=><div className="risk-reason" key={x}><CheckCircle2 size={16}/>{x}</div>):<p className="muted">No major risk flags were entered.</p>}<div className="disclaimer">This layer uses established DR risk factors to prioritize screening. It does not estimate a validated personal disease probability.</div></div><div className="card"><h3>Entered context</h3><p>Diabetes: <b>{o.diabetesStatus}</b></p><p>Duration: <b>{o.duration}</b></p><p>HbA1c: <b>{o.hba1c||'Not provided'}</b></p><p>Systolic BP: <b>{o.systolicBP||'Not provided'}</b></p><p>Previous DR: <b>{o.drHistory}</b></p><p>Symptoms: <b>{o.symptoms}</b></p></div></div></>}
function Reports({p}:{p:PatientProfile}){const d=readDB();const uploaded=p.onboarding?.uploadedReports||[];const final=d.screenings.filter(s=>s.patientId===p.id&&s.doctorReview);return <><PageTitle title="Reports" sub="Patient uploads and finalized clinical screening reports."/><div className="grid grid-2"><div className="card"><h3>Uploaded medical records</h3>{uploaded.length?uploaded.map(x=><div className="file-row" key={x.id}><FileText size={17}/><span>{x.name}</span>{x.dataUrl&&<a href={x.dataUrl} download={x.name}>Open</a>}</div>):<p className="muted">No reports uploaded.</p>}</div><div className="card"><h3>Final screening reports</h3>{final.length?final.map(s=><button key={s.id} className="btn ghost" onClick={()=>downloadFinal(p,s)}>Download {new Date(s.createdAt).toLocaleDateString()}</button>):<p className="muted">No finalized report yet.</p>}</div></div></>}
function Book({p}:{p:PatientProfile}){const d=readDB();const[phc,setPhc]=useState(d.phcs[0]?.id||'');const[date,setDate]=useState('');const[slot,setSlot]=useState('10:00');const[report,setReport]=useState<UploadRecord|null>(null);const[without,setWithout]=useState(false);async function pick(f?:File){if(f)setReport(await toUpload(f))}function confirm(){if(!phc||!date||(!report&&!without))return;const db=readDB();if(report)db.reports.push(report);writeDB(db);addAppointment({id:uid('appt'),patientId:p.id,phcId:phc,date,slot,status:'booked',initialReportId:report?.id,createdAt:new Date().toISOString()});alert('Screening booked');setDate('')}return <><PageTitle title="Find PHC & book screening" sub="Only PHC centers registered in this system appear here."/><div className="grid grid-2"><div className="card"><h3>Available PHC centers</h3>{d.phcs.length?d.phcs.map(c=><button key={c.id} className={`phc-option ${phc===c.id?'selected':''}`} onClick={()=>setPhc(c.id)}><MapPin size={19}/><span><b>{c.name}</b><small>{c.location} • {c.contact}</small></span></button>):<Empty title="No PHC centers registered" body="A PHC must register before patients can book it."/>}</div><div className="card"><h3>Appointment</h3><div className="grid grid-2"><F label="Date" type="date" v={date} set={setDate}/><div className="field"><label>Time slot</label><select className="select" value={slot} onChange={e=>setSlot(e.target.value)}>{['09:00','10:00','11:00','14:00','15:00','16:00'].map(x=><option key={x}>{x}</option>)}</select></div></div><div className="upload"><Upload size={20}/><b>Diabetes / HbA1c / eye report (optional)</b><input type="file" accept="image/*,.pdf" onChange={e=>pick(e.target.files?.[0])}/>{report&&<Status>{report.name}</Status>}</div><label className="check-row"><input type="checkbox" checked={without} onChange={e=>setWithout(e.target.checked)}/> Continue without an existing medical report</label><button className="btn primary" disabled={!phc||!date||(!report&&!without)} onClick={confirm}>Confirm booking</button></div></div></>}
function Screenings({p}:{p:PatientProfile}){const d=readDB();const apps=d.appointments.filter(a=>a.patientId===p.id);return <><PageTitle title="My screenings"/>{apps.length?<div className="card responsive-list">{apps.map(a=><div className="list-row" key={a.id}><div><b>{d.phcs.find(x=>x.id===a.phcId)?.name||'PHC'}</b><span>{a.date} • {a.slot}</span></div><Status>{a.status}</Status></div>)}</div>:<Empty title="No booking yet" body="Book a registered PHC for retinal screening."/>}</>}
function Results({p}:{p:PatientProfile}){const d=readDB();const list=d.screenings.filter(s=>s.patientId===p.id&&s.doctorReview);return <><PageTitle title="Reviewed results" sub="Only specialist-finalized assessments appear here."/>{list.length?list.map(s=><div className="report" key={s.id}><span className="eyebrow">Ophthalmologist Final Assessment</span><h2>Level {s.doctorReview!.finalSeverity} · {s.doctorReview!.referable?'Referable':'Non-referable'}</h2><p>{s.doctorReview!.notes}</p><div className="ai-summary"><b>AI screening recommendation</b><span>Level {s.aiResult?.severity} • confidence {Math.round((s.aiResult?.confidence||0)*100)}%</span></div><button className="btn ghost" onClick={()=>downloadFinal(p,s)}><FileDown size={16}/>Download report</button></div>):<Empty title="No finalized results" body="Your result will appear after retina specialist review."/>}</>}
function Referrals({p}:{p:PatientProfile}){const d=readDB();const rs=d.referrals.filter(r=>r.patientId===p.id);const cs=d.consultations.filter(c=>c.patientId===p.id);return <><PageTitle title="Referral & remote consultation"/><div className="grid grid-2"><div className="card"><h3>Referrals</h3>{rs.length?rs.map(r=><div key={r.id} className="list-row"><div><b>{r.specialist}</b><span>{r.reason}</span></div><Status>{r.status}</Status></div>):<p className="muted">No referral created.</p>}</div><div className="card"><h3>Video consultations</h3>{cs.length?cs.map(c=><div key={c.id} className="consult-row"><Video size={18}/><div><b>{new Date(c.scheduledAt).toLocaleString()}</b><p>{c.reason}</p></div>{c.status==='scheduled'&&<a className="btn soft" target="_blank" rel="noreferrer" href={`https://meet.jit.si/${c.roomId}`}>Join room</a>}</div>):<p className="muted">No remote consultation scheduled.</p>}<div className="disclaimer">Prototype video rooms use a replaceable Jitsi adapter. Healthcare deployments should use an organization-approved, privacy-compliant telemedicine service.</div></div></div></>}
function Notifications({p}:{p:PatientProfile}){const d=readDB();const ns=d.notifications.filter(n=>n.userId===p.userId||n.userId===p.id);return <><PageTitle title="Notifications"/>{ns.length?ns.map(n=><div className="card notification" key={n.id}><Bell size={16}/><div><b>{n.title}</b><p>{n.message}</p><span>{new Date(n.createdAt).toLocaleString()}</span></div></div>):<Empty title="All caught up" body="No notifications yet."/>}</>}

function Onboarding({p,onDone}:{p:PatientProfile;onDone:()=>void}){const qs=[['diabetesStatus','Do you have diabetes?',['Yes','No','Not sure']],['duration','How long have you had diabetes?',['Less than 1 year','1–5 years','5–10 years','More than 10 years','Not applicable']],['treatment','How is diabetes currently managed?',['Lifestyle','Tablets','Insulin','Combination','Not sure']],['medication','Are you currently taking diabetes medication?',['Yes','No','Not applicable']],['previousEyeExam','Have you had a retinal/eye examination before?',['Yes','No','Not sure']],['symptoms','Current vision symptoms?',['None','Blurred vision','Floaters','Sudden vision change','Difficulty seeing at night','Other']],['drHistory','Previous diabetic retinopathy/retina history?',['Yes','No','Not sure']],['medicalContext','Relevant medical context?',['Hypertension','Kidney disease','Pregnancy','None/Other']]] as const;const[o,setO]=useState<OnboardingData>(p.onboarding||defaults);const[step,setStep]=useState(0);async function upload(fs:FileList|null){if(!fs)return;const arr:UploadRecord[]=[];for(const f of Array.from(fs))arr.push(await toUpload(f));setO({...o,uploadedReports:[...o.uploadedReports,...arr]})}function finish(){const risk=assessScreeningUrgency(o);updatePatient(p.userId,{onboarding:{...o,risk},profileComplete:70});onDone()}const q=qs[step];return <div className="modal-back"><div className="modal onboarding"><span className="eyebrow">First login health profile</span><h2>Let’s understand your screening needs.</h2><p className="muted">These questions prioritize screening. They do not diagnose diabetic retinopathy.</p><div className="progress"><div style={{width:`${Math.min(100,((step+1)/(qs.length+1))*100)}%`}}/></div>{step<qs.length?<div className="question"><h3>{q[1]}</h3><div className="option-grid">{q[2].map(v=><button key={v} className={'option '+((o as any)[q[0]]===v?'selected':'')} onClick={()=>setO({...o,[q[0]]:v})}>{v}</button>)}</div></div>:<div className="question"><h3>Known measurements & reports</h3><div className="grid grid-3"><F label="HbA1c % (if known)" v={o.hba1c||''} set={v=>setO({...o,hba1c:v})}/><F label="Systolic BP" v={o.systolicBP||''} set={v=>setO({...o,systolicBP:v})}/><F label="Cholesterol (optional)" v={o.cholesterol||''} set={v=>setO({...o,cholesterol:v})}/></div><textarea className="textarea" placeholder="Current treatment / medicines" value={o.currentTreatment} onChange={e=>setO({...o,currentTreatment:e.target.value})}/><div className="upload" style={{marginTop:14}}><input multiple type="file" accept="image/*,.pdf" onChange={e=>upload(e.target.files)}/><p className="small">Upload reports if available. You can continue without them.</p></div></div>}<div className="modal-actions"><button className="btn ghost" onClick={()=>{markUserOnboarded(p.userId);onDone()}}>Skip for now</button>{step<qs.length?<button disabled={!(o as any)[q[0]]} className="btn primary" onClick={()=>setStep(step+1)}>Continue</button>:<button className="btn primary" onClick={finish}>Calculate screening urgency</button>}</div></div></div>}

export function PatientEyeCapture({p}:{p:PatientProfile}){
  const video=useRef<HTMLVideoElement|null>(null);
  const canvas=useRef<HTMLCanvasElement|null>(null);
  const detector=useRef<any>(null);
  const raf=useRef<number|null>(null);
  const countdownTimer=useRef<any>(null);
  const autoLock=useRef(false);
  const boxRef=useRef<{x:number;y:number;w:number;h:number}|null>(null);
  const lastVideoTime=useRef(-1);

  const[active,setActive]=useState(false);
  const[detectorReady,setDetectorReady]=useState(false);
  const[eyeOk,setEyeOk]=useState(false);
  const[stable,setStable]=useState(0);
  const[count,setCount]=useState<number|null>(null);
  const[captured,setCaptured]=useState<string>('');
  const[guide,setGuide]=useState('Start camera and place one eye inside the oval.');
  const[metrics,setMetrics]=useState<{brightness:number;sharpness:number;eyeSize:number}>({brightness:0,sharpness:0,eyeSize:0});
  const[fundus,setFundus]=useState<UploadRecord|null>(null);
  const[ai,setAi]=useState<AIResult|null>(null);
  const[busy,setBusy]=useState(false);

  function beep(){
    try{
      const AC=(window.AudioContext||(window as any).webkitAudioContext); if(!AC)return;
      const ctx=new AC(); const osc=ctx.createOscillator(); const gain=ctx.createGain();
      osc.type='sine'; osc.frequency.value=920; gain.gain.setValueAtTime(.14,ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(.001,ctx.currentTime+.18); osc.connect(gain); gain.connect(ctx.destination);
      osc.start(); osc.stop(ctx.currentTime+.19); osc.onended=()=>ctx.close();
    }catch{}
  }

  async function ensureDetector(){
    if(detector.current)return detector.current;
    setGuide('Loading eye detector…');
    const vision=await import('@mediapipe/tasks-vision');
    const files=await vision.FilesetResolver.forVisionTasks('/mediapipe/wasm');
    detector.current=await vision.FaceLandmarker.createFromOptions(files,{
      baseOptions:{modelAssetPath:'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/latest/face_landmarker.task',delegate:'GPU'},
      runningMode:'VIDEO', numFaces:1, minFaceDetectionConfidence:.55, minFacePresenceConfidence:.55, minTrackingConfidence:.5
    });
    setDetectorReady(true);
    return detector.current;
  }

  async function start(){
    try{
      await ensureDetector();
      const s=await navigator.mediaDevices.getUserMedia({video:{facingMode:'user',width:{ideal:1280},height:{ideal:720}},audio:false});
      if(video.current){
        video.current.srcObject=s; await video.current.play(); setCaptured(''); setStable(0); setEyeOk(false); setActive(true); setGuide('Move closer and place one eye inside the oval.');
        lastVideoTime.current=-1; scanLoop();
      }
    }catch(e:any){
      setGuide('Camera/eye detector could not start. Check camera permission and internet access for the vision model.');
      if (e?.name === 'NotAllowedError' || e?.name === 'PermissionDeniedError') {
        alert('Camera permission is blocked. Please allow camera access and reload.');
      } else if (e?.name === 'NotFoundError') {
        alert('No camera was detected on this device.');
      } else if (e?.name === 'NotReadableError') {
        alert('Camera is busy or already being used by another application.');
      } else {
        alert(`Eye detector could not start: ${e?.message || 'Unknown MediaPipe error'}`);
      }
    }
  }

  function cancelCountdown(){
    if(countdownTimer.current){clearInterval(countdownTimer.current);countdownTimer.current=null}
    setCount(null); autoLock.current=false;
  }

  function stop(){
    if(raf.current!==null){cancelAnimationFrame(raf.current);raf.current=null}
    cancelCountdown(); const s=video.current?.srcObject as MediaStream|undefined; s?.getTracks().forEach(t=>t.stop());
    if(video.current)video.current.srcObject=null; setActive(false); setEyeOk(false); setStable(0); setGuide('Camera stopped.');
  }
  useEffect(()=>()=>{stop();try{detector.current?.close?.()}catch{}},[]);

  function frameQuality(v:HTMLVideoElement){
    const c=canvas.current!; const w=240,h=135; c.width=w;c.height=h; const ctx=c.getContext('2d',{willReadFrequently:true})!; ctx.drawImage(v,0,0,w,h);
    const data=ctx.getImageData(0,0,w,h).data; let sum=0,grad=0,n=0; let prev=0;
    for(let i=0;i<data.length;i+=4){const y=.299*data[i]+.587*data[i+1]+.114*data[i+2];sum+=y;if(n%w!==0)grad+=Math.abs(y-prev);prev=y;n++}
    return {brightness:sum/n,sharpness:grad/Math.max(1,n-1)};
  }

  function eyeBoxFromLandmarks(lm:any[]){
    const groups=[[33,133,159,145,153,154,155,173],[362,263,386,374,380,381,382,398]];
    const boxes=groups.map(ids=>{const pts=ids.map(i=>lm[i]).filter(Boolean);const xs=pts.map((q:any)=>q.x),ys=pts.map((q:any)=>q.y);const x1=Math.min(...xs),x2=Math.max(...xs),y1=Math.min(...ys),y2=Math.max(...ys);return{x:x1,y:y1,w:x2-x1,h:y2-y1,cx:(x1+x2)/2,cy:(y1+y2)/2}});
    return boxes.sort((a,b)=>Math.hypot(a.cx-.5,a.cy-.5)-Math.hypot(b.cx-.5,b.cy-.5))[0];
  }

  function scanLoop(){
    const v=video.current;
    if(!v||!detector.current||v.readyState<2){raf.current=requestAnimationFrame(scanLoop);return}
    try{
      if(v.currentTime!==lastVideoTime.current){
        lastVideoTime.current=v.currentTime;
        const result=detector.current.detectForVideo(v,performance.now());
        const lm=result?.faceLandmarks?.[0];
        const q=frameQuality(v);
        if(!lm){
          boxRef.current=null;setEyeOk(false);setStable(0);setMetrics({brightness:q.brightness,sharpness:q.sharpness,eyeSize:0});setGuide('Eye not detected — move closer and keep one eye clearly visible.');if(autoLock.current)cancelCountdown();
        }else{
          const b=eyeBoxFromLandmarks(lm); const eyeSize=b.w;
          const centered=Math.abs(b.cx-.5)<.18&&Math.abs(b.cy-.5)<.17;
          const distanceOk=eyeSize>.065&&eyeSize<.24;
          const lightOk=q.brightness>55&&q.brightness<205;
          const sharpOk=q.sharpness>7.5;
          const ready=centered&&distanceOk&&lightOk&&sharpOk;
          boxRef.current={x:b.x,y:b.y,w:b.w,h:b.h}; setMetrics({brightness:q.brightness,sharpness:q.sharpness,eyeSize}); setEyeOk(ready);
          setStable(n=>ready?Math.min(n+1,12):0);
          if(!centered)setGuide('Center one eye inside the oval.');
          else if(eyeSize<=.065)setGuide('Move closer — eye is too small in the frame.');
          else if(eyeSize>=.24)setGuide('Move slightly back — eye is too close.');
          else if(!lightOk)setGuide(q.brightness<=55?'Increase lighting on the eye.':'Reduce strong light/glare.');
          else if(!sharpOk)setGuide('Hold still — image is blurry.');
          else setGuide('Good position — hold still.');
          if(!ready&&autoLock.current)cancelCountdown();
        }
      }
    }catch{setEyeOk(false);setStable(0);setGuide('Eye tracking paused — hold still and try again.');if(autoLock.current)cancelCountdown()}
    raf.current=requestAnimationFrame(scanLoop);
  }

  useEffect(()=>{
    if(!active||captured||!eyeOk||stable<6||autoLock.current)return;
    autoLock.current=true; beep(); setCount(3); let n=3;
    countdownTimer.current=setInterval(()=>{n-=1;if(n<=0){clearInterval(countdownTimer.current);countdownTimer.current=null;setCount(null);snap(true);autoLock.current=false}else setCount(n)},1000);
  },[active,captured,eyeOk,stable]);

  function snap(auto=false){
    if(!video.current||!canvas.current)return; if(auto&&!eyeOk)return;
    const v=video.current, c=canvas.current, vw=v.videoWidth,vh=v.videoHeight, box=boxRef.current;
    if(box){
      const cx=(box.x+box.w/2)*vw,cy=(box.y+box.h/2)*vh; const cropW=Math.min(vw,Math.max(box.w*vw*4.8,320)); const cropH=Math.min(vh,Math.max(box.h*vh*6.8,220));
      const sx=Math.max(0,Math.min(vw-cropW,cx-cropW/2)),sy=Math.max(0,Math.min(vh-cropH,cy-cropH/2));
      c.width=720;c.height=Math.max(420,Math.round(720*(cropH/cropW)));c.getContext('2d')!.drawImage(v,sx,sy,cropW,cropH,0,0,c.width,c.height);
    }else{
      const cropW=vw*.58,cropH=vh*.46,sx=(vw-cropW)/2,sy=(vh-cropH)/2;c.width=720;c.height=Math.round(720*(cropH/cropW));c.getContext('2d')!.drawImage(v,sx,sy,cropW,cropH,0,0,c.width,c.height);
    }
    setCaptured(c.toDataURL('image/jpeg',.94)); cancelCountdown(); setGuide('Eye image captured. Retake if needed.');
  }

  async function pick(f?:File){if(!f)return;setFundus(await toUpload(f,'fundus'));setAi(null)}
  async function analyze(){if(!fundus)return;setBusy(true);try{const result=await runTrainedDRModel({id:uid('patient-preview'),patientId:p.id,phcId:'patient-preview',createdAt:new Date().toISOString(),status:'draft',right:{eye:'right',image:fundus,quality:'good',observations:{}},left:{eye:'left',image:fundus,quality:'good',observations:{}}});setAi(result)}catch(e:any){alert(e.message||'Trained model service unavailable.')}finally{setBusy(false)}}

  return <><PageTitle title="Eye capture" sub="Step 2 after your health quiz: position one eye, wait for green, then automatic 3-2-1 capture."/><div className="grid grid-2"><div className="card capture-card"><span className="eyebrow">Guided eye capture</span><h3>Eye inside guide → green → beep → 3 · 2 · 1 → auto capture</h3><p className="small muted">This runs eye landmark detection in the browser, so the green lock does not depend on localhost or the Python AI server.</p><div className={`live-capture ${eyeOk?'ready':'not-ready'}`}><video ref={video} muted playsInline/><div className="eye-guide"/><div className="capture-status">{!active?'Camera off':count!==null?`Eye locked • capturing in ${count}`:guide}</div>{count!==null&&<div className="countdown">{count}</div>}<div className="capture-dot" aria-hidden="true"/></div><canvas ref={canvas} style={{display:'none'}}/><div className="capture-actions">{!active?<button className="btn primary" onClick={start}><Camera size={16}/>Start camera</button>:<button className="btn ghost" onClick={stop}>Stop</button>}<button className="btn soft" disabled={!active} onClick={()=>snap(false)}>Manual capture</button>{captured&&<button className="btn ghost" onClick={()=>{setCaptured('');setStable(0);autoLock.current=false;setGuide('Place one eye inside the oval.') }}>Retake</button>}</div>{active&&<div className="capture-metrics"><span>{detectorReady?'Eye detector ready':'Loading detector'}</span><span>Light {Math.round(metrics.brightness)}</span><span>Stability {Math.min(100,Math.round(stable/6*100))}%</span></div>}{captured&&<><span className="small" style={{display:'block',marginTop:12}}>Captured eye-only image</span><img className="captured-preview eye-only-preview" src={captured} alt="Captured eye"/></>}<div className="disclaimer"><ShieldAlert size={15}/> This camera step verifies positioning/capture only. Diabetic-retinopathy grading requires a retinal/fundus image.</div></div><div className="card"><span className="eyebrow">Optional retinal image</span><h3>Fundus image analysis</h3><p className="muted">If you already have a real retinal/fundus image, upload it here. Otherwise continue to PHC booking after capturing the eye image.</p><div className="upload"><input type="file" accept="image/*" onChange={e=>pick(e.target.files?.[0])}/>{fundus&&<><Status>{fundus.name}</Status>{fundus.dataUrl&&<img className="fundus-preview" src={fundus.dataUrl} alt="Fundus preview"/>}</>}</div><button className="btn primary" disabled={!fundus||busy} onClick={analyze}>{busy?'Running trained model…':'Run retinal screening model'}</button>{captured&&<Link className="btn soft" style={{marginTop:10}} to="/patient/book-screening"><MapPin size={16}/>Continue to PHC discovery</Link>}{ai&&<div className="patient-ai"><span className="eyebrow">AI Screening Recommendation</span><h2>Level {ai.severity} · {ai.referable?'Referable':'Non-referable'}</h2><p>Confidence {Math.round(ai.confidence*100)}%</p><p>{ai.explanation}</p><div className="disclaimer">This is trained-model screening support, not a final diagnosis. A PHC/specialist review is recommended.</div></div>}</div></div></>
}

function downloadFinal(p:PatientProfile,s:any){const doc=new jsPDF();doc.setFontSize(19);doc.text('DRISHTI-AI — Retinal Screening Report',16,18);doc.setFontSize(10);let y=31;const rows=[['Patient',p.name],['Screening date',new Date(s.createdAt).toLocaleString()],['Right-eye quality',s.right.quality],['Left-eye quality',s.left.quality],['AI screening recommendation',s.aiResult?`Level ${s.aiResult.severity} — ${s.aiResult.referable?'Referable':'Non-referable'}`:''],['AI confidence',s.aiResult?`${Math.round(s.aiResult.confidence*100)}%`:``],['Ophthalmologist final assessment',`Level ${s.doctorReview.finalSeverity} — ${s.doctorReview.referable?'Referable':'Non-referable'}`],['Doctor notes',s.doctorReview.notes||''],['Follow-up',s.doctorReview.followUpDate||'']];for(const[a,b]of rows){if(!b)continue;doc.setFont('helvetica','bold');doc.text(a+':',16,y);doc.setFont('helvetica','normal');const lines=doc.splitTextToSize(String(b),128);doc.text(lines,72,y);y+=Math.max(8,lines.length*5)}doc.setFontSize(8);doc.text('AI screening support is not a guaranteed diagnosis. Final clinical assessment is clinician-entered.',16,285);doc.save(`DRISHTI-AI-${p.name.replace(/\s+/g,'-')}.pdf`)}
function F({label,v,set,type='text'}:{label:string;v:string;set:(v:string)=>void;type?:string}){return <div className="field"><label>{label}</label><input className="input" type={type} value={v} onChange={e=>set(e.target.value)}/></div>}
function K({t,n}:{t:string;n:string|number}){return <div className="card"><span className="small">{t}</span><div className="kpi small-kpi">{n}</div></div>}
