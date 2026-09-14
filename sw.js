const VERSION = "workflows-status-v2";
// base.js exposes the app's base path ("" when self-hosted at the domain
// root, "/workflows-status/" when served from GitHub Pages).
importScripts("base.js");
const B = self.APP_BASE || "/";
const SHELL = [
  B,
  B + "index.html",
  B + "style.css",
  B + "app.js",
  B + "manifest.webmanifest",
  B + "icons/icon-192.png",
  B + "icons/icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(VERSION).then((cache) => cache.addAll(SHELL))
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)))
    ).then(() => self.skipWaiting())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;
  if (B !== "/" && !url.pathname.startsWith(B)) return;

  // /status never goes through this service worker: self-hosted the vhost
  // proxies it; on GitHub Pages the app fetches it cross-origin directly.

  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(VERSION).then((cache) => cache.put(B, copy));
          return res;
        })
        .catch(async () => {
          const shell = await caches.match(B + "index.html");
          return shell || new Response("offline", { status: 503 });
        })
    );
    return;
  }

  event.respondWith(
    caches.match(req).then((cached) =>
      cached ||
      fetch(req).then((res) => {
        if (res.ok && url.pathname.startsWith(B + "icons/")) {
          const copy = res.clone();
          caches.open(VERSION).then((cache) => cache.put(req, copy));
        }
        return res;
      }).catch(() => new Response("offline", { status: 503 }))
    )
  );
});
