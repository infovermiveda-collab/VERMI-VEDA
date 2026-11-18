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
        <button class="alt" id="vvhr-export">Export CSV</button>
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
      <td>${canManage ? `<button class="alt vvhr-edit" data-id="${escapeHtml(e.id)}">Edit</button>` : "—"}</td></tr>`).join("") : '<tr><td colspan="9" class="vvhr-empty">No employee records found.</td></tr>';
    root.querySelector("#vvhr-count").textContent = `Showing ${filtered.length} of ${rows.length} employees`;
    body.querySelectorAll(".vvhr-edit").forEach(b=>b.onclick=()=>openForm(rows.find(e=>e.id===b.dataset.id)));
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
            <label>Mobile *<input name="mobile" required inputmode="tel" value="${value("mobile")}"></label>\n            <label>Email<input name="email" type="email" value="${value("email")}"></label>
            <label>Joining Date *<input name="joining_date" required type="date" value="${value("joining_date")}"></label>
            <label>Department<input name="department" value="${value("department")}"></label>
            <label>Designation<input name="designation" value="${value("designation")}"></label>
            <label>Monthly Salary (₹)<input name="monthly_fixed_salary" type="number" min="0" step="0.01" value="${value("monthly_fixed_salary")}"></label>
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
      const data={full_name:f.get("full_name").trim(),mobile:f.get("mobile").trim(),email:f.get("email").trim()||null,joining_date:f.get("joining_date"),department:f.get("department").trim()||null,designation:f.get("designation").trim()||null,monthly_fixed_salary:Number(f.get("monthly_fixed_salary")||0),employment_status:f.get("employment_status"),address:f.get("address").trim()||null,notes:f.get("notes").trim()||null};
      const btn=modal.querySelector("#vvhr-save"); btn.disabled=true;btn.textContent="Saving…";
      let result;if(e){result=await sb.from("vvhr_employees").update(data).eq("id",e.id);}else{result=await sb.from("vvhr_employees").insert(data);}
      if(result.error){modal.querySelector("#vvhr-error").textContent=result.error.message;btn.disabled=false;btn.textContent="Save Employee";return;}
      closeForm();await load();
    };
  }
  function closeForm(){modal.hidden=true;modal.innerHTML="";editing=null;}
  root.querySelector("#vvhr-search").oninput=draw;
  root.querySelector("#vvhr-status").onchange=draw;
  root.querySelector("#vvhr-add")?.addEventListener("click",()=>openForm());
  root.querySelector("#vvhr-export").onclick=()=>{
    const csvRows=[["Employee ID","Name","Mobile","Email","Department","Designation","Joining Date","Salary","Status","Address"],...rows.map(e=>[e.employee_code,e.full_name,e.mobile,e.email,e.department,e.designation,e.joining_date,e.monthly_fixed_salary,e.employment_status,e.address])];
    const csvCell=v=>{let s=String(v??"");if(/^[\\s]*[=+\\-@]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"';};
    const csv=csvRows.map(row=>row.map(csvCell).join(",")).join("\n");
    const a=document.createElement("a");a.href="data:text/csv;charset=utf-8,"+encodeURIComponent(csv);a.download="VermiVeda_Employees.csv";a.click();
  };
  load();
}
