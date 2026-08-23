"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";

export function PushNotificationPrompt() {
  const [permission, setPermission] = useState<string>("default");
  const [show, setShow] = useState(false);
  const { user } = useAuth();

  useEffect(() => {
    if ("Notification" in window && "serviceWorker" in navigator) {
      setPermission(Notification.permission);
      const dismissed = localStorage.getItem("push-prompt-dismissed");
      if (Notification.permission === "default" && !dismissed) {
        const timer = setTimeout(() => setShow(true), 3000);
        return () => clearTimeout(timer);
      }
      // If already granted, silently register subscription
      if (Notification.permission === "granted" && user?.id) {
        registerSubscription(user.id);
      }
    }
  }, [user?.id]);

  const registerSubscription = async (userId: string) => {
    try {
      const registration = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
      });

      await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subscription: subscription.toJSON(), userId }),
      });
    } catch (err) {
      console.error("Error registering push subscription:", err);
    }
  };

  const subscribe = async () => {
    try {
      const perm = await Notification.requestPermission();
      setPermission(perm);

      if (perm === "granted" && user?.id) {
        await registerSubscription(user.id);
        setShow(false);
        localStorage.setItem("push-prompt-dismissed", "true");
      }
    } catch (err) {
      console.error("Error subscribing to push:", err);
    }
  };

  if (!show || permission !== "default") return null;

  return (
    <div className="fixed bottom-4 left-4 z-50 bg-white rounded-lg shadow-xl border border-gray-200 p-4 max-w-sm animate-slide-in">
      <p className="font-medium text-gray-900 text-sm mb-1">Activar notificaciones?</p>
      <p className="text-xs text-gray-500 mb-3">Recibe alertas cuando llega un cliente o se agenda una cita.</p>
      <div className="flex gap-2">
        <button onClick={() => { setShow(false); localStorage.setItem("push-prompt-dismissed", "true"); }}
          className="px-3 py-1.5 text-xs border rounded-lg hover:bg-gray-50">Ahora no</button>
        <button onClick={subscribe}
          className="px-3 py-1.5 text-xs bg-brand-blue text-white rounded-lg hover:bg-brand-blue/90">Activar</button>
      </div>
    </div>
  );
}
