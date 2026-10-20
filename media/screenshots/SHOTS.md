# Screenshots

Source captures for the site, copied verbatim from the app repository's
`screenshots/<dark|light>/<name>{-mobile}.png` (PowerDNS-AuthAdmin v1.9.1).
Desktop captures are 1440x900; mobile captures are 830x1848 real screenshots
wrapped in an iPhone 16 Pro bezel. `node scripts/build-media.mjs shots` turns
them into WebP under `src/static/assets/img/shots/` and writes `src/shots.json`.

The captions and alt text below are derived from the app repository's
`screenshots/README.md`. Use the alt text when a page embeds a screenshot
(mobile variants: append "on mobile"). This file is documentation only;
nothing imports it.

| Name | Alt text | Caption |
| --- | --- | --- |
| `dashboard` | Dashboard | Operational landing page: active sessions, zone and backend totals, recent record-change counts, an Attention required surface and live PowerDNS statistics polled from every primary and secondary. |
| `backend-health` | Backend health popover | The bell in the top-right surfaces active backend advisories: unreachable hosts, API-key rejections, replication drift, missing TSIG keys, config drift between peers, with acknowledge and jump-to-source actions. |
| `zones-list` | Zones list | Every backend's zones merged into one searchable list with kind, serial, DNSSEC status, last-edit timestamp and a per-row sync chip; live-updates over SSE. |
| `zone-detail` | Zone detail | Per-zone landing: kind, serial, DNSSEC status, last-edit attribution, backend, Clone-zone button and tabs for Records, SOA, Zone settings, DNSSEC, Metadata and TSIG, Sync, Statistics, Access and Change history. |
| `zone-edit` | Edit record dialog | The per-RRset editor with structured editors for SRV, MX, CAA, NAPTR, SVCB, TLSA, SSHFP, URI, DS and TXT, inline validation and an explicit Save anyway override. |
| `zone-edit-diff` | Review changes diff | Every record change previewed as a BIND-style before / after diff before it is written; Save stays disabled until the operator confirms. |
| `zone-change-history` | Zone change history | The audit log filtered to a single zone, with before / after diffs, the acting user and a request-id deep-link to every related audit row. |
| `powerdns-servers` | PowerDNS servers | One row per backend grouped by topology (standalone primaries, primary + secondaries groups, multi-primary cluster peers) with reachability, version, sync status and a Test button. |
| `users` | Users | User management with a security column per mechanism (TOTP, email verification), account status and last sign-in; the detail page manages role assignments, MFA, password reset and sessions. |
| `teams` | Teams | Team-scoped grouping for RBAC: users join as member or owner and team-scoped role assignments grant permissions only within the team's resources. |
| `roles` | Roles | Seeded system roles (read-only / operator / admin) plus custom roles with the full permission grid across zones, records, backends, users, teams, audit, settings, OIDC, TSIG, autoprimaries and templates. |
| `audit-log` | Audit log | Append-only record of every state-changing action, filterable by actor, action, resource and date range, with redacted before / after snapshots, per-row PDNS HTTP-call log and CSV export. |
| `pdns-requests` | PDNS request log | Every HTTP call the app makes to PowerDNS, recorded with method, URL, status, error, request body and the audit requestId that triggered it, with inline expandable HTTP detail. |
| `oidc-providers` | Authentication providers | The unified sign-in methods page: Local Auth plus every OIDC, SAML and LDAP provider in one table, the Default sign-in method picker, discovery probes and the env-configured provider badged Configured by ENV. |
| `tsig-keys` | TSIG keys | Per-backend inventory of TSIG keys (name and algorithm only) and the wizard that walks through generate, install on peer secondaries and activate for zones. |
| `autoprimaries` | Autoprimaries | Per-backend (ip, nameserver, account) tuples PDNS accepts NOTIFYs from for auto-creation of secondary zones. |
| `zone-templates` | Zone templates | Reusable record-set bundles applied to new zones at create-time or to existing zones in place, parameterised by zone name and operator-supplied vars. |
| `settings` | Settings | Site-wide configuration: display name, brand logo, signup policy, operator-visible email defaults and rate-limit knobs, all also reachable through the first-boot YAML provisioner. |
| `profile` | Profile | Self-service account page: change password, enrol or remove TOTP, manage active sessions with revoke, and generate scoped API tokens. |

Each name also exists as `<name>-mobile` in both themes.
