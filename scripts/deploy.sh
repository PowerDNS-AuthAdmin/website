#!/bin/sh
# Build, verify and publish dist/ to a static web server over SSH (rsync).
#
# The target lives in .env.deploy (git-ignored), never in the repo:
#   cp .env.example .env.deploy && $EDITOR .env.deploy
#   npm run deploy            # or: sh scripts/deploy.sh
set -eu

cd "$(dirname "$0")/.."

[ -f .env.deploy ] && . ./.env.deploy
: "${DEPLOY_HOST:?set DEPLOY_HOST in .env.deploy}"
: "${DEPLOY_PATH:?set DEPLOY_PATH in .env.deploy}"
DEPLOY_OWNER="${DEPLOY_OWNER:-}"
INDEXNOW="${INDEXNOW:-0}"

echo "→ build + checks"
node scripts/build.mjs
node scripts/check.mjs

echo "→ sync to ${DEPLOY_PATH}"
# Fingerprinted CSS/JS first so new HTML never references a file that isn't there yet,
# then everything else with --delete.
chown_opt=""
[ -n "$DEPLOY_OWNER" ] && chown_opt="--chown=$DEPLOY_OWNER"
rsync -rlt --checksum $chown_opt --chmod=D755,F644 dist/assets/ "$DEPLOY_HOST:$DEPLOY_PATH/assets/"
rsync -rlt --checksum --delete $chown_opt --chmod=D755,F644 dist/ "$DEPLOY_HOST:$DEPLOY_PATH/"

url=$(node -e 'import("./src/site.mjs").then(m => console.log(m.site.url))')
echo "→ smoke test ${url}"
for path in / /features/ /powerdns-admin-alternative/ /faq/ /sitemap.xml /robots.txt /llms.txt; do
  code=$(curl -s -o /dev/null -w '%{http_code}' "${url}${path}")
  printf '  %s %s\n' "$code" "$path"
  [ "$code" = 200 ] || { echo "smoke test failed for $path" >&2; exit 1; }
done
code=$(curl -s -o /dev/null -w '%{http_code}' "${url}/definitely-not-a-page/")
[ "$code" = 404 ] || { echo "expected 404, got $code" >&2; exit 1; }

if [ "$INDEXNOW" = 1 ]; then
  echo "→ IndexNow"
  node scripts/indexnow.mjs
fi
echo "✓ deployed"
