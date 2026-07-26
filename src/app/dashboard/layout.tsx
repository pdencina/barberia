import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import { Sidebar } from "@/components/layout/sidebar";
import { ToastWrapper } from "@/components/providers/toast-wrapper";
import { PushNotificationPrompt } from "@/components/push-notifications";
import { ErrorBoundary } from "@/components/error-boundary";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("name, role")
    .eq("id", user.id)
    .single();

  return (
    <ToastWrapper>
      <div className="flex h-screen">
        <Sidebar userName={profile?.name || user.email || ""} userRole={profile?.role || "barber"} />
        <main className="flex-1 overflow-y-auto bg-gray-50 pt-[4.5rem] lg:pt-0">
          <ErrorBoundary>
            {children}
          </ErrorBoundary>
          <PushNotificationPrompt />
        </main>
      </div>
    </ToastWrapper>
  );
}
