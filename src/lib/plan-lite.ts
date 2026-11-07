// Plan «Lite» (pago único de $1.000, para evitar cuentas fantasma): solo Agenda, Oti con Billetera y los horarios/breaks.
// Todo lo demás del menú aparece bloqueado. (Es un bloqueo del menú, igual que el de Basic: no reemplaza la validación de cada ruta.)
export const PLAN_LITE = "lite";
export const LITE_PRECIO_TOTAL = 1000;   // IVA incluido
export const LITE_PRECIO_NETO = 840;     // 840 + 19% = 1.000
export const LITE_PERIODO_DIAS = 3650;   // pago único: no vence ni se renueva

const PERMITIDAS = [
  "/dashboard/calendario", "/dashboard/mi-agenda", "/dashboard/mi-billetera",
  "/dashboard/barberos",        // aquí se configuran los horarios y breaks de cada profesional
  "/dashboard/configuracion",   // horario del negocio
  "/dashboard/vacaciones", "/dashboard/mi-perfil", "/dashboard/soporte", "/dashboard/avisos",
];

export const esLite = (plan: string | null | undefined) => plan === PLAN_LITE;
/** ¿Esa pantalla es parte del plan Lite? (la ruta o cualquiera de sus subpantallas) */
export const liteIncluye = (href: string): boolean => PERMITIDAS.some((p) => href === p || href.startsWith(p + "/"));
