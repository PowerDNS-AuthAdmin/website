#!/usr/bin/env node
// Sync the PowerDNS-AuthAdmin docs (docs/**/*.md, content only) into content/docs/.
//
//   node scripts/sync-docs.mjs /path/to/powerdns-authadmin     copy from a local checkout
//   node scripts/sync-docs.mjs --ref v1.9.1                     download that tag from GitHub (gh, else curl)
//   node scripts/sync-docs.mjs /path/to/powerdns-authadmin --ref v1.9.1
//                                                               copy locally, but record that ref's
//                                                               commit and per-file dates from GitHub
// Options:
//   --repo owner/name   (default PowerDNS-AuthAdmin/powerdns-authadmin)
//   --no-dates          skip per-file commit date lookups
//
// Upstream file names are numbered and upper-case (docs/02-INSTALLATION.md); the site
// addresses every doc by a slug instead:
//   docs/NN-NAME.md        -> <name>            content/docs/<name>.md         /docs/<name>/
//   docs/FEATURES.md       -> features
//   docs/dev-setup.md      -> dev-setup
//   docs/adr/NNNN-name.md  -> adr/NNNN-name     content/docs/adr/NNNN-name.md  /docs/adr/NNNN-name/
// docs/README.md, docs/adr/README.md and docs/adr/0000-template.md are skipped: the site
// generates its own /docs/ and /docs/adr/ index pages from the nav.
//
// Writes content/docs/**/*.md and content/docs/_source.json:
//   { repo, ref, commit, version, releaseDate, syncedAt,
//     files: { "<slug>": { upstream: "docs/02-INSTALLATION.md", modified, sha256 } } }
// Zero dependencies. Never commits anything.

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "content", "docs");

const args = process.argv.slice(2);
const opt = (name) => {
  const k = args.indexOf(name);
  if (k === -1) return null;
  const v = args[k + 1];
  args.splice(k, 2);
  return v;
};
const flag = (name) => {
  const k = args.indexOf(name);
  if (k === -1) return false;
  args.splice(k, 1);
  return true;
};
const ref = opt("--ref");
const repo = opt("--repo") || "PowerDNS-AuthAdmin/powerdns-authadmin";
const noDates = flag("--no-dates");
const localPath = args[0] ? resolve(args[0]) : null;

if (!localPath && !ref) {
  console.error("usage: node scripts/sync-docs.mjs <powerdns-authadmin-checkout> [--ref vX.Y.Z]  |  --ref vX.Y.Z");
  process.exit(2);
}
if (!/^[\w.-]+\/[\w.-]+$/.test(repo)) throw new Error(`bad --repo ${repo}`);
if (ref && !/^[\w./-]+$/.test(ref)) throw new Error(`bad --ref ${ref}`);

const run = (cmd, argv, opts = {}) => execFileSync(cmd, argv, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], ...opts }).trim();
const tryRun = (cmd, argv, opts) => { try { return run(cmd, argv, opts); } catch { return null; } };
const hasGh = tryRun("gh", ["--version"]) !== null;
const gh = (path, jq) => (hasGh ? tryRun("gh", ["api", path, ...(jq ? ["--jq", jq] : [])]) : null);

let src = localPath;
let tmp = null;
if (!src) {
  // Download the tag tarball into its own empty directory.
  tmp = mkdtempSync(join(tmpdir(), "powerdns-authadmin-docs-"));
  const tgz = join(tmp, "src.tar.gz");
  const extract = join(tmp, "x");
  mkdirSync(extract);
  let ok = false;
  if (hasGh) {
    try {
      const buf = execFileSync("gh", ["api", `repos/${repo}/tarball/${ref}`], { stdio: ["ignore", "pipe", "pipe"], maxBuffer: 512 * 1024 * 1024 });
      writeFileSync(tgz, buf);
      ok = true;
    } catch {}
  }
  if (!ok) ok = tryRun("curl", ["-fsSL", "-o", tgz, `https://codeload.github.com/${repo}/tar.gz/${ref}`]) !== null;
  if (!ok) throw new Error(`could not download ${repo}@${ref} (tried gh and curl)`);
  run("tar", ["-xzf", tgz, "-C", extract]);
  const top = readdirSync(extract).filter((d) => !d.startsWith("."));
  if (top.length !== 1) throw new Error("unexpected tarball layout");
  src = join(extract, top[0]);
}

const docsDir = join(src, "docs");
if (!existsSync(docsDir)) throw new Error(`no docs/ directory in ${src}`);

/** Upstream path (relative to the repo root) -> site slug, or null to skip. */
function slugFor(file) {
  let m = /^docs\/(\d{2})-([A-Z0-9-]+)\.md$/.exec(file);
  if (m) return m[2].toLowerCase();
  if (file === "docs/FEATURES.md") return "features";
  if (file === "docs/dev-setup.md") return "dev-setup";
  m = /^docs\/adr\/(\d{4}-[a-z0-9][a-z0-9.-]*)\.md$/.exec(file);
  if (m && m[1] !== "0000-template") return `adr/${m[1]}`;
  return null;
}

const entries = [];
for (const f of readdirSync(docsDir).sort()) {
  const p = join(docsDir, f);
  if (statSync(p).isDirectory()) {
    if (f !== "adr") continue;
    for (const g of readdirSync(p).sort()) {
      const slug = slugFor(`docs/adr/${g}`);
      if (slug) entries.push({ slug, upstream: `docs/adr/${g}`, path: join(p, g) });
    }
    continue;
  }
  const slug = slugFor(`docs/${f}`);
  if (slug) entries.push({ slug, upstream: `docs/${f}`, path: p });
}
if (!entries.length) throw new Error("no docs found");
const dupes = entries.map((e) => e.slug).filter((s, i, a) => a.indexOf(s) !== i);
if (dupes.length) throw new Error(`slug collision: ${dupes.join(", ")}`);

// version from package.json
const pkgFile = join(src, "package.json");
const pkgVersion = existsSync(pkgFile) ? JSON.parse(readFileSync(pkgFile, "utf8")).version : null;
const version = pkgVersion || (ref || "").replace(/^v/, "") || null;
const refName = ref || (version ? `v${version}` : "main");

// commit
const isGit = existsSync(join(src, ".git")) && tryRun("git", ["-C", src, "rev-parse", "HEAD"]);
let commit = (ref && gh(`repos/${repo}/commits/${encodeURIComponent(refName)}`, ".sha")) || isGit || null;
if (!commit && tmp) {
  const m = /-([0-9a-f]{7,40})$/.exec(src);
  if (m) commit = m[1];
}
const releaseDate =
  (ref && gh(`repos/${repo}/releases/tags/${encodeURIComponent(refName)}`, ".published_at")) ||
  (commit && gh(`repos/${repo}/commits/${commit}`, ".commit.committer.date")) ||
  null;

// Sample data in the upstream docs that isn't RFC 2606 / reserved example data would be
// swapped here. The current docs only use example.com / example.org style names, so the
// list is empty; keep the hook so a future upstream slip is a one-line fix.
const SANITIZE = [];
const sanitize = (s) => SANITIZE.reduce((out, [re, to]) => out.replace(re, to), s);

// write files (and drop stale ones from a previous sync)
mkdirSync(join(OUT, "adr"), { recursive: true });
const wanted = new Set(entries.map((e) => `${e.slug}.md`));
for (const dir of ["", "adr"]) {
  for (const f of readdirSync(join(OUT, dir))) {
    const relName = dir ? `${dir}/${f}` : f;
    if (f.endsWith(".md") && !wanted.has(relName)) rmSync(join(OUT, relName));
  }
}
const meta = {};
for (const e of entries) {
  const body = sanitize(readFileSync(e.path, "utf8").replace(/\r\n?/g, "\n"));
  writeFileSync(join(OUT, `${e.slug}.md`), body);
  let modified = null;
  if (!noDates) {
    if (isGit) modified = tryRun("git", ["-C", src, "log", "-1", "--format=%cI", "--", e.upstream]) || null;
    if (!modified && (commit || ref)) {
      modified = gh(`repos/${repo}/commits?path=${encodeURIComponent(e.upstream)}&sha=${encodeURIComponent(commit || refName)}&per_page=1`, ".[0].commit.committer.date") || null;
    }
  }
  meta[e.slug] = { upstream: e.upstream, modified: modified || releaseDate, sha256: createHash("sha256").update(body).digest("hex").slice(0, 16) };
  process.stdout.write(`  ${e.slug.padEnd(36)} ${e.upstream.padEnd(44)} ${meta[e.slug].modified || "-"}\n`);
}

const source = { repo, ref: refName, commit, version, releaseDate, syncedAt: new Date().toISOString(), files: meta };
writeFileSync(join(OUT, "_source.json"), JSON.stringify(source, null, 2) + "\n");
if (tmp) rmSync(tmp, { recursive: true, force: true });
console.log(`synced ${entries.length} docs from ${repo}@${refName}${commit ? ` (${commit.slice(0, 7)})` : ""} -> content/docs/`);
