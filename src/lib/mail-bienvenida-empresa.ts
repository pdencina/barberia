// Correo de bienvenida con las credenciales de una EMPRESA nueva (la crea Super admin o se registra sola desde /suscribirse).
// Una sola plantilla con el diseño verde de re-booking (encabezado con logo blanco), para que todos los correos se vean igual.
// Incluye el recuadro con los links de descarga de la app (iPhone y Android).
import { bloqueDescargaApps } from "@/lib/app-links";

export interface DatosBienvenidaEmpresa {
  adminName: string;
  businessName: string;
  adminEmail: string;
  tempPassword: string;
  planLine: string;   // ej. «Pro (15 días gratis)»
  appUrl: string;
}

const esc = (v: string) => String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export function htmlBienvenidaEmpresa(d: DatosBienvenidaEmpresa): string {
  const adminName = esc(d.adminName);
  const businessName = esc(d.businessName);
  const input = { adminEmail: d.adminEmail };
  const tempPassword = d.tempPassword;
  const appUrl = d.appUrl;
  const trialLine = d.planLine;
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /><meta name="viewport" content="width=device-width" /></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background-color: #F5F7FA; margin: 0; padding: 20px;">
  <div style="max-width: 480px; margin: 0 auto; background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.08);">
    <div style="background: linear-gradient(135deg, #0F8B8D, #2EC4B6); padding: 32px 24px; text-align: center;">
      <img src="https://re-booking.cl/logo-horizontal-white.png" alt="re-booking" style="height: 32px; max-width: 240px; object-fit: contain; margin-bottom: 14px;" />
      <h1 style="color: white; margin: 0; font-size: 22px;">Bienvenido a re-booking</h1>
      <p style="color: rgba(255,255,255,0.85); margin: 8px 0 0; font-size: 14px;">Todo tu negocio. Un solo sistema.</p>
    </div>
    <div style="padding: 32px 24px;">
      <p style="color: #1F2937; font-size: 15px; margin: 0 0 20px;">Hola <strong>${adminName}</strong>,</p>
      <p style="color: #6B7280; font-size: 14px; line-height: 1.6; margin: 0 0 24px;">
        Tu cuenta de <strong>${businessName}</strong> ya está lista. Estos son tus datos para ingresar:
      </p>

      <div style="background: #F5F7FA; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
        <p style="color: #6B7280; font-size: 12px; margin: 0 0 8px; text-transform: uppercase; letter-spacing: 0.5px;">Tus credenciales</p>
        <p style="color: #1F2937; font-size: 14px; margin: 0 0 6px;"><strong>Email:</strong> ${esc(input.adminEmail)}</p>
        <p style="color: #1F2937; font-size: 14px; margin: 0 0 6px;"><strong>Contraseña temporal:</strong> <span style="font-family: monospace; font-size: 15px; background: #E6F4F4; color: #0F8B8D; padding: 2px 8px; border-radius: 6px;">${tempPassword}</span></p>
        <p style="color: #1F2937; font-size: 14px; margin: 0;"><strong>Plan:</strong> ${esc(trialLine)}</p>
      </div>

      <a href="${appUrl}/login" style="display: block; text-align: center; background: #0F8B8D; color: white; padding: 14px 24px; border-radius: 12px; text-decoration: none; font-weight: 600; font-size: 14px;">
        Ingresar al sistema
      </a>

      ${bloqueDescargaApps()}

      <p style="color: #9CA3AF; font-size: 12px; text-align: center; margin: 20px 0 0;">
        Al ingresar por primera vez te pediremos crear tu propia contraseña.
      </p>
    </div>
    <div style="border-top: 1px solid #F3F4F6; padding: 16px 24px; text-align: center;">
      <p style="color: #9CA3AF; font-size: 11px; margin: 0;">re-booking · Todo tu negocio. Un solo sistema.</p>
    </div>
  </div>
</body>
</html>`;
}
