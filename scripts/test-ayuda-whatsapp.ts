// Enlace de ayuda por WhatsApp de la pagina de reservas. Uso: npx tsx scripts/test-ayuda-whatsapp.ts
import { enlaceWhatsappNegocio } from "../src/components/booking/ayuda-whatsapp";
let fallos = 0;
const ok = (c: boolean, n: string) => { if (!c) { fallos++; console.log("FALLA:", n); } else console.log("OK  ", n); };
const l = (p: any, n = "Looky Estudio") => enlaceWhatsappNegocio(p, n) || "";
ok(l("+56 9 8765 4321").startsWith("https://wa.me/56987654321?text="), "teléfono con +56 y espacios");
ok(l("987654321").startsWith("https://wa.me/56987654321?"), "celular sin código de país: se agrega el 56");
ok(l("0987654321").startsWith("https://wa.me/56987654321?"), "con un 0 adelante: se corrige");
ok(decodeURIComponent(l("987654321")).includes("tengo un problema para reservar una cita") && decodeURIComponent(l("987654321")).includes("Looky Estudio"), "el mensaje dice el problema y nombra al negocio");
ok(enlaceWhatsappNegocio(null, "X") === null && enlaceWhatsappNegocio("12", "X") === null, "sin teléfono válido no hay botón");
process.exit(fallos ? 1 : 0);
