"use client";

import { useEffect, useState } from "react";
import { DEFAULT_WHATSAPP_CONFIG, mergeWhatsAppConfig, type WhatsAppMessagesConfig } from "@/lib/whatsapp-confirm";

// Mensajes de WhatsApp del negocio, leidos una sola vez y compartidos (Calendario, Mi Agenda, ajustes).
// Mientras carga (o si falla / falta la migracion 113) se usan los mensajes de siempre.
let cached: WhatsAppMessagesConfig | null = null;
let inflight: Promise<WhatsAppMessagesConfig> | null = null;

function load(): Promise<WhatsAppMessagesConfig> {
  if (!inflight) {
    inflight = fetch("/api/settings/mensajes")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { cached = mergeWhatsAppConfig(d?.config); return cached; })
      .catch(() => DEFAULT_WHATSAPP_CONFIG)
      .finally(() => { inflight = null; });
  }
  return inflight;
}

export function setWhatsAppConfigCache(cfg: WhatsAppMessagesConfig) { cached = cfg; }

export function useWhatsAppConfig(): WhatsAppMessagesConfig {
  const [cfg, setCfg] = useState<WhatsAppMessagesConfig>(cached || DEFAULT_WHATSAPP_CONFIG);
  useEffect(() => {
    let alive = true;
    load().then((c) => { if (alive) setCfg(c); });
    return () => { alive = false; };
  }, []);
  return cfg;
}
