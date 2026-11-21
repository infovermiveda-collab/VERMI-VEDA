import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
const makeTemporaryPassword = () => {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%";
  return "Vv!" + Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("") + "9a";
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  let createdPassword: string | null = null;
  let createdEmployeeCode: string | null = null;
  try {
    const url = Deno.env.get("SUPABASE_URL");
    const anon = Deno.env.get("SUPABASE_ANON_KEY");
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !anon || !service) throw new Error("Server auth configuration is incomplete.");

    const authorization = req.headers.get("Authorization") || "";
    if (!authorization.startsWith("Bearer ")) return json({ error: "Authentication required" }, 401);
    const caller = createClient(url, anon, { global: { headers: { Authorization: authorization } } });
    const { data: { user }, error: authError } = await caller.auth.getUser();
    if (authError || !user) return json({ error: "Invalid session" }, 401);

    const admin = createClient(url, service);
    const [{ data: omsActor }, { data: hrActor }] = await Promise.all([
      admin.from("oms_profiles").select("role,active").eq("user_id", user.id).maybeSingle(),
      admin.from("vvhr_user_profiles").select("role").eq("user_id", user.id).maybeSingle(),
    ]);
    const authorised = (omsActor?.role === "admin" && omsActor.active === true) || hrActor?.role === "admin";
    if (!authorised) return json({ error: "HR/Admin access required" }, 403);

    const body = await req.json().catch(() => ({}));
    const employeeId = String(body.employee_id || "").trim();
    if (!employeeId) return json({ error: "employee_id is required" }, 400);

    const { data: employee, error: employeeError } = await admin
      .from("vvhr_employees")
      .select("id,employee_code,full_name,email,auth_user_id,employment_status")
      .eq("id", employeeId)
      .single();
    if (employeeError || !employee) return json({ error: "Employee not found" }, 404);
    if (!["active", "probation"].includes(employee.employment_status)) {
      return json({ error: "Only active or probation employees can receive an Employee Portal login." }, 409);
    }
    const email = String(employee.email || "").trim().toLowerCase();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return json({ error: "Enter a valid work email in the employee record before linking a login." }, 400);
    }

    let userId: string | null = employee.auth_user_id || null;
    let created = false;
    let temporaryPassword: string | null = null;

    if (userId) {
      const { data, error } = await admin.auth.admin.getUserById(userId);
      if (error || !data?.user) throw new Error("The linked Auth account could not be found. Contact support before changing the link.");
      if ((data.user.email || "").toLowerCase() !== email) {
        throw new Error("Employee email does not match the linked login. Update and verify the account email before retrying.");
      }
    } else {
      let matchingUser: any = null;
      const perPage = 1000;
      for (let page = 1; page <= 100; page++) {
        const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
        if (error) throw error;
        const users = data?.users || [];
        matchingUser = users.find((candidate: any) => (candidate.email || "").toLowerCase() === email) || null;
        if (matchingUser || users.length < perPage) break;
      }
      if (matchingUser) {
        userId = matchingUser.id;
      } else {
        temporaryPassword = makeTemporaryPassword();
        createdPassword = temporaryPassword;
        createdEmployeeCode = employee.employee_code;
        const { data, error } = await admin.auth.admin.createUser({
          email,
          password: temporaryPassword,
          email_confirm: true,
          user_metadata: { full_name: employee.full_name, employee_code: employee.employee_code, portal: "employee", vvhr_must_change_password: true },
        });
        if (error || !data?.user) throw error || new Error("Could not create the employee login.");
        userId = data.user.id;
        created = true;
      }
    }

    const [{ data: existingOms }, { data: existingHr }] = await Promise.all([
      admin.from("oms_profiles").select("role,active").eq("user_id", userId).maybeSingle(),
      admin.from("vvhr_user_profiles").select("role,employee_id").eq("user_id", userId).maybeSingle(),
    ]);
    if (existingOms?.role === "admin" || existingHr?.role === "admin") {
      throw new Error("This email belongs to an administrator account. Use a separate employee email.");
    }
    if (existingHr?.employee_id && existingHr.employee_id !== employee.id) {
      throw new Error("This login is already linked to another employee.");
    }

    // Preserve OMS FE profiles exactly as they are. Employee Portal authorization lives in vvhr_user_profiles.
    const { error: hrProfileError } = await admin.from("vvhr_user_profiles").upsert({
      user_id: userId,
      role: "employee",
      employee_id: employee.id,
    }, { onConflict: "user_id" });
    if (hrProfileError) throw hrProfileError;

    const { data: linkedRows, error: linkError } = await admin
      .from("vvhr_employees")
      .update({ auth_user_id: userId })
      .eq("id", employee.id)
      .or("auth_user_id.is.null,auth_user_id.eq." + userId)
      .select("id");
    if (linkError || !linkedRows?.length) {
      if (!existingHr) await admin.from("vvhr_user_profiles").delete().eq("user_id", userId);
      throw linkError || new Error("Employee link changed during setup. Refresh and retry.");
    }

    return json({
      success: true,
      employee_code: employee.employee_code,
      email,
      created,
      linked: true,
      temporary_password: temporaryPassword,
      message: created
        ? "Employee Portal login created and linked. Share the one-time password securely."
        : "Existing Auth login linked to the employee record. The existing password remains unchanged.",
    });
  } catch (error) {
    // If creation succeeded but linking failed, keep the Auth user so a retry can safely find and finish linking it.
    const message = error?.message || String(error);
    if (createdPassword) return json({ success: false, error: message, account_created: true, employee_code: createdEmployeeCode, temporary_password: createdPassword }, 200);
    return json({ error: message }, 400);
  }
});