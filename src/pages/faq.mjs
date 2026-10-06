import { site } from "../site.mjs";
import { icon } from "../icons.mjs";
import { ids } from "../layout.mjs";
import { faqs } from "../content.mjs";

const slug = (q) => q.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

const body = `
<section class="page-hero">
  <div class="hero-bg" aria-hidden="true"></div>
  <div class="container narrow">
    <p class="eyebrow">FAQ</p>
    <h1>PowerDNS-AuthAdmin questions, answered</h1>
    <p class="page-lead">Installation, supported PowerDNS versions, single sign-on, permissions, clusters and security. Can't find what you need? Ask in <a href="${site.discussions}" rel="noopener">GitHub Discussions</a>.</p>
  </div>
</section>

<section class="section section-tight">
  <div class="container narrow">
    <div class="faq faq-full">
      ${faqs.map((f, i) => `<details name="faq" id="${slug(f.q)}"${i === 0 ? " open" : ""}><summary><h2>${f.q}</h2>${icon("chevronDown", 20)}</summary><div class="faq-a"><p>${f.a}</p></div></details>`).join("\n      ")}
    </div>
  </div>
</section>

<section class="section cta-section">
  <div class="container cta-slim">
    <h2>Still curious?</h2>
    <p>The documentation covers installation, configuration, RBAC, SSO and hardening in depth.</p>
    <div class="cta-buttons">
      <a class="btn btn-primary btn-lg" href="${site.docs.index}" data-cta="Docs" rel="noopener">${icon("book", 18)}<span>Read the docs</span></a>
      <a class="btn btn-ghost btn-lg" href="${site.discussions}" data-cta="Discussions" rel="noopener">${icon("chat", 18)}<span>Ask the community</span></a>
    </div>
  </div>
</section>
`;

export default {
  slug: "faq",
  path: "/faq/",
  title: "FAQ: install, SSO, RBAC and PowerDNS support | PowerDNS-AuthAdmin",
  description:
    "Answers about PowerDNS-AuthAdmin: supported PowerDNS versions, Docker install, databases, OIDC, SAML and LDAP, passkeys, zone-scoped access, clusters and API.",
  priority: "0.8",
  changefreq: "monthly",
  pageType: ["WebPage", "FAQPage"],
  breadcrumbs: [{ name: "FAQ", path: "/faq/" }],
  og: {
    eyebrow: "FAQ",
    title: "Questions, <em>answered</em>",
    sub: "Install, PowerDNS versions, SSO, RBAC, clusters, API and security.",
    shot: "zones-list",
  },
  about: { "@id": ids.app },
  // The page itself is the FAQPage; layout turns these into its mainEntity questions.
  faq: faqs,
  body,
};
