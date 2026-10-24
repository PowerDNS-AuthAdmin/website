/* PowerDNS-AuthAdmin docs: mobile sidebar panel, remembered nav groups, TOC scrollspy,
   copy buttons on code blocks. Progressive enhancement only: every docs page is fully
   readable and navigable without this file. */
(function () {
  "use strict";
  var d = document;
  var root = d.documentElement;
  var shell = d.querySelector("[data-docs]");
  if (!shell) return;
  var $ = function (s, c) { return (c || d).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || d).querySelectorAll(s)); };
  var store = {
    get: function (k) { try { return JSON.parse(localStorage.getItem(k) || "null"); } catch (e) { return null; } },
    set: function (k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  };
  var reduceMotion = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- Sidebar panel (mobile) ---------- */
  // Below 1081px the header's menu button (data-docs-menu) opens the docs sidebar
  // as a full-height panel under the header, in place of the site's mobile menu.
  var sidebar = $("#docs-sidebar");
  var menuBtn = $("[data-docs-menu]");
  var desktop = window.matchMedia ? matchMedia("(min-width: 1081px)") : { matches: true };

  function isOpen() { return shell.classList.contains("is-drawer-open"); }
  function setDrawer(open) {
    if (open && desktop.matches) return;
    shell.classList.toggle("is-drawer-open", open);
    d.body.classList.toggle("menu-open", open);
    menuBtn.setAttribute("aria-expanded", String(open));
    menuBtn.setAttribute("aria-label", open ? "Close docs menu" : "Open docs menu");
    if (open) scrollCurrentIntoView();
  }
  if (menuBtn && sidebar) {
    menuBtn.setAttribute("aria-label", "Open docs menu");
    menuBtn.addEventListener("click", function () { setDrawer(!isOpen()); });
    sidebar.addEventListener("click", function (e) {
      if (isOpen() && e.target.closest && e.target.closest("a[href]")) setDrawer(false);
    });
    d.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && isOpen()) { setDrawer(false); menuBtn.focus(); }
    });
    // The search trigger opens a dialog: close the panel first.
    d.addEventListener("click", function (e) {
      if (isOpen() && e.target.closest && e.target.closest("[data-search-open]")) setDrawer(false);
    }, true);
    var onMq = function () { if (desktop.matches) setDrawer(false); };
    if (desktop.addEventListener) desktop.addEventListener("change", onMq);
    else if (desktop.addListener) desktop.addListener(onMq);
  }

  /* ---------- Nav groups: remember open/closed ---------- */
  var KEY = "pda-docs-nav";
  var state = store.get(KEY) || {};
  $$(".docs-nav-group").forEach(function (g) {
    var id = g.getAttribute("data-group");
    if (g.classList.contains("has-current")) g.open = true;
    else if (state[id] === false) g.open = false;
    g.addEventListener("toggle", function () {
      state[id] = g.open;
      store.set(KEY, state);
    });
  });

  /* ---------- Keep the current page visible in the sidebar ---------- */
  function scrollCurrentIntoView() {
    var box = $(".docs-sidebar-scroll");
    var cur = box && $('.docs-nav a[aria-current="page"]', box);
    if (!box || !cur) return;
    var b = box.getBoundingClientRect(), c = cur.getBoundingClientRect();
    if (c.top < b.top + 40 || c.bottom > b.bottom - 40) {
      box.scrollTop += c.top - b.top - b.height / 2 + c.height / 2;
    }
  }
  scrollCurrentIntoView();

  /* ---------- TOC scrollspy ---------- */
  var tocLinks = $$("[data-toc]");
  var content = $(".doc-content");
  if (tocLinks.length && content && "IntersectionObserver" in window) {
    var byId = {};
    tocLinks.forEach(function (a) { (byId[a.getAttribute("data-toc")] = byId[a.getAttribute("data-toc")] || []).push(a); });
    var heads = $$("h2[id], h3[id]", content).filter(function (h) { return byId[h.id]; });
    var tocBox = $(".docs-toc nav");
    var active = null;
    var offset = function () {
      var hh = parseFloat(getComputedStyle(root).getPropertyValue("--header-h")) || 64;
      return hh + 24;
    };
    var setActive = function (id) {
      if (id === active) return;
      active = id;
      tocLinks.forEach(function (a) {
        var on = a.getAttribute("data-toc") === id;
        a.classList.toggle("is-active", on);
        if (on) a.setAttribute("aria-current", "location"); else a.removeAttribute("aria-current");
      });
      // Highlight the parent h2 of an active h3 too.
      $$(".docs-toc li.is-parent, .docs-toc-mobile li.is-parent").forEach(function (li) { li.classList.remove("is-parent"); });
      (byId[id] || []).forEach(function (a) {
        var li = a.parentNode && a.parentNode.parentNode && a.parentNode.parentNode.closest && a.parentNode.parentNode.closest("li");
        if (li) li.classList.add("is-parent");
      });
      if (tocBox) {
        var link = $('[data-toc="' + (window.CSS && CSS.escape ? CSS.escape(id) : id) + '"]', tocBox);
        if (link) {
          var b = tocBox.getBoundingClientRect(), r = link.getBoundingClientRect();
          if (r.top < b.top || r.bottom > b.bottom) tocBox.scrollTop += r.top - b.top - b.height / 3;
        }
      }
    };
    var compute = function () {
      var line = offset();
      var cur = null;
      for (var i = 0; i < heads.length; i++) {
        if (heads[i].getBoundingClientRect().top - line <= 1) cur = heads[i].id; else break;
      }
      // At the very bottom, the last heading wins.
      if (window.innerHeight + window.scrollY >= d.documentElement.scrollHeight - 2 && heads.length) cur = heads[heads.length - 1].id;
      setActive(cur || (heads[0] && heads[0].id));
    };
    var ticking = false;
    var io = new IntersectionObserver(function () {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(function () { ticking = false; compute(); });
    }, { rootMargin: "-" + offset() + "px 0px -55% 0px", threshold: [0, 1] });
    heads.forEach(function (h) { io.observe(h); });
    window.addEventListener("scroll", function () {
      // Cheap fallback for long gaps between headings (IO only fires on crossings).
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(function () { ticking = false; compute(); });
    }, { passive: true });
    compute();
  }

  /* ---------- Compact TOC: close after choosing a section ---------- */
  var mtoc = $(".docs-toc-mobile");
  if (mtoc) mtoc.addEventListener("click", function (e) {
    if (e.target.closest && e.target.closest("a[href^='#']")) mtoc.open = false;
  });

  /* ---------- Copy buttons on code blocks ---------- */
  function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(text).then(function () { return true; }, function () { return legacy(text); });
    return Promise.resolve(legacy(text));
  }
  function legacy(text) {
    var ta = d.createElement("textarea");
    ta.value = text; ta.setAttribute("readonly", ""); ta.style.position = "fixed"; ta.style.opacity = "0";
    d.body.appendChild(ta); ta.select();
    var ok = false;
    try { ok = d.execCommand("copy"); } catch (e) {}
    d.body.removeChild(ta);
    return ok;
  }
  // main.js binds its own handler to every [data-copy] but reads the text from the
  // home page's .terminal tabs; a docs code block has none. Handle .code-block buttons
  // here in the capture phase and stop the event so a click is never handled twice.
  d.addEventListener("click", function (e) {
      var btn = e.target.closest && e.target.closest(".code-block [data-copy]");
      if (!btn) return;
      e.stopPropagation();
      var pre = btn.closest(".code-block").querySelector("pre");
      var label = btn.querySelector(".copy-label");
      copyText(pre ? pre.innerText.replace(/\n$/, "") : "").then(function (ok) {
        btn.classList.toggle("copied", ok);
        if (label) label.textContent = ok ? "Copied" : "Press Ctrl+C";
        btn.setAttribute("aria-label", ok ? "Copied to clipboard" : "Copy failed");
        clearTimeout(btn._t);
        btn._t = setTimeout(function () {
          btn.classList.remove("copied");
          if (label) label.textContent = "Copy";
          btn.setAttribute("aria-label", "Copy code to clipboard");
        }, 1800);
      });
  }, true);

  /* ---------- Back to top without leaving a #main hash ---------- */
  var top = $("[data-docs-top]");
  if (top) top.addEventListener("click", function (e) {
    e.preventDefault();
    window.scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" });
    var main = $("#main");
    if (main) main.focus({ preventScroll: true });
  });
})();
