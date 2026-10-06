// Single source of truth for facts that appear on more than one page.
// Bump `version` / `released` when the app ships a release.

const repo = "https://github.com/PowerDNS-AuthAdmin/powerdns-authadmin";
const docs = `${repo}/blob/main/docs`;

export const site = {
  name: "PowerDNS-AuthAdmin",
  domain: "powerdns-authadmin.org",
  url: "https://powerdns-authadmin.org",
  lang: "en",
  locale: "en_US",
  tagline: "Modern, self-hosted DNS administration for PowerDNS Authoritative",
  description:
    "Open-source, self-hosted web UI for PowerDNS Authoritative: RBAC, OIDC, SAML and LDAP sign-in, passkeys, diff-before-apply zone editing, DNSSEC, multi-backend clusters and an append-only audit log.",
  version: "1.7.0",
  released: "2026-10-02",
  license: "MIT",
  pdnsVersions: "4.6 to 5.0",
  image: "ghcr.io/powerdns-authadmin/powerdns-authadmin",
  demo: "https://demo.powerdns-authadmin.org",
  org: "https://github.com/PowerDNS-AuthAdmin",
  repo,
  releases: `${repo}/releases`,
  latestRelease: `${repo}/releases/latest`,
  changelog: `${repo}/blob/main/CHANGELOG.md`,
  issues: `${repo}/issues`,
  discussions: `${repo}/discussions`,
  security: `${repo}/security/policy`,
  advisories: `${repo}/security/advisories/new`,
  contributing: `${repo}/blob/main/CONTRIBUTING.md`,
  package: `${repo}/pkgs/container/powerdns-authadmin`,
  websiteRepo: "https://github.com/PowerDNS-AuthAdmin/website",
  // GA4 measurement ID, loaded by src/analytics.js (shared NGN event script). Empty disables analytics.
  ga4: "G-Y8C640LSFR",
  // IndexNow (Bing, Yandex, Seznam...). Public by design: served at /<key>.txt.
  indexNowKey: "652aab60d92521253f92abc06012277a",
  docs: {
    index: `${docs}/README.md`,
    quickstart: `${docs}/01-QUICKSTART.md`,
    install: `${docs}/02-INSTALLATION.md`,
    config: `${docs}/03-CONFIGURATION.md`,
    backends: `${docs}/04-BACKENDS.md`,
    oidc: `${docs}/05-OIDC.md`,
    provisioning: `${docs}/06-PROVISIONING.md`,
    rbac: `${docs}/07-RBAC.md`,
    hardening: `${docs}/08-HARDENING.md`,
    upgrading: `${docs}/09-UPGRADING.md`,
    troubleshooting: `${docs}/10-TROUBLESHOOTING.md`,
    passkeys: `${docs}/11-PASSKEYS.md`,
    ldap: `${docs}/12-LDAP.md`,
    saml: `${docs}/13-SAML.md`,
    features: `${docs}/FEATURES.md`,
  },
  nav: [
    { href: "/features/", label: "Features" },
    { href: "/#screens", label: "Screens" },
    { href: "/#quickstart", label: "Quickstart" },
    { href: "/powerdns-admin-alternative/", label: "Compare" },
    { href: "/faq/", label: "FAQ" },
  ],
};
