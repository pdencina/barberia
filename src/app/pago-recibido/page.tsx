export const metadata = { title: "Pago", robots: { index: false, follow: false } };

export default function PagoRecibido({ searchParams }: { searchParams: { status?: string } }) {
  const ok = searchParams.status === "success";
  const pendiente = searchParams.status === "pending";
  return (
    <main style={{ minHeight: "100vh", background: "#FAF8F5", color: "#10201F", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, textAlign: "center", fontFamily: "system-ui, sans-serif" }}>
      <div style={{ maxWidth: 420 }}>
        <svg width="72" height="72" viewBox="0 0 24 24" fill="none" stroke={ok ? "#0A6E6B" : pendiente ? "#B7791F" : "#B42318"} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <circle cx="12" cy="12" r="10" />
          {ok ? <path d="M7.5 12.5l3 3 6-7" /> : pendiente ? <path d="M12 7v5l3 2" /> : <path d="M12 7v6M12 16.5v.5" />}
        </svg>
        <h1 style={{ fontSize: 28, margin: "12px 0 8px" }}>{ok ? "¡Pago recibido!" : pendiente ? "Pago en proceso" : "No se pudo completar el pago"}</h1>
        <p style={{ opacity: 0.75, fontSize: 16 }}>{ok ? "Gracias. Ya avisamos a tu profesional. Puedes volver al local." : pendiente ? "Tu pago se está procesando. Avisaremos cuando se confirme." : "Puedes intentarlo de nuevo en el tótem o pagar con tu profesional."}</p>
      </div>
    </main>
  );
}
