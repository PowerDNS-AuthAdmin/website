import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { site } from "./site.mjs";
import { icon, githubMark } from "./icons.mjs";

const shotsMeta = JSON.parse(readFileSync(new URL("./shots.json", import.meta.url), "utf8"));

export const esc = (s) =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export const ext = (href, label, cls = "") =>
  `<a${cls ? ` class="${cls}"` : ""} href="${href}" rel="noopener">${label}</a>`;

const sha256 = (s) => "sha256-" + createHash("sha256").update(s, "utf8").digest("base64");

/* ---------- Screenshots ---------- */
const shotSrc = (theme, name, w) => `/assets/img/shots/${theme}/${name}-${w}.webp`;

export function shotSet(theme, name) {
  const m = shotsMeta[name];
  if (!m) throw new Error(`missing screenshot: ${name}`);
  return {
    src: shotSrc(theme, name, m.widths.includes(960) ? 960 : m.widths[0]),
    srcset: m.widths.map((w) => `${shotSrc(theme, name, w)} ${w}w`).join(", "),
    full: shotSrc(theme, name, m.width),
    width: m.width,
    height: m.height,
  };
}

// Both theme variants are emitted; CSS shows the one matching <html data-theme>.
// Lazy images that are display:none are never fetched, so only one variant downloads.
export function shot(name, alt, { sizes = "(min-width: 1180px) 1100px, 94vw", cls = "", priority = false } = {}) {
  return ["dark", "light"]
    .map((theme) => {
      const s = shotSet(theme, name);
      return `<img class="shot shot-${theme}${cls ? " " + cls : ""}" src="${s.src}" srcset="${s.srcset}" sizes="${sizes}" width="${s.width}" height="${s.height}" alt="${esc(alt)}" loading="lazy" decoding="async"${priority ? ' fetchpriority="high"' : ""} data-full="${s.full}">`;
    })
    .join("");
}

/* ---------- Structured data ---------- */
export const ids = {
  org: `${site.url}/#organization`,
  website: `${site.url}/#website`,
  app: `${site.url}/#software`,
  code: `${site.url}/#source`,
};

export function baseGraph() {
  return [
    {
      "@type": "Organization",
      "@id": ids.org,
      name: site.name,
      url: `${site.url}/`,
      logo: { "@type": "ImageObject", url: `${site.url}/assets/icons/icon-512.png`, width: 512, height: 512 },
      sameAs: [site.org, site.repo],
    },
    {
      "@type": "WebSite",
      "@id": ids.website,
      url: `${site.url}/`,
      name: site.name,
      description: site.description,
      inLanguage: site.lang,
      publisher: { "@id": ids.org },
    },
  ];
}

export function softwareNode() {
  return {
    "@type": "SoftwareApplication",
    "@id": ids.app,
    name: site.name,
    alternateName: ["PowerDNS AuthAdmin", "PDNS AuthAdmin"],
    description: site.description,
    url: `${site.url}/`,
    applicationCategory: "DeveloperApplication",
    applicationSubCategory: "DNS management",
    operatingSystem: "Linux, macOS, Windows (Docker)",
    softwareVersion: site.version,
    datePublished: site.released,
    license: "https://opensource.org/license/mit",
    isAccessibleForFree: true,
    offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
    downloadUrl: site.package,
    installUrl: site.docs.install,
    releaseNotes: site.changelog,
    softwareHelp: { "@type": "CreativeWork", url: site.docs.index },
    screenshot: `${site.url}/assets/img/shots/dark/dashboard-1440.webp`,
    image: `${site.url}/assets/og/home.jpg`,
    featureList: [
      "Role-based access control with ~60 permissions and global, team, zone or server scope",
      "OIDC, SAML 2.0 and LDAP / Active Directory single sign-on with group to role mapping",
      "Passkeys, security keys and TOTP multi-factor authentication",
      "Diff-before-apply RRset editor with per-type validation",
      "Multi-backend: standalone, primary + secondaries and multi-primary clusters",
      "DNSSEC, TSIG keys, autoprimaries, zone metadata and zone templates",
      "Append-only audit log with redacted before / after snapshots",
      "Scoped API tokens, Prometheus metrics, health and readiness probes",
      "First-boot YAML provisioning",
    ],
    author: { "@id": ids.org },
    publisher: { "@id": ids.org },
    sameAs: [site.repo],
  };
}

export function sourceNode() {
  return {
    "@type": "SoftwareSourceCode",
    "@id": ids.code,
    name: `${site.name} source code`,
    codeRepository: site.repo,
    programmingLanguage: ["TypeScript", "Node.js"],
    runtimePlatform: "Node.js 24",
    license: "https://opensource.org/license/mit",
    targetProduct: { "@id": ids.app },
    author: { "@id": ids.org },
  };
}

export function faqQuestions(faqs) {
  return faqs.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a.replace(/<[^>]+>/g, "") },
    }));
}

/* ---------- Partials ---------- */
// The project's own wordmark (media/brand), one variant per theme. 2086×351 source.
const LOGO_W = [240, 360, 480, 720];
function logo(h) {
  const w = Math.round((h * 2086) / 351);
  return ["dark", "light"]
    .map((t) => `<img class="logo logo-${t}" src="/assets/img/brand/logo-${t}-360.png" srcset="${LOGO_W.map((x) => `/assets/img/brand/logo-${t}-${x}.webp ${x}w`).join(", ")}" sizes="${w}px" width="${w}" height="${h}" alt="${site.name}">`)
    .join("");
}

function header(page) {
  const navLinks = site.nav
    .map((n) => {
      const current = n.href === page.path;
      return `<a href="${n.href}"${current ? ' aria-current="page"' : ""}>${n.label}</a>`;
    })
    .join("");
  return `<header class="site-header">
  <div class="container header-inner">
    <a class="brand" href="/" aria-label="${site.name} home">${logo(32)}</a>
    <nav class="nav" aria-label="Primary">${navLinks}</nav>
    <div class="header-actions">
      <button class="icon-btn theme-toggle" id="themeToggle" type="button" aria-label="Switch to light theme" title="Toggle theme">${icon("sun", 18, "i-sun")}${icon("moon", 18, "i-moon")}</button>
      <a class="btn btn-ghost btn-sm hide-sm" href="${site.repo}" data-cta="GitHub" rel="noopener">${githubMark(16)}<span>GitHub</span></a>
      <a class="btn btn-primary btn-sm hide-xs" href="${site.demo}" data-cta="Live demo" rel="noopener">Live demo</a>
      <button class="icon-btn menu-toggle" id="menuToggle" type="button" aria-label="Open menu" aria-expanded="false" aria-controls="mobileNav">${icon("menu", 20, "i-menu")}${icon("close", 20, "i-close")}</button>
    </div>
  </div>
  <div class="mobile-nav" id="mobileNav" hidden>
    <nav class="container" aria-label="Mobile">
      ${site.nav.map((n) => `<a href="${n.href}"${n.href === page.path ? ' aria-current="page"' : ""}>${n.label}${icon("chevronRight", 18)}</a>`).join("")}
      <div class="mobile-cta" data-cta-location="nav">
        <a class="btn btn-primary btn-lg" href="${site.demo}" data-cta="Live demo" rel="noopener">Try the live demo</a>
        <a class="btn btn-ghost btn-lg" href="${site.repo}" data-cta="GitHub" rel="noopener">${githubMark(18)}<span>View on GitHub</span></a>
      </div>
    </nav>
  </div>
</header>`;
}

function breadcrumbs(page) {
  if (!page.breadcrumbs) return "";
  const items = [{ name: "Home", path: "/" }, ...page.breadcrumbs];
  return `<nav class="crumbs container" aria-label="Breadcrumb"><ol>${items
    .map((c, i) =>
      i === items.length - 1
        ? `<li><span aria-current="page">${esc(c.name)}</span></li>`
        : `<li><a href="${c.path}">${esc(c.name)}</a>${icon("chevronRight", 14)}</li>`,
    )
    .join("")}</ol></nav>`;
}

function breadcrumbNode(page) {
  const items = [{ name: "Home", path: "/" }, ...page.breadcrumbs];
  return {
    "@type": "BreadcrumbList",
    "@id": `${site.url}${page.path}#breadcrumb`,
    itemListElement: items.map((c, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: c.name,
      item: `${site.url}${c.path}`,
    })),
  };
}

const releasedLabel = new Date(site.released + "T00:00:00Z").toLocaleDateString("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

function footer() {
  const col = (title, links) =>
    `<div class="footer-col"><h2>${title}</h2><ul>${links.map(([h, l]) => `<li><a href="${h}"${h.startsWith("http") ? ' rel="noopener"' : ""}>${l}</a></li>`).join("")}</ul></div>`;
  return `<footer class="site-footer">
  <div class="container footer-inner">
    <div class="footer-brand">
      <a class="brand" href="/" aria-label="${site.name} home">${logo(30)}</a>
      <p>${site.tagline}. Open source under the MIT licence, built in the open by its community.</p>
      <a class="release-chip" href="${site.latestRelease}" data-cta="Latest release" rel="noopener"><span class="pulse" aria-hidden="true"></span>v${site.version}<span class="muted">· ${releasedLabel}</span></a>
    </div>
    <div class="footer-cols">
      ${col("Product", [["/features/", "Features"], ["/powerdns-admin-alternative/", "Compare"], ["/faq/", "FAQ"], [site.demo, "Live demo"], [site.releases, "Releases"], [site.changelog, "Changelog"]])}
      ${col("Docs", [[site.docs.quickstart, "Quickstart"], [site.docs.install, "Installation"], [site.docs.config, "Configuration"], [site.docs.rbac, "RBAC"], [site.docs.oidc, "OIDC"], [site.docs.ldap, "LDAP"], [site.docs.saml, "SAML"], [site.docs.passkeys, "Passkeys"]])}
      ${col("Community", [[site.repo, "GitHub"], [site.discussions, "Discussions"], [site.issues, "Issues"], [site.contributing, "Contributing"], [site.security, "Security policy"], [site.websiteRepo, "Website source"]])}
    </div>
  </div>
  <div class="container footer-bottom">
    <span>© ${site.released.slice(0, 4)} ${site.name} contributors. MIT licensed.</span>
    <span>Independent community project, not affiliated with or endorsed by PowerDNS or Open-Xchange. PowerDNS is a trademark of its respective owner.</span>
    <span>This website uses Google Analytics to count visits (no ad cookies); <a href="https://tools.google.com/dlpage/gaoptout" rel="noopener">opt out</a>. The app itself has no telemetry.</span>
  </div>
</footer>`;
}

const lightbox = `<dialog class="lightbox" id="lightbox" aria-label="Screenshot preview">
  <div class="lightbox-frame" id="lightboxFrame">
    <span class="lightbox-spinner" aria-hidden="true"></span>
  </div>
  <p class="lightbox-caption" id="lightboxCaption"></p>
  <button class="lightbox-btn lightbox-close" id="lightboxClose" type="button" aria-label="Close preview">${icon("close", 22)}</button>
  <button class="lightbox-btn lightbox-prev" id="lightboxPrev" type="button" aria-label="Previous screenshot">${icon("chevronLeft", 24)}</button>
  <button class="lightbox-btn lightbox-next" id="lightboxNext" type="button" aria-label="Next screenshot">${icon("chevronRight", 24)}</button>
</dialog>`;

/* ---------- Document ---------- */
export function render(page, { cssHref, jsHref, analyticsHref }) {
  const url = `${site.url}${page.path}`;
  const title = page.title;
  const ogImage = `${site.url}/assets/og/${page.ogImage || page.slug}.jpg`;

  // Theme before first paint (no flash), js class for JS-only layout, and an
  // early preload of the LCP screenshot for the theme that will actually show.
  let lcp = "";
  if (page.lcp) {
    const d = shotSet("dark", page.lcp.name);
    const l = shotSet("light", page.lcp.name);
    lcp = `var s=t==="light"?${JSON.stringify(l.srcset)}:${JSON.stringify(d.srcset)},k=document.createElement("link");k.rel="preload";k.as="image";k.imageSrcset=s;k.imageSizes=${JSON.stringify(page.lcp.sizes)};k.fetchPriority="high";document.head.appendChild(k);`;
  }
  const boot = `(function(){var d=document.documentElement,t;d.classList.replace("no-js","js");try{t=localStorage.getItem("pda-theme")}catch(e){}if(t!=="light"&&t!=="dark")t=matchMedia("(prefers-color-scheme: light)").matches?"light":"dark";d.dataset.theme=t;${lcp}})();`;

  const graph = [...baseGraph(), ...(page.schema || [])];
  const webPage = {
    "@type": page.pageType || "WebPage",
    "@id": `${url}#webpage`,
    url,
    name: title,
    description: page.description,
    inLanguage: site.lang,
    isPartOf: { "@id": ids.website },
    primaryImageOfPage: { "@type": "ImageObject", url: ogImage, width: 1200, height: 630 },
    dateModified: page.modified || site.released,
  };
  if (page.about) webPage.about = page.about;
  if (page.breadcrumbs) {
    webPage.breadcrumb = { "@id": `${url}#breadcrumb` };
    graph.push(breadcrumbNode(page));
  }
  if (page.mainEntity) webPage.mainEntity = page.mainEntity;
  if (page.faq) webPage.mainEntity = faqQuestions(page.faq);
  graph.push(webPage);
  const jsonld = JSON.stringify({ "@context": "https://schema.org", "@graph": graph }).replace(/</g, "\\u003c");

  const csp = [
    "default-src 'self'",
    // Google Analytics 4 (gtag.js), loaded by analytics.js; no inline script needed.
    `script-src 'self' '${sha256(boot)}' https://*.googletagmanager.com`,
    "style-src 'self'",
    "img-src 'self' data: https://*.google-analytics.com https://*.googletagmanager.com https://*.g.doubleclick.net https://www.google.com https://www.google.com.au",
    "font-src 'self'",
    "connect-src 'self' https://*.google-analytics.com https://analytics.google.com https://*.analytics.google.com https://*.googletagmanager.com https://*.g.doubleclick.net https://www.google.com https://www.google.com.au",
    "manifest-src 'self'",
    "base-uri 'self'",
    "form-action 'none'",
    "object-src 'none'",
    "frame-src 'none'",
    "upgrade-insecure-requests",
  ].join("; ");

  return `<!DOCTYPE html>
<html lang="${site.lang}" class="no-js" data-theme="dark">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta http-equiv="Content-Security-Policy" content="${csp}">
<title>${esc(title)}</title>
<meta name="description" content="${esc(page.description)}">
<link rel="canonical" href="${url}">
<meta name="robots" content="${page.noindex ? "noindex, follow" : "index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1"}">
<script>${boot}</script>
<link rel="preload" href="/assets/fonts/inter-latin.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="${cssHref}">
<meta name="color-scheme" content="dark light">
<meta name="theme-color" content="#0a0c11" media="(prefers-color-scheme: dark)">
<meta name="theme-color" content="#ffffff" media="(prefers-color-scheme: light)">
<meta name="format-detection" content="telephone=no">
<meta name="application-name" content="${site.name}">
<meta name="apple-mobile-web-app-title" content="AuthAdmin">
<link rel="icon" href="/favicon.ico" sizes="48x48">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="manifest" href="/site.webmanifest">
<link rel="author" href="/humans.txt">
<meta property="og:type" content="website">
<meta property="og:site_name" content="${site.name}">
<meta property="og:locale" content="${site.locale}">
<meta property="og:url" content="${url}">
<meta property="og:title" content="${esc(page.ogTitle || title)}">
<meta property="og:description" content="${esc(page.description)}">
<meta property="og:image" content="${ogImage}">
<meta property="og:image:type" content="image/jpeg">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="${esc(page.ogAlt || `${site.name}: ${site.tagline}`)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(page.ogTitle || title)}">
<meta name="twitter:description" content="${esc(page.description)}">
<meta name="twitter:image" content="${ogImage}">
<script type="application/ld+json">${jsonld}</script>
<script src="${jsHref}" defer></script>
${site.ga4 && analyticsHref ? `<script src="${analyticsHref}" data-ga4="${site.ga4}" defer></script>
` : ""}</head>
<body class="page-${page.slug}">
<a class="skip-link" href="#main">Skip to content</a>
${header(page)}
<main id="main" tabindex="-1">
${breadcrumbs(page)}
${page.body}
</main>
${footer()}
${page.lightbox ? lightbox : ""}
</body>
</html>
`;
}
