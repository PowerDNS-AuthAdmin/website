#!/usr/bin/env node
// Builds the static site into dist/. Zero dependencies: Node 20+ only.
//   node scripts/build.mjs                                            # production (https://powerdns-authadmin.org)
//   SITE_URL=http://127.0.0.1:8080/preview node scripts/build.mjs    # a subpath build (CI checks this too)
//   DIST=/tmp/out node scripts/build.mjs                              # build somewhere other than dist/
import { createHash } from "node:crypto";
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { site, href, abs } from "../src/site.mjs";
import * as pagesMod from "../src/pages/index.mjs";
import { render, shotSet, hasShot, ogKey, SEARCH_INDEX_TOKEN } from "../src/layout.mjs";
import { faqs, highlights } from "../src/content.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = join(root, "src");
const dist = resolve(root, process.env.DIST || "dist"); // DIST=/some/dir overrides the output directory
const write = (rel, data) => {
  const file = join(dist, rel);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, data);
};
const hash = (s) => createHash("sha256").update(s).digest("hex").slice(0, 10);
const optional = async (rel) => {
  const file = join(root, rel);
  return existsSync(file) ? import(pathToFileURL(file).href) : null;
};

/* 1. Clean and copy static files */
rmSync(dist, { recursive: true, force: true });
mkdirSync(dist, { recursive: true });
if (existsSync(join(src, "static"))) cpSync(join(src, "static"), dist, { recursive: true });

/* 2. CSS: every src/styles/*.css in filename order, minified (comments and whitespace only:
      safe for calc(), selectors and strings in these stylesheets) */
const css = readdirSync(join(src, "styles"))
  .filter((f) => f.endsWith(".css"))
  .sort()
  .map((f) => readFileSync(join(src, "styles", f), "utf8"))
  .join("\n")
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .replace(/\s+/g, " ")
  .replace(/\s*([{};,])\s*/g, "$1")
  .replace(/;}/g, "}")
  .trim();
const cssPath = `/assets/css/site.${hash(css)}.css`;
write(cssPath, css);

/* 3. JS: each src/js/*.js fingerprinted separately (main, search, docs, analytics) */
const js = {};
for (const f of readdirSync(join(src, "js")).filter((f) => f.endsWith(".js")).sort()) {
  const code = readFileSync(join(src, "js", f), "utf8");
  const name = f.replace(/\.js$/, "");
  const p = `/assets/js/${name}.${hash(code)}.js`;
  write(p, code);
  js[name] = href(p);
}
const assets = { css: href(cssPath), js };

/* 4. Pages */
const corePages = pagesMod.corePages || pagesMod.pages || [];
const searchPage = pagesMod.searchPage || null;
const docsMod = await optional("src/docs/index.mjs");
const docPages = (docsMod && (docsMod.docPages || docsMod.default)) || [];
const pages = [...corePages, ...docPages, ...(searchPage ? [searchPage] : [])];
const seen = new Map();
for (const p of pages) {
  if (seen.has(p.path)) throw new Error(`duplicate page path ${p.path} (${seen.get(p.path)} and ${p.slug})`);
  seen.set(p.path, p.slug);
}
// page.file is an output file only when it is an .html path (404.html); docs pages use
// `file` for their markdown source name.
const outFile = (p) => (p.file && /\.html$/.test(p.file) ? p.file : join(p.path, "index.html"));

/* 5. Render (with a placeholder for the search index URL) */
const rendered = pages.map((page) => ({ page, html: render(page, assets) }));

/* 6. Search index */
const searchMod = await optional("src/search/build-index.mjs");
let searchUrl = "";
let searchStats = null;
if (searchMod && typeof searchMod.buildSearchIndex === "function") {
  const { json, stats } = await searchMod.buildSearchIndex(rendered.map((r) => ({ page: r.page, html: r.html })));
  const body = typeof json === "string" ? json : JSON.stringify(json);
  const p = `/assets/search/index.${hash(body)}.json`;
  write(p, body);
  searchUrl = href(p);
  searchStats = stats || null;
}
for (const r of rendered) {
  r.html = searchUrl
    ? r.html.split(SEARCH_INDEX_TOKEN).join(searchUrl)
    : r.html.replace(` data-search-index="${SEARCH_INDEX_TOKEN}"`, "");
  write(outFile(r.page), r.html);
}

/* 7a. sitemap.xml with lastmod and image entries */
const indexed = pages.filter((p) => p.sitemap !== false && !p.noindex);
const ogFor = (p) => {
  const k = ogKey(p);
  for (const c of [k, p.layout === "docs" ? "docs" : null, "home"]) if (c && existsSync(join(dist, "assets", "og", `${c}.jpg`))) return abs(`/assets/og/${c}.jpg`);
  return null;
};
const xmlEsc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${indexed
  .map((p) => {
    const imgs = [ogFor(p), ...(p.images || []).filter(hasShot).map((n) => shotSet("dark", n).fullAbs)].filter(Boolean);
    return `  <url>
    <loc>${xmlEsc(abs(p.path))}</loc>
    <lastmod>${p.modified || site.released}</lastmod>
    <changefreq>${p.changefreq || "monthly"}</changefreq>
    <priority>${Number(p.priority || 0.5).toFixed(1)}</priority>
${imgs.map((i) => `    <image:image><image:loc>${xmlEsc(i)}</image:loc></image:image>`).join("\n")}
  </url>`;
  })
  .join("\n")}
</urlset>
`;
write("sitemap.xml", sitemap);

/* 7b. robots.txt: everything is public; AI crawlers welcome (AEO). They are named
   explicitly so the intent is unambiguous; a named group replaces `*` for that bot,
   so every group carries the same rules. A staging build disallows everything. */
const aiBots = ["GPTBot", "OAI-SearchBot", "ChatGPT-User", "ClaudeBot", "Claude-User", "Claude-SearchBot", "PerplexityBot", "Perplexity-User", "Google-Extended", "Applebot", "Applebot-Extended"];
const disallow = `Disallow: ${href("/404.html")}`;
write(
  "robots.txt",
  site.staging
    ? `# Staging preview: not for indexing.\nUser-agent: *\nDisallow: /\n`
    : `User-agent: *
Allow: ${href("/")}
${disallow}

${aiBots.map((b) => `User-agent: ${b}`).join("\n")}
Allow: ${href("/")}
${disallow}

Sitemap: ${abs("/sitemap.xml")}
`,
);

/* 7c. llms.txt and llms-full.txt: concise, link-rich summaries for answer engines */
const strip = (s) =>
  String(s)
    .replace(/<[^>]+>/g, "")
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
const docs = docPages.filter((p) => p.path !== "/docs/" && !p.noindex);
const docLine = (p) => {
  const name = p.h1 || p.title;
  // Some descriptions lead with the page title ("Hardening: TLS, ..."); don't repeat it.
  const desc = p.description.startsWith(`${name}: `) ? p.description.slice(name.length + 2) : p.description;
  return `- [${name}](${abs(p.path)}): ${desc}`;
};
const docsBySection = docs.reduce((m, p) => {
  const s = p.section || "Docs";
  (m[s] = m[s] || []).push(p);
  return m;
}, {});
const docsSection = docs.length
  ? Object.entries(docsBySection)
      .map(([s, list]) => `### ${s}\n\n${list.map(docLine).join("\n")}`)
      .join("\n\n")
  : `- [Documentation](${abs("/docs/")})`;
write(
  "llms.txt",
  `# ${site.name}

> ${site.name} is a free, open-source (${site.license}), self-hosted web UI for PowerDNS Authoritative. It adds scoped role-based access control, OIDC / SAML 2.0 / LDAP single sign-on with group-to-role mapping, passkeys and TOTP MFA, a diff-before-apply record editor, automatic PTR maintenance with a fleet-wide Reverse DNS report, Zone Monitoring (delegation, nameservers, open AXFR and the DNSSEC chain checked from the outside), global search, DNSSEC / TSIG / autoprimary management, multi-backend support (standalone, primary + secondaries, multi-primary clusters), an append-only audit log and a built-in Model Context Protocol (MCP) server so Claude Code, Codex, Cursor and other AI assistants can manage zones and records in natural language. It ships as one Docker image (${site.image}) on SQLite or PostgreSQL.

- Latest version: ${site.version} (released ${site.released})
- PowerDNS Authoritative versions tested in CI: 4.6, 4.7, 4.8, 4.9, 5.0, 5.1
- Catalog zones (RFC 9432, PowerDNS 4.7+) are listed apart as system zones, with guarded deletion and sync that only counts secondaries consuming the catalog
- Runtime: Node.js 24, Next.js, TypeScript
- MCP server at /api/mcp (Streamable HTTP, personal access token as Bearer): list_backends, list_zones, find_zones, get_zone, list_records, records_at, set_records, add_record, delete_records, create_zone, delete_zone, zone_sync_status, reverse_dns_report, reverse_dns_links, reverse_dns_rectify, zone_monitoring, zone_monitoring_refresh, search, list_notifications, dismiss_notifications
- Opt-in features (off by default): REVERSE_DNS_ENABLED=true for the Reverse DNS report, ZONE_MONITOR_ENABLED=true for Zone Monitoring; automatic PTR maintenance on save via the auto_ptr setting
- No telemetry, no CDN; works air-gapped (Zone Monitoring and external PTR lookups, both opt-in, are the only features that send DNS queries out)
- Independent community project, not affiliated with PowerDNS or Open-Xchange

## Site

- [Home](${abs("/")}): overview, Reverse DNS and Zone Monitoring, screenshots, the MCP server ("talk to your DNS") and the Docker Compose quickstart
- [Features](${abs("/features/")}): full feature catalog
- [PowerDNS-Admin alternative](${abs("/powerdns-admin-alternative/")}): how it compares and how to switch
- [FAQ](${abs("/faq/")}): installation, versions, SSO, RBAC, clusters, PTR sync, zone monitoring, search, MCP and AI assistants, API, security
- [Commercial support](${abs("/support/")}): 24 hour commercial support from ${site.support.legalName} (${site.support.name}, ${site.support.url})
- [Documentation](${abs("/docs/")}): every guide, synced from the ${site.name} repository at v${site.version}
- [Full documentation as one text file](${abs("/llms-full.txt")})

## Project

- [Source code](${site.repo})
- [Releases](${site.releases}) and [changelog](${site.changelog})
- [Container image](${site.package})
- [Live demo](${site.demo})
- [Security policy](${site.security})

## Documentation

${docsSection}

## Highlights

${highlights.map((h) => `- ${h.title}: ${strip(h.text)}`).join("\n")}

## FAQ

${faqs.map((f) => `### ${strip(f.q)}\n\n${strip(f.a)}`).join("\n\n")}
`,
);
const docText = (p) => {
  if (p.doc && p.doc.markdown) return p.doc.markdown.trim();
  const r = rendered.find((x) => x.page === p);
  const main = r ? (r.html.match(/<main[^>]*>([\s\S]*?)<\/main>/) || [])[1] || "" : "";
  return strip(main.replace(/<(script|style)[\s\S]*?<\/\1>/g, "")).replace(/\n{3,}/g, "\n\n").trim();
};
write(
  "llms-full.txt",
  `# ${site.name} documentation (full text)

> ${site.description}

Version ${site.version}. Source: ${site.repo}. Each section below is one page of the documentation at ${abs("/docs/")}.

${docs.map((p) => `---\n\n<!-- ${abs(p.path)} -->\n\n${docText(p)}\n`).join("\n")}`,
);

/* 7d. Web app manifest */
write(
  "site.webmanifest",
  JSON.stringify(
    {
      name: site.name,
      short_name: "AuthAdmin",
      description: site.description,
      start_url: href("/"),
      scope: href("/"),
      display: "browser",
      background_color: "#0a0c11",
      theme_color: "#0a0c11",
      icons: [
        { src: href("/assets/icons/icon-192.png"), sizes: "192x192", type: "image/png" },
        { src: href("/assets/icons/icon-512.png"), sizes: "512x512", type: "image/png" },
        { src: href("/assets/icons/icon-maskable-512.png"), sizes: "512x512", type: "image/png", purpose: "maskable" },
      ],
    },
    null,
    2,
  ) + "\n",
);

/* 7e. security.txt (RFC 9116) pointing at GitHub private vulnerability reporting, humans.txt */
const expires = new Date(Date.parse(site.released) + 365 * 864e5).toISOString().replace(/\.\d+Z$/, "Z");
write(
  ".well-known/security.txt",
  `Contact: ${site.advisories}
Expires: ${expires}
Policy: ${site.security}
Preferred-Languages: en
Canonical: ${abs("/.well-known/security.txt")}
`,
);
write(
  "humans.txt",
  `/* TEAM */
Project: ${site.name} contributors
Source: ${site.repo}

/* SITE */
Standards: HTML, CSS, vanilla JavaScript
Components: Inter, JetBrains Mono (SIL OFL 1.1)
Website source: ${site.websiteRepo}
`,
);

/* 7f. IndexNow key file (the key is public by design; it proves domain ownership) */
if (site.indexNowKey) write(`${site.indexNowKey}.txt`, site.indexNowKey);

console.log(
  `built ${pages.length} pages (${corePages.length} core, ${docPages.length} docs${searchPage ? ", search" : ""}) → ${dist}` +
    `\n  base: "${site.base || "/"}"  url: ${site.url}` +
    `\n  css: ${assets.css}\n  js: ${Object.values(js).join(", ")}` +
    (searchUrl ? `\n  search: ${searchUrl}${searchStats ? " " + JSON.stringify(searchStats) : ""}` : "\n  search: (no indexer yet)"),
);
