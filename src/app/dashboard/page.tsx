import { createServerSupabase } from "@/lib/supabase/server";
import { formatCurrency } from "@/lib/utils";
import {
  DollarSign,
  Users,
  Calendar,
  TrendingUp,
  Package,
  Scissors,
} from "lucide-react";

export default async function DashboardPage() {
  const supabase = createServerSupabase();

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

  // Today income
  const { data: todayTx } = await supabase
    .from("transactions")
    .select("total")
    .eq("type", "income")
    .eq("status", "completed")
    .gte("created_at", today.toISOString())
    .lt("created_at", tomorrow.toISOString());

  const todayIncome = todayTx?.reduce((sum, t) => sum + Number(t.total), 0) || 0;

  // Month income
  const { data: monthTx } = await supabase
    .from("transactions")
    .select("total")
    .eq("type", "income")
    .eq("status", "completed")
    .gte("created_at", firstOfMonth.toISOString());

  const monthIncome = monthTx?.reduce((sum, t) => sum + Number(t.total), 0) || 0;

  // Today appointments
  const todayStr = today.toISOString().split("T")[0];
  const { count: todayAppointments } = await supabase
    .from("appointments")
    .select("id", { count: "exact", head: true })
    .eq("date", todayStr)
    .in("status", ["scheduled", "confirmed", "in_progress"]);

  // Total clients
  const { count: totalClients } = await supabase
    .from("clients")
    .select("id", { count: "exact", head: true });

  // Low stock
  const { data: lowStock } = await supabase
    .from("products")
    .select("id")
    .eq("active", true)
    .lte("stock", 5);

  // Active barbers
  const { count: activeBarbers } = await supabase
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("role", "barber")
    .eq("active", true);

  const cards = [
    { title: "Ingresos Hoy", value: formatCurrency(todayIncome), icon: DollarSign, desc: "Ventas del dia" },
    { title: "Ingresos del Mes", value: formatCurrency(monthIncome), icon: TrendingUp, desc: "Acumulado mensual" },
    { title: "Citas Hoy", value: String(todayAppointments || 0), icon: Calendar, desc: "Agendadas para hoy" },
    { title: "Total Clientes", value: String(totalClients || 0), icon: Users, desc: "Registrados" },
    { title: "Stock Bajo", value: String(lowStock?.length || 0), icon: Package, desc: "Productos por reponer" },
    { title: "Barberos Activos", value: String(activeBarbers || 0), icon: Scissors, desc: "En servicio" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Dashboard</h2>
        <p className="text-gray-500">Resumen general de EstudioLevels</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {cards.map((card) => (
          <div key={card.title} className="rounded-lg border bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between pb-2">
              <p className="text-sm font-medium text-gray-500">{card.title}</p>
              <card.icon className="h-4 w-4 text-gray-400" />
            </div>
            <div className="text-2xl font-bold">{card.value}</div>
            <p className="text-xs text-gray-500">{card.desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
