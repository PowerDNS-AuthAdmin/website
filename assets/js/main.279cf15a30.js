// PowerDNS-AuthAdmin website: small, dependency-free progressive enhancement.
// Every page is fully readable without this file. Search (Cmd/Ctrl+K, "/") lives in
// search.js and the docs sidebar/TOC in docs.js; this file binds neither key and
// leaves the menu button alone on docs pages (see "Mobile menu").
(function () {
  "use strict";

  var root = document.documentElement;
  var $ = function (sel, ctx) { return (ctx || document).querySelector(sel); };
  var $$ = function (sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); };
  var KEY = "pda-theme";

  /* ---------- Theme ---------- */
  var themeBtn = $("#themeToggle");
  var themeMetas = $$('meta[name="theme-color"]');
  var mq = window.matchMedia ? window.matchMedia("(prefers-color-scheme: light)") : null;

  function applyTheme(theme) {
    root.dataset.theme = theme;
    themeMetas.forEach(function (m) {
      m.setAttribute("content", theme === "light" ? "#ffffff" : "#08090d");
      m.removeAttribute("media");
    });
    if (themeBtn) themeBtn.setAttribute("aria-label", theme === "light" ? "Switch to dark theme" : "Switch to light theme");
    // Other modules (search palette, docs) re-render theme-dependent bits on this.
    try { document.dispatchEvent(new CustomEvent("themechange", { detail: { theme: theme } })); } catch (e) {}
  }
  function saved() { try { return localStorage.getItem(KEY); } catch (e) { return null; } }

  applyTheme(root.dataset.theme === "light" ? "light" : "dark");
  if (themeBtn) {
    themeBtn.addEventListener("click", function () {
      var next = root.dataset.theme === "light" ? "dark" : "light";
      applyTheme(next);
      try { localStorage.setItem(KEY, next); } catch (e) {}
    });
  }
  // Follow the OS while the visitor hasn't picked a theme themselves.
  if (mq && mq.addEventListener) {
    mq.addEventListener("change", function (e) { if (!saved()) applyTheme(e.matches ? "light" : "dark"); });
  }

  /* ---------- Mobile menu ----------
     One header button. On docs pages it carries data-docs-menu and docs.js owns it
     (it opens #docs-sidebar as a drawer and sets aria-expanded/aria-label itself),
     so this block only binds the site menu when the button is not docs-flavoured. */
  var menuBtn = $("#menuToggle");
  var menu = $("#mobileNav");
  function setMenu(open) {
    if (!menuBtn || !menu) return;
    menu.hidden = !open;
    menuBtn.setAttribute("aria-expanded", String(open));
    menuBtn.setAttribute("aria-label", open ? "Close menu" : "Open menu");
    document.body.classList.toggle("menu-open", open);
  }
  if (menuBtn && menu && !menuBtn.hasAttribute("data-docs-menu")) {
    menuBtn.addEventListener("click", function () { setMenu(menu.hidden); });
    menu.addEventListener("click", function (e) { if (e.target.closest("a")) setMenu(false); });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && !menu.hidden) { setMenu(false); menuBtn.focus(); }
    });
    // Close if the viewport grows past the breakpoint (rotation, resize).
    var wide = window.matchMedia("(min-width: 1081px)");
    var onWide = function () { if (wide.matches) setMenu(false); };
    if (wide.addEventListener) wide.addEventListener("change", onWide);
    // The search trigger opens a dialog: close the menu first.
    document.addEventListener("click", function (e) { if (e.target.closest && e.target.closest("[data-search-open]")) setMenu(false); }, true);
  }

  /* ---------- Accessible tabs (roving tabindex, arrow keys) ----------
     Any [role="tablist"]; aria-orientation="vertical" swaps the arrow keys (both
     axes always work). Panels are hidden with [data-inactive]. */
  var tabApi = {};
  function tabs(list) {
    var items = $$('[role="tab"]', list);
    var vertical = list.getAttribute("aria-orientation") === "vertical";
    function select(tab, focus) {
      items.forEach(function (t) {
        var on = t === tab;
        t.setAttribute("aria-selected", String(on));
        t.tabIndex = on ? 0 : -1;
        var panel = document.getElementById(t.getAttribute("aria-controls"));
        if (panel) panel.toggleAttribute("data-inactive", !on);
      });
      if (focus) tab.focus();
      if (list.scrollWidth > list.clientWidth + 2 && tab.getBoundingClientRect) {
        var lr = list.getBoundingClientRect(), tr = tab.getBoundingClientRect();
        if (tr.left < lr.left || tr.right > lr.right) list.scrollLeft += tr.left - lr.left - 24;
      }
    }
    items.forEach(function (t, i) {
      if (t.id) tabApi[t.id] = function () { select(t); };
      t.addEventListener("click", function () { select(t); });
      t.addEventListener("keydown", function (e) {
        var n = null;
        var next = vertical ? "ArrowDown" : "ArrowRight", prev = vertical ? "ArrowUp" : "ArrowLeft";
        if (e.key === next || e.key === "ArrowRight" || e.key === "ArrowDown") n = items[(i + 1) % items.length];
        else if (e.key === prev || e.key === "ArrowLeft" || e.key === "ArrowUp") n = items[(i - 1 + items.length) % items.length];
        else if (e.key === "Home") n = items[0];
        else if (e.key === "End") n = items[items.length - 1];
        if (n) { e.preventDefault(); select(n, true); }
      });
    });
  }
  $$('[role="tablist"]').forEach(tabs);

  /* ---------- Showcase device switch ---------- */
  $$(".showcase").forEach(function (sc) {
    var btns = $$(".seg button", sc);
    btns.forEach(function (b) {
      b.addEventListener("click", function () {
        sc.dataset.device = b.dataset.view;
        btns.forEach(function (x) { x.setAttribute("aria-pressed", String(x === b)); });
      });
    });
  });

  /* ---------- Hash targets: a tab id selects its tab, a FAQ entry opens ---------- */
  function onHash() {
    var id = decodeURIComponent(location.hash.slice(1));
    if (!id) return;
    if (tabApi[id]) { tabApi[id](); return; }
    var el = document.getElementById(id);
    if (!el) return;
    var d = el.tagName === "DETAILS" ? el : el.closest("details");
    if (d && !d.open) d.open = true;
  }
  onHash();
  window.addEventListener("hashchange", onHash);

  /* ---------- Copy buttons: any button[data-copy] ----------
     Text source, in order: the attribute's own value; data-copy-target="#id"; the
     active tab pane in the enclosing .terminal; the nearest code block. A code
     element's data-plain (the un-highlighted source) wins over its textContent. */
  function copyText(btn) {
    var v = btn.getAttribute("data-copy");
    if (v) return v;
    var target = btn.getAttribute("data-copy-target");
    var el = target ? document.querySelector(target) : null;
    if (!el) {
      var scope = btn.closest(".terminal, [data-copy-scope], .code-block, figure") || btn.parentElement;
      el = scope && ($('[role="tabpanel"]:not([data-inactive]) code', scope) || $("pre code", scope) || $("pre", scope) || $("code", scope));
    }
    if (!el) return "";
    var code = el.matches && el.matches("pre") ? ($("code", el) || el) : el;
    return code.getAttribute("data-plain") || code.textContent || "";
  }
  function flash(btn, ok) {
    var label = $(".copy-label", btn);
    var original = label ? label.getAttribute("data-label") || label.textContent : null;
    if (label && !label.getAttribute("data-label")) label.setAttribute("data-label", original);
    btn.classList.toggle("copied", ok);
    btn.setAttribute("data-copied", ok ? "true" : "false");
    if (label) label.textContent = ok ? "Copied" : "Press ⌘/Ctrl+C";
    clearTimeout(btn._copyT);
    btn._copyT = setTimeout(function () {
      btn.classList.remove("copied");
      btn.removeAttribute("data-copied");
      if (label) label.textContent = original;
    }, 1800);
  }
  // Delegated, so docs.js can tell this page handles copy buttons and skip its own fallback.
  root.setAttribute("data-copy-ready", "main");
  document.addEventListener("click", function (e) {
    var btn = e.target.closest && e.target.closest("button[data-copy]");
    if (!btn) return;
    var text = copyText(btn).replace(/\s+$/, "");
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).then(function () { flash(btn, true); }, function () { flash(btn, false); });
    } else {
      var ta = document.createElement("textarea");
      ta.value = text; ta.setAttribute("readonly", ""); ta.className = "sr-only";
      document.body.appendChild(ta); ta.select();
      var ok = false;
      try { ok = document.execCommand("copy"); } catch (err) {}
      document.body.removeChild(ta);
      flash(btn, ok);
    }
  });

  /* ---------- FAQ: one open at a time where <details name> isn't supported ---------- */
  if (!("name" in HTMLDetailsElement.prototype)) {
    $$('details[name="faq"]').forEach(function (d, _, all) {
      d.addEventListener("toggle", function () {
        if (d.open) all.forEach(function (o) { if (o !== d) o.open = false; });
      });
    });
  }

  /* ---------- Lightbox ---------- */
  var lb = $("#lightbox");
  if (lb && typeof lb.showModal === "function") {
    var img = document.createElement("img"), cap = $("#lightboxCaption");
    img.className = "lightbox-img";
    img.alt = "";
    $("#lightboxFrame").prepend(img);
    var prev = $("#lightboxPrev"), next = $("#lightboxNext");
    var list = [], index = 0, token = 0;

    // The screenshot inside a zoom button that matches the current theme.
    function visibleShot(btn) {
      return $(".shot-" + (root.dataset.theme === "light" ? "light" : "dark"), btn) || $(".shot", btn);
    }
    // Opened from the showcase: step through its screens for the current device.
    // Anywhere else: step through the zoomable screenshots visible on the page.
    function candidates(btn) {
      var sc = btn.closest(".showcase");
      if (sc) return $$(".view-" + sc.dataset.device + " .zoom", sc);
      return $$(".zoom").filter(function (b) { return b.offsetParent !== null && !b.closest(".showcase"); });
    }
    function show(i) {
      index = (i + list.length) % list.length;
      var btn = list[index], s = visibleShot(btn), my = ++token;
      if (!s || s.tagName !== "IMG") return; // a placeholder for a missing screenshot
      var fig = btn.closest("figure");
      var caption = fig && $("figcaption", fig);
      var full = s.getAttribute("data-full") || "";
      cap.textContent = caption ? caption.textContent : s.alt;
      img.alt = s.alt;
      img.classList.toggle("is-mobile", s.naturalHeight > s.naturalWidth || /mobile/.test(full));
      // Show the already-loaded image instantly, then swap in the full-size one.
      img.src = s.currentSrc || s.src;
      lb.classList.add("loading");
      var big = new Image();
      big.onload = big.onerror = function () {
        if (my !== token) return; // a later click won the race
        if (big.naturalWidth) img.src = big.src;
        lb.classList.remove("loading");
      };
      big.src = full || s.currentSrc || s.src;
      prev.hidden = next.hidden = list.length < 2;
    }
    function open(btn) {
      list = candidates(btn);
      if (list.indexOf(btn) === -1) list = [btn];
      lb.showModal();
      document.body.classList.add("lightbox-open");
      show(Math.max(0, list.indexOf(btn)));
    }
    function close() { lb.close(); }

    document.addEventListener("click", function (e) {
      var b = e.target.closest && e.target.closest(".zoom");
      if (b) open(b);
    });
    lb.addEventListener("close", function () {
      document.body.classList.remove("lightbox-open");
      img.removeAttribute("src");
      token++;
    });
    $("#lightboxClose").addEventListener("click", close);
    prev.addEventListener("click", function () { show(index - 1); });
    next.addEventListener("click", function () { show(index + 1); });
    lb.addEventListener("click", function (e) {
      if (e.target === lb || e.target.classList.contains("lightbox-frame") || e.target === img) close();
    });
    lb.addEventListener("keydown", function (e) {
      if (e.key === "ArrowRight") { e.preventDefault(); show(index + 1); }
      else if (e.key === "ArrowLeft") { e.preventDefault(); show(index - 1); }
    });
    // Swipe on touch screens.
    var x0 = null;
    lb.addEventListener("touchstart", function (e) { x0 = e.touches[0].clientX; }, { passive: true });
    lb.addEventListener("touchend", function (e) {
      if (x0 === null) return;
      var dx = e.changedTouches[0].clientX - x0;
      x0 = null;
      if (Math.abs(dx) > 50) show(index + (dx < 0 ? 1 : -1));
    });
  }
})();
