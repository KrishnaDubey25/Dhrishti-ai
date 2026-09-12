import {useEffect,useMemo,useRef,useState} from 'react';
import {Link,useNavigate} from 'react-router-dom';
import jsPDF from 'jspdf';
import {Bell,CalendarDays,Camera,CheckCircle2,FileDown,FileText,HeartPulse,MapPin,ShieldAlert,Upload,Video} from 'lucide-react';
import {Empty,PageTitle,PortalLayout,Status} from '../components/Common';
import {useAuth} from '../contexts/AuthContext';
import {addAppointment,markUserOnboarded,readDB,uid,updatePatient,writeDB} from '../services/db';
import {assessScreeningUrgency} from '../services/risk';
import {runTrainedDRModel} from '../services/ai';
import {findNearbyHealthCentres,getCurrentPosition,mapViewUrl,type NearbyHealthCentre} from '../services/nearbyPhc';
import type {AIResult,OnboardingData,PatientProfile,UploadRecord} from '../types';
import {toUpload} from '../utils/files';

const links=[{to:'/patient/dashboard',label:'Dashboard',icon:'dashboard'},{to:'/patient/profile',label:'Profile',icon:'profile'},{to:'/patient/medical-history',label:'Health & Risk'},{to:'/patient/eye-capture',label:'Eye / Fundus Capture'},{to:'/patient/book-screening',label:'Find PHC & Book'},{to:'/patient/screenings',label:'Screenings'},{to:'/patient/results',label:'Results'},{to:'/patient/reports',label:'Reports',icon:'reports'},{to:'/patient/referrals',label:'Referrals'},{to:'/patient/notifications',label:'Notifications'}];
const defaults:OnboardingData={diabetesStatus:'',duration:'',treatment:'',medication:'',hba1c:'',systolicBP:'',cholesterol:'',previousEyeExam:'',eyeProblems:'',symptoms:'',drHistory:'',medicalContext:'',currentTreatment:'',uploadedReports:[]};
export function PatientShell({view}:{view:string}){const {user,setUser}=useAuth();const navigate=useNavigate();const[,refresh]=useState(0);useEffect(()=>{const f=()=>refresh(x=>x+1);window.addEventListener('drishti-db',f);return()=>window.removeEventListener('drishti-db',f)},[]);const db=readDB();const p=db.patients.find(x=>x.userId===user?.id);if(!user||!p)return null;const body:any={dashboard:<Dashboard p={p}/>,profile:<Profile p={p}/>,history:<HealthRisk p={p}/>,reports:<Reports p={p}/>,book:<Book p={p}/>,capture:<PatientEyeCapture p={p}/>,screenings:<Screenings p={p}/>,results:<Results p={p}/>,referrals:<Referrals p={p}/>,notifications:<Notifications p={p}/>}[view];return <PortalLayout role="Patient" links={links}>{user.firstLogin&&<Onboarding p={p} onDone={()=>{markUserOnboarded(user.id);setUser({...user,firstLogin:false});navigate('/patient/eye-capture',{replace:true})}}/>}{body}</PortalLayout>}
function Dashboard({p}:{p:PatientProfile}){
  const d=readDB();const apps=d.appointments.filter(a=>a.patientId===p.id);const screens=d.screenings.filter(s=>s.patientId===p.id);const refs=d.referrals.filter(r=>r.patientId===p.id);const care=d.carePlans.find(c=>c.patientId===p.id);const risk=p.onboarding?.risk;const next=apps.filter(a=>a.status!=='completed'&&a.status!=='cancelled').sort((a,b)=>(a.date+a.slot).localeCompare(b.date+b.slot))[0];
  return <><PageTitle title={`Hello, ${p.name}`} sub="Your screening journey, upcoming action and specialist follow-up in one place." action={<Link className="btn primary" to="/patient/eye-capture"><Camera size={16}/>Continue screening</Link>}/>
  <div className="patient-command"><div><span className="eyebrow">Your next action</span><h2>{risk?.nextStep||'Complete your health questions, then continue to guided eye capture.'}</h2><p>DRISHTI keeps screening urgency, PHC booking, retinal results and specialist follow-up connected.</p><div className="hero-ctas"><Link className="btn primary" to="/patient/eye-capture">Guided eye capture</Link><Link className="btn ghost" to="/patient/book-screening"><MapPin size={16}/>Find live PHC</Link></div></div><div className={`command-risk ${risk?.band||'low'}`}><span>Screening urgency</span><strong>{risk?.band?.toUpperCase()||'NOT SET'}</strong><small>Questionnaire triage — not diagnosis</small></div></div>
  <div className="grid grid-4 dashboard-kpis"><K t="Profile completion" n={`${p.profileComplete}%`}/><K t="PHC bookings" n={apps.length}/><K t="Retinal screenings" n={screens.length}/><K t="Specialist reviews" n={screens.filter(s=>s.doctorReview).length}/></div>
  <div className="care-journey"><div className={p.onboarding?'complete':'current'}><b>01</b><span><strong>Health profile</strong><small>{p.onboarding?'Completed':'Complete questionnaire'}</small></span></div><div className="current"><b>02</b><span><strong>Eye capture</strong><small>Guided positioning & capture</small></span></div><div className={apps.length?'complete':''}><b>03</b><span><strong>PHC screening</strong><small>{apps.length?'Booking created':'Find nearby PHC'}</small></span></div><div className={screens.length?'complete':''}><b>04</b><span><strong>Fundus analysis</strong><small>{screens.length?'Screening record exists':'Awaiting retinal image'}</small></span></div><div className={screens.some(s=>s.doctorReview)?'complete':''}><b>05</b><span><strong>Specialist</strong><small>{screens.some(s=>s.doctorReview)?'Reviewed':'Final clinical review'}</small></span></div></div>
  <div className="grid grid-2 dashboard-lower"><div className="card"><div className="section-head"><div><span className="eyebrow">Upcoming</span><h3>Screening appointment</h3></div><CalendarDays size={20}/></div>{next?<><h2 className="card-big">{next.date} · {next.slot}</h2><p className="muted">{d.phcs.find(x=>x.id===next.phcId)?.name||'Connected PHC'} · {next.status}</p><Link className="btn soft" to="/patient/screenings">View screening</Link></>:<Empty title="No upcoming booking" body="Use live PHC discovery to find a connected centre and schedule retinal screening." action={<Link className="btn soft" to="/patient/book-screening">Find PHC</Link>}/>}</div><div className="card"><div className="section-head"><div><span className="eyebrow">Specialist plan</span><h3>Care & follow-up</h3></div><HeartPulse size={20}/></div>{care?<><p><b>Medicines / treatment:</b> {care.medicines||'Not entered'}</p><p><b>Routine:</b> {care.routine||'Not entered'}</p><p className="small">Updated {new Date(care.updatedAt).toLocaleString()}</p></>:refs.length?<p className="muted">A referral exists. Your specialist care plan will appear here after review.</p>:<p className="muted">No specialist plan yet. It appears only after clinical review.</p>}</div></div>
  </>
}
function Profile({p}:{p:PatientProfile}){const[f,setF]=useState(p);function save(){updatePatient(p.userId,{...f,profileComplete:Math.max(60,p.profileComplete)});alert('Profile saved')}return <><PageTitle title="Patient profile" sub="Identity and contact details used across PHC and specialist workflows."/><div className="card"><div className="grid grid-2"><F label="Full name" v={f.name} set={v=>setF({...f,name:v})}/><F label="Phone" v={f.phone||''} set={v=>setF({...f,phone:v})}/><F label="Date of birth" type="date" v={f.dob||''} set={v=>setF({...f,dob:v})}/><F label="Gender" v={f.gender||''} set={v=>setF({...f,gender:v})}/><F label="Emergency contact" v={f.emergencyContact||''} set={v=>setF({...f,emergencyContact:v})}/></div><F label="Address" v={f.address||''} set={v=>setF({...f,address:v})}/><button className="btn primary" onClick={save}>Save profile</button></div></>}
function HealthRisk({p}:{p:PatientProfile}){const o=p.onboarding;if(!o)return <><PageTitle title="Health & screening urgency"/><Empty title="Health history not completed" body="Complete your first-login questionnaire or reopen it from your profile."/></>;return <><PageTitle title="Health & screening urgency" sub="Evidence-informed triage from the information you entered—not a DR diagnosis."/><div className={`risk-hero ${o.risk?.band||'low'}`}><span>Screening urgency</span><h2>{o.risk?.band?.toUpperCase()||'NOT CALCULATED'}</h2><p>{o.risk?.nextStep}</p></div><div className="grid grid-2" style={{marginTop:16}}><div className="card"><h3>Why this level?</h3>{o.risk?.reasons.length?o.risk.reasons.map(x=><div className="risk-reason" key={x}><CheckCircle2 size={16}/>{x}</div>):<p className="muted">No major risk flags were entered.</p>}<div className="disclaimer">This layer uses established DR risk factors to prioritize screening. It does not estimate a validated personal disease probability.</div></div><div className="card"><h3>Entered context</h3><p>Diabetes: <b>{o.diabetesStatus}</b></p><p>Duration: <b>{o.duration}</b></p><p>HbA1c: <b>{o.hba1c||'Not provided'}</b></p><p>Systolic BP: <b>{o.systolicBP||'Not provided'}</b></p><p>Previous DR: <b>{o.drHistory}</b></p><p>Symptoms: <b>{o.symptoms}</b></p></div></div></>}
function Reports({p}:{p:PatientProfile}){const d=readDB();const uploaded=p.onboarding?.uploadedReports||[];const generated=d.reports.filter(r=>r.patientId===p.id&&r.generated).sort((a,b)=>b.uploadedAt.localeCompare(a.uploadedAt));const final=d.screenings.filter(s=>s.patientId===p.id&&s.doctorReview);return <><PageTitle title="Reports" sub="Your generated screening reports, uploaded medical records and specialist-finalized reports."/><div className="grid grid-3 report-library"><div className="card"><span className="eyebrow">Generated</span><h3>Screening reports</h3>{generated.length?generated.map(x=><div className="generated-report-row" key={x.id}><div><FileText size={18}/><span><b>{x.category==='ai-screening'?'AI retinal screening report':'Preliminary screening report'}</b><small>{new Date(x.uploadedAt).toLocaleString()}</small></span></div>{x.dataUrl&&<a className="btn soft mini" href={x.dataUrl} download={x.name}><FileDown size={14}/>Download</a>}</div>):<p className="muted">Complete guided eye capture to generate your first report.</p>}</div><div className="card"><span className="eyebrow">Medical context</span><h3>Uploaded records</h3>{uploaded.length?uploaded.map(x=><div className="file-row" key={x.id}><FileText size={17}/><span>{x.name}</span>{x.dataUrl&&<a href={x.dataUrl} download={x.name}>Open</a>}</div>):<p className="muted">No reports uploaded.</p>}</div><div className="card"><span className="eyebrow">Clinician finalized</span><h3>Final screening reports</h3>{final.length?final.map(s=><button key={s.id} className="btn ghost" onClick={()=>downloadFinal(p,s)}>Download {new Date(s.createdAt).toLocaleDateString()}</button>):<p className="muted">No finalized specialist report yet.</p>}</div></div></>}
function Book({p}:{p:PatientProfile}){
  const d=readDB();const[phc,setPhc]=useState(d.phcs[0]?.id||'');const[date,setDate]=useState('');const[slot,setSlot]=useState('10:00');const[report,setReport]=useState<UploadRecord|null>(null);const[without,setWithout]=useState(false);
  const[nearby,setNearby]=useState<NearbyHealthCentre[]>([]);const[locating,setLocating]=useState(false);const[geoError,setGeoError]=useState('');const[userPos,setUserPos]=useState<{lat:number;lon:number}|null>(null);
  async function pick(f?:File){if(f)setReport(await toUpload(f))}
  async function discover(){setLocating(true);setGeoError('');try{const pos=await getCurrentPosition();const lat=pos.coords.latitude,lon=pos.coords.longitude;setUserPos({lat,lon});setNearby(await findNearbyHealthCentres(lat,lon,15000))}catch(e:any){setGeoError(e?.message||'Could not access your location or nearby healthcare data. Enable location permission and try again.')}finally{setLocating(false)}}
  function connected(c:NearbyHealthCentre){return d.phcs.find(x=>{if(x.latitude!=null&&x.longitude!=null){const dy=(x.latitude-c.latitude)*111,dx=(x.longitude-c.longitude)*111*Math.cos(c.latitude*Math.PI/180);if(Math.sqrt(dx*dx+dy*dy)<.35)return true}const a=(x.name||'').toLowerCase(),b=c.name.toLowerCase();return a&&b&&(a.includes(b)||b.includes(a))})}
  function confirm(){if(!phc||!date||(!report&&!without))return;const db=readDB();if(report)db.reports.push(report);writeDB(db);addAppointment({id:uid('appt'),patientId:p.id,phcId:phc,date,slot,status:'booked',initialReportId:report?.id,createdAt:new Date().toISOString()});alert('Screening booked');setDate('')}
  return <><PageTitle title="Find a live PHC & book screening" sub="Use your current location to discover real nearby healthcare facilities. Booking is enabled only for DRISHTI-connected PHCs." action={<button className="btn primary" onClick={discover} disabled={locating}><MapPin size={17}/>{locating?'Finding nearby PHCs…':'Use my live location'}</button>}/>
  {geoError&&<div className="error" style={{marginBottom:16}}>{geoError}</div>}
  {userPos&&<div className="live-location-banner"><span className="live-dot"/><div><b>Live location active</b><span>Nearby facilities are queried live and your coordinates are not stored in your patient profile.</span></div></div>}
  <div className="grid grid-2"><div className="card"><div className="section-head"><div><span className="eyebrow">Live nearby discovery</span><h3>Nearby PHC / health centres</h3></div><span className="small muted">OpenStreetMap live data</span></div>
  {!userPos?<Empty title="Location not enabled" body="Tap ‘Use my live location’ to find real PHCs and healthcare centres around you."/>:locating?<div className="location-loading"><span className="spinner"/>Searching nearby healthcare facilities…</div>:nearby.length?<div className="nearby-centres">{nearby.map(c=>{const match=connected(c);return <div className={`nearby-centre ${match?'connected':''}`} key={c.osmId}><div className="nearby-main"><div className="nearby-icon"><MapPin size={19}/></div><div><b>{c.name}</b><div className="facility-meta"><span>{c.type}</span><span>•</span><span>{c.distanceKm.toFixed(1)} km away</span></div><small>{c.address}</small>{c.openingHours&&<small>Hours listed: {c.openingHours}</small>}</div></div><div className="nearby-actions"><a className="btn ghost mini" target="_blank" rel="noreferrer" href={mapViewUrl(c.latitude,c.longitude)}>View map</a>{match?<button className="btn soft mini" onClick={()=>setPhc(match.id)}>Select connected PHC</button>:<span className="external-label">Not yet connected to DRISHTI</span>}</div></div>})}</div>:<Empty title="No mapped health centre found nearby" body="Try again later. Public map coverage varies by area."/>}
  <div className="connected-divider"><span>DRISHTI-connected centers</span></div>{d.phcs.length?d.phcs.map(c=><button key={c.id} className={`phc-option ${phc===c.id?'selected':''}`} onClick={()=>setPhc(c.id)}><MapPin size={19}/><span><b>{c.name}</b><small>{c.location} • {c.contact}</small>{c.latitude!=null&&<small className="verified-location">GPS location registered</small>}</span></button>):<Empty title="No connected PHC centers" body="Nearby facilities can still be viewed on the map, but in-app booking requires a registered PHC workspace."/>}</div>
  <div className="card"><span className="eyebrow">Book screening</span><h3>Appointment details</h3><div className="grid grid-2"><F label="Date" type="date" v={date} set={setDate}/><div className="field"><label>Time slot</label><select className="select" value={slot} onChange={e=>setSlot(e.target.value)}>{['09:00','10:00','11:00','14:00','15:00','16:00'].map(x=><option key={x}>{x}</option>)}</select></div></div><div className="selected-center"><span className="small muted">Selected PHC</span><b>{d.phcs.find(x=>x.id===phc)?.name||'Select a connected PHC'}</b></div><div className="upload"><Upload size={20}/><b>Diabetes / HbA1c / eye report</b><input type="file" accept="image/*,.pdf" onChange={e=>pick(e.target.files?.[0])}/>{report&&<Status>{report.name}</Status>}<p className="small">Upload if available, or explicitly continue without a report.</p></div><label className="check-row"><input type="checkbox" checked={without} onChange={e=>setWithout(e.target.checked)}/> Continue without an existing medical report</label><button className="btn primary" disabled={!phc||!date||(!report&&!without)} onClick={confirm}>Confirm booking</button></div></div></>
}
function Screenings({p}:{p:PatientProfile}){const d=readDB();const apps=d.appointments.filter(a=>a.patientId===p.id);return <><PageTitle title="My screenings"/>{apps.length?<div className="card responsive-list">{apps.map(a=><div className="list-row" key={a.id}><div><b>{d.phcs.find(x=>x.id===a.phcId)?.name||'PHC'}</b><span>{a.date} • {a.slot}</span></div><Status>{a.status}</Status></div>)}</div>:<Empty title="No booking yet" body="Book a registered PHC for retinal screening."/>}</>}
function Results({p}:{p:PatientProfile}){const d=readDB();const list=d.screenings.filter(s=>s.patientId===p.id&&s.doctorReview);return <><PageTitle title="Reviewed results" sub="Only specialist-finalized assessments appear here."/>{list.length?list.map(s=><div className="report" key={s.id}><span className="eyebrow">Ophthalmologist Final Assessment</span><h2>Level {s.doctorReview!.finalSeverity} · {s.doctorReview!.referable?'Referable':'Non-referable'}</h2><p>{s.doctorReview!.notes}</p><div className="ai-summary"><b>AI screening recommendation</b><span>Level {s.aiResult?.severity} • confidence {Math.round((s.aiResult?.confidence||0)*100)}%</span></div><button className="btn ghost" onClick={()=>downloadFinal(p,s)}><FileDown size={16}/>Download report</button></div>):<Empty title="No finalized results" body="Your result will appear after retina specialist review."/>}</>}
function Referrals({p}:{p:PatientProfile}){const d=readDB();const rs=d.referrals.filter(r=>r.patientId===p.id);const cs=d.consultations.filter(c=>c.patientId===p.id);return <><PageTitle title="Referral & remote consultation"/><div className="grid grid-2"><div className="card"><h3>Referrals</h3>{rs.length?rs.map(r=><div key={r.id} className="list-row"><div><b>{r.specialist}</b><span>{r.reason}</span></div><Status>{r.status}</Status></div>):<p className="muted">No referral created.</p>}</div><div className="card"><h3>Video consultations</h3>{cs.length?cs.map(c=><div key={c.id} className="consult-row"><Video size={18}/><div><b>{new Date(c.scheduledAt).toLocaleString()}</b><p>{c.reason}</p></div>{c.status==='scheduled'&&<a className="btn soft" target="_blank" rel="noreferrer" href={`https://meet.jit.si/${c.roomId}`}>Join room</a>}</div>):<p className="muted">No remote consultation scheduled.</p>}<div className="disclaimer">Prototype video rooms use a replaceable Jitsi adapter. Healthcare deployments should use an organization-approved, privacy-compliant telemedicine service.</div></div></div></>}
function Notifications({p}:{p:PatientProfile}){const d=readDB();const ns=d.notifications.filter(n=>n.userId===p.userId||n.userId===p.id);return <><PageTitle title="Notifications"/>{ns.length?ns.map(n=><div className="card notification" key={n.id}><Bell size={16}/><div><b>{n.title}</b><p>{n.message}</p><span>{new Date(n.createdAt).toLocaleString()}</span></div></div>):<Empty title="All caught up" body="No notifications yet."/>}</>}

function Onboarding({p,onDone}:{p:PatientProfile;onDone:()=>void}){const qs=[['diabetesStatus','Do you have diabetes?',['Yes','No','Not sure']],['duration','How long have you had diabetes?',['Less than 1 year','1–5 years','5–10 years','More than 10 years','Not applicable']],['treatment','How is diabetes currently managed?',['Lifestyle','Tablets','Insulin','Combination','Not sure']],['medication','Are you currently taking diabetes medication?',['Yes','No','Not applicable']],['previousEyeExam','Have you had a retinal/eye examination before?',['Yes','No','Not sure']],['symptoms','Current vision symptoms?',['None','Blurred vision','Floaters','Sudden vision change','Difficulty seeing at night','Other']],['drHistory','Previous diabetic retinopathy/retina history?',['Yes','No','Not sure']],['medicalContext','Relevant medical context?',['Hypertension','Kidney disease','Pregnancy','None/Other']]] as const;const[o,setO]=useState<OnboardingData>(p.onboarding||defaults);const[step,setStep]=useState(0);async function upload(fs:FileList|null){if(!fs)return;const arr:UploadRecord[]=[];for(const f of Array.from(fs))arr.push(await toUpload(f));setO({...o,uploadedReports:[...o.uploadedReports,...arr]})}function finish(){const risk=assessScreeningUrgency(o);updatePatient(p.userId,{onboarding:{...o,risk},profileComplete:70});onDone()}const q=qs[step];return <div className="modal-back"><div className="modal onboarding"><span className="eyebrow">First login health profile</span><h2>Let’s understand your screening needs.</h2><p className="muted">These questions prioritize screening. They do not diagnose diabetic retinopathy.</p><div className="progress"><div style={{width:`${Math.min(100,((step+1)/(qs.length+1))*100)}%`}}/></div>{step<qs.length?<div className="question"><h3>{q[1]}</h3><div className="option-grid">{q[2].map(v=><button key={v} className={'option '+((o as any)[q[0]]===v?'selected':'')} onClick={()=>setO({...o,[q[0]]:v})}>{v}</button>)}</div></div>:<div className="question"><h3>Known measurements & reports</h3><div className="grid grid-3"><F label="HbA1c % (if known)" v={o.hba1c||''} set={v=>setO({...o,hba1c:v})}/><F label="Systolic BP" v={o.systolicBP||''} set={v=>setO({...o,systolicBP:v})}/><F label="Cholesterol (optional)" v={o.cholesterol||''} set={v=>setO({...o,cholesterol:v})}/></div><textarea className="textarea" placeholder="Current treatment / medicines" value={o.currentTreatment} onChange={e=>setO({...o,currentTreatment:e.target.value})}/><div className="upload" style={{marginTop:14}}><input multiple type="file" accept="image/*,.pdf" onChange={e=>upload(e.target.files)}/><p className="small">Upload reports if available. You can continue without them.</p></div></div>}<div className="modal-actions"><button className="btn ghost" onClick={()=>{markUserOnboarded(p.userId);onDone()}}>Skip for now</button>{step<qs.length?<button disabled={!(o as any)[q[0]]} className="btn primary" onClick={()=>setStep(step+1)}>Continue</button>:<button className="btn primary" onClick={finish}>Calculate screening urgency</button>}</div></div></div>}

export function PatientEyeCapture({p}:{p:PatientProfile}){
  type Phase='idle'|'starting'|'scanning'|'locked'|'countdown'|'captured'|'error';
  type DetectorMode='loading'|'mediapipe'|'guided';
  const video=useRef<HTMLVideoElement|null>(null);
  const canvas=useRef<HTMLCanvasElement|null>(null);
  const detector=useRef<any>(null);
  const streamRef=useRef<MediaStream|null>(null);
  const raf=useRef<number|null>(null);
  const audioCtx=useRef<AudioContext|null>(null);
  const predictionRef=useRef<HTMLDivElement|null>(null);
  const eyeBox=useRef<{x:number;y:number;w:number;h:number}|null>(null);
  const phaseRef=useRef<Phase>('idle');
  const detectorModeRef=useRef<DetectorMode>('loading');
  const stableSince=useRef<number|null>(null);
  const countdownToken=useRef(0);
  const lastFrameTime=useRef(-1);
  const fallbackAt=useRef(0);

  const[phase,setPhase]=useState<Phase>('idle');
  const[detectorMode,setDetectorMode]=useState<DetectorMode>('loading');
  const[guide,setGuide]=useState('Start camera, then bring one eye inside the oval guide.');
  const[ready,setReady]=useState(false);
  const[readiness,setReadiness]=useState(0);
  const[count,setCount]=useState<number|null>(null);
  const[captured,setCaptured]=useState('');
  const[metrics,setMetrics]=useState({brightness:0,contrast:0,sharpness:0,eyeSize:0});
  const[fundus,setFundus]=useState<UploadRecord|null>(null);
  const[ai,setAi]=useState<AIResult|null>(null);
  const[busy,setBusy]=useState(false);
  const[predictionReady,setPredictionReady]=useState(false);
  const[preliminaryReport,setPreliminaryReport]=useState<UploadRecord|null>(()=>readDB().reports.filter(r=>r.patientId===p.id&&r.category==='preliminary-screening').sort((a,b)=>b.uploadedAt.localeCompare(a.uploadedAt))[0]||null);
  const[aiReport,setAiReport]=useState<UploadRecord|null>(()=>readDB().reports.filter(r=>r.patientId===p.id&&r.category==='ai-screening').sort((a,b)=>b.uploadedAt.localeCompare(a.uploadedAt))[0]||null);

  function setPhaseSafe(next:Phase){phaseRef.current=next;setPhase(next)}
  function setMode(next:DetectorMode){detectorModeRef.current=next;setDetectorMode(next)}
  const sleep=(ms:number)=>new Promise(r=>setTimeout(r,ms));


  function saveGeneratedPdf(doc:any,category:'preliminary-screening'|'ai-screening',label:string){
    const dataUrl=doc.output('datauristring');
    const report:UploadRecord={id:uid('report'),name:`DRISHTI-AI-${label}-${p.name.replace(/\s+/g,'-')}-${new Date().toISOString().slice(0,10)}.pdf`,type:'application/pdf',size:Math.round(dataUrl.length*.75),dataUrl,uploadedAt:new Date().toISOString(),source:'camera',patientId:p.id,category,generated:true};
    const db=readDB();
    db.reports=db.reports.filter(r=>!(r.patientId===p.id&&r.category===category));
    db.reports.unshift(report);writeDB(db);return report;
  }
  function createPreliminaryReport(image:string){
    const o=p.onboarding;const risk=o?.risk;const doc=new jsPDF();
    doc.setFillColor(23,107,104);doc.rect(0,0,210,28,'F');doc.setTextColor(255,255,255);doc.setFontSize(18);doc.setFont('helvetica','bold');doc.text('DRISHTI-AI — Preliminary Screening Report',14,18);
    doc.setTextColor(23,36,43);doc.setFontSize(9);doc.setFont('helvetica','normal');doc.text(`Generated ${new Date().toLocaleString()}`,14,35);
    try{doc.addImage(image,'JPEG',139,42,55,38)}catch{}
    let y=48;const row=(label:string,value?:string)=>{if(!value)return;doc.setFont('helvetica','bold');doc.text(label,14,y);doc.setFont('helvetica','normal');const lines=doc.splitTextToSize(value,105);doc.text(lines,55,y);y+=Math.max(7,lines.length*5)};
    row('Patient',p.name);row('Email',p.email);row('Phone',p.phone||'Not provided');row('Diabetes status',o?.diabetesStatus||'Not provided');row('Duration',o?.duration||'Not provided');row('HbA1c',o?.hba1c||'Not provided');row('Systolic BP',o?.systolicBP||'Not provided');row('Previous DR',o?.drHistory||'Not provided');row('Vision symptoms',o?.symptoms||'Not provided');
    y=Math.max(y,88);doc.setDrawColor(228,234,236);doc.line(14,y,196,y);y+=9;doc.setFont('helvetica','bold');doc.setFontSize(12);doc.text('Preliminary screening guidance',14,y);y+=8;doc.setFontSize(10);row('Urgency',risk?.band?.toUpperCase()||'SCREENING RECOMMENDED');row('Next step',risk?.nextStep||'Proceed to a PHC for retinal/fundus screening.');
    if(risk?.reasons?.length){doc.setFont('helvetica','bold');doc.text('Risk context',14,y);y+=6;doc.setFont('helvetica','normal');for(const reason of risk.reasons.slice(0,6)){const lines=doc.splitTextToSize(`• ${reason}`,175);doc.text(lines,18,y);y+=lines.length*5+2}}
    y+=4;doc.setFillColor(232,244,242);doc.roundedRect(14,y,182,30,3,3,'F');doc.setFont('helvetica','bold');doc.text('Eye capture status',20,y+9);doc.setFont('helvetica','normal');doc.setFontSize(9);doc.text(doc.splitTextToSize('External-eye capture completed for positioning/workflow confirmation. This image does not visualize the retina and is not used to diagnose diabetic retinopathy.',165),20,y+16);y+=39;
    doc.setFillColor(248,250,250);doc.roundedRect(14,y,182,31,3,3,'F');doc.setTextColor(70,88,96);doc.setFontSize(8);doc.text(doc.splitTextToSize('Clinical safety: This preliminary report combines information entered by the patient with screening-urgency guidance. It is not a diagnosis. A real fundus/retinal image is required for trained DR image analysis, and final diagnosis/treatment decisions belong to a qualified ophthalmologist.',168),20,y+9);
    return saveGeneratedPdf(doc,'preliminary-screening','Preliminary-Screening');
  }
  function createAIReport(result:AIResult,fundusImage?:string){
    const doc=new jsPDF();doc.setFillColor(23,107,104);doc.rect(0,0,210,28,'F');doc.setTextColor(255,255,255);doc.setFontSize(18);doc.setFont('helvetica','bold');doc.text('DRISHTI-AI — AI Retinal Screening Report',14,18);doc.setTextColor(23,36,43);doc.setFontSize(9);doc.setFont('helvetica','normal');doc.text(`Generated ${new Date().toLocaleString()}`,14,35);if(fundusImage){try{doc.addImage(fundusImage,'JPEG',139,42,55,42)}catch{}}
    let y=48;const row=(label:string,value:string)=>{doc.setFont('helvetica','bold');doc.text(label,14,y);doc.setFont('helvetica','normal');const lines=doc.splitTextToSize(value,104);doc.text(lines,58,y);y+=Math.max(8,lines.length*5)};row('Patient',p.name);row('AI severity',`Level ${result.severity}`);row('Referable status',result.referable?'Referable':'Non-referable');row('Model confidence',`${Math.round(result.confidence*100)}%`);row('Model',result.model?.name||'Configured trained DR model');row('Explanation',result.explanation||'No additional explanation returned.');y=Math.max(y,112);doc.setFillColor(248,250,250);doc.roundedRect(14,y,182,35,3,3,'F');doc.setFontSize(8);doc.setTextColor(70,88,96);doc.text(doc.splitTextToSize('AI Screening Recommendation only. Model confidence is not a guarantee of clinical correctness. This report must not be treated as the final diagnosis; ophthalmologist review remains the final clinical assessment.',168),20,y+10);return saveGeneratedPdf(doc,'ai-screening','AI-Retinal-Screening');
  }

  async function primeAudio(){
    try{
      const AC=(window.AudioContext||(window as any).webkitAudioContext);if(!AC)return;
      if(!audioCtx.current)audioCtx.current=new AC();
      if(audioCtx.current.state==='suspended')await audioCtx.current.resume();
      const osc=audioCtx.current.createOscillator();const gain=audioCtx.current.createGain();
      gain.gain.value=.0001;osc.connect(gain);gain.connect(audioCtx.current.destination);osc.start();osc.stop(audioCtx.current.currentTime+.02);
    }catch(e){console.warn('Audio priming failed',e)}
  }
  async function beep(freq=960,duration=.16,volume=.34){
    try{
      await primeAudio();const ctx=audioCtx.current;if(!ctx)return;
      const osc=ctx.createOscillator();const gain=ctx.createGain();osc.type='sine';osc.frequency.value=freq;
      gain.gain.setValueAtTime(volume,ctx.currentTime);gain.gain.exponentialRampToValueAtTime(.001,ctx.currentTime+duration);
      osc.connect(gain);gain.connect(ctx.destination);osc.start();osc.stop(ctx.currentTime+duration);
    }catch(e){console.warn('Buzzer unavailable',e)}
  }

  async function initializeMediaPipe(){
    setMode('loading');
    const vision=await import('@mediapipe/tasks-vision');
    const wasmCandidates=[
      'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22/wasm',
      'https://unpkg.com/@mediapipe/tasks-vision@0.10.22/wasm'
    ];
    let files:any=null;let lastError:any=null;
    for(const base of wasmCandidates){try{files=await vision.FilesetResolver.forVisionTasks(base);break}catch(e){lastError=e}}
    if(!files)throw lastError||new Error('Vision WASM could not be loaded');
    const modelAssetPath='https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';
    const common={runningMode:'VIDEO' as const,numFaces:1,minFaceDetectionConfidence:.35,minFacePresenceConfidence:.35,minTrackingConfidence:.35};
    try{
      detector.current=await vision.FaceLandmarker.createFromOptions(files,{baseOptions:{modelAssetPath,delegate:'GPU'},...common});
    }catch(gpuError){
      console.warn('GPU detector failed; retrying CPU',gpuError);
      detector.current=await vision.FaceLandmarker.createFromOptions(files,{baseOptions:{modelAssetPath},...common});
    }
    setMode('mediapipe');
  }

  function stopStream(){
    streamRef.current?.getTracks().forEach(t=>t.stop());streamRef.current=null;
    if(video.current)video.current.srcObject=null;
  }
  function cancelAuto(reason?:string){
    countdownToken.current+=1;stableSince.current=null;setCount(null);setReady(false);setReadiness(0);
    if(phaseRef.current==='countdown'||phaseRef.current==='locked')setPhaseSafe('scanning');
    if(reason)setGuide(reason);
  }
  function stop(){
    if(raf.current!==null){cancelAnimationFrame(raf.current);raf.current=null}
    cancelAuto();stopStream();setPhaseSafe('idle');setGuide('Camera stopped. Start again when ready.');
  }
  useEffect(()=>()=>{stopStream();if(raf.current!==null)cancelAnimationFrame(raf.current);try{detector.current?.close?.()}catch{}},[]);

  async function start(){
    stopStream();if(raf.current!==null){cancelAnimationFrame(raf.current);raf.current=null}
    countdownToken.current+=1;stableSince.current=null;eyeBox.current=null;lastFrameTime.current=-1;
    setCaptured('');setPredictionReady(false);setAi(null);setCount(null);setReady(false);setReadiness(0);setPhaseSafe('starting');
    await primeAudio();
    if(!navigator.mediaDevices?.getUserMedia){setPhaseSafe('error');setGuide('This browser does not expose camera access. Use current Chrome, Edge or Safari.');return}
    try{
      setGuide('Allow camera access…');
      const stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:'user',width:{ideal:1280},height:{ideal:720}},audio:false});
      streamRef.current=stream;const el=video.current;if(!el)throw new Error('Video preview is not ready');
      el.srcObject=stream;el.muted=true;el.playsInline=true;
      if(el.readyState<1)await new Promise<void>((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('Camera preview timed out')),6000);el.onloadedmetadata=()=>{clearTimeout(timer);resolve()}});
      try{await el.play()}catch(e:any){if(e?.name==='AbortError'){await sleep(160);await el.play()}else throw e}
      setPhaseSafe('scanning');setMode('loading');fallbackAt.current=performance.now()+2600;setGuide('Camera ready. Loading eye detector…');void beep(720,.10,.22);
      scanLoop();
      initializeMediaPipe().then(()=>{setGuide('Eye detector ready. Bring one eye inside the oval.')}).catch(err=>{
        console.warn('MediaPipe unavailable; using guided alignment fallback.',err);detector.current=null;setMode('guided');setGuide('Guided capture mode active. Place one eye inside the oval and hold still.');
      });
    }catch(e:any){
      stopStream();setPhaseSafe('error');const name=e?.name||'';
      if(name==='NotAllowedError'||name==='PermissionDeniedError')setGuide('Camera permission is blocked. Allow Camera for this site, then press Start camera again.');
      else if(name==='NotFoundError'||name==='DevicesNotFoundError')setGuide('No camera was found on this device.');
      else if(name==='NotReadableError'||name==='TrackStartError')setGuide('Camera is busy in another tab/app. Close it there and retry.');
      else setGuide(`Camera could not start: ${e?.message||'Unknown camera error'}`);
    }
  }

  function frameMetrics(v:HTMLVideoElement){
    const c=canvas.current!;const w=260,h=150;c.width=w;c.height=h;const ctx=c.getContext('2d',{willReadFrequently:true})!;ctx.drawImage(v,0,0,w,h);
    const roiX=Math.floor(w*.31),roiY=Math.floor(h*.29),roiW=Math.floor(w*.38),roiH=Math.floor(h*.42);
    const data=ctx.getImageData(roiX,roiY,roiW,roiH).data;let sum=0,sum2=0,grad=0,n=0,prev=0;
    for(let i=0;i<data.length;i+=4){const y=.299*data[i]+.587*data[i+1]+.114*data[i+2];sum+=y;sum2+=y*y;if(n%roiW!==0)grad+=Math.abs(y-prev);prev=y;n++}
    const brightness=sum/Math.max(1,n);const variance=Math.max(0,sum2/Math.max(1,n)-brightness*brightness);
    return{brightness,contrast:Math.sqrt(variance),sharpness:grad/Math.max(1,n-1)};
  }
  function eyeBoxFromLandmarks(lm:any[]){
    const groups=[[33,133,159,145,153,154,155,173],[362,263,386,374,380,381,382,398]];
    const boxes=groups.map(ids=>{const pts=ids.map(i=>lm[i]).filter(Boolean);const xs=pts.map((q:any)=>q.x),ys=pts.map((q:any)=>q.y);const x1=Math.min(...xs),x2=Math.max(...xs),y1=Math.min(...ys),y2=Math.max(...ys);return{x:x1,y:y1,w:x2-x1,h:y2-y1,cx:(x1+x2)/2,cy:(y1+y2)/2}});
    return boxes.sort((a,b)=>Math.hypot(a.cx-.5,a.cy-.5)-Math.hypot(b.cx-.5,b.cy-.5))[0];
  }

  function evaluateFrame(v:HTMLVideoElement){
    const q=frameMetrics(v);let isReady=false;let score=0;let msg='Place one eye inside the oval.';let size=0;
    if(detectorModeRef.current==='loading'&&performance.now()>=fallbackAt.current){setMode('guided');msg='Guided capture mode active. Place one eye inside the oval and hold still.'}
    if(detectorModeRef.current==='mediapipe'&&detector.current){
      const result=detector.current.detectForVideo(v,Math.round(performance.now()));const lm=result?.faceLandmarks?.[0];
      if(lm){
        const b=eyeBoxFromLandmarks(lm);size=b.w;eyeBox.current={x:b.x,y:b.y,w:b.w,h:b.h};
        const centered=Math.abs(b.cx-.5)<.34&&Math.abs(b.cy-.5)<.29;const distanceOk=size>.02&&size<.38;const lightOk=q.brightness>28&&q.brightness<238;
        score=Math.round((centered?42:12)+(distanceOk?30:8)+(lightOk?18:5)+Math.min(10,q.sharpness/1.8));isReady=centered&&distanceOk&&lightOk;
        if(!centered)msg='Move the eye into the centre of the oval.';else if(size<=.02)msg='Move closer — the eye is too small.';else if(size>=.38)msg='Move slightly back.';else if(!lightOk)msg='Adjust lighting — avoid darkness or strong glare.';else msg='Eye locked — hold still.';
      }else{eyeBox.current=null;msg='Eye not detected yet — move closer and keep one eye clearly visible.';score=15}
    }else{
      eyeBox.current=null;const lightOk=q.brightness>34&&q.brightness<230;const detailOk=q.contrast>13&&q.sharpness>2.2;
      score=Math.round((lightOk?48:18)+(detailOk?42:12)+Math.min(10,q.contrast/5));isReady=lightOk&&detailOk;
      if(!lightOk)msg=q.brightness<=34?'Increase light on your face/eye.':'Reduce glare or direct light.';else if(!detailOk)msg='Move closer and hold one eye inside the oval.';else msg='Guide aligned — hold still.';
    }
    setMetrics({brightness:q.brightness,contrast:q.contrast,sharpness:q.sharpness,eyeSize:size});setReadiness(Math.min(100,score));setReady(isReady);setGuide(msg);
    return isReady;
  }

  function scanLoop(){
    const v=video.current;if(!v||!streamRef.current){return}
    try{
      if(v.readyState>=2&&v.currentTime!==lastFrameTime.current){
        lastFrameTime.current=v.currentTime;const isReady=evaluateFrame(v);const now=performance.now();
        if(isReady){
          if(stableSince.current===null)stableSince.current=now;
          const held=now-stableSince.current;
          if(phaseRef.current==='scanning'&&held>1100){setPhaseSafe('locked');void beginCountdown()}
        }else{
          stableSince.current=null;if(phaseRef.current==='countdown'||phaseRef.current==='locked')cancelAuto('Alignment lost — hold the eye inside the oval again.');
        }
      }
    }catch(e){console.warn('Frame analysis skipped',e);if(detectorModeRef.current==='mediapipe'){detector.current=null;setMode('guided');setGuide('Detector switched to guided fallback. Keep one eye inside the oval.')}}
    raf.current=requestAnimationFrame(scanLoop);
  }

  async function beginCountdown(){
    const token=++countdownToken.current;setGuide('Perfect position — get ready.');await beep(1080,.24,.42);await sleep(260);
    for(const n of [3,2,1]){
      if(token!==countdownToken.current||!streamRef.current)return;
      setPhaseSafe('countdown');setCount(n);setGuide(`Hold still — capturing in ${n}`);await beep(n===1?1180:900,.13,.36);await sleep(900);
    }
    if(token!==countdownToken.current||!streamRef.current)return;setCount(null);await beep(1380,.2,.46);captureFrame(true);
  }

  function captureFrame(auto=false){
    const v=video.current,c=canvas.current;if(!v||!c||v.videoWidth===0||v.videoHeight===0)return;
    const vw=v.videoWidth,vh=v.videoHeight,box=eyeBox.current;let sx:number,sy:number,cropW:number,cropH:number;
    if(box){const cx=(box.x+box.w/2)*vw,cy=(box.y+box.h/2)*vh;cropW=Math.min(vw,Math.max(box.w*vw*5.6,Math.min(vw*.58,520)));cropH=Math.min(vh,Math.max(box.h*vh*8.0,Math.min(vh*.48,360)));sx=Math.max(0,Math.min(vw-cropW,cx-cropW/2));sy=Math.max(0,Math.min(vh-cropH,cy-cropH/2));}
    else{cropW=vw*.54;cropH=vh*.44;sx=(vw-cropW)/2;sy=(vh-cropH)/2;}
    c.width=760;c.height=Math.max(430,Math.round(760*(cropH/cropW)));const ctx=c.getContext('2d')!;ctx.save();ctx.translate(c.width,0);ctx.scale(-1,1);ctx.drawImage(v,sx,sy,cropW,cropH,0,0,c.width,c.height);ctx.restore();
    const image=c.toDataURL('image/jpeg',.94);setCaptured(image);const report=createPreliminaryReport(image);setPreliminaryReport(report);setPredictionReady(true);setCount(null);setReady(false);setPhaseSafe('captured');stopStream();if(raf.current!==null){cancelAnimationFrame(raf.current);raf.current=null}
    setGuide(auto?'Automatic eye capture complete — preliminary report generated.':'Manual eye capture complete — preliminary report generated.');void beep(1480,.16,.4);setTimeout(()=>predictionRef.current?.scrollIntoView({behavior:'smooth',block:'start'}),380);
  }

  async function pick(f?:File){if(!f)return;setFundus(await toUpload(f,'fundus'));setAi(null)}
  async function analyze(){if(!fundus)return;setBusy(true);try{const result=await runTrainedDRModel({id:uid('patient-preview'),patientId:p.id,phcId:'patient-preview',createdAt:new Date().toISOString(),status:'draft',right:{eye:'right',image:fundus,quality:'good',observations:{}},left:{eye:'left',image:fundus,quality:'good',observations:{}}});setAi(result);const report=createAIReport(result,fundus.dataUrl);setAiReport(report)}catch(e:any){alert(e.message||'Trained retinal model service is unavailable. You can continue to PHC booking.')}finally{setBusy(false)}}
  const risk=p.onboarding?.risk;

  return <>
    <PageTitle title="Guided eye capture" sub="Immediately after your health quiz: align one eye, wait for green, hear the countdown, then continue to screening guidance."/>
    <div className="capture-flowbar"><span className="done">1 Health questions</span><i/><span className="active">2 Eye capture</span><i/><span>3 Retinal screening</span><i/><span>4 PHC / specialist</span></div>
    <div className="capture-layout">
      <section className="capture-stage-card">
        <div className="capture-head"><div><span className="eyebrow">Live guided capture</span><h2>Keep one eye inside the oval</h2></div><span className={`detector-pill ${detectorMode}`}>{detectorMode==='mediapipe'?'Eye AI active':detectorMode==='guided'?'Guided fallback':'Loading detector'}</span></div>
        <div className={`live-capture premium ${ready?'ready':''} ${phase==='countdown'?'counting':''}`}>
          <video ref={video} muted playsInline/>
          <div className="eye-guide"><span/></div>
          <div className="capture-topstatus"><b>{ready?'GOOD POSITION':'ALIGN EYE'}</b><span>{readiness}% ready</span></div>
          <div className="capture-status">{guide}</div>
          {count!==null&&<div className="countdown"><b>{count}</b><span>Hold still</span></div>}
          {phase==='captured'&&<div className="capture-success"><CheckCircle2 size={42}/><b>Captured</b></div>}
        </div>
        <canvas ref={canvas} style={{display:'none'}}/>
        <div className="readiness-track"><div style={{width:`${readiness}%`}}/></div>
        <div className="capture-metrics"><span>Lighting {Math.round(metrics.brightness)}</span><span>Detail {Math.round(metrics.sharpness)}</span><span>{detectorMode==='mediapipe'?'Landmark eye lock':'Guide alignment'}</span><span>Sound enabled after Start</span></div>
        <div className="capture-actions">
          {phase==='idle'||phase==='error'||phase==='captured'?<button className="btn primary" onClick={start}><Camera size={17}/>{captured?'Retake with camera':'Start camera'}</button>:<button className="btn ghost" onClick={stop}>Stop camera</button>}
          <button className="btn soft" disabled={!streamRef.current||phase==='countdown'} onClick={()=>captureFrame(false)}>Manual capture</button><button className="btn ghost" onClick={()=>void beep(1040,.22,.48)}>Test sound</button>
        </div>
        {captured&&<div className="captured-result"><div><span className="eyebrow">Captured eye image</span><h3>Ready for the next step</h3><p>This is an external-eye positioning image, not a retinal diagnosis image.</p></div><img src={captured} alt="Captured eye"/></div>}
      </section>

      <aside className="capture-side">
        <div className="journey-card emphasis"><span className="eyebrow">What happens next</span><h3>Capture → guidance → PHC</h3><div className="journey-list"><div><b>01</b><span><strong>Health context</strong><small>Quiz creates screening urgency.</small></span></div><div><b>02</b><span><strong>Eye capture</strong><small>Positioning workflow confirms usable capture.</small></span></div><div><b>03</b><span><strong>Fundus screening</strong><small>Real retinal image is required for DR grading.</small></span></div><div><b>04</b><span><strong>Specialist review</strong><small>Ophthalmologist owns final assessment.</small></span></div></div></div>
        <div className={`journey-card risk-mini ${risk?.band||'low'}`}><span className="eyebrow">Your current screening urgency</span><h3>{risk?.band?.toUpperCase()||'NOT CALCULATED'}</h3><p>{risk?.nextStep||'Complete the health questionnaire to generate screening guidance.'}</p></div>
        <div className="journey-card"><ShieldAlert size={20}/><h3>No fake diagnosis</h3><p>A phone/laptop camera cannot see the retina well enough to grade diabetic retinopathy. DR severity is only shown for a real fundus image.</p></div>
      </aside>
    </div>

    <div ref={predictionRef} className={`prediction-stage ${predictionReady?'visible':''}`}>
      <div className="prediction-heading"><span className="eyebrow">Screening guidance</span><h2>{predictionReady?'Capture complete — your report is ready':'Complete eye capture to continue'}</h2><p>{predictionReady?'A preliminary screening report has been generated from your entered health information and capture step. Continue with fundus analysis or book a PHC.':'The next step unlocks automatically after capture.'}</p></div>
      {predictionReady&&preliminaryReport&&<div className="preliminary-report-ready"><div className="report-ready-icon"><FileText size={24}/></div><div><span className="eyebrow">Report generated</span><h3>Preliminary Screening Report</h3><p>Includes your entered diabetes/eye history, screening urgency, risk context, capture status and recommended next action.</p><small>{new Date(preliminaryReport.uploadedAt).toLocaleString()} · Saved in Reports</small></div><div className="report-ready-actions">{preliminaryReport.dataUrl&&<a className="btn primary" href={preliminaryReport.dataUrl} download={preliminaryReport.name}><FileDown size={16}/>Download report</a>}<Link className="btn ghost" to="/patient/reports">Open Reports</Link></div></div>}
      {predictionReady&&<div className="grid grid-2">
        <div className={`risk-hero ${risk?.band||'low'}`}><span>Questionnaire-based urgency</span><h2>{risk?.band?.toUpperCase()||'SCREENING RECOMMENDED'}</h2><p>{risk?.nextStep||'Proceed to a PHC for retinal/fundus screening.'}</p><div className="disclaimer">This is triage guidance from entered health context. It is not a diabetic-retinopathy diagnosis.</div><Link className="btn primary" to="/patient/book-screening"><MapPin size={16}/>Find nearby PHC & book</Link></div>
        <div className="card fundus-next"><span className="eyebrow">Have a retinal/fundus image?</span><h3>Run trained retinal screening</h3><p className="muted">Upload a real fundus image from a compatible retinal camera. The model must never run on the external-eye selfie above.</p><div className="upload"><Upload size={20}/><input type="file" accept="image/*" onChange={e=>pick(e.target.files?.[0])}/>{fundus&&<><Status>{fundus.name}</Status>{fundus.dataUrl&&<img className="fundus-preview" src={fundus.dataUrl} alt="Fundus preview"/>}</>}</div><button className="btn primary" disabled={!fundus||busy} onClick={analyze}>{busy?'Analyzing retinal image…':'Analyze fundus image'}</button></div>
      </div>}
      {ai&&<div className="ai-result-premium"><div><span className="eyebrow">AI Screening Recommendation</span><h2>Level {ai.severity} · {ai.referable?'Referable':'Non-referable'}</h2><p>{ai.explanation}</p>{aiReport?.dataUrl&&<a className="btn soft" href={aiReport.dataUrl} download={aiReport.name}><FileDown size={16}/>Download AI screening report</a>}</div><div className="ai-confidence"><strong>{Math.round(ai.confidence*100)}%</strong><span>model confidence</span></div><div className="disclaimer">Trained-model screening support only. Final assessment must be completed by an ophthalmologist.</div></div>}
    </div>
  </>
}
function downloadFinal(p:PatientProfile,s:any){const doc=new jsPDF();doc.setFontSize(19);doc.text('DRISHTI-AI — Retinal Screening Report',16,18);doc.setFontSize(10);let y=31;const rows=[['Patient',p.name],['Screening date',new Date(s.createdAt).toLocaleString()],['Right-eye quality',s.right.quality],['Left-eye quality',s.left.quality],['AI screening recommendation',s.aiResult?`Level ${s.aiResult.severity} — ${s.aiResult.referable?'Referable':'Non-referable'}`:''],['AI confidence',s.aiResult?`${Math.round(s.aiResult.confidence*100)}%`:``],['Ophthalmologist final assessment',`Level ${s.doctorReview.finalSeverity} — ${s.doctorReview.referable?'Referable':'Non-referable'}`],['Doctor notes',s.doctorReview.notes||''],['Follow-up',s.doctorReview.followUpDate||'']];for(const[a,b]of rows){if(!b)continue;doc.setFont('helvetica','bold');doc.text(a+':',16,y);doc.setFont('helvetica','normal');const lines=doc.splitTextToSize(String(b),128);doc.text(lines,72,y);y+=Math.max(8,lines.length*5)}doc.setFontSize(8);doc.text('AI screening support is not a guaranteed diagnosis. Final clinical assessment is clinician-entered.',16,285);doc.save(`DRISHTI-AI-${p.name.replace(/\s+/g,'-')}.pdf`)}
function F({label,v,set,type='text'}:{label:string;v:string;set:(v:string)=>void;type?:string}){return <div className="field"><label>{label}</label><input className="input" type={type} value={v} onChange={e=>set(e.target.value)}/></div>}
function K({t,n}:{t:string;n:string|number}){return <div className="card"><span className="small">{t}</span><div className="kpi small-kpi">{n}</div></div>}
