// Respondedor determinista puro; datos comerciales inyectados.
export interface DatosFaq {
 negocio:{nombre:string|null;direccion:string|null;telefono:string|null;linkReserva:string|null};
 horario:{dia:number;cerrado:boolean;abre:string|null;cierra:string|null}[];
 servicios:{id?:string;nombre:string;precio:number|null;duracionMin:number|null}[];
 sucursales?:{id:string;nombre:string|null;direccion:string|null;horario:DatosFaq["horario"]}[]|null;
 // Profesionales que se pueden reservar y su link personal (re-booking.cl/<negocio>/<profesional>); null = no disponible.
 // id y duracionMin (tiempo base del profesional) los usa la consulta de disponibilidad.
 profesionales?:{id?:string;nombre:string;link:string;duracionMin?:number|null}[]|null;
}
export type IntencionFaq="horario"|"direccion"|"telefono"|"precio_servicio"|"servicios"|"agendar";
export type ResultadoFaq={tipo:"respuesta";intencion:IntencionFaq;texto:string}|{tipo:"traspaso";motivo:"mensaje_no_admitido"|"sin_intencion"|"datos_incompletos"|"coincidencia_ambigua"};
const traspaso=(motivo:Extract<ResultadoFaq,{tipo:"traspaso"}>["motivo"]):ResultadoFaq=>({tipo:"traspaso",motivo});
// Solo retira marcas en vocales. La ñ sigue siendo otra letra, igual que en respuesta-cliente.
export const normalizar=(s:string)=>s.normalize("NFC").toLowerCase().normalize("NFD").replace(/([aeiou])[\u0300-\u036f]+/g,"$1").normalize("NFC").trim().replace(/\s+/g," ");
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
// "Agendar con X": prefijos de una lista cerrada seguidos de " con <nombre>"; el nombre debe coincidir con un solo profesional.
const PREFIJOS_CON_PROFESIONAL=["quiero agendar una hora","quiero reservar una hora","quiero agendar una cita","quiero reservar una cita","necesito reservar una hora","necesito agendar una hora","quiero agendar","quiero reservar","quiero pedir hora","quiero sacar hora","quiero una hora","quiero una cita","quisiera agendar","quisiera reservar","necesito agendar","necesito reservar","necesito una hora","necesito una cita","me gustaria agendar","me gustaria reservar","puedo agendar","puedo reservar","como agendo","como reservo","agendar una hora","reservar una hora","agendar una cita","reservar una cita","agendar","reservar","pedir hora","sacar hora","una hora","una cita","hora","cita"].sort((a,b)=>b.length-a.length);
const conProfesional=new RegExp(`^(?:${PREFIJOS_CON_PROFESIONAL.join("|")}) con (.+)$`);
const enlaceProfesional=/^(?:el )?(?:link|enlace) (?:de|del) (.+)$/;
// Mensajes sobre agendar que no son una frase exacta: se ofrece el link. Los de precio, cambios o cancelaciones los ve una persona.
const PALABRA_AGENDAR=/\b(agendar|agendarme|agendo|reservar|reservarme|reservo)\b/;
const NO_ES_AGENDAR=/\b(cuanto|cuesta|cuestan|precio|precios|valor|vale|valen|descuento|promocion|promo|gratis|cancela|cancelen|anula|cambia|horario|horarios|direccion|ubicacion|telefono|servicios|catalogo|donde|cancelar|cancelo|anular|anulo|cambiar|cambio|reprogramar|reagendar|mover|modificar|reclamo|reclamar|queja|quejar)\b/;
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
// Limpia una pregunta ya normalizada: saludo, "por favor" y signos de apertura/cierre.
const limpiar=(s:string)=>s.replace(/^hola(?:,|\s)+/,"").replace(/,? por favor[.!?]*$/,"").trim().replace(/^[¿¡]+/,"").replace(/[?!.]+$/,"").trim();
// Una sola pregunta ya normalizada y limpia.
function resolverUna(pedido:string,datos:DatosFaq|null):ResultadoFaq{
 let intencion:IntencionFaq|null=null,servicioPedido:string|null=null,sucursalPedida:string|null=null,profesionalPedido:string|null=null,agendarLibre=false;
 for(const key of Object.keys(frases) as Exclude<IntencionFaq,"precio_servicio">[])if(frases[key].has(pedido))intencion=key;
 if(!intencion){
  const sucursal=/^(.*?) (?:de|en)(?: la)?(?: sucursal)? (.+)$/.exec(pedido)??/^(.*?) (?:la )?sucursal (.+)$/.exec(pedido);
  if(sucursal){
   for(const key of ["direccion","horario"] as const)if(frases[key].has(sucursal[1])){intencion=key;sucursalPedida=sucursal[2];}
  }
 }
 if(!intencion){
  const quien=conProfesional.exec(pedido)??enlaceProfesional.exec(pedido);
  if(quien){
   const nombre=quien[1].replace(/^(?:el |la )?(?:barbero |profesional |estilista )?/,"").trim();
   intencion="agendar";
   // Sin nombre se ofrece el link general; un nombre demasiado largo no se intenta emparejar (se ofrecen las opciones).
   if(nombre)profesionalPedido=nombre;
  }
 }
 if(!intencion){
  const match=/^(?:cuanto (?:cuesta|cuestan|vale|valen|sale|salen)|(?:cual es el )?precio (?:de|del)|que precio tiene|quiero saber el precio (?:de|del)) (.+)$/.exec(pedido);
  if(match){
   servicioPedido=match[1].replace(/^(?:el|la|los|las|un|una) /,"");
   // Nunca convertir una pregunta mixta en un nombre de servicio aproximado.
   if(/\b(horario|horarios|direccion|ubicacion|telefono|agendar|reservar|catalogo)\b/.test(servicioPedido))return traspaso("coincidencia_ambigua");
   intencion="precio_servicio";
  }
 }
 if(!intencion&&PALABRA_AGENDAR.test(pedido)&&!NO_ES_AGENDAR.test(pedido)&&!/https?:|www\.|\w\.(?:com|cl|net|org|invalid)\b/.test(pedido)){intencion="agendar";agendarLibre=true;}
 if(!intencion)return traspaso("sin_intencion");
 try{
  if(!datos||!datos.negocio)return traspaso("datos_incompletos");
  let direccion=datos.negocio.direccion,horario=datos.horario;
  if(intencion==="direccion"||intencion==="horario"){
   if(datos.sucursales===null)return traspaso("datos_incompletos");
   if(datos.sucursales?.length){
    const visibles=datos.sucursales.filter(s=>s&&datoTexto(s.nombre));
    if(!visibles.length)return traspaso("datos_incompletos");
    // No ofrecer elegir entre sucursales si ninguna tiene el dato pedido: derivar a una persona.
    const conDato=visibles.filter(s=>intencion==="direccion"?datoTexto(s.direccion):horarioLegible(s.horario)!==null);
    if(!sucursalPedida&&!conDato.length)return traspaso("datos_incompletos");
    if(!sucursalPedida)return {tipo:"respuesta",intencion,texto:`¿De qué sucursal necesitas ${intencion==="direccion"?"la dirección":"el horario"}? Sucursales: ${conDato.map(s=>s.nombre!.trim()).join("; ")}. Indica la sucursal en tu consulta.`};
    const matches=visibles.filter(s=>normalizar(s.nombre!)===sucursalPedida);
    if(matches.length!==1)return traspaso("coincidencia_ambigua");
    direccion=matches[0].direccion;horario=matches[0].horario;
   }else if(sucursalPedida)return traspaso("datos_incompletos");
  }
  let respuesta:string;
  if(intencion==="direccion"){
   if(!datoTexto(direccion))return traspaso("datos_incompletos");
   respuesta=`Dirección: ${direccion!.trim()}.`;
  }else if(intencion==="telefono"){
   if(!datoTexto(datos.negocio.telefono))return traspaso("datos_incompletos");
   respuesta=`Teléfono: ${datos.negocio.telefono.trim()}.`;
  }else if(intencion==="horario"){
   const valor=horarioLegible(horario);if(!valor)return traspaso("datos_incompletos");
   respuesta=`Horario semanal: ${valor[0].toUpperCase()+valor.slice(1)}.`;
  }else if(intencion==="agendar"&&profesionalPedido!==null){
   const link=datos.negocio.linkReserva;
   const linkOk=datoTexto(link)&&(()=>{try{const u=new URL(link);return ["https:","http:"].includes(u.protocol)&&!u.username&&!u.password;}catch{return false;}})();
   const lista=(Array.isArray(datos.profesionales)?datos.profesionales:[]).filter(p=>p&&datoTexto(p.nombre)&&datoTexto(p.link));
   const palabras=profesionalPedido.length>40||profesionalPedido.split(" ").length>4?[]:profesionalPedido.split(" ");
   // Cada palabra pedida debe ser un nombre completo o el comienzo (3 letras o más) de una palabra del nombre del profesional.
   const coincide=(p:{nombre:string})=>{const t=normalizar(p.nombre).split(" ");return palabras.every(x=>t.some(y=>y===x||(x.length>=3&&y.startsWith(x))));};
   const candidatos=palabras.length?lista.filter(coincide):[];
   if(candidatos.length===1){
    const url=new URL(candidatos[0].link);if(!["https:","http:"].includes(url.protocol)||url.username||url.password)return traspaso("datos_incompletos");
    respuesta=`Puedes solicitar tu hora con ${candidatos[0].nombre.trim()} aquí: ${candidatos[0].link.trim()}`;
   }else if(candidatos.length>1&&candidatos.length<=5){
    respuesta=`Hay más de un profesional con ese nombre: ${candidatos.map(c=>c.nombre.trim()).join("; ")}. Escribe el nombre completo${linkOk?` o elígelo aquí: ${link!.trim()}`:""}.`;
   }else{
    // Ninguno coincide: se ofrecen los profesionales y el link general para elegir, en vez de derivar.
    if(!linkOk)return traspaso("datos_incompletos");
    const nombres=lista.map(p=>p.nombre.trim());
    respuesta=nombres.length>0&&nombres.length<=10
     ?`No encontré a un profesional con ese nombre. Profesionales disponibles: ${nombres.join("; ")}. Para elegir y agendar: ${link!.trim()}`
     :`No encontré a un profesional con ese nombre. Puedes elegirlo y agendar aquí: ${link!.trim()}`;
   }
  }else if(intencion==="agendar"){
   const link=datos.negocio.linkReserva;if(!datoTexto(link))return traspaso("datos_incompletos");
   const url=new URL(link);if(!["https:","http:"].includes(url.protocol)||url.username||url.password)return traspaso("datos_incompletos");
   respuesta=agendarLibre?`¿Deseas agendar? Elige al profesional y la hora aquí: ${link.trim()}`:`Puedes solicitar tu hora aquí: ${link.trim()}`;
  }else{
   if(!Array.isArray(datos.servicios)||!datos.servicios.length)return traspaso("datos_incompletos");
   if(intencion==="servicios"){
    const visibles=datos.servicios.filter(s=>s&&datoTexto(s.nombre));
    if(!visibles.length)return traspaso("datos_incompletos");
    respuesta=`Servicios: ${visibles.map(s=>s.nombre.trim()).join("; ")}.`;
   }
   else{
    // Un nombre inválido impide demostrar un precio único; el listado sí puede omitirlo.
    if(datos.servicios.some(s=>!s||!datoTexto(s.nombre)))return traspaso("datos_incompletos");
    const candidates=datos.servicios.filter(s=>(" "+normalizar(s.nombre)+" ").includes(" "+servicioPedido+" "));
    if(candidates.length>1){
     // Varias coincidencias: se listan con su precio base solo si todas tienen precio y son pocas; si no, una persona.
     if(candidates.length>5||candidates.some(c=>typeof c.precio!=="number"||!Number.isFinite(c.precio)||c.precio<0))return traspaso("coincidencia_ambigua");
     return {tipo:"respuesta",intencion,texto:`Precios base: ${candidates.map(c=>`${c.nombre.trim()}: $${precio.format(c.precio!)}`).join("; ")}. Los profesionales pueden tener precios distintos.`};
    }
    if(candidates.length!==1||typeof candidates[0].precio!=="number"||!Number.isFinite(candidates[0].precio)||candidates[0].precio<0)return traspaso("datos_incompletos");
    // Precio base autorizado por Nico; los profesionales pueden tener precios distintos.
    respuesta=`Precio base de ${candidates[0].nombre.trim()}: $${precio.format(candidates[0].precio!)}. Los profesionales pueden tener precios distintos.`;
   }
  }
  return {tipo:"respuesta",intencion,texto:respuesta};
 }catch{return traspaso("datos_incompletos");}
}

// Separadores entre preguntas: signos, "y", "e", "ademas", "tambien". Solo se usan si el mensaje completo no es una pregunta conocida.
const separadores=/\s*(?:[?¿!;,]+|\sy\s|\se\s|\sademas\s|\stambien\s)\s*/;
const MAX_PREGUNTAS=3;
// No usa reloj, red, entorno, modelo ni logs. Nunca concatena el texto/captura del cliente en la salida.
// Con 2 o 3 preguntas conocidas responde todas juntas; si alguna parte no se entiende o falta un dato, deriva a una persona.
export function responderFaq(texto:unknown,datos:DatosFaq|null):ResultadoFaq{
 if(typeof texto!=="string"||!texto.trim()||texto.length>160||formatosOcultos.test(texto))return traspaso("mensaje_no_admitido");
 const completo=normalizar(texto);
 if(instrucciones.test(completo)||excluido.test(completo)||/(^|[^a-zñ0-9_])(no|nunca|jamas|tampoco|ni)(?=$|[^a-zñ0-9_])/.test(completo))return traspaso("mensaje_no_admitido");
 const unica=resolverUna(limpiar(completo),datos);
 // Si la lectura de una sola pregunta respondió (o el mensaje no es admitido), se queda así; si derivó, se prueba separar varias preguntas.
 if(unica.tipo==="respuesta"||unica.motivo==="mensaje_no_admitido")return unica;
 const partes=limpiar(completo).split(separadores).map(limpiar).filter(Boolean);
 if(partes.length<2||partes.length>MAX_PREGUNTAS)return unica;
 const textos:string[]=[];let primera:IntencionFaq|null=null;
 for(const parte of partes){
  const r=resolverUna(parte,datos);
  if(r.tipo!=="respuesta")return unica; // si una parte falla, se conserva el resultado original de derivar
  // Una repregunta ("¿de qué sucursal?", "escribe el nombre completo") no se mezcla con otras respuestas: lo ve una persona.
  if(/^(?:¿De qué sucursal|Hay más de un profesional)/.test(r.texto))return traspaso("coincidencia_ambigua");
  primera=primera??r.intencion;
  if(!textos.includes(r.texto))textos.push(r.texto);
 }
 return {tipo:"respuesta",intencion:primera!,texto:textos.join("\n\n")};
}

// Para otros módulos deterministas (consulta de disponibilidad): mismas reglas de admisión que la FAQ.
// Devuelve el texto normalizado, o null si el mensaje no es admitido (largo, formato oculto, instrucción, tema excluido o negación).
export function mensajeAdmitido(texto:unknown):string|null{
 if(typeof texto!=="string"||!texto.trim()||texto.length>160||formatosOcultos.test(texto))return null;
 const completo=normalizar(texto);
 if(instrucciones.test(completo)||excluido.test(completo)||/(^|[^a-zñ0-9_])(no|nunca|jamas|tampoco|ni)(?=$|[^a-zñ0-9_])/.test(completo))return null;
 return completo;
}
export const datoSeguro=(valor:unknown):valor is string=>datoTexto(valor);
