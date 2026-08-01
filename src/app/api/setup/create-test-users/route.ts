import { NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase/server";

// POST: Create test users for each role (run once)
export async function POST() {
  const supabase = createAdminSupabase();

  const testUsers = [
    { email: "superadmin@rebooking.cl", password: "Super123!", name: "Nico Levels", role: "super_admin" },
    { email: "admin@rebooking.cl", password: "Admin123!", name: "Pablo Admin", role: "admin" },
    { email: "barbero@rebooking.cl", password: "Barber123!", name: "Dylan Perez", role: "barber" },
    { email: "cliente@rebooking.cl", password: "Client123!", name: "Juan Cliente", role: "client" },
  ];

  const results = [];

  for (const user of testUsers) {
    // Create auth user
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: user.email,
      password: user.password,
      email_confirm: true,
    });

    if (authError) {
      // User might already exist
      if (authError.message?.includes("already") || authError.message?.includes("exists")) {
        // Update existing profile role
        const { data: existing } = await supabase
          .from("profiles")
          .select("id")
          .eq("email", user.email)
          .single();

        if (existing) {
          await supabase.from("profiles").update({ role: user.role, name: user.name }).eq("id", existing.id);
          results.push({ email: user.email, status: "updated", role: user.role });
        } else {
          results.push({ email: user.email, status: "error", error: authError.message });
        }
        continue;
      }
      results.push({ email: user.email, status: "error", error: authError.message });
      continue;
    }

    // Create or update profile
    if (authData.user) {
      await supabase.from("profiles").upsert({
        id: authData.user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        active: true,
      });
      results.push({ email: user.email, status: "created", role: user.role });
    }
  }

  return NextResponse.json({
    message: "Test users processed",
    results,
    credentials: testUsers.map((u) => ({ email: u.email, password: u.password, role: u.role })),
  });
}
