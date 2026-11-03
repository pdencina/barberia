"use client";

import { useEffect, useState } from "react";
import { Mic, Copy, Check } from "lucide-react";
import { useToast } from "@/components/ui/toast";

// Guía + llave personal para anotar gastos hablando, con un Atajo del iPhone. La llave solo sirve para anotar TUS gastos personales.
export function AtajoVoz() {
  const { showToast } = useToast();
  const [abierto, setAbierto] = useState(false);
  const [estado, setEstado] = useState<{ activa: boolean; ultimoUso: string | null; migracionPendiente?: boolean } | null>(null);
  const [llave, setLlave] = useState<string | null>(null);
  const [copiado, setCopiado] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const url = typeof window !== "undefined" ? `${window.location.origin}/api/personal/voz` : "https://www.re-booking.cl/api/personal/voz";

  const cargar = () => fetch("/api/personal/voz/llave", { cache: "no-store" }).then((r) => r.json()).then(setEstado).catch(() => setEstado({ activa: false, ultimoUso: null }));
  useEffect(() => { if (abierto && !estado) cargar(); }, [abierto, estado]);

  const generar = async () => {
    if (estado?.activa && !window.confirm("Ya tienes una llave. Si generas otra, la anterior deja de funcionar y tendrás que actualizar el Atajo. ¿Continuar?")) return;
    setOcupado(true);
    try {
      const r = await fetch("/api/personal/voz/llave", { method: "POST" });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { showToast(d?.error || "No se pudo generar", "error"); return; }
      setLlave(d.llave); cargar();
    } finally { setOcupado(false); }
  };
  const revocar = async () => {
    if (!window.confirm("¿Desactivar el Atajo de voz? Dejará de funcionar hasta que generes otra llave.")) return;
    const r = await fetch("/api/personal/voz/llave", { method: "DELETE" });
    if (r.ok) { setLlave(null); showToast("Atajo desactivado", "success"); cargar(); } else showToast("No se pudo desactivar", "error");
  };
  const copiar = async (txt: string, id: string) => { try { await navigator.clipboard.writeText(txt); setCopiado(id); setTimeout(() => setCopiado(null), 1500); } catch { showToast("No pude copiar; selecciónalo a mano", "error"); } };
  const Copiar = ({ txt, id }: { txt: string; id: string }) => (
    <button type="button" onClick={() => copiar(txt, id)} className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-2 py-1 text-[11px] font-semibold text-brand-dark hover:bg-gray-50">
      {copiado === id ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />} {copiado === id ? "Copiado" : "Copiar"}
    </button>
  );

  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm md:p-5">
      <button type="button" onClick={() => setAbierto(!abierto)} className="flex w-full items-center justify-between gap-3 text-left">
        <span className="flex items-center gap-2"><Mic className="h-4 w-4 text-brand-blue" /><span className="font-bold text-brand-dark">Anotar gastos con tu voz (iPhone)</span></span>
        <span className="text-xs font-semibold text-brand-blue">{abierto ? "Ocultar" : "Ver cómo"}</span>
      </button>
      {abierto && (
        <div className="mt-4 space-y-4 text-sm text-brand-dark">
          <p className="text-xs text-brand-gray">Con un Atajo de Apple dices «compré pan, me salió mil quinientos» y queda en tus gastos personales, sin abrir la app. Siempre te pregunta antes de anotar. La llave solo sirve para esto: no da acceso a nada más.</p>
          {estado?.migracionPendiente && <p className="rounded-xl bg-amber-50 p-3 text-xs text-amber-700">Falta una actualización de la base de datos (migración 125).</p>}

          <div className="space-y-2">
            <p className="font-semibold">Paso 1 · Tu llave</p>
            {llave ? (
              <div className="space-y-2 rounded-xl border border-amber-200 bg-amber-50 p-3">
                <p className="text-xs text-amber-800">Cópiala ahora: <b>no se vuelve a mostrar</b>. No la compartas.</p>
                <div className="flex items-center gap-2"><code className="min-w-0 flex-1 break-all rounded bg-white px-2 py-1 text-[11px]">{llave}</code><Copiar txt={llave} id="llave" /></div>
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-2">
                <button type="button" onClick={generar} disabled={ocupado || !!estado?.migracionPendiente} className="rounded-xl bg-brand-blue px-3 py-2 text-xs font-bold text-white disabled:opacity-50">{estado?.activa ? "Generar llave nueva" : "Generar mi llave"}</button>
                {estado?.activa && <button type="button" onClick={revocar} className="rounded-xl border border-gray-200 px-3 py-2 text-xs font-semibold text-red-600">Desactivar</button>}
                {estado?.activa && <span className="text-[11px] text-brand-gray">Llave activa{estado.ultimoUso ? ` · último uso ${new Date(estado.ultimoUso).toLocaleDateString("es-CL")}` : " · aún sin usar"}</span>}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <p className="font-semibold">Paso 2 · Crear el Atajo en tu iPhone</p>
            <ol className="list-decimal space-y-2 pl-5 text-xs leading-relaxed">
              <li>Abre la app <b>Atajos</b> › toca <b>+</b> (arriba a la derecha) › ponle de nombre <b>Anotar gasto</b>.</li>
              <li>Agrega la acción <b>Dictar texto</b>. Idioma: <b>Español (Chile)</b>. Déjala en «Detener al pausar».</li>
              <li>Agrega <b>Obtener contenido de URL</b>. En la URL pega: <span className="inline-flex items-center gap-1 align-middle"><code className="break-all rounded bg-gray-100 px-1">{url}</code><Copiar txt={url} id="url" /></span></li>
              <li>Toca la flecha de esa acción y configura: <b>Método = POST</b>. En <b>Encabezados</b> agrega <code className="rounded bg-gray-100 px-1">Authorization</code> con valor <code className="rounded bg-gray-100 px-1">Bearer</code> + espacio + tu llave. En <b>Cuerpo de la solicitud = JSON</b> agrega un campo <b>Texto</b> llamado <code className="rounded bg-gray-100 px-1">texto</code> y como valor elige la variable <b>Texto dictado</b>.</li>
              <li>Agrega <b>Obtener valor del diccionario</b> › clave <code className="rounded bg-gray-100 px-1">mensaje</code>.</li>
              <li>Agrega <b>Mostrar alerta</b> con ese valor como mensaje (tiene los botones «Cancelar» y «OK»: si cancelas, no se anota nada).</li>
              <li>Agrega otro <b>Obtener contenido de URL</b>, igual que el primero (misma URL, POST y encabezado), pero en el cuerpo suma un campo <b>Booleano</b> llamado <code className="rounded bg-gray-100 px-1">confirmar</code> en <b>verdadero</b>.</li>
              <li>Agrega <b>Obtener valor del diccionario</b> (clave <code className="rounded bg-gray-100 px-1">mensaje</code>) y luego <b>Mostrar notificación</b> con ese valor. Listo.</li>
            </ol>
          </div>

          <div className="space-y-1">
            <p className="font-semibold">Paso 3 · Cómo lo abres sin entrar a la app</p>
            <ul className="list-disc space-y-1 pl-5 text-xs leading-relaxed">
              <li><b>Siri:</b> di «Oye Siri, Anotar gasto».</li>
              <li><b>Botón de Acción</b> (iPhone 15 Pro o más nuevo): Ajustes › Botón de acción › Atajo › elige «Anotar gasto».</li>
              <li><b>Toque en la parte trasera:</b> Ajustes › Accesibilidad › Tocar › Toque trasero › elige «Anotar gasto».</li>
              <li><b>Centro de control:</b> mantén presionado un espacio vacío › Añadir un control › Atajos › «Anotar gasto».</li>
            </ul>
          </div>
          <p className="text-[11px] text-brand-gray">Prueba diciendo: «Cargué bencina, me salió cuarenta y cinco mil» (si el iPhone escribe el monto con letras y Oti no lo entiende, dilo con cifras: «45 mil»).</p>
        </div>
      )}
    </div>
  );
}
