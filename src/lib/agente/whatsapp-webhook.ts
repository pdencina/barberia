import { responderFaq, type DatosFaq } from "./faq-fija";
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
  accion: (tipo: "confirmar" | "cancelar", c: { tenantId: string; clienteId: string; referenciaRecordatorio: string }) => Promise<ResultadoAccionCita>;
  responder: (negocio: NegocioWebhook, para: string, texto: string) => Promise<unknown>;
  avisarAdministrador: (tenantId: string) => Promise<unknown>;
}
export class MigracionWebhookPendiente extends Error { constructor() { super("Falta aplicar la migración del webhook"); } }
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
const hour = 60 * 60 * 1000;

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
            const p = entry.persistible, text = entry.memoria.leerTexto(), para = entry.memoria.leerRemitente();
            if (!para) { totals.omitidos++; continue; }
            const eventKey = crearClaveEventoEntrante({tenantId:n.tenantId,referenciaProveedor:p.id});
            // No se guarda texto: HMAC evita diccionarios de frases frecuentes sobre el hash.
            const messageHash = createHmac("sha256",config.salHashes).update(JSON.stringify([n.tenantId,p.tipo,text ?? p.id])).digest("hex");
            const ahora = deps.ahora();
            const admitted = await deps.repo.admitir({key:eventKey,tenantId:n.tenantId,contactHash:p.remitenteHash,messageHash,ahora});
            if (admitted.repetido) { totals.repetidos++; continue; }
            key = eventKey;
            const limit = evaluarLimiteDeUso({tenantId:n.tenantId,contactHash:p.remitenteHash,messageHash,ahoraMs:ahora,historial:admitted.historial,
              reglas:{contacto:{max:10,ventanaMs:hour},negocio:{max:Number.MAX_SAFE_INTEGER,ventanaMs:hour},bucle:{max:Number.MAX_SAFE_INTEGER,ventanaMs:hour}}});
            // El helper cuenta repeticiones en ventana; el RPC aporta las dos inmediatamente anteriores.
            if (!limit.permitido || admitted.consecutivos >= 2) { await deps.repo.terminar(n.tenantId,key,"limitado"); totals.limitados++; continue; }
            if (await deps.repo.baja(n.tenantId,p.remitenteHash)) { await deps.repo.terminar(n.tenantId,key,"procesado"); totals.omitidos++; continue; }
            const current = await deps.repo.negocio(n.phoneNumberId);
            if (!current?.enabled || current.tenantId !== n.tenantId) { await deps.repo.terminar(n.tenantId,key,"procesado"); totals.omitidos++; continue; }
            const tipo = clasificarRespuestaCliente(text);
            const responder = async (body: string, acuseBaja = false) => {
              if (acuseBaja || !await deps.repo.baja(n.tenantId,p.remitenteHash)) await deps.responder(n,para,body);
            };
            if (tipo === "no_quiero_mensajes") {
              await deps.repo.guardarBaja(n.tenantId,p.remitenteHash);
              await responder("Tu solicitud de baja quedó registrada.",true);
            } else {
              let res: ResultadoAccionCita | null = null;
              // NUNCA extraer appointmentId ni referencia del texto, botón o payload de interacción.
              if (tipo === "confirmar" || tipo === "cancelar") {
                const ref = p.context_id ? await deps.repo.referencia(n.tenantId,p.context_id,p.remitenteHash)
                  : await deps.repo.referenciaAlternativa(n.tenantId,p.remitenteHash,deps.ahora());
                if (ref) res = await deps.accion(tipo,{tenantId:n.tenantId,clienteId:ref.clienteId,referenciaRecordatorio:ref.registroId});
              }
              if (res && (res.motivo === "ok" || res.motivo === "ya_estaba")) {
                totals.acciones++;
                await responder(tipo === "confirmar" ? "Tu cita está confirmada." : "Tu cita está cancelada.");
              } else {
                let respuestaFaq: string | null = null;
                if (tipo === "desconocido" && deps.datosDelNegocio) {
                  const ref = p.context_id ? await deps.repo.referencia(n.tenantId,p.context_id,p.remitenteHash)
                    : await deps.repo.referenciaAlternativa(n.tenantId,p.remitenteHash,deps.ahora());
                  if (!ref) {
                    // Solo datos comerciales del tenant verificado; el texto vive únicamente en memoria.
                    const faq = responderFaq(text,await deps.datosDelNegocio(n.tenantId));
                    if (faq.tipo === "respuesta") respuestaFaq = faq.texto;
                  }
                }
                if (respuestaFaq !== null) await responder(respuestaFaq);
                else {
                  await responder("Te contactará una persona.");
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
    async negocio(id) { const r=check(await db.from("agent_whatsapp_settings").select("tenant_id,phone_number_id,enabled").eq("phone_number_id",id).maybeSingle()).data; return r ? {tenantId:r.tenant_id,phoneNumberId:r.phone_number_id,enabled:r.enabled===true} : null; },
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
