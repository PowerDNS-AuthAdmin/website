#!/usr/bin/env node
// Generates every derived image from the sources in media/ into src/static/.
// Run after changing a screenshot, the icon, or an OG card. Outputs are committed,
// so `npm run build` never needs ImageMagick, cwebp or Chrome.
//
// Needs: ImageMagick 7 (`magick`), `cwebp`, and Google Chrome / Chromium.
//   node scripts/build-media.mjs            # everything
//   node scripts/build-media.mjs shots      # screenshots only
//   node scripts/build-media.mjs icons og   # icons + social cards

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, rmSync, writeFileSync, readFileSync, statSync } from "node:fs";
import { join, dirname, basename } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { tmpdir } from "node:os";
import { site } from "../src/site.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const media = join(root, "media");
const out = join(root, "src", "static");
const tmp = join(tmpdir(), "pda-site-media");
mkdirSync(tmp, { recursive: true });

const run = (cmd, args) => execFileSync(cmd, args, { stdio: ["ignore", "ignore", "inherit"] });

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
    `--window-size=${width},${height}`,
    `--screenshot=${file}`,
  ];
  if (transparent) args.push("--default-background-color=00000000");
  args.push(pathToFileURL(page).href);
  execFileSync(CHROME, args, { stdio: "ignore" });
}

/* ---------- Screenshots: lossless WebP at native size, lossy at smaller sizes ---------- */
// Desktop 1440x900 → 1440, 960, 640. Mobile 830x1848 → 830, 415.
const SHOT_WIDTHS = { desktop: [1440, 960, 640], mobile: [830, 415] };

function shots() {
  const dest = join(out, "assets", "img", "shots");
  rmSync(dest, { recursive: true, force: true });
  const manifest = {};
  for (const theme of ["dark", "light"]) {
    mkdirSync(join(dest, theme), { recursive: true });
    for (const file of readdirSync(join(media, "screenshots", theme)).filter((f) => f.endsWith(".png"))) {
      const name = file.replace(/\.png$/, "");
      const src = join(media, "screenshots", theme, file);
      const kind = name.endsWith("-mobile") ? "mobile" : "desktop";
      const [w, h] = execFileSync("magick", ["identify", "-format", "%w %h", src]).toString().split(" ").map(Number);
      for (const width of SHOT_WIDTHS[kind].filter((x) => x <= w)) {
        const png = join(tmp, `${theme}-${name}-${width}.png`);
        run("magick", [src, "-strip", "-resize", `${width}x`, png]);
        const webp = join(dest, theme, `${name}-${width}.webp`);
        const q = width === w ? ["-lossless", "-z", "9"] : ["-q", "86", "-m", "6", "-sharp_yuv"];
        run("cwebp", ["-quiet", "-metadata", "none", ...q, png, "-o", webp]);
      }
      manifest[name] = { width: w, height: h, widths: SHOT_WIDTHS[kind].filter((x) => x <= w) };
    }
  }
  writeFileSync(join(root, "src", "shots.json"), JSON.stringify(manifest, null, 2) + "\n");
  console.log(`shots: ${Object.keys(manifest).length} screenshots × 2 themes`);
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

/* ---------- Social cards (1200x630) per page ---------- */
async function og() {
  const { pages } = await import("../src/pages/index.mjs");
  const font = (f) => pathToFileURL(join(out, "assets", "fonts", f)).href;
  const shot = (n) => pathToFileURL(join(out, "assets", "img", "shots", "dark", `${n}-960.webp`)).href;
  const dest = join(out, "assets", "og");
  mkdirSync(dest, { recursive: true });
  const wordmark = pathToFileURL(join(media, "brand", "logo-wordmark-dark.png")).href;
  for (const p of pages.filter((p) => p.og)) {
    const html = `<!doctype html><html><head><meta charset="utf-8"><style>
      @font-face{font-family:Inter;src:url(${font("inter-latin.woff2")}) format("woff2");font-weight:100 900}
      @font-face{font-family:JBM;src:url(${font("jetbrains-mono-latin.woff2")}) format("woff2");font-weight:100 800}
      *{box-sizing:border-box}html,body{margin:0;width:1200px;height:630px;overflow:hidden}
      body{font-family:Inter,sans-serif;color:#e8ecf3;background:#0a0c11;position:relative}
      .glow{position:absolute;inset:0;background:
        radial-gradient(60% 70% at 85% 10%,rgba(79,142,247,.28),transparent 70%),
        radial-gradient(50% 60% at 0% 100%,rgba(56,184,79,.16),transparent 70%)}
      .grid{position:absolute;inset:0;background-image:linear-gradient(rgba(255,255,255,.035) 1px,transparent 1px),
        linear-gradient(90deg,rgba(255,255,255,.035) 1px,transparent 1px);background-size:40px 40px;
        mask-image:linear-gradient(180deg,#000 30%,transparent)}
      .copy{position:absolute;left:72px;top:64px;width:600px}
      .brand{display:block;width:400px;height:auto}
      .eyebrow{margin-top:70px;font-family:JBM;font-size:20px;letter-spacing:.14em;text-transform:uppercase;color:#6fa8ff}
      h1{margin:16px 0 0;font-size:${p.og.size || 62}px;line-height:1.04;letter-spacing:-.035em;font-weight:800}
      h1 em{font-style:normal;background:linear-gradient(90deg,#4f8ef7,#38b84f);-webkit-background-clip:text;color:transparent}
      p{margin:22px 0 0;font-size:24px;line-height:1.4;color:#9aa4b4}
      .foot{position:absolute;left:72px;bottom:56px;font-family:JBM;font-size:20px;color:#6b7585;display:flex;gap:18px}
      .foot b{color:#c7d0de;font-weight:500}
      .shot{position:absolute;left:720px;top:110px;width:760px;border-radius:18px;overflow:hidden;
        border:1px solid #232a38;box-shadow:0 40px 80px -20px rgba(0,0,0,.8)}
      .shot img{display:block;width:100%}
    </style></head><body><div class="glow"></div><div class="grid"></div>
      <div class="copy">
        <img class="brand" src="${wordmark}" alt="">
        <div class="eyebrow">${p.og.eyebrow}</div>
        <h1>${p.og.title}</h1>
        <p>${p.og.sub}</p>
      </div>
      <div class="foot"><b>${site.domain}</b><span>MIT · self-hosted · Docker</span></div>
      <div class="shot"><img src="${shot(p.og.shot || "dashboard")}"></div>
    </body></html>`;
    const png = join(tmp, `og-${p.slug}.png`);
    chromeShot(html, png, 1200, 630);
    const jpg = join(dest, `${p.slug}.jpg`);
    run("magick", [png, "-crop", "1200x630+0+0", "+repage", "-strip", "-sampling-factor", "4:2:0", "-quality", "86", "-interlace", "Plane", jpg]);
    console.log(`og: ${p.slug}.jpg ${Math.round(statSync(jpg).size / 1024)} KB`);
  }
}

const want = new Set(process.argv.slice(2));
const all = want.size === 0;
if (all || want.has("shots")) shots();
if (all || want.has("brand")) brand();
if (all || want.has("icons")) icons();
if (all || want.has("og")) await og();
