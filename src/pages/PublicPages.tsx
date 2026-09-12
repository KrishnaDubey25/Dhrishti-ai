import {motion} from 'framer-motion';
import {ArrowRight,BrainCircuit,Building2,Camera,CheckCircle2,Eye,FileCheck2,HeartPulse,ShieldCheck,Stethoscope,Video,Newspaper,Globe2,Sparkles,MapPin,ExternalLink,Activity,Languages,Network} from 'lucide-react';
import {Link} from 'react-router-dom';
import {Footer,PublicNav} from '../components/Common';

const roleCards=[
 {title:'Patient',desc:'Create your health profile, complete risk questions, prepare for retinal screening and book a PHC visit.',icon:HeartPulse,to:'/register',cta:'Start as Patient'},
 {title:'PHC Center',desc:'Register a centre, receive bookings, capture/import fundus images, run quality gates and create screening reports.',icon:Building2,to:'/register-phc',cta:'PHC Workspace'},
 {title:'Retina Specialist',desc:'Review fundus screening evidence, confirm or modify AI recommendations, create care plans and follow-up.',icon:Stethoscope,to:'/register-doctor',cta:'Specialist Workspace'}
];
export function Home(){
const evidence=[
 {value:'89.8M',label:'Adults living with diabetes in India (2024)',source:'IDF Diabetes Atlas 2025'},
 {value:'156.7M',label:'Projected adults with diabetes in India by 2050',source:'IDF Diabetes Atlas 2025'},
 {value:'80%',label:'WHO regional target for regular retinopathy screening among people with diabetes by 2030',source:'WHO South-East Asia'},
 {value:'1 in 7',label:'Adults living with diabetes worldwide accounted for by India',source:'IDF South-East Asia'}
];
const updates=[
 {date:'10 Sep 2026',tag:'WHO South-East Asia',title:'Regional digital-health and AI collaboration strengthened',text:'WHO South-East Asia Member States established a regional collaborative network to share practical approaches for responsible digital health and AI.',href:'https://www.who.int/southeastasia/news/detail/10-09-2026-who-south-east-asia-regional-committee-session-concludes-with-landmark-decisions-to-advance-equity-and-health-for-all'},
 {date:'10 Jun 2026',tag:'Primary care + AI',title:'WHO SEARO and The George Institute expand evidence-based digital health work',text:'The collaboration focuses on designing, evaluating and scaling digital-health and AI interventions for primary care and non-communicable diseases.',href:'https://www.who.int/southeastasia/news/detail/10-06-2026-who-searo-and-the-george-institute-for-global-health-india-collaborate-on-digital-health-and-ai-for-primary-care-and-non-communicable-diseases'},
 {date:'14 Apr 2026',tag:'Eye health',title:'WHO eye-health meeting report reinforces integrated screening and referral',text:'The regional report highlights diabetic retinopathy as a major contributor to avoidable visual impairment and calls for stronger integrated eye-care pathways.',href:'https://www.who.int/publications/i/item/sea-hdc-2'}
];
return <div className="public-page premium-public"><PublicNav/>
<section className="container premium-hero">
  <motion.div className="premium-hero-copy" initial={{opacity:0,y:22}} animate={{opacity:1,y:0}} transition={{duration:.55}}>
    <div className="hero-kicker"><span className="live-pulse"/> AI-assisted retinal screening · Human-led care</div>
    <h1>From the first risk signal to the <span>right retina specialist.</span></h1>
    <p>DRISHTI‑AI brings patient context, PHC screening, retinal image quality, trained-model support, structured clinical reporting and specialist review into one connected pathway—designed for real screening workflows, not a one-screen AI demo.</p>
    <div className="hero-ctas">
      <Link to="/register" className="btn primary">Start Patient Journey <ArrowRight size={17}/></Link>
      <Link to="/demo" className="btn soft"><Sparkles size={16}/> Watch Full Demo</Link>
      <Link to="/providers" className="btn ghost">For PHCs & Specialists</Link>
    </div>
    <div className="hero-language"><Languages size={15}/><span>Built for multilingual care:</span><b>English</b><b>हिन्दी</b><b>मराठी</b></div>
    <div className="trust premium-trust"><span><ShieldCheck size={14}/> No fake diagnosis</span><span><Camera size={14}/> Fundus-first DR analysis</span><span><Stethoscope size={14}/> Ophthalmologist final assessment</span></div>
  </motion.div>

  <motion.div className="care-command" initial={{opacity:0,scale:.94,y:18}} animate={{opacity:1,scale:1,y:0}} transition={{duration:.65,delay:.08}}>
    <div className="care-command-top"><div><small>LIVE CARE PATHWAY</small><b>Patient → PHC → Specialist</b></div><span><Activity size={15}/> Connected</span></div>
    <div className="retina-command-visual">
      <div className="retina premium-retina"><div className="scan"/><div className="retina-pulse"/></div>
      <div className="orbit orbit-a"><HeartPulse size={17}/><span>Patient<br/><b>Risk context</b></span></div>
      <div className="orbit orbit-b"><Building2 size={17}/><span>PHC<br/><b>Fundus screening</b></span></div>
      <div className="orbit orbit-c"><Stethoscope size={17}/><span>Specialist<br/><b>Final review</b></span></div>
    </div>
    <div className="command-status-grid">
      <div><span>01</span><b>Quality Gate</b><small>Reject poor retinal inputs</small></div>
      <div><span>02</span><b>AI Support</b><small>Grade + confidence</small></div>
      <div><span>03</span><b>Clinical Report</b><small>PHC findings + labs</small></div>
      <div><span>04</span><b>Specialist Connect</b><small>Review / video consult</small></div>
    </div>
  </motion.div>
</section>

<section className="evidence-band">
 <div className="container evidence-grid">{evidence.map((x,i)=><motion.div key={x.value} className="evidence-stat" initial={{opacity:0,y:16}} whileInView={{opacity:1,y:0}} viewport={{once:true}} transition={{delay:i*.06}}><strong>{x.value}</strong><p>{x.label}</p><small>{x.source}</small></motion.div>)}</div>
</section>

<section className="container pathway-section">
 <div className="section-heading left-heading"><span className="eyebrow">One connected care record</span><h2>Every step answers one clinical question.</h2><p>What is the patient’s risk context? Is the retinal image usable? What does the screening model suggest? Who needs specialist review next?</p></div>
 <div className="pathway-grid">
   {[['01','Prepare','Patient profile, diabetes context and existing reports.',HeartPulse],['02','Capture','Right and left fundus images with image-quality checks.',Camera],['03','Analyze','DR severity, confidence and explainability from the trained model.',BrainCircuit],['04','Report','Detailed PHC clinical findings with only documented data.',FileCheck2],['05','Connect','Async retina review or direct video consultation.',Video],['06','Finalize','Ophthalmologist assessment, referral and follow-up.',Stethoscope]].map(([n,t,d,I]:any,i)=><motion.div className="pathway-card" key={n} initial={{opacity:0,y:18}} whileInView={{opacity:1,y:0}} viewport={{once:true}} transition={{delay:i*.05}}><div className="pathway-number">{n}</div><I size={22}/><h3>{t}</h3><p>{d}</p></motion.div>)}
 </div>
</section>

<section className="container role-zone premium-role-zone"><div className="section-heading"><span className="eyebrow">Role-specific experience</span><h2>One platform. Three focused workspaces.</h2><p>No admin clutter. Each role sees the tools needed for its part of the care pathway.</p></div><div className="role-grid">{roleCards.map((r,i)=>{const I=r.icon;return <motion.div className="role-card premium-role-card" key={r.title} initial={{opacity:0,y:18}} whileInView={{opacity:1,y:0}} viewport={{once:true}} transition={{delay:i*.08}}><div className="role-icon"><I size={26}/></div><h3>{r.title}</h3><p>{r.desc}</p><Link to={r.to} className="role-link">{r.cta}<ArrowRight size={16}/></Link></motion.div>})}</div></section>

<section className="updates-zone">
 <div className="container">
  <div className="updates-heading"><div><span className="eyebrow dark-eyebrow"><Newspaper size={14}/> Evidence & health-system updates</span><h2>Built around where eye care is heading.</h2><p>Curated, source-linked updates relevant to digital health, primary care, diabetic retinopathy screening and specialist access.</p></div><div className="updates-reviewed"><Globe2 size={18}/><span>Verified sources<br/><b>Reviewed Sep 2026</b></span></div></div>
  <div className="updates-grid">{updates.map((u,i)=><motion.a href={u.href} target="_blank" rel="noreferrer" className="update-card" key={u.title} initial={{opacity:0,y:18}} whileInView={{opacity:1,y:0}} viewport={{once:true}} transition={{delay:i*.08}}><div className="update-meta"><span>{u.date}</span><b>{u.tag}</b></div><h3>{u.title}</h3><p>{u.text}</p><span className="read-source">Read source <ExternalLink size={14}/></span></motion.a>)}</div>
 </div>
</section>

<section className="container demo-context">
 <div className="demo-context-main"><span className="eyebrow"><MapPin size={14}/> Mumbai-ready demo story</span><h2>Show the full journey, not disconnected screens.</h2><p>For an Andheri / Mumbai PHC, NGO or community-screening demo, present one patient record moving from onboarding to fundus screening, detailed PHC report, specialist review and video consultation. Demo data stays isolated from real patient data.</p><div className="hero-ctas"><Link to="/demo" className="btn primary">Open End-to-End Demo <ArrowRight size={16}/></Link><Link to="/how-it-works" className="btn ghost">See How It Works</Link></div></div>
 <div className="demo-proof"><Network size={28}/><h3>Demo narrative</h3><div><span>Patient</span><i/><span>PHC</span><i/><span>AI Support</span><i/><span>Retina Specialist</span></div><small>Same record · clear hand-offs · human final decision</small></div>
</section>

<section className="container safety-callout"><div><ShieldCheck size={28}/><span><small>Clinical safety by design</small><b>AI screening support ≠ final diagnosis</b><p>DRISHTI‑AI shows model-supported screening information, documented PHC findings and source-linked evidence without inventing tests or lesion findings that were never performed.</p></span></div><Link className="btn soft" to="/about">Read our safety approach</Link></section>
<Footer/></div>}

function PublicInfo({title,lead,items}:{title:string;lead:string;items:[string,string,any][]}){return <div><PublicNav/><section className="container section"><span className="eyebrow">DRISHTI‑AI</span><h2>{title}</h2><p className="lead">{lead}</p><div className="feature-grid">{items.map(([a,b,I])=><motion.div className="feature" key={a} initial={{opacity:0,y:12}} whileInView={{opacity:1,y:0}} viewport={{once:true}}><I size={24} color="#176B68"/><h3>{a}</h3><p>{b}</p></motion.div>)}</div></section><Footer/></div>}
export const HowItWorks=()=> <PublicInfo title="A clinically safer screening pathway." lead="Questionnaire context helps prioritize screening; diabetic retinopathy classification itself requires retinal/fundus imaging—not an ordinary selfie of the eye." items={[["1. Patient preparation","Health history and known DR risk factors create a screening-urgency signal. It is not a diagnostic probability.",FileCheck2],["2. Fundus acquisition","PHC or compatible fundus-camera workflows provide right/left retinal images. Ungradable images stop before AI.",Camera],["3. AI + specialist review","A trained DR model supplies screening support and explainability; a retina specialist makes the final clinical assessment.",Stethoscope]]}/>;
export const Patients=()=> <PublicInfo title="Prepare, screen and follow up with less confusion." lead="Patients can create an account, complete a guided health history, upload existing reports, locate registered PHCs, book screening and receive reviewed results." items={[["Health context","Simple questions cover diabetes duration, HbA1c/BP when known, prior eye exams and retinal history.",HeartPulse],["Capture guidance","A camera workflow can assist eye positioning, but retinal disease analysis is only enabled for fundus images.",Eye],["Next action","Results prioritize the safest next step: routine screening, PHC screening or prompt specialist review.",CheckCircle2]]}/>;
export const Providers=()=> <PublicInfo title="PHC screening and specialist review in one record." lead="The provider workflow supports fundus-image import, image-quality gating, trained-model inference, structured observations, referral and tele-ophthalmology." items={[["Interoperable intake","Designed for JPEG/PNG and DICOM/file-based camera adapters; device-specific USB/Wi‑Fi integrations can plug in later.",Camera],["Explainable screening","Model severity, confidence and Grad-CAM can be reviewed alongside clinical observations.",BrainCircuit],["Remote specialist","PHCs can request a retina specialist review and schedule a video consultation for patients who are far away.",Video]]}/>;
export const About=()=> <PublicInfo title="Designed to avoid fake certainty." lead="DRISHTI‑AI is a decision-support workflow. It does not label research-model output as guaranteed diagnosis, and it never invents lesion findings that a model or clinician did not actually provide." items={[["Quality gate","Ungradable fundus images are rejected for recapture instead of forcing a prediction.",ShieldCheck],["Human finalization","AI recommendation and ophthalmologist final assessment remain visibly separate.",Stethoscope],["Replaceable services","Camera, quality, AI, storage, auth and telemedicine layers are modular integration points.",CheckCircle2]]}/>;
