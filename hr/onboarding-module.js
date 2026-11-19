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
    ["employee_photo","Employee Photo",true],["resume","Resume / CV",false]
  ];
  root.innerHTML = `
  <section class="vvhr-onboard">
    <header class="vvhr-onboard-head"><div><h2>Employee Onboarding</h2><p>Registration, KYC documents and HR verification</p></div><span class="vvhr-step">Employee Code after approval</span></header>
    <div class="vvhr-onboard-card">
      <form id="vvhr-onboard-form">
        <h3>1. Basic Details</h3><div class="vvhr-onboard-grid">
          <label>Full Name *<input name="full_name" required autocomplete="name"></label>
          <label>Mobile Number *<input name="mobile" required inputmode="tel" pattern="[0-9+ -]{10,15}"></label>
          <label>Email ID *<input name="email" type="email" required></label>
          <label>Date of Birth<input name="date_of_birth" type="date"></label>
          <label>Gender<select name="gender"><option value="">Select</option><option>Male</option><option>Female</option><option>Other</option><option>Prefer not to say</option></select></label>
          <label>Joining Date *<input name="joining_date" type="date" required></label>
          <label>Department<input name="department"></label><label>Designation<input name="designation"></label>
          <label>Monthly Salary (HR only) ₹<input name="monthly_fixed_salary" type="number" min="0" step="1"></label>
          <label class="wide">Complete Address<textarea name="address" rows="2"></textarea></label>
        </div>
        <h3>2. Salary Bank Account Details</h3><div class="vvhr-onboard-grid">
          <label>Account Holder Name *<input name="bank_account_name" required autocomplete="off"></label>
          <label>Bank Account Number *<input name="bank_account_number" required inputmode="numeric" autocomplete="off"></label>
          <label>IFSC Code *<input name="bank_ifsc" required autocapitalize="characters" placeholder="e.g. SBIN0001234"></label>
        </div>
        <h3>3. Document Upload & Verification</h3><p class="vvhr-onboard-note">Identity documents and the uploaded bank proof will be verified by HR. Enter bank details carefully; they will be used for salary payments.</p>
        <h3>4. Emergency Contact</h3><div class="vvhr-onboard-grid">
          <label>Contact Person Name *<input name="emergency_contact_name" required></label>
          <label>Relationship<input name="emergency_contact_relationship"></label>
          <label>Emergency Mobile Number *<input name="emergency_contact_mobile" required inputmode="tel" pattern="[0-9+ -]{10,15}"></label>
          <label>Alternate Number<input name="emergency_contact_alt_mobile" inputmode="tel"></label>
        </div>
        <h3>5. Documents Upload</h3><p class="vvhr-onboard-note">Required documents are marked *. Files are private; upload limit 8 MB per file.</p>
        <div class="vvhr-doc-grid">${docs.map(([key,label,required])=>`<label class="vvhr-doc"><span>${escapeHtml(label)} ${required?"*":""}</span><input type="file" name="${key}" accept=".pdf,.jpg,.jpeg,.png" ${required?"required":""}><small>PDF/JPG/PNG</small></label>`).join("")}</div>
        <div class="vvhr-onboard-note">Employee code is not generated during registration. HR will review the details and documents first.</div>
        <div class="vvhr-onboard-actions"><button type="submit" id="vvhr-onboard-save">Submit Registration</button></div><div id="vvhr-onboard-error" class="vvhr-onboard-error"></div>
      </form>
    </div>
  </section>`;
  root.querySelector("#vvhr-onboard-form").onsubmit = async ev => {
    ev.preventDefault();
    const form=ev.currentTarget, fd=new FormData(form), err=root.querySelector("#vvhr-onboard-error"), btn=root.querySelector("#vvhr-onboard-save");
    err.textContent="";
    const fileMap={}; for(const [key,label,required] of docs){const file=form.elements[key]?.files?.[0];if(required&&!file){err.textContent=label+" is required.";return;}if(file&&file.size>8*1024*1024){err.textContent=label+" exceeds 8 MB.";return;}if(file&& !["application/pdf","image/jpeg","image/png"].includes(file.type)){err.textContent=label+" must be PDF, JPG or PNG.";return;}if(file)fileMap[key]=file;}
    const mobile=String(fd.get("mobile")||"").replace(/\D/g,"");
    if(mobile.length!==10){err.textContent="Enter a valid 10-digit mobile number.";return;}
    const accountNumber=String(fd.get("bank_account_number")||"").trim().replace(/\\s+/g,""),ifsc=String(fd.get("bank_ifsc")||"").trim().toUpperCase();
    if(!/^[0-9]{6,20}$/.test(accountNumber)){err.textContent="Enter a valid bank account number (6–20 digits).";return;}
    if(!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifsc)){err.textContent="Enter a valid 11-character IFSC code.";return;}
    const data={full_name:String(fd.get("full_name")).trim(),mobile:String(fd.get("mobile")).trim(),email:String(fd.get("email")||"").trim()||null,date_of_birth:fd.get("date_of_birth")||null,gender:fd.get("gender")||null,address:String(fd.get("address")||"").trim()||null,joining_date:fd.get("joining_date"),department:String(fd.get("department")||"").trim()||null,designation:String(fd.get("designation")||"").trim()||null,monthly_fixed_salary:Number(fd.get("monthly_fixed_salary")||0),bank_account_name:String(fd.get("bank_account_name")||"").trim(),bank_account_number:accountNumber,bank_ifsc:ifsc,emergency_contact_name:String(fd.get("emergency_contact_name")).trim(),emergency_contact_relationship:String(fd.get("emergency_contact_relationship")||"").trim()||null,emergency_contact_mobile:String(fd.get("emergency_contact_mobile")).trim(),emergency_contact_alt_mobile:String(fd.get("emergency_contact_alt_mobile")||"").trim()||null,status:"under_verification",document_metadata:{},created_by:(await sb.auth.getUser()).data.user?.id||null};
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
