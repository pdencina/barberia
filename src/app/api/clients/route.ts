import { cleanClientName } from "@/lib/client-name";
import { BUILTIN_SOURCES, loadCustomSources } from "@/lib/client-sources";
import { NextRequest, NextResponse } from "next/server";
import { fetchAllRows } from "@/lib/accounting";
import { esGrupo, resumirGrupos } from "@/lib/clientes-grupos";
import { cupoClientes, mensajeLimiteClientes } from "@/lib/client-limit";
import { calcularStats, esOrdenCliente, esOrdenPorStats, ordenarClientes, type StatsCliente } from "@/lib/clientes-stats";
import { createAdminSupabase, getCurrentTenantId, getCurrentUserRoleAndTenant, resolveTenantForRequest } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  const supabase = createAdminSupabase();
  const { searchParams } = new URL(req.url);
  const search = searchParams.get("search");
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "50");
  const offset = (page - 1) * limit;

  // Never trust the tenantId coming from the browser — see resolveTenantForRequest.
  const { tenantId } = await resolveTenantForRequest(searchParams.get("tenantId"));

  // If no tenant can be determined, return empty (security: never show all data)
  // EXCEPT: super_admin ("ALL") can see everything
  if (!tenantId) {
    return NextResponse.json({ clients: [], total: 0, page: 1, totalPages: 0 });
  }

  // Clientes que ya usan re-booking: tienen al menos una cita que no fue cancelada. Requiere la migración 143 (imported_at); sin ella no hay grupos.
  const conActividad = async (): Promise<Set<string>> => {
    const filas = await fetchAllRows<any>(() => supabase.from("appointments").select("id, client_id").eq("tenant_id", tenantId).not("client_id", "is", null).neq("status", "cancelled"));
    return new Set(filas.map((r: any) => r.client_id));
  };
  const todosLosClientes = () => fetchAllRows<any>(() => supabase.from("clients").select("*").eq("tenant_id", tenantId));

  if (tenantId !== "ALL" && searchParams.get("resumen") === "1") {
    try {
      const { data: prueba, error: errCol } = await supabase.from("clients").select("imported_at").eq("tenant_id", tenantId).limit(1);
      if (errCol || !prueba) return NextResponse.json({ grupos: null });
      const [cl, act] = await Promise.all([
        fetchAllRows<any>(() => supabase.from("clients").select("id, imported_at, created_at").eq("tenant_id", tenantId)), conActividad(),
      ]);
      return NextResponse.json({ grupos: resumirGrupos(cl, act) });
    } catch { return NextResponse.json({ grupos: null }); }
  }

  // Resumen por cliente (veces que vino, ticket, asistencia, total gastado). Con ids solo de esos clientes; sin ids, de todo el negocio.
  const cargarStats = async (ids: string[] | null): Promise<Map<string, StatsCliente>> => {
    const trozos = ids ? Array.from({ length: Math.ceil(ids.length / 100) }, (_, i) => ids.slice(i * 100, i * 100 + 100)) : [null];
    const citas: any[] = [], ventas: any[] = [];
    for (const t of trozos) {
      const pedirCitas = (cols: string) => fetchAllRows<any>(() => { let q = supabase.from("appointments").select(`id, client_id, status${cols}`).eq("tenant_id", tenantId).not("client_id", "is", null); if (t) q = q.in("client_id", t); return q; });
      citas.push(...await pedirCitas(", cancel_reason").catch(() => pedirCitas("")));
      ventas.push(...await fetchAllRows<any>(() => { let q = supabase.from("transactions").select("id, client_id, total").eq("tenant_id", tenantId).eq("type", "income").eq("status", "completed").not("client_id", "is", null); if (t) q = q.in("client_id", t); return q; }));
    }
    return calcularStats(citas, ventas);
  };
  const conStats = (lista: any[], m: Map<string, StatsCliente> | null) => (m ? lista.map((c) => ({ ...c, stats: m.get(c.id) || { visitas: 0, ventas: 0, gastado: 0, ticket: null, asistencia: null } })) : lista);

  const grupo = searchParams.get("grupo");
  const ordenPedido = searchParams.get("orden");
  const orden = esOrdenCliente(ordenPedido) ? ordenPedido : "nombre";
  const asc = searchParams.get("dir") !== "desc";
  // Por grupo o por un criterio de resumen se arma todo en memoria (hay que conocer a todos para ordenarlos).
  if (tenantId !== "ALL" && (esGrupo(grupo) || esOrdenPorStats(orden))) {
    try {
      const act = esGrupo(grupo) && grupo !== "nuevo" ? await conActividad() : new Set<string>();
      const q = (search || "").toLowerCase();
      let lista = (await todosLosClientes())
        .filter((c: any) => !esGrupo(grupo) || (grupo === "nuevo" ? !c.imported_at : !!c.imported_at && (grupo === "activo") === act.has(c.id)))
        .filter((c: any) => !q || [c.name, c.email, c.phone].some((v) => String(v || "").toLowerCase().includes(q)));
      let stats: Map<string, StatsCliente> | null = null;
      if (esOrdenPorStats(orden)) stats = await cargarStats(null);
      lista = ordenarClientes(lista, stats || new Map(), orden, asc);
      const pagina = lista.slice(offset, offset + limit);
      if (!stats) stats = await cargarStats(pagina.map((c: any) => c.id)).catch(() => null);
      return NextResponse.json({ clients: conStats(pagina, stats), total: lista.length, page, limit, totalPages: Math.ceil(lista.length / limit) });
    } catch {
      return NextResponse.json({ clients: [], total: 0, page, totalPages: 0 });
    }
  }

  // Build query
  let query = supabase.from("clients").select("*", { count: "exact" }).order("name", { ascending: asc });

  // Only filter by tenant if not super_admin
  if (tenantId !== "ALL") {
    query = query.eq("tenant_id", tenantId);
  }

  if (search) {
    query = query.or(`name.ilike.%${search}%,email.ilike.%${search}%,phone.ilike.%${search}%`);
  }

  // Apply pagination
  query = query.range(offset, offset + limit - 1);

  const { data, error, count } = await query;
  if (error) return NextResponse.json({ clients: [], total: 0, page, totalPages: 0 });

  const total = count || 0;
  const totalPages = Math.ceil(total / limit);
  let statsPagina: Map<string, StatsCliente> | null = null;
  if (tenantId !== "ALL" && (data || []).length > 0) statsPagina = await cargarStats((data || []).map((c: any) => c.id)).catch(() => null);

  return NextResponse.json({
    clients: conStats(data || [], statsPagina),
    total,
    page,
    limit,
    totalPages,
  });
}

export async function POST(req: NextRequest) {
  // SEGURIDAD: antes no pedia sesion y tomaba el negocio del cuerpo: cualquiera creaba clientes en cualquier negocio.
  const session = await getCurrentUserRoleAndTenant();
  if (!session.userId) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const supabase = createAdminSupabase();
  const body = await req.json();
  const { name: rawName, email, phone, notes, source, sourceDetail } = body;
  const name = cleanClientName(rawName) || String(rawName || "").trim();
  // El negocio sale de la sesion; resolveTenantForRequest valida (y corrige) lo que mande el navegador.
  const { tenantId: tenantFromSession } = await resolveTenantForRequest(body.tenantId || null);
  const tenantId = tenantFromSession && tenantFromSession !== "ALL" ? tenantFromSession : null;

  // Nico (29-sep): celular y correo son obligatorios — sin ellos no hay registro ni datos
  // del cliente. Se valida tambien aqui (no solo en los formularios).
  if (!name || !String(name).trim()) {
    return NextResponse.json({ error: "El nombre es obligatorio" }, { status: 400 });
  }
  if (!phone || String(phone).replace(/\D/g, "").length < 8) {
    return NextResponse.json({ error: "El celular es obligatorio" }, { status: 400 });
  }
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email).trim())) {
    return NextResponse.json({ error: "El correo es obligatorio y debe ser valido" }, { status: 400 });
  }

  // Always resolve tenant_id: prefer param, fallback to session
  let resolvedTenantId = tenantId;
  if (!resolvedTenantId) {
    resolvedTenantId = await getCurrentTenantId();
  }

  // Punto 10 (Pablo): alta manual desde el boton "Nuevo" en Clientes. El formulario
  // mandaba un campo "source" que nunca se guardaba (quedaba solo en el estado del
  // formulario) — quedaba huerfano y Metricas nunca veia estos clientes.
  //
  // Segunda vuelta (26-sep): Pablo pidio canales especificos en vez de un generico
  // "Normal"/"Promocion" — la recepcion siempre pregunta de donde viene el cliente.
  // "walk_in" (Paso por fuera) es el default cuando no se elige nada. "promotion" e
  // "influencer" aceptan un detalle opcional (codigo de descuento / @handle).
  // Ademas de los de siempre vale cualquier origen que el negocio haya creado ("+ Crear otra opcion").
  const VALID_SOURCES = [...BUILTIN_SOURCES.map((x) => x.code), ...(await loadCustomSources(supabase, resolvedTenantId)).map((x) => x.code)];
  // Si no se eligio ninguno queda SIN REGISTRAR (null): no se inventa "Paso por fuera" para clientes que ya venian de antes,
  // porque eso inflaria esa metrica.
  const acquisitionSource = VALID_SOURCES.includes(source) ? source : null;
  const acquisitionDetail = (source === "promotion" || source === "influencer") ? (sourceDetail || null) : null;

  // Límite de clientes del plan (el super admin no se limita).
  if (resolvedTenantId && session.role !== "super_admin") {
    const cupo = await cupoClientes(supabase, resolvedTenantId);
    if (cupo.libres === 0) return NextResponse.json({ error: mensajeLimiteClientes(cupo.max), code: "plan_limit" }, { status: 403 });
  }

  const { data, error } = await supabase
    .from("clients")
    .insert({
      name, email: email || null, phone: phone || null, notes,
      tenant_id: resolvedTenantId || null,
      acquisition_source: acquisitionSource,
      acquisition_detail: acquisitionDetail,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
