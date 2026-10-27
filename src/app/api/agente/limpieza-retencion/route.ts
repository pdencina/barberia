import { crearManejadorLimpieza, crearRepositorioRetencion } from "@/lib/agente/limpieza-retencion";
import { crearAutorizadorInformeProgramado } from "@/lib/agente/informe-programado";
import { createAdminSupabase } from "@/lib/supabase/server";
import * as meta from "@/lib/agente/whatsapp-meta";
export const dynamic="force-dynamic";
export const GET=crearManejadorLimpieza({
 autorizar:crearAutorizadorInformeProgramado(), // Reutiliza verifyCron, incluido dryRun.
 permitirBorrado:false,
 crearDependencias:()=>({repo:crearRepositorioRetencion(createAdminSupabase()),ahora:Date.now}),
 // C8 aporta el verificador puro sin apilar PRs ni exigir una exportación todavía ausente.
 configuracion:()=>{
  const checker=(meta as unknown as {verificarConfiguracionWhatsApp?:(e:Record<string,string|undefined>)=>string[]}).verificarConfiguracionWhatsApp;
  return checker?.(process.env);
 },
});
