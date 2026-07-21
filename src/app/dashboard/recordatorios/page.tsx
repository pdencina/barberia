"use client";

import { useState, useEffect } from "react";
import { useToast } from "@/components/ui/toast";
import { Spinner } from "@/components/ui/spinner";

interface WhatsAppLink {
  appointmentId: string;
  clientName: string;
  phone: string;
  time: string;
  service: string;
  barber: string;
  whatsappUrl: string;
}

export default function RecordatoriosPage() {
  const [links, setLinks] = useState<WhatsAppLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const { showToast } = useToast();

  const fetchLinks = async () => {
    setLoading(true);
    const res = await fetch("/api/cron/reminders/whatsapp");
    setLinks(await res.json());
    setLoading(false);
  };

  useEffect(() => { fetchLinks(); }, []);

  const triggerEmailReminders = async () => {
    setSending(true);
    const res = await fetch("/api/cron/reminders");
    const data = await res.json();
    setSending(false);
    showToast(`${data.emailsSent || 0} emails enviados`, "success");
  };

  const openWhatsApp = (url: string) => {
    window.open(url, "_blank");
  };

  const openAllWhatsApp = () => {
    links.forEach((link, i) => {
      setTimeout(() => window.open(link.whatsappUrl, "_blank"), i * 1500);
    });
    showToast(`Abriendo ${links.length} conversaciones`, "info");
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Recordatorios</h1>
          <p className="text-gray-500 text-sm">Citas de manana - notifica a tus clientes</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={triggerEmailReminders}
            disabled={sending}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 text-sm"
          >
            {sending ? "Enviando..." : "Enviar Emails"}
          </button>
          {links.length > 0 && (
            <button
              onClick={openAllWhatsApp}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm flex items-center gap-2"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
              </svg>
              Enviar todos por WhatsApp
            </button>
          )}
        </div>
      </div>

      {/* Info card */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-sm text-blue-700">
          <strong>Automatico:</strong> Los emails de recordatorio se envian automaticamente 24h antes de cada cita (via Vercel Cron).
          Desde aqui puedes enviar WhatsApp manualmente o re-disparar emails.
        </p>
      </div>

      {/* Tomorrow's appointments */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-4 border-b">
          <h2 className="font-bold text-gray-800">Citas de Manana ({links.length})</h2>
        </div>
        {loading ? (
          <Spinner />
        ) : links.length === 0 ? (
          <div className="p-8 text-center text-gray-400">
            <p className="text-lg">No hay citas agendadas para manana</p>
          </div>
        ) : (
          <div className="divide-y">
            {links.map((link) => (
              <div key={link.appointmentId} className="p-4 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-3">
                    <span className="text-lg font-bold text-indigo-600">{link.time}</span>
                    <span className="font-medium text-gray-900">{link.clientName}</span>
                  </div>
                  <p className="text-sm text-gray-500 mt-1">
                    {link.service} · Barbero: {link.barber} · Tel: {link.phone}
                  </p>
                </div>
                <button
                  onClick={() => openWhatsApp(link.whatsappUrl)}
                  className="px-3 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 flex items-center gap-1"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                  </svg>
                  WhatsApp
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
