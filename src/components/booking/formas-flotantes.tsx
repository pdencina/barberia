"use client";

// Formas decorativas suaves (círculo, cuadrado, triángulo, asterisco, cruz, arco punteado) que flotan despacio y giran en un loop continuo detrás de la
// página de reservas, con el color principal del negocio. Solo decoración: no reciben clics y se apagan si la persona prefiere menos movimiento.
type Forma = { tipo: "circulo" | "cuadrado" | "triangulo" | "asterisco" | "cruz" | "arco" | "cuadradoRelleno"; x: number; y: number; t: number; o: number; dur: number; delay: number; dx: number; dy: number; giro: number };

const FORMAS: Forma[] = [
  { tipo: "circulo", x: 6, y: 9, t: 64, o: 0.28, dur: 34, delay: -6, dx: 26, dy: 34, giro: 40 },
  { tipo: "cuadrado", x: 78, y: 14, t: 34, o: 0.3, dur: 28, delay: -14, dx: -22, dy: 30, giro: -70 },
  { tipo: "triangulo", x: 44, y: 5, t: 46, o: 0.2, dur: 38, delay: -20, dx: 30, dy: 22, giro: 90 },
  { tipo: "asterisco", x: 90, y: 38, t: 52, o: 0.32, dur: 30, delay: -9, dx: -26, dy: -24, giro: 120 },
  { tipo: "cruz", x: 8, y: 46, t: 28, o: 0.4, dur: 26, delay: -3, dx: 22, dy: -30, giro: 90 },
  { tipo: "cuadradoRelleno", x: 70, y: 58, t: 26, o: 0.2, dur: 32, delay: -17, dx: -30, dy: 26, giro: -50 },
  { tipo: "asterisco", x: 12, y: 74, t: 64, o: 0.26, dur: 36, delay: -12, dx: 28, dy: -22, giro: -100 },
  { tipo: "arco", x: 52, y: 84, t: 150, o: 0.32, dur: 40, delay: -24, dx: 34, dy: -14, giro: 14 },
  { tipo: "circulo", x: 88, y: 80, t: 40, o: 0.24, dur: 29, delay: -5, dx: -24, dy: -32, giro: 60 },
  { tipo: "cruz", x: 34, y: 38, t: 22, o: 0.28, dur: 27, delay: -11, dx: 20, dy: 28, giro: 180 },
];

function Dibujo({ tipo }: { tipo: Forma["tipo"] }) {
  const p = { fill: "none", stroke: "currentColor", strokeWidth: 2.4, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  switch (tipo) {
    case "circulo": return <svg viewBox="0 0 80 80" width="100%" height="100%"><circle cx="40" cy="40" r="35" {...p} /></svg>;
    case "cuadrado": return <svg viewBox="0 0 80 80" width="100%" height="100%"><rect x="6" y="6" width="68" height="68" rx="12" {...p} /></svg>;
    case "triangulo": return <svg viewBox="0 0 80 80" width="100%" height="100%"><path d="M40 8 L74 68 L6 68 Z" fill="currentColor" stroke="currentColor" strokeWidth="6" strokeLinejoin="round" /></svg>;
    case "asterisco": return <svg viewBox="0 0 80 80" width="100%" height="100%"><g {...p}><path d="M40 6 V74" /><path d="M6 40 H74" /><path d="M16 16 L64 64" /><path d="M64 16 L16 64" /></g></svg>;
    case "cruz": return <svg viewBox="0 0 80 80" width="100%" height="100%"><g {...p}><path d="M40 12 V68" /><path d="M12 40 H68" /></g></svg>;
    case "arco": return <svg viewBox="0 0 160 50" width="100%" height="100%"><path d="M6 8 Q80 52 154 8" {...p} strokeDasharray="7 9" /></svg>;
    default: return <svg viewBox="0 0 80 80" width="100%" height="100%"><rect x="8" y="8" width="64" height="64" rx="18" fill="currentColor" /></svg>;
  }
}

export function FormasFlotantes() {
  const css = FORMAS.map((f, i) => `@keyframes rb-flota-${i}{0%{transform:translate3d(0,0,0) rotate(0deg)}50%{transform:translate3d(${f.dx}px,${f.dy}px,0) rotate(${f.giro}deg)}100%{transform:translate3d(0,0,0) rotate(0deg)}}`).join("");
  return (
    <div aria-hidden="true" className="rb-formas pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <style>{css + `.rb-forma{animation-timing-function:ease-in-out;animation-iteration-count:infinite;will-change:transform}@media (prefers-reduced-motion:reduce){.rb-forma{animation:none!important}}@media (max-width:640px){.rb-forma.rb-solo-grande{display:none}}`}</style>
      {FORMAS.map((f, i) => (
        <div key={i} className={`rb-forma absolute ${i % 3 === 2 ? "rb-solo-grande" : ""}`}
          style={{ left: `${f.x}%`, top: `${f.y}%`, width: f.t, height: f.tipo === "arco" ? f.t / 3.2 : f.t, opacity: f.o, color: "hsl(var(--brand-blue))", animationName: `rb-flota-${i}`, animationDuration: `${f.dur}s`, animationDelay: `${f.delay}s` }}>
          <Dibujo tipo={f.tipo} />
        </div>
      ))}
    </div>
  );
}
