#!/usr/bin/env node
// Static QA gate on dist/: SEO metadata, structured data, internal links and assets
// (base-path aware), CSP hashes, third-party hygiene and the search index. Exits
// non-zero on failure. DIST=<dir> checks a build made with the same DIST.
//
//   node scripts/build.mjs && node scripts/check.mjs
//   SITE_URL=http://127.0.0.1:8080/preview node scripts/build.mjs && node scripts/check.mjs
//
// The base path and site URL are read from the built dist/index.html (data-base and
// canonical), so the check always matches whatever SITE_URL the build used.
//
// The only third party this site talks to is Google Analytics 4, loaded by
// src/js/analytics.js (never inline); its hosts are the one allowance below. NGN
// (who built the site and offer commercial support) and IndexNow are intentional.
//
// Extension hooks: src/docs/check.mjs and src/search/check.mjs may export a default
// function (ctx) that adds checks with ctx.ok(condition, message). ctx carries
// { dist, base, url, files, htmlFiles, read, resolve, ok }.
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, dirname, extname, resolve as resolvePath } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { site } from "../src/site.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dist = resolvePath(root, process.env.DIST || "dist"); // DIST overrides the directory to check
const errors = [];
let checks = 0;
const ok = (cond, msg) => { checks++; if (!cond) errors.push(msg); return cond; };

if (!existsSync(join(dist, "index.html"))) {
  console.error("✗ dist/index.html missing: run node scripts/build.mjs first");
  process.exit(1);
}
const walk = (d) => readdirSync(d).flatMap((f) => (statSync(join(d, f)).isDirectory() ? walk(join(d, f)) : [join(d, f)]));
const files = walk(dist);
const htmlFiles = files.filter((f) => f.endsWith(".html"));
const cache = new Map();
const read = (f) => { if (!cache.has(f)) cache.set(f, readFileSync(f, "utf8")); return cache.get(f); };

const homeHtml = read(join(dist, "index.html"));
const base = (homeHtml.match(/<html[^>]*\sdata-base="([^"]*)"/) || [])[1] ?? "";
const siteUrl = ((homeHtml.match(/<link rel="canonical" href="([^"]+)"/) || [])[1] || "").replace(/\/$/, "");
ok(siteUrl && new URL(siteUrl + "/").pathname.replace(/\/$/, "") === base, `base "${base}" does not match canonical ${siteUrl}`);
const rel = (f) => "/" + f.slice(dist.length + 1);

// Resolve a site path (with the base) to a file in dist.
function resolve(url) {
  let path = url.split(/[?#]/)[0];
  if (!path) return true;
  if (base) {
    if (path !== base && !path.startsWith(base + "/")) return false;
    path = path.slice(base.length) || "/";
  }
  const file = join(dist, decodeURIComponent(path));
  return existsSync(file) && (statSync(file).isFile() || existsSync(join(file, "index.html")));
}
const fileFor = (url) => {
  let path = url.split(/[?#]/)[0];
  if (base) path = path.slice(base.length) || "/";
  const f = join(dist, decodeURIComponent(path));
  return existsSync(f) && statSync(f).isDirectory() ? join(f, "index.html") : f;
};
const attr = (tag, name) => (tag.match(new RegExp(`\\s${name}="([^"]*)"`)) || [])[1];
const meta = (html, key) => (html.match(new RegExp(`<meta (?:name|property)="${key}" content="([^"]*)"`)) || [])[1];
const isExternal = (u) => /^[a-z][a-z0-9+.-]*:/i.test(u) || u.startsWith("//");

// Google Analytics 4: the hosts gtag.js is served from and beacons to. Nothing else
// off-site may appear in the CSP or be loaded by a script.
const GA_HOSTS = /https:\/\/(?:\*\.)?(?:googletagmanager\.com|google-analytics\.com|analytics\.google\.com|g\.doubleclick\.net|www\.google\.com(?:\.au)?)/g;
const isAnalyticsJs = (f) => /\/assets\/js\/analytics\.[0-9a-f]+\.js$/.test(f);

/* ---------- Hygiene across every text file ---------- */
const TEXT = new Set([".html", ".css", ".js", ".json", ".txt", ".xml", ".webmanifest", ".svg", ""]);
// Names from the reference site this one was ported from must never leak into copy or
// code. The patterns are assembled from fragments so this file does not itself contain
// the words a repository-wide grep looks for.
const word = (...parts) => new RegExp(parts.join(""), "i");
const banned = [
  [word("rust", "guac"), "reference project name"],
  [word("\\bso", "l1\\b|dave", "ke", "mpe|dave ", "ke", "mp"), "reference project maintainer"],
  [/raw\.githubusercontent\.com/i, "raw.githubusercontent hotlink"],
];
const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/g;
const emailOk = (e) =>
  /@(?:[a-z0-9-]+\.)*example(?:\.(?:com|net|org))?$/i.test(e) ||
  /@[a-z0-9.-]+\.(?:test|example|invalid|localhost)$/i.test(e) ||
  /@[a-z0-9.-]+\.example\.internal$/i.test(e) ||
  /^git@github\.com$/i.test(e) ||
  /@ngn\.au$/i.test(e) || // the commercial support contact (site.support.email)
  /\.(?:service|socket|timer|target|mount)$/i.test(e); // systemd template units (name@instance.service)
for (const f of files) {
  if (!TEXT.has(extname(f))) continue;
  // The deploy host's own name (e.g. a staging domain) is not content.
  const text = read(f).split(new URL(siteUrl).host).join("site.host");
  for (const [re, what] of banned) {
    const m = text.match(re);
    ok(!m, `${rel(f)}: ${what} (“${m && m[0]}”)`);
  }
  for (const [e] of text.matchAll(EMAIL)) ok(emailOk(e), `${rel(f)}: email address ${e}`);
  if (f.endsWith(".css")) {
    for (const [, u] of text.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/g)) {
      if (u.startsWith("data:")) continue;
      ok(!isExternal(u), `${rel(f)}: third-party url(${u})`);
      if (!isExternal(u)) ok(existsSync(join(dirname(f), u.split(/[?#]/)[0])), `${rel(f)}: missing url(${u})`);
    }
    ok(!/@import\s/.test(text), `${rel(f)}: @import`);
  }
  if (f.endsWith(".js")) {
    ok(!/(?:fetch|importScripts|import)\s*\(\s*["'`]https?:/.test(text), `${rel(f)}: fetches a third-party URL`);
    // analytics.js is the one script allowed to inject a remote <script>: gtag.js from Google.
    const loads = [...text.matchAll(/\.src\s*=\s*["'`](https?:[^"'`]*)/g)].map((m) => m[1]);
    for (const u of loads) ok(isAnalyticsJs(f) && /^https:\/\/www\.googletagmanager\.com\//.test(u), `${rel(f)}: loads a third-party script or image (${u})`);
    if (isAnalyticsJs(f)) ok(loads.length === 1, `${rel(f)}: expected exactly one remote script load (gtag.js), found ${loads.length}`);
  }
}

/* ---------- Per page ---------- */
const titles = new Map();
const descriptions = new Map();
for (const file of htmlFiles) {
  const r = rel(file).replace(/index\.html$/, "");
  const html = read(file);
  const where = (m) => `${r}: ${m}`;
  const noindex = /<meta name="robots" content="noindex/.test(html);

  // Head metadata
  const title = (html.match(/<title>([^<]*)<\/title>/) || [])[1] || "";
  const titleText = title.replace(/&amp;/g, "&").replace(/&quot;/g, '"');
  ok(titleText.length >= 15 && titleText.length <= 70, where(`title length ${titleText.length}: ${titleText}`));
  ok(!titles.has(title), where(`duplicate title (also ${titles.get(title)})`)); titles.set(title, r);
  const desc = (meta(html, "description") || "").replace(/&amp;/g, "&").replace(/&quot;/g, '"');
  ok(desc.length >= 70 && desc.length <= 165, where(`description length ${desc.length}`));
  if (!noindex) { ok(!descriptions.has(desc), where(`duplicate description (also ${descriptions.get(desc)})`)); descriptions.set(desc, r); }
  const canonical = (html.match(/<link rel="canonical" href="([^"]+)"/) || [])[1];
  ok(canonical === siteUrl + r, where(`canonical ${canonical} ≠ ${siteUrl + r}`));
  ok((html.match(/<h1[\s>]/g) || []).length === 1, where("must have exactly one <h1>"));
  ok(/<html lang="en"/.test(html), where("missing lang"));
  ok(new RegExp(`<html[^>]*\\sdata-base="${base}"`).test(html), where("missing or wrong data-base"));
  ok(/<main id="main"[^>]*data-search-section="[^"]+"/.test(html), where('<main id="main"> without data-search-section'));
  for (const k of ["og:title", "og:description", "og:image", "og:url", "twitter:card", "og:image:alt"]) ok(meta(html, k), where(`missing ${k}`));
  const og = meta(html, "og:image") || "";
  ok(og.startsWith(siteUrl + "/") && resolve(base + og.slice(siteUrl.length)), where(`og:image missing file ${og}`));
  if (!noindex) ok(/max-image-preview:large/.test(html), where("robots meta"));
  ok(/class="search-trigger[^"]*" data-search-open/.test(html), where("header search trigger missing"));

  // Search index wiring
  const idx = (html.match(/<html[^>]*\sdata-search-index="([^"]*)"/) || [])[1];
  if (idx !== undefined) ok(idx && !idx.includes("__") && resolve(idx), where(`data-search-index does not resolve: ${idx}`));

  // Structured data
  const ld = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];
  ok(ld.length === 1, where(`expected one JSON-LD block, found ${ld.length}`));
  for (const [, json] of ld) {
    let data = null;
    try { data = JSON.parse(json); } catch (e) { ok(false, where(`JSON-LD parse: ${e.message}`)); continue; }
    const types = data["@graph"].map((n) => n["@type"]).flat();
    ok(types.includes("Organization") && types.includes("WebSite"), where("JSON-LD missing Organization/WebSite"));
    ok(JSON.stringify(data).includes("SearchAction"), where("WebSite without SearchAction"));
    ok(!JSON.stringify(data).includes("aggregateRating"), where("self-published aggregateRating"));
    if (r === "/") ok(types.includes("SoftwareApplication") && types.includes("SoftwareSourceCode"), where("home missing SoftwareApplication/SoftwareSourceCode"));
    if (r !== "/faq/") ok(!types.includes("FAQPage"), where("FAQPage markup outside /faq/"));
    else ok(types.includes("FAQPage"), where("FAQ page without FAQPage"));
    // Docs hubs (/docs/, /docs/adr/) are CollectionPage; every other docs page is an article.
    if (r.startsWith("/docs/") && !types.includes("CollectionPage")) ok(types.includes("TechArticle"), where("docs page without TechArticle"));
    if (/aria-label="Breadcrumb"/.test(html)) ok(types.includes("BreadcrumbList"), where("breadcrumbs without BreadcrumbList"));
    for (const n of data["@graph"]) for (const k of ["url", "@id", "item"]) if (typeof n[k] === "string" && n[k].startsWith("http")) ok(n[k].startsWith(siteUrl), where(`JSON-LD ${k} off-site: ${n[k]}`));
  }

  // CSP: every inline script must match a hash; no inline styles; GA4 is the only third party
  const csp = (html.match(/http-equiv="Content-Security-Policy" content="([^"]+)"/) || [])[1] || "";
  ok(csp.includes("default-src 'self'") && !/unsafe-inline|unsafe-eval/.test(csp), where("CSP missing or too loose"));
  const cspRest = csp.replace(/upgrade-insecure-requests/, "").replace(GA_HOSTS, "");
  ok(!/https?:\/\//.test(cspRest), where(`CSP allows a third-party origin other than GA4: ${(cspRest.match(/https?:\/\/[^\s;]+/) || [])[0]}`));
  for (const [, body] of html.matchAll(/<script>([\s\S]*?)<\/script>/g)) {
    const h = "sha256-" + createHash("sha256").update(body).digest("base64");
    ok(csp.includes(`'${h}'`), where("inline script hash not in CSP"));
  }
  ok(!/<script(?![^>]*\ssrc=)(?![^>]*type="application\/ld\+json")[^>]*\s(?:type|nonce)=/.test(html), where("unexpected inline script type"));
  ok(!/\son[a-z]+="/i.test(html), where("inline event handler attribute"));
  ok(!/\sstyle="/.test(html), where("inline style attribute (blocked by CSP)"));
  ok(!/<style[\s>]/.test(html), where("inline <style> (blocked by CSP)"));
  // Analytics: exactly one GA4 loader (the shared analytics.js), and the CSP lets gtag.js run.
  ok((html.match(/data-ga4="G-[A-Z0-9]+"/g) || []).length === (site.ga4 ? 1 : 0), where("expected exactly one GA4 loader"));
  ok(!/gtag\(['"]config/.test(html), where("inline gtag config (use analytics.js)"));
  if (site.ga4) ok(csp.includes("https://*.googletagmanager.com") && csp.includes("https://analytics.google.com"), where("CSP does not allow GA4"));

  // Mixed content and third-party resources (outbound <a href> links are fine)
  for (const [tag] of html.matchAll(/<(?:script|img|link|source|iframe|video|audio|embed|object)\s[^>]*>/g)) {
    const isCanonicalish = /<link[^>]*rel="(?:canonical|alternate)"/.test(tag);
    for (const u of [attr(tag, "src"), attr(tag, "href")].filter(Boolean)) {
      if (isCanonicalish) continue;
      ok(!/^http:/.test(u), where(`mixed content: ${u}`));
      ok(!isExternal(u) || u.startsWith("data:"), where(`third-party resource: ${tag.slice(0, 90)}`));
    }
  }
  for (const [, set] of html.matchAll(/\ssrcset="([^"]+)"/g)) for (const part of set.split(",")) {
    const u = part.trim().split(/\s+/)[0];
    ok(!isExternal(u) && resolve(u), where(`broken or external srcset ${u}`));
  }

  // Internal links and assets (base-aware). Relative URLs are not allowed: nginx serves
  // 404.html for any path, so every URL on every page must be absolute.
  for (const [, url] of html.matchAll(/\s(?:href|src|action|data-full|data-search-index)="([^"]*)"/g)) {
    if (!url || url.startsWith("#") || isExternal(url)) continue;
    ok(url.startsWith("/"), where(`relative URL ${url}`));
    if (!url.startsWith("/")) continue;
    if (base) ok(url === base || url.startsWith(base + "/"), where(`internal URL without base path: ${url}`));
    ok(resolve(url), where(`broken internal reference ${url}`));
  }
  for (const [, id] of html.matchAll(/\shref="#([^"]+)"/g)) ok(html.includes(`id="${decodeURIComponent(id)}"`) || html.includes(`id="${id}"`), where(`missing anchor #${id}`));
  for (const [, path, id] of html.matchAll(/\shref="(\/[^"#]*)#([^"]+)"/g)) {
    if (!resolve(path)) continue; // reported above
    const target = fileFor(path);
    const t = existsSync(target) ? read(target) : "";
    ok(t.includes(`id="${id}"`) || t.includes(`id="${decodeURIComponent(id)}"`), where(`missing anchor ${path}#${id}`));
  }
  for (const [tag] of html.matchAll(/<a\s[^>]*href="https?:[^"]*"[^>]*>/g)) ok(/rel="[^"]*noopener/.test(tag), where(`external link without rel=noopener: ${tag.slice(0, 90)}`));

  // Images
  for (const [tag] of html.matchAll(/<img\s[^>]*>/g)) {
    ok(attr(tag, "alt") !== undefined, where(`img without alt: ${tag.slice(0, 80)}`));
    ok(attr(tag, "width") && attr(tag, "height"), where(`img without dimensions: ${tag.slice(0, 80)}`));
  }
  for (const [tag] of html.matchAll(/<svg\s[^>]*>/g)) ok(attr(tag, "width") && attr(tag, "height"), where(`svg without intrinsic size: ${tag.slice(0, 80)}`));
}

/* ---------- Site files ---------- */
const sitemap = read(join(dist, "sitemap.xml"));
const locs = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
for (const loc of locs) ok(loc.startsWith(siteUrl + "/") && resolve(base + (loc.slice(siteUrl.length) || "/")), `sitemap: unresolved ${loc}`);
for (const [, loc] of sitemap.matchAll(/<image:loc>([^<]+)<\/image:loc>/g)) ok(resolve(base + loc.slice(siteUrl.length)), `sitemap: missing image ${loc}`);
ok(locs.some((l) => l.includes("/docs/")), "sitemap: no docs pages");
ok(!locs.some((l) => /404|\/search\//.test(l)), "sitemap: lists 404 or search");
for (const [, lm] of sitemap.matchAll(/<lastmod>([^<]+)<\/lastmod>/g)) ok(/^\d{4}-\d{2}-\d{2}/.test(lm), `sitemap: bad lastmod ${lm}`);
const robots = read(join(dist, "robots.txt"));
if (process.env.STAGING === "1") ok(/^Disallow: \/$/m.test(robots), "robots.txt: staging build must disallow everything");
else {
  ok(robots.includes(`Sitemap: ${siteUrl}/sitemap.xml`), "robots.txt: no sitemap");
  ok(!/Disallow: \/(\s|$)/.test(robots), "robots.txt: a group disallows everything");
}
for (const f of ["llms.txt", "llms-full.txt", ".well-known/security.txt", "humans.txt", "404.html", "favicon.ico", "favicon.svg", "apple-touch-icon.png"]) ok(existsSync(join(dist, f)), `${f} missing`);
if (site.indexNowKey) ok(existsSync(join(dist, `${site.indexNowKey}.txt`)), "IndexNow key file missing");
const llms = existsSync(join(dist, "llms.txt")) ? read(join(dist, "llms.txt")) : "";
ok(llms.includes(`${siteUrl}/docs/`), "llms.txt does not list docs");
ok(existsSync(join(dist, "llms-full.txt")) && statSync(join(dist, "llms-full.txt")).size > 2000, "llms-full.txt is empty");
try {
  const mf = JSON.parse(read(join(dist, "site.webmanifest")));
  for (const i of mf.icons) ok(resolve(i.src), `manifest icon missing ${i.src}`);
  ok(mf.start_url === (base || "") + "/", `manifest start_url ${mf.start_url}`);
} catch (e) { ok(false, `site.webmanifest: ${e.message}`); }

// 404 page: noindex; its URLs are absolute like every page's (checked above), which
// matters here because nginx serves it at any depth.
const nf = read(join(dist, "404.html"));
ok(/noindex/.test(nf), "404.html must be noindex");

// Search index
const idxFiles = files.filter((f) => /\/assets\/search\/index\.[0-9a-f]+\.json$/.test(f));
ok(idxFiles.length === 1, `expected one search index, found ${idxFiles.length}`);
for (const f of idxFiles) {
  const size = statSync(f).size;
  ok(size < 1.5 * 1024 * 1024, `search index is ${(size / 1048576).toFixed(2)} MB (limit 1.5 MB)`);
  try { JSON.parse(read(f)); } catch (e) { ok(false, `search index JSON: ${e.message}`); }
}

/* ---------- Hooks from the docs and search modules ---------- */
for (const hook of ["src/docs/check.mjs", "src/search/check.mjs"]) {
  const p = join(root, hook);
  if (!existsSync(p)) continue;
  const mod = await import(pathToFileURL(p).href);
  const fn = mod.default || mod.check;
  if (typeof fn === "function") await fn({ dist, base, url: siteUrl, files, htmlFiles, read, resolve, ok });
}

if (errors.length) {
  console.error(errors.map((e) => "✗ " + e).join("\n"));
  console.error(`\n${errors.length} of ${checks} checks failed (base "${base || "/"}")`);
  process.exit(1);
}
console.log(`✓ ${checks} checks passed across ${htmlFiles.length} pages (base "${base || "/"}", ${siteUrl})`);
