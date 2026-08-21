import { redirect } from "next/navigation";
import { createServerSupabase, createAdminSupabase } from "@/lib/supabase/server";
import { Sidebar } from "@/components/layout/sidebar";
import { ToastWrapper } from "@/components/providers/toast-wrapper";
import { AuthWrapper } from "@/components/providers/auth-wrapper";
import { TrialBanner } from "@/components/layout/trial-banner";
import { TenantOverrideBanner } from "@/components/layout/tenant-override-banner";
import { PushNotificationPrompt } from "@/components/push-notifications";
import { ErrorBoundary } from "@/components/error-boundary";
import { CommandPalette } from "@/components/command-palette";
import { QuickActions } from "@/components/quick-actions";

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

  const { data: profile } = await createAdminSupabase()
    .from("profiles")
    .select("name, role, tenant_id")
    .eq("id", user.id)
    .single();

  // Fetch tenant name for sidebar display
  let tenantName = "";
  if (profile?.tenant_id) {
    const { data: tenant } = await supabase
      .from("tenants")
      .select("name")
      .eq("id", profile.tenant_id)
      .single();
    tenantName = tenant?.name || "";
  }

  return (
    <ToastWrapper>
      <AuthWrapper
        serverRole={profile?.role || "admin"}
        serverUserId={user.id}
        serverEmail={user.email || ""}
        serverName={profile?.name || user.email || ""}
        serverTenantId={profile?.tenant_id || null}
      >
        <div className="flex h-screen">
          <Sidebar userName={profile?.name || user.email || ""} userRole={profile?.role || "barber"} tenantName={tenantName} />
          <main className="flex-1 overflow-y-auto bg-gray-50 pt-[4.5rem] lg:pt-0">
            <TenantOverrideBanner />
            <TrialBanner />
            <ErrorBoundary>
              {children}
            </ErrorBoundary>
            <PushNotificationPrompt />
            <QuickActions />
            <CommandPalette />
          </main>
        </div>
      </AuthWrapper>
    </ToastWrapper>
  );
}
