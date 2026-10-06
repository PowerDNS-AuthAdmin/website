import { site } from "../site.mjs";
import { icon } from "../icons.mjs";
import { shot, ids, esc } from "../layout.mjs";
import { featureGroups } from "../content.mjs";

const body = `
<section class="page-hero">
  <div class="hero-bg" aria-hidden="true"></div>
  <div class="container">
    <p class="eyebrow">Features</p>
    <h1>Every feature of PowerDNS-AuthAdmin</h1>
    <p class="page-lead">Access control, single sign-on, safe record editing, multi-backend operations, DNSSEC and a real audit trail, in one self-hosted web UI for PowerDNS Authoritative.</p>
    <nav class="jump" aria-label="On this page">
      ${featureGroups.map((g) => `<a href="#${g.id}">${icon(g.icon, 16)}${esc(g.short)}</a>`).join("")}
    </nav>
  </div>
</section>

${featureGroups
  .map(
    (g, i) => `<section class="section feature-group${i % 2 ? " section-alt" : ""}" id="${g.id}" aria-labelledby="${g.id}-title">
  <div class="container">
    <div class="group-head">
      <div class="card-icon">${icon(g.icon, 22)}</div>
      <div>
        <h2 id="${g.id}-title">${esc(g.title)}</h2>
        <p>${g.lead}</p>
      </div>
    </div>
    ${
      g.shot
        ? `<figure class="group-shot"><div class="browser"><div class="browser-bar" aria-hidden="true"><span class="dots"><i></i><i></i><i></i></span><span class="browser-url">${icon("lock", 12)}demo.powerdns-authadmin.org</span></div><button class="zoom" type="button" aria-label="Enlarge screenshot">${shot(g.shot.name, g.shot.alt, { sizes: "(min-width: 1180px) 1100px, 94vw" })}<span class="zoom-hint">${icon("zoom", 16)}</span></button></div><figcaption class="sr-only">${g.shot.alt}</figcaption></figure>`
        : ""
    }
    <dl class="feature-list">
      ${g.items.map(([t, d]) => `<div><dt>${icon("check", 16)}${esc(t)}</dt><dd>${d}</dd></div>`).join("\n      ")}
    </dl>
  </div>
</section>`,
  )
  .join("\n")}

<section class="section cta-section">
  <div class="container cta-slim">
    <h2>See it with your own eyes</h2>
    <p>Click around a seeded install, or have your own running in a couple of minutes.</p>
    <div class="cta-buttons">
      <a class="btn btn-primary btn-lg" href="${site.demo}" data-cta="Live demo" rel="noopener">${icon("play", 18)}<span>Open the live demo</span></a>
      <a class="btn btn-ghost btn-lg" href="/#quickstart" data-cta="Quickstart">${icon("terminal", 18)}<span>Quickstart</span></a>
    </div>
  </div>
</section>
`;

export default {
  slug: "features",
  path: "/features/",
  title: "Features: RBAC, SSO, DNSSEC, audit log | PowerDNS-AuthAdmin",
  description:
    "Every PowerDNS-AuthAdmin feature: scoped RBAC, OIDC, SAML, LDAP and passkeys, diff-before-apply editing, clusters and secondaries, DNSSEC, TSIG and audit.",
  priority: "0.9",
  changefreq: "monthly",
  lightbox: true,
  breadcrumbs: [{ name: "Features", path: "/features/" }],
  images: ["roles", "zone-edit-diff", "powerdns-servers", "audit-log"],
  og: {
    eyebrow: "Features",
    title: "Every feature, <em>built for teams</em> that run DNS",
    sub: "Scoped RBAC, SSO, passkeys, diff-before-apply, clusters, DNSSEC and audit.",
    shot: "zone-edit-diff",
    size: 58,
  },
  about: { "@id": ids.app },
  body,
};
