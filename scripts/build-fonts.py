#!/usr/bin/env python3
# Subsets the self-hosted fonts in media/fonts/ into src/static/assets/fonts/.
# Needs: pip install fonttools brotli   (not part of the normal build; output is committed)
#
# Two reductions, both lossless for what the site renders:
#  - glyphs: Latin-1, the punctuation the copy uses (quotes, ellipsis, arrows, ⌘) and
#    Inter's cv11 / ss01 / ss03 alternates that styles.css turns on. JetBrains Mono keeps
#    kerning, mark composition and locale forms but not its calt ligatures: config and
#    DNS snippets should show the characters that are actually there;
#  - weight axis: Inter is used at 400 to 800 and JetBrains Mono at 400 to 700, so the
#    variation data for the other weights is dropped (this is what halves gvar).
# Keep the ranges in step with the @font-face rules in src/styles.css.
import os
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer
from fontTools import subset

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
SRC = os.path.join(ROOT, "media", "fonts")
OUT = os.path.join(ROOT, "src", "static", "assets", "fonts")
UNICODES = (
    "U+0020-007E,U+00A0-00FF,U+0131,U+0152-0153,U+2013-2014,U+2018-201A,U+201C-201E,"
    "U+2022,U+2026,U+2039-203A,U+20AC,U+2122,U+2190-2193,U+2212,U+2318,U+2713-2714"
)
DEFAULT_FEATURES = list(subset.Options().layout_features)
FONTS = [
    ("inter-latin.woff2", (400, 800), DEFAULT_FEATURES + ["cv11", "ss01", "ss03"]),
    ("jetbrains-mono-latin.woff2", (400, 700), ["kern", "ccmp", "locl"]),
]

for name, (lo, hi), features in FONTS:
    src = os.path.join(SRC, name)
    font = TTFont(src, lazy=False)
    before = os.path.getsize(src)

    opts = subset.Options()
    opts.layout_features = features
    opts.notdef_outline = True
    opts.hinting = False
    opts.name_IDs = ["*"]
    sub = subset.Subsetter(opts)
    sub.populate(unicodes=subset.parse_unicodes(UNICODES))
    sub.subset(font)

    # Round-trip through an uncompressed TTF: the instancer wants fully loaded tables.
    font.flavor = None
    tmp = os.path.join(OUT, name + ".tmp.ttf")
    font.save(tmp)
    font = TTFont(tmp, lazy=False)
    os.remove(tmp)
    font = instancer.instantiateVariableFont(font, {"wght": (lo, hi)}, inplace=True, updateFontNames=False)
    font.flavor = "woff2"
    out = os.path.join(OUT, name)
    font.save(out)

    check = TTFont(out)
    axes = {a.axisTag: (a.minValue, a.maxValue) for a in check["fvar"].axes}
    print(f"{name}: {before} -> {os.path.getsize(out)} bytes, {len(check.getGlyphOrder())} glyphs, wght {axes['wght']}")
