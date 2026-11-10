"use client";

import { useState } from "react";
import { api, BUTTON, BUTTON_LIGHT, CARD, errorText, INPUT, Message, Table, TD, Title, useApi } from "@/components/empresa/ui";

type Kind = "productos" | "clientes";

const AYUDA: Record<Kind, string> = {
  productos: "Sirve la exportación de productos de Bsale. Columnas que reconozco: Nombre o Producto (obligatoria), Variante, SKU o Código, Descripción, Categoría, Unidad, Precio (o Precio Venta Bruto), Costo, Stock mínimo, Stock y Bodega o Sucursal. El stock se carga solo si el producto aún no tiene stock en esa bodega; para corregir un stock existente usa una toma de inventario.",
  clientes: "Sirve la exportación de clientes de Bsale. Columnas que reconozco: Nombre o Razón social (obligatoria), RUT, Contacto, Teléfono o Celular, Correo, Dirección, Ciudad o Comuna, Tipo (distribuidor/cliente), Vendedor (su correo o nombre) y Acepta WhatsApp (sí/no).",
};

export default function ImportarPage() {
  const warehouses = useApi<{ warehouses: any[] }>("bodegas");
  const [kind, setKind] = useState<Kind>("productos");
  const [rows, setRows] = useState<unknown[][] | null>(null);
  const [fileName, setFileName] = useState("");
  const [warehouseId, setWarehouseId] = useState("");
  const [preview, setPreview] = useState<any>(null);
  const [result, setResult] = useState<any>(null);
  const [msg, setMsg] = useState<{ error?: string; ok?: string }>({});
  const [busy, setBusy] = useState(false);

  const reset = () => { setPreview(null); setResult(null); setMsg({}); };

  // El archivo se lee en el navegador; el servidor interpreta las columnas y valida todo.
  const readFile = async (file: File) => {
    reset();
    setFileName(file.name);
    try {
      const XLSX = (await import("xlsx")).default;
      const wb = XLSX.read(await file.arrayBuffer(), { type: "array" });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const data = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, raw: false, defval: "" });
      setRows(data.map((r) => (Array.isArray(r) ? r.slice(0, 60).map((c) => String(c ?? "").slice(0, 500)) : [])));
    } catch {
      setRows(null);
      setMsg({ error: "No pude leer el archivo. Guárdalo como .xlsx o .csv e inténtalo de nuevo." });
    }
  };

  const send = async (dryRun: boolean) => {
    if (!rows) return;
    setBusy(true);
    setMsg({});
    try {
      const r = await api("importar", { kind, rows, dryRun, warehouseId: warehouseId || undefined });
      if (dryRun) setPreview(r);
      else { setResult(r); setPreview(null); setMsg({ ok: "Importación terminada." }); }
    } catch (e) {
      setMsg({ error: errorText(e) });
    } finally {
      setBusy(false);
    }
  };

  const errors: any[] = (result || preview)?.errors || [];
  return (
    <div className="space-y-4">
      <Title>Importar desde Excel</Title>
      <div className={`${CARD} space-y-3`}>
        <div className="flex flex-wrap gap-2">
          {(["productos", "clientes"] as Kind[]).map((k) => (
            <button key={k} className={kind === k ? BUTTON : BUTTON_LIGHT} onClick={() => { setKind(k); reset(); }}>{k === "productos" ? "Productos y stock" : "Clientes"}</button>
          ))}
        </div>
        <p className="text-sm text-gray-600">{AYUDA[kind]}</p>
        <input aria-label="Archivo" type="file" accept=".xlsx,.xls,.csv" className="text-sm" onChange={(e) => e.target.files?.[0] && readFile(e.target.files[0])} />
        {kind === "productos" && (
          <select aria-label="Bodega del stock" className={`${INPUT} sm:w-80`} value={warehouseId} onChange={(e) => { setWarehouseId(e.target.value); setPreview(null); }}>
            <option value="">Bodega del stock (si el archivo no trae la columna)</option>
            {warehouses.data?.warehouses.filter((w) => w.active).map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
          </select>
        )}
        {rows && <p className="text-sm text-gray-600">{fileName}: {Math.max(0, rows.length - 1)} filas.</p>}
        <div className="flex flex-wrap gap-2">
          <button className={BUTTON_LIGHT} disabled={!rows || busy} onClick={() => send(true)}>Revisar</button>
          <button className={BUTTON} disabled={!preview || busy} onClick={() => send(false)}>{busy ? "Importando..." : "Importar"}</button>
        </div>
        <Message {...msg} />
      </div>

      {preview && (
        <div className={`${CARD} space-y-2`}>
          <p className="text-sm text-brand-dark">
            Se crearán <b>{preview.create}</b> y se completarán <b>{preview.update}</b> {kind}.
            {kind === "productos" && <> Filas con stock inicial: <b>{preview.stockRows}</b>.</>}
            {kind === "clientes" && preview.optIn > 0 && <> Con permiso de WhatsApp: <b>{preview.optIn}</b>.</>} Nada se borra.
          </p>
          <Table head={["Fila", kind === "productos" ? "SKU" : "RUT", "Nombre", kind === "productos" ? "Precio" : "Celular", kind === "productos" ? "Stock" : "Vendedor", "Acción"]}>
            {preview.preview.map((p: any) => (
              <tr key={p.row}>
                <td className={TD}>{p.row}</td>
                <td className={TD}>{(kind === "productos" ? p.sku : p.taxId) || "-"}</td>
                <td className={TD}>{p.name}</td>
                <td className={TD}>{(kind === "productos" ? p.price : p.phone) ?? "-"}</td>
                <td className={TD}>{(kind === "productos" ? p.stock : p.seller) ?? "-"}</td>
                <td className={TD}>{p.action}</td>
              </tr>
            ))}
          </Table>
        </div>
      )}
      {result && (
        <div className={CARD}>
          <p className="text-sm text-brand-dark">
            Creados: <b>{result.created}</b> · Actualizados: <b>{result.updated}</b>
            {kind === "productos" && <> · Stock cargado: <b>{result.stockApplied}</b> · Stock no tocado (ya tenía): <b>{result.stockSkipped}</b></>}
          </p>
        </div>
      )}
      {errors.length > 0 && (
        <Table head={["Fila", "Aviso"]}>
          {errors.map((e, i) => <tr key={i}><td className={TD}>{e.row}</td><td className={TD}>{e.message}</td></tr>)}
        </Table>
      )}
    </div>
  );
}
