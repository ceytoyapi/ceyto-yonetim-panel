// Ceyto Panel — hafif servis çalışanı. Sadece uygulama kabuğunu önbelleğe alır;
// veri istekleri (Supabase) her zaman ağdan gider.
const CACHE = "ceyto-shell-v2";
self.addEventListener("install", (e) => { self.skipWaiting(); });
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))));
  self.clients.claim();
});
self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== self.location.origin) return;
  if (url.pathname.endsWith("/config.js")) return; // ayar dosyası hep taze
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copy));
        return res;
      })
      .catch(() => caches.match(e.request).then((r) => r || caches.match(new URL("index.html", self.registration.scope).href)))
  );
});

// ---- Push bildirimleri
self.addEventListener("push", (e) => {
  let data = {};
  try { data = e.data ? e.data.json() : {}; } catch { data = { title: "Ceyto Panel", body: e.data ? e.data.text() : "" }; }
  const title = data.title || "Ceyto Panel";
  const opts = {
    body: data.body || "",
    icon: new URL("icon-192.png", self.registration.scope).href,
    badge: new URL("icon-192.png", self.registration.scope).href,
    tag: data.tag || undefined,
    renotify: !!data.tag,
    data: { url: data.url || "#/" },
    vibrate: [80, 40, 80],
  };
  e.waitUntil(self.registration.showNotification(title, opts));
});
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const target = new URL(e.notification.data?.url || "#/", self.registration.scope).href;
  e.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
    for (const c of list) {
      if (c.url.startsWith(self.registration.scope)) { c.navigate(target); return c.focus(); }
    }
    return self.clients.openWindow(target);
  }));
});
