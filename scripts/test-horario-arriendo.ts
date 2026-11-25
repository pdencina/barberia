import { arriendoPuedeEditarHoy, diaDeLaSemanaChile } from "../src/lib/horario-arriendo";
let fallas = 0;
const t = (iso: string, esperado: boolean) => { const r = arriendoPuedeEditarHoy(new Date(iso)); if (r !== esperado) { fallas++; console.log("FALLA", iso, r); } };
t("2026-11-29T15:00:00Z", true);  // domingo
t("2026-11-30T15:00:00Z", true);  // lunes
t("2026-12-01T15:00:00Z", false); // martes
t("2026-11-28T15:00:00Z", false); // sábado
t("2026-12-01T01:00:00Z", true);  // lunes 22:00 en Chile (martes 01:00 UTC)
t("2026-11-30T01:00:00Z", true);  // domingo 22:00 en Chile (lunes UTC)
t("2026-11-29T01:00:00Z", false); // sábado 22:00 en Chile (domingo UTC)
if (diaDeLaSemanaChile(new Date("2026-11-29T15:00:00Z")) !== 0) fallas++;
console.log(fallas ? "HAY FALLAS" : "OK horario arriendo");
process.exit(fallas ? 1 : 0);
