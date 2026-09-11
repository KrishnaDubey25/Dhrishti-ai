import {Navigate,Route,Routes} from 'react-router-dom';
import {Protected} from './components/Protected';
import {About,Home,HowItWorks,Patients,Providers} from './pages/PublicPages';
import {Forgot,Login,Register} from './pages/AuthPages';import {PHCRegister} from './pages/PHCRegister';import {DoctorRegister} from './pages/DoctorRegister';
import {Demo} from './pages/Demo';
import {PatientShell} from './pages/PatientPortal';
import {AppointmentDetail,PHCShell,ScreeningWorkspace} from './pages/PHCPortal';
import {DoctorCase,DoctorPatient,DoctorShell} from './pages/DoctorPortal';
export default function App(){return <Routes>
<Route path="/" element={<Home/>}/><Route path="/how-it-works" element={<HowItWorks/>}/><Route path="/patients" element={<Patients/>}/><Route path="/providers" element={<Providers/>}/><Route path="/about" element={<About/>}/><Route path="/demo" element={<Demo/>}/><Route path="/login" element={<Login/>}/><Route path="/register" element={<Register/>}/><Route path="/forgot" element={<Forgot/>}/><Route path="/register-phc" element={<PHCRegister/>}/><Route path="/register-doctor" element={<DoctorRegister/>}/>
{[['dashboard','dashboard'],['profile','profile'],['medical-history','history'],['reports','reports'],['book-screening','book'],['eye-capture','capture'],['screenings','screenings'],['results','results'],['referrals','referrals'],['notifications','notifications']].map(([p,v])=><Route key={p} path={`/patient/${p}`} element={<Protected role="patient"><PatientShell view={v}/></Protected>}/>) }
{[['dashboard','dashboard'],['appointments','appointments'],['patients','patients'],['new-patient','new'],['screenings','screenings'],['reports','reports'],['referrals','referrals'],['consultations','consultations']].map(([p,v])=><Route key={p} path={`/phc/${p}`} element={<Protected role="phc"><PHCShell view={v}/></Protected>}/>) }
<Route path="/phc/appointment/:id" element={<Protected role="phc"><AppointmentDetail/></Protected>}/><Route path="/phc/screen/:appointmentId" element={<Protected role="phc"><ScreeningWorkspace/></Protected>}/>
{[['dashboard','dashboard'],['reviews','reviews'],['cases','cases'],['reports','reports'],['history','history'],['referrals','referrals'],['patients','patients'],['consultations','consultations']].map(([p,v])=><Route key={p} path={`/doctor/${p}`} element={<Protected role="doctor"><DoctorShell view={v}/></Protected>}/>) }
<Route path="/doctor/cases/:id" element={<Protected role="doctor"><DoctorCase/></Protected>}/><Route path="/doctor/patient/:id" element={<Protected role="doctor"><DoctorPatient/></Protected>}/><Route path="*" element={<Navigate to="/" replace/>}/>
</Routes>}
