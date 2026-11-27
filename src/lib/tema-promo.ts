import { coloresLegibles, sobre, type ColoresCorreo } from "@/lib/correo-colores";

const canales = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)).join(" ");

/** Colores del link de la promoción. Sin colores propios: blanco sobre negro con las formas de fondo. */
export function temaPromo(c: ColoresCorreo | null | undefined) {
  const ok = coloresLegibles(c);
  if (!ok) return { vars: {} as Record<string, string>, papel: "#000000", claro: false, formas: true };
  return {
    vars: { "--promo-papel": canales(ok.fondo), "--promo-tinta": canales(ok.texto), "--promo-boton": canales(ok.boton), "--promo-sobre": canales(sobre(ok.boton)) } as Record<string, string>,
    papel: ok.fondo, claro: sobre(ok.fondo) === "#111111", formas: false,
  };
}
