#!/usr/bin/env node
// Development server: builds the site, serves dist/ the way the nginx host does,
// rebuilds when src/, content/ or the build scripts change, and live-reloads open tabs.
// Zero dependencies. Never used in CI or deploys.
//   node scripts/dev.mjs                 # http://127.0.0.1:8080
//   PORT=9000 HOST=0.0.0.0 node scripts/dev.mjs
//   SITE_URL=http://127.0.0.1:8080/preview node scripts/dev.mjs   # test a subpath build
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { serveBadge } from "./badge-dev.mjs";
import { existsSync, readFileSync, statSync, watch } from "node:fs";
import { dirname, extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dist = join(root, "dist");
const port = Number(process.env.PORT || 8080);
const host = process.env.HOST || "127.0.0.1";
// The build must think it lives at this server, not at the production domain, or every
// canonical and asset URL would point away from the page being previewed.
process.env.SITE_URL ||= `http://${host === "0.0.0.0" ? "127.0.0.1" : host}:${port}`;

const TYPES = {
  ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8", ".xml": "application/xml; charset=utf-8", ".txt": "text/plain; charset=utf-8",
  ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp", ".ico": "image/x-icon",
  ".woff2": "font/woff2", ".webmanifest": "application/manifest+json",
};

/* ---------- build ---------- */
let building = null;
let queued = false;
let waiting = []; // requests held while dist/ is being rebuilt
let base = "";
const clients = new Set();

function build() {
  if (building) return (queued = true);
  const started = Date.now();
  building = spawn(process.execPath, [join(root, "scripts", "build.mjs")], { cwd: root, env: process.env, stdio: ["ignore", "pipe", "pipe"] });
  let err = "";
  building.stderr.on("data", (d) => (err += d));
  building.on("exit", (code) => {
    building = null;
    if (!queued) for (const resume of waiting.splice(0)) resume();
    if (code === 0) {
      base = (readFileSync(join(dist, "index.html"), "utf8").match(/<html[^>]*\sdata-base="([^"]*)"/) || [])[1] || "";
      console.log(`\x1b[32m✓\x1b[0m built in ${Date.now() - started} ms`);
      for (const res of clients) res.write("data: reload\n\n");
    } else {
      console.error(`\x1b[31m✗ build failed\x1b[0m\n${err.trim()}`);
    }
    if (queued) {
      queued = false;
      build();
    }
  });
}

let timer;
for (const dir of ["src", "content", "scripts"]) {
  const abs = join(root, dir);
  if (!existsSync(abs)) continue;
  watch(abs, { recursive: true }, (_, file) => {
    if (!file || /(^|\/)\.|~$|\.swp$/.test(file) || file.startsWith("static/assets/")) return;
    clearTimeout(timer);
    timer = setTimeout(build, 120);
  });
}

/* ---------- serve ---------- */
// Served at /__dev/reload.js and added to every HTML response, so the page's CSP
// ('self' scripts and connections) allows it without changes.
const RELOAD = `new EventSource(${JSON.stringify("/__dev/events")}).onmessage = () => location.reload();\n`;

function send(res, status, file) {
  let body;
  try {
    body = readFileSync(file);
  } catch {
    res.writeHead(503, { "Content-Type": TYPES[".txt"], "Retry-After": "1" });
    return res.end("dist/ is not built yet: see the dev server output\n");
  }
  const type = TYPES[extname(file)] || "application/octet-stream";
  if (type.startsWith("text/html")) body = String(body).replace("</body>", '<script src="/__dev/reload.js" defer></script></body>');
  res.writeHead(status, { "Content-Type": type, "Cache-Control": "no-store" });
  res.end(body);
}

createServer((req, res) => (building || queued ? waiting.push(() => handle(req, res)) : handle(req, res))).listen(port, host, () => {
  console.log(`dev server: ${process.env.SITE_URL}/  (watching src/, content/, scripts/; Ctrl+C to stop)`);
  build();
});

function handle(req, res) {
  const url = new URL(req.url, "http://x");
  if (url.pathname === "/__dev/reload.js") {
    res.writeHead(200, { "Content-Type": TYPES[".js"], "Cache-Control": "no-store" });
    return res.end(RELOAD);
  }
  if (url.pathname === "/__dev/events") {
    res.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-store", Connection: "keep-alive" });
    res.write(": connected\n\n");
    clients.add(res);
    return req.on("close", () => clients.delete(res));
  }
  if (base && url.pathname === "/") {
    res.writeHead(302, { Location: `${base}/` });
    return res.end();
  }
  const notFound = join(dist, "404.html");
  if (base && !url.pathname.startsWith(`${base}/`) && url.pathname !== base) return send(res, 404, notFound);
  if (serveBadge(url.pathname.slice(base.length), res)) return;
  let rel = decodeURIComponent(url.pathname.slice(base.length)) || "/";
  let file = normalize(join(dist, rel));
  if (!file.startsWith(dist)) return send(res, 404, notFound);
  if (existsSync(file) && statSync(file).isDirectory()) {
    if (!rel.endsWith("/")) {
      res.writeHead(301, { Location: `${url.pathname}/${url.search}` });
      return res.end();
    }
    file = join(file, "index.html");
  }
  if (!existsSync(file)) return send(res, 404, notFound);
  send(res, 200, file);
}
