import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  const supabase = createAdminSupabase();
  const { searchParams } = new URL(req.url);
  const barberId = searchParams.get("barberId");
  const date = searchParams.get("date");
  const duration = parseInt(searchParams.get("duration") || "45");

  if (!barberId || !date) {
    return NextResponse.json({ error: "barberId and date required" }, { status: 400 });
  }

  // Business hours: 10:00 - 21:00
  const openHour = 10;
  const closeHour = 21;

  // Get existing appointments for this barber on this date
  const { data: appointments } = await supabase
    .from("appointments")
    .select("start_time, end_time")
    .eq("barber_id", barberId)
    .eq("date", date)
    .in("status", ["scheduled", "confirmed", "in_progress"]);

  // Generate all possible slots
  const slots: string[] = [];
  const slotInterval = 15; // every 15 minutes

  for (let hour = openHour; hour < closeHour; hour++) {
    for (let min = 0; min < 60; min += slotInterval) {
      const slotStart = new Date(`${date}T${hour.toString().padStart(2, "0")}:${min.toString().padStart(2, "0")}:00`);
      const slotEnd = new Date(slotStart.getTime() + duration * 60000);

      // Check slot doesn't exceed business hours
      const closeTime = new Date(`${date}T${closeHour.toString().padStart(2, "0")}:00:00`);
      if (slotEnd > closeTime) continue;

      // Check slot is not in the past
      const now = new Date();
      if (slotStart <= now) continue;

      // Check no conflict with existing appointments
      const hasConflict = (appointments || []).some((appt) => {
        const apptStart = new Date(appt.start_time);
        const apptEnd = new Date(appt.end_time);
        return slotStart < apptEnd && slotEnd > apptStart;
      });

      if (!hasConflict) {
        slots.push(slotStart.toISOString());
      }
    }
  }

  return NextResponse.json({ slots, date, barberId });
}
