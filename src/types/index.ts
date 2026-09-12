export type Role='patient'|'phc'|'doctor';
export type Severity=0|1|2|3|4;
export type Quality='good'|'enhance'|'unusable';
export type RiskBand='low'|'moderate'|'high';
export interface User{ id:string; role:Role; name:string; email:string; password:string; phcId?:string; firstLogin?:boolean; }
export interface UploadRecord{ id:string; name:string; type:string; size:number; dataUrl?:string; uploadedAt:string; source?:'patient'|'fundus-camera'|'camera'; patientId?:string; category?:'medical-upload'|'preliminary-screening'|'ai-screening'; generated?:boolean; }
export interface RiskAssessment{ band:RiskBand; score:number; reasons:string[]; nextStep:string; calculatedAt:string; method:string; }
export interface OnboardingData{ diabetesStatus:string; duration:string; treatment:string; medication:string; hba1c?:string; systolicBP?:string; cholesterol?:string; previousEyeExam:string; eyeProblems:string; symptoms:string; drHistory:string; medicalContext:string; currentTreatment:string; uploadedReports:UploadRecord[]; risk?:RiskAssessment; }
export interface PatientProfile{ id:string; userId:string; name:string; email:string; phone?:string; dob?:string; gender?:string; address?:string; emergencyContact?:string; profileComplete:number; onboarding?:OnboardingData; }
export interface PHC{ id:string; name:string; code:string; location:string; contact:string; responsible:string; latitude?:number; longitude?:number; services?:string[]; }
export interface Appointment{ id:string; patientId:string; phcId:string; date:string; slot:string; status:'booked'|'arrived'|'registered'|'screening'|'completed'|'cancelled'; initialReportId?:string; createdAt:string; notes?:string; }
export interface ClinicalObservation{ visualAcuity?:string; retinalStructure?:string; opticDisc?:string; macula?:string; vessels?:string; microaneurysm?:string; hemorrhage?:string; exudate?:string; other?:string; notes?:string; }
export interface EyeScreening{ eye:'right'|'left'; image?:UploadRecord; quality:Quality; qualityScore?:number; qualityGuidance?:string; qualityMethod?:string; enhancementApplied?:boolean; observations:ClinicalObservation; }
export interface EyeAIResult{ severity:Severity; label:string; confidence:number; probabilities:number[]; }
export interface AIResult{ severity:Severity; confidence:number; referable:boolean; findings:string[]; explanation:string; disclaimer:string; simulated:boolean; model?:{name:string;source:string;version:string}; perEye?:{right:EyeAIResult;left:EyeAIResult}; heatmaps?:{right?:string;left?:string}; }
export interface DoctorReview{ doctorId:string; finalSeverity:Severity; referable:boolean; notes:string; confirmedAI:boolean; finalizedAt:string; referralId?:string; followUpDate?:string; }
export interface Screening{ id:string; appointmentId?:string; patientId:string; phcId:string; createdAt:string; right:EyeScreening; left:EyeScreening; status:'draft'|'submitted'|'reviewed'; aiResult?:AIResult; doctorReview?:DoctorReview; }
export interface Referral{ id:string; patientId:string; screeningId:string; reason:string; severity:Severity; specialist:string; date?:string; status:'recommended'|'scheduled'|'completed'; notes:string; }
export interface FollowUp{ id:string; patientId:string; doctorId:string; date:string; status:'planned'|'completed'|'missed'; notes?:string; }
export interface CarePlan{ id:string; patientId:string; doctorId:string; createdAt:string; updatedAt:string; medicines:string; diet:string; routine:string; monitoring:string; precautions:string; goals:string; }
export interface ProgressEntry{ id:string; patientId:string; authorId:string; createdAt:string; glucose?:string; visionNotes?:string; adherence?:string; notes:string; }
export interface Consultation{ id:string; patientId:string; phcId?:string; doctorId?:string; screeningId?:string; scheduledAt:string; status:'requested'|'scheduled'|'completed'|'cancelled'; reason:string; roomId:string; notes?:string; }
export interface Notification{ id:string; userId:string; title:string; message:string; createdAt:string; read:boolean; }
