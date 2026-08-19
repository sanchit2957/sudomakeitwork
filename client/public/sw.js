self.addEventListener("install", event => event.waitUntil(self.skipWaiting()));
self.addEventListener("activate", event => event.waitUntil(self.clients.claim()));

self.addEventListener("push", event => {
  const payload = event.data ? event.data.json() : {};
  const title = payload.title || "Riverguard operational alert";
  event.waitUntil(self.registration.showNotification(title, {
    body: payload.body || "Open Riverguard for details.",
    icon: "/favicon.ico",
    badge: "/favicon.ico",
    data: { url: payload.url || "/responder/alerts", incidentId: payload.incidentId },
    tag: payload.incidentId ? `incident-${payload.incidentId}` : undefined,
  }));
});

self.addEventListener("notificationclick", event => {
  event.notification.close();
  event.waitUntil(clients.openWindow(event.notification.data?.url || "/responder/alerts"));
});
