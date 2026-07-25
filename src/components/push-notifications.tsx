"use client";

import { useEffect, useState } from "react";

export function PushNotificationPrompt() {
  const [permission, setPermission] = useState<string>("default");
  const [show, setShow] = useState(false);

  useEffect(() => {
    if ("Notification" in window && "serviceWorker" in navigator) {
      setPermission(Notification.permission);
      if (Notification.permission === "default") {
        // Show prompt after 3 seconds
        const timer = setTimeout(() => setShow(true), 3000);
        return () => clearTimeout(timer);
      }
    }
  }, []);

  const subscribe = async () => {
    try {
      const perm = await Notification.requestPermission();
      setPermission(perm);

      if (perm === "granted") {
        const registration = await navigator.serviceWorker.register("/sw.js");
        await navigator.serviceWorker.ready;

        const subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
        });

        await fetch("/api/push/subscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ subscription: subscription.toJSON() }),
        });

        setShow(false);
      }
    } catch (err) {
      console.error("Error subscribing to push:", err);
    }
  };

  if (!show || permission !== "default") return null;

  return (
    <div className="fixed bottom-4 left-4 z-50 bg-white rounded-lg shadow-xl border border-gray-200 p-4 max-w-sm animate-slide-in">
      <p className="font-medium text-gray-900 text-sm mb-1">Activar notificaciones?</p>
      <p className="text-xs text-gray-500 mb-3">Recibe alertas cuando un cliente agenda una cita.</p>
      <div className="flex gap-2">
        <button onClick={() => setShow(false)}
          className="px-3 py-1.5 text-xs border rounded-lg hover:bg-gray-50">Ahora no</button>
        <button onClick={subscribe}
          className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700">Activar</button>
      </div>
    </div>
  );
}
