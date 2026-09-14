// GET /status.js?job=<name>&limit=<n>
// CORS proxy for the GitHub Pages build: the app on hari2m.github.io
// fetches the LAN status endpoint cross-origin, which a browser blocks.
// This service worker (installed by sw.js when the app runs on a
// non-self-hosted origin) fetches the same JSON from
// workflows.supremeporter.com (same machine, LAN) and echoes it back
// with Access-Control-Allow-Origin: *. No credentials are stored or
// forwarded; the status endpoint is auth-free by design.
// The self-hosted build never installs this worker (sw.js only
// registers on workflows.supremeporter.com / localhost).
const UPSTREAM = "https://workflows.supremeporter.com";

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => {
  event.waitUntil(clients.claim());
});
self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.pathname !== "/status.js") return;
  const target = new URL(UPSTREAM + "/status");
  const q = url.searchParams;
  if (q.has("job")) target.searchParams.set("job", q.get("job"));
  if (q.has("limit")) target.searchParams.set("limit", q.get("limit"));
  event.respondWith(
    fetch(target, { cache: "no-store" })
      .then((res) =>
        res.text().then((body) =>
          new Response(body, {
            status: res.status,
            headers: {
              "Access-Control-Allow-Origin": "*",
              "Content-Type": "application/json",
              "Cache-Control": "no-store",
            },
          })
        )
      )
      .catch(() =>
        new Response(JSON.stringify({ error: "upstream unreachable" }), {
          status: 502,
          headers: {
            "Access-Control-Allow-Origin": "*",
            "Content-Type": "application/json",
          },
        })
      )
  );
});
