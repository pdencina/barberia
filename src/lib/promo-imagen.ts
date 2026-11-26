// Imagen opcional del correo de una promoción. Solo se aceptan las subidas por el propio negocio
// (carpeta promos/<negocio>/ del almacenamiento): nunca una dirección cualquiera que mande el navegador.
export const BUCKET_PROMOS = "cut-photos";
export const carpetaPromos = (tenantId: string) => `promos/${tenantId}/`;

export function imagenDelNegocio(url: unknown, tenantId: string | null | undefined, base = process.env.NEXT_PUBLIC_SUPABASE_URL || ""): string | null {
  if (typeof url !== "string" || !tenantId || !base) return null;
  const prefijo = `${base.replace(/\/+$/, "")}/storage/v1/object/public/${BUCKET_PROMOS}/${carpetaPromos(tenantId)}`;
  if (!url.startsWith(prefijo)) return null;
  return /^[0-9a-z-]+\.(jpg|png|webp)$/.test(url.slice(prefijo.length)) ? url : null;
}
