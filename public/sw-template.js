const SHELL = "gazkontur-shell-__VERSION__";
const DOCS = "gazkontur-documents-v1";
const PRECACHE = __PRECACHE__;
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  );
});
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k.startsWith("gazkontur-shell-") && k !== SHELL)
            .map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});
async function documentResponse(request) {
  let cache;
  try {
    cache = await caches.open(DOCS);
  } catch {
    return fetch(request);
  }
  try {
    const response = await fetch(request);
    if (
      response.status === 200 &&
      !response.headers.get("content-type")?.includes("text/html")
    ) {
      const blob = await response.clone().blob();
      if (blob.size <= 15 * 1024 * 1024) {
        try {
          await cache.put(request, response.clone());
          const keys = await cache.keys();
          for (const key of keys.slice(0, Math.max(0, keys.length - 30)))
            await cache.delete(key);
        } catch {
          /* Quota failures must not prevent opening the document. */
        }
      }
    }
    return response;
  } catch {
    return (
      (await cache.match(request)) ??
      new Response("Нет соединения", { status: 503 })
    );
  }
}
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== "GET" || url.origin !== self.location.origin)
    return;
  // The application validates JSON before storing it, including on the first visit.
  if (url.pathname.startsWith("/config/")) return;
  if (url.pathname.startsWith("/documents/")) {
    event.respondWith(documentResponse(event.request));
    return;
  }
  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request).catch(
        async () => (await caches.match("/index.html")) ?? Response.error(),
      ),
    );
    return;
  }
  event.respondWith(
    caches.match(event.request, { ignoreVary: true }).then((saved) => saved ?? fetch(event.request)),
  );
});
