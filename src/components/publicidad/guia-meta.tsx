"use client";

import { Panel } from "@/components/ui/premium";

// Guia paso a paso para conectar el Pixel de Meta y medir cuantas reservas llegan por anuncios. Lenguaje simple, sin tecnicismos.
const PASOS: { titulo: string; items: string[] }[] = [
  {
    titulo: "A. Crear tu Píxel en Meta (una sola vez)",
    items: [
      "Entra a business.facebook.com con la cuenta de tu negocio y abre el «Administrador de eventos».",
      "Pulsa el botón verde «Conectar datos», elige «Web» y luego «Píxel de Meta».",
      "Ponle un nombre (por ejemplo, el de tu negocio) y escribe la dirección de tu página de reservas.",
      "Cuando termine, abre tu Píxel: bajo su nombre aparece su número (solo dígitos). Cópialo.",
      "Si ya tienes un Píxel creado, úsalo: no hace falta crear otro.",
    ],
  },
  {
    titulo: "B. Conectarlo en re-booking",
    items: [
      "En el paso 1 de esta pantalla, pega el número del Píxel y pulsa «Guardar». Debe aparecer un tic verde.",
      "Desde ese momento, tu página de reservas avisa a Meta cuando alguien entra y cuando confirma una reserva (evento «Programar»).",
      "Nunca se envía el nombre, el correo ni el teléfono del cliente, ni el servicio que reservó.",
      "La persona ve un aviso de cookies. Si lo rechaza, no se cuenta en Meta (pero sí aquí).",
    ],
  },
  {
    titulo: "C. Preparar tus anuncios",
    items: [
      "Crea tu anuncio en Meta y, como destino, usa el link de reservas del paso 2 (el primero, el corto).",
      "En el anuncio busca «Parámetros de URL» (están al final, junto al destino) y pega el texto del paso 2.",
      "Eso permite saber de qué campaña viene cada reserva. Si no lo pegas, la reserva llega igual pero no se sabe de qué anuncio.",
    ],
  },
  {
    titulo: "D. Comprobar que funciona (2 minutos)",
    items: [
      "En el Administrador de eventos, abre tu Píxel y entra a «Probar eventos». Elige «Sitio web».",
      "Pega el link de tu página de reservas y ábrelo desde ahí. Acepta las cookies.",
      "En la pantalla de Meta deben aparecer «PageView» y «Ver contenido». Al confirmar una reserva de prueba, aparece «Programar».",
      "Cancela después la reserva de prueba en tu calendario.",
      "Si no aparece nada, desactiva un momento el bloqueador de anuncios de tu navegador: a veces bloquea el Píxel.",
    ],
  },
  {
    titulo: "E. Leer los resultados",
    items: [
      "«Reservas por anuncios pagados»: las que llegaron por un anuncio con el texto del paso 2.",
      "«Por Instagram y otros links»: reservas que llegaron por el link de tu biografía u otros links sin pagar.",
      "En la tabla, cada fila es una campaña. «Clientes nuevos» son personas que reservaban por primera vez.",
      "En Meta (Administrador de anuncios) verás las reservas como «Programar»; sirve para que Meta muestre tus anuncios a personas parecidas a quienes reservan.",
    ],
  },
];

export default function GuiaMeta() {
  return (
    <Panel title="Guía paso a paso" subtitle="Cómo conectar tu Píxel de Meta y medir tus anuncios">
      <div className="space-y-2">
        {PASOS.map((p) => (
          <details key={p.titulo} className="group rounded-xl border border-gray-100 bg-white/50 px-4 py-3">
            <summary className="cursor-pointer text-sm font-semibold text-brand-dark">{p.titulo}</summary>
            <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-sm text-brand-gray">
              {p.items.map((t, i) => <li key={i}>{t}</li>)}
            </ol>
          </details>
        ))}
      </div>
    </Panel>
  );
}
