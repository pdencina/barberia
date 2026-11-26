// Antes de crear una ficha de cliente se busca si la persona ya existe, con la misma regla con la que se unificaron
// las fichas repetidas: mismo TELÉFONO o mismo CORREO **y** mismo primer nombre (3 primeras letras, sin tildes).
// Así «+56966151692» = «966151692», pero dos familiares que comparten celular siguen siendo personas distintas.

export const claveNombre = (n: unknown): string =>
  String(n ?? "").trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").split(/\s+/)[0].slice(0, 3);

/** Últimos 9 dígitos, o "" si no alcanza para ser un teléfono. */
export const telefono9 = (p: unknown): string => {
  const d = String(p ?? "").replace(/\D/g, "");
  return d.length >= 8 ? d.slice(-9) : "";
};

export interface DatosCliente { name?: string | null; phone?: string | null; email?: string | null }

export function esLaMismaPersona(ficha: DatosCliente, nuevo: DatosCliente): boolean {
  const nombre = claveNombre(nuevo.name);
  if (!nombre || claveNombre(ficha.name) !== nombre) return false;
  const tel = telefono9(nuevo.phone);
  const correo = String(nuevo.email ?? "").trim().toLowerCase();
  return (!!tel && telefono9(ficha.phone) === tel) || (!!correo && String(ficha.email ?? "").trim().toLowerCase() === correo);
}

/** La ficha existente (la más antigua) de esa persona en el negocio, o null. */
export async function buscarClienteExistente(sb: any, tenantId: string | null, nuevo: DatosCliente): Promise<any | null> {
  if (!tenantId) return null;
  const tel = telefono9(nuevo.phone);
  const correo = String(nuevo.email ?? "").trim().toLowerCase();
  const consultas: PromiseLike<any>[] = [];
  const base = () => sb.from("clients").select("*").eq("tenant_id", tenantId).order("created_at", { ascending: true }).limit(25);
  if (tel) consultas.push(base().ilike("phone", `%${tel.slice(-8)}`));
  if (correo) consultas.push(base().ilike("email", correo.replace(/[\\%_]/g, "\\$&")));
  if (consultas.length === 0) return null;
  const filas: any[] = (await Promise.all(consultas)).flatMap((r: any) => r.data || []);
  return filas.filter((f) => esLaMismaPersona(f, nuevo)).sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)))[0] || null;
}
