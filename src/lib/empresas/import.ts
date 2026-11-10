// Importación de catálogo y clientes comerciales desde Excel/CSV (Etapa 1). Funciones puras: reciben las filas ya leídas
// (la primera es la de títulos) y devuelven filas limpias + errores por fila. Reconoce los títulos más comunes en Chile.

export type ImportKind = "productos" | "clientes";

export type ProductRow = {
  row: number; sku: string | null; name: string; variant?: string | null; description: string | null; category: string | null; unit: string | null;
  listPrice: number | null; cost: number | null; minStock: number | null; stock: number | null; warehouse: string | null;
};
export type CustomerRow = {
  row: number; name: string; taxId: string | null; contactName: string | null; phone: string | null; email: string | null;
  address: string | null; city: string | null; customerType: "client" | "distributor"; seller: string | null; whatsappOptIn?: boolean;
};
export type RowError = { row: number; message: string };

export const MAX_IMPORT_ROWS = 5000;

const norm = (h: unknown) =>
  String(h ?? "").replace(/^﻿/, "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[_\-.:/()]/g, " ").replace(/\s+/g, " ").trim();

const cell = (v: unknown, max = 300): string | null => {
  const s = String(v ?? "").trim();
  if (!s || /^(null|undefined|n\/a|nan|-)$/i.test(s)) return null;
  return s.slice(0, max);
};

// Cada campo: títulos aceptados (ya normalizados). Se busca primero coincidencia exacta y después "empieza con".
// Incluye los títulos de las exportaciones de Bsale (Producto, Variante, SKU, Precio Venta Bruto, Sucursal, Razón Social...).
const PRODUCT_HEADERS: Record<keyof Omit<ProductRow, "row">, string[]> = {
  sku: ["sku", "codigo", "cod", "codigo producto", "referencia", "ref", "codigo interno", "codigo sku"],
  name: ["nombre", "producto", "nombre producto", "articulo", "item"],
  variant: ["variante", "nombre variante"],
  description: ["descripcion", "detalle"],
  category: ["categoria", "familia", "linea", "tipo"],
  unit: ["unidad", "unidad medida", "um", "formato"],
  listPrice: ["precio venta bruto", "precio bruto", "precio publico", "precio", "precio venta", "precio lista", "precio unitario", "valor", "pvp"],
  cost: ["costo", "costo unitario", "precio costo", "precio compra"],
  minStock: ["stock minimo", "minimo", "stock min", "min"],
  stock: ["stock", "cantidad", "existencia", "saldo", "stock actual", "unidades"],
  warehouse: ["bodega", "sucursal", "almacen", "ubicacion"],
};
const CUSTOMER_HEADERS: Record<keyof Omit<CustomerRow, "row">, string[]> = {
  name: ["nombre", "razon social", "cliente", "nombre cliente", "empresa", "negocio", "local"],
  taxId: ["rut", "rut cliente", "rut empresa"],
  contactName: ["contacto", "nombre contacto", "encargado"],
  phone: ["telefono", "celular", "fono", "whatsapp", "movil", "telefono contacto"],
  email: ["correo", "email", "mail", "e mail", "correo electronico"],
  address: ["direccion", "domicilio"],
  city: ["ciudad", "comuna", "region"],
  customerType: ["tipo", "tipo cliente", "segmento"],
  seller: ["vendedor", "ejecutivo", "vendedor asignado"],
  whatsappOptIn: ["permiso whatsapp", "acepta whatsapp", "acepta ofertas", "recibe whatsapp", "recibe ofertas", "opt in", "autoriza whatsapp"],
};

function mapHeaders<K extends string>(header: unknown[], spec: Record<K, string[]>): Partial<Record<K, number>> {
  const heads = header.map(norm);
  const out: Partial<Record<K, number>> = {};
  const used = new Set<number>();
  // Pasada 1: coincidencia exacta. Pasada 2: el título empieza con el alias (ej. "precio venta ($)").
  for (const exact of [true, false]) {
    for (const key of Object.keys(spec) as K[]) {
      if (out[key] !== undefined) continue;
      const idx = heads.findIndex((h, i) => !used.has(i) && spec[key].some((a) => (exact ? h === a : h.startsWith(a + " "))));
      if (idx >= 0) { out[key] = idx; used.add(idx); }
    }
  }
  return out;
}

/** "$12.000" → 12000 · "12.000,5" → 12000.5 · "1,5" → 1.5 · "8000" → 8000. Vacío → null. NaN → undefined (error). */
export function parseNumber(v: unknown): number | null | undefined {
  if (typeof v === "number") return Number.isFinite(v) ? v : undefined;
  const s = cell(v, 40);
  if (s === null) return null;
  let t = s.replace(/[$\s]|clp/gi, "");
  if (/^-?\d{1,3}(\.\d{3})+(,\d+)?$/.test(t)) t = t.replace(/\./g, "").replace(",", ".");
  else if (/^-?\d+,\d+$/.test(t)) t = t.replace(",", ".");
  else if (/^-?\d{1,3}(,\d{3})+(\.\d+)?$/.test(t)) t = t.replace(/,/g, "");
  const n = Number(t);
  return Number.isFinite(n) ? n : undefined;
}

const isBlankRow = (r: unknown[]) => r.every((c) => cell(c) === null);

export function parseProducts(rows: unknown[][]): { items: ProductRow[]; errors: RowError[]; missing: string[] } {
  const errors: RowError[] = [];
  if (rows.length < 2) return { items: [], errors: [{ row: 1, message: "El archivo no tiene filas." }], missing: [] };
  const h = mapHeaders(rows[0], PRODUCT_HEADERS);
  if (h.name === undefined) return { items: [], errors: [], missing: ["Nombre del producto"] };
  const items: ProductRow[] = [];
  const seenSku = new Set<string>();
  rows.slice(1, MAX_IMPORT_ROWS + 1).forEach((r, i) => {
    const row = i + 2;
    if (!Array.isArray(r) || isBlankRow(r)) return;
    const get = (k: keyof typeof h) => (h[k] === undefined ? undefined : r[h[k]!]);
    const name = cell(get("name"), 200);
    if (!name) { errors.push({ row, message: "Falta el nombre." }); return; }
    const nums: Record<string, number | null> = {};
    for (const k of ["listPrice", "cost", "minStock", "stock"] as const) {
      const n = parseNumber(get(k));
      if (n === undefined || (n !== null && n < 0)) { errors.push({ row, message: `Número no válido en ${k === "listPrice" ? "precio" : k === "cost" ? "costo" : k === "minStock" ? "stock mínimo" : "stock"}.` }); return; }
      nums[k] = n;
    }
    if ((nums.minStock !== null && !Number.isInteger(nums.minStock)) || (nums.stock !== null && !Number.isInteger(nums.stock))) {
      errors.push({ row, message: "El stock debe ser un número entero." }); return;
    }
    const sku = cell(get("sku"), 80);
    if (sku) {
      const key = sku.toLowerCase();
      if (seenSku.has(key)) { errors.push({ row, message: `SKU repetido en el archivo: ${sku}.` }); return; }
      seenSku.add(key);
    }
    // Bsale exporta producto y variante por separado: "Shampoo" + "500 ml" → "Shampoo 500 ml".
    const variant = cell(get("variant"), 100);
    const fullName = variant && !/^(unica|única|default|-)$/i.test(variant) ? `${name} ${variant}`.slice(0, 200) : name;
    items.push({
      row, sku, name: fullName,
      description: cell(get("description"), 1000), category: cell(get("category"), 100), unit: cell(get("unit"), 40),
      listPrice: nums.listPrice, cost: nums.cost, minStock: nums.minStock, stock: nums.stock, warehouse: cell(get("warehouse"), 120),
    });
  });
  return { items, errors, missing: [] };
}

const cleanRut = (s: string | null) => (s ? s.replace(/[.\s]/g, "").toUpperCase().slice(0, 20) : null);

export function parseCustomers(rows: unknown[][]): { items: CustomerRow[]; errors: RowError[]; missing: string[] } {
  const errors: RowError[] = [];
  if (rows.length < 2) return { items: [], errors: [{ row: 1, message: "El archivo no tiene filas." }], missing: [] };
  const h = mapHeaders(rows[0], CUSTOMER_HEADERS);
  if (h.name === undefined) return { items: [], errors: [], missing: ["Nombre del cliente"] };
  const items: CustomerRow[] = [];
  const seenRut = new Set<string>();
  rows.slice(1, MAX_IMPORT_ROWS + 1).forEach((r, i) => {
    const row = i + 2;
    if (!Array.isArray(r) || isBlankRow(r)) return;
    const get = (k: keyof typeof h) => (h[k] === undefined ? undefined : r[h[k]!]);
    const name = cell(get("name"), 200);
    if (!name) { errors.push({ row, message: "Falta el nombre." }); return; }
    const taxId = cleanRut(cell(get("taxId"), 30));
    if (taxId) {
      if (seenRut.has(taxId)) { errors.push({ row, message: `RUT repetido en el archivo: ${taxId}.` }); return; }
      seenRut.add(taxId);
    }
    const email = cell(get("email"), 200);
    const tipo = norm(get("customerType"));
    items.push({
      row, name, taxId,
      contactName: cell(get("contactName"), 200), phone: cell(get("phone"), 40),
      email: email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email.toLowerCase() : null,
      address: cell(get("address"), 300), city: cell(get("city"), 100),
      customerType: /distrib|mayor|revend/.test(tipo) ? "distributor" : "client",
      seller: cell(get("seller"), 200),
      whatsappOptIn: /^(si|sí|s|x|1|true|ok|acepta)$/i.test(String(get("whatsappOptIn") ?? "").trim()),
    });
  });
  return { items, errors, missing: [] };
}
