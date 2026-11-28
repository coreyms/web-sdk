"""Where the Run Over Reindeer build scripts read their source art and fonts.

Every tools/build_*.py takes its roots from here, so a rebuild needs only the project directory (Corey, 2026-11-28:
"actual used resources should be moved out of these folders into the project directory").

  ART_SRC   the app's art-src/ folder (git-ignored, about 7.5 GB). It keeps the layout of Corey's Desktop working
            folder "Run Over Reindeer", so a path such as animation/column_idle/v6_keyed_v2/f001.png means the same
            file in both. The Desktop folder is his drop and decision space only; no build reads it.
            Set ROR_ART_SRC to read another copy instead (for example a backup drive).
  FONTS     ART_SRC/_fonts: the four Overpass .otf files (build_assets.py) and Sigmar-Regular.ttf
            (build_wild_mult.py, build_wild_word.py, build_led_wilds.py).

Resolved from this file's own location, never from the working directory or HOME.
"""

import os

APP = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ART_SRC = os.path.abspath(os.environ.get("ROR_ART_SRC") or os.path.join(APP, "art-src"))
FONTS = os.path.join(ART_SRC, "_fonts")
