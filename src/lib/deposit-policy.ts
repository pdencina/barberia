// Politica de devolucion del abono (la define cada negocio; el cliente la ve antes de pagar). Sin dependencias de servidor.
export type PoliticaAbono = "none" | "until_hours" | "always";
export const HORAS_DEVOLUCION = [12, 24, 48, 72, 96, 168];

export function textoPoliticaAbono(policy: string | null | undefined, hours: number | null | undefined): string {
  if (policy === "always") return "Abono reembolsable si cancelas tu cita.";
  if (policy === "until_hours") {
    const h = Number(hours) || 24;
    return `Abono reembolsable si cancelas con al menos ${h >= 48 && h % 24 === 0 ? `${h / 24} días` : `${h} horas`} de anticipación.`;
  }
  if (policy === "none") return "El abono no es reembolsable.";
  return "";
}
