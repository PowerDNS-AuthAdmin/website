// Docs fixes the site applies on top of the synced upstream docs, each one tracking an
// open issue on PowerDNS-AuthAdmin/powerdns-authadmin. Once upstream merges a fix, the
// docs build reports it as no longer needed (apply() returns the text unchanged); then
// delete the entry. An apply() that inserts text must first check the text is not there
// already, so an upstream fix that words it differently still makes the entry report as
// stale. New pages that upstream does not have yet live next to this file as <slug>.md.
//
// { issue, file (upstream path, e.g. "docs/02-INSTALLATION.md"), title, apply(markdown) -> markdown }

export default [
  {
    issue: 163,
    file: "docs/FEATURES.md",
    title: "Audit action table: two-cell delimiter row",
    // The delimiter row has four cells under a two-column header, so the table never renders.
    apply: (md) => md.replace(/^(\| -{3,} \| -{3,} \|) -{3,} \| -{3,} \|$/m, "$1"),
  },
  {
    issue: 163,
    file: "docs/FEATURES.md",
    title: "Mobile screenshots: one centred wrapper instead of nested <p align>",
    apply: (md) =>
      md.replace(
        /  &nbsp;\n  <p align="center">\n    <picture>\n    (<source[^\n]*\n)    (<img[^\n]*\n)    <\/picture>\n  <\/p>\n<\/p>/,
        "  &nbsp;\n  <picture>\n    $1    $2  </picture>\n</p>",
      ),
  },
];
