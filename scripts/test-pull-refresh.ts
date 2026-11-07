import assert from "node:assert/strict";
import { canPullRefresh, PullRefreshGesture, PULL_REFRESH } from "../src/lib/pull-refresh";
let count = 0;
function t(name: string, fn: () => void) { fn(); count++; console.log("OK " + name); }
t("pantallas de consulta comparten gesto", () => { for (const section of ["", "/mi-agenda", "/calendario", "/clientes", "/inventario", "/reportes", "/caja", "/arriendo", "/comisiones", "/finanzas", "/mi-billetera"]) assert.ok(canPullRefresh("/dashboard" + section)); });
t("cobros, configuración, formularios de ficha y rutas desconocidas quedan fuera", () => { for (const path of ["/dashboard/pos", "/dashboard/standby", "/dashboard/terminal-pos", "/dashboard/configuracion", "/dashboard/clientes/id", "/dashboard/onboarding", "/login", "/dashboardx", "/dashboard/nueva-ruta"]) assert.equal(canPullRefresh(path), false); });
t("barra final no cambia habilitación", () => assert.ok(canPullRefresh("/dashboard/clientes/")));
t("gesto largo vertical arma actualización", () => { const g = new PullRefreshGesture(); g.begin(10,10,true); assert.ok(g.move(12,160,true) >= PULL_REFRESH.threshold); assert.equal(g.release(),true); });
t("no dispara dos veces al soltar", () => { const g = new PullRefreshGesture(); g.begin(0,0,true); g.move(0,200,true); assert.equal(g.release(),true); assert.equal(g.release(),false); });
t("deslizamiento corto no recarga", () => { const g = new PullRefreshGesture(); g.begin(0,0,true); g.move(0,50,true); assert.equal(g.release(),false); });
t("zona muerta evita toques accidentales", () => { const g = new PullRefreshGesture(); g.begin(0,0,true); assert.equal(g.move(0,5,true),0); assert.equal(g.active,false); });
t("gesto horizontal se cancela", () => { const g = new PullRefreshGesture(); g.begin(0,0,true); assert.equal(g.move(80,20,true),0); g.move(80,200,true); assert.equal(g.release(),false); });
t("scroll hacia arriba no recarga", () => { const g = new PullRefreshGesture(); g.begin(0,100,true); g.move(0,0,true); assert.equal(g.release(),false); });
t("no empieza si pantalla no está arriba", () => { const g = new PullRefreshGesture(); g.begin(0,0,false); g.move(0,200,true); assert.equal(g.release(),false); });
t("dejar parte superior cancela", () => { const g = new PullRefreshGesture(); g.begin(0,0,true); g.move(0,200,false); assert.equal(g.release(),false); });
t("dos dedos no activan recarga", () => { const g = new PullRefreshGesture(); g.begin(0,0,true,2); g.move(0,200,true,2); assert.equal(g.release(),false); });
t("segundo dedo durante gesto cancela", () => { const g = new PullRefreshGesture(); g.begin(0,0,true); g.move(0,200,true,2); assert.equal(g.release(),false); });
t("retraer gesto bajo umbral cancela", () => { const g = new PullRefreshGesture(); g.begin(0,0,true); g.move(0,200,true); g.move(0,40,true); assert.equal(g.release(),false); });
t("indicador tiene altura máxima", () => { const g = new PullRefreshGesture(); g.begin(0,0,true); assert.equal(g.move(0,5000,true),PULL_REFRESH.maximum); });
t("cancelación limpia estado", () => { const g = new PullRefreshGesture(); g.begin(0,0,true); g.move(0,200,true); g.cancel(); assert.equal(g.release(),false); assert.equal(g.distance,0); });

// Componente real con fronteras DOM, React y navegación simuladas: sin navegador ni red.
const Module = require("node:module"); const originalLoad = Module._load;
const React = require("react"); (globalThis as any).React = React;
class FakeElement {
  scrollTop = 0; scrollHeight = 900; clientHeight = 500; parentElement: FakeElement | null = null;
  style = { overscrollBehaviorY: "auto" }; interactive = false; form = false;
  listeners = new Map<string, Function>();
  closest(selector: string): FakeElement | null {
    if (selector === "main") return main;
    if (selector === "form") return this.form ? this : null;
    return this.interactive ? this : null;
  }
  addEventListener(type: string, fn: Function) { this.listeners.set(type, fn); }
  removeEventListener(type: string) { this.listeners.delete(type); }
}
let main: FakeElement; let origin: FakeElement; let modal = false; let pathname = "/dashboard/clientes";
let effects: Array<() => any> = [], states: any[] = []; let queued: Function | null = null;
let reloads = 0, cleared = 0, online = true;
Object.defineProperty(globalThis, "navigator", { configurable: true, value: { get onLine() { return online; } } });
(globalThis as any).HTMLElement = FakeElement; (globalThis as any).Element = FakeElement;
(globalThis as any).document = { querySelector: () => modal ? {} : null };
(globalThis as any).window = { location: { reload: () => reloads++ } };
const realTimeout = globalThis.setTimeout, realClear = globalThis.clearTimeout;
(globalThis as any).setTimeout = (fn: Function) => { queued = fn; return 1; };
(globalThis as any).clearTimeout = () => { queued = null; };
Module._load = function(id: string, ...args: any[]) {
  if (id === "react") return { ...React, useRef: () => ({current: {closest: () => main}}), useEffect: (fn: () => any) => effects.push(fn), useState: (initial: any) => [initial, (value: any) => states.push(value)] };
  if (id === "next/navigation") return { usePathname: () => pathname };
  if (id === "@/lib/swr-cache") return { clearAppCache: () => cleared++ };
  return originalLoad.call(this, id, ...args);
};
const { PullToRefresh } = require("../src/components/layout/pull-to-refresh");
Module._load = originalLoad;
function setup(path = "/dashboard/clientes") {
  pathname = path; effects = []; states = []; queued = null; reloads = 0; cleared = 0; modal = false; online = true;
  main = new FakeElement(); origin = new FakeElement(); origin.parentElement = main; origin.scrollTop = 0;
  PullToRefresh(); const cleanup = effects[0]();
  return typeof cleanup === "function" ? cleanup : () => {};
}
function event(type: string, x = 0, y = 0, target = origin) {
  let prevented = false;
  main.listeners.get(type)?.({target, touches: [{clientX:x,clientY:y}], cancelable:true, defaultPrevented:false, preventDefault() { prevented = true; }});
  return prevented;
}
function pull() { event("touchstart"); event("touchmove",0,200); event("touchend"); }
t("recarga real solo una vez después de soltar y limpia cache", () => { const done = setup(); event("touchstart"); assert.equal(event("touchmove",0,200),true); assert.equal(reloads,0); event("touchend"); event("touchend"); assert.ok(queued); (queued as Function)(); assert.equal(cleared,1); assert.equal(reloads,1); done(); });
t("scroll en lista anidada no activa", () => { const done=setup(); origin.scrollTop=50; pull(); assert.equal(queued,null); done(); });
t("pantalla a mitad del scroll no activa", () => { const done=setup(); main.scrollTop=100; pull(); assert.equal(queued,null); done(); });
t("modal abierto no recarga", () => { const done=setup(); modal=true; pull(); assert.equal(queued,null); done(); });
t("formulario modificado bloquea gesto", () => { const done=setup(); origin.form=true; event("input"); origin.form=false; pull(); assert.equal(queued,null); done(); });
t("controles y rejilla del calendario no capturan gesto", () => { const done=setup(); origin.interactive=true; pull(); assert.equal(queued,null); done(); });
t("sin conexión informa sin borrar cache ni recargar", () => { const done=setup(); online=false; pull(); assert.equal(queued,null); assert.equal(cleared,0); assert.ok(states.some(s=>typeof s==='string' && s.includes('Sin conexión'))); done(); });
t("touchcancel no recarga", () => { const done=setup(); event("touchstart"); event("touchmove",0,200); event("touchcancel"); event("touchend"); assert.equal(queued,null); done(); });
t("POS queda sin handlers ni cambios de scroll", () => { setup("/dashboard/pos"); assert.equal(main.listeners.size,0); assert.equal(main.style.overscrollBehaviorY,"auto"); });
t("desmontar restaura scroll y elimina listeners y navegación pendiente", () => { const done=setup(); pull(); done(); assert.equal(main.listeners.size,0); assert.equal(main.style.overscrollBehaviorY,"auto"); assert.equal(queued,null); });
(globalThis as any).setTimeout = realTimeout; (globalThis as any).clearTimeout = realClear;
console.log(`${count} pruebas correctas`);
