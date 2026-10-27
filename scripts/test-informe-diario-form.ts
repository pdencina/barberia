// Pruebas del formulario del informe (src/lib/informe-diario-form.ts). Ejecutar: npx tsx scripts/test-informe-diario-form.ts
import { aCuerpoPut, desdeRespuesta, formularioInicial, problemaFormulario, HORA_INFORME_PREDETERMINADA } from "../src/lib/informe-diario-form";
import { POLITICA_INFORME } from "../src/lib/agente/calendario-informe";

let fails = 0;
const t = (n: string, ok: boolean, x = "") => { if (!ok) fails++; console.log(`${ok ? "OK " : "MAL"} ${n}${x ? " -> " + x : ""}`); };
const HOY = "2026-10-27";
const CAMPOS = ["enabled", "frequency", "custom_weekdays", "weekly_weekday", "anchor_date", "send_local_time", "effective_from"];

const ini = formularioInicial();
t("inicial: apagado, diario y 21:00", !ini.enabled && ini.frequency === "daily" && ini.send_local_time === "21:00");
t("la hora por defecto coincide con la politica del servidor", HORA_INFORME_PREDETERMINADA === POLITICA_INFORME.horaPredeterminada);

let b = aCuerpoPut({ ...ini, enabled: true }, HOY);
t("diario: sin dias ni ancla, vigencia hoy", b.custom_weekdays.length === 0 && b.weekly_weekday === null && b.anchor_date === null && b.effective_from === HOY);
t("el cuerpo solo trae campos permitidos (nunca correo, ids ni revision)", JSON.stringify(Object.keys(b).sort()) === JSON.stringify([...CAMPOS].sort()));
b = aCuerpoPut({ ...ini, enabled: true, frequency: "every_3_days" }, HOY);
t("cada 3 dias: ancla = hoy si no tenia", b.anchor_date === HOY);
b = aCuerpoPut({ ...ini, enabled: true, frequency: "every_3_days", anchor_date: "2026-10-20", effective_from: "2026-10-20" }, HOY);
t("cada 3 dias: conserva su ancla y vigencia anteriores", b.anchor_date === "2026-10-20" && b.effective_from === "2026-10-20");
b = aCuerpoPut({ ...ini, enabled: true, frequency: "weekly", weekly_weekday: 1, custom_weekdays: [2, 3] }, HOY);
t("semanal: lleva el dia y descarta los personalizados", b.weekly_weekday === 1 && b.custom_weekdays.length === 0);
b = aCuerpoPut({ ...ini, enabled: true, frequency: "custom", custom_weekdays: [4, 1, 4], weekly_weekday: 3 }, HOY);
t("personalizado: dias sin repetir y ordenados; descarta el semanal", JSON.stringify(b.custom_weekdays) === "[1,4]" && b.weekly_weekday === null);
b = aCuerpoPut({ ...ini, enabled: false }, HOY);
t("apagar: no inventa vigencia", b.enabled === false && b.effective_from === null);

t("sin problemas si esta apagado", problemaFormulario({ ...ini, frequency: "weekly" }) === null);
t("semanal sin dia: avisa", problemaFormulario({ ...ini, enabled: true, frequency: "weekly" }) !== null);
t("personalizado sin dias: avisa", problemaFormulario({ ...ini, enabled: true, frequency: "custom" }) !== null);
t("hora invalida: avisa", problemaFormulario({ ...ini, enabled: true, send_local_time: "25:00" }) !== null && problemaFormulario({ ...ini, enabled: true, send_local_time: null }) !== null);
t("diario con hora valida: sin problema", problemaFormulario({ ...ini, enabled: true }) === null);

const r = desdeRespuesta({ enabled: true, frequency: "weekly", weekly_weekday: 5, custom_weekdays: [], send_local_time: "21:30:00", anchor_date: null, effective_from: "2026-10-27", revision: 3, profile_id: "x" });
t("respuesta: recorta la hora a HH:mm y copia solo lo conocido", r.send_local_time === "21:30" && r.weekly_weekday === 5 && r.effective_from === "2026-10-27" && !("revision" in r));
t("respuesta basura -> formulario inicial", JSON.stringify(desdeRespuesta(null)) === JSON.stringify(ini) && JSON.stringify(desdeRespuesta("x")) === JSON.stringify(ini));
t("respuesta con frecuencia desconocida -> diaria", desdeRespuesta({ frequency: "cada_hora" }).frequency === "daily");
t("respuesta sin hora -> 21:00", desdeRespuesta({ send_local_time: null }).send_local_time === "21:00");
process.exit(fails ? 1 : 0);
