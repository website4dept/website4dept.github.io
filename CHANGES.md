# Change log

Newest first. Each entry says what was asked for, which files changed, and why.

---

## 24 November 2026 — Plain page headings, approve-then-confirm, and a safer server

Three things were asked for: take the maroon strip off every tab except the home
page, do the "betterment" items proposed earlier, and change the booking flow so
that the Head approving is no longer what tells the person who asked.

### 1. The maroon strip is gone from the inner pages

**Before:** Academics, Students, Publications and News & Events each opened with a
400-pixel maroon band. Research, People and Contact did not, so the site did not
look like one site.
**Now:** all of them open the way Research does — breadcrumbs, a small gold
eyebrow, a dark serif heading and one line of intro, on white. The home page is
untouched. Faculty profile pages keep their dark header, because a person's photo
sits inside it and it reads as a card rather than a strip; say the word and it goes
too.

| File | Change |
|---|---|
| `style.css` | `.page-hero` is now white with dark text, no fixed height, no `∫ ∑ π ∞ ∇` watermark. The old maroon treatment was moved to `.page-hero.profile-hero`, which only profile.html uses. `.breadcrumbs` recoloured for a light background. |

Nothing in any HTML file changed for this — one rule in one stylesheet does all of
it, so it is easy to undo.

### 2. The Head approves, the office confirms

**Before:** the moment the Head pressed Approve, the confirmation e-mail went to
the person who asked.
**Now:** his approval sends nothing to them at all. The booking moves into the
office's **Ready to confirm** list, and the e-mail goes out only when the office
presses **Confirm booking** — To the person who asked, Cc the office, Cc the
faculty advisor if one was named. This is true of all three ways a request gets
approved: the Head pressing Approve, the Head clearing a whole date at once, and
the standing-approval rule applying by itself.

Everyone can see where a request is stuck:

* the person who asked sees *"Approved by the HoD — office to confirm"*;
* the office has two counters, *with the Head, not yet approved* and *approved —
  ready for you to confirm*;
* the Head has a table, *Approved by you — waiting for the office to confirm*;
* System health warns if anything has been unconfirmed for more than two days.

**The office can switch this off.** A tick box at the bottom of Booking requests,
*"Confirm as soon as the Head approves"*, sends approvals out immediately. It
belongs to the office — the Head cannot change it from his page — and it is off to
begin with.

**Nothing leaves the office desk unchecked.** Forward and Confirm now open a
checklist first: is the room really free, is the date inside the booking window, is
the room big enough, is there an address to write to, is anybody else asking for
the slot, has this person failed to turn up before. A red ✕ stops it; an amber ! is
a judgement call. The same checks run again on the server when the button is
pressed, so a stale page cannot wave anything through.

| File | Change |
|---|---|
| `backend/bookings.py` | new `confirmed` / `confirmed_by` / `confirmed_at` columns (added automatically to an existing database); `approve()` no longer e-mails the asker and takes a `confirm_now` flag; new `confirm_booking()`, `office_checks()`, `blockers()`, `api_office_check()`, `status_label()`; new `mail_awaiting_office()`; `api_queue` returns a `to_confirm` tray; `api_hod` returns `awaiting_office` and a `days` list; `decide-many` accepts a `date`; `office_auto_confirm` setting, writable by the office; the Notice Board and the "confirmed, still to come" list now require `confirmed = 1`; withdrawing an unconfirmed booking says "not approved" rather than "cancelled", because the asker was never told it was approved |
| `portal/bookings.js` | the checklist panel; the **Ready to confirm** table; the confirm-on-approval tick box; **Clear a whole day** buttons on the Head's page; the Head's *waiting for the office* table; the status chip shows the in-between state in amber |
| `portal/portal.css` | styles for the checklist, the tick box and the day buttons |
| `backend/test_bookings.py` | 112 checks (was 76) |

### 3. The betterment items

| What | Where | Why |
|---|---|---|
| **Content-Security-Policy** | `backend/server.py` (`CSP`), and the same line in both deploy configs | the browser now refuses to run any script that is not one of our own files. This is the single biggest protection against a script smuggled in through a notice or a booking title. |
| **No script written inside a page** | new `contact.js`; the logo fallback moved into `footer.js`, `room-booking.js`, `portal/portal.js`; `onload=` / `onerror=` attributes removed from `contact.html` | a strict policy forbids them, and they were the only ones left |
| **The logo is served from our own site** | new `assets/` folder, `assets/README.md`, all 16 pages | it used to be fetched from `nptel.iitkgp.ac.in` on every page load. Drop `assets/iitkgp-logo.png` in and that stops; until then it still falls back, so nothing breaks. |
| **The website no longer depends on Python** | `deploy/nginx-site.conf`, `deploy/apache-site.conf`, new `portal-down.html` | nginx used to hand *every* request to the portal, so a Python fault took the whole site down. It now serves the pages itself and passes on only `/api/` and `/portal/`. If Python stops, the website keeps working and only signing in and booking are affected. |
| **Backups that survive the machine** | new `deploy/backup-offsite.sh`, new `python3 server.py backup` | the existing six-hourly backup sits on the same disk as the database. This script copies it elsewhere; set it up once from the instructions at the top of the file. |
| **System health page** | `backend/server.py` (`system_report()`, `/api/admin/system`), `portal/portal.js` (`VIEWS.system`) | Admin → System health: database, disk space, backups, off-site copy, e-mail, HTTPS, failed sign-ins, locked accounts, bookings nobody has confirmed, staff with no address. Green / amber / red, in plain words. |
| **A daily warning e-mail** | `backend/server.py` (`daily_health_mail_loop`) | the same list is checked once a day and e-mailed to the admins **only when something is wrong**, so a message arriving means something really does need attention. |
| **`SECURITY.md`** | new | what protects the site, what you have to do yourself, what to do when something goes wrong, and an honest list of what is still open. |

### 4. Housekeeping

* Every page now carries the same `?v=32` on its stylesheet and scripts — they had
  drifted to a mixture of 29, 30 and 31, which meant some browsers were being
  served a stale stylesheet.
* The three test suites no longer hard-code a folder path and no longer share a
  database: each run creates and throws away `backend/data-test/`, so a run can
  never be upset by an earlier one and your real `backend/data/` is never touched.
  **221 checks, all passing** (112 + 62 + 47).
* `BOOKINGS.md`, `HOW-TO-UPDATE.md` and the deploy configs were rewritten to match.
* Deleted the leftover `gallery/Dept Photo.jpeg` (4.3 MB). Nothing referenced it —
  the slideshow uses the renamed, compressed `gallery/dept-photo.jpg` — and having
  both broke the "no two names that differ only in capitals and spaces" rule.

---

## 23 November 2026 — The Head is e-mailed only when the office forwards

Requested: the HoD should get the mail only when the office forwards a request to
him. This reverses the earlier "seminar halls go straight to the HoD" decision.

**Before:** a seminar hall request e-mailed the Head the moment it was made; the
office never touched it first.
**Now:** every request — from the website or the portal — lands with the department
office. They forward a hall to the Head, which is the only thing that e-mails him,
or confirm a classroom themselves. His standing approval is applied at the moment
of forwarding, so a routine request he has already blessed is confirmed then and
there without troubling him.

| File | Change |
|---|---|
| `backend/bookings.py` | `route_new_booking()` now always returns the request to the office. `mail_forwarded()` is called from one place only, the office's Forward action. First-e-mail and confirmation wording say the office |
| `portal/bookings.js` | The office's **Forward to HoD** button restored for halls; office and Head screen text updated |
| `room-booking.html`, `room-booking.js` | The page says every request goes to the office first |
| `backend/test_bookings.py`, `test_public.py`, `test_extras.py` | Expectations follow the flow; two new checks assert the Head gets no e-mail and sees nothing until the office forwards |

**Also fixed:** `try-it.py` attributed its four sample bookings to your own address,
which used up the five-requests-an-hour limit before you could make your first
booking. They now come from a separate demo address.

---

## 23 November 2026 — Room Booking given the portal look

Requested: clicking Room Booking should open an interface like the portal login page.

The page is rebuilt on the portal shell — slim white header with the crest and
"← Back to website", a light grey background, one centred white card with the gold
top border, and the dark footer bar. The site's main navigation and the big maroon
hero are gone from this page: it is a task, like logging in, not a page to browse.

Everything inside is unchanged — the calendar, the three numbered steps, the code
step, the confirmation and the release page all now sit inside that one card.

| File | Change |
|---|---|
| `room-booking.html` | Rebuilt on the portal shell; loads `portal/portal.css` as well as `style.css`. The sidebar's three boxes folded into one short "How it works / Who approves it" note at the foot of the card |
| `portal/portal.css` | `.auth-card-wide` (1040px) and `.auth-lead`, so the same card can hold a calendar and a form |
| `room-booking.js` | Inner panels no longer draw their own card frames, which would have nested inside the page card |
| `style.css` | The old two-column page layout for this page removed |

---

## 23 November 2026 — Try it on your own computer

| File | What it is |
|---|---|
| `RUN-ON-YOUR-PC.md` | Step-by-step: unzip, two commands, and what to click to see the whole flow |
| `backend/try-it.py` | One command that builds a demo database: your address on the register, three portal logins, sample bookings so the calendar has colour |

Tested from a clean unzip: `python3 try-it.py you@example.com`, `python3 server.py`,
then a real two-step portal login and a real booking through the public form.

Delete `try-it.py` before the system goes live on the CIC server — it only exists
to make a demo database.

---

## 23 November 2026 — Availability calendar on the booking page

Requested: when someone opens Room Booking they should see the available dates and
slots in a calendar.

The page now opens on a month calendar for the chosen room. Days are marked free,
partly booked, fully booked or not available; choosing one lists what is booked and
offers the free stretches as buttons that fill the form in. Changing the room
reloads the month. The form was reordered into three numbered steps around it.

| File | Change |
|---|---|
| `backend/bookings.py` | `GET /api/bookings/open/month` — a month of bookings for one room, with opening hours and closed dates (past, beyond the window, blocked). No login |
| `room-booking.js` | The calendar, the free-stretch buttons and the reordered form. The room chooser moved above the calendar |
| `style.css` | Calendar grid, day states, legend and free-slot buttons, down to phone width |
| `backend/test_extras.py` | 11 more checks: the month shape, closed days, blocked dates, the booking window, and that no free stretch overlaps a confirmed booking |

**Fixed while testing:** the new code called a helper that only exists in the portal
module, which stopped the booking page loading altogether.

---

## 23 November 2026 — Room Booking moved into the header

Requested: no separate navigation tab, no card on the home page, just a small link
beside Admin Login called **Room Booking**.

| File | Change |
|---|---|
| all 12 HTML pages | The "Book a Room" tab removed from the main navigation; a `header-booking` link added beside Admin Login |
| `index.html` | The "Book a room" card above the Notice Board removed; the hero button put back to "Academic Programmes", which it replaced earlier |
| `style.css` | `.header-booking` outlined in maroon so Admin Login stays the stronger of the two; kept visible below 1100px like Admin Login, and icon-only on phones |
| `room-booking.html` | Breadcrumb renamed to "Room Booking" |

The page itself is unchanged.

---

## 23 November 2026 — Rooms given back, today's sheet, Notice Board (stage 1c)

Added from the list of suggestions, after "Do".

| Added | Where | What it does |
|---|---|---|
| Release link | confirmation e-mail → `room-booking.html?release=…` | One tap gives an unwanted room back. The link only opens a page; the slot is released when the button there is pressed, because mail scanners follow links on their own |
| No-show mark | Portal → Today, Booking requests | The office records that a room went unused; the count per person shows beside their name |
| Today's sheet | Portal → **Today** | One printable page of the day's bookings across every room, with times, phone numbers and what each booking needs. Print styles drop the menus |
| Key-holder | Admin → Rooms & halls | A custodian per room, named in every booking e-mail so people know who to ask for access |
| Put on Notice Board | Booking requests, Approvals | Turns an approved booking into an event notice on the home page, the calendar and News & Events. Asks only for the speaker |

**Files:** `backend/bookings.py` (release tokens, no-show, notice publishing, the
today endpoint, the custodian column), `portal/bookings.js` (the Today view and the
new buttons), `room-booking.js` (the release page), `style.css`, `portal/portal.css`
(print styles), `backend/test_extras.py` (35 new checks).

**Fixed on the phone**, which I had not checked before: the "outside organisation"
tick box stretched to the full width of the form like a text field, and a blank
spacer label left a gap above the opening-hours note. Both only showed below 900px.

---

## 23 November 2026 — Booking opened to the whole department (stage 1b)

Requested: anyone (student, faculty, HoD, staff, postdoc) can book from the home
page, giving roll number, name, faculty name, phone, slot and room; a confirmation
e-mail on request and a second one on approval, in the same thread; the faculty
advisor and the office copied in; one office account instead of two, with at most
two people signed in at a time.
Decided during the discussion: only people whose official address the department
already holds may book, a six-digit code confirms it is really them, seminar halls
go straight to the HoD while the office confirms classrooms, and a booking is shown
publicly under the faculty member's name.

**New files**

| File | What it is |
|---|---|
| `room-booking.html` + `room-booking.js` | The booking form on the website: form → six-digit code → done, with live availability |
| `backend/test_public.py` | 58 checks of the public flow |

**Changed files**

| File | Change | Why |
|---|---|---|
| `backend/bookings.py` | The register (who may book), the six-digit code step, four public addresses, the new requester fields, the hall-straight-to-HoD rule, CC'd and threaded e-mails, rate limits | The feature itself |
| `backend/server.py` | `send_mail` takes `cc` and `in_reply_to` and returns the Message-ID; `enforce_session_limit` with `"session_limits": {"office": 2}` in the config; student imports put the address in the contacts table | Threading and the shared office account |
| `portal/bookings.js` | Office and HoD screens show roll number, phone, advisor and where the request came from; the office's "Forward" button is gone for halls; warnings when addresses are missing | Matches the new flow |
| `index.html` and every page | "Book a Room" in the main navigation; a card and a hero button on the home page | The way in |
| `style.css`, `portal/portal.css` | Styles for the public form and the new columns | — |
| `JSON-files/6-students-current/example-msc-batch-2025.json` | Students can carry `email` | So students can be put on the register |

**Bugs found and fixed while testing**

* A request the office sent back and the asker corrected was never re-routed, so a
  hall request would have sat with the office for ever and the Head would never have
  seen it.
* Asking for a code was not rate-limited (only completed bookings were), so the form
  could have been used to send repeated e-mails to somebody else's address.
* Two sign-ins in the same second carry the same timestamp, so "sign out the oldest
  session" could have ended the wrong one. Now broken by row order as well as time.
* A student's e-mail in a batch file would have been written into `students-data.js`,
  which is published to the website. Addresses now go to the server-side contacts
  table instead and never leave the server.

**Still to come:** the office week/month grid, the public calendar for students,
repeating bookings, calendar attachments, approve links inside the e-mail, printable
slips, reminders, and an "endorse" link for the advisor.

---

## 23 November 2026 — Seminar hall & classroom booking (stage 1)

Requested: faculty apply for a seminar hall or classroom after logging in; the two
office staff check it and forward it to the HoD; the HoD approves; the faculty
member is e-mailed the confirmed slot; the office can see what is free and what is
booked; faculty can see whether their request is pending or accepted.
Agreed during the discussion: classrooms can be confirmed by the office, research
scholars may book as well as faculty, the public calendar will show full detail,
and the HoD gets a standing-approval switch of his own.

**New files**

| File | What it is |
|---|---|
| `backend/bookings.py` | The whole booking system, server side: tables, rules, approval flow, e-mails, `/api/bookings/...` |
| `portal/bookings.js` | The four portal screens: Book a room, Booking requests, Approvals, Rooms & halls |
| `backend/test_bookings.py` | 66 automated checks of the flow, permissions, clashes and e-mails |
| `BOOKINGS.md` | What the code does and how the flow works |
| `HOW-TO-UPDATE.md` | How to change photos, people, notices, jobs and rooms yourself |

**Changed files**

| File | Change | Why |
|---|---|---|
| `backend/server.py` | `EXTENSIONS` list + loop in `init_db()`; `import bookings` block near the bottom. Both marked `BOOKING SYSTEM` | Lets the add-on create its tables and register its addresses without its code being mixed into `server.py` |
| `portal/portal.js` | Five small edits: two new roles in `ROLE_LABEL`, the account role dropdown and the change-role prompt; `window.PORTAL` helper export; add-on hook before the menu is drawn | So `bookings.js` can add pages and menu entries without `portal.js` knowing about bookings |
| `portal/index.html` | Loads `bookings.js` before `portal.js`; versions bumped | — |
| `portal/portal.css` | Booking styles appended at the end, in their own marked block | — |

**Fixed along the way:** `window.PORTAL` was first placed above the `head()`
function it refers to, which threw `Cannot access 'head' before initialization`
and stopped the whole portal from loading. Moved below `head()`.

**Not included (later stages):** the office week/month grid, the public calendar
for students, repeating bookings, calendar attachments, approve links inside the
e-mail, printable slips, reminder e-mails.

---

## 23 November 2026 — Website fixes

| Asked for | Files changed | What was done |
|---|---|---|
| The department photo was not showing in the home slideshow | `gallery/dept-photo.jpg` (renamed from `Dept Photo.jpeg`), `gallery-data.js`, `main.js` | The file name had a space and capitals; it was also 4.2 MB and the slideshow waited for the whole download before showing any photo. Renamed, compressed to 662 KB, EXIF (including GPS) stripped, and the slideshow rewritten to build slides at once and attach each photo as it loads |
| Remove "Placements & Industry", add a "Placement" tab | `students.html`, `students.js`, `main.js`, all nav menus | Replaced by a Placement section with campus placement, internships, higher studies and the CDC link |
| Add a "Job Opportunity" tab | `students.html`, `students.js`, `students-data.js`, `style.css` | New section driven by `DEPT_JOBS` in `students-data.js` |
| Remove "Student Notices" | `students.html`, `students.js`, `main.js`, all nav menus | Section and menu entry removed |
| Link Admissions to the IIT KGP page | all 11 HTML files, `academics.html`, `main.js` | Academics ▸ Admissions, the home hero button and the search entry now open `iitkgp.ac.in/navpage/admissions` |
| Search only found faculty | `main.js`, all 11 HTML files | 40 faculty names were hardcoded in `main.js`. The index is now built from `people-data.js`, so scholars, postdocs, staff, adjunct and former faculty are all searchable — by name, supervisor, roll number or research area. `people-data.js` is now loaded on every page |
| Technical staff profiles looked like professors' | `people.js`, `style.css` | `type: "staff"` now gets a short static page — designation, e-mail, phone, office — like the scholar pages, with none of the faculty tabs |

Also: every `?v=` cache number was made the same (`23`). They were inconsistent
before (`style.css?v=19` on the home page, `v=21` on Students), which can leave
visitors looking at stale files after an upload.
