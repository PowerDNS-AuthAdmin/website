// Check hook for scripts/check.mjs: validates the built search index in dist/.
// Called as check(ctx) with ctx = { dist, base, url, files, htmlFiles, read, resolve, ok }.
// The generic gate already asserts that exactly one index exists, parses and is < 1.5 MB;
// this hook looks inside it. The size limit is repeated here so the index stays small even
// if the generic check is relaxed one day.
import { existsSync, statSync } from "node:fs";
import { join } from "node:path";

const SIZE_LIMIT = 1.5 * 1024 * 1024;
const KINDS = new Set(["page", "doc", "config", "api", "adr", "faq"]);

export default function check(ctx) {
  const { files, read, resolve, base, ok } = ctx;
  const idxFiles = files.filter((f) => /\/assets\/search\/index\.[0-9a-f]+\.json$/.test(f));
  if (!ok(idxFiles.length === 1, `search: expected one index file, found ${idxFiles.length}`)) return;
  const file = idxFiles[0];
  const text = read(file);

  ok(statSync(file).size < SIZE_LIMIT, `search: index is ${(statSync(file).size / 1048576).toFixed(2)} MB (limit 1.5 MB)`);
  // The search engine was ported from another project's site. Its name must never appear
  // in this repository, so the pattern is assembled from fragments rather than spelled out.
  const foreign = new RegExp(["rust", "guac", "|", "so", "l1", "|", "dave", "kemp"].join(""), "i");
  ok(!foreign.test(text), "search: index carries leftover branding from the ported engine");

  let data;
  try { data = JSON.parse(text); } catch (e) { ok(false, `search: index JSON does not parse: ${e.message}`); return; }
  ok(data.v === 1, `search: index version ${data.v} (expected 1)`);
  for (const k of ["p", "r", "d"]) ok(Array.isArray(data[k]), `search: index "${k}" is not an array`);
  ok(typeof data.w === "string" && data.w.length > 0, "search: index vocabulary is empty");
  if (!Array.isArray(data.p) || !Array.isArray(data.r) || !Array.isArray(data.d)) return;

  const vocab = data.w.split(" ");
  ok(vocab.length === data.d.length, `search: vocabulary has ${vocab.length} terms but ${data.d.length} document frequencies`);
  ok(vocab.every((t, i) => i === 0 || vocab[i - 1] < t), "search: vocabulary is not sorted (prefix lookups depend on it)");

  const urls = data.p.map((p) => p[0]);
  ok(urls.some((u) => /^\/docs\/.+/.test(u)), "search: no /docs/ pages in the index");
  ok(urls.some((u) => /^\/docs\/adr\/.+/.test(u)), "search: no ADR pages in the index");
  ok(data.p.some((p) => p[3] === "faq"), "search: no FAQ records in the index");
  ok(data.p.some((p) => p[3] === "config"), "search: no config pages in the index");
  ok(!urls.includes("/search/"), "search: the index lists /search/ itself");
  ok(!urls.some((u) => /404/.test(u)), "search: the index lists the 404 page");
  ok(urls.length === new Set(urls).size, "search: duplicate page URLs in the index");

  for (const p of data.p) {
    const [url, title, section, kind, desc] = p;
    // The client prefixes <html data-base>, so a URL that already carries the base would double it.
    ok(typeof url === "string" && url.startsWith("/") && (base === "" || !url.startsWith(base + "/")), `search: page URL must be site-relative without the base: ${url}`);
    ok(resolve(base + url), `search: page URL does not resolve: ${url}`);
    ok(typeof title === "string" && title.length > 0, `search: page without a title: ${url}`);
    ok(!/\s[·|]\s(?:PowerDNS-)?AuthAdmin(?:\s+docs?)?\s*$/i.test(title), `search: title still carries the site suffix: ${title}`);
    ok(typeof section === "string" && section.length > 0, `search: page without a section: ${url}`);
    ok(KINDS.has(kind), `search: unknown kind "${kind}" for ${url}`);
    ok(typeof desc === "string", `search: page description missing for ${url}`);
  }

  // Every record points at an existing page, and anchored records at an existing id.
  const htmlFor = (url) => {
    const f = join(ctx.dist, decodeURIComponent(url), "index.html");
    return existsSync(f) ? read(f) : "";
  };
  const htmlCache = new Map();
  let anchored = 0;
  for (const r of data.r) {
    const [page, anchor, heading, parent, content, keywords, kind] = r;
    const p = data.p[page];
    if (!ok(p !== undefined, `search: record points at missing page #${page}`)) continue;
    ok(typeof content === "string", `search: record without content on ${p[0]}#${anchor}`);
    ok(Array.isArray(keywords), `search: record keywords is not an array on ${p[0]}#${anchor}`);
    ok(kind === "" || KINDS.has(kind), `search: unknown record kind "${kind}" on ${p[0]}#${anchor}`);
    ok(parent === -1 || (data.r[parent] && data.r[parent][0] === page), `search: record parent ${parent} is not on the same page (${p[0]}#${anchor})`);
    if (!anchor) continue;
    anchored++;
    ok(typeof heading === "string" && heading.length > 0, `search: anchored record without a heading: ${p[0]}#${anchor}`);
    if (!htmlCache.has(p[0])) htmlCache.set(p[0], htmlFor(p[0]));
    const html = htmlCache.get(p[0]);
    ok(html.includes(`id="${anchor}"`), `search: anchor does not exist: ${p[0]}#${anchor}`);
  }
  ok(anchored > 0, "search: no section records (every page indexed as a single record)");

  // Keyword extraction actually caught the identifiers people search for.
  const kws = new Set(data.r.flatMap((r) => r[5]));
  ok([...kws].some((k) => /^APP_[A-Z_]+$/.test(k)), "search: no APP_* environment variables among the keywords");
  ok(kws.has("DATABASE_URL"), "search: DATABASE_URL is not among the keywords");
  ok(kws.has("pda_pat_"), "search: the pda_pat_ token prefix is not among the keywords");
  ok(kws.has("list_zones") || kws.has("set_records"), "search: no MCP tool names among the keywords");
  ok(vocab.includes("oidc") && vocab.includes("dnssec") && vocab.includes("tsig"), "search: core DNS vocabulary missing from the index");
}
