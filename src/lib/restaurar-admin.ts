// Restaura la cuenta del administrador de una empresa cuya cuenta de acceso o perfil se perdio (por ejemplo, el administrador se elimino
// a si mismo desde «Equipo»). Vuelve a crear su usuario y su perfil con una contraseña temporal y le manda el correo de bienvenida.
// No toca nada del negocio (servicios, clientes, citas...). Solo Super admin la usa (ver /api/superadmin/tenants/[id]/restaurar-admin).
import { htmlBienvenidaEmpresa } from "@/lib/mail-bienvenida-empresa";

export const generarClaveTemporal = () => Math.random().toString(36).slice(-6) + Math.random().toString(36).slice(-4).toUpperCase();

export type ResultadoRestauracion =
  | { ok: true; email: string; tempPassword: string; correoEnviado: boolean }
  | { ok: false; error: string; status: number };

export async function restaurarAdmin(supabase: any, tenantId: string): Promise<ResultadoRestauracion> {
  const { data: t } = await supabase.from("tenants").select("id, name, plan, status, max_professionals, admin_email, admin_name, trial_ends_at").eq("id", tenantId).maybeSingle();
  if (!t) return { ok: false, error: "Empresa no encontrada", status: 404 };
  const email = String(t.admin_email || "").trim().toLowerCase();
  if (!/^\S+@\S+\.\S+$/.test(email)) return { ok: false, error: "La empresa no tiene un correo de administrador válido. Edítalo primero.", status: 400 };

  // Si ya hay un administrador activo con perfil, no hay nada que restaurar.
  const { data: admins } = await supabase.from("profiles").select("id, email, active").eq("tenant_id", tenantId).eq("role", "admin");
  if ((admins || []).some((a: any) => a.active)) return { ok: false, error: "Esta empresa ya tiene un administrador activo.", status: 409 };

  const tempPassword = generarClaveTemporal();

  // Usuario de acceso: se crea; si ya existe (solo se perdio el perfil), se le pone la clave temporal.
  let userId: string | null = null;
  const creado = await supabase.auth.admin.createUser({ email, password: tempPassword, email_confirm: true });
  if (creado.data?.user) userId = creado.data.user.id;
  else if (/already|registered|exists/i.test(String(creado.error?.message || ""))) {
    for (let page = 1; page <= 10 && !userId; page++) {
      const { data: lista } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
      const u = (lista?.users || []).find((x: any) => String(x.email || "").toLowerCase() === email);
      if (u) userId = u.id;
      if (!lista?.users || lista.users.length < 200) break;
    }
    if (!userId) return { ok: false, error: "Ese correo ya tiene una cuenta, pero no la pude ubicar.", status: 500 };
    const act = await supabase.auth.admin.updateUserById(userId, { password: tempPassword, email_confirm: true });
    if (act.error) return { ok: false, error: `No se pudo dejar la clave temporal: ${act.error.message}`, status: 500 };
  } else return { ok: false, error: `No se pudo crear la cuenta: ${creado.error?.message || "error desconocido"}`, status: 500 };

  // Perfil: administrador activo. En un negocio de un solo profesional (Lite, Basic) el dueño es quien atiende.
  const perfil = await supabase.from("profiles").upsert({
    id: userId, email, name: t.admin_name || t.name, role: "admin", tenant_id: tenantId, active: true,
    ...(Number(t.max_professionals) <= 1 ? { also_attends_clients: true } : {}),
  });
  if (perfil.error) return { ok: false, error: `No se pudo crear el perfil: ${perfil.error.message}`, status: 500 };

  await supabase.from("tenants").update({ temp_password: tempPassword, must_change_password: true }).eq("id", tenantId);
  await supabase.from("audit_log").insert({ action: "admin_restored", entity_type: "tenant", entity_id: tenantId, description: `Super admin restauró la cuenta del administrador (${email})`, metadata: { email } }).then(() => {}, () => {});

  // Correo con las credenciales (mismo de las empresas nuevas). Si falla, la clave igual se devuelve al Super admin.
  let correoEnviado = false;
  try {
    const { getResendClient } = await import("@/lib/resend-client");
    const planLabel = String(t.plan || "").charAt(0).toUpperCase() + String(t.plan || "").slice(1);
    const dias = t.status === "trial" && t.trial_ends_at ? Math.max(0, Math.ceil((new Date(t.trial_ends_at).getTime() - Date.now()) / 86400000)) : 0;
    const planLine = t.status === "trial" ? `${planLabel} (${dias} días de prueba)` : `${planLabel} (activo)`;
    await getResendClient().emails.send({
      from: process.env.EMAIL_FROM || "re-booking <no-reply@re-booking.cl>",
      to: email,
      subject: "re-booking — Tu acceso fue restaurado",
      html: htmlBienvenidaEmpresa({ adminName: t.admin_name || t.name, businessName: t.name, adminEmail: email, tempPassword, planLine, appUrl: process.env.NEXT_PUBLIC_APP_URL || "https://www.re-booking.cl" }),
    });
    correoEnviado = true;
  } catch (e) { console.error("restaurar-admin: no se pudo enviar el correo", e); }

  return { ok: true, email, tempPassword, correoEnviado };
}
