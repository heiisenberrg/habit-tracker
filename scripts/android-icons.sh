#!/bin/zsh
# Regenerates the Android launcher icon and launch-screen bitmaps from the iOS
# sources, so the two platforms cannot drift. Usage: scripts/android-icons.sh
#
#   ios/…/AppIcon.appiconset/icon-1024.png
#     → mipmap-*/ic_launcher.png, ic_launcher_round.png   legacy 48dp (round = circle mask)
#     → mipmap-*/ic_launcher_foreground.png               adaptive layer: 108dp canvas, the
#       1024 icon fills the 72dp visible square and is padded with its own red so it
#       blends into @color/ic_launcher_background (mipmap-anydpi-v26/ic_launcher*.xml)
#   src/assets/splash-logo.png
#     → drawable-*/launch_mark.png   the mark at 120dp, drawn centred by
#       @drawable/launch_background (the same picture as LaunchScreen.storyboard)
#     → drawable-*/splash_mark.png   the same 120dp mark on a transparent 288dp canvas
#       for android:windowSplashScreenAnimatedIcon (values-v31): Android 12+ scales the
#       drawable to 288dp and shows only the centre 192dp circle
#
# Needs python3 with Pillow (python3 -m pip install pillow).
set -eu
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
python3 -c 'import PIL' 2>/dev/null || { echo "android-icons: needs Pillow (python3 -m pip install pillow)"; exit 2; }
python3 - "$ROOT" <<'PY'
import os, sys
from PIL import Image, ImageDraw

root = sys.argv[1]
res = os.path.join(root, "android/app/src/main/res")
icon = Image.open(os.path.join(root, "ios/habittracker/Images.xcassets/AppIcon.appiconset/icon-1024.png")).convert("RGBA")
mark = Image.open(os.path.join(root, "src/assets/splash-logo.png")).convert("RGBA")
RED = (0xE5, 0x09, 0x14, 255)          # icon-1024's ground; must equal @color/ic_launcher_background
CLEAR = (0, 0, 0, 0)
DENSITIES = {"mdpi": 1, "hdpi": 1.5, "xhdpi": 2, "xxhdpi": 3, "xxxhdpi": 4}


def px(density, dp):
    return round(dp * DENSITIES[density])


def fit(im, size):
    return im.resize((size, size), Image.LANCZOS)


def circle(im):
    # Anti-aliased circular mask: drawn at 4x, downsampled.
    s = im.width * 4
    m = Image.new("L", (s, s), 0)
    ImageDraw.Draw(m).ellipse((0, 0, s - 1, s - 1), fill=255)
    out = im.copy()
    out.putalpha(m.resize(im.size, Image.LANCZOS))
    return out


def pad(im, size, fill):
    out = Image.new("RGBA", (size, size), fill)
    out.alpha_composite(im, ((size - im.width) // 2, (size - im.height) // 2))
    return out


def save(im, *path):
    p = os.path.join(res, *path)
    os.makedirs(os.path.dirname(p), exist_ok=True)
    im.save(p, optimize=True)
    print(f"{os.path.relpath(p, root)}  {im.width}x{im.height}")


for d in DENSITIES:
    legacy = fit(icon, px(d, 48))
    save(legacy, f"mipmap-{d}", "ic_launcher.png")
    save(circle(legacy), f"mipmap-{d}", "ic_launcher_round.png")
    save(pad(fit(icon, px(d, 72)), px(d, 108), RED), f"mipmap-{d}", "ic_launcher_foreground.png")
    m = fit(mark, px(d, 120))
    save(m, f"drawable-{d}", "launch_mark.png")
    save(pad(m, px(d, 288), CLEAR), f"drawable-{d}", "splash_mark.png")
PY
