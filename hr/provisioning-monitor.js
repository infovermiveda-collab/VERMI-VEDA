// Phase 1 — Employee Portal login linking monitor.
export function renderProvisioning(root, sb, options = {}) {
  if (options.canManage === false) { root.innerHTML = "<p>HR/Admin access required.</p>"; return; }
  const esc = v => String(v ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  root.innerHTML = `
    <section class="vvhr-onboard-card">
      <header style="display:flex;justify-content:space-between;gap:12px;align-items:center;flex-wrap:wrap">
        <div><h2>Employee Login & Linking</h2><p>Create an Employee Portal login or securely link an existing Supabase Auth account using the employee's work email.</p></div>
        <button class="alt" id="pr-refresh">Refresh</button>
      </header>
      <div class="vvhr-v-toolbar"><input id="pr-search" placeholder="Search employee, code or email"></div>
      <div id="pr-message" role="status" aria-live="polite"></div>
      <div class="vvhr-tablewrap"><table><thead><tr><th>Employee Code</th><th>Name</th><th>Work Email</th><th>Employment</th><th>Portal Login</th><th>Action</th></tr></thead><tbody id="pr-body"></tbody></table></div>
      <p class="footnote">New accounts receive a one-time temporary password. Existing accounts keep their current password. Employee access is linked through the HR profile and does not alter OMS orders or FE permissions.</p>
    </section>`;
  const body=root.querySelector("#pr-body"), msg=root.querySelector("#pr-message");
  let rows=[];
  async function load(){
    msg.textContent="Loading employee login status…";
    const r=await sb.from("vvhr_employees").select("id,employee_code,full_name,email,auth_user_id,employment_status,created_at").order("employee_code",{ascending:true});
    if(r.error){msg.textContent="Unable to load employee records: "+r.error.message;return;}
    rows=r.data||[]; draw();
    const linked=rows.filter(x=>x.auth_user_id).length;
    msg.textContent=rows.length+" employee records · "+linked+" portal login(s) linked · "+(rows.length-linked)+" not linked";
  }
  function draw(){
    const q=root.querySelector("#pr-search").value.toLowerCase().trim();
    const filtered=rows.filter(x=>[x.employee_code,x.full_name,x.email].join(" ").toLowerCase().includes(q));
    body.innerHTML=filtered.map(x=>{
      const linked=Boolean(x.auth_user_id);
      const eligible=["active","probation"].includes(x.employment_status);
      const canLink=eligible&&Boolean(x.email)&&!linked;
      const label=linked?"Linked":!x.email?"Email required":!eligible?"Inactive":"Not linked";
      return `<tr>
        <td><b>${esc(x.employee_code)}</b></td><td>${esc(x.full_name)}</td><td>${esc(x.email||"—")}</td>
        <td>${esc(x.employment_status||"—")}</td><td><span class="pill ${linked?"green":canLink?"orange":""}">${esc(label)}</span></td>
        <td>${canLink?`<button class="alt" data-link="${esc(x.id)}">Create / Link Login</button>`:linked?"—":"—"}</td>
      </tr>`;
    }).join("")||'<tr><td colspan="6">No employees found.</td></tr>';
    body.querySelectorAll("[data-link]").forEach(b=>b.onclick=async()=>{
      if(!confirm("Create a new Employee Portal login or link an existing account matching this employee's work email?"))return;
      b.disabled=true;b.textContent="Linking…";msg.textContent="";
      const res=await sb.functions.invoke("provision-employee-portal-account",{body:{employee_id:b.dataset.link}});
      if(res.error||!res.data?.success){msg.textContent="Login linking failed: "+(res.error?.message||res.data?.error||"Unknown error");b.disabled=false;b.textContent="Create / Link Login";return;}
      if(res.data.temporary_password){
        window.prompt("One-time temporary password for "+res.data.employee_code+". Copy it now and share privately with the employee.",res.data.temporary_password);
        msg.textContent="Login created and linked. The employee must change the temporary password after first sign-in.";
      }else{
        msg.textContent="Existing login linked successfully. The employee's current password has not been changed.";
      }
      await load();
      if(res.data.temporary_password) msg.textContent="Login created and linked for "+res.data.employee_code+". Temporary password was shown once; employee must change it after first sign-in.";
      else msg.textContent="Existing login linked successfully for "+res.data.employee_code+". Existing password unchanged.";
    });
  }
  root.querySelector("#pr-refresh").onclick=load;
  root.querySelector("#pr-search").oninput=draw;
  load();
}
