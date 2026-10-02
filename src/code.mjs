// Tiny build-time highlighter for the YAML and shell snippets on the site.
import { esc } from "./layout.mjs";

export function hl(code, lang) {
  return code
    .replace(/^\n/, "")
    .replace(/\s+$/, "")
    .split("\n")
    .map((line) => {
      let rest = esc(line);
      let comment = "";
      const hash = lang === "sh" ? rest.search(/(^|\s)#/) : rest.search(/(^|\s)#(?![^"]*"$)/);
      if (hash !== -1) {
        comment = `<span class="t-c">${rest.slice(hash)}</span>`;
        rest = rest.slice(0, hash);
      }
      rest = rest.replace(/\$\{?[A-Z_]+\}?|\$\([^)]*\)/g, (m) => `<span class="t-v">${m}</span>`);
      if (lang === "yaml") {
        rest = rest.replace(/^(\s*(?:-\s+)?)([\w.-]+)(:)/, '$1<span class="t-k">$2</span>$3');
        rest = rest.replace(/(:\s+)(&quot;[^&]*&quot;|true|false|\d+)(\s*)$/, '$1<span class="t-s">$2</span>$3');
      } else {
        rest = rest.replace(/^(\s*)(docker|openssl|echo|chmod|mkdir|cd|curl)\b/, '$1<span class="t-x">$2</span>');
        rest = rest.replace(/(&quot;[^&]*?&quot;)/g, '<span class="t-s">$1</span>');
      }
      return rest + comment;
    })
    .join("\n");
}

// Plain text for the copy button (the escaped HTML above is never copied).
export const plain = (code) => code.replace(/^\n/, "").replace(/\s+$/, "");
