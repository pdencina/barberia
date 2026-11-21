import { ImageResponse } from "next/og";
import { readFileSync } from "fs";
import { join } from "path";

// Imagen de la tarjeta que se ve al compartir el link del landing (WhatsApp, Instagram, correo, etc.): 1200x630.
// Se genera una vez al compilar y se sirve en /og.png. Colores y textos del landing (public/landing-nuevo/index.html).
export const dynamic = "force-static";

const TEAL_DARK = "#0A6E6B";
const TEAL = "#0B9490";
const INK = "#10201F";
const MUTED = "#46564F";
const CREAM = "#F0EBE3";

// Fuente del landing (Bricolage Grotesque, licencia abierta OFL), guardada en el repo para no depender de internet al compilar.
function font(file: string): ArrayBuffer {
  const buf = readFileSync(join(process.cwd(), "src", "app", "og.png", "fonts", file));
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
}

function dataUrl(file: string): string {
  const b64 = readFileSync(join(process.cwd(), "public", file)).toString("base64");
  return `data:image/png;base64,${b64}`;
}

export function GET() {
  const logo = dataUrl("logo-horizontal.png"); // 1080x269
  const items = ["Agenda online", "Punto de venta", "Caja", "Clientes", "Reportes"];
  const FAMILY = "Bricolage Grotesque";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: CREAM,
          fontFamily: FAMILY,
          padding: "64px 80px",
          position: "relative",
        }}
      >
        {/* Franja de color arriba, igual que los correos del sistema */}
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 14, background: TEAL_DARK, display: "flex" }} />
        {/* Circulos suaves de fondo */}
        <div style={{ position: "absolute", right: -140, top: -120, width: 520, height: 520, borderRadius: 999, background: "#E6F2F1", display: "flex" }} />
        <div style={{ position: "absolute", right: 120, bottom: -200, width: 380, height: 380, borderRadius: 999, background: "#DCEEEC", display: "flex" }} />

        <div style={{ display: "flex", position: "relative" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={logo} width={300} height={75} alt="re-booking" />
        </div>

        <div style={{ display: "flex", flexDirection: "column", position: "relative" }}>
          <div style={{ display: "flex", fontSize: 28, fontWeight: 600, color: TEAL, letterSpacing: 2, textTransform: "uppercase" }}>
            Software de gestión y reservas
          </div>
          <div style={{ display: "flex", flexDirection: "column", marginTop: 18, fontSize: 88, fontWeight: 800, lineHeight: 1.04, color: INK, letterSpacing: -2 }}>
            <span style={{ display: "flex" }}>Todo tu negocio.</span>
            <span style={{ display: "flex", color: TEAL_DARK }}>Un solo sistema.</span>
          </div>
          <div style={{ display: "flex", marginTop: 26, fontSize: 30, color: MUTED }}>
            Para barberías, peluquerías y centros de belleza.
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", position: "relative" }}>
          <div style={{ display: "flex", gap: 10 }}>
            {items.map((t) => (
              <div
                key={t}
                style={{ display: "flex", padding: "8px 18px", borderRadius: 999, background: "#FFFFFF", border: "2px solid #DFD8CE", fontSize: 22, fontWeight: 600, color: INK, whiteSpace: "nowrap" }}
              >
                {t}
              </div>
            ))}
          </div>
          <div style={{ display: "flex", flexShrink: 0, marginLeft: 20, fontSize: 30, fontWeight: 800, color: TEAL_DARK, whiteSpace: "nowrap" }}>re-booking.cl</div>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
      fonts: [
        { name: FAMILY, data: font("BricolageGrotesque-600.ttf"), weight: 600, style: "normal" },
        { name: FAMILY, data: font("BricolageGrotesque-800.ttf"), weight: 800, style: "normal" },
      ],
    }
  );
}
