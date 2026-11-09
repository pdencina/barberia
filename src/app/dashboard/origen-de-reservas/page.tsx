"use client";

import { useEffect, useState } from "react";
import { Copy, CheckCircle2, Megaphone, Users, Percent } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { useTenant } from "@/lib/tenant-context";
import { useToast } from "@/components/ui/toast";
import { PageHeader, Panel, StatCard, Segmented, inputClass, primaryButton, ghostButton, tableStyles } from "@/components/ui/premium";
import { META_URL_PARAMETERS } from "@/lib/ad-tracking";

interface CampaignRow { campaign: string; content: string; medium: string; bookings: number; completed: number; cancelled: number; clients: number; newClients: number }
interface Report { days: number; totalLinkBookings: number; taggedBookings: number; untaggedBookings: number; paidBookings: number; newClientsTotal: number; campaigns: CampaignRow[] }

// "Publicidad": cuantos clientes reservan gracias a tus anuncios de Meta. Tres pasos para conectarlo y una tabla simple.
export default function PublicidadPage() {
  const { role } = useAuth();
  const { tenant } = useTenant();
  const { showToast } = useToast();
  const isAdmin = role === "admin" || role === "super_admin";

  const [days, setDays] = useState<"30" | "90">("30");
  const [report, setReport] = useState<Report | null>(null);
  const [reportError, setReportError] = useState("");
  const [pixel, setPixel] = useState("");
  const [savedPixel, setSavedPixel] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const bookingLink = typeof window !== "undefined" && tenant?.slug ? `${window.location.origin}/${tenant.slug}` : "";

  useEffect(() => {
    if (!isAdmin) return;
    fetch("/api/settings/meta-pixel", { cache: "no-store" }).then((r) => r.json()).then((d) => { setSavedPixel(d.pixelId || null); setPixel(d.pixelId || ""); }).catch(() => {});
  }, [isAdmin]);
  useEffect(() => {
    if (!isAdmin) return;
    setReportError("");
    fetch(`/api/origen-de-reservas/reporte?days=${days}`, { cache: "no-store" }).then(async (r) => {
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setReport(null); setReportError(d.error || "No se pudo cargar"); return; }
      setReport(d);
    }).catch(() => setReportError("No se pudo cargar"));
  }, [isAdmin, days]);

  const savePixel = async () => {
    setSaving(true);
    const r = await fetch("/api/settings/meta-pixel", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pixelId: pixel }) });
    const d = await r.json().catch(() => ({}));
    setSaving(false);
    if (!r.ok) { showToast(d.error || "No se pudo guardar", "error"); return; }
    setSavedPixel(d.pixelId || null);
    showToast(d.pixelId ? "Píxel conectado" : "Píxel desconectado", "success");
  };
  const copy = (text: string, msg: string) => { navigator.clipboard.writeText(text); showToast(msg, "success"); };

  if (!isAdmin) return <div className="p-6 text-sm text-brand-gray">Solo el administrador puede ver esta sección.</div>;

  const paid = report?.paidBookings ?? 0;
  const share = report && report.totalLinkBookings > 0 ? Math.round((paid / report.totalLinkBookings) * 100) : 0;
  const conectado = !!savedPixel;

  return (
    <div className="p-3 md:p-6 space-y-4 max-w-4xl animate-fade-in">
      <PageHeader title="Publicidad" subtitle="Cuántos clientes reservan gracias a tus anuncios de Meta" />

      <div className="flex justify-end">
        <Segmented size="sm" value={days} onChange={setDays} options={[{ value: "30", label: "30 días" }, { value: "90", label: "90 días" }]} />
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard label="Reservas por anuncios" value={report ? paid : "—"} hint={`Últimos ${days} días`} Icon={Megaphone} tone="teal" />
        <StatCard label="Clientes nuevos por anuncios" value={report ? report.newClientsTotal : "—"} hint="Primera vez que reservan" Icon={Users} tone="green" />
        <StatCard label="De tus reservas online" value={report ? `${share}%` : "—"} hint="Las que vienen de un anuncio" Icon={Percent} tone="violet" />
      </div>
      {reportError && <p className="text-sm text-red-600">{reportError}</p>}

      <Panel title="Conecta tus anuncios en 3 pasos" subtitle={conectado ? "Tu Píxel está conectado. Revisa que el paso 2 esté hecho en tus anuncios." : "Toma unos 5 minutos. Se hace una sola vez."}>
        <ol className="space-y-5 text-sm text-brand-dark">
          <li>
            <p className="font-semibold">1. Pega el número de tu Píxel de Meta {conectado && <CheckCircle2 className="ml-1 inline h-4 w-4 text-emerald-600" />}</p>
            <p className="mt-1 text-xs text-brand-gray">En Meta abre <span className="font-medium">Administrador de eventos</span>, entra a tu Píxel y copia el número (son 15 o 16 dígitos). Así Meta sabrá cuándo alguien reserva.</p>
            <div className="mt-2 flex flex-col gap-2 sm:flex-row">
              <input value={pixel} onChange={(e) => setPixel(e.target.value.replace(/\D/g, ""))} inputMode="numeric" placeholder="Ej: 955315870712237" className={inputClass} />
              <button type="button" onClick={savePixel} disabled={saving || pixel === (savedPixel || "")} className={`${primaryButton} sm:flex-shrink-0`}>Guardar</button>
            </div>
          </li>
          <li>
            <p className="font-semibold">2. En cada anuncio, pega este texto</p>
            <p className="mt-1 text-xs text-brand-gray">En Meta, dentro del anuncio busca <span className="font-medium">Parámetros de URL</span> y pega esto. Así sabemos de qué campaña viene cada reserva. El anuncio debe llevar a tu link de reservas:</p>
            <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center">
              <input readOnly value={bookingLink} className={`${inputClass} text-xs`} />
              <button type="button" onClick={() => copy(bookingLink, "Link copiado")} className={`${ghostButton} sm:flex-shrink-0`}><Copy className="h-4 w-4" /> Copiar link</button>
            </div>
            <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center">
              <input readOnly value={META_URL_PARAMETERS} className={`${inputClass} font-mono text-xs`} />
              <button type="button" onClick={() => copy(META_URL_PARAMETERS, "Texto copiado")} className={`${ghostButton} sm:flex-shrink-0`}><Copy className="h-4 w-4" /> Copiar texto</button>
            </div>
          </li>
          <li>
            <p className="font-semibold">3. Listo: aquí abajo verás los resultados</p>
            <p className="mt-1 text-xs text-brand-gray">Cada reserva que llegue desde un anuncio aparecerá en la tabla. También la verás en el Administrador de anuncios de Meta como «Programar» (Schedule). Las personas que rechacen las cookies no se cuentan en Meta, pero sí aquí.</p>
          </li>
        </ol>
      </Panel>

      <Panel title="Resultados por campaña" subtitle="Reservas hechas por tu link de reservas" flush>
        {report && report.campaigns.length === 0 ? (
          <p className="px-5 pb-5 text-sm text-brand-gray">Todavía no hay reservas que vengan de un anuncio. Cuando completes los pasos de arriba y llegue la primera, aparecerá aquí.</p>
        ) : report ? (
          <div className={tableStyles.wrap}>
            <table className={tableStyles.table}>
              <thead className={tableStyles.thead}>
                <tr><th className={tableStyles.th}>Campaña</th><th className={tableStyles.thRight}>Reservas</th><th className={tableStyles.thRight}>Clientes nuevos</th><th className={tableStyles.thRight}>Atendidas</th><th className={tableStyles.thRight}>Canceladas</th></tr>
              </thead>
              <tbody className={tableStyles.tbody}>
                {report.campaigns.map((c, i) => (
                  <tr key={i} className={tableStyles.tr}>
                    <td className={tableStyles.td}>{c.campaign}{c.content && <span className="ml-2 text-[11px] text-brand-gray">{c.content}</span>}</td>
                    <td className={tableStyles.tdRight}>{c.bookings}</td>
                    <td className={tableStyles.tdRight}>{c.newClients}</td>
                    <td className={tableStyles.tdRight}>{c.completed}</td>
                    <td className={tableStyles.tdRight}>{c.cancelled}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </Panel>
    </div>
  );
}
