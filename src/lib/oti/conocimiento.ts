// Base de conocimiento de Oti: preguntas frecuentes, tutoriales y solucion de problemas de TODO re-booking.
// Cada entrada describe algo que EXISTE en el sistema (pantalla, boton o regla real); Oti no inventa: si algo no esta aqui ni en el catalogo, dice que no lo sabe
// y ofrece avisar a soporte. `claves` son frases que la gente escribe de verdad (se comparan sin tildes ni mayusculas).
// Para agregar una: id unico con prefijo «k-», 3 a 8 frases en `claves`, un resumen corto y, si es un procedimiento, `pasos`.
import type { EntradaOti } from "./catalogo";

export const CONOCIMIENTO: EntradaOti[] = [
  // ======================= RESERVA ONLINE: LINK Y PRESENTACION =======================
  {
    id: "k-cambiar-link", titulo: "Cambiar el link de reserva", para: "Administrador",
    claves: ["cambiar el link de reserva", "cambiar mi link", "cambiar el nombre de mi link", "personalizar mi link", "quiero otro link", "link mas corto", "editar el link de reservas", "cambiar la direccion de mi pagina de reservas", "mi link tiene numeros", "link personalizado", "que mi link diga el nombre de mi barberia", "link con el nombre de mi negocio", "que mi link tenga mi nombre"],
    resumen: "El link de tu negocio (re-booking.cl/tu-nombre) se cambia en Configuración. El sistema te avisa en vivo si el nombre está disponible y el link anterior sigue funcionando, así que no pierdes los que ya repartiste.",
    pasos: ["Entra a Configuración > «Link de Reserva Online».", "Toca «Cambiar» y escribe el nombre que quieres.", "Espera el aviso verde «disponible» (si no lo está, te sugiere alternativas).", "Toca «Guardar link» y confirma."],
    ruta: "/dashboard/configuracion",
  },
  {
    id: "k-link-profesional", titulo: "Link de reserva de cada profesional", para: "Administrador y profesionales",
    claves: ["link de un profesional", "link para cada profesional", "link personal de reserva", "que mis clientes reserven con un profesional en especial", "link directo a un profesional", "compartir el link de un barbero", "link de reserva de mi perfil"],
    resumen: "Cada profesional tiene su propio link (re-booking.cl/tu-negocio/su-nombre) que lleva directo a reservar con esa persona. Lo encuentra en Mi Perfil, y el administrador también puede cambiarle el nombre al link desde su ficha en Equipo.",
    ruta: "/dashboard/mi-perfil",
  },
  {
    id: "k-compartir-link", titulo: "Compartir mi link de reserva (Instagram, WhatsApp, QR)", para: "Administrador",
    claves: ["donde esta mi link de reserva", "compartir mi link", "poner mi link en instagram", "link para mi biografia", "enviar mi link por whatsapp", "copiar mi link", "como mando mi agenda a mis clientes", "qr para mis clientes", "link para ponerlo en instagram", "donde esta mi link para instagram", "ponerlo en instagram"],
    resumen: "Tu link está arriba en Configuración, en «Link de Reserva Online», con el botón «Copiar». Pégalo en la biografía de Instagram, en el estado de WhatsApp o en tus mensajes. Cada profesional tiene además su propio link en Mi Perfil.",
    ruta: "/dashboard/configuracion",
  },
  {
    id: "k-logo-banner", titulo: "Poner el logo, la foto y la descripción en mi página de reservas", para: "Administrador",
    claves: ["poner mi logo", "cambiar el logo", "subir el logo del negocio", "foto de portada de mi pagina", "banner de mi pagina de reservas", "descripcion de mi negocio", "como se ve mi pagina de reservas", "mejorar mi pagina de reservas", "agregar google maps a mi pagina", "boton como llegar", "subir mi logo", "como subo mi logo", "agregar mi logo", "subir la foto de portada"],
    resumen: "El logo y los datos básicos (teléfono, dirección, página web) están en Configuración > «Datos del Negocio». La imagen de portada, el texto de presentación y el link de Google Maps («Cómo llegar») se cargan en «Preferencias de reservas».",
    pasos: ["Logo y datos: Configuración > Datos del Negocio.", "Imagen, presentación y Google Maps: Configuración > Preferencias de reservas.", "Abre tu link de reserva para ver cómo quedó."],
    ruta: "/dashboard/configuracion/reservas",
  },
  {
    id: "k-dias-anticipacion", titulo: "Cuántos días hacia adelante pueden reservar mis clientes", para: "Administrador",
    claves: ["dias para agendar", "con cuantos dias de anticipacion pueden reservar", "limitar hasta cuando se puede reservar", "no quiero que reserven tan lejos", "ampliar los dias para reservar", "mis clientes solo pueden reservar", "dias de anticipacion", "reserven solo hasta", "hasta cuantos dias pueden reservar", "dias adelante", "que no reserven con tanta anticipacion", "limitar los dias de reserva"],
    resumen: "En «Preferencias de reservas» defines hasta cuántos días hacia adelante se puede agendar (por ejemplo 7, 14, 21 o 31). Si lo dejas muy corto, tus clientes verán pocos días disponibles.",
    ruta: "/dashboard/configuracion/reservas",
  },
  {
    id: "k-vista-reserva", titulo: "Cómo empieza a reservar el cliente (por profesional o por hora)", para: "Administrador",
    claves: ["elegir primero el profesional", "que el cliente elija la hora primero", "tipo de visualizacion", "cambiar como reservan mis clientes", "primer profesional disponible", "reservar sin elegir profesional", "orden de la reserva online"],
    resumen: "En «Preferencias de reservas» eliges cómo empieza el cliente: eligiendo primero a un profesional, o eligiendo primero el servicio y la hora (el sistema asigna al primer profesional disponible). Ahí también están las reglas del «primer profesional disponible».",
    ruta: "/dashboard/configuracion/reservas",
  },

  // ======================= HORARIOS =======================
  {
    id: "k-horario-negocio-vs-profesional", titulo: "Horario del negocio y horario de cada profesional: ¿cuál manda?", para: "Administrador",
    claves: ["horario del negocio y del profesional", "cual horario manda", "aparecen horas que no programe", "horas disponibles que no configure", "aparecen horarios despues de mi hora de cierre", "mi horario de cierre no se respeta", "diferencia entre horario del negocio y horario del profesional", "por que hay horas abiertas despues de cerrar", "horas despues de mi hora de cierre", "aparecen horas despues del cierre", "horas despues del cierre", "se ofrecen horas fuera de mi horario"],
    resumen: "Hay dos lugares: el «Horario del Negocio» (Configuración) y el horario de cada profesional (Equipo > su perfil > Horario). Si tu negocio es de una sola persona, manda el del negocio. Si tienes varios profesionales, cada uno usa su propio horario: lo que dejes abierto en el horario de un profesional es lo que ven los clientes.",
    pasos: ["Revisa el horario del profesional en Equipo > su perfil > Horario (las horas de término de cada día).", "Revisa el del negocio en Configuración > Horario del Negocio.", "Si ves horas de más, corrige la hora de término en el horario del profesional."],
    ruta: "/dashboard/barberos",
  },
  {
    id: "k-colacion", titulo: "Agregar la colación o un descanso al horario", para: "Administrador y profesionales",
    claves: ["agregar colacion", "hora de almuerzo", "poner un descanso en mi horario", "bloquear mi hora de almuerzo todos los dias", "break de mi horario", "descanso diario", "que no reserven a la hora de almuerzo", "agrego la hora de almuerzo", "agregar la hora de almuerzo", "como agrego la colacion", "poner la hora de almuerzo"],
    resumen: "Las colaciones se agregan en el horario de cada profesional: en cada día de trabajo puedes sumar uno o más descansos con su hora de inicio y término. Esas horas dejan de ofrecerse en la reserva.",
    pasos: ["Entra a Equipo > el profesional > pestaña «Horario».", "En el día que quieras, toca para agregar un break y pon desde y hasta qué hora.", "Guarda el horario."],
    ruta: "/dashboard/barberos",
  },
  {
    id: "k-dias-libres", titulo: "Dejar un día libre fijo (por ejemplo el lunes)", para: "Administrador y profesionales",
    claves: ["no trabajo los lunes", "dejar un dia libre", "cerrar los domingos", "dia libre fijo de la semana", "no quiero atender un dia de la semana", "desactivar un dia de la semana"],
    resumen: "En el horario del profesional (Equipo > su perfil > Horario) apaga el interruptor de ese día de la semana y guarda. Desde ahí ese día no se ofrece en la reserva. Si es de una sola vez, usa mejor un bloqueo desde el Calendario.",
    ruta: "/dashboard/barberos",
  },
  {
    id: "k-bloqueo-puntual", titulo: "Bloquear una hora o un día puntual", para: "Todo el equipo",
    claves: ["bloquear una hora", "reunion no puedo atender", "salir antes un dia", "cerrar solo una tarde", "bloquear una tarde", "tengo un trámite un dia", "cierra mañana mi agenda", "no voy a estar el viernes"],
    resumen: "Desde el Calendario (o Mi Agenda) toca un horario libre de la columna del profesional y elige «Bloquear». También puedes pedírmelo: escríbeme, por ejemplo, «cierra mañana mi agenda» o «cierra del 28 al 30 de octubre a Javier».",
    ruta: "/dashboard/calendario",
  },

  // ======================= SERVICIOS Y PRECIOS =======================
  {
    id: "k-servicio-no-aparece", titulo: "Un servicio no aparece en la reserva", para: "Administrador",
    claves: ["mi servicio no aparece", "no aparece el servicio en la reserva", "el cliente no ve el servicio", "servicio oculto", "falta un servicio en mi pagina", "por que no sale mi servicio", "no tengo servicios cargados", "no hay servicios en mi pagina", "sin servicios"],
    resumen: "Revisa tres cosas en Servicios: que el servicio esté activo, que no sea «interno» (los internos solo se cobran en el Punto de Venta) y que el profesional lo ofrezca (Precios por profesional: si un profesional tiene servicios asignados, solo ofrece esos).",
    ruta: "/dashboard/servicios",
  },
  {
    id: "k-precio-por-profesional", titulo: "Un precio o tiempo distinto para cada profesional", para: "Administrador",
    claves: ["precio distinto por profesional", "cada barbero cobra distinto", "tiempo distinto para cada profesional", "un servicio mas caro con un profesional", "precio propio de un profesional", "que un profesional haga solo algunos servicios"],
    resumen: "En «Precios por profesional» eliges qué servicios ofrece cada persona y, si quieres, le pones un precio o un tiempo propio. Otra forma es crear una categoría con los servicios de esa persona en Servicios.",
    ruta: "/dashboard/barberos/precios",
  },
  {
    id: "k-servicio-extra", titulo: "Cobrar un extra sin que se pueda reservar (servicio interno)", para: "Administrador",
    claves: ["cobrar un extra", "servicio que solo cobro en caja", "servicio interno", "agregar un adicional al cobro", "que no aparezca en la reserva pero si en el punto de venta"],
    resumen: "Al crear o editar un servicio puedes marcarlo como «interno»: no aparece en la reserva online, pero lo puedes cobrar en el Punto de Venta. Sirve para extras (por ejemplo un diseño o una mascarilla).",
    ruta: "/dashboard/servicios",
  },
  {
    id: "k-subir-precios", titulo: "Subir los precios", para: "Administrador",
    claves: ["subir los precios", "subir el precio de todos los servicios", "reajustar precios", "cambiar precios", "actualizar mis precios"],
    resumen: "Cambia el precio de cada servicio en Servicios con «Editar». Las ventas ya hechas no cambian: el nuevo precio vale para las reservas y cobros nuevos. Si un profesional tiene precio propio, cámbialo también en «Precios por profesional».",
    ruta: "/dashboard/servicios",
  },

  // ======================= EQUIPO =======================
  {
    id: "k-agregar-profesional", titulo: "Agregar un profesional al equipo", para: "Administrador",
    claves: ["agregar un profesional", "sumar un barbero", "nuevo profesional", "invitar a un profesional", "agregar a alguien a mi equipo", "como creo la cuenta de un barbero", "dar acceso a un profesional", "registrar un barbero nuevo"],
    resumen: "En Equipo toca «Nuevo Miembro del Equipo», escribe su nombre, correo y contraseña y se crea su cuenta; le llega un correo con sus datos. Luego completa su horario, sus servicios y cómo gana (comisión o arriendo). Cada plan tiene un máximo de profesionales.",
    pasos: ["Equipo > «Nuevo Miembro del Equipo».", "Pon nombre, correo y contraseña inicial.", "Abre su ficha y completa Horario y Servicios."],
    ruta: "/dashboard/barberos",
  },
  {
    id: "k-limite-profesionales", titulo: "No puedo agregar más profesionales", para: "Administrador",
    claves: ["no puedo agregar mas profesionales", "alcanzaste la cantidad maxima de profesionales", "limite de profesionales", "maximo de profesionales de mi plan", "mejorar mi plan para agregar", "no me deja agregar un barbero"],
    resumen: "Cada plan incluye una cantidad de profesionales (y si tú, como administrador, atiendes clientes, también cuentas). Cuando llegas al máximo, hay que mejorar el plan en «Plan y facturación». Si alguien ya no trabaja, puedes desactivarlo en Equipo para liberar su lugar.",
    ruta: "/dashboard/configuracion/facturacion",
  },
  {
    id: "k-desactivar-reactivar", titulo: "Desactivar o volver a activar a un profesional", para: "Administrador",
    claves: ["desactivar a un profesional", "un barbero ya no trabaja", "reactivar a un profesional", "volver a activar a un barbero", "dar de baja a un profesional", "profesionales desactivados", "eliminar a un profesional", "se fue del salon", "ya no trabaja en mi negocio", "renuncio un barbero", "un barbero se fue"],
    resumen: "En Equipo, «Desactivar» saca al profesional de la agenda y de la reserva sin borrar su historial. Abajo, en «Profesionales desactivados», lo reactivas cuando quieras (si tu plan tiene un lugar libre). «Eliminar definitivamente» solo existe para quien no tiene citas, ventas ni comisiones. La cuenta del administrador no se puede desactivar ni eliminar.",
    ruta: "/dashboard/barberos",
  },
  {
    id: "k-yo-atiendo", titulo: "Atender clientes yo mismo como dueño", para: "Administrador",
    claves: ["quiero atender clientes yo tambien", "aparecer como profesional", "no aparezco en la reserva", "soy el dueño y atiendo", "que mis clientes reserven conmigo", "atiende clientes", "no hay profesionales disponibles soy yo", "activarme como profesional"],
    resumen: "Si tú también atiendes, tu perfil debe tener activada la opción «atiende clientes»: así apareces en la agenda y la reserva online. En un negocio de una sola persona viene activada desde el inicio. Para revisarlo, entra a Equipo y abre tu perfil. Ojo: si atiendes, ocupas uno de los lugares de profesionales de tu plan.",
    ruta: "/dashboard/barberos",
  },
  {
    id: "k-comision-arriendo", titulo: "Cómo le pago a cada profesional (comisión o arriendo)", para: "Administrador",
    claves: ["configurar la comision de un barbero", "cambiar la comision", "pagar por arriendo de silla", "arriendo diario", "como gana cada profesional", "porcentaje de comision", "cambiar de comision a arriendo", "modalidad de trabajo"],
    resumen: "En la ficha de cada profesional (Equipo > su perfil > «Modalidad de trabajo») eliges si trabaja a comisión (un % de lo que cobra) o en arriendo (paga un monto fijo por día trabajado) y pones los valores. No aplica si eres un negocio de una sola persona: ahí todo lo que vendes es tuyo.",
    ruta: "/dashboard/barberos",
  },
  {
    id: "k-pin-personal", titulo: "PIN personal y modo Standby", para: "Todo el equipo",
    claves: ["cambiar mi pin", "pin personal", "olvide mi pin", "entrar a standby", "codigo personal de cobro", "como cobra un profesional con su pin", "pin de administrador", "pin de recepcion"],
    resumen: "El PIN personal (4 dígitos) se configura en la ficha del profesional (Equipo > su perfil > Datos personales). Con él se entra a «Standby», el modo de cobro del profesional. El PIN de recepción/administrador se usa para encender la caja y confirmar cambios sensibles.",
    ruta: "/dashboard/standby",
  },

  // ======================= CITAS Y AGENDA =======================
  {
    id: "k-recordatorios-cliente", titulo: "Recordatorios y confirmaciones a mis clientes", para: "Administrador",
    claves: ["recordarle a mis clientes su cita", "mensaje de recordatorio", "recordatorio automatico", "que mis clientes confirmen su asistencia", "reducir los no shows", "clientes que no llegan", "enviar recordatorios", "confirmar citas"],
    resumen: "Al reservar, el cliente recibe un correo de confirmación con un link para cambiar o cancelar su hora. En «Recordatorios» ves y gestionas los avisos de las próximas citas, y con el botón de WhatsApp del Calendario le escribes con un mensaje listo (el texto lo editas en Mi negocio > Mensajes de WhatsApp).",
    ruta: "/dashboard/recordatorios",
  },
  {
    id: "k-cliente-cambia-hora", titulo: "El cliente quiere cambiar o cancelar su hora", para: "Administrador y recepción",
    claves: ["el cliente quiere cambiar su hora", "mi cliente quiere cancelar", "como cambia su cita un cliente", "cliente reagenda por su cuenta", "plazo para cambiar la cita", "el cliente no puede cambiar su hora", "link para cambiar la cita"],
    resumen: "El cliente puede cambiar o cancelar desde el link de su correo de confirmación, dentro del plazo que tú defines (Configuración > plazo de cambios). Si ya pasó el plazo (lo ajustas en Configuración, en la tarjeta de plazo para cambios), o si prefieres hacerlo tú, abre la cita en el Calendario y cámbiala o cancélala desde ahí.",
    ruta: "/dashboard/calendario",
  },
  {
    id: "k-agenda-vacia", titulo: "Mi agenda se ve vacía o no aparece una cita", para: "Todo el equipo",
    claves: ["mi agenda esta vacia", "no veo mis citas", "no aparece una cita", "desaparecio una cita", "la cita no sale en el calendario", "agenda sin citas", "no veo a mis clientes agendados"],
    resumen: "Revisa que estés mirando el día y el profesional correctos (en el Calendario cada profesional tiene su columna, y los filtros pueden ocultar a otros). Las citas canceladas no se muestran en la agenda. Si sigue sin aparecer, avísame con el nombre del cliente y el día y abro un caso a soporte.",
    ruta: "/dashboard/calendario",
  },
  {
    id: "k-cita-doble", titulo: "Dos citas a la misma hora", para: "Administrador y recepción",
    claves: ["dos clientes a la misma hora", "cita duplicada", "se pisan las citas", "dos citas al mismo tiempo", "se reservaron la misma hora", "doble reserva"],
    resumen: "La reserva online no deja agendar encima de otra cita del mismo profesional. Si ves dos citas a la misma hora, suele ser una que se creó o se movió a mano en el Calendario, o una de otra fecha. Abre una de las dos y muévela o cancélala. Si te pasa con una reserva por link, avísame con los nombres y la hora para revisarlo.",
    ruta: "/dashboard/calendario",
  },
  {
    id: "k-cliente-no-recibe-correo", titulo: "Mi cliente no recibe el correo de confirmación", para: "Administrador",
    claves: ["no llega el correo de confirmacion", "mi cliente no recibe correos", "el correo llega a spam", "correo de confirmacion no llega", "no me llegan los correos", "el cliente no recibio nada", "no le llego el mail", "no le llego el correo", "no le llego la confirmacion"],
    resumen: "Casi siempre es porque el correo cayó en «Spam» o porque se escribió mal. Pídele que revise Spam y Promociones y confirma su correo en su ficha de Clientes. Cada plan incluye una cantidad de correos al mes (se ve en Configuración > Cupo de mensajería); si se agotó, no se envían más hasta el mes siguiente.",
    ruta: "/dashboard/configuracion",
  },
  {
    id: "k-cita-no-asistio-cobro", titulo: "Cliente que no llegó y había pagado abono", para: "Administrador",
    claves: ["cliente que no llego con abono", "perdio el abono", "devolver el abono de un cliente que no llego", "que hago con el abono si no vino", "no show con abono", "no vino y habia pagado abono", "cliente que no vino con abono", "no vino y pago el abono"],
    resumen: "En «Abonos» ves cada abono recibido. Si el cliente no llegó, puedes dejarlo como ingreso del negocio o devolverlo con el botón «Devolver», según tu política. Marcar la cita como «No asistió» queda en las estadísticas del cliente.",
    ruta: "/dashboard/abonos",
  },

  // ======================= ABONOS Y PAGOS =======================
  {
    id: "k-activar-abono", titulo: "Cobrar un abono al reservar", para: "Administrador",
    claves: ["activar el abono", "cobrar abono al reservar", "pedir un adelanto", "cobrar anticipo", "que paguen para reservar", "configurar el abono", "monto del abono", "porcentaje de abono", "abono fijo", "cobrar senal", "que me paguen antes de ir", "que paguen antes de venir", "cobrar antes de la cita", "que mis clientes me paguen antes"],
    resumen: "Se activa en Configuración > «Abono para Reservas»: eliges un monto fijo o un porcentaje, y conectas tu cuenta de Mercado Pago (Terminal POS), para que los pagos lleguen directo a ti. Ahí mismo defines las horas de cancelación: si el cliente cancela antes se le devuelve el abono y después lo pierde. El cliente tiene unos minutos para pagar al reservar; si no paga, el horario se libera solo. El abono se descuenta del total al cobrar la cita.",
    ruta: "/dashboard/configuracion",
  },
  {
    id: "k-abono-no-funciona", titulo: "Mis clientes no pueden pagar el abono", para: "Administrador",
    claves: ["no pueden pagar el abono", "el abono no funciona", "problema con el abono", "no puedo cobrar el abono", "mercado pago no funciona en mi reserva", "el pago del abono falla", "el cliente pago y no se agendo", "abono rechazado", "clientes no logran pagar", "pago y no le salio la hora", "pago el abono y no aparece su hora", "pago y no se agendo", "pago pero no tiene hora"],
    resumen: "Hay dos causas comunes. Si Mercado Pago no está conectado, el cliente llega al pago y no puede completarlo: te lo detecto con «mis clientes no pueden reservar». Y si el banco o Mercado Pago rechaza la tarjeta (saldo, seguridad, varios intentos seguidos), te llega un aviso con el nombre del cliente y el motivo, y el cliente puede escribirte por WhatsApp para que lo agendes tú en el Calendario.",
    ruta: "/dashboard/abonos",
  },
  {
    id: "k-devolver-abono", titulo: "Devolver un abono", para: "Administrador y recepción",
    claves: ["devolver un abono", "reembolsar un abono", "cliente quiere que le devuelva el abono", "abono por devolver", "devolver el dinero del abono"],
    resumen: "En «Abonos» busca el pago y usa «Devolver»; también puedes cancelar la cita si corresponde. Los abonos marcados «por devolver» son los que se pagaron pero el horario ya estaba ocupado: hay que devolverlos al cliente.",
    ruta: "/dashboard/abonos",
  },
  {
    id: "k-maquina-tarjeta", titulo: "Cobrar con tarjeta en el local (máquina)", para: "Administrador",
    claves: ["configurar la maquina de tarjeta", "conectar la maquina de pagos", "cobrar con tarjeta en el local", "la maquina no responde", "terminal de pagos", "mercado pago point", "tuu", "no me deja cobrar con tarjeta", "la maquina de tarjeta no responde", "maquina de tarjeta no funciona", "la maquina no anda", "la maquina no cobra"],
    resumen: "La máquina se configura en «Terminal POS»: agregas tu terminal (Mercado Pago Point o TUU) con su identificador y eliges cuál usa el Punto de Venta para cobrar con tarjeta. En el Punto de Venta eliges débito o crédito y el cobro se manda a la máquina.",
    ruta: "/dashboard/terminal-pos",
  },

  // ======================= VENTAS, CAJA Y DINERO =======================
  {
    id: "k-cobrar-cliente", titulo: "Cobrar a un cliente paso a paso", para: "Recepción y profesionales",
    claves: ["como cobrar a un cliente", "hacer una venta paso a paso", "como uso el punto de venta", "cobrar un corte", "cobrar servicios y productos", "tutorial del punto de venta", "como registro una venta"],
    resumen: "En el Punto de Venta eliges al profesional, agregas los servicios o productos, ves el total y eliges cómo paga. La venta queda registrada apenas se paga; la propina es un extra opcional que se anota después. Si el cliente venía con abono, se descuenta solo.",
    pasos: ["Abre «Punto de Venta» (o Standby si eres profesional).", "Elige profesional y cliente (opcional), y toca los servicios o productos.", "Aplica descuento o cupón si corresponde.", "Elige el método de pago (efectivo, débito, crédito, transferencia o dividido) y cobra."],
    ruta: "/dashboard/pos",
  },
  {
    id: "k-descuento-cupon", titulo: "Aplicar un descuento o un cupón al cobrar", para: "Recepción y administrador",
    claves: ["aplicar un descuento", "hacer un descuento a un cliente", "usar un cupon al cobrar", "canjear un cupon", "descuento manual", "cupon de descuento", "dar un descuento"],
    resumen: "En el Punto de Venta, antes de cobrar, ingresa el código del cupón en «Cupón». Un descuento manual pide el PIN del administrador para autorizarlo. Los cupones se crean en «Cupones» (monto o porcentaje, con fechas y límites).",
    ruta: "/dashboard/pos",
  },
  {
    id: "k-puntos-fidelidad", titulo: "Puntos y premios de fidelidad", para: "Administrador",
    claves: ["programa de puntos", "los clientes acumulan puntos", "canjear puntos", "premios para clientes frecuentes", "como funcionan los puntos", "fidelizar clientes", "configurar los puntos", "regalo para clientes fieles", "regalar algo a mis clientes", "premio a mis clientes fieles", "dar un regalo a mis clientes"],
    resumen: "En «Programa de Fidelidad» defines cuánto debe gastar un cliente para ganar 1 punto y qué recompensas puede canjear. Los puntos se suman solos en las ventas nuevas y se canjean en el Punto de Venta.",
    ruta: "/dashboard/fidelidad",
  },
  {
    id: "k-abrir-cerrar-caja", titulo: "Abrir y cerrar la caja del día", para: "Administrador y recepción",
    claves: ["abrir la caja", "cerrar la caja", "como cierro el dia", "arqueo de caja", "contar el efectivo", "cerrar el turno", "caja diaria", "encender la caja"],
    resumen: "En «Caja» abres con el PIN de recepción y el monto inicial en efectivo. Durante el día ves ingresos, egresos y lo «Esperado en Caja». Al final, «Cerrar Caja»: cuentas el efectivo, ingresas el monto y el sistema te muestra si cuadra o la diferencia.",
    ruta: "/dashboard/caja",
  },
  {
    id: "k-retiro-caja", titulo: "Sacar plata de la caja o registrar un gasto en efectivo", para: "Administrador y recepción",
    claves: ["sacar plata de la caja", "retiro de efectivo", "pagar algo con plata de la caja", "gasto en efectivo", "registrar un movimiento manual", "compre algo con la plata de la caja", "ajuste de caja"],
    resumen: "En «Caja» usa «Registrar movimiento manual» para anotar un gasto en efectivo, y los retiros y ajustes para que el efectivo esperado siga cuadrando. Así la caja refleja lo que realmente hay.",
    ruta: "/dashboard/caja",
  },
  {
    id: "k-registrar-gasto", titulo: "Registrar un gasto del negocio", para: "Administrador",
    claves: ["registrar un gasto", "anotar un egreso", "pague la luz", "gasto del negocio", "pago de arriendo del local", "anotar una compra", "gasto de insumos", "agregar un egreso"],
    resumen: "En «Ingresos/Egresos» toca «Nueva transacción» y elige gasto: monto, descripción, método de pago y el mes al que corresponde. También puedes decirme, por ejemplo, «compré insumos por $30.000 para la barbería» y lo anoto como gasto del negocio.",
    ruta: "/dashboard/finanzas",
  },
  {
    id: "k-informe-fin-de-mes", titulo: "Informe de fin de mes", para: "Administrador",
    claves: ["informe de fin de mes", "informe mensual", "reporte del mes", "cuanto gane este mes", "resultado del mes", "cierre del mes", "utilidad del mes", "resumen mensual", "informe de ventas del mes", "como saco un informe"],
    resumen: "El «Cierre mensual» es tu informe de fin de mes: ingresos, egresos y utilidad, ventas por profesional y por método de pago, servicios y productos más vendidos, clientes nuevos y la comparación con los últimos 6 meses. Cambias de mes con las flechas. Para tener el detalle en Excel, usa «Ingresos/Egresos» > «Exportar a Excel».",
    ruta: "/dashboard/reportes",
  },
  {
    id: "k-informe-correo", titulo: "Recibir un informe por correo", para: "Administrador",
    claves: ["recibir un informe por correo", "informe semanal", "informe diario", "que me llegue un resumen por correo", "resumen de la agenda por correo", "activar el informe", "dejar de recibir el informe", "resumen por correo", "recibir un resumen por correo", "informe por correo", "que me llegue el informe"],
    resumen: "En Mi Perfil > «Informes» activas el resumen de tus citas por correo, una vez por semana, y eliges el día y la hora. Desde ahí también lo apagas.",
    ruta: "/dashboard/mi-perfil",
  },
  {
    id: "k-excel", titulo: "Descargar mis ventas en Excel", para: "Administrador",
    claves: ["descargar en excel", "exportar a excel", "bajar mis ventas", "sacar un excel de las ventas", "planilla con mis ingresos", "descargar los movimientos", "saco un excel", "sacar un excel con mis ventas", "excel de mis ventas", "bajar un excel"],
    resumen: "En «Ingresos/Egresos» elige el período y los filtros que quieras y toca «Exportar a Excel»: baja exactamente lo que ves en pantalla.",
    ruta: "/dashboard/finanzas",
  },
  {
    id: "k-ganancias-profesional", titulo: "Cuánto ganó cada profesional", para: "Administrador",
    claves: ["cuanto gano cada profesional", "ver lo que gano cada barbero", "pagar a mis profesionales", "liquidacion de un profesional", "comisiones del mes de cada barbero", "ventas por profesional"],
    resumen: "En el «Cierre mensual» ves los ingresos por profesional del mes. En «Comisiones» ves lo generado por cada uno, y cada profesional ve su detalle y sus propinas en «Mi Billetera». También puedes preguntarme, por ejemplo, «cuánto vendió Pablo este mes».",
    ruta: "/dashboard/reportes",
  },
  {
    id: "k-propinas", titulo: "Dónde ven las propinas los profesionales", para: "Profesionales",
    claves: ["ver mis propinas", "donde estan las propinas", "propinas del mes", "cuanto me dejaron de propina", "propina que no aparece"],
    resumen: "En «Mi Billetera» cada profesional ve la tarjeta «Propinas» del mes y de hoy, y en el detalle de movimientos cada venta con su propina. Las propinas van 100% para quien atendió y no se descuentan comisión. Se anotan al cobrar, en el aviso que aparece en la esquina del Punto de Venta.",
    ruta: "/dashboard/mi-billetera",
  },
  {
    id: "k-boleta", titulo: "Boletas y facturas", para: "Administrador",
    claves: ["emitir una boleta", "boleta electronica", "enviar una boleta al cliente", "facturar", "subir una factura", "boleta del sii", "necesito dar boleta"],
    resumen: "«Boletas» lista tus boletas y permite enviarlas por correo al cliente; la boleta electrónica del SII se configura en Configuración > «Boleta electrónica (SII)». «Facturas digitales» guarda las facturas de compra de tu negocio con «Subir Factura».",
    ruta: "/dashboard/boletas",
  },

  // ======================= CLIENTES Y MARKETING =======================
  {
    id: "k-importar-clientes", titulo: "Cargar mis clientes desde un Excel", para: "Administrador",
    claves: ["cargar mis clientes", "importar clientes desde excel", "pasar mis clientes de otro sistema", "subir mi lista de clientes", "tengo una planilla de clientes", "importar contactos", "pasar mis clientes de un excel", "pasar clientes desde excel", "subir clientes desde un excel", "clientes de un excel"],
    resumen: "En «Clientes» usa la opción de importar: subes tu planilla (Excel o CSV), el sistema revisa duplicados y te muestra un resumen antes de cargarla.",
    ruta: "/dashboard/clientes",
  },
  {
    id: "k-ficha-cliente", titulo: "Ver o editar la ficha de un cliente", para: "Recepción y administrador",
    claves: ["ver la ficha de un cliente", "historial de un cliente", "editar los datos de un cliente", "cambiar el telefono de un cliente", "notas de un cliente", "cuantas veces ha venido un cliente", "buscar un cliente"],
    resumen: "En «Clientes» busca por nombre, correo o celular y abre su ficha: ves su historial de visitas, lo que ha gastado y puedes editar sus datos (menú de tres puntos > «Modificar datos»).",
    ruta: "/dashboard/clientes",
  },
  {
    id: "k-recuperar-clientes", titulo: "Recuperar clientes que dejaron de venir", para: "Administrador",
    claves: ["recuperar clientes", "clientes que no han vuelto", "enviar un correo a clientes antiguos", "campana para clientes inactivos", "traer de vuelta a mis clientes", "mensaje a clientes que no vienen hace tiempo", "mensaje a todos mis clientes", "mandar un mensaje a todos mis clientes", "correo a todos mis clientes", "avisar a todos mis clientes"],
    resumen: "En «Retención» eliges cuántos días llevan sin venir, un cupón opcional y el mensaje; ves a quién le llegará (puedes quitar o agregar) y lo envías por correo. En «Campañas enviadas» ves lo que ya mandaste.",
    ruta: "/dashboard/retencion",
  },
  {
    id: "k-crear-cupon", titulo: "Crear un cupón de descuento", para: "Administrador",
    claves: ["crear un cupon", "como creo un cupon", "como hago un cupon", "hacer una promocion", "cupon para mis clientes", "codigo de descuento", "promocion para dias flojos", "descuento por dia", "cupon con fecha de termino"],
    resumen: "En «Cupones» creas un código con un monto o porcentaje de descuento, fechas de vigencia y límite de usos. El cliente lo menciona o lo muestras en el Punto de Venta. Para saber en qué días conviene promocionar, mira el «Mapa de demanda».",
    ruta: "/dashboard/cupones",
  },
  {
    id: "k-resenas-google", titulo: "Conseguir más reseñas", para: "Administrador",
    claves: ["conseguir mas resenas", "pedir resenas a mis clientes", "resenas de google", "mejorar mis estrellas", "que mis clientes me califiquen", "resenas destacadas", "tener mas resenas", "quiero mas resenas", "mas estrellas en google"],
    resumen: "Después de cada atención el cliente recibe un correo para calificarte. En «Reseñas» ves lo que opinan y respondes a lo que necesite atención. El link de Google Maps de tu negocio se carga en Preferencias de reservas.",
    ruta: "/dashboard/resenas",
  },
  {
    id: "k-mas-clientes-nuevos", titulo: "De dónde vienen mis clientes nuevos", para: "Administrador",
    claves: ["de donde vienen mis clientes", "origen de mis clientes", "que anuncio me trae clientes", "medir mi publicidad", "cuantos clientes vienen de instagram", "clientes nuevos por mes"],
    resumen: "«Métricas de Clientes» muestra de dónde viene cada cliente y los clientes nuevos por mes. «Origen de reservas» muestra qué canal o anuncio generó cada reserva. Con eso sabes qué publicidad realmente te trae gente.",
    ruta: "/dashboard/clientes/metricas",
  },
  {
    id: "k-horas-flojas", titulo: "Saber qué días y horas están más vacíos", para: "Administrador",
    claves: ["cuando tengo menos clientes", "dias mas flojos", "horas libres de mi agenda", "cuando promocionar", "en que horarios hay poca demanda", "agenda vacia en ciertos dias", "como lleno mi agenda"],
    resumen: "El «Mapa de demanda» muestra qué días y horas (o bloques de trabajo, si tus servicios son largos) se llenan más y menos. «Ocupación» mide cuánto se usa el tiempo de cada profesional. Con eso decides dónde ofrecer cupones o campañas. También puedes preguntarme «cuál fue el día más lento de este mes».",
    ruta: "/dashboard/demanda",
  },

  // ======================= CUENTA, PLAN Y APP =======================
  {
    id: "k-cambiar-clave", titulo: "Cambiar mi contraseña", para: "Todo el equipo",
    claves: ["cambiar mi contrasena", "cambiar mi clave", "olvide mi contrasena", "recuperar mi clave", "resetear mi contrasena", "restablecer la contrasena", "no recuerdo mi clave"],
    resumen: "Dentro de la app: Mi Perfil > seguridad. Si no puedes entrar, en la pantalla de login usa «Olvidé mi contraseña» (te llega un correo) o pide un código de 6 dígitos a tu correo para entrar sin clave.",
    ruta: "/dashboard/mi-perfil",
  },
  {
    id: "k-modo-oscuro", titulo: "Cambiar el color o el modo oscuro", para: "Todo el equipo",
    claves: ["modo oscuro", "cambiar el tema", "cambiar el color de la app", "poner la app en negro", "tema claro", "apariencia de la app"],
    resumen: "En Mi Perfil eliges la apariencia (claro u oscuro y los colores del sistema) solo para ti. El administrador además puede elegir los colores del negocio y los de la página de reservas y los correos a clientes, en Configuración.",
    ruta: "/dashboard/mi-perfil",
  },
  {
    id: "k-cambiar-plan", titulo: "Cambiar o cancelar mi plan", para: "Administrador",
    claves: ["cambiar mi plan", "subir de plan", "bajar de plan", "cancelar mi suscripcion", "dar de baja mi cuenta", "ver mi factura", "cuando me cobran", "metodo de pago de mi plan", "cuanto pago al mes", "a que plan estoy", "cuanto pago de mi plan", "cuanto tengo que pagar de mi plan", "cuanto cuesta mi plan"],
    resumen: "En «Plan y facturación» ves tu plan actual, lo que incluye, cuándo se renueva y puedes cambiarlo o cancelarlo. Los planes difieren en la cantidad de profesionales y módulos disponibles.",
    ruta: "/dashboard/configuracion/facturacion",
  },
  {
    id: "k-instalar-app", titulo: "Instalar la app en el celular", para: "Todo el equipo",
    claves: ["instalar la app", "descargar la app", "app para iphone", "app para android", "esta en la app store", "esta en google play", "usar re-booking en el celular", "poner la app en mi telefono"],
    resumen: "re-booking tiene app para iPhone (App Store) y Android (Google Play): busca «re-booking» o usa los links que vienen en tu correo de bienvenida. También funciona desde el navegador del celular. Ingresas con el mismo correo y contraseña.",
  },
  {
    id: "k-notificaciones", titulo: "Recibir avisos de nuevas citas", para: "Todo el equipo",
    claves: ["recibir notificaciones", "avisos de nuevas citas", "no me llegan las notificaciones", "activar las notificaciones", "campanita", "silenciar los avisos", "horario de silencio"],
    resumen: "La campanita muestra los avisos del negocio (nuevas citas, cambios, cancelaciones, abonos). En «Avisos» eliges de qué profesionales y qué tipo de avisos quieres recibir, y un horario de silencio. En el celular, permite las notificaciones de la app cuando te las pida.",
    ruta: "/dashboard/avisos",
  },
  {
    id: "k-eliminar-cuenta", titulo: "Eliminar mi cuenta", para: "Todo el equipo",
    claves: ["eliminar mi cuenta", "borrar mi cuenta", "darme de baja", "quiero que borren mis datos", "cerrar mi cuenta"],
    resumen: "En Mi Perfil está la opción «Eliminar mi cuenta». Si eres el administrador y quieres cerrar todo el negocio, primero cancela tu plan en «Plan y facturación» o escríbenos desde Ayuda y soporte para ayudarte.",
    ruta: "/dashboard/mi-perfil",
  },
  {
    id: "k-nueva-sucursal", titulo: "Agregar una sucursal", para: "Administrador",
    claves: ["agregar una sucursal", "tengo dos locales", "abrir otra sucursal", "nuevo local", "separar mis locales", "sucursal nueva"],
    resumen: "En «Sucursales» creas cada local con su dirección y asignas a cada profesional a una sucursal desde su ficha. Cada una tiene su link de reserva. La cantidad de sucursales depende de tu plan.",
    ruta: "/dashboard/sucursales",
  },
  {
    id: "k-inventario-insumos", titulo: "Controlar el stock y pedir insumos", para: "Administrador y recepción",
    claves: ["controlar el stock", "inventario de productos", "pedir insumos", "se acabo el producto", "agregar un producto", "registrar la entrada de productos", "pedirle a mi proveedor", "pedido de productos", "hacer un pedido de productos", "comprar productos"],
    resumen: "En «Inventario» administras tus productos y su stock (los cambios piden el PIN del administrador). En «Solicitud de insumos» indicas lo que queda y lo que hay que pedir, y se envía por correo al administrador. Los datos de tus proveedores están en Mi negocio > Proveedores.",
    ruta: "/dashboard/inventario",
  },

  // ======================= VACACIONES =======================
  {
    id: "k-vacaciones-solicitud", titulo: "Pedir vacaciones (profesionales)", para: "Profesionales",
    claves: ["pedir vacaciones", "solicitar vacaciones", "como pido mis vacaciones", "cuantos dias de vacaciones me quedan", "mis vacaciones", "tomarme vacaciones"],
    resumen: "En «Mis vacaciones» ves cuántos días laborales te quedan y pides un bloque en un calendario: siempre empieza un lunes y es un solo bloque corrido. Se descuentan solo los días en que trabajas (tus días libres no cuentan). Tu administrador la acepta o la rechaza y te avisa.",
    ruta: "/dashboard/vacaciones",
  },
  {
    id: "k-vacaciones-admin", titulo: "Aprobar vacaciones y definir cuántos días tiene el equipo", para: "Administrador",
    claves: ["aprobar vacaciones", "solicitudes de vacaciones", "cuantos dias de vacaciones le doy a mi equipo", "configurar las vacaciones", "vacaciones del equipo", "aceptar vacaciones", "dias de vacaciones por año"],
    resumen: "En Mi negocio > Vacaciones defines cuántos días laborales por año puede pedir cada profesional y si se reinician el 1 de enero o en su aniversario. Ahí mismo aceptas o rechazas solicitudes, ves los días de cada uno y puedes agregar vacaciones tú. Lo aprobado bloquea su agenda y la reserva online.",
    ruta: "/dashboard/vacaciones",
  },

  // ======================= PROBLEMAS Y SOPORTE =======================
  {
    id: "k-clientes-no-reservan", titulo: "Mis clientes no pueden reservar", para: "Administrador",
    claves: ["mis clientes no pueden reservar", "no me llegan reservas", "no entran reservas", "mi pagina de reservas no funciona", "la reserva online no funciona", "no puedo recibir reservas", "problemas para reservar", "reserva online con problemas", "no puede sacar hora", "no pueden sacar hora", "no logran sacar hora", "no logran agendar"],
    resumen: "Escríbeme «mis clientes no pueden reservar» y reviso tu negocio al tiro: si hay alguien atendiendo, servicios activos, horarios abiertos, la cuenta al día y el abono conectado. Las causas más comunes son: nadie con «atiende clientes» activado, sin servicios activos, todos los días del horario cerrados, o Mercado Pago sin conectar con el abono activado.",
    pasos: ["Escríbeme «mis clientes no pueden reservar» para que haga la revisión.", "Si me dices que todo está bien, abre tu link de reserva en una ventana privada y prueba reservar tú.", "Si algo falla, copia el mensaje que ves y envíalo en «Ayuda y soporte»."],
    ruta: "/dashboard/configuracion",
  },
  {
    id: "k-no-hay-profesionales", titulo: "La reserva dice «no hay profesionales disponibles»", para: "Administrador",
    claves: ["no hay profesionales disponibles", "dice que no hay profesionales", "no aparece ningun profesional", "mi pagina no muestra profesionales", "no puedo elegir profesional"],
    resumen: "Significa que ninguna persona figura atendiendo clientes. Si atiendes tú, abre tu perfil en Equipo y activa «atiende clientes». Si es un profesional, revisa que esté activo y que su horario tenga días de trabajo. Escribe «mis clientes no pueden reservar» y lo reviso por ti.",
    ruta: "/dashboard/barberos",
  },
  {
    id: "k-no-aparecen-horas", titulo: "No aparecen horas disponibles en la reserva", para: "Administrador",
    claves: ["no aparecen horas disponibles", "no hay horarios para reservar", "sin horarios disponibles", "dice que no hay horas", "todas las horas aparecen ocupadas", "no salen horarios", "no hay cupos"],
    resumen: "Puede ser que el día esté cerrado en el horario del negocio o del profesional, que haya vacaciones o bloqueos, que la fecha esté más lejos de lo que permiten los «días para agendar», o que el servicio dure más que el espacio libre. Escribe «mis clientes no pueden reservar» y reviso lo que puedo ver desde tu cuenta.",
    ruta: "/dashboard/configuracion",
  },
  {
    id: "k-reportar-problema", titulo: "Reportar un problema o hablar con soporte", para: "Todo el equipo",
    claves: ["hablar con soporte", "reportar un error", "algo no funciona", "tengo un problema con la app", "necesito ayuda de una persona", "contactar a re-booking", "ayuda tecnica", "falla la app", "quiero reportar un bug"],
    resumen: "En «Ayuda y soporte» abres un «Nuevo caso»: eliges el área, cuentas qué pasó y puedes adjuntar una captura. Te respondemos por WhatsApp en menos de 48 horas. Si prefieres, dime el problema aquí y te preparo el reporte.",
    ruta: "/dashboard/soporte",
  },
  {
    id: "k-que-puede-oti", titulo: "Qué puede hacer Oti", para: "Todo el equipo",
    claves: ["que puede hacer oti", "que sabes hacer", "para que sirves", "ayuda de oti", "como te uso", "que preguntas te puedo hacer", "que sabes", "en que me ayudas"],
    resumen: "Puedo explicarte dónde está cada cosa y cómo se hace (por ejemplo «cómo cambio el link de reserva»), cerrar días de la agenda («cierra mañana mi agenda»), anotar gastos personales («gasté $4.500 en almuerzo»), dejar notas («recuérdame llamar al proveedor»), y, si eres administrador, decirte cifras del negocio («cuánto vendimos ayer», «cuánto hizo Pablo este mes», «cuál fue el día más lento»), darte ideas para vender más y revisar por qué tus clientes no pueden reservar.",
  },
  {
    id: "k-tutorial-inicial", titulo: "Primeros pasos: dejar mi negocio listo para recibir reservas", para: "Administrador",
    claves: ["primeros pasos", "como empiezo", "dejar mi negocio listo", "configurar mi negocio desde cero", "que tengo que hacer primero", "tutorial para empezar", "recien me registre", "como configuro todo", "guia de inicio"],
    resumen: "Para recibir reservas necesitas cinco cosas: tus servicios, tu horario, quién atiende, tus datos y tu link. Cuando las tengas, abre tu link en una ventana privada y reserva una prueba.",
    pasos: ["Servicios: crea los que ofreces, con precio y duración.", "Horario: Configuración > Horario del Negocio (y el horario de cada profesional en Equipo).", "Equipo: revisa que el que atiende tenga «atiende clientes» activado (si eres tú) o agrega a tu equipo.", "Configuración: sube tu logo y completa los datos del negocio.", "Copia tu link de reserva y compártelo; prueba reservar tú."],
    ruta: "/dashboard/servicios",
  },
  {
    id: "k-privacidad-datos", titulo: "Privacidad y datos de mis clientes", para: "Administrador",
    claves: ["privacidad de los datos", "ley de proteccion de datos", "que pasa con los datos de mis clientes", "consentimiento de los clientes", "politica de privacidad", "los datos de mis clientes estan seguros", "terminos y condiciones"],
    resumen: "Los datos de tus clientes son de tu negocio y solo los ve tu equipo según su rol. Al reservar online, el cliente puede aceptar o no recibir promociones. Las opciones de privacidad están en Configuración > Privacidad.",
    ruta: "/dashboard/configuracion",
  },
];
