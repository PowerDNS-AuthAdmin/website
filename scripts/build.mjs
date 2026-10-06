#!/usr/bin/env node
// Builds the static site into dist/. Zero dependencies: Node 20+ only.
//   node scripts/build.mjs
import { createHash } from "node:crypto";
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { site } from "../src/site.mjs";
import { pages } from "../src/pages/index.mjs";
import { render, shotSet } from "../src/layout.mjs";
import { faqs, highlights } from "../src/content.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dist = join(root, "dist");
const write = (rel, data) => {
  const file = join(dist, rel);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, data);
};
const hash = (s) => createHash("sha256").update(s).digest("hex").slice(0, 10);

rmSync(dist, { recursive: true, force: true });
cpSync(join(root, "src", "static"), dist, { recursive: true });

/* Fingerprinted CSS/JS so they can be cached forever. */
// Comments and whitespace only: safe for calc(), selectors and strings in this stylesheet.
const css = readFileSync(join(root, "src", "styles.css"), "utf8")
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .replace(/\s+/g, " ")
  .replace(/\s*([{};,])\s*/g, "$1")
  .replace(/;}/g, "}")
  .trim();
const js = readFileSync(join(root, "src", "main.js"), "utf8");
// Shared NGN GA4 event script (keep identical to the other sites; see its header comment).
const analytics = readFileSync(join(root, "src", "analytics.js"), "utf8");
const cssHref = `/assets/css/site.${hash(css)}.css`;
const analyticsHref = `/assets/js/analytics.${hash(analytics)}.js`;
const jsHref = `/assets/js/site.${hash(js)}.js`;
write(cssHref, css);
write(jsHref, js);
write(analyticsHref, analytics);

/* Pages */
for (const page of pages) {
  const html = render(page, { cssHref, jsHref, analyticsHref });
  write(page.file || join(page.path, "index.html"), html);
}

/* sitemap.xml with image entries */
const indexed = pages.filter((p) => p.sitemap !== false && !p.noindex);
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${indexed
  .map((p) => {
    const imgs = [`${site.url}/assets/og/${p.ogImage || p.slug}.jpg`, ...(p.images || []).map((n) => site.url + shotSet("dark", n).full)];
    return `  <url>
    <loc>${site.url}${p.path}</loc>
    <lastmod>${p.modified || site.released}</lastmod>
    <changefreq>${p.changefreq || "monthly"}</changefreq>
    <priority>${p.priority || "0.5"}</priority>
${imgs.map((i) => `    <image:image><image:loc>${i}</image:loc></image:image>`).join("\n")}
  </url>`;
  })
  .join("\n")}
</urlset>
`;
write("sitemap.xml", sitemap);

/* robots.txt: everything is public; AI crawlers welcome (AEO). They are named
   explicitly so the intent is unambiguous; a named group replaces `*` for that bot,
   so every group carries the same rules. */
const aiBots = [
  "GPTBot", "OAI-SearchBot", "ChatGPT-User",
  "ClaudeBot", "Claude-User", "Claude-SearchBot",
  "PerplexityBot", "Perplexity-User",
  "Google-Extended", "Applebot", "Applebot-Extended",
];
write(
  "robots.txt",
  `User-agent: *
Allow: /
Disallow: /404.html

${aiBots.map((b) => `User-agent: ${b}`).join("\n")}
Allow: /
Disallow: /404.html

Sitemap: ${site.url}/sitemap.xml
`,
);

/* llms.txt: a concise, link-rich summary for answer engines. */
const strip = (s) => s.replace(/<[^>]+>/g, "");
write(
  "llms.txt",
  `# ${site.name}

> ${site.name} is a free, open-source (${site.license}), self-hosted web UI for PowerDNS Authoritative. It adds scoped role-based access control, OIDC / SAML 2.0 / LDAP single sign-on with group-to-role mapping, passkeys and TOTP MFA, a diff-before-apply record editor, DNSSEC / TSIG / autoprimary management, multi-backend support (standalone, primary + secondaries, multi-primary clusters) and an append-only audit log. It ships as one Docker image (${site.image}) on SQLite or PostgreSQL.

- Latest version: ${site.version} (released ${site.released})
- PowerDNS Authoritative versions tested in CI: 4.6, 4.7, 4.8, 4.9, 5.0
- Runtime: Node.js 24, Next.js, TypeScript
- No telemetry, no CDN; works air-gapped
- Independent community project, not affiliated with PowerDNS or Open-Xchange

## Site

- [Home](${site.url}/): overview, screenshots and Docker Compose quickstart
- [Features](${site.url}/features/): full feature catalog
- [PowerDNS-Admin alternative](${site.url}/powerdns-admin-alternative/): how it compares and how to switch
- [FAQ](${site.url}/faq/): installation, versions, SSO, RBAC, clusters, API, security

## Project

- [Source code](${site.repo})
- [Releases](${site.releases}) and [changelog](${site.changelog})
- [Container image](${site.package})
- [Live demo](${site.demo})
- [Security policy](${site.security})

## Documentation

- [Quickstart](${site.docs.quickstart})
- [Installation](${site.docs.install})
- [Configuration reference](${site.docs.config})
- [PowerDNS backends](${site.docs.backends})
- [OIDC](${site.docs.oidc}), [SAML](${site.docs.saml}), [LDAP](${site.docs.ldap}), [Passkeys](${site.docs.passkeys})
- [RBAC](${site.docs.rbac})
- [Provisioning](${site.docs.provisioning})
- [Hardening](${site.docs.hardening})
- [Upgrading](${site.docs.upgrading})
- [Troubleshooting](${site.docs.troubleshooting})
- [Feature reference](${site.docs.features})

## Highlights

${highlights.map((h) => `- ${h.title}: ${h.text}`).join("\n")}

## FAQ

${faqs.map((f) => `### ${f.q}\n\n${strip(f.a)}`).join("\n\n")}
`,
);

/* PWA manifest */
write(
  "site.webmanifest",
  JSON.stringify(
    {
      name: site.name,
      short_name: "AuthAdmin",
      description: site.description,
      start_url: "/",
      scope: "/",
      display: "browser",
      background_color: "#0a0c11",
      theme_color: "#0a0c11",
      icons: [
        { src: "/assets/icons/icon-192.png", sizes: "192x192", type: "image/png" },
        { src: "/assets/icons/icon-512.png", sizes: "512x512", type: "image/png" },
        { src: "/assets/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      ],
    },
    null,
    2,
  ) + "\n",
);

/* security.txt (RFC 9116) pointing at GitHub private vulnerability reporting */
const expires = new Date(Date.parse(site.released) + 365 * 864e5).toISOString().replace(/\.\d+Z$/, "Z");
write(
  ".well-known/security.txt",
  `Contact: ${site.advisories}
Expires: ${expires}
Policy: ${site.security}
Preferred-Languages: en
Canonical: ${site.url}/.well-known/security.txt
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

/* IndexNow key file (the key is public by design; it proves domain ownership) */
if (site.indexNowKey) write(`${site.indexNowKey}.txt`, site.indexNowKey);

console.log(`built ${pages.length} pages → dist/ (${cssHref}, ${jsHref})`);
