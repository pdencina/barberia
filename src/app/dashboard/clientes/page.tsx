"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/toast";
import { Spinner } from "@/components/ui/spinner";

interface Client {
  id: string;
  name: string;
  email: string;
  phone: string;
  notes: string;
}

export default function ClientesPage() {
  const router = useRouter();
  const [clients, setClients] = useState<Client[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({ name: "", email: "", phone: "", notes: "" });
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);
  const debounceRef = useRef<NodeJS.Timeout>();
  const { showToast } = useToast();

  const fetchClients = async (query: string) => {
    setLoading(true);
    try {
      const params = query ? `?search=${encodeURIComponent(query)}` : "";
      const res = await fetch(`/api/clients${params}`);
      const data = await res.json();
      setClients(data.clients || data || []);
    } catch (err) {
      console.error("Error fetching clients:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchClients(""); }, []);

  const handleSearch = (value: string) => {
    setSearch(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchClients(value), 300);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await fetch("/api/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      showToast("Cliente creado exitosamente", "success");
      setShowModal(false);
      setFormData({ name: "", email: "", phone: "", notes: "" });
      fetchClients(search);
    } catch (err) {
      console.error("Error creating client:", err);
      showToast("Error al crear cliente", "error");
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedIds.size === clients.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(clients.map((c) => c.id)));
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`Eliminar ${selectedIds.size} cliente(s)? Esta accion no se puede deshacer.`)) return;
    setDeleting(true);
    await fetch("/api/clients/bulk-delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: Array.from(selectedIds) }),
    });
    showToast(`${selectedIds.size} cliente(s) eliminados`, "success");
    setSelectedIds(new Set());
    setDeleting(false);
    fetchClients(search);
  };

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-6 animate-fade-in">
      <div className="flex justify-between items-center">
        <h1 className="text-xl md:text-2xl font-bold text-gray-900">Clientes</h1>
        <div className="flex gap-2">
          <label className="px-3 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 text-sm cursor-pointer">
            Importar CSV/Excel
            <input type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;

              let clients: Array<{ name: string; email: string | null; phone: string | null }> = [];

              if (file.name.endsWith(".csv")) {
                // Parse CSV
                const text = await file.text();
                const lines = text.split("\n").filter(Boolean);
                const headers = lines[0].toLowerCase().split(",").map((h: string) => h.trim().replace(/"/g, ""));
                const nameIdx = headers.findIndex((h: string) => h.includes("nombre") || h === "name" || h === "full name");
                const firstNameIdx = headers.findIndex((h: string) => h === "first name" || h === "first_name" || h.includes("primer"));
                const lastNameIdx = headers.findIndex((h: string) => h === "last name" || h === "last_name" || h.includes("apellido"));
                const emailIdx = headers.findIndex((h: string) => h.includes("email") || h.includes("correo") || h.includes("e-mail"));
                const phoneIdx = headers.findIndex((h: string) => h.includes("telefono") || h.includes("phone") || h.includes("fono") || h.includes("mobile") || h.includes("celular"));
                
                if (nameIdx === -1 && firstNameIdx === -1) { alert("Archivo debe tener columna Nombre (o First Name)"); return; }
                
                clients = lines.slice(1).map((line: string) => {
                  const cols = line.split(",").map((c: string) => c.trim().replace(/"/g, ""));
                  let name = "";
                  if (nameIdx !== -1) {
                    name = cols[nameIdx] || "";
                  } else {
                    // Concatenate First Name + Last Name (Setmore format)
                    const first = cols[firstNameIdx] || "";
                    const last = lastNameIdx !== -1 ? cols[lastNameIdx] || "" : "";
                    name = `${first} ${last}`.trim();
                  }
                  return { name, email: cols[emailIdx] || null, phone: cols[phoneIdx] || null };
                }).filter((c: any) => c.name);
              } else {
                // Parse Excel
                const XLSX = (await import("xlsx")).default;
                const buffer = await file.arrayBuffer();
                const workbook = XLSX.read(buffer, { type: "array" });
                const sheet = workbook.Sheets[workbook.SheetNames[0]];
                const rows: any[] = XLSX.utils.sheet_to_json(sheet, { defval: "" });
                if (rows.length === 0) { alert("Archivo vacio"); return; }
                // Detect columns by header name
                const headers = Object.keys(rows[0]).map((h) => h.toLowerCase());
                const nameKey = Object.keys(rows[0]).find((k) => k.toLowerCase().includes("nombre") || k.toLowerCase() === "name" || k.toLowerCase() === "full name");
                const firstNameKey = Object.keys(rows[0]).find((k) => k.toLowerCase() === "first name" || k.toLowerCase() === "first_name" || k.toLowerCase().includes("primer"));
                const lastNameKey = Object.keys(rows[0]).find((k) => k.toLowerCase() === "last name" || k.toLowerCase() === "last_name" || k.toLowerCase().includes("apellido"));
                const emailKey = Object.keys(rows[0]).find((k) => k.toLowerCase().includes("email") || k.toLowerCase().includes("correo") || k.toLowerCase().includes("e-mail"));
                const phoneKey = Object.keys(rows[0]).find((k) => k.toLowerCase().includes("telefono") || k.toLowerCase().includes("phone") || k.toLowerCase().includes("fono") || k.toLowerCase().includes("celular") || k.toLowerCase().includes("mobile"));
                
                if (!nameKey && !firstNameKey) { alert("Excel debe tener columna Nombre (o First Name)"); return; }
                
                clients = rows.map((row: any) => {
                  let name = "";
                  if (nameKey) {
                    name = String(row[nameKey] || "").trim();
                  } else {
                    const first = String(row[firstNameKey!] || "").trim();
                    const last = lastNameKey ? String(row[lastNameKey] || "").trim() : "";
                    name = `${first} ${last}`.trim();
                  }
                  return {
                    name,
                    email: emailKey ? String(row[emailKey] || "").trim() || null : null,
                    phone: phoneKey ? String(row[phoneKey] || "").trim() || null : null,
                  };
                }).filter((c) => c.name);
              }

              if (clients.length === 0) { alert("No se encontraron clientes en el archivo"); return; }
              if (!confirm(`Se encontraron ${clients.length} clientes. Importar?`)) return;

              const res = await fetch("/api/clients/import", {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ clients }),
              });
              const data = await res.json();
              showToast(`${data.imported} importados, ${data.skipped} duplicados omitidos`, "success");
              fetchClients("");
              e.target.value = "";
            }} />
          </label>
          <a href="/api/clients/export" download
            className="px-3 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 text-sm">
            Exportar
          </a>
          <button onClick={() => setShowModal(true)}
            className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 text-sm">
            Nuevo
          </button>
        </div>
      </div>

      <input type="text" placeholder="Buscar por nombre, email o telefono..."
        value={search} onChange={(e) => handleSearch(e.target.value)}
        className="w-full border rounded-lg px-4 py-2" />

      {/* Bulk actions bar */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-xl px-4 py-2.5">
          <span className="text-sm text-red-700 font-medium">{selectedIds.size} seleccionado(s)</span>
          <button onClick={handleBulkDelete} disabled={deleting}
            className="px-3 py-1.5 bg-red-600 text-white text-xs rounded-lg hover:bg-red-700 disabled:opacity-50 font-medium">
            {deleting ? "Eliminando..." : "Eliminar seleccionados"}
          </button>
          <button onClick={() => setSelectedIds(new Set())}
            className="px-3 py-1.5 border border-gray-300 text-xs rounded-lg hover:bg-white text-brand-gray">
            Cancelar
          </button>
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="p-4 w-10">
                <input type="checkbox" checked={clients.length > 0 && selectedIds.size === clients.length}
                  onChange={toggleAll}
                  className="w-4 h-4 rounded border-gray-300" />
              </th>
              <th className="text-left p-4 font-medium text-gray-600">Nombre</th>
              <th className="text-left p-4 font-medium text-gray-600">Email</th>
              <th className="text-left p-4 font-medium text-gray-600">Telefono</th>
              <th className="text-left p-4 font-medium text-gray-600">Notas</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {loading ? (
              <tr><td colSpan={5}><Spinner /></td></tr>
            ) : clients.length === 0 ? (
              <tr><td colSpan={5} className="p-4 text-center text-gray-500">No hay clientes</td></tr>
            ) : clients.map((c) => (
              <tr key={c.id} className="hover:bg-gray-50">
                <td className="p-4" onClick={(e) => e.stopPropagation()}>
                  <input type="checkbox" checked={selectedIds.has(c.id)}
                    onChange={() => toggleSelect(c.id)}
                    className="w-4 h-4 rounded border-gray-300" />
                </td>
                <td className="p-4 font-medium text-blue-600 hover:underline cursor-pointer" onClick={() => router.push(`/dashboard/clientes/${c.id}`)}>{c.name}</td>
                <td className="p-4">{c.email || "-"}</td>
                <td className="p-4">{c.phone || "-"}</td>
                <td className="p-4 text-gray-500">{c.notes || "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-modal flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-5 md:p-6 w-full max-w-md shadow-xl animate-scale-in">
            <h2 className="text-lg font-bold mb-4">Nuevo Cliente</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre</label>
                <input type="text" required value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input type="email" value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Telefono</label>
                <input type="text" value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notas</label>
                <textarea value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2" rows={2} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Como nos conocio?</label>
                <select value={(formData as any).source || ""}
                  onChange={(e) => setFormData({ ...formData, source: e.target.value } as any)}
                  className="w-full border rounded-lg px-3 py-2">
                  <option value="">Seleccionar...</option>
                  <option value="friend">Amigo / Referido</option>
                  <option value="google_maps">Google Maps</option>
                  <option value="instagram">Instagram</option>
                  <option value="tiktok">TikTok</option>
                  <option value="ads">Publicidad</option>
                  <option value="other">Otro</option>
                </select>
              </div>
              {(formData as any).source === "instagram" && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Cuenta de Instagram</label>
                  <input type="text" value={(formData as any).source_detail || ""}
                    onChange={(e) => setFormData({ ...formData, source_detail: e.target.value } as any)}
                    placeholder="@usuario"
                    className="w-full border rounded-lg px-3 py-2" />
                </div>
              )}
              <div className="flex gap-2 justify-end">
                <button type="button" onClick={() => setShowModal(false)}
                  className="px-4 py-2 border rounded-lg hover:bg-gray-50">Cancelar</button>
                <button type="submit"
                  disabled={!formData.name.trim()}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed">Guardar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
