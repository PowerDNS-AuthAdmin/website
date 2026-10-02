import { site } from "../site.mjs";
import { icon, githubMark } from "../icons.mjs";
import { shot, softwareNode, sourceNode, ids, esc } from "../layout.mjs";
import { highlights, faqs } from "../content.mjs";
import { hl, plain } from "../code.mjs";

const HERO_SIZES = "(min-width: 1100px) 1040px, 94vw";

/* ---- Screens showcase: one tab per screen, desktop + mobile variants ---- */
const screens = [
  { id: "dashboard", label: "Dashboard", d: "dashboard", m: "dashboard-mobile", title: "Operational dashboard", text: "Live PowerDNS stats per backend, active sessions, recent changes, and users who need a second look." },
  { id: "zones", label: "Zones", d: "zones-list", m: "zones-list-mobile", title: "Every zone, one list", text: "Zones from every backend in one searchable list with serial, DNSSEC and per-row sync state." },
  { id: "editor", label: "Editor", d: "zone-edit", m: "zone-edit-mobile", title: "Per-RRset record editor", text: "Structured editors per record type with inline validation and RFC-backed hints." },
  { id: "diff", label: "Diff", d: "zone-edit-diff", m: "zone-edit-diff-mobile", title: "Diff before apply", text: "Every change is reviewed as a BIND-style before / after diff before it reaches PowerDNS." },
  { id: "servers", label: "Backends", d: "powerdns-servers", m: "powerdns-servers-mobile", title: "Clusters and secondaries", text: "Multi-primary clusters, primaries with secondaries and standalone servers, side by side." },
  { id: "health", label: "Health", d: "backend-health", m: "backend-health-mobile", title: "Backend health advisories", text: "Alerts for unreachable hosts, replication drift and TSIG keys missing on secondaries." },
  { id: "audit", label: "Audit", d: "audit-log", m: "audit-log-mobile", title: "Append-only audit log", text: "Redacted before / after snapshots, the PowerDNS HTTP trail and CSV export." },
  { id: "roles", label: "Roles", d: "roles", m: "roles-mobile", title: "Roles and permissions", text: "Five system roles plus custom roles, scoped to global, team, zone or server." },
];

const showcase = `<div class="showcase" data-device="desktop">
  <div class="showcase-controls">
    <div class="showcase-tabs" role="tablist" aria-label="Screens">
      ${screens.map((s, i) => `<button class="chip-tab" type="button" role="tab" id="tab-${s.id}" aria-controls="panel-${s.id}" aria-selected="${i === 0}"${i ? ' tabindex="-1"' : ""}>${s.label}</button>`).join("")}
    </div>
    <div class="seg" role="group" aria-label="Device">
      <button type="button" data-view="desktop" aria-pressed="true">${icon("monitor", 16)}<span>Desktop</span></button>
      <button type="button" data-view="mobile" aria-pressed="false">${icon("phone", 16)}<span>Mobile</span></button>
    </div>
  </div>
  ${screens
    .map(
      (s, i) => `<div class="showcase-panel" role="tabpanel" id="panel-${s.id}" aria-labelledby="tab-${s.id}"${i ? " data-inactive" : ""}><figure>
    <div class="showcase-stage">
      <div class="browser view-desktop">
        <div class="browser-bar" aria-hidden="true"><span class="dots"><i></i><i></i><i></i></span><span class="browser-url">${icon("lock", 12)}demo.powerdns-authadmin.org</span></div>
        <button class="zoom" type="button" aria-label="Enlarge: ${esc(s.title)}">${shot(s.d, `${s.title}: PowerDNS-AuthAdmin ${s.label.toLowerCase()} screen on desktop`, { sizes: "(min-width: 1180px) 1100px, 94vw" })}<span class="zoom-hint">${icon("zoom", 16)}</span></button>
      </div>
      <div class="phone view-mobile">
        <button class="zoom" type="button" aria-label="Enlarge: ${esc(s.title)} on mobile">${shot(s.m, `${s.title}: PowerDNS-AuthAdmin ${s.label.toLowerCase()} screen on a phone`, { sizes: "(min-width: 700px) 340px, 72vw" })}<span class="zoom-hint">${icon("zoom", 16)}</span></button>
      </div>
    </div>
    <figcaption><strong>${s.title}.</strong> ${s.text}</figcaption>
  </figure></div>`,
    )
    .join("\n  ")}
</div>`;

/* ---- Quickstart snippets (kept in step with docs/02-INSTALLATION.md) ---- */
const envSh = `
mkdir powerdns-authadmin && cd powerdns-authadmin

# 1. Generate secrets once. Back this file up and never change them.
{
  echo "APP_SECRET_KEY=$(openssl rand -base64 32)"
  echo "APP_ENCRYPTION_KEY=$(openssl rand -base64 32)"
  echo "BOOTSTRAP_ADMIN_EMAIL=admin@example.com"
  echo "BOOTSTRAP_ADMIN_PASSWORD=$(openssl rand -base64 18)"
  echo "APP_URL=https://dns.example.com"   # the exact URL your browser uses
} > .env
chmod 600 .env

# 2. Save compose.yml (next tab), then start it
docker compose up -d
`;

const composeYml = `
# compose.yml: single instance on SQLite
services:
  app:
    image: ${site.image}:latest
    restart: unless-stopped
    ports: ["3000:3000"]
    environment:
      APP_URL: \${APP_URL}
      DATABASE_URL: file:/data/powerdns_authadmin.db
      APP_SECRET_KEY: \${APP_SECRET_KEY}
      APP_ENCRYPTION_KEY: \${APP_ENCRYPTION_KEY}
      BOOTSTRAP_ADMIN_EMAIL: \${BOOTSTRAP_ADMIN_EMAIL}
      BOOTSTRAP_ADMIN_PASSWORD: \${BOOTSTRAP_ADMIN_PASSWORD}
      # Optional: apply provisioning.yaml once on first boot
      # PROVISION_ON_BOOT: "true"
      # PROVISIONING_FILE: /etc/pda/provisioning.yaml
    volumes:
      - app-data:/data
      # - ./provisioning.yaml:/etc/pda/provisioning.yaml:ro
volumes:
  app-data:
`;

const provisioningYml = `
# provisioning.yaml: applied once on first boot, then the UI
# is the source of truth. Every block is optional.
settings:
  site_name: "ACME DNS"
  default_record_ttl: 300

# Register your PowerDNS Authoritative backend(s)
pdns_servers:
  - slug: primary
    name: "Primary PowerDNS"
    base_url: "https://pdns.internal:8081/api/v1"
    server_id: localhost
    api_key: "change-me-pdns-api-key"   # encrypted at rest
    is_default: true
`;

const files = [
  { id: "setup", label: "setup.sh", lang: "sh", code: envSh },
  { id: "compose", label: "compose.yml", lang: "yaml", code: composeYml },
  { id: "provisioning", label: "provisioning.yaml", lang: "yaml", code: provisioningYml },
];

const terminal = `<div class="terminal">
  <div class="terminal-bar">
    <span class="dots" aria-hidden="true"><i></i><i></i><i></i></span>
    <div class="terminal-tabs" role="tablist" aria-label="Files">
      ${files.map((f, i) => `<button class="terminal-tab" type="button" role="tab" id="ft-${f.id}" aria-controls="fp-${f.id}" aria-selected="${i === 0}"${i ? ' tabindex="-1"' : ""}>${f.label}</button>`).join("")}
    </div>
    <button class="copy-btn" type="button" data-copy aria-label="Copy file contents">${icon("copy", 15, "i-copy")}${icon("check", 15, "i-done")}<span class="copy-label">Copy</span></button>
  </div>
  ${files
    .map(
      (f, i) => `<div class="terminal-pane" role="tabpanel" id="fp-${f.id}" aria-labelledby="ft-${f.id}" tabindex="0"${i ? " data-inactive" : ""}><pre><code data-plain="${esc(plain(f.code))}">${hl(f.code, f.lang)}</code></pre></div>`,
    )
    .join("\n  ")}
</div>`;

const stack = [
  "PowerDNS Authoritative 4.6 to 5.0",
  "Docker",
  "PostgreSQL",
  "SQLite",
  "Redis",
  "Keycloak",
  "Authentik",
  "Okta",
  "Microsoft Entra ID",
  "AD FS",
  "Active Directory",
  "OpenLDAP",
  "YubiKey",
  "Prometheus",
];

const homeFaqs = [0, 2, 6, 13].map((i) => faqs[i]);

const body = `
<section class="hero">
  <div class="hero-bg" aria-hidden="true"></div>
  <div class="container hero-inner">
    <a class="pill" href="${site.latestRelease}" rel="noopener"><span class="pill-tag">v${site.version}</span><span>Latest release: see what's new</span>${icon("arrowRight", 15)}</a>
    <h1 class="hero-title">The PowerDNS admin UI<br> <span class="accent">built for teams.</span></h1>
    <p class="hero-sub">PowerDNS-AuthAdmin is a modern, self-hosted web interface for PowerDNS Authoritative. Scoped RBAC, SSO with OIDC, SAML and LDAP, passkeys, diff-before-apply zone editing and an append-only audit log. One Docker image. No telemetry.</p>
    <div class="hero-cta">
      <a class="btn btn-primary btn-lg" href="${site.demo}" rel="noopener">${icon("play", 18)}<span>Try the live demo</span></a>
      <a class="btn btn-ghost btn-lg" href="#quickstart">${icon("terminal", 18)}<span>Self-host in 2 minutes</span></a>
    </div>
    <ul class="hero-meta">
      <li>${icon("check", 15)}MIT licensed</li>
      <li>${icon("check", 15)}SQLite or Postgres</li>
      <li>${icon("check", 15)}PowerDNS ${site.pdnsVersions}</li>
      <li>${icon("check", 15)}DNSSEC &amp; TSIG</li>
    </ul>
    <div class="hero-shot">
      <div class="browser">
        <div class="browser-bar" aria-hidden="true"><span class="dots"><i></i><i></i><i></i></span><span class="browser-url">${icon("lock", 12)}demo.powerdns-authadmin.org</span></div>
        <button class="zoom" type="button" aria-label="Enlarge: dashboard">${shot("dashboard", "PowerDNS-AuthAdmin dashboard with backend stats, active sessions and PowerDNS query charts", { sizes: HERO_SIZES, priority: true })}<span class="zoom-hint">${icon("zoom", 16)}</span></button>
      </div>
    </div>
  </div>
</section>

<section class="stats" aria-label="Project facts">
  <div class="container stats-inner">
    <div><strong>~60</strong><span>scoped permissions</span></div>
    <div><strong>3</strong><span>SSO protocols: OIDC, SAML, LDAP</span></div>
    <div><strong>5</strong><span>PowerDNS releases tested in CI</span></div>
    <div><strong>0</strong><span>telemetry, trackers or CDNs</span></div>
  </div>
</section>

<section class="section" id="features" aria-labelledby="features-title">
  <div class="container">
    <div class="section-head">
      <p class="eyebrow">Features</p>
      <h2 id="features-title">Everything you need to run authoritative DNS</h2>
      <p>Designed for teams that operate real, multi-backend PowerDNS infrastructure, from a homelab to a hosting provider.</p>
    </div>
    <div class="cards">
      ${highlights.map((h) => `<article class="card"><div class="card-icon">${icon(h.icon, 22)}</div><h3>${esc(h.title)}</h3><p>${h.text}</p></article>`).join("\n      ")}
    </div>
    <p class="section-more"><a class="link-arrow" href="/features/">Explore every feature${icon("arrowRight", 16)}</a></p>
  </div>
</section>

<section class="marquee-band" aria-labelledby="stack-title">
  <div class="container">
    <h2 class="band-title" id="stack-title">Fits the stack you already run</h2>
    <ul class="stack">${stack.map((s) => `<li>${s}</li>`).join("")}</ul>
  </div>
</section>

<section class="section section-alt" id="screens" aria-labelledby="screens-title">
  <div class="container">
    <div class="section-head">
      <p class="eyebrow">A closer look</p>
      <h2 id="screens-title">Clean, fast and mobile-first</h2>
      <p>Every screen reflows down to a phone. Pick a screen, switch device, or flip the theme: the screenshots follow.</p>
    </div>
    ${showcase}
  </div>
</section>

<section class="section" id="quickstart" aria-labelledby="qs-title">
  <div class="container">
    <div class="section-head">
      <p class="eyebrow">Quickstart</p>
      <h2 id="qs-title">Self-host it with Docker Compose</h2>
      <p>One image, <code>${site.image}</code>. Runs on SQLite or Postgres, and migrations plus the role seed run automatically on boot.</p>
    </div>
    <div class="quickstart">
      ${terminal}
      <div class="quickstart-notes">
        <ol class="steps">
          <li><strong>Generate secrets once</strong> into a persistent <code>.env</code>. A regenerated <code>APP_ENCRYPTION_KEY</code> makes stored API keys and MFA secrets unreadable, so back it up.</li>
          <li><strong>Set <code>APP_URL</code></strong> to the exact URL your browser uses, scheme and host included.</li>
          <li><strong>Start it</strong> with <code>docker compose up -d</code> and sign in with the bootstrap admin.</li>
          <li><strong>Optional:</strong> add a <code>provisioning.yaml</code> to register backends, roles, teams and SSO on first boot.</li>
        </ol>
        <div class="quickstart-links">
          <a class="btn btn-ghost" href="${site.docs.install}" rel="noopener">${icon("book", 16)}<span>Installation guide</span></a>
          <a class="btn btn-ghost" href="${site.docs.config}" rel="noopener">${icon("template", 16)}<span>All config options</span></a>
        </div>
        <p class="note">Running more than one replica? Use Postgres plus Redis behind a load balancer. Just evaluating? The <a href="${site.demo}" rel="noopener">live demo</a> is one click away.</p>
      </div>
    </div>
  </div>
</section>

<section class="section section-alt" aria-labelledby="compare-title">
  <div class="container split">
    <div>
      <p class="eyebrow">Coming from PowerDNS-Admin?</p>
      <h2 id="compare-title">A from-scratch take on the PowerDNS web UI</h2>
      <p class="lead">PowerDNS-AuthAdmin is a separate project written in TypeScript for teams with several backends, an identity provider and an auditor to answer to. Your zones already live in PowerDNS, so pointing it at your API is all it takes to see them.</p>
      <a class="link-arrow" href="/powerdns-admin-alternative/">How it compares and how to switch${icon("arrowRight", 16)}</a>
    </div>
    <ul class="checklist">
      <li>${icon("check", 18)}Role assignments scoped to a single zone, team or server</li>
      <li>${icon("check", 18)}OIDC, SAML 2.0 and LDAP with group → role mapping</li>
      <li>${icon("check", 18)}Passkeys, security keys and TOTP</li>
      <li>${icon("check", 18)}Diff-before-apply with optimistic concurrency</li>
      <li>${icon("check", 18)}Cluster and secondary sync probes</li>
      <li>${icon("check", 18)}Append-only, redacted audit log</li>
    </ul>
  </div>
</section>

<section class="section" aria-labelledby="faq-title">
  <div class="container narrow">
    <div class="section-head">
      <p class="eyebrow">FAQ</p>
      <h2 id="faq-title">Common questions</h2>
    </div>
    <div class="faq">
      ${homeFaqs.map((f) => `<details name="faq"><summary><h3>${f.q}</h3>${icon("chevronDown", 20)}</summary><div class="faq-a"><p>${f.a}</p></div></details>`).join("\n      ")}
    </div>
    <p class="section-more"><a class="link-arrow" href="/faq/">All questions${icon("arrowRight", 16)}</a></p>
  </div>
</section>

<section class="section cta-section" id="community" aria-labelledby="community-title">
  <div class="container">
    <div class="cta">
      <div class="cta-text">
        <p class="eyebrow">Community driven</p>
        <h2 id="community-title">Built in the open. Run it your way.</h2>
        <p>PowerDNS-AuthAdmin is MIT licensed and developed in public. Star the repo, start a discussion, report a bug or send a pull request. Contributions of every size are welcome.</p>
        <div class="cta-buttons">
          <a class="btn btn-primary btn-lg" href="${site.repo}" rel="noopener">${githubMark(18)}<span>Star on GitHub</span></a>
          <a class="btn btn-ghost btn-lg" href="${site.contributing}" rel="noopener">Contributing guide</a>
        </div>
      </div>
      <div class="mini-cards">
        <a class="mini-card" href="${site.discussions}" rel="noopener">${icon("chat", 20)}<span><strong>Discussions</strong>Ideas, questions and show-and-tell.</span></a>
        <a class="mini-card" href="${site.issues}" rel="noopener">${icon("bug", 20)}<span><strong>Issues</strong>Report a bug or request a feature.</span></a>
        <a class="mini-card" href="${site.docs.index}" rel="noopener">${icon("book", 20)}<span><strong>Documentation</strong>Install, configure and operate.</span></a>
        <a class="mini-card" href="${site.security}" rel="noopener">${icon("shield", 20)}<span><strong>Security</strong>Private vulnerability reporting.</span></a>
      </div>
    </div>
  </div>
</section>
`;

export default {
  slug: "home",
  path: "/",
  title: "PowerDNS-AuthAdmin: self-hosted web UI for PowerDNS Authoritative",
  description:
    "Free, open-source web UI for PowerDNS Authoritative with scoped RBAC, OIDC, SAML and LDAP SSO, passkeys, diff-before-apply editing, DNSSEC and an audit log.",
  priority: "1.0",
  changefreq: "weekly",
  lightbox: true,
  lcp: { name: "dashboard", sizes: HERO_SIZES },
  images: ["dashboard", "zones-list", "zone-edit-diff", "powerdns-servers", "audit-log", "roles"],
  og: {
    eyebrow: "Open-source PowerDNS admin UI",
    title: "DNS administration for PowerDNS, <em>built for teams.</em>",
    sub: "RBAC, OIDC · SAML · LDAP, passkeys, diff-before-apply and an append-only audit log.",
  },
  ogAlt: "PowerDNS-AuthAdmin: DNS administration for PowerDNS, built for teams",
  about: { "@id": ids.app },
  mainEntity: { "@id": ids.app },
  schema: [softwareNode(), sourceNode()],
  body,
};
