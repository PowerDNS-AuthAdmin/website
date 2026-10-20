// /search/ : full-page search results. The markup is a mount point; src/js/search.js
// finds [data-search-page], un-hides [data-search-ui] and drives it with the same engine
// as the command palette (no globals). ?q= pre-fills the query. Without JS the page
// points to the docs index.
import { href } from "../site.mjs";

const ico = (d) =>
  `<svg class="sx-svg sx-bar-ico" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${d}</svg>`;

const body = `
<div class="container sx-page" data-search-page>
  <header class="sx-page-head">
    <p class="sx-page-eyebrow">Search</p>
    <h1>Search the docs and site</h1>
    <p class="sx-page-lead">Guides, environment variables, MCP tools, API endpoints, architecture decisions and FAQs, ranked as you type. Tip: press <kbd>/</kbd> or <kbd data-search-kbd>Ctrl K</kbd> on any page.</p>
  </header>
  <div class="sx-page-ui" data-search-ui hidden>
    <div class="sx-bar sx-page-bar">
      ${ico('<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>')}
      <input class="sx-input" type="search" role="combobox" aria-expanded="false" aria-autocomplete="list" aria-haspopup="listbox" aria-label="Search docs and site" placeholder="Search docs, env vars, MCP tools…" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" enterkeyhint="search" maxlength="120">
      <button type="button" class="sx-x" aria-label="Clear search" hidden>${ico('<path d="M18 6 6 18M6 6l12 12"/>').replace("sx-bar-ico", "")}</button>
    </div>
    <div class="sx-page-tools">
      <div class="sx-chips" role="radiogroup" aria-label="Filter results"></div>
      <span class="sx-meta" aria-hidden="true"></span>
    </div>
    <div class="sx-list sx-page-list" data-label="Search results"></div>
    <div class="sx-sr" role="status" aria-live="polite"></div>
  </div>
  <noscript>
    <div class="sx-noscript">
      <p>Search needs JavaScript. Everything is also reachable from the <a href="${href("/docs/")}">documentation index</a>.</p>
    </div>
  </noscript>
</div>
`;

export default {
  slug: "search",
  path: "/search/",
  title: "Search · PowerDNS-AuthAdmin",
  description:
    "Search the PowerDNS-AuthAdmin docs and website: installation, environment variables, OIDC, SAML and LDAP sign-in, RBAC, the MCP server and the FAQ.",
  layout: "default",
  noindex: true,
  sitemap: false,
  search: false,
  priority: "0.1",
  changefreq: "monthly",
  pageType: ["WebPage", "SearchResultsPage"],
  breadcrumbs: [{ name: "Search", path: "/search/" }],
  og: {
    eyebrow: "Search",
    title: "Find anything in the <em>docs</em>",
    sub: "Typo-tolerant search across every guide, environment variable, MCP tool, API endpoint and FAQ. Press Ctrl K anywhere on the site.",
    shot: "zones-list",
  },
  ogAlt: "Search the PowerDNS-AuthAdmin documentation and website",
  body,
};
