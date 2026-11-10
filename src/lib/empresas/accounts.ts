import type { createAdminSupabase } from "@/lib/supabase/server";

type Admin = ReturnType<typeof createAdminSupabase>;

export const MIN_PASSWORD = 8;

/**
 * Crea la cuenta de una persona de la empresa (miembro o distribuidor): usuario de Auth + perfil con role "client".
 * El permiso real nunca sale de profiles.role, sino de company_members o company_partner_users.
 * Si algo falla después de crear el usuario, se borra para no dejar cuentas huérfanas.
 */
export async function createCompanyAccount(
  admin: Admin,
  args: { tenantId: string; email: string; name: string; password: string },
): Promise<{ ok: true; userId: string } | { ok: false; status: number; error: string }> {
  const email = args.email.trim().toLowerCase();
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: args.password,
    email_confirm: true,
    user_metadata: { name: args.name },
  });
  if (error || !data.user) {
    if (/already|exists|registered/i.test(error?.message || "")) {
      return { ok: false, status: 409, error: "Ya existe una cuenta con ese correo." };
    }
    if (/password/i.test(error?.message || "")) {
      return { ok: false, status: 400, error: `La contraseña debe tener al menos ${MIN_PASSWORD} caracteres y no ser demasiado simple.` };
    }
    console.error("[empresa] crear cuenta:", error?.message);
    return { ok: false, status: 500, error: "No se pudo crear la cuenta." };
  }
  const userId = data.user.id;
  const { error: profileError } = await admin.from("profiles").upsert({ id: userId, name: args.name, email, role: "client", tenant_id: args.tenantId });
  if (profileError) {
    await admin.auth.admin.deleteUser(userId);
    console.error("[empresa] crear perfil:", profileError.message);
    return { ok: false, status: 500, error: "No se pudo crear la cuenta." };
  }
  return { ok: true, userId };
}

/** Borra una cuenta recién creada cuando el paso siguiente (membresía o acceso al portal) falló. */
export async function rollbackAccount(admin: Admin, userId: string) {
  await admin.from("profiles").delete().eq("id", userId);
  await admin.auth.admin.deleteUser(userId);
}
