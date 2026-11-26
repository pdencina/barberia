// Diseño «Oscuro» (blanco y negro) para el correo de una promoción o invitación: logo del negocio sobre negro (re-booking pequeño al pie),
// imagen grande, titular, texto, un recuadro blanco por cada dato y botón blanco. Todo el texto llega aquí YA escapado.

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

export function plantillaOscura(o: {
  logoNegocio: string | null; logoFondo?: boolean; titulo: string; saludo: string; textoHtml: string; imagen: string | null;
  datosHtml: string[]; cupon: { codigo: string; detalle: string } | null; boton: { url: string; texto: string };
}): string {
  const fuente = "'Plus Jakarta Sans', -apple-system, 'Segoe UI', Helvetica, Arial, sans-serif";
  // Protagonista: el logo del negocio, directo sobre el negro (si es oscuro, el negocio activa el fondo blanco).
  // re-booking va pequeño y en blanco al pie. Si el negocio no tiene logo, no se pone nada arriba.
  const logoArriba = o.logoNegocio
    ? `<img src="${o.logoNegocio}" alt="Logo del negocio" height="56" style="display:inline-block;height:56px;max-width:220px;width:auto;border:0;${o.logoFondo ? "background:#FFFFFF;border-radius:12px;padding:6px 14px;" : ""}">`
    : "";
  const firma = `<div style="padding-top:18px;"><span style="color:#6B6B73;font-size:11px;vertical-align:middle;">Enviado con&nbsp;</span><img src="https://www.re-booking.cl/logo-horizontal-white.png" alt="re-booking" width="72" height="18" style="display:inline-block;vertical-align:middle;width:72px;height:18px;border:0;opacity:0.55;"></div>`;
  // Todas las condiciones en UN recuadro compacto (una línea cada una).
  const fila = (h: string, i: number) => `<tr><td align="center" style="padding:7px 12px;color:#0A0A0A;font-size:13px;line-height:1.35;font-weight:600;${i ? "border-top:1px solid #E7E7EA;" : ""}">${h}</td></tr>`;
  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="dark">
<meta name="supported-color-schemes" content="dark">
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700;800&display=swap" rel="stylesheet">
</head>
<body bgcolor="#000000" style="margin:0;padding:0;background:#000000;font-family:${fuente};-webkit-text-size-adjust:100%;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#000000" style="background:#000000;">
  <tr><td align="center" style="padding:24px 12px;">
    <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" bgcolor="#0B0B0C" style="width:100%;max-width:600px;background:#0B0B0C;border:1px solid #1F1F22;border-radius:20px;">
      ${logoArriba ? `<tr><td align="center" style="padding:18px 20px 14px;">${logoArriba}</td></tr>` : `<tr><td style="height:16px;font-size:0;line-height:0;">&nbsp;</td></tr>`}
      ${o.imagen ? `<tr><td style="padding:0 16px;"><img src="${o.imagen}" alt="${o.titulo || "Promoción"}" width="100%" style="display:block;width:100%;max-width:100%;height:auto;border-radius:16px;"></td></tr>` : ""}
      <tr><td align="center" style="padding:16px 28px 0;">
        ${o.titulo ? `<div style="color:#FFFFFF;font-size:26px;line-height:1.15;font-weight:800;text-transform:uppercase;letter-spacing:0.02em;margin-bottom:10px;">${o.titulo}</div>` : ""}
        <div style="color:#FFFFFF;font-size:17px;font-weight:700;margin-bottom:6px;">${o.saludo}</div>
        <div style="color:#C9C9CF;font-size:14px;line-height:1.5;">${o.textoHtml}</div>
      </td></tr>
      ${o.datosHtml.length ? `<tr><td style="padding:12px 24px 0;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#FFFFFF" style="background:#FFFFFF;border-radius:12px;">${o.datosHtml.map(fila).join("")}</table></td></tr>` : ""}
      ${o.cupon ? `<tr><td style="padding:10px 24px 0;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td align="center" style="border:2px dashed #FFFFFF;border-radius:12px;padding:11px;">
        <div style="color:#9A9AA2;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;font-weight:700;">Tu código</div>
        <div style="color:#FFFFFF;font-size:24px;font-weight:800;font-family:monospace;margin-top:3px;">${o.cupon.codigo}</div>
        ${o.cupon.detalle ? `<div style="color:#C9C9CF;font-size:14px;margin-top:6px;">${o.cupon.detalle}</div>` : ""}
      </td></tr></table></td></tr>` : ""}
      <tr><td align="center" style="padding:16px 28px 22px;"><a href="${o.boton.url}" style="display:inline-block;background:#FFFFFF;color:#0A0A0A;text-decoration:none;padding:15px 44px;border-radius:999px;font-weight:800;font-size:15px;">${o.boton.texto}</a></td></tr>
    </table>
    ${firma}
  </td></tr>
</table>
</body>
</html>`;
}
