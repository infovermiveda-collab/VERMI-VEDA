// VermiVeda Employee Self-Service Portal — private, row-level secured employee view.
export function renderEmployeePortal(root,sb,options={}){
 const uid=options.currentUserId;
 const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
 root.innerHTML='<section class="vv-employee-portal"><header><span>VERMIVEDA · EMPLOYEE SELF SERVICE</span><h2>My Employee Portal</h2><p>View your employment details and download HR documents.</p></header><div id="ep-content" class="vv-ep-card">Loading your employee profile…</div></section>';
 const box=root.querySelector("#ep-content");
 async function load(){
  const e=await sb.from("vvhr_employees").select("id,employee_code,full_name,mobile,email,address,designation,department,joining_date,employment_status,monthly_fixed_salary").eq("auth_user_id",uid).single();
  if(e.error||!e.data){box.innerHTML='<div class="error">Your employee profile is not linked yet. Please contact HR/Admin to link your login.</div>';return;}
  const x=e.data,docs=await sb.from("vvhr_employee_documents").select("id,document_type,file_name,storage_path,uploaded_at").eq("employee_id",x.id).order("uploaded_at",{ascending:false});
  if(docs.error){box.innerHTML='<div class="error">Unable to load employee documents: '+esc(docs.error.message)+'</div>';return;}
  const labels={offer_letter:"Offer of Employment",aadhaar_front:"Aadhaar Front",aadhaar_back:"Aadhaar Back",pan_card:"PAN Card",bank_proof:"Bank Proof",employee_photo:"Employee Photo",resume:"Resume / CV"};
  box.innerHTML='<div class="vv-ep-identity"><div><small>EMPLOYEE CODE</small><b>'+esc(x.employee_code)+'</b></div><span class="pill green">'+esc(x.employment_status)+'</span></div><div class="vv-ep-grid">'+[['Full Name',x.full_name],['Department',x.department],['Designation',x.designation],['Joining Date',x.joining_date],['Work Email',x.email],['Mobile',x.mobile],['Work Location',x.address]].map(([k,v])=>'<div><small>'+esc(k)+'</small><b>'+esc(v||"—")+'</b></div>').join('')+'</div><h3>My Documents</h3><p class="muted">Documents are stored privately. Only you and authorised HR/Admin users can access them.</p><div class="vv-ep-docs">'+(docs.data||[]).map(d=>'<article><div><b>'+esc(labels[d.document_type]||d.document_type)+'</b><small>'+esc(d.file_name)+'</small></div><button class="alt" data-doc="'+esc(d.id)+'">Download</button></article>').join('')+'</div>';
  box.querySelectorAll("[data-doc]").forEach(b=>b.onclick=async()=>{const d=docs.data.find(z=>z.id===b.dataset.doc);const u=await sb.storage.from("vvhr-employee-documents").createSignedUrl(d.storage_path,300,{download:d.file_name});if(u.error){alert(u.error.message);return}window.open(u.data.signedUrl,"_blank","noopener");});
 }
 load();
}