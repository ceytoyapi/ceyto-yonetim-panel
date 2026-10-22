// Ceyto Panel — hafif servis çalışanı. Sadece uygulama kabuğunu önbelleğe alır;
// veri istekleri (Supabase) her zaman ağdan gider.
const CACHE = "ceyto-shell-v11";
self.addEventListener("install", (e) => { self.skipWaiting(); });
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))));
  self.clients.claim();
});
self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== self.location.origin) return;
  // config.js dahil her şey: önce ağ, ağ yoksa önbellek (ayar dosyası yüklenemezse panel açılmıyordu)
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
  const acil = !!data.acil;
  const opts = {
    body: data.body || "",
    icon: new URL("icon-v4-192.png", self.registration.scope).href,
    badge: new URL("icon-v4-192.png", self.registration.scope).href,
    tag: data.tag || undefined,
    renotify: !!data.tag,                                   // aynı iş yeniden gelirse (tekrar) tekrar uyarsın
    requireInteraction: !!data.requireInteraction,          // acil / tekrar: kullanıcı kapatana kadar dursun
    silent: false,
    timestamp: Date.now(),
    data: { url: data.url || "#/", tip: data.tip || "" },
    vibrate: Array.isArray(data.vibrate) && data.vibrate.length ? data.vibrate : acil ? [300, 120, 300, 120, 300, 120, 700] : [80, 40, 80],
  };
  if (data.tip === "yeni" || data.tip === "tekrar") opts.actions = [{ action: "ac", title: "Aç" }];
  e.waitUntil((async () => {
    await self.registration.showNotification(title, opts);
    // "üstlendi" / "tamamlandı" bilgisi: 8 sn sonra kendiliğinden kapansın
    if (data.tip === "ustlenildi" || data.tip === "kapatildi") setTimeout(async () => { for (const n of await self.registration.getNotifications({ tag: data.tag })) if (n.data?.tip === data.tip) n.close(); }, 8000);
    // Açık panel sekmelerine haber ver (alarm şeridi anında güncellensin)
    for (const c of await self.clients.matchAll({ type: "window", includeUncontrolled: true })) c.postMessage({ tip: "push", veri: data });
  })());
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
