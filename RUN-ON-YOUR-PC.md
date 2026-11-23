# Running it on your own computer

Nothing to install. Python 3.9 or newer is all you need.

Check with `python3 --version` (on Windows: `python --version`). If that fails,
install Python from python.org and tick **"Add Python to PATH"** during setup.

---

## 1. Unzip, then run two commands

Open a terminal (Windows: Command Prompt or PowerShell) in the folder you unzipped,
then:

```bash
cd backend
python3 try-it.py your.email@gmail.com
python3 server.py
```

> **Windows:** use `python` instead of `python3` in both lines.

Open **http://localhost:8000**

`try-it.py` sets everything up: the database, your e-mail on the register so the
booking form accepts you, three portal logins, and a few sample bookings so the
calendar has something in it. Run it again at any time to start over.

**Use a real address you can read, or any address at all** — nothing is actually
sent. Every e-mail is printed in the terminal window and saved as a file in
`backend/data/outbox/`.

---

## 2. What to try

### The booking form — no login
Click **Room Booking**, top right.

* The calendar shows the month for whichever room is chosen. Green days are free,
  gold partly booked, maroon fully booked, grey unavailable.
* Choose a day. What is already booked is listed, and the free stretches appear as
  green buttons. Press one — the date and time fill themselves in.
* Fill in your name, your e-mail (the one you gave `try-it.py`), a phone number and
  an advisor, then **Send me a code**.
* **Look at the terminal window.** A six-digit code is printed there. Type it in.
* The request is made and the first e-mail appears in the terminal — addressed to
  you, with the advisor and the office in CC.

### The portal — three logins
**http://localhost:8000/portal/login.html** — password `DeptMaths2026!` for all
three. After the password a code appears in the terminal; type that in too (that
two-step login is how the portal always works).

`try-it.py` prints the three addresses when it finishes. They are:

| Who | Sees |
|---|---|
| your address | Admin — everything, including **Rooms & halls** |
| `office.demo@…` | The office — **Booking requests** and **Today** |
| `hod.demo@…` | The Head — **Approvals** and the **Standing approval** switch |

### A whole booking, start to finish
1. Book a **seminar hall** on the public form. It goes straight to the Head.
2. Log in as the HoD → **Approvals** → Approve. Watch the confirmation e-mail
   appear in the terminal — same subject as the first, so mail programs show them
   as one conversation.
3. That e-mail contains a **release link**. Paste it into the browser: it asks
   before giving the room back.
4. Log in as the office → **Today** → **Print** to see the sheet for the door.
5. On a confirmed booking, press **Put on Notice Board**, then look at the home
   page — the seminar is on the Notice Board and the calendar.
6. As the HoD → **Standing approval** → tick a room → Save. Book that room again:
   it is approved the moment it is asked for.

### Also on the register, so you can book as them
`scholar.demo@…` (a research scholar) and `student.demo@…` (an M.Sc. student).
Both use the same domain as the address you gave.

---

## 3. Things worth knowing

**Nothing here touches the real website.** This is a copy running on your own
machine, at `localhost`. The GitHub copy is untouched until you upload files.

**To stop the server:** press `Ctrl+C` in the terminal.

**If the browser cannot connect,** try `http://127.0.0.1:8000` instead of
`localhost`, and check the terminal is still showing the server running.

**If port 8000 is busy,** change `"port"` in `backend/config.json` to 8080 and use
`http://localhost:8080`.

**To wipe everything and start fresh:** `python3 try-it.py your.email@gmail.com`
again. It deletes the database first.

**Do not upload `backend/config.json` or `backend/data/` to GitHub.** They hold the
accounts database. `.gitignore` already excludes them.

---

## 4. When it moves to the CIC server

Only `backend/config.json` changes — the real address, institute domains only,
HTTPS cookies and the CIC mail server. The steps are in `deploy/DEPLOY.md`, and the
booking system needs nothing extra. Delete `try-it.py` before going live; it exists
only to make a demo database.
