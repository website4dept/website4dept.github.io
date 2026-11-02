# IIT Kharagpur Mathematics — Static HTML Site

This is a **static HTML/CSS conversion** of the supplied maroon/navy Mathematics Department homepage design. It has independent pages, one shared stylesheet and a small JavaScript file for mobile navigation and **page-title/topic search** (not full-text indexing).

## Open locally

Double-click `index.html` to open the site in a browser. No Python, Django, npm, database or installation is required.

For optional local HTTP testing, run `python -m http.server 8000` inside the folder and visit http://127.0.0.1:8000/.

## Files

- `index.html` — home
- `about.html` — about
- `research.html` — research
- `people.html` — people/directory landing page
- `academics.html` — academics
- `students.html` — students
- `news-events.html` — news and events
- `publications.html` — research publications
- `contact.html` — contact
- `faculty-template.html` — editable placeholder for a faculty profile
- `404.html` — missing page
- `assets/css/style.css` — **single dedicated shared CSS file**
- `assets/js/main.js` — responsive menu and static page search
- `assets/favicon.svg` — illustrative icon, not an official IIT logo

## Edit it

Change page content in its own `.html` file. Change shared site styling in `assets/css/style.css`.

The header/footer are repeated in each HTML page so every file works independently, including when double-clicked. When adding a main navigation tab, update all HTML pages, and (optionally) the `pages` list in `assets/js/main.js`.

The directory/news/publications pages deliberately have **empty-state placeholders** because the supplied homepage design did not contain a verified complete directory, publication listing, or current schedule. Replace them with approved data before official publication.

The two illustrative Unsplash photographs and Google Fonts load from the internet; fonts have system fallbacks, and the layout remains usable without these services. Replace the photographs with approved campus photographs before official use.

## Publish with GitHub Pages

1. Create a GitHub repository, for example `mathematics-department`.
2. Upload the **contents** of this folder (ensure `index.html` is in the repository root).
3. Go to repository **Settings → Pages**.
4. Under **Build and deployment**, choose **Deploy from a branch**, then `main` and `/(root)`; Save.
5. Once GitHub reports deployment, use the Pages URL it provides.

You may attach a department-owned custom domain later with the approval of the relevant IIT Kharagpur administrators and correctly configured DNS/HTTPS.

## Important feature difference from Django

GitHub Pages does not run Python, Django, PostgreSQL, faculty email/password accounts, upload APIs, or an administrator dashboard. This static edition has **no working faculty authentication, online publication forms, or server-side content editing**. Faculty content must be edited in HTML and pushed to GitHub, or you must connect an approved static-site CMS/service with proper access controls. Do **not** publish `.env`, passwords, database backups, or other secrets in a public repository.

This is a layout/content adaptation of the original supplied HTML, not a copy of the unprovided Django `config/`, `portal/` and `templates/` source tree. It is not an official deployment.
