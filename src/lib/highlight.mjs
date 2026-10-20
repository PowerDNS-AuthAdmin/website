// Zero-dependency build-time syntax highlighter.
//
// highlight(code, lang) -> HTML-escaped code with <span class="t-*"> tokens:
//   t-k keyword/section/flag   t-s string        t-c comment
//   t-v variable/key           t-x command/call  t-n number/literal
//   t-p punctuation/operator   t-add / t-del (diff lines)
// Languages: bash sh shell zsh console, toml, json, yaml, ini, env/dotenv, nginx,
// apache, caddyfile, haproxy, hcl, http, dockerfile, js/javascript, ts/typescript,
// python, rust, lua, powershell, sql, ldif, zonefile (BIND zone files), diff, text.
// Unknown languages are escaped only.

const ESC = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
const esc = (s) => s.replace(/[&<>"']/g, (c) => ESC[c]);
const span = (cls, s) => (s ? `<span class="${cls}">${esc(s)}</span>` : "");

const ALIASES = {
  sh: "bash", shell: "bash", zsh: "bash", "shell-session": "console", shellsession: "console",
  javascript: "js", mjs: "js", node: "js", typescript: "ts", tsx: "ts", jsx: "js", jsonc: "json", json5: "json",
  yml: "yaml", conf: "ini", cfg: "ini", properties: "ini", systemd: "ini", dosini: "ini",
  caddy: "caddyfile", terraform: "hcl", tf: "hcl", py: "python", rs: "rust", ps1: "powershell", pwsh: "powershell",
  docker: "dockerfile", patch: "diff", plaintext: "text", txt: "text", "": "text",
  apacheconf: "apache", httpd: "apache", jinja: "text",
  dotenv: "env", envrc: "env", "shell-env": "env",
  zone: "zonefile", bind: "zonefile", dns: "zonefile", "dns-zone": "zonefile", rfc1035: "zonefile",
  compose: "yaml", "docker-compose": "yaml",
};

/** Human label for the code block header. */
export const LABELS = {
  bash: "bash", console: "console", toml: "toml", json: "json", yaml: "yaml", ini: "ini", nginx: "nginx",
  apache: "apache", caddyfile: "Caddyfile", haproxy: "haproxy", hcl: "hcl", http: "http", dockerfile: "Dockerfile",
  js: "javascript", ts: "typescript", python: "python", rust: "rust", lua: "lua", powershell: "powershell", sql: "sql",
  env: ".env", ldif: "ldif", zonefile: "zone file", diff: "diff", text: "text",
};

export function normalizeLang(lang) {
  const l = String(lang || "").toLowerCase().trim();
  return ALIASES[l] ?? l;
}

/** Guess a language for an unlabeled fence (conservative: falls back to "text"). */
export function detectLang(code) {
  const lines = code.split("\n").filter((l) => l.trim() && !/^\s*#/.test(l));
  const first = (lines[0] || "").trim();
  if (/^(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS) \/\S*( HTTP\/\d(\.\d)?)?$/.test(first)) return "http";
  if (/^(global|defaults|frontend|backend|listen)(\s|$)/.test(first) || lines.some((l) => /^\s*(http-(request|response)|acl|use_backend|stats socket|bind \*?:)\s/.test(l))) return "haproxy";
  if (/^\$ \S/.test(first)) return "console";
  if (lines.some((l) => /^\$(ORIGIN|TTL|INCLUDE|GENERATE)\b/.test(l.trim())) || lines.filter((l) => /\s(?:IN\s+)?(?:A|AAAA|NS|SOA|MX|CNAME|TXT|PTR|SRV|CAA)\s/.test(l)).length >= 2) return "zonefile";
  if (lines.length && lines.every((l) => /^(?:export\s+)?[A-Z_][A-Z0-9_]*=/.test(l.trim()))) return "env";
  if (/^[[{]/.test(first) && /[\]}]\s*$/.test(lines[lines.length - 1] || "")) return "json";
  if (/^(SELECT|INSERT|UPDATE|DELETE|CREATE|ALTER|DROP)\b/i.test(first)) return "sql";
  return "text";
}

// ---------------------------------------------------------------- generic lexer

function lex(code, rules) {
  let out = "";
  let plain = "";
  let i = 0;
  const n = code.length;
  next: while (i < n) {
    for (const [re, cls] of rules) {
      re.lastIndex = i;
      const m = re.exec(code);
      if (m && m[0].length) {
        if (plain) { out += esc(plain); plain = ""; }
        out += typeof cls === "function" ? cls(m) : cls ? span(cls, m[0]) : esc(m[0]);
        i += m[0].length;
        continue next;
      }
    }
    plain += code[i++];
  }
  return out + esc(plain);
}

const BOL = "(?<=(?:^|\\n)[ \\t]*)"; // beginning of line (after indentation)
const y = (src, flags = "") => new RegExp(src, "y" + flags);
const kw = (words, flags = "") => y(`\\b(?:${words.split(" ").join("|")})\\b`, flags);

const STR_D = y(`"(?:\\\\.|[^"\\\\\\n])*"`);
const STR_S = y(`'(?:\\\\.|[^'\\\\\\n])*'`);
const NUM = y(`-?\\b\\d[\\d_]*(?:\\.\\d+)?(?:[eE][+-]?\\d+)?\\b`);
const HASH_C = y(`(?<=^|\\s)#[^\\n]*`);
const WORD = [y(`[A-Za-z_][\\w./:-]*`), ""];

const RULES = {
  toml: [
    [y(`#[^\\n]*`), "t-c"],
    [y(`${BOL}\\[\\[?[^\\]\\n]+\\]\\]?`), "t-k"],
    [y(`(?<=(?:^|\\n|[{,])[ \\t]*)(?:"[^"\\n]*"|[A-Za-z0-9_.-]+)(?=[ \\t]*=)`), "t-v"],
    [y(`"""[\\s\\S]*?"""|'''[\\s\\S]*?'''`), "t-s"],
    [STR_D, "t-s"], [STR_S, "t-s"],
    [y(`\\d{4}-\\d{2}-\\d{2}(?:[T ][\\d:.]+(?:Z|[+-]\\d{2}:\\d{2})?)?`), "t-n"],
    [kw("true false inf nan"), "t-n"], [NUM, "t-n"],
    [y(`[=\\[\\]{},]`), "t-p"],
  ],
  json: [
    [y(`//[^\\n]*`), "t-c"],
    [y(`"(?:\\\\.|[^"\\\\\\n])*"(?=\\s*:)`), "t-v"],
    [STR_D, "t-s"],
    [kw("true false null"), "t-n"], [NUM, "t-n"],
    [y(`\\{\\{|\\}\\}|\\{%|%\\}`), "t-x"],
    [y(`[{}\\[\\],:]`), "t-p"],
  ],
  yaml: [
    [HASH_C, "t-c"],
    [y(`${BOL}(?:- )*(?:"[^"\\n]*"|'[^'\\n]*'|[^\\s:#'"\\-][^:\\n#]*?)(?=:(?:\\s|$))`), "t-v"],
    [y(`${BOL}-(?=\\s)`), "t-p"],
    [STR_D, "t-s"], [STR_S, "t-s"],
    [y(`[&*][\\w-]+`), "t-k"],
    [kw("true false yes no null on off"), "t-n"], [NUM, "t-n"],
    [y(`[:{}\\[\\],|>]`), "t-p"],
  ],
  ini: [
    [y(`${BOL}[;#][^\\n]*`), "t-c"],
    [y(`${BOL}\\[[^\\]\\n]+\\]`), "t-k"],
    [y(`${BOL}[^=\\n;#\\[][^=\\n]*?(?=[ \\t]*=)`), "t-v"],
    [STR_D, "t-s"], [STR_S, "t-s"],
    [kw("true false yes no on off"), "t-n"], [NUM, "t-n"],
    [y(`=`), "t-p"],
  ],
  nginx: [
    [HASH_C, "t-c"],
    [y(`\\$\\w+`), "t-v"],
    [STR_D, "t-s"], [STR_S, "t-s"],
    [y(`(?<=(?:^|\\n|[;{}])[ \\t]*)[a-z_][\\w]*`), "t-k"],
    [y(`\\b\\d+(?:\\.\\d+)*[smhdkKmMgG]?\\b`), "t-n"],
    WORD,
    [y(`[{};~=]`), "t-p"],
  ],
  apache: [
    [y(`${BOL}#[^\\n]*`), "t-c"],
    [y(`</?[A-Za-z]\\w*`), "t-k"], [y(`>`), "t-k"],
    [y(`%\\{[^}\\n]+\\}|\\$\\{?\\w+\\}?`), "t-v"],
    [STR_D, "t-s"], [STR_S, "t-s"],
    [y(`${BOL}[A-Za-z]\\w*`), "t-x"],
    [kw("on off On Off"), "t-n"], [y(`\\b\\d+(?:\\.\\d+)*\\b`), "t-n"],
    WORD,
  ],
  caddyfile: [
    [HASH_C, "t-c"],
    [y(`\\{[\\w.>-]+\\}`), "t-v"],
    [STR_D, "t-s"], [y("`[^`]*`"), "t-s"],
    [y(`(?<=(?:^|\\n))[^\\s{#][^\\s{]*(?=\\s*\\{)`), "t-k"],
    [y(`${BOL}[a-z_][\\w-]*`), "t-x"],
    [y(`\\b\\d+[smhd]?\\b`), "t-n"],
    WORD,
    [y(`[{}]`), "t-p"],
  ],
  haproxy: [
    [HASH_C, "t-c"],
    [y(`(?<=(?:^|\\n))(?:global|defaults|frontend|backend|listen|resolvers|peers|userlist|program|cache|mailers)\\b`), "t-k"],
    [y(`${BOL}[a-z][\\w.-]*`), "t-x"],
    [kw("if unless or"), "t-k"],
    [y(`%\\[[^\\]\\n]*\\]|%\\w+`), "t-v"],
    [STR_D, "t-s"], [STR_S, "t-s"],
    [y(`(?<=\\s)--?[a-z][\\w-]*`), "t-k"],
    [y(`(?:\\d{1,3}\\.){3}\\d{1,3}(?:/\\d+)?(?::\\d+)?|\\*?:\\d+|\\b\\d+[smhd]?\\b`), "t-n"],
    WORD,
    [y(`[{}!]`), "t-p"],
  ],
  hcl: [
    [y(`(?:#|//)[^\\n]*|/\\*[\\s\\S]*?\\*/`), "t-c"],
    [y(`${BOL}[A-Za-z_][\\w-]*(?=[ \\t]+(?:"|\\{|[A-Za-z_]))`), "t-k"],
    [y(`${BOL}[A-Za-z_][\\w-]*(?=[ \\t]*=)`), "t-v"],
    [y(`<<-?(\\w+)\\n[\\s\\S]*?\\n[ \\t]*\\1(?=\\n|$)`), "t-s"],
    [STR_D, "t-s"],
    [kw("true false null"), "t-n"], [NUM, "t-n"],
    [y(`[=\\[\\]{},]`), "t-p"],
  ],
  http: [
    [y(`(?<=(?:^|\\n))(?:GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\\b`), "t-k"],
    [y(`(?<=(?:^|\\n)(?:GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS) )\\S+`), "t-s"],
    [y(`HTTP/\\d(?:\\.\\d)?(?: \\d{3})?`), "t-n"],
    [y(`(?<=(?:^|\\n))[A-Za-z][\\w-]*(?=:)`), "t-v"],
    [y(`<[^>\\n]+>`), "t-x"],
    [STR_D, "t-s"],
    [y(`[{}\\[\\],:]`), "t-p"],
  ],
  js: [
    [y(`//[^\\n]*|/\\*[\\s\\S]*?\\*/`), "t-c"],
    [y("`(?:\\\\.|[^`\\\\])*`"), "t-s"], [STR_D, "t-s"], [STR_S, "t-s"],
    [kw("const let var function return if else for while do of in new class extends import export from default async await try catch finally throw typeof instanceof switch case break continue yield delete this"), "t-k"],
    [kw("true false null undefined NaN Infinity"), "t-n"], [NUM, "t-n"],
    [y(`[A-Za-z_$][\\w$]*(?=\\s*\\()`), "t-x"],
    [y(`[A-Za-z_$][\\w$]*`), ""],
    [y(`=>|[{}()\\[\\];,.]`), "t-p"],
  ],
  python: [
    [y(`#[^\\n]*`), "t-c"],
    [y(`[rbfRBF]{0,2}(?:"""[\\s\\S]*?"""|'''[\\s\\S]*?''')`), "t-s"],
    [y(`[rbfRBF]{0,2}(?:"(?:\\\\.|[^"\\\\\\n])*"|'(?:\\\\.|[^'\\\\\\n])*')`), "t-s"],
    [kw("def return if elif else for while in not and or is import from as class try except finally raise with lambda yield pass break continue global nonlocal async await"), "t-k"],
    [kw("True False None self"), "t-n"], [NUM, "t-n"],
    [y(`[A-Za-z_]\\w*(?=\\s*\\()`), "t-x"],
    [y(`[A-Za-z_]\\w*`), ""],
    [y(`[{}()\\[\\]:,.]`), "t-p"],
  ],
  rust: [
    [y(`//[^\\n]*|/\\*[\\s\\S]*?\\*/`), "t-c"],
    [y(`r#*"[\\s\\S]*?"#*`), "t-s"], [STR_D, "t-s"],
    [kw("fn let mut pub use mod struct enum impl trait for in if else match while loop return async await move ref where type const static crate self super Self as dyn unsafe"), "t-k"],
    [kw("true false None Some Ok Err"), "t-n"], [NUM, "t-n"],
    [y(`[A-Za-z_]\\w*!?(?=\\s*\\()|[A-Za-z_]\\w*!`), "t-x"],
    [y(`[A-Za-z_]\\w*`), ""],
    [y(`[{}()\\[\\];,.:&]`), "t-p"],
  ],
  powershell: [
    [y(`<#[\\s\\S]*?#>|#[^\\n]*`), "t-c"],
    [y(`\\$[\\w:]+|\\$\\{[^}]+\\}`), "t-v"],
    [STR_D, "t-s"], [STR_S, "t-s"],
    [y(`\\b[A-Z][a-z]+-[A-Z][A-Za-z]+\\b`), "t-x"],
    [y(`(?<=\\s)-[A-Za-z][\\w]*`), "t-k"],
    [kw("if else elseif foreach for while function param return try catch finally throw", "i"), "t-k"],
    [y(`\\b0x[0-9a-fA-F]+\\b`), "t-n"], [NUM, "t-n"],
    [y(`[{}()\\[\\];,|=]`), "t-p"],
  ],
  sql: [
    [y(`--[^\\n]*|/\\*[\\s\\S]*?\\*/`), "t-c"],
    [STR_S, "t-s"],
    [kw("select from where and or not insert into values update set delete create table index join left right inner outer on group by order having limit as distinct null is in like count union all case when then else end primary key references alter drop", "i"), "t-k"],
    [NUM, "t-n"],
    [y(`[A-Za-z_]\\w*(?=\\()`), "t-x"],
    [y(`[A-Za-z_]\\w*`), ""],
    [y(`[(),;.*=<>]`), "t-p"],
  ],
  env: [
    [y(`${BOL}#[^\\n]*`), "t-c"],
    [y(`${BOL}export(?=\\s)`), "t-k"],
    [y(`(?<=(?:^|\\n)[ \\t]*(?:export[ \\t]+)?)[A-Za-z_][A-Za-z0-9_.]*(?=\\s*=)`), "t-v"],
    [y(`\\$\\{[^}\\n]*\\}|\\$[A-Za-z_]\\w*`), "t-v"],
    [STR_D, "t-s"], [STR_S, "t-s"],
    [y(`(?<==)(?:true|false|yes|no|on|off)\\b`), "t-n"],
    [y(`(?<==)-?\\d+(?:\\.\\d+)?(?=\\s|$)`), "t-n"],
    [y(`=`), "t-p"],
  ],
  lua: [
    [y(`--\\[(=*)\\[[\\s\\S]*?\\]\\1\\]|--[^\\n]*`), "t-c"],
    [y(`\\[(=*)\\[[\\s\\S]*?\\]\\1\\]`), "t-s"],
    [STR_D, "t-s"], [STR_S, "t-s"],
    [kw("and break do else elseif end for function goto if in local not or repeat return then until while"), "t-k"],
    [kw("true false nil self"), "t-n"], [y(`0x[0-9a-fA-F]+`), "t-n"], [NUM, "t-n"],
    [y(`[A-Za-z_][\\w.:]*(?=\\s*[({"'])`), "t-x"],
    [y(`[A-Za-z_]\\w*`), ""],
    [y(`\\.\\.|[{}()\\[\\];,.=<>~+*/%#^-]`), "t-p"],
  ],
  ldif: [
    [y(`${BOL}#[^\\n]*`), "t-c"],
    [y(`${BOL}[A-Za-z][\\w;.-]*(?=::?\\s)`), "t-v"],
    [y(`${BOL}-$`), "t-p"],
    [y(`::?`), "t-p"],
  ],
  // BIND zone files: directives, owner names, TTLs, classes, RR types, rdata.
  zonefile: [
    [y(`;[^\\n]*`), "t-c"],
    [y(`${BOL}\\$(?:ORIGIN|TTL|INCLUDE|GENERATE)\\b`), "t-k"],
    [STR_D, "t-s"],
    [y(`\\b(?:IN|CH|HS)\\b`), "t-p"],
    [y(`\\b(?:A|AAAA|AFSDB|ALIAS|APL|CAA|CDNSKEY|CDS|CERT|CNAME|CSYNC|DHCID|DNAME|DNSKEY|DS|EUI48|EUI64|HINFO|HTTPS|IPSECKEY|KEY|L32|L64|LOC|LP|LUA|MB|MG|MINFO|MR|MX|NAPTR|NID|NS|NSEC|NSEC3|NSEC3PARAM|OPENPGPKEY|PTR|RP|RRSIG|SIG|SMIMEA|SOA|SPF|SRV|SSHFP|SVCB|TKEY|TLSA|TSIG|TXT|URI|ZONEMD)\\b`), "t-k"],
    [y(`(?<=^|\\s)@(?=\\s|$)`), "t-v"],
    [y(`(?:\\d{1,3}\\.){3}\\d{1,3}|[0-9a-fA-F:]*:[0-9a-fA-F:]+`), "t-n"],
    [y(`\\b\\d+[smhdwSMHDW]?\\b`), "t-n"],
    [y(`${BOL}[A-Za-z0-9_*][\\w.*-]*\\.?`), "t-v"],
    [y(`[()]`), "t-p"],
    WORD,
  ],
};
// TypeScript: the JS rules with the type-level keywords added.
RULES.ts = [
  ...RULES.js.slice(0, 4),
  [kw("const let var function return if else for while do of in new class extends implements interface type enum namespace declare abstract readonly public private protected static import export from default as satisfies keyof infer async await try catch finally throw typeof instanceof switch case break continue yield delete this"), "t-k"],
  ...RULES.js.slice(5),
];

function dockerfile(code) {
  return code
    .split("\n")
    .map((line) => {
      const m = /^(\s*)(FROM|RUN|CMD|LABEL|EXPOSE|ENV|ADD|COPY|ENTRYPOINT|VOLUME|USER|WORKDIR|ARG|ONBUILD|STOPSIGNAL|HEALTHCHECK|SHELL)(\b.*)$/i.exec(line);
      if (/^\s*#/.test(line)) return span("t-c", line);
      if (m) return esc(m[1]) + span("t-k", m[2]) + bash(m[3], { inline: true });
      return bash(line, { inline: true });
    })
    .join("\n");
}

function diff(code) {
  return code
    .split("\n")
    .map((l) => (/^\+/.test(l) ? span("t-add", l) : /^-/.test(l) ? span("t-del", l) : /^@@/.test(l) ? span("t-k", l) : esc(l)))
    .join("\n");
}

// ---------------------------------------------------------------- shell

const SH_KW = new Set("if then else elif fi for in do done while until case esac function select return local export readonly declare unset set source".split(" "));
const SH_PREFIX = new Set(["sudo", "exec", "time", "env", "nohup", "xargs", "command", "builtin", "then", "do", "else", "watch", "!"]);

function dqString(s) {
  // highlight $VAR / ${...} / $(...) inside double-quoted strings
  let out = "";
  let last = 0;
  const re = /\$\{[^}]*\}|\$\([^)]*\)|\$[A-Za-z_]\w*|\$[@#?$!*0-9]/g;
  let m;
  while ((m = re.exec(s))) {
    out += span("t-s", s.slice(last, m.index)) + span("t-v", m[0]);
    last = m.index + m[0].length;
  }
  return out + span("t-s", s.slice(last));
}

function bash(code, { prompt = false, inline = false } = {}) {
  const lines = code.split("\n");
  let out = [];
  let continued = false;
  let heredoc = null;
  for (let li = 0; li < lines.length; li++) {
    let line = lines[li];
    if (heredoc) {
      if (line.replace(/^\t+/, "") === heredoc) { out.push(span("t-p", line)); heredoc = null; }
      else out.push(span("t-s", line));
      continue;
    }
    let html = "";
    if (prompt) {
      const pm = /^(\s*(?:\$|#|>|PS[^>]*>)\s)/.exec(line);
      if (!pm && !continued) { out.push(esc(line)); continue; }
      if (pm && !continued) { html += span("t-p", pm[1]); line = line.slice(pm[1].length); }
    }
    let cmdPos = !continued && !inline;
    if (inline && li === 0) cmdPos = false;
    let i = 0;
    let varNext = false;
    const n = line.length;
    while (i < n) {
      const rest = line.slice(i);
      const c = line[i];
      let m;
      if (/\s/.test(c)) { m = /^\s+/.exec(rest); html += m[0]; i += m[0].length; continue; }
      if (c === "#" && (i === 0 || /\s/.test(line[i - 1]))) { html += span("t-c", rest); break; }
      if ((m = /^<<-?\s*(['"]?)([A-Za-z_]\w*)\1/.exec(rest))) { heredoc = m[2]; html += span("t-p", m[0]); i += m[0].length; continue; }
      if (c === "'") { m = /^'[^']*'?/.exec(rest); html += span("t-s", m[0]); i += m[0].length; cmdPos = false; continue; }
      if (c === '"') { m = /^"(?:\\.|[^"\\])*"?/.exec(rest); html += dqString(m[0]); i += m[0].length; cmdPos = false; continue; }
      if ((m = /^\$\(\(?/.exec(rest))) { html += span("t-v", m[0]); i += m[0].length; cmdPos = m[0] === "$("; continue; }
      if ((m = /^\$\{[^}]*\}|^\$[A-Za-z_]\w*|^\$[@#?$!*0-9]/.exec(rest))) { html += span("t-v", m[0]); i += m[0].length; cmdPos = false; continue; }
      if ((m = /^(?:&&|\|\||\|&?|;;?|&)/.exec(rest))) { html += span("t-p", m[0]); i += m[0].length; cmdPos = true; continue; }
      if ((m = /^(?:\d?>>?&?\d?|<|\(|\)|\{|\}|\[\[?|\]\]?)/.exec(rest))) {
        html += span("t-p", m[0]); i += m[0].length;
        cmdPos = m[0] === "(" || m[0] === "{";
        continue;
      }
      if (c === "\\" && i === n - 1) { html += span("t-p", "\\"); i++; continue; }
      m = /^(?:\\.|[^\s|;&()<>"'$\\{}])+/.exec(rest) || [c];
      const w = m[0];
      i += w.length;
      if (varNext) { varNext = false; html += span("t-v", w); continue; }
      if (cmdPos) {
        const am = /^([A-Za-z_]\w*)(\+?=)(.*)$/.exec(w);
        if (am) { html += span("t-v", am[1]) + span("t-p", am[2]) + esc(am[3]); continue; }
        if (w === "for" || w === "select") { html += span("t-k", w); cmdPos = false; varNext = true; continue; }
        if (SH_KW.has(w)) { html += span("t-k", w); cmdPos = w !== "in"; continue; }
        html += span("t-x", w);
        cmdPos = SH_PREFIX.has(w);
        continue;
      }
      if (SH_KW.has(w) && /^(then|do|done|fi|else|esac|in)$/.test(w)) { html += span("t-k", w); cmdPos = w !== "in"; continue; }
      const fm = /^(--?[A-Za-z][\w-]*)(=?)(.*)$/.exec(w);
      if (fm) { html += span("t-k", fm[1]) + (fm[2] ? span("t-p", "=") + esc(fm[3]) : ""); continue; }
      if (/^\d+(\.\d+)?$/.test(w)) { html += span("t-n", w); continue; }
      html += esc(w);
    }
    continued = /\\$/.test(line) || /(\|\||&&|\|)\s*$/.test(line);
    out.push(html);
  }
  return out.join("\n");
}

/** Highlight `code` for `lang`. Returns escaped HTML. */
export function highlight(code, lang) {
  const l = normalizeLang(lang);
  if (l === "bash") return bash(code);
  if (l === "console") return bash(code, { prompt: true });
  if (l === "dockerfile") return dockerfile(code);
  if (l === "diff") return diff(code);
  const rules = RULES[l];
  if (!rules) return esc(code);
  return lex(code, rules);
}

export default highlight;
