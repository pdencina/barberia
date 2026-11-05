"use client";

import { useEffect, useState } from "react";
import type { ResenaDestacada } from "@/lib/resenas-destacadas";

// Reseñas que van pasando solas, al pie de la página de reservas. Sobrio: una a la vez, con desvanecido.
export default function ResenasCarrusel({ tenantId }: { tenantId: string }) {
  const [items, setItems] = useState<ResenaDestacada[]>([]);
  const [i, setI] = useState(0);
  const [pausa, setPausa] = useState(false);

  useEffect(() => {
    if (!tenantId) return;
    fetch(`/api/public/resenas-destacadas?tenantId=${tenantId}`).then((r) => r.json()).then((d) => setItems(Array.isArray(d) ? d : [])).catch(() => {});
  }, [tenantId]);

  useEffect(() => {
    if (items.length < 2 || pausa) return;
    const t = setInterval(() => setI((x) => (x + 1) % items.length), 6000);
    return () => clearInterval(t);
  }, [items.length, pausa]);

  if (items.length === 0) return null;
  const r = items[i % items.length];
  return (
    <section className="mx-auto max-w-2xl px-4 pb-8 text-center" onMouseEnter={() => setPausa(true)} onMouseLeave={() => setPausa(false)} aria-label="Opiniones de clientes">
      <p className="text-[11px] font-semibold uppercase tracking-widest text-brand-gray">Lo que dicen nuestros clientes</p>
      <figure key={i} className="mx-auto mt-3 min-h-[92px] max-w-md animate-[fade-in_.6s_ease]">
        <div className="text-sm text-brand-blue" aria-label={`${r.rating} de 5 estrellas`}>{"★".repeat(r.rating)}<span className="text-gray-300">{"★".repeat(5 - r.rating)}</span></div>
        <blockquote className="mt-1.5 text-sm leading-relaxed text-brand-dark">“{r.texto}”</blockquote>
        <figcaption className="mt-1.5 text-xs text-brand-gray">{r.autor}</figcaption>
      </figure>
      {items.length > 1 && (
        <div className="mt-2 flex justify-center gap-1.5">
          {items.map((_, k) => <button key={k} type="button" onClick={() => setI(k)} aria-label={`Reseña ${k + 1}`} className={`h-1.5 rounded-full transition-all ${k === i ? "w-4 bg-brand-blue" : "w-1.5 bg-gray-300"}`} />)}
        </div>
      )}
    </section>
  );
}
