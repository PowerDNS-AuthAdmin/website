// Build-time syntax highlighting for the homepage snippets (quickstart tabs etc.).
// When the docs highlighter (src/lib/highlight.mjs, owned by the docs engine) is
// present it is used so code looks the same everywhere; otherwise a tiny built-in
// highlighter covers sh / bash / console, toml, yaml and json.
import { existsSync } from "node:fs";

export const esc = (s) =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

let shared = null;
const sharedPath = new URL("./lib/highlight.mjs", import.meta.url);
if (existsSync(sharedPath)) {
  try {
    const mod = await import(sharedPath.href);
    const fn = mod.highlight || mod.hl || mod.default;
    if (typeof fn === "function") shared = fn;
  } catch (e) {
    console.warn(`code: docs highlighter not usable (${e.message}); using the built-in one`);
  }
}

const CMDS =
  "sudo|apt|apt-get|docker|curl|git|cd|mkdir|cp|mv|rm|chmod|chown|echo|export|cat|systemctl|journalctl|bash|sh|wget|tar|openssl|usermod|getent|make|dnf|rpm|install|tee|npm|npx|node|claude|codex|psql|sqlite3";

function builtin(code, lang) {
  const l = (lang || "").toLowerCase();
  return code
    .split("\n")
    .map((line) => {
      let rest = esc(line);
      let comment = "";
      const hashAt = l === "json" ? -1 : rest.search(/(^|\s)#/);
      if (hashAt !== -1) {
        comment = `<span class="t-c">${rest.slice(hashAt)}</span>`;
        rest = rest.slice(0, hashAt);
      }
      if (l === "json") {
        rest = rest.replace(/(&quot;[^&]*?&quot;)(\s*:)/g, '<span class="t-k">$1</span>$2');
        rest = rest.replace(/(:\s*)(&quot;[^&]*?&quot;)/g, '$1<span class="t-s">$2</span>');
        rest = rest.replace(/(:\s*)(true|false|null|-?\d+(?:\.\d+)?)/g, '$1<span class="t-n">$2</span>');
      } else if (l === "toml" || l === "ini") {
        rest = rest.replace(/^(\s*)(\[\[?[^\]]+\]\]?)/, '$1<span class="t-k">$2</span>');
        rest = rest.replace(/^(\s*)([\w.-]+)(\s*=)/, '$1<span class="t-v">$2</span>$3');
        rest = rest.replace(/(=\s*)(&quot;[^&]*?&quot;)/, '$1<span class="t-s">$2</span>');
        rest = rest.replace(/(=\s*)(true|false|-?\d+(?:\.\d+)?)\b/, '$1<span class="t-n">$2</span>');
      } else if (l === "yaml" || l === "yml") {
        rest = rest.replace(/^(\s*(?:-\s+)?)([\w.-]+)(:)/, '$1<span class="t-k">$2</span>$3');
        rest = rest.replace(/(&quot;[^&]*?&quot;)/g, '<span class="t-s">$1</span>');
      } else {
        // shell / console
        rest = rest.replace(/^(\s*)(\$\s)/, '$1<span class="t-p">$2</span>');
        rest = rest.replace(new RegExp(`(^|\\s|<\\/span>|\\|\\s?|&amp;&amp;\\s?|\\$\\()(${CMDS})(?=\\s|$)`, "g"), (m, a, b) => `${a}<span class="t-x">${b}</span>`);
        rest = rest.replace(/(\s)(--?[\w-]+)/g, '$1<span class="t-k">$2</span>');
        rest = rest.replace(/(&quot;[^&]*?&quot;|'[^']*')/g, '<span class="t-s">$1</span>');
        rest = rest.replace(/(\$\{?[A-Za-z_][A-Za-z0-9_]*\}?|\$\([^)]*\))/g, '<span class="t-v">$1</span>');
      }
      return rest + comment;
    })
    .join("\n");
}

// Highlight `code` (plain text) for `lang`; returns HTML for inside <code>.
export function hl(code, lang) {
  const src = plain(code);
  if (shared) {
    try {
      const out = shared(src, lang);
      if (typeof out === "string") return out;
    } catch {}
  }
  return builtin(src, lang);
}

// Plain text for the copy button (the escaped HTML above is never copied).
export const plain = (code) => String(code).replace(/^\n+/, "").replace(/\s+$/, "");
