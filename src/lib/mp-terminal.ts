// Maquina Mercado Pago Point (Newland N950) lista para usar: el negocio solo escribe el numero de serie (S/N de la etiqueta trasera)
// y el sistema arma el Device ID. Puro: se prueba sin base de datos.
export const MP_DEVICE_PREFIX = "NEWLAND_N950__";
export const MP_MODELO = "Newland N950 (Mercado Pago Point)";

export type ResultadoSerie = { ok: true; serie: string; deviceId: string } | { ok: false; error: string };

// Acepta: «NCD300018012», «S/N: NCD 300018012», «n950-ncc804366876» o el Device ID completo («NEWLAND_N950__NCD300018012»).
export function deviceIdDesdeSerie(entrada: string): ResultadoSerie {
  let t = String(entrada ?? "").toUpperCase().trim();
  t = t.replace(/^S\s*\/?\s*N\s*[:.\-]?\s*/, "");        // quita «S/N:» del inicio
  if (t.startsWith("NEWLAND")) {                           // ya viene el Device ID completo
    const m = /^NEWLAND_[A-Z0-9]+__([A-Z0-9]{6,32})$/.exec(t.replace(/\s+/g, ""));
    return m ? { ok: true, serie: m[1], deviceId: t.replace(/\s+/g, "") } : { ok: false, error: "El Device ID no tiene el formato NEWLAND_N950__SERIE" };
  }
  const serie = t.replace(/[\s\-_.]/g, "");
  if (!serie) return { ok: false, error: "Escribe el número de serie de la máquina" };
  if (!/^[A-Z0-9]+$/.test(serie)) return { ok: false, error: "El número de serie solo lleva letras y números" };
  if (serie.length < 6 || serie.length > 32) return { ok: false, error: "Revisa el número de serie: parece muy corto o muy largo" };
  return { ok: true, serie, deviceId: `${MP_DEVICE_PREFIX}${serie}` };
}

// Para mostrar en el formulario: de «NEWLAND_N950__NCD300018012» a «NCD300018012».
export const serieDesdeDeviceId = (deviceId: string | null | undefined): string => {
  const t = String(deviceId ?? "");
  const i = t.indexOf("__");
  return i >= 0 ? t.slice(i + 2) : t;
};
