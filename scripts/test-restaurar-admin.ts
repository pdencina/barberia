// Restaurar la cuenta del administrador (si se elimino a si mismo). Uso: npx tsx scripts/test-restaurar-admin.ts
import { restaurarAdmin, reenviarAcceso, generarClaveTemporal } from "../src/lib/restaurar-admin";
process.env.RESEND_API_KEY = "x";
let fallos = 0;
const ok = (c: boolean, n: string) => { if (!c) { fallos++; console.log("FALLA:", n); } else console.log("OK  ", n); };

function fake(o: { tenant: any; admins?: any[]; usuarioExiste?: boolean; usuario?: any }) {
  const log: any = { perfil: null, tenantUpd: null, creado: null, claveActualizada: null, audit: 0 };
  const consulta = (tabla: string) => {
    const q: any = { _eq: {} as any, _op: "" };
    q.select = () => q; q.eq = (c: string, v: any) => { q._eq[c] = v; return q; };
    q.maybeSingle = async () => ({ data: tabla === "tenants" ? o.tenant : null });
    q.then = (res: any) => Promise.resolve({ data: tabla === "profiles" ? (o.admins || []) : [] }).then(res);
    q.upsert = (v: any) => { if (tabla === "profiles") log.perfil = v; return Promise.resolve({ error: null }); };
    q.update = (v: any) => { if (tabla === "tenants") log.tenantUpd = v; return { eq: async () => ({ error: null }) }; };
    q.insert = () => { log.audit++; return { then: (a: any) => Promise.resolve().then(a) }; };
    return q;
  };
  const sb: any = {
    from: (t: string) => consulta(t),
    auth: { admin: {
      createUser: async (a: any) => { log.creado = a; return o.usuarioExiste ? { data: null, error: { message: "A user with this email address has already been registered" } } : { data: { user: { id: "nuevo-id" } }, error: null }; },
      getUserById: async () => ({ data: { user: o.usuario === undefined ? null : o.usuario } }),
      listUsers: async () => ({ data: { users: [{ id: "viejo-id", email: o.tenant.admin_email }] } }),
      updateUserById: async (id: string, a: any) => { log.claveActualizada = { id, ...a }; return { error: null }; },
    } },
  };
  return { sb, log };
}
const basic = { id: "t1", name: "Th_diamond", plan: "basic", status: "trial", max_professionals: 1, admin_email: "Bastian@Ejemplo.cl", admin_name: "Bastian Espinoza", trial_ends_at: new Date(Date.now() + 10 * 86400000).toISOString() };

(async () => {
  ok(generarClaveTemporal().length >= 8, "la clave temporal tiene largo suficiente");
  let { sb, log } = fake({ tenant: basic });
  let r = await restaurarAdmin(sb, "t1");
  ok(r.ok && r.email === "bastian@ejemplo.cl", "restaura con el correo del negocio (en minúsculas)");
  ok(log.creado?.email === "bastian@ejemplo.cl" && log.creado?.email_confirm === true && String(log.creado?.password).length >= 8, "crea el usuario con clave temporal");
  ok(log.perfil?.id === "nuevo-id" && log.perfil?.role === "admin" && log.perfil?.tenant_id === "t1" && log.perfil?.active === true, "crea su perfil como administrador activo del negocio");
  ok(log.perfil?.also_attends_clients === true, "en un plan de 1 profesional (Basic) el dueño queda atendiendo clientes");
  ok(log.tenantUpd?.must_change_password === true, "le pide cambiar la clave al entrar");

  ({ sb, log } = fake({ tenant: { ...basic, plan: "pro", max_professionals: 8 } }));
  await restaurarAdmin(sb, "t1");
  ok(!("also_attends_clients" in (log.perfil || {})), "en un plan grande no se marca como profesional");

  ({ sb, log } = fake({ tenant: basic, admins: [{ id: "a1", email: "x@y.cl", active: true }] }));
  r = await restaurarAdmin(sb, "t1");
  ok(!r.ok && (r as any).status === 409 && !log.creado, "si ya hay un administrador activo, no hace nada");

  ({ sb, log } = fake({ tenant: basic, admins: [{ id: "a1", email: "x@y.cl", active: false }] }));
  r = await restaurarAdmin(sb, "t1");
  ok(r.ok, "un administrador desactivado no cuenta: se restaura");

  ({ sb, log } = fake({ tenant: basic, usuarioExiste: true }));
  r = await restaurarAdmin(sb, "t1");
  ok(r.ok && log.claveActualizada?.id === "viejo-id" && log.perfil?.id === "viejo-id", "si el usuario de acceso ya existía (solo faltaba el perfil), le pone la clave temporal y reutiliza ese usuario");

  ({ sb, log } = fake({ tenant: { ...basic, admin_email: "no-es-correo" } }));
  r = await restaurarAdmin(sb, "t1");
  ok(!r.ok && (r as any).status === 400 && !log.creado, "sin correo válido no crea nada");

  ({ sb, log } = fake({ tenant: null }));
  r = await restaurarAdmin(sb, "t1");
  ok(!r.ok && (r as any).status === 404, "empresa inexistente");

  // ---- Reenviar acceso: solo a quien NUNCA ha entrado ----
  const admin = { id: "a1", email: "dueno@ejemplo.cl", active: true };
  ({ sb, log } = fake({ tenant: basic, admins: [admin], usuario: { id: "a1", email: "dueno@ejemplo.cl", last_sign_in_at: null } }));
  r = await reenviarAcceso(sb, "t1");
  ok(r.ok && r.email === "dueno@ejemplo.cl" && log.claveActualizada?.id === "a1" && String(log.claveActualizada?.password).length >= 8, "reenviar: a quien nunca entró le pone una clave temporal nueva");
  ok(log.tenantUpd?.must_change_password === true && !log.creado && !log.perfil, "reenviar: pide cambiar la clave y NO crea otra cuenta ni perfil");

  ({ sb, log } = fake({ tenant: basic, admins: [admin], usuario: { id: "a1", email: "dueno@ejemplo.cl", last_sign_in_at: "2026-11-10T10:00:00Z" } }));
  r = await reenviarAcceso(sb, "t1");
  ok(!r.ok && (r as any).status === 409 && !log.claveActualizada, "reenviar: si ya entró alguna vez NO se toca su clave");

  ({ sb, log } = fake({ tenant: basic, admins: [] }));
  r = await reenviarAcceso(sb, "t1");
  ok(!r.ok && (r as any).status === 409 && !log.claveActualizada, "reenviar: sin administrador activo se sugiere restaurar");

  ({ sb, log } = fake({ tenant: basic, admins: [admin], usuario: null }));
  r = await reenviarAcceso(sb, "t1");
  ok(!r.ok && (r as any).status === 409, "reenviar: sin cuenta de acceso se sugiere restaurar");

  ({ sb, log } = fake({ tenant: null }));
  r = await reenviarAcceso(sb, "t1");
  ok(!r.ok && (r as any).status === 404, "reenviar: empresa inexistente");
  process.exit(fallos ? 1 : 0);
})();
