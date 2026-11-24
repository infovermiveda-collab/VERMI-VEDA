// Vermi Veda HRMS — Payroll & Payslip Administration
export function renderPayrollModule(root, sb, options = {}) {
  if (options.canManage !== true) { root.innerHTML = '<section class="vvp-card"><h2>Payroll</h2><p>HR/admin access required.</p></section>'; return; }
  const userId = options.currentUserId || null;
  const esc = v => String(v ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const money = v => "₹" + Number(v || 0).toLocaleString("en-IN",{minimumFractionDigits:2,maximumFractionDigits:2});
  const today = new Date(), monthNow = today.getFullYear()+"-"+String(today.getMonth()+1).padStart(2,"0");
  let period=null, items=[], employees=[], adjustments=[], busy=false;
  root.innerHTML = `<section class="vvp"><style>   .vvp{color:#173b29}.vvp-head{display:flex;justify-content:space-between;align-items:center;gap:14px;flex-wrap:wrap;margin-bottom:16px}.vvp-head h2{margin:0}.vvp-muted{color:#718077}.vvp-card{background:#fff;border:1px solid #e1ebe4;border-radius:14px;padding:16px;margin:12px 0;box-shadow:0 5px 18px #12351a0a}.vvp-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}.vvp label{display:block;font-size:12px;color:#607469;margin-bottom:5px}.vvp input,.vvp select{width:100%;padding:9px;border:1px solid #d5e2d9;border-radius:8px;min-width:0}.vvp button{border:0;border-radius:8px;background:#176b45;color:white;padding:10px 14px;font-weight:650;cursor:pointer}.vvp button.alt{background:#edf5ef;color:#175638;border:1px solid #d9e8dd}.vvp button:disabled{opacity:.5;cursor:not-allowed}.vvp-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}.vvp-stats{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}.vvp-stats>div{background:#f2f8f3;border-radius:10px;padding:12px}.vvp-stats small{display:block;color:#718077}.vvp-stats b{font-size:20px}.vvp-table-wrap{overflow:auto}.vvp table{width:100%;border-collapse:collapse;min-width:850px}.vvp th,.vvp td{padding:9px;border-bottom:1px solid #e7eee9;text-align:left;font-size:13px}.vvp th{background:#f5f9f6;color:#52675a}.vvp td input{min-width:78px}.vvp-note{background:#fff8e8;color:#77551a;padding:10px;border-radius:8px;margin:10px 0;font-size:13px}.vvp-pill{display:inline-block;border-radius:20px;background:#e9f5ed;color:#176b45;padding:4px 9px;font-size:12px}.vvp-error{color:#b42318}.vvp-attn-summary{font-size:11px;line-height:1.5;color:#607469;min-width:190px}.vvp-success{color:#176b45}@media(max-width:760px){.vvp-grid,.vvp-stats{grid-template-columns:repeat(2,minmax(0,1fr))}}   </style><div class="vvp-head"><div><h2>Payroll Management</h2><p class="vvp-muted">Prepare monthly salary, review deductions and publish employee payslips.</p></div><span class="vvp-pill" id="vvp-status">No payroll selected</span></div>
  <div class="vvp-card"><div class="vvp-grid"><div><label>Payroll Month</label><input id="vvp-month" type="month" value="${monthNow}"></div><div><label>Period Start</label><input id="vvp-start" type="date"></div><div><label>Period End</label><input id="vvp-end" type="date"></div><div><label>Monthly Salary Divisor (Working Days)</label><input id="vvp-days" type="number" min="20" max="27" step=".5" value="26" placeholder="e.g. 26"></div></div><div class="vvp-actions"><button id="vvp-open">Open / Create Draft</button><button class="alt" id="vvp-refresh">Refresh</button></div><p class="vvp-muted">Enter the full-month salary divisor (normally 26), not the number of days an employee worked. For one day salary, keep divisor 26 and set that employee Paid Days to 1. Divisor must be 20–27.</p></div>
  <div id="vvp-work"></div></section>`;
  const $ = id => root.querySelector("#"+id);
  function datesForMonth(v){if(!v)return;const [y,m]=v.split("-").map(Number);$("vvp-start").value=y+"-"+String(m).padStart(2,"0")+"-01";$("vvp-end").value=new Date(y,m,0).getFullYear()+"-"+String(m).padStart(2,"0")+"-"+String(new Date(y,m,0).getDate()).padStart(2,"0");}
  $("vvp-month").addEventListener("change",()=>datesForMonth($("vvp-month").value));datesForMonth(monthNow);
  function totals(){return {head:items.length,net:items.reduce((a,x)=>a+Number(x.net_payable||0),0),gross:items.reduce((a,x)=>a+Number(x.gross_earnings||0),0),paid:items.filter(x=>x.payment_status==="paid").length};}
  function render(){
    if(!period){$("vvp-work").innerHTML='<div class="vvp-card vvp-muted">Select a month and open or create a draft payroll.</div>';return;}
    const t=totals(), locked=["approved","paid","locked"].includes(period.status);
    $("vvp-status").textContent=String(period.status||"draft").toUpperCase();
    const storedDivisor=Number(period.working_days||0),validDivisor=storedDivisor>=20&&storedDivisor<=27;
    $("vvp-days").value=validDivisor?storedDivisor:26;
    $("vvp-work").innerHTML='<div class="vvp-stats"><div><small>Employees</small><b>'+t.head+'</b></div><div><small>Gross Salary</small><b>'+money(t.gross)+'</b></div><div><small>Net Payable</small><b>'+money(t.net)+'</b></div><div><small>Paid Employees</small><b>'+t.paid+'</b></div></div><div class="vvp-card"><div class="vvp-head"><div><h3>Employee Salary Register</h3><p class="vvp-muted">Import attendance and approved leave, then review paid days, allowances, incentives and deductions.</p></div><span class="vvp-pill">'+esc(period.payroll_month)+'</span></div><div class="vvp-note">Salary is prorated using the full-month divisor (normally 26). Example: monthly ₹26,000 ÷ 26 × 1 paid day = ₹1,000. Import recorded attendance and approved leave, then verify paid days. Payroll approval publishes payslips but does not transfer money.</div><div class="vvp-table-wrap"><table><thead><tr><th>Employee</th><th>Fixed Salary</th><th>Paid Days</th><th>Attendance Summary</th><th>Unpaid Days</th><th>Earned Salary</th><th>Allowance</th><th>Incentive</th><th>Deduction</th><th>Net Payable</th><th>Payment</th></tr></thead><tbody>'+items.map((x,i)=>'<tr><td><b>'+esc(x.employee_code)+'</b><br>'+esc(x.full_name)+'</td><td>'+money(x.fixed_salary)+'</td><td><input data-i="'+i+'" data-k="paid_days" type="number" min="0" max="'+Number(period.working_days)+'" step=".5" value="'+Number(x.paid_days)+'" '+(locked?'disabled':'')+'></td><td class="vvp-attn-summary">'+(x.attendance_summary?esc(x.attendance_summary):'<span class="vvp-muted">Not imported</span>')+'</td><td>'+Number(x.unpaid_days||0).toFixed(1)+'</td><td>'+money(x.earned_fixed_salary)+'</td><td><input data-i="'+i+'" data-k="allowances" type="number" min="0" step=".01" value="'+Number(x.allowances||0)+'" '+(locked?'disabled':'')+'></td><td><input data-i="'+i+'" data-k="incentives" type="number" min="0" step=".01" value="'+Number(x.incentives||0)+'" '+(locked?'disabled':'')+'></td><td><input data-i="'+i+'" data-k="deductions" type="number" min="0" step=".01" value="'+Number(x.deductions||0)+'" '+(locked?'disabled':'')+'></td><td><b>'+money(x.net_payable)+'</b></td><td>'+esc(x.payment_status||"pending")+'</td></tr>').join("")+'</tbody></table></div><div class="vvp-actions">'+(!locked?'<button id="vvp-attendance" class="alt">Import Attendance & Approved Leave</button><button id="vvp-save">Save Payroll Draft</button><button class="alt" id="vvp-generate">Generate / Refresh Employees</button>':'')+(period.status==="generated"?'<button id="vvp-approve">Approve Payroll & Publish Payslips</button>':'')+(["approved","paid"].includes(period.status)?'<button class="alt" id="vvp-bank">Download Bank Payment CSV</button><button class="alt" id="vvp-paid">Mark All as Paid</button>':'')+'<button class="alt" id="vvp-csv">Download Salary Register CSV</button></div><div class="vvp-card"><div class="vvp-head"><div><h3>Penalty & Salary Recovery</h3><p class="vvp-muted">Record penalties or recover excess salary. Entries are tracked separately; payroll is not deducted automatically.</p></div></div><div class="vvp-grid"><div><label>Employee</label><select id="vvp-adj-employee">'+items.map(x=>'<option value="'+esc(x.employee_id)+'">'+esc(x.employee_code)+' - '+esc(x.full_name)+'</option>').join("")+'</select></div><div><label>Adjustment Type</label><select id="vvp-adj-type"><option value="salary_recovery">Salary Recovery / Excess Salary</option><option value="penalty">Penalty</option></select></div><div><label>Amount (₹)</label><input id="vvp-adj-amount" type="number" min="0.01" step="0.01" placeholder="Enter amount"></div><div><label>Reason</label><input id="vvp-adj-reason" type="text" placeholder="Reason / reference"></div></div><div class="vvp-actions"><button id="vvp-adj-save">Save Adjustment</button></div><div class="vvp-table-wrap"><table><thead><tr><th>Employee</th><th>Type</th><th>Amount</th><th>Recovered</th><th>Balance</th><th>Reason</th><th>Status</th><th>Action</th></tr></thead><tbody>'+adjustments.map(a=>'<tr><td>'+esc(a.vvhr_employees?.employee_code)+' - '+esc(a.vvhr_employees?.full_name)+'</td><td>'+esc(a.adjustment_type)+'</td><td>'+money(a.amount)+'</td><td>'+money(a.recovered_amount)+'</td><td>'+money(Number(a.amount)-Number(a.recovered_amount))+'</td><td>'+esc(a.reason)+'</td><td>'+esc(a.status)+'</td><td><button class="alt" data-recover="'+esc(a.id)+'">Record Recovery</button></td></tr>').join("")+'</tbody></table></div></div></div>';
    root.querySelectorAll("[data-i]").forEach(inp=>inp.addEventListener("change",()=>{const x=items[Number(inp.dataset.i)],k=inp.dataset.k;x[k]=Math.max(0,Number(inp.value||0));recalc(x);render();}));
    $("vvp-attendance")?.addEventListener("click",()=>run(importAttendance));
    $("vvp-save")?.addEventListener("click",saveDraft);
    $("vvp-adj-save")?.addEventListener("click",()=>run(saveAdjustment));
    root.querySelectorAll("[data-recover]").forEach(b=>b.addEventListener("click",()=>run(()=>recordRecovery(b.dataset.recover))));
    $("vvp-generate")?.addEventListener("click",generateEmployees);
    $("vvp-approve")?.addEventListener("click",approve);
    $("vvp-bank")?.addEventListener("click",bankCsv);
    $("vvp-paid")?.addEventListener("click",markPaid);
    $("vvp-csv")?.addEventListener("click",salaryCsv);
  }
  // Monthly fixed salary is prorated strictly by paid working days.
  // Example: monthly salary ₹26,000 / 26 working days × 1 paid day = ₹1,000.
  function recalc(x){const rawWd=Number(period.working_days||0),wd=rawWd>=20&&rawWd<=27?rawWd:26,paid=Math.min(wd,Math.max(0,Number(x.paid_days||0)));x.paid_days=paid;x.unpaid_days=Math.max(0,wd-paid);x.earned_fixed_salary=wd?Math.round(Number(x.fixed_salary)*paid/wd*100)/100:0;x.gross_earnings=+(x.earned_fixed_salary+Number(x.allowances||0)+Number(x.incentives||0)).toFixed(2);x.net_payable=+Math.max(0,x.gross_earnings-Number(x.deductions||0)).toFixed(2);}
  async function openPeriod(){
    const month=$("vvp-month").value,start=$("vvp-start").value,end=$("vvp-end").value,days=Number($("vvp-days").value);
    if(!month||!start||!end||end<start||!Number.isFinite(days)||days<20||days>27){alert("Enter the full-month salary divisor between 20 and 27 working days (normally 26). For one day salary, keep divisor 26 and set employee Paid Days to 1.");return;}
    const payrollMonth=month+"-01";
    const r=await sb.from("vvhr_payroll_periods").select("*").eq("payroll_month",payrollMonth).maybeSingle();if(r.error)throw r.error;
    if(r.data){period=r.data;if(Number(period.working_days)!==days&&!["approved","paid","locked"].includes(period.status)){const u=await sb.from("vvhr_payroll_periods").update({period_start:start,period_end:end,working_days:days}).eq("id",period.id).select("*").single();if(u.error)throw u.error;period=u.data;}}
    else{const ins=await sb.from("vvhr_payroll_periods").insert({payroll_month:payrollMonth,period_start:start,period_end:end,working_days:days,status:"draft",created_by:userId}).select("*").single();if(ins.error)throw ins.error;period=ins.data;}
    await loadItems();if(!items.length&&period.status==="draft")await generateEmployees();else render();
  }
  async function loadItems(){
    const r=await sb.from("vvhr_payroll_items").select("*,vvhr_employees!inner(employee_code,full_name,department,designation,employment_status,bank_account_name,bank_account_number,bank_ifsc)").eq("payroll_period_id",period.id).order("created_at");
    if(r.error)throw r.error;items=(r.data||[]).map(x=>({...x,employee_code:x.vvhr_employees.employee_code,full_name:x.vvhr_employees.full_name,department:x.vvhr_employees.department,designation:x.vvhr_employees.designation,bank_account_name:x.vvhr_employees.bank_account_name,bank_account_number:x.vvhr_employees.bank_account_number,bank_ifsc:x.vvhr_employees.bank_ifsc}));
    const a=await sb.from("vvhr_payroll_adjustments").select("*,vvhr_employees!inner(employee_code,full_name)").in("status",["pending","partially_recovered"]).order("created_at",{ascending:false});if(a.error)throw a.error;adjustments=a.data||[];
  }
  async function importAttendance(){
    if(!period||["approved","paid","locked"].includes(period.status))return;
    const ids=items.map(x=>x.employee_id).filter(Boolean);
    if(!ids.length){alert("Generate the employee salary register first.");return;}
    const [ar,lr]=await Promise.all([
      sb.from("vvhr_attendance").select("employee_id,attendance_date,status").in("employee_id",ids).gte("attendance_date",period.period_start).lte("attendance_date",period.period_end),
      sb.from("vvhr_leave_requests").select("employee_id,leave_type,start_date,end_date,requested_days").in("employee_id",ids).eq("status","approved").lte("start_date",period.period_end).gte("end_date",period.period_start)
    ]);
    if(ar.error)throw ar.error;if(lr.error)throw lr.error;
    const attendanceByEmployee=new Map(),leaveByEmployee=new Map();
    (ar.data||[]).forEach(r=>{if(!attendanceByEmployee.has(r.employee_id))attendanceByEmployee.set(r.employee_id,new Map());attendanceByEmployee.get(r.employee_id).set(r.attendance_date,r);});
    (lr.data||[]).forEach(r=>{if(!leaveByEmployee.has(r.employee_id))leaveByEmployee.set(r.employee_id,[]);leaveByEmployee.get(r.employee_id).push(r);});
    let totalUnmarked=0;
    for(const x of items){
      const dayMap=attendanceByEmployee.get(x.employee_id)||new Map(),leaves=leaveByEmployee.get(x.employee_id)||[];
      const counts={present:0,half:0,paidLeave:0,absent:0,unpaidLeave:0,unmarked:0},cursor=new Date(period.period_start+"T12:00:00"),last=new Date(period.period_end+"T12:00:00");
      let paid=0;
      while(cursor<=last){
        const date=cursor.getFullYear()+"-"+String(cursor.getMonth()+1).padStart(2,"0")+"-"+String(cursor.getDate()).padStart(2,"0");
        if(cursor.getDay()!==0){
          const rec=dayMap.get(date);
          if(rec){
            if(rec.status==="present"||rec.status==="travel"){paid+=1;counts.present++;}
            else if(rec.status==="half_day"){paid+=.5;counts.half++;}
            else if(rec.status==="paid_leave"){paid+=1;counts.paidLeave++;}
            else if(rec.status==="absent"){counts.absent++;}
            else if(rec.status==="unpaid_leave"){counts.unpaidLeave++;}
            else if(rec.status!=="weekly_off"&&rec.status!=="holiday"){counts.unmarked++;}
          }else{
            const leave=leaves.find(l=>l.start_date<=date&&l.end_date>=date);
            if(leave){if(leave.leave_type==="unpaid"){counts.unpaidLeave++;}else{paid+=1;counts.paidLeave++;}}
            else counts.unmarked++;
          }
        }
        cursor.setDate(cursor.getDate()+1);
      }
      x.paid_days=Math.min(Number(period.working_days||0),paid);
      x.attendance_summary="P "+counts.present+" · HD "+counts.half+" · PL "+counts.paidLeave+" · AB "+counts.absent+" · UL "+counts.unpaidLeave+" · NM "+counts.unmarked;
      x.attendance_counts=counts;recalc(x);totalUnmarked+=counts.unmarked;
    }
    render();
    if(totalUnmarked>0)alert("Attendance imported for "+items.length+" employees. "+totalUnmarked+" working dates are not marked; please verify these before saving payroll. Unmarked dates are not counted as paid.");
    else alert("Attendance and approved leave imported. Please review each employee's paid days before saving.");
  }
  async function generateEmployees(){
    if(!period||["approved","paid","locked"].includes(period.status))return;
    const er=await sb.from("vvhr_employees").select("id,employee_code,full_name,monthly_fixed_salary,employment_status,joining_date").in("employment_status",["active","probation"]).lte("joining_date",period.period_end);
    if(er.error)throw er.error;
    const existing=new Set(items.map(x=>x.employee_id)),fresh=(er.data||[]).filter(e=>!existing.has(e.id));
    if(!fresh.length){alert("No new active/probation employees to add.");return;}
    const rows=fresh.map(e=>{const fixed=Number(e.monthly_fixed_salary||0);const x={payroll_period_id:period.id,employee_id:e.id,fixed_salary:fixed,paid_days:0,unpaid_days:Number(period.working_days),earned_fixed_salary:0,allowances:0,incentives:0,deductions:0,gross_earnings:0,net_payable:0,payment_status:"pending"};return x;});
    const ins=await sb.from("vvhr_payroll_items").insert(rows);if(ins.error)throw ins.error;
    period.status="draft";await loadItems();render();
  }
  async function saveAdjustment(){
    const employee_id=$("vvp-adj-employee")?.value,type=$("vvp-adj-type")?.value,amount=Number($("vvp-adj-amount")?.value),reason=$("vvp-adj-reason")?.value.trim();
    if(!employee_id||!["penalty","salary_recovery"].includes(type)||!Number.isFinite(amount)||amount<=0||!reason){alert("Select employee, type, positive amount and reason.");return;}
    const r=await sb.from("vvhr_payroll_adjustments").insert({employee_id,payroll_period_id:period?.id||null,adjustment_type:type,amount,reason,created_by:userId}).select("id").single();if(r.error)throw r.error;
    $("vvp-adj-amount").value="";$("vvp-adj-reason").value="";await loadItems();render();alert("Adjustment recorded. It will not be deducted until HR records and approves the recovery.");
  }
  async function recordRecovery(id){
    const a=adjustments.find(x=>x.id===id);if(!a)return;
    const balance=Number(a.amount)-Number(a.recovered_amount),input=prompt("Enter amount recovered now (balance "+money(balance)+"):");
    if(input===null)return;const amount=Number(input);if(!Number.isFinite(amount)||amount<=0||amount>balance){alert("Enter a recovery amount between 0.01 and "+balance);return;}
    const recovered=Number(a.recovered_amount)+amount,status=recovered>=Number(a.amount)?"recovered":"partially_recovered";
    const r=await sb.from("vvhr_payroll_adjustments").update({recovered_amount:recovered,status,updated_at:new Date().toISOString()}).eq("id",id).in("status",["pending","partially_recovered"]);if(r.error)throw r.error;
    await loadItems();render();alert("Recovery entry updated.");
  }
  async function saveDraft(){
    if(!period||["approved","paid","locked"].includes(period.status))return;
    const divisor=Number(period.working_days||0);if(divisor<20||divisor>27){alert("Payroll divisor is invalid. Set Monthly Salary Divisor to 26 (allowed 20–27), reopen the draft, and recalculate before saving.");return;}
    const rows=items.map(x=>{recalc(x);return {payroll_period_id:period.id,employee_id:x.employee_id,fixed_salary:x.fixed_salary,paid_days:x.paid_days,unpaid_days:x.unpaid_days,earned_fixed_salary:x.earned_fixed_salary,allowances:x.allowances,incentives:x.incentives,deductions:x.deductions,gross_earnings:x.gross_earnings,net_payable:x.net_payable,payment_status:x.payment_status||"pending",remarks:x.remarks||null};});
    const up=await sb.from("vvhr_payroll_items").upsert(rows,{onConflict:"payroll_period_id,employee_id"});if(up.error)throw up.error;
    const pr=await sb.from("vvhr_payroll_periods").update({status:"generated"}).eq("id",period.id).in("status",["draft","generated"]).select("*").single();if(pr.error)throw pr.error;period=pr.data;await loadItems();render();alert("Payroll saved and generated. Review before approval.");
  }
  async function approve(){
    if(!period||period.status!=="generated")return;
    if(!confirm("Approve this payroll and publish payslips to employee portals? This will lock salary figures."))return;
    const r=await sb.from("vvhr_payroll_periods").update({status:"approved",approved_by:userId}).eq("id",period.id).eq("status","generated").select("*").single();if(r.error)throw r.error;period=r.data;render();alert("Payroll approved. Employees can now view their payslips.");
  }
  function csv(name,rows){const body=rows.map(row=>row.map(v=>'"'+String(v??"").replace(/"/g,'""')+'"').join(",")).join("\r\n");const blob=new Blob(["\uFEFF"+body],{type:"text/csv;charset=utf-8"}),url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download=name;a.click();URL.revokeObjectURL(url);}
  function salaryCsv(){csv("VermiVeda_Salary_Register_"+period.payroll_month+".csv",[["Employee Code","Employee Name","Fixed Salary","Paid Days","Unpaid Days","Earned Salary","Allowances","Incentives","Deductions","Gross Earnings","Net Payable","Payment Status"],...items.map(x=>[x.employee_code,x.full_name,x.fixed_salary,x.paid_days,x.unpaid_days,x.earned_fixed_salary,x.allowances,x.incentives,x.deductions,x.gross_earnings,x.net_payable,x.payment_status])]);}
  function bankCsv(){
    const valid=items.filter(x=>x.bank_account_name&&x.bank_account_number&&x.bank_ifsc);
    if(!valid.length){alert("No employees have complete bank details.");return;}
    const missing=items.length-valid.length;if(missing&&!confirm(missing+" employees have incomplete bank details and will be excluded. Continue?"))return;
    csv("VermiVeda_Bank_Payment_"+period.payroll_month+".csv",[["Employee Code","Employee Name","Account Holder","Account Number","IFSC","Amount"],...valid.map(x=>[x.employee_code,x.full_name,x.bank_account_name,x.bank_account_number,x.bank_ifsc,x.net_payable])]);
  }
  async function markPaid(){
    if(!confirm("Confirm that the bank transfer has actually been completed for ALL employees in this payroll?"))return;
    const date=new Date().toISOString().slice(0,10),r=await sb.from("vvhr_payroll_items").update({payment_status:"paid",payment_date:date}).eq("payroll_period_id",period.id).eq("payment_status","pending");if(r.error)throw r.error;
    const p=await sb.from("vvhr_payroll_periods").update({status:"paid"}).eq("id",period.id).select("*").single();if(p.error)throw p.error;period=p.data;await loadItems();render();
  }
  async function run(fn){if(busy)return;busy=true;root.querySelectorAll("button").forEach(b=>b.disabled=true);try{await fn();}catch(e){console.error(e);alert("Payroll action failed: "+(e.message||e));}finally{busy=false;root.querySelectorAll("button").forEach(b=>b.disabled=false);}}
  $("vvp-open").addEventListener("click",()=>run(openPeriod));$("vvp-refresh").addEventListener("click",()=>run(async()=>{if(period){await loadItems();render();}else await openPeriod();}));
  render();
}
