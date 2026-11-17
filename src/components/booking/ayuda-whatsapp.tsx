"use client";

// Boton fijo de ayuda en la pagina de reservas: si el negocio tiene telefono, el cliente puede escribirle por WhatsApp en cualquier paso
// («tengo un problema para reservar una cita»). Aparece desde el principio, no solo cuando algo falla.
export function enlaceWhatsappNegocio(phone: string | null | undefined, negocio: string | null | undefined): string | null {
  const d = String(phone || "").replace(/\D/g, "").replace(/^0+/, "");
  if (d.length < 8) return null;
  const numero = d.startsWith("56") ? d : `56${d}`;
  const texto = `Hola${negocio ? ` ${negocio}` : ""}, tengo un problema para reservar una cita. ¿Me pueden ayudar?`;
  return `https://wa.me/${numero}?text=${encodeURIComponent(texto)}`;
}

export function AyudaWhatsapp({ phone, negocio }: { phone: string | null | undefined; negocio: string | null | undefined }) {
  const href = enlaceWhatsappNegocio(phone, negocio);
  if (!href) return null;
  return (
    <a href={href} target="_blank" rel="noopener noreferrer"
      className="fixed bottom-4 right-4 z-40 flex items-center gap-2 rounded-full bg-[#25D366] px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-black/20 transition-transform hover:scale-105 active:scale-95"
      style={{ bottom: "calc(1rem + env(safe-area-inset-bottom, 0px))" }}
      aria-label="¿Problemas para reservar? Escríbenos por WhatsApp">
      <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current" aria-hidden="true"><path d="M20.5 3.5A11.8 11.8 0 0 0 12 0C5.4 0 .1 5.3.1 11.9c0 2.1.6 4.1 1.6 5.9L0 24l6.4-1.7a11.9 11.9 0 0 0 5.6 1.4h.1c6.6 0 11.9-5.3 11.9-11.9 0-3.2-1.2-6.2-3.5-8.3ZM12 21.7a9.9 9.9 0 0 1-5-1.4l-.4-.2-3.8 1 1-3.7-.2-.4a9.9 9.9 0 0 1-1.5-5.2c0-5.5 4.5-9.9 10-9.9a9.9 9.9 0 0 1 7 2.9 9.8 9.8 0 0 1 2.9 7c0 5.5-4.5 9.9-10 9.9Zm5.4-7.4c-.3-.1-1.8-.9-2-1-.3-.1-.5-.1-.7.1l-.9 1.1c-.2.2-.3.2-.6.1a8 8 0 0 1-4-3.5c-.3-.5.3-.5.9-1.6.1-.2 0-.4 0-.5l-.9-2.1c-.2-.5-.5-.5-.7-.5h-.6c-.2 0-.5.1-.8.4-.3.3-1 1-1 2.5s1.1 2.9 1.2 3.1c.1.2 2.1 3.3 5.2 4.6 1.9.8 2.7.9 3.6.7.6-.1 1.8-.7 2-1.4.3-.7.3-1.3.2-1.4-.1-.1-.3-.2-.6-.3Z" /></svg>
      <span className="hidden sm:inline">¿Problemas para reservar?</span>
      <span className="sm:hidden">Ayuda</span>
    </a>
  );
}
