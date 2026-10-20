// Page shell: <head> (SEO, Open Graph, JSON-LD, CSP), header, footer and shared
// partials. render(page, assets) is called by scripts/build.mjs for every page,
// including the docs and search pages owned by other modules.
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { site, href, abs } from "./site.mjs";
import { icon, githubMark, ngnLogo } from "./icons.mjs";
import { esc } from "./code.mjs";

export { esc };
export { href, abs };

export const sha256 = (s) => "sha256-" + createHash("sha256").update(s, "utf8").digest("base64");

// External link. rel=noopener on every off-site link (checked by scripts/check.mjs).
export const ext = (url, label, cls = "") => `<a${cls ? ` class="${cls}"` : ""} href="${url}" rel="noopener">${label}</a>`;

// Placeholder written into <html data-search-index>; build.mjs swaps in the real URL.
export const SEARCH_INDEX_TOKEN = "__PDA_SEARCH_INDEX__";

/* ---------- Screenshots ---------- */
const shotsFile = new URL("./shots.json", import.meta.url);
const shotsMeta = existsSync(shotsFile) ? JSON.parse(readFileSync(shotsFile, "utf8")) : {};
export const hasShot = (name) => Boolean(shotsMeta[name]);

const shotPath = (theme, name, w) => `/assets/img/shots/${theme}/${name}-${w}.webp`;

export function shotSet(theme, name) {
  const m = shotsMeta[name];
  if (!m) throw new Error(`missing screenshot: ${name} (run node scripts/build-media.mjs shots)`);
  const def = m.widths.includes(960) ? 960 : m.widths[m.widths.length > 1 ? 1 : 0];
  return {
    src: href(shotPath(theme, name, def)),
    srcset: m.widths.map((w) => `${href(shotPath(theme, name, w))} ${w}w`).join(", "),
    full: href(shotPath(theme, name, m.width)),
    fullAbs: abs(shotPath(theme, name, m.width)),
    width: m.width,
    height: m.height,
  };
}

// Both theme variants are emitted; CSS shows the one matching <html data-theme>.
// Lazy images that are display:none are never fetched, so only one variant downloads.
// The hero screenshot is fetchpriority="low": where it is above the fold the boot
// script has already preloaded it at high priority and the img reuses that response;
// on phones it sits just below the fold, the hero text is the LCP element, and Chrome
// would otherwise fetch it at high priority next to the stylesheet and Inter.
export function shot(name, alt, { sizes = "(min-width: 1180px) 1100px, 94vw", cls = "", fetchpriority = "", eager = false } = {}) {
  if (!shotsMeta[name]) {
    return `<span class="shot shot-missing" role="img" aria-label="${esc(alt)}"></span>`;
  }
  return ["dark", "light"]
    .map((theme) => {
      const s = shotSet(theme, name);
      return `<img class="shot shot-${theme}${cls ? " " + cls : ""}" src="${s.src}" srcset="${s.srcset}" sizes="${sizes}" width="${s.width}" height="${s.height}" alt="${esc(alt)}" loading="${eager ? "eager" : "lazy"}" decoding="async"${fetchpriority ? ` fetchpriority="${fetchpriority}"` : ""} data-full="${s.full}">`;
    })
    .join("");
}

// A screenshot in a browser frame, wrapped in a zoom button for the lightbox.
export function browserShot(name, alt, { url = "dns.example.com", sizes, cls = "", fetchpriority = "", eager = false, label } = {}) {
  return `<div class="browser${cls ? " " + cls : ""}">
  <div class="browser-bar" aria-hidden="true"><span class="dots"><i></i><i></i><i></i></span><span class="browser-url">${icon("lock", 12)}${esc(url)}</span></div>
  <button class="zoom" type="button" aria-label="${esc(label || "Enlarge: " + alt)}">${shot(name, alt, { sizes, fetchpriority, eager })}<span class="zoom-hint">${icon("zoom", 16)}</span></button>
</div>`;
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
      url: abs("/"),
      logo: { "@type": "ImageObject", url: abs("/assets/icons/icon-512.png"), width: 512, height: 512 },
      sameAs: [site.org, site.repo],
    },
    {
      "@type": "WebSite",
      "@id": ids.website,
      url: abs("/"),
      name: site.name,
      description: site.description,
      inLanguage: site.lang,
      publisher: { "@id": ids.org },
      potentialAction: {
        "@type": "SearchAction",
        target: { "@type": "EntryPoint", urlTemplate: `${abs("/search/")}?q={search_term_string}` },
        "query-input": "required name=search_term_string",
      },
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
    url: abs("/"),
    applicationCategory: "DeveloperApplication",
    applicationSubCategory: "DNS management",
    operatingSystem: "Linux, macOS, Windows (Docker)",
    softwareVersion: site.version,
    datePublished: site.released,
    license: site.licenseUrl,
    isAccessibleForFree: true,
    offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
    downloadUrl: site.package,
    installUrl: abs(site.docs.install),
    releaseNotes: site.changelog,
    softwareHelp: { "@type": "CreativeWork", url: abs("/docs/") },
    screenshot: hasShot("dashboard") ? shotSet("dark", "dashboard").fullAbs : undefined,
    image: abs("/assets/og/home.jpg"),
    featureList: [
      "Built-in MCP server so Claude Code, Codex, Cursor and other AI assistants manage DNS in natural language",
      "Role-based access control with ~60 permissions and global, team, zone or server scope",
      "OIDC, SAML 2.0 and LDAP / Active Directory single sign-on with group to role mapping",
      "Passkeys, security keys and TOTP multi-factor authentication",
      "Diff-before-apply RRset editor with per-type validation",
      "Multi-backend: standalone, primary + secondaries and multi-primary clusters",
      "Zone-level DNSSEC enable, disable and rectify, cryptokeys, TSIG keys, autoprimaries, zone metadata and zone templates",
      "Inline record editing and a keyboard-first records table",
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
    license: site.licenseUrl,
    targetProduct: { "@id": ids.app },
    author: { "@id": ids.org },
  };
}

const stripTags = (s) => String(s).replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
const decode = (s) => s.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");

export function faqQuestions(faqs) {
  return faqs.map((f) => ({
    "@type": "Question",
    name: decode(stripTags(f.q)),
    acceptedAnswer: { "@type": "Answer", text: decode(stripTags(f.a)) },
  }));
}

/* ---------- Partials ---------- */
// The project's own wordmark (media/brand), one variant per theme. 2086×351 source.
// Lazy so the hidden theme's variant is never fetched, and low priority so the 7 KB
// wordmark never competes with the stylesheet, the font or the hero text: it is
// requested right after layout and arrives a moment after the first paint.
const LOGO_W = [240, 360, 480, 720];
function logo(h) {
  const w = Math.round((h * 2086) / 351);
  return ["dark", "light"]
    .map((t) => `<img class="logo logo-${t}" src="${href(`/assets/img/brand/logo-${t}-360.png`)}" srcset="${LOGO_W.map((x) => `${href(`/assets/img/brand/logo-${t}-${x}.webp`)} ${x}w`).join(", ")}" sizes="${w}px" width="${w}" height="${h}" alt="${site.name}" loading="lazy" decoding="async" fetchpriority="low">`)
    .join("");
}

export const brand = (size = 32) => `<a class="brand" href="${href("/")}" aria-label="${site.name} home">${logo(size)}</a>`;

export const searchTrigger = (cls = "") =>
  `<button type="button" class="search-trigger${cls ? " " + cls : ""}" data-search-open aria-label="Search docs and site (Ctrl K)">${icon("search", 16)}<span class="search-trigger-label">Search docs…</span><kbd class="search-kbd" data-search-kbd>Ctrl K</kbd></button>`;

// "Docs" stays highlighted on every /docs/* page; hash links (/#mcp) never match.
const isCurrent = (navHref, page) => {
  if (navHref.includes("#")) return false;
  if (navHref === "/") return page.path === "/";
  return page.path === navHref || page.path.startsWith(navHref);
};

function header(page) {
  const links = site.nav
    .map((n) => `<a href="${href(n.href)}"${isCurrent(n.href, page) ? ' aria-current="page"' : ""}>${n.label}</a>`)
    .join("");
  return `<header class="site-header" data-search-ignore>
  <div class="container header-inner">
    ${brand(32)}
    <nav class="nav" aria-label="Primary">${links}</nav>
    <div class="header-actions">
      ${searchTrigger()}
      <button class="icon-btn theme-toggle" id="themeToggle" type="button" aria-label="Switch to light theme" title="Toggle theme">${icon("sun", 18, "i-sun")}${icon("moon", 18, "i-moon")}</button>
      <a class="icon-btn hide-md" href="${site.repo}" data-cta="GitHub" rel="noopener" aria-label="${site.name} on GitHub" title="${site.name} on GitHub">${githubMark(18)}</a>
      <a class="btn btn-primary btn-sm hide-xs" href="${site.demo}" data-cta="Live demo" rel="noopener">Live demo</a>
      <button class="icon-btn menu-toggle" id="menuToggle" type="button" aria-label="Open menu" aria-expanded="false" ${page.docsNav ? 'aria-controls="docs-sidebar" data-docs-menu' : 'aria-controls="mobileNav"'}>${icon("menu", 20, "i-menu")}${icon("x", 20, "i-close")}</button>
    </div>
  </div>
  ${page.docsNav ? "" : `<div class="mobile-nav" id="mobileNav" hidden>
    <nav class="container" aria-label="Mobile">
      ${site.nav.map((n) => `<a href="${href(n.href)}"${isCurrent(n.href, page) ? ' aria-current="page"' : ""}>${n.label}${icon("chevron-right", 18)}</a>`).join("")}
      <div class="mobile-cta" data-cta-location="nav">
        <a class="btn btn-primary btn-lg" href="${site.demo}" data-cta="Live demo" rel="noopener">Try the live demo</a>
        <a class="btn btn-ghost btn-lg" href="${site.repo}" data-cta="GitHub" rel="noopener">${githubMark(18)}<span>View on GitHub</span></a>
      </div>
    </nav>
  </div>`}
</header>`;
}

function crumbItems(page) {
  const items = [{ name: "Home", path: "/" }, ...(page.breadcrumbs || [])];
  // Drop a duplicate "Home" if the page already starts with it.
  if (items.length > 1 && items[1].path === "/") items.splice(1, 1);
  return items;
}

function breadcrumbs(page) {
  if (!page.breadcrumbs || !page.breadcrumbs.length) return "";
  const items = crumbItems(page);
  return `<nav class="crumbs container" aria-label="Breadcrumb" data-search-ignore><ol>${items
    .map((c, i) =>
      i === items.length - 1
        ? `<li><span aria-current="page">${esc(c.name)}</span></li>`
        : `<li><a href="${href(c.path)}">${esc(c.name)}</a>${icon("chevron-right", 14)}</li>`,
    )
    .join("")}</ol></nav>`;
}

function breadcrumbNode(page) {
  return {
    "@type": "BreadcrumbList",
    "@id": `${abs(page.path)}#breadcrumb`,
    itemListElement: crumbItems(page).map((c, i) => ({ "@type": "ListItem", position: i + 1, name: c.name, item: abs(c.path) })),
  };
}

export const releasedLabel = new Date(site.released + "T00:00:00Z").toLocaleDateString("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

function footer() {
  const col = (title, links) =>
    `<div class="footer-col"><h2>${title}</h2><ul>${links
      .filter(([h]) => h)
      .map(([h, l]) => (/^https?:/.test(h) ? `<li><a href="${h}" rel="noopener">${l}</a></li>` : `<li><a href="${href(h)}">${l}</a></li>`))
      .join("")}</ul></div>`;
  const d = site.docs;
  return `<footer class="site-footer" data-search-ignore>
  <div class="container footer-inner">
    <div class="footer-brand">
      ${brand(30)}
      <p>${site.tagline}. Open source under the <a href="${site.licenseFile}" rel="noopener">MIT licence</a>, built in the open by its community.</p>
      <a class="release-chip" href="${site.release}" data-cta="Latest release" rel="noopener"><span class="pulse" aria-hidden="true"></span>v${site.version}<span class="muted">· ${releasedLabel}</span></a>
    </div>
    <div class="footer-cols">
      ${col("Product", [["/features/", "Features"], ["/powerdns-admin-alternative/", "Compare"], ["/faq/", "FAQ"], ["/support/", "Commercial support"], ["/search/", "Search"], [site.demo, "Live demo"], [site.releases, "Releases"], [site.changelog, "Changelog"]])}
      ${col("Docs", [[d.index, "Documentation"], [d.quickstart, "Quickstart"], [d.install, "Installation"], [d.config, "Configuration"], [d.rbac, "RBAC"], [d.oidc, "OIDC"], [d.ldap, "LDAP"], [d.saml, "SAML"], [d.passkeys, "Passkeys"], [d.mcp, "MCP"]])}
      ${col("Community", [[site.repo, "GitHub"], [site.discussions, "Discussions"], [site.issues, "Issues"], [site.contributing, "Contributing"], [site.security, "Security policy"], [site.websiteRepo, "Website source"]])}
    </div>
  </div>
  <div class="container footer-bottom">
    <span>© ${site.released.slice(0, 4)} ${site.name} contributors. MIT licensed.</span>
    <span>Independent community project, not affiliated with or endorsed by PowerDNS or Open-Xchange. PowerDNS is a trademark of its respective owner.</span>
    <span>This website uses Google Analytics to count visits (no ad cookies); <a href="https://tools.google.com/dlpage/gaoptout" rel="noopener">opt out</a>. The app itself has no telemetry.</span>
    <span><a class="ngn-credit" rel="noopener" href="https://ngn.au/services/website-development/" aria-label="Website by NGN"><span>Website by</span>${ngnLogo(45, 16)}</a></span>
  </div>
</footer>`;
}

const lightbox = `<dialog class="lightbox" id="lightbox" aria-label="Screenshot preview">
  <div class="lightbox-frame" id="lightboxFrame">
    <span class="lightbox-spinner" aria-hidden="true"></span>
  </div>
  <p class="lightbox-caption" id="lightboxCaption"></p>
  <button class="lightbox-btn lightbox-close" id="lightboxClose" type="button" aria-label="Close preview">${icon("x", 22)}</button>
  <button class="lightbox-btn lightbox-prev" id="lightboxPrev" type="button" aria-label="Previous screenshot">${icon("chevron-left", 24)}</button>
  <button class="lightbox-btn lightbox-next" id="lightboxNext" type="button" aria-label="Next screenshot">${icon("chevron-right", 24)}</button>
</dialog>`;

/* ---------- Social card ---------- */
const ogDir = new URL("./static/assets/og/", import.meta.url);
export function ogKey(page) {
  if (page.ogImage) return page.ogImage;
  if (page.layout === "docs") return page.og ? page.slug.replace(/^(docs-)?/, "docs-") : "docs";
  return page.slug;
}
function ogImageFor(page) {
  const want = ogKey(page);
  for (const k of [want, page.layout === "docs" ? "docs" : null, "home"]) {
    if (k && existsSync(new URL(`${k}.jpg`, ogDir))) return `/assets/og/${k}.jpg`;
  }
  return `/assets/og/${want}.jpg`;
}

/* ---------- Document ---------- */
export const THEME_KEY = "pda-theme";
// Theme before first paint (no flash) and the js class for JS-only layout.
const bootFor = (extra = "") =>
  `(function(){var d=document.documentElement,t;d.classList.replace("no-js","js");try{t=localStorage.getItem("${THEME_KEY}")}catch(e){}if(t!=="light"&&t!=="dark")t=matchMedia("(prefers-color-scheme: light)").matches?"light":"dark";d.dataset.theme=t;${extra}})();`;
export const bootScript = bootFor();

// Pages with an above-the-fold screenshot (page.lcp) get an early preload of the
// variant for the theme that will actually show. The preload is limited to viewports
// where the screenshot is above the fold (page.lcp.media): on a phone the hero text is
// the LCP element and the screenshot sits below it, so fetching it early only competes
// with the stylesheet and the font for bandwidth and delays that text.
function bootScriptFor(page) {
  if (!page.lcp || !hasShot(page.lcp.name)) return bootScript;
  const d = shotSet("dark", page.lcp.name);
  const l = shotSet("light", page.lcp.name);
  const media = page.lcp.media || "(min-width: 761px)";
  return bootFor(
    `if(matchMedia(${JSON.stringify(media)}).matches){var s=t==="light"?${JSON.stringify(l.srcset)}:${JSON.stringify(d.srcset)},k=document.createElement("link");k.rel="preload";k.as="image";k.imageSrcset=s;k.imageSizes=${JSON.stringify(page.lcp.sizes || "")};k.fetchPriority="high";document.head.appendChild(k)}`,
  );
}

export function render(page, assets = {}) {
  const url = abs(page.path);
  const title = page.title;
  const ogPath = ogImageFor(page);
  const ogImage = abs(ogPath);
  const layout = page.layout || "default";
  const types = [].concat(page.pageType || ["WebPage"]);
  const boot = bootScriptFor(page);

  const graph = [...baseGraph(), ...(page.schema || []), ...(page.jsonld || [])];
  const webPage = {
    "@type": types.length === 1 ? types[0] : types,
    "@id": `${url}#webpage`,
    url,
    name: title,
    description: page.description,
    inLanguage: site.lang,
    isPartOf: { "@id": ids.website },
    primaryImageOfPage: { "@type": "ImageObject", url: ogImage, width: 1200, height: 630 },
    dateModified: page.modified || site.released,
  };
  if (types.includes("TechArticle") || types.includes("Article")) {
    Object.assign(webPage, {
      headline: (page.headline || page.h1 || title).slice(0, 110),
      author: { "@id": ids.org },
      publisher: { "@id": ids.org },
      image: ogImage,
      mainEntityOfPage: url,
      about: { "@id": ids.app },
    });
    if (page.datePublished) webPage.datePublished = page.datePublished;
    if (page.wordCount) webPage.wordCount = page.wordCount;
  }
  if (page.about) webPage.about = page.about;
  const crumbsOn = page.breadcrumbs && page.breadcrumbs.length;
  if (crumbsOn) {
    webPage.breadcrumb = { "@id": `${url}#breadcrumb` };
    graph.push(breadcrumbNode(page));
  }
  if (page.mainEntity) webPage.mainEntity = page.mainEntity;
  if (page.faq && types.includes("FAQPage")) webPage.mainEntity = faqQuestions(page.faq);
  graph.push(webPage);
  const jsonld = JSON.stringify({ "@context": "https://schema.org", "@graph": graph }).replace(/</g, "\\u003c");

  const inlineScripts = [boot, ...(page.inlineScripts || [])];
  // Google Analytics 4 (gtag.js) is loaded by analytics.js, never inline, so script-src
  // only needs the tag manager host; the img/connect hosts are where gtag beacons go.
  const ga = site.ga4;
  const csp = [
    "default-src 'self'",
    `script-src 'self' ${inlineScripts.map((s) => `'${sha256(s)}'`).join(" ")}${ga ? " https://*.googletagmanager.com" : ""}`,
    "style-src 'self'",
    `img-src 'self' data:${ga ? " https://*.google-analytics.com https://*.googletagmanager.com https://*.g.doubleclick.net https://www.google.com https://www.google.com.au" : ""}`,
    "font-src 'self'",
    `connect-src 'self'${ga ? " https://*.google-analytics.com https://analytics.google.com https://*.analytics.google.com https://*.googletagmanager.com https://*.g.doubleclick.net https://www.google.com https://www.google.com.au" : ""}`,
    "manifest-src 'self'",
    "base-uri 'self'",
    "form-action 'none'",
    "object-src 'none'",
    "frame-src 'none'",
    "worker-src 'self'",
    // Only for https builds: Safari applies it to http://127.0.0.1 too, so a local
    // preview's stylesheet, fonts and images would be requested over https and fail.
    ...(site.url.startsWith("https:") ? ["upgrade-insecure-requests"] : []),
  ].join("; ");

  const js = assets.js || {};
  const scripts = [js.main, js.search, layout === "docs" ? js.docs : null]
    .filter(Boolean)
    .map((s) => `<script src="${s}" defer></script>`)
    .concat(ga && js.analytics ? [`<script src="${js.analytics}" data-ga4="${ga}" defer></script>`] : [])
    .join("\n");
  const section = page.searchSection || (layout === "docs" ? `Docs${page.section ? " › " + page.section : ""}` : "Site");
  const searchAttr = assets.searchIndex === false ? "" : ` data-search-index="${assets.searchIndex || SEARCH_INDEX_TOKEN}"`;

  return `<!DOCTYPE html>
<html lang="${site.lang}" class="no-js" data-theme="dark" data-base="${site.base}"${searchAttr}>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta http-equiv="Content-Security-Policy" content="${csp}">
<title>${esc(title)}</title>
<meta name="description" content="${esc(page.description)}">
<link rel="canonical" href="${url}">
<meta name="robots" content="${site.staging ? "noindex, nofollow" : page.noindex ? "noindex, follow" : "index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1"}">
<script>${boot}</script>
${(page.inlineScripts || []).map((s) => `<script>${s}</script>`).join("\n")}
<link rel="preload" href="${href("/assets/fonts/inter-latin.woff2")}" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="${assets.css}">
<meta name="color-scheme" content="dark light">
<meta name="theme-color" content="#0a0c11" media="(prefers-color-scheme: dark)">
<meta name="theme-color" content="#ffffff" media="(prefers-color-scheme: light)">
<meta name="format-detection" content="telephone=no">
<meta name="application-name" content="${site.name}">
<meta name="apple-mobile-web-app-title" content="AuthAdmin">
<link rel="icon" href="${href("/favicon.ico")}" sizes="48x48">
<link rel="icon" href="${href("/favicon.svg")}" type="image/svg+xml">
<link rel="apple-touch-icon" href="${href("/apple-touch-icon.png")}">
<link rel="manifest" href="${href("/site.webmanifest")}">
<link rel="author" href="${href("/humans.txt")}">
<link rel="search" type="text/plain" title="llms.txt" href="${href("/llms.txt")}">
<meta property="og:type" content="${types.includes("TechArticle") ? "article" : "website"}">
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
${scripts}
${page.headExtra || ""}</head>
<body class="page-${esc(page.slug)} layout-${layout}${page.bodyClass ? " " + page.bodyClass : ""}">
<a class="skip-link" href="#main">Skip to content</a>
${header(page)}
<main id="main" tabindex="-1" data-search-section="${esc(section)}">
${layout === "docs" ? "" : breadcrumbs(page)}
${page.body}
</main>
${footer()}
${page.lightbox ? lightbox : ""}
</body>
</html>
`;
}
