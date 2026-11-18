// HR account provisioning monitor — feature branch only
export function renderProvisioning(root, sb, options = {}) {
  if (options.canManage === false) { root.innerHTML = "<p>HR/Admin access required.</p>"; return; }
  const esc = v => String(v ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  root.innerHTML = `
    <section class="vvhr-onboard-card">
      <header style="display:flex;justify-content:space-between;gap:12px;align-items:center;flex-wrap:wrap">
        <div><h2>OMS FE Account Provisioning</h2><p>Monitor employee login creation and retry failed provisioning.</p></div>
        <button class="alt" id="pr-refresh">Refresh</button>
      </header>
      <div class="vvhr-v-toolbar"><input id="pr-search" placeholder="Search employee, code or email"></div>
      <div id="pr-message" role="status"></div>
      <div class="vvhr-tablewrap"><table><thead><tr><th>Employee Code</th><th>Name</th><th>Email</th><th>Account Status</th><th>Attempts</th><th>Started / Provisioned</th><th>Last Error</th><th>Action</th></tr></thead><tbody id="pr-body"></tbody></table></div>
    </section>`;
  const body=root.querySelector("#pr-body"), msg=root.querySelector("#pr-message");
  let rows=[];
  async function load(){
    msg.textContent="Loading…";
    const r=await sb.from("vvhr_employees").select("id,employee_code,full_name,email,auth_user_id,oms_provisioning_status,oms_provisioning_attempts,oms_provisioning_error,oms_provisioned_at,oms_provisioning_started_at").order("created_at",{ascending:false});
    if(r.error){msg.textContent="Unable to load provisioning data: "+r.error.message;return;}
    rows=r.data||[]; draw();
  }
  function draw(){
    const q=root.querySelector("#pr-search").value.toLowerCase().trim();
    const filtered=rows.filter(x=>[x.employee_code,x.full_name,x.email].join(" ").toLowerCase().includes(q));
    body.innerHTML=filtered.map(x=>{
      const status=x.oms_provisioning_status||"not_started";
      const pendingAge=x.oms_provisioning_started_at?Date.now()-new Date(x.oms_provisioning_started_at).getTime():Infinity;
      const stalePending=status==="pending"&&pendingAge>=15*60*1000;
      const canRetry=(status==="not_started"||status==="failed"||stalePending)&&!x.auth_user_id&&Boolean(x.email);\n      const dateLabel=status==="success"&&x.oms_provisioned_at?new Date(x.oms_provisioned_at).toLocaleString():status==="pending"&&x.oms_provisioning_started_at?new Date(x.oms_provisioning_started_at).toLocaleString():"—";
      return `<tr><td>${esc(x.employee_code)}</td><td>${esc(x.full_name)}</td><td>${esc(x.email||"—")}</td><td>${esc(status)}</td><td>${esc(x.oms_provisioning_attempts||0)}</td><td>${esc(dateLabel)}</td><td>${esc(x.oms_provisioning_error||"—")}</td><td>${canRetry?`<button class="alt" data-retry="${esc(x.id)}">${status==="pending"?"Recover":"Retry"}</button>`:"—"}</td></tr>`;
    }).join("")||'<tr><td colspan="8">No employees found.</td></tr>';
    body.querySelectorAll("[data-retry]").forEach(b=>b.onclick=async()=>{
      if(!confirm("Create or recover FE login for this employee?"))return;b.disabled=true;b.textContent="Working…";msg.textContent="";
      const res=await sb.functions.invoke("provision-fe-account",{body:{employee_id:b.dataset.retry}});
      if(res.error||!res.data?.success){msg.textContent="Provisioning failed: "+(res.error?.message||res.data?.error||"Unknown error");await load();return}
      msg.textContent="Account created. Temporary password: "+res.data.temporary_password+" — share securely; employee must change it on first login.";
      await load();
    });
  }
  root.querySelector("#pr-refresh").onclick=load;
  root.querySelector("#pr-search").oninput=draw;
  load();
}
