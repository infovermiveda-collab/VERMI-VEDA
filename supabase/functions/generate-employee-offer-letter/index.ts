import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { PDFDocument, StandardFonts, rgb } from "npm:pdf-lib@1.17.1";
import { Resvg } from "npm:@resvg/resvg-js";

const cors={ "Access-Control-Allow-Origin":"*", "Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods":"POST, OPTIONS" };
const green=rgb(0.10,0.36,0.20), ink=rgb(0.14,0.20,0.16), muted=rgb(0.40,0.47,0.42), pale=rgb(0.93,0.96,0.93);
const safe=(v:unknown)=>String(v??"").trim();
const dateText=(v:string)=>v?new Date(v+(v.length===10?"T00:00:00":"")).toLocaleDateString("en-IN",{day:"2-digit",month:"long",year:"numeric"}):"—";
const inr=(n:number)=>"Rs. "+Math.round(n||0).toLocaleString("en-IN");
async function brandSvg(path:string):Promise<Uint8Array>{
 const r=await fetch("https://raw.githubusercontent.com/infovermiveda-collab/VERMI-VEDA/hr-module-dev/"+path);
 if(!r.ok)throw new Error("Unable to load Vermi Veda artwork: "+path);
 return new Uint8Array(await r.arrayBuffer());
}
Deno.serve(async(req:Request)=>{
 if(req.method==="OPTIONS")return new Response("ok",{headers:cors});
 try{
  const url=Deno.env.get("SUPABASE_URL")!,anon=Deno.env.get("SUPABASE_ANON_KEY")!,service=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
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
  if(!((profile?.active===true&&profile.role==="admin")||hrProfile?.role==="admin"))
   return new Response(JSON.stringify({error:"HR/Admin access required"}),{status:403,headers:{...cors,"Content-Type":"application/json"}});
  const body=await req.json(),employeeId=safe(body.employee_id);
  if(!employeeId)throw new Error("employee_id is required");
  const {data:e,error:eErr}=await admin.from("vvhr_employees").select("id,employee_code,full_name,mobile,email,address,designation,department,joining_date,monthly_fixed_salary,employment_status").eq("id",employeeId).single();
  if(eErr||!e)throw new Error(eErr?.message||"Employee not found");
  const [logoSvg,signatureSvg]=await Promise.all([brandSvg("vermi-veda-logo.svg"),brandSvg("vermi-veda-signature.svg")]);
  const logoPng=new Resvg(new TextDecoder().decode(logoSvg),{fitTo:{mode:"width",value:900}}).render().asPng();
  const signPng=new Resvg(new TextDecoder().decode(signatureSvg),{fitTo:{mode:"width",value:600}}).render().asPng();
  const pdf=await PDFDocument.create();
  const font=await pdf.embedFont(StandardFonts.Helvetica),bold=await pdf.embedFont(StandardFonts.HelveticaBold);
  const logo=await pdf.embedPng(logoPng),signature=await pdf.embedPng(signPng);
  const W=595.28,H=841.89,margin=48,bottom=55;
  let page=pdf.addPage([W,H]),y=H-48;
  const draw=(txt:string,x=margin,size=9,color=ink,b=false)=>{page.drawText(txt,{x,y,size,font:b?bold:font,color});};
  const newPage=()=>{page=pdf.addPage([W,H]);y=H-52;};
  const wrap=(txt:string,max=500,size=9,b=false)=>{
   const f=b?bold:font,words=txt.split(/\s+/),lines:string[]=[];let line="";
   for(const word of words){const test=line?line+" "+word:word;if(f.widthOfTextAtSize(test,size)>max&&line){lines.push(line);line=word;}else line=test;}
   if(line)lines.push(line);return lines;
  };
  const paragraph=(txt:string,size=9,b=false,color=ink,gap=5)=>{
   for(const line of wrap(txt,W-2*margin,size,b)){if(y<size+bottom)newPage();draw(line,margin,size,color,b);y-=size+4;}y-=gap;
  };
  const section=(txt:string)=>{
   if(y<bottom+38)newPage();y-=8;draw(txt,margin,11,green,true);y-=18;
   page.drawLine({start:{x:margin,y:y+8},end:{x:W-margin,y:y+8},thickness:0.6,color:pale});
  };
  const row=(label:string,value:string)=>{
   const h=31;if(y<h+bottom)newPage();
   page.drawRectangle({x:margin,y:y-h+5,width:W-2*margin,height:h, color:pale,opacity:0.45});
   draw(label,margin+9,8,green,true);
   for(const line of wrap(value, W-2*margin-175,8)){draw(line,margin+178,8,ink);if(wrap(value,W-2*margin-175,8).length>1)y-=10;}
   y-=h+1;
  };
  const monthly=Number(e.monthly_fixed_salary||0),annual=monthly*12,today=new Date();
  const ref="VV/HR/OL/"+today.getFullYear()+"/"+safe(e.employee_code).replace(/[^A-Za-z0-9-]/g,"");
  const name=safe(e.full_name),first=name.split(/\s+/)[0]||name;
  const address=safe(e.address)||"Assigned VermiVeda office / field location";
  // Letterhead with original company logo.
  page.drawImage(logo,{x:margin,y:y-105,width:100,height:84});
  draw("VERMIVEDA",W-210,y-16,20,green,true);
  draw("WISDOM OF NATURE, POWER OF SOIL",W-210,y-34,7,green,true);
  draw("H133-A, Platinum Paradise, Near Malwa College",W-260,y-54,7,muted);
  draw("Indore, Madhya Pradesh - 452016",W-260,y-65,7,muted);
  draw("info.vermiveda@gmail.com | www.vermiveda.com",W-260,y-76,7,muted);
  y-=120;page.drawLine({start:{x:margin,y},end:{x:W-margin,y},thickness:2,color:green});y-=28;
  paragraph("OFFER OF EMPLOYMENT",18,true,green,8);
  paragraph("Reference: "+ref+"     |     Date: "+dateText(today.toISOString().slice(0,10)),8,true,ink,12);
  paragraph("To,",9,true,ink,1);paragraph(name,10,true,ink,1);paragraph(address,9,false,ink,1);
  paragraph("Email: "+(safe(e.email)||"—")+"   |   Mobile: "+(safe(e.mobile)||"—"),8,false,muted,10);
  paragraph("Subject: Offer of Employment for the Position of "+(safe(e.designation)||"Employee"),9,true,green,10);
  paragraph("Dear "+first+",",9,true,ink,6);
  paragraph("Following our recent discussions and successful interview process, we are pleased to offer you employment with VermiVeda (the Company) as "+(safe(e.designation)||"Employee")+" in the "+(safe(e.department)||"assigned")+" department. We believe your skills and dedication will be a valuable addition to our organisation.",9);
  paragraph("The principal terms and conditions of your employment are set out below:",9,false,ink,6);
  section("EMPLOYMENT DETAILS");
  row("Designation / Role",safe(e.designation)||"As assigned");
  row("Department",safe(e.department)||"As assigned");
  row("Employee Code",safe(e.employee_code));
  row("Date of Joining",dateText(e.joining_date));
  row("Work Location",address);
  row("Working Schedule","6 days a week, Monday to Saturday; working hours as per assigned shift");
  row("Probation","6 months from date of joining");
  row("Monthly Compensation",inr(monthly));
  row("Annual Compensation (CTC)",inr(annual));
  section("1. COMPENSATION & STATUTORY DEDUCTIONS");
  paragraph("Your total annual compensation (CTC) will be "+inr(annual)+" per annum ("+inr(monthly)+" per month). Component-wise breakup will be as per the salary structure approved and maintained by HR. Applicable statutory deductions, including TDS and any other deductions required by law, will be made as per prevailing rules.",9);
  section("2. PROBATION & CONFIRMATION");
  paragraph("You will initially be on probation for 6 (six) months from your date of joining. The probation period may be extended based on performance and business requirements. Confirmation will be communicated in writing after satisfactory completion.",9);
  section("3. WORKING HOURS, DUTIES & TRANSFER");
  paragraph("You shall perform duties assigned to your role and comply with Company policies, code of conduct and operational guidelines. Work timings and weekly offs will be as per the assigned shift and applicable policy. The Company may transfer or depute you to another office, unit or field location based on business requirements.",9);
  section("4. LEAVE & HOLIDAYS");
  paragraph("Leave and holidays will be governed by the Company's HR Leave Policy in force from time to time.",9);
  section("5. CONFIDENTIALITY & INTELLECTUAL PROPERTY");
  paragraph("You must maintain confidentiality of Company information, customer data, pricing, processes and business plans during and after employment. Work product and intellectual property created in the course of employment will belong to the Company, subject to applicable law.",9);
  section("6. EXCLUSIVITY OF SERVICE");
  paragraph("You are expected to devote your working time and attention to Company duties. Any outside employment or consultancy that may conflict with your responsibilities requires prior written approval.",9);
  section("7. NOTICE PERIOD & TERMINATION");
  paragraph("Either party may terminate employment by giving 30 (thirty) days' written notice or salary in lieu of notice, subject to applicable law, Company policy and completion of handover. Serious misconduct or breach of policy may result in disciplinary action.",9);
  section("8. BACKGROUND VERIFICATION & DOCUMENTS");
  paragraph("This offer is subject to satisfactory verification of identity, address, education and prior employment details. Please submit the required documents to HR on or before joining, including Aadhaar, PAN, educational certificates, previous employment records (if applicable), bank proof and recent photographs.",9);
  paragraph("Please sign and return a copy of this letter to confirm your acceptance.",9,false,ink,18);
  if(y<190)newPage();
  paragraph("For VermiVeda,",9,true,green,2);
  page.drawImage(signature,{x:margin,y:y-52,width:110,height:52});
  y-=60;paragraph("SURAJ VISHWAKARMA",9,true,ink,1);paragraph("Authorised Signatory | Partner & HR Head",8,false,muted,8);
  paragraph("Date: "+dateText(today.toISOString().slice(0,10)),8,false,ink,16);
  paragraph("CANDIDATE ACCEPTANCE",10,true,green,5);
  paragraph("I, "+name+", accept the offer and the terms stated in this letter.",9,false,ink,14);
  paragraph("Candidate Signature: ______________________________",9,false,ink,6);
  paragraph("Confirmed Joining Date: ___________________________",9,false,ink,6);
  // Annexure on a clean new page with logo and signature footer.
  newPage();
  page.drawImage(logo,{x:margin,y:y-62,width:62,height:54});draw("VERMIVEDA | ANNEXURE",W-205,y-25,13,green,true);y-=80;
  section("ANNEXURE A - COMPENSATION SUMMARY");
  paragraph("Employee: "+name+"     |     Designation: "+(safe(e.designation)||"—"),9,true,ink,10);
  row("Monthly Fixed Salary",inr(monthly));row("Annual Fixed Salary / CTC",inr(annual));
  paragraph("Detailed component-wise salary breakup will be shared separately by HR as per the approved compensation structure.",8,false,muted,18);
  section("ANNEXURE B - DOCUMENTS REQUIRED AT JOINING");
  for(const item of ["Aadhaar Card (front and back)","PAN Card","Educational certificates and mark sheets","Previous employer relieving / experience letter and recent salary slips, if applicable","Bank proof showing account holder name, account number, IFSC and MICR, where available","Recent passport-size photographs"])
   paragraph("•  "+item,9,false,ink,5);
  y-=25;page.drawImage(signature,{x:margin,y:y-45,width:95,height:45});y-=53;
  paragraph("SURAJ VISHWAKARMA | Authorised Signatory",8,true,green,4);
  paragraph("VermiVeda | Indore, Madhya Pradesh | www.vermiveda.com",8,false,muted,0);
  // Consistent footer with page numbers.
  const pages=pdf.getPages();pages.forEach((p,i)=>{p.drawLine({start:{x:margin,y:35},end:{x:W-margin,y:35},thickness:0.5,color:pale});p.drawText("VERMIVEDA • CONFIDENTIAL EMPLOYMENT DOCUMENT",{x:margin,y:22,size:7,font,color:muted});p.drawText("Page "+(i+1)+" of "+pages.length,{x:W-margin-65,y:22,size:7,font,color:muted});});
  const bytes=await pdf.save();
  const filePath=e.id+"/"+e.employee_code+"_Offer_Letter.pdf";
  const {error:uploadErr}=await admin.storage.from("vvhr-employee-documents").upload(filePath,bytes,{contentType:"application/pdf",upsert:true});
  if(uploadErr)throw uploadErr;
  const {data:existing}=await admin.from("vvhr_employee_documents").select("id,storage_path").eq("employee_id",e.id).eq("document_type","offer_letter").maybeSingle();
  const record={employee_id:e.id,document_type:"offer_letter",file_name:e.employee_code+"_Offer_Letter.pdf",storage_path:filePath};
  const saved=existing?await admin.from("vvhr_employee_documents").update(record).eq("id",existing.id):await admin.from("vvhr_employee_documents").insert(record);
  if(saved.error)throw saved.error;
  return new Response(JSON.stringify({success:true,employee_code:e.employee_code,file_name:record.file_name,format:"PDF"}),{headers:{...cors,"Content-Type":"application/json"}});
 }catch(error){
  return new Response(JSON.stringify({error:error?.message||String(error)}),{status:500,headers:{...cors,"Content-Type":"application/json"}});
 }
});