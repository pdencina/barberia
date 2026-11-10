import { loadMembers } from "@/lib/empresas/cartera-data";
import { getResendClient } from "@/lib/resend-client";
import type { createAdminSupabase } from "@/lib/supabase/server";

type Admin = ReturnType<typeof createAdminSupabase>;

export type ReceiptLine = { name: string; sku: string | null; quantity: number; unitPrice: number | null };

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
const clp = (n: number) => "$" + Math.round(n).toLocaleString("es-CL");

export function receiptHtml(args: { companyName: string; customerName: string; orderId: string; lines: ReceiptLine[]; notes: string | null; panelUrl: string }) {
  const total = args.lines.reduce((s, l) => s + (l.unitPrice ?? 0) * l.quantity, 0);
  const td = "padding:6px 8px;border-bottom:1px solid #F3F4F6;font-size:14px;color:#10201F";
  const rows = args.lines.map((l) => `<tr><td style="${td}">${esc(l.name)}${l.sku ? ` <span style="color:#6B7280">(${esc(l.sku)})</span>` : ""}</td><td style="${td};text-align:right">${l.quantity}</td><td style="${td};text-align:right">${l.unitPrice == null ? "-" : clp(l.unitPrice * l.quantity)}</td></tr>`).join("");
  return `<!doctype html><html><body style="margin:0;background:#F7F5F0;font-family:-apple-system,'Segoe UI',Helvetica,Arial,sans-serif">
<div style="max-width:600px;margin:0 auto;padding:24px">
<h1 style="font-size:20px;color:#10201F;margin:0 0 4px">Nuevo pedido del portal</h1>
<p style="font-size:14px;color:#5F6E6C;margin:0 0 16px">${esc(args.customerName)} hizo un pedido en el portal de ${esc(args.companyName)}. Queda en <b>borrador</b>: revísalo y confírmalo para reservar el stock.</p>
<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;background:#fff;border-radius:12px;border-collapse:collapse">${rows}
<tr><td style="${td};font-weight:700">Total referencial</td><td></td><td style="${td};text-align:right;font-weight:700">${clp(total)}</td></tr></table>
${args.notes ? `<p style="font-size:14px;color:#10201F;margin:12px 0 0"><b>Nota:</b> ${esc(args.notes)}</p>` : ""}
<p style="font-size:12px;color:#6B7280;margin:16px 0 0">Pedido ${esc(args.orderId.slice(0, 8))}. <a href="${esc(args.panelUrl)}" style="color:#0A6E6B">Abrir en el panel</a></p>
</div></body></html>`;
}

/**
 * Comprobante al vendedor del distribuidor (o a los dueños si no tiene vendedor). Nunca hace fallar el pedido:
 * si el correo no sale, el pedido igual queda y se ve en el panel.
 */
export async function sendPortalReceipt(admin: Admin, args: { tenantId: string; companyName: string; customerId: string; customerName: string; orderId: string; lines: ReceiptLine[]; notes: string | null }): Promise<"sent" | "skipped" | "failed"> {
  try {
    if (!process.env.RESEND_API_KEY) return "skipped";
    const { data: customer } = await admin.from("company_customers").select("assigned_seller_id").eq("tenant_id", args.tenantId).eq("id", args.customerId).maybeSingle();
    const members = (await loadMembers(admin, args.tenantId)).filter((m) => m.active && m.email);
    const seller = members.find((m) => m.userId === customer?.assigned_seller_id);
    const to = seller ? [seller.email] : members.filter((m) => m.role === "owner").map((m) => m.email);
    if (to.length === 0) return "skipped";
    const appUrl = (process.env.NEXT_PUBLIC_APP_URL || "https://www.re-booking.cl").replace(/\/$/, "");
    const { error } = await getResendClient().emails.send({
      from: process.env.EMAIL_FROM || "re-booking <no-reply@re-booking.cl>",
      to,
      subject: `Pedido del portal · ${args.customerName}`,
      html: receiptHtml({ ...args, panelUrl: `${appUrl}/empresa/pedidos/${args.orderId}` }),
    });
    return error ? "failed" : "sent";
  } catch {
    return "failed";
  }
}
