// Zero-dependency GitHub Flavored Markdown renderer for the PowerDNS-AuthAdmin docs.
//
// Covers what the upstream docs/ use: ATX + setext headings (GitHub slug ids),
// paragraphs, emphasis/strong/strikethrough, code spans, links, autolinks
// (angle + bare URLs), images, nested ordered/unordered lists, task lists,
// fenced + indented code, blockquotes (GitHub alerts and "**Note:**" styles
// become callouts), GFM tables with alignment, thematic breaks, hard breaks.
//
// Raw HTML is sanitised, never passed through verbatim. A small allowlist of tags
// (picture/source/img, table cells, br, details/summary, kbd, sub/sup, a, em,
// strong, code) and attributes survives with their values re-escaped; every other
// tag, including placeholders like <slug> or <zone> that the docs write as literal
// text, is escaped. Tags are balanced per block, so a stray closer can never leak
// out of the article. <img>/<source> pointing at ../screenshots/<theme>/<name>.png
// become the site's own screenshot (both theme variants, srcset from opts.shots)
// when the name is known; otherwise the picture degrades to a link to the file on
// GitHub (opts.link(url, "image")). Images are never hotlinked: img-src is 'self'.
//
// render(md, opts) -> { html, headings:[{depth,id,text}], title, titleId, firstParagraphText, text }
//
// opts:
//   link(url, kind)      -> { href, external? } | string   (kind: "link" | "image")
//   code(code, lang)     -> html for a fenced/indented block (default: plain <pre>)
//   callout(type, titleHtml, innerHtml) -> html
//   shots                {<name>: {width, height, widths}} from src/shots.json
//   shotSrc(theme, name, width) -> url of one rendition (default /assets/img/shots/...)
//   href(path)           prefix for site-relative asset paths (default identity)
//   anchors: boolean     add "#" permalink anchors to h2-h6 (default true)
//   stripTitle: boolean  drop the first h1 from html (it is returned as `title`)

const ESC = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
export const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ESC[c]);
const escText = (s) => String(s).replace(/[&<>"]/g, (c) => ESC[c]);
// Like escText, but keeps character references (&nbsp;, &#x2192;) that raw HTML relies on.
const escKeepEntities = (s) =>
  String(s).replace(/&(?!(?:#x[0-9a-f]{1,6}|#\d{1,7}|[a-z][a-z0-9]{1,31});)/gi, "&amp;").replace(/[<>"]/g, (c) => ESC[c]);

const ENT = { amp: "&", lt: "<", gt: ">", quot: '"', "#39": "'", nbsp: " ", mdash: "—", ndash: "–", hellip: "…", rarr: "→", larr: "←" };
export function decode(s) {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z0-9]+);/gi, (m, e) => {
    if (e[0] === "#") {
      const n = e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(n) ? String.fromCodePoint(n) : m;
    }
    return ENT[e.toLowerCase()] ?? m;
  });
}
export const stripTags = (html) => decode(html.replace(/<[^>]*>/g, ""));

/** GitHub-compatible heading slug (github-slugger algorithm). */
export function slugify(text) {
  return text
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{M}\p{N}\p{Pc} -]/gu, "")
    .replace(/ /g, "-");
}

export function createSlugger() {
  const seen = new Map();
  return (text) => {
    const base = slugify(text);
    let slug = base;
    if (seen.has(base)) {
      let n = seen.get(base);
      do slug = `${base}-${++n}`;
      while (seen.has(slug));
      seen.set(base, n);
    }
    seen.set(slug, seen.get(slug) ?? 0);
    return slug;
  };
}

// ---------------------------------------------------------------- inline

const PUNCT = /[!-/:-@[-`{-~\p{P}\p{S}]/u;
const WS = /\s/u;
const isPunct = (c) => !!c && PUNCT.test(c);
const isWs = (c) => !c || WS.test(c);

function findCodeEnd(src, i, n) {
  // returns index of a closing backtick run of exactly n starting at/after i, or -1
  let j = i;
  while ((j = src.indexOf("`", j)) !== -1) {
    let k = j;
    while (src[k] === "`") k++;
    if (k - j === n) return j;
    j = k;
  }
  return -1;
}

/** Find the `]` that closes the `[` at index i (respecting escapes, code spans, nesting). */
function findBracketClose(src, i) {
  let depth = 0;
  for (let j = i; j < src.length; j++) {
    const c = src[j];
    if (c === "\\") { j++; continue; }
    if (c === "`") {
      let k = j;
      while (src[k] === "`") k++;
      const end = findCodeEnd(src, k, k - j);
      if (end !== -1) { j = end + (k - j) - 1; continue; }
      j = k - 1;
      continue;
    }
    if (c === "[") depth++;
    else if (c === "]" && --depth === 0) return j;
  }
  return -1;
}

/** Parse `(dest "title")` at index i (src[i] === "("). Returns { dest, title, end } or null. */
function parseLinkTail(src, i) {
  if (src[i] !== "(") return null;
  let j = i + 1;
  while (src[j] === " " || src[j] === "\n") j++;
  let dest = "";
  if (src[j] === "<") {
    const e = src.indexOf(">", j);
    if (e === -1) return null;
    dest = src.slice(j + 1, e);
    j = e + 1;
  } else {
    let depth = 0;
    const s = j;
    for (; j < src.length; j++) {
      const c = src[j];
      if (c === "\\" && isPunct(src[j + 1])) { j++; continue; }
      if (c === "(") depth++;
      else if (c === ")") { if (depth === 0) break; depth--; }
      else if (/\s/.test(c)) break;
    }
    dest = src.slice(s, j);
  }
  while (src[j] === " " || src[j] === "\n") j++;
  let title = null;
  const q = src[j];
  if (q === '"' || q === "'" || q === "(") {
    const close = q === "(" ? ")" : q;
    const e = src.indexOf(close, j + 1);
    if (e === -1) return null;
    title = src.slice(j + 1, e);
    j = e + 1;
    while (src[j] === " " || src[j] === "\n") j++;
  }
  if (src[j] !== ")") return null;
  return { dest: dest.replace(/\\([!-/:-@[-`{-~])/g, "$1"), title, end: j + 1 };
}

const BARE_URL = /^(?:https?:\/\/|www\.)[^\s<]+/i;
function trimUrl(u) {
  for (;;) {
    const last = u[u.length - 1];
    if (/[?!.,:*_~'";]/.test(last)) { u = u.slice(0, -1); continue; }
    if (last === ")") {
      const open = (u.match(/\(/g) || []).length;
      const close = (u.match(/\)/g) || []).length;
      if (close > open) { u = u.slice(0, -1); continue; }
    }
    return u;
  }
}

function linkAttrs(ctx, url, kind) {
  let r = ctx.opts.link ? ctx.opts.link(url, kind) : url;
  if (typeof r === "string") r = { href: r };
  if (r.external === undefined) r.external = /^https?:\/\//i.test(r.href);
  return r;
}

function renderLink(ctx, url, innerHtml, title) {
  const r = linkAttrs(ctx, url, "link");
  const t = title ? ` title="${esc(title)}"` : "";
  const ext = r.external ? ` rel="noopener"` : "";
  const cls = r.class ? ` class="${esc(r.class)}"` : "";
  return `<a href="${esc(r.href)}"${cls}${t}${ext}>${innerHtml}</a>`;
}

export function renderInline(src, ctx, noLinks = false) {
  const nodes = [];
  let text = "";
  const flush = () => { if (text) { nodes.push({ t: "text", v: text }); text = ""; } };
  const pushHtml = (v) => { flush(); nodes.push({ t: "html", v }); };
  const n = src.length;
  let i = 0;
  while (i < n) {
    const c = src[i];
    // backslash escapes and hard breaks
    if (c === "\\") {
      const d = src[i + 1];
      if (d === "\n") { text = text.replace(/ +$/, ""); pushHtml("<br>\n"); i += 2; while (src[i] === " ") i++; continue; }
      if (d && /[!-/:-@[-`{-~]/.test(d)) { text += escText(d); i += 2; continue; }
      text += "\\"; i++; continue;
    }
    if (c === "`") {
      let k = i;
      while (src[k] === "`") k++;
      const run = k - i;
      const end = findCodeEnd(src, k, run);
      if (end === -1) { text += "`".repeat(run); i = k; continue; }
      let code = src.slice(k, end).replace(/\n/g, " ");
      if (/^ .*[^ ].* $/.test(code) || (code.length > 2 && code[0] === " " && code[code.length - 1] === " " && code.trim())) code = code.slice(1, -1);
      pushHtml(`<code>${esc(code)}</code>`);
      i = end + run;
      continue;
    }
    if (c === "\n") {
      const hard = / {2,}$/.test(text);
      text = text.replace(/ +$/, "");
      if (hard) pushHtml("<br>\n");
      else text += "\n";
      i++;
      while (src[i] === " ") i++;
      continue;
    }
    if (c === "<") {
      const m = /^<([a-zA-Z][a-zA-Z0-9+.-]{1,31}:[^\s<>]*)>/.exec(src.slice(i));
      if (m && !noLinks) { pushHtml(renderLink(ctx, m[1], esc(m[1]))); i += m[0].length; continue; }
      const e = /^<([a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)+)>/.exec(src.slice(i));
      if (e && !noLinks) { pushHtml(`<a href="mailto:${esc(e[1])}">${esc(e[1])}</a>`); i += e[0].length; continue; }
      const tag = parseTag(src, i);
      if (tag && INLINE_TAGS.has(tag.name)) {
        const out = renderTag(tag, ctx, "inline");
        if (out !== null) { flush(); nodes.push({ t: "tag", name: tag.name, close: tag.close, open: !tag.close && !VOID.has(tag.name), v: out }); i += tag.length; continue; }
      }
      text += "&lt;"; i++; continue;
    }
    if (c === "&") {
      const m = /^&(#x[0-9a-f]{1,6}|#\d{1,7}|[a-z][a-z0-9]{1,31});/i.exec(src.slice(i, i + 40));
      if (m) { text += m[0]; i += m[0].length; continue; }
      text += "&amp;"; i++; continue;
    }
    if ((c === "!" && src[i + 1] === "[") || c === "[") {
      const img = c === "!";
      const open = img ? i + 1 : i;
      const close = findBracketClose(src, open);
      if (close !== -1 && (img || !noLinks)) {
        const tail = parseLinkTail(src, close + 1);
        if (tail) {
          const label = src.slice(open + 1, close);
          if (img) {
            pushHtml(image(ctx, tail.dest, stripTags(renderInline(label, ctx, true)), "inline"));
          } else {
            pushHtml(renderLink(ctx, tail.dest, renderInline(label, ctx, true), tail.title));
          }
          i = tail.end;
          continue;
        }
      }
      text += img ? "!" : "["; i++; continue;
    }
    if (c === "*" || c === "_" || c === "~") {
      let k = i;
      while (src[k] === c) k++;
      const run = k - i;
      const before = i > 0 ? src[i - 1] : "";
      const after = src[k] || "";
      const left = !isWs(after) && (!isPunct(after) || isWs(before) || isPunct(before));
      const right = !isWs(before) && (!isPunct(before) || isWs(after) || isPunct(after));
      let canOpen = left, canClose = right;
      if (c === "_") {
        canOpen = left && (!right || isPunct(before));
        canClose = right && (!left || isPunct(after));
      }
      if (c === "~" && run > 2) { text += "~".repeat(run); i = k; continue; }
      flush();
      nodes.push({ t: "delim", ch: c, n: run, orig: run, canOpen, canClose, pre: "" });
      i = k;
      continue;
    }
    // bare URL autolinks (GFM extension)
    if (!noLinks && (c === "h" || c === "w" || c === "H" || c === "W") && (i === 0 || /[\s(*_~]/.test(src[i - 1]))) {
      const m = BARE_URL.exec(src.slice(i));
      if (m) {
        const u = trimUrl(m[0]);
        if (/^www\./i.test(u) ? /^www\.[a-z0-9-]+\.[a-z]/i.test(u) : /^https?:\/\/[a-z0-9]/i.test(u)) {
          pushHtml(renderLink(ctx, /^www\./i.test(u) ? `https://${u}` : u, esc(u)));
          i += u.length;
          continue;
        }
      }
    }
    text += c === ">" ? "&gt;" : c === '"' ? "&quot;" : c;
    i++;
  }
  flush();
  processEmphasis(nodes);
  balanceTags(nodes);
  let out = "";
  for (const nd of nodes) out += nd.v;
  return out;
}

/** Drop unmatched closers and close whatever an inline run left open, so the paragraph stays well-formed. */
function balanceTags(nodes) {
  const stack = [];
  for (const nd of nodes) {
    if (nd.t !== "tag") continue;
    if (nd.open) { stack.push(nd); continue; }
    if (!nd.close) continue;
    const k = stack.map((o) => o.name).lastIndexOf(nd.name);
    if (k === -1) { nd.v = ""; continue; }
    // Close anything opened after it first (<em><kbd></em> -> <em><kbd></kbd></em>).
    nd.v = stack.splice(k).reverse().map((o) => `</${o.name}>`).join("");
  }
  if (stack.length) nodes.push({ t: "html", v: stack.reverse().map((o) => `</${o.name}>`).join("") });
}

// ---------------------------------------------------------------- raw HTML (allowlisted, sanitised)

// Tags that survive, with the attributes each may keep. p/div only carry align
// (features.md centres screenshots with them) and come out as <div> so a nested <p>
// cannot produce invalid HTML.
const ALLOW = {
  picture: [], source: ["srcset", "media"], img: ["src", "alt", "width", "height", "title"],
  a: ["href", "title"], br: [], details: ["open"], summary: [], kbd: [], sub: [], sup: [],
  table: [], thead: [], tbody: [], tr: [], th: ["align"], td: ["align"],
  em: [], strong: [], code: [], p: ["align"], div: ["align"],
};
const VOID = new Set(["br", "img", "source"]);
const INLINE_TAGS = new Set(["a", "br", "kbd", "sub", "sup", "em", "strong", "code", "img"]);
const BLOCK_START = /^ {0,3}<\/?(picture|table|thead|tbody|tr|td|th|details|summary|p|div|figure)(?=[\s/>]|$)/i;
const ATTR_RE = /([^\s"'<>\/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
const SHOT_RE = /(?:^|\/)screenshots\/(?:dark|light)\/([a-z0-9][a-z0-9-]*)\.png$/i;

/** Parse one tag at src[i] === "<". Returns { name, close, attrs, length } or null. */
function parseTag(src, i) {
  const m = /^<(\/?)([a-zA-Z][a-zA-Z0-9-]*)((?:\s+[^\s"'<>\/=]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'=<>`]+))?)*)\s*(\/?)>/.exec(src.slice(i, i + 2000));
  if (!m) return null;
  const attrs = {};
  for (const a of m[3].matchAll(ATTR_RE)) attrs[a[1].toLowerCase()] = decode(a[2] ?? a[3] ?? a[4] ?? "");
  return { name: m[2].toLowerCase(), close: m[1] === "/", attrs, length: m[0].length };
}

const SAFE_URL = /^(?:https?:|mailto:|tel:|#|\/|\.|[a-z0-9_-]+(?:[/#?]|$))/i;

/** Sanitised HTML for one allowlisted tag, or null when it must be escaped instead. */
function renderTag(tag, ctx, mode) {
  const spec = ALLOW[tag.name];
  if (!spec) return null;
  let name = tag.name;
  if (tag.close) return VOID.has(name) ? "" : `</${name === "p" ? "div" : name}>`;
  if (name === "img") return image(ctx, tag.attrs.src || "", tag.attrs.alt || "", mode, tag.attrs);
  const out = [];
  const cls = [];
  for (const k of spec) {
    if (!(k in tag.attrs)) continue;
    const v = tag.attrs[k];
    if (k === "align") { if (/^(left|center|right)$/i.test(v)) cls.push(`align-${v.toLowerCase()}`); continue; }
    if (k === "open") { out.push(" open"); continue; }
    if (k === "href") {
      if (!SAFE_URL.test(v) || /^\s*javascript:/i.test(v)) continue;
      const r = linkAttrs(ctx, v, "link");
      out.push(` href="${esc(r.href)}"`);
      if (r.external) out.push(' rel="noopener"');
      continue;
    }
    if (k === "srcset" || k === "media") continue; // <source> is rebuilt by the picture rewrite
    out.push(` ${k}="${esc(v)}"`);
  }
  if (name === "p" || name === "div") { name = "div"; cls.unshift("md-html"); }
  if (name === "source") return ""; // only meaningful inside a <picture>, which is rewritten whole
  return `<${name}${cls.length ? ` class="${cls.join(" ")}"` : ""}${out.join("")}>`;
}

/** The site's own screenshot for a ../screenshots/<theme>/<name>.png reference, or null. */
function shotHtml(ctx, name, alt, mode, hint = {}) {
  const meta = ctx.opts.shots && ctx.opts.shots[name];
  if (!meta) return null;
  const href = ctx.opts.href || ((p) => p);
  const src = ctx.opts.shotSrc || ((theme, n, w) => `/assets/img/shots/${theme}/${n}-${w}.webp`);
  const main = meta.widths.includes(960) ? 960 : meta.widths[0];
  const narrow = Number(hint.width) > 0 && Number(hint.width) <= 400;
  const sizes = narrow ? "(min-width: 640px) 280px, 60vw" : "(min-width: 860px) 800px, 94vw";
  const imgs = ["dark", "light"]
    .map((t) => `<img class="shot shot-${t}" src="${esc(href(src(t, name, main)))}" srcset="${meta.widths.map((w) => `${esc(href(src(t, name, w)))} ${w}w`).join(", ")}" sizes="${sizes}" width="${meta.width}" height="${meta.height}" alt="${esc(alt)}" loading="lazy" decoding="async">`)
    .join("");
  const tag = mode === "inline" ? "span" : "figure";
  return `<${tag} class="doc-shot${narrow ? " doc-shot-narrow" : ""}">${imgs}</${tag}>`;
}

/** An image reference: a local screenshot when known, otherwise a link to the file upstream. */
function image(ctx, url, alt, mode, hint = {}) {
  const m = SHOT_RE.exec(url.split(/[?#]/)[0]);
  const shot = m && shotHtml(ctx, m[1], alt, mode, hint);
  if (shot) return shot;
  const r = linkAttrs(ctx, url, "image");
  const label = alt || url.split("/").pop();
  const a = `<a class="doc-shot-link" href="${esc(r.href)}"${r.external ? ' rel="noopener"' : ""}>${esc(label)}<span class="doc-shot-link-note"> (screenshot on GitHub)</span></a>`;
  return mode === "inline" ? a : `<p class="doc-shot-fallback">${a}</p>`;
}

/** Sanitise a raw HTML block: rewrite pictures, allowlist tags/attributes, balance nesting. */
function renderHtmlBlock(raw, ctx) {
  let html = raw.replace(/<!--[\s\S]*?-->/g, "");
  // <picture> is rewritten as a unit from its <img> (src, alt, width); <source> only
  // duplicates the dark variant, which the site's own two-theme markup covers.
  html = html.replace(/<picture\b[^>]*>([\s\S]*?)<\/picture>/gi, (all, inner) => {
    const im = /<img\b[^>]*>/i.exec(inner);
    const tag = im ? parseTag(im[0], 0) : null;
    const out = tag ? image(ctx, tag.attrs.src || "", tag.attrs.alt || "", "block", tag.attrs) : "";
    return `\u0000${ctx.keep.push(out) - 1}\u0000`;
  });
  let out = "";
  const stack = [];
  let i = 0;
  while (i < html.length) {
    const lt = html.indexOf("<", i);
    if (lt === -1) { out += escKeepEntities(html.slice(i)); break; }
    out += escKeepEntities(html.slice(i, lt));
    const tag = parseTag(html, lt);
    if (!tag) { out += "&lt;"; i = lt + 1; continue; }
    i = lt + tag.length;
    const rendered = renderTag(tag, ctx, "block");
    if (rendered === null) { out += escKeepEntities(html.slice(lt, i)); continue; }
    if (tag.close) {
      const name = tag.name === "p" ? "div" : tag.name;
      const k = stack.lastIndexOf(name);
      if (k === -1) continue;
      out += stack.splice(k).reverse().map((n) => `</${n}>`).join("");
      continue;
    }
    out += rendered;
    if (rendered && !VOID.has(tag.name) && tag.name !== "source") stack.push(tag.name === "p" ? "div" : tag.name);
  }
  out += stack.reverse().map((n) => `</${n}>`).join("");
  out = out.replace(/\u0000(\d+)\u0000/g, (_, k) => ctx.keep[k]);
  // Tables scroll inside the same wrapper GFM tables get; bare <tr> rows get the
  // <tbody> the parser would imply anyway.
  if (/^\s*<table\b/i.test(out)) {
    if (!/<t(?:head|body|foot)\b/i.test(out)) out = out.replace(/(<table\b[^>]*>)/i, "$1<tbody>").replace(/<\/table>/i, "</tbody></table>");
    out = `<div class="table-wrap" tabindex="0">${out}</div>`;
  }
  return out.replace(/^\s+|\s+$/g, "");
}

function processEmphasis(nodes) {
  // CommonMark "process emphasis" over delimiter nodes. For an opener, `pre`
  // holds open tags (literal leftover chars go before them); for a closer,
  // `post` holds close tags (leftover chars go after them).
  for (let ci = 0; ci < nodes.length; ci++) {
    const closer = nodes[ci];
    if (closer.t !== "delim" || !closer.canClose) continue;
    while (closer.n > 0) {
      let oi = -1;
      for (let j = ci - 1; j >= 0; j--) {
        const o = nodes[j];
        if (o.t !== "delim" || o.ch !== closer.ch || !o.canOpen || o.n === 0) continue;
        if (o.ch === "~") { if (o.n !== closer.n) continue; }
        else if ((o.canClose || closer.canOpen) && (o.orig + closer.orig) % 3 === 0 && !(o.orig % 3 === 0 && closer.orig % 3 === 0)) continue;
        oi = j;
        break;
      }
      if (oi === -1) break;
      const opener = nodes[oi];
      const use = closer.ch === "~" ? closer.n : opener.n >= 2 && closer.n >= 2 ? 2 : 1;
      const tag = closer.ch === "~" ? "del" : use === 2 ? "strong" : "em";
      opener.n -= use;
      closer.n -= use;
      opener.pre = `<${tag}>` + opener.pre;
      closer.closeTags = (closer.closeTags || "") + `</${tag}>`;
      // delimiters between become literal
      for (let j = oi + 1; j < ci; j++) {
        const d = nodes[j];
        if (d.t === "delim") { nodes[j] = { t: "html", v: (d.closeTags || "") + d.ch.repeat(d.n) + d.pre }; }
      }
    }
  }
  for (let j = 0; j < nodes.length; j++) {
    const d = nodes[j];
    if (d.t === "delim") nodes[j] = { t: "html", v: (d.closeTags || "") + d.ch.repeat(d.n) + d.pre };
  }
}

// ---------------------------------------------------------------- blocks

const RE = {
  blank: /^[ \t]*$/,
  atx: /^ {0,3}(#{1,6})(?:[ \t]+|$)(.*?)(?:[ \t]+#+)?[ \t]*$/,
  fence: /^( {0,3})(`{3,}|~{3,})[ \t]*([^`\s]*)[^`]*$/,
  hr: /^ {0,3}([-*_])(?:[ \t]*\1){2,}[ \t]*$/,
  quote: /^ {0,3}> ?/,
  bullet: /^( {0,3})([-*+])( {1,4}|\t|$)/,
  ordered: /^( {0,3})(\d{1,9})([.)])( {1,4}|\t|$)/,
  setext1: /^ {0,3}=+[ \t]*$/,
  setext2: /^ {0,3}-+[ \t]*$/,
  tableDelim: /^ {0,3}\|?[ \t]*:?-+:?[ \t]*(?:\|[ \t]*:?-+:?[ \t]*)*\|?[ \t]*$/,
};

const indentOf = (line) => line.match(/^ */)[0].length;
const detab = (line) => (line.includes("\t") ? line.replace(/^[ \t]+/, (ws) => { let col = 0; for (const ch of ws) col = ch === "\t" ? col + 4 - (col % 4) : col + 1; return " ".repeat(col); }) : line);

function listMarker(line) {
  let m = RE.bullet.exec(line);
  if (m) {
    const indent = m[1].length;
    const pad = m[3] === "" ? 1 : m[3].length > 4 ? 1 : m[3].length;
    return { ordered: false, ch: m[2], indent, content: indent + 1 + (line.trim() === m[2] ? 1 : pad), start: 1, rest: line.slice(indent + 1 + (m[3] ? pad : 0)) };
  }
  m = RE.ordered.exec(line);
  if (m) {
    const indent = m[1].length;
    const w = m[2].length + 1;
    const pad = m[4] === "" ? 1 : m[4].length;
    return { ordered: true, ch: m[3], indent, content: indent + w + pad, start: parseInt(m[2], 10), rest: line.slice(indent + w + (m[4] ? pad : 0)) };
  }
  return null;
}

function isTableStart(lines, i) {
  return lines[i].includes("|") && i + 1 < lines.length && RE.tableDelim.test(lines[i + 1]) && lines[i + 1].includes("-") &&
    (lines[i + 1].includes("|") || splitRow(lines[i]).length === 1) && splitRow(lines[i]).length === splitRow(lines[i + 1]).length;
}

/** Can `line` start a block that interrupts a paragraph? */
function interrupts(line, lines, i) {
  if (RE.atx.test(line) || RE.fence.test(line) || RE.hr.test(line) || RE.quote.test(line) || BLOCK_START.test(line)) return true;
  const lm = listMarker(line);
  if (lm && lm.rest.trim() !== "" && (!lm.ordered || lm.start === 1)) return true;
  if (lines && isTableStart(lines, i)) return true;
  return false;
}

function splitRow(line) {
  let s = line.trim();
  if (s.startsWith("|")) s = s.slice(1);
  if (s.endsWith("|") && !s.endsWith("\\|")) s = s.slice(0, -1);
  const cells = [];
  let cur = "";
  for (let j = 0; j < s.length; j++) {
    const ch = s[j];
    if (ch === "\\" && s[j + 1] === "|") { cur += "|"; j++; continue; }
    if (ch === "|") { cells.push(cur.trim()); cur = ""; continue; }
    cur += ch;
  }
  cells.push(cur.trim());
  return cells;
}

const ALERTS = { note: "Note", tip: "Tip", important: "Important", warning: "Warning", caution: "Caution" };
const LEAD_TYPES = [
  [/^(note|nb|info)$/i, "note"],
  [/^(tip|hint|recommended)$/i, "tip"],
  [/^(important)$/i, "important"],
  [/^(warning|warn|security)$/i, "warning"],
  [/^(caution|danger)$/i, "caution"],
];

/**
 * Parse lines into an array of blocks.
 * Block: { type, html?, blank (blank line(s) before it) , ... }
 */
function parseBlocks(lines, ctx) {
  const blocks = [];
  let i = 0;
  let blank = false;
  const n = lines.length;
  while (i < n) {
    const line = detab(lines[i]);
    if (RE.blank.test(line)) { blank = true; i++; continue; }
    const push = (b) => { b.blank = blank; blank = false; blocks.push(b); };

    // indented code
    if (/^ {4}/.test(line)) {
      const buf = [];
      while (i < n && (/^ {4}/.test(detab(lines[i])) || RE.blank.test(lines[i]))) { buf.push(detab(lines[i]).slice(4)); i++; }
      while (buf.length && RE.blank.test(buf[buf.length - 1])) buf.pop();
      push({ type: "code", html: ctx.code(buf.join("\n"), "") });
      continue;
    }
    // fenced code
    let m = RE.fence.exec(line);
    if (m) {
      const ind = m[1].length, fence = m[2], lang = m[3].replace(/\\(.)/g, "$1").toLowerCase();
      const buf = [];
      i++;
      const closeRe = new RegExp(`^ {0,3}${fence[0] === "`" ? "`" : "~"}{${fence.length},}[ \\t]*$`);
      while (i < n && !closeRe.test(lines[i])) {
        let l = detab(lines[i]);
        const k = Math.min(ind, indentOf(l));
        buf.push(l.slice(k));
        i++;
      }
      i++; // closing fence (or EOF)
      push({ type: "code", html: ctx.code(buf.join("\n"), lang) });
      continue;
    }
    // ATX heading
    m = RE.atx.exec(line);
    if (m) { push(heading(m[1].length, m[2].trim(), ctx)); i++; continue; }
    // thematic break
    if (RE.hr.test(line)) { push({ type: "hr", html: "<hr>" }); i++; continue; }
    // blockquote
    if (RE.quote.test(line)) {
      const buf = [];
      let lastWasPara = false;
      while (i < n) {
        const l = detab(lines[i]);
        if (RE.quote.test(l)) {
          const inner = l.replace(RE.quote, "");
          buf.push(inner);
          lastWasPara = !RE.blank.test(inner) && !RE.fence.test(inner);
          i++;
        } else if (lastWasPara && !RE.blank.test(l) && !interrupts(l)) {
          buf.push(l); i++;
        } else break;
      }
      push(blockquote(buf, ctx));
      continue;
    }
    // raw HTML block (CommonMark type 6: runs to the next blank line)
    if (BLOCK_START.test(line)) {
      const buf = [];
      while (i < n && !RE.blank.test(lines[i])) { buf.push(lines[i]); i++; }
      push({ type: "html", html: renderHtmlBlock(buf.join("\n"), ctx) });
      continue;
    }
    // list
    const lm = listMarker(line);
    if (lm) { const r = parseList(lines, i, lm, ctx); push(r.block); i = r.i; continue; }
    // table
    if (isTableStart(lines, i)) { const r = parseTable(lines, i, ctx); push(r.block); i = r.i; continue; }
    // paragraph (+ setext heading)
    const buf = [line.replace(/^ +/, "")];
    i++;
    let setext = 0;
    while (i < n) {
      const l = detab(lines[i]);
      if (RE.blank.test(l)) break;
      if (RE.setext1.test(l)) { setext = 1; i++; break; }
      if (RE.setext2.test(l)) { setext = 2; i++; break; }
      if (interrupts(l, lines, i)) break;
      buf.push(l.replace(/^ +/, ""));
      i++;
    }
    const raw = buf.join("\n").replace(/[ \t]+$/, "");
    if (setext) push(heading(setext, raw, ctx));
    else push({ type: "p", inner: renderInline(raw, ctx), raw });
  }
  return blocks;
}

function heading(depth, raw, ctx) {
  // A page has one h1 (its title); later top-level headings render as h2.
  if (depth === 1 && ctx.seenH1) depth = 2;
  if (depth === 1) ctx.seenH1 = true;
  const inner = renderInline(raw, ctx);
  const text = stripTags(inner).replace(/\s+/g, " ").trim();
  const id = ctx.slug(text);
  ctx.headings.push({ depth, id, text });
  let html;
  if (depth === 1 || ctx.opts.anchors === false) html = `<h${depth} id="${id}">${inner}</h${depth}>`;
  else html = `<h${depth} id="${id}">${inner}<a class="heading-anchor" href="#${id}" aria-label="Link to this section: ${esc(text)}" data-search-ignore>#</a></h${depth}>`;
  return { type: "h", depth, id, text, html };
}

function parseList(lines, i, first, ctx) {
  const n = lines.length;
  const items = [];
  let loose = false;
  let sawBlankBetween = false;
  while (i < n) {
    const line = detab(lines[i]);
    const lm = listMarker(line);
    if (!lm || lm.ordered !== first.ordered || lm.ch !== first.ch) break;
    if (items.length && RE.hr.test(line)) break;
    if (sawBlankBetween) loose = true;
    const content = lm.rest.trim() === "" ? lm.indent + (lm.ordered ? String(lm.start).length + 2 : 2) : lm.content;
    const itemLines = [lm.rest];
    i++;
    let prevBlank = lm.rest.trim() === "";
    let inFence = RE.fence.test(lm.rest) ? RE.fence.exec(lm.rest)[2] : null;
    while (i < n) {
      const l = detab(lines[i]);
      if (RE.blank.test(l)) { itemLines.push(""); prevBlank = true; i++; continue; }
      const ind = indentOf(l);
      if (ind >= content) {
        const inner = l.slice(content);
        itemLines.push(inner);
        const fm = RE.fence.exec(inner);
        if (inFence) { if (new RegExp(`^ {0,3}${inFence[0] === "`" ? "`" : "~"}{${inFence.length},}[ \\t]*$`).test(inner)) inFence = null; }
        else if (fm) inFence = fm[2];
        prevBlank = false; i++; continue;
      }
      if (inFence) {
        // under-indented line inside a fence that belongs to this item
        itemLines.push(l.slice(Math.min(ind, content)));
        if (new RegExp(`^ {0,3}${inFence[0] === "`" ? "`" : "~"}{${inFence.length},}[ \\t]*$`).test(l.trim())) inFence = null;
        i++; continue;
      }
      if (prevBlank) break;
      // lazy paragraph continuation
      if (interrupts(l, lines, i) || listMarker(l)) break;
      itemLines.push(l.trim());
      i++;
    }
    // trailing blank lines belong between items
    sawBlankBetween = false;
    while (itemLines.length > 1 && itemLines[itemLines.length - 1] === "") { itemLines.pop(); sawBlankBetween = true; }
    items.push({ lines: itemLines, start: lm.start });
  }
  if (sawBlankBetween && i < n) {
    // a blank followed by something that is not another item ends the list: not loose
  }
  const rendered = items.map((it) => {
    let task = null;
    const tm = /^\[([ xX])\][ \t]+/.exec(it.lines[0]);
    if (tm) { task = tm[1] !== " "; it.lines[0] = it.lines[0].slice(tm[0].length); }
    const blocks = parseBlocks(it.lines, ctx);
    if (blocks.slice(1).some((b) => b.blank)) loose = true;
    return { blocks, task };
  });
  const body = rendered
    .map(({ blocks, task }) => {
      const inner = blocks
        .map((b, k) => (b.type === "p" ? (loose ? `<p>${b.inner}</p>` : b.inner + (k < blocks.length - 1 ? "\n" : "")) : b.html))
        .join(loose ? "\n" : "");
      if (task === null) return `<li>${inner}</li>`;
      return `<li class="task-list-item"><input type="checkbox" disabled${task ? " checked" : ""} aria-label="${task ? "Done" : "To do"}"> ${inner}</li>`;
    })
    .join("\n");
  const tag = first.ordered ? "ol" : "ul";
  const start = first.ordered && first.start !== 1 ? ` start="${first.start}"` : "";
  const cls = rendered.some((r) => r.task !== null) ? ` class="contains-task-list"` : "";
  return { block: { type: "list", html: `<${tag}${start}${cls}>\n${body}\n</${tag}>` }, i };
}

function parseTable(lines, i, ctx) {
  const head = splitRow(lines[i]);
  const aligns = splitRow(lines[i + 1]).map((c) => (c.startsWith(":") && c.endsWith(":") ? "center" : c.endsWith(":") ? "right" : c.startsWith(":") ? "left" : ""));
  i += 2;
  const rows = [];
  while (i < lines.length && !RE.blank.test(lines[i]) && lines[i].includes("|") && !RE.quote.test(lines[i]) && !RE.fence.test(lines[i])) {
    rows.push(splitRow(lines[i]));
    i++;
  }
  const cell = (tag, txt, k) => `<${tag}${aligns[k] ? ` class="align-${aligns[k]}"` : ""}>${renderInline(txt ?? "", ctx)}</${tag}>`;
  const thead = `<thead><tr>${head.map((c, k) => cell("th", c, k)).join("")}</tr></thead>`;
  const tbody = rows.length ? `<tbody>\n${rows.map((r) => `<tr>${head.map((_, k) => cell("td", r[k], k)).join("")}</tr>`).join("\n")}\n</tbody>` : "";
  ctx.tables++;
  return {
    block: { type: "table", html: `<div class="table-wrap" tabindex="0"><table>\n${thead}\n${tbody}\n</table></div>` },
    i,
  };
}

function blockquote(lines, ctx) {
  // GitHub alert: > [!NOTE]
  const am = /^\s*\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*$/i.exec(lines[0] || "");
  if (am) {
    const type = am[1].toLowerCase();
    const inner = renderBlocks(parseBlocks(lines.slice(1), ctx));
    return { type: "callout", html: ctx.callout(type, ALERTS[type], inner) };
  }
  const blocks = parseBlocks(lines, ctx);
  const firstP = blocks[0] && blocks[0].type === "p" ? blocks[0] : null;
  // "> **Note:** text" / "> **Note**: text" / "> **Note.** text" / "> **`--local` security caveat:** text"
  const lead = firstP && /^<strong>(.+?)([.:]?)<\/strong>([.:]?)\s*/.exec(firstP.inner);
  if (lead && (lead[2] || lead[3])) {
    const label = stripTags(lead[1]).trim();
    const hit = LEAD_TYPES.find(([re]) => re.test(label));
    if (hit) {
      // Plain label (Note/Tip/...) becomes the title; strip it from the body.
      firstP.inner = firstP.inner.slice(lead[0].length);
      firstP.inner = firstP.inner.charAt(0).toUpperCase() + firstP.inner.slice(1);
      return { type: "callout", html: ctx.callout(hit[1], ALERTS[hit[1]], renderBlocks(blocks)) };
    }
    // Descriptive bold lead: keep it inline, pick a tone from its words.
    const type = /caveat|warning|danger|security|do not|never/i.test(label) ? "warning" : /important|required/i.test(label) ? "important" : "note";
    firstP.inner = firstP.inner.replace(/^<strong>(.+?)<\/strong>/, '<strong class="callout-lead">$1</strong>');
    return { type: "callout", html: ctx.callout(type, "", renderBlocks(blocks)) };
  }
  return { type: "quote", html: `<blockquote>\n${renderBlocks(blocks)}\n</blockquote>` };
}

function renderBlocks(blocks) {
  return blocks.map((b) => (b.type === "p" ? `<p>${b.inner}</p>` : b.html)).join("\n");
}

const defaultCode = (code, lang) => `<pre${lang ? ` data-lang="${esc(lang)}"` : ""}><code>${esc(code)}</code></pre>`;
const defaultCallout = (type, title, inner) =>
  `<div class="callout callout-${type}" role="note">${title ? `<p class="callout-title">${esc(title)}</p>` : ""}\n${inner}\n</div>`;

/** Render markdown to HTML. */
export function render(md, opts = {}) {
  const ctx = {
    opts,
    headings: [],
    tables: 0,
    slug: createSlugger(),
    code: opts.code || defaultCode,
    callout: opts.callout || defaultCallout,
    keep: [],
  };
  const lines = String(md).replace(/\r\n?/g, "\n").replace(/^﻿/, "").split("\n");
  const blocks = parseBlocks(lines, ctx);
  const h1 = blocks.find((b) => b.type === "h" && b.depth === 1);
  const title = h1 ? h1.text : "";
  const titleId = h1 ? h1.id : "";
  const out = opts.stripTitle && h1 ? blocks.filter((b) => b !== h1) : blocks;
  const html = renderBlocks(out);
  const firstP = blocks.find((b) => b.type === "p");
  const firstParagraphText = firstP ? stripTags(firstP.inner).replace(/\s+/g, " ").trim() : "";
  const text = stripTags(html.replace(/<a class="heading-anchor"[^>]*>#<\/a>/g, "").replace(/<\/(p|li|h\d|pre|tr|blockquote|div)>/g, "$&\n").replace(/<br>/g, "\n"))
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return { html, headings: ctx.headings, title, titleId, firstParagraphText, text };
}

export default render;
