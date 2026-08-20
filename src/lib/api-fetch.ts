/**
 * Tenant-aware fetch wrapper.
 * Automatically appends tenantId to all API calls.
 * 
 * Usage: import { apiFetch } from "@/lib/api-fetch";
 * const data = await apiFetch("/api/services");
 */

let cachedTenantId: string | null = null;

export function setTenantId(id: string | null) {
  cachedTenantId = id;
}

export function getTenantId(): string | null {
  return cachedTenantId;
}

export async function apiFetch(url: string, options?: RequestInit): Promise<Response> {
  // Append tenantId to URL
  if (cachedTenantId) {
    const separator = url.includes("?") ? "&" : "?";
    url = `${url}${separator}tenantId=${cachedTenantId}`;
  }
  return fetch(url, options);
}
