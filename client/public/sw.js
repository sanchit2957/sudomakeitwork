const CACHE = "sudo-makeitwork-offline-shell-v2";
const APP_SHELL = ["/", "/emergency", "/track"];

self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(APP_SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches
      .keys()
      .then(keys => Promise.all(keys.filter(key => key.startsWith("rescue-offline-shell-") || key.startsWith("sudo-makeitwork-offline-shell-")).filter(key => key !== CACHE).map(key => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  // Operational tRPC calls must always reach the server. Caching them causes
  // the Command Centre and responder workspace to render old SOS and mission data.
  if (url.pathname === "/api" || url.pathname.startsWith("/api/")) return;
  if (event.request.mode === "navigate") {
    event.respondWith(fetch(event.request).then(response => { const clone = response.clone(); void caches.open(CACHE).then(cache => cache.put(event.request, clone)); return response; }).catch(async () => (await caches.match(event.request)) || (await caches.match("/"))));
    return;
  }
  if (url.origin !== self.location.origin) return;
  event.respondWith(caches.match(event.request).then(cached => cached || fetch(event.request).then(response => { const clone = response.clone(); void caches.open(CACHE).then(cache => cache.put(event.request, clone)); return response; })));
});

self.addEventListener("push", event => {
  const payload = event.data ? event.data.json() : {};
  const title = payload.title || "sudo MakeItWork";
  event.waitUntil(self.registration.showNotification(title, { body: payload.body || "You have a new emergency update.", icon: "/favicon.ico", badge: "/favicon.ico", data: { url: payload.url || "/responder/alerts", incidentId: payload.incidentId }, tag: payload.incidentId ? `incident-${payload.incidentId}` : undefined }));
});

self.addEventListener("notificationclick", event => {
  event.notification.close();
  event.waitUntil(clients.openWindow(event.notification.data?.url || "/responder/alerts"));
});
