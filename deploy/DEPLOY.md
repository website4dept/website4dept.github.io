# Moving the website + portal to the CIC server

The site is built so that the move is a **copy + five settings + one command**. Nothing in the pages has to change:
all links are relative, and the portal server serves the pages *and* the live data (people, notices, gallery).

## A. What CIC provides (send them this section)

| Need | Details |
|---|---|
| Linux server / VM | Python **3.9 or newer** (nothing else to install – no pip packages). About 1 GB disk, 512 MB RAM is enough. |
| Web address + HTTPS | e.g. `https://maths.iitkgp.ac.in` with a valid certificate. nginx or Apache forwards it to `127.0.0.1:8000` (`nginx-site.conf` / `apache-site.conf` are ready). |
| Outgoing mail (SMTP) | Host, port and a sender account, so the portal can send **invitations and login codes**. Without this nobody can log in. |
| Service account | A Linux user (e.g. `mathsite`) that owns `/srv/mathsite`. |
| Backups | Include `/srv/mathsite/backend/data` and `/srv/mathsite/uploads` in the server's normal backup. (The portal also keeps its own daily database copy.) |

## B. What we do (about 15 minutes once CIC has given the above)

1. **Copy** the whole site folder to the server as `/srv/mathsite` (keep the `backend`, `portal`, `deploy`, `gallery`, `photos` folders). If the portal has been used locally, also copy `backend/data` and `uploads` – the admin account, notices and edits then come along.
2. **Config:** `cp deploy/config.cic.example.json backend/config.json` and edit: `base_url`, the three `smtp_*` values and `from_email`. Then `chmod 600 backend/config.json`.
3. **Create the first admin** (also creates the database and loads people, notices and gallery from the site files):
   ```bash
   cd /srv/mathsite/backend
   python3 server.py setup admin@iitkgp.ac.in
   ```
   The setup ends with a **pre-flight check** – fix anything marked `FAIL`/`WARN`. Run it any time with `python3 server.py check`. Test mail with `python3 server.py test-mail you@iitkgp.ac.in`.
4. **Run it as a service:** `sudo cp deploy/portal.service /etc/systemd/system/mathsite.service`, then `sudo systemctl daemon-reload && sudo systemctl enable --now mathsite`.
5. **Switch on the web server:** use `deploy/nginx-site.conf` (or `apache-site.conf`) and reload it.

## C. Check it works

- [ ] `https://…/` shows the home page and `https://…/people-data.js` is served (live data).
- [ ] Admin Login → set password from the invitation e-mail → the 6-digit code arrives by e-mail → Overview opens.
- [ ] Post a test notice → it appears on the home page Notice Board **immediately** (no export needed).
- [ ] People → a scholar profile shows supervisor, email, area, roll no., office.
- [ ] `https://…/backend/config.json` and `https://…/data/portal.db` give **404** (secrets are never served).
- [ ] Admin → Backup & restore → download a backup.

## D. After the move

- **Updating the pages later:** copy the new files over `/srv/mathsite` (leave `backend/data`, `backend/config.json` and `uploads` alone) and run `sudo systemctl restart mathsite`.
- **The GitHub copy** is no longer needed: unpublish GitHub Pages, keep the repository private as a backup, and update links that point to it.
- **Logs:** `journalctl -u mathsite -f`. **Restart:** `sudo systemctl restart mathsite`.
- **Security settings:** `config.json` → `admin_ip_allowlist` (limit admin to campus addresses), `allowed_email_domains` (institute addresses only), `session_hours`.
- Optional, for heavier traffic: run behind gunicorn instead of the built-in server (`gunicorn -w 2 -b 127.0.0.1:8000 server:app`, from the `backend` folder). Not needed for a department site.
