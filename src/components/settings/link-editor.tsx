"use client";

import { useEffect, useRef, useState } from "react";
import { Copy, Check } from "lucide-react";
import { useToast } from "@/components/ui/toast";
import { linkNegocio, linkProfesional, normalizarSlug, validarSlug } from "@/lib/slugs";

interface Props {
  tipo: "negocio" | "profesional";
  tenantId: string;
  slugActual: string;              // link actual (negocio o profesional)
  slugNegocio?: string;            // para el link del profesional
  barberId?: string;
  titulo: string;
  ayuda?: string;
  onGuardado?: (nuevo: string) => void;
}

// Editor de un link limpio: muestra el link completo, deja cambiar el nombre y avisa EN VIVO si está disponible.
export function LinkEditor({ tipo, tenantId, slugActual, slugNegocio, barberId, titulo, ayuda, onGuardado }: Props) {
  const { showToast } = useToast();
  const [editando, setEditando] = useState(false);
  const [valor, setValor] = useState(slugActual);
  const [estado, setEstado] = useState<null | { cargando?: boolean; disponible?: boolean; error?: string | null; alternativas?: string[] }>(null);
  const [guardando, setGuardando] = useState(false);
  const [copiado, setCopiado] = useState(false);
  const peticion = useRef(0);
  useEffect(() => { setValor(slugActual); }, [slugActual]);

  const completo = (s: string) => (tipo === "negocio" ? linkNegocio(s) : linkProfesional(slugNegocio || "negocio", s));
  const limpio = normalizarSlug(valor);
  const cambio = limpio !== slugActual;

  // Chequeo en vivo (espera 400 ms después de la última letra).
  useEffect(() => {
    if (!editando || !cambio) { setEstado(null); return; }
    const local = validarSlug(limpio);
    if (local) { setEstado({ disponible: false, error: local }); return; }
    setEstado({ cargando: true });
    const id = ++peticion.current;
    const espera = setTimeout(async () => {
      try {
        const q = new URLSearchParams({ tipo, valor: limpio, tenantId, ...(barberId ? { barberId } : {}) });
        const r = await fetch(`/api/settings/slug?${q}`, { cache: "no-store" });
        const d = await r.json().catch(() => ({}));
        if (id === peticion.current) setEstado(r.ok ? { disponible: !!d.disponible, error: d.error, alternativas: d.alternativas } : { disponible: false, error: d.error || "No se pudo revisar" });
      } catch { if (id === peticion.current) setEstado({ disponible: false, error: "No se pudo revisar" }); }
    }, 400);
    return () => clearTimeout(espera);
  }, [limpio, editando, cambio, tipo, tenantId, barberId]);

  const copiar = async () => { try { await navigator.clipboard.writeText(completo(slugActual)); setCopiado(true); setTimeout(() => setCopiado(false), 1500); } catch { showToast("No pude copiar; selecciónalo a mano", "error"); } };
  const guardar = async () => {
    if (!estado?.disponible || guardando) return;
    if (tipo === "negocio" && !window.confirm(`Tu link pasará a ser:\n${completo(limpio).replace(/^https?:\/\//, "")}\n\nEl link anterior seguirá funcionando y llevará al nuevo. ¿Cambiarlo?`)) return;
    setGuardando(true);
    try {
      const res = await fetch("/api/settings/slug", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tipo, valor: limpio, tenantId, barberId }) });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) { showToast(d?.error || "No se pudo cambiar el link", "error"); return; }
      showToast("Link actualizado", "success"); setEditando(false); onGuardado?.(d.slug);
    } finally { setGuardando(false); }
  };

  return (
    <div className="rounded-2xl border border-brand-blue/20 bg-brand-light p-4">
      <p className="mb-1.5 text-xs font-medium text-brand-gray">{titulo}</p>
      <div className="flex items-center gap-2">
        <code className="min-w-0 flex-1 truncate rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-brand-blue">{completo(slugActual).replace(/^https?:\/\//, "")}</code>
        <button type="button" onClick={copiar} className="flex flex-shrink-0 items-center gap-1 rounded-xl bg-brand-blue px-3 py-2 text-xs text-white hover:opacity-90">{copiado ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}{copiado ? "Copiado" : "Copiar"}</button>
        <button type="button" onClick={() => setEditando((e) => !e)} className="flex-shrink-0 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-brand-dark hover:bg-gray-50">{editando ? "Cancelar" : "Cambiar"}</button>
      </div>
      {ayuda && !editando && <p className="mt-2 text-[10px] text-brand-gray">{ayuda}</p>}
      {editando && (
        <div className="mt-3 space-y-2">
          <div className="flex items-center overflow-hidden rounded-xl border border-gray-200 bg-white focus-within:border-brand-blue">
            <span className="whitespace-nowrap bg-gray-50 px-3 py-2 text-xs text-brand-gray">{tipo === "negocio" ? "re-booking.cl/" : `re-booking.cl/${slugNegocio || "negocio"}/`}</span>
            <input value={valor} onChange={(e) => setValor(e.target.value.toLowerCase())} maxLength={40} aria-label="Nuevo nombre del link" placeholder="mi-negocio" className="min-w-0 flex-1 bg-transparent px-2 py-2 text-sm text-brand-dark outline-none" autoCapitalize="none" spellCheck={false} />
          </div>
          {valor && limpio !== valor && <p className="text-[11px] text-brand-gray">Se escribirá así: <b>{limpio || "—"}</b></p>}
          {cambio && estado?.cargando && <p className="text-xs text-brand-gray">Revisando…</p>}
          {cambio && estado && !estado.cargando && (estado.disponible
            ? <p className="text-xs font-semibold text-brand-blue">✓ Disponible: {completo(limpio).replace(/^https?:\/\//, "")}</p>
            : <div className="text-xs text-brand-dark"><p className="font-semibold">✕ {estado.error || "No disponible"}</p>{estado.alternativas && estado.alternativas.length > 0 && <p className="mt-1 text-brand-gray">Prueba: {estado.alternativas.map((a) => <button key={a} type="button" onClick={() => setValor(a)} className="mr-2 text-brand-blue underline">{a}</button>)}</p>}</div>)}
          <button type="button" onClick={guardar} disabled={!cambio || !estado?.disponible || guardando} className="rounded-xl bg-brand-blue px-4 py-2 text-xs font-semibold text-white disabled:opacity-40">{guardando ? "Guardando…" : "Guardar link"}</button>
        </div>
      )}
    </div>
  );
}
