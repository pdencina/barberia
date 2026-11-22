// Preguntas reales que la gente escribe -> la entrada de ayuda que debe aparecer primero. Uso: npx tsx scripts/test-oti-conocimiento.ts
import { buscarAyuda } from "../src/lib/oti/buscar";
import { CATALOGO } from "../src/lib/oti/catalogo";
import { CONOCIMIENTO } from "../src/lib/oti/conocimiento";
let fallos = 0;
const ok = (c: boolean, n: string, x = "") => { if (!c) { fallos++; console.log("FALLA:", n, x); } else console.log("OK  ", n); };

ok(CONOCIMIENTO.length >= 50, `la base tiene ${CONOCIMIENTO.length} entradas de conocimiento (más las ${CATALOGO.length - CONOCIMIENTO.length} de pantallas y guías)`);
const ids = new Set<string>(); let dup = "";
for (const e of CATALOGO) { if (ids.has(e.id)) dup = e.id; ids.add(e.id); }
ok(!dup, "todas las entradas tienen id único", dup);
ok(CONOCIMIENTO.every((e) => e.id.startsWith("k-") && e.claves.length >= 3 && e.resumen.length >= 40), "cada entrada tiene prefijo k-, al menos 3 frases y un resumen");
ok(CONOCIMIENTO.every((e) => !e.ruta || e.ruta.startsWith("/dashboard")), "las rutas apuntan a pantallas del panel");

// pregunta -> id esperado (cualquiera de la lista vale)
const casos: [string, string[]][] = [
  ["¿cómo puedo cambiar el link de reserva?", ["k-cambiar-link"]],
  ["quiero otro link mas corto para mi negocio", ["k-cambiar-link"]],
  ["donde esta mi link para ponerlo en instagram", ["k-compartir-link"]],
  ["como subo mi logo", ["k-logo-banner"]],
  ["mis clientes no pueden reservar", ["k-clientes-no-reservan"]],
  ["dice que no hay profesionales disponibles", ["k-no-hay-profesionales", "k-clientes-no-reservan"]],
  ["no aparecen horas disponibles para reservar", ["k-no-aparecen-horas", "k-clientes-no-reservan"]],
  ["quiero que mis clientes reserven solo hasta 14 dias adelante", ["k-dias-anticipacion"]],
  ["aparecen horas despues de mi hora de cierre", ["k-horario-negocio-vs-profesional"]],
  ["como agrego la hora de almuerzo", ["k-colacion"]],
  ["no trabajo los lunes", ["k-dias-libres"]],
  ["necesito bloquear una tarde", ["k-bloqueo-puntual", "t-vacaciones-bloqueos"]],
  ["mi servicio no aparece en la reserva", ["k-servicio-no-aparece"]],
  ["cada barbero cobra distinto", ["k-precio-por-profesional", "t-servicios-por-profesional"]],
  ["como subo los precios", ["k-subir-precios"]],
  ["quiero agregar un barbero nuevo", ["k-agregar-profesional", "t-importar-clientes"].slice(0, 1)],
  ["no me deja agregar mas profesionales", ["k-limite-profesionales"]],
  ["un barbero ya no trabaja conmigo", ["k-desactivar-reactivar"]],
  ["quiero aparecer como profesional en mi agenda", ["k-yo-atiendo"]],
  ["como configuro la comision de un barbero", ["k-comision-arriendo", "t-comision-arriendo"]],
  ["olvide mi pin", ["k-pin-personal"]],
  ["como les mando recordatorios a mis clientes", ["k-recordatorios-cliente"]],
  ["mi cliente quiere cambiar su hora", ["k-cliente-cambia-hora", "t-cancelar-mover-cita"]],
  ["mi cliente no recibe el correo de confirmacion", ["k-cliente-no-recibe-correo"]],
  ["quiero cobrar un abono al reservar", ["k-activar-abono"]],
  ["mis clientes no pueden pagar el abono", ["k-abono-no-funciona"]],
  ["como devuelvo un abono", ["k-devolver-abono"]],
  ["la maquina de tarjeta no responde", ["k-maquina-tarjeta"]],
  ["tutorial del punto de venta", ["k-cobrar-cliente"]],
  ["como le hago un descuento a un cliente", ["k-descuento-cupon"]],
  ["como cierro la caja", ["k-abrir-cerrar-caja"]],
  ["saque plata de la caja para comprar algo", ["k-retiro-caja"]],
  ["pague la luz del local, como lo anoto", ["k-registrar-gasto"]],
  ["necesito un informe de fin de mes", ["k-informe-fin-de-mes"]],
  ["como saco un excel con mis ventas", ["k-excel", "k-informe-fin-de-mes"]],
  ["quiero recibir un resumen por correo", ["k-informe-correo"]],
  ["donde veo lo que gano cada profesional", ["k-ganancias-profesional"]],
  ["donde veo mis propinas", ["k-propinas"]],
  ["como emito una boleta", ["k-boleta", "boletas"]],
  ["quiero pasar mis clientes de un excel", ["k-importar-clientes", "t-importar-clientes"]],
  ["como edito los datos de un cliente", ["k-ficha-cliente"]],
  ["quiero recuperar a los clientes que no han vuelto", ["k-recuperar-clientes"]],
  ["como creo un cupon", ["k-crear-cupon"]],
  ["quiero tener mas resenas", ["k-resenas-google"]],
  ["de donde vienen mis clientes", ["k-mas-clientes-nuevos"]],
  ["cuando tengo menos clientes", ["k-horas-flojas", "t-mas-clientes"]],
  ["olvide mi contraseña", ["k-cambiar-clave", "t-iniciar-sesion"]],
  ["quiero poner la app en negro", ["k-modo-oscuro"]],
  ["como cancelo mi suscripcion", ["k-cambiar-plan"]],
  ["donde descargo la app para iphone", ["k-instalar-app"]],
  ["no me llegan las notificaciones", ["k-notificaciones"]],
  ["quiero borrar mi cuenta", ["k-eliminar-cuenta"]],
  ["tengo dos locales, como los separo", ["k-nueva-sucursal"]],
  ["se me acabo un producto, como lo pido", ["k-inventario-insumos"]],
  ["como pido mis vacaciones", ["k-vacaciones-solicitud"]],
  ["como apruebo las vacaciones de mi equipo", ["k-vacaciones-admin"]],
  ["quiero hablar con una persona de soporte", ["k-reportar-problema"]],
  ["que sabes hacer", ["k-que-puede-oti"]],
  ["acabo de registrarme, como empiezo", ["k-tutorial-inicial"]],
  ["que pasa con los datos de mis clientes", ["k-privacidad-datos"]],
  ["cliente que no vino y habia pagado abono", ["k-cita-no-asistio-cobro"]],
  ["se pisan dos citas a la misma hora", ["k-cita-doble"]],
  ["no veo mis citas en el calendario", ["k-agenda-vacia"]],
];
let bien = 0;
for (const [q, esperados] of casos) {
  const top = buscarAyuda(q)[0]?.entrada.id ?? null;
  const acierta = !!top && esperados.includes(top);
  if (acierta) bien++;
  ok(acierta, `«${q}» -> ${esperados[0]}`, `(salió ${top})`);
}
ok(bien / casos.length >= 0.9, `acierta ${bien} de ${casos.length} preguntas (${Math.round((bien / casos.length) * 100)}%)`);
process.exit(fallos ? 1 : 0);
