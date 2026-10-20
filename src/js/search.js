/*
 * PowerDNS-AuthAdmin site search: a command palette (Cmd/Ctrl+K, "/") and the /search/ page.
 * Zero dependencies, no globals, no network apart from the site's own index JSON.
 *
 * This one file holds two layers:
 *   1. ENGINE: pure functions (tokenizer, typo tolerance, fuzzy scorer, ranking).
 *      No DOM. When there is no `document` (Node via node:vm), the IIFE exports the
 *      engine on `module.exports` and stops, so the build-time indexer and the tests use
 *      the very same tokenizer and ranking as the browser. Single source of truth.
 *   2. UI: the <dialog> palette, the /search/ page mount ([data-search-page]) and the
 *      #anchor flash.
 *
 * Index format: see src/search/build-index.mjs.
 */
(function () {
  "use strict";

  /* =====================================================================
   * 1. ENGINE
   * =================================================================== */

  var STOP = {};
  ("a an and are as at be by can do does for from has have how i if in into is it its me my of on " +
    "or our so than that the their then there these this to was we what when where which who why will with you your")
    .split(" ").forEach(function (w) { STOP[w] = 1; });

  // Synonym groups: every phrase in a group can stand in for the others.
  var SYN = [
    ["pdns", "powerdns", "authoritative"],
    ["rrset", "record set", "records"],
    ["dnssec", "cryptokey", "dnskey", "ds"],
    ["tsig", "transfer key"],
    ["oidc", "sso", "openid", "openid connect", "single sign on"],
    ["saml", "adfs"],
    ["ldap", "active directory", "ad", "directory"],
    ["rbac", "roles", "permissions"],
    ["mcp", "model context protocol", "ai assistant", "claude code", "codex", "cursor"],
    ["docker", "compose", "container"],
    ["postgres", "postgresql", "pg"],
    ["sqlite"],
    ["zone", "domain"],
    ["secondary", "slave"],
    ["primary", "master"],
    ["cluster", "multi primary"],
    ["axfr", "zone transfer"],
    ["notify"],
    ["api token", "pat", "personal access token"],
    ["passkey", "webauthn", "fido", "security key"],
    ["2fa", "mfa", "totp", "two factor"],
    ["provisioning", "yaml", "first boot"],
    ["audit", "audit log", "history"],
    ["env", "environment variable", "config", "configuration"],
    ["install", "installation", "setup"],
    ["upgrade", "upgrading", "migration"],
    ["tls", "ssl", "https"],
    ["proxy", "reverse proxy", "nginx", "caddy", "traefik"],
    ["backend", "server"],
    ["template", "zone template"],
    ["autoprimary", "supermaster"],
    ["metrics", "prometheus"],
    ["health", "readiness", "liveness"],
    ["dyndns", "ddclient"],
  ];
  var SYN_MAP = {}; // first word -> [{words, group}]
  SYN.forEach(function (g, gi) {
    g.forEach(function (ph) {
      var words = ph.split(" ");
      (SYN_MAP[words[0]] = SYN_MAP[words[0]] || []).push({ words: words, group: gi });
    });
  });
  Object.keys(SYN_MAP).forEach(function (k) { SYN_MAP[k].sort(function (a, b) { return b.words.length - a.words.length; }); });

  function fold(s) {
    return String(s == null ? "" : s)
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "");
  }

  var WORD_RE = /[A-Za-z0-9]+/g;
  function camelParts(w) {
    if (!/[a-z][A-Z]|[A-Z]{2}[a-z]/.test(w)) return null;
    var parts = w.replace(/([a-z0-9])([A-Z])/g, "$1 $2").replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2").split(" ");
    return parts.length > 1 ? parts : null;
  }

  // Tokens for indexing: lower-cased words (len >= 2, no stopwords) plus camelCase parts.
  function indexTokens(s) {
    var out = [], m, str = fold(s);
    WORD_RE.lastIndex = 0;
    while ((m = WORD_RE.exec(str))) {
      var w = m[0], lw = w.toLowerCase();
      if (lw.length > 1 && !STOP[lw]) out.push(lw);
      var parts = camelParts(w);
      if (parts) for (var i = 0; i < parts.length; i++) {
        var p = parts[i].toLowerCase();
        if (p.length > 1 && !STOP[p] && p !== lw) out.push(p);
      }
    }
    return out;
  }

  // A deliberately light stemmer: only used to group inflections (groups/group, recording(s)).
  function stem(t) {
    if (t.length < 4) return t;
    if (/ies$/.test(t) && t.length > 4) return t.slice(0, -3) + "y";
    if (/sses$/.test(t)) return t.slice(0, -2);
    if (/ing$/.test(t) && t.length > 5) return t.slice(0, -3);
    if (/ed$/.test(t) && t.length > 4) return t.slice(0, -2);
    if (/[^su]s$/.test(t)) return t.slice(0, -1);
    return t;
  }

  // Bounded Damerau-Levenshtein (optimal string alignment). Returns max+1 when over.
  var D0 = [], D1 = [], D2 = [];
  function dl(a, b, max) {
    var la = a.length, lb = b.length, i, j;
    if (Math.abs(la - lb) > max) return max + 1;
    var prev2 = D0, prev = D1, cur = D2, tmp;
    for (j = 0; j <= lb; j++) prev[j] = j;
    for (i = 1; i <= la; i++) {
      cur[0] = i;
      var rowMin = i, ai = a.charCodeAt(i - 1);
      for (j = 1; j <= lb; j++) {
        var bj = b.charCodeAt(j - 1);
        var v = prev[j - 1] + (ai === bj ? 0 : 1);
        if (prev[j] + 1 < v) v = prev[j] + 1;
        if (cur[j - 1] + 1 < v) v = cur[j - 1] + 1;
        if (i > 1 && j > 1 && ai === b.charCodeAt(j - 2) && a.charCodeAt(i - 2) === bj && prev2[j - 2] + 1 < v) v = prev2[j - 2] + 1;
        cur[j] = v;
        if (v < rowMin) rowMin = v;
      }
      if (rowMin > max) return max + 1;
      tmp = prev2; prev2 = prev; prev = cur; cur = tmp;
    }
    return prev[lb];
  }

  // fzf-style fuzzy subsequence scoring with an optimal alignment (small DP).
  // Bonuses for word starts / camelCase humps / consecutive runs, gap penalties.
  // Returns {score, ratio (0..1), pos:[indexes]} or null.
  function fzf(pattern, text) {
    var m = pattern.length, n = text.length;
    if (!m || m > n || n > 400) return null;
    var lower = fold(text).toLowerCase();
    if (lower.length !== n) { lower = text.toLowerCase(); }
    // quick subsequence check
    var k = 0, i, j;
    for (i = 0; i < n && k < m; i++) if (lower.charCodeAt(i) === pattern.charCodeAt(k)) k++;
    if (k < m) return null;
    var bonus = new Array(n);
    for (i = 0; i < n; i++) {
      var c = text.charAt(i), pc = i ? text.charAt(i - 1) : " ";
      var isAl = /[A-Za-z0-9]/.test(c), pAl = /[A-Za-z0-9]/.test(pc);
      bonus[i] = !isAl ? 0 : !pAl ? 10 : (/[a-z]/.test(pc) && /[A-Z]/.test(c)) ? 8 : (/[A-Za-z]/.test(pc) && /[0-9]/.test(c)) ? 5 : 0;
    }
    var NEG = -1e9, MATCH = 16, CONSEC = 6, GAP_S = 3, GAP_E = 1;
    var S = [], from = [];
    for (j = 0; j < m; j++) {
      var row = new Array(n), fr = new Array(n), pj = pattern.charCodeAt(j);
      var prevRow = j ? S[j - 1] : null;
      var gapBest = NEG, gapIdx = -1;
      for (i = 0; i < n; i++) {
        if (j && i >= 2) {
          var cand = prevRow[i - 2] - GAP_S;
          if (gapBest - GAP_E >= cand) gapBest -= GAP_E; else { gapBest = cand; gapIdx = i - 2; }
        } else if (j && gapBest > NEG) gapBest -= GAP_E;
        row[i] = NEG; fr[i] = -1;
        if (lower.charCodeAt(i) !== pj) continue;
        var base = MATCH + bonus[i];
        if (!j) { row[i] = base - (i > 0 ? Math.min(i, 8) * 0.5 : 0); continue; }
        var diag = i ? prevRow[i - 1] : NEG;
        var best = NEG, bi = -1;
        if (diag > NEG) { best = diag + CONSEC + Math.max(bonus[i], 0); bi = i - 1; }
        if (gapBest > NEG && gapBest > best) { best = gapBest; bi = gapIdx; }
        if (bi < 0) continue;
        row[i] = best + base; fr[i] = bi;
      }
      S.push(row); from.push(fr);
    }
    var last = S[m - 1], end = -1, sc = NEG;
    for (i = 0; i < n; i++) if (last[i] > sc) { sc = last[i]; end = i; }
    if (end < 0 || sc <= NEG / 2) return null;
    var pos = new Array(m);
    for (j = m - 1, i = end; j >= 0; j--) { pos[j] = i; i = from[j][i]; }
    var maxScore = m * (MATCH + 10 + CONSEC) - CONSEC;
    return { score: sc, ratio: Math.max(0, Math.min(1, sc / maxScore)), pos: pos };
  }

  function compact(s) { return fold(s).toLowerCase().replace(/[^a-z0-9]+/g, ""); }

  // Field bits
  var F_TITLE = 1, F_HEAD = 2, F_LINE = 4, F_KW = 8, F_BODY = 16;
  // ADRs explain why; guides explain how. A guide should win a tie.
  var KIND_BOOST = { doc: 1.12, config: 1.12, api: 1.12, adr: 1.02, faq: 1.0, page: 0.92 };
  var FILTERS = {
    all: null,
    docs: { doc: 1, config: 1, api: 1, adr: 1 },
    config: { config: 1 },
    api: { api: 1 },
    site: { page: 1, faq: 1 },
  };

  function createEngine(data) {
    var P = data.p || [], R = data.r || [], N = R.length;
    var vocab = data.w ? data.w.split(" ") : [];
    var df = (data.d || []).slice();
    var vid = new Map();
    for (var v = 0; v < vocab.length; v++) vid.set(vocab[v], v);

    var recs = new Array(N), pageRec = [];
    var post = []; // id -> {r:[], m:[], tf:[]}
    var lens = new Float32Array(N), totalLen = 0;

    function idOf(t) {
      var id = vid.get(t);
      if (id === undefined) { id = vocab.length; vocab.push(t); vid.set(t, id); df.push(0); }
      return id;
    }

    for (var i = 0; i < N; i++) {
      var r = R[i], p = P[r[0]];
      var isPage = !r[1];
      var rec = {
        i: i, page: r[0], url: p[0] + (r[1] ? "#" + r[1] : ""), path: p[0], title: p[1], section: p[2],
        kind: r[6] || p[3], pageKind: p[3], desc: p[4], anchor: r[1], heading: r[2], parent: r[3],
        parentHeading: r[3] >= 0 && R[r[3]] ? R[r[3]][2] : "", content: r[4] || "", kw: r[5] || [],
        isPage: isPage, level: isPage ? 1 : r[3] >= 0 ? 3 : 2,
      };
      rec.kwc = rec.kw.map(compact);
      rec.headLower = fold(isPage ? rec.title : rec.heading).toLowerCase();
      var hw = rec.headLower.match(/[a-z0-9]+/g) || [];
      rec.acr = hw.map(function (x) { return x[0]; }).join("");
      rec.acr2 = hw.filter(function (x) { return !STOP[x]; }).map(function (x) { return x[0]; }).join("");
      rec.titleLower = fold(rec.title).toLowerCase();
      recs[i] = rec;
      if (isPage && pageRec[r[0]] === undefined) pageRec[r[0]] = i;

      var acc = new Map(), bodyLen = 0;
      var addField = function (text, bit) {
        var toks = indexTokens(text);
        for (var t = 0; t < toks.length; t++) {
          var id = idOf(toks[t]);
          var e = acc.get(id);
          if (!e) { e = { m: 0, tf: 0 }; acc.set(id, e); }
          e.m |= bit;
          if (bit === F_BODY) { e.tf++; bodyLen++; }
        }
      };
      addField(rec.title, F_TITLE);
      addField(rec.section, F_LINE);
      if (rec.parentHeading) addField(rec.parentHeading, F_LINE);
      if (!isPage) addField(rec.heading, F_HEAD);
      addField(rec.kw.join(" "), F_KW);
      addField(rec.content, F_BODY);
      if (isPage && rec.desc) addField(rec.desc, F_BODY);
      lens[i] = bodyLen; totalLen += bodyLen;
      acc.forEach(function (e, id) {
        var pl = post[id] || (post[id] = { r: [], m: [], tf: [] });
        pl.r.push(i); pl.m.push(e.m); pl.tf.push(e.tf);
      });
    }
    var V = vocab.length;
    for (v = 0; v < V; v++) if (!df[v]) df[v] = post[v] ? post[v].r.length : 0;
    var avgLen = N ? totalLen / N || 1 : 1;
    var idf = new Float32Array(V), maxIdf = 0;
    for (v = 0; v < V; v++) {
      idf[v] = Math.log(1 + (N - df[v] + 0.5) / (df[v] + 0.5));
      if (idf[v] > maxIdf) maxIdf = idf[v];
    }
    maxIdf = maxIdf || 1;

    // Sorted copy for prefix lookups (vocab from the index is sorted already; extras are not).
    var sortedIds = []; for (v = 0; v < V; v++) sortedIds.push(v);
    sortedIds.sort(function (a, b) { return vocab[a] < vocab[b] ? -1 : vocab[a] > vocab[b] ? 1 : 0; });
    var byLen = [], stems = new Map();
    for (v = 0; v < V; v++) {
      var w = vocab[v], L = w.length;
      (byLen[L] = byLen[L] || []).push(v);
      var st = stem(w);
      var arr = stems.get(st); if (!arr) stems.set(st, arr = []); arr.push(v);
    }

    function lowerBound(t) {
      var lo = 0, hi = sortedIds.length;
      while (lo < hi) { var mid = (lo + hi) >> 1; if (vocab[sortedIds[mid]] < t) lo = mid + 1; else hi = mid; }
      return lo;
    }

    // ---- term expansion: exact, inflection, prefix, typo. Memoised.
    var memo = new Map();
    function expand(t, last, strict) {
      var key = t + (last ? "\u0001" : "") + (strict ? "\u0002" : "");
      var hit = memo.get(key);
      if (hit) return hit;
      var res = new Map();
      var add = function (id, q, hl) { var e = res.get(id); if (!e || e.q < q) res.set(id, { q: q, hl: hl }); };
      var ex = vid.get(t);
      if (ex !== undefined) add(ex, 1, 0);
      var sv = stems.get(stem(t));
      if (sv) for (var a = 0; a < sv.length; a++) add(sv[a], Math.abs(vocab[sv[a]].length - t.length) <= 1 ? 0.96 : 0.9, 0);
      var k, id, w;
      if (strict) return finish();
      // prefix
      var lo = lowerBound(t), pref = [];
      for (k = lo; k < sortedIds.length; k++) {
        id = sortedIds[k]; w = vocab[id];
        if (w.lastIndexOf(t, 0) !== 0) break;
        if (w !== t) pref.push(id);
      }
      if (last) {
        if (pref.length > 150) pref = pref.sort(function (x, y) { return df[y] - df[x]; }).slice(0, 150);
        for (a = 0; a < pref.length; a++) { w = vocab[pref[a]]; add(pref[a], Math.min(0.93, 0.62 + 0.33 * t.length / w.length), t.length); }
      } else {
        for (a = 0; a < pref.length; a++) if (vocab[pref[a]].length - t.length <= 3) add(pref[a], 0.82, 0);
      }
      // near-inflection: migrate -> migration, configure -> configuration
      if (t.length >= 6) {
        var root = t.slice(0, -1);
        for (k = lowerBound(root); k < sortedIds.length; k++) {
          id = sortedIds[k]; w = vocab[id];
          if (w.lastIndexOf(root, 0) !== 0) break;
          if (w.length - root.length <= 5) add(id, 0.8, 0);
        }
      }
      // typo tolerance, only when the term is unknown (Algolia-style: typos rank after exact)
      if (!res.size && t.length >= 4) {
        var maxD = t.length >= 8 ? 2 : 1;
        for (var L = t.length - maxD; L <= t.length + maxD; L++) {
          var bucket = byLen[L];
          if (!bucket) continue;
          for (a = 0; a < bucket.length; a++) {
            var d = dl(t, vocab[bucket[a]], maxD);
            if (d <= maxD) add(bucket[a], d === 1 ? 0.64 : 0.46, 0);
          }
        }
        if (last && t.length >= 5) {
          for (L = t.length + 1; L < byLen.length; L++) {
            bucket = byLen[L];
            if (!bucket) continue;
            for (a = 0; a < bucket.length; a++) {
              w = vocab[bucket[a]];
              if (dl(t, w.slice(0, t.length), 1) <= 1) add(bucket[a], 0.5, t.length);
            }
          }
        }
      }
      return finish();
      function finish() {
        var list = [];
        res.forEach(function (e, id2) { list.push({ id: id2, q: e.q, hl: e.hl }); });
        if (memo.size > 3000) memo.clear();
        memo.set(key, list);
        return list;
      }
    }

    function synTerms(ph) {
      return ph.split(" ").filter(function (t) { return !STOP[t]; }).map(function (t) { return { t: t, last: false, strict: true }; });
    }

    // ---- query parsing (stopwords, last-term prefix, synonym phrases)
    function parse(q) {
      var raw = fold(q).toLowerCase();
      var toks = raw.match(/[a-z0-9]+/g) || [];
      var trailing = /\s$/.test(q);
      var terms = toks.map(function (t, ix) { return { t: t, last: ix === toks.length - 1 && !trailing }; });
      var kept = terms.filter(function (x) { return (x.last || (!STOP[x.t] && x.t.length > 1)); });
      if (kept.length > 1) kept = kept.filter(function (x) { return !(STOP[x.t] && x.last && x.t.length < 3); });
      if (!kept.length) kept = terms.slice(-1);
      var units = [];
      for (var i2 = 0; i2 < kept.length;) {
        var cand = SYN_MAP[kept[i2].t], used = 0, group = -1;
        if (cand) for (var c = 0; c < cand.length && !used; c++) {
          var ws = cand[c].words, ok = i2 + ws.length <= kept.length;
          for (var x = 0; ok && x < ws.length; x++) if (kept[i2 + x].t !== ws[x]) ok = false;
          if (ok && ws.length > 1 && kept[i2 + ws.length - 1].last) ok = false;
          if (ok) { used = ws.length; group = cand[c].group; }
        }
        if (!used) {
          var single = kept[i2];
          var alts = [{ w: 1, terms: [single] }];
          // single word synonyms only once the word is complete (or an exact known short form)
          var sc = SYN_MAP[single.t];
          if (sc && !(single.last && single.t.length < 3 && !vid.has(single.t))) {
            var g2 = -1; for (c = 0; c < sc.length; c++) if (sc[c].words.length === 1) g2 = sc[c].group;
            if (g2 >= 0) SYN[g2].forEach(function (ph) {
              if (ph === single.t) return;
              alts.push({ w: 0.86, terms: synTerms(ph) });
            });
          }
          units.push({ alts: alts, raw: single.t });
          i2++;
        } else {
          var orig = kept.slice(i2, i2 + used);
          var phrase = orig.map(function (o) { return o.t; }).join(" ");
          var alts2 = [{ w: 1, terms: orig }];
          SYN[group].forEach(function (ph) {
            if (ph === phrase) return;
            alts2.push({ w: 0.86, terms: synTerms(ph) });
          });
          units.push({ alts: alts2, raw: phrase });
          i2 += used;
        }
      }
      // symbolic queries (APP_SECRET_KEY, zone_templates, POST /api/mcp, list_zones) also match literally
      var sym = /[\[\]_\/.\-=]/.test(q) ? fold(q).toLowerCase().trim().replace(/\s+/g, " ") : "";
      return { sym: sym, units: units, words: kept.map(function (x) { return x.t; }), compact: compact(q), phrase: kept.map(function (x) { return x.t; }).join(" ") };
    }

    var K1 = 1.2, B = 0.75;
    function termScores(term, out, hl, masks) {
      var ex = expand(term.t, term.last, term.strict);
      for (var e = 0; e < ex.length; e++) {
        var x = ex[e], pl = post[x.id];
        if (!pl) continue;
        var hv = hl.get(vocab[x.id]);
        if (hv === undefined || (hv !== 0 && (x.hl === 0 || x.hl > hv))) hl.set(vocab[x.id], x.hl);
        var idn = idf[x.id] / maxIdf, idfF = 0.5 + 0.5 * idn;
        for (var k = 0; k < pl.r.length; k++) {
          var ri = pl.r[k], mask = pl.m[k], fs = 0;
          if (mask & F_HEAD) fs = 10;
          if (mask & F_TITLE) fs = Math.max(fs, recs[ri].isPage ? 10.5 : 3.2);
          if (mask & F_KW) fs = Math.max(fs, 6.5);
          if (mask & F_LINE) fs = Math.max(fs, 3);
          var cs = 0, tf = pl.tf[k];
          if (tf) cs = 3.2 * idn * (tf * (K1 + 1)) / (tf + K1 * (1 - B + B * lens[ri] / avgLen));
          var s = x.q * (fs * idfF + cs);
          if (s > out[ri]) out[ri] = s;
          masks[ri] |= mask;
        }
      }
    }

    function search(q, opts) {
      opts = opts || {};
      var t0 = (typeof performance !== "undefined" ? performance : Date).now();
      var parsed = parse(q || "");
      var hl = new Map();
      var empty = { query: q, groups: [], hits: [], total: 0, counts: { all: 0, docs: 0, config: 0, api: 0, site: 0 }, hl: hl, fuzzy: false, ms: 0 };
      if (!parsed.compact) return empty;
      var U = parsed.units.length;
      var total = new Float32Array(N), matched = new Uint8Array(N);
      var inPrimary = new Uint8Array(N), inMeta = new Uint8Array(N);
      for (var u = 0; u < U; u++) {
        var unit = parsed.units[u], us = new Float32Array(N), um = new Uint8Array(N);
        for (var a = 0; a < unit.alts.length; a++) {
          var alt = unit.alts[a], altS = null, altM = null;
          if (!alt.terms.length) continue;
          for (var t = 0; t < alt.terms.length; t++) {
            var ts = new Float32Array(N), tm = new Uint8Array(N);
            termScores(alt.terms[t], ts, hl, tm);
            if (!altS) { altS = ts; altM = tm; }
            else for (var r2 = 0; r2 < N; r2++) { altS[r2] = altS[r2] > 0 && ts[r2] > 0 ? altS[r2] + ts[r2] : 0; altM[r2] &= tm[r2]; }
          }
          if (alt.terms.length > 1) for (r2 = 0; r2 < N; r2++) altS[r2] /= Math.sqrt(alt.terms.length);
          for (r2 = 0; r2 < N; r2++) if (altS[r2] > 0) { var sv = altS[r2] * alt.w; if (sv > us[r2]) us[r2] = sv; um[r2] |= altM[r2]; }
        }
        for (r2 = 0; r2 < N; r2++) if (us[r2] > 0) {
          total[r2] += us[r2]; matched[r2]++;
          if (um[r2] & (recs[r2].isPage ? F_TITLE : F_HEAD)) inPrimary[r2]++;
          if (um[r2] & (F_TITLE | F_HEAD | F_LINE)) inMeta[r2]++;
        }
      }
      var need = U, cands = [];
      for (r2 = 0; r2 < N; r2++) if (matched[r2] >= need && U) cands.push(r2);
      var relaxed = false;
      if (!cands.length && U >= 2) {
        need = Math.max(1, Math.ceil(U / 2)); relaxed = true;
        for (r2 = 0; r2 < N; r2++) if (matched[r2] >= need) cands.push(r2);
      }
      var scored = [], cq = parsed.compact, phrase = parsed.phrase;
      var seen = new Uint8Array(N);
      for (var c = 0; c < cands.length; c++) {
        var ri = cands[c], rec = recs[ri], s = total[ri];
        if (relaxed) s *= 0.45 * matched[ri] / U;
        // attribute criterion: every query word is in the title (page) or heading (section)
        if (inPrimary[ri] === U) { if (rec.isPage) s = (s + 11) * 1.1; else s += 5; }
        else if (inMeta[ri] === U) s += 2;
        // exact phrase / equality bonuses
        if (parsed.words.length > 1) {
          if (rec.headLower.indexOf(phrase) !== -1) s += 8;
          else if (!rec.isPage && rec.titleLower.indexOf(phrase) !== -1) s += 2;
          else if (rec.content.length && fold(rec.content).toLowerCase().indexOf(phrase) !== -1) s += 3;
        }
        var hc = compact(rec.isPage ? rec.title : rec.heading);
        if (hc === cq) s += 8; else if (stem(hc) === stem(cq)) s += 7;
        if (parsed.sym && rec.headLower.indexOf(parsed.sym) !== -1) s += 22;
        if (cq.length >= 2 && (rec.acr === cq || rec.acr2 === cq)) s += 8;
        // code identifiers: APP_SECRET_KEY, set_records, POST /api/mcp, pda_pat_. Only the best
        // keyword counts: a section listing dnssec.read, dnssec.enable, dnssec.rectify... must not
        // out-rank the section whose heading is "DNSSEC".
        var kwBest = 0;
        for (var k = 0; k < rec.kwc.length; k++) {
          var kc = rec.kwc[k];
          if (parsed.sym && rec.kw[k].toLowerCase().replace(/\s+/g, "") === parsed.sym.replace(/\s+/g, "")) { kwBest = 16; break; }
          if (kc === cq) { kwBest = 14; break; }
          if (cq.length >= 4 && kc.indexOf(cq) !== -1) kwBest = Math.max(kwBest, kc.lastIndexOf(cq, 0) === 0 ? 5 : 3);
        }
        s += kwBest;
        var fz = cq.length >= 2 && cq.length <= 32 ? fzf(cq, rec.isPage ? rec.title : rec.heading) : null;
        if (fz && fz.ratio > 0.35) s += 4 * fz.ratio;
        s *= KIND_BOOST[rec.kind] || 1;
        if (rec.level === 3) s *= 0.97;
        scored.push({ rec: rec, score: s, fuzzy: false });
        seen[ri] = 1;
      }
      // Cmd+P-style fuzzy fallback on titles/headings ("instl", "dnsc", "oidcgrp")
      var fuzzyAdded = 0;
      if (cq.length >= 2 && cq.length <= 32 && scored.length < 12) {
        for (ri = 0; ri < N; ri++) {
          if (seen[ri]) continue;
          rec = recs[ri];
          if (cq.length >= 2 && cq.length <= 6 && (rec.acr2 === cq || rec.acr === cq)) {
            scored.push({ rec: rec, score: 11 * (KIND_BOOST[rec.kind] || 1) * (rec.isPage ? 1.1 : 1), fuzzy: true });
            fuzzyAdded++;
            continue;
          }
          var f = fzf(cq, rec.isPage ? rec.title : rec.heading);
          var minRatio = cq.length <= 3 ? 0.72 : 0.6;
          if (f && f.ratio >= minRatio) {
            scored.push({ rec: rec, score: 7 * f.ratio * (KIND_BOOST[rec.kind] || 1), fuzzy: true, fz: f });
            fuzzyAdded++;
          }
        }
      }
      scored.sort(function (x, y) { return y.score - x.score || x.rec.i - y.rec.i; });

      var counts = { all: 0, docs: 0, config: 0, api: 0, site: 0 };
      for (c = 0; c < scored.length; c++) {
        var kd = scored[c].rec.kind;
        counts.all++;
        for (var fk in FILTERS) if (FILTERS[fk] && FILTERS[fk][kd]) counts[fk]++;
      }
      var filt = FILTERS[opts.filter || "all"] || null;
      var hits = filt ? scored.filter(function (h) { return filt[h.rec.kind]; }) : scored;

      // Group by page (DocSearch-style): page header row + best sections.
      var maxGroups = opts.groups || 8, perGroup = opts.perGroup || 4;
      var groups = [], gmap = new Map();
      for (c = 0; c < hits.length; c++) {
        var h = hits[c], pg = h.rec.page, g = gmap.get(pg);
        if (!g) {
          if (groups.length >= maxGroups) continue;
          var pr = pageRec[pg];
          g = { page: pg, score: h.score, head: null, items: [], more: 0 };
          g.head = h.rec.isPage ? h : { rec: recs[pr], score: 0, fuzzy: false, header: true };
          gmap.set(pg, g); groups.push(g);
          if (h.rec.isPage) continue;
        }
        if (h.rec.isPage) { g.head = h; continue; }
        if (g.items.length < perGroup) g.items.push(h); else g.more++;
      }
      var ms = (typeof performance !== "undefined" ? performance : Date).now() - t0;
      return {
        query: q, groups: groups, hits: hits, total: hits.length, counts: counts, hl: hl,
        relaxed: relaxed, fuzzy: fuzzyAdded > 0 && fuzzyAdded === scored.length, parsed: parsed, ms: ms,
      };
    }

    function suggest(q) {
      // "Did you mean" for the no-results state: closest vocabulary word per query word.
      var words = (fold(q).toLowerCase().match(/[a-z0-9]+/g) || []), changed = false;
      var out = words.map(function (w) {
        if (vid.has(w) || w.length < 4) return w;
        var best = null, bd = 3, bdf = -1;
        for (var L = w.length - 2; L <= w.length + 2; L++) {
          var bucket = byLen[L]; if (!bucket) continue;
          for (var a = 0; a < bucket.length; a++) {
            var d = dl(w, vocab[bucket[a]], 2);
            if (d < bd || (d === bd && df[bucket[a]] > bdf)) { bd = d; best = vocab[bucket[a]]; bdf = df[bucket[a]]; }
          }
        }
        if (best && bd <= 2) { changed = true; return best; }
        return w;
      });
      return changed ? out.join(" ") : "";
    }

    return { search: search, suggest: suggest, records: recs, vocab: vocab, size: N, parse: parse, expand: expand };
  }

  // ---- presentation helpers (pure; used by the UI and tests)
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; });
  }

  var HL_WORD = /[A-Za-z0-9À-ɏ]+/gi;
  // Returns [[start,end], ...] ranges of `text` matched by the query terms.
  function termRanges(text, hl) {
    var out = [], m;
    if (!hl || !hl.size) return out;
    HL_WORD.lastIndex = 0;
    while ((m = HL_WORD.exec(text))) {
      var w = m[0], lw = fold(w).toLowerCase().replace(/[^a-z0-9]/g, "");
      var h = hl.get(lw);
      if (h !== undefined) { out.push([m.index, m.index + (h ? Math.min(h, w.length) : w.length)]); continue; }
      var parts = camelParts(w);
      if (parts) {
        var off = 0;
        for (var i = 0; i < parts.length; i++) {
          var hp = hl.get(parts[i].toLowerCase());
          if (hp !== undefined) out.push([m.index + off, m.index + off + (hp ? Math.min(hp, parts[i].length) : parts[i].length)]);
          off += parts[i].length;
        }
      }
    }
    return out;
  }

  function markup(text, ranges) {
    if (!ranges || !ranges.length) return esc(text);
    ranges = ranges.slice().sort(function (a, b) { return a[0] - b[0]; });
    var out = "", at = 0;
    for (var i = 0; i < ranges.length; i++) {
      var s = Math.max(ranges[i][0], at), e = ranges[i][1];
      if (e <= s) continue;
      out += esc(text.slice(at, s)) + "<mark>" + esc(text.slice(s, e)) + "</mark>";
      at = e;
    }
    return out + esc(text.slice(at));
  }

  function posRanges(pos) {
    var out = [];
    for (var i = 0; i < pos.length; i++) {
      if (out.length && out[out.length - 1][1] === pos[i]) out[out.length - 1][1]++;
      else out.push([pos[i], pos[i] + 1]);
    }
    return out;
  }

  // Highlight a title/heading: term matches first, fzf positions as a fallback.
  function highlight(text, res) {
    var r = termRanges(text, res.hl);
    if (!r.length && res.parsed && res.parsed.compact.length >= 2) {
      var f = fzf(res.parsed.compact, text);
      if (f && f.ratio > 0.3) r = posRanges(f.pos);
    }
    return markup(text, r);
  }

  // Best window of `width` chars around the densest cluster of matched terms.
  function snippet(content, res, width) {
    if (!content) return "";
    width = width || 150;
    var ranges = termRanges(content, res.hl);
    if (!ranges.length) {
      if (content.length <= width) return esc(content);
      var cut = content.lastIndexOf(" ", width);
      return esc(content.slice(0, cut > width * 0.6 ? cut : width)) + "…";
    }
    var best = 0, bestScore = -1, lim = Math.min(ranges.length, 80);
    for (var i = 0; i < lim; i++) {
      var start = Math.max(0, ranges[i][0] - 28), end = start + width, distinct = {}, cnt = 0, sc = 0;
      for (var j = i; j < lim && ranges[j][0] < end; j++) {
        var w = content.slice(ranges[j][0], ranges[j][1]).toLowerCase();
        if (!distinct[w]) { distinct[w] = 1; cnt++; }
        sc++;
      }
      var score = cnt * 10 + sc - (i === 0 ? 0 : 0.01 * i);
      if (score > bestScore) { bestScore = score; best = i; }
    }
    var s0 = Math.max(0, ranges[best][0] - 28);
    if (s0 > 0) { var sp = content.indexOf(" ", s0); if (sp !== -1 && sp < ranges[best][0]) s0 = sp + 1; }
    var e0 = Math.min(content.length, s0 + width);
    if (e0 < content.length) { var sp2 = content.lastIndexOf(" ", e0); if (sp2 > s0 + width * 0.6) e0 = sp2; }
    var local = [];
    for (i = 0; i < ranges.length; i++) if (ranges[i][0] >= s0 && ranges[i][1] <= e0) local.push([ranges[i][0] - s0, ranges[i][1] - s0]);
    return (s0 > 0 ? "…" : "") + markup(content.slice(s0, e0), local) + (e0 < content.length ? "…" : "");
  }

  var api = {
    fold: fold, indexTokens: indexTokens, stem: stem, dl: dl, fzf: fzf, compact: compact,
    createEngine: createEngine, highlight: highlight, snippet: snippet, termRanges: termRanges, esc: esc, SYN: SYN,
  };

  if (typeof document === "undefined") {
    if (typeof module === "object" && module && module.exports) module.exports = api;
    return;
  }

  /* =====================================================================
   * 2. UI
   * =================================================================== */

  var doc = document, html = doc.documentElement;
  var BASE = (html.getAttribute("data-base") || "").replace(/\/+$/, "");
  var ISSUES = "https://github.com/PowerDNS-AuthAdmin/powerdns-authadmin/issues?q=";
  var RECENT_KEY = "pda:search:recent";
  var POPULAR = [
    ["Installation", "installation"], ["Configuration", "configuration"], ["OIDC SSO", "oidc sso"],
    ["RBAC", "rbac"], ["Docker Compose", "docker compose"], ["MCP", "mcp"],
  ];
  var CHIPS = [["all", "All"], ["docs", "Docs"], ["config", "Config"], ["api", "API"], ["site", "Site"]];
  var KIND_LABEL = { doc: "Doc", config: "Config", api: "API", adr: "ADR", faq: "FAQ", page: "Site" };
  var reduceMotion = function () { return window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches; };
  var platform = (navigator.userAgentData && navigator.userAgentData.platform) || navigator.platform || navigator.userAgent || "";
  var isApple = /mac|iphone|ipad|ipod/i.test(platform);
  var MOD = isApple ? "⌘" : "Ctrl";

  function svg(path, cls) {
    return '<svg class="' + (cls || "sx-svg") + '" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' + path + "</svg>";
  }
  var I = {
    search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
    doc: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h4"/>',
    hash: '<path d="M5 9h14M5 15h14M10 4 8 20M16 4l-2 16"/>',
    cog: '<path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0"/><circle cx="16" cy="6" r="2"/><circle cx="10" cy="12" r="2"/><circle cx="18" cy="18" r="2"/>',
    api: '<path d="m8 8-4 4 4 4M16 8l4 4-4 4M13.5 5l-3 14"/>',
    faq: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6V14M12 17.5h.01"/>',
    page: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    spark: '<path d="m3 17 6-6 4 4 8-8"/><path d="M14 7h7v7"/>',
    x: '<path d="M18 6 6 18M6 6l12 12"/>',
    enter: '<path d="M9 10 4 15l5 5"/><path d="M20 4v7a4 4 0 0 1-4 4H4"/>',
    gh: '<path d="M9 19c-4.3 1.4-4.3-2.5-6-3m12 5v-3.5c0-1 .1-1.4-.5-2 2.8-.3 5.5-1.4 5.5-6a4.6 4.6 0 0 0-1.3-3.2 4.2 4.2 0 0 0-.1-3.2s-1.1-.3-3.5 1.3a12.3 12.3 0 0 0-6.2 0C6.5 2.8 5.4 3.1 5.4 3.1a4.2 4.2 0 0 0-.1 3.2A4.6 4.6 0 0 0 4 9.5c0 4.6 2.7 5.7 5.5 6-.6.6-.6 1.2-.5 2V21"/>',
    book: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5z"/><path d="M4 19.5A2.5 2.5 0 0 0 6.5 22H20v-5"/>',
    arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    adr: '<circle cx="6" cy="6" r="2.5"/><circle cx="6" cy="18" r="2.5"/><circle cx="18" cy="12" r="2.5"/><path d="M6 8.5v7M8.3 7l7.4 3.8M8.3 17l7.4-3.8"/>',
  };
  var KIND_ICON = { doc: "doc", config: "cog", api: "api", adr: "adr", faq: "faq", page: "page" };

  function url(path) { return BASE + path; }

  // ---- index loading (lazy, cached, prefetch on intent)
  var enginePromise = null, engineReady = null;
  function loadEngine() {
    if (enginePromise) return enginePromise;
    var src = html.getAttribute("data-search-index");
    if (!src) return Promise.reject(new Error("no index"));
    enginePromise = fetch(src, { credentials: "same-origin" })
      .then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
      .then(function (data) { engineReady = createEngine(data); return engineReady; });
    enginePromise.catch(function () { enginePromise = null; });
    return enginePromise;
  }

  // ---- recents (localStorage, always guarded)
  function getRecent() {
    try { var v = JSON.parse(localStorage.getItem(RECENT_KEY) || "[]"); return Array.isArray(v) ? v.filter(function (x) { return typeof x === "string"; }).slice(0, 6) : []; } catch (e) { return []; }
  }
  function saveRecent(q) {
    q = String(q || "").trim();
    if (q.length < 2) return;
    try {
      var list = getRecent().filter(function (x) { return x.toLowerCase() !== q.toLowerCase(); });
      list.unshift(q);
      localStorage.setItem(RECENT_KEY, JSON.stringify(list.slice(0, 6)));
    } catch (e) { /* storage unavailable */ }
  }
  function clearRecent() { try { localStorage.removeItem(RECENT_KEY); } catch (e) { /* noop */ } }

  // ---- the shared results controller (palette and /search/ page)
  var uid = 0;
  function Controller(o) {
    var self = this;
    var id = "sx" + (++uid);
    this.o = o; this.id = id; this.filter = "all"; this.active = -1; this.options = []; this.res = null; this.query = "";
    var input = o.input, list = o.list;
    list.id = id + "-list";
    list.setAttribute("role", "listbox"); // set here (not in static HTML) since JS fills it
    if (!list.hasAttribute("aria-label")) list.setAttribute("aria-label", list.getAttribute("data-label") || "Search results");
    input.setAttribute("aria-controls", list.id);

    // chips
    o.chips.innerHTML = CHIPS.map(function (c) {
      return '<button type="button" class="sx-chip" role="radio" aria-checked="' + (c[0] === "all") + '" data-filter="' + c[0] + '"' + (o.page ? "" : ' tabindex="-1"') + ">" +
        esc(c[1]) + '<span class="sx-chip-n" data-n="' + c[0] + '"></span></button>';
    }).join("");
    o.chips.addEventListener("click", function (e) {
      var b = e.target.closest("[data-filter]");
      if (!b) return;
      self.setFilter(b.getAttribute("data-filter"));
      if (!o.page) input.focus();
    });

    input.addEventListener("input", function () { self.run(); });
    input.addEventListener("keydown", function (e) { self.key(e); });
    list.addEventListener("click", function (e) {
      var clr = e.target.closest("[data-clear-recent]");
      if (clr) { e.preventDefault(); clearRecent(); self.run(); input.focus(); return; }
      var opt = e.target.closest("[role=option]");
      if (!opt) return;
      var nt = e.metaKey || e.ctrlKey || e.shiftKey || e.button === 1;
      if (opt.hasAttribute("data-q")) { e.preventDefault(); self.setQuery(opt.getAttribute("data-q")); return; }
      if (nt) { saveRecent(self.query); return; } // let the browser open it
      e.preventDefault();
      self.activate(opt, false);
    });
    list.addEventListener("auxclick", function (e) {
      var opt = e.target.closest("[role=option][href]");
      if (opt && e.button === 1) saveRecent(self.query);
    });
    list.addEventListener("pointermove", function (e) {
      var opt = e.target.closest("[role=option]");
      if (!opt) return;
      var i = self.options.indexOf(opt);
      if (i !== -1 && i !== self.active) self.setActive(i, false);
    });
  }

  Controller.prototype.setQuery = function (q) {
    this.o.input.value = q;
    this.run();
    this.o.input.focus();
  };

  Controller.prototype.setFilter = function (f) {
    if (!FILTERS.hasOwnProperty(f)) return;
    this.filter = f;
    var bs = this.o.chips.querySelectorAll("[data-filter]");
    for (var i = 0; i < bs.length; i++) bs[i].setAttribute("aria-checked", String(bs[i].getAttribute("data-filter") === f));
    this.run();
    if (this.res) this.announce(CHIPS.filter(function (c) { return c[0] === f; })[0][1] + " filter, " + this.res.total + " results");
  };

  Controller.prototype.announce = function (msg) {
    var live = this.o.live;
    if (!live) return;
    clearTimeout(this.liveT);
    this.liveT = setTimeout(function () { live.textContent = msg; }, 350);
  };

  Controller.prototype.run = function () {
    var self = this, q = this.o.input.value;
    this.query = q;
    if (this.o.onQuery) this.o.onQuery(q);
    if (this.o.clear) this.o.clear.hidden = !q;
    if (!q.trim()) { this.renderEmpty(); return; }
    if (!engineReady) {
      this.renderMsg('<div class="sx-loading"><span class="sx-spin" aria-hidden="true"></span>Loading the search index…</div>');
      loadEngine().then(function () { if (self.o.input.value === q) self.run(); }, function () {
        self.renderMsg('<div class="sx-msg"><p>The search index could not be loaded.</p><p><a class="sx-link" href="' + esc(url("/docs/")) + '">Browse the documentation</a></p></div>');
      });
      return;
    }
    var page = !!this.o.page;
    var res = engineReady.search(q, { filter: this.filter, groups: page ? 30 : 8, perGroup: page ? 8 : 4 });
    this.res = res;
    this.render(res);
  };

  Controller.prototype.updateCounts = function (counts) {
    var ns = this.o.chips.querySelectorAll("[data-n]");
    for (var i = 0; i < ns.length; i++) {
      var n = counts ? counts[ns[i].getAttribute("data-n")] : null;
      ns[i].textContent = n == null ? "" : n > 99 ? "99+" : String(n);
    }
    this.o.chips.classList.toggle("sx-chips-off", !counts);
  };

  Controller.prototype.renderMsg = function (h) {
    this.o.list.innerHTML = h;
    this.options = []; this.active = -1;
    this.o.input.setAttribute("aria-expanded", "false");
    this.o.input.removeAttribute("aria-activedescendant");
    this.updateCounts(null);
    if (this.o.meta) this.o.meta.textContent = "";
  };

  Controller.prototype.renderEmpty = function () {
    var id = this.id, n = 0, h = "";
    var recent = getRecent();
    var opt = function (q, icon, label, extra) {
      return '<a class="sx-item sx-item-mini" role="option" id="' + id + "-o" + (n++) + '" tabindex="-1" aria-selected="false" href="' + esc(url("/search/?q=" + encodeURIComponent(q))) + '" data-q="' + esc(q) + '">' +
        '<span class="sx-ico">' + svg(I[icon]) + '</span><span class="sx-main"><span class="sx-title">' + esc(label) + "</span></span>" + (extra || "") +
        '<span class="sx-go" aria-hidden="true">' + svg(I.arrow) + "</span></a>";
    };
    if (recent.length) {
      h += '<div class="sx-group" role="group" aria-labelledby="' + id + '-rh"><div class="sx-ghead" id="' + id + '-rh" role="presentation"><span>Recent searches</span>' +
        '<button type="button" class="sx-clear-recent" data-clear-recent>Clear</button></div>' +
        recent.map(function (q) { return opt(q, "clock", q); }).join("") + "</div>";
    }
    h += '<div class="sx-group" role="group" aria-labelledby="' + id + '-ph"><div class="sx-ghead" id="' + id + '-ph" role="presentation"><span>Popular</span></div>' +
      '<div class="sx-pop">' + POPULAR.map(function (p) { return opt(p[1], "spark", p[0]); }).join("") + "</div></div>";
    h += '<p class="sx-tip">Tip: search environment variables like <code>APP_SECRET_KEY</code>, MCP tools like <code>set_records</code> or endpoints like <code>POST /api/mcp</code>.</p>';
    this.o.list.innerHTML = h;
    this.collect();
    this.updateCounts(null);
    if (this.o.meta) this.o.meta.textContent = "";
    this.res = null;
  };

  Controller.prototype.render = function (res) {
    var id = this.id, n = 0, h = "", page = !!this.o.page, q = this.query;
    var snipW = page ? 240 : 132;
    this.updateCounts(res.counts);
    if (!res.groups.length) {
      var sug = engineReady.suggest(q);
      var other = this.filter !== "all" && res.counts.all > 0;
      h = '<div class="sx-none"><div class="sx-none-art" aria-hidden="true">' + svg(I.search) + "</div>" +
        '<p class="sx-none-t">No results for “<strong>' + esc(q.trim()) + "</strong>”" + (other ? " in " + esc(CHIPS.filter(function (c) { return c[0] === this.filter; }, this)[0][1]) : "") + "</p>" +
        (sug ? '<p class="sx-none-s">Did you mean <a href="' + esc(url("/search/?q=" + encodeURIComponent(sug))) + '" data-q="' + esc(sug) + '" role="option" id="' + id + "-o" + (n++) + '" tabindex="-1" aria-selected="false" class="sx-sug">' + esc(sug) + "</a>?</p>" : "") +
        (other ? '<p class="sx-none-s">' + res.counts.all + " result" + (res.counts.all === 1 ? "" : "s") + " in other categories. Press <kbd>Tab</kbd> or pick <em>All</em>.</p>" : "") +
        "</div>" +
        '<div class="sx-group" role="group" aria-label="Other places to look">' +
        '<a class="sx-item sx-item-mini" role="option" id="' + id + "-o" + (n++) + '" tabindex="-1" aria-selected="false" href="' + esc(ISSUES + encodeURIComponent(q.trim())) + '" rel="noopener">' +
        '<span class="sx-ico">' + svg(I.gh) + '</span><span class="sx-main"><span class="sx-title">Search GitHub issues for “' + esc(q.trim()) + '”</span><span class="sx-path">github.com/PowerDNS-AuthAdmin/powerdns-authadmin</span></span><span class="sx-go" aria-hidden="true">' + svg(I.arrow) + "</span></a>" +
        '<a class="sx-item sx-item-mini" role="option" id="' + id + "-o" + (n++) + '" tabindex="-1" aria-selected="false" href="' + esc(url("/docs/")) + '">' +
        '<span class="sx-ico">' + svg(I.book) + '</span><span class="sx-main"><span class="sx-title">Browse the documentation index</span><span class="sx-path">All guides and references</span></span><span class="sx-go" aria-hidden="true">' + svg(I.arrow) + "</span></a></div>";
      this.o.list.innerHTML = h;
      this.collect();
      this.announce("No results");
      if (this.o.meta) this.o.meta.textContent = "0 results";
      return;
    }
    for (var g = 0; g < res.groups.length; g++) {
      var grp = res.groups[g], head = grp.head.rec, gid = id + "-g" + g;
      var top = res.hits[0] && res.hits[0].rec;
      var headSnip = !grp.head.header && !grp.head.fuzzy ? snippet(head.content || head.desc, res, snipW) : "";
      if (!headSnip && (page || !grp.items.length)) headSnip = esc(clip(head.desc || head.content, snipW));
      h += '<div class="sx-group" role="group" aria-labelledby="' + gid + '">';
      h += '<a class="sx-item sx-item-page" role="option" id="' + id + "-o" + (n++) + '" tabindex="-1" aria-selected="false"' + (head === top ? " data-top" : "") + ' href="' + esc(url(head.url)) + '">' +
        '<span class="sx-ico sx-ico-' + head.kind + '">' + svg(I[KIND_ICON[head.pageKind] || "doc"]) + "</span>" +
        '<span class="sx-main"><span class="sx-title" id="' + gid + '">' + highlight(head.title, res) + "</span>" +
        '<span class="sx-path">' + esc(head.section) + "</span>" +
        (headSnip ? '<span class="sx-snip">' + headSnip + "</span>" : "") + "</span>" +
        '<span class="sx-badge sx-badge-' + head.pageKind + '">' + KIND_LABEL[head.pageKind] + "</span>" +
        '<span class="sx-go" aria-hidden="true">' + svg(I.enter) + "</span></a>";
      for (var k = 0; k < grp.items.length; k++) {
        var it = grp.items[k], r = it.rec, lastItem = k === grp.items.length - 1;
        var sn = it.fuzzy ? esc(clip(r.content, snipW)) : snippet(r.content, res, snipW);
        h += '<a class="sx-item sx-item-sec' + (lastItem ? " sx-last" : "") + (r.level === 3 ? " sx-h3" : "") + '" role="option" id="' + id + "-o" + (n++) + '" tabindex="-1" aria-selected="false"' + (r === top ? " data-top" : "") + ' href="' + esc(url(r.url)) + '">' +
          '<span class="sx-tree" aria-hidden="true"></span>' +
          '<span class="sx-ico sx-ico-sm">' + svg(I.hash) + "</span>" +
          '<span class="sx-main"><span class="sx-title">' +
          (r.parentHeading ? '<span class="sx-crumb">' + esc(r.parentHeading) + ' <span aria-hidden="true">›</span> </span>' : "") +
          highlight(r.heading, res) + "</span>" +
          (sn ? '<span class="sx-snip">' + sn + "</span>" : "") + "</span>" +
          (r.kind !== head.pageKind ? '<span class="sx-badge sx-badge-' + r.kind + '">' + KIND_LABEL[r.kind] + "</span>" : "") +
          '<span class="sx-go" aria-hidden="true">' + svg(I.enter) + "</span></a>";
      }
      if (grp.more) h += '<div class="sx-more" role="presentation">+' + grp.more + " more in this page</div>";
      h += "</div>";
    }
    if (res.relaxed) h = '<p class="sx-note">No page matches every word; showing the closest matches.</p>' + h;
    this.o.list.innerHTML = h;
    this.collect();
    var msg = res.total + " result" + (res.total === 1 ? "" : "s");
    this.announce(msg);
    if (this.o.meta) this.o.meta.textContent = msg + " · " + (res.ms < 1 ? res.ms.toFixed(2) : res.ms.toFixed(1)) + " ms";
  };

  function clip(s, w) {
    s = String(s || "");
    if (s.length <= w) return s;
    var c = s.lastIndexOf(" ", w);
    return s.slice(0, c > w * 0.6 ? c : w) + "…";
  }

  Controller.prototype.collect = function () {
    this.options = Array.prototype.slice.call(this.o.list.querySelectorAll("[role=option]"));
    this.o.input.setAttribute("aria-expanded", String(this.options.length > 0));
    this.active = -1;
    if (this.options.length && (this.query.trim() || !this.o.page)) {
      var topEl = this.o.list.querySelector("[data-top]");
      var ti = topEl ? this.options.indexOf(topEl) : 0;
      this.setActive(this.query.trim() ? ti : -1, ti > 2);
      if (ti <= 2 && this.o.scroller) this.o.scroller.scrollTop = 0;
    } else if (this.o.scroller) this.o.scroller.scrollTop = 0;
    else this.o.input.removeAttribute("aria-activedescendant");
  };

  Controller.prototype.setActive = function (i, scroll) {
    var opts = this.options;
    if (this.active >= 0 && opts[this.active]) { opts[this.active].setAttribute("aria-selected", "false"); }
    this.active = i;
    if (i < 0 || !opts[i]) { this.o.input.removeAttribute("aria-activedescendant"); return; }
    opts[i].setAttribute("aria-selected", "true");
    this.o.input.setAttribute("aria-activedescendant", opts[i].id);
    if (scroll) {
      if (i === 0 && this.o.scroller) this.o.scroller.scrollTop = 0;
      else opts[i].scrollIntoView({ block: "nearest" });
    }
  };

  Controller.prototype.key = function (e) {
    var n = this.options.length, k = e.key;
    if (e.isComposing) return;
    if (k === "ArrowDown" || k === "ArrowUp") {
      if (!n) return;
      e.preventDefault();
      var d = k === "ArrowDown" ? 1 : -1;
      this.setActive(this.active < 0 ? (d > 0 ? 0 : n - 1) : (this.active + d + n) % n, true);
    } else if ((k === "Home" || k === "End") && n && this.res) {
      e.preventDefault();
      this.setActive(k === "Home" ? 0 : n - 1, true);
    } else if (k === "Enter") {
      if (this.active < 0 || !this.options[this.active]) {
        if (this.o.page && this.query.trim()) saveRecent(this.query);
        return;
      }
      e.preventDefault();
      this.activate(this.options[this.active], e.metaKey || e.ctrlKey);
    } else if (k === "Tab" && !this.o.page && this.res && !e.altKey && !e.ctrlKey && !e.metaKey) {
      e.preventDefault();
      var ix = 0;
      for (var c = 0; c < CHIPS.length; c++) if (CHIPS[c][0] === this.filter) ix = c;
      ix = (ix + (e.shiftKey ? -1 : 1) + CHIPS.length) % CHIPS.length;
      this.setFilter(CHIPS[ix][0]);
    }
  };

  Controller.prototype.activate = function (opt, newTab) {
    if (opt.hasAttribute("data-q")) { this.setQuery(opt.getAttribute("data-q")); return; }
    var href = opt.getAttribute("href");
    if (!href) return;
    saveRecent(this.query);
    if (newTab) { window.open(href, "_blank", "noopener"); return; }
    if (this.o.onNavigate) this.o.onNavigate();
    var dest;
    try { dest = new URL(href, location.href); } catch (e) { location.href = href; return; }
    if (dest.origin === location.origin && dest.pathname === location.pathname && dest.search === location.search) {
      if (!dest.hash) window.scrollTo({ top: 0, behavior: reduceMotion() ? "auto" : "smooth" });
      else if (dest.hash === location.hash) flash(dest.hash, true);
      else location.hash = dest.hash;
    } else {
      location.href = dest.href;
    }
  };

  // ---- the palette
  var dialog = null, ctl = null, opener = null, closing = false;

  function buildDialog() {
    dialog = doc.createElement("dialog");
    dialog.className = "sx";
    dialog.setAttribute("aria-label", "Search the PowerDNS-AuthAdmin docs and site");
    dialog.innerHTML =
      '<div class="sx-panel">' +
      '<div class="sx-bar">' + svg(I.search, "sx-svg sx-bar-ico") +
      '<input class="sx-input" type="text" role="combobox" aria-expanded="false" aria-autocomplete="list" aria-haspopup="listbox" aria-label="Search docs and site" ' +
      'placeholder="Search docs, env vars, MCP tools…" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" enterkeyhint="go" maxlength="120">' +
      '<button type="button" class="sx-x" aria-label="Clear search" hidden>' + svg(I.x) + "</button>" +
      '<button type="button" class="sx-close" aria-label="Close search"><kbd class="sx-esc">Esc</kbd><span class="sx-cancel">Cancel</span></button>' +
      "</div>" +
      '<div class="sx-chips" role="radiogroup" aria-label="Filter results"></div>' +
      '<div class="sx-body"><div class="sx-list" role="listbox" aria-label="Search results"></div></div>' +
      '<div class="sx-foot"><span class="sx-keys" aria-hidden="true">' +
      '<span><kbd>↑</kbd><kbd>↓</kbd> navigate</span><span><kbd>↵</kbd> open</span><span><kbd>' + MOD + "</kbd><kbd>↵</kbd> new tab</span>" +
      '<span><kbd>Tab</kbd> filter</span><span><kbd>Esc</kbd> close</span></span>' +
      '<span class="sx-meta"></span></div>' +
      '<div class="sx-sr" role="status" aria-live="polite"></div>' +
      "</div>";
    doc.body.appendChild(dialog);
    var input = dialog.querySelector(".sx-input");
    ctl = new Controller({
      input: input,
      list: dialog.querySelector(".sx-list"),
      scroller: dialog.querySelector(".sx-body"),
      chips: dialog.querySelector(".sx-chips"),
      meta: dialog.querySelector(".sx-meta"),
      live: dialog.querySelector(".sx-sr"),
      clear: dialog.querySelector(".sx-x"),
      page: false,
      onNavigate: function () { close(true); },
    });
    dialog.querySelector(".sx-x").addEventListener("click", function () { ctl.setQuery(""); });
    dialog.querySelector(".sx-close").addEventListener("click", function () { close(); });
    dialog.addEventListener("cancel", function (e) { e.preventDefault(); close(); });
    // backdrop click (the dialog element itself is the backdrop area)
    dialog.addEventListener("mousedown", function (e) { dialog._downOnBackdrop = e.target === dialog; });
    dialog.addEventListener("click", function (e) { if (e.target === dialog && dialog._downOnBackdrop) close(); });
    // focus trap (Tab in the input switches filters when results are shown)
    dialog.addEventListener("keydown", function (e) {
      if (e.key !== "Tab" || e.defaultPrevented) return;
      var f = Array.prototype.filter.call(dialog.querySelectorAll("input, button:not([hidden]):not([tabindex='-1']), a[href]:not([tabindex='-1'])"), function (el) { return el.offsetParent !== null || el === input; });
      if (!f.length) return;
      var first = f[0], last = f[f.length - 1];
      if (e.shiftKey && doc.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && doc.activeElement === last) { e.preventDefault(); first.focus(); }
    });
  }

  function open(prefill) {
    if (!dialog) buildDialog();
    loadEngine().catch(function () { /* handled when rendering */ });
    if (dialog.open && !closing) { ctl.o.input.focus(); ctl.o.input.select(); return; }
    closing = false;
    dialog.classList.remove("sx-closing");
    opener = doc.activeElement;
    html.classList.add("sx-lock");
    if (typeof prefill === "string") ctl.o.input.value = prefill;
    try { dialog.showModal(); } catch (e) { dialog.setAttribute("open", ""); }
    ctl.run();
    ctl.o.input.focus();
    ctl.o.input.select();
  }

  function close(navigating) {
    if (!dialog || !dialog.open || closing) return;
    var finish = function () {
      closing = false;
      dialog.classList.remove("sx-closing");
      try { dialog.close(); } catch (e) { dialog.removeAttribute("open"); }
      html.classList.remove("sx-lock");
      if (!navigating && opener && doc.contains(opener) && opener.focus) { try { opener.focus({ preventScroll: true }); } catch (e) { opener.focus(); } }
      opener = null;
    };
    if (navigating || reduceMotion()) { finish(); return; }
    closing = true;
    dialog.classList.add("sx-closing");
    var done = false, end = function () { if (done) return; done = true; finish(); };
    dialog.addEventListener("animationend", end, { once: true });
    setTimeout(end, 220);
  }

  // ---- triggers, shortcuts, prefetch
  function initTriggers() {
    var kbds = doc.querySelectorAll("[data-search-kbd]");
    for (var i = 0; i < kbds.length; i++) kbds[i].textContent = isApple ? "⌘K" : "Ctrl K";
    var trig = doc.querySelectorAll("[data-search-open]");
    for (i = 0; i < trig.length; i++) {
      trig[i].setAttribute("aria-haspopup", "dialog");
      trig[i].setAttribute("aria-keyshortcuts", isApple ? "Meta+K" : "Control+K");
      var al = trig[i].getAttribute("aria-label");
      if (al && isApple) trig[i].setAttribute("aria-label", al.replace(/\(Ctrl K\)/, "(⌘K)"));
    }
    doc.addEventListener("click", function (e) {
      var t = e.target.closest && e.target.closest("[data-search-open]");
      if (!t) return;
      e.preventDefault();
      open(t.getAttribute("data-search-query") || undefined);
    });
    var prefetch = function (e) {
      if (e.target.closest && e.target.closest("[data-search-open]")) loadEngine().catch(function () {});
    };
    doc.addEventListener("pointerover", prefetch, { passive: true });
    doc.addEventListener("focusin", prefetch);
    doc.addEventListener("touchstart", prefetch, { passive: true });
    doc.addEventListener("keydown", function (e) {
      var k = e.key;
      if ((k === "k" || k === "K") && (e.metaKey || e.ctrlKey) && !e.altKey && !e.shiftKey) {
        e.preventDefault();
        if (dialog && dialog.open && doc.activeElement === ctl.o.input) close(); else open();
        return;
      }
      if (k === "/" && !e.metaKey && !e.ctrlKey && !e.altKey && !(dialog && dialog.open)) {
        var t = e.target;
        if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
        e.preventDefault();
        open();
      }
    });
  }

  // ---- #anchor flash
  function flash(hash, scroll) {
    if (!hash || hash.length < 2) return;
    var el;
    try { el = doc.getElementById(decodeURIComponent(hash.slice(1))); } catch (e) { return; }
    if (!el) return;
    if (scroll) el.scrollIntoView({ block: "start", behavior: reduceMotion() ? "auto" : "smooth" });
    el.classList.remove("search-flash");
    void el.offsetWidth; // restart the animation
    el.classList.add("search-flash");
    clearTimeout(el._sxT);
    el._sxT = setTimeout(function () { el.classList.remove("search-flash"); }, 2200);
  }

  // ---- /search/ page mount
  function initPage() {
    var mount = doc.querySelector("[data-search-page]");
    if (!mount) return;
    var ui = mount.querySelector("[data-search-ui]");
    if (ui) ui.hidden = false;
    var input = mount.querySelector(".sx-input");
    var c = new Controller({
      input: input,
      list: mount.querySelector(".sx-list"),
      chips: mount.querySelector(".sx-chips"),
      meta: mount.querySelector(".sx-meta"),
      live: mount.querySelector(".sx-sr"),
      clear: mount.querySelector(".sx-x"),
      page: true,
      onQuery: function (q) {
        clearTimeout(c && c.urlT);
        if (!c) return;
        c.urlT = setTimeout(function () {
          try {
            var u = new URL(location.href);
            if (q.trim()) u.searchParams.set("q", q.trim()); else u.searchParams.delete("q");
            history.replaceState(history.state, "", u.pathname + u.search + u.hash);
            doc.title = (q.trim() ? q.trim() + " · " : "") + "Search · PowerDNS-AuthAdmin";
          } catch (e) { /* noop */ }
        }, 250);
      },
    });
    var clr = mount.querySelector(".sx-x");
    if (clr) clr.addEventListener("click", function () { c.setQuery(""); });
    var q = "";
    try { q = new URL(location.href).searchParams.get("q") || ""; } catch (e) { /* noop */ }
    input.value = q;
    loadEngine().then(function () { c.run(); }, function () { c.run(); });
    c.run();
    if (!q) input.focus();
  }

  function init() {
    initTriggers();
    initPage();
    if (location.hash) setTimeout(function () { flash(location.hash, false); }, 60);
    window.addEventListener("hashchange", function () { flash(location.hash, false); });
  }

  if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", init);
  else init();
})();
