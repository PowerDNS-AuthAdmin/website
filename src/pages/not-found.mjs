import { site } from "../site.mjs";
import { icon } from "../icons.mjs";

const body = `
<section class="not-found">
  <div class="hero-bg" aria-hidden="true"></div>
  <div class="container narrow">
    <p class="nf-code" aria-hidden="true"><span>{</span>404<span>}</span></p>
    <h1>NXDOMAIN: page not found</h1>
    <p class="page-lead">That record doesn't resolve. It may have moved, or the link may be mistyped.</p>
    <div class="hero-cta">
      <a class="btn btn-primary btn-lg" href="/">${icon("arrowRight", 18)}<span>Back to the zone apex</span></a>
      <a class="btn btn-ghost btn-lg" href="/features/">Features</a>
      <a class="btn btn-ghost btn-lg" href="${site.docs.index}" rel="noopener">Docs</a>
    </div>
  </div>
</section>
`;

export default {
  slug: "404",
  path: "/404.html",
  file: "404.html",
  title: "Page not found | PowerDNS-AuthAdmin",
  description: "This page doesn't exist. Head back to the PowerDNS-AuthAdmin home page, features or documentation.",
  noindex: true,
  sitemap: false,
  ogImage: "home",
  body,
};
