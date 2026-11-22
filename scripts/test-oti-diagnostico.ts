// Diagnostico de «mis clientes no pueden reservar». Uso: npx tsx scripts/test-oti-diagnostico.ts
import { diagnosticar, resumenDiagnostico, PIDE_DIAGNOSTICO, type InstantaneaNegocio } from "../src/lib/oti/diagnostico";
import { norm } from "../src/lib/oti/texto";
let fallos = 0;
const ok = (c: boolean, n: string) => { if (!c) { fallos++; console.log("FALLA:", n); } else console.log("OK  ", n); };

const sano = (): InstantaneaNegocio => ({
  hoy: "2026-11-23",
  tenant: { status: "active", trial_ends_at: null, slug: "mi-barberia", booking_window_days: 31 },
  ajustes: { booking_enabled: true, deposit_enabled: false, mpConfigurado: false },
  profesionales: [{ id: "p1", name: "Rody", role: "admin", active: true, also_attends_clients: true }],
  horarios: [{ barber_id: "p1", day_of_week: 2, is_working: true }],
  horarioNegocio: [{ day_of_week: 2, is_closed: false }],
  servicios: [{ id: "s1", name: "Corte", active: true, internal_only: false }],
  asignaciones: [], vacaciones: [],
});
const titulos = (i: InstantaneaNegocio) => diagnosticar(i).map((h) => h.titulo).join(" | ");

ok(diagnosticar(sano()).length === 0, "un negocio sano no tiene hallazgos");
ok(/Todo se ve bien|todo se ve bien/.test(resumenDiagnostico([])), "sin hallazgos Oti dice que todo se ve bien y qué hacer si igual falla");

let i = sano(); i.profesionales[0].also_attends_clients = false;
ok(/Nadie figura atendiendo/.test(titulos(i)), "dueño que no atiende y sin equipo: «nadie atiende clientes» (el caso de Vicente)");
i = sano(); i.profesionales = [];
ok(/Nadie figura atendiendo/.test(titulos(i)), "sin profesionales: lo mismo");
i = sano(); i.servicios = [];
ok(/No tienes servicios activos/.test(titulos(i)), "sin servicios activos (los 4 que nunca entraron)");
i = sano(); i.servicios = [{ id: "s1", name: "Extra", active: true, internal_only: true }];
ok(/No tienes servicios activos/.test(titulos(i)), "un servicio interno no cuenta para reservar");
i = sano(); i.tenant.status = "suspended";
ok(/suspendida/.test(titulos(i)), "cuenta suspendida");
i = sano(); i.tenant = { ...i.tenant, status: "trial", trial_ends_at: "2026-11-01T00:00:00Z" };
ok(/período de prueba terminó/.test(titulos(i)), "prueba vencida");
i = sano(); i.ajustes.booking_enabled = false;
ok(/reserva online está apagada/.test(titulos(i)), "reserva apagada");
i = sano(); i.ajustes = { booking_enabled: true, deposit_enabled: true, mpConfigurado: false };
ok(/Mercado Pago no está conectado/.test(titulos(i)), "abono activado sin Mercado Pago (clientes llegan al pago y no pueden pagar)");
i = sano(); i.ajustes = { booking_enabled: true, deposit_enabled: true, mpConfigurado: true };
ok(diagnosticar(i).length === 0, "abono activado con Mercado Pago conectado: bien");
i = sano(); i.horarios = [{ barber_id: "p1", day_of_week: 2, is_working: false }, { barber_id: "p1", day_of_week: 3, is_working: false }];
ok(/no tiene ningún día de trabajo/.test(titulos(i)), "profesional con todos los días libres");
i = sano(); i.horarios = []; i.horarioNegocio = [{ day_of_week: 0, is_closed: true }, { day_of_week: 1, is_closed: true }];
ok(/cerrado todos los días/.test(titulos(i)), "sin horario propio y horario del negocio cerrado todos los días");
i = sano(); i.horarios = []; i.horarioNegocio = [{ day_of_week: 1, is_closed: false }];
ok(diagnosticar(i).length === 0, "sin horario propio pero con el del negocio abierto: bien");
i = sano(); i.asignaciones = [{ barber_id: "p1", service_id: "inexistente" }];
ok(/no tiene servicios disponibles/.test(titulos(i)), "servicios asignados que no están activos");
i = sano(); i.vacaciones = [{ barber_id: "p1", start_date: "2026-11-20", end_date: "2026-12-05" }];
ok(/vacaciones esta semana/.test(titulos(i)), "todo el equipo de vacaciones esta semana (aviso)");
i = sano(); i.tenant.booking_window_days = 1;
ok(/1 día de anticipación/.test(titulos(i)), "solo se puede reservar con 1 día (aviso)");
const r = resumenDiagnostico(diagnosticar({ ...sano(), servicios: [], tenant: { ...sano().tenant, booking_window_days: 1 } }));
ok(/Encontré 1 problema/.test(r) && /1 cosa para revisar/.test(r) && /1\. /.test(r), "el resumen separa problemas y avisos, numerados");

const dice = (f: string) => PIDE_DIAGNOSTICO.test(norm(f));
for (const f of ["mis clientes no pueden reservar", "Mis clientes no pueden reservar una hora", "no me deja agendar", "no deja agendar", "tengo problemas para reservar", "dice que no hay profesionales disponibles", "no hay horas disponibles", "no aparecen horarios", "no me aparecen los servicios", "por qué no me reservan", "mi link no funciona", "mi link de reserva no abre", "revisa mi negocio", "mis clientes no logran reservar", "no se puede reservar", "los clientes no pueden agendar"]) ok(dice(f), `pide diagnóstico: «${f}»`);
for (const f of ["¿cómo cambio el link de reserva?", "cuánto vendimos ayer", "cómo agrego un profesional", "cierra mañana mi agenda", "quiero agendar una cita", "cómo reservo una hora para un cliente"]) ok(!dice(f), `NO es diagnóstico: «${f}»`);
process.exit(fallos ? 1 : 0);
