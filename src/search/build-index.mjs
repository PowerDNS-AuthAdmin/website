// Build-time search indexer: zero dependencies.
//
//   import { buildSearchIndex } from "../src/search/build-index.mjs";
//   const { json, stats } = buildSearchIndex(rendered.map(r => ({ page: r.page, html: r.html })));
//
// The indexer reads ONLY <main> of each rendered page and splits it into one record for
// the page plus one per h2/h3 that has an id. Code identifiers (env vars, YAML keys, API
// endpoints, MCP tool names, token prefixes, DNS record types) are pulled out of code
// blocks into a keyword field.
//
// The tokenizer is NOT duplicated here: it lives in src/js/search.js (the single source
// of truth, shared with the browser), which is loaded in a sandbox via node:vm. That keeps
// the precomputed vocabulary and the client's postings perfectly in sync.
//
// Index format (version 1, compact arrays, short keys):
//   {
//     v: 1,
//     p: [[url, title, section, kind, description], ...]          // page table (shared strings)
//     r: [[page, anchor, heading, parent, content, keywords, kind], ...]
//          page     index into p
//          anchor   "" for the page record, else the heading id
//          heading  "" for the page record, else the h2/h3 text
//          parent   index into r of the enclosing h2 for an h3 record, else -1
//          content  normalised text (capped at CONTENT_MAX chars); snippets are cut from it
//          keywords array of code identifiers found in this section
//          kind     "" = inherit the page kind, else "config" | "api" for that record
//                   (page kinds: "page" | "doc" | "config" | "api" | "adr" | "faq")
//     w: "term term term ..."  vocabulary, sorted, space separated
//     d: [df, df, ...]          document frequency per vocabulary term (records containing it)
//   }
// URLs never include the site base; the client prefixes <html data-base>.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import { site } from "../site.mjs";

const CONTENT_MAX = 2800;
const KEYWORDS_MAX = 40;

// ---------------------------------------------------------------- shared engine
let engine;
function loadEngine() {
  if (engine) return engine;
  const file = fileURLToPath(new URL("../js/search.js", import.meta.url));
  const sandbox = { module: { exports: {} } };
  vm.runInNewContext(readFileSync(file, "utf8"), sandbox, { filename: file });
  engine = sandbox.module.exports;
  if (!engine || typeof engine.indexTokens !== "function") throw new Error("search.js did not export its engine");
  return engine;
}

// ---------------------------------------------------------------- HTML helpers
const NAMED = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", ensp: " ", emsp: " ", thinsp: " ",
  middot: "·", rsaquo: "›", lsaquo: "‹", raquo: "»", laquo: "«", hellip: "…", mdash: "—", ndash: "–",
  rarr: "→", larr: "←", harr: "↔", uarr: "↑", darr: "↓", copy: "©", reg: "®", trade: "™", times: "×",
  bull: "•", lsquo: "‘", rsquo: "’", ldquo: "“", rdquo: "”", deg: "°", plusmn: "±", check: "✓", hyphen: "-",
  zwj: "", zwnj: "", shy: "",
};
export function decodeEntities(s) {
  return s.replace(/&(#x[0-9a-f]+|#[0-9]+|[a-z][a-z0-9]*);/gi, (m, e) => {
    if (e[0] === "#") {
      const cp = e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      try { return String.fromCodePoint(cp); } catch { return m; }
    }
    const v = NAMED[e.toLowerCase()];
    return v === undefined ? m : v;
  });
}

const VOID = new Set("area base br col embed hr img input link meta param source track wbr".split(" "));
const RAW = new Set(["script", "style", "textarea", "title"]);
const SKIP = new Set(["script", "style", "svg", "nav", "button", "noscript", "template", "select", "math", "iframe", "canvas", "video", "audio", "picture", "dialog"]);
// Chrome inside content that is never searchable text (code block toolbars, anchor links...).
const SKIP_CLASS = /(?:^|\s)(?:code-head|code-lang|copy-btn|heading-anchor|anchor-link|sr-only|visually-hidden)(?:\s|$)/;
const INLINE = new Set("a abbr b bdi bdo cite code data dfn em i kbd mark q s samp small span strong sub sup time u var del ins wbr".split(" "));

function parseAttrs(src) {
  const out = {};
  const re = /([^\s"'<>\/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
  let m;
  while ((m = re.exec(src))) out[m[1].toLowerCase()] = decodeEntities(m[2] ?? m[3] ?? m[4] ?? "");
  return out;
}

// Streaming tokenizer: yields {type:"open"|"close"|"text", name, attrs, selfClosing, text}.
function* lex(html) {
  let i = 0;
  const n = html.length;
  while (i < n) {
    const lt = html.indexOf("<", i);
    if (lt === -1) { yield { type: "text", text: html.slice(i) }; return; }
    if (lt > i) yield { type: "text", text: html.slice(i, lt) };
    if (html.startsWith("<!--", lt)) {
      const end = html.indexOf("-->", lt + 4);
      i = end === -1 ? n : end + 3;
      continue;
    }
    if (html[lt + 1] === "!" || html[lt + 1] === "?") {
      const end = html.indexOf(">", lt);
      i = end === -1 ? n : end + 1;
      continue;
    }
    const m = /^<(\/?)([a-zA-Z][a-zA-Z0-9:-]*)((?:[^>"']|"[^"]*"|'[^']*')*)>/.exec(html.slice(lt, lt + 4096));
    if (!m) { yield { type: "text", text: "<" }; i = lt + 1; continue; }
    const name = m[2].toLowerCase();
    i = lt + m[0].length;
    if (m[1]) { yield { type: "close", name }; continue; }
    const attrSrc = m[3] || "";
    const selfClosing = /\/\s*$/.test(attrSrc);
    yield { type: "open", name, attrs: parseAttrs(attrSrc.replace(/\/\s*$/, "")), selfClosing };
    if (RAW.has(name) && !selfClosing) {
      const re = new RegExp(`</${name}\\s*>`, "i");
      const rest = html.slice(i);
      const em = re.exec(rest);
      const body = em ? rest.slice(0, em.index) : rest;
      if (name === "textarea" || name === "title") yield { type: "text", text: body };
      yield { type: "close", name };
      i = em ? i + em.index + em[0].length : n;
    }
  }
}

const ws = (s) => s.replace(/[\s ]+/g, " ").trim();

// ---------------------------------------------------------------- code identifiers
const HTTP = "GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS";
// Route path characters: PDNS /api/v1/servers/{id}, the app's /api/admin/.../[zoneId] and
// the docs' <slug> placeholders all appear inside one path.
const PATH = "[\\w\\-./{}:\\[\\]<>]";
// Record types the docs talk about. Single-letter "A" cannot survive the tokenizer's
// length >= 2 rule, so it is left out on purpose.
const RRTYPES = "AAAA|ALIAS|CAA|CNAME|DNAME|DNSKEY|DS|HTTPS|LOC|MX|NAPTR|NS|PTR|SOA|SRV|SSHFP|SVCB|TLSA|TXT|URI";
const RR_INLINE = new RegExp(`^(?:${RRTYPES})$`);
const RR_LINE = new RegExp(`(?:^|\\s)(?:IN\\s+)?(${RRTYPES})\\s+\\S`);
// Env vars: APP_SECRET_KEY, DATABASE_URL, OIDC_CLIENT_ID.
const ENV_INLINE = /^[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+$/;
// MCP tool names and other snake_case identifiers: list_zones, set_records, server_slug.
const SNAKE_INLINE = /^[a-z][a-z0-9]*(?:_[a-z0-9]+){1,3}$/;
const PAT = /\bpda_pat_[A-Za-z0-9]*/g;
const YAML_TOP = /^([a-z][a-z0-9_]{2,}):(?:\s|$)/;
const YAML_NESTED = /^\s+-?\s*([a-z][a-z0-9]*(?:_[a-z0-9]+)+):(?:\s|$)/;
function codeKeywords(code, inline) {
  const out = [];
  const text = code.replace(/\r/g, "");
  if (inline) {
    const t = ws(text);
    if (!t || t.length > 80) return out;
    let m;
    if ((m = new RegExp(`^(${HTTP})\\s+(\\/${PATH}*)`).exec(t))) { out.push(`${m[1]} ${m[2]}`); return out; }
    if (RR_INLINE.test(t)) { out.push(t); return out; }
    if (/^--?[a-z][\w-]*(=.*)?$/i.test(t)) { out.push(t.replace(/=.*/, "")); return out; }
    if (new RegExp(`^\\/(api|auth|nic|healthz|readyz|metrics|admin|zones|profile)${PATH}*$`).test(t)) { out.push(t); return out; }
    if (/^pda_pat_/.test(t)) { out.push("pda_pat_"); return out; }
    if (ENV_INLINE.test(t)) { out.push(t); return out; }
    if (SNAKE_INLINE.test(t)) { out.push(t); return out; }
    // YAML key shown inline ("pdns_servers:", "zone_templates:")
    if ((m = /^([a-z][a-z0-9_]{2,}):$/.exec(t))) { out.push(m[1]); return out; }
    if (/^[A-Za-z_][\w]*(?:[._-][A-Za-z0-9_]+)+$/.test(t) && /[._]/.test(t)) { out.push(t); return out; }
    const kv = /^([A-Za-z_][\w.]*)\s*=\s*\S/.exec(t);
    if (kv && /_/.test(kv[1])) out.push(kv[1]);
    return out;
  }
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (!line || line.length > 300) continue;
    let m;
    // .env style assignments, commented-out examples included: "# APP_SECRET_KEY=..."
    if ((m = /^#?\s*(?:export\s+)?([A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+)\s*=/.exec(line))) out.push(m[1]);
    // YAML: top-level keys always, nested keys when they look like identifiers (pdns_servers, api_key)
    if ((m = YAML_TOP.exec(raw))) out.push(m[1]);
    else if ((m = YAML_NESTED.exec(raw))) out.push(m[1]);
    if ((m = new RegExp(`(?:^|\\s|["'])(${HTTP})\\s+(\\/${PATH}*)`).exec(line))) out.push(`${m[1]} ${m[2]}`);
    for (const f of line.matchAll(/(?:^|\s)(--[a-z][a-z0-9-]{1,40})/g)) out.push(f[1]);
    for (const e of line.matchAll(/\b([A-Z][A-Z0-9]{1,}(?:_[A-Z0-9]+)+)\b/g)) out.push(e[1]);
    for (const p of line.matchAll(new RegExp(`(?:^|[\\s"'(])(\\/(?:api|nic)\\/${PATH}*)`, "g"))) out.push(p[1]);
    if (PAT.test(line)) out.push("pda_pat_");
    PAT.lastIndex = 0;
    // MCP tool names in JSON/shell examples: "list_zones", set_records(...)
    for (const t of line.matchAll(/(?:^|[\s"'(`])((?:list|get|set|add|delete|create|update)_[a-z]+(?:_[a-z]+)?)\b/g)) out.push(t[1]);
    if ((m = RR_LINE.exec(line))) out.push(m[1]);
  }
  return out;
}

// ---------------------------------------------------------------- page → records
function cleanTitle(t) {
  let s = ws(t || "");
  // " · AuthAdmin docs", " | PowerDNS-AuthAdmin", " · PowerDNS-AuthAdmin", " - PowerDNS-AuthAdmin"
  s = s.replace(/\s+[·|—–\-:]\s+(?:PowerDNS-)?AuthAdmin(?:\s+docs?)?\s*$/i, "");
  s = s.replace(/^(?:PowerDNS-)?AuthAdmin(?:\s+docs?)?\s+[·|—–\-:]\s+/i, "");
  return s.trim();
}

const DOC_KINDS = new Set(["doc", "config", "api", "adr"]);
function kindFor(path) {
  if (path === "/docs/" || path === "/docs/adr/") return "page"; // hubs: launchers, not documents
  if (/^\/docs\/adr\//.test(path)) return "adr";
  if (/^\/docs\/(?:mcp|api)\//.test(path)) return "api";
  if (/^\/docs\/configuration\//.test(path)) return "config";
  if (/^\/docs\//.test(path)) return "doc";
  if (/^\/faq\//.test(path)) return "faq";
  return "page";
}

function sectionFallback(path, kind) {
  if (kind === "adr") return "Architecture decisions";
  if (DOC_KINDS.has(kind)) return "Docs";
  if (kind === "faq") return "FAQ";
  const seg = path.split("/").filter(Boolean)[0];
  if (!seg) return "Site";
  return seg.replace(/-/g, " ").replace(/^\w/, (c) => c.toUpperCase());
}

function extract(html) {
  const mainStart = html.search(/<main[\s>]/i);
  if (mainStart === -1) return null;
  const mainEnd = html.lastIndexOf("</main>");
  const src = html.slice(mainStart, mainEnd === -1 ? undefined : mainEnd + 7);

  const sections = []; // {level, id, heading, text[], kw[]}
  let mainAttrs = {};
  let cur = { level: 1, id: "", heading: "", text: [], kw: [] };
  sections.push(cur);
  let h1 = "";

  const stack = []; // {name, skip, idCarrier}
  let skipDepth = 0;
  let heading = null; // {level, id, parts[]}
  let pre = null; // {parts[]}
  let code = null; // inline code parts

  const push = (s) => {
    if (heading) heading.parts.push(s);
    else if (pre) pre.parts.push(s);
    else cur.text.push(s);
    if (code) code.push(s);
  };

  for (const tok of lex(src)) {
    if (tok.type === "open") {
      const { name, attrs } = tok;
      if (name === "main") { mainAttrs = attrs; continue; }
      const isVoid = VOID.has(name) || tok.selfClosing;
      if (skipDepth > 0 || SKIP.has(name) || SKIP_CLASS.test(attrs.class || "") || "data-search-ignore" in attrs || attrs["aria-hidden"] === "true" || "hidden" in attrs) {
        if (!isVoid) { stack.push({ name, id: "" }); skipDepth++; }
        continue;
      }
      if (!isVoid) stack.push({ name, id: attrs.id || "" });
      if (!INLINE.has(name)) push(" ");
      if (name === "br" || name === "hr") continue;
      if (/^h[1-6]$/.test(name)) {
        heading = { level: +name[1], id: attrs.id || "", parts: [] };
      } else if (name === "pre") {
        pre = { parts: [] };
      } else if (name === "code" && !pre) {
        code = [];
      } else if (name === "img" && attrs.alt && !heading) {
        // alt text is meaningful content
        push(` ${attrs.alt} `);
      }
      continue;
    }
    if (tok.type === "close") {
      const { name } = tok;
      if (name === "main") break;
      // pop to the matching open tag (tolerates unclosed <p>, <li> ...)
      let idx = -1;
      for (let k = stack.length - 1; k >= 0; k--) if (stack[k].name === name) { idx = k; break; }
      if (idx === -1) continue;
      while (stack.length > idx) {
        const fr = stack.pop();
        if (skipDepth > 0) { skipDepth--; continue; }
        closeEl(fr.name);
      }
      continue;
    }
    if (skipDepth > 0) continue;
    push(decodeEntities(tok.text));
  }

  function closeEl(name) {
    if (/^h[1-6]$/.test(name) && heading && heading.level === +name[1]) {
      const text = ws(heading.parts.join("")).replace(/\s*[#¶§]\s*$/, "");
      const level = heading.level;
      let id = heading.id;
      if (!id) for (let k = stack.length - 1; k >= 0; k--) if (stack[k].id && /^(details|section|article)$/.test(stack[k].name)) { id = stack[k].id; break; }
      heading = null;
      if (level === 1) { if (!h1) h1 = text; cur.text.push(" "); return; }
      if ((level === 2 || level === 3) && id) {
        cur = { level, id, heading: text, text: [], kw: [] };
        sections.push(cur);
      } else {
        cur.text.push(` ${text}. `);
      }
      return;
    }
    if (name === "pre" && pre) {
      cur.kw.push(...codeKeywords(pre.parts.join(""), false));
      pre = null;
      cur.text.push(" ");
      return;
    }
    if (name === "code" && code) {
      cur.kw.push(...codeKeywords(code.join(""), true));
      code = null;
      return;
    }
    if (!INLINE.has(name)) push(" ");
  }

  return { mainAttrs, sections, h1 };
}

function cap(text, max) {
  if (text.length <= max) return text;
  const cut = text.lastIndexOf(" ", max);
  return text.slice(0, cut > max * 0.8 ? cut : max) + "…";
}

function readMeta(html, name) {
  const re = new RegExp(`<meta\\s+[^>]*name=["']${name}["'][^>]*>`, "i");
  const m = re.exec(html);
  if (!m) return "";
  const c = /content=["']([^"']*)["']/i.exec(m[0]);
  return c ? decodeEntities(c[1]) : "";
}

// ---------------------------------------------------------------- main export
export function buildSearchIndex(renderedPages) {
  const E = loadEngine();
  const pages = [];
  const records = [];
  let skipped = 0;
  let keywordCount = 0;

  const sorted = [...renderedPages].filter((x) => x && x.page && typeof x.html === "string");
  // docs first, then site pages: stable, deterministic order.
  sorted.sort((a, b) => String(a.page.path).localeCompare(String(b.page.path)));

  for (const { page, html } of sorted) {
    const robots = readMeta(html, "robots");
    // A staging build marks every page noindex, so only a page's own noindex counts.
    if (page.search === false || page.noindex || (/noindex/i.test(robots) && !site.staging)) { skipped++; continue; }
    const ex = extract(html);
    if (!ex) { skipped++; continue; }
    const path = page.path || "/";
    const kind = kindFor(path);
    // Display title: docs use their (cleaned) document title; marketing pages use the short
    // breadcrumb name ("FAQ", "Features") rather than the long SEO <title>.
    const crumbs = Array.isArray(page.breadcrumbs) ? page.breadcrumbs : [];
    const crumb = crumbs.length ? ws(String(crumbs[crumbs.length - 1].name || "")) : "";
    let title = page.searchTitle || "";
    if (!title && path === "/") title = "Home";
    if (!title && path === "/docs/") title = "Documentation";
    if (!title && !DOC_KINDS.has(kind) && crumb) title = crumb;
    if (!title) title = cleanTitle(page.title || "") || ex.h1 || "PowerDNS-AuthAdmin";
    const section = ws(ex.mainAttrs["data-search-section"] || "") || sectionFallback(path, kind);
    const desc = ws(page.description || readMeta(html, "description"));
    const pIdx = pages.length;
    pages.push([path, title, section, kind, desc]);

    let lastH2 = -1;
    for (const s of ex.sections) {
      let content = ws(s.text.join(""));
      const kw = [...new Set(s.kw.map((k) => k.trim()).filter((k) => k.length > 1 && k.length < 80))].slice(0, KEYWORDS_MAX);
      keywordCount += kw.length;
      const isPage = s.level === 1;
      if (isPage && !content) content = desc;
      if (!isPage && !content && !kw.length && !s.heading) continue;
      let rk = "";
      if (kind === "doc") {
        const envVars = kw.filter((k) => ENV_INLINE.test(k)).length;
        const endpoints = kw.filter((k) => new RegExp(`^(?:(?:${HTTP}) )?\\/api\\/`).test(k)).length;
        const lead = s.heading + " " + content.slice(0, 200);
        // A section that documents endpoints is "api"; one that is mostly env vars is "config".
        if (endpoints >= 1 && /\bapi\b|endpoint|route/i.test(lead)) rk = "api";
        else if (envVars >= 3 || (envVars >= 1 && /environment|variables?|settings|\.env/i.test(s.heading))) rk = "config";
      }
      const idx = records.length;
      records.push([pIdx, isPage ? "" : s.id, isPage ? "" : s.heading, s.level === 3 ? lastH2 : -1, cap(content, CONTENT_MAX), kw, rk]);
      if (s.level === 2) lastH2 = idx;
    }
  }

  // vocabulary + document frequency, using exactly the client's tokenizer.
  const df = new Map();
  for (const r of records) {
    const p = pages[r[0]];
    const terms = new Set();
    const add = (s) => { for (const t of E.indexTokens(s)) terms.add(t); };
    add(p[1]); add(p[2]); add(r[2]); add(r[4]); add(r[5].join(" "));
    if (r[1] === "") add(p[4]);
    if (r[3] >= 0) add(records[r[3]][2]);
    for (const t of terms) df.set(t, (df.get(t) || 0) + 1);
  }
  const vocab = [...df.keys()].sort();
  const out = { v: 1, p: pages, r: records, w: vocab.join(" "), d: vocab.map((t) => df.get(t)) };
  const json = JSON.stringify(out);
  const stats = {
    pages: pages.length,
    records: records.length,
    terms: vocab.length,
    keywords: keywordCount,
    skipped,
    bytes: Buffer.byteLength(json),
  };
  return { json, stats };
}

export default buildSearchIndex;
