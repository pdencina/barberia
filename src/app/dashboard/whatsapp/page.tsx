"use client";

import { useState, useEffect } from "react";
import { useToast } from "@/components/ui/toast";

interface Client {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  lastVisit: string | null;
}

export default function WhatsAppBroadcastPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [filter, setFilter] = useState<"all" | "inactive" | "recent">("all");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [copied, setCopied] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const { showToast } = useToast();

  useEffect(() => {
    fetch("/api/whatsapp/contacts")
      .then((r) => r.json())
      .then((data) => {
        setClients(Array.isArray(data) ? data : []);
        setSelectedIds(new Set(data.filter((c: Client) => c.phone).map((c: Client) => c.id)));
      })
      .finally(() => setLoading(false));
  }, []);

  const filtered = clients.filter((c) => {
    if (!c.phone) return false;
    if (filter === "inactive") {
      if (!c.lastVisit) return true;
      const days = (Date.now() - new Date(c.lastVisit).getTime()) / (1000 * 60 * 60 * 24);
      return days > 30;
    }
    if (filter === "recent") {
      if (!c.lastVisit) return false;
      const days = (Date.now() - new Date(c.lastVisit).getTime()) / (1000 * 60 * 60 * 24);
      return days <= 30;
    }
    return true;
  });

  const selected = filtered.filter((c) => selectedIds.has(c.id));

  const formatPhone = (phone: string): string => {
    let cleaned = phone.replace(/[^0-9+]/g, "");
    if (cleaned.startsWith("+")) return cleaned;
    if (cleaned.startsWith("56")) return "+" + cleaned;
    if (cleaned.startsWith("9") && cleaned.length === 9) return "+56" + cleaned;
    return "+56" + cleaned;
  };

  const copyPhones = async () => {
    const phones = selected.map((c) => formatPhone(c.phone!)).join("\n");
    await navigator.clipboard.writeText(phones);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    showToast(`${selected.length} numeros copiados`, "success");
  };

  const copyMessage = async () => {
    await navigator.clipboard.writeText(message);
    showToast("Mensaje copiado", "success");
  };

  const copyAll = async () => {
    const phones = selected.map((c) => formatPhone(c.phone!));
    const text = `📋 MENSAJE PARA BROADCAST:\n━━━━━━━━━━━━━━━━━━━━━━\n\n${message}\n\n━━━━━━━━━━━━━━━━━━━━━━\n📱 CONTACTOS (${phones.length}):\n\n${phones.join("\n")}`;
    await navigator.clipboard.writeText(text);
    showToast(`Mensaje + ${phones.length} contactos copiados`, "success");
  };

  const toggleAll = () => {
    if (selectedIds.size === filtered.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map((c) => c.id)));
    }
  };

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-5">
      <div>
        <h1 className="text-xl md:text-2xl font-bold text-brand-dark">WhatsApp Broadcast</h1>
        <p className="text-sm text-brand-gray">Envia mensajes masivos via WhatsApp Business</p>
      </div>

      {/* Instructions */}
      <div className="bg-green-50 border border-green-200 rounded-2xl p-4">
        <p className="text-sm font-medium text-green-800 mb-2">Como funciona:</p>
        <ol className="text-xs text-green-700 space-y-1 list-decimal pl-4">
          <li>Escribe tu mensaje abajo</li>
          <li>Selecciona los contactos (o filtra por segmento)</li>
          <li>Copia los numeros → pegalos como contactos en una Lista de Difusion de WhatsApp Business</li>
          <li>Copia el mensaje → pega y envia a la lista</li>
        </ol>
      </div>

      {/* Message composer */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-brand-dark text-sm">Mensaje</h3>
          <button onClick={copyMessage} disabled={!message.trim()}
            className="text-xs text-brand-blue hover:underline disabled:opacity-40">
            Copiar mensaje
          </button>
        </div>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Ej: Hola! Te recordamos que puedes agendar tu proximo corte en nuestro link: rebooking.cl/booking"
          rows={4}
          className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-brand-dark placeholder:text-brand-gray resize-none focus:ring-2 focus:ring-brand-blue focus:border-transparent outline-none"
        />
        <div className="flex gap-2 flex-wrap">
          {[
            { label: "Link booking", text: "https://barberia-kappa-weld.vercel.app/booking" },
            { label: "Saludo", text: "Hola! " },
            { label: "Cupon", text: "\n\nUsa tu cupon: VUELVE10" },
          ].map((t) => (
            <button key={t.label} onClick={() => setMessage(message + t.text)}
              className="px-2 py-1 bg-brand-light border border-gray-200 rounded-lg text-[11px] text-brand-gray hover:border-brand-blue hover:text-brand-blue">
              + {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="flex bg-white rounded-xl border border-gray-100 p-1 gap-1">
          {[
            { key: "all", label: "Todos" },
            { key: "inactive", label: "Inactivos (+30d)" },
            { key: "recent", label: "Recientes" },
          ].map((f) => (
            <button key={f.key} onClick={() => setFilter(f.key as any)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${filter === f.key ? "bg-brand-blue text-white" : "text-brand-gray hover:text-brand-dark"}`}>
              {f.label}
            </button>
          ))}
        </div>
        <span className="text-xs text-brand-gray ml-auto">
          {selected.length}/{filtered.length} seleccionados
        </span>
      </div>

      {/* Contact list */}
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <div className="p-3 border-b border-gray-50 flex items-center justify-between">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={selectedIds.size === filtered.length && filtered.length > 0}
              onChange={toggleAll} className="rounded border-gray-300 text-brand-blue focus:ring-brand-blue" />
            <span className="text-xs text-brand-gray font-medium">Seleccionar todos</span>
          </label>
        </div>
        <div className="max-h-64 overflow-y-auto divide-y divide-gray-50">
          {loading ? (
            <p className="p-4 text-center text-brand-gray text-sm">Cargando...</p>
          ) : filtered.length === 0 ? (
            <p className="p-4 text-center text-brand-gray text-sm">Sin contactos con telefono</p>
          ) : filtered.map((c) => (
            <label key={c.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-brand-light/50 cursor-pointer">
              <input type="checkbox" checked={selectedIds.has(c.id)}
                onChange={() => {
                  const next = new Set(selectedIds);
                  next.has(c.id) ? next.delete(c.id) : next.add(c.id);
                  setSelectedIds(next);
                }}
                className="rounded border-gray-300 text-brand-blue focus:ring-brand-blue" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-brand-dark truncate">{c.name}</p>
                <p className="text-xs text-brand-gray">{formatPhone(c.phone!)}</p>
              </div>
              {c.lastVisit && (
                <span className="text-[10px] text-brand-gray">
                  {new Date(c.lastVisit).toLocaleDateString("es-CL", { day: "numeric", month: "short" })}
                </span>
              )}
            </label>
          ))}
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex flex-col sm:flex-row gap-3">
        <button onClick={copyPhones} disabled={selected.length === 0}
          className="flex-1 py-3 bg-green-600 text-white font-medium rounded-xl hover:bg-green-700 disabled:opacity-40 transition-colors flex items-center justify-center gap-2">
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/></svg>
          {copied ? "Copiados!" : `Copiar ${selected.length} numeros`}
        </button>
        <button onClick={copyAll} disabled={selected.length === 0 || !message.trim()}
          className="flex-1 py-3 bg-brand-blue text-white font-medium rounded-xl hover:bg-blue-700 disabled:opacity-40 transition-colors">
          Copiar todo (mensaje + contactos)
        </button>
      </div>
    </div>
  );
}
