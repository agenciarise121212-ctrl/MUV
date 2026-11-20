// MUV service worker — rede primeiro, cache como fallback (somente GET de páginas e assets)
const CACHE = "muv-v1";
self.addEventListener("install", (e) => { self.skipWaiting(); e.waitUntil(caches.open(CACHE).then((c) => c.addAll(["/", "/record", "/map", "/missions", "/profile"]).catch(() => {}))); });
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));
self.addEventListener("fetch", (e) => {
  const r = e.request;
  if (r.method !== "GET" || new URL(r.url).origin !== location.origin || r.url.includes("/api/")) return;
  e.respondWith(fetch(r).then((res) => { const copy = res.clone(); if (res.ok) caches.open(CACHE).then((c) => c.put(r, copy)); return res; }).catch(() => caches.match(r).then((m) => m || caches.match("/"))));
});
