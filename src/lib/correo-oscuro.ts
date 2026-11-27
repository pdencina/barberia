// Diseño «Oscuro» (blanco y negro) para el correo de una promoción o invitación: logo del negocio sobre negro (re-booking pequeño al pie),
// imagen grande, titular, texto, las condiciones en un recuadro transparente y botón blanco, sobre un fondo con formas suaves. Todo el texto llega aquí YA escapado.

import { coloresLegibles, mezcla, sobre, type ColoresCorreo } from "@/lib/correo-colores";

export type DisenoCorreo = "clasico" | "oscuro";

/** Lo que llega del navegador sobre el diseño del correo, ya acotado. Sin nada, queda el correo de siempre. */
export function estiloCorreo(body: any): { design: DisenoCorreo; subject: string; title: string; logoFondo: boolean; colores: ColoresCorreo | null } {
  const texto = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/[\r\n]+/g, " ").trim().slice(0, max) : "");
  // «Mis colores» usa la misma distribución del diseño oscuro con los colores elegidos.
  const colores = body?.design === "colores" ? coloresLegibles(body?.colores) : null;
  return { colores, design: body?.design === "oscuro" || colores ? "oscuro" : "clasico", subject: texto(body?.subject, 120), title: texto(body?.title, 80), logoFondo: body?.logoFondo === true };
}

/** Separa el mensaje del bloque «Condiciones:» (cada línea «• dato» pasa a ser un recuadro). */
export function separarCondiciones(mensaje: string): { texto: string; datos: string[] } {
  const i = mensaje.indexOf("Condiciones:\n");
  if (i < 0) return { texto: mensaje.trim(), datos: [] };
  const datos = mensaje.slice(i).split("\n").slice(1).map((l) => l.replace(/^•\s*/, "").trim()).filter(Boolean);
  return { texto: mensaje.slice(0, i).trim(), datos };
}

/** *palabra* en el mensaje = negrita (igual que en WhatsApp). Recibe texto ya escapado. */
export const negritas = (html: string, estilo = "font-weight:800;") => html.replace(/\*([^*\n<>]{1,80})\*/g, `<b style="${estilo}">$1</b>`);

/** Nombre de pila con mayúscula inicial: «nicolas perez» -> «Nicolas». Deja igual el marcador de la vista previa. */
export function nombrePila(n: string): string {
  const t = n.trim();
  if (!t || t.startsWith("[")) return t;
  const p = t.split(/\s+/)[0].toLocaleLowerCase("es-CL");
  return p.charAt(0).toLocaleUpperCase("es-CL") + p.slice(1);
}

// Una condición: la etiqueta delgada y el dato en negrita; en frases sin «:» se resaltan las fechas.
function lineaDato(h: string, texto: string, suave: string): string {
  const fuerte = (t: string) => `<span style="font-weight:700;color:${texto};">${t}</span>`;
  const i = h.indexOf(": ");
  if (i > 0) return `<span style="font-weight:300;color:${suave};">${h.slice(0, i + 1)}</span> ${fuerte(h.slice(i + 2))}`;
  return `<span style="font-weight:300;color:${suave};">${h.replace(/\d{2}\/\d{2}\/\d{4}/g, (f) => fuerte(f))}</span>`;
}

export function plantillaOscura(o: {
  logoNegocio: string | null; logoFondo?: boolean; titulo: string; saludo: string; textoHtml: string; imagen: string | null;
  colores?: ColoresCorreo | null; datosHtml: string[]; cupon: { codigo: string; detalle: string } | null; boton: { url: string; texto: string };
}): string {
  // Montserrat donde el correo permite fuentes web (Apple Mail); en Gmail se usa la del teléfono, con los mismos pesos.
  const fuente = "Montserrat, -apple-system, Roboto, 'Segoe UI', Helvetica, Arial, sans-serif";
  // Sin colores propios queda el blanco y negro de siempre, con su fondo de formas.
  const c = o.colores || null;
  const base = c?.fondo || "#000000";
  const tinta = c?.texto || "#FFFFFF";
  const parrafo = c ? mezcla(tinta, base, 0.88) : "#D6D6DC";
  const suave = c ? mezcla(tinta, base, 0.75) : "#BDBDC4";
  const tarjeta = c?.fondo || "#0B0B0C";
  const marco = c ? mezcla(tinta, base, 0.14) : "#1F1F22";
  const caja = c ? mezcla(tinta, base, 0.05) : "#19191B";
  const linea = c ? mezcla(tinta, base, 0.16) : "rgba(255,255,255,0.12)";
  const boton = c?.boton || "#FFFFFF";
  const textoBoton = c ? sobre(boton) : "#0A0A0A";
  const claro = !!c && sobre(base) === "#111111";
  const imagenFondo = c ? "" : "https://www.re-booking.cl/correo/fondo-oscuro.png";
  const recuadroLogo = claro ? "#111111" : "#FFFFFF";
  // Protagonista: el logo del negocio, directo sobre el negro (si es oscuro, el negocio activa el fondo blanco).
  // re-booking va pequeño y en blanco al pie. Si el negocio no tiene logo, no se pone nada arriba.
  const logoArriba = o.logoNegocio
    ? `<img src="${o.logoNegocio}" alt="Logo del negocio" height="56" style="display:inline-block;height:56px;max-width:220px;width:auto;border:0;${o.logoFondo ? `background:${recuadroLogo};border-radius:12px;padding:6px 14px;` : ""}">`
    : "";
  const firma = claro ? `<div data-rb-powered="1" style="padding-top:18px;color:${suave};font-size:11px;">Enviado con <b>re-booking</b></div>` : `<div data-rb-powered="1" style="padding-top:18px;"><span style="color:${c ? suave : "#6B6B73"};font-size:11px;vertical-align:middle;">Enviado con&nbsp;</span><img src="https://www.re-booking.cl/logo-horizontal-white.png" alt="re-booking" width="72" height="18" style="display:inline-block;vertical-align:middle;width:72px;height:18px;border:0;opacity:0.55;"></div>`;
  // Todas las condiciones en UN recuadro transparente (una línea cada una), con letras claras.
  const fila = (h: string, i: number) => `<tr><td align="center" style="padding:9px 14px;color:${tinta};font-size:13px;line-height:1.45;${i ? `border-top:1px solid ${linea};` : ""}">${lineaDato(h, tinta, suave)}</td></tr>`;
  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="${claro ? "light" : "dark"}">
<meta name="supported-color-schemes" content="${claro ? "light" : "dark"}">
<link href="https://fonts.googleapis.com/css2?family=Montserrat:ital,wght@0,300;0,400;0,700;0,800;1,300;1,800&display=swap" rel="stylesheet">
</head>
<body bgcolor="${base}" style="margin:0;padding:0;background:${base};font-family:${fuente};-webkit-text-size-adjust:100%;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${base}" style="background:${base};">
  <tr><td align="center" style="padding:24px 12px;">
    <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" bgcolor="${tarjeta}"${imagenFondo ? ` background="${imagenFondo}"` : ""} style="width:100%;max-width:600px;background-color:${tarjeta};${imagenFondo ? `background-image:url('${imagenFondo}');background-repeat:repeat-y;background-position:top center;background-size:100% auto;` : ""}border:1px solid ${marco};border-radius:20px;font-family:${fuente};">
      ${logoArriba ? `<tr><td align="center" style="padding:18px 20px 14px;">${logoArriba}</td></tr>` : `<tr><td style="height:16px;font-size:0;line-height:0;">&nbsp;</td></tr>`}
      ${o.imagen ? `<tr><td style="padding:0 16px;"><img src="${o.imagen}" alt="${o.titulo || "Promoción"}" width="100%" style="display:block;width:100%;max-width:100%;height:auto;border-radius:16px;"></td></tr>` : ""}
      <tr><td align="center" style="padding:16px 28px 0;">
        ${o.titulo ? `<div style="color:${tinta};font-size:28px;line-height:1.1;font-weight:800;text-transform:uppercase;letter-spacing:-0.01em;margin-bottom:12px;">${o.titulo}</div>` : ""}
        <div style="color:${tinta};font-size:22px;line-height:1.2;font-weight:800;text-transform:uppercase;margin-bottom:8px;">${o.saludo}</div>
        <div style="color:${parrafo};font-size:14px;line-height:1.6;font-weight:${c ? 400 : 300};">${negritas(o.textoHtml, `font-weight:700;color:${tinta};`)}</div>
      </td></tr>
      ${o.datosHtml.length ? `<tr><td style="padding:16px 24px 0;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${caja}" style="background:${caja};${c ? "" : "background:rgba(255,255,255,0.06);"}border:1px solid ${c ? linea : "rgba(255,255,255,0.16)"};border-radius:14px;">${o.datosHtml.map(fila).join("")}</table></td></tr>` : ""}
      ${o.cupon ? `<tr><td style="padding:10px 24px 0;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td align="center" style="border:2px dashed ${c ? tinta : "rgba(255,255,255,0.75)"};border-radius:14px;padding:12px;">
        <div style="color:${suave};font-size:11px;letter-spacing:0.32em;text-transform:uppercase;font-weight:300;font-style:italic;">Tu código</div>
        <div style="color:${tinta};font-size:24px;font-weight:800;font-family:monospace;margin-top:3px;">${o.cupon.codigo}</div>
        ${o.cupon.detalle ? `<div style="color:${tinta};font-size:13px;margin-top:4px;font-weight:300;letter-spacing:0.12em;text-transform:uppercase;">${o.cupon.detalle}</div>` : ""}
      </td></tr></table></td></tr>` : ""}
      <tr><td align="center" style="padding:16px 28px 22px;"><a href="${o.boton.url}" style="display:inline-block;background:${boton};color:${textoBoton};text-decoration:none;padding:15px 44px;border-radius:999px;font-weight:800;font-style:italic;font-size:15px;letter-spacing:0.04em;text-transform:uppercase;">${o.boton.texto}</a></td></tr>
    </table>
    ${firma}
  </td></tr>
</table>
</body>
</html>`;
}
