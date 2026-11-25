import { responderServicioProfesional } from "../src/lib/agente/servicio-profesional";
let fallas = 0;
const ok = (n: string, c: boolean, extra = "") => { if (!c) { fallas++; console.log("FALLA", n, extra); } else console.log("OK", n); };
const datos: any = {
  negocio: { nombre: "Estudio Levels", direccion: null, telefono: null, linkReserva: null }, horario: [],
  servicios: [{ id: "s1", nombre: "Corte de cabello", precio: 17000, duracionMin: 45 }, { id: "s2", nombre: "Rizos/Ondulación permanentes", precio: 80000, duracionMin: 180 }, { id: "s3", nombre: "Visos", precio: 85000, duracionMin: 180 }],
  profesionales: [{ id: "p1", nombre: "Enzo Perez", link: "x" }, { id: "p2", nombre: "Pablo Yañez", link: "x" }, { id: "p3", nombre: "Gabriel Alcayaga", link: "x" }],
};
const mapa = { p1: ["s1"], p2: ["s1", "s2", "s3"], p3: null };
const r = (t: string) => responderServicioProfesional(t, datos, mapa);
let x = r("quien hace rizos?"); ok("quien hace rizos", !!x && x.includes("Pablo") && x.includes("Gabriel") && !x.includes("Enzo Perez*\n"), x ?? "");
x = r("enzo hace rizos?"); ok("enzo no hace", !!x && /Enzo Perez\* no hace/.test(x), x ?? "");
x = r("quiero reservar risos con enzo"); ok("reservar con enzo", !!x && /no hace/.test(x), x ?? "");
x = r("pablo hace rizos?"); ok("pablo si", !!x && x.startsWith("Sí"), x ?? "");
x = r("quiero reservar risos"); ok("reservar sin pro: lo resuelve la disponibilidad con el servicio", x === null, x ?? "");
ok("corte no aplica", r("quiero un corte de cabello con enzo") === null);
ok("hola no aplica", r("hola") === null);
ok("precio no aplica", r("cuanto cuestan los visos?") === null, String(r("cuanto cuestan los visos?")));
console.log(fallas ? `fallas=${fallas}` : "OK servicio-profesional");
process.exit(fallas ? 1 : 0);
