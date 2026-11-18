// Supabase Edge Function: provision-fe-account
// Deploy only after the HR onboarding provisioning migration and UI are reviewed.
// Generates a one-time temporary password and returns it only to authorized HR/Admin.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

function tempPassword() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%";
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const raw = Array.from(bytes, b => alphabet[b % alphabet.length]).join("");
  return "Vv!" + raw + "9";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "POST required" }, 405);

  const url = Deno.env.get("SUPABASE_URL");
  const anon = Deno.env.get("SUPABASE_ANON_KEY");
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !anon || !service) return json({ error: "Server configuration missing" }, 500);

  const authHeader = req.headers.get("Authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  if (!token) return json({ error: "Authentication required" }, 401);

  const callerClient = createClient(url, anon, { global: { headers: { Authorization: `Bearer ${token}` } } });
  const admin = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: caller, error: callerError } = await callerClient.auth.getUser(token);
  if (callerError || !caller.user) return json({ error: "Invalid session" }, 401);

  const { data: callerProfile, error: profileError } = await admin
    .from("vvhr_user_profiles").select("role").eq("user_id", caller.user.id).maybeSingle();
  if (profileError) return json({ error: "Unable to verify HR permissions" }, 500);
  if (!callerProfile || !["admin", "hr"].includes(callerProfile.role)) return json({ error: "HR/Admin access required" }, 403);

  let employeeId = "";
  try {
    const body = await req.json();
    employeeId = String(body?.employee_id || "").trim();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }
  if (!employeeId) return json({ error: "employee_id is required" }, 400);

  const { data: employee, error: employeeError } = await admin
    .from("vvhr_employees")
    .select("id,employee_code,full_name,email,auth_user_id")
    .eq("id", employeeId).maybeSingle();
  if (employeeError) return json({ error: "Unable to load employee" }, 500);
  if (!employee) return json({ error: "Employee not found" }, 404);
  if (!employee.email?.trim()) return json({ error: "Employee email is required before FE account provisioning" }, 400);
  if (employee.auth_user_id) return json({ error: "OMS account already linked", already_provisioned: true }, 409);

  const { data: approvedRequest, error: requestError } = await admin
    .from("vvhr_onboarding_requests").select("id,status,employee_id")
    .eq("employee_id", employeeId).eq("status", "approved").maybeSingle();
  if (requestError) return json({ error: "Unable to verify approved onboarding" }, 500);
  if (!approvedRequest) return json({ error: "Only approved onboarding employees can be provisioned" }, 403);

  const { error: pendingError } = await admin.from("vvhr_employees")
    .update({ oms_provisioning_status: "pending", oms_provisioning_error: null, oms_provisioning_attempts: 1 })
    .eq("id", employeeId);
  if (pendingError) return json({ error: "Provisioning status could not be updated: " + pendingError.message }, 500);

  const password = tempPassword();
  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email: employee.email.trim().toLowerCase(),
    password,
    email_confirm: true,
    user_metadata: { full_name: employee.full_name, employee_code: employee.employee_code, account_origin: "hr_onboarding" },
  });
  if (createError || !created.user) {
    await admin.from("vvhr_employees").update({ oms_provisioning_status: "failed", oms_provisioning_error: createError?.message || "Auth account creation failed" }).eq("id", employeeId);
    return json({ error: createError?.message || "Auth account creation failed" }, 400);
  }

  const userId = created.user.id;
  const { error: omsProfileError } = await admin.from("oms_profiles").insert({
    user_id: userId, full_name: employee.full_name, role: "fe", active: true,
    must_change_password: true,
  });
  if (omsProfileError) {
    await admin.auth.admin.deleteUser(userId);
    await admin.from("vvhr_employees").update({ oms_provisioning_status: "failed", oms_provisioning_error: omsProfileError.message }).eq("id", employeeId);
    return json({ error: "OMS profile creation failed: " + omsProfileError.message }, 500);
  }

  const { error: linkError } = await admin.from("vvhr_employees").update({ auth_user_id: userId }).eq("id", employeeId).is("auth_user_id", null);
  if (linkError) {
    await admin.from("oms_profiles").delete().eq("user_id", userId);
    await admin.auth.admin.deleteUser(userId);
    await admin.from("vvhr_employees").update({ oms_provisioning_status: "failed", oms_provisioning_error: linkError.message }).eq("id", employeeId);
    return json({ error: "Employee linking failed: " + linkError.message }, 500);
  }

  await admin.from("vvhr_employees").update({ oms_provisioning_status: "success", oms_provisioning_error: null, oms_provisioned_at: new Date().toISOString() }).eq("id", employeeId);

  return json({
    success: true,
    employee_code: employee.employee_code,
    email: employee.email,
    temporary_password: password,
    message: "Temporary password is shown once. Share it securely and require password change on first login.",
  });
});
