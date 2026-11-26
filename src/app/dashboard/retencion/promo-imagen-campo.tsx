"use client";

import { useState } from "react";
import { ImagePlus, X } from "lucide-react";
import { compressImage } from "@/lib/image-compress";

export function PromoImagenCampo({ url, onChange, tenantId, showToast }: {
  url: string; onChange: (u: string) => void; tenantId?: string; showToast: (m: string, t?: "success" | "error" | "info") => void;
}) {
  const [subiendo, setSubiendo] = useState(false);
  const subir = async (original: File) => {
    setSubiendo(true);
    try {
      // Se achica en el navegador para que el correo cargue rápido.
      const file = await compressImage(original, { maxDimension: 1200, maxBytes: 600 * 1024 });
      const form = new FormData();
      form.append("file", file);
      if (tenantId) form.append("tenantId", tenantId);
      const res = await fetch("/api/retention/imagen", { method: "POST", body: form });
      const d = await res.json().catch(() => ({}));
      if (!res.ok || !d.url) { showToast(d.error || "No se pudo subir la imagen", "error"); return; }
      onChange(d.url);
    } catch {
      showToast("No se pudo leer esa imagen. Prueba con un JPG o PNG.", "error");
    } finally {
      setSubiendo(false);
    }
  };
  return (
    <div>
      <span className="mb-1.5 block text-xs font-semibold text-brand-gray">Imagen del correo (opcional)</span>
      {url ? (
        <div className="flex items-center gap-3">
          <img src={url} alt="Imagen de la promoción" className="h-16 w-24 rounded-lg border border-gray-200 object-cover" />
          <button type="button" onClick={() => onChange("")} className="inline-flex items-center gap-1 text-xs font-semibold text-brand-gray hover:text-red-500"><X className="h-3.5 w-3.5" /> Quitar</button>
        </div>
      ) : (
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-gray-200 bg-white px-3.5 py-2 text-xs font-semibold text-brand-dark hover:border-brand-blue/50">
          <ImagePlus className="h-4 w-4" /> {subiendo ? "Subiendo…" : "Añadir imagen"}
          <input type="file" accept="image/*" className="hidden" disabled={subiendo} onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) void subir(f); }} />
        </label>
      )}
      <p className="mt-1.5 text-[11px] text-brand-gray">Va solo en el correo. WhatsApp no permite adjuntarla desde aquí.</p>
    </div>
  );
}
