// Boleta electronica (SII) con la cuenta de CADA negocio. DTE 39 = Boleta Electronica.
// Hoy solo OpenFactura/Haulmer. El payload esta por contrastar en sandbox (ver docs/TUTORIAL-BOLETAS-SII.md).
import { todayInChile } from "./utils";
import { decryptSecret } from "./secret-box";

export interface SiiConfig {
  enabled: boolean;
  auto_emit: boolean;
  provider: string;
  environment: "sandbox" | "production";
  emisor_rut: string | null;
  emisor_razon_social: string | null;
  emisor_giro: string | null;
  emisor_direccion: string | null;
  emisor_comuna: string | null;
  api_key_enc: string | null;
}

interface BoletaItem {
  name: string;
  quantity: number;
  unitPrice: number; // precio con IVA incluido
  total: number;
}

export interface EmitBoletaParams {
  items: BoletaItem[];
  total: number;
  paymentMethod: string;
  clientRut?: string | null;
  clientName?: string | null;
  transactionId: string;
}

export interface BoletaResult {
  success: boolean;
  folio?: number;
  pdfUrl?: string | null;
  error?: string;
}

// IVA general de Chile (los precios del POS ya lo incluyen).
const IVA_RATE = 0.19;

const HAULMER_URL: Record<SiiConfig["environment"], string> = {
  sandbox: "https://dev-api.haulmer.com/v2",
  production: "https://api.haulmer.com/v2",
};

export function missingEmisorData(c: SiiConfig): string | null {
  if (!c.emisor_rut || !c.emisor_razon_social || !c.emisor_giro || !c.emisor_direccion || !c.emisor_comuna) {
    return "Faltan datos del emisor (RUT, razón social, giro, dirección y comuna)";
  }
  if (!c.api_key_enc) return "Falta la llave del proveedor";
  return null;
}

export async function emitBoleta(config: SiiConfig, params: EmitBoletaParams): Promise<BoletaResult> {
  if (config.provider !== "haulmer") return { success: false, error: `Proveedor '${config.provider}' no soportado` };
  const missing = missingEmisorData(config);
  if (missing) return { success: false, error: missing };

  let apiKey: string;
  try {
    apiKey = decryptSecret(config.api_key_enc as string);
  } catch {
    return { success: false, error: "No se pudo leer la llave del proveedor; vuelve a guardarla" };
  }

  const neto = Math.round(params.total / (1 + IVA_RATE));
  const body = {
    response: ["PDF", "FOLIO"],
    dte: {
      Encabezado: {
        IdDoc: { TipoDTE: 39, Folio: 0, FchEmis: todayInChile(), IndServicio: 3 },
        Emisor: {
          RUTEmisor: config.emisor_rut,
          RznSocEmisor: config.emisor_razon_social,
          GiroEmisor: config.emisor_giro,
          DirOrigen: config.emisor_direccion,
          CmnaOrigen: config.emisor_comuna,
        },
        Receptor: { RUTRecep: params.clientRut || "66666666-6" },
        Totales: { MntNeto: neto, IVA: params.total - neto, MntTotal: params.total },
      },
      Detalle: params.items.map((item, i) => ({
        NroLinDet: i + 1,
        NmbItem: item.name,
        QtyItem: item.quantity,
        PrcItem: item.unitPrice,
        MontoItem: item.total,
      })),
    },
  };

  try {
    const res = await fetch(`${HAULMER_URL[config.environment]}/dte/document`, {
      method: "POST",
      headers: { apikey: apiKey, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (data.FOLIO) {
      // El proveedor puede devolver el PDF en base64 y no como enlace: solo se guarda si es una URL.
      const pdf = typeof data.PDF === "string" && data.PDF.startsWith("http") ? data.PDF : null;
      return { success: true, folio: Number(data.FOLIO), pdfUrl: pdf };
    }
    return { success: false, error: data.MENSAJE || data.error?.message || `Error del proveedor (${res.status})` };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}
