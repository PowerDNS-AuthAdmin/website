// Status badges shown in the site footer, the same set as the app README.
//
// One list drives both ends: the footer renders <img src="/badges/<id>.svg">, and
// scripts/badges-nginx.mjs turns the same entries into deploy/nginx-badges.conf, the
// nginx locations that fetch each badge server-side and cache it. Visitors only ever
// talk to this site (the privacy rule in README.md), the badges stay live, and the
// proxy only knows these exact upstream URLs, so it can never fetch anything else.
// scripts/check.mjs fails the build if the footer and the nginx file disagree.
//
// `width` is a hint for the pre-load layout only (at 20 px high); the image's own
// size wins once it loads.

/** @type {{ id: string, alt: string, group: "project" | "image" | "stack" | "powerdns", src: string, href: string, width: number }[]} */
export const badges = [
  {id: "ci", alt: "CI", group: "project", src: "https://github.com/PowerDNS-AuthAdmin/powerdns-authadmin/actions/workflows/ci.yml/badge.svg?branch=main", href: "https://github.com/PowerDNS-AuthAdmin/powerdns-authadmin/actions/workflows/ci.yml?query=branch%3Amain", width: 90},
  {id: "release", alt: "Release", group: "project", src: "https://img.shields.io/github/v/release/PowerDNS-AuthAdmin/powerdns-authadmin", href: "https://github.com/PowerDNS-AuthAdmin/powerdns-authadmin/releases/latest", width: 102},
  {id: "openssf-scorecard", alt: "OpenSSF Scorecard", group: "project", src: "https://img.shields.io/ossf-scorecard/github.com/PowerDNS-AuthAdmin/powerdns-authadmin?label=openssf+scorecard&style=flat", href: "https://scorecard.dev/viewer/?uri=github.com/PowerDNS-AuthAdmin/powerdns-authadmin", width: 136},
  {id: "openssf-best-practices", alt: "OpenSSF Best Practices", group: "project", src: "https://www.bestpractices.dev/projects/12974/badge", href: "https://www.bestpractices.dev/projects/12974", width: 184},
  {id: "license", alt: "License: MIT", group: "project", src: "https://img.shields.io/github/license/PowerDNS-AuthAdmin/powerdns-authadmin", href: "https://github.com/PowerDNS-AuthAdmin/powerdns-authadmin/blob/main/LICENSE", width: 78},
  {id: "ghcr", alt: "Container: GHCR", group: "image", src: "https://img.shields.io/badge/ghcr.io-powerdns--authadmin-2496ED?logo=docker&logoColor=white", href: "https://github.com/PowerDNS-AuthAdmin/powerdns-authadmin/pkgs/container/powerdns-authadmin", width: 191},
  {id: "ghcr-version", alt: "GHCR version", group: "image", src: "https://ghcr-badge.ngn.au/powerdns-authadmin/powerdns-authadmin/latest_tag?ignore=latest,edge,%2Asha%2A,%5B0-9%5D,%5B0-9%5D.%5B0-9%5D,%5B0-9%5D.%5B0-9%5D%5B0-9%5D&label=ghcr.io&color=%232ea44f", href: "https://github.com/PowerDNS-AuthAdmin/powerdns-authadmin/pkgs/container/powerdns-authadmin", width: 101},
  {id: "ghcr-pulls", alt: "GHCR pulls", group: "image", src: "https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fghcr-badge.elias.eu.org%2Fapi%2Fpowerdns-authadmin%2Fpowerdns-authadmin&query=%24.downloadCount&label=ghcr%20pulls&logo=docker&logoColor=white&color=2496ED", href: "https://github.com/PowerDNS-AuthAdmin/powerdns-authadmin/pkgs/container/powerdns-authadmin", width: 111},
  {id: "ghcr-size", alt: "GHCR image size", group: "image", src: "https://ghcr-badge.ngn.au/powerdns-authadmin/powerdns-authadmin/size?tag=latest&label=image%20size&color=%232ea44f", href: "https://github.com/PowerDNS-AuthAdmin/powerdns-authadmin/pkgs/container/powerdns-authadmin", width: 142},
  {id: "nodejs", alt: "Node.js 24", group: "stack", src: "https://img.shields.io/badge/Node.js-24-339933?logo=node.js&logoColor=white", href: "https://github.com/PowerDNS-AuthAdmin/powerdns-authadmin/blob/main/.nvmrc", width: 91},
  {id: "nextjs", alt: "Next.js 16", group: "stack", src: "https://img.shields.io/badge/Next.js-16-000000?logo=next.js", href: "https://nextjs.org", width: 89},
  {id: "typescript", alt: "TypeScript strict", group: "stack", src: "https://img.shields.io/badge/TypeScript-strict-3178C6?logo=typescript&logoColor=white", href: "https://github.com/PowerDNS-AuthAdmin/powerdns-authadmin/blob/main/tsconfig.json", width: 123},
  {id: "pdns-4-6", alt: "PowerDNS 4.6", group: "powerdns", src: "https://github.com/PowerDNS-AuthAdmin/powerdns-authadmin/actions/workflows/pdns-compat-46.yml/badge.svg", href: "https://github.com/PowerDNS-AuthAdmin/powerdns-authadmin/actions/workflows/pdns-compat-46.yml", width: 153},
  {id: "pdns-4-7", alt: "PowerDNS 4.7", group: "powerdns", src: "https://github.com/PowerDNS-AuthAdmin/powerdns-authadmin/actions/workflows/pdns-compat-47.yml/badge.svg", href: "https://github.com/PowerDNS-AuthAdmin/powerdns-authadmin/actions/workflows/pdns-compat-47.yml", width: 153},
  {id: "pdns-4-8", alt: "PowerDNS 4.8", group: "powerdns", src: "https://github.com/PowerDNS-AuthAdmin/powerdns-authadmin/actions/workflows/pdns-compat-48.yml/badge.svg", href: "https://github.com/PowerDNS-AuthAdmin/powerdns-authadmin/actions/workflows/pdns-compat-48.yml", width: 153},
  {id: "pdns-4-9", alt: "PowerDNS 4.9", group: "powerdns", src: "https://github.com/PowerDNS-AuthAdmin/powerdns-authadmin/actions/workflows/pdns-compat-49.yml/badge.svg", href: "https://github.com/PowerDNS-AuthAdmin/powerdns-authadmin/actions/workflows/pdns-compat-49.yml", width: 153},
  {id: "pdns-5-0", alt: "PowerDNS 5.0", group: "powerdns", src: "https://github.com/PowerDNS-AuthAdmin/powerdns-authadmin/actions/workflows/pdns-compat-50.yml/badge.svg", href: "https://github.com/PowerDNS-AuthAdmin/powerdns-authadmin/actions/workflows/pdns-compat-50.yml", width: 155},
];

/** The site path each badge is served from (before the base path). */
export const badgePath = (id) => `/badges/${id}.svg`;
