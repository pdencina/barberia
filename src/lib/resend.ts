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
