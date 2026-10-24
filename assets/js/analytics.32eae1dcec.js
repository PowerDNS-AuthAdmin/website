/* GA4 events, named the same on every managed site so reports compare
 * across them. Page views, scrolls, outbound links, downloads and site search
 * come from GA4's enhanced measurement; this adds the actions that matter:
 *
 *   phone_call     a tel: link tapped                          (key event)
 *   email_click    a mailto: link tapped                       (key event)
 *   generate_lead  a form sent successfully: the site calls     (key event)
 *                  window.trackLead('form name') on success, or the page is
 *                  a thank-you page (data-track-lead on <body>)
 *   booking_click  a link to an online booking system
 *   cta_click      any other button-styled link or [data-cta] element
 *
 * Every event carries cta_location (header, nav, hero, mobile_bar, footer or
 * body), cta_text and link_url; leads carry form_name and lead_method. These
 * are registered as custom dimensions in each GA4 property.
 *
 * Loaded deferred, after the gtag config (inline or from data-ga4 on this
 * script tag); does nothing when GA is absent. No inline handlers, so it is
 * CSP-safe. */
(function () {
    'use strict';
    var me = document.currentScript;
    var id = me && me.getAttribute('data-ga4');
    if (id && !window.gtag) {
        window.dataLayer = window.dataLayer || [];
        window.gtag = function () { window.dataLayer.push(arguments); };
        window.gtag('js', new Date());
        window.gtag('config', id);
        var s = document.createElement('script');
        s.async = true;
        s.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(id);
        document.head.appendChild(s);
    }
    function send(name, params) { if (window.gtag) { window.gtag('event', name, params || {}); } }

    var BOOKING = /servicem8\.com|calendly\.com|book(ing)?s?\.|setmore|square\.site|acuityscheduling|cal\.com/i;

    function where(el) {
        if (el.closest('[data-cta-location]')) { return el.closest('[data-cta-location]').getAttribute('data-cta-location'); }
        if (el.closest('.mobile-bar, .mobile-cta, .call-bar, [class*="mobile-bar"], [class*="sticky-cta"]')) { return 'mobile_bar'; }
        if (el.closest('nav, .nav, [class*="nav-"], [role="navigation"]')) { return 'nav'; }
        /* Before header: a page hero is often a <header> element itself. */
        if (el.closest('[class*="hero"]')) { return 'hero'; }
        if (el.closest('header, .site-header')) { return 'header'; }
        if (el.closest('footer, .site-footer')) { return 'footer'; }
        return 'body';
    }
    function label(el) {
        var t = el.getAttribute('data-cta') || el.getAttribute('aria-label') || el.textContent || '';
        return t.replace(/\s+/g, ' ').trim().slice(0, 100);
    }

    document.addEventListener('click', function (e) {
        var a = e.target.closest && e.target.closest('a[href], button[data-cta], [data-cta]');
        if (!a) { return; }
        var href = a.getAttribute('href') || '';
        var p = { cta_location: where(a), cta_text: label(a), link_url: href.slice(0, 200) };
        if (/^tel:/i.test(href)) { p.lead_method = 'phone'; send('phone_call', p); return; }
        if (/^mailto:/i.test(href)) { p.lead_method = 'email'; send('email_click', p); return; }
        if (BOOKING.test(href)) { p.lead_method = 'booking'; send('booking_click', p); return; }
        if (a.hasAttribute('data-cta') || /\b(btn|button|cta)\b/i.test(a.className || '')) { send('cta_click', p); }
    }, true);

    /* Sites call this from their form handler once the server says it went. */
    window.trackLead = function (formName, method) {
        send('generate_lead', { form_name: formName || 'contact', lead_method: method || 'contact_form', page_path: location.pathname });
    };
    var lead = document.body && document.body.getAttribute('data-track-lead');
    if (lead) { window.trackLead(lead); }
}());
