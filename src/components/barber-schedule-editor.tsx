"use client";

import { useState, useEffect } from "react";

const dayNames = ["Domingo", "Lunes", "Martes", "Miercoles", "Jueves", "Viernes", "Sabado"];

interface ScheduleDay {
  day_of_week: number;
  is_working: boolean;
  start_time: string;
  end_time: string;
  break_start: string | null;
  break_end: string | null;
}

export function BarberScheduleEditor({ barberId, showToast }: { barberId: string; showToast: (msg: string, type?: "success" | "error" | "info") => void }) {
  const [schedule, setSchedule] = useState<ScheduleDay[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch(`/api/barber-schedule?barberId=${barberId}`)
      .then((r) => r.json())
      .then((data) => setSchedule(Array.isArray(data) ? data : []));
  }, [barberId]);

  const updateDay = (dayIndex: number, field: string, value: any) => {
    setSchedule((prev) => prev.map((d) =>
      d.day_of_week === dayIndex ? { ...d, [field]: value } : d
    ));
  };

  const updateDayMultiple = (dayIndex: number, updates: Record<string, any>) => {
    setSchedule((prev) => prev.map((d) =>
      d.day_of_week === dayIndex ? { ...d, ...updates } : d
    ));
  };

  const save = async () => {
    setSaving(true);
    await fetch("/api/barber-schedule", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ barberId, schedule }),
    });
    setSaving(false);
    showToast("Horario guardado", "success");
  };

  return (
    <div className="space-y-2">
      {schedule.map((day) => (
        <div key={day.day_of_week} className="flex items-center gap-3 py-1">
          <input type="checkbox" checked={day.is_working}
            onChange={(e) => updateDay(day.day_of_week, "is_working", e.target.checked)}
            className="w-4 h-4 rounded border-gray-300 text-brand-blue focus:ring-brand-blue" />
          <span className={`w-20 text-sm font-medium ${day.is_working ? "text-brand-dark" : "text-brand-gray line-through"}`}>
            {dayNames[day.day_of_week]}
          </span>
          {day.is_working ? (
            <div className="flex items-center gap-2 flex-1">
              <input type="time" value={day.start_time || "10:00"}
                onChange={(e) => updateDay(day.day_of_week, "start_time", e.target.value)}
                className="border border-gray-200 rounded-lg px-2 py-1 text-sm w-24" />
              <span className="text-brand-gray text-xs">a</span>
              <input type="time" value={day.end_time || "20:00"}
                onChange={(e) => updateDay(day.day_of_week, "end_time", e.target.value)}
                className="border border-gray-200 rounded-lg px-2 py-1 text-sm w-24" />
              {/* Break */}
              <button onClick={() => {
                if (day.break_start) {
                  updateDayMultiple(day.day_of_week, { break_start: null, break_end: null });
                } else {
                  updateDayMultiple(day.day_of_week, { break_start: "13:00", break_end: "14:00" });
                }
              }}
                className={`text-[10px] px-2 py-1 rounded-lg ${day.break_start ? "bg-orange-100 text-orange-600" : "bg-gray-100 text-gray-500 hover:bg-gray-200"}`}>
                {day.break_start ? "☕ Break" : "+ Break"}
              </button>
            </div>
          ) : (
            <span className="text-xs text-brand-gray italic">Dia libre</span>
          )}
        </div>
      ))}
      {/* Break times (if any day has break) */}
      {schedule.some((d) => d.break_start) && (
        <div className="mt-2 pt-2 border-t border-gray-100">
          <p className="text-xs text-brand-gray font-medium mb-2">Horarios de break/colacion:</p>
          {schedule.filter((d) => d.break_start && d.is_working).map((day) => (
            <div key={`break-${day.day_of_week}`} className="flex items-center gap-2 mb-1">
              <span className="text-xs text-brand-dark w-20">{dayNames[day.day_of_week]}</span>
              <input type="time" value={day.break_start || "13:00"}
                onChange={(e) => updateDay(day.day_of_week, "break_start", e.target.value)}
                className="border border-gray-200 rounded-lg px-2 py-1 text-xs w-22" />
              <span className="text-xs text-brand-gray">a</span>
              <input type="time" value={day.break_end || "14:00"}
                onChange={(e) => updateDay(day.day_of_week, "break_end", e.target.value)}
                className="border border-gray-200 rounded-lg px-2 py-1 text-xs w-22" />
            </div>
          ))}
        </div>
      )}
      <button onClick={save} disabled={saving}
        className="mt-3 px-4 py-2 bg-brand-blue text-white text-sm rounded-xl hover:opacity-90 disabled:opacity-50">
        {saving ? "Guardando..." : "Guardar Horario"}
      </button>
    </div>
  );
}
