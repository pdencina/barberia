// SII (Servicio de Impuestos Internos) - Boleta Electrónica Integration
// Supports: Simple API (chilesystems.com), Haulmer/OpenFactura, or direct SII
// DTE Type 39 = Boleta Electrónica, Type 41 = Boleta Exenta

interface BoletaItem {
  name: string;
  quantity: number;
  unitPrice: number; // precio con IVA incluido
  total: number;
}

interface EmitBoletaParams {
  items: BoletaItem[];
  total: number;
  paymentMethod: string; // 'cash', 'debit_card', 'credit_card', 'transfer'
  clientRut?: string | null;
  clientName?: string | null;
  transactionId: string;
}

interface BoletaResult {
  success: boolean;
  folio?: number;
  pdfUrl?: string;
  error?: string;
}

// Map payment methods to SII codes
const PAYMENT_CODES: Record<string, number> = {
  cash: 1, // Efectivo
  debit_card: 2, // Débito
  credit_card: 3, // Crédito
  transfer: 4, // Transferencia
  mixed: 5, // Otros
};

export async function emitBoleta(params: EmitBoletaParams): Promise<BoletaResult> {
  const provider = process.env.SII_PROVIDER || "simple_api"; // 'simple_api' | 'haulmer' | 'apigateway'

  switch (provider) {
    case "simple_api":
      return emitViaSimpleApi(params);
    case "haulmer":
      return emitViaHaulmer(params);
    default:
      return { success: false, error: `Provider '${provider}' not supported` };
  }
}

// Simple API (chilesystems.com)
async function emitViaSimpleApi(params: EmitBoletaParams): Promise<BoletaResult> {
  const apiUrl = process.env.SII_SIMPLE_API_URL || "https://api.simpleapi.cl/api/v1";
  const apiToken = process.env.SII_SIMPLE_API_TOKEN;

  if (!apiToken) {
    return { success: false, error: "SII_SIMPLE_API_TOKEN no configurado" };
  }

  const body = {
    response: ["PDF", "FOLIO"],
    dte: {
      Encabezado: {
        IdDoc: {
          TipoDTE: 39, // Boleta Electrónica
          FchEmis: new Date().toISOString().split("T")[0],
          IndServicio: 3, // Servicios
          FmaPago: PAYMENT_CODES[params.paymentMethod] || 1,
        },
        Receptor: {
          RUTRecep: params.clientRut || "66666666-6", // RUT genérico para boleta
          RznSocRecep: params.clientName || "Cliente",
        },
        Totales: {
          MntTotal: params.total,
        },
      },
      Detalle: params.items.map((item, i) => ({
        NroLinDet: i + 1,
        NmbItem: item.name,
        QtyItem: item.quantity,
        PrcItem: item.unitPrice,
        MontoItem: item.total,
      })),
      Referencia: [{
        NroLinRef: 1,
        CodRef: 0,
        RazonRef: `POS re-booking - TX ${params.transactionId.slice(-8)}`,
      }],
    },
  };

  try {
    const res = await fetch(`${apiUrl}/dte/emitir`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const data = await res.json();

    if (res.ok && data.folio) {
      return {
        success: true,
        folio: data.folio,
        pdfUrl: data.pdfUrl || data.pdf || null,
      };
    }

    return { success: false, error: data.message || data.error || "Error emitiendo boleta" };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

// Haulmer / OpenFactura
async function emitViaHaulmer(params: EmitBoletaParams): Promise<BoletaResult> {
  const apiUrl = process.env.SII_HAULMER_URL || "https://dev-api.haulmer.com/v2";
  const apiToken = process.env.SII_HAULMER_TOKEN;

  if (!apiToken) {
    return { success: false, error: "SII_HAULMER_TOKEN no configurado" };
  }

  const body = {
    response: ["PDF"],
    dte: {
      Encabezado: {
        IdDoc: { TipoDTE: 39, Folio: 0 },
        Receptor: { RUTRecep: params.clientRut || "66666666-6" },
        Totales: { MntTotal: params.total },
      },
      Detalle: params.items.map((item) => ({
        NmbItem: item.name,
        QtyItem: item.quantity,
        PrcItem: item.unitPrice,
        MontoItem: item.total,
      })),
    },
  };

  try {
    const res = await fetch(`${apiUrl}/dte/document`, {
      method: "POST",
      headers: { "apikey": apiToken, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const data = await res.json();
    if (data.FOLIO) {
      return { success: true, folio: data.FOLIO, pdfUrl: data.PDF || null };
    }
    return { success: false, error: data.MENSAJE || "Error Haulmer" };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}
