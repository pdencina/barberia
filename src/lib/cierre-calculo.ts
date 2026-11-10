// Cierre mensual: reparte lo realmente cobrado de cada venta entre sus servicios y productos para que los informes cuadren.
// Puro: se prueba sin base de datos.
//
// Antes, «Top servicios» sumaba el precio de lista de cada línea y no restaba los descuentos de la venta (que se guardan en la venta, no en
// las líneas); y en ventas anotadas a mano el precio del servicio podía incluir lo que también estaba como producto. Resultado: la suma por
// servicio no coincidía con el dinero cobrado. Aquí cada venta aporta exactamente su total: si las líneas suman más que lo cobrado, la
// diferencia se reparte en proporción al precio de lista de cada línea (descuentos y ajustes); si suman menos, lo que falta queda «sin detalle».

export interface LineaVenta { description: string; total: number; quantity: number; tipo: "servicio" | "producto" }
// abono: parte del precio que la clienta ya había pagado al reservar (otro momento, otro mes). `total` es solo lo cobrado en esta venta.
export interface VentaCierre { id: string; total: number; lineas: LineaVenta[]; abono?: number }

export interface FilaReparto { nombre: string; cantidad: number; lista: number; cobrado: number; descuentos: number }
export interface ResultadoReparto {
  servicios: FilaReparto[];       // de mayor a menor cobrado
  productos: FilaReparto[];
  serviciosLista: number;         // a precio de lista
  serviciosCobrado: number;
  productosLista: number;
  productosCobrado: number;
  descuentos: number;             // lista - cobrado (servicios y productos)
  sinDetalle: number;             // ventas sin líneas, o parte del total que las líneas no explican
  totalVentas: number;            // lo cobrado en las ventas del mes (sin los abonos pagados antes)
  abonosAplicados: number;        // parte de esas ventas que la clienta ya había pagado como abono (no es descuento ni egreso)
  ventasAjustadas: { id: string; total: number; lineas: number; diferencia: number }[]; // lista no coincide con lo cobrado
}

const r = (n: number) => Math.round(n * 100) / 100;

export function repartirVentas(ventas: VentaCierre[]): ResultadoReparto {
  const svc = new Map<string, FilaReparto>(), prod = new Map<string, FilaReparto>();
  const res: ResultadoReparto = { servicios: [], productos: [], serviciosLista: 0, serviciosCobrado: 0, productosLista: 0, productosCobrado: 0, descuentos: 0, sinDetalle: 0, totalVentas: 0, abonosAplicados: 0, ventasAjustadas: [] };
  for (const v of ventas) {
    const cobradoMes = Number(v.total) || 0;
    const abono = Math.max(0, Number(v.abono) || 0);
    // El servicio se reparte a su precio completo (lo cobrado hoy + lo abonado antes): así el abono no se ve como descuento.
    const total = cobradoMes + abono;
    res.totalVentas += cobradoMes; res.abonosAplicados += abono;
    const lineas = v.lineas.filter((l) => Number(l.total) > 0 || Number(l.quantity) > 0);
    const suma = lineas.reduce((s, l) => s + (Number(l.total) || 0), 0);
    if (lineas.length === 0 || suma <= 0) { res.sinDetalle += total; continue; }
    // Solo se escala hacia abajo: lo que las líneas no explican (suma < total) queda aparte, sin inflar ningún servicio.
    const factor = Math.min(1, total / suma);
    if (Math.abs(suma - total) > 1) res.ventasAjustadas.push({ id: v.id, total, lineas: suma, diferencia: r(suma - total) });
    if (suma < total) res.sinDetalle += total - suma;
    for (const l of lineas) {
      const lista = Number(l.total) || 0, cobrado = lista * factor;
      const mapa = l.tipo === "servicio" ? svc : prod;
      const clave = l.description || (l.tipo === "servicio" ? "Servicio" : "Producto");
      const f = mapa.get(clave) || { nombre: clave, cantidad: 0, lista: 0, cobrado: 0, descuentos: 0 };
      f.cantidad += Number(l.quantity) || 1; f.lista += lista; f.cobrado += cobrado; f.descuentos += lista - cobrado;
      mapa.set(clave, f);
      if (l.tipo === "servicio") { res.serviciosLista += lista; res.serviciosCobrado += cobrado; } else { res.productosLista += lista; res.productosCobrado += cobrado; }
    }
  }
  const orden = (a: FilaReparto, b: FilaReparto) => b.cobrado - a.cobrado;
  const redondear = (f: FilaReparto): FilaReparto => ({ ...f, lista: r(f.lista), cobrado: r(f.cobrado), descuentos: r(f.descuentos) });
  res.servicios = Array.from(svc.values()).map(redondear).sort(orden);
  res.productos = Array.from(prod.values()).map(redondear).sort(orden);
  res.serviciosLista = r(res.serviciosLista); res.serviciosCobrado = r(res.serviciosCobrado);
  res.productosLista = r(res.productosLista); res.productosCobrado = r(res.productosCobrado);
  res.descuentos = r(res.serviciosLista + res.productosLista - res.serviciosCobrado - res.productosCobrado);
  res.sinDetalle = r(res.sinDetalle); res.totalVentas = r(res.totalVentas); res.abonosAplicados = r(res.abonosAplicados);
  return res;
}

// «Resumen que cuadra»: lista − descuentos = cobrado; cobrado de servicios + productos + sin detalle = movimiento total.
export function cuadra(res: ResultadoReparto): { ok: boolean; diferencia: number } {
  const suma = res.serviciosCobrado + res.productosCobrado + res.sinDetalle;
  const diferencia = r(res.totalVentas + res.abonosAplicados - suma);
  return { ok: Math.abs(diferencia) <= 1, diferencia };
}

// ---- profesionales ----
export interface PerfilAtiende { id: string; role?: string | null; active?: boolean | null; also_attends_clients?: boolean | null }

// ¿Atiende clientes? Profesional, o administrador que también atiende (igual que el calendario).
export const atiendeClientes = (p: PerfilAtiende) =>
  p.active !== false && (p.role === "barber" || ((p.role === "admin" || p.role === "super_admin") && !!p.also_attends_clients));

// Negocio de un solo profesional: exactamente una persona atiende clientes. Devuelve su id, o null si hay equipo (o nadie).
export function profesionalUnico(perfiles: PerfilAtiende[]): string | null {
  const atienden = perfiles.filter(atiendeClientes);
  return atienden.length === 1 ? atienden[0].id : null;
}
