#!/bin/sh
# Pull the built website from the "site" branch of PowerDNS-AuthAdmin/website into the
# web root. Runs every minute from pull-site.timer as pda-site. The repository is public,
# so no credentials are needed, and nothing on GitHub can reach this host: it only ever
# pulls. The Deploy workflow writes build.txt (the source commit) and waits for it to
# appear on the live site before smoke-testing.
set -eu
REPO=https://github.com/PowerDNS-AuthAdmin/website.git
CLONE=/home/pda-site/site
WEBROOT=/var/www/powerdns-authadmin-website
if [ ! -d "$CLONE/.git" ]; then
  git init -q "$CLONE"
  git -C "$CLONE" remote add origin "$REPO"
fi
git -C "$CLONE" fetch -q --depth 1 origin site 2>/dev/null || exit 0   # no site branch yet
new=$(git -C "$CLONE" rev-parse FETCH_HEAD)
old=$(cat "$CLONE/.deployed" 2>/dev/null || true)
[ "$new" = "$old" ] && exit 0
git -C "$CLONE" reset -q --hard FETCH_HEAD
# Fingerprinted assets first so no page ever references a file that is not there yet,
# then everything else with --delete.
rsync -rlt --checksum --chmod=D755,F644 "$CLONE/assets/" "$WEBROOT/assets/"
rsync -rlt --checksum --delete --exclude=.git --exclude=.deployed --chmod=D755,F644 "$CLONE/" "$WEBROOT/"
echo "$new" > "$CLONE/.deployed"
logger -t pull-site "deployed site branch $new ($(cat "$CLONE/build.txt" 2>/dev/null || echo ?))"
