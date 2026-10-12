# Local geographic asset

`us-states.json` contains SVG paths and label positions only. It has no business data.

Source: [us-atlas 3.0.1](https://github.com/topojson/us-atlas), derived from the U.S. Census Bureau 2017 cartographic state boundaries. Licence: ISC; see `US-ATLAS-LICENSE.txt`.

Projection: Albers USA, 975 × 610. Alaska and Hawaii are insets. The asset includes 50 states and the District of Columbia. The dashboard joins API aggregates by exact state name.

Run `node scripts/prepare-assets.mjs` from `frontend` to regenerate the geometry and copy the local font. Vazirmatn uses SIL OFL 1.1; see `public/fonts/OFL.txt`. [Font source](https://github.com/rastikerdar/vazirmatn).
