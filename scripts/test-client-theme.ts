import assert from "node:assert";
import { resolverTemaCliente } from "../src/lib/client-theme";
assert.equal(resolverTemaCliente(null), null);
assert.equal(resolverTemaCliente({ theme: "dark", client_theme_enabled: false, client_theme: "rose" }), null, "apagado: colores de siempre");
assert.equal(resolverTemaCliente({ theme: "dark", client_theme_enabled: true, client_theme: null }), "dark", "igual que el sistema");
assert.equal(resolverTemaCliente({ theme: "dark", client_theme_enabled: true, client_theme: "rose" }), "rose", "diseño propio manda");
assert.equal(resolverTemaCliente({ theme: "dark", client_theme_enabled: true, client_theme: "inventado" }), "dark", "valor inválido cae al del sistema");
assert.equal(resolverTemaCliente({ theme: "xx", client_theme_enabled: true }), null);
console.log("ok client-theme");
