// Pruebas de Oti (buscador de ayuda y pedido de bloqueo). Ejecutar: npx tsx scripts/test-oti.ts
import { buscarAyuda } from "../src/lib/oti/buscar";
import { CATALOGO } from "../src/lib/oti/catalogo";
import { entenderBloqueo, etiquetaFecha, MAX_DIAS_BLOQUEO, type MiembroEquipo } from "../src/lib/oti/bloqueo";

let fails = 0;
const t = (n: string, ok: boolean, x = "") => { if (!ok) fails++; console.log(`${ok ? "OK " : "MAL"} ${n}${x ? " -> " + x : ""}`); };
const HOY = "2026-10-27"; // martes
const equipo: MiembroEquipo[] = [
  { id: "n1", name: "Nicolás Levels" }, { id: "j1", name: "Javier García" }, { id: "j2", name: "Javiera Soto" }, { id: "b1", name: "Bastian ahumada" },
];
const pide = (s: string, yo: string | null = null) => entenderBloqueo(s, HOY, equipo, yo);
const ok = (r: any) => (r && r.ok ? `${r.profesional.id} ${r.desde}..${r.hasta} (${r.dias})` : r ? `falta:${r.falta}` : "null");

// ---------- ayuda ----------
const top = (q: string) => buscarAyuda(q)[0]?.entrada.id ?? null;
t("«como agrego mercadopago» -> MercadoPago", top("¿Cómo agrego MercadoPago?") === "mercadopago");
t("«quiero conectar la maquina de tarjeta» -> MercadoPago", top("quiero conectar la maquina de tarjeta") === "mercadopago");
t("«como bloqueo un dia» -> bloquear", top("¿cómo bloqueo un día completo?") === "bloquear");
t("«vacaciones de nicolas» -> vacaciones", top("vacaciones de nicolas") === "vacaciones");
t("«generar codigo de invitacion» -> equipo", top("necesito generar un código de invitación") === "equipo");
t("«cambiar el precio de un servicio» -> servicios", top("cambiar el precio de un servicio") === "servicios");
t("«pagar comisiones» -> comisiones", top("pagar comisiones") === "comisiones");
t("«marcar el arriendo como pagado» -> arriendo", top("quiero pagar el arriendo") === "arriendo");
// variaciones de conjugacion y plural (lo que de verdad escribe la gente)
t("«¿Cómo cambio el precio de un servicio?» (la sugerencia del panel) -> servicios", top("¿Cómo cambio el precio de un servicio?") === "servicios");
t("«como agrego un profesional» -> equipo", top("como agrego un profesional") === "equipo");
t("«como creo un cupon» -> cupones", top("como creo un cupon") === "cupones");
t("«como bloqueo un dia» -> bloquear", top("como bloqueo un dia") === "bloquear");
t("«como invito a un profesional» -> equipo", top("como invito a un profesional") === "equipo");
t("«donde veo mis comisiones» -> comisiones", top("donde veo mis comisiones") === "comisiones");
t("«como configuro mercadopago» -> mercadopago", top("como configuro mercadopago") === "mercadopago");
t("«como envio una boleta» -> boletas", top("como envio una boleta") === "boletas");
t("«cambiar el plan» -> plan", top("quiero cambiar mi plan") === "plan");
t("las tres sugerencias del panel encuentran respuesta o son un pedido de bloqueo", ["¿Cómo agrego MercadoPago?", "¿Cómo cambio el precio de un servicio?"].every((q) => buscarAyuda(q).length > 0));
t("«como cobro con debito» -> punto de venta", top("como cobro con debito") === "pos");
t("«como cierro el mes» -> cierre mensual (y no es un bloqueo)", top("como cierro el mes") === "cierre-mensual" && pide("como cierro el mes") === null);
t("«quiero ver mis ventas» -> ingresos y egresos", top("quiero ver mis ventas") === "finanzas");
t("«como cancelo una cita» -> calendario", top("como cancelo una cita") === "calendario");
t("pregunta sin relacion -> sin respuesta (Oti dice «no lo se»)", buscarAyuda("cual es la capital de francia").length === 0 && buscarAyuda("receta de empanadas").length === 0);
t("texto vacio o una letra -> sin respuesta", buscarAyuda("").length === 0 && buscarAyuda("a").length === 0);
t("sin tildes ni mayusculas da lo mismo", top("COMO AGREGO MERCADO PAGO") === top("como agrego mercado pago"));
t("todas las rutas del catalogo apuntan al panel", CATALOGO.every((e) => !e.ruta || e.ruta.startsWith("/dashboard/")));
t("ids del catalogo sin repetir", new Set(CATALOGO.map((e) => e.id)).size === CATALOGO.length);

// ---------- bloqueo ----------
t("«cierra mañana a Nicolás»", ok(pide("cierra mañana a Nicolás")) === "n1 2026-10-28..2026-10-28 (1)", ok(pide("cierra mañana a Nicolás")));
t("«cierrame el día de hoy a nicolas levels»", ok(pide("cierrame el día de hoy a nicolas levels")) === "n1 2026-10-27..2026-10-27 (1)");
t("«bloquea el 30 de octubre a Bastian»", ok(pide("bloquea el 30 de octubre a Bastian")) === "b1 2026-10-30..2026-10-30 (1)");
t("«cierra el 5/11 a Nicolás»", ok(pide("cierra el 5/11 a Nicolás")) === "n1 2026-11-05..2026-11-05 (1)");
t("«cierra el viernes a Nicolás» -> proximo viernes", ok(pide("cierra el viernes a Nicolás")) === "n1 2026-10-30..2026-10-30 (1)");
t("«cierra el martes a Nicolás» (hoy es martes) -> el proximo", ok(pide("cierra el martes a Nicolás")) === "n1 2026-11-03..2026-11-03 (1)");
t("«cierra pasado mañana a Nicolás»", ok(pide("cierra pasado mañana a Nicolás")) === "n1 2026-10-29..2026-10-29 (1)");
t("«cierra del 28 al 30 de octubre a Nicolás»", ok(pide("cierra del 28 al 30 de octubre a Nicolás")) === "n1 2026-10-28..2026-10-30 (3)");
t("«cierra desde mañana hasta el 2 de noviembre a Nicolás»", ok(pide("cierra desde mañana hasta el 2 de noviembre a Nicolás")) === "n1 2026-10-28..2026-11-02 (6)");
t("«cierra por 3 días a Nicolás» (desde hoy)", ok(pide("cierra por 3 días a Nicolás")) === "n1 2026-10-27..2026-10-29 (3)");
t("«cierra mañana mi agenda» con yo", ok(pide("cierra mañana mi agenda", "j1")) === "j1 2026-10-28..2026-10-28 (1)");
t("«cierra mañana mi agenda» sin yo -> falta profesional", ok(pide("cierra mañana mi agenda")) === "falta:profesional");
t("«cierra mañana» sin nombre -> falta profesional", ok(pide("cierra mañana")) === "falta:profesional");
t("negocio con un solo profesional: no hace falta nombrarlo", ok(entenderBloqueo("cierra mañana", HOY, [equipo[0]])) === "n1 2026-10-28..2026-10-28 (1)");
t("«cierra mañana a Javier» (hay Javier y Javiera) -> el exacto no es ambiguo con Javiera", ok(pide("cierra mañana a Javier")) === "j1 2026-10-28..2026-10-28 (1)");
t("«cierra mañana a Javier García» -> exacto", ok(pide("cierra mañana a Javier García")) === "j1 2026-10-28..2026-10-28 (1)");
t("dos con el mismo nombre -> ambiguo", ok(entenderBloqueo("cierra mañana a Javier", HOY, [{ id: "a", name: "Javier García" }, { id: "b", name: "Javier Pérez" }])) === "falta:ambiguo");
t("«cierra a Nicolás de aquí en adelante» -> pregunta hasta cuando", ok(pide("cierra a Nicolás de aquí en adelante")) === "falta:hasta");
t("«cierra el día a Nicolás» sin fecha -> falta fecha", ok(pide("cierra el día a Nicolás")) === "falta:fecha");
t("fecha pasada -> avisa", ok(pide("cierra el 10 de octubre a Nicolás")) !== "null" && (pide("cierra el 10/10/2026 a Nicolás") as any).falta === "pasado");
t("fin antes del inicio -> rango invalido", (pide("cierra del 30 al 28 de octubre a Nicolás") as any)?.falta === "rango");
t(`mas de ${MAX_DIAS_BLOQUEO} dias -> se pide acortar`, (pide("cierra desde mañana hasta el 28 de febrero a Nicolás") as any)?.falta === "largo");
t("fecha inexistente (31 de abril) no se inventa", ok(pide("cierra el 31 de abril a Nicolás")) !== "n1 2027-05-01..2027-05-01 (1)");
t("año cruzado: «cierra el 5 de enero a Nicolás» -> enero del proximo año", ok(pide("cierra el 5 de enero a Nicolás")) === "n1 2027-01-05..2027-01-05 (1)");
// no son pedidos de bloqueo
t("«cómo cierro la caja» no es un bloqueo", pide("¿cómo cierro la caja?") === null);
t("«cierre mensual» no es un bloqueo", pide("quiero hacer el cierre mensual") === null);
t("«cómo bloqueo un día» (pregunta) va a la ayuda", pide("¿cómo bloqueo un día?") === null);
t("texto sin verbo no es un bloqueo", pide("mañana a Nicolás") === null);
t("etiqueta de fecha legible", etiquetaFecha("2026-10-28") === "miércoles 28 de octubre");
process.exit(fails ? 1 : 0);
