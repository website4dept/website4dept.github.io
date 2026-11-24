# assets/ — the Institute logo

Two copies of the same IIT Kharagpur crest live here. **Do not rename either
file**; every page looks for them by name.

| File | What it is | Used by |
|---|---|---|
| `iitkgp-logo.png` | 204 × 229 pixels, transparent background, 8 KB | every page of the website and the portal |
| `iitkgp-logo.svg` | the vector original — sharp at any size, even on a poster | nothing automatically; it is the master copy |

## Why the PNG and not the SVG?

The pages show the logo at 68 pixels (52 in the portal). The PNG is rendered at
three times that, so it stays sharp on a high-resolution screen, and at 8 KB it
is far smaller than the 99 KB vector file. Keep the SVG for anything printed —
a poster, a certificate, a slide — where it will be shown large.

## Replacing the logo

1. Keep the name `iitkgp-logo.png` exactly.
2. Transparent background, roughly 200 pixels wide.
3. Put it here, overwriting the old one.
4. Raise the `?v=` number in every HTML file (see HOW-TO-UPDATE.md), or browsers
   will keep showing the old picture.

If you have a new vector version, save it as `iitkgp-logo.svg` here too and make
the PNG from it:

```bash
rsvg-convert -w 204 -h 229 assets/iitkgp-logo.svg -o assets/iitkgp-logo.png
```

## One thing not to undo

The pages used to fetch this logo from `nptel.iitkgp.ac.in` on every page load.
Now that it is a file of our own, the site's security policy
(`CSP` in `backend/server.py`, and the matching line in both files in `deploy/`)
no longer allows images from any outside server at all. If you ever point an
`<img>` at another website, that image will simply not appear until you add that
address to the `img-src` part of the policy — in all three places.
