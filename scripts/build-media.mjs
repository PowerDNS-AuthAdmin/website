#!/usr/bin/env node
// Generates every derived image from the sources in media/ into src/static/.
// Run after changing a screenshot, the icon, or a page's og block. Outputs are
// committed, so `npm run build` never needs ImageMagick, cwebp, oxipng or Chrome.
//
// Needs: ImageMagick 7 (`magick`), `cwebp`, `oxipng` and Google Chrome / Chromium.
//   node scripts/build-media.mjs            # everything
//   node scripts/build-media.mjs shots      # screenshots → WebP + src/shots.json
//   node scripts/build-media.mjs icons og   # favicons/PWA icons + 1200×630 social cards
//   node scripts/build-media.mjs brand      # wordmark WebP/PNG for the header + README
//
// Screenshots: media/screenshots/{dark,light}/<name>{-mobile}.png, copied from the app
// repository's screenshots/ (captions in media/screenshots/SHOTS.md). Every page listed in
// EXPECTED is rendered in both themes; a missing capture gets a clearly-labelled placeholder
// so the site (and the docs that embed it) still build, and shots.json marks it with
// "placeholder": true.
//
// Social cards: one per page with an `og` block (core pages and, when src/docs/index.mjs
// exists, every docs page and ADR), plus a generic docs card and an ADR-index card when the
// docs module does not emit them. The file name is ogKey(page) from src/layout.mjs.

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, rmSync, writeFileSync, readFileSync, statSync } from "node:fs";
import { join, dirname, basename } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { tmpdir } from "node:os";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const media = join(root, "media");
const out = join(root, "src", "static");
const tmp = join(tmpdir(), "pda-site-media");
mkdirSync(tmp, { recursive: true });

const run = (cmd, args) => execFileSync(cmd, args, { stdio: ["ignore", "ignore", "inherit"] });
const fileUrl = (...p) => pathToFileURL(join(...p)).href;

const CHROME = [
  process.env.CHROME,
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
].find((p) => p && existsSync(p));

function chromeShot(html, file, width, height, transparent = false) {
  if (!CHROME) throw new Error("Chrome not found; set CHROME=/path/to/chrome");
  const page = join(tmp, `render-${basename(file)}.html`);
  writeFileSync(page, html);
  const args = [
    "--headless=new",
    "--disable-gpu",
    "--hide-scrollbars",
    "--force-device-scale-factor=1",
    "--allow-file-access-from-files",
    `--window-size=${width},${height}`,
    // Lets lazy font and image decodes settle before the capture without a wall-clock sleep.
    "--virtual-time-budget=3000",
    `--screenshot=${file}`,
  ];
  if (transparent) args.push("--default-background-color=00000000");
  args.push(pathToFileURL(page).href);
  execFileSync(CHROME, args, { stdio: "ignore" });
}

// The full fonts in media/fonts (the site's copies are subset to the glyphs its pages use),
// inlined as data: URLs: headless Chrome treats each file:// URL as its own origin and
// refuses cross-directory font loads.
const font = (f) => `data:font/woff2;base64,${readFileSync(join(media, "fonts", f)).toString("base64")}`;
const FONTS = `@font-face{font-family:Inter;src:url(${font("inter-latin.woff2")}) format("woff2");font-weight:400 800}
@font-face{font-family:JBM;src:url(${font("jetbrains-mono-latin.woff2")}) format("woff2");font-weight:400 700}`;
const wordmark = (theme) => fileUrl(media, "brand", `logo-wordmark-${theme}.png`);

/* ---------- Screenshots: lossless WebP at native size, lossy at smaller sizes ---------- */
// Every page the app repository captures (screenshots/README.md). The docs embed the
// -mobile variants too, so each name is expected in both layouts.
const EXPECTED = [
  "add-record",
  "audit-log",
  "autoprimaries",
  "backend-health",
  "change-log",
  "dashboard",
  "notifications",
  "oidc-providers",
  "pdns-requests",
  "powerdns-servers",
  "profile",
  "reverse-dns",
  "roles",
  "settings",
  "teams",
  "tsig-keys",
  "users",
  "zone-change-history",
  "zone-detail",
  "zone-edit",
  "zone-edit-diff",
  "zone-monitoring",
  "zone-templates",
  "zones-list",
];
// Desktop 1440x900 → 1440, 960, 720, 640 (720 covers a 94vw hero on a 1.75× or 2× phone).
// Mobile 830x1848 (iPhone bezel) → 830, 415.
const SHOT_WIDTHS = { desktop: [1440, 960, 720, 640], mobile: [830, 415] };
const SHOT_SIZE = { desktop: [1440, 900], mobile: [830, 1848] };
const kindOf = (name) => (name.endsWith("-mobile") ? "mobile" : "desktop");

function placeholder(theme, name, file) {
  const kind = kindOf(name);
  const [w, h] = SHOT_SIZE[kind];
  const dark = theme === "dark";
  const label = name.replace(/-mobile$/, "").replace(/-/g, " ");
  const html = `<!doctype html><html><head><meta charset="utf-8"><style>${FONTS}
    *{box-sizing:border-box}html,body{margin:0;width:${w}px;height:${h}px;overflow:hidden;font-family:Inter,sans-serif}
    body{background:${dark ? "radial-gradient(80% 60% at 30% 0%,#17203a,#0a0c11 70%)" : "linear-gradient(#f6f8fc,#e9edf6)"};color:${dark ? "#cfd6e8" : "#2a3150"};display:grid;place-items:center}
    .c{text-align:center;padding:0 40px}.c img{width:${kind === "mobile" ? 420 : 460}px;height:auto}
    .t{margin-top:40px;font-size:${kind === "mobile" ? 40 : 46}px;font-weight:800;letter-spacing:-.03em;text-transform:capitalize}
    .s{margin-top:14px;font-family:JBM;font-size:20px;opacity:.7}
    .side{position:absolute;left:0;top:0;bottom:0;width:240px;background:${dark ? "rgba(255,255,255,.03)" : "rgba(0,0,0,.03)"};border-right:1px solid ${dark ? "#232a38" : "#d9deea"}}
  </style></head><body>${kind === "desktop" ? '<div class="side"></div>' : ""}<div class="c"><img src="${wordmark(theme)}" alt=""><div class="t">${label}</div><div class="s">placeholder screenshot · ${kind} · ${theme}</div></div></body></html>`;
  chromeShot(html, file, w, h);
}

function shots() {
  const dest = join(out, "assets", "img", "shots");
  rmSync(dest, { recursive: true, force: true });
  const manifest = {};
  let placeholders = 0;
  for (const theme of ["dark", "light"]) {
    mkdirSync(join(dest, theme), { recursive: true });
    const dir = join(media, "screenshots", theme);
    const found = existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith(".png")).map((f) => f.replace(/\.png$/, "")) : [];
    const names = [...new Set([...EXPECTED.flatMap((n) => [n, `${n}-mobile`]), ...found])].sort();
    for (const name of names) {
      let src = join(dir, `${name}.png`);
      let isPlaceholder = false;
      if (!existsSync(src)) {
        src = join(tmp, `placeholder-${theme}-${name}.png`);
        placeholder(theme, name, src);
        isPlaceholder = true;
        placeholders++;
      }
      const [w, h] = execFileSync("magick", ["identify", "-format", "%w %h", src]).toString().split(" ").map(Number);
      const widths = SHOT_WIDTHS[kindOf(name)].filter((x) => x <= w);
      for (const width of widths) {
        const png = join(tmp, `${theme}-${name}-${width}.png`);
        run("magick", [src, "-strip", "-filter", "Lanczos", "-resize", `${width}x`, png]);
        const webp = join(dest, theme, `${name}-${width}.webp`);
        const q = width === w ? ["-lossless", "-z", "9"] : ["-q", "86", "-m", "6", "-sharp_yuv"];
        run("cwebp", ["-quiet", "-metadata", "none", ...q, png, "-o", webp]);
      }
      const prev = manifest[name];
      // Both themes share one width/height attribute pair per <img>; keep the larger
      // height if the captures differ slightly.
      manifest[name] = {
        width: w,
        height: prev ? Math.max(prev.height, h) : h,
        widths,
        ...(isPlaceholder || (prev && prev.placeholder) ? { placeholder: true } : {}),
      };
    }
  }
  writeFileSync(join(root, "src", "shots.json"), JSON.stringify(manifest, null, 2) + "\n");
  console.log(`shots: ${Object.keys(manifest).length} screenshots × 2 themes${placeholders ? ` (${placeholders} placeholders)` : ""}`);
}

/* ---------- Wordmark: the project's own dark/light PNGs, resized only ---------- */
function brand() {
  const dest = join(out, "assets", "img", "brand");
  rmSync(dest, { recursive: true, force: true });
  mkdirSync(dest, { recursive: true });
  for (const theme of ["dark", "light"]) {
    const src = join(media, "brand", `logo-wordmark-${theme}.png`);
    for (const w of [240, 360, 480, 720]) {
      const png = join(tmp, `logo-${theme}-${w}.png`);
      run("magick", [src, "-strip", "-filter", "Lanczos", "-resize", `${w}x`, png]);
      run("cwebp", ["-quiet", "-metadata", "none", "-q", "92", "-alpha_q", "100", "-m", "6", png, "-o", join(dest, `logo-${theme}-${w}.webp`)]);
      if (w === 360) {
        run("magick", [png, join(dest, `logo-${theme}-360.png`)]);
        run("oxipng", ["-q", "-o", "4", "--strip", "all", join(dest, `logo-${theme}-360.png`)]);
      }
    }
  }
  console.log("brand: wordmark dark + light at 240/360/480/720");
}

/* ---------- Icons: SVG favicon, ICO, apple-touch, PWA + maskable ---------- */
function icons() {
  const svg = readFileSync(join(media, "brand", "icon.svg"), "utf8");
  const inner = svg.replace(/^[\s\S]*?<svg[^>]*>/, "").replace(/<\/svg>\s*$/, "").replace(/<!--[\s\S]*?-->/g, "");
  // Favicon SVG: braces only, transparent, colour works on light and dark tabs.
  writeFileSync(
    join(out, "favicon.svg"),
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">${inner.trim()}</svg>\n`,
  );

  const tile = (size, pad, radius) => `<!doctype html><html><head><style>
    html,body{margin:0;background:transparent}
    .t{width:${size}px;height:${size}px;display:grid;place-items:center;border-radius:${radius}px;
       background:radial-gradient(120% 120% at 30% 0%,#17203a 0%,#0a0c11 60%)}
    svg{width:${size - pad * 2}px;height:${size - pad * 2}px}
  </style></head><body><div class="t"><svg viewBox="0 0 32 32">${inner}</svg></div></body></html>`;

  const icons = join(out, "assets", "icons");
  mkdirSync(icons, { recursive: true });
  const jobs = [
    ["apple-touch-icon.png", 180, 18, 0, out],          // iOS rounds the corners itself; must be opaque
    ["icon-192.png", 192, 20, 42, icons],
    ["icon-512.png", 512, 56, 112, icons],
    ["icon-maskable-512.png", 512, 120, 0, icons],      // content inside the 80% safe zone
    ["ico-48.png", 48, 4, 10, tmp],
    ["ico-32.png", 32, 2, 7, tmp],
    ["ico-16.png", 16, 0, 3, tmp],
  ];
  for (const [name, size, pad, radius, dir] of jobs) {
    const raw = join(tmp, `raw-${name}`);
    chromeShot(tile(size, pad, radius), raw, size, size, radius > 0);
    run("magick", [raw, "-crop", `${size}x${size}+0+0`, "+repage", "-strip", join(dir, name)]);
  }
  run("magick", [join(tmp, "ico-16.png"), join(tmp, "ico-32.png"), join(tmp, "ico-48.png"), join(out, "favicon.ico")]);
  for (const f of ["apple-touch-icon.png", "assets/icons/icon-192.png", "assets/icons/icon-512.png", "assets/icons/icon-maskable-512.png"]) {
    run("oxipng", ["-q", "-o", "4", "--strip", "all", join(out, f)]);
  }
  console.log("icons: favicon.svg, favicon.ico, apple-touch-icon, PWA + maskable");
}

/* ---------- Social cards (1200x630): one per page with an `og` block + generic docs ---------- */
// Mirrors layout.mjs for a checkout where ogKey is not exported yet.
const fallbackOgKey = (page) => {
  if (page.ogImage) return page.ogImage;
  if (page.layout === "docs") return page.og ? page.slug.replace(/^(docs-)?/, "docs-") : "docs";
  return page.slug;
};

// /support/: an NGN contact card in place of the screenshot.
const supportPanel = (site, ngnLogo) => {
  const sp = site.support;
  return `<div class="panel">${ngnLogo(150, 53)}<div class="live"><i></i>24 hour support</div>
    <ul><li>${sp.phoneIntl}<span>international</span></li><li>${sp.phone}<span>Australia</span></li><li>${sp.url.replace(/^https:\/\/|\/$/g, "")}</li></ul></div>`;
};

// Title size steps down with length; ADR titles ("ADR 0014 - Per-zone authority + observed
// daemon capabilities") need the smallest step and a 3-line clamp.
const titleSize = (o) => {
  if (o.size) return o.size;
  const len = o.title.replace(/<[^>]+>/g, "").length;
  return len > 80 ? 38 : len > 64 ? 42 : len > 52 ? 48 : len > 40 ? 54 : 62;
};
// The footer sits left of the screenshot (640px), so a long docs path steps down too.
const footSize = (text) => (text.length > 56 ? 15 : text.length > 40 ? 17 : 20);

async function og() {
  // Imported lazily: src/site.mjs needs content/docs/_source.json, which `shots` does not.
  const { site } = await import("../src/site.mjs");
  const { ngnLogo } = await import("../src/icons.mjs");
  const pagesModule = await import("../src/pages/index.mjs");
  const corePages = pagesModule.pages || [...(pagesModule.corePages || []), ...(pagesModule.searchPage ? [pagesModule.searchPage] : [])];
  const ogKey = (await import("../src/layout.mjs")).ogKey || fallbackOgKey;
  let docPages = [];
  const docsModule = join(root, "src", "docs", "index.mjs");
  if (existsSync(docsModule)) {
    const m = await import(pathToFileURL(docsModule).href);
    docPages = (m.docPages || m.default || []).filter((p) => p.og);
  }
  const shotFile = (n) => {
    const f = join(out, "assets", "img", "shots", "dark", `${n}-960.webp`);
    return existsSync(f) ? pathToFileURL(f).href : null;
  };
  const dest = join(out, "assets", "og");
  mkdirSync(dest, { recursive: true });

  const docPath = (p) => (p.path || "").replace(/\/$/, "");
  const cards = [
    ...corePages.filter((p) => p.og).map((p) => ({ key: ogKey(p), og: p.og })),
    ...docPages.map((p) => ({ key: ogKey(p), og: p.og, path: docPath(p) })),
  ];
  const have = new Set(cards.map((c) => c.key));
  if (!have.has("docs")) {
    cards.push({
      key: "docs",
      path: "/docs",
      og: {
        eyebrow: "Documentation",
        title: 'Install, configure and run <em><span class="nb">PowerDNS-AuthAdmin</span></em>',
        sub: "Quickstart, install, configure, backends, SSO and passkeys, provisioning, RBAC, hardening, upgrading, the MCP server and the ADRs.",
        shot: "dashboard",
      },
    });
  }
  if (!have.has("docs-adr")) {
    cards.push({
      key: "docs-adr",
      path: "/docs/adr",
      og: {
        eyebrow: "Docs · Architecture",
        title: "Architecture <em>Decision Records</em>",
        sub: "Why PowerDNS-AuthAdmin is built the way it is: authentication, RBAC, sessions, the PDNS client, migrations, backend capabilities and more.",
        shot: "powerdns-servers",
      },
    });
  }

  let total = 0;
  for (const { key, og: o, path } of cards) {
    const panel = o.panel === "support";
    const shot = panel ? null : shotFile(o.shot || "dashboard");
    if (!panel && !shot) console.warn(`og: ${key}: screenshot "${o.shot || "dashboard"}" not built, rendering text only`);
    const foot = path
      ? `<b>${site.domain}<i>${path}</i></b>`
      : `<b>${site.domain}</b><span>MIT · self-hosted · Docker</span>`;
    const footPx = footSize(path ? site.domain + path : "");
    const html = `<!doctype html><html><head><meta charset="utf-8"><style>${FONTS}
      *{box-sizing:border-box}html,body{margin:0;width:1200px;height:630px;overflow:hidden}
      body{font-family:Inter,sans-serif;color:#e8ecf3;background:#0a0c11;position:relative}
      .glow{position:absolute;inset:0;background:
        radial-gradient(60% 70% at 85% 10%,rgba(79,142,247,.28),transparent 70%),
        radial-gradient(50% 60% at 0% 100%,rgba(56,184,79,.16),transparent 70%)}
      .grid{position:absolute;inset:0;background-image:linear-gradient(rgba(255,255,255,.035) 1px,transparent 1px),
        linear-gradient(90deg,rgba(255,255,255,.035) 1px,transparent 1px);background-size:40px 40px;
        -webkit-mask-image:linear-gradient(180deg,#000 30%,transparent)}
      .copy{position:absolute;left:72px;top:64px;width:${shot || panel ? 600 : 1000}px}
      .brand{display:block;width:400px;height:auto}
      .eyebrow{margin-top:${titleSize(o) < 54 ? 54 : 70}px;font-family:JBM;font-size:20px;letter-spacing:.14em;text-transform:uppercase;color:#6fa8ff;
        white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      h1{margin:16px 0 0;font-size:${titleSize(o)}px;line-height:1.06;letter-spacing:-.035em;font-weight:800;
        display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:3;overflow:hidden}
      h1 em{font-style:normal;background:linear-gradient(90deg,#4f8ef7,#38b84f);-webkit-background-clip:text;color:transparent}
      p{margin:22px 0 0;font-size:24px;line-height:1.4;color:#9aa4b4;display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:3;overflow:hidden}
      .foot{position:absolute;left:72px;bottom:56px;max-width:636px;font-family:JBM;font-size:${footPx}px;color:#6b7585;display:flex;gap:18px}
      .foot b{color:#c7d0de;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.foot b i{font-style:normal;color:#6fa8ff}
      .nb{white-space:nowrap}
      .shot{position:absolute;left:720px;top:110px;width:760px;border-radius:18px;overflow:hidden;
        border:1px solid #232a38;box-shadow:0 40px 80px -20px rgba(0,0,0,.8),0 0 0 6px rgba(79,142,247,.06)}
      .bar{height:30px;background:#0d1017;border-bottom:1px solid #232a38;display:flex;gap:8px;align-items:center;padding:0 12px}
      .bar span{width:10px;height:10px;border-radius:50%;background:#232a38}
      .shot img{display:block;width:100%}
      .panel{position:absolute;left:744px;top:150px;width:384px;padding:34px;border-radius:22px;background:#11141c;
        border:1px solid #232a38;box-shadow:0 40px 80px -20px rgba(0,0,0,.8);color:#eceff5}
      .panel svg{display:block;width:150px;height:auto}
      .live{display:inline-flex;align-items:center;gap:12px;margin:26px 0 0;padding:8px 16px 8px 14px;border-radius:999px;font-size:19px;
        color:#c7d0de;border:1px solid rgba(56,184,79,.4);background:rgba(56,184,79,.1)}
      .live i{width:11px;height:11px;border-radius:50%;background:#38b84f;box-shadow:0 0 0 5px rgba(56,184,79,.22)}
      .panel ul{margin:26px 0 0;padding:22px 0 0;border-top:1px solid #232a38;list-style:none;font-family:JBM;font-size:21px;line-height:1.9}
      .panel li span{color:#6b7585;font-family:Inter;font-size:17px;margin-left:10px}
    </style></head><body><div class="glow"></div><div class="grid"></div>
      <div class="copy">
        <img class="brand" src="${wordmark("dark")}" alt="">
        <div class="eyebrow">${o.eyebrow}</div>
        <h1>${o.title}</h1>
        <p>${o.sub}</p>
      </div>
      <div class="foot">${foot}</div>
      ${panel ? supportPanel(site, ngnLogo) : ""}
      ${shot ? `<div class="shot"><div class="bar"><span></span><span></span><span></span></div><img src="${shot}"></div>` : ""}
    </body></html>`;
    const png = join(tmp, `og-${key}.png`);
    chromeShot(html, png, 1200, 630);
    const jpg = join(dest, `${key}.jpg`);
    run("magick", [png, "-crop", "1200x630+0+0", "+repage", "-strip", "-sampling-factor", "4:2:0", "-quality", "86", "-interlace", "Plane", jpg]);
    const kb = statSync(jpg).size;
    total += kb;
    console.log(`og: ${key}.jpg ${Math.round(kb / 1024)} KB`);
  }
  // Cards for pages that no longer exist would otherwise linger in the committed output.
  const keys = new Set(cards.map((c) => `${c.key}.jpg`));
  for (const f of readdirSync(dest).filter((f) => f.endsWith(".jpg") && !keys.has(f))) {
    rmSync(join(dest, f));
    console.log(`og: removed stale ${f}`);
  }
  console.log(`og: ${cards.length} cards, ${Math.round(total / 1024)} KB`);
}

const want = new Set(process.argv.slice(2));
const all = want.size === 0;
if (all || want.has("shots")) shots();
if (all || want.has("brand")) brand();
if (all || want.has("icons")) icons();
if (all || want.has("og")) await og();
