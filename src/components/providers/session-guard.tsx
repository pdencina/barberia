"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function SessionGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    // Only redirect to login on a REAL sign-out. This used to also check getSession()
    // on mount and every 5 minutes and push to /login whenever it returned null — but
    // getSession() just reads the local cookie and does NOT refresh the token. When the
    // 1-hour access token expired before the refresh ran, getSession() briefly reported
    // "no session" for a perfectly valid login, kicking professionals out every couple
    // of days. The middleware (which uses getUser(), the validating/refreshing call)
    // already protects the routes, so the guard only needs to react to an explicit
    // SIGNED_OUT event.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        router.push("/login");
        router.refresh();
      }
    });

    // When the app comes back to the foreground (PWA on a phone left in the background,
    // tab refocused), proactively validate/refresh the session. auto-refresh can pause
    // while the tab is hidden; getUser() revives the token so the barber isn't silently
    // logged out after leaving the app open for a day or two.
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        supabase.auth.getUser().catch(() => {});
      }
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      subscription.unsubscribe();
      document.removeEventListener("visibilitychange", onVisible);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <>{children}</>;
}
