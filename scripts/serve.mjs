#!/usr/bin/env node
// Tiny zero-dependency static server for dist/, mounted at the build's base path,
// with the production nginx behaviour: directory → index.html, unknown paths → 404.html.
//   node scripts/serve.mjs                         # http://127.0.0.1:8080 (base read from dist)
//   PORT=9000 HOST=0.0.0.0 node scripts/serve.mjs
//   DIST=/tmp/out PORT=9001 node scripts/serve.mjs  # serve a build made with DIST=/tmp/out
//
// `npm run serve` builds first with SITE_URL set to this server (see package.json), so
// canonical and asset URLs point at the preview rather than at the production domain.
import { createServer } from "node:http";
import { serveBadge } from "./badge-dev.mjs";
import { createReadStream, existsSync, readFileSync, statSync } from "node:fs";
import { extname, join, normalize, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const dist = resolve(dirname(fileURLToPath(import.meta.url)), "..", process.env.DIST || "dist");
if (!existsSync(join(dist, "index.html"))) {
  console.error("dist/ is empty: run node scripts/build.mjs first");
  process.exit(1);
}
// The base path the site was built for (from <html data-base>), so a subpath build
// is served at /<base>/ exactly as the host would.
const base = (readFileSync(join(dist, "index.html"), "utf8").match(/<html[^>]*\sdata-base="([^"]*)"/) || [])[1] || "";
const port = Number(process.env.PORT || 8080);
const host = process.env.HOST || "127.0.0.1";
const TYPES = {
  ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8", ".xml": "application/xml; charset=utf-8", ".txt": "text/plain; charset=utf-8",
  ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp", ".ico": "image/x-icon",
  ".woff2": "font/woff2", ".webmanifest": "application/manifest+json",
};

function send(res, status, file) {
  const type = TYPES[extname(file)] || "application/octet-stream";
  const cache = /\/assets\/(css|js|search)\//.test(file) ? "public, max-age=31536000, immutable" : "no-cache";
  res.writeHead(status, { "Content-Type": type, "Cache-Control": cache, "X-Content-Type-Options": "nosniff" });
  createReadStream(file).pipe(res);
}

createServer((req, res) => {
  let path;
  try { path = decodeURIComponent(new URL(req.url, "http://x").pathname); } catch { path = "/"; }
  if (base && (path === "/" || path === "")) { res.writeHead(302, { Location: base + "/" }); return res.end(); }
  if (base && path === base) { res.writeHead(301, { Location: base + "/" }); return res.end(); }
  if (base && !path.startsWith(base + "/")) return send(res, 404, join(dist, "404.html"));
  if (serveBadge(path.slice(base.length), res)) return;
  const rel = normalize(path.slice(base.length)).replace(/^(\.\.[/\\])+/, "");
  let file = join(dist, rel);
  if (!file.startsWith(dist)) return send(res, 404, join(dist, "404.html"));
  if (existsSync(file) && statSync(file).isDirectory()) {
    if (!path.endsWith("/")) { res.writeHead(301, { Location: path + "/" }); return res.end(); }
    file = join(file, "index.html");
  }
  if (!existsSync(file)) return send(res, 404, join(dist, "404.html"));
  send(res, 200, file);
}).listen(port, host, () => console.log(`serving ${dist} at http://${host}:${port}${base}/`));
