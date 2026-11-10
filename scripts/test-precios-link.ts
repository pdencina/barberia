import { preciosDestino, slugVendedorValido } from "../src/lib/precios-link";
import { statsDeVendedor } from "../src/lib/vendedores";
let fails = 0;
const t = (n: string, got: unknown, want: unknown) => { if (JSON.stringify(got) !== JSON.stringify(want)) { fails++; console.log("FALLA", n, JSON.stringify(got), "esperado", JSON.stringify(want)); } else console.log("ok", n); };
t("sin parametros: marca creador y va a #precios", preciosDestino(new URLSearchParams("")), "/landing?utm_source=creador&utm_medium=contenido&utm_campaign=precios#precios");
t("el nombre del creador manda sobre el defecto", preciosDestino(new URLSearchParams("utm_campaign=juan")), "/landing?utm_source=creador&utm_medium=contenido&utm_campaign=juan#precios");
t("conserva fbclid", preciosDestino(new URLSearchParams("fbclid=ABC")).includes("fbclid=ABC"), true);
t("ignora parametros ajenos", preciosDestino(new URLSearchParams("x=1&<script>=2")).includes("script"), false);
t("recorta valores largos", preciosDestino(new URLSearchParams("utm_campaign=" + "a".repeat(500))).length < 400, true);
// --- vendedores ---
t("?v=juan marca vendedor", preciosDestino(new URLSearchParams("v=Juan")), "/landing?utm_source=vendedor&utm_medium=vendedor&utm_campaign=juan#precios");
t("?v invalido cae en el defecto creador", preciosDestino(new URLSearchParams("v=<x>")).includes("utm_source=creador"), true);
t("slug valido", [slugVendedorValido("juan-2"), slugVendedorValido("a"), slugVendedorValido("Ju an")], [true, false, false]);
const filas = [
  { status: "paid", amount: 15458, plan: "basic", created_at: "2026-11-02T10:00:00Z", ad_attribution: { utm_source: "vendedor", utm_campaign: "juan" } },
  { status: "pending", amount: 30000, ad_attribution: { utm_source: "vendedor", utm_campaign: "juan" } },
  { status: "paid", amount: 59488, plan: "pro", created_at: "2026-11-05T10:00:00Z", ad_attribution: { utm_source: "vendedor", utm_campaign: "juan" } },
  { status: "paid", amount: 99999, ad_attribution: { utm_source: "vendedor", utm_campaign: "maria" } },
  { status: "paid", amount: 11111, ad_attribution: { utm_source: "meta", utm_campaign: "juan" } },
];
const j = statsDeVendedor(filas as any, "juan");
t("juan: 3 empezaron, 2 pagaron, 67%", [j.iniciados, j.pagados, j.conversion], [3, 2, 67]);
t("juan: ingresos suman solo sus pagadas", j.ingresos, 74946);
t("no mezcla a otros vendedores ni a otras fuentes", statsDeVendedor(filas as any, "maria").ingresos, 99999);
t("ventas ordenadas de la mas reciente", j.ventas.map((v) => v.plan), ["pro", "basic"]);
t("el detalle no trae datos personales", Object.keys(j.ventas[0]).sort(), ["fecha", "monto", "plan"]);
console.log(fails ? `${fails} fallas` : "TODO OK");
process.exit(fails ? 1 : 0);
