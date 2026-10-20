// Commercial support from NGN (site.support): the home page's #support section and /support/.
import { site } from "./site.mjs";
import { icon, ngnLogo } from "./icons.mjs";

const sp = site.support;
export const supportLead = `PowerDNS-AuthAdmin is free and community built. For teams that need someone on call, ${sp.legalName} (${sp.name}), the Sydney IT company behind this website, offers commercial support.`;
export const chatLink = `<a href="${sp.contact}" data-cta="Support chat" rel="noopener">Have a chat with the team</a>`;
export const liveBadge = `<p class="live-badge"><span class="live-dot" aria-hidden="true"></span>24 hour commercial support available</p>`;
const supportPoints = [
  ["server", "PowerDNS and the network around it", "Deployment, upgrades and single sign-on, plus the network, cloud and Kubernetes infrastructure your DNS runs on."],
  ["activity", "Around the clock", `${sp.hours}, with monitoring running 24/7, so there is someone to call when a zone change goes wrong at 3am.`],
  ["globe", "Australian team, worldwide clients", "Over 20 years of network and infrastructure engineering, supporting clients worldwide from Sydney."],
];
const points = `<ul class="support-points">
        ${supportPoints.map(([i, t, d]) => `<li>${icon(i, 20)}<span><strong>${t}</strong>${d}</span></li>`).join("\n        ")}
      </ul>`;
const card = `
    <aside class="support-card" aria-label="Contact ${sp.name}">
      <a class="support-logo" href="${sp.url}" rel="noopener" aria-label="${sp.legalName} (${sp.name})">${ngnLogo(118, 42)}</a>
      <p>Talk to ${sp.name} about running PowerDNS-AuthAdmin in production.</p>
      <a class="btn btn-primary btn-lg" href="${sp.contact}" data-cta="Contact NGN" rel="noopener">${icon("chat", 18)}<span>Contact ${sp.name}</span></a>
      <ul class="support-contact">
        <li>${icon("phone", 16)}<a href="tel:${sp.phoneIntl.replace(/\s/g, "")}">${sp.phoneIntl.replace(/ /g, "&nbsp;")}</a><span class="support-note">international</span></li>
        <li>${icon("phone", 16)}<a href="tel:${sp.phone.replace(/\s/g, "")}">${sp.phone.replace(/ /g, "&nbsp;")}</a><span class="support-note">within Australia</span></li>
        <li>${icon("mail", 16)}<a href="mailto:${sp.email}">${sp.email}</a></li>
        <li>${icon("clock", 16)}<span>${sp.hours}</span></li>
      </ul>
    </aside>`;

// head: false drops the eyebrow, heading, badge and lead, for a page that has them in its hero.
export function supportBlock({ head = true } = {}) {
  return `
<section class="section section-alt"${head ? ' id="support" aria-labelledby="support-title"' : ' aria-label="Commercial support from NGN"'}>
  <div class="container support">
    <div class="support-text">${head ? `
      <p class="eyebrow">Commercial support</p>
      <h2 id="support-title">Running it somewhere that matters?</h2>
      ${liveBadge}
      <p class="support-lead">${supportLead} ${chatLink}.</p>` : ""}
      ${points}
    </div>${card}
  </div>
</section>`;
}
