# Security — what protects this site, and what you have to do

Written for whoever looks after the department website, not for a security
specialist. It says what the system already does, what *you* must do, and what
is still open. Last reviewed: 24 November 2026.

---

## 1. The short version

| | |
|---|---|
| **Before going live** | run `python3 server.py check` on the server and fix everything it marks FAIL |
| **Every day** | nothing — the portal checks itself and e-mails the admins only when something is wrong |
| **Every month** | open the portal → Admin → **System health** and look at the list |
| **Every term** | Admin → Accounts: switch off anyone who has left |

---

## 2. How people get in

**Signing in takes two things**, both needed:

1. an institute e-mail address and a password;
2. a six-digit code e-mailed to that same address, valid for a few minutes.

So a stolen password on its own is not enough. Whoever has it would also need
to be reading the person's institute mailbox.

**Passwords are never stored.** What is stored is a scrypt hash
(n = 16384, r = 8, p = 1) with a random salt per person. scrypt is deliberately
slow and memory-hungry, so guessing through the stored values is impractical.
If the database were ever copied, the passwords in it would still not be usable.

**Guessing is cut off.** Five wrong passwords in a row lock the account for
fifteen minutes. Code attempts are limited separately. Both are recorded in the
activity log.

**Sessions.** Signing in creates a token that is stored only as a SHA-256 hash,
so the database cannot be used to impersonate anybody. The cookie is HttpOnly
(JavaScript cannot read it), SameSite=Strict (it is not sent from other sites)
and, once `secure_cookies` is on, HTTPS-only. Sessions expire after eight hours.
The office account is limited to two signed-in devices at once — a third sign-in
signs out the oldest, which is what you want for a shared account.

**Every form is signed.** Anything that changes data must carry a CSRF token
that matches the session, compared with `hmac.compare_digest`. A page on another
site cannot make your browser act on your behalf.

---

## 3. How the pages themselves are protected

Every response carries these headers (`backend/server.py`, `SECURITY_HEADERS`,
and the same list in `deploy/nginx-site.conf` and `deploy/apache-site.conf`):

| Header | What it does |
|---|---|
| `Content-Security-Policy` | the browser refuses to run any script, or load any image, that is not one of our own files |
| `X-Content-Type-Options: nosniff` | the browser does not guess file types |
| `Referrer-Policy: same-origin` | other sites are not told which page a visitor came from |
| `X-Frame-Options` / `frame-ancestors` | the site cannot be hidden inside somebody else's page |
| `Permissions-Policy` | no page here may ask for the camera, microphone or location |
| `Strict-Transport-Security` | once seen over HTTPS, the browser refuses plain HTTP |

**The Content-Security-Policy is the important one.** It is why there is no
longer a single `<script>` written inside a page and no `onclick="…"` in the
markup: that work moved into `contact.js` and the logo fallback at the top of
`footer.js`. If you ever add a feature, put the JavaScript in a `.js` file. A
script typed into a page will simply not run, and the browser console will say
why.

One deliberate relaxation: `style-src` still allows inline styles, because a
few places build a `style="…"` string in JavaScript (`portal/portal.js`,
`board.js`). Inline CSS is a much smaller risk than inline script. If you ever
want to close it too, move those into `portal/portal.css` and drop
`'unsafe-inline'` from the `style-src` line in all three files.

---

## 4. How the data is protected

* **The database is never asked a question built by string-joining.** Every
  query uses placeholders, so a roll number or a booking title cannot change
  what the query does.
* **Everything shown on a page is escaped** before it is put into the HTML.
* **File paths are checked** before anything is read from disk, so a crafted
  address cannot walk up out of the website folder.
* **Uploads** are size-limited and the file is identified by reading its first
  bytes, not by trusting its name. Photos must really be JPG, PNG or WebP; a
  departmental form must really be a PDF or a Word file, and a `.docx` is
  opened as a zip and must contain the `word/` folder a real Word document has.
  Stored filenames are generated from the title, never taken from the upload,
  so a crafted name cannot escape the folder.
* **Roll numbers and phone numbers never reach the public website.** They are
  visible to the office and the Head inside the portal and nowhere else. A
  student's booking is shown publicly under the faculty advisor's name.
* **Student e-mail addresses are kept in the database**, not in the
  `students-data.js` file that is published with the website.

---

## 5. Backups

Three layers, and you need all three:

1. **On the machine.** The portal snapshots its own database every six hours
   into `backend/data/backups/` and keeps the last fourteen. This covers
   mistakes.
2. **Off the machine.** `deploy/backup-offsite.sh`, run nightly from cron,
   copies the database and the uploads folder to another machine. This is the
   one that covers a dead disk or a rebuilt server. **It is not set up by
   itself — follow the instructions at the top of that file.** The System
   health page will keep telling you if it has never run.
3. **By hand, occasionally.** Admin → Backup & restore → download. Keep one
   on a laptop before any big change.

`config.json` is deliberately *not* in the automatic backups, because it holds
the mail password. Keep one copy of it somewhere safe yourself, and on the
server run `chmod 600 config.json` so other users cannot read it.

---

## 6. What to do if something goes wrong

**Somebody's account may have been taken.**
Admin → Accounts → switch the account off. That kills their sessions
immediately. Then Admin → Activity log, and read what that account did.
Switch it back on and have them set a new password.

**The portal is not responding.**
The website itself keeps working — nginx serves it straight from disk — and
visitors see `portal-down.html` only when they try to sign in. On the server:

    sudo systemctl status mathsite-portal
    sudo systemctl restart mathsite-portal
    sudo journalctl -u mathsite-portal -n 100

**The database is damaged.**
Stop the service, move `backend/data/portal.db` aside, copy the newest file
from `backend/data/backups/` into its place, start the service. Or use
Admin → Backup & restore.

**You think the machine itself is compromised.**
Do not try to clean it. Tell CIC, keep the off-site backup safe, and rebuild
from it on a fresh machine.

---

## 7. Known and accepted

These are open on purpose. They are written down so nobody finds them by
surprise.

* **`style-src` allows inline styles.** See section 3.
* **Two outside addresses are allowed:** the two Google Fonts servers, and
  nothing else — no outside images, scripts or connections of any kind. Removing
  Google Fonts too would mean hosting the two font families yourself.
* **Rate limiting is in memory**, so it resets when the service restarts and is
  counted per process. Enough for ordinary abuse; not a defence against a
  determined flood. If that ever matters, ask CIC to put rate limiting in nginx.
* **One machine.** If it is down, the site is down. There is no second server.
* **The booking form on the website trusts the department register.** Anyone
  whose address is on the register can send a request, because a code is e-mailed
  to that address and has to be typed back. Someone reading another person's
  mailbox could book a room in their name — and the office sees every request
  before anything is confirmed, which is the backstop.

---

## 8. Reporting a problem

If you find a security problem in this site, please write to the department
office rather than posting it anywhere. Include what you did and what happened;
you do not need to prove it works.
