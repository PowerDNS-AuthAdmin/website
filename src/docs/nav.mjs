// Docs sidebar: sections and ordering. Mirrors the grouping of the upstream
// docs/README.md table (guides first, reference after), split into the four
// questions an operator arrives with: getting it running, signing people in,
// operating it, and integrating or reading the reference material. Descriptions
// paraphrase README.md's "Read it when you want to..." column (or the doc's own
// intro where the README has none), so every claim is backed upstream.
//
// Each doc: { slug, title (short sidebar/card title), description (one line), icon }
//   issue: an upstream issue proposing the page; it is listed only while
//          content/docs/ or content/docs-overlay/ has the markdown.
// The page <h1> comes from the markdown itself.
//
// Architecture Decision Records are listed automatically from content/docs/adr/*.md:
// number and title from the h1 ("ADR NNNN - Title"), status and date from the
// "**Status:**" / "**Date:**" bullets. They render under /docs/adr/<NNNN-name>/.

import { existsSync, readdirSync, readFileSync } from "node:fs";

const CONTENT = new URL("../../content/docs/", import.meta.url);
const OVERLAY = new URL("../../content/docs-overlay/", import.meta.url);
const hasMarkdown = (slug) => [CONTENT, OVERLAY].some((dir) => existsSync(new URL(`${slug}.md`, dir)));

const guideSections = [
  {
    id: "getting-started",
    title: "Getting started",
    icon: "zap",
    blurb: "Try it in two minutes, then install it for real and connect your PowerDNS servers.",
    docs: [
      { slug: "quickstart", title: "Quickstart", icon: "play", description: "Try the app end-to-end on a throwaway Docker stack with demo zones, in about two minutes." },
      { slug: "installation", title: "Installation", icon: "download", description: "Run it for real: Docker or from source, SQLite or Postgres, a reverse proxy, backups and health checks." },
      { slug: "configuration", title: "Configuration", icon: "settings", description: "Every environment variable, what it does and when you need it." },
      { slug: "backends", title: "PowerDNS backends", icon: "server", description: "Wire up standalone primaries, primary + secondaries groups and multi-primary clusters, plus DNSSEC and TSIG." },
    ],
  },
  {
    id: "sign-in-access",
    title: "Sign-in & access",
    icon: "key",
    blurb: "Single sign-on with OIDC, SAML or LDAP, passkeys, and the roles that decide who can do what.",
    docs: [
      { slug: "oidc", title: "OIDC single sign-on", icon: "key", description: "Set up SSO with any OpenID Connect provider and map IdP groups to roles." },
      { slug: "saml", title: "SAML 2.0 single sign-on", icon: "user-check", description: "Set up SAML SSO with AD FS, Authentik or Keycloak." },
      { slug: "ldap", title: "LDAP sign-in", icon: "folder", description: "Authenticate directly against Active Directory or OpenLDAP." },
      { slug: "passkeys", title: "Passkeys & security keys", icon: "fingerprint", description: "Use WebAuthn as passwordless sign-in or as a second factor." },
      { slug: "rbac", title: "Roles & permissions", icon: "shield", description: "The five system roles, the permission vocabulary, scopes, custom roles and MFA-required roles." },
    ],
  },
  {
    id: "operations",
    title: "Operations",
    icon: "activity",
    blurb: "Provision a whole install from YAML, lock it down, upgrade it and fix it when something breaks.",
    docs: [
      { slug: "provisioning", title: "First-boot provisioning", icon: "workflow", description: "Bring up a fully configured install from one YAML file, and how to re-apply it." },
      { slug: "hardening", title: "Hardening", icon: "lock", description: "Lock down a production deployment: secrets, network exposure, authentication, least privilege and image signatures." },
      { slug: "upgrading", title: "Upgrading", icon: "package", description: "Move to a new version safely, with the notes that apply to each release." },
      { slug: "troubleshooting", title: "Troubleshooting", icon: "alert", description: "Fix a startup error, a backend that won't connect, a sign-in that does nothing or a lost admin account." },
    ],
  },
  {
    id: "integrations-reference",
    title: "Integrations & reference",
    icon: "plug",
    blurb: "Talk to your DNS from an AI assistant, browse the full feature catalog, or set up a dev environment.",
    docs: [
      { slug: "mcp", title: "Natural-language DNS with MCP", icon: "bot", description: "Connect Claude Code, Codex or any MCP client and manage records from a prompt." },
      { slug: "features", title: "Feature catalog", icon: "layers", description: "The full feature catalog with pointers to the modules that implement each one." },
      { slug: "dev-setup", title: "Dev setup", icon: "terminal", description: "Local development workflow: HMR, tests, migrations, demo stacks and screenshots." },
    ],
  },
];

/* ---------------------------------------------------------------- ADRs (auto-listed) */

// "ADR 0004 - Title", "ADR-0021: Title" and "12. Title" all appear upstream.
const ADR_H1 = /^#\s+(?:ADR[\s-]*)?(\d{1,4})\s*[-:.–]\s*(.+?)\s*$/m;
const inlineText = (md) =>
  md.replace(/\[([^\]]*)\]\([^)]*\)/g, "$1").replace(/[*_`]/g, "").replace(/\s+/g, " ").trim();

function statusOf(raw) {
  const text = inlineText(raw).replace(/\.$/, "");
  const ref = /(?:Superseded by|Supersedes)\s+ADR\s+(\d{4})/i.exec(text);
  if (/^superseded/i.test(text)) return { status: "superseded", label: ref ? `Superseded by ${ref[1]}` : "Superseded", ref: ref && ref[1] };
  if (/^accepted/i.test(text)) return { status: "accepted", label: /supersedes/i.test(text) && ref ? `Accepted, supersedes ${ref[1]}` : "Accepted", ref: ref && ref[1] };
  if (/^(proposed|draft)/i.test(text)) return { status: "proposed", label: "Proposed", ref: null };
  if (/^(deprecated|rejected|withdrawn)/i.test(text)) return { status: "retired", label: text.split(/[,.]/)[0], ref: null };
  return { status: "unknown", label: text.split(/[,.]/)[0] || "Unknown", ref: null };
}

export function parseAdr(markdown, slug) {
  const h1 = ADR_H1.exec(markdown);
  const file = /^(\d{4})-/.exec(slug.split("/").pop());
  const number = (h1 ? h1[1] : file ? file[1] : "0000").padStart(4, "0");
  const title = h1 ? inlineText(h1[2]) : slug;
  // Template form: "- **Status:** Accepted" / "- **Date:** 2026-05-16". ADR 0012 instead has a
  // "## Status" section and a bare "Date: ..." line, so fall back to those.
  const statusLine =
    (/^\s*[-*]\s+\*\*Status:?\*\*:?\s*(.+)$/m.exec(markdown) || [])[1] ||
    (/^##\s+Status\s*\n+\s*([^\n]+)/m.exec(markdown) || [])[1] ||
    "";
  const date =
    (/^\s*[-*]\s+\*\*Date:?\*\*:?\s*(\d{4}-\d{2}-\d{2})/m.exec(markdown) || [])[1] ||
    (/^(?:[-*]\s+)?Date:\s*(\d{4}-\d{2}-\d{2})/m.exec(markdown) || [])[1] ||
    null;
  return { number, title, date, ...statusOf(statusLine) };
}

const adrDir = new URL("adr/", CONTENT);
const adrDocs = existsSync(adrDir)
  ? readdirSync(adrDir)
      .filter((f) => /^\d{4}-[a-z0-9][a-z0-9.-]*\.md$/.test(f) && !f.startsWith("0000-"))
      .sort()
      .map((f) => {
        const slug = `adr/${f.replace(/\.md$/, "")}`;
        const meta = parseAdr(readFileSync(new URL(f, adrDir), "utf8"), slug);
        return {
          slug,
          title: meta.title,
          navTitle: `ADR ${meta.number}`,
          icon: meta.status === "superseded" ? "history" : "git-branch",
          description: `Architecture decision record ${meta.number}, ${meta.label.toLowerCase()}${meta.date ? `, decided ${meta.date}` : ""}.`,
          adr: meta,
        };
      })
  : [];

export const adrSection = {
  id: "adr",
  title: "Architecture decisions",
  icon: "scroll",
  blurb: "Why the codebase is shaped the way it is: one short record per load-bearing decision.",
  path: "/docs/adr/",
  docs: adrDocs,
};

const allSections = [...guideSections, adrSection];

export const sections = allSections.map((s) => ({ ...s, docs: s.docs.filter((d) => !d.issue || hasMarkdown(d.slug)) }));

/** Flat, ordered list of docs with their section attached. */
export const flatDocs = sections.flatMap((s) => s.docs.map((d) => ({ ...d, section: s })));

export const docBySlug = Object.fromEntries(flatDocs.map((d) => [d.slug, d]));

/** Quick-start path on the docs home. */
export const quickPath = [
  { slug: "installation", step: "Install", text: "Docker image or from source, on SQLite or Postgres, behind your reverse proxy." },
  { slug: "backends", step: "Connect a backend", text: "Point it at the PowerDNS HTTP API: one primary, a replication group or a cluster." },
  { slug: "oidc", step: "Sign in with SSO", text: "OIDC, SAML or LDAP, with IdP groups mapped to roles." },
];

/** Popular destinations on the docs home (anchors are verified at build time). */
export const popular = [
  { slug: "installation", hash: "a---docker-install", title: "Install with Docker Compose" },
  { slug: "installation", hash: "behind-a-reverse-proxy", title: "Put it behind nginx, HAProxy or Caddy" },
  { slug: "configuration", hash: "secrets-required", title: "The required secrets" },
  { slug: "oidc", hash: "group--role-mapping", title: "Map OIDC groups to roles" },
  { slug: "rbac", hash: "scopes", title: "Scope a role to specific zones" },
  { slug: "backends", hash: "topologies", title: "Backend topologies: standalone, primary + secondaries, cluster" },
  { slug: "mcp", hash: "claude-code", title: "Connect Claude Code over MCP" },
  { slug: "upgrading", hash: "version-specific-notes", title: "Version-specific upgrade notes" },
];
