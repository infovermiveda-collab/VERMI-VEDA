// Vermi Veda HRMS — Phase 5 Performance Management
// Uses only vvhr_* HR tables; does not read or write OMS data.
export function renderPerformanceModule(root, sb, options = {}) {
  if (options.canManage !== true) {
    root.innerHTML = '<section class="vvp-card"><h2>Performance Management</h2><p>HR/admin access required.</p></section>';
    return;
  }
  const userId = options.currentUserId || null;
  const esc = v => String(v ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const monthNow = new Date().getFullYear()+"-"+String(new Date().getMonth()+1).padStart(2,"0");
  let employees = [], rows = [], busy = false;
  root.innerHTML = `
    <section class="vvp vvp-performance">
      <style>
        .vvp-performance .vvp-head{display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:15px}
        .vvp-performance .vvp-head h2{margin:0}.vvp-performance .vvp-muted{color:#718077}
        .vvp-performance .vvp-card{background:#fff;border:1px solid #e1ebe4;border-radius:14px;padding:16px;margin:12px 0;box-shadow:0 5px 18px #12351a0a}
        .vvp-performance .vvp-controls{display:grid;grid-template-columns:1fr 1fr auto auto;gap:10px;align-items:end}
        .vvp-performance label{display:block;font-size:12px;color:#607469;margin-bottom:5px}
        .vvp-performance input,.vvp-performance select{width:100%;padding:9px;border:1px solid #d5e2d9;border-radius:8px;min-width:0}
        .vvp-performance button{border:0;border-radius:8px;background:#176b45;color:white;padding:10px 14px;font-weight:650;cursor:pointer}
        .vvp-performance button.alt{background:#edf5ef;color:#175638;border:1px solid #d9e8dd}
        .vvp-performance button:disabled{opacity:.5;cursor:not-allowed}
        .vvp-performance .vvp-stats{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:9px}
        .vvp-performance .vvp-stats>div{background:#f2f8f3;border-radius:10px;padding:12px;min-width:0}
        .vvp-performance .vvp-stats small{display:block;color:#718077}.vvp-performance .vvp-stats b{font-size:20px}
        .vvp-performance .vvp-table-wrap{overflow:auto}.vvp-performance table{width:100%;border-collapse:collapse;min-width:1050px}
        .vvp-performance th,.vvp-performance td{padding:9px;border-bottom:1px solid #e7eee9;text-align:left;font-size:12px;vertical-align:middle}
        .vvp-performance th{background:#f5f9f6;color:#52675a;white-space:nowrap}
        .vvp-performance td input{min-width:68px;padding:7px}.vvp-performance td input[data-k="reviewer_remarks"]{min-width:150px}
        .vvp-performance .vvp-pill{display:inline-block;border-radius:20px;background:#e9f5ed;color:#176b45;padding:4px 9px;font-size:11px}
        .vvp-performance .vvp-note{background:#fff8e8;color:#77551a;padding:10px;border-radius:8px;margin:10px 0;font-size:12px}
        .vvp-performance .vvp-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}
        .vvp-performance .vvp-muted-cell{color:#78877e}
        @media(max-width:760px){.vvp-performance .vvp-controls{grid-template-columns:1fr 1fr}.vvp-performance .vvp-stats{grid-template-columns:repeat(2,minmax(0,1fr))}}
      </style>
      <div class="vvp-head"><div><h2>Performance Management</h2><p class="vvp-muted">Monthly productivity, quality and employee performance review.</p></div><span class="vvp-pill" id="vperf-status">Draft workspace</span></div>
      <div class="vvp-card"><div class="vvp-controls">
        <div><label>Review Month</label><input id="vperf-month" type="month" value="${monthNow}"></div>
        <div><label>Department</label><select id="vperf-dept"><option value="">All Departments</option></select></div>
        <button id="vperf-load">Load Employees</button><button class="alt" id="vperf-export">Export MIS CSV</button>
      </div><p class="vvp-muted">Enter the monthly target, completed cases, audited cases and error cases. Productivity and quality scores are calculated automatically.</p></div>
      <div id="vperf-work"><div class="vvp-card vvp-muted">Select a month and load employees to start the performance review.</div></div>
    </section>`;
  const $ = id => root.querySelector("#"+id);
  const moneyPct = v => Number(v||0).toFixed(1)+"%";
  function calc(r){
    const t=Number(r.target_cases||0),c=Number(r.completed_cases||0),a=Number(r.audited_cases||0),e=Number(r.error_cases||0);
    return {productivity:t?c/t*100:0,quality:a?(a-e)/a*100:0,rating:t&&a?Math.min(10,Math.round((Math.min(100,c/t*100)*.5+((a-e)/a*100)*.5)/10*10)/10):0};
  }
  function summary(){
    const scored=rows.map(calc),count=rows.length;
    const avg=(key)=>count?scored.reduce((s,x)=>s+x[key],0)/count:0;
    const low=rows.filter(r=>{const x=calc(r);return x.productivity<80||x.quality<90;}).length;
    const high=rows.filter(r=>{const x=calc(r);return x.productivity>=100&&x.quality>=98;}).length;
    return {count,prod:avg("productivity"),quality:avg("quality"),rating:avg("rating"),low,high};
  }
  function render(){
    const s=summary();
    $("vperf-work").innerHTML=`
      <div class="vvp-stats">
        <div><small>Employees</small><b>${s.count}</b></div>
        <div><small>Avg Productivity</small><b>${moneyPct(s.prod)}</b></div>
        <div><small>Avg Quality</small><b>${moneyPct(s.quality)}</b></div>
        <div><small>Avg Rating</small><b>${s.rating.toFixed(1)}/10</b></div>
        <div><small>Needs Attention / Top</small><b>${s.low} / ${s.high}</b></div>
      </div>
      <div class="vvp-card">
        <div class="vvp-head"><div><h3>Employee Monthly Scorecard</h3><p class="vvp-muted">${esc($("vperf-month").value)} · ${rows.length} employees</p></div></div>
        <div class="vvp-note">Rating is an indicative score: 50% productivity achievement + 50% quality score. Low performance flag: productivity below 80% or quality below 90%. These thresholds can be revised by HR policy.</div>
        <div class="vvp-table-wrap"><table><thead><tr><th>Employee</th><th>Department</th><th>Target Cases</th><th>Completed</th><th>Productivity</th><th>Audited</th><th>Errors</th><th>Quality</th><th>Rating</th><th>Remarks</th><th>Status</th></tr></thead><tbody>
        ${rows.map((r,i)=>{const x=calc(r),flag=x.productivity<80||x.quality<90;return `<tr>
          <td><b>${esc(r.employee_code)}</b><br>${esc(r.full_name)}</td><td>${esc(r.department||"—")}</td>
          <td><input data-i="${i}" data-k="target_cases" type="number" min="0" step="1" value="${Number(r.target_cases||0)}"></td>
          <td><input data-i="${i}" data-k="completed_cases" type="number" min="0" step="1" value="${Number(r.completed_cases||0)}"></td>
          <td><b>${moneyPct(x.productivity)}</b></td>
          <td><input data-i="${i}" data-k="audited_cases" type="number" min="0" step="1" value="${Number(r.audited_cases||0)}"></td>
          <td><input data-i="${i}" data-k="error_cases" type="number" min="0" step="1" value="${Number(r.error_cases||0)}"></td>
          <td><b>${moneyPct(x.quality)}</b></td><td><b>${x.rating.toFixed(1)}/10</b></td>
          <td><input data-i="${i}" data-k="reviewer_remarks" type="text" value="${esc(r.reviewer_remarks||"")}" placeholder="HR remarks"></td>
          <td><span class="vvp-pill">${r.review_status==="published"?"Published":flag?"Needs review":"Draft"}</span></td>
        </tr>`}).join("")||'<tr><td colspan="11" class="vvp-muted-cell">No active/probation employees found for this month.</td></tr>'}
        </tbody></table></div>
        <div class="vvp-actions"><button id="vperf-save">Save Draft</button><button id="vperf-publish">Publish Monthly Reviews</button><button class="alt" id="vperf-refresh">Refresh</button></div>
      </div>`;
    $("vperf-status").textContent=rows.some(r=>r.review_status==="published")?"Review data loaded":"Draft workspace";
    root.querySelectorAll("[data-i]").forEach(inp=>inp.addEventListener("change",()=>{
      const r=rows[Number(inp.dataset.i)],k=inp.dataset.k;
      if(k==="reviewer_remarks")r[k]=inp.value;
      else r[k]=Math.max(0,Math.floor(Number(inp.value||0)));
      if(Number(r.error_cases)>Number(r.audited_cases)){r.error_cases=r.audited_cases;alert("Error cases cannot exceed audited cases.");}
      render();
    }));
    $("vperf-save").addEventListener("click",()=>run(save(false)));
    $("vperf-publish").addEventListener("click",()=>run(save(true)));
    $("vperf-refresh").addEventListener("click",()=>run(load));
  }
  async function load(){
    const month=$("vperf-month").value;if(!month)throw new Error("Select review month.");
    const first=month+"-01";
    const [er,rr]=await Promise.all([
      sb.from("vvhr_employees").select("id,employee_code,full_name,department,designation,employment_status,joining_date").in("employment_status",["active","probation"]).lte("joining_date",new Date(new Date(first+"T12:00:00").getFullYear(),new Date(first+"T12:00:00").getMonth()+1,0).toISOString().slice(0,10)).order("employee_code"),
      sb.from("vvhr_performance_reviews").select("*").eq("review_month",first)
    ]);
    if(er.error)throw er.error;if(rr.error)throw rr.error;
    employees=er.data||[];
    const existing=new Map((rr.data||[]).map(r=>[r.employee_id,r]));
    rows=employees.map(e=>({...e,...(existing.get(e.id)||{}),employee_id:e.id,review_month:first,department:e.department,designation:e.designation,target_cases:existing.get(e.id)?.target_cases||0,completed_cases:existing.get(e.id)?.completed_cases||0,audited_cases:existing.get(e.id)?.audited_cases||0,error_cases:existing.get(e.id)?.error_cases||0,reviewer_remarks:existing.get(e.id)?.reviewer_remarks||"",review_status:existing.get(e.id)?.review_status||"draft"}));
    const departments=[...new Set(employees.map(e=>e.department).filter(Boolean))].sort();
    const current=$("vperf-dept").value;
    $("vperf-dept").innerHTML='<option value="">All Departments</option>'+departments.map(d=>'<option value="'+esc(d)+'">'+esc(d)+'</option>').join("");
    $("vperf-dept").value=current;
    if(current)rows=rows.filter(r=>r.department===current);
    render();
  }
  async function save(publish){
    if(!rows.length){alert("No employee rows to save.");return;}
    if(publish&&!confirm("Publish these monthly performance reviews? HR will be able to revise them by saving a new draft only after changing status is enabled."))return;
    const month=$("vperf-month").value+"-01";
    const payload=rows.map(r=>{
      const t=Number(r.target_cases||0),c=Number(r.completed_cases||0),a=Number(r.audited_cases||0),e=Number(r.error_cases||0);
      if(e>a)throw new Error("Error cases cannot exceed audited cases for "+r.full_name);
      return {employee_id:r.employee_id,review_month:month,department:r.department||null,designation:r.designation||null,target_cases:t,completed_cases:c,audited_cases:a,error_cases:e,reviewer_remarks:r.reviewer_remarks||null,review_status:publish?"published":"draft",reviewed_by:publish?userId:null,reviewed_at:publish?new Date().toISOString():null};
    });
    const res=await sb.from("vvhr_performance_reviews").upsert(payload,{onConflict:"employee_id,review_month"});
    if(res.error)throw res.error;
    await load();
    alert(publish?"Monthly performance reviews published.":"Performance draft saved.");
  }
  function exportCsv(){
    const month=$("vperf-month").value;
    const data=rows.map(r=>{const x=calc(r);return [r.employee_code,r.full_name,r.department,r.designation,r.target_cases,r.completed_cases,x.productivity.toFixed(2),r.audited_cases,r.error_cases,x.quality.toFixed(2),x.rating.toFixed(1),r.reviewer_remarks,r.review_status];});
    const all=[["Employee Code","Employee Name","Department","Designation","Target Cases","Completed Cases","Productivity %","Audited Cases","Error Cases","Quality %","Rating / 10","HR Remarks","Status"],...data];
    const csv=all.map(row=>row.map(v=>'"'+String(v??"").replace(/"/g,'""')+'"').join(",")).join("\r\n");
    const blob=new Blob(["\uFEFF"+csv],{type:"text/csv;charset=utf-8"}),url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download="VermiVeda_Performance_"+month+".csv";a.click();URL.revokeObjectURL(url);
  }
  async function run(fn){if(busy)return;busy=true;root.querySelectorAll("button").forEach(b=>b.disabled=true);try{await fn();}catch(e){console.error(e);alert("Performance module error: "+(e.message||e));}finally{busy=false;root.querySelectorAll("button").forEach(b=>b.disabled=false);}}
  $("vperf-load").addEventListener("click",()=>run(load));
  $("vperf-export").addEventListener("click",exportCsv);
  $("vperf-dept").addEventListener("change",()=>{if(employees.length)run(load);});
  load().catch(e=>{$("vperf-work").innerHTML='<div class="vvp-card" style="color:#b42318">Unable to load performance data: '+esc(e.message)+'</div>';});
}
