// Vermi Veda HR — Daily Attendance (Phase 2)
// Admin/HR only. Requires vvhr_attendance migration and vvhr_employees.
export function renderAttendanceModule(root, sb, options = {}) {
  if (options.canManage === false) {
    root.innerHTML = '<div class="vvhr-attendance-card"><h2>Attendance</h2><p>HR/admin access required.</p></div>';
    return;
  }
  const esc = v => String(v ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const localDate = () => { const d = new Date(); return [d.getFullYear(),String(d.getMonth()+1).padStart(2,"0"),String(d.getDate()).padStart(2,"0")].join("-"); };
  let employees = [], attendance = [], saving = false;
  root.innerHTML = `
    <section class="vvhr-attendance">
      <header class="vvhr-attendance-head">
        <div><h2>Daily Attendance</h2><p>Mark and review employee attendance by date</p></div>
        <button class="alt" id="vva-refresh">↻ Refresh</button>
      </header>
      <div class="vvhr-attendance-filters">
        <label>Attendance Date<input id="vva-date" type="date" value="${localDate()}"></label>
        <label>Department<select id="vva-dept"><option value="">All Departments</option></select></label>
        <label>Search Employee<input id="vva-search" placeholder="Name, employee code or mobile"></label>
        <button class="alt" id="vva-export">Export CSV</button>
      </div>
      <div class="vvhr-attendance-stats" id="vva-stats"></div>
      <div class="vvhr-attendance-note">Choose a status for each employee. Changes are saved per employee; unmarked employees remain unmarked.</div>
      <div class="vvhr-attendance-table"><table><thead><tr><th>Employee</th><th>Department</th><th>Status</th><th>Check In</th><th>Check Out</th><th>Late (min)</th><th>OT (min)</th><th>Remarks</th><th>Save</th></tr></thead><tbody id="vva-body"></tbody></table></div>
      <p class="vvhr-attendance-foot" id="vva-foot"></p>
    </section>`;
  const dateEl=root.querySelector("#vva-date"), deptEl=root.querySelector("#vva-dept"), searchEl=root.querySelector("#vva-search"), body=root.querySelector("#vva-body"), stats=root.querySelector("#vva-stats"), foot=root.querySelector("#vva-foot");
  const byId = id => attendance.find(a=>a.employee_id===id);
  const departments = () => [...new Set(employees.map(e=>e.department).filter(Boolean))].sort();
  async function load() {
    foot.textContent="Loading employees and attendance…";
    const [er, ar] = await Promise.all([
      sb.from("vvhr_employees").select("id,employee_code,full_name,mobile,department,designation,employment_status").in("employment_status",["active","probation"]).order("employee_code"),
      sb.from("vvhr_attendance").select("*").eq("attendance_date",dateEl.value)
    ]);
    if(er.error){foot.textContent="Employee load failed: "+er.error.message;return;}
    if(ar.error){foot.textContent="Attendance load failed: "+ar.error.message+" — apply the HR attendance SQL migration first.";return;}
    employees=er.data||[]; attendance=ar.data||[];
    const selected=deptEl.value;
    deptEl.innerHTML='<option value="">All Departments</option>'+departments().map(d=>'<option value="'+esc(d)+'">'+esc(d)+'</option>').join("");
    deptEl.value=selected;
    draw();
  }
  function draw(){
    const q=searchEl.value.trim().toLowerCase(), dept=deptEl.value;
    const filtered=employees.filter(e=>(!dept||e.department===dept)&&(!q||[e.employee_code,e.full_name,e.mobile,e.department,e.designation].join(" ").toLowerCase().includes(q)));
    const count=s=>filtered.filter(e=>byId(e.id)?.status===s).length;
    const marked=filtered.filter(e=>byId(e.id)).length;
    stats.innerHTML=[
      ["Employees",filtered.length],["Present",count("present")],["Absent",count("absent")],["Half Day",count("half_day")],["Paid Leave",count("paid_leave")],["Not Marked",filtered.length-marked]
    ].map(([l,n])=>'<div><small>'+l+'</small><b>'+n+'</b></div>').join("");
    body.innerHTML=filtered.length?filtered.map(e=>{
      const a=byId(e.id)||{};
      return '<tr data-employee="'+esc(e.id)+'"><td><b>'+esc(e.full_name)+'</b><small>'+esc(e.employee_code||"")+' · '+esc(e.mobile||"")+'</small></td><td>'+esc(e.department||"—")+'</td>'+
      '<td><select data-field="status"><option value="">Not Marked</option>'+[['present','Present'],['absent','Absent'],['half_day','Half Day'],['paid_leave','Paid Leave'],['unpaid_leave','Unpaid Leave'],['holiday','Holiday'],['weekly_off','Weekly Off']].map(([v,l])=>'<option value="'+v+'" '+(a.status===v?'selected':'')+'>'+l+'</option>').join("")+'</select></td>'+
      '<td><input data-field="check_in" type="time" value="'+esc(a.check_in||"")+'"></td><td><input data-field="check_out" type="time" value="'+esc(a.check_out||"")+'"></td>'+
      '<td><input data-field="late_minutes" type="number" min="0" step="1" value="'+esc(a.late_minutes??0)+'"></td><td><input data-field="overtime_minutes" type="number" min="0" step="1" value="'+esc(a.overtime_minutes??0)+'"></td>'+
      '<td><input data-field="remarks" maxlength="500" value="'+esc(a.remarks||"")+'" placeholder="Optional"></td><td><button class="vva-save">Save</button></td></tr>';
    }).join(""):'<tr><td colspan="9" class="vvhr-attendance-empty">No active/probation employees found for this filter.</td></tr>';
    foot.textContent='Showing '+filtered.length+' employees · '+marked+' attendance records saved for '+dateEl.value;
    body.querySelectorAll(".vva-save").forEach(btn=>btn.onclick=()=>saveRow(btn.closest("tr")));
  }
  async function saveRow(tr){
    if(saving)return;
    const employeeId=tr.dataset.employee, field=k=>tr.querySelector('[data-field="'+k+'"]').value;
    const status=field("status");
    if(!status){foot.textContent="Select an attendance status before saving.";return;}
    const number=k=>Math.max(0,Math.floor(Number(field(k)||0)));
    const checkIn=field("check_in")||null, checkOut=field("check_out")||null;
    if(checkIn&&checkOut&&checkOut<checkIn){foot.textContent="Check-out time cannot be earlier than check-in.";return;}
    const payload={employee_id:employeeId,attendance_date:dateEl.value,status,check_in:checkIn,check_out:checkOut,late_minutes:number("late_minutes"),overtime_minutes:number("overtime_minutes"),remarks:field("remarks").trim()||null,marked_by:(await sb.auth.getUser()).data?.user?.id||null};
    const btn=tr.querySelector(".vva-save");btn.disabled=true;btn.textContent="Saving…";saving=true;
    const r=await sb.from("vvhr_attendance").upsert(payload,{onConflict:"employee_id,attendance_date"}).select("*").single();
    saving=false;btn.disabled=false;btn.textContent="Save";
    if(r.error){foot.textContent="Save failed: "+r.error.message;return;}
    const i=attendance.findIndex(a=>a.employee_id===employeeId);
    if(i>=0)attendance[i]=r.data;else attendance.push(r.data);
    draw();
    foot.textContent="Saved attendance for "+(employees.find(e=>e.id===employeeId)?.full_name||"employee")+".";
  }
  root.querySelector("#vva-refresh").onclick=load;
  dateEl.onchange=load;deptEl.onchange=draw;searchEl.oninput=draw;
  root.querySelector("#vva-export").onclick=()=>{
    const rows=[["Date","Employee Code","Name","Department","Status","Check In","Check Out","Late Minutes","Overtime Minutes","Remarks"],
      ...employees.filter(e=>(!deptEl.value||e.department===deptEl.value)&&(!searchEl.value.trim()||[e.employee_code,e.full_name,e.mobile,e.department].join(" ").toLowerCase().includes(searchEl.value.trim().toLowerCase()))).map(e=>{const a=byId(e.id)||{};return [dateEl.value,e.employee_code,e.full_name,e.department,a.status,a.check_in,a.check_out,a.late_minutes,a.overtime_minutes,a.remarks]})];
    const cell=v=>{let x=String(v??"");if(/^\s*[=+\-@]/.test(x))x="'"+x;return '"'+x.replace(/"/g,'""')+'"';};
    const csv=rows.map(r=>r.map(cell).join(",")).join("\r\n"),url=URL.createObjectURL(new Blob(["\ufeff"+csv],{type:"text/csv;charset=utf-8"})),a=document.createElement("a");
    a.href=url;a.download="VermiVeda_Attendance_"+dateEl.value+".csv";a.click();URL.revokeObjectURL(url);
  };
  load();
}
