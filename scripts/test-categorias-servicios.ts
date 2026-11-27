import { porCategoria } from "../src/lib/categorias-servicios";
const g = porCategoria([{ id: 1, category: null }, { id: 2, category: "Salón" }, { id: 3, category: "Químicos" }, { id: 4, category: "Salón " }]);
const bien = g.map((x) => `${x.nombre}:${x.items.length}`).join() === "Salón:2,Químicos:1,Sin categoría:1";
console.log(bien ? "OK categorías" : "FALLA " + JSON.stringify(g));
process.exit(bien ? 0 : 1);
