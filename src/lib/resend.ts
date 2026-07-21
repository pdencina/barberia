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
<head><meta charset="utf-8"><title>Boleta EstudioLevels</title></head>
<body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #1a1a1a;">
  <div style="background: #111; padding: 30px; border-radius: 12px; border: 1px solid #333;">
    <div style="text-align: center; margin-bottom: 30px; border-bottom: 2px solid #e53e3e; padding-bottom: 20px;">
      <h1 style="color: #fff; margin: 0; font-size: 28px; font-weight: 900; font-style: italic; letter-spacing: 1px;">Estudio+Levels</h1>
      <p style="color: #e53e3e; margin: 8px 0 0; font-size: 11px; text-transform: uppercase; letter-spacing: 3px;">Barberia Premium en Puente Alto</p>
    </div>

    <div style="background: #1a1a1a; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
      <p style="margin: 4px 0; font-size: 14px; color: #ccc;"><strong style="color: #fff;">Boleta N:</strong> ${transactionId.slice(-8).toUpperCase()}</p>
      <p style="margin: 4px 0; font-size: 14px; color: #ccc;"><strong style="color: #fff;">Fecha:</strong> ${new Date(date).toLocaleDateString("es-CL")}</p>
      <p style="margin: 4px 0; font-size: 14px; color: #ccc;"><strong style="color: #fff;">Cliente:</strong> ${clientName}</p>
      <p style="margin: 4px 0; font-size: 14px; color: #ccc;"><strong style="color: #fff;">Barbero:</strong> ${barberName}</p>
    </div>

    <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
      <thead>
        <tr style="background: #e53e3e; color: white;">
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
      ${discount > 0 ? `<p style="margin: 4px 0; font-size: 14px; color: #e53e3e;">Descuento: -$${discount.toLocaleString("es-CL")}</p>` : ""}
      <p style="margin: 8px 0 0; font-size: 20px; font-weight: bold; color: #fff;">Total: $${total.toLocaleString("es-CL")}</p>
      <p style="margin: 4px 0; font-size: 13px; color: #888;">Pago: ${paymentLabel[paymentMethod] || paymentMethod}</p>
    </div>

    <div style="text-align: center; padding-top: 20px; border-top: 1px solid #333;">
      <p style="color: #888; font-size: 13px; margin: 4px 0;">Gracias por tu preferencia!</p>
      <p style="color: #555; font-size: 11px; margin: 4px 0;">EstudioLevels | estudiolevels.com</p>
    </div>
  </div>
</body>
</html>`;

  const resend = getResendClient();
  const { data, error } = await resend.emails.send({
    from: process.env.EMAIL_FROM || "EstudioLevels <boletas@estudiolevels.com>",
    to,
    subject: `Boleta EstudioLevels - ${new Date(date).toLocaleDateString("es-CL")}`,
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
}

export async function sendBookingConfirmation(params: SendBookingConfirmationParams) {
  const { to, clientName, barberName, serviceName, date, duration, price } = params;

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
    <div style="text-align: center; margin-bottom: 30px; border-bottom: 2px solid #e53e3e; padding-bottom: 20px;">
      <h1 style="color: #fff; margin: 0; font-size: 28px; font-weight: 900; font-style: italic;">Estudio+Levels</h1>
      <p style="color: #e53e3e; margin: 8px 0 0; font-size: 11px; text-transform: uppercase; letter-spacing: 3px;">Cita Confirmada</p>
    </div>

    <p style="color: #ccc; font-size: 16px; margin-bottom: 20px;">Hola <strong style="color: #fff;">${clientName}</strong>, tu cita esta confirmada!</p>

    <div style="background: #1a1a1a; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
      <table style="width: 100%; color: #ccc; font-size: 14px;">
        <tr><td style="padding: 8px 0; color: #888;">Servicio</td><td style="padding: 8px 0; color: #fff; font-weight: bold;">${serviceName}</td></tr>
        <tr><td style="padding: 8px 0; color: #888;">Barbero</td><td style="padding: 8px 0; color: #fff;">${barberName}</td></tr>
        <tr><td style="padding: 8px 0; color: #888;">Fecha</td><td style="padding: 8px 0; color: #fff;">${dateStr}</td></tr>
        <tr><td style="padding: 8px 0; color: #888;">Hora</td><td style="padding: 8px 0; color: #fff; font-weight: bold; font-size: 18px;">${timeStr}</td></tr>
        <tr><td style="padding: 8px 0; color: #888;">Duracion</td><td style="padding: 8px 0; color: #fff;">${duration} minutos</td></tr>
        <tr><td style="padding: 8px 0; color: #888;">Precio</td><td style="padding: 8px 0; color: #e53e3e; font-weight: bold; font-size: 16px;">$${price.toLocaleString("es-CL")}</td></tr>
      </table>
    </div>

    <div style="background: #e53e3e22; border: 1px solid #e53e3e44; border-radius: 8px; padding: 12px; margin-bottom: 20px;">
      <p style="color: #e53e3e; font-size: 13px; margin: 0; text-align: center;">
        Si necesitas cancelar o modificar tu cita, contactanos al <strong>9 4266 6172</strong>
      </p>
    </div>

    <div style="text-align: center; padding-top: 20px; border-top: 1px solid #333;">
      <p style="color: #888; font-size: 13px; margin: 4px 0;">Te esperamos!</p>
      <p style="color: #555; font-size: 11px; margin: 4px 0;">EstudioLevels | 1889 Juan de Dios Malebran, Puente Alto</p>
      <p style="color: #555; font-size: 11px; margin: 4px 0;">estudiolevels.com</p>
    </div>
  </div>
</body>
</html>`;

  const resend = getResendClient();
  await resend.emails.send({
    from: process.env.EMAIL_FROM || "EstudioLevels <boletas@estudiolevels.com>",
    to,
    subject: `Cita confirmada - ${serviceName} con ${barberName} | EstudioLevels`,
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
    <div style="background: #e53e3e22; border: 2px dashed #e53e3e; border-radius: 12px; padding: 20px; margin: 20px 0; text-align: center;">
      <p style="color: #e53e3e; font-size: 11px; text-transform: uppercase; letter-spacing: 2px; margin: 0 0 8px;">Cupon de descuento</p>
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
    <div style="text-align: center; margin-bottom: 30px; border-bottom: 2px solid #e53e3e; padding-bottom: 20px;">
      <h1 style="color: #fff; margin: 0; font-size: 28px; font-weight: 900; font-style: italic;">Estudio+Levels</h1>
    </div>

    <p style="color: #fff; font-size: 18px; margin-bottom: 8px;">Hola ${clientName}!</p>
    <p style="color: #ccc; font-size: 15px; line-height: 1.6; margin-bottom: 20px;">${message}</p>

    ${couponHtml}

    <div style="text-align: center; margin: 30px 0;">
      <a href="${bookingUrl}" style="display: inline-block; background: #e53e3e; color: #fff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: bold; font-size: 16px; text-transform: uppercase; letter-spacing: 1px;">
        Agendar Ahora
      </a>
    </div>

    <div style="text-align: center; padding-top: 20px; border-top: 1px solid #333;">
      <p style="color: #555; font-size: 11px; margin: 4px 0;">EstudioLevels | 1889 Juan de Dios Malebran, Puente Alto</p>
      <p style="color: #555; font-size: 11px; margin: 4px 0;">estudiolevels.com</p>
    </div>
  </div>
</body>
</html>`;

  const resend = getResendClient();
  await resend.emails.send({
    from: process.env.EMAIL_FROM || "EstudioLevels <boletas@estudiolevels.com>",
    to,
    subject: `Te extrañamos ${clientName}! | EstudioLevels`,
    html,
  });
}


interface SendAppointmentReminderParams {
  to: string;
  clientName: string;
  barberName: string;
  serviceName: string;
  date: Date;
}

export async function sendAppointmentReminder(params: SendAppointmentReminderParams) {
  const { to, clientName, barberName, serviceName, date } = params;

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
    <div style="text-align: center; margin-bottom: 30px; border-bottom: 2px solid #e53e3e; padding-bottom: 20px;">
      <h1 style="color: #fff; margin: 0; font-size: 28px; font-weight: 900; font-style: italic;">Estudio+Levels</h1>
      <p style="color: #e53e3e; margin: 8px 0 0; font-size: 11px; text-transform: uppercase; letter-spacing: 3px;">Recordatorio de Cita</p>
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
        <p style="color: #888; font-size: 13px; margin: 4px 0;">Barbero: <strong style="color: #fff;">${barberName}</strong></p>
      </div>
    </div>

    <div style="background: #e53e3e11; border: 1px solid #e53e3e33; border-radius: 8px; padding: 12px; margin-bottom: 20px;">
      <p style="color: #e53e3e; font-size: 13px; margin: 0; text-align: center;">
        Si necesitas cancelar o reprogramar, contactanos al <strong>9 4266 6172</strong>
      </p>
    </div>

    <div style="text-align: center; padding-top: 20px; border-top: 1px solid #333;">
      <p style="color: #888; font-size: 13px; margin: 4px 0;">Te esperamos!</p>
      <p style="color: #555; font-size: 11px; margin: 4px 0;">EstudioLevels | 1889 Juan de Dios Malebran, Puente Alto</p>
    </div>
  </div>
</body>
</html>`;

  const resend = getResendClient();
  await resend.emails.send({
    from: process.env.EMAIL_FROM || "EstudioLevels <boletas@estudiolevels.com>",
    to,
    subject: `Recordatorio: ${serviceName} manana a las ${timeStr} | EstudioLevels`,
    html,
  });
}
