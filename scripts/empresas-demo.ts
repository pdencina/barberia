// Crea una empresa de DEMOSTRACIÓN con datos simulados en el Supabase de PRUEBAS, para probar el panel /empresa a mano.
// Uso: npx tsx scripts/empresas-demo.ts [correo-extra@dominio]   (el correo extra, si se da, queda como otro dueño de la demo)
// Pide una contraseña en esta ventana (no se muestra ni se guarda) y la usa para los 3 usuarios de demo.
// SEGURIDAD: se niega a correr si .env.local no apunta a rebooking-pruebas. Es re-ejecutable.
import { readFileSync } from "node:fs";
import { createInterface } from "node:readline";
import { createClient } from "@supabase/supabase-js";

const PRUEBAS_REF = "ucwrdmwtlesayjxmlbve";
const env: Record<string, string> = {};
for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}
const url = env.NEXT_PUBLIC_SUPABASE_URL || "";
if (!url.includes(PRUEBAS_REF)) {
  console.error("PARADO: .env.local no apunta al proyecto de pruebas.");
  process.exit(2);
}
const admin = createClient(url, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });

const USERS = [
  { email: "dueno@empresa-demo.test", name: "Dueño Demo", role: "owner" },
  { email: "vendedor@empresa-demo.test", name: "Vendedor Demo", role: "seller" },
  { email: "bodega@empresa-demo.test", name: "Bodega Demo", role: "warehouse" },
];
const extra = (process.argv[2] || "").trim().toLowerCase();
if (extra) {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(extra)) {
    console.error("PARADO: el correo extra no es valido.");
    process.exit(2);
  }
  if (!USERS.some((u) => u.email === extra)) USERS.push({ email: extra, name: "Dueño de prueba", role: "owner" });
}
const PRODUCTS = [
  { sku: "DEMO-001", name: "Cera mate (simulado)", category: "Cabello", list_price: 8000, cost: 4000, min_stock: 10, stock: [40, 15] },
  { sku: "DEMO-002", name: "Pomada brillo (simulado)", category: "Cabello", list_price: 9000, cost: 4500, min_stock: 10, stock: [25, 5] },
  { sku: "DEMO-003", name: "Aceite de barba (simulado)", category: "Barba", list_price: 12000, cost: 6000, min_stock: 5, stock: [12, 0] },
  { sku: "DEMO-004", name: "Perfume clásico (simulado)", category: "Perfumes", list_price: 25000, cost: 12000, min_stock: 5, stock: [8, 3] },
  { sku: "DEMO-005", name: "Shampoo (simulado)", category: "Cabello", list_price: 7000, cost: 3000, min_stock: 20, stock: [60, 30] },
];
const CUSTOMERS = [
  { name: "Barbería Demo Uno", tax_id: "DEMO-1", city: "Santiago", customer_type: "client" },
  { name: "Barbería Demo Dos", tax_id: "DEMO-2", city: "Valparaíso", customer_type: "client" },
  { name: "Distribuidor Demo", tax_id: "DEMO-3", city: "Concepción", customer_type: "distributor" },
];

function askHidden(question: string): Promise<string> {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    const writer = rl as unknown as { _writeToOutput: (s: string) => void };
    // Con salto de linea: readline redibuja la linea actual al empezar y borraba la pregunta.
    process.stdout.write(question + "\n");
    writer._writeToOutput = () => {};
    rl.question("", (answer) => { rl.close(); process.stdout.write("\n"); resolve(answer); });
  });
}

async function must<T>(label: string, q: PromiseLike<{ data: T; error: { message: string } | null }>): Promise<T> {
  const { data, error } = await q;
  if (error) throw new Error(`${label}: ${error.message}`);
  return data;
}

async function main() {
  const password = await askHidden("Elige una contraseña para los usuarios de demo (no se verá al escribir): ");
  if (password.length < 8) throw new Error("La contraseña debe tener al menos 8 caracteres.");

  let tenant = await must("empresa", admin.from("tenants").select("id").eq("slug", "empresa-demo").maybeSingle()) as { id: string } | null;
  if (!tenant) {
    tenant = await must("crear empresa", admin.from("tenants")
      .insert({ name: "Empresa Demo (simulada)", slug: "empresa-demo", admin_email: USERS[0].email, kind: "company" }).select("id").single()) as { id: string };
  }
  const tenantId = tenant.id;

  const { data: list, error: listError } = await admin.auth.admin.listUsers({ perPage: 1000 });
  if (listError) throw new Error(`usuarios: ${listError.message}`);
  let ownerId = "";
  for (const u of USERS) {
    let id = list.users.find((x) => x.email === u.email)?.id;
    if (id) {
      const { error } = await admin.auth.admin.updateUserById(id, { password });
      if (error) throw new Error(`clave: ${error.message}`);
    } else {
      const { data, error } = await admin.auth.admin.createUser({ email: u.email, password, email_confirm: true, user_metadata: { name: u.name } });
      if (error || !data.user) throw new Error(`crear usuario: ${error?.message}`);
      id = data.user.id;
    }
    // profiles.role = client: el permiso real sale de company_members, no de este valor.
    await must("perfil", admin.from("profiles").upsert({ id, name: u.name, email: u.email, role: "client", tenant_id: tenantId }));
    await must("miembro", admin.from("company_members").upsert({ tenant_id: tenantId, user_id: id, role_key: u.role, active: true }, { onConflict: "tenant_id,user_id" }));
    if (u.role === "owner") ownerId = id;
  }

  const warehouses: string[] = [];
  for (const name of ["Bodega Central (simulada)", "Bodega Sur (simulada)"]) {
    const row = await must("bodega", admin.from("company_warehouses").upsert({ tenant_id: tenantId, name }, { onConflict: "tenant_id,name" }).select("id").single()) as { id: string };
    warehouses.push(row.id);
  }
  for (const c of CUSTOMERS) {
    await must("cliente", admin.from("company_customers").upsert({ tenant_id: tenantId, ...c }, { onConflict: "tenant_id,tax_id" }));
  }
  for (const { stock, ...p } of PRODUCTS) {
    const row = await must("producto", admin.from("company_products").upsert({ tenant_id: tenantId, ...p }, { onConflict: "tenant_id,sku" }).select("id").single()) as { id: string };
    for (let i = 0; i < stock.length; i++) {
      if (stock[i] <= 0) continue;
      // La llave fija evita sumar el stock inicial otra vez si el script se corre de nuevo.
      await must("stock inicial", admin.rpc("company_stock_move", {
        p_tenant_id: tenantId, p_type: "in", p_product_id: row.id, p_warehouse_id: warehouses[i], p_quantity: stock[i], p_created_by: ownerId,
        p_reason: "Stock inicial simulado", p_idempotency_key: `demo-${p.sku}-${i}`,
      }));
    }
  }
  console.log("\nListo. Usuarios de demo:");
  for (const u of USERS) console.log(`  ${u.role.padEnd(9)} ${u.email}`);
}

main().catch((e) => { console.error("ERROR:", e instanceof Error ? e.message : "desconocido"); process.exit(1); });
