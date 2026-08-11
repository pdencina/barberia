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

  // Get business hours for this day of week
  const dayOfWeek = new Date(date + "T12:00:00").getDay();
  const { data: hoursData } = await supabase
    .from("business_hours")
    .select("open_time, close_time, is_closed")
    .eq("day_of_week", dayOfWeek)
    .single();

  // Default to 10-21 if not configured
  const openHour = hoursData?.open_time ? parseInt(hoursData.open_time.split(":")[0]) : 10;
  const openMin = hoursData?.open_time ? parseInt(hoursData.open_time.split(":")[1]) : 0;
  const closeHour = hoursData?.close_time ? parseInt(hoursData.close_time.split(":")[0]) : 21;
  const closeMin = hoursData?.close_time ? parseInt(hoursData.close_time.split(":")[1]) : 0;

  // If day is closed, return empty
  if (hoursData?.is_closed) {
    return NextResponse.json({ slots: [], date, barberId, closed: true });
  }

  // Get barber's custom slot duration
  const { data: barberProfile } = await supabase
    .from("profiles")
    .select("slot_duration")
    .eq("id", barberId)
    .single();

  const slotInterval = barberProfile?.slot_duration || 15; // Default 15min intervals

  // Get existing appointments for this barber on this date
  const { data: appointments } = await supabase
    .from("appointments")
    .select("start_time, end_time")
    .eq("barber_id", barberId)
    .eq("date", date)
    .in("status", ["scheduled", "confirmed", "in_progress"]);

  // Check if barber has blocked this day
  const { data: blocks } = await supabase
    .from("barber_blocks")
    .select("all_day, start_time, end_time")
    .eq("barber_id", barberId)
    .eq("date", date);

  // If any block is all_day, no slots available
  if (blocks?.some((b) => b.all_day)) {
    return NextResponse.json({ slots: [], date, barberId, blocked: true });
  }

  // Generate all possible slots
  const slots: string[] = [];

  const startMinutes = openHour * 60 + openMin;
  const endMinutes = closeHour * 60 + closeMin;

  for (let totalMin = startMinutes; totalMin < endMinutes; totalMin += slotInterval) {
    const hour = Math.floor(totalMin / 60);
    const min = totalMin % 60;
    const slotStart = new Date(`${date}T${hour.toString().padStart(2, "0")}:${min.toString().padStart(2, "0")}:00`);
    const slotEnd = new Date(slotStart.getTime() + duration * 60000);

    // Check slot doesn't exceed business hours
    const closeTime = new Date(`${date}T${closeHour.toString().padStart(2, "0")}:${closeMin.toString().padStart(2, "0")}:00`);
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

      // Check no conflict with partial blocks
      const isBlocked = (blocks || []).some((block) => {
        if (block.all_day) return true;
        if (!block.start_time || !block.end_time) return false;
        const blockStart = new Date(`${date}T${block.start_time}`);
        const blockEnd = new Date(`${date}T${block.end_time}`);
        return slotStart < blockEnd && slotEnd > blockStart;
      });

      if (!hasConflict && !isBlocked) {
        slots.push(slotStart.toISOString());
      }
  }

  return NextResponse.json({ slots, date, barberId });
}
