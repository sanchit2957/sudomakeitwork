const CACHE = "sudo-makeitwork-shell-v2";
const APP_SHELL = ["/", "/emergency", "/track"];

self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(APP_SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", event => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;
  if (event.request.mode === "navigate") {
    event.respondWith(fetch(event.request).then(response => { const clone = response.clone(); void caches.open(CACHE).then(cache => cache.put(event.request, clone)); return response; }).catch(async () => (await caches.match(event.request)) || (await caches.match("/"))));
    return;
  }
  if (new URL(event.request.url).origin !== self.location.origin) return;
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
