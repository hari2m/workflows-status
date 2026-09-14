// GET /status.js?job=<name>&limit=<n>
// CORS proxy for the GitHub Pages build: the app on hari2m.github.io
// fetches the LAN status endpoint cross-origin, which a browser blocks.
// This service worker (installed by app.js when the app runs on a
// non-self-hosted origin) fetches the same JSON from
// workflows.supremeporter.com (same machine, LAN) and echoes it back
// with Access-Control-Allow-Origin: *. No credentials are stored or
// forwarded; the status endpoint is auth-free by design.
// The self-hosted build never installs this worker (sw.js only
// registers on workflows.supremeporter.com / localhost).
const UPSTREAM = "http://localhost:8765";
const UPSTREAM_FALLBACK = "https://workflows.supremeporter.com";

async function fetchStatus(params) {
  const tryUrl = (base) => {
    const u = new URL(base + "/status");
    for (const [k, v] of params) u.searchParams.set(k, v);
    return fetch(u, { cache: "no-store" });
  };
  // Same machine: localhost first (no TLS, no proxy hop); the vhost as
  // fallback (e.g. if the port is ever closed or renamed).
  for (const base of [UPSTREAM, UPSTREAM_FALLBACK]) {
    try {
      const res = await tryUrl(base);
      if (res.ok) return res;
      if (res.status < 500) {
        const body = await res.text();
        return new Response(body, { status: res.status });
      }
    } catch (err) {
      continue;
    }
  }
  return null;
}

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => {
  event.waitUntil(clients.claim());
});
self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.pathname !== "/status.js") return;
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
  };
  event.respondWith(
    fetchStatus(url.searchParams)
      .then((res) => {
        if (!res)
          return new Response(JSON.stringify({ error: "upstream unreachable" }), {
            status: 502,
            headers,
          });
        return res.text().then((body) => new Response(body, { status: res.status, headers }));
      })
      .catch(() =>
        new Response(JSON.stringify({ error: "upstream unreachable" }), {
          status: 502,
          headers,
        })
      )
  );
});
