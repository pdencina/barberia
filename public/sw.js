// Service Worker for Push Notifications - re-booking

self.addEventListener("push", (event) => {
  const data = event.data ? event.data.json() : {};

  const options = {
    body: data.body || "Nueva notificacion de re-booking",
    icon: "/logo.png",
    badge: "/logo.png",
    vibrate: [200, 100, 200],
    tag: data.tag || "default",
    data: {
      url: data.url || "/dashboard",
    },
  };

  event.waitUntil(
    self.registration.showNotification(data.title || "re-booking", options)
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/dashboard";
  event.waitUntil(clients.openWindow(url));
});
