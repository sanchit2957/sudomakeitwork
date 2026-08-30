const CACHE = "sudo-makeitwork-offline-shell-v3";
const APP_SHELL = ["/", "/emergency", "/track", "/safety", "/more"];

// ─── IndexedDB helpers (duplicated here because SW can't import from app bundle) ─

const DB_NAME = "sudo-makeitwork-sos";
const DB_VERSION = 1;
const STORE_NAME = "outbox";

function openSosDb() {
  return new Promise(function (resolve, reject) {
    var request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = function () {
      var db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        var store = db.createObjectStore(STORE_NAME, { keyPath: "id" });
        store.createIndex("status", "status", { unique: false });
        store.createIndex("createdAt", "createdAt", { unique: false });
      }
    };
    request.onsuccess = function () { resolve(request.result); };
    request.onerror = function () { reject(request.error); };
  });
}

function readPendingSos(db) {
  return new Promise(function (resolve, reject) {
    var tx = db.transaction(STORE_NAME, "readonly");
    var index = tx.objectStore(STORE_NAME).index("status");
    var req = index.getAll("pending");
    req.onsuccess = function () {
      var results = req.result || [];
      results.sort(function (a, b) { return a.createdAt - b.createdAt; });
      resolve(results);
    };
    req.onerror = function () { reject(req.error); };
  });
}

function markDelivered(db, id) {
  return new Promise(function (resolve, reject) {
    var tx = db.transaction(STORE_NAME, "readwrite");
    var store = tx.objectStore(STORE_NAME);
    var getReq = store.get(id);
    getReq.onsuccess = function () {
      var record = getReq.result;
      if (!record) { resolve(); return; }
      record.status = "delivered";
      record.deliveredAt = Date.now();
      store.put(record);
    };
    tx.oncomplete = function () { resolve(); };
    tx.onerror = function () { reject(tx.error); };
  });
}

function markFailed(db, id) {
  return new Promise(function (resolve, reject) {
    var tx = db.transaction(STORE_NAME, "readwrite");
    var store = tx.objectStore(STORE_NAME);
    var getReq = store.get(id);
    getReq.onsuccess = function () {
      var record = getReq.result;
      if (!record) { resolve(); return; }
      record.retryCount = (record.retryCount || 0) + 1;
      store.put(record);
    };
    tx.oncomplete = function () { resolve(); };
    tx.onerror = function () { reject(tx.error); };
  });
}

// ─── Determine the API base URL from the SW's own origin ─────────────

function getApiBaseUrl() {
  // In production, the SW origin IS the API origin.
  // In dev, there's a Vite proxy so relative URLs work fine.
  return self.location.origin;
}

// ─── Background Sync: flush offline SOS to the REST endpoint ────────

async function flushSosFromServiceWorker() {
  var db;
  try {
    db = await openSosDb();
  } catch (err) {
    console.warn("[SW] Cannot open IndexedDB for offline SOS flush:", err);
    return;
  }

  var pending = await readPendingSos(db);
  if (pending.length === 0) return;

  console.log("[SW] Background Sync: flushing " + pending.length + " offline SOS alert(s)");

  var deliveredCodes = [];

  for (var i = 0; i < pending.length; i++) {
    var record = pending[i];
    try {
      var response = await fetch(getApiBaseUrl() + "/api/sos/offline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(record.payload),
      });
      if (response.ok) {
        var data = await response.json();
        await markDelivered(db, record.id);
        deliveredCodes.push(data.publicCode || record.id);
        console.log("[SW] Delivered offline SOS: " + (data.publicCode || record.id));
      } else {
        await markFailed(db, record.id);
        console.warn("[SW] Offline SOS delivery returned " + response.status);
      }
    } catch (fetchErr) {
      await markFailed(db, record.id);
      console.warn("[SW] Offline SOS delivery failed:", fetchErr);
    }
  }

  // Show a notification to reassure the user their SOS was delivered
  if (deliveredCodes.length > 0 && self.registration) {
    try {
      await self.registration.showNotification("SOS Delivered", {
        body: deliveredCodes.length === 1
          ? "Your emergency SOS (" + deliveredCodes[0] + ") has been delivered to the Command Centre."
          : deliveredCodes.length + " offline SOS alerts have been delivered to the Command Centre.",
        icon: "/favicon.ico",
        badge: "/favicon.ico",
        tag: "sos-delivery-confirmation",
        data: { url: "/track?code=" + deliveredCodes[0] },
      });
    } catch (notifErr) {
      console.warn("[SW] Could not show SOS delivery notification:", notifErr);
    }
  }
}

// ─── Service Worker lifecycle ────────────────────────────────────────

self.addEventListener("install", function (event) {
  event.waitUntil(caches.open(CACHE).then(function (cache) { return cache.addAll(APP_SHELL); }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener("activate", function (event) {
  event.waitUntil(
    caches
      .keys()
      .then(function (keys) { return Promise.all(keys.filter(function (key) { return key.startsWith("rescue-offline-shell-") || key.startsWith("sudo-makeitwork-offline-shell-"); }).filter(function (key) { return key !== CACHE; }).map(function (key) { return caches.delete(key); })); })
      .then(function () { return self.clients.claim(); })
  );
});

self.addEventListener("fetch", function (event) {
  if (event.request.method !== "GET") return;
  var url = new URL(event.request.url);
  // Operational tRPC calls must always reach the server.
  if (url.pathname === "/api" || url.pathname.startsWith("/api/")) return;
  if (event.request.mode === "navigate") {
    event.respondWith(fetch(event.request).then(function (response) { var clone = response.clone(); void caches.open(CACHE).then(function (cache) { cache.put(event.request, clone); }); return response; }).catch(async function () { return (await caches.match(event.request)) || (await caches.match("/")); }));
    return;
  }
  if (url.origin !== self.location.origin) return;
  event.respondWith(fetch(event.request).then(function (response) { var clone = response.clone(); void caches.open(CACHE).then(function (cache) { cache.put(event.request, clone); }); return response; }).catch(function () { return caches.match(event.request); }));
});

// ─── Background Sync: fires when connectivity returns ────────────────

self.addEventListener("sync", function (event) {
  if (event.tag === "sos-outbox-sync") {
    event.waitUntil(flushSosFromServiceWorker());
  }
});

// ─── Push notifications ──────────────────────────────────────────────

self.addEventListener("push", function (event) {
  var payload = event.data ? event.data.json() : {};
  var title = payload.title || "sudo MakeItWork";
  event.waitUntil(self.registration.showNotification(title, { body: payload.body || "You have a new emergency update.", icon: "/favicon.ico", badge: "/favicon.ico", data: { url: payload.url || "/responder/alerts", incidentId: payload.incidentId }, tag: payload.incidentId ? "incident-" + payload.incidentId : undefined }));
});

self.addEventListener("notificationclick", function (event) {
  event.notification.close();
  event.waitUntil(clients.openWindow(event.notification.data && event.notification.data.url ? event.notification.data.url : "/responder/alerts"));
});
