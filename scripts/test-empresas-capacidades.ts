// Empresas: permisos por rol e interruptor. Sin red ni base de datos.
// Uso: npx tsx scripts/test-empresas-capacidades.ts
import { canSeeOrder, capabilitiesFor, roleCan } from "../src/lib/empresas/capabilities";
import { isEmpresasEnabled } from "../src/lib/empresas/flag";

let fails = 0;
const ok = (name: string, cond: boolean) => { if (!cond) { fails++; console.log("FALLA", name); } else console.log("ok", name); };

ok("apagado en producción por defecto", !isEmpresasEnabled({ NODE_ENV: "production", VERCEL_ENV: "production" }));
ok("apagado sin variables", !isEmpresasEnabled({}));
ok("se activa a propósito", isEmpresasEnabled({ NODE_ENV: "production", VERCEL_ENV: "production", EMPRESAS_ENABLED: "1" }));
ok("otro valor no activa", !isEmpresasEnabled({ NODE_ENV: "production", EMPRESAS_ENABLED: "true" }));
ok("activo en Preview", isEmpresasEnabled({ NODE_ENV: "production", VERCEL_ENV: "preview" }));
ok("activo en local", isEmpresasEnabled({ NODE_ENV: "development" }));

for (const role of [null, undefined, "", "admin", "super_admin", "barber", "client", "constructor", "__proto__", "toString"]) {
  ok(`rol ${String(role)} no da permisos`, capabilitiesFor(role).length === 0 && !roleCan(role, "stock.ver"));
}
ok("dueño ve costos", roleCan("owner", "costos.ver"));
ok("vendedor no ve costos", !roleCan("seller", "costos.ver"));
ok("bodega no ve costos", !roleCan("warehouse", "costos.ver"));
ok("vendedor no mueve stock", !roleCan("seller", "stock.mover"));
ok("bodega mueve stock", roleCan("warehouse", "stock.mover"));
ok("bodega no ajusta", !roleCan("warehouse", "stock.ajustar"));
ok("bodega cuenta", roleCan("warehouse", "conteos.contar"));
ok("bodega no cierra conteos", !roleCan("warehouse", "conteos.cerrar"));
ok("bodega no ve lo que dice el sistema", !roleCan("warehouse", "conteos.ver_sistema"));
ok("bodega no ve clientes", !roleCan("warehouse", "clientes.ver"));
ok("vendedor no despacha", !roleCan("seller", "pedidos.despachar"));

const mine = { created_by: "u1", status: "draft" };
ok("vendedor ve el suyo", canSeeOrder("seller", "u1", mine));
ok("vendedor no ve el ajeno", !canSeeOrder("seller", "u2", mine));
ok("bodega no ve borradores", !canSeeOrder("warehouse", "u2", mine));
ok("bodega ve confirmados", canSeeOrder("warehouse", "u2", { created_by: "u1", status: "confirmed" }));
ok("bodega no ve cancelados", !canSeeOrder("warehouse", "u2", { created_by: "u1", status: "cancelled" }));
ok("dueño ve todos", canSeeOrder("owner", "u2", mine));
ok("rol desconocido no ve", !canSeeOrder("admin", "u1", mine));

console.log(fails ? `${fails} fallas` : "TODO OK");
process.exit(fails ? 1 : 0);
