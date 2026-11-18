// Enlaces de descarga de la app de re-booking y el bloque que se agrega a los correos con credenciales (verificados el 17 nov 2026).
export const APP_STORE_URL = "https://apps.apple.com/cl/app/id6821324388";
export const PLAY_STORE_URL = "https://play.google.com/store/apps/details?id=cl.rebooking.app";

// Bloque HTML para correos: dos botones (iPhone y Android). Usa tablas y estilos en linea, que es lo que soportan los clientes de correo.
export function bloqueDescargaApps(): string {
  const boton = (href: string, texto: string) =>
    `<a href="${href}" style="display:inline-block;background:#111827;color:#ffffff;text-decoration:none;padding:11px 16px;border-radius:10px;font-weight:700;font-size:13px;margin:4px;">${texto}</a>`;
  return `<div style="text-align:center;margin:24px 0 0;padding:18px 12px;border:1px solid #E5E7EB;border-radius:12px;background:#FAFAFA;">
        <p style="margin:0 0 4px;font-size:14px;font-weight:700;color:#1F2937;">Descarga la app de re-booking</p>
        <p style="margin:0 0 10px;font-size:12px;color:#6B7280;">Ingresa con el mismo correo y contraseña de arriba.</p>
        ${boton(APP_STORE_URL, "Descargar para iPhone")}${boton(PLAY_STORE_URL, "Descargar para Android")}
      </div>`;
}
