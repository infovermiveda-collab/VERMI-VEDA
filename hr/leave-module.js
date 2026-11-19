// Vermi Veda HRMS — Leave Management
// Admin/HR manages requests and leave allocations. Employees can self-serve after their HR employee record is linked to auth_user_id.
export function renderLeaveModule(root, sb, options = {}) {
  const canManage = options.canManage === true;
  const userId = options.currentUserId;
  const esc = v => String(v ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const localDate = () => { const d = new Date(); return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0"); };
  const leaveTypes = [["casual","Casual Leave"],["sick","Sick Leave"],["earned","Earned Leave"],["unpaid","Unpaid Leave"],["other","Other"]];
  let employees = [], requests = [], balances = [], accounts = [], selfEmployee = null, activeTab = "requests";
  const typeLabel = t => (leaveTypes.find(x=>x[0]===t)||[t,t])[1];
  const statusPill = s => '<span class="vvl-status vvl-'+esc(s)+'">'+esc((s||"pending").replace("_"," "))+'</span>';
  const businessDays = (start,end) => { if(!start||!end)return 0;let n=0,d=new Date(start+"T12:00:00"),last=new Date(end+"T12:00:00");while(d<=last){if(d.getDay()!==0)n++;d.setDate(d.getDate()+1);}return n; };
  root.innerHTML = '<section class="vvl-wrap"><header class="vvl-head"><div><h2>Leave Management</h2><p>Leave requests, approvals and annual leave balances</p></div><button class="alt" id="vvl-refresh">↻ Refresh</button></header><div id="vvl-content"><div class="vvl-loading">Loading leave records…</div></div></section>';
  const content = root.querySelector("#vvl-content");
  async function load() {
    content.innerHTML = '<div class="vvl-loading">Loading leave records…</div>';
    if (canManage) {
      const results = await Promise.all([
        sb.from("vvhr_employees").select("id,employee_code,full_name,department,employment_status").order("full_name"),
        sb.from("vvhr_leave_requests").select("*").order("created_at",{ascending:false}),
        sb.from("vvhr_leave_balances").select("*").order("leave_year",{ascending:false})
      ]);
      const failed = results.find(x=>x.error);
      if(failed){content.innerHTML='<div class="vvl-error">Could not load leave data: '+esc(failed.error.message)+'</div>';return;}
      employees=results[0].data||[];requests=results[1].data||[];balances=results[2].data||[];
      renderAdmin();
    } else {
      const er = await sb.from("vvhr_employees").select("id,employee_code,full_name,department").eq("auth_user_id",userId).maybeSingle();
      if(er.error){content.innerHTML='<div class="vvl-error">Employee profile could not be loaded: '+esc(er.error.message)+'</div>';return;}
      selfEmployee=er.data;
      if(!selfEmployee){content.innerHTML='<div class="vvl-empty"><h3>Employee account not linked</h3><p>Your HR employee record is not linked to this login yet. Please ask HR to link your account before applying for leave.</p></div>';return;}
      const results=await Promise.all([
        sb.from("vvhr_leave_requests").select("*").eq("employee_id",selfEmployee.id).order("created_at",{ascending:false}),
        sb.from("vvhr_leave_balances").select("*").eq("employee_id",selfEmployee.id).order("leave_year",{ascending:false})
      ]);
      const failed=results.find(x=>x.error);
      if(failed){content.innerHTML='<div class="vvl-error">Could not load your leave data: '+esc(failed.error.message)+'</div>';return;}
      requests=results[0].data||[];balances=results[1].data||[];
      renderSelf();
    }
  }
  function tabButtons() {
    return '<div class="vvl-tabs"><button class="alt '+(activeTab==="requests"?"active":"")+'" data-vvl-tab="requests">Leave Requests</button>'+(canManage?'<button class="alt '+(activeTab==="balances"?"active":"")+'" data-vvl-tab="balances">Leave Balances</button><button class="alt '+(activeTab==="accounts"?"active":"")+'" data-vvl-tab="accounts">Employee Login Linking</button>':'')+'</div>';
  }
  function renderAdmin() {
    const pending=requests.filter(r=>r.status==="pending").length;
    const approved=requests.filter(r=>r.status==="approved").length;
    const rejected=requests.filter(r=>r.status==="rejected").length;
    const stats='<div class="vvl-stats"><div><small>Total Requests</small><b>'+requests.length+'</b></div><div><small>Pending Approval</small><b>'+pending+'</b></div><div><small>Approved</small><b>'+approved+'</b></div><div><small>Rejected</small><b>'+rejected+'</b></div></div>';
    content.innerHTML=stats+tabButtons()+(activeTab==="requests"?requestsAdminHtml():activeTab==="balances"?balancesAdminHtml():"");
    content.querySelectorAll("[data-vvl-tab]").forEach(b=>b.onclick=()=>{activeTab=b.dataset.vvlTab;renderAdmin();});
    if(activeTab==="requests")bindAdminRequests();
    if(activeTab==="balances")bindBalances();
    if(activeTab==="accounts")renderAccountLinking();
  }
  async function renderAccountLinking() {
    content.insertAdjacentHTML("beforeend", '<div class="vvl-panel"><h3>Link Employee to Existing Login</h3><p class="vvl-note">Only active Field Executive accounts are shown. Linking enables employee self-service leave requests for that login.</p><div id="vvl-account-link-body" class="vvl-loading">Loading login accounts…</div></div>');
    const target=content.querySelector("#vvl-account-link-body");
    const result=await sb.from("oms_profiles").select("user_id,full_name,role,active").eq("role","fe").eq("active",true).order("full_name");
    if(result.error){target.innerHTML='<div class="vvl-error">Could not load active FE logins: '+esc(result.error.message)+'</div>';return;}
    accounts=result.data||[];
    const draw=()=>{
      const body=employees.filter(e=>["active","probation"].includes(e.employment_status));
      const linkedIds=employees.filter(e=>e.auth_user_id).map(e=>e.auth_user_id);
      target.innerHTML='<div class="vvl-table-wrap"><table><thead><tr><th>Employee</th><th>Department</th><th>Current Login</th><th>Link Active FE Login</th><th>Action</th></tr></thead><tbody>'+body.map(e=>{
        const current=accounts.find(a=>a.user_id===e.auth_user_id);
        const options=accounts.filter(a=>!linkedIds.includes(a.user_id)||a.user_id===e.auth_user_id);
        const exact=options.find(a=>a.full_name.trim().toLowerCase()===e.full_name.trim().toLowerCase());
        const selected=e.auth_user_id||exact?.user_id||"";
        return '<tr><td><b>'+esc(e.full_name)+'</b><small>'+esc(e.employee_code)+'</small></td><td>'+esc(e.department||"—")+'</td><td>'+(current?'<span class="vvl-status vvl-approved">Linked: '+esc(current.full_name)+'</span>':'<span class="vvl-status">Not linked</span>')+'</td><td><select data-vvl-account="'+esc(e.id)+'"><option value="">Select active FE login</option>'+options.map(a=>'<option value="'+esc(a.user_id)+'" '+(selected===a.user_id?"selected":"")+'>'+esc(a.full_name)+'</option>').join("")+'</select></td><td><button data-vvl-link="'+esc(e.id)+'" '+(e.auth_user_id?"disabled":"")+'>Link Account</button></td></tr>';
      }).join("")+'</tbody></table></div><p class="vvl-note">A login can be linked to only one employee. The matching name is preselected where exact; please verify before clicking Link Account.</p>';
      target.querySelectorAll("[data-vvl-link]").forEach(btn=>btn.onclick=async()=>{
        const employeeId=btn.dataset.vvlLink,select=target.querySelector('[data-vvl-account="'+employeeId+'"]'),userId=select?.value;
        if(!userId){alert("Select an active FE login first.");return;}
        const employee=employees.find(e=>e.id===employeeId),account=accounts.find(a=>a.user_id===userId);
        if(!confirm('Link '+employee.full_name+' with login '+account?.full_name+'?'))return;
        btn.disabled=true;btn.textContent="Linking…";
        const linked=await sb.rpc("vvhr_admin_link_employee_account",{p_employee_id:employeeId,p_user_id:userId});
        if(linked.error){alert("Account linking failed: "+linked.error.message);btn.disabled=false;btn.textContent="Link Account";return;}
        const emp=await sb.from("vvhr_employees").select("id,employee_code,full_name,department,employment_status,auth_user_id").order("full_name");
        if(emp.error){alert("Account linked, but employee list could not refresh: "+emp.error.message);return;}
        employees=emp.data||[];renderAdmin();
      });
    };
    draw();
  }
  function requestsAdminHtml() {
    const opts=employees.map(e=>'<option value="'+esc(e.id)+'">'+esc(e.employee_code)+' — '+esc(e.full_name)+'</option>').join("");
    return '<div class="vvl-panel"><h3>Apply Leave on Behalf of Employee</h3><form id="vvl-admin-apply" class="vvl-form"><label>Employee<select name="employee_id" required><option value="">Select employee</option>'+opts+'</select></label><label>Leave Type<select name="leave_type">'+leaveTypes.map(t=>'<option value="'+t[0]+'">'+t[1]+'</option>').join("")+'</select></label><label>From Date<input name="start_date" type="date" min="2000-01-01" required></label><label>To Date<input name="end_date" type="date" required></label><label class="wide">Reason<textarea name="reason" rows="2" maxlength="1000" required placeholder="Enter reason for leave"></textarea></label><div class="vvl-form-action"><span id="vvl-preview-days">Sundays are excluded from leave days.</span><button type="submit" id="vvl-submit-request">Submit Request</button></div></form></div><div class="vvl-panel"><div class="vvl-toolbar"><h3>Leave Request Register</h3><select id="vvl-status-filter"><option value="">All Statuses</option><option value="pending">Pending</option><option value="approved">Approved</option><option value="rejected">Rejected</option><option value="cancelled">Cancelled</option></select><input id="vvl-search" placeholder="Search employee or leave type"></div><div class="vvl-table-wrap"><table><thead><tr><th>Employee</th><th>Leave Type</th><th>Dates</th><th>Days</th><th>Reason</th><th>Status</th><th>Action</th></tr></thead><tbody id="vvl-request-rows"></tbody></table></div><p class="vvl-note">Leave days are calculated automatically, excluding Sundays. Requests cannot cross calendar years or overlap another pending/approved leave.</p></div>';
  }
  function bindAdminRequests() {
    const form=content.querySelector("#vvl-admin-apply"),from=form.elements.start_date,to=form.elements.end_date,preview=content.querySelector("#vvl-preview-days");
    const previewDays=()=>{preview.textContent=from.value&&to.value?"Calculated leave days (Sunday excluded): "+businessDays(from.value,to.value):"Sundays are excluded from leave days.";};
    from.onchange=previewDays;to.onchange=previewDays;
    form.onsubmit=async e=>{
      e.preventDefault();
      if(from.value>to.value){alert("To Date cannot be earlier than From Date.");return;}
      if(new Date(from.value+"T12:00:00").getFullYear()!==new Date(to.value+"T12:00:00").getFullYear()){alert("A leave request must be within one calendar year.");return;}
      if(!businessDays(from.value,to.value)){alert("Selected dates contain only Sunday weekly offs.");return;}
      const btn=form.querySelector("button[type=submit]");btn.disabled=true;btn.textContent="Submitting…";
      const result=await sb.from("vvhr_leave_requests").insert({employee_id:form.elements.employee_id.value,leave_type:form.elements.leave_type.value,start_date:from.value,end_date:to.value,reason:form.elements.reason.value.trim(),requested_by:userId}).select("*").single();
      btn.disabled=false;btn.textContent="Submit Request";
      if(result.error){alert("Leave request could not be saved: "+result.error.message);return;}
      requests.unshift(result.data);renderAdmin();
    };
    const rows=content.querySelector("#vvl-request-rows");
    function drawRows(){
      const status=content.querySelector("#vvl-status-filter").value,q=content.querySelector("#vvl-search").value.trim().toLowerCase();
      const list=requests.filter(r=>(!status||r.status===status)&&(!q||[employeeName(r.employee_id),typeLabel(r.leave_type),r.reason].join(" ").toLowerCase().includes(q)));
      rows.innerHTML=list.length?list.map(r=>'<tr><td><b>'+esc(employeeName(r.employee_id))+'</b><small>'+esc(employeeCode(r.employee_id))+'</small></td><td>'+esc(typeLabel(r.leave_type))+'</td><td>'+esc(r.start_date)+'<small>to '+esc(r.end_date)+'</small></td><td><b>'+Number(r.requested_days).toFixed(1)+'</b></td><td class="vvl-reason">'+esc(r.reason)+'</td><td>'+statusPill(r.status)+'</td><td>'+(r.status==="pending"?'<div class="vvl-actions"><button data-vvl-approve="'+esc(r.id)+'">Approve</button><button class="danger" data-vvl-reject="'+esc(r.id)+'">Reject</button></div>':(r.reviewer_remarks?'<small>'+esc(r.reviewer_remarks)+'</small>':'—'))+'</td></tr>').join(""):'<tr><td colspan="7" class="vvl-empty">No leave requests found.</td></tr>';
      rows.querySelectorAll("[data-vvl-approve]").forEach(b=>b.onclick=()=>review(b.dataset.vvlApprove,"approved"));
      rows.querySelectorAll("[data-vvl-reject]").forEach(b=>b.onclick=()=>review(b.dataset.vvlReject,"rejected"));
    }
    content.querySelector("#vvl-status-filter").onchange=drawRows;content.querySelector("#vvl-search").oninput=drawRows;drawRows();
  }
  async function review(id,status){
    const note=prompt(status==="approved"?"Approval remarks (optional):":"Please enter rejection reason:");
    if(note===null)return;
    if(status==="rejected"&&!String(note||"").trim()){alert("Rejection reason is required.");return;}
    const result=await sb.from("vvhr_leave_requests").update({status,reviewed_by:userId,reviewed_at:new Date().toISOString(),reviewer_remarks:String(note||"").trim()||null}).eq("id",id).eq("status","pending").select("*").single();
    if(result.error){alert("Could not update request: "+result.error.message);return;}
    const i=requests.findIndex(r=>r.id===id);if(i>=0)requests[i]=result.data;renderAdmin();
  }
  function employeeName(id){return employees.find(e=>e.id===id)?.full_name||"Employee";}
  function employeeCode(id){return employees.find(e=>e.id===id)?.employee_code||"";}
  function balancesAdminHtml(){
    const opts=employees.map(e=>'<option value="'+esc(e.id)+'">'+esc(e.employee_code)+' — '+esc(e.full_name)+'</option>').join("");
    const year=new Date().getFullYear();
    return '<div class="vvl-panel"><h3>Set / Update Leave Allocation</h3><form id="vvl-balance-form" class="vvl-form"><label>Employee<select name="employee_id" required><option value="">Select employee</option>'+opts+'</select></label><label>Leave Year<input name="leave_year" type="number" min="2020" max="2100" value="'+year+'" required></label><label>Leave Type<select name="leave_type">'+leaveTypes.map(t=>'<option value="'+t[0]+'">'+t[1]+'</option>').join("")+'</select></label><label>Annual Quota (days)<input name="annual_quota" type="number" min="0" step="0.5" value="0" required></label><label>Carry Forward (days)<input name="carry_forward" type="number" min="0" step="0.5" value="0"></label><label>Adjustment (+/- days)<input name="adjustment_days" type="number" step="0.5" value="0"></label><label class="wide">Notes<input name="notes" maxlength="500" placeholder="Optional policy / adjustment note"></label><div class="vvl-form-action"><span>Balance is calculated from approved leave requests only.</span><button type="submit">Save Allocation</button></div></form></div><div class="vvl-panel"><h3>Employee Leave Balances</h3><div class="vvl-toolbar"><input id="vvl-balance-search" placeholder="Search employee"><select id="vvl-balance-year"><option value="'+year+'">'+year+'</option><option value="'+(year+1)+'">'+(year+1)+'</option><option value="'+(year-1)+'">'+(year-1)+'</option></select></div><div class="vvl-table-wrap"><table><thead><tr><th>Employee</th><th>Leave Year</th><th>Type</th><th>Annual Quota</th><th>Carry Forward</th><th>Adjustment</th><th>Used</th><th>Available</th><th>Notes</th></tr></thead><tbody id="vvl-balance-rows"></tbody></table></div><p class="vvl-note">Only approved leave is deducted. Sunday is excluded from leave days. Allocations are not assumed; configure each employee leave entitlement here.</p></div>';
  }
  function bindBalances(){
    const form=content.querySelector("#vvl-balance-form");
    form.onsubmit=async e=>{
      e.preventDefault();const f=new FormData(form),payload={employee_id:f.get("employee_id"),leave_year:Number(f.get("leave_year")),leave_type:f.get("leave_type"),annual_quota:Number(f.get("annual_quota")),carry_forward:Number(f.get("carry_forward")||0),adjustment_days:Number(f.get("adjustment_days")||0),notes:String(f.get("notes")||"").trim()||null};
      const btn=form.querySelector("button[type=submit]");btn.disabled=true;btn.textContent="Saving…";
      const result=await sb.from("vvhr_leave_balances").upsert(payload,{onConflict:"employee_id,leave_year,leave_type"}).select("*").single();
      btn.disabled=false;btn.textContent="Save Allocation";
      if(result.error){alert("Could not save leave allocation: "+result.error.message);return;}
      const i=balances.findIndex(b=>b.employee_id===payload.employee_id&&b.leave_year===payload.leave_year&&b.leave_type===payload.leave_type);if(i>=0)balances[i]=result.data;else balances.unshift(result.data);drawBalanceRows();
    };
    content.querySelector("#vvl-balance-search").oninput=drawBalanceRows;content.querySelector("#vvl-balance-year").onchange=drawBalanceRows;drawBalanceRows();
  }
  function drawBalanceRows(){
    const q=content.querySelector("#vvl-balance-search").value.trim().toLowerCase(),year=Number(content.querySelector("#vvl-balance-year").value),rows=content.querySelector("#vvl-balance-rows");
    const list=balances.filter(b=>b.leave_year===year&&(!q||employeeName(b.employee_id).toLowerCase().includes(q)||employeeCode(b.employee_id).toLowerCase().includes(q)));
    rows.innerHTML=list.length?list.map(b=>{const used=requests.filter(r=>r.employee_id===b.employee_id&&r.leave_type===b.leave_type&&r.status==="approved"&&Number(r.start_date.slice(0,4))===year).reduce((n,r)=>n+Number(r.requested_days||0),0),available=Number(b.annual_quota)+Number(b.carry_forward)+Number(b.adjustment_days)-used;return '<tr><td><b>'+esc(employeeName(b.employee_id))+'</b><small>'+esc(employeeCode(b.employee_id))+'</small></td><td>'+b.leave_year+'</td><td>'+esc(typeLabel(b.leave_type))+'</td><td>'+Number(b.annual_quota).toFixed(1)+'</td><td>'+Number(b.carry_forward).toFixed(1)+'</td><td>'+Number(b.adjustment_days).toFixed(1)+'</td><td>'+used.toFixed(1)+'</td><td><b class="'+(available<0?'vvl-negative':'')+'">'+available.toFixed(1)+'</b></td><td>'+esc(b.notes||"—")+'</td></tr>';}).join(""):'<tr><td colspan="9" class="vvl-empty">No leave allocations configured for this year.</td></tr>';
  }
  function renderSelf(){
    const year=new Date().getFullYear(),ownBalances=balances.filter(b=>b.leave_year===year);
    content.innerHTML='<div class="vvl-self-head"><h3>Hello, '+esc(selfEmployee.full_name)+'</h3><p>Submit a leave request and track its approval status.</p></div><div class="vvl-panel"><h3>Apply for Leave</h3><form id="vvl-self-apply" class="vvl-form"><label>Leave Type<select name="leave_type">'+leaveTypes.map(t=>'<option value="'+t[0]+'">'+t[1]+'</option>').join("")+'</select></label><label>From Date<input name="start_date" type="date" min="'+localDate()+'" required></label><label>To Date<input name="end_date" type="date" min="'+localDate()+'" required></label><label class="wide">Reason<textarea name="reason" rows="2" maxlength="1000" required placeholder="Enter reason for leave"></textarea></label><div class="vvl-form-action"><span id="vvl-self-days">Sundays are excluded from leave days.</span><button type="submit">Submit Leave Request</button></div></form></div><div class="vvl-panel"><h3>My Leave Balance — '+year+'</h3><div class="vvl-balance-cards">'+(ownBalances.length?ownBalances.map(b=>{const used=requests.filter(r=>r.leave_type===b.leave_type&&r.status==="approved"&&Number(r.start_date.slice(0,4))===year).reduce((n,r)=>n+Number(r.requested_days||0),0),available=Number(b.annual_quota)+Number(b.carry_forward)+Number(b.adjustment_days)-used;return '<div><small>'+esc(typeLabel(b.leave_type))+'</small><b>'+available.toFixed(1)+' days</b><span>'+used.toFixed(1)+' used of '+(Number(b.annual_quota)+Number(b.carry_forward)+Number(b.adjustment_days)).toFixed(1)+'</span></div>';}).join(""):'<p class="vvl-note">Your leave allocation has not been configured by HR yet.</p>')+'</div></div><div class="vvl-panel"><h3>My Leave History</h3><div class="vvl-table-wrap"><table><thead><tr><th>Type</th><th>Dates</th><th>Days</th><th>Reason</th><th>Status</th><th>HR Remarks</th></tr></thead><tbody id="vvl-self-rows"></tbody></table></div></div>';
    const form=content.querySelector("#vvl-self-apply"),from=form.elements.start_date,to=form.elements.end_date,preview=content.querySelector("#vvl-self-days");
    const previewDays=()=>{preview.textContent=from.value&&to.value?"Calculated leave days (Sunday excluded): "+businessDays(from.value,to.value):"Sundays are excluded from leave days.";};from.onchange=previewDays;to.onchange=previewDays;
    form.onsubmit=async e=>{e.preventDefault();if(from.value>to.value){alert("To Date cannot be earlier than From Date.");return;}if(new Date(from.value+"T12:00:00").getFullYear()!==new Date(to.value+"T12:00:00").getFullYear()){alert("A leave request must be within one calendar year.");return;}if(!businessDays(from.value,to.value)){alert("Selected dates contain only Sunday weekly offs.");return;}const btn=form.querySelector("button[type=submit]");btn.disabled=true;const f=new FormData(form),result=await sb.from("vvhr_leave_requests").insert({employee_id:selfEmployee.id,leave_type:f.get("leave_type"),start_date:from.value,end_date:to.value,reason:String(f.get("reason")).trim(),requested_by:userId}).select("*").single();btn.disabled=false;if(result.error){alert("Leave request could not be submitted: "+result.error.message);return;}requests.unshift(result.data);renderSelf();};
    const rows=content.querySelector("#vvl-self-rows");rows.innerHTML=requests.length?requests.map(r=>'<tr><td>'+esc(typeLabel(r.leave_type))+'</td><td>'+esc(r.start_date)+'<small>to '+esc(r.end_date)+'</small></td><td>'+Number(r.requested_days).toFixed(1)+'</td><td>'+esc(r.reason)+'</td><td>'+statusPill(r.status)+'</td><td>'+esc(r.reviewer_remarks||"—")+'</td></tr>').join(""):'<tr><td colspan="6" class="vvl-empty">No leave requests submitted yet.</td></tr>';
  }
  root.querySelector("#vvl-refresh").onclick=load;
  load();
}
