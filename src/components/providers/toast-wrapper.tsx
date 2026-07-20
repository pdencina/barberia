"use client";

import { ToastProvider } from "@/components/ui/toast";
import { ConfirmProvider } from "@/components/ui/confirm-dialog";
import { SessionGuard } from "@/components/providers/session-guard";

export function ToastWrapper({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      <ConfirmProvider>
        <SessionGuard>
          {children}
        </SessionGuard>
      </ConfirmProvider>
    </ToastProvider>
  );
}
