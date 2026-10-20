import { existsSync, readFileSync } from "node:fs";

// Single source of truth for facts that appear on more than one page.
// `version` and `released` come from content/docs/_source.json, which
// `npm run sync-docs -- --ref vX.Y.Z` writes: syncing a release updates both.
//
// Base path: the site works at a domain root and under a subpath. Production is
// https://powerdns-authadmin.org (nginx, domain root); CI also builds with
//   SITE_URL=http://127.0.0.1:8080/preview node scripts/build.mjs
// so a subpath build keeps working. `site.url` is the absolute origin + path (no
// trailing slash) for canonical, og, sitemap and JSON-LD URLs; `site.base` is just
// the path ("" at a domain root). Every internal link and asset goes through href().

const raw = (process.env.SITE_URL || "https://powerdns-authadmin.org").trim();
const parsed = new URL(raw.endsWith("/") ? raw : raw + "/");
const base = parsed.pathname.replace(/\/+$/, "");

const repo = "https://github.com/PowerDNS-AuthAdmin/powerdns-authadmin";

const sourceFile = new URL("../content/docs/_source.json", import.meta.url);
if (!existsSync(sourceFile)) {
  throw new Error(
    "content/docs/_source.json is missing: the docs (and the app version) are synced from the upstream repository. " +
      "Run `npm run sync-docs -- --ref vX.Y.Z` (the release tag to publish) and build again.",
  );
}
const synced = JSON.parse(readFileSync(sourceFile, "utf8"));
const version = synced.version;
if (!version || !synced.releaseDate) {
  throw new Error("content/docs/_source.json has no version/releaseDate: re-run `npm run sync-docs -- --ref vX.Y.Z`.");
}

export const site = {
  // STAGING=1: a preview deploy. Every page is noindex and robots.txt disallows everything.
  staging: process.env.STAGING === "1",
  name: "PowerDNS-AuthAdmin",
  domain: "powerdns-authadmin.org",
  url: parsed.origin + base,
  base,
  host: parsed.host,
  lang: "en",
  locale: "en_US",
  tagline: "Modern, self-hosted DNS administration for PowerDNS Authoritative",
  description:
    "Open-source, self-hosted web UI for PowerDNS Authoritative: RBAC, OIDC, SAML and LDAP sign-in, passkeys, diff-before-apply zone editing, DNSSEC, multi-backend clusters, an append-only audit log and a built-in MCP server so AI assistants can manage DNS in natural language.",
  version,
  released: synced.releaseDate.slice(0, 10),
  license: "MIT",
  licenseUrl: "https://opensource.org/license/mit",
  pdnsVersions: "4.6 to 5.0",
  image: "ghcr.io/powerdns-authadmin/powerdns-authadmin",
  demo: "https://demo.powerdns-authadmin.org",
  org: "https://github.com/PowerDNS-AuthAdmin",
  repo,
  releases: `${repo}/releases`,
  latestRelease: `${repo}/releases/latest`,
  release: `${repo}/releases/tag/v${version}`,
  changelog: `${repo}/blob/main/CHANGELOG.md`,
  issues: `${repo}/issues`,
  discussions: `${repo}/discussions`,
  security: `${repo}/security/policy`,
  advisories: `${repo}/security/advisories/new`,
  contributing: `${repo}/blob/main/CONTRIBUTING.md`,
  licenseFile: `${repo}/blob/main/LICENSE`,
  // The docs folder at the synced release: where "edit on GitHub" and source links go.
  docsSource: `${repo}/tree/v${version}/docs`,
  package: `${repo}/pkgs/container/powerdns-authadmin`,
  websiteRepo: "https://github.com/PowerDNS-AuthAdmin/website",
  // Commercial support is offered by NGN, who built this website (the app itself is a community
  // project). Details are from ngn.au (includes/config.php and llms.txt), checked 20 Oct 2026.
  support: {
    name: "NGN",
    legalName: "Next Generation Networks",
    url: "https://ngn.au/",
    contact: "https://ngn.au/contact/",
    phone: "1300 096 253",
    phoneIntl: "+61 2 8287 3300",
    email: "sales@ngn.au",
    hours: "Open 24 hours, 7 days",
  },
  // GA4 measurement ID, loaded by src/js/analytics.js (shared NGN event script). Empty disables analytics.
  ga4: "G-Y8C640LSFR",
  // IndexNow (Bing, Yandex, Seznam...). Public by design: served at /<key>.txt.
  indexNowKey: "652aab60d92521253f92abc06012277a",
  // Site paths (not GitHub URLs): the docs are rendered on this site from content/docs.
  // Pages pass them through href() like any other internal path.
  docs: {
    index: "/docs/",
    quickstart: "/docs/quickstart/",
    install: "/docs/installation/",
    config: "/docs/configuration/",
    backends: "/docs/backends/",
    oidc: "/docs/oidc/",
    provisioning: "/docs/provisioning/",
    rbac: "/docs/rbac/",
    hardening: "/docs/hardening/",
    upgrading: "/docs/upgrading/",
    troubleshooting: "/docs/troubleshooting/",
    passkeys: "/docs/passkeys/",
    ldap: "/docs/ldap/",
    saml: "/docs/saml/",
    mcp: "/docs/mcp/",
    features: "/docs/features/",
    devSetup: "/docs/dev-setup/",
    adr: "/docs/adr/",
  },
  nav: [
    { href: "/features/", label: "Features" },
    { href: "/docs/", label: "Docs" },
    { href: "/#mcp", label: "Talk to your DNS" },
    { href: "/powerdns-admin-alternative/", label: "Compare" },
    { href: "/faq/", label: "FAQ" },
  ],
};

// Prefix an internal path with the base path. Absolute URLs, anchors and
// protocol-relative/mailto links pass through untouched.
export function href(path = "/") {
  if (/^(?:[a-z][a-z0-9+.-]*:|#|\/\/)/i.test(path)) return path;
  if (!path.startsWith("/")) path = "/" + path;
  return base + path;
}

// Absolute URL for canonical, og, sitemap and JSON-LD.
export const abs = (path = "/") => site.url + (path.startsWith("/") ? path : "/" + path);

// Prepare an HTML fragment from content.mjs: prefix root-relative href/src
// attributes with the base path (content is written with "/docs/..." paths) and
// give outbound links rel="noopener".
export function hrefAll(html) {
  let out = String(html);
  if (base) {
    out = out.replace(/(\s(?:href|src)=")(\/(?!\/)[^"]*)"/g, (m, a, p) =>
      p.startsWith(base + "/") || p === base ? m : `${a}${base}${p}"`,
    );
  }
  return out.replace(/<a\s([^>]*href="https?:[^"]*"[^>]*)>/g, (m, inner) => (/\srel=|^rel=/.test(inner) ? m : `<a ${inner} rel="noopener">`));
}
