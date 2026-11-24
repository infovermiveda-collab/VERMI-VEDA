// Vermi Veda HRMS — Phase 6 HR Reports & MIS
// Read-only reports over vvhr_* HR tables. OMS data is never queried.
export function renderHrMisModule(root, sb, options = {}) {
  if (options.canManage !== true) {
    root.innerHTML = '<section class="vvhrmis-card"><h2>HR Reports & MIS</h2><p>HR/admin access required.</p></section>';
    return;
  }
  const esc = v => String(v ?? "").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const monthNow = new Date().getFullYear()+"-"+String(new Date().getMonth()+1).padStart(2,"0");
  let data={employees:[],attendance:[],leaves:[],periods:[],payroll:[],performance:[]}, busy=false;
  root.innerHTML = `
  <section class="vvhrmis">
    <style>
      .vvhrmis{color:#203b2b}.vvhrmis .mis-head{display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;margin:8px 0 16px}
      .vvhrmis .mis-head h2{margin:0}.vvhrmis .muted{color:#718077;font-size:12px}
      .vvhrmis .mis-card{background:#fff;border:1px solid #e2ebe4;border-radius:14px;padding:15px;margin:12px 0;box-shadow:0 5px 18px #12351a0a}
      .vvhrmis .mis-controls{display:grid;grid-template-columns:1fr 1fr auto auto;gap:10px;align-items:end}
      .vvhrmis label{display:block;font-size:12px;color:#64766b;margin-bottom:5px}
      .vvhrmis input,.vvhrmis select{width:100%;padding:9px;border:1px solid #d8e4db;border-radius:8px}
      .vvhrmis button{background:#176b45;color:#fff;border:0;border-radius:8px;padding:10px 14px;font-weight:650;cursor:pointer}
      .vvhrmis button.alt{background:#edf5ef;color:#175638;border:1px solid #d9e8dd}
      .vvhrmis button:disabled{opacity:.55}
      .vvhrmis .mis-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}
      .vvhrmis .mis-stat{background:#f2f8f3;border-radius:11px;padding:13px;min-width:0}
      .vvhrmis .mis-stat small{display:block;color:#718077;font-size:11px}.vvhrmis .mis-stat b{font-size:22px;display:block;margin-top:3px}
      .vvhrmis .mis-section{font-size:16px;margin:3px 0 10px}.vvhrmis .mis-table-wrap{overflow:auto}
      .vvhrmis table{width:100%;border-collapse:collapse;min-width:580px}.vvhrmis th,.vvhrmis td{padding:9px;border-bottom:1px solid #e7eee9;text-align:left;font-size:12px}
      .vvhrmis th{background:#f5f9f6;color:#53685b;white-space:nowrap}.vvhrmis .mis-note{background:#fff8e8;color:#77551a;border-radius:8px;padding:10px;font-size:12px;margin-top:10px}
      .vvhrmis .mis-actions{display:flex;gap:8px;flex-wrap:wrap}.vvhrmis .mis-tag{display:inline-block;background:#e9f5ed;color:#176b45;border-radius:20px;padding:4px 8px;font-size:11px}
      @media(max-width:760px){.vvhrmis .mis-controls{grid-template-columns:1fr 1fr}.vvhrmis .mis-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
    </style>
    <div class="mis-head"><div><h2>HR Reports & MIS</h2><p class="muted">Workforce, attendance, leave, payroll and attrition overview</p></div><span class="mis-tag" id="mis-state">Live HR data</span></div>
    <div class="mis-card"><div class="mis-controls">
      <div><label>From Date</label><input id="mis-from" type="date" value="${monthNow}-01"></div>
      <div><label>To Date</label><input id="mis-to" type="date" value="${new Date().toISOString().slice(0,10)}"></div>
      <button id="mis-refresh">Refresh MIS</button><button id="mis-export" class="alt">Export Summary CSV</button>
    </div><p class="muted">Reports refresh from the HR database for the selected period. All figures are read-only.</p></div>
    <div id="mis-content"><div class="mis-card">Loading HR reports…</div></div>
  </section>`;
  const $=id=>root.querySelector("#"+id);
  const num=v=>Number(v||0);
  const money=v=>"₹"+num(v).toLocaleString("en-IN",{maximumFractionDigits:0});
  const group=(arr,key)=>{const m={};arr.forEach(x=>{const k=x[key]||"Not specified";m[k]=(m[k]||0)+1;});return Object.entries(m).sort((a,b)=>b[1]-a[1]);};
  function table(title,headers,rows){return `<div class="mis-card"><h3 class="mis-section">${title}</h3><div class="mis-table-wrap"><table><thead><tr>${headers.map(h=>'<th>'+esc(h)+'</th>').join("")}</tr></thead><tbody>${rows.length?rows.map(r=>'<tr>'+r.map(v=>'<td>'+esc(v)+'</td>').join("")+'</tr>').join(""):'<tr><td colspan="'+headers.length+'">No records for this period</td></tr>'}</tbody></table></div></div>`;}
  function render(){
    const e=data.employees, active=e.filter(x=>x.employment_status==="active").length, probation=e.filter(x=>x.employment_status==="probation").length;
    const from=$("mis-from").value,to=$("mis-to").value;
    const exits=e.filter(x=>["resigned","terminated"].includes(x.employment_status)&&((x.resignation_date||x.last_working_date||"")>=from)&&((x.resignation_date||x.last_working_date||"")<=to));
    const a=data.attendance, present=a.filter(x=>x.status==="present").length, absent=a.filter(x=>x.status==="absent").length;
    const late=a.filter(x=>num(x.late_minutes)>0).length, leave=data.leaves;
    const approved=leave.filter(x=>x.status==="approved"), pending=leave.filter(x=>x.status==="pending"), rejected=leave.filter(x=>x.status==="rejected");
    const net=data.payroll.reduce((s,x)=>s+num(x.net_payable),0), gross=data.payroll.reduce((s,x)=>s+num(x.gross_earnings),0);
    const paid=data.payroll.filter(x=>x.payment_status==="paid").length;
    const unpaid=data.payroll.filter(x=>x.payment_status!=="paid").length;
    const attRate=a.length?present/a.length*100:0;
    const deptRows=group(e,"department").map(([k,v])=>[k,v]);
    const statusRows=group(e,"employment_status").map(([k,v])=>[k,v]);
    const leaveRows=group(leave,"status").map(([k,v])=>[k,v]);
    const payStatus=group(data.payroll,"payment_status").map(([k,v])=>[k,v]);
    const deptPayroll={};data.payroll.forEach(x=>{const emp=e.find(y=>y.id===x.employee_id);const k=emp?.department||"Not specified";deptPayroll[k]=(deptPayroll[k]||0)+num(x.net_payable);});
    const deptPayRows=Object.entries(deptPayroll).sort((a,b)=>b[1]-a[1]).map(([k,v])=>[k,money(v)]);
    const topPerf=[...data.performance].sort((x,y)=>num(y.rating)-num(x.rating)).slice(0,8).map(x=>{const emp=e.find(y=>y.id===x.employee_id);return [emp?.employee_code||"",emp?.full_name||"",x.productivity_pct+"%",x.quality_pct+"%",x.rating+"/10"];});
    $("mis-content").innerHTML=`
      <div class="mis-grid">
        <div class="mis-stat"><small>Total Employees</small><b>${e.length}</b><small>${active} active · ${probation} probation</small></div>
        <div class="mis-stat"><small>Exited Employees</small><b>${exits.length}</b><small>Resigned / terminated</small></div>
        <div class="mis-stat"><small>Attendance Records</small><b>${a.length}</b><small>${money(attRate).replace("₹","")}% present records</small></div>
        <div class="mis-stat"><small>Leave Requests</small><b>${leave.length}</b><small>${pending.length} pending</small></div>
        <div class="mis-stat"><small>Payroll Net Cost</small><b>${money(net)}</b><small>Gross ${money(gross)}</small></div>
        <div class="mis-stat"><small>Payroll Paid</small><b>${paid}</b><small>${unpaid} pending / unpaid items</small></div>
        <div class="mis-stat"><small>Late Attendance</small><b>${late}</b><small>Records with late minutes</small></div>
        <div class="mis-stat"><small>Absent Records</small><b>${absent}</b><small>Marked absent in period</small></div>
      </div>
      ${table("Employee Strength by Department",["Department","Employees"],deptRows)}
      ${table("Employee Status",["Employment Status","Employees"],statusRows)}
      ${table("Attendance Summary",["Metric","Count"],[["Present",present],["Absent",absent],["Late records",late],["All attendance records",a.length]])}
      ${table("Leave MIS",["Leave Status","Requests"],[["Approved",approved.length],["Pending",pending.length],["Rejected",rejected.length],["All requests",leave.length]])}
      ${table("Payroll by Department",["Department","Net Payroll"],deptPayRows)}
      ${table("Payroll Payment Status",["Payment Status","Employees"],payStatus)}
      ${table("Employee Attrition / Exit",["Exit Type","Count"],[["Resigned",exits.filter(x=>x.employment_status==="resigned").length],["Terminated",exits.filter(x=>x.employment_status==="terminated").length]])}
      ${table("Performance Snapshot",["Employee Code","Employee","Productivity","Quality","Rating"],topPerf)}
      <div class="mis-note">Branch-wise manpower is not shown because the current employee master has no dedicated branch/location field. Attendance percentage above is based on marked attendance records, not scheduled headcount-days. Payroll totals include the payroll items returned for the selected payroll months.</div>
    `;
  }
  async function load(){
    const from=$("mis-from").value,to=$("mis-to").value;
    if(!from||!to||from>to)throw new Error("Please select a valid date range.");
    const [er,ar,lr,pr,per]=await Promise.all([
      sb.from("vvhr_employees").select("id,employee_code,full_name,department,designation,joining_date,employment_status,resignation_date,last_working_date,exit_reason,monthly_fixed_salary").order("employee_code"),
      sb.from("vvhr_attendance").select("id,employee_id,attendance_date,status,late_minutes,overtime_minutes").gte("attendance_date",from).lte("attendance_date",to),
      sb.from("vvhr_leave_requests").select("id,employee_id,leave_type,start_date,end_date,requested_days,status").lte("start_date",to).gte("end_date",from),
      sb.from("vvhr_payroll_periods").select("id,payroll_month,status").gte("payroll_month",from.slice(0,7)+"-01").lte("payroll_month",to.slice(0,7)+"-01"),
      sb.from("vvhr_performance_reviews").select("employee_id,review_month,productivity_pct,quality_pct,rating").gte("review_month",from.slice(0,7)+"-01").lte("review_month",to.slice(0,7)+"-01")
    ]);
    for(const x of [er,ar,lr,pr,per])if(x.error)throw x.error;
    const periods=pr.data||[];
    let payroll=[];
    if(periods.length){const rr=await sb.from("vvhr_payroll_items").select("id,payroll_period_id,employee_id,gross_earnings,net_payable,payment_status").in("payroll_period_id",periods.map(x=>x.id));if(rr.error)throw rr.error;payroll=rr.data||[];}
    data={employees:er.data||[],attendance:ar.data||[],leaves:lr.data||[],periods,payroll,performance:per.data||[]};
    render();
    $("mis-state").textContent="Updated "+new Date().toLocaleTimeString();
  }
  function exportCsv(){
    const e=data.employees,a=data.attendance,l=data.leaves,p=data.payroll;
    const rows=[
      ["HR MIS Summary", "Value"],
      ["Total Employees",e.length],
      ["Active Employees",e.filter(x=>x.employment_status==="active").length],
      ["Probation Employees",e.filter(x=>x.employment_status==="probation").length],
      ["Exited Employees in Period",e.filter(x=>["resigned","terminated"].includes(x.employment_status)&&((x.resignation_date||x.last_working_date||"")>=$("mis-from").value)&&((x.resignation_date||x.last_working_date||"")<=$("mis-to").value)).length],
      ["Attendance Records",a.length],
      ["Present Records",a.filter(x=>x.status==="present").length],
      ["Absent Records",a.filter(x=>x.status==="absent").length],
      ["Leave Requests",l.length],
      ["Approved Leaves",l.filter(x=>x.status==="approved").length],
      ["Pending Leaves",l.filter(x=>x.status==="pending").length],
      ["Payroll Gross",p.reduce((s,x)=>s+num(x.gross_earnings),0)],
      ["Payroll Net",p.reduce((s,x)=>s+num(x.net_payable),0)]
    ];
    const csv=rows.map(r=>r.map(v=>'"'+String(v??"").replace(/"/g,'""')+'"').join(",")).join("\r\n");
    const blob=new Blob(["\uFEFF"+csv],{type:"text/csv;charset=utf-8"}),url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download="VermiVeda_HR_MIS_"+$("mis-from").value+"_to_"+$("mis-to").value+".csv";a.click();URL.revokeObjectURL(url);
  }
  async function run(fn){if(busy)return;busy=true;root.querySelectorAll("button").forEach(b=>b.disabled=true);try{await fn();}catch(e){console.error(e);$("mis-content").innerHTML='<div class="mis-card" style="color:#b42318">Unable to load HR MIS: '+esc(e.message||e)+'</div>';}finally{busy=false;root.querySelectorAll("button").forEach(b=>b.disabled=false);}}
  $("mis-refresh").addEventListener("click",()=>run(load));$("mis-export").addEventListener("click",exportCsv);
  load().catch(e=>{$("mis-content").innerHTML='<div class="mis-card" style="color:#b42318">Unable to load HR MIS: '+esc(e.message)+'</div>';});
}
