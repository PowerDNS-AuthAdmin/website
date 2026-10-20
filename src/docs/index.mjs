// Docs pages: /docs/ (home), /docs/adr/ (the ADR index) and one page per synced
// upstream doc. Markdown lives in content/docs/**/*.md (scripts/sync-docs.mjs) and is
// rendered by src/lib/markdown.mjs with src/lib/highlight.mjs at build time.
//
// export const docPages  -> page objects for layout.render (layout: "docs")
// export const docsReport -> { brokenAnchors, links, staleFixes } (also printed as build warnings)
import { existsSync, readFileSync } from "node:fs";
import { posix } from "node:path";
import { site, href, abs } from "../site.mjs";
import { icon } from "../icons.mjs";
import { render as renderMarkdown, esc } from "../lib/markdown.mjs";
import { highlight, normalizeLang, detectLang, LABELS } from "../lib/highlight.mjs";
import { sections, flatDocs, docBySlug, quickPath, popular, adrSection } from "./nav.mjs";
import overlayFixes from "../../content/docs-overlay/fixes.mjs";

const CONTENT = new URL("../../content/docs/", import.meta.url);
// Fixes and new pages proposed upstream but not merged yet (see content/docs-overlay/fixes.mjs).
const OVERLAY = new URL("../../content/docs-overlay/", import.meta.url);
// site.mjs already refuses to load without _source.json, so it is always there here.
const source = JSON.parse(readFileSync(new URL("_source.json", CONTENT), "utf8"));
const shots = JSON.parse(readFileSync(new URL("../shots.json", import.meta.url), "utf8"));

const REPO = `https://github.com/${source.repo}`;
const REF = source.ref || `v${source.version}`;
const VERSION = source.version || site.version;
const SHORT = source.commit ? source.commit.slice(0, 7) : "";
const SUFFIX = " · AuthAdmin docs"; // "PowerDNS-AuthAdmin docs" pushes most titles past 65 chars
const issueLink = (n) => `${REPO}/issues/${n}`;
// Upstream file names are numbered and upper-case (docs/02-INSTALLATION.md); the slug
// to path mapping comes from _source.json, never from the slug.
const upstreamOf = (slug) => source.files?.[slug]?.upstream || `docs/${slug}.md`;
const slugByUpstream = Object.fromEntries(Object.entries(source.files || {}).map(([slug, f]) => [f.upstream, slug]));
const editUrl = (upstream, pending) => (pending ? issueLink(pending) : `${REPO}/edit/main/${upstream}`);
const viewUrl = (upstream, pending) => (pending ? issueLink(pending) : `${REPO}/blob/${REF}/${upstream}`);
const issueUrl = (title, path, upstream) =>
  `${REPO}/issues/new?title=${encodeURIComponent(`Docs: ${title}`)}&body=${encodeURIComponent(`Page: ${abs(path)}\nSource: ${upstream} (${REF})\n\nWhat was unclear or wrong?\n`)}`;
const docPath = (slug) => `/docs/${slug}/`;
const ADR_INDEX = "/docs/adr/";
const fmtDate = (iso) =>
  new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

/* ---------------------------------------------------------------- helpers */

// The screenshot on each doc's social card (media/screenshots names, see src/shots.json).
const OG_SHOT = {
  quickstart: "dashboard",
  installation: "zones-list",
  configuration: "settings",
  backends: "powerdns-servers",
  oidc: "oidc-providers",
  saml: "teams",
  ldap: "users",
  passkeys: "profile",
  rbac: "roles",
  provisioning: "zone-templates",
  hardening: "audit-log",
  upgrading: "backend-health",
  troubleshooting: "pdns-requests",
  mcp: "zone-edit",
  features: "zone-edit-diff",
  "dev-setup": "dashboard",
  "adr/0004-three-layer-architecture": "roles",
  "adr/0006-csp-nonce": "settings",
  "adr/0007-db-backed-sessions": "profile",
  "adr/0008-argon2id-passwords": "users",
  "adr/0009-custom-auth-core": "oidc-providers",
  "adr/0010-per-rrset-optimistic-concurrency": "zone-edit-diff",
  "adr/0011-migrate-on-app-boot": "settings",
  "adr/0012-first-boot-provisioning": "zone-templates",
  "adr/0013-pdns-db-bridge": "powerdns-servers",
  "adr/0014-backend-capability-model": "powerdns-servers",
  "adr/0015-backend-health-advisories": "backend-health",
  "adr/0016-redis-horizontal-scale": "dashboard",
  "adr/0018-provider-abstraction": "oidc-providers",
  "adr/0019-webauthn-passkeys": "profile",
  "adr/0020-ldap-architecture": "users",
  "adr/0021-saml-architecture": "teams",
  "adr/0022-zone-horizons": "zones-list",
  "adr/0023-zone-authority-permissions": "roles",
};
const DEFAULT_SHOT = "dashboard";
const ADR_SHOT = "audit-log";

const copyBtn = `<button type="button" class="copy-btn" data-copy aria-label="Copy code to clipboard">${icon("copy", 15, "i-copy")}${icon("check", 15, "i-done")}<span class="copy-label">Copy</span></button>`;

function codeBlock(code, lang) {
  let l = normalizeLang(lang);
  if (!lang) l = detectLang(code);
  const label = LABELS[l] || lang || "text";
  return `<div class="code-block" data-lang="${esc(l)}"><div class="code-head"><span class="code-lang">${esc(label)}</span>${copyBtn}</div><pre tabindex="0"><code>${highlight(code, l)}</code></pre></div>`;
}

const CALLOUT_ICON = { note: "info", tip: "zap", important: "star", warning: "alert", caution: "alert" };
function callout(type, title, inner) {
  return `<div class="callout callout-${type}" role="note"><span class="callout-icon" aria-hidden="true">${icon(CALLOUT_ICON[type] || "info", 18)}</span><div class="callout-body">${title ? `<p class="callout-title">${esc(title)}</p>` : ""}\n${inner}\n</div></div>`;
}

/** Trim to <= max chars on a word boundary, preferring a sentence end. */
export function trimDescription(text, min = 70, max = 160) {
  let t = text.replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max);
  const sentence = cut.match(/^.*[.!?](?=\s)/);
  if (sentence && sentence[0].length >= min) return sentence[0];
  const word = cut.slice(0, max - 1).replace(/\s+\S*$/, "").replace(/[\s,;:—–-]+$/, "");
  return word + "…";
}

/** "<name> · AuthAdmin docs" within 65 chars: the first candidate that fits, else the first one cut on a word. */
function seoTitle(...candidates) {
  const max = 65 - SUFFIX.length;
  for (const c of candidates) if (c && c.length <= max) return c + SUFFIX;
  const c = candidates.find(Boolean) || "Docs";
  return c.slice(0, max - 1).replace(/\s+\S*$/, "").replace(/[\s,;:(-]+$/, "") + "…" + SUFFIX;
}

// Plain text of a markdown fragment (for ADR summaries taken from "## Context").
const plain = (md) => md.replace(/\[([^\]]*)\]\([^)]*\)/g, "$1").replace(/[*_`]/g, "").replace(/\s+/g, " ").trim();
const adrStatusBadge = (adr) =>
  `<span class="adr-status adr-status-${esc(adr.status)}">${esc(adr.label)}</span>`;
const adrBySlugNumber = Object.fromEntries(adrSection.docs.map((d) => [d.adr.number, d]));

/* ---------------------------------------------------------------- link rewriting */

// A path inside the upstream repo -> the site page it maps to, or null.
function resolveDocPath(target) {
  const t = target.replace(/\/$/, "");
  if (t === "docs" || t === "docs/README.md") return { slug: null, path: "/docs/" };
  if (t === "docs/adr" || t === "docs/adr/README.md") return { slug: null, path: ADR_INDEX };
  const slug = slugByUpstream[t];
  return slug && docBySlug[slug] ? { slug, path: docPath(slug) } : null;
}

const links = []; // { from, slug, hash, raw }
function makeLinkRewriter(fromSlug, upstream) {
  const dir = posix.dirname(upstream);
  const GH_DOC = new RegExp(`^https://github\\.com/${source.repo.replace(/[.]/g, "\\.")}/(?:blob|tree)/[^/]+/(docs(?:/[^#?]*)?)/?(#.*)?$`, "i");
  return (url, kind) => {
    if (/^(mailto:|tel:)/i.test(url)) return { href: url, external: false };
    if (url.startsWith("#")) {
      links.push({ from: upstream, slug: fromSlug, hash: decodeURIComponent(url.slice(1)), raw: url });
      return { href: url, external: false };
    }
    // GitHub links to the docs themselves come home to the site.
    const gh = GH_DOC.exec(url);
    if (gh) {
      const r = resolveDocPath(gh[1]);
      if (r) {
        const hash = gh[2] ? gh[2].slice(1) : "";
        if (r.slug) links.push({ from: upstream, slug: r.slug, hash: decodeURIComponent(hash), raw: url });
        return { href: href(r.path) + (hash ? `#${hash}` : ""), external: false };
      }
    }
    if (/^[a-z][a-z0-9+.-]*:/i.test(url) || url.startsWith("//")) return { href: url, external: true };
    // Relative to the upstream file's directory.
    const [pathPart, ...h] = url.split("#");
    const hash = h.join("#");
    const target = posix.normalize(posix.join(dir, pathPart || posix.basename(upstream)));
    const r = resolveDocPath(target);
    if (r) {
      if (r.slug) links.push({ from: upstream, slug: r.slug, hash: decodeURIComponent(hash), raw: url });
      return { href: href(r.path) + (hash ? `#${hash}` : ""), external: false };
    }
    // Anything else lives in the upstream repository at the synced tag. Images are
    // linked, not hotlinked (img-src is 'self').
    const clean = target.replace(/^(\.\.\/)+/, "").replace(/\/$/, "");
    if (kind === "image") return { href: `${REPO}/blob/${REF}/${clean}`, external: true };
    const isDir = pathPart.endsWith("/") || !/\.[a-z0-9]+$/i.test(clean);
    return { href: `${REPO}/${isDir ? "tree" : "blob"}/${REF}/${clean}${hash ? `#${hash}` : ""}`, external: true };
  };
}

/* ---------------------------------------------------------------- render docs */

const staleFixes = []; // overlay fixes that no longer change anything: merged upstream?
const rendered = flatDocs.map((d) => {
  const file = `${d.slug}.md`;
  const upstreamFile = new URL(file, CONTENT);
  const overlayFile = new URL(file, OVERLAY);
  const pending = !existsSync(upstreamFile) && existsSync(overlayFile) ? d.issue : null;
  if (existsSync(upstreamFile) && existsSync(overlayFile) && !process.env.DOCS_QUIET)
    console.warn(`docs: upstream now has ${file}; the overlay copy is ignored, delete content/docs-overlay/${file} and its nav issue`);
  if (!existsSync(upstreamFile) && !pending) throw new Error(`docs: missing content/docs/${file} (run node scripts/sync-docs.mjs)`);
  const upstream = upstreamOf(d.slug);
  let markdown = readFileSync(pending ? overlayFile : upstreamFile, "utf8");
  const fixes = [];
  for (const f of overlayFixes.filter((f) => f.file === upstream || f.file === file)) {
    const next = f.apply(markdown);
    if (next === markdown) staleFixes.push(f);
    else if (!fixes.includes(f.issue)) fixes.push(f.issue);
    markdown = next;
  }
  const r = renderMarkdown(markdown, { link: makeLinkRewriter(d.slug, upstream), code: codeBlock, callout, stripTitle: true, shots, href });
  // ADRs open with a metadata list; the first real paragraph is under "## Context".
  const context = d.adr ? plain((/^##\s+Context\s*\n+([\s\S]*?)(?=\n\s*\n|\n#)/m.exec(markdown) || [])[1] || "") : "";
  // Pages keep the upstream h1 (the nav title is the short sidebar label), except ADRs,
  // whose h1 repeats the number the nav already parsed out ("ADR 0005 - ...").
  return { ...d, file, upstream, markdown, pending, fixes, context, ...r, title: d.adr ? d.title : r.title || d.title };
});

// Verify every internal anchor resolves.
const idsBySlug = Object.fromEntries(rendered.map((r) => [r.slug, new Set(r.headings.map((h) => h.id))]));
export const brokenAnchors = links
  .filter((l) => l.hash && !idsBySlug[l.slug]?.has(l.hash))
  .map((l) => ({ from: l.from, to: `${upstreamOf(l.slug)}#${l.hash}`, link: l.raw }));
for (const p of popular) if (p.hash && !idsBySlug[p.slug]?.has(p.hash)) brokenAnchors.push({ from: "src/docs/nav.mjs (popular)", to: `${upstreamOf(p.slug)}#${p.hash}`, link: p.hash });
if (brokenAnchors.length && !process.env.DOCS_QUIET) {
  console.warn(`docs: ${brokenAnchors.length} upstream anchor(s) do not resolve (links kept as-is):`);
  for (const b of brokenAnchors) console.warn(`  ${b.from} -> ${b.to}`);
}
for (const f of staleFixes) if (!process.env.DOCS_QUIET) console.warn(`docs: overlay fix for #${f.issue} (${f.file}: ${f.title}) no longer applies; remove it from content/docs-overlay/fixes.mjs`);
export const docsReport = { brokenAnchors, links: links.length, staleFixes };

/* ---------------------------------------------------------------- partials */

// current: a doc slug, "adr" for the ADR index, or "" for the docs home.
function sidebar(current) {
  const groups = sections
    .map((s) => {
      const isAdr = s.id === "adr";
      const has = s.docs.some((d) => d.slug === current) || (isAdr && current === "adr");
      const items = s.docs
        .map((d) => {
          const cur = d.slug === current;
          const label = d.adr ? `<span class="docs-nav-num">${esc(d.adr.number)}</span><span>${esc(d.title)}</span>` : esc(d.title);
          return `<li${d.adr ? ' class="is-adr"' : ""}><a href="${href(docPath(d.slug))}"${cur ? ' aria-current="page"' : ""}>${label}</a></li>`;
        })
        .join("");
      const indexItem = isAdr ? `<li class="is-index"><a href="${href(ADR_INDEX)}"${current === "adr" ? ' aria-current="page"' : ""}>All decisions</a></li>` : "";
      // The long ADR list starts collapsed unless the reader is inside it.
      return `<details class="docs-nav-group${has ? " has-current" : ""}" data-group="${s.id}"${!isAdr || has ? " open" : ""}>
<summary><span class="docs-nav-icon" aria-hidden="true">${icon(s.icon, 16)}</span><span class="docs-nav-label">${esc(s.title)}</span>${icon("chevron-down", 16, "docs-nav-chevron")}</summary>
<ul>${indexItem}${items}</ul>
</details>`;
    })
    .join("\n");
  return `<aside class="docs-sidebar" id="docs-sidebar" aria-label="Documentation" data-search-ignore>
<div class="docs-sidebar-scroll">
<nav class="docs-sitenav" aria-label="Site">${site.nav.map((n) => `<a href="${href(n.href)}"${n.href === "/docs/" ? ' class="is-current"' : ""}>${esc(n.label)}</a>`).join("")}</nav>
<a class="docs-nav-home${current ? "" : ' is-current" aria-current="page'}" href="${href("/docs/")}">${icon("book", 16)}<span>Docs home</span></a>
<nav class="docs-nav" aria-label="Docs sections">
${groups}
</nav>
<div class="docs-sidebar-foot">
<a href="${site.release}" rel="noopener"><span class="pulse" aria-hidden="true"></span>PowerDNS-AuthAdmin v${esc(VERSION)}</a>
<a href="${REPO}/tree/${REF}/docs" rel="noopener">${icon("github", 14)}Docs source</a>
</div>
</div>
</aside>`;
}

function tocList(headings, compact = false) {
  // Very long pages (the feature catalog, upgrade notes) list only h2s in the side TOC.
  let items = headings.filter((h) => h.depth === 2 || h.depth === 3);
  if (compact && items.length > 40) items = items.filter((h) => h.depth === 2);
  if (!items.length) return "";
  let html = "<ol>";
  let open3 = false;
  items.forEach((h, k) => {
    if (h.depth === 2) {
      if (open3) { html += "</ol></li>"; open3 = false; }
      else if (k > 0) html += "</li>";
      html += `<li><a href="#${h.id}" data-toc="${h.id}">${esc(h.text)}</a>`;
    } else {
      if (!open3) { html += k === 0 ? "<li><ol>" : "<ol>"; open3 = true; }
      html += `<li><a href="#${h.id}" data-toc="${h.id}">${esc(h.text)}</a></li>`;
    }
  });
  html += open3 ? "</ol></li>" : "</li>";
  return html + "</ol>";
}

function pager(i) {
  const prev = flatDocs[i - 1];
  const next = flatDocs[i + 1];
  const label = (d) => (d.adr ? `ADR ${d.adr.number}: ${d.title}` : d.title);
  const card = (d, dir) =>
    d
      ? `<a class="docs-pager-card docs-pager-${dir}" href="${href(docPath(d.slug))}" rel="${dir}"><span class="docs-pager-dir">${dir === "prev" ? `${icon("chevron-left", 15)}Previous` : `Next${icon("chevron-right", 15)}`}</span><span class="docs-pager-title">${esc(label(d))}</span><span class="docs-pager-section">${esc(d.section.title)}</span></a>`
      : `<span class="docs-pager-card is-empty" aria-hidden="true"></span>`;
  return `<nav class="docs-pager" aria-label="Previous and next page" data-search-ignore>${card(prev, "prev")}${card(next, "next")}</nav>`;
}

const crumbs = (items) =>
  `<nav class="docs-crumbs" aria-label="Breadcrumb" data-search-ignore><ol>${items
    .map((c, k) => (k === items.length - 1 ? `<li><span aria-current="page">${esc(c.name)}</span></li>` : `<li><a href="${href(c.path)}">${esc(c.name)}</a>${icon("chevron-right", 14)}</li>`))
    .join("")}</ol></nav>`;

const syncedNote = (upstream, pending, fixes) =>
  `<p class="docs-synced">${icon("git-branch", 14)}<span>${
    pending
      ? `Proposed for the PowerDNS-AuthAdmin docs in <a href="${issueLink(pending)}" rel="noopener">#${pending}</a> and not merged upstream yet.`
      : `Synced from <a href="${REPO}/tree/${REF}/docs" rel="noopener">PowerDNS-AuthAdmin v${esc(VERSION)}</a>${SHORT ? ` (<a href="${REPO}/commit/${source.commit}" rel="noopener"><code>${SHORT}</code></a>)` : ""}, <code>${esc(upstream)}</code>${
          fixes.length ? `, with fixes from ${fixes.map((n) => `<a href="${issueLink(n)}" rel="noopener">#${n}</a>`).join(", ")}` : ""
        }.`
  } Documentation © the PowerDNS-AuthAdmin contributors, <a href="${site.licenseFile}" rel="noopener">MIT</a>.</span></p>`;

/* ---------------------------------------------------------------- doc pages */

const docPagesList = rendered.map((r, i) => {
  const path = docPath(r.slug);
  const modified = source.files?.[r.slug]?.modified || source.releaseDate || site.released;
  const adr = r.adr || null;
  // The page keeps the upstream h1; the nav title is the short sidebar label.
  const h1 = adr ? `ADR ${adr.number}: ${r.title}` : r.title || r.navTitle;
  // A long ADR title is cut on a word rather than reduced to its number.
  const title = adr ? seoTitle(`ADR ${adr.number}: ${r.title}`) : seoTitle(r.title, r.navTitle || r.title.slice(0, 48));
  let description = trimDescription(adr ? r.context : r.firstParagraphText || "");
  const balanced = (description.match(/\(/g) || []).length === (description.match(/\)/g) || []).length;
  if (r.seoFromNav || description.length < 70 || !balanced || /:$/.test(description)) {
    description = trimDescription(`${h1}: ${r.description}`);
    if (description.length < 70) description = trimDescription(`${description} Part of the PowerDNS-AuthAdmin documentation.`);
  }
  const toc = tocList(r.headings, true);
  const words = r.text.split(/\s+/).filter(Boolean).length;
  const minutes = Math.max(1, Math.round(words / 230));
  const issue = issueUrl(h1, path, r.upstream);
  const sectionCrumb = adr ? { name: r.section.title, path: ADR_INDEX } : { name: r.section.title, path: `/docs/#${r.section.id}` };
  const related = adr && adr.ref && adrBySlugNumber[adr.ref];
  const lead = adr ? trimDescription(r.context, 70, 220) : r.description;

  const body = `<div class="docs-shell" data-docs>
${sidebar(r.slug)}
<article class="docs-article" aria-labelledby="doc-title">
${crumbs([{ name: "Docs", path: "/docs/" }, sectionCrumb, { name: adr ? `ADR ${adr.number}` : r.title, path }])}
<header class="docs-header">
${adr ? `<p class="docs-kicker" data-search-ignore>${adrStatusBadge(adr)}${adr.date ? `<span class="docs-kicker-date">Decided <time datetime="${esc(adr.date)}">${fmtDate(adr.date)}</time></span>` : ""}${
        related ? `<a class="docs-kicker-link" href="${href(docPath(related.slug))}">${adr.status === "superseded" ? "Read ADR" : "Replaces ADR"} ${esc(related.adr.number)}: ${esc(related.title)}</a>` : ""
      }</p>` : ""}
<h1 id="doc-title">${esc(h1)}</h1>
<p class="docs-lead">${esc(lead)}</p>
<div class="docs-meta" data-search-ignore>
<span>${icon("history", 14)}Updated <time datetime="${esc(modified)}">${fmtDate(modified)}</time></span>
<span>${icon("book", 14)}${minutes} min read</span>
<a href="${editUrl(r.upstream, r.pending)}" rel="noopener">${icon("github", 14)}Edit on GitHub</a>
</div>
</header>
${toc ? `<details class="docs-toc-mobile" data-search-ignore><summary>${icon("file-text", 16)}<span>On this page</span>${icon("chevron-down", 16, "docs-toc-chevron")}</summary><nav aria-label="On this page (compact)">${tocList(r.headings)}</nav></details>` : ""}
<div class="doc-content">
${r.html}
</div>
<footer class="docs-footer" data-search-ignore>
<div class="docs-feedback">
<p class="docs-feedback-q">${icon("chat", 18)}<span>Was this page helpful?</span></p>
<div class="docs-feedback-links">
<a class="btn btn-ghost btn-sm" href="${issue}" rel="noopener">${icon("bug", 15)}Open an issue</a>
<a class="btn btn-ghost btn-sm" href="${editUrl(r.upstream, r.pending)}" rel="noopener">${icon("github", 15)}Edit this page on GitHub</a>
<a class="btn btn-ghost btn-sm" href="${viewUrl(r.upstream, r.pending)}" rel="noopener">${icon("code", 15)}View source</a>
</div>
</div>
${pager(i)}
${syncedNote(r.upstream, r.pending, r.fixes)}
</footer>
</article>
${toc ? `<aside class="docs-toc" aria-label="On this page" data-search-ignore>
<p class="docs-toc-title">On this page</p>
<nav aria-label="Table of contents">${toc}</nav>
<div class="docs-toc-actions">
<a href="${editUrl(r.upstream, r.pending)}" rel="noopener">${icon("github", 14)}Edit this page</a>
<a href="${issue}" rel="noopener">${icon("bug", 14)}Report an issue</a>
<a href="#main" data-docs-top>${icon("arrow-up-right", 14)}Back to top</a>
</div>
</aside>` : ""}
</div>`;

  return {
    slug: `docs-${r.slug.replace(/\//g, "-")}`,
    path,
    title,
    description,
    h1,
    headline: h1,
    layout: "docs",
    // The header menu button opens the docs sidebar instead of the site menu.
    docsNav: true,
    section: r.section.title,
    searchSection: `Docs › ${r.section.title}`,
    breadcrumbs: [{ name: "Docs", path: "/docs/" }, ...(adr ? [{ name: r.section.title, path: ADR_INDEX }] : []), { name: adr ? `ADR ${adr.number}` : r.title, path }],
    pageType: ["TechArticle"],
    modified,
    datePublished: adr && adr.date ? adr.date : undefined,
    wordCount: words,
    priority: ["quickstart", "installation"].includes(r.slug) ? 0.8 : adr ? 0.5 : 0.7,
    changefreq: "monthly",
    doc: { slug: r.slug, file: r.upstream, markdown: r.markdown, text: r.text, headings: r.headings, source: viewUrl(r.upstream, r.pending), adr },
    // Social card: scripts/build-media.mjs og renders it to assets/og/docs-<slug>.jpg.
    og: {
      eyebrow: adr ? `Docs · ADR ${adr.number} · ${adr.label}` : `Docs · ${esc(r.section.title)}`,
      title: esc(r.title).replace(/(\S+)$/, "<em>$1</em>"),
      sub: esc(adr ? trimDescription(r.context, 40, 120) : r.description),
      shot: OG_SHOT[r.slug] || (adr ? ADR_SHOT : DEFAULT_SHOT),
    },
    ogAlt: `${h1}: PowerDNS-AuthAdmin documentation`,
    body,
  };
});

/* ---------------------------------------------------------------- ADR list (shared by the home and the ADR index) */

function adrList(detailed) {
  return `<ol class="adr-list${detailed ? " adr-list-detailed" : ""}">
${adrSection.docs
  .map(
    (d) => `<li><a class="adr-row${d.adr.status === "superseded" ? " is-superseded" : ""}" href="${href(docPath(d.slug))}"><span class="adr-num">${esc(d.adr.number)}</span><span class="adr-title">${esc(d.title)}</span>${
      detailed && d.adr.date ? `<time class="adr-date" datetime="${esc(d.adr.date)}">${fmtDate(d.adr.date)}</time>` : ""
    }${adrStatusBadge(d.adr)}</a></li>`,
  )
  .join("\n")}
</ol>`;
}

/* ---------------------------------------------------------------- docs home */

const docsHome = (() => {
  const guides = rendered.filter((r) => !r.adr).length;
  const cards = sections
    .map(
      (s) => `<section class="docs-home-section" id="${s.id}" aria-labelledby="${s.id}-h">
<div class="docs-home-section-head">
<span class="docs-home-section-icon" aria-hidden="true">${icon(s.icon, 20)}</span>
<div><h2 id="${s.id}-h">${esc(s.title)}</h2><p>${esc(s.blurb)}</p></div>
</div>
${
  s.id === "adr"
    ? `${adrList(false)}
<p class="docs-home-more"><a href="${href(ADR_INDEX)}">${icon("arrow-right", 15)}<span>About the records and how to write one</span></a></p>`
    : `<ul class="docs-card-grid">
${s.docs
  .map(
    (d) => `<li><a class="docs-card" href="${href(docPath(d.slug))}"><span class="docs-card-icon" aria-hidden="true">${icon(d.icon, 18)}</span><span class="docs-card-title">${esc(d.title)}</span><span class="docs-card-desc">${esc(d.description)}</span><span class="docs-card-arrow" aria-hidden="true">${icon("arrow-right", 16)}</span></a></li>`,
  )
  .join("\n")}
</ul>`
}
</section>`,
    )
    .join("\n");

  const steps = quickPath
    .map(
      (q, k) => `<li><a class="docs-step" href="${href(docPath(q.slug))}"><span class="docs-step-num" aria-hidden="true">${k + 1}</span><span class="docs-step-body"><span class="docs-step-title">${esc(q.step)}</span><span class="docs-step-text">${esc(q.text)}</span></span>${icon("arrow-right", 16, "docs-step-arrow")}</a></li>`,
    )
    .join("");

  const pop = popular
    .map((p) => `<li><a href="${href(docPath(p.slug))}${p.hash ? `#${p.hash}` : ""}">${icon("arrow-right", 14)}<span>${esc(p.title)}</span></a></li>`)
    .join("");

  const body = `<div class="docs-home" data-docs>
<section class="docs-hero">
<div class="docs-hero-inner">
${crumbs([{ name: "Home", path: "/" }, { name: "Docs", path: "/docs/" }])}
<p class="docs-eyebrow"><span class="pulse" aria-hidden="true"></span>PowerDNS-AuthAdmin v${esc(VERSION)} documentation</p>
<h1>Install, configure and run PowerDNS-AuthAdmin</h1>
<p class="docs-hero-lead">Everything from a two-minute demo stack to a hardened production install: SQLite or Postgres, OIDC, SAML and LDAP sign-in, roles and scopes, one or many PowerDNS backends, and natural-language DNS over MCP.</p>
<button type="button" class="docs-search" data-search-open aria-label="Search the documentation (Ctrl K)">${icon("search", 18)}<span class="docs-search-text">Search the docs, e.g. “OIDC groups” or “APP_URL”</span><kbd class="search-kbd" data-search-kbd>Ctrl K</kbd></button>
<noscript><p class="docs-search-nojs"><a href="${href("/search/")}">Open the search page</a> or browse the sections below.</p></noscript>
<p class="docs-hero-meta">${guides} guides and ${adrSection.docs.length} decision records · synced from <a href="${REPO}/tree/${REF}/docs" rel="noopener"><code>${esc(source.repo)}/docs</code> @ ${esc(REF)}</a></p>
</div>
</section>
<div class="docs-home-body">
<section class="docs-quick" aria-labelledby="quick-h">
<h2 id="quick-h">Quick start</h2>
<ol class="docs-steps">${steps}</ol>
</section>
${cards}
<section class="docs-popular" aria-labelledby="popular-h" data-search-ignore>
<h2 id="popular-h">Popular topics</h2>
<ul>${pop}</ul>
</section>
<aside class="docs-home-help" data-search-ignore>
<div><h2>Can't find something?</h2><p>The docs are synced from the PowerDNS-AuthAdmin repository. Ask or report a gap on GitHub, and improvements to the docs are welcome as pull requests.</p></div>
<div class="docs-home-help-links">
<a class="btn btn-primary" href="${REPO}/issues/new?title=${encodeURIComponent("Docs: ")}" rel="noopener">${icon("bug", 16)}Open an issue</a>
<a class="btn btn-ghost" href="${REPO}/tree/${REF}/docs" rel="noopener">${icon("github", 16)}Browse docs on GitHub</a>
</div>
</aside>
</div>
</div>`;

  return {
    slug: "docs",
    path: "/docs/",
    title: "PowerDNS-AuthAdmin docs: install, configure, operate",
    description:
      "PowerDNS-AuthAdmin documentation: quickstart, installation, configuration, PowerDNS backends, OIDC, SAML and LDAP sign-in, RBAC, hardening, upgrades and MCP.",
    h1: "Install, configure and run PowerDNS-AuthAdmin",
    layout: "docs",
    section: "",
    searchSection: "Docs",
    breadcrumbs: [{ name: "Docs", path: "/docs/" }],
    pageType: ["CollectionPage"],
    modified: source.releaseDate || site.released,
    priority: 0.9,
    changefreq: "weekly",
    body,
  };
})();

/* ---------------------------------------------------------------- ADR index */

const adrIndex = (() => {
  const dates = adrSection.docs.map((d) => source.files?.[d.slug]?.modified).filter(Boolean).sort();
  const modified = dates[dates.length - 1] || source.releaseDate || site.released;
  const superseded = adrSection.docs.filter((d) => d.adr.status === "superseded").length;
  const toc = `<ol><li><a href="#why" data-toc="why">Why these exist</a></li><li><a href="#how-to-use-them" data-toc="how-to-use-them">How to use them</a></li><li><a href="#index" data-toc="index">Index</a></li></ol>`;
  const body = `<div class="docs-shell" data-docs>
${sidebar("adr")}
<article class="docs-article" aria-labelledby="doc-title">
${crumbs([{ name: "Docs", path: "/docs/" }, { name: adrSection.title, path: ADR_INDEX }])}
<header class="docs-header">
<h1 id="doc-title">Architecture Decision Records</h1>
<p class="docs-lead">${esc(adrSection.blurb)}</p>
<div class="docs-meta" data-search-ignore>
<span>${icon("history", 14)}Updated <time datetime="${esc(modified)}">${fmtDate(modified)}</time></span>
<span>${icon("scroll", 14)}${adrSection.docs.length} records, ${superseded} superseded</span>
<a href="${REPO}/edit/main/docs/adr/README.md" rel="noopener">${icon("github", 14)}Edit on GitHub</a>
</div>
</header>
<details class="docs-toc-mobile" data-search-ignore><summary>${icon("file-text", 16)}<span>On this page</span>${icon("chevron-down", 16, "docs-toc-chevron")}</summary><nav aria-label="On this page (compact)">${toc}</nav></details>
<div class="doc-content">
<h2 id="why">Why these exist<a class="heading-anchor" href="#why" aria-label="Link to this section: Why these exist" data-search-ignore>#</a></h2>
<p>Code preserves the <em>what</em> but rots the <em>why</em>. Each record captures one decision, the context it was made in and the options that were rejected, so a future contributor can ask "why did they do it this way?" and get an answer without archaeology.</p>
<h2 id="how-to-use-them">How to use them<a class="heading-anchor" href="#how-to-use-them" aria-label="Link to this section: How to use them" data-search-ignore>#</a></h2>
<ul>
<li><strong>Read</strong> any record whose subject touches the area you are changing before you change it.</li>
<li><strong>Write</strong> a new record when a decision adds, removes or replaces a major dependency, changes an architectural pattern, or constrains future choices in a non-obvious way.</li>
<li><strong>Don't edit</strong> a record after it is merged. Write a follow-up that supersedes it and mark the old one <code>Superseded by NNNN</code>.</li>
</ul>
<p>Records follow the <a href="${REPO}/blob/${REF}/docs/adr/0000-template.md" rel="noopener">upstream template</a> and stay short: one page is the target, two is the maximum. There is no ADR 0003; that number was reserved for a decision withdrawn before it was written, and numbers are never reused.</p>
<h2 id="index">Index<a class="heading-anchor" href="#index" aria-label="Link to this section: Index" data-search-ignore>#</a></h2>
${adrList(true)}
</div>
<footer class="docs-footer" data-search-ignore>
<div class="docs-feedback">
<p class="docs-feedback-q">${icon("chat", 18)}<span>Was this page helpful?</span></p>
<div class="docs-feedback-links">
<a class="btn btn-ghost btn-sm" href="${issueUrl("Architecture Decision Records", ADR_INDEX, "docs/adr/README.md")}" rel="noopener">${icon("bug", 15)}Open an issue</a>
<a class="btn btn-ghost btn-sm" href="${REPO}/edit/main/docs/adr/README.md" rel="noopener">${icon("github", 15)}Edit this page on GitHub</a>
<a class="btn btn-ghost btn-sm" href="${REPO}/blob/${REF}/docs/adr/README.md" rel="noopener">${icon("code", 15)}View source</a>
</div>
</div>
<nav class="docs-pager" aria-label="Previous and next page" data-search-ignore><span class="docs-pager-card is-empty" aria-hidden="true"></span><a class="docs-pager-card docs-pager-next" href="${href(docPath(adrSection.docs[0].slug))}" rel="next"><span class="docs-pager-dir">Next${icon("chevron-right", 15)}</span><span class="docs-pager-title">ADR ${esc(adrSection.docs[0].adr.number)}: ${esc(adrSection.docs[0].title)}</span><span class="docs-pager-section">${esc(adrSection.title)}</span></a></nav>
${syncedNote("docs/adr/README.md", null, [])}
</footer>
</article>
<aside class="docs-toc" aria-label="On this page" data-search-ignore>
<p class="docs-toc-title">On this page</p>
<nav aria-label="Table of contents">${toc}</nav>
<div class="docs-toc-actions">
<a href="${REPO}/edit/main/docs/adr/README.md" rel="noopener">${icon("github", 14)}Edit this page</a>
<a href="#main" data-docs-top>${icon("arrow-up-right", 14)}Back to top</a>
</div>
</aside>
</div>`;
  return {
    slug: "docs-adr",
    path: ADR_INDEX,
    title: "Architecture Decision Records" + SUFFIX,
    description: `The ${adrSection.docs.length} Architecture Decision Records behind PowerDNS-AuthAdmin: framework, auth core, sessions, CSP, migrations, backends, SSO providers and zone permissions.`,
    h1: "Architecture Decision Records",
    layout: "docs",
    docsNav: true,
    section: adrSection.title,
    searchSection: `Docs › ${adrSection.title}`,
    breadcrumbs: [{ name: "Docs", path: "/docs/" }, { name: adrSection.title, path: ADR_INDEX }],
    pageType: ["CollectionPage"],
    modified,
    priority: 0.6,
    changefreq: "monthly",
    doc: { slug: "adr", file: "docs/adr/README.md", markdown: "", text: "", headings: [], source: `${REPO}/blob/${REF}/docs/adr/README.md` },
    og: {
      eyebrow: "Docs · Architecture decisions",
      title: `Architecture <em>Decision Records</em>`,
      sub: esc(adrSection.blurb),
      shot: ADR_SHOT,
    },
    ogAlt: "Architecture Decision Records: PowerDNS-AuthAdmin documentation",
    body,
  };
})();

export const docPages = [docsHome, adrIndex, ...docPagesList];
export default docPages;
