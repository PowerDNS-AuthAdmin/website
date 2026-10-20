import { site, href } from "../site.mjs";
import { icon } from "../icons.mjs";
import { searchTrigger } from "../layout.mjs";

// Served for every unknown URL, at any depth, so every link here is absolute and
// base-prefixed (href() does that).
const body = `
<section class="not-found">
  <div class="hero-bg" aria-hidden="true"></div>
  <div class="container narrow">
    <p class="nf-code" aria-hidden="true"><span>{</span>404<span>}</span></p>
    <h1>NXDOMAIN: page not found</h1>
    <p class="page-lead">That record doesn't resolve. It may have moved, or the link may be mistyped.</p>
    <div class="hero-cta">
      <a class="btn btn-primary btn-lg" href="${href("/")}">${icon("arrow-right", 18)}<span>Back to the zone apex</span></a>
      <a class="btn btn-ghost btn-lg" href="${href(site.docs.index)}" data-cta="Docs">${icon("book", 18)}<span>Docs</span></a>
      <a class="btn btn-ghost btn-lg" href="${href("/features/")}">Features</a>
    </div>
    <div class="nf-search">${searchTrigger("search-trigger-lg")}</div>
  </div>
</section>
`;

export default {
  slug: "404",
  path: "/404.html",
  file: "404.html",
  title: "Page not found | PowerDNS-AuthAdmin",
  description: "This page doesn't exist. Head back to the PowerDNS-AuthAdmin home page, the documentation or the feature overview, or search the site.",
  noindex: true,
  sitemap: false,
  search: false,
  og: {
    eyebrow: "404",
    title: "NXDOMAIN: <em>page not found</em>",
    sub: "That record doesn't resolve. The docs, features and FAQ are one click away.",
    shot: "zones-list",
  },
  ogAlt: "PowerDNS-AuthAdmin: page not found",
  body,
};
