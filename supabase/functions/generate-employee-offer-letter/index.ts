import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, AlignmentType, BorderStyle, ShadingType } from "npm:docx@9.5.1";

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const green = "216B3B";
const safe = (v: unknown) => String(v ?? "").trim();
const dateText = (v: string) => v ? new Date(v + (v.length===10 ? "T00:00:00" : "")).toLocaleDateString("en-IN",{day:"2-digit",month:"long",year:"numeric"}) : "—";
const inr = (n: number) => "INR " + Math.round(n||0).toLocaleString("en-IN");
function para(text:string, opts:any={}) { return new Paragraph({ spacing:{after:opts.after??100}, alignment:opts.align, children:[new TextRun({text,bold:!!opts.bold,color:opts.color||"26382B",size:opts.size||20,font:"Arial"})] }); }
function heading(text:string){return new Paragraph({spacing:{before:220,after:100},children:[new TextRun({text,bold:true,color:green,size:22,font:"Arial"})]});}
function cell(text:string, header=false){return new TableCell({width:{size:50,type:WidthType.PERCENTAGE},shading:header?{fill:"EFF6EF",type:ShadingType.CLEAR}:undefined,margins:{top:90,bottom:90,left:120,right:120},children:[new Paragraph({children:[new TextRun({text,bold:header,color:header?green:"26382B",size:18,font:"Arial"})]})]});}
Deno.serve(async (req:Request)=>{
 if(req.method==="OPTIONS")return new Response("ok",{headers:cors});
 try {
  const url=Deno.env.get("SUPABASE_URL")!, anon=Deno.env.get("SUPABASE_ANON_KEY")!, service=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const auth=req.headers.get("Authorization")||"";
  if(!auth.startsWith("Bearer "))return new Response(JSON.stringify({error:"Authentication required"}),{status:401,headers:{...cors,"Content-Type":"application/json"}});
  const userClient=createClient(url,anon,{global:{headers:{Authorization:auth}}});
  const {data:{user},error:userErr}=await userClient.auth.getUser();
  if(userErr||!user)return new Response(JSON.stringify({error:"Invalid session"}),{status:401,headers:{...cors,"Content-Type":"application/json"}});
  const admin=createClient(url,service);
  const [{data:profile},{data:hrProfile}]=await Promise.all([
   admin.from("oms_profiles").select("role,active").eq("user_id",user.id).maybeSingle(),
   admin.from("vvhr_user_profiles").select("role").eq("user_id",user.id).maybeSingle()
  ]);
  const authorised=(profile?.active===true&&profile.role==="admin")||hrProfile?.role==="admin";
  if(!authorised)return new Response(JSON.stringify({error:"HR/Admin access required"}),{status:403,headers:{...cors,"Content-Type":"application/json"}});
  const body=await req.json(), employeeId=safe(body.employee_id);
  if(!employeeId)return new Response(JSON.stringify({error:"employee_id is required"}),{status:400,headers:{...cors,"Content-Type":"application/json"}});
  const {data:e,error:eErr}=await admin.from("vvhr_employees").select("id,employee_code,full_name,mobile,email,address,designation,department,joining_date,monthly_fixed_salary,employment_status").eq("id",employeeId).single();
  if(eErr||!e)return new Response(JSON.stringify({error:eErr?.message||"Employee not found"}),{status:404,headers:{...cors,"Content-Type":"application/json"}});
  const {data:existing}=await admin.from("vvhr_employee_documents").select("id,storage_path").eq("employee_id",e.id).eq("document_type","offer_letter").maybeSingle();
  const monthly=Number(e.monthly_fixed_salary||0), annual=monthly*12, today=new Date();
  const ref="VV/HR/OL/"+today.getFullYear()+"/"+safe(e.employee_code).replace(/[^A-Za-z0-9-]/g,"");
  const name=safe(e.full_name), first=name.split(/\s+/)[0]||name, location=safe(e.address)||"H133-A, Platinum Paradise, Near Malwa College, Indore, MP - 452016 (or assigned branch/field location)";
  const rows=[
   new TableRow({children:[cell("Designation / Role",true),cell(safe(e.designation)||"As assigned")]}),
   new TableRow({children:[cell("Department & Reporting",true),cell((safe(e.department)||"—")+" | Reporting to: As assigned")]}),
   new TableRow({children:[cell("Employee Code",true),cell(safe(e.employee_code))]}),
   new TableRow({children:[cell("Date of Joining",true),cell(dateText(e.joining_date))]}),
   new TableRow({children:[cell("Work Location",true),cell(location)]}),
   new TableRow({children:[cell("Working Days & Timing",true),cell("6 Days a Week (Monday to Saturday) | 10:00 AM to 07:00 PM")]}),
   new TableRow({children:[cell("Probation Period",true),cell("6 Months from the Date of Joining")]}),
   new TableRow({children:[cell("Annual Compensation (CTC)",true),cell(inr(annual)+" per annum ("+inr(monthly)+" per month)")]}),
  ];
  const doc=new Document({sections:[{properties:{page:{margin:{top:850,right:850,bottom:850,left:850}}},children:[
   para("VERMIVEDA",{bold:true,color:green,size:34,align:AlignmentType.RIGHT,after:20}),
   para("WISDOM OF NATURE, POWER OF SOIL",{bold:true,color:"6A8C5D",size:16,align:AlignmentType.RIGHT,after:30}),
   para("H133-A, Platinum Paradise, Near Malwa College, Indore, Madhya Pradesh - 452016",{size:15,align:AlignmentType.RIGHT,after:10}),
   para("GSTIN: 23ABBFV4656M1ZT | info.vermiveda@gmail.com | www.vermiveda.com",{size:15,align:AlignmentType.RIGHT,after:180}),
   new Paragraph({border:{bottom:{style:BorderStyle.SINGLE,size:12,color:green,space:8}},spacing:{after:240},children:[]}),
   para("OFFER OF EMPLOYMENT",{bold:true,color:green,size:28,align:AlignmentType.CENTER,after:180}),
   para("Ref. No.: "+ref+"                                      Date: "+dateText(today.toISOString().slice(0,10)),{bold:true,after:180}),
   para("To,",{bold:true}),para(name,{bold:true}),para(location),para("Email: "+(safe(e.email)||"—")+" | Mobile: "+(safe(e.mobile)||"—"),{after:180}),
   para("Subject: Offer of Employment for the Position of "+(safe(e.designation)||"Employee"),{bold:true,color:green,after:180}),
   para("Dear "+first+",",{after:130}),
   para("Following our recent discussions and your successful interview process, we are pleased to offer you employment with VermiVeda (the Company) in the capacity of "+(safe(e.designation)||"Employee")+" in the "+(safe(e.department)||"assigned")+" department. We believe your skills, experience, and dedication will be a valuable asset to our mission and growth.",{after:130}),
   para("This offer of employment is governed by the key terms and conditions outlined below:",{after:120}),
   new Table({width:{size:100,type:WidthType.PERCENTAGE},columnWidths:[4200,5200],rows}),
   heading("1. Compensation & Tax Deductions"),
   para("Your total annual compensation (CTC) will be "+inr(annual)+" per annum ("+inr(monthly)+" per month). Salary component-wise breakup shall be as per the approved salary structure maintained by HR. No statutory deductions such as PF or ESIC are applicable; only Tax Deducted at Source (TDS) will be deducted as per prevailing Government of India Income Tax rules."),
   heading("2. Probation & Confirmation"),
   para("You will initially be on probation for a period of 6 (six) months from your date of joining, which may be extended at the sole discretion of the management based on your performance review. Upon satisfactory completion of the probation period, your services will be confirmed in writing."),
   heading("3. Working Hours, Roles & Transfer"),
   para("Your regular working schedule will be 6 days a week from 10:00 AM to 07:00 PM. You shall diligently perform all duties assigned to your role and comply with Company policies, code of conduct and operational guidelines. The Company reserves the right to transfer or depute you to any office, production unit or field location based on business requirements."),
   heading("4. Leave & Holidays"),
   para("You will be entitled to leaves and public holidays in accordance with VermiVeda's HR Leave Policy in force from time to time."),
   heading("5. Confidentiality & Intellectual Property"),
   para("During and after your employment, you shall maintain strict confidentiality regarding all proprietary data, formulations, processes, customer lists, pricing and business strategies of VermiVeda. All inventions, processes or materials developed during your employment shall remain the exclusive intellectual property of the Company."),
   heading("6. Exclusivity of Service"),
   para("During your employment with VermiVeda, you shall devote your full working time and attention to the Company and shall not engage in any other employment, business, consultancy or advisory role without prior written consent."),
   heading("7. Notice Period & Termination"),
   para("Both during the probation period and post-confirmation, termination of employment by either party shall require 30 (thirty) days' prior written notice or salary in lieu thereof, subject to management approval and proper handover of Company assets and responsibilities. The Company reserves the right to terminate services immediately in case of misconduct, breach of trust or violation of Company policies."),
   heading("8. Background Verification & Documents"),
   para("This offer is contingent upon satisfactory verification of educational qualifications, prior employment records and identity proof. Please submit self-attested copies of the documents listed below on or before your joining date."),
   para("Mandatory joining documents: Aadhaar Card and PAN Card; educational certificates (10th, 12th, Graduation/Post-Graduation as applicable); previous employment records if experienced; cancelled cheque or bank passbook front page showing account number and IFSC; four recent passport-size colour photographs.",{after:160}),
   para("Please sign and return a duplicate copy of this letter as a token of your acceptance of this offer.",{after:260}),
   para("For VermiVeda,                                                                 CANDIDATE ACCEPTANCE",{bold:true,color:green,after:220}),
   para("__________________________________                              __________________________________"),
   para("SURAJ VISHWAKARMA                                                        Signature of Candidate",{bold:true}),
   para("Partner & HR Head                                                            Name: "+name),
   para("Date: "+dateText(today.toISOString().slice(0,10))+"                                              Confirmed Joining Date: ______________"),
   new Paragraph({pageBreakBefore:true,children:[]}),
   para("VERMIVEDA | ANNEXURE-A & ANNEXURE-B",{bold:true,color:green,size:24,align:AlignmentType.CENTER,after:220}),
   heading("ANNEXURE - A: COMPENSATION STRUCTURE (SALARY BREAKUP)"),
   para("Employee Name: "+name+" | Designation: "+(safe(e.designation)||"—")),
   new Table({width:{size:100,type:WidthType.PERCENTAGE},columnWidths:[4200,2600,2600],rows:[
    new TableRow({children:[cell("Salary Component",true),cell("Monthly (INR)",true),cell("Annual (INR)",true)]}),
    ...["Basic Salary","House Rent Allowance (HRA)","Conveyance / Travel Allowance","Special / Other Allowance","Performance / Variable Incentive (if applicable)"].map(x=>new TableRow({children:[cell(x,true),cell("As per approved salary breakup"),cell("As per approved salary breakup")]})),
    new TableRow({children:[cell("TOTAL GROSS COMPENSATION (CTC)",true),cell(inr(monthly),true),cell(inr(annual),true)]})
   ]}),
   para("Note: Monthly and annual component-wise salary values will be governed by the approved salary structure on record.",{after:180}),
   heading("ANNEXURE - B: MANDATORY DOCUMENTS REQUIRED ON DATE OF JOINING"),
   para("Please bring originals for verification along with one set of self-attested photocopies of the following documents:"),
   para("☐ Identity & Address Proof: Aadhaar Card and PAN Card (Mandatory for TDS & KYC)."),
   para("☐ Educational Certificates: 10th, 12th, Graduation / Post-Graduation mark sheets and degree certificates."),
   para("☐ Previous Employment Records (if experienced): Relieving Letter, Experience Certificate, and last 3 months' salary slips / bank statement."),
   para("☐ Bank Account Details: Cancelled cheque or front page of bank passbook showing Account Number and IFSC Code."),
   para("☐ Photographs: Four (4) recent passport-size colour photographs."),
   para("VermiVeda • H133-A, Platinum Paradise, Near Malwa College, Indore (M.P.) - 452016 • www.vermiveda.com",{color:"718077",size:14,align:AlignmentType.CENTER,after:0})
  ]}]});
  const buffer=await Packer.toBuffer(doc);
  const path=e.id+"/"+e.employee_code+"_Offer_Letter.docx";
  const {error:uploadErr}=await admin.storage.from("vvhr-employee-documents").upload(path,buffer,{contentType:"application/vnd.openxmlformats-officedocument.wordprocessingml.document",upsert:true});
  if(uploadErr)throw uploadErr;
  if(existing?.storage_path&&existing.storage_path!==path)await admin.storage.from("vvhr-employee-documents").remove([existing.storage_path]);
  const record={employee_id:e.id,document_type:"offer_letter",file_name:e.employee_code+"_Offer_Letter.docx",storage_path:path};
  const saved=existing?await admin.from("vvhr_employee_documents").update(record).eq("id",existing.id):await admin.from("vvhr_employee_documents").insert(record);
  if(saved.error)throw saved.error;
  return new Response(JSON.stringify({success:true,employee_code:e.employee_code,file_name:record.file_name}),{headers:{...cors,"Content-Type":"application/json"}});
 } catch(error) {
  return new Response(JSON.stringify({error:error?.message||String(error)}),{status:500,headers:{...cors,"Content-Type":"application/json"}});
 }
});