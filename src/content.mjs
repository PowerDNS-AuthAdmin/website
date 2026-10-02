// Page copy that is reused across pages. Every claim here is backed by the app's
// README, docs/ or CHANGELOG; keep it that way when editing.
import { site } from "./site.mjs";

const a = (href, text) => `<a href="${href}"${href.startsWith("http") ? ' rel="noopener"' : ""}>${text}</a>`;

/* Feature highlights (home page cards). */
export const highlights = [
  {
    icon: "shield",
    title: "Real RBAC",
    text: "Five system roles plus your own custom roles across ~60 permissions, each assignment scoped to global, team, zone or server.",
  },
  {
    icon: "key",
    title: "SSO your way",
    text: "OIDC with PKCE, SAML 2.0 and LDAP / Active Directory, all with group → role mapping. Local accounts use Argon2id.",
  },
  {
    icon: "fingerprint",
    title: "Passkeys & MFA",
    text: "Passkeys and hardware security keys (WebAuthn) or TOTP. Any role can require MFA before it takes effect.",
  },
  {
    icon: "diff",
    title: "Diff before apply",
    text: "A per-RRset editor with per-type validators and optimistic concurrency. Every change is reviewed as a BIND-style diff.",
  },
  {
    icon: "layers",
    title: "Multi-backend",
    text: "Standalone primaries, primary + secondaries and multi-primary clusters, merged into one searchable zone list.",
  },
  {
    icon: "sync",
    title: "Sync you can see",
    text: "NOTIFY-aware probes compare every secondary's serial with its primary, and diff record-for-record on demand.",
  },
  {
    icon: "lock",
    title: "DNSSEC & TSIG",
    text: "Cryptokeys, TSIG keys, autoprimaries and zone metadata, with reading a TSIG secret split into its own permission.",
  },
  {
    icon: "log",
    title: "Append-only audit",
    text: "Every write is recorded with redacted before / after snapshots, the PowerDNS HTTP trail and per-zone history.",
  },
  {
    icon: "package",
    title: "One image, zero clicks",
    text: "A single Docker image on SQLite or Postgres. A provisioning.yaml brings up roles, teams, backends and SSO on first boot.",
  },
];

/* Full catalog for /features/. Each group becomes a section with an anchor. */
export const featureGroups = [
  {
    id: "access-control",
    short: "Access control",
    icon: "shield",
    title: "Access control that fits real teams",
    lead: "Give each person exactly the zones and actions they need, and nothing that could break the zone.",
    shot: { name: "roles", alt: "RBAC roles list showing the five system roles and their permission counts" },
    items: [
      ["~60 permissions", "A typed vocabulary across zones, records, SOA, DNSSEC, metadata, TSIG, autoprimaries, templates, users, teams, roles, servers, API tokens, audit, settings and auth providers."],
      ["System and custom roles", "Super Admin, Team Owner, Operator, Zone Editor and Read Only are seeded. Define your own roles in the UI or in provisioning.yaml."],
      ["Scoped assignments", "Every grant is (user, role, scope) where scope is global, a team, a single zone or a single server. An operator can edit records in one zone and nowhere else."],
      ["Zone authority kept apart", "The SOA, the apex NS RRset and zone settings each answer to their own permission, so a hosting customer can manage records without seeing the knobs that break the zone."],
      ["Teams", "Group users and zones into teams and delegate administration to a Team Owner scoped to that team."],
      ["MFA by role", "Mark a role as MFA-required and anyone holding it must enrol TOTP or a passkey."],
    ],
  },
  {
    id: "authentication",
    short: "Sign-in & SSO",
    icon: "key",
    title: "Sign-in for every identity stack",
    lead: "Bring your existing identity provider. Groups map to roles on every sign-in.",
    items: [
      ["OIDC", "Generic OpenID Connect with PKCE, per-provider group → role mapping and RP-initiated logout that signs you out at the IdP too. " + a(site.docs.oidc, "OIDC guide")],
      ["SAML 2.0", "Works with AD FS, Authentik, Keycloak, Okta, Microsoft Entra ID, PingFederate and Shibboleth. Signed assertions required by default, encryption optional. " + a(site.docs.saml, "SAML guide")],
      ["LDAP / Active Directory", "Direct bind against Active Directory or OpenLDAP with StartTLS, no federation broker in the path. Groups feed the same mapping as OIDC. " + a(site.docs.ldap, "LDAP guide")],
      ["Passkeys and security keys", "WebAuthn passkeys (Touch ID, Windows Hello, Android, iCloud Keychain, 1Password, Bitwarden) and hardware keys such as YubiKey, for passwordless sign-in or as a second factor. " + a(site.docs.passkeys, "Passkeys guide")],
      ["Local accounts and TOTP", "Argon2id password hashing with OWASP parameters, TOTP authenticator apps, session management and sign-in rate limiting."],
      ["Scoped API tokens", "Personal access tokens prefixed <code>pda_pat_</code> carry their own permission scopes for automation and CI."],
    ],
  },
  {
    id: "zones-records",
    short: "Zones & records",
    icon: "diff",
    title: "Zones and records, edited safely",
    lead: "See exactly what will change before it is written to PowerDNS.",
    shot: { name: "zone-edit-diff", alt: "Review changes dialog showing a BIND-style before and after diff of an NS record" },
    items: [
      ["Diff-before-apply", "Every change is previewed as a BIND-style before / after diff, then applied as a single RRset PATCH."],
      ["Per-type validation", "Structured editors per record type with inline validation and warnings, including trailing-dot fixes, CAA tags and underscore labels for DKIM, DMARC and SRV."],
      ["Optimistic concurrency", "Edits are checked against the RRset you loaded, so two people can't silently overwrite each other."],
      ["Zone templates and cloning", "Templates carry NS, SOA timers, prelude records, zone settings and per-kind metadata. Clone an existing zone in one step."],
      ["Configurable default TTL", "New records start from the zone's metadata, the global setting, then 3600, and the editor tells you which applied."],
      ["Split-horizon zones", "Mark a zone's internal copy so public and internal zones of the same name list separately with a clear badge."],
      ["BIND import and export", "Import one or many zones from a BIND zone file, or export any selection as a single BIND-format bundle."],
      ["Change history", "Every zone has its own history feed, built from the audit log."],
    ],
  },
  {
    id: "backends",
    short: "Backends",
    icon: "layers",
    title: "Every PowerDNS topology, one UI",
    lead: "Run many PowerDNS Authoritative backends from a single install, side by side.",
    shot: { name: "powerdns-servers", alt: "PowerDNS servers list with a three-peer cluster and a primary with three secondaries" },
    items: [
      ["Three topologies", "Standalone primaries, primary + secondaries groups (bootstrapped via autoprimary and NOTIFY / AXFR) and multi-primary clusters on a replicated database."],
      ["Amalgamated zone list", "Zones from every backend merge into one searchable, sortable list with serial, DNSSEC and sync state per row."],
      ["Cluster peer selection", "Route reads and writes by round-robin, random, lowest latency or least load."],
      ["Sync probes", "Compare each secondary's serial with the primary, or each cluster peer with the highest-serial peer, and diff record-for-record on demand."],
      ["Read-only backends", "Mark a backend read-only so writes skip it, for public nameservers fed by database replication."],
      ["Health advisories", "Bell-driven alerts for unreachable hosts, replication drift, missing TSIG keys on secondaries and daemon config drift."],
      ["Request log", "Every HTTP call to PowerDNS is recorded so you can see what the app asked for and what came back."],
      ["SSRF guard", "Backend URLs are validated; private networks and plain http are opt-in for trusted LANs."],
    ],
  },
  {
    id: "dnssec",
    short: "DNSSEC & TSIG",
    icon: "lock",
    title: "DNSSEC, TSIG and metadata",
    lead: "The PowerDNS features you'd otherwise reach for pdnsutil to manage.",
    items: [
      ["DNSSEC cryptokeys", "Create, update and delete cryptokeys, with each key's activity pulled from the audit log."],
      ["TSIG keys", "Create and manage TSIG keys; revealing a secret is a separate permission from reading the key list."],
      ["Autoprimaries", "Register and manage autoprimary (supermaster) entries for automatic secondary provisioning."],
      ["Zone metadata", "Edit per-zone metadata with validation and diff history."],
    ],
  },
  {
    id: "audit",
    short: "Audit",
    icon: "log",
    title: "An audit trail you can trust",
    lead: "Answer “who changed what, when, and from where” without grepping logs.",
    shot: { name: "audit-log", alt: "Audit log with filters for action, actor, resource and time range" },
    items: [
      ["Append-only", "Every state-changing action is written once and never edited."],
      ["Before / after snapshots", "Full snapshots with known secret fields redacted, plus the request ID and source IP."],
      ["PowerDNS HTTP trail", "Each audit row links to the PowerDNS requests it caused."],
      ["Filters and CSV export", "Filter by action, actor, resource and time, bookmark the query, and export to CSV."],
    ],
  },
  {
    id: "operations",
    short: "Operations",
    icon: "activity",
    title: "Built to operate",
    lead: "Observable, scriptable and quiet. Nothing leaves your network.",
    items: [
      ["First-boot provisioning", "One provisioning.yaml sets up settings, roles, teams, templates, clusters, servers, demo zones and identity providers. " + a(site.docs.provisioning, "Provisioning guide")],
      ["Full API", "Every admin surface has an <code>/api/admin</code> route that accepts a session or a scoped API token."],
      ["Metrics and probes", "Prometheus <code>/metrics</code>, <code>/healthz</code> liveness and <code>/readyz</code> readiness gated on the database and migration version."],
      ["Structured logs", "Pino JSON logs with secrets redacted."],
      ["Realtime UI", "A server-sent events bus pushes external zone edits to open browsers without a refresh."],
      ["High availability", "Postgres plus Redis for multiple replicas. Migrations are serialised by an advisory lock, so rolling boots are safe."],
      ["No telemetry, no CDN", "No phone-home and no third-party assets, so air-gapped installs are first-class."],
      ["Hardened by default", "Per-request CSP nonces, CSRF double-submit, AES-256-GCM encryption of stored secrets and a published security policy. " + a(site.docs.hardening, "Hardening guide")],
    ],
  },
  {
    id: "mobile",
    short: "Mobile",
    icon: "phone",
    title: "Mobile-first, light and dark",
    lead: "Every page reflows down to a phone, so you can fix a record from wherever you are.",
    items: [
      ["Responsive everywhere", "An off-canvas drawer, stacked tables and full-width dialogs on small screens."],
      ["Light and dark themes", "Follows your system preference, with a one-tap toggle."],
      ["Live status", "A header chip shows backend connectivity and sync state at a glance."],
    ],
  },
];

/* FAQs: marked up once, on /faq/. Answers are self-contained so they can be quoted. */
export const faqs = [
  {
    q: "What is PowerDNS-AuthAdmin?",
    a: `PowerDNS-AuthAdmin is a free, open-source web interface for managing PowerDNS Authoritative servers. It adds role-based access control, single sign-on (OIDC, SAML and LDAP), passkeys and MFA, a diff-before-apply record editor, DNSSEC and TSIG management, multi-backend cluster support and an append-only audit log on top of the PowerDNS HTTP API. It ships as one Docker image and is MIT licensed.`,
  },
  {
    q: "Is PowerDNS-AuthAdmin free?",
    a: `Yes. PowerDNS-AuthAdmin is free and open source under the MIT licence. You self-host it on your own infrastructure; there is no SaaS, no account to create and no telemetry.`,
  },
  {
    q: "Which PowerDNS versions does it support?",
    a: `PowerDNS-AuthAdmin is tested in CI against PowerDNS Authoritative ${site.pdnsVersions} (4.6, 4.7, 4.8, 4.9 and 5.0). It talks to PowerDNS through the Authoritative server's built-in HTTP API, so the API and an API key must be enabled.`,
  },
  {
    q: "Does it work with PowerDNS Recursor or dnsdist?",
    a: `No. PowerDNS-AuthAdmin manages PowerDNS Authoritative servers, the ones that host your zones. It does not configure PowerDNS Recursor or dnsdist.`,
  },
  {
    q: "How do I install PowerDNS-AuthAdmin?",
    a: `Run the Docker image <code>${site.image}</code> with Docker Compose. Generate <code>APP_SECRET_KEY</code> and <code>APP_ENCRYPTION_KEY</code> once into a <code>.env</code> file, set <code>APP_URL</code> to the URL your browser uses, set the bootstrap admin account and start the stack. Migrations run automatically on boot. The ${a(site.docs.install, "installation guide")} covers production setups with TLS and backups.`,
  },
  {
    q: "Which database does it need?",
    a: `SQLite for a single instance (homelab, evaluation, small teams) or PostgreSQL for multiple instances. To run more than one replica you need PostgreSQL plus Redis, which coordinates rate limiting, one-time reveal tokens and live updates across replicas.`,
  },
  {
    q: "Which single sign-on providers are supported?",
    a: `Any OpenID Connect provider (with PKCE, group → role mapping and RP-initiated logout), any SAML 2.0 identity provider such as AD FS, Authentik, Keycloak, Okta, Microsoft Entra ID, PingFederate or Shibboleth, and LDAP against Active Directory or OpenLDAP. Local email and password accounts are also available.`,
  },
  {
    q: "Does it support passkeys and two-factor authentication?",
    a: `Yes. Users can enrol WebAuthn passkeys and hardware security keys such as YubiKey, either for passwordless sign-in or as a second factor, and TOTP authenticator apps. A role can be marked MFA-required so everyone holding it must enrol.`,
  },
  {
    q: "Can I give a customer or team access to only their own zones?",
    a: `Yes. Every role assignment has a scope: global, a team, a single zone or a single server. A user can hold a record-editing role on one zone and have no access anywhere else. The SOA, apex NS records and zone settings are separate permissions, so you can let someone manage records without letting them change the zone's authority.`,
  },
  {
    q: "Can it manage several PowerDNS servers or clusters?",
    a: `Yes. One install manages standalone primaries, primary + secondaries groups and multi-primary clusters that share a replicated database. Zones from all backends appear in one list, and sync probes show whether every secondary or cluster peer has the same serial and records.`,
  },
  {
    q: "Is there an API for automation?",
    a: `Yes. Every admin screen has a matching <code>/api/admin</code> route. Scripts authenticate with personal access tokens (<code>pda_pat_…</code>) that carry their own permission scopes, sent as a Bearer token or <code>X-API-Key</code> header.`,
  },
  {
    q: "Can I import existing zones?",
    a: `Zones already hosted in PowerDNS appear as soon as you register the backend, because PowerDNS-AuthAdmin reads them straight from the PowerDNS API. You can also import one or many zones from a BIND zone file, and export any selection of zones as a BIND-format bundle.`,
  },
  {
    q: "Does PowerDNS-AuthAdmin send telemetry or load anything from a CDN?",
    a: `No. It makes no phone-home calls and serves all of its assets itself, so it runs in air-gapped networks.`,
  },
  {
    q: "How is it different from PowerDNS-Admin?",
    a: `PowerDNS-AuthAdmin is a separate project written from scratch in TypeScript on Node.js. Its focus is teams running multiple backends: scoped RBAC, OIDC / SAML / LDAP with group mapping, passkeys, diff-before-apply editing, cluster and secondary sync probes and an append-only audit log. See the ${a("/powerdns-admin-alternative/", "comparison page")} for details.`,
  },
  {
    q: "Is there a live demo?",
    a: `Yes. ${a(site.demo, "demo.powerdns-authadmin.org")} is a real, seeded install you can click around in. The sign-in details are on its login page and in the project README.`,
  },
  {
    q: "How do I report a security issue?",
    a: `Please report vulnerabilities privately through GitHub's private vulnerability reporting, as described in the ${a(site.security, "security policy")}. Do not open a public issue.`,
  },
];
