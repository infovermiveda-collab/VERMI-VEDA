// Vermi Veda HR — Employee Management module (Phase 1)
// This module is intentionally separate from OMS code/data.
// Requires Supabase client (sb) and HR employee table vvhr_employees.

export function renderEmployeeModule(root, sb, options = {}) {
  const canManage = options.canManage !== false;
  const escapeHtml = (v) => String(v ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const money = (v) => new Intl.NumberFormat("en-IN",{style:"currency",currency:"INR",maximumFractionDigits:0}).format(Number(v||0));
  let rows = [];
  let editing = null;

  root.innerHTML = `
    <section class="vvhr-employees">
      <div class="vvhr-header">
        <div><h2>Employee Management</h2><p>Employee records, joining details and employment status</p></div>
        ${canManage ? '<span class="vvhr-note">New employees must complete Onboarding and document verification before an ECode is issued.</span>' : ''}
      </div>
      <div class="vvhr-stats" id="vvhr-stats"></div>
      <div class="vvhr-toolbar vvhr-employee-toolbar">
        <input id="vvhr-search" placeholder="Search employee name or ID…">
        <select id="vvhr-status"><option value="">All employees</option><option value="active">Active</option><option value="probation">Probation</option><option value="inactive">Inactive</option><option value="resigned">Resigned</option><option value="terminated">Terminated</option></select>
        <div class="vvhr-view-toggle" role="group" aria-label="Employee display mode">
          <button type="button" class="alt active" id="vvhr-card-view" aria-pressed="true">▦ Card View</button>
          <button type="button" class="alt" id="vvhr-list-view" aria-pressed="false">☷ List View</button>
        </div>
        <button class="alt" id="vvhr-export">Export CSV</button><button class="alt" id="vvhr-exit-export">Exit Report</button><button class="alt" id="vvhr-bank-export">Salary Bank Report</button>
      </div>
      <div id="vvhr-card-grid" class="vvhr-card-grid"></div>
      <div class="vvhr-tablewrap" id="vvhr-table-view" hidden><table><thead><tr><th>Employee ID</th><th>Name</th><th>Mobile</th><th>Email</th><th>Department</th><th>Designation</th><th>Joining Date</th><th>Monthly Salary</th><th>Status</th><th>Action</th></tr></thead><tbody id="vvhr-body"></tbody></table></div>
      <div class="vvhr-pagination"><div class="vvhr-foot" id="vvhr-count"></div><label>Records per page <select id="vvhr-page-size"><option value="10">10</option><option value="20">20</option><option value="50">50</option><option value="100">100</option></select></label><div class="vvhr-page-controls"><button type="button" class="alt" id="vvhr-prev">Previous</button><span id="vvhr-page-label"></span><button type="button" class="alt" id="vvhr-next">Next</button></div></div>
      <div id="vvhr-modal" class="vvhr-modal" hidden></div>
    </section>`;

  const body = root.querySelector("#vvhr-body");
  const cardGrid = root.querySelector("#vvhr-card-grid");
  const tableView = root.querySelector("#vvhr-table-view");
  const modal = root.querySelector("#vvhr-modal");
  let viewMode = "cards";
  let currentPage = 1;
  const initials = (name) => String(name||"?").trim().split(/\\s+/).slice(0,2).map(x=>x[0]||"").join("").toUpperCase();
  const actionMarkup = (e) => canManage ? `<div class="actions"><button class="alt vvhr-edit" data-id="${escapeHtml(e.id)}">Edit</button><button class="alt vvhr-bank-edit" data-id="${escapeHtml(e.id)}">Bank Details</button><button class="alt vvhr-offer" data-id="${escapeHtml(e.id)}">Offer Letter</button>${["active","probation"].includes(e.employment_status)?'<button class="alt vvhr-exit" data-id="'+escapeHtml(e.id)+'">Process Exit</button>':''}</div>` : "—";
  const bindRowActions = (host) => {
    host.querySelectorAll(".vvhr-edit,.vvhr-bank-edit").forEach(b=>b.onclick=()=>openForm(rows.find(e=>e.id===b.dataset.id)));
    host.querySelectorAll(".vvhr-exit").forEach(b=>b.onclick=async()=>{
      const row=rows.find(e=>e.id===b.dataset.id);if(!row)return;
      const resignationDate=prompt("Resignation date (YYYY-MM-DD)",new Date().toISOString().slice(0,10));if(!resignationDate)return;
      const exitDate=prompt("Exit date / Last working day (YYYY-MM-DD)",resignationDate);if(!exitDate)return;
      const reason=prompt("Reason for resignation / exit");if(reason===null)return;
      const dateOk=v=>/^\\d{4}-\\d{2}-\\d{2}$/.test(v)&&!Number.isNaN(Date.parse(v));
      if(!dateOk(resignationDate)||!dateOk(exitDate)||exitDate<resignationDate){alert("Enter valid dates. Exit date cannot be before resignation date.");return;}
      if(!confirm("Approve exit for "+row.full_name+" ("+row.employee_code+")? Portal access will be blocked immediately. Existing HR history will be retained."))return;
      b.disabled=true;b.textContent="Processing…";
      const upd=await sb.from("vvhr_employees").update({employment_status:"resigned",resignation_date:resignationDate,exit_date:exitDate,last_working_date:exitDate,exit_reason:reason.trim()||null,exit_approved_by:options.currentUserId||null,exit_approved_at:new Date().toISOString()}).eq("id",row.id).in("employment_status",["active","probation"]).select("id").maybeSingle();
      if(upd.error||!upd.data){alert("Exit update failed: "+(upd.error?.message||"Employee status changed. Refresh and retry."));b.disabled=false;b.textContent="Process Exit";return;}
      if(row.auth_user_id){const access=await sb.functions.invoke("set-employee-portal-access",{body:{employee_id:row.id,employment_status:"resigned"}});if(access.error||!access.data?.success)alert("Employee exit saved, but Auth sign-in lock failed: "+(access.error?.message||access.data?.error||"Unknown error")+". Please retry access deactivation.");}
      await load();alert("Exit processed. Employee portal access is blocked by HR self-access policy; linked Auth account deactivation was requested.");
    });
    host.querySelectorAll(".vvhr-offer").forEach(b=>b.onclick=async()=>{const row=rows.find(e=>e.id===b.dataset.id);b.disabled=true;b.textContent="Generating…";const r=await sb.functions.invoke("generate-employee-offer-letter",{body:{employee_id:row.id}});if(r.error||!r.data?.success){alert("Offer letter could not be generated: "+(r.error?.message||r.data?.error||"Unknown error"));b.disabled=false;b.textContent="Offer Letter";return;}let note="Offer letter generated for "+row.employee_code+".";const doc=await sb.from("vvhr_employee_documents").select("storage_path,file_name").eq("employee_id",row.id).eq("document_type","offer_letter").maybeSingle();if(doc.error||!doc.data){note+=" Download link could not be prepared: "+(doc.error?.message||"Document record not found");}else{const signed=await sb.storage.from("vvhr-employee-documents").createSignedUrl(doc.data.storage_path,300,{download:doc.data.file_name});if(signed.error){note+=" Download failed: "+signed.error.message;}else{const a=document.createElement("a");a.href=signed.data.signedUrl;a.download=doc.data.file_name;a.style.display="none";document.body.appendChild(a);a.click();a.remove();note+=" Download started.";}}if(row.email){const account=await sb.functions.invoke("provision-employee-portal-account",{body:{employee_id:row.id}});if(account.error||!account.data?.success)note+=" Portal login needs follow-up: "+(account.error?.message||account.data?.error||"Unknown error");else if(account.data.temporary_password)window.prompt("Employee Portal temporary password — share securely with the employee.",account.data.temporary_password);}alert(note);b.disabled=false;b.textContent="Offer Letter";});
  };
  const draw = () => {
    const q = root.querySelector("#vvhr-search").value.trim().toLowerCase();
    const status = root.querySelector("#vvhr-status").value;
    const filtered = rows.filter(e => {
      const inactive = ["resigned","terminated"].includes(e.employment_status);
      const statusMatch = !status || (status==="inactive" ? inactive : e.employment_status===status);
      return statusMatch && (!q || [e.employee_code,e.full_name].join(" ").toLowerCase().includes(q));
    });
    const active = rows.filter(e=>e.employment_status==="active").length;
    root.querySelector("#vvhr-stats").innerHTML = `
      <div><small>Total Employees</small><b>${rows.length}</b></div>
      <div><small>Active</small><b>${active}</b></div>
      <div><small>Probation</small><b>${rows.filter(e=>e.employment_status==="probation").length}</b></div>
      <div><small>Inactive</small><b>${rows.filter(e=>["resigned","terminated"].includes(e.employment_status)).length}</b></div>`;
    const pageSize=Number(root.querySelector("#vvhr-page-size").value||10);
    const pageCount=Math.max(1,Math.ceil(filtered.length/pageSize));
    currentPage=Math.min(currentPage,pageCount);
    const pageRows=filtered.slice((currentPage-1)*pageSize,currentPage*pageSize);
    const statusLabel = s => s==="active"?"Active":s==="probation"?"Probation":s==="resigned"?"Resigned":s==="terminated"?"Terminated":s||"Unknown";
    const statusClass = s => ["active","probation","resigned","terminated"].includes(s)?s:"inactive";
    cardGrid.innerHTML = pageRows.length ? pageRows.map(e=>`<article class="vvhr-employee-card">
      <div class="vvhr-employee-photo">${e.photo_url?'<img src="'+escapeHtml(e.photo_url)+'" alt="'+escapeHtml(e.full_name)+'" loading="lazy">':'<span>'+escapeHtml(initials(e.full_name))+'</span>'}</div>
      <div class="vvhr-employee-id">${escapeHtml(e.employee_code||"—")}</div>
      <h3>${escapeHtml(e.full_name||"Unnamed employee")}</h3>
      <span class="vvhr-badge ${statusClass(e.employment_status)}">${statusLabel(e.employment_status)}</span>
      <div class="vvhr-employee-meta">${escapeHtml(e.department||"")}${e.designation?" · "+escapeHtml(e.designation):""}</div>
      <div class="vvhr-employee-actions">${actionMarkup(e)}</div>
    </article>`).join("") : '<div class="vvhr-empty">No employee records found.</div>';
    body.innerHTML = pageRows.length ? pageRows.map(e=>`<tr>
      <td><b>${escapeHtml(e.employee_code)}</b></td><td>${escapeHtml(e.full_name)}</td><td>${escapeHtml(e.mobile)}</td><td>${escapeHtml(e.email||"—")}</td>
      <td>${escapeHtml(e.department||"—")}</td><td>${escapeHtml(e.designation||"—")}</td><td>${escapeHtml(e.joining_date||"—")}</td>
      <td>${money(e.monthly_fixed_salary)}</td><td><span class="vvhr-badge ${statusClass(e.employment_status)}">${statusLabel(e.employment_status)}</span></td>
      <td>${actionMarkup(e)}</td></tr>`).join("") : '<tr><td colspan="10" class="vvhr-empty">No employee records found.</td></tr>';
    cardGrid.hidden=viewMode!=="cards";
    tableView.hidden=viewMode!=="list";
    root.querySelector("#vvhr-card-view").classList.toggle("active",viewMode==="cards");
    root.querySelector("#vvhr-list-view").classList.toggle("active",viewMode==="list");
    root.querySelector("#vvhr-card-view").setAttribute("aria-pressed",String(viewMode==="cards"));
    root.querySelector("#vvhr-list-view").setAttribute("aria-pressed",String(viewMode==="list"));
    root.querySelector("#vvhr-count").textContent = `Showing ${filtered.length?((currentPage-1)*pageSize+1):0}–${Math.min(currentPage*pageSize,filtered.length)} of ${filtered.length} employees`;
    root.querySelector("#vvhr-page-label").textContent = `Page ${currentPage} of ${pageCount}`;
    root.querySelector("#vvhr-prev").disabled=currentPage<=1;
    root.querySelector("#vvhr-next").disabled=currentPage>=pageCount;
    bindRowActions(cardGrid);bindRowActions(body);
  };
  async function load() {
    const r = await sb.from("vvhr_employees").select("*").order("employee_code",{ascending:true});
    if(r.error) { root.querySelector("#vvhr-count").textContent = "Unable to load employee records: "+r.error.message; return; }
    rows = r.data||[];
    const ids=rows.map(e=>e.id).filter(Boolean);
    if(ids.length){
      const docs=await sb.from("vvhr_employee_documents").select("employee_id,storage_path,uploaded_at").in("employee_id",ids).eq("document_type","employee_photo").order("uploaded_at",{ascending:false});
      if(!docs.error&&docs.data?.length){
        const latest=new Map();
        docs.data.forEach(d=>{if(!latest.has(d.employee_id))latest.set(d.employee_id,d.storage_path);});
        await Promise.all(rows.map(async e=>{
          const path=latest.get(e.id);if(!path)return;
          const signed=await sb.storage.from("vvhr-employee-documents").createSignedUrl(path,3600);
          if(!signed.error)e.photo_url=signed.data.signedUrl;
        }));
      }
    }
    draw();
  }
  function openForm(e=null) {
    if(!canManage) return;
    editing = e;
    const value = (k)=>escapeHtml(e?.[k]||"");
    modal.hidden=false;
    modal.innerHTML=`
      <div class="vvhr-dialog">
        <div class="vvhr-dialog-head"><h3>${e?"Edit Employee":"Add Employee"}</h3><button type="button" class="alt" id="vvhr-close">✕</button></div>
        <form id="vvhr-form">
          <div class="vvhr-formgrid">
            <label>Full Name *<input name="full_name" required value="${value("full_name")}"></label>
            <label>Mobile *<input name="mobile" required inputmode="tel" value="${value("mobile")}"></label>\n            <label>Email *<input name="email" type="email" ${e?"":"required"} value="${value("email")}"></label>
            <label>Joining Date *<input name="joining_date" required type="date" value="${value("joining_date")}"></label>
            <label>Department<input name="department" value="${value("department")}"></label>
            <label>Designation<input name="designation" value="${value("designation")}"></label>
            <label>Monthly Salary (₹)<input name="monthly_fixed_salary" type="number" min="0" step="0.01" value="${value("monthly_fixed_salary")}"></label>
            <div class="wide vvhr-bank-section"><h4>Bank Account Details <span>For salary / NEFT payment</span></h4></div>
            <label>Account Holder Name *<input name="bank_account_name" required autocomplete="off" value="${value("bank_account_name")}" placeholder="As per bank records"></label>
            <label>Bank Account Number *<input name="bank_account_number" required inputmode="numeric" autocomplete="off" value="${value("bank_account_number")}" placeholder="Enter account number"></label>
            <label>IFSC Code *<input name="bank_ifsc" required autocapitalize="characters" value="${value("bank_ifsc")}" placeholder="e.g. SBIN0001234"></label>
            <label>Status<select name="employment_status"><option value="active" ${e?.employment_status==="active"?"selected":""}>Active</option><option value="probation" ${e?.employment_status==="probation"?"selected":""}>Probation</option><option value="resigned" ${e?.employment_status==="resigned"?"selected":""}>Resigned</option><option value="terminated" ${e?.employment_status==="terminated"?"selected":""}>Terminated</option></select></label>
            <label class="wide">Address<textarea name="address" rows="2">${value("address")}</textarea></label>
            <label class="wide">Notes<textarea name="notes" rows="2">${value("notes")}</textarea></label>
            <section class="wide vvhr-doc-upload">
              <h4>Employee Documents</h4>
              <p>Upload PDF, JPG, PNG or DOCX files (maximum 8 MB per file). Documents remain private and visible only to authorised HR and the employee.</p>
              <div class="vvhr-doc-grid">
                <label>Aadhaar Front<input type="file" name="doc_aadhaar_front" accept=".pdf,.jpg,.jpeg,.png,.docx"></label>
                <label>Aadhaar Back<input type="file" name="doc_aadhaar_back" accept=".pdf,.jpg,.jpeg,.png,.docx"></label>
                <label>PAN Card<input type="file" name="doc_pan_card" accept=".pdf,.jpg,.jpeg,.png,.docx"></label>
                <label>Bank Proof<input type="file" name="doc_bank_proof" accept=".pdf,.jpg,.jpeg,.png,.docx"></label>
                <label>Resume<input type="file" name="doc_resume" accept=".pdf,.jpg,.jpeg,.png,.docx"></label>
                <label>Joining Form<input type="file" name="doc_joining_form" accept=".pdf,.jpg,.jpeg,.png,.docx"></label>
                <label>Employee Photo (JPG/PNG)<input type="file" name="doc_employee_photo" accept=".jpg,.jpeg,.png" capture="user"></label>
              </div>
              <div id="vvhr-existing-docs"><small>${e?"Loading previously uploaded documents…":"Documents will be linked after the employee record is saved."}</small></div>
            </section>
          </div>
          <div class="vvhr-form-actions"><button type="submit" id="vvhr-save">Save Employee</button><button type="button" class="alt" id="vvhr-cancel">Cancel</button></div>
          <div class="vvhr-error" id="vvhr-error"></div>
        </form>
      </div>`;
    modal.querySelector("#vvhr-close").onclick=closeForm;
    modal.querySelector("#vvhr-cancel").onclick=closeForm;
    if(e) showExistingDocuments(e.id);
    modal.querySelector("#vvhr-form").onsubmit=async ev=>{
      ev.preventDefault();
      const f=new FormData(ev.target);
      const accountNumber=f.get("bank_account_number").trim().replace(/\s+/g,"");
      const ifsc=f.get("bank_ifsc").trim().toUpperCase();
      if(!/^[0-9]{6,20}$/.test(accountNumber)){modal.querySelector("#vvhr-error").textContent="Please enter a valid bank account number (6–20 digits).";return;}
      if(!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifsc)){modal.querySelector("#vvhr-error").textContent="Please enter a valid 11-character IFSC code.";return;}
      const data={full_name:f.get("full_name").trim(),mobile:f.get("mobile").trim(),email:f.get("email").trim()||null,joining_date:f.get("joining_date"),department:f.get("department").trim()||null,designation:f.get("designation").trim()||null,monthly_fixed_salary:Number(f.get("monthly_fixed_salary")||0),employment_status:f.get("employment_status"),address:f.get("address").trim()||null,notes:f.get("notes").trim()||null,bank_account_name:f.get("bank_account_name").trim(),bank_account_number:accountNumber,bank_ifsc:ifsc};
      const btn=modal.querySelector("#vvhr-save"); btn.disabled=true;btn.textContent="Saving…";
      let result;if(e){result=await sb.from("vvhr_employees").update(data).eq("id",e.id);}else{result=await sb.from("vvhr_employees").insert(data).select("id,employee_code,email").single();}
      if(result.error){modal.querySelector("#vvhr-error").textContent=result.error.message;btn.disabled=false;btn.textContent="Save Employee";return;}
      const employeeId=e?.id||result.data?.id;
      const documentResult=await uploadEmployeeDocuments(employeeId,f);
      if(e && e.auth_user_id && e.employment_status!==data.employment_status){
        const access=await sb.functions.invoke("set-employee-portal-access",{body:{employee_id:e.id,employment_status:data.employment_status}});
        if(access.error||!access.data?.success){
          alert("Employee record updated, and HR self-access is blocked by database policy. Auth sign-in lock could not be synced: "+(access.error?.message||access.data?.error||"Unknown error"));
        }
      }
      const messages=[];
      if(documentResult.errors.length)messages.push("Some documents could not be uploaded: "+documentResult.errors.join("; "));
      if(!e&&employeeId){
        const letter=await sb.functions.invoke("generate-employee-offer-letter",{body:{employee_id:employeeId}});
        if(letter.error||!letter.data?.success){messages.push("Employee saved, but offer letter could not be generated: "+(letter.error?.message||letter.data?.error||"Unknown error"));}
        if(data.email){
          const account=await sb.functions.invoke("provision-employee-portal-account",{body:{employee_id:employeeId}});
          if(account.error||!account.data?.success){messages.push("Employee Portal login needs HR follow-up: "+(account.error?.message||account.data?.error||"Unknown error"));}
          else if(account.data.temporary_password){window.prompt("One-time Employee Portal password — share securely. Employee must change it at first login.",account.data.temporary_password);}
        }
      }
      closeForm();
      await load();
      if(documentResult.uploaded.length)messages.push(documentResult.uploaded.length+" document(s) uploaded successfully.");
      if(messages.length)alert(messages.join("\n"));
    };
  }

  async function showExistingDocuments(employeeId){
    const host=modal.querySelector("#vvhr-existing-docs"); if(!host)return;
    const result=await sb.from("vvhr_employee_documents").select("id,document_type,file_name,storage_path,uploaded_at").eq("employee_id",employeeId).order("uploaded_at",{ascending:false});
    if(result.error){host.innerHTML='<small class="vvhr-doc-error">Could not load existing documents: '+escapeHtml(result.error.message)+'</small>';return;}
    if(!result.data?.length){host.innerHTML='<small>No documents uploaded yet.</small>';return;}
    const labels={aadhaar_front:"Aadhaar Front",aadhaar_back:"Aadhaar Back",pan_card:"PAN Card",bank_proof:"Bank Proof",resume:"Resume",joining_form:"Joining Form",employee_photo:"Employee Photo",offer_letter:"Offer Letter"};
    const links=await Promise.all(result.data.map(async d=>{
      const signed=await sb.storage.from("vvhr-employee-documents").createSignedUrl(d.storage_path,300,{download:d.file_name});
      return '<div class="vvhr-doc-existing"><span><b>'+escapeHtml(labels[d.document_type]||d.document_type)+'</b><small>'+escapeHtml(d.file_name)+' · '+escapeHtml(new Date(d.uploaded_at).toLocaleDateString("en-IN"))+'</small></span>'+(signed.error?'': '<a href="'+escapeHtml(signed.data.signedUrl)+'" target="_blank" rel="noopener">Download</a>')+'</div>';
    }));
    host.innerHTML='<h5>Previously uploaded documents</h5>'+links.join("");
  }
  async function uploadEmployeeDocuments(employeeId,formData){
    const types=["aadhaar_front","aadhaar_back","pan_card","bank_proof","resume","joining_form","employee_photo"];
    const uploaded=[],errors=[];
    for(const type of types){
      const file=formData.get("doc_"+type);
      if(!file||!file.size)continue;
      if(file.size>8*1024*1024){errors.push(type.replaceAll("_"," ")+": file exceeds 8 MB");continue;}
      const allowed=["application/pdf","image/jpeg","image/png","application/vnd.openxmlformats-officedocument.wordprocessingml.document"];
      if(type==="employee_photo"&&!["image/jpeg","image/png"].includes(file.type)){errors.push("employee photo: upload JPG or PNG only");continue;}
      if(!allowed.includes(file.type)){errors.push(type.replaceAll("_"," ")+": unsupported file type");continue;}
      const cleanName=file.name.replace(/[^A-Za-z0-9._-]/g,"_").slice(-100);
      const path=employeeId+"/"+type+"/"+Date.now()+"_"+cleanName;
      const storage=sb.storage.from("vvhr-employee-documents");
      const up=await storage.upload(path,file,{contentType:file.type,upsert:false});
      if(up.error){errors.push(type.replaceAll("_"," ")+": "+up.error.message);continue;}
      const saved=await sb.from("vvhr_employee_documents").insert({employee_id:employeeId,document_type:type,file_name:file.name,storage_path:path});
      if(saved.error){await storage.remove([path]);errors.push(type.replaceAll("_"," ")+": "+saved.error.message);continue;}
      uploaded.push(type);
    }
    return {uploaded,errors};
  }

  function closeForm(){modal.hidden=true;modal.innerHTML="";editing=null;}
  root.querySelector("#vvhr-search").oninput=()=>{currentPage=1;draw();};
  root.querySelector("#vvhr-status").onchange=()=>{currentPage=1;draw();};
  root.querySelector("#vvhr-card-view").onclick=()=>{viewMode="cards";draw();};
  root.querySelector("#vvhr-list-view").onclick=()=>{viewMode="list";draw();};
  root.querySelector("#vvhr-page-size").onchange=()=>{currentPage=1;draw();};
  root.querySelector("#vvhr-prev").onclick=()=>{currentPage=Math.max(1,currentPage-1);draw();};
  root.querySelector("#vvhr-next").onclick=()=>{currentPage++;draw();};
  // Direct employee creation is disabled. New records are created only by the verified onboarding approval workflow.
  root.querySelector("#vvhr-exit-export").onclick=()=>{
    const exited=rows.filter(e=>["resigned","terminated"].includes(e.employment_status));
    const values=[["Employee Code","Employee Name","Department","Designation","Status","Resignation Date","Exit Date","Last Working Day","Exit Reason","Exit Approved At"],...exited.map(e=>[e.employee_code,e.full_name,e.department,e.designation,e.employment_status,e.resignation_date,e.exit_date||e.last_working_date,e.last_working_date,e.exit_reason,e.exit_approved_at])];
    const csv=values.map(row=>row.map(v=>'"'+String(v??"").replace(/"/g,'""')+'"').join(",")).join("\r\n");
    const blob=new Blob(["\\uFEFF"+csv],{type:"text/csv;charset=utf-8"}),url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download="VermiVeda_Employee_Exit_Report.csv";a.click();URL.revokeObjectURL(url);
  };
  root.querySelector("#vvhr-export").onclick=()=>{
    const csvRows=[["Employee ID","Name","Mobile","Email","Department","Designation","Joining Date","Salary","Status","Address"],...rows.map(e=>[e.employee_code,e.full_name,e.mobile,e.email,e.department,e.designation,e.joining_date,e.monthly_fixed_salary,e.employment_status,e.address])];
    const csvCell=v=>{let s=String(v??"");if(/^\s*[=+@-]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"';};
    const csv=csvRows.map(row=>row.map(csvCell).join(",")).join("\n");
    const a=document.createElement("a");a.href="data:text/csv;charset=utf-8,"+encodeURIComponent(csv);a.download="VermiVeda_Employees.csv";a.click();
  };
  root.querySelector("#vvhr-bank-export").onclick=()=>{
    const eligible=rows.filter(e=>["active","probation"].includes(e.employment_status));
    const missing=eligible.filter(e=>!e.bank_account_name||!e.bank_account_number||!e.bank_ifsc);
    if(missing.length&&!confirm(missing.length+" active/probation employee(s) have incomplete bank details and will be excluded. Download completed records only?"))return;
    const csvRows=[["Employee Code","Employee Name","Department","Designation","Bank Account Holder Name","Bank Account Number","IFSC Code","Monthly Salary (INR)","Employment Status"],...eligible.filter(e=>e.bank_account_name&&e.bank_account_number&&e.bank_ifsc).map(e=>[e.employee_code,e.full_name,e.department,e.designation,e.bank_account_name,e.bank_account_number,e.bank_ifsc,e.monthly_fixed_salary,e.employment_status])];
    if(csvRows.length===1){alert("No active/probation employees have complete bank details.");return;}
    const csvCell=v=>{let x=String(v??"");if(/^\s*[=+\-@]/.test(x))x="'"+x;return '"'+x.replace(/"/g,'""')+'"';};
    const csv="\uFEFF"+csvRows.map(row=>row.map(csvCell).join(",")).join("\r\n");
    const blob=new Blob([csv],{type:"text/csv;charset=utf-8"}),url=URL.createObjectURL(blob),a=document.createElement("a");
    a.href=url;a.download="VermiVeda_Salary_Bank_Report_"+new Date().toISOString().slice(0,10)+".csv";a.style.display="none";document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1500);
    alert("Downloaded "+(csvRows.length-1)+" employee records. "+missing.length+" incomplete records excluded.");
  };
  load();
}
