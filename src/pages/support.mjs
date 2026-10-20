import { site, href } from "../site.mjs";
import { icon } from "../icons.mjs";
import { ids } from "../layout.mjs";
import { supportBlock, supportLead, liveBadge, chatLink } from "../support.mjs";

const sp = site.support;

const body = `
<section class="page-hero">
  <div class="hero-bg" aria-hidden="true"></div>
  <div class="container">
    <p class="eyebrow">Commercial support</p>
    <h1>Commercial support for PowerDNS-AuthAdmin</h1>
    ${liveBadge}
    <p class="page-lead">${supportLead} ${chatLink}.</p>
  </div>
</section>
${supportBlock({ head: false })}

<section class="section cta-section">
  <div class="container cta-slim">
    <h2>Prefer the community?</h2>
    <p>The app stays free and open source either way. Ask questions in Discussions, report bugs in Issues, or read the docs.</p>
    <div class="cta-buttons">
      <a class="btn btn-ghost btn-lg" href="${site.discussions}" data-cta="Discussions" rel="noopener">${icon("chat", 18)}<span>Discussions</span></a>
      <a class="btn btn-ghost btn-lg" href="${href(site.docs.index)}" data-cta="Docs">${icon("book", 18)}<span>Read the docs</span></a>
    </div>
  </div>
</section>
`;

export default {
  slug: "support",
  path: "/support/",
  title: "Commercial support for PowerDNS-AuthAdmin, 24/7 from NGN",
  description:
    "24 hour commercial support for PowerDNS-AuthAdmin from NGN (Next Generation Networks), Sydney: deployment, upgrades, SSO and the infrastructure behind it.",
  priority: "0.6",
  changefreq: "monthly",
  breadcrumbs: [{ name: "Commercial support", path: "/support/" }],
  og: {
    eyebrow: "Commercial support",
    title: "Someone on call, <em>24/7</em>",
    sub: `For PowerDNS-AuthAdmin, from ${sp.legalName} (${sp.name}) in Sydney.`,
    size: 58,
    panel: "support",
  },
  ogAlt: `Commercial support for PowerDNS-AuthAdmin, 24 hours a day from ${sp.legalName}`,
  about: { "@id": ids.app },
  body,
};
