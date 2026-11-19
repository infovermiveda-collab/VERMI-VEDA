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
        ${canManage ? '<button id="vvhr-add">＋ Add Employee</button>' : ''}
      </div>
      <div class="vvhr-stats" id="vvhr-stats"></div>
      <div class="vvhr-toolbar">
        <input id="vvhr-search" placeholder="Search employee, code, phone or department…">
        <select id="vvhr-status"><option value="">All statuses</option><option value="active">Active</option><option value="probation">Probation</option><option value="resigned">Resigned</option><option value="terminated">Terminated</option></select>
        <button class="alt" id="vvhr-export">Export CSV</button><button class="alt" id="vvhr-bank-export">Salary Bank Report</button>
      </div>
      <div class="vvhr-tablewrap"><table><thead><tr><th>Employee ID</th><th>Name</th><th>Mobile</th><th>Email</th><th>Department</th><th>Designation</th><th>Joining Date</th><th>Monthly Salary</th><th>Status</th><th>Action</th></tr></thead><tbody id="vvhr-body"></tbody></table></div>
      <div class="vvhr-foot" id="vvhr-count"></div>
      <div id="vvhr-modal" class="vvhr-modal" hidden></div>
    </section>`;

  const body = root.querySelector("#vvhr-body");
  const modal = root.querySelector("#vvhr-modal");
  const draw = () => {
    const q = root.querySelector("#vvhr-search").value.trim().toLowerCase();
    const status = root.querySelector("#vvhr-status").value;
    const filtered = rows.filter(e => (!status || e.employment_status===status) && (!q || [e.employee_code,e.full_name,e.mobile,e.email,e.department,e.designation].join(" ").toLowerCase().includes(q)));
    const active = rows.filter(e=>e.employment_status==="active").length;
    root.querySelector("#vvhr-stats").innerHTML = `
      <div><small>Total Employees</small><b>${rows.length}</b></div>
      <div><small>Active</small><b>${active}</b></div>
      <div><small>Probation</small><b>${rows.filter(e=>e.employment_status==="probation").length}</b></div>
      <div><small>Resigned</small><b>${rows.filter(e=>e.employment_status==="resigned").length}</b></div>`;
    body.innerHTML = filtered.length ? filtered.map(e=>`<tr>
      <td><b>${escapeHtml(e.employee_code)}</b></td><td>${escapeHtml(e.full_name)}</td><td>${escapeHtml(e.mobile)}</td><td>${escapeHtml(e.email||"—")}</td>
      <td>${escapeHtml(e.department||"—")}</td><td>${escapeHtml(e.designation||"—")}</td><td>${escapeHtml(e.joining_date||"—")}</td>
      <td>${money(e.monthly_fixed_salary)}</td><td><span class="vvhr-badge ${escapeHtml(e.employment_status)}">${escapeHtml(e.employment_status)}</span></td>
      <td>${canManage ? `<div class="actions"><button class="alt vvhr-edit" data-id="${escapeHtml(e.id)}">Edit</button><button class="alt vvhr-bank-edit" data-id="${escapeHtml(e.id)}">Bank Details</button><button class="alt vvhr-offer" data-id="${escapeHtml(e.id)}">Offer Letter</button></div>` : "—"}</td></tr>`).join("") : '<tr><td colspan="10" class="vvhr-empty">No employee records found.</td></tr>';
    root.querySelector("#vvhr-count").textContent = `Showing ${filtered.length} of ${rows.length} employees`;
    body.querySelectorAll(".vvhr-edit,.vvhr-bank-edit").forEach(b=>b.onclick=()=>openForm(rows.find(e=>e.id===b.dataset.id)));
    body.querySelectorAll(".vvhr-offer").forEach(b=>b.onclick=async()=>{const row=rows.find(e=>e.id===b.dataset.id);b.disabled=true;b.textContent="Generating…";const r=await sb.functions.invoke("generate-employee-offer-letter",{body:{employee_id:row.id}});if(r.error||!r.data?.success){alert("Offer letter could not be generated: "+(r.error?.message||r.data?.error||"Unknown error"));b.disabled=false;b.textContent="Offer Letter";return;}let note="Offer letter uploaded for "+row.employee_code+".";if(row.email){const account=await sb.functions.invoke("provision-employee-portal-account",{body:{employee_id:row.id}});if(account.error||!account.data?.success)note+=" Portal login needs follow-up: "+(account.error?.message||account.data?.error||"Unknown error");else if(account.data.temporary_password)window.prompt("Employee Portal temporary password — share securely with the employee.",account.data.temporary_password);}alert(note);b.disabled=false;b.textContent="Offer Letter";});
  };
  async function load() {
    const r = await sb.from("vvhr_employees").select("*").order("employee_code",{ascending:true});
    if(r.error) { root.querySelector("#vvhr-count").textContent = "Unable to load employee records: "+r.error.message; return; }
    rows = r.data||[]; draw();
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
          </div>
          <div class="vvhr-form-actions"><button type="submit" id="vvhr-save">Save Employee</button><button type="button" class="alt" id="vvhr-cancel">Cancel</button></div>
          <div class="vvhr-error" id="vvhr-error"></div>
        </form>
      </div>`;
    modal.querySelector("#vvhr-close").onclick=closeForm;
    modal.querySelector("#vvhr-cancel").onclick=closeForm;
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
      closeForm();if(!e&&result.data?.id){const letter=await sb.functions.invoke("generate-employee-offer-letter",{body:{employee_id:result.data.id}});if(letter.error||!letter.data?.success){alert("Employee saved, but offer letter upload failed: "+(letter.error?.message||letter.data?.error||"Unknown error"));}else if(result.data.email){const account=await sb.functions.invoke("provision-employee-portal-account",{body:{employee_id:result.data.id}});if(account.error||!account.data?.success){alert("Offer letter uploaded. Employee Portal login needs HR follow-up: "+(account.error?.message||account.data?.error||"Unknown error"));}else if(account.data.temporary_password){window.prompt("Employee Portal temporary password — share securely with the employee.",account.data.temporary_password);}}}await load();
    };
  }
  function closeForm(){modal.hidden=true;modal.innerHTML="";editing=null;}
  root.querySelector("#vvhr-search").oninput=draw;
  root.querySelector("#vvhr-status").onchange=draw;
  root.querySelector("#vvhr-add")?.addEventListener("click",()=>openForm());
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
    const csvCell=v=>{let x=String(v??"");if(/^\\s*[=+@-]/.test(x))x="'"+x;return '"'+x.replace(/"/g,'""')+'"';};
    const csv="\\uFEFF"+csvRows.map(row=>row.map(csvCell).join(",")).join("\\r\\n");
    const blob=new Blob([csv],{type:"text/csv;charset=utf-8"}),url=URL.createObjectURL(blob),a=document.createElement("a");
    a.href=url;a.download="VermiVeda_Salary_Bank_Report_"+new Date().toISOString().slice(0,10)+".csv";a.click();URL.revokeObjectURL(url);
    alert("Downloaded "+(csvRows.length-1)+" employee records. "+missing.length+" incomplete records excluded.");
  };
  load();
}
