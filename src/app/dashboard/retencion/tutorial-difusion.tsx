import { BookOpen } from "lucide-react";

const PASOS: { titulo: string; detalle: string[] }[] = [
  { titulo: "1. Elige a quién escribir", detalle: ["Marca un rango de días sin venir (por ejemplo 30–45) y desmarca a quien no quieras incluir.", "Si vas a dar un descuento, créalo en Cupones y selecciónalo en «Cupón a incluir»."] },
  { titulo: "2. Descarga los contactos", detalle: ["Aprieta «Descargar contactos». Baja un archivo con los marcados, nombrados como «RET 30-45 Nombre».", "Repite con cada rango que quieras (45–60, 60–90…): cada uno queda con su propia etiqueta."] },
  { titulo: "3. Pásalos al teléfono del negocio", detalle: ["iPhone: envía el archivo por AirDrop o correo, ábrelo y elige agregar todos los contactos.", "Android: ábrelo con la app Contactos para importarlo.", "A quien ya tenías guardado le puede quedar un contacto repetido."] },
  { titulo: "4. Crea la lista en WhatsApp Business", detalle: ["Se hace en el teléfono; en WhatsApp Web no se puede crear.", "iPhone: pestaña Chats → «Listas de difusión» → «Nueva lista». Android: Chats → menú ⋮ → «Nueva difusión».", "Busca la etiqueta (RET 30-45) y selecciónalos. Máximo 256 por lista."] },
  { titulo: "5. Envía el mensaje", detalle: ["Aprieta «Copiar para difusión» y pega en WhatsApp solo el texto que está bajo «MENSAJE».", "Agrega: «Si no quieres recibir promociones, responde BAJA»."] },
];

const CUIDADOS = [
  "El mensaje llega solo a quienes tengan tu número guardado en su teléfono.",
  "Parte con grupos chicos: muchos envíos seguidos pueden hacer que WhatsApp bloquee el número.",
  "Escribe solo a quienes aceptan promociones y marca en su ficha a quien pida no recibir más.",
  "La difusión necesita un número en la app de WhatsApp Business (no sirve uno conectado solo a la API).",
];

/** Guía para armar una lista de difusión (gratis) con los clientes de Retención. Cerrada por defecto. */
export function TutorialDifusion() {
  return (
    <details className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
      <summary className="flex cursor-pointer items-center gap-2 text-sm font-semibold">
        <BookOpen className="h-4 w-4 text-emerald-500" strokeWidth={2} /> Cómo enviar una promoción por lista de difusión de WhatsApp (gratis)
      </summary>
      <div className="mt-4 space-y-4 text-sm text-brand-gray">
        {PASOS.map((p) => (
          <div key={p.titulo}>
            <p className="font-semibold">{p.titulo}</p>
            <ul className="mt-1 list-disc space-y-1 pl-5">{p.detalle.map((d) => <li key={d}>{d}</li>)}</ul>
          </div>
        ))}
        <div>
          <p className="font-semibold">Antes de enviar</p>
          <ul className="mt-1 list-disc space-y-1 pl-5">{CUIDADOS.map((d) => <li key={d}>{d}</li>)}</ul>
        </div>
      </div>
    </details>
  );
}
