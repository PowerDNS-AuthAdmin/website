// PowerDNS-AuthAdmin website: small, dependency-free progressive enhancement.
// Every section is fully readable without this file.
(function () {
  "use strict";

  var root = document.documentElement;
  var $ = function (sel, ctx) { return (ctx || document).querySelector(sel); };
  var $$ = function (sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); };

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
  }
  function saved() { try { return localStorage.getItem("pda-theme"); } catch (e) { return null; } }

  applyTheme(root.dataset.theme === "light" ? "light" : "dark");
  if (themeBtn) {
    themeBtn.addEventListener("click", function () {
      var next = root.dataset.theme === "light" ? "dark" : "light";
      applyTheme(next);
      try { localStorage.setItem("pda-theme", next); } catch (e) {}
    });
  }
  // Follow the OS while the visitor hasn't picked a theme themselves.
  if (mq && mq.addEventListener) {
    mq.addEventListener("change", function (e) { if (!saved()) applyTheme(e.matches ? "light" : "dark"); });
  }

  /* ---------- Mobile menu ---------- */
  var menuBtn = $("#menuToggle");
  var menu = $("#mobileNav");
  function setMenu(open) {
    if (!menuBtn || !menu) return;
    menu.hidden = !open;
    menuBtn.setAttribute("aria-expanded", String(open));
    menuBtn.setAttribute("aria-label", open ? "Close menu" : "Open menu");
    document.body.classList.toggle("menu-open", open);
  }
  if (menuBtn && menu) {
    menuBtn.addEventListener("click", function () { setMenu(menu.hidden); });
    menu.addEventListener("click", function (e) { if (e.target.closest("a")) setMenu(false); });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && !menu.hidden) { setMenu(false); menuBtn.focus(); }
    });
    // Close if the viewport grows past the breakpoint (rotation, resize).
    var wide = window.matchMedia("(min-width: 1061px)");
    var onWide = function () { if (wide.matches) setMenu(false); };
    if (wide.addEventListener) wide.addEventListener("change", onWide);
  }

  /* ---------- Accessible tabs (roving tabindex, arrow keys) ---------- */
  function tabs(list, onSelect) {
    var items = $$('[role="tab"]', list);
    function select(tab, focus) {
      items.forEach(function (t) {
        var on = t === tab;
        t.setAttribute("aria-selected", String(on));
        t.tabIndex = on ? 0 : -1;
        var panel = document.getElementById(t.getAttribute("aria-controls"));
        if (panel) panel.toggleAttribute("data-inactive", !on);
      });
      if (focus) tab.focus();
      if (tab.scrollIntoView && list.scrollWidth > list.clientWidth) {
        tab.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "smooth" });
      }
      if (onSelect) onSelect(tab);
    }
    items.forEach(function (t, i) {
      t.addEventListener("click", function () { select(t); });
      t.addEventListener("keydown", function (e) {
        var n = null;
        if (e.key === "ArrowRight") n = items[(i + 1) % items.length];
        else if (e.key === "ArrowLeft") n = items[(i - 1 + items.length) % items.length];
        else if (e.key === "Home") n = items[0];
        else if (e.key === "End") n = items[items.length - 1];
        if (n) { e.preventDefault(); select(n, true); }
      });
    });
  }
  $$('[role="tablist"]').forEach(function (l) { tabs(l); });

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

  /* ---------- Copy code ---------- */
  $$("[data-copy]").forEach(function (btn) {
    var label = $(".copy-label", btn);
    btn.addEventListener("click", function () {
      var term = btn.closest(".terminal");
      var code = term && $(".terminal-pane:not([data-inactive]) code", term);
      var text = code ? code.getAttribute("data-plain") || code.textContent : "";
      var done = function (ok) {
        btn.classList.toggle("copied", ok);
        if (label) label.textContent = ok ? "Copied" : "Press ⌘/Ctrl+C";
        setTimeout(function () { btn.classList.remove("copied"); if (label) label.textContent = "Copy"; }, 1800);
      };
      if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(text).then(function () { done(true); }, function () { done(false); });
      } else {
        var ta = document.createElement("textarea");
        ta.value = text; ta.setAttribute("readonly", ""); ta.style.position = "fixed"; ta.style.opacity = "0";
        document.body.appendChild(ta); ta.select();
        var ok = false;
        try { ok = document.execCommand("copy"); } catch (e) {}
        document.body.removeChild(ta);
        done(ok);
      }
    });
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
      var fig = btn.closest("figure");
      var caption = fig && $("figcaption", fig);
      cap.textContent = caption ? caption.textContent : s.alt;
      img.alt = s.alt;
      img.classList.toggle("is-mobile", s.naturalHeight > s.naturalWidth || /mobile/.test(s.dataset.full));
      // Show the already-loaded image instantly, then swap in the full-size one.
      img.src = s.currentSrc || s.src;
      lb.classList.add("loading");
      var full = new Image();
      full.onload = full.onerror = function () {
        if (my !== token) return; // a later click won the race
        if (full.naturalWidth) img.src = full.src;
        lb.classList.remove("loading");
      };
      full.src = s.dataset.full;
      prev.hidden = next.hidden = list.length < 2;
    }
    function open(btn) {
      list = candidates(btn);
      lb.showModal();
      document.body.classList.add("lightbox-open");
      show(Math.max(0, list.indexOf(btn)));
    }
    function close() { lb.close(); }

    $$(".zoom").forEach(function (b) { b.addEventListener("click", function () { open(b); }); });
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
