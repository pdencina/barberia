"use client";

import { useState, useEffect } from "react";

export function ActivityIndicator() {
  const [stats, setStats] = useState({ activeNow: 0, todaySales: 0 });

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const today = new Date().toISOString().split("T")[0];
        const res = await fetch(`/api/appointments?date=${today}`);
        const data = await res.json();
        const active = Array.isArray(data) ? data.filter((a: any) => a.status === "in_progress").length : 0;
        const completed = Array.isArray(data) ? data.filter((a: any) => a.status === "completed").length : 0;
        setStats({ activeNow: active, todaySales: completed });
      } catch {}
    };

    fetchStats();
    const interval = setInterval(fetchStats, 60000); // every minute
    return () => clearInterval(interval);
  }, []);

  if (stats.activeNow === 0 && stats.todaySales === 0) return null;

  return (
    <div className="hidden md:flex items-center gap-3 px-3 py-1.5 bg-gray-800/50 rounded-lg text-xs">
      {stats.activeNow > 0 && (
        <span className="flex items-center gap-1.5 text-green-400">
          <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse-soft" />
          {stats.activeNow} en atencion
        </span>
      )}
      {stats.todaySales > 0 && (
        <span className="text-gray-400">
          {stats.todaySales} atenciones hoy
        </span>
      )}
    </div>
  );
}
