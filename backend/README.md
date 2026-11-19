# Department portal – setup guide

The portal adds logins to the website:

* **Faculty, postdocs and staff** log in and edit their own profile (research scholars have no logins – the admin keeps their profiles; change `self_edit_types` in `config.json` to adjust) (bio, publications, projects, students, teaching, photo, CV …).
* **Two-step login every time:** institute e-mail + password, then a 6-digit code sent to that e-mail.
* **Accounts are created only by the admin**, only for allowed e-mail domains. The person receives an invitation e-mail to set their password (or a temporary password – see `invite_mode`).
* **Admin panel:** accounts, every profile (designation, status → Former Faculty / Alumni), notices & events (home Notice Board + News & Events page), mailing lists, e-mail to groups, activity log, export.

Everything is in `server.py` – Python 3.9 or newer, **no packages to install**.

---

## 1. Try it on your own computer (now, with a dummy e-mail)

Open a terminal / Command Prompt in this `backend` folder.

```bash
python server.py init
```
This creates `config.json` and the database `data/portal.db`, and imports the 40 faculty from `people-data.js`.

Copy the settings from `config.example.json` into `config.json` (or just rename it) and set:

```json
"allowed_email_domains": ["iitkgp.ac.in", "gmail.com"],
```
`gmail.com` is only there so you can test with a dummy Gmail account. **Remove it later.**

Create yourself as admin (use your dummy e-mail; optionally the profile id you want to link):
```bash
python server.py create-admin your.dummy.account@gmail.com adrijit-goswami
```

Start the server:
```bash
python server.py
```
Open **http://localhost:8000** – the whole website runs from here, and **Portal Login** is in the top bar (http://localhost:8000/portal/login.html).

### Test mode (default): no real e-mails
With `"mode": "console"` nothing is sent. Every e-mail (invitations, login codes, group e-mails) is **printed in the terminal window** and saved in `data/outbox/`. Copy the link / code from there.

### Real e-mails from a dummy Gmail account
1. Use a separate Gmail account for the department (not a personal one).
2. Turn on 2-Step Verification for that Google account, then create an **App password** (Google Account → Security → App passwords).
3. In `config.json`:
```json
"mail": {
  "mode": "smtp",
  "from_name": "Department of Mathematics, IIT Kharagpur",
  "from_email": "your.dummy.account@gmail.com",
  "smtp_host": "smtp.gmail.com",
  "smtp_port": 587,
  "smtp_security": "starttls",
  "smtp_user": "your.dummy.account@gmail.com",
  "smtp_password": "the 16-letter app password"
}
```
4. Restart the server and test: `python server.py test-mail you@gmail.com`

Gmail allows roughly 500 e-mails a day – fine for testing and small groups.

---

## 2. Daily use

| Task | Where |
|---|---|
| Give a professor access | Admin → **Accounts** → e-mail + link to their profile → *Create account*. They get an e-mail to set a password. |
| Someone forgot their password | They click *Forgot password* on the login page, or admin → Accounts → *Re-send invite*. |
| Account locked (5 wrong passwords) | Unlocks itself after 15 minutes, or admin → Accounts → *Unlock*. |
| Post a notice or seminar | Admin → **Notices & events**. Appears on the home Notice Board and News & Events at once. |
| Professor retires / scholar graduates | Admin → **People & profiles** → Edit → Status = Former / Alumni. |
| E-mail all faculty / scholars / students | Admin → **Send e-mail**. Students: first make a list in **Mailing lists** (paste "Name, e-mail" lines from Excel). |
| See who changed what | Admin → **Activity log**. |

### Adding many scholars, alumni or students at once (JSON)
Templates: `docs/import-template-scholars.json` and `docs/import-template-students.json`.
Admin → **Import data (JSON)** → choose the file → Import (or `python server.py import file.json`).
* Profiles (`"type": "scholar"` / `"postdoc"` / …) are created, or merged into the existing profile with the same `id`.
* Graduated scholars: `"status": "alumni"` + `"year"` (completed) + optional `"now"` → listed under Alumni.
* `"supervisor"` = the professor's profile id → the scholar appears on that professor's Students tab.
* Records with `"list"` + `"email"` go to that mailing list (current students, alumni contacts).
* Importing the same file again updates, never duplicates.

### While the public website is still on GitHub Pages
GitHub cannot run this server, so the GitHub copy shows the data files as they were last uploaded.
To publish portal changes there: Admin → **Export for website** → download → upload the files inside to GitHub.
(The *Portal Login* link on the GitHub copy shows a message that the login system is not available there.)

---

## 3. Moving to the CIC server (no code changes)

Only `config.json` changes:

```json
"base_url": "https://maths.iitkgp.ac.in",            // the real address
"allowed_email_domains": ["iitkgp.ac.in"],            // institute IDs only
"secure_cookies": true,                               // HTTPS only
"mail": {
  "mode": "smtp",
  "from_email": "noreply@<address CIC gives you>",
  "smtp_host": "<CIC mail server>", "smtp_port": 587, "smtp_security": "starttls",
  "smtp_user": "<from CIC>", "smtp_password": "<from CIC>"
}
```
You can also keep the password out of the file: set the environment variable `PORTAL_SMTP_PASSWORD`.

Run it behind the CIC web server (Apache or Nginx with HTTPS), for example:
```bash
pip install gunicorn            # on the server only
gunicorn --workers 2 --bind 127.0.0.1:8000 server:app
```
and let Apache/Nginx forward the site to `http://127.0.0.1:8000` (the server serves the whole website and the portal). Copy the `data` folder across to keep all accounts, profiles and notices.

**Back up** `backend/data/portal.db` and the `uploads/` folder regularly (CIC usually does this).

If CIC offers institute single sign-on later, the login step can be connected to it.

---

## 4. Security notes

* Passwords are stored only as salted **scrypt** hashes. Login codes, invitation and reset links are single-use, stored as hashes, and expire (10 min / 48 h / 60 min).
* 5 wrong passwords lock the account for 15 minutes; 5 wrong codes cancel the login; login attempts are rate-limited per IP.
* Sessions: HttpOnly, SameSite=Strict cookie, 8-hour expiry, CSRF token on every change. Changing a password logs out other devices.
* Members can edit only their own profile; designation, status and the official profile link are admin-only.
* Uploads are checked: photos must really be JPG/PNG/WebP (max 2 MB), CVs must be PDF (max 5 MB).
* `backend/`, `data/` and hidden files are never served to the browser.
* **Never upload `config.json` or the `data` folder to GitHub** (`.gitignore` already excludes them).

## 5. Commands

```
python server.py                  start the server
python server.py init             create database / config (safe to repeat)
python server.py create-admin E [profile-id]   create or promote an admin and e-mail an invitation
python server.py test-mail E      send a test e-mail
python server.py import file.json bulk-add scholars, postdocs, alumni or mailing-list contacts
python server.py export [folder]  write people-data.js and notices-data.js
```
