// Vermi Veda HR — Employee Onboarding Registration (draft UI)
// Requires the reviewed migration to be applied before use.
// Sensitive uploads use the private vvhr-employee-documents bucket.
export function renderOnboardingModule(root, sb, options = {}) {
  if (options.canManage === false) {
    root.innerHTML = '<div class="vvhr-onboard"><div class="vvhr-card"><h2>Employee Onboarding</h2><p>HR/admin access required.</p></div></div>';
    return;
  }
  const escapeHtml = v => String(v ?? "").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const docs = [
    ["aadhaar_front","Aadhaar Front",true],["aadhaar_back","Aadhaar Back",true],
    ["pan_card","PAN Card",true],["bank_proof","Bank Statement / Passbook / Cancelled Cheque",true],
    ["resume","Resume / CV",true],["joining_form","Joining Form",true],["employee_photo","Employee Photo",false]
  ];
  root.innerHTML = `
  <style>
.vvhr-onboard{--vv-green:#176b36;--vv-deep:#0c3d2b;--vv-ink:#18352a;max-width:1180px;margin:0 auto;padding:28px 30px 48px;color:var(--vv-ink);font-family:Inter,ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif}
.vvhr-onboard *{box-sizing:border-box}
.vvhr-onboard-head{display:flex;align-items:center;justify-content:space-between;gap:18px;padding:26px 30px;border-radius:20px;background:linear-gradient(120deg,#0b3d2b,#176b36 68%,#2b8a40);color:#fff;box-shadow:0 12px 30px #123d2b24;margin-bottom:22px;position:relative;overflow:hidden}
.vvhr-onboard-head:after{content:"";position:absolute;width:220px;height:220px;border:1px solid #ffffff24;border-radius:50%;right:-55px;top:-115px;box-shadow:0 0 0 24px #ffffff0b,0 0 0 48px #ffffff08}
.vvhr-onboard-head h2{font-size:25px;line-height:1.2;margin:0 0 7px;font-weight:800;letter-spacing:-.4px;color:#fff}
.vvhr-onboard-head p{margin:0;color:#d8eddf;font-size:13px}
.vvhr-step{position:relative;z-index:1;border:1px solid #ffffff45;background:#ffffff16;color:#fff;border-radius:999px;padding:9px 14px;font-size:12px;font-weight:700;white-space:nowrap}
.vvhr-onboard-card{background:#fff;border:1px solid #e2ece5;border-radius:20px;padding:28px 30px;box-shadow:0 8px 28px #123d2b0b}
.vvhr-onboard h3{display:flex;align-items:center;gap:11px;font-size:16px;font-weight:800;color:#164b30;margin:28px 0 17px;padding:0 0 12px;border-bottom:1px solid #e8f0ea;counter-increment:vvhr-section}
.vvhr-onboard h3:first-child{margin-top:0}
.vvhr-onboard form{counter-reset:vvhr-section}
.vvhr-onboard h3:before{display:grid;place-items:center;flex:0 0 30px;height:30px;border-radius:10px;background:#eaf6e9;color:#24713a;font-size:13px;font-weight:800;content:counter(vvhr-section)}
.vvhr-onboard-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px 20px;margin-bottom:25px}
.vvhr-onboard label{display:flex;flex-direction:column;gap:7px;color:#304b3c;font-size:12px;font-weight:700;min-width:0}
.vvhr-onboard input:not([type=file]),.vvhr-onboard select,.vvhr-onboard textarea{width:100%;min-height:45px;padding:11px 13px;border:1px solid #d7e5da;border-radius:10px;background:#fbfdfb;color:#193c2b;font:500 14px inherit;outline:none;transition:border-color .18s,box-shadow .18s,background .18s}
.vvhr-onboard textarea{min-height:82px;resize:vertical}
.vvhr-onboard input:focus,.vvhr-onboard select:focus,.vvhr-onboard textarea:focus{border-color:#4caa65;background:#fff;box-shadow:0 0 0 3px #4caa651b}
.vvhr-onboard input::placeholder,.vvhr-onboard textarea::placeholder{color:#9aa99e}
.vvhr-onboard .wide{grid-column:1/-1}
.vvhr-onboard-note{font-size:12px;line-height:1.6;color:#607469;background:#f3f8f3;border:1px solid #e3eee4;padding:12px 15px;border-radius:11px;margin:0 0 18px}
.vvhr-doc-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:13px;margin:15px 0 22px}
.vvhr-doc{padding:16px;border:1px solid #dfeae1;border-radius:13px;background:linear-gradient(180deg,#fff,#f8fbf8);min-height:120px;justify-content:space-between;transition:transform .18s,border-color .18s,box-shadow .18s}
.vvhr-doc:hover{transform:translateY(-2px);border-color:#9bc9a4;box-shadow:0 8px 18px #174b3010}
.vvhr-doc span{font-size:12px;font-weight:800;color:#244a32}
.vvhr-doc input[type=file]{display:block;width:100%;font-size:11px;color:#4d6857;max-width:100%}
.vvhr-doc input[type=file]::file-selector-button{border:0;border-radius:7px;background:#e6f3e7;color:#1b6736;padding:7px 10px;font-weight:700;margin-right:8px;cursor:pointer}
.vvhr-doc small{font-size:10px;color:#829187}
.vvhr-onboard-actions{display:flex;justify-content:flex-end;border-top:1px solid #e7eee8;padding-top:20px;margin-top:8px}
.vvhr-onboard-actions button{border:0;border-radius:11px;padding:13px 23px;background:linear-gradient(120deg,#176b36,#238844);color:#fff;font-size:13px;font-weight:800;box-shadow:0 7px 16px #176b3628;cursor:pointer}
.vvhr-onboard-actions button:disabled{opacity:.6;cursor:wait}
.vvhr-onboard-error{display:none;margin:0 0 20px;padding:14px 16px;border-radius:12px;background:#fff0ef;border:1px solid #f2b8b5;color:#a3211b;font-size:13px;font-weight:700;line-height:1.5;box-shadow:0 5px 16px #a3211b12}.vvhr-onboard-error:not(:empty){display:block}.vvhr-onboard-error.success{background:#edf8ef;border-color:#cce8d1;color:#176b36}
.vvhr-onboard-error.success{padding:13px 15px;border-radius:10px;background:#edf8ef;border:1px solid #cce8d1;color:#176b36}
@media(max-width:760px){.vvhr-onboard{padding:16px 12px 30px}.vvhr-onboard-head{padding:20px;border-radius:15px;align-items:flex-start;flex-direction:column}.vvhr-onboard-head h2{font-size:21px}.vvhr-onboard-card{padding:20px 16px;border-radius:15px}.vvhr-onboard-grid{grid-template-columns:1fr;gap:13px}.vvhr-onboard .wide{grid-column:auto}.vvhr-doc-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.vvhr-onboard h3{font-size:15px;margin-top:24px}}
@media(max-width:420px){.vvhr-doc-grid{grid-template-columns:1fr}.vvhr-onboard-actions button{width:100%}}
</style>
  <section class="vvhr-onboard">
    <header class="vvhr-onboard-head"><div><h2>Employee Onboarding</h2><p>Registration, KYC documents and HR verification</p></div><span class="vvhr-step">Employee Code after approval</span></header>
    <div class="vvhr-onboard-card">
      <form id="vvhr-onboard-form">
        <h3>1. Basic Details</h3><div class="vvhr-onboard-grid">
          <label>Full Name *<input name="full_name" required autocomplete="name"></label>
          <label>Mobile Number *<input name="mobile" required inputmode="tel" pattern="[0-9+ -]{10,15}"></label>
          <label>Email ID *<input name="email" type="email" required></label>
          <label>Date of Birth *<input name="date_of_birth" type="date" required></label>
          <label>Gender<select name="gender"><option value="">Select</option><option>Male</option><option>Female</option><option>Other</option><option>Prefer not to say</option></select></label>
          <label>Joining Date *<input name="joining_date" type="date" required></label>
          <label>Department<select name="department"><option value="">Select Department</option><option>Operations</option><option>HR</option><option>Finance</option><option>Sales &amp; Marketing</option><option>Production</option><option>Logistics</option><option>Field Operations</option><option>IT</option><option>Other</option></select></label>
          <label>Designation *<select name="designation" required><option value="">Select Designation</option><option>Founder</option><option>Manager</option><option>Deputy Manager</option><option>Assistant Manager</option><option>Team Leader</option><option>HR Executive</option><option>Accountant</option><option>Executive</option><option>Field Executive</option><option>Delivery Executive</option><option>Supervisor</option><option>Data Entry Operator</option><option>Office Assistant</option><option>Worker</option><option>Other</option></select></label>
          <label>Aadhaar Number *<input name="aadhaar_number" required inputmode="numeric" maxlength="12" pattern="[0-9]{12}" placeholder="12-digit Aadhaar number" autocomplete="off"></label>
          <label>PAN Number *<input name="pan_number" required maxlength="10" pattern="[A-Z]{5}[0-9]{4}[A-Z]" placeholder="ABCDE1234F" autocapitalize="characters" autocomplete="off"></label>
          <label>Monthly Salary (HR only) ₹<input name="monthly_fixed_salary" type="number" min="0" step="1"></label>
          <label class="wide">Complete Address<textarea name="address" rows="2"></textarea></label>
        </div>
        <h3>2. Salary Bank Account Details</h3><div class="vvhr-onboard-grid">
          <label>Bank Name *<input name="bank_name" required placeholder="e.g. State Bank of India" autocomplete="organization"></label>
          <label>Account Holder Name *<input name="bank_account_name" required autocomplete="off"></label>
          <label>Bank Account Number *<input name="bank_account_number" required inputmode="numeric" autocomplete="off"></label>
          <label>IFSC Code *<input name="bank_ifsc" required autocapitalize="characters" placeholder="e.g. SBIN0001234"></label>\n          <label>MICR Code<input name="bank_micr" inputmode="numeric" maxlength="9" pattern="[0-9]{9}" placeholder="9-digit MICR code (optional)"></label>
        </div>
        <h3>3. Document Upload & Verification</h3><p class="vvhr-onboard-note">Identity documents and the uploaded bank proof will be verified by HR. Enter bank details carefully; they will be used for salary payments.</p>
        <h3>4. Emergency Contact</h3><div class="vvhr-onboard-grid">
          <label>Contact Person Name *<input name="emergency_contact_name" required></label>
          <label>Relationship *<select name="emergency_contact_relationship" required><option value="">Select Relationship</option><option>Father</option><option>Mother</option><option>Husband</option><option>Wife</option><option>Son</option><option>Daughter</option><option>Brother</option><option>Sister</option><option>Guardian</option><option>Other</option></select></label>
          <label>Emergency Mobile Number *<input name="emergency_contact_mobile" required inputmode="tel" pattern="[0-9+ -]{10,15}"></label>
          <label>Alternate Number<input name="emergency_contact_alt_mobile" inputmode="tel"></label>
        </div>
        <h3>5. Documents Upload</h3><p class="vvhr-onboard-note">Required documents are marked *. Files are private; upload limit 8 MB per file.</p>
        <div class="vvhr-doc-grid">${docs.map(([key,label,required])=>`<label class="vvhr-doc"><span>${escapeHtml(label)} ${required?"*":""}</span><input type="file" name="${key}" accept=".pdf,.jpg,.jpeg,.png" ${required?"required":""}><small>PDF/JPG/PNG</small></label>`).join("")}</div>
        <div class="vvhr-onboard-note">Employee code is not generated during registration. HR will review the details and documents first.</div>
        <div class="vvhr-onboard-actions"><button type="submit" id="vvhr-onboard-save">Submit Registration</button></div>
      </form>
    </div>
  </section>`;
  root.querySelector("#vvhr-onboard-form").onsubmit = async ev => {
    ev.preventDefault();
    const form=ev.currentTarget, fd=new FormData(form), err=root.querySelector("#vvhr-onboard-error"), btn=root.querySelector("#vvhr-onboard-save");
    err.textContent="";
    const fileMap={}; for(const [key,label,required] of docs){const file=form.elements[key]?.files?.[0];if(required&&!file){err.textContent=label+" is required.";err.scrollIntoView({behavior:"smooth",block:"start"});return;}if(file&&file.size>8*1024*1024){err.textContent=label+" exceeds 8 MB.";err.scrollIntoView({behavior:"smooth",block:"start"});return;}if(file&& !["application/pdf","image/jpeg","image/png"].includes(file.type)){err.textContent=label+" must be PDF, JPG or PNG.";err.scrollIntoView({behavior:"smooth",block:"start"});return;}if(file)fileMap[key]=file;}
    const mobile=String(fd.get("mobile")||"").replace(/\D/g,"");
    if(mobile.length!==10){err.textContent="Enter a valid 10-digit mobile number.";err.scrollIntoView({behavior:"smooth",block:"start"});return;}
    const dob=String(fd.get("date_of_birth")||""),joining=String(fd.get("joining_date")||"");
    if(!dob||!joining){err.textContent="Date of Birth and Date of Joining are required.";err.scrollIntoView({behavior:"smooth",block:"start"});return;}
    const minDob=new Date(joining+"T00:00:00");minDob.setFullYear(minDob.getFullYear()-18);
    if(new Date(dob+"T00:00:00")>minDob){err.textContent="Employee must be at least 18 years old on the Date of Joining.";err.scrollIntoView({behavior:"smooth",block:"start"});return;}
    const aadhaar=String(fd.get("aadhaar_number")||"").replace(/\D/g,""),pan=String(fd.get("pan_number")||"").trim().toUpperCase();
    if(!/^[0-9]{12}$/.test(aadhaar)){err.textContent="Enter a valid 12-digit Aadhaar number.";err.scrollIntoView({behavior:"smooth",block:"start"});return;}
    if(!/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(pan)){err.textContent="Enter a valid PAN number (e.g. ABCDE1234F).";err.scrollIntoView({behavior:"smooth",block:"start"});return;}
    const accountNumber=String(fd.get("bank_account_number")||"").trim().replace(/\\s+/g,""),ifsc=String(fd.get("bank_ifsc")||"").trim().toUpperCase();
    if(!/^[0-9]{6,20}$/.test(accountNumber)){err.textContent="Enter a valid bank account number (6–20 digits).";err.scrollIntoView({behavior:"smooth",block:"start"});return;}
    if(!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifsc)){err.textContent="Enter a valid 11-character IFSC code.";err.scrollIntoView({behavior:"smooth",block:"start"});return;}\n    const micr=String(fd.get("bank_micr")||"").trim();if(micr&&!/^[0-9]{9}$/.test(micr)){err.textContent="MICR Code must contain exactly 9 digits.";err.scrollIntoView({behavior:"smooth",block:"start"});return;}
    const data={full_name:String(fd.get("full_name")).trim(),mobile:String(fd.get("mobile")).trim(),email:String(fd.get("email")||"").trim()||null,date_of_birth:fd.get("date_of_birth")||null,aadhaar_number:aadhaar,pan_number:pan,gender:fd.get("gender")||null,address:String(fd.get("address")||"").trim()||null,joining_date:fd.get("joining_date"),department:String(fd.get("department")||"").trim()||null,designation:String(fd.get("designation")||"").trim()||null,monthly_fixed_salary:Number(fd.get("monthly_fixed_salary")||0),bank_name:String(fd.get("bank_name")||"").trim(),bank_account_name:String(fd.get("bank_account_name")||"").trim(),bank_account_number:accountNumber,bank_ifsc:ifsc,bank_micr:String(fd.get("bank_micr")||"").trim(),emergency_contact_name:String(fd.get("emergency_contact_name")).trim(),emergency_contact_relationship:String(fd.get("emergency_contact_relationship")||"").trim()||null,emergency_contact_mobile:String(fd.get("emergency_contact_mobile")).trim(),emergency_contact_alt_mobile:String(fd.get("emergency_contact_alt_mobile")||"").trim()||null,status:"under_verification",document_metadata:{},created_by:(await sb.auth.getUser()).data.user?.id||null};
    btn.disabled=true;btn.textContent="Uploading & Saving…";
    let id=null;const uploadedPaths=[];
    try{
      const saved=await sb.from("vvhr_onboarding_requests").insert(data).select("id").single();
      if(saved.error)throw saved.error;
      id=saved.data.id;const metadata={};
      for(const [key,file] of Object.entries(fileMap)){
        const safe=file.name.replace(/[^a-zA-Z0-9._-]/g,"_"),path=id+"/"+key+"/"+Date.now()+"_"+safe;
        const up=await sb.storage.from("vvhr-employee-documents").upload(path,file,{contentType:file.type,upsert:false});
        if(up.error)throw new Error(key+" upload failed: "+up.error.message);
        uploadedPaths.push(path);
        metadata[key]={file_name:file.name,storage_path:path,uploaded_at:new Date().toISOString(),verification_status:"pending"};
      }
      const upd=await sb.from("vvhr_onboarding_requests").update({document_metadata:metadata,status:"under_verification"}).eq("id",id);
      if(upd.error)throw upd.error;
      form.reset();err.textContent="Registration submitted. HR verification is pending. A valid email is required for the Employee Portal login.";
      err.classList.add("success");
    }catch(e){if(uploadedPaths.length)await sb.storage.from("vvhr-employee-documents").remove(uploadedPaths).catch(()=>{});if(id)await sb.from("vvhr_onboarding_requests").delete().eq("id",id).catch(()=>{});err.textContent=e.message||"Unable to submit registration.";err.classList.remove("success");}
    finally{btn.disabled=false;btn.textContent="Submit Registration";}
  };
}
