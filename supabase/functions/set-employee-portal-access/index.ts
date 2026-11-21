import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS"};
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,"Content-Type":"application/json"}});
Deno.serve(async(req:Request)=>{
 if(req.method==="OPTIONS")return new Response("ok",{headers:cors});
 if(req.method!=="POST")return json({error:"Method not allowed"},405);
 try{
  const url=Deno.env.get("SUPABASE_URL"),anon=Deno.env.get("SUPABASE_ANON_KEY"),service=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if(!url||!anon||!service)throw new Error("Server auth configuration is incomplete.");
  const authorization=req.headers.get("Authorization")||"";
  if(!authorization.startsWith("Bearer "))return json({error:"Authentication required"},401);
  const caller=createClient(url,anon,{global:{headers:{Authorization:authorization}}});
  const {data:{user},error:authError}=await caller.auth.getUser();
  if(authError||!user)return json({error:"Invalid session"},401);
  const admin=createClient(url,service);
  const [{data:oms},{data:hr}]=await Promise.all([
   admin.from("oms_profiles").select("role,active").eq("user_id",user.id).maybeSingle(),
   admin.from("vvhr_user_profiles").select("role").eq("user_id",user.id).maybeSingle()
  ]);
  if(!((oms?.role==="admin"&&oms.active===true)||hr?.role==="admin"))return json({error:"HR/Admin access required"},403);
  const body=await req.json().catch(()=>({}));
  const employeeId=String(body.employee_id||"").trim();
  const status=String(body.employment_status||"").trim().toLowerCase();
  if(!employeeId||!["active","probation","resigned","terminated"].includes(status))return json({error:"Valid employee_id and employment_status are required."},400);
  const {data:employee,error}=await admin.from("vvhr_employees").select("id,employee_code,auth_user_id,employment_status").eq("id",employeeId).single();
  if(error||!employee)return json({error:"Employee not found"},404);
  if(employee.employment_status!==status)return json({error:"Employee status changed. Refresh and retry."},409);
  if(!employee.auth_user_id)return json({success:true,linked:false,message:"No portal login is linked; no Auth account change was needed."});
  const ban_duration=["active","probation"].includes(status)?"none":"876000h";
  const {error:banError}=await admin.auth.admin.updateUserById(employee.auth_user_id,{ban_duration});
  if(banError)throw banError;
  return json({success:true,linked:true,access_enabled:["active","probation"].includes(status),employee_code:employee.employee_code});
 }catch(error){return json({error:error?.message||String(error)},400);}
});