import { correoValido, enviarTanda, type CorreoListo } from "../src/lib/envio-lote";
let f = 0;
const ok = (c: boolean, t: string) => { if (!c) { f++; console.log("FALLA", t); } };
const c = (id: string, to: string): CorreoListo => ({ id, payload: { from: "a@b.cl", to, subject: "s", html: "h" } });
const lista = [c("1", "ana@x.cl"), c("2", "malo@"), c("3", "beto@x.com")];

(async () => {
  ok(correoValido("a@b.cl") && !correoValido("a b@x.cl") && !correoValido("a@x"), "validación");
  let tandas = 0;
  const bien = await enviarTanda({ batch: { send: async (p) => { tandas = p.length; return {}; } }, emails: { send: async () => ({}) } }, lista, 1);
  ok(tandas === 2 && bien.enviados.size === 2 && !bien.enviados.has("2"), "tanda sin los inválidos");
  const uno = await enviarTanda({ batch: { send: async () => ({ error: { message: "validation" } }) }, emails: { send: async (p) => (p.to === "ana@x.cl" ? {} : { error: { message: "no" } }) } }, lista, 1);
  ok(uno.enviados.size === 1 && uno.enviados.has("1"), "uno por uno, solo confirmados");
  let individuales = 0;
  const sinCupo = await enviarTanda({ batch: { send: async () => ({ error: { name: "daily_quota_exceeded" } }) }, emails: { send: async () => { individuales++; return {}; } } }, lista, 1);
  ok(sinCupo.enviados.size === 0 && individuales === 0, "sin cupo no insiste");
  console.log(f ? "HAY FALLAS" : "OK envío por tandas");
  process.exit(f ? 1 : 0);
})();
