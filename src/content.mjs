// Page copy that is reused across pages. Every claim here is backed by the app's
// README, docs/ or CHANGELOG; keep it that way when editing.
import { site, href } from "./site.mjs";

// Internal paths (incl. site.docs.*) are root-relative and get the base path via href();
// only off-site links carry rel="noopener".
const a = (to, text) => `<a href="${href(to)}"${/^https?:/.test(to) ? ' rel="noopener"' : ""}>${text}</a>`;

/* Feature highlights (home page cards). */
export const highlights = [
  {
    icon: "sync",
    title: "PTR records that keep up",
    text: "Saving or deleting an A/AAAA record can create, update or remove its PTR in a reverse zone on any backend, and a fleet-wide Reverse DNS report shows every address that is missing, mismatched or orphaned.",
  },
  {
    icon: "globe",
    title: "Zone Monitoring",
    text: "Every hosted zone checked from the outside: delegation walked from the root servers, each nameserver, open AXFR, the DNSSEC chain and what resolvers answer. Findings feed the notification bell.",
  },
  {
    icon: "sparkles",
    title: "Talk to your DNS",
    text: "A built-in MCP server lets Claude Code, Codex, Cursor or any MCP client manage zones and records, reverse DNS and monitoring from a prompt, under the same RBAC, validation and audit log as the UI.",
  },
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
    text: "Edit records inline, in the full editor or through the Add record wizard, drive it all from the keyboard, and review every change as a BIND-style diff before it is written.",
  },
  {
    icon: "layers",
    title: "Multi-backend, in sync",
    text: "Standalone primaries, primary + secondaries and multi-primary clusters in one zone list, with NOTIFY-aware probes that compare every secondary's serial.",
  },
  {
    icon: "lock",
    title: "DNSSEC & TSIG",
    text: "Enable, disable and rectify DNSSEC per zone, publish the right DS set, manage cryptokeys, TSIG keys and autoprimaries without pdnsutil.",
  },
  {
    icon: "log",
    title: "Append-only audit",
    text: "Every write, including what an AI assistant does, is recorded with redacted before / after snapshots and the PowerDNS HTTP trail, with a fleet-wide Change log and one per zone.",
  },
  {
    icon: "package",
    title: "One image, zero clicks",
    text: "A single Docker image on SQLite or Postgres. A provisioning.yaml brings up roles, teams, backends and SSO on first boot.",
  },
  {
    icon: "search",
    title: "Search everything",
    text: "<kbd>Ctrl K</kbd> / <kbd>⌘K</kbd> fuzzy-matches zones, records and config across every backend, filtered by your own permissions. The request and audit logs have their own tabs.",
  },
];

/* Full catalog for /features/. Each group becomes a section with an anchor. */
export const featureGroups = [
  {
    id: "reverse-dns",
    short: "Reverse DNS",
    icon: "sync",
    title: "Reverse DNS that keeps up with your records",
    lead: "Keep every A and AAAA record and its PTR in step on save, and see where they have drifted across the whole fleet.",
    shot: { name: "reverse-dns", alt: "Reverse DNS report listing addresses with their forward records, PTR and a status per row" },
    items: [
      ["PTR on save", "Saving or deleting an A/AAAA record creates, updates or removes the matching PTR in a reverse zone hosted on any backend, including RFC 2317 classless zones. The review dialog lists the reverse changes before Save."],
      ["Global, per zone or per save", "Switch it on for everything with the <code>auto_ptr</code> setting (Settings or provisioning), for one zone with <code>X-AUTHADMIN-AUTO-PTR</code> metadata, or for a single save with the editor's checkbox. The API and the MCP record tools take a <code>ptr</code> flag."],
      ["Never clobbers", "Reverse zones are never created. A PTR that points at a different name is never replaced without an explicit takeover and never deleted, and the user needs record permissions in the reverse zone."],
      ["Reported and audited per address", "Every PTR outcome comes back per address and is audited as <code>record.ptr-sync</code> next to the ordinary record changes on the reverse zone."],
      ["Fleet-wide report", "Every A/AAAA record on every backend compared with its PTR: OK, missing, mismatch, ambiguous, orphan or not hosted. Record tables link each address to its PTR and each PTR back to its forward records, and the sidebar counts the addresses that need attention."],
      ["Rectify with a reviewed diff", "Fix one row, a selection or everything fixable. Removals and bulk rectifies open Review changes with the PTR diff for each reverse zone before Apply."],
      ["Suggested fixes for orphans", "A PTR with no forward record offers two fixes: add the forward record (the Add record wizard opens prefilled) or remove the PTR."],
      ["Public and internal kept apart", "Matching follows the zone horizon, so public records only match public reverse zones and internal ones only internal. An unclassified reverse zone over private address space counts as internal."],
      ["Addresses you don't host", "When no hosted reverse zone covers an address, its PTR is looked up through the public or internal resolvers, so you can see whether the upstream record matches."],
      ["Opt-in", "Nothing is written until you turn on <code>auto_ptr</code>, set the zone metadata or tick the checkbox on a save. The Reverse DNS report needs <code>REVERSE_DNS_ENABLED=true</code>; while it is off, its page, routes and MCP tools do not exist. " + a(site.docs.features + "#48-automatic-ptr-maintenance-auto-ptr", "Feature reference")],
    ],
  },
  {
    id: "zone-monitoring",
    short: "Zone Monitoring",
    icon: "globe",
    title: "Zone Monitoring, from the outside in",
    lead: "A zone PowerDNS serves correctly can still be broken for everyone else. AuthAdmin checks every hosted zone the way the internet sees it.",
    shot: { name: "zone-monitoring", alt: "Zone Monitoring page with a verdict per zone and expandable findings" },
    items: [
      ["Delegation from the root", "The parent's NS set, glue and DS are read by walking down from the root servers, not through a recursive resolver, and compared with the zone's apex NS and DNSKEYs."],
      ["Every nameserver probed", "Each NS address is asked for the SOA without recursion: did it answer, with the AA flag, with which serial, and does it serve the same NS set as PowerDNS."],
      ["Open zone transfer", "An unsigned AXFR is tried against the zone's own nameservers only, and reading stops at the first message."],
      ["DNSSEC chain", "The DS at the parent is compared with the zone's DNSKEYs by key tag and algorithm: a signed zone without a DS, a DS for an unsigned zone, or a DS left over from an unfinished key rollover."],
      ["Resolver view and SOA sanity", "The configured public or internal resolvers are asked what they answer, and SOA timers, MNAME and RNAME are checked against the RFCs."],
      ["Fix with a reviewed diff", "The \"SOA MNAME is not one of the nameservers\" finding suggests the zone's first nameserver. Fix shows the SOA before and after, saves through the zone's own SOA route and re-checks the zone."],
      ["Findings in the bell", "Findings have stable codes and an error, warn or info severity with what to do. Errors and warnings reach the notification bell after two sightings, at once after a manual re-check, and the sidebar shows a count."],
      ["Horizon-aware", "Internal zones skip the root walk and are judged against your internal resolvers, so a zone that is not meant to be on the internet is not flagged for it."],
      ["Single nameserver by design", "A standalone backend can accept single-nameserver zones: the finding stays on the page as information and out of the bell."],
      ["Bounded and opt-in", "Three zones at a time, spaced across the interval, 3 second timeouts and rate-limited manual re-checks. Off unless <code>ZONE_MONITOR_ENABLED=true</code>, because it sends DNS queries outside your network. " + a(site.docs.features + "#20-zone-monitoring", "Feature reference")],
    ],
  },
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
      ["Add record wizard", "Add record next to Add zone picks the horizon, finds the zone with a type-ahead across every backend, checks live whether the name is already taken, shows the diff, then waits until every secondary or cluster peer serves the change."],
      ["Inline editing", "Enter on a row, a double-click or the row's Edit button opens an edit strip under the record for TTL, value and the disabled flag. Renames and type changes escalate to the full editor with the draft carried along."],
      ["Keyboard-first", "<kbd>/</kbd> searches, <kbd>N</kbd> adds, arrows move, <kbd>Enter</kbd> edits in place, <kbd>E</kbd> opens the full editor, <kbd>Delete</kbd> deletes. Every select menu is a combo box with type-ahead and a filter for long lists."],
      ["Per-type validation", "Structured editors per record type with inline validation and warnings, including trailing-dot fixes, CAA tags and underscore labels for DKIM, DMARC and SRV."],
      ["Optimistic concurrency", "Edits are checked against the RRset you loaded, so two people can't silently overwrite each other."],
      ["Zone templates and cloning", "Templates carry NS, SOA timers, prelude records, zone settings and per-kind metadata. Clone an existing zone in one step."],
      ["Configurable default TTL", "New records start from the zone's metadata, the global setting, then 3600, and the editor tells you which applied."],
      ["Split-horizon zones", "Mark a zone's internal copy so public and internal zones of the same name list separately with a clear badge."],
      ["BIND import and export", "Import one or many zones from a BIND zone file, or export any selection as a single BIND-format bundle."],
      ["Change log", "Every zone has a Change log tab built from the audit log, with diffs, and Show all changes opens the fleet-wide Change log narrowed to that zone."],
    ],
  },
  {
    id: "mcp",
    short: "Talk to your DNS",
    icon: "sparkles",
    title: "Talk to your DNS with any AI assistant",
    lead: "A Model Context Protocol (MCP) server is built in. Describe the change; the assistant makes it through the same guard rails as the UI.",
    items: [
      ["Built-in MCP server", "<code>POST /api/mcp</code> speaks Streamable HTTP, stateless and JSON, so it works behind any reverse proxy and across replicas. " + a(site.docs.mcp, "MCP guide")],
      ["Works with your client", "Claude Code, Codex, Cursor, Windsurf and any HTTP-capable MCP client connect with a URL and a Bearer header. Stdio-only clients bridge through mcp-remote."],
      ["Twenty task-shaped tools", "Backends, zones and records, plus everything the new pages do: find a zone, check a name before adding it, wait for a zone to sync, read and rectify the Reverse DNS report, read and re-run Zone Monitoring, search, and list or dismiss notifications. The Reverse DNS and Zone Monitoring tools exist only while those features are on."],
      ["Never more than the token", "Every call runs as the owner of a personal access token. Scopes and per-zone grants are the ceiling, re-evaluated on every call, and revocation is immediate."],
      ["Read-only tokens, read-only server", "Write tools are only advertised to tokens that can write somewhere, so a look-only token never tempts the assistant to try."],
      ["Same validators, same diff path", "Writes go through the per-type validators, optimistic concurrency and NOTIFY the UI uses. A malformed value comes back as a readable error the assistant can correct."],
      ["Destructive calls flagged", "Replace, delete-records and delete-zone are annotated as destructive, so clients that confirm such calls will ask you first. Deleting a zone also requires the assistant to repeat its name."],
      ["Audited by name", "Everything an assistant does lands in the audit log under the token owner, with the client's user agent, so you can filter for it."],
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
      ["Read-only backends", "Mark a backend read-only and every write route refuses it, for public nameservers fed by database replication."],
      ["Health advisories", "Bell-driven alerts for unreachable hosts, replication drift, missing TSIG keys on secondaries and daemon config drift."],
      ["Notifications page", "The bell previews the three most pressing notifications with a count by severity. Show all lists every backend health and Zone Monitoring notification with filters, search, detail and per-row or bulk dismissal, each visible only to users who can read what it is about."],
      ["Request log", "Every HTTP call to PowerDNS is recorded so you can see what the app asked for and what came back, pruned after a configurable number of days."],
      ["SSRF guard", "Backend URLs are validated; private networks and plain http are opt-in for trusted LANs."],
    ],
  },
  {
    id: "dnssec",
    short: "DNSSEC & TSIG",
    icon: "lock",
    title: "DNSSEC, TSIG and metadata",
    lead: "The PowerDNS features you'd otherwise reach for pdnsutil to manage, with the secondaries kept in step.",
    items: [
      ["Enable, disable, rectify", "Sign a zone the way PowerDNS intends: one call adds default keys, rectifies and bumps the serial, then NOTIFYs. Disabling asks for the zone name and reminds you to pull the DS first."],
      ["The right DS set", "The DNSSEC tab shows signing state, NSEC / NSEC3, SOA-EDIT and the DS records to publish, leaving out SHA-1 and GOST digests that registrars refuse."],
      ["Presigned secondaries handled", "Transferred zones get SOA-EDIT so secondaries re-transfer fresh signatures, sync probes compare the served serial, and warnings flag LUA or ALIAS records a secondary cannot sign."],
      ["DNSSEC cryptokeys", "Create, update and delete cryptokeys; creating one rectifies the zone so denial of existence is never left broken. Each key's activity is pulled from the audit log."],
      ["DNSSEC over the API", "Signing state, keys, the DS set and per-mirror sync are readable with a scoped token, never private key material. " + a(site.docs.backends + "#dnssec", "Rollout order and curl examples")],
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
      ["Fleet-wide Change log", "What people changed, everywhere: records, zones, DNSSEC, users and access, and configuration, with a Zone column and a Category filter. It sits in a Logs sidebar section next to the Request log and the Audit log."],
    ],
  },
  {
    id: "operations",
    short: "Operations",
    icon: "activity",
    title: "Built to operate",
    lead: "Observable, scriptable and quiet. Nothing leaves your network unless you turn on the checks that look at it from outside.",
    items: [
      ["First-boot provisioning", "One provisioning.yaml sets up settings, roles, teams, templates, clusters, servers, demo zones and identity providers. " + a(site.docs.provisioning, "Provisioning guide")],
      ["Full API", "Every admin surface has an <code>/api/admin</code> route that accepts a session or a scoped API token."],
      ["Metrics and probes", "Prometheus <code>/metrics</code>, <code>/healthz</code> liveness and <code>/readyz</code> readiness gated on the database and migration version."],
      ["Backup and restore", "Export the app database (users, roles, grants, backends, providers, settings, audit log) as JSON with secrets still encrypted, and merge it back into a fresh install that shares the encryption key."],
      ["Structured logs", "Pino JSON logs with secrets redacted."],
      ["Global search", "A header palette (<kbd>Ctrl K</kbd> / <kbd>⌘K</kbd> or <kbd>/</kbd>) fuzzy-matches zones, records and config, with the PowerDNS request log and the audit log in their own tabs. Results show where a zone or record lives and its state, every source is filtered by your permissions, and secrets are never indexed."],
      ["Realtime UI", "A server-sent events bus pushes external zone edits to open browsers without a refresh, and the stream reopens on its own after a tab sleeps or the network drops, without reloading the page."],
      ["High availability", "Postgres plus Redis for multiple replicas. Migrations are serialised by an advisory lock, so rolling boots are safe."],
      ["No telemetry, no CDN", "No phone-home and no third-party assets, so air-gapped installs are first-class. Zone Monitoring and the Reverse DNS lookups are the only features that send DNS queries out, and both are off by default."],
      ["Hardened by default", "Per-request CSP nonces, CSRF double-submit, AES-256-GCM encryption of stored secrets and a published security policy. " + a(site.docs.hardening, "Hardening guide")],
    ],
  },
  {
    id: "mobile",
    short: "Mobile & a11y",
    icon: "phone",
    title: "Mobile-first, accessible, light and dark",
    lead: "Every page reflows down to a phone and works without a mouse, so you can fix a record from wherever you are.",
    items: [
      ["Responsive everywhere", "An off-canvas drawer, stacked tables and full-width dialogs on small screens."],
      ["Keyboard operable", "Sortable headers are real buttons, pickers are combo boxes, dialogs trap and restore focus, and the mobile drawer is inert while closed."],
      ["WCAG AA contrast", "Semantic colours used as text meet AA in both themes, every field is labelled for screen readers, and animation honours reduced-motion preferences."],
      ["Light and dark themes", "Follows your system preference, with a one-tap toggle. Self-hosted Inter and JetBrains Mono, no font CDN."],
      ["Live status", "A header chip shows backend connectivity and sync state at a glance, naming the actual state: lagging, missing or error."],
    ],
  },
];

/* FAQs: marked up once, on /faq/. Answers are self-contained so they can be quoted. */
export const faqs = [
  {
    q: "What is PowerDNS-AuthAdmin?",
    a: `PowerDNS-AuthAdmin is a free, open-source web interface for managing PowerDNS Authoritative servers. It adds role-based access control, single sign-on (OIDC, SAML and LDAP), passkeys and MFA, a diff-before-apply record editor, automatic PTR maintenance with a fleet-wide Reverse DNS report, Zone Monitoring of delegation, nameservers and DNSSEC from the outside, DNSSEC and TSIG management, multi-backend cluster support, an append-only audit log and a built-in MCP server for AI assistants on top of the PowerDNS HTTP API. It ships as one Docker image and is MIT licensed.`,
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
    q: "Can PowerDNS-AuthAdmin keep PTR records in sync?",
    a: `Yes, since version 1.10.0. With automatic PTR maintenance on, saving or deleting an A or AAAA record also creates, updates or removes the matching PTR in a reverse zone hosted on any of your backends, including RFC 2317 classless zones, and the review dialog shows the reverse change before you save. Turn it on globally with the <code>auto_ptr</code> setting, per zone with <code>X-AUTHADMIN-AUTO-PTR</code> metadata, or for one save with the editor's checkbox; nothing is written otherwise. It never creates reverse zones and never replaces a PTR that points at another name without an explicit takeover. To reconcile what is already there, set <code>REVERSE_DNS_ENABLED=true</code> for the Reverse DNS report, which compares every A/AAAA record in the fleet with its PTR (OK, missing, mismatch, ambiguous, orphan, not hosted) and rectifies the rows you pick after showing the PTR diff. See the ${a(site.docs.features + "#48-automatic-ptr-maintenance-auto-ptr", "feature reference")}.`,
  },
  {
    q: "Does it monitor delegation, nameservers and DNSSEC?",
    a: `Yes, since version 1.10.0, when you set <code>ZONE_MONITOR_ENABLED=true</code>. Zone Monitoring checks every hosted zone from the outside on a schedule: the delegation at the parent, read by walking from the root servers rather than through a resolver, each nameserver's reachability, authority, serial and NS set, open AXFR, the DS at the parent against the zone's DNSKEYs, what public or internal resolvers answer, and the SOA timers, MNAME and RNAME. Findings have stable codes, a severity and what to do; errors and warnings appear in the notification bell, and an SOA MNAME finding has a Fix button that shows the change as a diff before saving. It is off by default because it sends DNS queries outside your network. See the ${a(site.docs.features + "#20-zone-monitoring", "feature reference")} and the ${a(site.docs.config + "#zone-monitoring", "configuration guide")}.`,
  },
  {
    q: "Can I search across every zone and record?",
    a: `Yes. Press <kbd>Ctrl K</kbd> (<kbd>⌘K</kbd> on a Mac), <kbd>/</kbd> or the Search button in the header to fuzzy-search zones, records (names and values) and configuration across every backend. The PowerDNS request log and the audit log are searched from their own tabs. Results are filtered by your own permissions and secrets are never indexed or returned. The same search is available as <code>GET /api/search</code> and the MCP <code>search</code> tool.`,
  },
  {
    q: "Is there an API for automation?",
    a: `Yes. Every admin screen has a matching <code>/api/admin</code> route. Scripts authenticate with personal access tokens (<code>pda_pat_…</code>) that carry their own permission scopes, sent as a Bearer token or <code>X-API-Key</code> header. The same tokens authenticate MCP clients on <code>/api/mcp</code>, and DNSSEC state (signing status, keys, the DS set, per-mirror sync) is readable over the API too.`,
  },
  {
    q: "Can I manage DNS with Claude Code or another AI assistant?",
    a: `Yes. Since version 1.9.0, PowerDNS-AuthAdmin includes a Model Context Protocol (MCP) server at <code>/api/mcp</code>. Connect Claude Code, Codex, Cursor, Windsurf or any MCP client over Streamable HTTP with a personal access token as the Bearer header, then ask in plain language: point <code>www</code> at an address, replace a zone's MX records, create a staging zone. The assistant gets tools for backends, zones and records, and since 1.10.0 for everything the new pages do: finding a zone, checking a name before adding it, waiting for a zone to sync, the Reverse DNS report and its rectify, Zone Monitoring, search and notifications. See the ${a(site.docs.mcp, "MCP guide")} for each client's configuration.`,
  },
  {
    q: "Is it safe to let an AI assistant change DNS records?",
    a: `The MCP server gives an assistant no power its token owner doesn't have. Every call runs as the owner of a personal access token, limited by the token's scopes and per-zone grants, and goes through the same validators, optimistic concurrency and audit log as the web UI. A read-only token presents a read-only server, destructive tools are annotated so clients can ask for confirmation, deleting a zone requires the assistant to repeat its name, and every change is logged under the owner's name with the client's user agent. Give a bot the minimum: a per-zone grant beats a global role.`,
  },
  {
    q: "Can I import existing zones?",
    a: `Zones already hosted in PowerDNS appear as soon as you register the backend, because PowerDNS-AuthAdmin reads them straight from the PowerDNS API. You can also import one or many zones from a BIND zone file, and export any selection of zones as a BIND-format bundle.`,
  },
  {
    q: "Does PowerDNS-AuthAdmin send telemetry or load anything from a CDN?",
    a: `No. It makes no phone-home calls and serves all of its assets itself, so it runs in air-gapped networks. The only features that send traffic outside your network on their own are Zone Monitoring (<code>ZONE_MONITOR_ENABLED=true</code>) and the Reverse DNS lookups for addresses you don't host (<code>REVERSE_DNS_ENABLED=true</code>). Both are off by default, and both send only DNS queries on port 53.`,
  },
  {
    q: "How is it different from PowerDNS-Admin?",
    a: `PowerDNS-AuthAdmin is a separate project written from scratch in TypeScript on Node.js. Its focus is teams running multiple backends: scoped RBAC, OIDC / SAML / LDAP with group mapping, passkeys, diff-before-apply editing, cluster and secondary sync probes, automatic PTR maintenance, Zone Monitoring, an append-only audit log and a built-in MCP server for AI assistants. See the ${a("/powerdns-admin-alternative/", "comparison page")} for details.`,
  },
  {
    q: "Is there a live demo?",
    a: `Yes. ${a(site.demo, "demo.powerdns-authadmin.org")} is a real, seeded install you can click around in. The sign-in details are on its login page and in the project README.`,
  },
  {
    q: "Is commercial support available?",
    a: `Yes. PowerDNS-AuthAdmin is free and community supported: ask questions in ${a(site.discussions, "GitHub Discussions")} and report bugs in ${a(site.issues, "Issues")}. Commercial support, 24 hours a day, is available from ${a(site.support.url, `${site.support.legalName} (${site.support.name})`)}, the Sydney IT company that built this website; see ${a("/support/", "commercial support")} for how to reach them.`,
  },
  {
    q: "How do I report a security issue?",
    a: `Please report vulnerabilities privately through GitHub's private vulnerability reporting, as described in the ${a(site.security, "security policy")}. Do not open a public issue.`,
  },
];
