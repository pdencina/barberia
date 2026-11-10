export const metadata = { title: "Pago", robots: { index: false, follow: false } };

export default function PagoRecibido({ searchParams }: { searchParams: { status?: string } }) {
  const ok = searchParams.status === "success";
  const pendiente = searchParams.status === "pending";
  return (
    <main style={{ minHeight: "100vh", background: "#0f1115", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, textAlign: "center", fontFamily: "system-ui, sans-serif" }}>
      <div style={{ maxWidth: 420 }}>
        <p style={{ fontSize: 64, margin: 0 }}>{ok ? "✅" : pendiente ? "⏳" : "⚠️"}</p>
        <h1 style={{ fontSize: 28, margin: "12px 0 8px" }}>{ok ? "¡Pago recibido!" : pendiente ? "Pago en proceso" : "No se pudo completar el pago"}</h1>
        <p style={{ opacity: 0.75, fontSize: 16 }}>{ok ? "Gracias. Ya avisamos a tu profesional. Puedes volver al local." : pendiente ? "Tu pago se está procesando. Avisaremos cuando se confirme." : "Puedes intentarlo de nuevo en el tótem o pagar con tu profesional."}</p>
      </div>
    </main>
  );
}
