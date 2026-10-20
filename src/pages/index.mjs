// Every core page on the site, in sitemap order. Docs pages come from
// src/docs/index.mjs and the search page from ./search.mjs (owned by the docs and
// search modules); scripts/build.mjs puts them together.
import home from "./home.mjs";
import features from "./features.mjs";
import alternative from "./alternative.mjs";
import faq from "./faq.mjs";
import support from "./support.mjs";
import notFound from "./not-found.mjs";
import searchPage from "./search.mjs";

export const corePages = [home, features, alternative, faq, support, notFound];
export { searchPage };
// Back-compat for tooling that still wants one flat list (build-media og cards).
export const pages = [...corePages, searchPage].filter(Boolean);
