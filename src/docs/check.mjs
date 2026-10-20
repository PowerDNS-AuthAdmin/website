// Docs checks for scripts/check.mjs: every doc the nav lists was built, every docs
// page carries the sidebar, the on-page TOC (when the page has headings), the pager,
// an "Edit on GitHub" link and a Docs search section, nothing in dist mentions the
// reference implementation this site was ported from, no image is hotlinked from
// raw.githubusercontent.com, and the ADR index lists every record.
//
// ctx: { dist, base, url, files, htmlFiles, read, resolve, ok }
import { join } from "node:path";
import { flatDocs, adrSection } from "./nav.mjs";

export default function check({ dist, base, htmlFiles, read, ok }) {
  const rel = (f) => "/" + f.slice(dist.length + 1).replace(/index\.html$/, "");
  const pageFile = (path) => join(dist, path.slice(1), "index.html");
  const docsPages = htmlFiles.filter((f) => /\/docs\//.test(rel(f)));
  ok(docsPages.length >= flatDocs.length + 2, `docs: expected at least ${flatDocs.length + 2} docs pages, found ${docsPages.length}`);

  for (const d of flatDocs) {
    const f = pageFile(`/docs/${d.slug}/`);
    const exists = htmlFiles.includes(f);
    ok(exists, `docs: ${d.slug} is in the nav but /docs/${d.slug}/ was not built`);
    if (!exists) continue;
    const html = read(f);
    ok(/<aside class="docs-sidebar"/.test(html), `docs: /docs/${d.slug}/ has no sidebar`);
    ok(/<nav class="docs-pager"/.test(html), `docs: /docs/${d.slug}/ has no pager`);
    ok(/>Edit on GitHub</.test(html), `docs: /docs/${d.slug}/ has no "Edit on GitHub" link`);
    const hasHeadings = /<div class="doc-content">[\s\S]*<h[23] id="/.test(html);
    if (hasHeadings) ok(/<aside class="docs-toc"/.test(html) && /class="docs-toc-mobile"/.test(html), `docs: /docs/${d.slug}/ has headings but no TOC`);
    ok(/<main id="main"[^>]*data-search-section="Docs[^"]*"/.test(html), `docs: /docs/${d.slug}/ search section does not start with "Docs"`);
    ok(/<meta name="robots" content="(?!noindex)/.test(html) || !/<meta name="robots"/.test(html) || process.env.STAGING === "1", `docs: /docs/${d.slug}/ is noindex`);
  }

  for (const f of htmlFiles) {
    const html = read(f);
    ok(!/rustguac|sol1/i.test(html), `${rel(f)}: mentions the reference project`);
    ok(!/raw\.githubusercontent\.com/.test(html), `${rel(f)}: hotlinks raw.githubusercontent.com`);
  }

  const index = pageFile("/docs/adr/");
  ok(htmlFiles.includes(index), "docs: /docs/adr/ (ADR index) was not built");
  if (htmlFiles.includes(index)) {
    const html = read(index);
    for (const d of adrSection.docs) ok(html.includes(`href="${base}/docs/${d.slug}/"`), `docs: ADR index does not list ${d.slug}`);
    ok(/<aside class="docs-sidebar"/.test(html), "docs: ADR index has no sidebar");
  }
  const home = pageFile("/docs/");
  if (htmlFiles.includes(home)) {
    const html = read(home);
    for (const d of flatDocs) ok(html.includes(`href="${base}/docs/${d.slug}/"`), `docs: home does not link /docs/${d.slug}/`);
  }
}
