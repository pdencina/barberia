import { Resend } from "resend";

export const resend = new Resend(process.env.RESEND_API_KEY);

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
      <td style="padding: 8px; border-bottom: 1px solid #eee;">${item.description}</td>
      <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: center;">${item.quantity}</td>
      <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right;">$${item.unitPrice.toLocaleString("es-CL")}</td>
      <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right;">$${item.total.toLocaleString("es-CL")}</td>
    </tr>`
    )
    .join("");

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Boleta EstudioLevels</title></head>
<body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #f5f5f5;">
  <div style="background: white; padding: 30px; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.08);">
    <div style="text-align: center; margin-bottom: 30px; border-bottom: 2px solid #111; padding-bottom: 20px;">
      <h1 style="color: #111; margin: 0; font-size: 28px; letter-spacing: 2px;">ESTUDIOLEVELS</h1>
      <p style="color: #666; margin: 5px 0 0; font-size: 13px;">Barberia & Grooming</p>
    </div>

    <div style="background: #f9f9f9; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
      <p style="margin: 4px 0; font-size: 14px;"><strong>Boleta N:</strong> ${transactionId.slice(-8).toUpperCase()}</p>
      <p style="margin: 4px 0; font-size: 14px;"><strong>Fecha:</strong> ${new Date(date).toLocaleDateString("es-CL")}</p>
      <p style="margin: 4px 0; font-size: 14px;"><strong>Cliente:</strong> ${clientName}</p>
      <p style="margin: 4px 0; font-size: 14px;"><strong>Barbero:</strong> ${barberName}</p>
    </div>

    <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
      <thead>
        <tr style="background: #111; color: white;">
          <th style="padding: 10px; text-align: left; font-size: 13px;">Descripcion</th>
          <th style="padding: 10px; text-align: center; font-size: 13px;">Cant.</th>
          <th style="padding: 10px; text-align: right; font-size: 13px;">Precio</th>
          <th style="padding: 10px; text-align: right; font-size: 13px;">Total</th>
        </tr>
      </thead>
      <tbody>${itemsHtml}</tbody>
    </table>

    <div style="text-align: right; margin-bottom: 20px;">
      <p style="margin: 4px 0; font-size: 14px;">Subtotal: <strong>$${subtotal.toLocaleString("es-CL")}</strong></p>
      ${discount > 0 ? `<p style="margin: 4px 0; font-size: 14px; color: #e53e3e;">Descuento: -$${discount.toLocaleString("es-CL")}</p>` : ""}
      <p style="margin: 8px 0 0; font-size: 20px; font-weight: bold;">Total: $${total.toLocaleString("es-CL")}</p>
      <p style="margin: 4px 0; font-size: 13px; color: #666;">Pago: ${paymentLabel[paymentMethod] || paymentMethod}</p>
    </div>

    <div style="text-align: center; padding-top: 20px; border-top: 1px solid #eee;">
      <p style="color: #666; font-size: 13px; margin: 4px 0;">Gracias por tu preferencia!</p>
      <p style="color: #999; font-size: 11px; margin: 4px 0;">EstudioLevels | estudiolevels.com</p>
    </div>
  </div>
</body>
</html>`;

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
