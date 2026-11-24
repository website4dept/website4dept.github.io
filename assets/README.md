# assets/ — the logo and other fixed images

## iitkgp-logo.png — the Institute logo (put the file here)

Every page shows the IIT Kharagpur logo in the top-left corner. The pages look
for it here first:

    assets/iitkgp-logo.png

If that file is missing, the page quietly falls back to the copy on the
Institute's NPTEL server, which is how the site worked before. That fallback
needs the visitor's browser to reach another server, so it is slower, it can
break if that server changes, and it tells that server who is reading your site.

### How to put the logo here

1. Save the official logo as a PNG, about 200 x 200 pixels, on a transparent
   background.
2. Name it exactly `iitkgp-logo.png`.
3. Put it in this folder.
4. Nothing else to change. Every page picks it up straight away.

Once the file is here you can also tighten the security policy: in
`backend/server.py`, find `CSP` and remove `https://nptel.iitkgp.ac.in` from the
`img-src` line.
