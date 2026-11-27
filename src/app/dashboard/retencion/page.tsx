"use client";

import { useTenant } from "@/lib/tenant-context";
import { couponKind } from "@/lib/coupon";
import { useBorrador } from "@/lib/use-borrador";
import { codigosDePago } from "@/lib/cupon-pagos";
import { etiquetaRangos, rangosATexto, type Rango } from "@/lib/rangos-dias";
import { SIN_CONDICIONES, errorCondiciones, textoCondiciones, type CondicionesPromo } from "@/lib/promo-condiciones";
import { PromoCondicionesForm } from "./promo-condiciones-form";
import { PromoImagenCampo } from "./promo-imagen-campo";
import { VistaCorreo } from "./vista-correo";
import { reglasDeCampana } from "@/lib/reglas-campana";
import { ColoresCorreoCampo } from "./colores-correo-campo";
import { PALETAS, coloresLegibles } from "@/lib/correo-colores";
import { useFondoLogo } from "@/lib/use-fondo-logo";
import { ResultadoCampana } from "./resultado-campana";
import { clavePendiente, correrEnvio, guardarPendiente, leerPendiente, TANDA, type EnvioPendiente } from "@/lib/envio-pendiente";
import { useState, useEffect, useRef } from "react";
import { useToast } from "@/components/ui/toast";
import { Spinner } from "@/components/ui/spinner";
import { Users, UserMinus, Percent, Mail, MessageCircle, HeartHandshake, Send, Eye, History, Download } from "lucide-react";
import Link from "next/link";
import { PageHeader, StatCard, Panel, primaryButton, ghostButton, inputClass } from "@/components/ui/premium";
import { MessageQuotaBar } from "@/components/dashboard/message-quota-bar";
import { formatPhoneCL } from "@/lib/phone";
import { contactosVcf } from "@/lib/vcard";
import { SendReviewModal, type ReviewRecipient } from "./send-review-modal";
import { AddClientSearch, type ManualClient } from "./add-client-search";
import { TutorialDifusion } from "./tutorial-difusion";

interface InactiveClient {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  lastVisit: string | null;
  totalVisits: number;
  daysSinceVisit: number;
}

// Rangos rapidos: "entre N y M dias sin venir" (max null = sin tope). Tambien se pueden escribir a mano.
const RANGE_PRESETS: Array<{ min: number; max: number | null }> = [
  { min: 0, max: 15 }, { min: 15, max: 30 }, { min: 30, max: 45 }, { min: 45, max: 60 },
  { min: 60, max: 90 }, { min: 90, max: 180 }, { min: 180, max: 365 }, { min: 365, max: null },
];
type SortKey = "days_desc" | "days_asc" | "name";

export default function RetencionPage() {
  const [clients, setClients] = useState<InactiveClient[]>([]);
  const [stats, setStats] = useState<{ total: number; inactive: number; percentage: number; contactable: number; neverVisited: number; optedOut?: number; repetidos?: number }>({ total: 0, inactive: 0, percentage: 0, contactable: 0, neverVisited: 0 });
  const [todaBase, setTodaBase] = useState(false); // todos los registrados, sin importar su última visita
  // Por defecto solo clientes que SI vinieron alguna vez. Los que nunca tuvieron una visita registrada (nuevos o importados)
  // no "dejaron de venir": se suman solo si se pide. Lo que se ve en pantalla es lo mismo que recibe el envio masivo.
  const [includeNever, setIncludeNever] = useState(false);
  // Grupos marcados cuando son dos o mas (con uno solo bastan days / maxDays).
  const [rangos, setRangos] = useState<Rango[]>([]);
  // Rango y orden: "entre 15 y 30 dias" y de mas a menos tiempo sin venir (o al reves).
  const [maxDays, setMaxDays] = useState<number | null>(30);
  const [maxInput, setMaxInput] = useState("30");
  const [minInput, setMinInput] = useState("15");
  const [sortBy, setSortBy] = useState<SortKey>("days_desc");
  const [bookingUrl, setBookingUrl] = useState("");
  const [previewTab, setPreviewTab] = useState<"whatsapp" | "email">("whatsapp");
  const [msgPreview, setMsgPreview] = useState<{ whatsapp: string; emailSubject: string; emailHtml: string } | null>(null);
  const [quotaRefresh, setQuotaRefresh] = useState(0);
  const [days, setDays] = useState(15);
  const [loading, setLoading] = useState(true);
  const [coupons, setCoupons] = useState<Array<{ code: string; description: string; discount_type?: string; discount_value?: number }>>([]);
  const [selectedCoupon, setSelectedCoupon] = useState("");
  const [customMessage, setCustomMessage] = useState("");
  const [condiciones, setCondiciones] = useState<CondicionesPromo>(SIN_CONDICIONES);
  const [imageUrl, setImageUrl] = useState("");
  // Diseño, asunto y titular del correo. El diseño elegido se recuerda en este equipo.
  const [design, setDesign] = useState<"clasico" | "oscuro" | "colores">("clasico");
  const [colores, setColores] = useState(PALETAS[0].colores);
  const [logo, setLogo] = useState<string | null>(null);
  const [subject, setSubject] = useState("");
  const [title, setTitle] = useState("");
  const [logoFondo, setLogoFondo] = useState(false); // fondo blanco detrás del logo (para logos oscuros)
  useEffect(() => { try { setLogoFondo(localStorage.getItem("rb_correo_logo_fondo") === "1"); } catch { /* sin almacenamiento */ } }, []);
  useEffect(() => { try { const d = localStorage.getItem("rb_diseno_correo"); if (d === "oscuro" || d === "colores") setDesign(d); const c = coloresLegibles(JSON.parse(localStorage.getItem("rb_correo_colores") || "null")); if (c) setColores(c); } catch { /* sin almacenamiento */ } }, []);
  const elegirDiseno = (d: "clasico" | "oscuro" | "colores") => { setDesign(d); try { localStorage.setItem("rb_diseno_correo", d); } catch { /* sin almacenamiento */ } };
  const elegirColores = (c: typeof colores) => { setColores(c); try { localStorage.setItem("rb_correo_colores", JSON.stringify(c)); } catch { /* sin almacenamiento */ } };
  // Si el logo se pierde sobre el fondo elegido, se le pone un recuadro aunque no se haya marcado.
  const logoNecesitaFondo = useFondoLogo(design === "clasico" ? null : logo, design === "colores" ? (coloresLegibles(colores)?.fondo || "#000000") : "#000000");
  const recuadroLogo = logoFondo || !!logoNecesitaFondo;
  const conditions = textoCondiciones(condiciones, !!selectedCoupon);
  const conCondiciones = (m: string) => [m, conditions].filter(Boolean).join("\n\n");
  const [borrarArmado, setBorrarArmado] = useState(false);
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [bulkSending, setBulkSending] = useState(false);
  const [progreso, setProgreso] = useState(""); // avance del envío por tandas
  const [pendiente, setPendiente] = useState<EnvioPendiente | null>(null); // envío a medias (se puede reanudar)
  const [deteniendo, setDeteniendo] = useState(false);
  const [descartarArmado, setDescartarArmado] = useState(false);
  const [cambios, setCambios] = useState(0); // para refrescar el resultado de la campaña
  const detener = useRef(false);
  // Al salir de esta pantalla el envío se detiene después de la tanda en curso (queda para reanudar).
  useEffect(() => () => { detener.current = true; }, []);
  // Mientras se envía, se avisa antes de cerrar o recargar la página.
  useEffect(() => {
    if (!progreso) return;
    const avisar = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", avisar);
    return () => window.removeEventListener("beforeunload", avisar);
  }, [progreso]);
  // Clientes que se DESMARCARON: no reciben el mensaje masivo (ni el cupon). Por defecto van todos marcados.
  const [excluded, setExcluded] = useState<Set<string>>(new Set());
  // Clientes agregados A MANO (buscados entre todos los del negocio), aunque no esten en el rango de dias.
  const [manualClients, setManualClients] = useState<ManualClient[]>([]);
  // Cuadro para revisar el envio masivo antes de confirmarlo (reemplaza al aviso de texto).
  type ReviewChoice = { ids: string[]; name: string };
  type Review = { kind: "email" | "whatsapp"; recipients: ReviewRecipient[]; messageText: string; couponLabel: string | null; skippedOptedOut: number; truncated: boolean; defaultName: string; recentDays: number; resolve: (r: ReviewChoice | null) => void };
  const [review, setReview] = useState<Review | null>(null);
  const askReview = (cfg: Omit<Review, "resolve">) => new Promise<ReviewChoice | null>((resolve) => setReview({ ...cfg, resolve }));
  const closeReview = (r: ReviewChoice | null) => { review?.resolve(r); setReview(null); };
  // Nombre sugerido para la campana ("Campaña 24 oct · 30–45 días"); se puede cambiar en el cuadro de revision.
  const suggestCampaignName = () => `Campaña ${new Intl.DateTimeFormat("es-CL", { day: "numeric", month: "short", timeZone: "America/Santiago" }).format(new Date())} · ${rangeLabel}`;
  // Cuerpo comun de los envios masivos: quienes se desmarcaron no reciben; los agregados a mano se suman.
  const bulkBody = (type: "email" | "whatsapp", extraExcluded: string[] = [], campaignName?: string) => ({
    ...(todaBase ? { days: 0, maxDays: null, rangos: [], includeNever: true, includeUpcoming: true } : { days, maxDays, rangos, includeNever }), couponCode: selectedCoupon || null, message: customMessage || null, conditions, imageUrl, design, colores, subject, title, logoFondo: recuadroLogo, type, campaignName: campaignName || null,
    excludeClientIds: [...Array.from(excluded), ...extraExcluded],
    includeClientIds: manualClients.map((m) => m.id),
  });
  const { showToast } = useToast();
  const { tenant } = useTenant();
  useEffect(() => { if (tenant?.slug) fetch(`/api/public/business-info?slug=${tenant.slug}`).then((r) => r.json()).then((d) => setLogo(d?.logo_url || null)).catch(() => {}); }, [tenant?.slug]);
  useEffect(() => { setPendiente(tenant?.id ? leerPendiente(clavePendiente(tenant.id)) : null); }, [tenant?.id]);
  // Borrador automático: lo armado queda guardado en este equipo y vuelve al entrar de nuevo.
  const borrador = {
    days, maxDays, rangos, includeNever, todaBase, selectedCoupon, customMessage, condiciones, imageUrl, design, colores, subject, title, logoFondo,
    excluidos: Array.from(excluded), agregados: manualClients,
  };
  const { hayBorrador, borrar: borrarBorrador } = useBorrador(tenant?.id ? `rb_borrador_retencion_${tenant.id}` : null, borrador, (g) => {
    const d = g?.days ?? 15;
    const m = g ? (g.maxDays ?? null) : 30;
    setDays(d); setMinInput(String(d)); setMaxDays(m); setMaxInput(m ? String(m) : "");
    setIncludeNever(!!g?.includeNever); setRangos(g?.rangos || []); setTodaBase(!!g?.todaBase);
    setSelectedCoupon(g?.selectedCoupon || ""); setCustomMessage(g?.customMessage || "");
    setCondiciones({ ...SIN_CONDICIONES, ...(g?.condiciones || {}) });
    setImageUrl(g?.imageUrl || ""); setSubject(g?.subject || ""); setTitle(g?.title || "");
    if (g?.design) setDesign(g.design);
    const guardados = coloresLegibles(g?.colores); if (guardados) setColores(guardados);
    if (typeof g?.logoFondo === "boolean") setLogoFondo(g.logoFondo);
    setExcluded(new Set(g?.excluidos || [])); setManualClients(g?.agregados || []);
  });

  // Ask the server WHO would receive this (scoped to the business), show a sample and
  // the exact count, and only send after an explicit confirmation. This is the guard
  // against the "sent to 647 people by one click" incident.
  const guardarReglas = async () => {
    if (errorCondiciones(condiciones)) { showToast(errorCondiciones(condiciones)!, "error"); return; }
    const cupon: any = coupons.find((c: any) => c.code === selectedCoupon);
    if (!cupon?.id) return;
    const reglas = { desde: condiciones.desde, hasta: condiciones.hasta, horaDesde: condiciones.horaDesde, horaHasta: condiciones.horaHasta, profesionalIds: condiciones.profesionalIds || [], pagos: condiciones.todosLosPagos ? [] : codigosDePago(condiciones.pagos), imagen: imageUrl, titulo: title };
    const res = await fetch(`/api/cupones/${cupon.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ conditions: reglas }) });
    const d = await res.json().catch(() => ({}));
    showToast(res.ok ? `Reglas guardadas en ${selectedCoupon}` : d.error || "No se pudieron guardar", res.ok ? "success" : "error");
  };

  // Antes de enviar: imagen, título y condiciones de la campaña pasan al código. Solo se escribe lo que está puesto; no se borra nada.
  const sincronizarCodigo = async (): Promise<boolean> => {
    const cupon: any = coupons.find((c: any) => c.code === selectedCoupon);
    if (!cupon?.id) return true;
    const conditionsNuevas = reglasDeCampana(cupon.conditions, condiciones, imageUrl, title);
    if (!conditionsNuevas) return true;
    const res = await fetch(`/api/cupones/${cupon.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ conditions: conditionsNuevas }) });
    if (!res.ok) { showToast((await res.json().catch(() => ({}))).error || "No se pudieron guardar las condiciones del código; no se envió nada.", "error"); return false; }
    setCoupons((l: any) => l.map((c: any) => (c.id === cupon.id ? { ...c, conditions: conditionsNuevas } : c)));
    return true;
  };

  const sendBulkEmail = async () => {
    if (errorCondiciones(condiciones)) { showToast(errorCondiciones(condiciones)!, "error"); return; }
    setBulkSending(true);
    try {
      const previewRes = await fetch("/api/retention/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...bulkBody("email"), preview: true }),
      });
      const preview = await previewRes.json();
      if (!previewRes.ok) { showToast(preview.error || "No se pudo preparar el envio", "error"); return; }
      if (!preview.total) { showToast("No hay clientes con email para enviar", "info"); return; }

      // Cuadro de revision: resumen, lista completa de destinatarios y la opcion de sacar a alguien antes de enviar.
      const shown: ReviewRecipient[] = preview.recipients || [];
      const choice = await askReview({
        kind: "email", recipients: shown, messageText: conCondiciones(customMessage.trim() || "Te extrañamos! Vuelve pronto."),
        couponLabel: selectedCoupon || null, skippedOptedOut: preview.manualSkipped || 0, truncated: preview.total > shown.length,
        defaultName: suggestCampaignName(), recentDays: preview.recentDays || 30,
      });
      if (!choice) return;

      // Se manda por tandas de 60. Quien ya recibió hoy este mismo cupón se salta (sirve para retomar un envío cortado).
      const fuera = new Set(choice.ids);
      const hoy = new Date().toDateString();
      const pendientes = shown.filter((r: any) => !fuera.has(r.id) && !(selectedCoupon && r.last && r.last.coupon === selectedCoupon && new Date(r.last.at).toDateString() === hoy)).map((r) => r.id);
      const yaEnviados = shown.filter((r) => !fuera.has(r.id)).length - pendientes.length;
      if (!pendientes.length) { showToast("Todos los marcados ya recibieron este cupón hoy", "info"); return; }
      if (!(await sincronizarCodigo())) return;
      await continuarEnvio({
        cuerpo: bulkBody("email", choice.ids, choice.name), pendientes, enviados: 0, total: pendientes.length, campaignId: null, creado: new Date().toISOString(),
      }, yaEnviados);
    } catch {
      showToast("No se pudo preparar el envío", "error");
    } finally {
      setBulkSending(false);
    }
  };

  // Envía lo que falta, tanda por tanda. Se puede detener; lo pendiente queda guardado para reanudar.
  const continuarEnvio = async (envio: EnvioPendiente, yaEnviados = 0) => {
    const clave = tenant?.id ? clavePendiente(tenant.id) : "";
    detener.current = false;
    setDeteniendo(false);
    setBulkSending(true);
    if (clave) guardarPendiente(clave, envio);
    setPendiente(envio);
    try {
      const r = await correrEnvio(envio, {
        pedir: async (cuerpo) => {
          const res: Response = await fetch("/api/retention/bulk", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(cuerpo) });
          return { ok: res.ok, data: await res.json().catch(() => ({})) };
        },
        detener: () => detener.current,
        guardar: (e) => { if (clave) guardarPendiente(clave, e); setPendiente(e.pendientes.length ? e : null); setCambios((k) => k + 1); },
        avance: (e) => setProgreso(`Enviando ${Math.min(e.total - e.pendientes.length + TANDA, e.total)} de ${e.total}…`),
      });
      const van = `${r.envio.enviados} de ${r.envio.total}`;
      if (r.fin === "completo") { setPendiente(null); showToast(`${van} correos enviados${yaEnviados ? ` (${yaEnviados} ya lo habían recibido hoy)` : ""}`, "success"); }
      else if (r.fin === "detenido") showToast(`Envío detenido. Van ${van}. Puedes reanudarlo cuando quieras.`, "info");
      else if (r.fin === "sin_cupo") showToast(`Se agotó tu cupo de correos. Van ${van}.`, "info");
      else if (r.fin === "proveedor") showToast(`El proveedor de correo dejó de aceptar envíos. Van ${van}.`, "error");
      else showToast(`${r.error || "Se cortó el envío"} Van ${van}; toca «Reanudar envío».`, "error");
    } finally {
      setProgreso("");
      setDeteniendo(false);
      setBulkSending(false);
      setQuotaRefresh((k) => k + 1);
      setCambios((k) => k + 1);
    }
  };

  const detenerEnvio = () => { detener.current = true; setDeteniendo(true); };
  const descartarEnvio = () => {
    if (!descartarArmado) { setDescartarArmado(true); setTimeout(() => setDescartarArmado(false), 4000); return; }
    setDescartarArmado(false);
    if (tenant?.id) guardarPendiente(clavePendiente(tenant.id), null);
    setPendiente(null);
    showToast("Envío cancelado. Lo ya enviado no se puede deshacer.", "info");
  };

  // Copiar lista para una Lista de difusion de WhatsApp. Primero se pide una vista previa
  // (sin gastar cupo) y se confirma; recien ahi se generan los mensajes, que si descuentan cupo.
  const copyForBroadcast = async () => {
    if (errorCondiciones(condiciones)) { showToast(errorCondiciones(condiciones)!, "error"); return; }
    setBulkSending(true);
    try {
      const previewRes = await fetch("/api/retention/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...bulkBody("whatsapp"), preview: true }),
      });
      const preview = await previewRes.json();
      if (!previewRes.ok) { showToast(preview.error || "No se pudo preparar la lista", "error"); return; }
      if (!preview.total) { showToast("No hay clientes con teléfono para copiar", "info"); return; }

      const shown: ReviewRecipient[] = preview.recipients || [];
      const choice = await askReview({
        kind: "whatsapp", recipients: shown, messageText: conCondiciones(customMessage.trim() || "Te extrañamos! Agenda tu cita."),
        couponLabel: selectedCoupon || null, skippedOptedOut: preview.manualSkipped || 0, truncated: preview.total > shown.length,
        defaultName: suggestCampaignName(), recentDays: preview.recentDays || 30,
      });
      if (!choice) return;

      const res = await fetch("/api/retention/bulk", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(bulkBody("whatsapp", choice.ids, choice.name)) });
      const data = await res.json();
      if (!res.ok) { showToast(data.error || "Error al preparar la lista", "error"); return; }
      if (data.links && data.links.length > 0) {
        const phones = data.links.map((l: any) => formatPhoneCL(l.phone)).join("\n");
        // Mismo texto que ve el cliente, pero sin nombre propio (la misma lista de difusion le llega a todos).
        const generic = await fetch("/api/retention/preview", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ couponCode: selectedCoupon || null, message: customMessage || null, conditions, clientName: "" }) })
          .then((r) => (r.ok ? r.json() : null)).catch(() => null);
        const msg = generic?.whatsapp || customMessage || "Te extrañamos! Agenda tu cita.";
        const fullText = `MENSAJE:\n${msg}\n\n---\nDESTINATARIOS (${data.links.length}):\n${phones}`;
        await navigator.clipboard.writeText(fullText);
        showToast(
          data.quotaExceeded
            ? `Se copiaron ${data.links.length} contactos: se agotó tu cupo de WhatsApp de este ciclo.`
            : `Lista de ${data.links.length} contactos copiada. Pégala en tu Lista de difusión de WhatsApp Business.`,
          data.quotaExceeded ? "info" : "success"
        );
      } else if (data.quotaExceeded) {
        showToast("Se agotó tu cupo de WhatsApp de este ciclo.", "error");
      }
      setQuotaRefresh((k) => k + 1);
    } catch {
      showToast("Error al preparar la lista", "error");
    } finally {
      setBulkSending(false);
    }
  };

  const fetchData = async () => {
    setLoading(true);
    const [retRes, coupRes] = await Promise.all([
      fetch(todaBase ? "/api/retention?days=0&includeNever=1&includeUpcoming=1" : `/api/retention?days=${days}${maxDays ? `&maxDays=${maxDays}` : ""}${includeNever ? "&includeNever=1" : ""}${rangos.length ? `&rangos=${rangosATexto(rangos)}` : ""}`),
      fetch("/api/cupones"),
    ]);
    const retData = await retRes.json();
    const coupData = await coupRes.json();
    setClients(retData.clients || []);
    setStats(retData.stats || { total: 0, inactive: 0, percentage: 0, contactable: 0, neverVisited: 0 });
    setBookingUrl(retData.bookingUrl || "");
    setCoupons(Array.isArray(coupData) ? coupData : []);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [days, maxDays, includeNever, rangos, todaBase]);
  // Si "desde" pasa a ser mayor que "hasta", se quita el tope.
  useEffect(() => { if (maxDays && maxDays < days) { setMaxDays(null); setMaxInput(""); } }, [days, maxDays]);

  // Vista previa de lo que recibira el cliente (se actualiza al cambiar cupon o mensaje). El nombre es un marcador: al enviar,
  // cada cliente recibe el mensaje con SU propio nombre (el envio masivo arma un correo por cliente).
  const PREVIEW_NAME = "[nombre del cliente]";
  useEffect(() => {
    const t = setTimeout(() => {
      fetch("/api/retention/preview", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ couponCode: selectedCoupon || null, message: customMessage || null, conditions, imageUrl, design, colores, subject, title, logoFondo: recuadroLogo, clientName: PREVIEW_NAME }) })
        .then((r) => (r.ok ? r.json() : null)).then((d) => { if (d?.whatsapp) setMsgPreview(d); }).catch(() => {});
    }, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCoupon, customMessage, conditions, imageUrl, design, colores, subject, title, recuadroLogo]);

  const notifyClient = async (clientId: string, type: "email" | "whatsapp") => {
    if (errorCondiciones(condiciones)) { showToast(errorCondiciones(condiciones)!, "error"); return; }
    setSendingId(`${clientId}-${type}`);
    if (!(await sincronizarCodigo())) { setSendingId(null); return; }
    const res = await fetch("/api/retention/notify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientId,
        type,
        couponCode: selectedCoupon || null,
        message: customMessage || null,
        conditions,
        imageUrl,
        design,
        colores,
        subject,
        title,
        logoFondo: recuadroLogo,
      }),
    });
    const data = await res.json();
    setSendingId(null);

    if (data.success) {
      if (type === "whatsapp" && data.url) {
        window.open(data.url, "_blank");
        showToast("WhatsApp abierto", "success");
      } else {
        showToast("Email enviado", "success");
      }
      setQuotaRefresh((k) => k + 1);
    } else {
      showToast(data.error || "Error al notificar", "error");
    }
  };

  const sortedClients = [...clients].sort((a, b) =>
    sortBy === "name" ? a.name.localeCompare(b.name, "es") : sortBy === "days_asc" ? a.daysSinceVisit - b.daysSinceVisit : b.daysSinceVisit - a.daysSinceVisit);
  const rangeLabel = todaBase ? "toda tu base" : rangos.length ? etiquetaRangos(rangos) : maxDays != null ? `${days}–${maxDays} días` : `${days}+ días`;
  const todos = !todaBase && !rangos.length && days === 0 && maxDays === null;
  // Deja marcados esos grupos: days / maxDays quedan cubriendo desde el menor hasta el mayor.
  const elegirRangos = (lista: Rango[]) => {
    setTodaBase(false);
    const min = Math.min(...lista.map((r) => r[0]));
    const max = lista.some((r) => r[1] === null) ? null : Math.max(...lista.map((r) => r[1] as number));
    setRangos(lista.length > 1 ? lista : []);
    setDays(min); setMaxDays(max); setMinInput(String(min)); setMaxInput(max ? String(max) : "");
  };
  const marcados: Rango[] = todaBase ? [] : rangos.length ? rangos : RANGE_PRESETS.filter((r) => days === r.min && r.max === maxDays).map((r) => [r.min, r.max]);
  const alternarRango = (min: number, max: number | null) => {
    const esta = marcados.some((r) => r[0] === min && r[1] === max);
    const lista: Rango[] = esta ? marcados.filter((r) => !(r[0] === min && r[1] === max)) : [...marcados, [min, max]];
    if (lista.length) elegirRangos(lista); // siempre queda al menos uno
  };

  // Mismos numeros que usa el envio: un correo / un telefono se cuenta una sola vez.
  // Solo cuentan los clientes marcados (los desmarcados no reciben el mensaje masivo).
  type Row = InactiveClient & { manual?: boolean };
  const inListIds = new Set(clients.map((c) => c.id));
  const manualRows: Row[] = manualClients.filter((m) => !inListIds.has(m.id)).map((m) => ({ ...m, lastVisit: null, totalVisits: 0, daysSinceVisit: 0, manual: true }));
  const rows: Row[] = [...manualRows, ...sortedClients];
  const selectedClients = rows.filter((c) => !excluded.has(c.id));
  const selectedCount = selectedClients.length;
  const withEmail = new Set(selectedClients.filter((c) => c.email).map((c) => c.email!.trim().toLowerCase())).size;
  const withPhone = new Set(selectedClients.filter((c) => c.phone).map((c) => c.phone!.replace(/\D/g, ""))).size;
  // Contactos de los marcados, para guardarlos en el teléfono y armar la difusión buscando la etiqueta. No envía nada ni gasta cupo.
  const downloadContacts = () => {
    const tag = `RET ${maxDays != null ? `${days}-${maxDays}` : `${days}+`}`;
    const { total, texto } = contactosVcf(selectedClients, tag);
    if (!total) { showToast("No hay clientes con teléfono válido", "info"); return; }
    const url = URL.createObjectURL(new Blob([texto], { type: "text/vcard;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url; a.download = `contactos ${tag}.vcf`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
    showToast(`${total} contactos descargados. En WhatsApp búscalos como «${tag}».`, "success");
  };
  const addManual = (c: ManualClient) => {
    setManualClients((prev) => (prev.some((m) => m.id === c.id) ? prev : [c, ...prev]));
    setExcluded((prev) => { if (!prev.has(c.id)) return prev; const n = new Set(prev); n.delete(c.id); return n; }); // al agregarlo queda marcado
    showToast(`${c.name} agregado al envío`, "success");
  };
  const removeManual = (id: string) => setManualClients((prev) => prev.filter((m) => m.id !== id));
  const toggleClient = (id: string) => setExcluded((prev) => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const toggleAll = () => setExcluded((prev) => {
    const n = new Set(prev);
    if (selectedCount === rows.length) rows.forEach((c) => n.add(c.id)); // todos marcados -> desmarcar a todos
    else rows.forEach((c) => n.delete(c.id)); // faltan algunos -> marcar a todos
    return n;
  });

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-6 animate-fade-in">
      <PageHeader
        title="Retención de clientes"
        subtitle="Recupera a los clientes que hace tiempo no vuelven"
        actions={
          <>
            {/* Historial: lo que ya se envio (fecha, mensaje, cupon y a quienes), para no repetir una campana */}
            <Link href="/dashboard/retencion/campanas" className={ghostButton}>
              <History className="h-4 w-4" strokeWidth={2} /> Campañas enviadas
            </Link>
            {rows.length > 0 && (
              <>
                <button onClick={downloadContacts} disabled={withPhone === 0} className={ghostButton}>
                  <Download className="h-4 w-4" strokeWidth={2} /> Descargar contactos
                </button>
                <button onClick={copyForBroadcast} disabled={bulkSending || withPhone === 0} className={ghostButton}>
                  <MessageCircle className="h-4 w-4 text-emerald-500" strokeWidth={2} /> Copiar para difusión ({withPhone})
                </button>
                <button onClick={sendBulkEmail} disabled={bulkSending || !!pendiente || withEmail === 0} className={primaryButton}>
                  <Send className="h-4 w-4" strokeWidth={2} /> {progreso || (bulkSending ? "Procesando..." : `Email masivo (${withEmail})`)}
                </button>
              </>
            )}
          </>
        }
      />

      <MessageQuotaBar refreshKey={quotaRefresh} />

      <TutorialDifusion />

      {/* Metricas */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Total de clientes" value={stats.total} Icon={Users} tone="teal" hint="Registrados en tu negocio" />
        <StatCard label={todaBase ? "Pueden recibirlo" : `Sin venir (${rangeLabel})`} value={stats.inactive} Icon={UserMinus} tone="amber" hint={todaBase ? "Toda tu base" : "Sin visita ni cita por venir"} />
        <StatCard label="% del total" value={`${stats.percentage}%`} Icon={Percent} tone={stats.percentage >= 30 ? "red" : "green"} hint="Del total de clientes" />
        <StatCard label="Contactables" value={stats.contactable} Icon={HeartHandshake} tone="green" hint="Con correo o teléfono" />
      </div>

      {(progreso || pendiente) && (
        <div role="status" className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
          <p className="text-sm font-semibold text-amber-900">
            {progreso ? (deteniendo ? "Deteniendo al terminar esta tanda…" : `${progreso} No cierres esta pantalla.`) : `Envío a medias: ${pendiente!.enviados} enviados, faltan ${pendiente!.pendientes.length}.`}
          </p>
          <div className="flex gap-2">
            {progreso ? (
              <button type="button" onClick={detenerEnvio} disabled={deteniendo} className="rounded-full bg-red-500 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Detener envío</button>
            ) : (
              <>
                <button type="button" onClick={() => void continuarEnvio(pendiente!)} disabled={bulkSending} className="rounded-full bg-brand-blue px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Reanudar envío</button>
                <button type="button" onClick={descartarEnvio} className="rounded-full border border-amber-300 bg-white px-4 py-2 text-sm font-semibold text-amber-900">{descartarArmado ? "Toca otra vez para cancelar" : "Cancelar envío"}</button>
              </>
            )}
          </div>
        </div>
      )}

      <ResultadoCampana cupon={selectedCoupon} tenantId={tenant?.id} refrescar={cambios} />

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(380px,480px)]">
      {/* Filtros y mensaje */}
      <Panel title="A quién y qué decirles">
        <div className="space-y-4">
          <div>
            <p className="mb-2 text-xs font-semibold text-brand-gray">Días sin venir (marca uno o varios grupos, o escríbelo)</p>
            <div className="-mx-1 flex flex-wrap items-center gap-2 px-1">
              <button type="button" aria-pressed={todaBase} onClick={() => setTodaBase((x) => !x)}
                className={`rounded-full border px-3.5 py-2 text-sm font-semibold transition-all ${todaBase ? "border-transparent bg-brand-blue text-white shadow-lg shadow-brand-blue/25" : "border-brand-blue/50 bg-white text-brand-blue"}`}>
                Toda mi base
              </button>
              <button type="button" aria-pressed={todos} onClick={() => elegirRangos([[0, null]])}
                className={`rounded-full border px-3.5 py-2 text-sm font-semibold transition-all ${todos ? "border-transparent bg-brand-blue text-white shadow-lg shadow-brand-blue/25" : "border-gray-200 bg-white text-brand-gray hover:border-brand-blue/40"}`}>
                Todos
              </button>
              {RANGE_PRESETS.map((r) => {
                const active = marcados.some((m) => m[0] === r.min && m[1] === r.max);
                return (
                  <button key={`${r.min}-${r.max}`} type="button" aria-pressed={active}
                    onClick={() => alternarRango(r.min, r.max)}
                    className={`rounded-full border px-3.5 py-2 text-sm font-semibold transition-all ${active ? "border-transparent bg-brand-blue text-white shadow-lg shadow-brand-blue/25" : "border-gray-200 bg-white text-brand-gray hover:border-brand-blue/40"}`}>
                    {r.max ? `${r.min}–${r.max} días` : `${r.min}+ días`}
                  </button>
                );
              })}
            </div>
            {/* Contador: cuántos de los registrados entran y por qué no el resto. */}
            <p role="status" className="mt-3 rounded-xl bg-brand-blue/5 px-3 py-2 text-xs text-brand-dark">
              <b>Entran {stats.inactive} de {stats.total} clientes registrados.</b>{" "}
              {todaBase
                ? `Fuera: ${stats.optedOut || 0} que pidieron no recibir promociones${stats.repetidos ? ` y ${stats.repetidos} fichas con un correo o teléfono repetido` : ""}.`
                : "Con este filtro quedan fuera quienes tienen una cita por venir, no calzan en los días o pidieron no recibir promociones. Para escribirles a todos toca «Toda mi base»."}
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-brand-gray">
              Entre
              <input type="number" min={0} max={999} value={minInput} onChange={(e) => setMinInput(e.target.value)}
                onBlur={() => { const v = parseInt(minInput); if (v >= 0) { if (v !== days) { setRangos([]); setTodaBase(false); } setDays(v); if (maxDays && maxDays < v) { setMaxDays(null); setMaxInput(""); } } else setMinInput(String(days)); }}
                onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
                className="w-24 rounded-full border border-gray-200 bg-white px-3.5 py-2 text-sm outline-none focus:border-brand-blue" />
              y
              <input type="number" min={days} max={999} placeholder="sin tope" value={maxInput} onChange={(e) => setMaxInput(e.target.value)}
                onBlur={() => { const v = parseInt(maxInput); if ((v >= days ? v : null) !== maxDays) { setRangos([]); setTodaBase(false); } if (v >= days) setMaxDays(v); else { setMaxDays(null); setMaxInput(""); } }}
                onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
                className="w-24 rounded-full border border-gray-200 bg-white px-3.5 py-2 text-sm outline-none focus:border-brand-blue" />
              días sin venir
            </div>
          </div>

          <div className="space-y-4">
            <div className="md:max-w-md">
              <label className="mb-1.5 block text-xs font-semibold text-brand-gray">Cupón a incluir</label>
              <select value={selectedCoupon} onChange={(e) => setSelectedCoupon(e.target.value)} className={inputClass}>
                <option value="">Sin cupón</option>
                {coupons.map((c: any) => (
                  <option key={c.code} value={c.code}>{c.code}{couponKind(c) !== "none" ? ` · ${c.discount_type === "percentage" ? `${c.discount_value}%` : `$${Number(c.discount_value).toLocaleString("es-CL")}`} de descuento` : ""}{c.description ? ` · ${c.description}` : ""}</option>
                ))}
              </select>
            </div>
            <div className="flex items-center justify-between gap-3 text-[11px] text-brand-gray">
              <span>{hayBorrador ? "✓ Borrador guardado en este equipo" : "Lo que armes se guarda solo como borrador"}</span>
              {hayBorrador && <button type="button" onClick={() => { if (!borrarArmado) { setBorrarArmado(true); setTimeout(() => setBorrarArmado(false), 4000); return; } setBorrarArmado(false); borrarBorrador(); }} className="font-semibold text-brand-blue hover:underline">{borrarArmado ? "Toca otra vez para borrar" : "Empezar de cero"}</button>}
            </div>
            <PromoCondicionesForm value={condiciones} onChange={setCondiciones} tenantId={tenant?.id} hayCupon={!!selectedCoupon} inputClass={inputClass} />
            {selectedCoupon && (
              <div className="rounded-xl bg-brand-blue/5 px-3 py-2.5">
                {tenant?.slug && <a href={`/${tenant.slug}/promocion?cupon=${encodeURIComponent(selectedCoupon)}`} target="_blank" rel="noopener noreferrer" className="mb-2 block text-xs font-semibold text-brand-blue underline">Ver la página de la promoción</a>}
                <button type="button" onClick={guardarReglas} className="rounded-full bg-brand-blue px-3.5 py-1.5 text-xs font-semibold text-white">Exigir estas reglas en el código {selectedCoupon}</button>
                <p className="mt-1 text-[11px] text-brand-gray">Se guardan solas al enviar el correo. Al reservar y al cobrar, el código solo se aceptará en las fechas, horario, profesionales y medios de pago marcados arriba. Sin nada marcado, vale siempre.</p>
              </div>
            )}
            <div className="space-y-3">
              <div>
                <span className="mb-1.5 block text-xs font-semibold text-brand-gray">Diseño del correo</span>
                <div className="flex flex-wrap gap-1.5">
                  {([["clasico", "Clásico (blanco)"], ["oscuro", "Oscuro (blanco y negro)"], ["colores", "Mis colores"]] as const).map(([k, t]) => (
                    <button key={k} type="button" aria-pressed={design === k} onClick={() => elegirDiseno(k)} className={`rounded-full border px-3.5 py-1.5 text-xs font-semibold ${design === k ? "border-brand-blue bg-brand-blue text-white" : "border-gray-200 bg-white text-brand-gray"}`}>{t}</button>
                  ))}
                </div>
              </div>
              {design === "colores" && <ColoresCorreoCampo colores={colores} onChange={elegirColores} />}
              {design !== "clasico" && logoNecesitaFondo && <p className="text-xs text-brand-gray">✓ Tu logo no se veía sobre ese fondo: le pusimos un recuadro automáticamente.</p>}
              {design !== "clasico" && !logoNecesitaFondo && (
                <label className="flex items-center gap-2 text-xs text-brand-gray">
                  <input type="checkbox" checked={logoFondo} onChange={(e) => { setLogoFondo(e.target.checked); try { localStorage.setItem("rb_correo_logo_fondo", e.target.checked ? "1" : "0"); } catch { /* sin almacenamiento */ } }} />
                  Poner un recuadro detrás de mi logo
                </label>
              )}
              <label className="block"><span className="mb-1.5 block text-xs font-semibold text-brand-gray">Asunto (opcional)</span>
                <input value={subject} maxLength={120} onChange={(e) => setSubject(e.target.value)} placeholder="Ej: Tenemos una promoción para ti" className={inputClass} /></label>
              <label className="block"><span className="mb-1.5 block text-xs font-semibold text-brand-gray">Título grande (opcional)</span>
                <input value={title} maxLength={80} onChange={(e) => setTitle(e.target.value)} placeholder="Ej: Promoción especial" className={inputClass} /></label>
            </div>
            <PromoImagenCampo url={imageUrl} onChange={setImageUrl} tenantId={tenant?.id} showToast={showToast} />
            <div>
              <label htmlFor="retencion-mensaje" className="mb-1.5 block text-xs font-semibold text-brand-gray">Mensaje personalizado</label>
              {/* Varias lineas y crece al escribir: antes era una sola linea que se corria hacia el lado y no se podia leer. */}
              <textarea
                id="retencion-mensaje"
                value={customMessage}
                onChange={(e) => setCustomMessage(e.target.value)}
                maxLength={600}
                rows={5}
                placeholder="Te extrañamos! Vuelve pronto..."
                className={`${inputClass} min-h-[132px] resize-y leading-relaxed`}
              />
              <div className="mt-1.5 flex items-start justify-between gap-3 text-[11px] text-brand-gray">
                <span>Puedes escribir en varias líneas. Lo que escribes aparece al lado (o abajo, en pantallas chicas) tal como lo recibirá el cliente.</span>
                <span className="flex-shrink-0 tabular-nums">{customMessage.length}/600</span>
              </div>
            </div>
          </div>
        </div>
      </Panel>

      {/* Vista previa: al lado del mensaje en pantallas grandes (fija mientras escribes) y justo debajo en las chicas */}
      <div className="xl:sticky xl:top-4 xl:col-start-2 xl:row-span-2 xl:row-start-1">
      <Panel title="Así lo recibirá el cliente" subtitle="Cada cliente recibe el mensaje con su propio nombre. Esto es solo una muestra: no envía nada ni gasta cupo.">
        <div className="mb-3 inline-flex rounded-xl border border-gray-100 bg-brand-light p-1 text-sm">
          {(["whatsapp", "email"] as const).map((k) => (
            <button key={k} onClick={() => setPreviewTab(k)}
              className={`flex items-center gap-1.5 rounded-lg px-4 py-1.5 font-semibold transition-all ${previewTab === k ? "bg-brand-blue text-white shadow" : "text-brand-gray"}`}>
              {k === "whatsapp" ? <MessageCircle className="h-4 w-4" /> : <Mail className="h-4 w-4" />} {k === "whatsapp" ? "WhatsApp" : "Correo"}
            </button>
          ))}
        </div>
        {!msgPreview ? <p className="text-sm text-brand-gray"><Eye className="mr-1 inline h-4 w-4" />Preparando vista previa…</p> : previewTab === "whatsapp" ? (
          <div className="max-w-md rounded-2xl rounded-tl-sm bg-[#E7FFDB] p-3 text-sm text-[#111b21] shadow-sm">
            <p className="whitespace-pre-wrap break-words">{msgPreview.whatsapp}</p>
          </div>
        ) : (
          <VistaCorreo asunto={msgPreview.emailSubject} html={msgPreview.emailHtml} />
        )}
      </Panel>
      </div>

      {/* Quien entra en la lista */}
      <div className="rounded-2xl border border-gray-100 bg-white p-4 text-sm shadow-sm dark:border-white/10 dark:bg-brand-white">
        <label className="flex items-start gap-3">
          <input type="checkbox" checked={includeNever} onChange={(e) => setIncludeNever(e.target.checked)} className="mt-1 h-5 w-5" />
          <span>
            <span className="block font-medium text-brand-dark">Incluir a quienes nunca han venido</span>
            <span className="block text-xs text-brand-gray">
              Son clientes nuevos o importados sin ninguna visita registrada: no "dejaron de venir", solo llevan {rangeLabel} registrados.
              {stats.neverVisited > 0 && (includeNever ? ` Hay ${stats.neverVisited} en esta lista.` : ` Hay ${stats.neverVisited} que no se muestran ni reciben mensajes.`)}
            </span>
          </span>
        </label>
        <p className="mt-2 text-xs text-brand-gray">Lo que ves abajo es exactamente a quién le llegará el email masivo o la lista de difusión.</p>
      </div>
      </div>

      {/* Lista */}
      <Panel title={`Clientes en este rango (${clients.length})`} subtitle={`${todaBase ? "Toda tu base" : `${rangeLabel} sin venir`}${manualRows.length > 0 ? ` · ${manualRows.length} agregado${manualRows.length === 1 ? "" : "s"} a mano` : ""}`} flush
        action={
          <label className="flex items-center gap-2 text-xs font-semibold text-brand-gray">
            Ordenar
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value as SortKey)} className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-brand-dark">
              <option value="days_desc">Más días sin venir primero</option>
              <option value="days_asc">Menos días sin venir primero</option>
              <option value="name">Nombre (A–Z)</option>
            </select>
          </label>
        }>
        {/* Agregar a mano a cualquier cliente del negocio (aunque no este en el rango de dias elegido) */}
        <div className="px-3 pb-3 md:px-4">
          <AddClientSearch inListIds={inListIds} manualIds={new Set(manualClients.map((m) => m.id))} onAdd={addManual} />
        </div>
        {loading ? (
          <Spinner />
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center px-6 pb-10 pt-4 text-center">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-500">
              <HeartHandshake className="h-6 w-6" strokeWidth={1.5} />
            </div>
            <p className="text-sm font-semibold text-brand-dark">¡Todos al día!</p>
            <p className="mt-1 text-xs text-brand-gray">No hay clientes con {rangeLabel} sin volver.</p>
          </div>
        ) : (
          <>
          {/* Seleccion: todos van marcados; se desmarca a quien NO debe recibir el mensaje masivo (y el cupon). */}
          <div className="mx-2 mb-1 flex flex-wrap items-center gap-x-4 gap-y-1 rounded-xl bg-brand-light/70 px-3 py-2.5 text-sm md:mx-3">
            <label className="flex cursor-pointer items-center gap-2.5 font-semibold text-brand-dark">
              <input
                type="checkbox"
                className="h-4 w-4 cursor-pointer accent-gray-500"
                checked={selectedCount === rows.length}
                ref={(el) => { if (el) el.indeterminate = selectedCount > 0 && selectedCount < rows.length; }}
                onChange={toggleAll}
                aria-label="Marcar o desmarcar a todos"
              />
              {selectedCount === rows.length ? "Todos recibirán el mensaje" : `${selectedCount} de ${rows.length} recibirán el mensaje`}
            </label>
            {selectedCount < rows.length && (
              <button type="button" onClick={toggleAll} className="text-xs font-semibold text-brand-blue hover:underline">
                {selectedCount === 0 ? "Marcar a todos" : rows.length - selectedCount === 1 ? "Marcar al que falta" : `Marcar a los ${rows.length - selectedCount} que faltan`}
              </button>
            )}
            <span className="text-xs text-brand-gray">
              Las casillas controlan el Email masivo y la lista de difusión. Los botones de cada fila envían solo a ese cliente.
            </span>
          </div>
          <div className="divide-y divide-gray-50 px-2 pb-2 md:px-3">
            {rows.map((c) => {
              const initials = c.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();
              const tone = c.manual ? "bg-brand-blue/10 text-brand-blue" : c.daysSinceVisit >= 60 ? "bg-red-500/15 text-red-500" : c.daysSinceVisit >= 30 ? "bg-amber-500/15 text-amber-500" : "bg-brand-light text-brand-gray";
              return (
                <div key={c.id} className={`flex flex-wrap items-center gap-3 px-3 py-3.5 transition-colors hover:bg-brand-blue/[0.04] md:flex-nowrap ${excluded.has(c.id) ? "opacity-50" : ""}`}>
                  <input
                    type="checkbox"
                    className="h-4 w-4 flex-shrink-0 cursor-pointer accent-gray-500"
                    checked={!excluded.has(c.id)}
                    onChange={() => toggleClient(c.id)}
                    title={excluded.has(c.id) ? "No recibirá el mensaje masivo" : "Recibirá el mensaje masivo"}
                    aria-label={`${c.name}: recibe el mensaje masivo`}
                  />
                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-blue/25 to-brand-accent/10 text-sm font-bold text-brand-blue ring-1 ring-brand-blue/20">
                    {initials}
                  </div>
                  <div className="min-w-0 flex-1 basis-40">
                    <p className="truncate text-sm font-semibold capitalize text-brand-dark">{c.name}</p>
                    <p className="truncate text-xs text-brand-gray">
                      {c.email || "Sin correo"}{c.phone ? ` · ${formatPhoneCL(c.phone)}` : " · Sin teléfono"}
                    </p>
                  </div>
                  <div className="hidden w-24 text-center md:block">
                    <p className="text-sm font-bold tabular-nums text-brand-dark">{c.manual ? "—" : c.totalVisits}</p>
                    <p className="text-[10px] uppercase tracking-wide text-brand-gray">{c.manual ? "visitas" : c.totalVisits === 1 ? "visita" : "visitas"}</p>
                  </div>
                  <div className="hidden w-28 text-center md:block">
                    <p className="text-sm font-semibold text-brand-dark">{c.lastVisit ? new Date(c.lastVisit + "T12:00:00").toLocaleDateString("es-CL", { day: "numeric", month: "short", year: "numeric" }) : c.manual ? "—" : "Sin visitas"}</p>
                    <p className="text-[10px] uppercase tracking-wide text-brand-gray">última visita</p>
                  </div>
                  {c.manual ? (
                    <button type="button" onClick={() => removeManual(c.id)} title="Quitar de este envío"
                      className={`flex-shrink-0 rounded-full px-3 py-1 text-center text-xs font-bold md:min-w-[84px] ${tone} transition-colors hover:bg-red-500/10 hover:text-red-500`}>
                      Agregado a mano ✕
                    </button>
                  ) : (
                    <span className={`flex-shrink-0 rounded-full px-3 py-1 text-center text-xs font-bold tabular-nums md:min-w-[84px] ${tone}`}>
                      {c.lastVisit ? "" : "Registrado hace "}{c.daysSinceVisit} {c.daysSinceVisit === 1 ? "día" : "días"}
                    </span>
                  )}
                  {/* Ancho fijo en pantalla grande: si el cliente no tiene correo (solo WhatsApp) las columnas de la fila siguen alineadas con las demas. */}
                  <div className="flex flex-shrink-0 gap-2 md:w-[216px]">
                    {c.phone && (
                      <button
                        onClick={() => notifyClient(c.id, "whatsapp")}
                        disabled={sendingId === `${c.id}-whatsapp`}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-500/10 px-3 py-2 text-xs font-bold text-emerald-500 ring-1 ring-emerald-500/20 transition-colors hover:bg-emerald-500/20 disabled:opacity-50"
                      >
                        <MessageCircle className="h-3.5 w-3.5" strokeWidth={2} /> WhatsApp
                      </button>
                    )}
                    {c.email && (
                      <button
                        onClick={() => notifyClient(c.id, "email")}
                        disabled={sendingId === `${c.id}-email`}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-bold text-brand-dark transition-colors hover:border-brand-blue/40 disabled:opacity-50"
                      >
                        <Mail className="h-3.5 w-3.5" strokeWidth={2} /> {sendingId === `${c.id}-email` ? "..." : "Email"}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          </>
        )}
      </Panel>

      {review && (
        <SendReviewModal
          kind={review.kind}
          recipients={review.recipients}
          messageText={review.messageText}
          couponLabel={review.couponLabel}
          skippedOptedOut={review.skippedOptedOut}
          truncated={review.truncated}
          defaultName={review.defaultName}
          recentDays={review.recentDays}
          onCancel={() => closeReview(null)}
          onConfirm={(ids, name) => closeReview({ ids, name })}
        />
      )}
    </div>
  );
}
