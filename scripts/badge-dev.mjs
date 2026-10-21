// The local stand-in for the production badge proxy (deploy/nginx-badges.conf), used by
// scripts/dev.mjs and scripts/serve.mjs: /badges/<id>.svg is fetched from the badge's
// upstream URL in src/badges.mjs and cached in memory for the life of the server.

import { badges } from "../src/badges.mjs";

const byId = new Map(badges.map((b) => [b.id, b.src]));
const cache = new Map();

/** Answer a /badges/<id>.svg request (path without the base); false if it is not one. */
export function serveBadge(path, res) {
  const m = path.match(/^\/badges\/([a-z0-9-]+)\.svg$/);
  if (!m) return false;
  const src = byId.get(m[1]);
  if (!src) {
    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("unknown badge");
    return true;
  }
  const hit = cache.get(src);
  const body = hit ?? fetch(src, { headers: { "User-Agent": "powerdns-authadmin.org badge proxy (dev)" } }).then((r) => (r.ok ? r.text() : Promise.reject(new Error(`${r.status}`))));
  if (!hit) cache.set(src, body);
  body.then(
    (svg) => {
      res.writeHead(200, { "Content-Type": "image/svg+xml", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" });
      res.end(svg);
    },
    (err) => {
      cache.delete(src);
      res.writeHead(502, { "Content-Type": "text/plain" });
      res.end(`badge upstream failed: ${err.message}`);
    },
  );
  return true;
}
