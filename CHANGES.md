# Change log

Newest first. Each entry says what was asked for, which files changed, and why.

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
