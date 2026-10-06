#!/usr/bin/env node
// Static checks on dist/: SEO metadata, structured data, internal links and assets,
// image attributes and the CSP hash of the inline script. Exits non-zero on failure.
//   node scripts/build.mjs && node scripts/check.mjs
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { site } from "../src/site.mjs";

const dist = join(dirname(fileURLToPath(import.meta.url)), "..", "dist");
const errors = [];
let checks = 0;
const ok = (cond, msg) => { checks++; if (!cond) errors.push(msg); };

const walk = (d) => readdirSync(d).flatMap((f) => (statSync(join(d, f)).isDirectory() ? walk(join(d, f)) : [join(d, f)]));
const files = walk(dist);
const htmlFiles = files.filter((f) => f.endsWith(".html"));

function resolve(url) {
  const path = url.split(/[?#]/)[0];
  if (!path) return true;
  const file = join(dist, decodeURIComponent(path));
  return existsSync(file) && (statSync(file).isFile() || existsSync(join(file, "index.html")));
}
const attr = (tag, name) => (tag.match(new RegExp(`\\s${name}="([^"]*)"`)) || [])[1];
const meta = (html, key) => (html.match(new RegExp(`<meta (?:name|property)="${key}" content="([^"]*)"`)) || [])[1];

const titles = new Set();
const descriptions = new Set();
for (const file of htmlFiles) {
  const rel = "/" + file.slice(dist.length + 1).replace(/index\.html$/, "");
  const html = readFileSync(file, "utf8");
  const where = (m) => `${rel}: ${m}`;
  const noindex = /<meta name="robots" content="noindex/.test(html);

  // Head metadata
  const title = (html.match(/<title>([^<]*)<\/title>/) || [])[1] || "";
  ok(title.length >= 20 && title.length <= 70, where(`title length ${title.length}: ${title}`));
  ok(!titles.has(title), where(`duplicate title`)); titles.add(title);
  const desc = meta(html, "description") || "";
  ok(desc.length >= 70 && desc.length <= 160, where(`description length ${desc.length}`));
  ok(!descriptions.has(desc), where(`duplicate description`)); descriptions.add(desc);
  const canonical = (html.match(/<link rel="canonical" href="([^"]+)"/) || [])[1];
  ok(canonical === site.url + (rel === "/404.html" ? "/404.html" : rel), where(`canonical ${canonical}`));
  ok((html.match(/<h1[\s>]/g) || []).length === 1, where("must have exactly one <h1>"));
  ok(/<html lang="en"/.test(html), where("missing lang"));
  for (const k of ["og:title", "og:description", "og:image", "og:url", "twitter:card", "og:image:alt"]) ok(meta(html, k), where(`missing ${k}`));
  const og = meta(html, "og:image") || "";
  ok(og.startsWith(site.url) && resolve(og.slice(site.url.length)), where(`og:image missing file ${og}`));
  if (!noindex) ok(/max-image-preview:large/.test(html), where("robots meta"));

  // Structured data
  const ld = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];
  ok(ld.length === 1, where(`expected one JSON-LD block, found ${ld.length}`));
  for (const [, json] of ld) {
    let data = null;
    try { data = JSON.parse(json); } catch (e) { ok(false, where(`JSON-LD parse: ${e.message}`)); continue; }
    const types = data["@graph"].map((n) => n["@type"]).flat();
    ok(types.includes("Organization") && types.includes("WebSite"), where("JSON-LD missing Organization/WebSite"));
    ok(!JSON.stringify(data).includes("aggregateRating"), where("self-published aggregateRating"));
    if (rel === "/") ok(types.includes("SoftwareApplication"), where("home missing SoftwareApplication"));
    if (rel !== "/faq/") ok(!types.includes("FAQPage"), where("FAQPage markup outside /faq/"));
  }

  // CSP: the inline boot script must match its hash
  const csp = (html.match(/http-equiv="Content-Security-Policy" content="([^"]+)"/) || [])[1] || "";
  for (const [, body] of html.matchAll(/<script>([\s\S]*?)<\/script>/g)) {
    const h = "sha256-" + createHash("sha256").update(body).digest("base64");
    ok(csp.includes(`'${h}'`), where("inline script hash not in CSP"));
  }
  ok(!/\sstyle="/.test(html), where("inline style attribute (blocked by CSP)"));
  ok(!/<style[\s>]/.test(html), where("inline <style> (blocked by CSP)"));

  // Internal links and assets
  for (const [, url] of html.matchAll(/\s(?:href|src)="(\/[^"]*)"/g)) ok(resolve(url), where(`broken internal reference ${url}`));
  for (const [, set] of html.matchAll(/\ssrcset="([^"]+)"/g)) for (const part of set.split(",")) ok(resolve(part.trim().split(" ")[0]), where(`broken srcset ${part}`));
  for (const [, id] of html.matchAll(/\shref="#([^"]+)"/g)) ok(html.includes(`id="${id}"`), where(`missing anchor #${id}`));
  for (const [, path, id] of html.matchAll(/\shref="(\/[^"#]*)#([^"]+)"/g)) {
    const target = join(dist, path, path.endsWith("/") ? "index.html" : "");
    ok(existsSync(target) && readFileSync(target, "utf8").includes(`id="${id}"`), where(`missing anchor ${path}#${id}`));
  }
  for (const [tag] of html.matchAll(/<a\s[^>]*href="https?:[^"]*"[^>]*>/g)) ok(/rel="[^"]*noopener/.test(tag), where(`external link without rel=noopener: ${tag.slice(0, 80)}`));

  // Images
  for (const [tag] of html.matchAll(/<img\s[^>]*>/g)) {
    ok(attr(tag, "alt") !== undefined, where(`img without alt: ${tag.slice(0, 80)}`));
    ok(attr(tag, "width") && attr(tag, "height"), where(`img without dimensions: ${tag.slice(0, 80)}`));
  }
  for (const [tag] of html.matchAll(/<svg\s[^>]*>/g)) ok(attr(tag, "width") && attr(tag, "height"), where(`svg without intrinsic size`));
}

// Sitemap and robots
const sitemap = readFileSync(join(dist, "sitemap.xml"), "utf8");
for (const [, loc] of sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)) ok(loc.startsWith(site.url) && resolve(loc.slice(site.url.length) || "/"), `sitemap: unresolved ${loc}`);
for (const [, loc] of sitemap.matchAll(/<image:loc>([^<]+)<\/image:loc>/g)) ok(resolve(loc.slice(site.url.length)), `sitemap: missing image ${loc}`);
const robots = readFileSync(join(dist, "robots.txt"), "utf8");
ok(robots.includes(`Sitemap: ${site.url}/sitemap.xml`), "robots.txt: no sitemap");
ok(!/Disallow: \/(\s|$)/.test(robots), "robots.txt: a group disallows everything");
ok(existsSync(join(dist, "llms.txt")), "llms.txt missing");
ok(existsSync(join(dist, ".well-known", "security.txt")), "security.txt missing");
JSON.parse(readFileSync(join(dist, "site.webmanifest"), "utf8"));

if (errors.length) {
  console.error(errors.map((e) => "✗ " + e).join("\n"));
  console.error(`\n${errors.length} of ${checks} checks failed`);
  process.exit(1);
}
console.log(`✓ ${checks} checks passed across ${htmlFiles.length} pages`);
