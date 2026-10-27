// Catalogo de ayuda de Oti. SOLO contiene lo que existe en el sistema: cada entrada cita una pantalla real del menu (src/components/layout/sidebar.tsx)
// y describe lo que se ve en ella. Oti no inventa: si algo no esta aqui, responde que no lo sabe y ofrece avisar a soporte.
// Al agregar o cambiar una pantalla, actualiza su entrada. Los textos son para el dueno del negocio: simples y sin jerga.
export interface EntradaOti {
  id: string;
  titulo: string;
  claves: string[]; // frases que la persona puede escribir (se comparan sin tildes ni mayusculas)
  resumen: string;
  pasos?: string[];
  ruta?: string; // pantalla que Oti puede abrir
}

export const CATALOGO: EntradaOti[] = [
  {
    id: "mercadopago",
    titulo: "Cobrar con tarjeta (MercadoPago)",
    claves: ["mercado pago", "mercadopago", "agregar mercadopago", "conectar mercadopago", "incorporar mercadopago", "terminal de tarjeta", "maquina de tarjeta", "cobrar con tarjeta", "device id", "terminal pos", "point"],
    resumen: "La maquina de tarjeta se configura en «Terminal POS» (menu Configuracion).",
    pasos: [
      "Entra a «Terminal POS» (menu Configuracion).",
      "Usa la guia de configuracion de MercadoPago que aparece en esa pantalla.",
      "Agrega tu maquina con «Nuevo terminal»: te pedira el Device ID.",
      "En «Maquina activa para cobrar con tarjeta» deja elegido MercadoPago: asi el Punto de Venta cobra con ella.",
    ],
    ruta: "/dashboard/terminal-pos",
  },
  {
    id: "pos",
    titulo: "Punto de Venta (cobrar una venta)",
    claves: ["punto de venta", "pos", "cobrar", "cobro", "registrar una venta", "cobrar con debito", "cobrar con credito", "cobrar en efectivo", "transferencia", "vender un producto"],
    resumen: "En «Punto de Venta» registras una venta: eliges los servicios o productos, el profesional y el metodo de pago (efectivo, debito, credito o transferencia).",
    ruta: "/dashboard/pos",
  },
  {
    id: "calendario",
    titulo: "Calendario y citas",
    claves: ["calendario", "agenda", "agendar una cita", "nueva cita", "crear una cita", "ver las citas", "cancelar una cita", "mover una cita"],
    resumen: "El «Calendario» muestra la agenda de cada profesional. Al hacer clic en un horario libre se abre «Agendar / Bloquear».",
    ruta: "/dashboard/calendario",
  },
  {
    id: "finanzas",
    titulo: "Ingresos y egresos",
    claves: ["ingresos", "egresos", "gastos", "ventas del dia", "mis ventas", "cuanto vendi", "ver mis ventas", "registrar un gasto"],
    resumen: "En «Ingresos/Egresos» ves y registras lo que entra y lo que sale de tu negocio.",
    ruta: "/dashboard/finanzas",
  },
  {
    id: "cierre-mensual",
    titulo: "Cierre mensual",
    claves: ["cierre mensual", "cierre del mes", "cerrar el mes", "reporte del mes", "reportes"],
    resumen: "En «Cierre Mensual» (menu Finanzas) revisas los numeros del mes.",
    ruta: "/dashboard/reportes",
  },
  {
    id: "pagos",
    titulo: "Terminal de Pagos (proveedor y metodos de pago)",
    claves: ["metodos de pago", "proveedor de pago", "pagos habilitados", "terminal de pagos", "configurar pagos"],
    resumen: "En «Pagos» eliges el proveedor y los metodos de pago habilitados.",
    ruta: "/dashboard/pagos",
  },
  {
    id: "bloquear",
    titulo: "Bloquear horas o un dia completo",
    claves: ["bloquear", "bloqueo", "cerrar el dia", "cerrar un dia", "cerrar agenda", "no atender", "dia libre", "bloquear horas", "cerrar horario", "cerrar un horario"],
    resumen: "Se hace desde el Calendario, en la columna del profesional.",
    pasos: [
      "Abre el Calendario.",
      "Haz clic en un horario libre de la columna del profesional: se abre «Agendar / Bloquear».",
      "Elige bloquear, marca dia completo o las horas, y si quieres repetirlo elige la repeticion.",
      "Tambien puedo hacerlo yo: escribeme, por ejemplo, «cierra manana a Nicolas».",
    ],
    ruta: "/dashboard/calendario",
  },
  {
    id: "vacaciones",
    titulo: "Vacaciones de un profesional",
    claves: ["vacaciones", "vacacion", "feriado de un profesional", "ausencia"],
    resumen: "En «Vacaciones» registras los dias en que un profesional no atiende; la reserva online los respeta.",
    ruta: "/dashboard/vacaciones",
  },
  {
    id: "equipo",
    titulo: "Equipo: profesionales y codigos de invitacion",
    claves: ["equipo", "agregar profesional", "nuevo profesional", "invitar profesional", "codigo de invitacion", "profesionales", "dar de baja a un profesional"],
    resumen: "En «Equipo» administras a tus profesionales; tambien desde ahi se genera el codigo de invitacion para que se registren.",
    ruta: "/dashboard/barberos",
  },
  {
    id: "precios-profesional",
    titulo: "Precios por profesional",
    claves: ["precio por profesional", "precios por profesional", "precio distinto", "cambiar precio de un profesional", "servicios de un profesional"],
    resumen: "En «Precios por Profesional» defines precios personalizados y que servicios hace cada profesional.",
    ruta: "/dashboard/barberos/precios",
  },
  {
    id: "servicios",
    titulo: "Servicios",
    claves: ["servicios", "agregar servicio", "crear servicio", "cambiar precio de un servicio", "editar servicio", "desactivar servicio", "foto de un servicio"],
    resumen: "En «Servicios» creas, editas, ordenas y desactivas servicios, y les cambias el precio y la foto.",
    ruta: "/dashboard/servicios",
  },
  {
    id: "cupones",
    titulo: "Cupones",
    claves: ["cupon", "cupones", "descuento", "codigo de descuento"],
    resumen: "En «Cupones» creas y administras codigos de descuento.",
    ruta: "/dashboard/cupones",
  },
  {
    id: "clientes",
    titulo: "Clientes",
    claves: ["clientes", "buscar cliente", "agregar cliente", "editar cliente", "ficha de cliente"],
    resumen: "En «Clientes» ves y administras tu lista de clientes.",
    ruta: "/dashboard/clientes",
  },
  {
    id: "caja",
    titulo: "Caja",
    claves: ["caja", "abrir caja", "cerrar caja", "arqueo", "efectivo de la caja"],
    resumen: "En «Caja» manejas la caja diaria del negocio.",
    ruta: "/dashboard/caja",
  },
  {
    id: "comisiones",
    titulo: "Comisiones",
    claves: ["comision", "comisiones", "porcentaje de comision", "pagar comisiones"],
    resumen: "En «Comisiones» ves lo que corresponde a cada profesional y marcas lo pagado.",
    ruta: "/dashboard/comisiones",
  },
  {
    id: "arriendo",
    titulo: "Arriendo",
    claves: ["arriendo", "arriendo de sillon", "pagar arriendo"],
    resumen: "En «Arriendo» registras el arriendo de cada profesional y lo marcas como pagado.",
    ruta: "/dashboard/arriendo",
  },
  {
    id: "boletas",
    titulo: "Boletas",
    claves: ["boleta", "boletas", "enviar boleta", "boleta por correo"],
    resumen: "En «Boletas» ves tus boletas y puedes enviarlas por correo.",
    ruta: "/dashboard/boletas",
  },
  {
    id: "inventario",
    titulo: "Inventario",
    claves: ["inventario", "productos", "stock", "editar producto", "agregar producto"],
    resumen: "En «Inventario» administras productos y su stock.",
    ruta: "/dashboard/inventario",
  },
  {
    id: "reservas",
    titulo: "Preferencias de reservas",
    claves: ["reserva online", "reservas online", "link de reservas", "preferencias de reservas", "dias para agendar", "dias de anticipacion", "primer profesional disponible"],
    resumen: "En «Preferencias de reservas» (menu Configuracion) ajustas como funciona tu reserva online.",
    ruta: "/dashboard/configuracion/reservas",
  },
  {
    id: "plan",
    titulo: "Plan y facturacion",
    claves: ["plan", "mi plan", "facturacion", "cambiar de plan", "suscripcion", "pago del plan"],
    resumen: "En «Plan y facturacion» ves y administras tu plan.",
    ruta: "/dashboard/configuracion/facturacion",
  },
  {
    id: "lista-espera",
    titulo: "Lista de espera",
    claves: ["lista de espera", "avisar a un cliente que se libero una hora", "waitlist"],
    resumen: "En «Lista de Espera» ves a quienes esperan una hora y puedes avisarles.",
    ruta: "/dashboard/waitlist",
  },
  {
    id: "fidelidad",
    titulo: "Programa de fidelidad",
    claves: ["fidelidad", "puntos", "programa de fidelidad", "recompensas"],
    resumen: "En «Programa de Fidelidad» configuras los puntos y recompensas de tus clientes.",
    ruta: "/dashboard/fidelidad",
  },
  {
    id: "recordatorios",
    titulo: "Recordatorios",
    claves: ["recordatorio", "recordatorios", "avisar a mis clientes de su cita"],
    resumen: "En «Recordatorios» gestionas los recordatorios de citas a tus clientes.",
    ruta: "/dashboard/recordatorios",
  },
  {
    id: "mi-perfil",
    titulo: "Mi Perfil",
    claves: ["mi perfil", "cambiar mi foto", "cambiar mi contrasena", "cambiar mi clave", "apariencia", "modo oscuro", "eliminar mi cuenta"],
    resumen: "En «Mi Perfil» cambias tus datos, la apariencia y la seguridad de tu cuenta.",
    ruta: "/dashboard/mi-perfil",
  },
  {
    id: "soporte",
    titulo: "Ayuda y soporte",
    claves: ["soporte", "ayuda", "reportar un problema", "hablar con soporte", "tengo un problema"],
    resumen: "En «Ayuda y soporte» puedes enviar un reporte al equipo de re-booking.",
    ruta: "/dashboard/soporte",
  },
];
