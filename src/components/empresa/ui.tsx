"use client";

import { useCallback, useEffect, useState } from "react";

export const INPUT = "h-10 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm text-brand-dark focus:outline-none focus:ring-2 focus:ring-brand-blue";
export const BUTTON = "h-10 rounded-lg bg-brand-blue px-4 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60";
export const BUTTON_LIGHT = "h-10 rounded-lg border border-gray-300 bg-white px-4 text-sm font-semibold text-brand-dark hover:bg-gray-50 disabled:opacity-60";
export const CARD = "rounded-xl border border-gray-200 bg-white p-4";
export const TH = "px-3 py-2 text-left text-xs font-semibold uppercase text-gray-500";
export const TD = "px-3 py-2 text-sm text-brand-dark";

export async function api<T = any>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(`/api/empresa/${path}`, body === undefined ? undefined : {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "No se pudo completar la acción.");
  return data as T;
}

export async function apiPatch<T = any>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`/api/empresa/${path}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "No se pudo completar la acción.");
  return data as T;
}

export const errorText = (e: unknown, fallback = "No se pudo completar la acción.") => (e instanceof Error ? e.message : fallback);

export function useApi<T = any>(path: string) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState("");
  const reload = useCallback(async () => {
    try {
      setData(await api<T>(path));
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo cargar.");
    }
  }, [path]);
  useEffect(() => { reload(); }, [reload]);
  return { data, error, reload };
}

export function Message({ error, ok }: { error?: string; ok?: string }) {
  if (error) return <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>;
  if (ok) return <p role="status" className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">{ok}</p>;
  return null;
}

export function Title({ children }: { children: React.ReactNode }) {
  return <h1 className="mb-3 text-lg font-bold text-brand-dark">{children}</h1>;
}

export function Table({ head, children }: { head: string[]; children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
      <table className="w-full min-w-max">
        <thead className="border-b border-gray-200"><tr>{head.map((h) => <th key={h} className={TH}>{h}</th>)}</tr></thead>
        <tbody className="divide-y divide-gray-100">{children}</tbody>
      </table>
    </div>
  );
}

export const ORDER_STATUS: Record<string, string> = {
  draft: "Borrador", confirmed: "Confirmado", prepared: "Preparado", dispatched: "Despachado", delivered: "Entregado", cancelled: "Cancelado",
};
export const ROLE_LABEL: Record<string, string> = { owner: "Dueño", seller: "Vendedor", warehouse: "Bodega" };
export const COUNT_STATUS: Record<string, string> = { open: "Abierto", closed: "Cerrado", cancelled: "Cancelado" };
