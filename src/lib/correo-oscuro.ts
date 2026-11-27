// Diseño «Oscuro» (blanco y negro) para el correo de una promoción o invitación: logo del negocio sobre negro (re-booking pequeño al pie),
// imagen grande, titular, texto, las condiciones en un recuadro transparente y botón blanco, sobre un fondo con formas suaves. Todo el texto llega aquí YA escapado.

export type DisenoCorreo = "clasico" | "oscuro";

/** Lo que llega del navegador sobre el diseño del correo, ya acotado. Sin nada, queda el correo de siempre. */
export function estiloCorreo(body: any): { design: DisenoCorreo; subject: string; title: string; logoFondo: boolean } {
  const texto = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/[\r\n]+/g, " ").trim().slice(0, max) : "");
  return { design: body?.design === "oscuro" ? "oscuro" : "clasico", subject: texto(body?.subject, 120), title: texto(body?.title, 80), logoFondo: body?.logoFondo === true };
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
function lineaDato(h: string): string {
  const fuerte = (t: string) => `<span style="font-weight:700;color:#FFFFFF;">${t}</span>`;
  const i = h.indexOf(": ");
  if (i > 0) return `<span style="font-weight:300;color:#BDBDC4;">${h.slice(0, i + 1)}</span> ${fuerte(h.slice(i + 2))}`;
  return `<span style="font-weight:300;color:#BDBDC4;">${h.replace(/\d{2}\/\d{2}\/\d{4}/g, (f) => fuerte(f))}</span>`;
}

export function plantillaOscura(o: {
  logoNegocio: string | null; logoFondo?: boolean; titulo: string; saludo: string; textoHtml: string; imagen: string | null;
  datosHtml: string[]; cupon: { codigo: string; detalle: string } | null; boton: { url: string; texto: string };
}): string {
  // Montserrat donde el correo permite fuentes web (Apple Mail); en Gmail se usa la del teléfono, con los mismos pesos.
  const fuente = "Montserrat, -apple-system, Roboto, 'Segoe UI', Helvetica, Arial, sans-serif";
  const fondo = "https://www.re-booking.cl/correo/fondo-oscuro.png";
  // Protagonista: el logo del negocio, directo sobre el negro (si es oscuro, el negocio activa el fondo blanco).
  // re-booking va pequeño y en blanco al pie. Si el negocio no tiene logo, no se pone nada arriba.
  const logoArriba = o.logoNegocio
    ? `<img src="${o.logoNegocio}" alt="Logo del negocio" height="56" style="display:inline-block;height:56px;max-width:220px;width:auto;border:0;${o.logoFondo ? "background:#FFFFFF;border-radius:12px;padding:6px 14px;" : ""}">`
    : "";
  const firma = `<div data-rb-powered="1" style="padding-top:18px;"><span style="color:#6B6B73;font-size:11px;vertical-align:middle;">Enviado con&nbsp;</span><img src="https://www.re-booking.cl/logo-horizontal-white.png" alt="re-booking" width="72" height="18" style="display:inline-block;vertical-align:middle;width:72px;height:18px;border:0;opacity:0.55;"></div>`;
  // Todas las condiciones en UN recuadro transparente (una línea cada una), con letras claras.
  const fila = (h: string, i: number) => `<tr><td align="center" style="padding:9px 14px;color:#FFFFFF;font-size:13px;line-height:1.45;${i ? "border-top:1px solid rgba(255,255,255,0.12);" : ""}">${lineaDato(h)}</td></tr>`;
  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="dark">
<meta name="supported-color-schemes" content="dark">
<link href="https://fonts.googleapis.com/css2?family=Montserrat:ital,wght@0,300;0,400;0,700;0,800;1,300;1,800&display=swap" rel="stylesheet">
</head>
<body bgcolor="#000000" style="margin:0;padding:0;background:#000000;font-family:${fuente};-webkit-text-size-adjust:100%;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#000000" style="background:#000000;">
  <tr><td align="center" style="padding:24px 12px;">
    <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" bgcolor="#0B0B0C" background="${fondo}" style="width:100%;max-width:600px;background-color:#0B0B0C;background-image:url('${fondo}');background-repeat:repeat-y;background-position:top center;background-size:100% auto;border:1px solid #1F1F22;border-radius:20px;font-family:${fuente};">
      ${logoArriba ? `<tr><td align="center" style="padding:18px 20px 14px;">${logoArriba}</td></tr>` : `<tr><td style="height:16px;font-size:0;line-height:0;">&nbsp;</td></tr>`}
      ${o.imagen ? `<tr><td style="padding:0 16px;"><img src="${o.imagen}" alt="${o.titulo || "Promoción"}" width="100%" style="display:block;width:100%;max-width:100%;height:auto;border-radius:16px;"></td></tr>` : ""}
      <tr><td align="center" style="padding:16px 28px 0;">
        ${o.titulo ? `<div style="color:#FFFFFF;font-size:28px;line-height:1.1;font-weight:800;text-transform:uppercase;letter-spacing:-0.01em;margin-bottom:12px;">${o.titulo}</div>` : ""}
        <div style="color:#FFFFFF;font-size:22px;line-height:1.2;font-weight:800;text-transform:uppercase;margin-bottom:8px;">${o.saludo}</div>
        <div style="color:#D6D6DC;font-size:14px;line-height:1.6;font-weight:300;">${negritas(o.textoHtml, "font-weight:700;color:#FFFFFF;")}</div>
      </td></tr>
      ${o.datosHtml.length ? `<tr><td style="padding:16px 24px 0;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#19191B" style="background:#19191B;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.16);border-radius:14px;">${o.datosHtml.map(fila).join("")}</table></td></tr>` : ""}
      ${o.cupon ? `<tr><td style="padding:10px 24px 0;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td align="center" style="border:2px dashed rgba(255,255,255,0.75);border-radius:14px;padding:12px;">
        <div style="color:#BDBDC4;font-size:11px;letter-spacing:0.32em;text-transform:uppercase;font-weight:300;font-style:italic;">Tu código</div>
        <div style="color:#FFFFFF;font-size:24px;font-weight:800;font-family:monospace;margin-top:3px;">${o.cupon.codigo}</div>
        ${o.cupon.detalle ? `<div style="color:#FFFFFF;font-size:13px;margin-top:4px;font-weight:300;letter-spacing:0.12em;text-transform:uppercase;">${o.cupon.detalle}</div>` : ""}
      </td></tr></table></td></tr>` : ""}
      <tr><td align="center" style="padding:16px 28px 22px;"><a href="${o.boton.url}" style="display:inline-block;background:#FFFFFF;color:#0A0A0A;text-decoration:none;padding:15px 44px;border-radius:999px;font-weight:800;font-style:italic;font-size:15px;letter-spacing:0.04em;text-transform:uppercase;">${o.boton.texto}</a></td></tr>
    </table>
    ${firma}
  </td></tr>
</table>
</body>
</html>`;
}
