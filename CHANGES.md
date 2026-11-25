# Change log

Newest first. Each entry says what was asked for, which files changed, and why.

---

## 25 November 2026 — Department forms, and three booking fixes

### New: forms people can download

The blank forms the department hands out — CL leave, sick leave, restricted
holiday, and whatever else the office issues. The office puts them up in the
portal; anybody downloads them from the website without signing in.

**Where people find them:** a small **Forms** link in the header of every page,
beside Room Booking — the same treatment you chose for the booking system.

**Where the files actually live:** `uploads/forms/`, served straight from disk
by nginx. So **the downloads keep working even if the Python portal is
stopped**, and they work on GitHub Pages with nothing running at all. The list
of forms is `forms-data.js`, written by the portal exactly the way
`people-data.js` and `notices-data.js` are.

**What the office gets** — Portal → **Forms**:

| | |
|---|---|
| Add | a title, the file (PDF or Word, up to 10 MB), and optionally a group and one line of explanation |
| Replace | a newer version of a form **keeps the same download link**, so anything already printed or e-mailed still works |
| Hide | take a form off the website without losing it — for when one is out of date and the new one has not arrived |
| Reorder | ▲ ▼; the public page keeps your order, and each group sits where its first form does |
| Delete | removes the file as well |

The public page groups the forms, shows a PDF or Word badge, the file size and
when each was last updated, and has a search box for when the list gets long.

**What is checked on upload:** the file must really be a PDF or a Word file —
the first bytes are read rather than the name trusted, and a `.docx` is opened
as a zip and must contain the `word/` folder a genuine Word document has. Under
10 MB. The stored filename is made from the title, never taken from the upload,
so a crafted name cannot escape the folder. Two forms with the same title get
`-2`, `-3`; nothing is overwritten by accident. Every add, edit, reorder and
delete is in the activity log with who did it.

Uploading is the **office** and the **admin** — this is website content like
Notices and the Gallery, not booking authority.

| File | |
|---|---|
| `backend/forms.py` | **new** — the whole feature, server side; installed the same way `bookings.py` is, so deleting one block in `server.py` switches it off |
| `backend/test_forms.py` | **new** — 43 checks |
| `forms.html`, `forms.js`, `forms-data.js` | **new** — the public page |
| `portal/forms.js` | **new** — the Forms screen |
| `FORMS.md` | **new** — the guide, including what to check when a form does not appear |
| `style.css`, `portal/portal.css` | the download list, the badges, the add/edit panel |
| `backend/server.py` | installs the module; `forms-data.js` added to Export for website |
| all 12 public pages | the **Forms** link in the header |

### Three booking fixes you asked for

* **Booking records** were already open to the office and the Head as well as
  the admin — confirmed, nothing to change.
* **"Still to come"** is a new filter button on Booking records: confirmed
  bookings from today onwards, so the Head and the office can see what is
  coming without setting a date range.
* **Booking requests** is now in the **Head's** menu as well, read-only. The
  buttons are the office's; a line at the top says so and points him at
  Approvals. He often wants to see what is on their desk before it reaches him.

### Housekeeping

* `assets/IIT_Kharagpur_Logo.svg` is not in this build. `assets/iitkgp-logo.svg`
  is the one to keep: same artwork, but with a `viewBox` added (without it the
  file cannot be scaled by CSS at all) and the empty metadata stripped, and it
  is the name the docs and the PNG build command use. **Delete the other one
  from your folder** — unzipping cannot do it for you.
* `backend/test_forms.py` points uploads at its own throwaway folder, so no test
  run can write into the live `uploads/` folder.
* All 17 HTML files are on `?v=37`.
* **313 checks** across four suites: 165 + 62 + 47 + 43.

---

## 25 November 2026 — The admin monitors through the record, and nothing else

Last time the admin lost the *power* to decide a booking, but kept the screens:
**Booking requests**, **Approvals** and **Today** were still in its menu, with
their office-and-Head wording and a Withdraw button. That still reads as booking
authority, which is what you said. Gone now.

### What the admin's Rooms menu is

| Before | Now |
|---|---|
| Book a room | Book a room |
| Booking requests | — |
| Today | — |
| Approvals | — |
| Booking records | **Booking records** |
| Rooms & halls | Rooms & halls |

**Booking records** is the whole history — every booking, every state,
searchable by reference number, name, e-mail, roll number, phone, purpose or
room, with the step-by-step story of each one. That is how the admin monitors
everything, and it is the only booking screen it has.

**Withdraw is gone from the admin too.** It was kept last time as damage
control; "the log only" settles it. If a room has to be freed in a hurry the
office does it, or that person gets the `office` role in Accounts — which is
itself recorded in the activity log.

### Three tiers instead of two

| | |
|---|---|
| `may_office()` / `may_hod()` | may **act** |
| `may_desk()` **(new)** | may open the **working screens** — queue, Approvals, Today, the checklist. Office and Head only |
| `may_watch()` | may read the **records**. Office, Head and admin |

| File | Change |
|---|---|
| `backend/bookings.py` | new `may_desk()` and `require_desk()`; `api_queue`, `api_hod`, `api_today`, `api_office_check` and `api_revoke` moved to it; `may_watch()` now covers the records alone; the refusal message points the admin at Booking records |
| `portal/bookings.js` | the admin's menu loses Booking requests, Today and Approvals; the records page carries a note explaining the account's part and how to grant the `office` role |
| `backend/test_bookings.py` | **165 checks** (was 161) — the admin is refused on all four screens and on Withdraw, and the office is checked to still have them |
| `BOOKINGS.md`, `HOW-TO-UPDATE.md` | roles table and reasoning rewritten |
| all 17 HTML files | `?v=36` |

Unchanged: the admin still owns rooms, accounts, blackout dates, the ordinary
booking rules, Export, Backup & restore and System health. Standing approval
stays the Head's.

---

## 24 November 2026 (evening) — The admin can watch, but not decide

You noticed the admin account could reject a booking and asked whether it should
be able to. It should not, and now it cannot.

### The reasoning

Deciding a booking is an authority decision, not a technical one. The whole
point of splitting approval from confirmation is that **two different people
touch each booking** — one account able to do both steps removes that control in
a single click. The person who can reset passwords and edit room records is not
the person the department has asked to decide who gets the seminar hall.

### What changed

`may_office()` and `may_hod()` used to return true for `admin` as well. They now
mean *may act as* and cover only the real role; a new `may_watch()` covers the
screens that only show things.

| The admin can | The admin cannot |
|---|---|
| see the office queue, Approvals, Today and the booking records | forward, return, refuse, approve, confirm |
| open the pre-forward checklist, as **See the checklist** (nothing to press) | clear a whole date, or approve several at once |
| **withdraw** a confirmed booking | mark a no-show, or put a booking on the Notice Board |
| change the booking rules — hours, how far ahead, blackout dates | give the Head's **standing approval** (`auto_rooms`, `auto_until`) |
| rooms, accounts, System health, everything else as before | |

**Withdraw was kept on purpose.** It frees a room rather than claiming one, and
everyone involved is e-mailed, so it cannot be done quietly — which is exactly
what you want available when a clash turns up at short notice.

**Standing approval was taken away** because it decides which bookings skip the
Head altogether. That is his to give, not the system keeper's.

Each of those pages now carries a note at the top explaining the limit, and the
buttons are simply not drawn. The server checks again on every request, so a
page left open from yesterday cannot get round it.

| File | Change |
|---|---|
| `backend/bookings.py` | `may_office` / `may_hod` narrowed; new `may_watch()`, `require_watch()`, `no_entry()`; read endpoints moved to `require_watch`; `revoke` widened to the admin; standing approval restricted to the Head; `api_config` returns `watch_only` |
| `portal/bookings.js` | `canOffice()`, `canHod()`, `watchOnly()`, `watchNote()`; every decision button drawn only for the role that may press it; the checklist gained a read-only form |
| `portal/portal.css` | `.bk-watch`, the note at the top of a page you may read but not act on |
| `backend/test_bookings.py` | **161 checks** (was 138) — 23 of them on exactly what the admin may and may not do |
| `BOOKINGS.md`, `HOW-TO-UPDATE.md` | a roles table that now matches the code, and the reasoning |
| all 17 HTML files | `?v=35` |

If somebody needs to act on bookings, give them the `office` role in
Portal → Accounts rather than the admin one. That change is itself recorded in
the activity log.

---

## 24 November 2026 (later still) — Booking records: search by reference number

You looked at "Recently decided" on the Head's page and said it was not the
useful thing — what is wanted is a way to see **all** past approvals, sorted,
and searched by reference number. Agreed, and done.

### The new screen

Portal → **Booking records**, for the office, the Head and the admin. Every
booking ever made, whatever became of it.

| | |
|---|---|
| **Search** | one box covering the reference number, the name, the e-mail address, the roll number, the phone number, the purpose and the room name |
| **Filter** | by state, each button carrying a live count — everything, confirmed, waiting for the office, with the Head, with the office, refused, cancelled — and by room, and by date range |
| **Sort** | click any column heading (reference, date, room, who asked, state); click again to reverse |
| **Open a row** | the whole record: the request, who asked, what happened and when, and a step-by-step list of every action with the person who took it |
| **Link to one** | `#bkrecords/42` opens that record directly |

### What changed on the Head's page

"Recently decided" is now **the last five only**, with a link to the records.
The question it was trying to answer — "what happened to MA-B-2026-0042?" — gets
asked months later, and belongs in something you can search rather than a list
that scrolls off the bottom of a to-do page.

Two buttons there were also offering something the server would refuse: **Put on
Notice Board** appeared on bookings the office had not confirmed yet. It is now
replaced by the words *"the office has still to confirm it"* until it is.

| File | Change |
|---|---|
| `backend/bookings.py` | new `api_records()` and `api_record()`, `record_query()`, `RECORD_FILTERS`, `RECORD_SORTS`, `PER_PAGE`; two new routes |
| `portal/bookings.js` | new `viewRecords()` and `recordDetail()`, registered as `bkrecords` and added to the menu; the Head's recent list trimmed to five; the Notice Board button guarded |
| `portal/portal.css` | the search bar, filter buttons, sortable headings, the opened-out record and its step-by-step list |
| `backend/test_bookings.py` | **138 checks** (was 112) — search by every field, each filter, both sort directions, paging past the end, one record in full, and that a made-up sort order is ignored rather than run |
| `BOOKINGS.md`, `HOW-TO-UPDATE.md` | new sections |
| all 17 HTML files | `?v=34` |

**On the sort order being safe:** the column to sort by is picked from a fixed
table in the code, never built from what the browser sends. There is a test that
sends `sort=nonsense';DROP TABLE bookings;--` and checks that it is quietly
ignored and the table is still there.

---

## 24 November 2026 (later) — The Institute logo is now our own file

You sent the logo, so it is in place and the last outside image has gone.

| File | Change |
|---|---|
| `assets/iitkgp-logo.png` | **new** — the crest at 204 × 229 with a transparent background, 8 KB. This is what every page shows. |
| `assets/iitkgp-logo.svg` | **new** — the vector original you sent, with a `viewBox` added so it scales, and the empty metadata block stripped. Keep it for posters, slides and anything printed. |
| `footer.js`, `room-booking.js`, `portal/portal.js` | the "if the logo is missing, fetch it from NPTEL" fallback was deleted. There is nothing to fall back to any more. |
| `backend/server.py`, `deploy/nginx-site.conf`, `deploy/apache-site.conf` | `img-src` in the security policy went from `'self' data: https://nptel.iitkgp.ac.in` to `'self' data:` — **the site now refuses images from any outside server at all** |
| `portal/portal.css` | `object-fit: contain` on the portal header logo, so the crest keeps its shape in the 52-pixel box |
| `assets/README.md`, `HOW-TO-UPDATE.md`, `SECURITY.md` | rewritten to match |
| all 17 HTML files | `?v=33` |

No HTML changed for the logo itself — the pages were already asking for
`assets/iitkgp-logo.png`; the file simply exists now.

Also in this batch: `backend/try-it.py` now seeds **one sample booking in each
state** — two confirmed, one approved and waiting in the office's "Ready to
confirm", one sitting with the Head, one just arrived on the office desk — so
every screen has something on it the first time you open it and the whole
approve-then-confirm flow is visible without creating it all by hand.

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
