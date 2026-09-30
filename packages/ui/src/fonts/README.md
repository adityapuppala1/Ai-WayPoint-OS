# Waypoint Dot

`waypoint-dot.woff2` holds one glyph: the middle dot (U+00B7) from
[Overpass](https://github.com/RedHatOfficial/Overpass), with its weight axis.

Overpass classifies that glyph as a combining mark, so browsers give it no width and a
separator such as "Free · works" is drawn as "Free ·works". This file is the same glyph marked
as an ordinary character. `styles/index.css` loads it for U+00B7 only, ahead of Overpass in the
font stack; every other character still comes from Overpass.

Made with fontTools: subset Overpass (latin, variable) to U+00B7, drop the GDEF/GSUB/GPOS
tables and rename the family. Licensed, like Overpass, under the SIL Open Font License 1.1
(`OFL.txt`).
