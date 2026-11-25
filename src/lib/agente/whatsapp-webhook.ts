import { responderFaq, normalizar, type DatosFaq } from "./faq-fija";
const INTENCION_AGENDAR = /\b(agendar|agendame|agendarme|reservar|reservame|reserva|agenda|confirmo|quiero)\b/;
import { conLlamadaAReservar } from "./cta";
import { esTextoMenu, listaDeMenu, textoDerivacionTelefono, pideHumano, pideCambio, textoCambio, textoNoTexto, esCierreConversacion, TEXTO_CIERRE, esAfirmativoSuelto, TEXTO_AFIRMATIVO_SUELTO, esTextoCurso, listaDeCurso, textoCurso, textoDeBoton, pideInfoCursoGeneral, TITULO_CURSO_SEGUIR } from "./menu";
import { DEL_CURSO } from "./cta";
import { enlacesPedidos } from "./archivos";
import { opcionMenu, esSaludo, esSoloSaludo, esVolver, esConsultaLarga, textoMenu, infoGeneral, CONSULTA_POR_OPCION, RESPUESTA_OTRAS } from "./menu";
import { manejarReservaChat, VIGENCIA_MIN, type EstadoChat, type CampoIndicador, type ResultadoCreacion, type ListaReserva } from "./reserva-chat";
import { responderDisponibilidad, ahoraChile, type DependenciasDisponibilidad } from "./disponibilidad";
import { manejarAdmin, pideHorario, conAvisos, type OperacionesAdmin } from "./admin";
import { manejarConsultaAdmin, TEXTO_AL_CLIENTE, TEXTO_IMAGEN_CLIENTE, type OperacionesConsulta } from "./consultas";
import { respuestaManicure, textoManicure, esTextoManicure, esRespuestaManicure, listaDeManicure, TITULO_MANICURE_SEGUIR } from "./manicure";
import { fetchAllRows } from "../accounting";
import { seleccionarRecordatorioUnico, recordatoriosCandidatos, patronTelefonoCanonico, type Cliente, type Registro } from "./referencia-alternativa";
import { createHmac } from "node:crypto";
import { verificarFirmaWebhook } from "./webhook-firma";
import { crearClaveEventoEntrante } from "./clave-deduplicacion";
import { evaluarLimiteDeUso, type EventoUso } from "./limite-de-uso";
import { clasificarRespuestaCliente } from "./respuesta-cliente";
import { extraerMensajesEntrantes, resolverDesafioWebhook, hashContactoWhatsApp, normalizarTelefonoWhatsApp } from "./whatsapp-meta";
import { confirmarCitaPropia, cancelarCitaPropia, crearRepositorioAccionesCita, type ResultadoAccionCita } from "./acciones-cita";

export interface NegocioWebhook { tenantId: string; phoneNumberId: string; enabled: boolean }
export interface RepositorioWebhook {
  negocio: (phoneId: string) => Promise<NegocioWebhook | null>;
  admitir: (evento: { key: string; tenantId: string; contactHash: string; messageHash: string; ahora: number }) => Promise<{ repetido: boolean; historial: EventoUso[]; consecutivos: number }>;
  terminar: (tenantId: string, key: string, estado: "procesado" | "limitado" | "fallido") => Promise<void>;
  baja: (tenantId: string, contactHash: string) => Promise<boolean>;
  guardarBaja: (tenantId: string, contactHash: string) => Promise<void>;
  reclamarAviso: (tenantId: string, contactHash: string, eventKey: string, ahora: number) => Promise<boolean>;
  referenciaAlternativa: (tenantId: string, contactHash: string, ahora: number) => Promise<{registroId:string;clienteId:string}|null>;
  referencia: (tenantId: string, providerId: string, contactHash: string) => Promise<{ registroId: string; clienteId: string } | null>;
}
export interface DependenciasWebhook {
  repo: RepositorioWebhook;
  ahora: () => number;
  datosDelNegocio?: (tenantId: string) => Promise<DatosFaq | null>;
  // Horas libres de un profesional (misma regla que la reserva web). Sin esto no se atiende la consulta de disponibilidad.
  horasLibres?: DependenciasDisponibilidad["horasLibres"];
  negocioInactivo?: (tenantId: string) => Promise<boolean>;
  /** Número administrador: desde ahí el dueño pide reportes y deja avisos (ver admin.ts). Sin esto, nadie es administrador. */
  admin?: {
    esAdmin: (tenantId: string, telefono: string) => Promise<boolean>;
    operaciones: (tenantId: string) => OperacionesAdmin;
    /** Textos de los avisos vigentes que se muestran a los clientes que preguntan por horarios u horas. */
    avisosVigentes: (tenantId: string, hoy: string) => Promise<string[]>;
  };
  /** Consultas difíciles (consultas.ts): el agente se las pasa al dueño por WhatsApp y guarda lo que él responda. Sin esto se deriva al teléfono como antes. */
  consultas?: {
    operaciones: (n: NegocioWebhook) => OperacionesConsulta;
    /** true = quedó registrada y el dueño fue avisado. false = no se pudo (sin migración, sin ventana de 24 h...): se deriva como antes. */
    abrir: (n: NegocioWebhook, contactHash: string, telefono: string, pregunta: string, medio?: { tipo: "image" | "document"; id: string }) => Promise<boolean>;
  };
  // Modo Avanzado (IA): última etapa, solo si todo lo anterior no pudo responder. null = lo ve una persona.
  ia?: (tenantId: string, texto: string, datos: DatosFaq | null, contactHash?: string) => Promise<string | null>;
  // true: las respuestas informativas (reglas e IA) terminan con "¿Quieres agendar? Reserva aquí: <link>". Apagado si no se indica.
  conCta?: boolean;
  // true: si nada entiende el mensaje (o solo saluda) se muestra el menú de opciones en vez de "Te contactará una persona.".
  conMenu?: boolean;
  // true: cuando debe intervenir una persona, se le da al cliente el teléfono real del negocio (piloto con número aparte para el agente).
  derivarAlTelefono?: boolean;
  // Reserva por chat: memoria mínima del contacto (30 min), creación de la cita e indicadores. Sin esto no se agenda por chat.
  chat?: {
    leerEstado: (tenantId: string, contactHash: string, ahora: number) => Promise<EstadoChat | null>;
    guardarEstado: (tenantId: string, contactHash: string, estado: EstadoChat, expiraMs: number) => Promise<void>;
    borrarEstado: (tenantId: string, contactHash: string) => Promise<void>;
    reservasFuturas: (tenantId: string, telefono: string, ahora: number) => Promise<number>;
    detalleFuturas?: (tenantId: string, telefono: string, ahora: number) => Promise<Array<{ profesional: string; fecha: string; hora: string }>>;
    /** Cambio de cita en curso (botón «Modificar mi cita»): datos ya conocidos del cliente, y cierre cancelando la cita anterior. */
    precargado?: (tenantId: string, contactHash: string, ahora: number) => Promise<{ cliente: string; correo: string; servicioId: string } | null>;
    alReprogramar?: (tenantId: string, contactHash: string, citaNuevaId: string, ahora: number) => Promise<void>;
    crearReserva: (tenantId: string, a: { profesionalId: string; fecha: string; hora: string; servicioId: string; nombre: string; correo: string; telefono: string }) => Promise<ResultadoCreacion>;
    contar: (tenantId: string, campo: CampoIndicador, ahora: number) => Promise<void>;
  };
  /** Botón «Modificar mi cita»: valida el plazo (más de 3 h), anota qué cita se reemplaza y devuelve qué decirle al cliente. */
  modificarCita?: (c: { tenantId: string; clienteId: string; referenciaRecordatorio: string; contactHash: string }) => Promise<{ texto: string }>;
  accion: (tipo: "confirmar" | "cancelar", c: { tenantId: string; clienteId: string; referenciaRecordatorio: string }) => Promise<ResultadoAccionCita>;
  responder: (negocio: NegocioWebhook, para: string, texto: string) => Promise<unknown>;
  // Archivos (malla del curso, folletos): se envían después del texto cuando el cliente los pide. Opcional.
  // Menú como lista de WhatsApp (botón). Si falla o no existe, se envía el menú numerado de siempre.
  responderLista?: (negocio: NegocioWebhook, para: string, lista: ReturnType<typeof listaDeMenu>) => Promise<unknown>;
  archivos?: { pedidos: (consulta: string, linkReserva: string | null | undefined) => unknown[]; enviar: (negocio: NegocioWebhook, para: string, archivo: any) => Promise<unknown> };
  avisarAdministrador: (tenantId: string) => Promise<unknown>;
}
/** ¿Vale la pena preguntarle al dueño? Una pregunta de verdad (con "?" y 3 palabras o más) o un mensaje largo; nunca un saludo ni texto suelto. */
const esConsultable = (t: string) => !esSaludo(t) && (esConsultaLarga(t) || (/\?/.test(t) && t.trim().split(/\s+/).length >= 3));
export class MigracionWebhookPendiente extends Error { constructor() { super("Falta aplicar la migración del webhook"); } }
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
const hour = 60 * 60 * 1000;
const conTiempoMaximo = <T,>(promesa: Promise<T>, ms: number) => new Promise<T>((resolve, reject) => {
  const t = setTimeout(() => reject(new Error("tiempo agotado")), ms);
  promesa.then((v) => { clearTimeout(t); resolve(v); }, (e) => { clearTimeout(t); reject(e); });
});

export function crearManejadoresWebhook(config: {
  secretoFirma?: string; tokenVerificacion?: string; salHashes?: string;
  crearDependencias: () => DependenciasWebhook;
}) {
  return {
    async GET(req: Request) {
      const desafio = resolverDesafioWebhook(new URL(req.url).searchParams, config.tokenVerificacion);
      return desafio === null ? json({ autorizado: 0 },403) : new Response(desafio, { headers: { "Content-Type": "text/plain", "Cache-Control": "no-store" } });
    },
    async POST(req: Request) {
      const totals = { procesados: 0, repetidos: 0, limitados: 0, omitidos: 0, acciones: 0, fallidos: 0, migracion_pendiente: 0 };
      if (!config.secretoFirma?.trim() || !config.salHashes?.trim()) return json(totals,503);
      const raw = await req.text();
      if (!verificarFirmaWebhook(req.headers.get("x-hub-signature-256"), raw, config.secretoFirma)) return json(totals,401);
      let payload: unknown;
      try { payload = JSON.parse(raw); } catch { totals.omitidos++; return json(totals); }
      try {
        const deps = config.crearDependencias(), businesses = new Map<string,NegocioWebhook>();
        // Descubrir metadatos con el extractor, sin aceptar aún ningún tenant.
        const ids = new Set<string>();
        extraerMensajesEntrantes(payload,{sal:config.salHashes,resolverTenant:id=>{ids.add(id);return null;}});
        for (const id of Array.from(ids)) {
          const n = await deps.repo.negocio(id);
          if (n && n.phoneNumberId === id && n.enabled && n.tenantId !== "ALL") businesses.set(id,n);
        }
        const messages = extraerMensajesEntrantes(payload,{sal:config.salHashes,resolverTenant:id=>businesses.get(id)?.tenantId ?? null});
        for (const entry of messages) {
          const n = businesses.get(entry.persistible.phone_number_id)!;
          let key: string | null = null;
          try {
            const p = entry.persistible, textoRecibido = entry.memoria.leerTexto(), para = entry.memoria.leerRemitente();
            // Botones y listas llegan como su id: se traducen al texto que el flujo ya entiende.
            const textoBoton = textoDeBoton(p.tipo, textoRecibido), esBoton = textoBoton !== null, text = textoBoton ?? textoRecibido;
            if (!para) { totals.omitidos++; continue; }
            const eventKey = crearClaveEventoEntrante({tenantId:n.tenantId,referenciaProveedor:p.id});
            // No se guarda texto: HMAC evita diccionarios de frases frecuentes sobre el hash.
            // Un texto que excede la memoria del extractor no trae contenido: se agrupa bajo un marcador fijo para que el límite de repetidos lo alcance.
            const messageHash = createHmac("sha256",config.salHashes).update(JSON.stringify([n.tenantId,p.tipo,textoRecibido ?? (p.tipo === "text" ? "texto-fuera-de-memoria" : p.id)])).digest("hex");
            const ahora = deps.ahora();
            const admitted = await deps.repo.admitir({key:eventKey,tenantId:n.tenantId,contactHash:p.remitenteHash,messageHash,ahora});
            if (admitted.repetido) { totals.repetidos++; continue; }
            key = eventKey;
            const limit = evaluarLimiteDeUso({tenantId:n.tenantId,contactHash:p.remitenteHash,messageHash,ahoraMs:ahora,historial:admitted.historial,
              reglas:{contacto:{max:20,ventanaMs:hour},negocio:{max:Number.MAX_SAFE_INTEGER,ventanaMs:hour},bucle:{max:Number.MAX_SAFE_INTEGER,ventanaMs:hour}}});
            // El helper cuenta repeticiones en ventana; el RPC aporta las dos inmediatamente anteriores.
            if (!limit.permitido || admitted.consecutivos >= 2) { await deps.repo.terminar(n.tenantId,key,"limitado"); totals.limitados++; continue; }
            if (await deps.repo.baja(n.tenantId,p.remitenteHash)) { await deps.repo.terminar(n.tenantId,key,"procesado"); totals.omitidos++; continue; }
            const current = await deps.repo.negocio(n.phoneNumberId);
            if (!current?.enabled || current.tenantId !== n.tenantId) { await deps.repo.terminar(n.tenantId,key,"procesado"); totals.omitidos++; continue; }
            const tipo = clasificarRespuestaCliente(text);
            // Negocio inactivo o suspendido: no se responde ni se avisa. Solo se conserva una baja pedida por el cliente.
            if (deps.negocioInactivo && await deps.negocioInactivo(n.tenantId)) {
              if (tipo === "no_quiero_mensajes") await deps.repo.guardarBaja(n.tenantId,p.remitenteHash);
              await deps.repo.terminar(n.tenantId,key,"procesado"); totals.omitidos++; continue;
            }
            const habilitado = async (acuseBaja: boolean) => {
              if (!acuseBaja && await deps.repo.baja(n.tenantId,p.remitenteHash)) return false;
              const vigente = await deps.repo.negocio(n.phoneNumberId);
              return !!vigente?.enabled && vigente.tenantId === n.tenantId && vigente.phoneNumberId === n.phoneNumberId;
            };
            const responder = async (body: string, acuseBaja = false) => {
              if (!(await habilitado(acuseBaja))) return;
              if (deps.responderLista && (esTextoMenu(body) || esTextoCurso(body) || esTextoManicure(body))) {
                try { const r: any = await deps.responderLista(n,para,esTextoCurso(body) ? listaDeCurso() : esTextoManicure(body) ? listaDeManicure() : listaDeMenu(body)); if (r && r.estado === "aceptado") return; } catch { /* se envía el menú de texto */ }
              }
              await deps.responder(n,para,body);
            };
            // Número administrador (solo el registrado): sus comandos claros (ayuda, reporte, aviso:, avisos, borrar, guardar) los atiende manejarAdmin; lo demás se responde como a cualquier cliente.
            if (deps.admin && typeof text === "string" && (p.tipo === "text" || esBoton)) {
              let esAdmin = false;
              try { esAdmin = await deps.admin.esAdmin(n.tenantId,para); } catch { /* sin tabla o falla: se atiende como cliente */ }
              if (esAdmin) {
                let respuestaAdmin: string | null = null;
                // Primero las consultas difíciles ("3: dile que sí...", o citando el aviso); si no es una, los comandos de siempre.
                if (deps.consultas) { try { respuestaAdmin = await manejarConsultaAdmin(text,p.context_id,deps.consultas.operaciones(n)); } catch { respuestaAdmin = null; } }
                if (respuestaAdmin === null) {
                try { respuestaAdmin = await manejarAdmin(text,deps.admin.operaciones(n.tenantId),deps.ahora()); }
                catch { respuestaAdmin = null; /* sin tabla o falla: se atiende como cliente */ }
                }
                // null = no es un comando de administrador: el mensaje sigue el camino normal de cualquier cliente.
                if (respuestaAdmin !== null) { await responder(respuestaAdmin); await deps.repo.terminar(n.tenantId,key,"procesado"); totals.procesados++; continue; }
              }
            }
            if (tipo === "no_quiero_mensajes") {
              await deps.repo.guardarBaja(n.tenantId,p.remitenteHash);
              await responder("Tu solicitud de baja quedó registrada.",true);
            } else {
              let res: ResultadoAccionCita | null = null;
              // NUNCA extraer appointmentId ni referencia del texto, botón o payload de interacción.
              if (tipo === "modificar" && deps.modificarCita && p.context_id) {
                // Botón «Modificar mi cita» de la confirmación: el asistente ayuda a elegir otra hora y reemplaza la anterior.
                const refM = await deps.repo.referencia(n.tenantId,p.context_id,p.remitenteHash);
                if (refM) {
                  let m: { texto: string } | null = null;
                  try { m = await deps.modificarCita({tenantId:n.tenantId,clienteId:refM.clienteId,referenciaRecordatorio:refM.registroId,contactHash:p.remitenteHash}); } catch { m = null; }
                  if (m) { totals.acciones++; await responder(m.texto); await deps.repo.terminar(n.tenantId,key,"procesado"); totals.procesados++; continue; }
                }
              }
              if (tipo === "confirmar" || tipo === "cancelar") {
                const ref = p.context_id ? await deps.repo.referencia(n.tenantId,p.context_id,p.remitenteHash)
                  : await deps.repo.referenciaAlternativa(n.tenantId,p.remitenteHash,deps.ahora());
                if (ref) res = await deps.accion(tipo,{tenantId:n.tenantId,clienteId:ref.clienteId,referenciaRecordatorio:ref.registroId});
              }
              if (res && (res.motivo === "ok" || res.motivo === "ya_estaba")) {
                totals.acciones++;
                await responder(tipo === "confirmar" ? "Tu cita está confirmada." : "Tu cita está cancelada.");
              } else if (res && res.motivo === "fuera_de_plazo" && tipo === "cancelar") {
                // Faltan menos de 3 horas (o ya pasó): ya no se puede cancelar desde aquí.
                totals.acciones++;
                await responder("Ya no es posible cancelar tu cita por este medio, porque faltan menos de 3 horas. Si no podrás asistir, avísanos por este chat; de lo contrario se marcará como inasistencia según nuestras políticas.");
              } else {
                let respuestaFaq: string | null = null;
                let derivarChat = false;
                let listaChat: ListaReserva | null = null;
                let datosMenu: DatosFaq | null = null;
                let desdeMenu = false;
                let consulta: string = typeof text === "string" ? text : "";
                const chat = deps.chat;
                const contar = async (c: CampoIndicador) => { if (chat) { try { await chat.contar(n.tenantId,c,deps.ahora()); } catch { /* indicador: no debe romper la respuesta */ } } };
                const entradaTexto = p.tipo === "text" || esBoton; // los botones del menú llegan como su texto equivalente
                if (entradaTexto && typeof text === "string" && deps.datosDelNegocio && (tipo === "desconocido" || chat)) {
                  const ref = p.context_id ? await deps.repo.referencia(n.tenantId,p.context_id,p.remitenteHash)
                    : await deps.repo.referenciaAlternativa(n.tenantId,p.remitenteHash,deps.ahora());
                  if (!ref) {
                    // Solo datos comerciales del tenant verificado; el texto vive únicamente en memoria.
                    const datosNegocio = await deps.datosDelNegocio(n.tenantId);
                    datosMenu = datosNegocio;
                    // Tocar un botón es una decisión nueva: se deja atrás cualquier reserva a medias.
                    if (esBoton && chat && !/^r[1-8]$/.test(String(textoRecibido ?? ""))) { try { await chat.borrarEstado(n.tenantId,p.remitenteHash); } catch { /* sin memoria: nada que borrar */ } }
                    // 0) "menú", "volver" o un saludo suelto: se sale de cualquier reserva en curso y se empieza de cero.
                    let reiniciado = false;
                    if (deps.conMenu && tipo === "desconocido" && (esVolver(text) || esSoloSaludo(text))) {
                      if (chat) { try { await chat.borrarEstado(n.tenantId,p.remitenteHash); } catch { /* sin memoria: nada que borrar */ } }
                      respuestaFaq = textoMenu(datosNegocio, esSoloSaludo(text) ? "saludo" : "volver");
                      reiniciado = true;
                      await contar("respuestas_automaticas");
                    }
                    // 0b) Manicure: otra línea de negocio, aparte de la barbería. Sale de cualquier reserva en curso y NO pasa por disponibilidad, reservas ni IA.
                    if (!reiniciado && deps.conMenu && tipo === "desconocido") {
                      const mani = respuestaManicure(text);
                      if (mani !== null) {
                        if (chat) { try { await chat.borrarEstado(n.tenantId,p.remitenteHash); } catch { /* sin memoria: nada que borrar */ } }
                        respuestaFaq = mani; reiniciado = true;
                        await contar("respuestas_automaticas");
                      }
                    }
                    // 1) Conversación de reserva en curso (elegir hora, enviar datos).
                    if (chat && !reiniciado) {
                      try {
                        const rc = await manejarReservaChat(text,para,datosNegocio,{
                          ahora: deps.ahora,
                          leerEstado: () => chat.leerEstado(n.tenantId,p.remitenteHash,deps.ahora()),
                          guardarEstado: (e) => chat.guardarEstado(n.tenantId,p.remitenteHash,e,deps.ahora() + VIGENCIA_MIN * 60000),
                          borrarEstado: () => chat.borrarEstado(n.tenantId,p.remitenteHash),
                          reservasFuturas: (tel) => chat.reservasFuturas(n.tenantId,tel,deps.ahora()),
                          ...(chat.detalleFuturas ? { detalleFuturas: (tel: string) => chat.detalleFuturas!(n.tenantId,tel,deps.ahora()) } : {}),
                          crearReserva: (a) => chat.crearReserva(n.tenantId,a),
                          contar,
                          ...(chat.precargado ? { precargado: () => chat.precargado!(n.tenantId,p.remitenteHash,deps.ahora()) } : {}),
                          ...(chat.alReprogramar ? { alReprogramar: (id: string) => chat.alReprogramar!(n.tenantId,p.remitenteHash,id,deps.ahora()) } : {}),
                        });
                        if (rc) { respuestaFaq = rc.texto; derivarChat = !!rc.derivar; listaChat = rc.lista ?? null; }
                      } catch { /* memoria o agenda no disponible: se sigue como antes */ }
                    }
                    if (respuestaFaq === null && tipo === "desconocido" && deps.conMenu) {
                      // Respuesta a las opciones del menú: 1 reservar, 2 curso, 3 precios/horarios/ubicación, 4 una persona.
                      const op = opcionMenu(text);
                      if (op === 4) { respuestaFaq = (deps.derivarAlTelefono && textoDerivacionTelefono(datosNegocio,"Perfecto, para otras consultas te atiende una persona del equipo.")) || RESPUESTA_OTRAS; derivarChat = true; }
                      else if (op === 3 && infoGeneral(datosNegocio)) { const info = infoGeneral(datosNegocio) as string; respuestaFaq = deps.conCta ? conLlamadaAReservar(info,datosNegocio?.negocio.linkReserva) : info; await contar("respuestas_automaticas"); }
                      else if (op === 2 || (op === null && pideInfoCursoGeneral(text))) { respuestaFaq = textoCurso(); await contar("respuestas_automaticas"); }
                      else if (op === 5) { respuestaFaq = textoManicure(); await contar("respuestas_automaticas"); } // sin reserva en curso, el 5 del menú es Manicure
                      else if (op !== null) { consulta = CONSULTA_POR_OPCION[op]; desdeMenu = true; }
                    }
                    // Pide el video del curso: el enlace va tal cual, sin pasar por la IA.
                    if (respuestaFaq === null && tipo === "desconocido") {
                      const enl = enlacesPedidos(consulta,datosNegocio?.negocio.linkReserva);
                      if (enl.length > 0) { respuestaFaq = enl[0]; await contar("respuestas_automaticas"); }
                    }
                    // Pide un archivo ("la malla del curso"): se responde corto y el archivo sale después, sin pasar por la IA.
                    if (respuestaFaq === null && tipo === "desconocido" && deps.archivos && text.split(/\s+/).filter(Boolean).length <= 10) {
                      const pedidos = deps.archivos.pedidos(consulta,datosNegocio?.negocio.linkReserva) as any[];
                      if (pedidos.length > 0 && typeof pedidos[0]?.caption === "string") { respuestaFaq = pedidos[0].caption; await contar("respuestas_automaticas"); }
                    }
                    // Gracias / chao, y un "sí" suelto sin pregunta pendiente: respuesta corta, sin IA.
                    if (respuestaFaq === null && tipo === "desconocido" && deps.conMenu && !esBoton) {
                      if (esCierreConversacion(text)) { respuestaFaq = TEXTO_CIERRE; await contar("respuestas_automaticas"); }
                      else if (esAfirmativoSuelto(text)) { respuestaFaq = TEXTO_AFIRMATIVO_SUELTO; await contar("respuestas_automaticas"); }
                    }
                    // Pedir a una persona, o cambiar / cancelar una hora: respuesta directa (con el teléfono real), sin pasar por la IA.
                    if (respuestaFaq === null && tipo === "desconocido" && deps.derivarAlTelefono && !esBoton) {
                      if (pideCambio(text)) { const t = textoCambio(datosNegocio); if (t) { respuestaFaq = t; await contar("respuestas_automaticas"); } }
                      else if (pideHumano(text)) { const t = textoDerivacionTelefono(datosNegocio,"Claro, te atiende una persona del equipo."); if (t) { respuestaFaq = t; derivarChat = true; } }
                    }
                    if (respuestaFaq === null && tipo === "desconocido") {
                      // 2) Consulta de disponibilidad ("¿Matías tiene hora a las 3?"); si no aplica o falla, la FAQ.
                      if (deps.horasLibres) {
                        try {
                          // Si ya se le ofreció algo, el seguimiento ("¿y Valentina a las 10:15?") hereda esa fecha y responde más corto.
                          let previo: EstadoChat | null = null;
                          if (chat) { try { previo = await chat.leerEstado(n.tenantId,p.remitenteHash,deps.ahora()); } catch { /* sin memoria: respuesta normal */ } }
                          // Si ya estaba en el paso de datos, se sigue hablando de ese día y esa hora ("¿qué barberos más tienen a esa hora?").
                          const fechaOferta = previo?.etapa === "oferta" ? previo.datos.opciones[0]?.fecha : previo?.etapa === "datos" ? previo.datos.fecha : undefined;
                          const horaContexto = previo?.etapa === "datos" ? previo.datos.hora : previo?.etapa === "oferta" ? (previo.datos.horaPendiente ?? previo.datos.horaExacta ?? undefined) : undefined;
                          if (horaContexto && /\b(esa|misma|esta) hora\b/i.test(consulta)) consulta = consulta.replace(/\b(a )?(esa|misma|esta) hora\b/i, `a las ${horaContexto}`);
                          const unica = previo?.etapa === "oferta" && previo.datos.opciones.length === 1 ? previo.datos.opciones[0] : undefined;
                          const d = await conTiempoMaximo(responderDisponibilidad(consulta,datosNegocio,{ahora:deps.ahora,horasLibres:deps.horasLibres,...(fechaOferta ? { fechaPorDefecto: fechaOferta } : {}),...(unica ? { profesionalPorDefecto: unica.id, horasOfrecidas: unica.horas } : {})}),6000);
                          if (d.tipo === "respuesta") {
                            respuestaFaq = d.texto;
                            await contar("consultas_disponibilidad");
                            if (chat && d.oferta) {
                              try { await chat.guardarEstado(n.tenantId,p.remitenteHash,{ etapa: "oferta", datos: d.oferta },deps.ahora() + VIGENCIA_MIN * 60000); await contar("ofertas_horas"); } catch { /* sin memoria: igual se muestra la respuesta */ }
                              // Cierre rápido: si ya dijo con quién y a qué hora quiere agendar y esa hora está libre, se piden los datos de una vez.
                              if (d.oferta.horaExacta && d.oferta.opciones.length === 1 && INTENCION_AGENDAR.test(normalizar(text))) {
                                try {
                                  const rc = await manejarReservaChat("si",para,datosNegocio,{
                                    ahora: deps.ahora,
                                    leerEstado: () => chat.leerEstado(n.tenantId,p.remitenteHash,deps.ahora()),
                                    guardarEstado: (e) => chat.guardarEstado(n.tenantId,p.remitenteHash,e,deps.ahora() + VIGENCIA_MIN * 60000),
                                    borrarEstado: () => chat.borrarEstado(n.tenantId,p.remitenteHash),
                                    reservasFuturas: (tel) => chat.reservasFuturas(n.tenantId,tel,deps.ahora()),
                          ...(chat.detalleFuturas ? { detalleFuturas: (tel: string) => chat.detalleFuturas!(n.tenantId,tel,deps.ahora()) } : {}),
                                    crearReserva: (a) => chat.crearReserva(n.tenantId,a),
                                    contar,
                                    ...(chat.precargado ? { precargado: () => chat.precargado!(n.tenantId,p.remitenteHash,deps.ahora()) } : {}),
                                    ...(chat.alReprogramar ? { alReprogramar: (id: string) => chat.alReprogramar!(n.tenantId,p.remitenteHash,id,deps.ahora()) } : {}),
                                  });
                                  if (rc) { respuestaFaq = rc.texto; derivarChat = !!rc.derivar; }
                                } catch { /* se deja la respuesta de disponibilidad */ }
                              }
                            }
                          }
                        } catch { /* agenda no disponible o demora: se sigue con la FAQ */ }
                      }
                      if (respuestaFaq === null) {
                        const faq = responderFaq(consulta,datosNegocio);
                        if (faq.tipo === "respuesta") { respuestaFaq = deps.conCta ? conLlamadaAReservar(faq.texto,datosNegocio?.negocio.linkReserva,consulta) : faq.texto; await contar("respuestas_automaticas"); }
                      }
                      // 3) Modo Avanzado (IA) con el contexto del negocio, solo si lo anterior no respondió.
                      if (respuestaFaq === null && deps.ia) {
                        try { const ia = await conTiempoMaximo(deps.ia(n.tenantId,consulta,datosNegocio,p.remitenteHash),9000); respuestaFaq = ia !== null && deps.conCta ? conLlamadaAReservar(ia,datosNegocio?.negocio.linkReserva,consulta) : ia; } catch { /* sin IA: se deriva a una persona */ }
                      }
                    }
                  }
                }
                if (respuestaFaq !== null && deps.admin && !derivarChat && !esTextoMenu(respuestaFaq) && !esTextoCurso(respuestaFaq) && !esTextoManicure(respuestaFaq) && !esRespuestaManicure(respuestaFaq) && pideHorario(consulta)) {
                  // Avisos del dueño (p. ej. "el viernes 27 cerramos a las 13:00") en las respuestas sobre horarios u horas.
                  try { respuestaFaq = conAvisos(respuestaFaq, await deps.admin.avisosVigentes(n.tenantId, ahoraChile(deps.ahora()).fecha)); } catch { /* sin avisos: la respuesta sale igual */ }
                }
                if (respuestaFaq !== null) {
                  // Opciones para tocar (profesional o servicio): se envían como lista con el texto de cuerpo; si falla, va el texto.
                  let comoLista = false;
                  if (listaChat && deps.responderLista && !derivarChat) {
                    try { if (await habilitado(false)) { const r: any = await deps.responderLista(n,para,{ ...listaChat, cuerpo: respuestaFaq }); comoLista = !!(r && r.estado === "aceptado"); } } catch { /* se envía el texto */ }
                  }
                  if (!comoLista) await responder(respuestaFaq);
                  if (deps.archivos && !derivarChat && entradaTexto) {
                    try { for (const a of deps.archivos.pedidos(typeof text === "string" ? text : "", datosMenu?.negocio.linkReserva)) await deps.archivos.enviar(n,para,a); } catch { /* el texto ya salió; el archivo es un extra */ }
                  }
                  // Tras una respuesta del curso, la lista de lo que suele querer ver el cliente: camino directo, sin preguntas abiertas.
                  if (deps.responderLista && !derivarChat && p.tipo !== "button" && !esTextoCurso(respuestaFaq) && (DEL_CURSO.test(respuestaFaq) || DEL_CURSO.test(consulta)) && !esTextoMenu(respuestaFaq)) {
                    try { if (await habilitado(false)) await deps.responderLista(n,para,listaDeCurso(TITULO_CURSO_SEGUIR)); } catch { /* la respuesta ya salió */ }
                  }
                  if (deps.responderLista && !derivarChat && p.tipo !== "button" && esRespuestaManicure(respuestaFaq)) {
                    try { if (await habilitado(false)) await deps.responderLista(n,para,listaDeManicure(TITULO_MANICURE_SEGUIR)); } catch { /* la respuesta ya salió */ }
                  }
                  if (derivarChat) {
                    await contar("derivadas_persona");
                    if (await deps.repo.reclamarAviso(n.tenantId,p.remitenteHash,key,deps.ahora())) await deps.avisarAdministrador(n.tenantId);
                  }
                } else if (deps.conMenu && tipo === "desconocido" && entradaTexto && typeof text === "string" && !desdeMenu && !esConsultaLarga(text)) {
                  // Una pregunta de verdad (con "?" y 3 palabras o más) que nada supo responder: se la consulta al dueño. Si no se puede, el menú de siempre.
                  let consultada = false;
                  if (deps.consultas && esConsultable(text)) { try { consultada = await deps.consultas.abrir(n,p.remitenteHash,para,text); } catch { consultada = false; } }
                  if (consultada) { await responder(TEXTO_AL_CLIENTE); await contar("derivadas_persona"); }
                  else {
                  // No entendido o solo saluda: opciones en vez de derivar (no se avisa al administrador).
                  await responder(textoMenu(datosMenu, esSaludo(text) ? "saludo" : "no_entendi"));
                  await contar("respuestas_automaticas");
                  }
                  // Los números del menú no deben leerse como elección de una oferta anterior: se empieza de cero.
                  if (chat) { try { await chat.borrarEstado(n.tenantId,p.remitenteHash); } catch { /* sin memoria: nada que borrar */ } }
                } else if (deps.consultas && !entradaTexto && entry.memoria.leerMedio() && await (async () => {
                  // Imagen o documento (comprobante de abono, fotos de referencia): se le reenvía al dueño, que la revisa y responde.
                  try { return await deps.consultas!.abrir(n,p.remitenteHash,para,"imagen",entry.memoria.leerMedio()!); } catch { return false; }
                })()) {
                  await responder(TEXTO_IMAGEN_CLIENTE); await contar("derivadas_persona");
                } else if (deps.derivarAlTelefono && !entradaTexto && p.tipo !== "button" && p.tipo !== "interactive") {
                  // Foto, audio, documento...: no se leen. Se le dice qué hacer (o se ignora si es una reacción o un sticker).
                  const dn = datosMenu ?? (deps.datosDelNegocio ? await deps.datosDelNegocio(n.tenantId).catch(() => null) : null);
                  const t = textoNoTexto(p.tipo, dn);
                  if (t) { await responder(t); await contar("respuestas_automaticas"); }
                } else {
                  await contar("derivadas_persona");
                  // Consulta difícil: se le pregunta al dueño por WhatsApp y se le responde al cliente por aquí. Si no se puede, se deriva al teléfono como antes.
                  let consultada = false;
                  if (deps.consultas && entradaTexto && typeof text === "string" && esConsultable(text)) { try { consultada = await deps.consultas.abrir(n,p.remitenteHash,para,text); } catch { consultada = false; } }
                  if (consultada) await responder(TEXTO_AL_CLIENTE);
                  else await responder((deps.derivarAlTelefono && textoDerivacionTelefono(datosMenu,"Para esto te atiende una persona del equipo.")) || "Te contactará una persona.");
                  if (await deps.repo.reclamarAviso(n.tenantId,p.remitenteHash,key,deps.ahora())) await deps.avisarAdministrador(n.tenantId);
                }
              }
            }
            await deps.repo.terminar(n.tenantId,key,"procesado"); totals.procesados++;
          } catch (e) {
            if (e instanceof MigracionWebhookPendiente) totals.migracion_pendiente++;
            totals.fallidos++;
            if (key) { try { await deps.repo.terminar(n.tenantId,key,"fallido"); } catch {} }
          }
        }
      } catch (e) { if (e instanceof MigracionWebhookPendiente) totals.migracion_pendiente++; else totals.fallidos++; }
      return json(totals);
    },
  };
}

export function crearRepositorioWebhook(db: any, sal: string): RepositorioWebhook {
  const check = (r: any) => { if (r.error) { if (["42P01","42703","42883","PGRST202","PGRST204","PGRST205"].includes(r.error.code)) throw new MigracionWebhookPendiente(); throw new Error("Operación de webhook no disponible"); } return r; };
  return {
    async negocio(id) {
      const r=check(await db.from("agent_whatsapp_settings").select("tenant_id,phone_number_id,enabled").eq("phone_number_id",id).maybeSingle()).data;
      if (r) return {tenantId:r.tenant_id,phoneNumberId:r.phone_number_id,enabled:r.enabled===true};
      // Segundo número del mismo negocio (migración 018): atiende igual y responde desde el número que recibió el mensaje.
      // Si la columna no existe todavía, simplemente no hay segundo número (no es una migración pendiente del webhook).
      const q=await db.from("agent_whatsapp_settings").select("tenant_id,phone_number_id_2,enabled").eq("phone_number_id_2",id).maybeSingle();
      if (q.error) { if (["42703","PGRST204","PGRST205"].includes(q.error.code)) return null; throw new Error("Operación de webhook no disponible"); }
      return q.data ? {tenantId:q.data.tenant_id,phoneNumberId:q.data.phone_number_id_2,enabled:q.data.enabled===true} : null;
    },
    async admitir(e) { return check(await db.rpc("agent_claim_whatsapp_event",{p_event_key:e.key,p_tenant_id:e.tenantId,p_contact_hash:e.contactHash,p_message_hash:e.messageHash,p_received_at:new Date(e.ahora).toISOString()})).data; },
    async terminar(tenant,key,status) { check(await db.from("agent_whatsapp_events").update({status}).eq("tenant_id",tenant).eq("event_key",key).eq("status","procesando")); },
    async baja(tenant,hash) { return !!check(await db.from("agent_contact_optouts").select("id").eq("tenant_id",tenant).eq("contact_hash",hash).maybeSingle()).data; },
    async guardarBaja(tenant,hash) { check(await db.from("agent_contact_optouts").upsert({tenant_id:tenant,contact_hash:hash,source:"respuesta_cliente"},{onConflict:"tenant_id,contact_hash",ignoreDuplicates:true})); },
    async reclamarAviso(tenant,hash,key,ahora) { return check(await db.rpc("agent_claim_whatsapp_admin_notice",{p_tenant_id:tenant,p_contact_hash:hash,p_event_key:key,p_now:new Date(ahora).toISOString()})).data === true; },
    async referenciaAlternativa(tenant,hash,ahora) {
      if(!tenant||tenant==="ALL")return null;
      const todas=(build:()=>any)=>fetchAllRows(()=>({order:(col:string,opt:unknown)=>({range:async(f:number,t:number)=>check(await build().order(col,opt).range(f,t))})}));
      const records:Registro[]=await todas(()=>db.from("agent_reminder_deliveries")
        .select("id,tenant_id,appointment_id,channel,purpose,status,provider_accepted_at,provider_message_id,appointment:appointments!appointment_id!inner(id,tenant_id,client_id,start_time)")
        .eq("tenant_id",tenant).eq("channel","whatsapp").eq("purpose","recordatorio-cita-v1").eq("status","aceptado_proveedor")
        .eq("appointment.tenant_id",tenant).gte("provider_accepted_at",new Date(ahora-48*3600000).toISOString()).lte("provider_accepted_at",new Date(ahora).toISOString()));
      const candidates=recordatoriosCandidatos(tenant,ahora,records);
      const ids=Array.from(new Set(candidates.map(r=>r.appointment.client_id)));
      if(!ids.length)return null;
      const clients:Cliente[]=[];
      // Evita listas .in grandes y el límite silencioso de 1000; no descarga otros clientes.
      for(let from=0;from<ids.length;from+=100){
        const batch=ids.slice(from,from+100);
        const rows:Cliente[]=await todas(()=>db.from("clients").select("id,tenant_id,phone").eq("tenant_id",tenant).in("id",batch));
        // También falla cerrado si el adaptador devuelve una fila fuera del lote solicitado.
        if(rows.some(c=>c.tenant_id!==tenant||!batch.includes(c.id)))return null;
        clients.push(...rows);
      }
      const selected=seleccionarRecordatorioUnico(tenant,hash,ahora,clients,candidates,sal);
      if(!selected)return null;
      const canonical=normalizarTelefonoWhatsApp(clients.find(c=>c.id===selected.clienteId)?.phone);
      if(!canonical)return null;
      // Preserva el rechazo de teléfonos compartidos incluso con un cliente SIN recordatorio.
      // HEAD entrega solo un conteo: nunca descarga nombre/teléfono/id de esos otros clientes.
      // PostgREST match (~): https://docs.postgrest.org/en/v12/references/api/tables_views.html#operators
      // Consultado 2026-10-27: "match | ~". Rendimiento del plan SQL real: no verificado.
      const pattern=patronTelefonoCanonico(canonical);
      const quoted='"'+pattern.replace(/\\/g,"\\\\").replace(/"/g,'\\"')+'"';
      const duplicate=check(await db.from("clients").select("id",{count:"exact",head:true})
        .eq("tenant_id",tenant).neq("id",selected.clienteId).filter("phone","match",quoted));
      if(typeof duplicate.count!=="number"||!Number.isSafeInteger(duplicate.count)||duplicate.count<0)throw new Error("Conteo de identidad no disponible");
      return duplicate.count===0?selected:null;
    },
    async referencia(tenant,providerId,contactHash) {
      const record=check(await db.from("agent_reminder_deliveries").select("id,appointment_id").eq("tenant_id",tenant).eq("provider_message_id",providerId).eq("channel","whatsapp").eq("purpose","recordatorio-cita-v1").eq("status","aceptado_proveedor").maybeSingle()).data;
      if (!record) return null;
      const appointment=check(await db.from("appointments").select("client_id,client:clients!client_id(id,phone,tenant_id)").eq("tenant_id",tenant).eq("id",record.appointment_id).maybeSingle()).data;
      const client=Array.isArray(appointment?.client)?appointment.client[0]:appointment?.client;
      const phone=normalizarTelefonoWhatsApp(client?.phone);
      if (!phone || client.id!==appointment.client_id || client.tenant_id!==tenant) return null;
      const hash=hashContactoWhatsApp(sal,tenant,phone);
      return hash===contactHash ? {registroId:record.id,clienteId:appointment.client_id} : null;
    },
  };
}

export function accionesDesdeBase(db: any) {
  const repo=crearRepositorioAccionesCita(db);
  return (tipo: "confirmar"|"cancelar",contexto: {tenantId:string;clienteId:string;referenciaRecordatorio:string}) =>
    (tipo==="confirmar"?confirmarCitaPropia:cancelarCitaPropia)(contexto,{repo,ahora:Date.now});
}
