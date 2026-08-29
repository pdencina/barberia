import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase/server";

// GET: Public barber rankings
export async function GET() {
  const supabase = createAdminSupabase();

  // Get all active barbers
  const { data: barbers } = await supabase
    .from("profiles")
    .select("id, name, avatar_url")
    .eq("role", "barber")
    .eq("active", true)
    .order("name");

  // Get all reviews
  const { data: reviews } = await supabase
    .from("reviews")
    .select("barber_id, rating, comment, created_at, client:clients(name)")
    .eq("public", true)
    .order("created_at", { ascending: false });

  // Get appointment counts per barber
  const { data: appointments } = await supabase
    .from("appointments")
    .select("barber_id")
    .eq("status", "completed");

  // Get top services per barber
  const { data: serviceData } = await supabase
    .from("appointments")
    .select("barber_id, services:appointment_services(service:services(name))")
    .eq("status", "completed");

  // Build stats per barber
  const barberStats = (barbers || []).map((barber) => {
    const barberReviews = (reviews || []).filter((r) => r.barber_id === barber.id);
    const totalReviews = barberReviews.length;
    const avgRating = totalReviews > 0
      ? barberReviews.reduce((sum, r) => sum + r.rating, 0) / totalReviews
      : 0;

    const totalAppointments = (appointments || []).filter((a) => a.barber_id === barber.id).length;

    // Top services
    const serviceCounts: Record<string, number> = {};
    (serviceData || [])
      .filter((a: any) => a.barber_id === barber.id)
      .forEach((a: any) => {
        (a.services || []).forEach((s: any) => {
          const name = s.service?.name;
          if (name) serviceCounts[name] = (serviceCounts[name] || 0) + 1;
        });
      });

    const topServices = Object.entries(serviceCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([name]) => name);

    // Recent reviews (last 5)
    const recentReviews = barberReviews.slice(0, 5).map((r: any) => ({
      rating: r.rating,
      comment: r.comment,
      clientName: r.client?.name || "Cliente",
      date: r.created_at,
    }));

    return {
      id: barber.id,
      name: barber.name,
      avatarUrl: barber.avatar_url,
      avgRating: Math.round(avgRating * 10) / 10,
      totalReviews,
      totalAppointments,
      topServices,
      recentReviews,
    };
  });

  // Sort by rating (highest first)
  barberStats.sort((a, b) => b.avgRating - a.avgRating || b.totalAppointments - a.totalAppointments);

  return NextResponse.json(barberStats);
}

// POST: Submit a review.
// The link in the receipt email is /review/{id}, where {id} can be EITHER an
// appointment id (booking flow) OR a transaction id (most POS walk-in sales have no
// appointment at all). We try appointments first, then fall back to transactions,
// so both kinds of links work instead of failing with "Cita no encontrada".
export async function POST(req: NextRequest) {
  const supabase = createAdminSupabase();
  const body = await req.json();
  const { appointmentId, rating, comment } = body;
  const id = appointmentId; // param name kept for compatibility with the existing page

  if (!id || !rating || rating < 1 || rating > 5) {
    return NextResponse.json({ error: "Datos invalidos" }, { status: 400 });
  }

  let clientId: string | null = null;
  let barberId: string | null = null;
  let matchedAppointmentId: string | null = null;
  let matchedTransactionId: string | null = null;

  // Try as an appointment first
  const { data: appointment } = await supabase
    .from("appointments")
    .select("id, client_id, barber_id, status")
    .eq("id", id)
    .maybeSingle();

  if (appointment) {
    if (appointment.status !== "completed") {
      return NextResponse.json({ error: "Solo puedes calificar citas completadas" }, { status: 400 });
    }
    clientId = appointment.client_id;
    barberId = appointment.barber_id;
    matchedAppointmentId = appointment.id;
  } else {
    // Fall back to a transaction (POS sale without an appointment)
    const { data: transaction } = await supabase
      .from("transactions")
      .select("id, client_id, barber_id, status")
      .eq("id", id)
      .maybeSingle();

    if (!transaction) {
      return NextResponse.json({ error: "No encontramos tu cita o compra para calificar" }, { status: 404 });
    }
    if (transaction.status !== "completed") {
      return NextResponse.json({ error: "Solo puedes calificar compras completadas" }, { status: 400 });
    }
    if (!transaction.client_id) {
      return NextResponse.json({ error: "Esta compra no tiene un cliente asociado" }, { status: 400 });
    }
    clientId = transaction.client_id;
    barberId = transaction.barber_id;
    matchedTransactionId = transaction.id;
  }

  if (!barberId) {
    return NextResponse.json({ error: "No hay un profesional asociado para calificar" }, { status: 400 });
  }

  // Check if already reviewed
  const { data: existing } = await supabase
    .from("reviews")
    .select("id")
    .eq(matchedAppointmentId ? "appointment_id" : "transaction_id", id)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ error: "Esto ya fue calificado" }, { status: 409 });
  }

  // Create review
  const { data, error } = await supabase
    .from("reviews")
    .insert({
      appointment_id: matchedAppointmentId,
      transaction_id: matchedTransactionId,
      client_id: clientId,
      barber_id: barberId,
      rating,
      comment: comment || null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
