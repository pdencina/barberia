import { Resend } from "resend";

function getResendClient() {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error("RESEND_API_KEY no configurada");
  }
  return new Resend(apiKey);
}

interface SendReceiptParams {
  to: string;
  clientName: string;
  transactionId: string;
  items: Array<{
    description: string;
    quantity: number;
    unitPrice: number;
    total: number;
  }>;
  subtotal: number;
  discount: number;
  total: number;
  paymentMethod: string;
  date: Date;
  barberName: string;
  // Business's own logo (tenants.logo_url). Falls back to the generic re-booking
  // logo when the salon hasn't uploaded one.
  businessLogoUrl?: string | null;
}

export async function sendReceipt(params: SendReceiptParams) {
  const {
    to,
    clientName,
    transactionId,
    items,
    subtotal,
    discount,
    total,
    paymentMethod,
    date,
    barberName,
    businessLogoUrl,
  } = params;

  const paymentLabel: Record<string, string> = {
    cash: "Efectivo",
    debit_card: "Tarjeta Debito",
    credit_card: "Tarjeta Credito",
    transfer: "Transferencia",
    mixed: "Mixto",
  };

  const itemsHtml = items
    .map(
      (item) => `
    <tr>
      <td style="padding: 8px; border-bottom: 1px solid #333; color: #ddd;">${item.description}</td>
      <td style="padding: 8px; border-bottom: 1px solid #333; text-align: center; color: #ddd;">${item.quantity}</td>
      <td style="padding: 8px; border-bottom: 1px solid #333; text-align: right; color: #ddd;">$${item.unitPrice.toLocaleString("es-CL")}</td>
      <td style="padding: 8px; border-bottom: 1px solid #333; text-align: right; color: #fff; font-weight: bold;">$${item.total.toLocaleString("es-CL")}</td>
    </tr>`
    )
    .join("");

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Boleta re-booking</title></head>
<body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #1a1a1a;">
  <div style="background: #111; padding: 30px; border-radius: 12px; border: 1px solid #333;">
    <div style="text-align: center; margin-bottom: 30px; border-bottom: 2px solid #0F8B8D; padding-bottom: 20px;">
      ${businessLogoUrl
        // A business's own logo is usually dark (made for light backgrounds), so it
        // disappeared against this dark email. Put it on a white rounded card so any
        // logo — light or dark — is readable. The generic re-booking logo is already
        // white, so it stays directly on the dark header.
        ? `<div style="display: inline-block; background: #ffffff; padding: 12px 20px; border-radius: 12px; margin-bottom: 10px;"><img src="${businessLogoUrl}" alt="Logo" style="height: 48px; max-width: 220px; object-fit: contain; display: block;" /></div>`
        : `<img src="https://re-booking.cl/logo-horizontal-white.png" alt="re-booking" style="height: 32px; max-width: 240px; object-fit: contain; margin-bottom: 10px;" />
      <p style="color: #0F8B8D; margin: 8px 0 0; font-size: 11px; text-transform: uppercase; letter-spacing: 3px;">Gestiona. Reserva. Repite el exito.</p>`}
    </div>

    <div style="background: #1a1a1a; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
      <p style="margin: 4px 0; font-size: 14px; color: #ccc;"><strong style="color: #fff;">Boleta N:</strong> ${transactionId.slice(-8).toUpperCase()}</p>
      <p style="margin: 4px 0; font-size: 14px; color: #ccc;"><strong style="color: #fff;">Fecha:</strong> ${new Date(date).toLocaleDateString("es-CL")}</p>
      <p style="margin: 4px 0; font-size: 14px; color: #ccc;"><strong style="color: #fff;">Cliente:</strong> ${clientName}</p>
      <p style="margin: 4px 0; font-size: 14px; color: #ccc;"><strong style="color: #fff;">Profesional:</strong> ${barberName}</p>
    </div>

    <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
      <thead>
        <tr style="background: #0F8B8D; color: white;">
          <th style="padding: 10px; text-align: left; font-size: 13px;">Descripcion</th>
          <th style="padding: 10px; text-align: center; font-size: 13px;">Cant.</th>
          <th style="padding: 10px; text-align: right; font-size: 13px;">Precio</th>
          <th style="padding: 10px; text-align: right; font-size: 13px;">Total</th>
        </tr>
      </thead>
      <tbody>${itemsHtml}</tbody>
    </table>

    <div style="text-align: right; margin-bottom: 20px;">
      <p style="margin: 4px 0; font-size: 14px; color: #ccc;">Subtotal: <strong style="color: #fff;">$${subtotal.toLocaleString("es-CL")}</strong></p>
      ${discount > 0 ? `<p style="margin: 4px 0; font-size: 14px; color: #0F8B8D;">Descuento: -$${discount.toLocaleString("es-CL")}</p>` : ""}
      <p style="margin: 8px 0 0; font-size: 20px; font-weight: bold; color: #fff;">Total: $${total.toLocaleString("es-CL")}</p>
      <p style="margin: 4px 0; font-size: 13px; color: #888;">Pago: ${paymentLabel[paymentMethod] || paymentMethod}</p>
    </div>

    <div style="text-align: center; padding-top: 20px; border-top: 1px solid #333;">
      <a href="${process.env.NEXT_PUBLIC_APP_URL || "https://barberia-kappa-weld.vercel.app"}/review/${transactionId}" style="display: inline-block; background: #0F8B8D; color: #fff; text-decoration: none; padding: 10px 24px; border-radius: 6px; font-weight: bold; font-size: 13px; margin-bottom: 12px;">
        Califica tu atencion ★
      </a>
      <p style="color: #888; font-size: 13px; margin: 4px 0;">Gracias por tu preferencia!</p>
      <p style="color: #555; font-size: 11px; margin: 4px 0;">re-booking | re-booking.cl</p>
    </div>
  </div>
</body>
</html>`;

  const resend = getResendClient();
  const { data, error } = await resend.emails.send({
    from: process.env.EMAIL_FROM || "re-booking <no-reply@re-booking.cl>",
    to,
    subject: `Boleta re-booking - ${new Date(date).toLocaleDateString("es-CL")}`,
    html,
  });

  if (error) {
    throw new Error(`Error enviando email: ${error.message}`);
  }

  return data;
}


interface SendBookingConfirmationParams {
  to: string;
  clientName: string;
  barberName: string;
  serviceName: string;
  date: Date;
  duration: number;
  price: number;
  appointmentId?: string;
}

export async function sendBookingConfirmation(params: SendBookingConfirmationParams) {
  const { to, clientName, barberName, serviceName, date, duration, price, appointmentId } = params;

  const dateStr = new Date(date).toLocaleDateString("es-CL", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const timeStr = new Date(date).toLocaleTimeString("es-CL", {
    hour: "2-digit",
    minute: "2-digit",
  });

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #1a1a1a;">
  <div style="background: #111; padding: 30px; border-radius: 12px; border: 1px solid #333;">
    <div style="text-align: center; margin-bottom: 30px; border-bottom: 2px solid #0F8B8D; padding-bottom: 20px;">
      <img src="https://re-booking.cl/logo-horizontal.png" alt="re-booking" style="height: 40px; margin-bottom: 10px;" />
      <p style="color: #0F8B8D; margin: 8px 0 0; font-size: 11px; text-transform: uppercase; letter-spacing: 3px;">Cita Confirmada</p>
    </div>

    <p style="color: #ccc; font-size: 16px; margin-bottom: 20px;">Hola <strong style="color: #fff;">${clientName}</strong>, tu cita esta confirmada!</p>

    <div style="background: #1a1a1a; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
      <table style="width: 100%; color: #ccc; font-size: 14px;">
        <tr><td style="padding: 8px 0; color: #888;">Servicio</td><td style="padding: 8px 0; color: #fff; font-weight: bold;">${serviceName}</td></tr>
        <tr><td style="padding: 8px 0; color: #888;">Profesional</td><td style="padding: 8px 0; color: #fff;">${barberName}</td></tr>
        <tr><td style="padding: 8px 0; color: #888;">Fecha</td><td style="padding: 8px 0; color: #fff;">${dateStr}</td></tr>
        <tr><td style="padding: 8px 0; color: #888;">Hora</td><td style="padding: 8px 0; color: #fff; font-weight: bold; font-size: 18px;">${timeStr}</td></tr>
        <tr><td style="padding: 8px 0; color: #888;">Duracion</td><td style="padding: 8px 0; color: #fff;">${duration} minutos</td></tr>
        <tr><td style="padding: 8px 0; color: #888;">Precio</td><td style="padding: 8px 0; color: #0F8B8D; font-weight: bold; font-size: 16px;">$${price.toLocaleString("es-CL")}</td></tr>
      </table>
    </div>

    <div style="background: #0F8B8D22; border: 1px solid #0F8B8D44; border-radius: 8px; padding: 12px; margin-bottom: 20px;">
      <p style="color: #0F8B8D; font-size: 13px; margin: 0; text-align: center;">
        ${appointmentId ? `<a href="https://re-booking.cl/cancel/${appointmentId}" style="color: #0F8B8D; text-decoration: underline;">Cancelar o modificar cita</a> · ` : ""}Contacto: <strong>9 4266 6172</strong>
      </p>
    </div>

    <div style="text-align: center; padding-top: 20px; border-top: 1px solid #333;">
      <p style="color: #888; font-size: 13px; margin: 4px 0;">Te esperamos!</p>
      <p style="color: #555; font-size: 11px; margin: 4px 0;">re-booking | <a href="https://re-booking.cl" style="color: #0F8B8D;">re-booking.cl</a></p>
    </div>
  </div>
</body>
</html>`;

  const resend = getResendClient();
  await resend.emails.send({
    from: process.env.EMAIL_FROM || "re-booking <no-reply@rebooking.cl>",
    to,
    subject: `Cita confirmada - ${serviceName} con ${barberName} | re-booking`,
    html,
  });
}


interface SendRetentionEmailParams {
  to: string;
  clientName: string;
  message: string;
  couponCode: string | null;
  couponDescription: string | null;
  discountType: string | null;
  discountValue: number | null;
}

export async function sendRetentionEmail(params: SendRetentionEmailParams) {
  const { to, clientName, message, couponCode, couponDescription, discountType, discountValue } = params;

  const couponHtml = couponCode ? `
    <div style="background: #0F8B8D22; border: 2px dashed #0F8B8D; border-radius: 12px; padding: 20px; margin: 20px 0; text-align: center;">
      <p style="color: #0F8B8D; font-size: 11px; text-transform: uppercase; letter-spacing: 2px; margin: 0 0 8px;">Cupon de descuento</p>
      <p style="color: #fff; font-size: 28px; font-weight: bold; font-family: monospace; margin: 0 0 8px;">${couponCode}</p>
      <p style="color: #ccc; font-size: 14px; margin: 0;">
        ${discountType === "percentage" ? `${discountValue}% de descuento` : `$${discountValue?.toLocaleString("es-CL")} de descuento`}
      </p>
      ${couponDescription ? `<p style="color: #888; font-size: 12px; margin: 8px 0 0;">${couponDescription}</p>` : ""}
    </div>
  ` : "";

  const bookingUrl = process.env.NEXT_PUBLIC_APP_URL
    ? `${process.env.NEXT_PUBLIC_APP_URL}/booking`
    : "https://barberia-kappa-weld.vercel.app/booking";

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #1a1a1a;">
  <div style="background: #111; padding: 30px; border-radius: 12px; border: 1px solid #333;">
    <div style="text-align: center; margin-bottom: 30px; border-bottom: 2px solid #0F8B8D; padding-bottom: 20px;">
      <h1 style="color: #fff; margin: 0; font-size: 28px; font-weight: 900; font-style: italic;">re-booking</h1>
    </div>

    <p style="color: #fff; font-size: 18px; margin-bottom: 8px;">Hola ${clientName}!</p>
    <p style="color: #ccc; font-size: 15px; line-height: 1.6; margin-bottom: 20px;">${message}</p>

    ${couponHtml}

    <div style="text-align: center; margin: 30px 0;">
      <a href="${bookingUrl}" style="display: inline-block; background: #0F8B8D; color: #fff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: bold; font-size: 16px; text-transform: uppercase; letter-spacing: 1px;">
        Agendar Ahora
      </a>
    </div>

    <div style="text-align: center; padding-top: 20px; border-top: 1px solid #333;">
      <p style="color: #555; font-size: 11px; margin: 4px 0;">re-booking | rebooking.cl</p>
    </div>
  </div>
</body>
</html>`;

  const resend = getResendClient();
  await resend.emails.send({
    from: process.env.EMAIL_FROM || "re-booking <no-reply@rebooking.cl>",
    to,
    subject: `Te extrañamos ${clientName}! | re-booking`,
    html,
  });
}


interface SendAppointmentReminderParams {
  to: string;
  clientName: string;
  barberName: string;
  serviceName: string;
  date: Date;
  appointmentId?: string;
}

export async function sendAppointmentReminder(params: SendAppointmentReminderParams) {
  const { to, clientName, barberName, serviceName, date, appointmentId } = params;

  const dateStr = new Date(date).toLocaleDateString("es-CL", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  const timeStr = new Date(date).toLocaleTimeString("es-CL", {
    hour: "2-digit",
    minute: "2-digit",
  });

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #1a1a1a;">
  <div style="background: #111; padding: 30px; border-radius: 12px; border: 1px solid #333;">
    <div style="text-align: center; margin-bottom: 30px; border-bottom: 2px solid #0F8B8D; padding-bottom: 20px;">
      <h1 style="color: #fff; margin: 0; font-size: 28px; font-weight: 900; font-style: italic;">re-booking</h1>
      <p style="color: #0F8B8D; margin: 8px 0 0; font-size: 11px; text-transform: uppercase; letter-spacing: 3px;">Recordatorio de Cita</p>
    </div>

    <p style="color: #fff; font-size: 18px; margin-bottom: 8px;">Hola ${clientName}!</p>
    <p style="color: #ccc; font-size: 15px; line-height: 1.6; margin-bottom: 24px;">
      Te recordamos que tienes una cita agendada para manana:
    </p>

    <div style="background: #1a1a1a; border: 1px solid #333; border-radius: 12px; padding: 24px; margin-bottom: 24px; text-align: center;">
      <p style="color: #888; font-size: 12px; text-transform: uppercase; letter-spacing: 2px; margin: 0 0 8px;">Tu cita</p>
      <p style="color: #fff; font-size: 32px; font-weight: bold; margin: 0 0 4px;">${timeStr}</p>
      <p style="color: #ccc; font-size: 14px; margin: 0 0 16px;">${dateStr}</p>
      <div style="border-top: 1px solid #333; padding-top: 16px;">
        <p style="color: #888; font-size: 13px; margin: 4px 0;">Servicio: <strong style="color: #fff;">${serviceName}</strong></p>
        <p style="color: #888; font-size: 13px; margin: 4px 0;">Profesional: <strong style="color: #fff;">${barberName}</strong></p>
      </div>
    </div>

    <div style="background: #0F8B8D11; border: 1px solid #0F8B8D33; border-radius: 8px; padding: 12px; margin-bottom: 20px;">
      <p style="color: #0F8B8D; font-size: 13px; margin: 0; text-align: center;">
        Si necesitas cancelar o reprogramar, contactanos al <strong>9 4266 6172</strong>
      </p>
    </div>

    ${appointmentId ? `
    <div style="text-align: center; margin-bottom: 20px;">
      <p style="color: #888; font-size: 13px; margin-bottom: 12px;">Confirma tu asistencia:</p>
      <a href="${process.env.NEXT_PUBLIC_APP_URL || "https://barberia-kappa-weld.vercel.app"}/api/public/confirm-attendance?id=${appointmentId}&action=confirm" style="display: inline-block; background: #0F8B8D; color: #fff; text-decoration: none; padding: 10px 24px; border-radius: 8px; font-weight: bold; font-size: 14px; margin-right: 8px;">
        ✓ Asistire
      </a>
      <a href="${process.env.NEXT_PUBLIC_APP_URL || "https://barberia-kappa-weld.vercel.app"}/cancel/${appointmentId}" style="display: inline-block; background: #333; color: #fff; text-decoration: none; padding: 10px 24px; border-radius: 8px; font-weight: bold; font-size: 14px;">
        ✕ No podre ir
      </a>
    </div>
    ` : ""}

    <div style="text-align: center; padding-top: 20px; border-top: 1px solid #333;">
      <p style="color: #888; font-size: 13px; margin: 4px 0;">Te esperamos!</p>
      <p style="color: #555; font-size: 11px; margin: 4px 0;">re-booking | rebooking.cl</p>
    </div>
  </div>
</body>
</html>`;

  const resend = getResendClient();
  await resend.emails.send({
    from: process.env.EMAIL_FROM || "re-booking <no-reply@rebooking.cl>",
    to,
    subject: `Recordatorio: ${serviceName} manana a las ${timeStr} | re-booking`,
    html,
  });
}


// ==================== WELCOME EMAIL FOR NEW PROFESSIONALS ====================

interface SendWelcomeParams {
  to: string;
  professionalName: string;
  businessName: string;
  password: string;
  loginUrl: string;
}

export async function sendWelcomeEmail(params: SendWelcomeParams) {
  const { to, professionalName, businessName, password, loginUrl } = params;

  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /><meta name="viewport" content="width=device-width" /></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background-color: #F5F7FA; margin: 0; padding: 20px;">
  <div style="max-width: 480px; margin: 0 auto; background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.08);">
    <div style="background: linear-gradient(135deg, #0F8B8D, #2EC4B6); padding: 32px 24px; text-align: center;">
      <img src="${loginUrl.replace("/login", "")}/oti/oti-web-160.png" alt="Oti" style="width: 64px; height: 64px; margin-bottom: 12px;" />
      <h1 style="color: white; margin: 0; font-size: 22px;">Bienvenido a re-booking</h1>
      <p style="color: rgba(255,255,255,0.85); margin: 8px 0 0; font-size: 14px;">${businessName} te ha agregado como profesional</p>
    </div>
    <div style="padding: 32px 24px;">
      <p style="color: #1F2937; font-size: 15px; margin: 0 0 20px;">Hola <strong>${professionalName}</strong>,</p>
      <p style="color: #6B7280; font-size: 14px; line-height: 1.6; margin: 0 0 24px;">
        Ya tienes tu cuenta lista en re-booking. Desde ahi podras ver tu agenda, registrar servicios y gestionar tus comisiones.
      </p>
      
      <div style="background: #F5F7FA; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
        <p style="color: #6B7280; font-size: 12px; margin: 0 0 8px; text-transform: uppercase; letter-spacing: 0.5px;">Tus credenciales</p>
        <p style="color: #1F2937; font-size: 14px; margin: 0 0 6px;"><strong>Email:</strong> ${to}</p>
        <p style="color: #1F2937; font-size: 14px; margin: 0;"><strong>Contraseña:</strong> ${password}</p>
      </div>

      <a href="${loginUrl}" style="display: block; text-align: center; background: #0F8B8D; color: white; padding: 14px 24px; border-radius: 12px; text-decoration: none; font-weight: 600; font-size: 14px;">
        Iniciar sesion
      </a>

      <p style="color: #9CA3AF; font-size: 12px; text-align: center; margin: 20px 0 0;">
        Te recomendamos cambiar tu contraseña despues del primer ingreso.
      </p>
    </div>
    <div style="border-top: 1px solid #F3F4F6; padding: 16px 24px; text-align: center;">
      <p style="color: #9CA3AF; font-size: 11px; margin: 0;">re-booking · Todo tu negocio. Un solo sistema.</p>
    </div>
  </div>
</body>
</html>`;

  try {
    const resend = getResendClient();
    await resend.emails.send({
      from: process.env.EMAIL_FROM || "re-booking <no-reply@re-booking.cl>",
      to,
      subject: `${professionalName}, te dieron acceso a ${businessName} en re-booking`,
      html,
    });
    return { success: true };
  } catch (error: any) {
    console.error("Error sending welcome email:", error);
    return { success: false, error: error.message };
  }
}
