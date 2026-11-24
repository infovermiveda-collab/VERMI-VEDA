import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ success: false, error: "Method not allowed" }, 405);

  const url = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ success: false, error: "Authentication required" }, 401);

  const callerClient = createClient(url, anonKey, { global: { headers: { Authorization: authHeader } } });
  const { data: auth, error: authError } = await callerClient.auth.getUser();
  if (authError || !auth.user) return json({ success: false, error: "Invalid session" }, 401);

  const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const uid = auth.user.id;
  const [{ data: oms }, { data: legacy }] = await Promise.all([
    admin.from("oms_profiles").select("role,active").eq("user_id", uid).maybeSingle(),
    admin.from("vvhr_user_profiles").select("role").eq("user_id", uid).maybeSingle(),
  ]);
  const allowed = (oms?.active === true && ["admin", "hr"].includes(String(oms.role).toLowerCase()))
    || ["admin", "hr"].includes(String(legacy?.role || "").toLowerCase());
  if (!allowed) return json({ success: false, error: "Admin or HR permission required" }, 403);

  let body: { employee_id?: string; new_password?: string };
  try { body = await req.json(); } catch { return json({ success: false, error: "Invalid request body" }, 400); }
  const employeeId = String(body.employee_id || "");
  const password = String(body.new_password || "");
  if (!employeeId) return json({ success: false, error: "Employee ID is required" }, 400);
  if (password.length < 9) return json({ success: false, error: "Password must be at least 9 characters" }, 400);

  const { data: employee, error: employeeError } = await admin
    .from("vvhr_employees").select("id,employee_code,full_name,auth_user_id")
    .eq("id", employeeId).maybeSingle();
  if (employeeError || !employee) return json({ success: false, error: "Employee not found" }, 404);
  if (!employee.auth_user_id) return json({ success: false, error: "Employee Portal login is not linked yet" }, 409);

  const { error: updateError } = await admin.auth.admin.updateUserById(employee.auth_user_id, { password, user_metadata: { vvhr_must_change_password: true } });
  if (updateError) return json({ success: false, error: updateError.message }, 400);
  return json({ success: true, employee_code: employee.employee_code, message: "Employee password updated successfully" });
});
