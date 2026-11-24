# How to update the website yourself

Everything here is a small edit you can make without knowing how the code works.
Each entry says **which file to open** and **what to change**.

After editing any file in this list, upload it to GitHub (or restart the portal
server if you are running that).

---

## Photos

### Change or add a photo in the home page slideshow

1. Put the picture in the **`gallery/`** folder.
   Name it in lower case with dashes and **no spaces**: `dept-photo.jpg`, not `Dept Photo.jpeg`.
   Resize it to about **2000 pixels** on the long side first — a photo straight from a
   phone is 4 MB and makes the home page slow.
2. Open **`gallery-data.js`** and add a line inside the list:

   ```js
   { src: "gallery/dept-photo.jpg", title: "Department of Mathematics", album: "Department", hero: true },
   ```

   * `src` — the path to the file
   * `title` — the caption, also used by the gallery filter
   * `album` — the group it belongs to (`Department`, `Campus`, `Events`, `Placement`…)
   * `hero: true` — also show it in the home page slideshow. Leave it out for gallery-only.
3. If the picture does not appear, it is almost always one of three things:
   the file name does not match exactly (capital letters count), the file is not in
   `gallery/`, or your browser cached the old file — see **Making a change show up** below.

### The IIT Kharagpur logo in the top-left corner

Every page looks for the logo at **`assets/iitkgp-logo.png`** first. That file is
not in the folder yet, so until you add it the pages quietly fall back to the copy
on the Institute's NPTEL server — which is how the site worked before, but it is
slower and it depends on somebody else's server staying up.

To fix that for good:

1. Save the official logo as a PNG, about 200 × 200 pixels, transparent background.
2. Name it exactly `iitkgp-logo.png`.
3. Put it in the `assets/` folder.
4. Nothing else to change. Every page picks it up straight away.

(Then, if you like: in `backend/server.py` find `CSP` and delete
`https://nptel.iitkgp.ac.in` from the `img-src` line. The site stops talking to
any outside server for images at all.)

### A photo for a person

Put it in **`photos/`** named after their profile id: `photos/ratna-dutta.jpg`.
No edit to any file is needed — the site looks for it automatically and shows
their initials if it is missing.

---

## People

Open **`people-data.js`**. One line per person. To add someone, copy an existing
line and change it:

```js
{"id": "firstname-lastname", "name": "Firstname Lastname", "type": "faculty",
 "designation": "assistant-professor", "status": "current", "email": "", "areas": ["algebra"]},
```

* `id` — lower case with dashes, must be unique. It is the address of their profile page.
* `type` — `faculty`, `adjunct`, `postdoc`, `project` (Project Fellows: JRF, SRF, RA; `supervisor` = the PI, `topic` = the project, `designation` = e.g. "Junior Research Fellow"), `scholar` or `staff`
* `status` — `current`, `former` (moves to Former Faculty) or `alumni` (scholars and postdocs move to PhD & PDF Alumni)
* `supervisor` — for scholars, the `id` of their supervisor. They then appear on
  that professor's Students tab automatically.

The full list of fields is in the comment at the top of `people-data.js`.

Everything updates at once: the People page, the search, the profile page, and
the supervisor's Students tab.

---

## Notices and events

Open **`notices-data.js`** and add an entry. `kind` is `notice` or `event`,
`date` is `YYYY-MM-DD`. They appear on the home Notice Board, the calendar and
the News & Events page.

(With the portal server running, use **Admin → Notices & events** instead and
this file is written for you.)

---

## Students

### Job openings (Students → Job Opportunity)

Open **`students-data.js`** and add an entry to `DEPT_JOBS`:

```js
{ title: "Junior Research Fellow (JRF)", org: "Department of Mathematics, IIT Kharagpur",
  type: "JRF", detail: "SERB-funded project on hyperbolic conservation laws.",
  eligibility: "M.Sc. Mathematics with NET/GATE", deadline: "15 Dec 2026",
  url: "https://www.iitkgp.ac.in/", status: "open" },
```

Set `status: "closed"` to take one down without deleting it.

### Student lists and alumni

Open **`students-data.js`** and add to `DEPT_STUDENTS`, or keep one small JSON file
per batch in `JSON-files/` and run `python build_students_data.py`.

---

## Room booking (needs the portal server)

### First: load the e-mail addresses — nothing works without this

Only people whose official address the department already holds can book a room.
Until the addresses are imported the booking form accepts nobody.

**Faculty, scholars, postdocs, staff** — a file of just ids and addresses is enough,
because the importer merges it into the profiles that already exist:

```json
[
  {"id": "ratna-dutta",     "email": "ratna@maths.iitkgp.ac.in"},
  {"id": "adrijit-goswami", "email": "goswami@maths.iitkgp.ac.in"}
]
```

Load it with Admin → **Import data (JSON)**, or from the `backend` folder:

```bash
python3 server.py import faculty-emails.json
```

The profile ids are the ones in `people-data.js` (`"id": "ratna-dutta"`).

**Students** — add an `email` to each student in a batch file under
`JSON-files/6-students-current/`:

```json
{ "programme": "msc", "batch": 2025,
  "students": [ {"name": "Student One", "roll": "25MA10001", "email": "student1@kgpian.iitkgp.ac.in"} ] }
```

Import it under Admin → **Students** → Import. The address is kept on the server for
booking only; it is **never** written into `students-data.js`, so student addresses
are never published on the website.

Portal → **Booking requests** shows how many faculty still have no address, so you
can see what is left to do.



| What | Where |
|---|---|
| Add a room or hall | Portal → **Rooms & halls** → Add a room |
| Decide whether a room needs the Head's approval | Portal → **Rooms & halls** → Edit → "Head's approval" |
| Switch a room off without losing its history | Portal → **Rooms & halls** → Remove (it is switched off, not deleted, if it has bookings) |
| Let routine requests through without the Head | Portal → **Approvals** → Standing approval → tick the room |
| Stop that again | Untick it, or set an end date in "Only until" |
| Print today's bookings for the office door | Portal → **Today** → Print |
| Say who holds the key for a room | Portal → **Rooms & halls** → Edit → "Who holds the key". It appears in every booking e-mail |
| Put an approved seminar on the Notice Board | Portal → **Booking requests** or **Approvals** → "Put on Notice Board" |
| Record that nobody used a room | Portal → **Today** or **Booking requests** → "Mark not used" |
| Make someone a booking office staff member | Portal → **Accounts** → Change role → `office`. One shared account is normal: two people may be signed in at once, and a third sign-in ends the oldest session |
| Make someone the Head for approvals | Portal → **Accounts** → Change role → `hod` |

### Who presses what, now that approval and confirmation are separate

A room is **not** booked the moment the Head approves it. There are two steps:

1. **The Head approves.** Nothing is sent to anybody. The request moves into the
   office's **Ready to confirm** list.
2. **The office presses Confirm booking.** *That* is what e-mails the person who
   asked, with a copy to the office and to the faculty advisor if one was named.

This is on purpose: only the office knows about the key, a late clash or the
furniture. If you would rather it went out straight away, the office can tick
**"Confirm as soon as the Head approves"** at the bottom of Portal → Booking
requests. It is off to begin with and can be switched back at any time.

Three places tell you where something is stuck:

* Portal → **Booking requests** — two counters at the top: *with the Head, not yet
  approved*, and *approved — ready for you to confirm*.
* Portal → **Approvals** (the Head) — a table, *Approved by you — waiting for the
  office to confirm*.
* Portal → **System health** (admin) — warns if anything has sat unconfirmed for
  more than two days.

### Before forwarding: the checklist

Pressing **Check & forward** (or **Check & confirm**) opens a short list before
anything happens: is the room really free, is the date inside the booking window,
is the room big enough, is there an e-mail address to write to, is anyone else
asking for the same slot, has this person failed to turn up before. A red ✕ stops
the request going further; an amber ! is for you to judge. The same checks run
again on the server when you press the button, so a page left open for an hour
cannot wave anything through.

### Change the working hours, how far ahead people may book, or blocked dates

These are settings, not code. Until a settings screen is added in a later stage,
change them with one command in the `backend` folder:

```bash
python3 -c "
import server, bookings, json
bookings.save_cfg({'day_start':'08:00','day_end':'20:00','max_days_ahead':120,'max_hours':4})
print(json.dumps(bookings.cfg(), indent=2))
"
```

To block a holiday period so nobody can book during it:

```bash
python3 -c "
import server, bookings
bookings.save_cfg({'blackout':[{'from':'2026-12-24','to':'2027-01-01','reason':'Institute holidays'}]})
"
```

To switch the website booking form off altogether (the portal keeps working):

```bash
python3 -c "
import server, bookings
bookings.save_cfg({'public_booking': False})
"
```

To change how many requests one person may send in an hour, or how long the
six-digit code lasts:

```bash
python3 -c "
import server, bookings
bookings.save_cfg({'max_per_hour': 5, 'code_minutes': 15})
"
```

To make every approval go out immediately, without the office confirming
(the same thing as the tick box described above):

```bash
python3 -c "
import server, bookings
bookings.save_cfg({'office_auto_confirm': True})
"
```

The defaults for all of these are listed in `DEFAULTS` at the top of
`backend/bookings.py`.

---

## Backups — the one thing to set up and then forget

The portal already copies its own database into `backend/data/backups/` every six
hours and keeps the last fourteen. That saves you from a mistake, but **not** from
the machine itself: if the disk fails, those copies go with it.

`deploy/backup-offsite.sh` copies a backup somewhere else. Open it, change the few
lines at the top (where the files should go), run it once by hand to check it
works, then add the single cron line printed in its own comments. Portal → **System
health** will keep saying *"Copy kept off this machine: never run"* until you do,
and will start warning again if it ever stops.

There is also a manual download: Portal → **Backup & restore**. Worth doing before
any big change.

---

## Making a change show up (important)

Browsers keep a copy of `style.css` and the `.js` files. If you change one and
the website looks the same afterwards, the browser is showing you the old copy.

Every page links to them with a version number:

```html
<link href="style.css?v=32" rel="stylesheet">
<script src="main.js?v=32"></script>
```

**Whenever you edit a `.css` or `.js` file, raise that number by one in every HTML
file that links to it.** They should all carry the same number, so the quickest
way is to search all the HTML files for `?v=32` and replace it with `?v=33`.

In VS Code: Edit → Replace in Files (Ctrl+Shift+H), search `?v=32`, replace
`?v=33`, press "Replace All". Every page must end up with the same number — if one
page is left behind, that page alone keeps showing the old styling.

Editing a `-data.js` file (gallery, people, notices, students) counts too.

---

## File naming — please keep to this

* lower case, dashes instead of spaces: `dept-photo.jpg`, `job-opportunity`
* no two files whose names differ only in capitals — GitHub treats `Photo.jpg`
  and `photo.jpg` as different files but Windows does not, which causes files to
  go missing
* a person's photo is named after their profile id, exactly
* put pictures in `gallery/` (slideshow and gallery) or `photos/` (people), never
  in the top folder

---

## What you cannot change by editing a file

The booking system, logins, approvals and e-mail need the portal server running
(see `backend/README.md` and `BOOKINGS.md`). On the GitHub copy those pages are
not available at all. Everything else on this page works on both copies.
