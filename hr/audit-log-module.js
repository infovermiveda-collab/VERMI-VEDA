// Phase 7 — HR audit log viewer. Audit records contain changed column names only, never field values.
export function renderHrAuditModule(root, sb) {
  const esc = v => String(v ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  let rows = [];
  root.innerHTML = `
    <section class="panel">
      <div class="head"><div><h2>HR Audit Logs</h2><p class="muted">Recent changes across HRMS records. Sensitive field values are not stored here.</p></div><button id="vvhr-audit-refresh">Refresh</button></div>
      <div class="toolbar">
        <input id="vvhr-audit-search" placeholder="Search table, record or employee ID">
        <select id="vvhr-audit-action"><option value="">All actions</option><option>INSERT</option><option>UPDATE</option><option>DELETE</option></select>
        <button class="alt" id="vvhr-audit-export">Export CSV</button>
      </div>
      <div id="vvhr-audit-state" class="muted">Loading audit history…</div>
      <div class="tablewrap"><table><thead><tr><th>Date & Time</th><th>HR Table</th><th>Record ID</th><th>Employee ID</th><th>Action</th><th>Changed Fields</th><th>Changed By</th></tr></thead><tbody id="vvhr-audit-body"></tbody></table></div>
      <p class="footnote">Showing the latest 300 events. This log records changed column names only, not Aadhaar, PAN, bank details, passwords or other field contents.</p>
    </section>`;
  const body=root.querySelector("#vvhr-audit-body"), state=root.querySelector("#vvhr-audit-state");
  function draw(){
    const q=root.querySelector("#vvhr-audit-search").value.trim().toLowerCase(), a=root.querySelector("#vvhr-audit-action").value;
    const list=rows.filter(x=>(!a||x.action===a)&&(!q||[x.table_name,x.record_id,x.employee_id,x.changed_by,(x.changed_fields||[]).join(" ")].join(" ").toLowerCase().includes(q)));
    body.innerHTML=list.length?list.map(x=>`<tr><td>${esc(new Date(x.changed_at).toLocaleString("en-IN"))}</td><td>${esc(x.table_name)}</td><td>${esc(x.record_id||"—")}</td><td>${esc(x.employee_id||"—")}</td><td><span class="pill ${x.action==="DELETE"?"red":x.action==="INSERT"?"green":"orange"}">${esc(x.action)}</span></td><td>${esc((x.changed_fields||[]).join(", ")||"—")}</td><td>${esc(x.changed_by||"System")}</td></tr>`).join(""):'<tr><td colspan="7" class="empty">No audit events found.</td></tr>';
    state.textContent=`Showing ${list.length} of ${rows.length} recent audit events`;
  }
  async function load(){
    state.textContent="Loading audit history…";
    const r=await sb.from("vvhr_audit_logs").select("id,table_name,record_id,employee_id,action,changed_fields,changed_by,changed_at").order("changed_at",{ascending:false}).limit(300);
    if(r.error){state.textContent="Could not load audit logs: "+r.error.message;body.innerHTML="";return;}
    rows=r.data||[];draw();
  }
  root.querySelector("#vvhr-audit-refresh").onclick=load;
  root.querySelector("#vvhr-audit-search").oninput=draw;
  root.querySelector("#vvhr-audit-action").onchange=draw;
  root.querySelector("#vvhr-audit-export").onclick=()=>{
    const cols=["changed_at","table_name","record_id","employee_id","action","changed_fields","changed_by"];
    const csv=[cols.join(","),...rows.map(x=>cols.map(k=>'"'+String(k==="changed_fields"?(x[k]||[]).join("|"):(x[k]??"")).replace(/"/g,'""')+'"').join(","))].join("\\r\\n");
    const url=URL.createObjectURL(new Blob([csv],{type:"text/csv;charset=utf-8"}));const a=document.createElement("a");a.href=url;a.download="VermiVeda_HR_Audit_Logs.csv";a.click();URL.revokeObjectURL(url);
  };
  load();
}
