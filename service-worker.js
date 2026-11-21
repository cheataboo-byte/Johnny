const CACHE_NAME = "molecule-shell-v3";
const APP_SHELL = [
  "./",
  "./index.html",
  "./styles.css",
  "./app.js",
  "./firebase-client.js",
  "./firebase-config.js",
  "./bio-knowledge.js",
  "./virtual-lab.js",
  "./science-api-client.js",
  "./manifest.webmanifest",
  "./icons/icon-192.svg",
  "./icons/icon-512.svg"
];

let pushMessaging = null;
try {
  importScripts("./firebase-config.js");
  const config = self.MOLECULE_FIREBASE_CONFIG || {};
  if (config.apiKey && !config.apiKey.startsWith("YOUR_")) {
    importScripts("https://www.gstatic.com/firebasejs/12.6.0/firebase-app-compat.js");
    importScripts("https://www.gstatic.com/firebasejs/12.6.0/firebase-messaging-compat.js");
    firebase.initializeApp(config);
    pushMessaging = firebase.messaging();
    pushMessaging.onBackgroundMessage(payload => {
      const notice = payload.notification || payload.data || {};
      self.registration.showNotification(notice.title || "molecule update", {
        body: notice.body || "There's a new update in your science lab.",
        icon: "./icons/icon-192.svg",
        badge: "./icons/icon-192.svg",
        data: { url: notice.url || payload.fcmOptions?.link || "./" }
      });
    });
  }
} catch (error) {
  console.error("Background push setup is unavailable; offline app support remains enabled.", error);
}

self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener("notificationclick", event => {
  event.notification.close();
  const noticeUrl = event.notification.data?.url || "./";
  const target = new URL(noticeUrl, self.location.origin);
  if (target.origin !== self.location.origin) return;
  event.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(clients => {
    const existing = clients.find(client => client.url.startsWith(self.location.origin));
    if (existing) return existing.navigate(target.href).then(() => existing.focus());
    return self.clients.openWindow(target.href);
  }));
});

self.addEventListener("activate", event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(
    keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
  )));
  self.clients.claim();
});

self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  if (event.request.destination === "script" || event.request.destination === "style" || url.pathname.endsWith("/firebase-config.js")) {
    event.respondWith(fetch(event.request, { cache: "no-store" }).then(async response => {
      if (response.ok) await (await caches.open(CACHE_NAME)).put(event.request, response.clone());
      return response;
    }).catch(() => caches.match(event.request)));
    return;
  }
  if (event.request.mode === "navigate") {
    event.respondWith(fetch(event.request).then(response => {
      if (response.ok) caches.open(CACHE_NAME).then(cache => cache.put("./index.html", response.clone()));
      return response;
    }).catch(() => caches.match("./index.html")));
    return;
  }
  event.respondWith(caches.match(event.request).then(cached => cached || fetch(event.request)));
});
