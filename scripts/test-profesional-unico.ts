import { atiende, esUnicoProfesional } from "../src/lib/profesional-unico";
let f = 0;
const ok = (c: boolean, t: string) => { if (!c) { f++; console.log("FALLA", t); } };
const base = (data: any[], error: any = null) => ({ from: () => ({ select: () => ({ eq: () => ({ eq: async () => ({ data, error }) }) }) }) });
(async () => {
  const duena = { role: "admin", active: true, also_attends_clients: true };
  ok(atiende(duena) && !atiende({ role: "admin", active: true }) && !atiende({ role: "barber", active: false }), "quién atiende");
  ok(await esUnicoProfesional(base([duena, { role: "receptionist", active: true }]), "t"), "independiente");
  ok(!(await esUnicoProfesional(base([duena, { role: "barber", active: true }]), "t")), "equipo: se respetan los asignados");
  ok(!(await esUnicoProfesional(base([duena], { message: "x" }), "t")) && !(await esUnicoProfesional(base([duena]), null)), "ante error, como antes");
  console.log(f ? `${f} FALLAS` : "OK profesional único");
  process.exit(f ? 1 : 0);
})();
