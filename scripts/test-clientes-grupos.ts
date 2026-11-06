// Grupos de clientes (cargados vs nacidos en re-booking). Uso: npx tsx scripts/test-clientes-grupos.ts
import assert from "node:assert/strict";
import { grupoDe, resumirGrupos, esGrupo } from "../src/lib/clientes-grupos";
let fails = 0;
const t = (n: string, f: () => void) => { try { f(); console.log("OK  " + n); } catch (e: any) { fails++; console.log("MAL " + n + ": " + e.message); } };

t("sin imported_at nació en re-booking, aunque no tenga citas", () => assert.equal(grupoDe({ imported_at: null }, false), "nuevo"));
t("cargado con actividad es activo; sin actividad sigue cargado", () => {
  assert.equal(grupoDe({ imported_at: "2026-08-19T14:00:00Z" }, true), "activo");
  assert.equal(grupoDe({ imported_at: "2026-08-19T14:00:00Z" }, false), "cargado");
});
t("resumen cuenta cada grupo y los nuevos por mes", () => {
  const cl = [
    { id: "a", imported_at: "2026-08-19", created_at: "2026-08-19" }, { id: "b", imported_at: "2026-08-19", created_at: "2026-08-19" },
    { id: "c", created_at: "2026-09-03" }, { id: "d", created_at: "2026-09-20" }, { id: "e", created_at: "2026-10-02" },
  ];
  const r = resumirGrupos(cl, new Set(["a"]));
  assert.deepEqual([r.total, r.nuevos, r.activos, r.cargados], [5, 3, 1, 1]);
  assert.deepEqual(r.nuevosPorMes, [{ mes: "2026-09", n: 2 }, { mes: "2026-10", n: 1 }]);
});
t("solo se aceptan grupos conocidos", () => { assert.ok(esGrupo("activo")); assert.ok(!esGrupo("todos")); assert.ok(!esGrupo(3)); });
process.exit(fails ? 1 : 0);
