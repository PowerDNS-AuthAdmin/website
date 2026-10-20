#!/bin/sh
# Check the live site serves the build in dist/: every page in the sitemap, the files that
# are not pages, and a miss that must 404. Used by scripts/deploy.sh (after rsync) and by
# .github/workflows/deploy.yml (once the host has pulled the site branch).
#   DIST   build directory (default dist); its robots.txt names the live origin.
set -eu

cd "$(dirname "$0")/.."
DIST="${DIST:-dist}"
[ -f "$DIST/sitemap.xml" ] || { echo "$DIST/sitemap.xml is missing: build first" >&2; exit 1; }

# The live origin comes from the build itself (robots.txt names the sitemap), so the test
# always checks the URLs this build was made for.
url=$(sed -n 's|^Sitemap: \(.*\)/sitemap\.xml$|\1|p' "$DIST/robots.txt" | head -n 1)
[ -n "$url" ] || url=$(node -e 'import("./src/site.mjs").then(m => console.log(m.site.url))')

echo "→ smoke test ${url}"
failed=0
expect() { # expect <status> <url>
  code=$(curl -sS -o /dev/null -w '%{http_code}' --max-time 30 "$2") || code=000
  printf '  %s %s\n' "$code" "$2"
  [ "$code" = "$1" ] || failed=1
}
# A for loop rather than `while read`: a pipeline would run the loop in a subshell and
# lose $failed.
# shellcheck disable=SC2013
for loc in $(grep -o '<loc>[^<]*</loc>' "$DIST/sitemap.xml" | sed 's|<loc>||; s|</loc>||'); do
  expect 200 "$loc"
done
for path in /search/ /robots.txt /llms.txt /llms-full.txt /sitemap.xml; do
  expect 200 "${url}${path}"
done
expect 404 "${url}/not-a-page-$(date +%s)-$$/"
[ "$failed" = 0 ] || { echo "smoke test failed" >&2; exit 1; }
echo "✓ ${url} serves this build"
