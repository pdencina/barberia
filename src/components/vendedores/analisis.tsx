"use client";

// Analisis del embudo de ventas: donde se pierde la gente, cuando llegan y con que aparato. Se usa en la pagina del vendedor y en Super Admin.
export type Analisis = {
  visitas: number; pagaron: number; errores: number; mejoresHoras: string[];
  embudo: { paso: string; etiqueta: string; visitas: number; pasanDelAnterior: number | null; seQuedan: number }[];
  mayorCaida: { entre: string; seQuedan: number; pct: number } | null;
  horas: { hora: number; visitas: number; pagos: number }[];
  dias: { nombre: string; visitas: number; pagos: number }[];
  dispositivos: { nombre: string; cantidad: number }[]; sistemas: { nombre: string; cantidad: number }[];
  navegadores: { nombre: string; cantidad: number }[]; ciudades: { nombre: string; cantidad: number }[]; planes: { nombre: string; cantidad: number }[];
};

function Lista({ titulo, items, total }: { titulo: string; items: { nombre: string; cantidad: number }[]; total: number }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4">
      <p className="mb-2 text-sm font-semibold text-brand-dark">{titulo}</p>
      {items.length === 0 ? <p className="text-xs text-brand-gray">Sin datos todavía.</p> : (
        <ul className="space-y-1.5 text-sm">
          {items.map((i) => (
            <li key={i.nombre}>
              <div className="flex justify-between"><span className="text-brand-dark">{i.nombre}</span><span className="text-brand-gray">{i.cantidad} · {total ? Math.round((i.cantidad / total) * 100) : 0}%</span></div>
              <div className="mt-0.5 h-1.5 rounded-full bg-gray-100"><div className="h-1.5 rounded-full bg-brand-blue" style={{ width: `${total ? (i.cantidad / total) * 100 : 0}%` }} /></div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function AnalisisEmbudo({ a }: { a: Analisis | null }) {
  if (!a) return <p className="rounded-2xl border border-gray-200 bg-white p-4 text-sm text-brand-gray">El análisis aparecerá cuando lleguen las primeras visitas con el link.</p>;
  const maxHora = Math.max(1, ...a.horas.map((h) => h.visitas));
  const maxDia = Math.max(1, ...a.dias.map((d) => d.visitas));
  const base = a.embudo[0]?.visitas || 0;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="rounded-2xl border border-gray-200 bg-white p-3"><p className="text-2xl font-bold text-brand-dark">{a.visitas}</p><p className="text-[11px] text-brand-gray">Visitas con link</p></div>
        <div className="rounded-2xl border border-gray-200 bg-white p-3"><p className="text-2xl font-bold text-brand-dark">{a.pagaron}</p><p className="text-[11px] text-brand-gray">Pagaron</p></div>
        <div className="rounded-2xl border border-gray-200 bg-white p-3"><p className="text-2xl font-bold text-brand-dark">{a.visitas ? Math.round((a.pagaron / a.visitas) * 1000) / 10 : 0}%</p><p className="text-[11px] text-brand-gray">De visita a pago</p></div>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-4">
        <p className="text-sm font-semibold text-brand-dark">Dónde se queda la gente</p>
        <p className="mb-3 text-xs text-brand-gray">Cada barra son personas distintas que llegaron a ese paso.</p>
        <ul className="space-y-2.5">
          {a.embudo.map((f) => (
            <li key={f.paso}>
              <div className="flex justify-between text-sm"><span className="text-brand-dark">{f.etiqueta}</span><span className="font-semibold text-brand-dark">{f.visitas}</span></div>
              <div className="mt-0.5 h-2 rounded-full bg-gray-100"><div className="h-2 rounded-full bg-brand-blue" style={{ width: `${base ? Math.min(100, (f.visitas / base) * 100) : 0}%` }} /></div>
              {f.pasanDelAnterior != null && <p className="mt-0.5 text-[11px] text-brand-gray">{f.pasanDelAnterior}% pasa del paso anterior{f.seQuedan > 0 ? ` · se quedan ${f.seQuedan}` : ""}</p>}
            </li>
          ))}
        </ul>
        {a.mayorCaida && <p className="mt-3 rounded-xl bg-amber-50 p-3 text-xs text-amber-900"><b>Donde más se pierde:</b> entre «{a.mayorCaida.entre}» se queda el {a.mayorCaida.pct}% ({a.mayorCaida.seQuedan} personas). Ahí hay que mejorar primero.</p>}
        {a.errores > 0 && <p className="mt-2 text-xs text-red-700">{a.errores} personas vieron un error al intentar pagar.</p>}
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-4">
        <p className="text-sm font-semibold text-brand-dark">Horarios más fuertes (hora de Chile)</p>
        {a.mejoresHoras.length > 0 && <p className="mb-2 text-xs text-brand-gray">Llegan más a las {a.mejoresHoras.join(", ")}.</p>}
        <div className="flex h-24 items-end gap-0.5">
          {a.horas.map((h) => <div key={h.hora} title={`${String(h.hora).padStart(2, "0")}:00 · ${h.visitas} visitas · ${h.pagos} pagos`} className="flex-1 rounded-t bg-brand-blue/80" style={{ height: `${Math.max(2, (h.visitas / maxHora) * 100)}%` }} />)}
        </div>
        <div className="mt-1 flex justify-between text-[10px] text-brand-gray"><span>0h</span><span>6h</span><span>12h</span><span>18h</span><span>23h</span></div>
        <ul className="mt-3 grid grid-cols-7 gap-1 text-center text-[11px]">
          {a.dias.map((d) => <li key={d.nombre}><div className="mx-auto flex h-12 w-5 items-end"><div className="w-full rounded-t bg-emerald-500/80" style={{ height: `${Math.max(4, (d.visitas / maxDia) * 100)}%` }} /></div><span className="text-brand-gray">{d.nombre.slice(0, 3)}</span><b className="block text-brand-dark">{d.visitas}</b></li>)}
        </ul>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Lista titulo="Aparato" items={a.dispositivos} total={a.visitas} />
        <Lista titulo="Sistema" items={a.sistemas} total={a.visitas} />
        <Lista titulo="Navegador o app" items={a.navegadores} total={a.visitas} />
        <Lista titulo="Ciudad (aproximada)" items={a.ciudades} total={a.visitas} />
      </div>
      <Lista titulo="Planes que eligen" items={a.planes} total={a.planes.reduce((x, p) => x + p.cantidad, 0)} />

      <p className="rounded-2xl border border-gray-200 bg-white p-3 text-[11px] text-brand-gray">Edad y sexo no se pueden saber desde el link: no se les pregunta a las personas. Solo se miden con anuncios dentro de Meta (Administrador de anuncios → Desglose → Edad). Los datos son anónimos: no guardan correo, teléfono ni nombre. No cuentan quienes rechazan las cookies.</p>
    </div>
  );
}
