// Service Worker for Push Notifications - re-booking

self.addEventListener("push", (event) => {
  const data = event.data ? event.data.json() : {};

  const options = {
    body: data.body || "Nueva notificacion de re-booking",
    icon: data.icon || "/logo-icon.png",
    badge: data.badge || "/logo-icon.png",
    vibrate: [200, 100, 200],
    tag: data.tag || "re-booking-" + Date.now(),
    renotify: true,
    data: {
      url: data.url || "/dashboard",
    },
    actions: [
      { action: "open", title: "Ver" },
      { action: "close", title: "Cerrar" },
    ],
  };

  event.waitUntil(
    self.registration.showNotification(data.title || "re-booking", options)
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  if (event.action === "close") return;

  const url = event.notification.data?.url || "/dashboard";
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      // Focus existing window if open
      for (const client of clientList) {
        if (client.url.includes("re-booking") && "focus" in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      // Otherwise open new window
      return clients.openWindow(url);
    })
  );
});

// Cache strategy for offline support
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", () => self.clients.claim());
