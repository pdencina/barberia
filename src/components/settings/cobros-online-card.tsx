"use client";

import { useEffect, useState } from "react";
import { useToast } from "@/components/ui/toast";
import { formatCurrency } from "@/lib/utils";
import { calcularAbono } from "@/lib/deposit-calc";

interface Estado { conectado: boolean; origen: "dedicado" | "terminal" | null; cuenta: string | null; conectadoEl?: string | null; migrationMissing: boolean; cifradoListo: boolean }
const input = "w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-brand-dark outline-none focus:border-brand-blue dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100";

// Abono al reservar: el cliente paga un monto al agendar y el dinero llega a la cuenta de Mercado Pago DEL NEGOCIO (no a la de re-booking).
export function CobrosOnlineCard({ tenantId }: { tenantId: string }) {
  const { showToast } = useToast();
  const [estado, setEstado] = useState<Estado | null>(null);
  const [token, setToken] = useState("");
  const [conectando, setConectando] = useState(false);
  const [activo, setActivo] = useState(false);
  const [modo, setModo] = useState<"percent" | "fixed">("percent");
  const [porcentaje, setPorcentaje] = useState(30);
  const [fijo, setFijo] = useState("");
  const [horas, setHoras] = useState(24);
  const [mensaje, setMensaje] = useState("Este servicio requiere un abono para confirmar tu cita.");
  const [guardando, setGuardando] = useState(false);
  const [probando, setProbando] = useState(false);
  const [prueba, setPrueba] = useState<any>(null);

  const cargarEstado = () => fetch(`/api/settings/cobros-online?tenantId=${tenantId}`, { cache: "no-store" }).then((r) => r.json()).then((d) => { if (!d?.error) setEstado(d); }).catch(() => {});
  useEffect(() => {
    if (!tenantId) return;
    cargarEstado();
    fetch(`/api/settings/deposit?tenantId=${tenantId}`, { cache: "no-store" }).then((r) => r.json()).then((d) => {
      setActivo(!!d.deposit_enabled); setModo(d.deposit_mode === "fixed" ? "fixed" : "percent"); setPorcentaje(d.deposit_percentage || 30);
      setFijo(d.deposit_fixed_amount ? String(d.deposit_fixed_amount) : ""); setHoras(d.cancellation_free_hours ?? 24);
      if (d.deposit_message) setMensaje(d.deposit_message);
    }).catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId]);

  const conectar = async () => {
    if (!token.trim() || conectando) return;
    setConectando(true);
    try {
      const res = await fetch("/api/settings/cobros-online", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tenantId, accessToken: token.trim() }) });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) { showToast(d?.error || "No se pudo conectar", "error"); return; }
      setToken(""); showToast(`Cuenta conectada${d.cuenta ? `: ${d.cuenta}` : ""}`, "success"); cargarEstado();
    } finally { setConectando(false); }
  };
  const desconectar = async () => {
    if (!window.confirm("¿Desconectar la cuenta de Mercado Pago? Tus clientes dejarán de poder pagar el abono al reservar.")) return;
    const res = await fetch(`/api/settings/cobros-online?tenantId=${tenantId}`, { method: "DELETE" });
    if (res.ok) { showToast("Cuenta desconectada", "success"); cargarEstado(); } else showToast("No se pudo desconectar", "error");
  };
  const guardar = async () => {
    setGuardando(true);
    try {
      const res = await fetch("/api/settings/deposit", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tenantId, deposit_enabled: activo, deposit_mode: modo, deposit_percentage: porcentaje, deposit_fixed_amount: modo === "fixed" ? Number(fijo.replace(/\D/g, "")) : null, cancellation_free_hours: horas, deposit_message: mensaje }) });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) { showToast(d?.error || "No se pudo guardar", "error"); return; }
      showToast("Abono guardado", "success");
    } finally { setGuardando(false); }
  };

  const probar = async () => {
    setProbando(true); setPrueba(null);
    try {
      const res = await fetch("/api/settings/cobros-online/probar", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tenantId }) });
      setPrueba(await res.json().catch(() => ({ ok: false, error: "No se pudo probar" })));
    } finally { setProbando(false); }
  };

  if (!estado) return null;
  const ejemploTotal = 35000;
  const ejemplo = calcularAbono(ejemploTotal, { mode: modo, percent: porcentaje, fixed: Number(fijo.replace(/\D/g, "")) || null });
  return (
    <div className="space-y-4 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-brand-white md:p-6">
      <div>
        <h2 className="font-bold text-brand-dark">Abono al reservar (Mercado Pago)</h2>
        <p className="text-xs text-brand-gray">Tu cliente paga un abono al agendar y <b>el dinero llega a tu cuenta de Mercado Pago</b>, no a la de re-booking. La cita se confirma sola cuando el pago se aprueba.</p>
      </div>
      {estado.migrationMissing && <p className="rounded-xl bg-amber-50 p-3 text-xs text-amber-700">Falta una actualización de la base de datos (migración 131) para usar esto.</p>}
      {!estado.cifradoListo && <p className="rounded-xl bg-amber-50 p-3 text-xs text-amber-700">Falta una llave de cifrado en el servidor (SECRET_BOX_KEY) para guardar el token de forma segura. Avísale a soporte.</p>}

      <div className="space-y-2 rounded-xl border border-gray-100 p-3 dark:border-gray-800">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-semibold text-brand-dark">1. Tu cuenta de Mercado Pago</p>
          <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${estado.conectado ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-600"}`}>{estado.conectado ? "Conectada" : "Sin conectar"}</span>
        </div>
        {estado.conectado && <p className="text-xs text-brand-gray">{estado.origen === "terminal" ? "Hoy se usa la cuenta de tu terminal de cobro. Si quieres que los abonos lleguen a otra cuenta, conecta una abajo." : <>Cuenta: <b className="text-brand-dark">{estado.cuenta || "conectada"}</b>{estado.conectadoEl ? ` · desde ${new Date(estado.conectadoEl).toLocaleDateString("es-CL")}` : ""}</>}</p>}
        <div className="flex flex-wrap gap-2">
          <input type="password" autoComplete="off" value={token} onChange={(e) => setToken(e.target.value)} placeholder="Access Token de producción (APP_USR-…)" className={`${input} min-w-[220px] flex-1`} />
          <button type="button" onClick={conectar} disabled={!token.trim() || conectando || !estado.cifradoListo} className="rounded-xl bg-brand-blue px-4 py-2.5 text-xs font-semibold text-white disabled:opacity-40">{conectando ? "Conectando…" : estado.origen === "dedicado" ? "Cambiar cuenta" : "Conectar"}</button>
          {estado.origen === "dedicado" && <button type="button" onClick={desconectar} className="rounded-xl border border-gray-200 px-3 py-2.5 text-xs font-semibold text-red-600 dark:border-gray-700">Desconectar</button>}
        </div>
        {estado.conectado && (
          <div className="space-y-2">
            <button type="button" onClick={probar} disabled={probando} className="rounded-xl border border-gray-200 px-3 py-2 text-xs font-semibold text-brand-dark disabled:opacity-40 dark:border-gray-700">{probando ? "Probando…" : "Probar que Mercado Pago acepta cobros"}</button>
            {prueba && (
              <div className={`rounded-xl p-3 text-xs ${prueba.ok ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-800"}`}>
                {prueba.error && <p>{prueba.error}</p>}
                {prueba.cuenta && <p>Cuenta: <b>{prueba.cuenta.nombre || "—"}</b> · token de <b>{prueba.cuenta.token === "produccion" ? "producción" : prueba.cuenta.token === "prueba" ? "prueba" : "tipo desconocido"}</b> · {prueba.cuenta.puedeVender === false ? "NO puede recibir pagos" : prueba.cuenta.puedeVender === true ? "puede recibir pagos" : "recepción de pagos sin confirmar"}</p>}
                {(prueba.problemas || []).map((x: string, i: number) => <p key={i} className="mt-1">• {x}</p>)}
                {prueba.linkDePago && <p className="mt-1">Link de pago de prueba: <b>{prueba.linkDePago.ok ? "Mercado Pago lo aceptó" : `Mercado Pago lo rechazó${prueba.linkDePago.detalle ? ` — ${prueba.linkDePago.detalle}` : ""}`}</b></p>}
                {prueba.ok && <p className="mt-1 font-semibold">Todo listo para cobrar abonos.</p>}
              </div>
            )}
          </div>
        )}
        {estado.origen === "terminal" && (
          <p className="rounded-lg bg-amber-50 p-2.5 text-[11px] leading-relaxed text-amber-800">Hoy se usa el token de tu <b>máquina Point</b>. Ese token es para el terminal y a veces Mercado Pago <b>no lo deja cobrar online</b>. Si el abono falla al pagar, crea una aplicación de cobros online (pasos abajo) y conéctala aquí.</p>
        )}
        <div className="rounded-lg border border-gray-100 p-3 text-[11px] leading-relaxed text-brand-gray dark:border-gray-800">
          <p className="mb-1 font-semibold text-brand-dark">Cómo habilitar los cobros online en tu cuenta de Mercado Pago (una sola vez):</p>
          <ol className="list-decimal space-y-1 pl-4">
            <li>Entra a <a href="https://www.mercadopago.cl/developers/panel/app" target="_blank" rel="noopener noreferrer" className="text-brand-blue underline">Mercado Pago Developers › Tus integraciones</a> con la cuenta que va a recibir el dinero.</li>
            <li><b>Crea una aplicación nueva</b> para <b>Pagos online</b> y elige el producto <b>«Checkout Pro»</b>. (La integración de Point es solo para la máquina: no sirve para esto.)</li>
            <li>Dentro de la aplicación entra a <b>Credenciales de producción</b> (si te lo pide, activa las credenciales de producción).</li>
            <li>Copia el <b>Access Token</b> (empieza con <b>APP_USR-</b>), pégalo arriba y toca <b>Conectar</b>.</li>
            <li>Toca <b>«Probar que Mercado Pago acepta cobros»</b>: debe decir «Todo listo para cobrar abonos».</li>
          </ol>
          <p className="mt-1.5">El token se guarda cifrado y nunca se muestra de nuevo.</p>
        </div>
      </div>

      <div className="space-y-3 rounded-xl border border-gray-100 p-3 dark:border-gray-800">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-semibold text-brand-dark">2. Cuánto se cobra de abono</p>
          <button type="button" onClick={() => setActivo(!activo)} aria-label="Activar el abono" className={`relative h-6 w-11 rounded-full transition-colors ${activo ? "bg-green-500" : "bg-gray-300"}`}><span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${activo ? "left-[22px]" : "left-0.5"}`} /></button>
        </div>
        {activo && (
          <>
            <div className="grid gap-2 sm:grid-cols-2">
              <label className={`flex cursor-pointer items-start gap-2 rounded-xl border p-3 text-sm ${modo === "percent" ? "border-brand-blue" : "border-gray-100 dark:border-gray-800"}`}>
                <input type="radio" name="modo-abono" checked={modo === "percent"} onChange={() => setModo("percent")} className="mt-0.5" />
                <span className="flex-1"><b className="text-brand-dark">Un porcentaje del servicio</b>
                  <select value={porcentaje} onChange={(e) => setPorcentaje(parseInt(e.target.value))} onFocus={() => setModo("percent")} className={`${input} mt-2`}>{[10, 20, 30, 40, 50, 75, 100].map((p) => <option key={p} value={p}>{p}%{p === 100 ? " (pago completo)" : ""}</option>)}</select></span>
              </label>
              <label className={`flex cursor-pointer items-start gap-2 rounded-xl border p-3 text-sm ${modo === "fixed" ? "border-brand-blue" : "border-gray-100 dark:border-gray-800"}`}>
                <input type="radio" name="modo-abono" checked={modo === "fixed"} onChange={() => setModo("fixed")} className="mt-0.5" />
                <span className="flex-1"><b className="text-brand-dark">Un monto fijo</b>
                  <input inputMode="numeric" value={fijo} onChange={(e) => setFijo(e.target.value.replace(/\D/g, ""))} onFocus={() => setModo("fixed")} placeholder="Ej: 5000" className={`${input} mt-2`} /></span>
              </label>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div><label className="mb-1 block text-xs font-medium text-brand-gray">Cancelación gratis hasta</label>
                <select value={horas} onChange={(e) => setHoras(parseInt(e.target.value))} className={input}>{[2, 6, 12, 24, 48, 72].map((h) => <option key={h} value={h}>{h} horas antes</option>)}</select></div>
              <div><label className="mb-1 block text-xs font-medium text-brand-gray">Mensaje al cliente</label>
                <input value={mensaje} maxLength={300} onChange={(e) => setMensaje(e.target.value)} className={input} /></div>
            </div>
            <p className="rounded-xl bg-green-50 p-3 text-xs text-green-700 dark:bg-green-500/10 dark:text-green-400"><b>Ejemplo:</b> un servicio de {formatCurrency(ejemploTotal)} → el cliente paga <b>{formatCurrency(ejemplo)}</b> al agendar y el resto en el local.</p>
          </>
        )}
        {activo && !estado.conectado && <p className="rounded-xl bg-amber-50 p-3 text-xs text-amber-700">Mientras no conectes una cuenta de Mercado Pago, <b>no se exige el abono</b> y tus clientes reservan normal.</p>}
        <div className="flex justify-end"><button type="button" onClick={guardar} disabled={guardando} className="rounded-xl bg-brand-blue px-4 py-2 text-xs font-semibold text-white disabled:opacity-40">{guardando ? "Guardando…" : "Guardar abono"}</button></div>
      </div>
    </div>
  );
}
