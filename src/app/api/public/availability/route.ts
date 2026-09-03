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

  // Get day of week (0=Sunday, 1=Monday, etc.), computed independent of the server's
  // timezone. Using `new Date(date + "T12:00:00").getDay()` interpreted the date in the
  // SERVER's timezone (UTC on Vercel), so a Saturday chosen by a Chile user (UTC-3/-4)
  // could resolve to Friday/Sunday — the "día corrido" bug where the enabled day showed
  // as blocked and the neighbouring day opened by mistake. Parse the parts and use UTC.
  const [dyY, dyM, dyD] = date.split("-").map(Number);
  const dayOfWeek = new Date(Date.UTC(dyY, dyM - 1, dyD)).getUTCDay();

  // Try barber's personal schedule first
  const { data: barberSchedule } = await supabase
    .from("barber_schedule")
    .select("is_working, start_time, end_time, break_start, break_end")
    .eq("barber_id", barberId)
    .eq("day_of_week", dayOfWeek)
    .single();

  let openTime: string;
  let closeTime: string;
  let breakStart: string | null = null;
  let breakEnd: string | null = null;

  if (barberSchedule) {
    // Use per-barber schedule
    if (!barberSchedule.is_working) {
      return NextResponse.json({ slots: [], date, barberId, closed: true });
    }
    openTime = barberSchedule.start_time || "10:00";
    closeTime = barberSchedule.end_time || "20:00";
    breakStart = barberSchedule.break_start || null;
    breakEnd = barberSchedule.break_end || null;
  } else {
    // Fallback to tenant's business hours
    // Get barber's tenant
    const { data: barberTenant } = await supabase
      .from("profiles")
      .select("tenant_id")
      .eq("id", barberId)
      .single();

    let hoursQuery = supabase
      .from("business_hours")
      .select("open_time, close_time, is_closed")
      .eq("day_of_week", dayOfWeek);

    if (barberTenant?.tenant_id) {
      hoursQuery = hoursQuery.eq("tenant_id", barberTenant.tenant_id);
    }

    const { data: hoursData } = await hoursQuery.single();

    if (hoursData?.is_closed) {
      return NextResponse.json({ slots: [], date, barberId, closed: true });
    }
    openTime = hoursData?.open_time || "10:00";
    closeTime = hoursData?.close_time || "21:00";
  }

  // Parse times to minutes (pure arithmetic, no Date objects — avoids timezone issues)
  const openHour = parseInt(openTime.split(":")[0]);
  const openMin = parseInt(openTime.split(":")[1]);
  const closeHour = parseInt(closeTime.split(":")[0]);
  const closeMin = parseInt(closeTime.split(":")[1]);
  const breakStartMin = breakStart ? parseInt(breakStart.split(":")[0]) * 60 + parseInt(breakStart.split(":")[1]) : null;
  const breakEndMin = breakEnd ? parseInt(breakEnd.split(":")[0]) * 60 + parseInt(breakEnd.split(":")[1]) : null;

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

  // Get current time in Chile for "past slots" filter
  const nowChile = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Santiago" }));
  const todayStr = `${nowChile.getFullYear()}-${String(nowChile.getMonth() + 1).padStart(2, "0")}-${String(nowChile.getDate()).padStart(2, "0")}`;
  const nowMinutes = nowChile.getHours() * 60 + nowChile.getMinutes();
  const isToday = date === todayStr;

  for (let totalMin = startMinutes; totalMin < endMinutes; totalMin += slotInterval) {
    const hour = Math.floor(totalMin / 60);
    const min = totalMin % 60;

    // Check slot + duration doesn't exceed close time
    if (totalMin + duration > endMinutes) continue;

    // Check slot is not in the past (only matters for today)
    if (isToday && totalMin <= nowMinutes) continue;

    // Build ISO string with explicit timezone offset for Chile (-04:00 or -03:00)
    const slotISO = `${date}T${hour.toString().padStart(2, "0")}:${min.toString().padStart(2, "0")}:00`;

    // Check no conflict with existing appointments (compare as minutes, not Date objects)
    const slotStartMin = totalMin;
    const slotEndMin = totalMin + duration;

    const hasConflict = (appointments || []).some((appt) => {
      const apptStartMatch = appt.start_time.match(/(\d{2}):(\d{2})/);
      const apptEndMatch = appt.end_time.match(/(\d{2}):(\d{2})/);
      if (!apptStartMatch || !apptEndMatch) return false;
      const apptStartMin = parseInt(apptStartMatch[1]) * 60 + parseInt(apptStartMatch[2]);
      const apptEndMin = parseInt(apptEndMatch[1]) * 60 + parseInt(apptEndMatch[2]);
      return slotStartMin < apptEndMin && slotEndMin > apptStartMin;
    });

    // Check no conflict with partial blocks
    const isBlocked = (blocks || []).some((block) => {
      if (block.all_day) return true;
      if (!block.start_time || !block.end_time) return false;
      const blockStartMatch = block.start_time.match(/(\d{2}):(\d{2})/);
      const blockEndMatch = block.end_time.match(/(\d{2}):(\d{2})/);
      if (!blockStartMatch || !blockEndMatch) return false;
      const blockStartMin = parseInt(blockStartMatch[1]) * 60 + parseInt(blockStartMatch[2]);
      const blockEndMin = parseInt(blockEndMatch[1]) * 60 + parseInt(blockEndMatch[2]);
      return slotStartMin < blockEndMin && slotEndMin > blockStartMin;
    });

    // Check no conflict with barber's break time
    const isDuringBreak = (breakStartMin !== null && breakEndMin !== null)
      ? (slotStartMin < breakEndMin && slotEndMin > breakStartMin)
      : false;

    if (!hasConflict && !isBlocked && !isDuringBreak) {
      slots.push(slotISO);
    }
  }

  return NextResponse.json({ slots, date, barberId });
}
