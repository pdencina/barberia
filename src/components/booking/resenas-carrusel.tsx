"use client";

import { useEffect, useState } from "react";
import type { ResenaDestacada } from "@/lib/resenas-destacadas";

interface Datos { items: ResenaDestacada[]; googleUrl: string | null; googleRating: number | null; googleTotal: number | null }

const Estrellas = ({ n }: { n: number }) => (
  <span className="text-[13px] tracking-tight text-brand-blue" aria-label={`${n} de 5 estrellas`}>{"★".repeat(n)}<span className="text-gray-200">{"★".repeat(5 - n)}</span></span>
);

const LogoGoogle = () => (
  <svg viewBox="0 0 48 48" className="h-3.5 w-3.5" aria-hidden="true">
    <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.6 17.7 9.5 24 9.5z"/>
    <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.5 5.8c4.4-4.1 7.1-10.1 7.1-17.5z"/>
    <path fill="#FBBC05" d="M10.5 28.7c-.5-1.5-.8-3-.8-4.7s.3-3.2.8-4.7l-7.9-6.1C.9 16.5 0 20.1 0 24s.9 7.5 2.6 10.8l7.9-6.1z"/>
    <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.5-5.8c-2.1 1.4-4.9 2.3-8.4 2.3-6.3 0-11.6-4.1-13.5-9.8l-7.9 6.1C6.5 42.6 14.6 48 24 48z"/>
  </svg>
);

function Tarjeta({ r }: { r: ResenaDestacada }) {
  const google = r.origen === "google";
  return (
    <figure className="flex h-full flex-col rounded-2xl border border-gray-100 bg-white p-4 text-left shadow-sm">
      <div className="flex items-center gap-2.5">
        {r.foto
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={r.foto} alt="" referrerPolicy="no-referrer" className="h-9 w-9 flex-shrink-0 rounded-full object-cover" />
          : <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-brand-blue/10 text-sm font-bold text-brand-blue">{r.autor.charAt(0).toUpperCase()}</span>}
        <div className="min-w-0">
          <figcaption className="truncate text-sm font-semibold text-brand-dark">{r.autor}</figcaption>
          <Estrellas n={r.rating} />
        </div>
      </div>
      <blockquote className="mt-2.5 line-clamp-4 flex-1 text-[13px] leading-relaxed text-brand-gray">“{r.texto}”</blockquote>
      <div className="mt-3 flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-brand-gray/80">
        {google ? <><LogoGoogle /> Google Maps</> : <><span className="text-brand-blue">●</span> re-booking</>}
      </div>
    </figure>
  );
}

// Reseñas al pie de la página de reservas: desfilan solas hacia el lado (3 a la vez, 1 en celular). Se puede ir atrás, adelante y pausar.
export default function ResenasCarrusel({ tenantId }: { tenantId: string }) {
  const [d, setD] = useState<Datos | null>(null);
  const [i, setI] = useState(0);
  const [jugando, setJugando] = useState(true);
  const [animar, setAnimar] = useState(true);
  const [visibles, setVisibles] = useState(3);

  useEffect(() => {
    if (!tenantId) return;
    fetch(`/api/public/resenas-destacadas?tenantId=${tenantId}`).then((r) => r.json()).then((x) => setD(x && Array.isArray(x.items) ? x : null)).catch(() => {});
  }, [tenantId]);

  useEffect(() => {
    const f = () => setVisibles(window.innerWidth >= 768 ? 3 : 1);
    f(); window.addEventListener("resize", f);
    return () => window.removeEventListener("resize", f);
  }, []);

  const items = d?.items || [];
  const n = items.length;
  const mueve = n > visibles;
  // La pista lleva copias de las primeras tarjetas al final: al llegar ahí salta al inicio sin que se note.
  const pista = mueve ? [...items, ...items.slice(0, visibles)] : items;

  const ir = (delta: number) => {
    if (!mueve) return;
    if (delta > 0) { setAnimar(true); setI((x) => x + 1); }
    else if (i === 0) { setAnimar(false); setI(n); setTimeout(() => { setAnimar(true); setI(n - 1); }, 30); }
    else { setAnimar(true); setI((x) => x - 1); }
  };

  useEffect(() => {
    if (!mueve || !jugando) return;
    const t = setInterval(() => { setAnimar(true); setI((x) => x + 1); }, 4000);
    return () => clearInterval(t);
  }, [mueve, jugando]);

  // Al terminar el deslizamiento hacia las copias del final, vuelve al inicio sin animación.
  const alTerminar = () => { if (mueve && i >= n) { setAnimar(false); setI(0); } };

  if (!d || (n === 0 && !d.googleUrl)) return null;
  const actual = n ? i % n : 0;
  const boton = "flex h-8 w-8 items-center justify-center rounded-full border border-gray-200 bg-white text-brand-gray shadow-sm transition-colors hover:border-brand-blue hover:text-brand-blue";
  return (
    <section className="mx-auto max-w-4xl px-4 pb-10 text-center" aria-label="Opiniones de clientes">
      <p className="text-[11px] font-semibold uppercase tracking-widest text-brand-gray">Lo que dicen nuestros clientes</p>
      {d.googleRating && (
        <p className="mt-1 flex items-center justify-center gap-1.5 text-xs text-brand-gray">
          <LogoGoogle /> <b className="text-brand-dark">{d.googleRating.toFixed(1).replace(".", ",")}</b> ★{d.googleTotal ? ` · ${d.googleTotal} reseñas en Google Maps` : ""}
        </p>
      )}
      {n > 0 && (
        <div className="mt-4 overflow-hidden">
          <div className="flex" onTransitionEnd={alTerminar}
            style={{ transform: `translateX(-${(i * 100) / visibles}%)`, transition: animar ? "transform .7s ease" : "none" }}>
            {pista.map((r, k) => (
              <div key={k} className="flex-shrink-0 px-1.5" style={{ width: `${100 / visibles}%` }}><Tarjeta r={r} /></div>
            ))}
          </div>
        </div>
      )}
      {mueve && (
        <div className="mt-3 flex items-center justify-center gap-3">
          <button type="button" onClick={() => ir(-1)} aria-label="Reseña anterior" className={boton}>‹</button>
          <button type="button" onClick={() => setJugando((v) => !v)} aria-label={jugando ? "Pausar" : "Reanudar"} className={boton}>
            {jugando
              ? <svg viewBox="0 0 16 16" className="h-3 w-3" fill="currentColor"><rect x="3" y="2" width="3.5" height="12" rx="1" /><rect x="9.5" y="2" width="3.5" height="12" rx="1" /></svg>
              : <svg viewBox="0 0 16 16" className="h-3 w-3" fill="currentColor"><path d="M4 2l10 6-10 6z" /></svg>}
          </button>
          <button type="button" onClick={() => ir(1)} aria-label="Reseña siguiente" className={boton}>›</button>
        </div>
      )}
      {mueve && (
        <div className="mt-2.5 flex justify-center gap-1.5">
          {items.map((_, k) => <button key={k} type="button" onClick={() => { setAnimar(true); setI(k); }} aria-label={`Ir a la reseña ${k + 1}`} className={`h-1.5 rounded-full transition-all ${k === actual ? "w-4 bg-brand-blue" : "w-1.5 bg-gray-300"}`} />)}
        </div>
      )}
      {d.googleUrl && (
        <a href={d.googleUrl} target="_blank" rel="noopener noreferrer"
          className="mt-4 inline-flex items-center gap-2 rounded-full border border-brand-blue/30 px-4 py-2 text-xs font-semibold text-brand-blue transition-colors hover:bg-brand-blue hover:text-white">
          Deja tu reseña aquí
        </a>
      )}
    </section>
  );
}
