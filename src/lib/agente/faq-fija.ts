// Respondedor determinista puro; datos comerciales inyectados.
export interface DatosFaq {
 negocio:{nombre:string|null;direccion:string|null;telefono:string|null;linkReserva:string|null};
 horario:{dia:number;cerrado:boolean;abre:string|null;cierra:string|null}[];
 servicios:{nombre:string;precio:number|null;duracionMin:number|null}[];
}
export type IntencionFaq="horario"|"direccion"|"telefono"|"precio_servicio"|"servicios"|"agendar";
export type ResultadoFaq={tipo:"respuesta";intencion:IntencionFaq;texto:string}|{tipo:"traspaso";motivo:"mensaje_no_admitido"|"sin_intencion"|"datos_incompletos"|"coincidencia_ambigua"};
const traspaso=(motivo:Extract<ResultadoFaq,{tipo:"traspaso"}>["motivo"]):ResultadoFaq=>({tipo:"traspaso",motivo});
// Solo retira marcas en vocales. La ñ sigue siendo otra letra, igual que en respuesta-cliente.
const normalizar=(s:string)=>s.normalize("NFC").toLowerCase().normalize("NFD").replace(/([aeiou])[\u0300-\u036f]+/g,"$1").normalize("NFC").trim().replace(/\s+/g," ");
const instrucciones=/\b(ignora|ignorar|olvida|olvidar|omite|omitir|instrucciones|prompt|sistema|instruccion|actua|responde|responder|revela|secretos|tokens|ejecuta|obedece|traduce|finge)\b/;
const excluido=/\b(abono|abonos|abonar|deposito|depositos|devolucion|devoluciones|devolver|reembolso|reembolsos|reclamo|reclamos|queja|quejas|salud|alergia|alergias|dolor|medico|medica|medicina|tratamiento|embarazo|herida|hongos|infeccion|dinero|pago|pagos|pagar|tarjeta|tarjetas|efectivo|transferencia|cuotas|descuento|descuentos|credito|cobro|saldo|propina)\b/;
const formatosOcultos=/[\u0000-\u001f\u007f\u200b-\u200f\u202a-\u202e\u2060-\u206f\ufeff]/;
const frases:Record<Exclude<IntencionFaq,"precio_servicio">,ReadonlySet<string>>={
 horario:new Set(["horario","horarios","horario de atencion","cual es el horario","cuales son los horarios","que horario tienen","que horarios tienen","cual es su horario","cual es el horario de atencion","a que hora abren","a que hora abre","a que hora abres","a que hora cierran","a que hora cierra","cuando abren","cuando abre","cuando atienden","cuando atiende","quiero saber el horario","me dices el horario","me puedes decir el horario"]),
 direccion:new Set(["direccion","ubicacion","cual es la direccion","cual es su direccion","donde estan","donde esta el negocio","donde queda el negocio","donde queda","donde quedan","donde se ubican","donde se ubica","como llego","como llegar","me pasas la direccion","me das la direccion"]),
 telefono:new Set(["telefono","numero de telefono","telefono del negocio","cual es el telefono","cual es su telefono","cual es el numero de telefono","cual es su numero","me das el telefono","me pasas el telefono","necesito el telefono","como los llamo","como puedo llamarlos"]),
 servicios:new Set(["servicios","lista de servicios","que servicios tienen","que servicios ofrecen","cuales son los servicios","cuales son sus servicios","que hacen","muestrame los servicios","quiero ver los servicios","quiero saber que servicios tienen","tienen catalogo de servicios"]),
 agendar:new Set(["quiero agendar","quiero reservar","como agendo","como reservo","como puedo agendar","como puedo reservar","quiero pedir hora","necesito reservar una hora","me gustaria agendar","quiero una cita","quiero reservar una cita","donde reservo","link de reserva","enlace de reserva","me das el link de reserva","puedo agendar"]),
};
const diasVisibles=["domingo","lunes","martes","miércoles","jueves","viernes","sábado"] as const;
function datoTexto(value:unknown):value is string{
 return typeof value==="string"&&!!value.trim()&&!formatosOcultos.test(value)&&!instrucciones.test(normalizar(value))&&!/[<>]/.test(value);
}
function horarioLegible(rows:DatosFaq["horario"]):string|null{
 if(!Array.isArray(rows)||rows.length!==7)return null;
 const mapa=new Map<number,string>();
 for(const r of rows){
  if(!r||!Number.isInteger(r.dia)||r.dia<0||r.dia>6||mapa.has(r.dia)||typeof r.cerrado!=="boolean")return null;
  if(r.cerrado){mapa.set(r.dia,"cerrado");continue;}
  if(typeof r.abre!=="string"||typeof r.cierra!=="string"||!/^([01]\d|2[0-3]):[0-5]\d$/.test(r.abre)||!/^([01]\d|2[0-3]):[0-5]\d$/.test(r.cierra)||r.abre===r.cierra)return null;
  mapa.set(r.dia,`de ${r.abre} a ${r.cierra}`);
 }
 const grupos:{inicio:number;fin:number;horas:string}[]=[];
 for(const dia of [1,2,3,4,5,6,0]){
  const horas=mapa.get(dia)!,last=grupos[grupos.length-1];
  if(last&&last.horas===horas)last.fin=dia;else grupos.push({inicio:dia,fin:dia,horas});
 }
 return grupos.map(g=>`${diasVisibles[g.inicio]}${g.inicio===g.fin?"":` a ${diasVisibles[g.fin]}`} ${g.horas}`).join("; ");
}
const precio=new Intl.NumberFormat("es-CL",{maximumFractionDigits:20});
// No usa reloj, red, entorno, modelo ni logs. Nunca concatena el texto/captura del cliente en la salida.
export function responderFaq(texto:unknown,datos:DatosFaq|null):ResultadoFaq{
 if(typeof texto!=="string"||!texto.trim()||texto.length>160||formatosOcultos.test(texto))return traspaso("mensaje_no_admitido");
 let pedido=normalizar(texto);
 if(instrucciones.test(pedido)||excluido.test(pedido)||/(^|[^a-zñ0-9_])(no|nunca|jamas|tampoco|ni)(?=$|[^a-zñ0-9_])/.test(pedido))return traspaso("mensaje_no_admitido");
 pedido=pedido.replace(/^hola(?:,|\s)+/,"").replace(/,? por favor[.!?]*$/,"").trim().replace(/^[¿¡]+/,"").replace(/[?!.]+$/,"").trim();
 let intencion:IntencionFaq|null=null,servicioPedido:string|null=null;
 for(const key of Object.keys(frases) as Exclude<IntencionFaq,"precio_servicio">[])if(frases[key].has(pedido))intencion=key;
 if(!intencion){
  const match=/^(?:cuanto (?:cuesta|cuestan|vale|valen|sale|salen)|(?:cual es el )?precio (?:de|del)|que precio tiene|quiero saber el precio (?:de|del)) (.+)$/.exec(pedido);
  if(match){
   servicioPedido=match[1].replace(/^(?:el|la|los|las|un|una) /,"");
   // Nunca convertir una pregunta mixta en un nombre de servicio aproximado.
   if(/\b(horario|horarios|direccion|ubicacion|telefono|agendar|reservar|catalogo)\b/.test(servicioPedido))return traspaso("coincidencia_ambigua");
   intencion="precio_servicio";
  }
 }
 if(!intencion)return traspaso("sin_intencion");
 try{
  if(!datos||!datos.negocio)return traspaso("datos_incompletos");
  let respuesta:string;
  if(intencion==="direccion"){
   if(!datoTexto(datos.negocio.direccion))return traspaso("datos_incompletos");
   respuesta=`Dirección: ${datos.negocio.direccion.trim()}.`;
  }else if(intencion==="telefono"){
   if(!datoTexto(datos.negocio.telefono))return traspaso("datos_incompletos");
   respuesta=`Teléfono: ${datos.negocio.telefono.trim()}.`;
  }else if(intencion==="horario"){
   const valor=horarioLegible(datos.horario);if(!valor)return traspaso("datos_incompletos");
   respuesta=`Horario semanal: ${valor[0].toUpperCase()+valor.slice(1)}.`;
  }else if(intencion==="agendar"){
   const link=datos.negocio.linkReserva;if(!datoTexto(link))return traspaso("datos_incompletos");
   const url=new URL(link);if(!["https:","http:"].includes(url.protocol)||url.username||url.password)return traspaso("datos_incompletos");
   respuesta=`Puedes solicitar tu hora aquí: ${link.trim()}`;
  }else{
   if(!Array.isArray(datos.servicios)||!datos.servicios.length||datos.servicios.some(s=>!s||!datoTexto(s.nombre)))return traspaso("datos_incompletos");
   if(intencion==="servicios")respuesta=`Servicios: ${datos.servicios.map(s=>s.nombre.trim()).join("; ")}.`;
   else{
    const candidates=datos.servicios.filter(s=>(" "+normalizar(s.nombre)+" ").includes(" "+servicioPedido+" "));
    if(candidates.length>1)return traspaso("coincidencia_ambigua");
    if(candidates.length!==1||typeof candidates[0].precio!=="number"||!Number.isFinite(candidates[0].precio)||candidates[0].precio<0)return traspaso("datos_incompletos");
    // Precio base autorizado por Nico; los profesionales pueden tener precios distintos.
    respuesta=`Precio base de ${candidates[0].nombre.trim()}: $${precio.format(candidates[0].precio!)}. Los profesionales pueden tener precios distintos.`;
   }
  }
  return {tipo:"respuesta",intencion,texto:respuesta};
 }catch{return traspaso("datos_incompletos");}
}
