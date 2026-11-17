"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { enlaceDeVuelta } from "@/lib/volver-reserva";
import { enlaceWhatsappNegocio } from "@/components/booking/ayuda-whatsapp";

type Estado =
  | { estado: "cargando" }
  | { estado: "pagado"; appointmentId: string | null }
  | { estado: "procesando" }
  | { estado: "esperando" }
  | { estado: "no_pagado"; motivo: string }
  | { estado: "conflicto" }
  | { estado: "desconocido" }
  | { estado: "demora" }; // el cliente volvio de Mercado Pago pero todavia no vemos el pago confirmado

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Pantalla a la que Mercado Pago devuelve al cliente (con el pago aprobado, pendiente o no). La direccion de vuelta NO prueba que se pago: aqui se
// pregunta al servidor si la reserva quedo realmente confirmada y solo entonces se dice «Abono confirmado». Antes decia siempre «confirmado».
export function ResultadoAbono({ modo }: { modo: "success" | "pending" }) {
  const [volver, setVolver] = useState({ href: "/booking", ref: null as string | null });
  const [negocio, setNegocio] = useState<{ name: string; phone: string | null } | null>(null);
  const [est, setEst] = useState<Estado>({ estado: "cargando" });
  const intentos = useRef(0);

  useEffect(() => {
    const search = window.location.search;
    const v = enlaceDeVuelta(search);
    setVolver(v);
    const q = new URLSearchParams(search);
    const slug = q.get("n");
    if (slug) fetch(`/api/public/business-info?slug=${encodeURIComponent(slug)}`).then((r) => r.json()).then((d) => { if (d?.name) setNegocio({ name: d.name, phone: d.phone || null }); }).catch(() => {});

    const ext = q.get("external_reference") || "";
    const ref = v.ref || (UUID.test(ext) ? ext : null);
    const pago = q.get("payment_id") || q.get("collection_id") || "";
    if (!ref) { setEst({ estado: "desconocido" }); return; }

    let vivo = true, timer: ReturnType<typeof setTimeout>;
    const maximo = modo === "pending" ? 40 : 20; // ~60 s (3 s por intento); pendiente espera mas
    const consultar = async () => {
      try {
        const r = await fetch(`/api/booking/deposit-verify?ref=${ref}${pago ? `&payment_id=${encodeURIComponent(pago)}` : ""}`, { cache: "no-store" });
        const d = await r.json();
        if (!vivo) return;
        if (d.estado === "esperando" || d.estado === "procesando") {
          intentos.current += 1;
          if (intentos.current >= maximo) { setEst({ estado: "demora" }); return; }
          setEst({ estado: d.estado });
          timer = setTimeout(consultar, 3000);
          return;
        }
        setEst(d);
      } catch {
        if (!vivo) return;
        intentos.current += 1;
        if (intentos.current >= maximo) { setEst({ estado: "demora" }); return; }
        timer = setTimeout(consultar, 3000);
      }
    };
    consultar();
    return () => { vivo = false; clearTimeout(timer); };
  }, [modo]);

  const ayuda = negocio?.phone ? enlaceWhatsappNegocio(negocio.phone, negocio.name, `Hola ${negocio.name}, hice un pago de abono para reservar y necesito confirmar que mi hora quedó agendada. ¿Me pueden ayudar?`) : null;
  const ok = est.estado === "pagado";
  const espera = est.estado === "cargando" || est.estado === "procesando" || est.estado === "esperando";

  const titulo = ok ? "Abono confirmado"
    : espera ? "Estamos confirmando tu pago"
    : est.estado === "demora" ? "Todavía no vemos tu pago confirmado"
    : est.estado === "conflicto" ? "Tu horario ya no estaba disponible"
    : est.estado === "desconocido" ? "No pudimos verificar tu reserva"
    : "Tu reserva NO quedó confirmada";
  const texto = ok ? "Tu pago fue procesado y tu cita está confirmada."
    : espera ? "No cierres esta pantalla. Esto toma unos segundos."
    : est.estado === "demora" ? "Si Mercado Pago ya te cobró, tu hora se confirma en unos minutos y te llegará un correo. Si no llega, escríbenos y te ayudamos."
    : est.estado === "conflicto" ? "Tu pago llegó, pero otra persona alcanzó a tomar esa hora. Te devolvemos el abono y puedes elegir otro horario."
    : est.estado === "desconocido" ? "Revisa tu correo: si no te llegó la confirmación de la cita, tu hora NO quedó reservada. Puedes volver a intentar o escribirnos."
    : `${(est as any).motivo || "El pago no se completó."} No se te cobró nada y tu hora no quedó reservada.`;

  return (
    <div className="min-h-screen bg-brand-light flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 max-w-sm w-full text-center">
        <img src="/logo-icon.png" alt="re-booking" className="w-16 h-16 mx-auto mb-4" />
        <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${ok ? "bg-brand-blue/10" : espera ? "bg-brand-blue/10" : "bg-red-50"}`}>
          {ok ? (
            <svg className="w-8 h-8 text-brand-blue" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
          ) : espera ? (
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-blue/20 border-t-brand-blue" />
          ) : (
            <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          )}
        </div>
        <h1 className="text-2xl font-bold text-brand-dark mb-2">{titulo}</h1>
        <p className="text-brand-gray text-sm mb-4">{texto}</p>
        {ok && <p className="text-xs text-brand-gray mb-6">Recibirás un correo con los detalles de tu cita.</p>}
        {!espera && (
          <Link href={volver.href} className="inline-block px-6 py-3 bg-brand-blue text-white rounded-xl font-medium hover:bg-brand-blue/90 transition-colors">
            {ok ? "Volver al inicio" : "Elegir una hora de nuevo"}
          </Link>
        )}
        {!ok && !espera && ayuda && (
          <a href={ayuda} target="_blank" rel="noopener noreferrer" className="mt-3 block rounded-xl border border-green-600 px-6 py-3 text-sm font-semibold text-green-700 hover:bg-green-50">
            Escribir a {negocio!.name} por WhatsApp
          </a>
        )}
      </div>
    </div>
  );
}
