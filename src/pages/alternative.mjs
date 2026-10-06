import { site } from "../site.mjs";
import { icon } from "../icons.mjs";
import { ids } from "../layout.mjs";

// Claims here are about PowerDNS-AuthAdmin only. PowerDNS-Admin is an active project;
// don't describe its features or maintenance status.
const checks = [
  ["Access scoped to one zone", "Assign any role globally, to a team, to a single zone or to a single server. SOA, apex NS and zone settings are separate permissions."],
  ["Your identity provider", "OIDC (PKCE, RP-initiated logout), SAML 2.0 and LDAP / Active Directory, each with group → role mapping on every sign-in."],
  ["Phishing-resistant MFA", "WebAuthn passkeys and hardware security keys, or TOTP. Roles can require MFA."],
  ["Safe edits", "Per-type validation, a BIND-style diff before every write and optimistic concurrency per RRset."],
  ["More than one backend", "Standalone primaries, primary + secondaries and multi-primary clusters, with sync probes and health advisories."],
  ["A trail for auditors", "Append-only log with redacted before / after snapshots, the PowerDNS request trail and CSV export."],
  ["Automation", "A full admin API with scoped personal access tokens, Prometheus metrics and first-boot YAML provisioning."],
  ["Operations", "One Docker image on SQLite or Postgres, Postgres + Redis for HA, no telemetry and no CDN."],
];

const steps = [
  ["Deploy alongside", `Start PowerDNS-AuthAdmin with Docker Compose next to what you run today. It only needs network access to the PowerDNS Authoritative HTTP API. <a href="${site.docs.install}" rel="noopener">Installation guide</a>.`],
  ["Register your backends", "Add each PowerDNS server with its API URL and key, or group them into clusters and primary + secondaries. Your existing zones appear straight away because they live in PowerDNS, not in the admin UI."],
  ["Connect sign-in", `Point it at your OIDC, SAML or LDAP provider and map groups to roles, or create local accounts. <a href="${site.docs.rbac}" rel="noopener">RBAC guide</a>.`],
  ["Recreate access rules", `Users, roles, teams and API tokens are not imported from other tools. Define them in the UI or in a <a href="${site.docs.provisioning}" rel="noopener">provisioning.yaml</a> so the setup is reviewable and repeatable.`],
  ["Switch over", "Once your team works in PowerDNS-AuthAdmin, retire the old UI. Edits made by any other client show up live, so running both during the transition is fine."],
];

const body = `
<section class="page-hero">
  <div class="hero-bg" aria-hidden="true"></div>
  <div class="container narrow">
    <p class="eyebrow">Compare</p>
    <h1>A modern alternative to PowerDNS-Admin</h1>
    <p class="page-lead">PowerDNS-Admin is the long-standing community web UI for PowerDNS. PowerDNS-AuthAdmin is a separate project, written from scratch in TypeScript, for teams that run several backends, sign in through an identity provider and need to show who changed what.</p>
    <div class="hero-cta left">
      <a class="btn btn-primary btn-lg" href="${site.demo}" data-cta="Live demo" rel="noopener">${icon("play", 18)}<span>Try the live demo</span></a>
      <a class="btn btn-ghost btn-lg" href="/features/" data-cta="Features">See all features</a>
    </div>
  </div>
</section>

<section class="section" aria-labelledby="what-title">
  <div class="container narrow prose">
    <h2 id="what-title">What PowerDNS-AuthAdmin is</h2>
    <p>PowerDNS-AuthAdmin is a free, MIT-licensed web interface for <strong>PowerDNS Authoritative</strong>. It talks to PowerDNS through its built-in HTTP API, so your zones and records stay where they are. On top it adds what multi-person DNS operations need: scoped role-based access control, single sign-on, passkeys, a diff-before-apply editor, cluster and secondary awareness, and an append-only audit log.</p>
    <p>It is not a fork. It is a clean-sheet build on Node.js 24, Next.js and TypeScript in strict mode, shipped as one container image (<code>${site.image}</code>) and tested in CI against PowerDNS ${site.pdnsVersions}.</p>
  </div>
</section>

<section class="section section-alt" aria-labelledby="checklist-title">
  <div class="container">
    <div class="section-head">
      <p class="eyebrow">Checklist</p>
      <h2 id="checklist-title">What to look for in a PowerDNS web UI</h2>
      <p>The questions teams ask when choosing an admin interface, and how PowerDNS-AuthAdmin answers each one.</p>
    </div>
    <div class="table-wrap">
      <table class="compare">
        <thead><tr><th scope="col">Requirement</th><th scope="col">PowerDNS-AuthAdmin</th></tr></thead>
        <tbody>
          ${checks.map(([k, v]) => `<tr><th scope="row">${icon("check", 18)}${k}</th><td>${v}</td></tr>`).join("\n          ")}
        </tbody>
      </table>
    </div>
  </div>
</section>

<section class="section" aria-labelledby="switch-title">
  <div class="container narrow">
    <div class="section-head">
      <p class="eyebrow">Switching</p>
      <h2 id="switch-title">How to move to PowerDNS-AuthAdmin</h2>
      <p>No zone migration is needed. The admin UI is a client of the PowerDNS API, so you can run it next to your current tool and switch when you're ready.</p>
    </div>
    <ol class="timeline">
      ${steps.map(([t, d]) => `<li><h3>${t}</h3><p>${d}</p></li>`).join("\n      ")}
    </ol>
  </div>
</section>

<section class="section section-alt" aria-labelledby="fit-title">
  <div class="container narrow prose">
    <h2 id="fit-title">Is it the right fit?</h2>
    <p>If a single shared admin login on one PowerDNS server covers your needs and your current UI does the job, you may not need to change anything. PowerDNS-AuthAdmin earns its place when more people, more backends or more scrutiny come into play: delegating zones to customers or teams, enforcing SSO and MFA, operating clusters and secondaries, or answering audit requests.</p>
    <p>The quickest way to decide is to click around the <a href="${site.demo}" rel="noopener">live demo</a>, then read the <a href="/faq/">FAQ</a>.</p>
  </div>
</section>

<section class="section cta-section">
  <div class="container cta-slim">
    <h2>Up and running in minutes</h2>
    <p>One image, one compose file, your existing PowerDNS.</p>
    <div class="cta-buttons">
      <a class="btn btn-primary btn-lg" href="/#quickstart" data-cta="Quickstart">${icon("terminal", 18)}<span>Quickstart</span></a>
      <a class="btn btn-ghost btn-lg" href="${site.repo}" data-cta="GitHub" rel="noopener">View on GitHub</a>
    </div>
  </div>
</section>
`;

export default {
  slug: "powerdns-admin-alternative",
  path: "/powerdns-admin-alternative/",
  title: "PowerDNS-Admin alternative: PowerDNS-AuthAdmin",
  description:
    "Looking for a PowerDNS-Admin alternative? PowerDNS-AuthAdmin adds scoped RBAC, OIDC, SAML and LDAP, passkeys, clusters and an audit log. Free and open source.",
  priority: "0.8",
  changefreq: "monthly",
  breadcrumbs: [{ name: "PowerDNS-Admin alternative", path: "/powerdns-admin-alternative/" }],
  og: {
    eyebrow: "Compare",
    title: "A modern alternative to <em>PowerDNS-Admin</em>",
    sub: "Scoped RBAC, OIDC · SAML · LDAP, passkeys, clusters and an audit log.",
    shot: "powerdns-servers",
    size: 60,
  },
  about: { "@id": ids.app },
  body,
};
