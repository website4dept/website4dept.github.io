# Seminar hall & classroom booking — what the code does

Stage 1 of the booking system. It lives inside the existing department portal,
so it reuses the portal's accounts, logins, e-mail and activity log.

**It needs the portal server running.** On the GitHub copy of the website the
booking pages are not there at all, because GitHub cannot run Python. To try it,
see "Running it on your own computer" below.

---

## 1. Which file does what

| File | What it is | Touch it when |
|---|---|---|
| `backend/bookings.py` | **The whole booking system, server side.** Tables, the register, rules, the approval flow, the e-mails, and every `/api/bookings/...` address. All commented. | You want to change a rule (who may book, what counts as routine, what the e-mails say) |
| `room-booking.html` + `room-booking.js` | **The booking form on the website**, open to everyone in the department. No login. Also the page that gives a room back. | You want to change the public form |
| `portal/bookings.js` | **The four portal screens.** Book a room, Booking requests, Approvals, Rooms & halls. | You want to change what a screen looks like or says |
| `portal/portal.css` | Styling. The booking part is the last block, marked `Seminar hall & classroom booking` | Colours, spacing of the booking screens |
| `backend/server.py` | The portal itself. Changed in **two places only**, both marked `BOOKING SYSTEM` | Almost never |
| `portal/portal.js` | The portal's own screens. Changed in **five small places**, listed below | Almost never |
| `portal/index.html` | Loads `bookings.js` before `portal.js` | Almost never |

### The changes made to existing files

`backend/server.py` — two marked places:
1. `EXTENSIONS = []` just before `init_db()`, and a loop inside `init_db()` that lets
   an add-on create its own tables.
2. A `try: import bookings` block near the bottom that calls `bookings.install()`.

`portal/portal.js` — five small places:
1. `ROLE_LABEL` gained `office` and `hod`.
2. The role dropdown when creating an account gained those two roles.
3. The "Change role" prompt text mentions them.
4. `window.PORTAL = {…}` exports the portal's own helpers so an add-on can use them.
5. Before the menu is drawn, any add-on in `window.PORTAL_MODULES` is asked for its
   menu entries and its pages.

**To switch the booking system off completely:** delete the `<script src="bookings.js…">`
line from `portal/index.html` and the `try: import bookings` block from `server.py`.
Everything else keeps working; the tables simply sit unused.

---

## 2. The flow

There are two ways in. Both end in the same place: the department office. And they
end there a second time, because **approval and confirmation are two separate
steps, done by two different people.**

```
  the booking form on the website            the portal, for people already signed in
  (anyone in the department)                 (faculty, scholars, postdocs, staff)
          │                                            │
          │ address checked against the register       │
          │ six-digit code e-mailed and typed back     │
          └───────────────────┬────────────────────────┘
                              ▼
                   THE DEPARTMENT OFFICE                      status: pending
                   runs the checklist (details + is the room free?)
                      ├── Return  ──► back to the asker to correct    status: returned
                      ├── Reject  ──► refused, with a reason          status: rejected
                      ├── Confirm ──► booked   (rooms that do not need the Head)
                      └── Forward ──► the Head of the Department      status: forwarded
                                        │
                                        ├── standing approval covers it
                                        │   and it is routine ──► approved at once
                                        └── otherwise, he approves or rejects
                                              │
                                              ▼
                                        status: approved, confirmed = 0
                              "Approved by the HoD — office to confirm"
                                   nothing has been sent to anybody
                                              │
                              ▼───────────────┘
                   THE DEPARTMENT OFFICE again
                   Booking requests ▸ Ready to confirm
                      └── Confirm booking ──► confirmed = 1
                                              ▼
                              the e-mail finally goes out:
                                 To:  the person who asked
                                 Cc:  the department office
                                 Cc:  the faculty advisor, if one was named
```

### Why the two steps

The Head approving means *"the department has no objection"*. The office confirming
means *"the room is really yours"*. Only the office knows about the key, the late
clash, the furniture, the other half of the morning. So the Head's approval no
longer sends anything at all, and the booking sits in the office's **Ready to
confirm** tray until somebody there presses the button.

This is true of all three ways a request can be approved — the Head pressing
Approve, the Head clearing a whole date in one click, and the standing-approval
rule applying automatically. None of them e-mails the person who asked.

**One switch changes it.** The office can tick *"Confirm as soon as the Head
approves"* at the bottom of Booking requests. With that on, an approval goes
straight out and nothing waits in the tray. It is off to begin with. The setting is
the office's own: the Head and the admin can see it, but the office is the one who
owns it (`office_auto_confirm` in the booking settings).

### Who can see what is stuck where

* **The person who asked** sees *"Approved by the HoD — office to confirm"* in
  Book a room, so they are never left guessing.
* **The office** sees two counters at the top of Booking requests: *with the Head,
  not yet approved* and *approved — ready for you to confirm*.
* **The Head** sees a table, *Approved by you — waiting for the office to confirm*,
  so he can see what has stalled without asking.
* **System health** (Admin) turns it into a warning if anything has been sitting
  unconfirmed for more than two days.

### The checklist before anything leaves the office

Forward and Confirm no longer act straight away. Both open a checklist first
(`GET /api/bookings/<id>/check`, `office_checks()` in `bookings.py`):

| | |
|---|---|
| **✕ stops it** | the room is already taken, the room is switched off, the date has passed or is beyond the booking window, the date is blocked, there is no e-mail address to write to |
| **! worth a look** | outside the normal bookable hours, longer than the usual limit, more people than the room holds, an outside organisation, equipment asked for, other requests for the same slot, earlier no-shows by this person |
| **✓ fine** | everything else, with the actual value shown — the date, the length, the address the letter will go to |

The same checks run again on the server when the button is pressed, so an open
page left over from an hour ago cannot wave anything through.

**The Head is e-mailed only when the office forwards a request.** In the code there
is a single call to `mail_forwarded()`, inside `api_office()`, so this cannot happen
by another route.

### The register — who is allowed to book

Only people the department already holds an e-mail address for. Two places:

* **people** — faculty, adjunct, postdocs, research scholars and staff. The `email`
  field of their profile, filled in by a JSON import or in the portal.
* **contacts** — students, from the portal's mailing lists, or from the `email`
  field of a student batch file at import time.

A student's address is kept in `contacts` on the server and is **never** written to
`students-data.js`, because that file is published to the website.

Until addresses are imported the form says so plainly and accepts nothing.

### The six-digit code

The form is public, so the address alone is not proof. After the form is filled in,
a six-digit code goes to that address and has to be typed back before the request is
made. Nothing is written to the database until the code is right. Codes last 15
minutes, five wrong tries cancel them, and both the number of codes and the number
of requests per address per hour are capped.

## 3. Who sees what

| Role | Menu | Can do |
|---|---|---|
| anyone on the register, not signed in | the website form | Ask for a room (with a code), and read the e-mails |
| `member` (faculty, scholars, postdocs, staff) | Book a room | Ask for a room, follow their own requests, cancel them |
| `office` | Book a room, Booking requests, Today, Booking records | Every request lands here. Forward a hall to the Head, confirm a classroom, confirm what the Head has approved, return or reject anything, withdraw a confirmed booking, mark a no-show. One shared account: two people signed in at a time, a third signs the oldest out |
| `hod` | Book a room, Approvals, Today, Booking records | Approve or reject what the office has forwarded, in bulk or a whole date at once; give standing approval; withdraw a booking |
| `admin` | Book a room, **Booking records**, Rooms & halls (plus the rest of the portal) | **Reads the record of every booking and takes no part in any of them.** Rooms, accounts, blackout dates, settings, System health |

A faculty member who is also the Head gets the `hod` role — they keep their own
profile editing, because that does not depend on the role.

### Why the admin takes no part in bookings

Deciding a booking is an authority decision, not a technical one. The point of
splitting approval from confirmation is that **two different people touch each
booking**; one account able to do both steps would remove that in a single
click. And the working screens belong to the people who work them: a queue is a
to-do list, and the admin has nothing to do on it.

So the admin's booking menu is **Booking records** — the whole history, every
state, searchable — and that is all. No Booking requests, no Approvals, no
Today's sheet. Nothing to press anywhere.

Three tiers in the code, in `bookings.py`:

| | |
|---|---|
| `may_office(u)` / `may_hod(u)` | may **act** — forward, return, refuse, approve, confirm, withdraw, no-show, publish |
| `may_desk(u)` | may open the **working screens** — the queue, Approvals, Today, the pre-forward checklist. Office and Head only |
| `may_watch(u)` | may read the **records**. Office, Head and admin |

The one setting that is not the admin's either is **standing approval**
(`auto_rooms`, `auto_until`): it decides which bookings skip the Head
altogether, so it is his to give. The ordinary rules — hours, how far ahead,
blackout dates — are configuration and the admin may change them.

If the admin really must act on a booking, the answer is to give that person the
`office` role in Accounts, which is itself recorded in the activity log. The
browser hides what they cannot use and the server refuses it as well, so a page
left open from yesterday cannot get round it.

---

## 4. Double bookings cannot happen

Two people may **ask** for the same slot — nobody is locked out by a request that
might be refused. The office and the Head see "also asked for" next to each one.

The slot is only held when a booking is **approved**, and that is the one place in
the code (`approve()`) where a booking becomes confirmed. It re-checks the slot
inside a locked database transaction (`BEGIN IMMEDIATE`), so if two approvals
happen at the same moment the second is refused with a clear message. Bulk
approval goes through exactly the same check, one request at a time.

---

## 5. The tables

`rooms` — one row per bookable room.
`needs_hod` = the Head must approve. `auto_ok` = standing approval is on for it.

`bookings` — one row per request, from "pending" to its final state.
`ref` is the reference number (`MA-B-2026-0001`) used in every e-mail.
`status` is `pending` → `forwarded` → `approved` (or `returned`, `rejected`,
`cancelled`). `confirmed` is a separate 0/1 column: `approved, confirmed = 0`
means the Head has said yes but the office has not let it out yet, and
`confirmed_by` / `confirmed_at` record who did and when. An approved booking
holds the slot whether or not it is confirmed — otherwise somebody else could be
approved into it while the office is still looking.

`booking_log` — every step on every request: who did what, when, and the note.

Settings (working hours, how far ahead, the end date for standing approval,
blocked dates, who may book) live in the portal's existing `settings` table
under the key `bookings`. The defaults are in `DEFAULTS` at the top of
`bookings.py`.

---

## 6. The e-mails

**One conversation per booking.** The first message goes **To** the person who asked,
with the **faculty advisor and the department office in CC**. Its `Message-ID` is kept
on the booking, and every later message quotes it in `In-Reply-To` and `References`
with the same subject line, so Gmail and Outlook show the whole booking as one thread
for all three people.

| When | Subject | Says |
|---|---|---|
| the form is filled in | Your booking code: 123456 | the six-digit code (to the requester only) |
| the request is made | Room booking MA-B-2026-0001 — … | received, waiting with the department office |
| the office forwards it | Room booking for your approval — … | **to the Head only**, and only at this point |
| the Head approves | Approved by the HoD - please confirm — … | **to the office only.** The person who asked is told nothing yet |
| the office confirms | *(same subject, same thread)* | CONFIRMED, with the full details and the link to give the room back |
| rejected | *(same thread)* | NOT APPROVED, with the reason |
| sent back | *(same thread)* | SENT BACK, with what to correct |
| cancelled or withdrawn | *(same thread)* | CANCELLED, and the slot is free |

A faculty member booking for themselves is their own advisor, so they are not CC'd
twice. If the advisor has no address on file yet, that copy is simply skipped and the
office screen lists who is missing.

Threading is a standard mail convention, not a guarantee: most clients group the
messages, a few group by subject instead and may show them separately.

## 7. Running it on your own computer

Nothing to install — Python 3.9 or newer is all it needs.

```bash
cd backend
python3 server.py init
python3 server.py create-admin your.email@gmail.com
python3 server.py
```

Then open **http://127.0.0.1:8000/portal/login.html**.

> On this machine use `127.0.0.1`, not `localhost`, if the browser cannot connect.

Add `gmail.com` to `allowed_email_domains` in `backend/config.json` while testing,
and take it out before the server goes live.

To try the whole flow you need four accounts. As admin, go to **Accounts** and
create them, setting the role for each:

| E-mail | Role | Who it is |
|---|---|---|
| a faculty address | `member`, linked to their profile id | asks for a room |
| two office addresses | `office` | the two staff |
| the Head's address | `hod`, linked to `adrijit-goswami` | approves |

In console mail mode the invitation link for each is printed in the terminal.

---

## 8. Tests

From the `backend` folder:

```bash
python3 test_bookings.py     # 112 checks: the portal flow, permissions, clashes,
                            # routing, standing approval, bulk approval, CSRF,
                            # the office checklist, approve-a-whole-day and the
                            # approve-then-confirm split
python3 test_public.py       # 62 checks: the register, the six-digit code, threading,
                            # CC, what the public calendar may show, rate limits,
                            # and the two-at-a-time office account
python3 test_extras.py       # 47 checks: the release link, no-shows, the Notice Board
                            # tick, the Today sheet and the availability calendar
```

221 checks in all. They run against the real server code through the real
addresses, not mocks.

Each run starts from an empty database in `backend/data-test/`, which is created
and thrown away by the test itself. Your real `backend/data/` folder is never
touched, and a run can never be upset by an earlier one.

---

## 8a. The availability calendar

The booking page opens on a **month calendar for the chosen room**, so somebody can
see what is free before filling anything in.

* Each day carries a coloured bar — **green** free, **gold** partly booked,
  **maroon** fully booked, **grey** not available (already gone, past the booking
  window, or a blocked date, with the reason shown).
* Choosing a day lists what is already booked on it, and then the **free stretches
  as buttons**. Pressing one fills the date and time into the form — an hour by
  default, which can then be changed.
* Changing the room reloads the month for that room. Months can be stepped through
  up to the booking window and no further.

It is served by `GET /api/bookings/open/month?room=…&month=YYYY-MM`, which needs no
login and returns the month's bookings day by day together with the opening hours
and the closed dates. The free stretches are worked out in the page from that one
reply, so moving between days costs nothing. A stretch shorter than 30 minutes is
not offered.

Requests that are still waiting for a decision are shown as "also asked for" but do
**not** block a slot — only a confirmed booking does.

## 8b. Rooms given back, rooms nobody used

**The confirmation e-mail carries a release link.** One tap and the slot is free
again, which is the only thing that reliably stops rooms being held and not used.

The link **opens a page**; the booking is released only when the button on that page
is pressed. That is deliberate: mail scanners at Gmail and in corporate mail systems
follow links in messages by themselves, and a link that acted on its own would
cancel bookings nobody meant to cancel. The token is single-use and stored hashed.

**The office can mark a booking as not used**, from the queue or from the Today
sheet. The count per person shows beside their name on the office screen — plain
information, not a penalty.

## 8b2. The booking records

Portal -> **Booking records** (office, Head and admin). Every booking ever made,
whatever became of it.

* **Search** covers the reference number, the name, the e-mail address, the roll
  number, the phone number, the purpose and the room name - one box, no need to
  pick which field.
* **Filter** by state, with a live count on each button: everything, confirmed,
  waiting for the office, with the Head, with the office, refused, cancelled.
  Also by room and by date range.
* **Sort** by clicking any column heading - reference, date, room, who asked,
  state - and click again to reverse it.
* **Click a row** and it opens out: the request, who asked, what happened and
  when, and a step-by-step list of every action with the person who took it,
  read straight from `booking_log`.
* 25 to a page.

`#bkrecords/42` opens one record directly, so a reference number can be passed
around as a link.

The Head's Approvals page used to carry a long "Recently decided" table. It now
shows only the last five, with a link here, because the question "what happened
to MA-B-2026-0042?" is asked months later and belongs in a record you can
search, not in a list that scrolls off the bottom of a to-do page.

In the code: `api_records()` and `api_record()` in `bookings.py`,
`viewRecords()` in `portal/bookings.js`. The sort order is chosen from a fixed
table (`RECORD_SORTS`), never built from what the browser sends, so no query can
be smuggled in through the sort parameter.

## 8c. Today's sheet

Portal → **Today** (office, HoD and admin). Every confirmed booking for one day,
room by room, with the time, what it is for, who booked it, a phone number and what
they need in the room. Free rooms are listed as free. There are previous/next day
buttons and a date picker, and a Print button: the print styles drop the menus and
buttons so what comes out of the printer is a clean one-page sheet to pin up.

Each room shows its **key-holder**, set per room in Admin → Rooms & halls. The same
line goes into every booking e-mail, so the person who booked knows who to ask for
access.

## 8d. Putting a seminar on the Notice Board

A **confirmed** booking already holds the title, room, date and time. (It has to be
confirmed by the office first: a booking the asker has not been told about yet
should not be on a public noticeboard.) **Put on Notice
Board** on the office queue or the Head's list turns it into an event notice, asking
only for the speaker's name and institution. It then appears on the home page Notice
Board, in the calendar and on News & Events, with no retyping. The roll number and
phone number are never part of the notice. A booking can only be published once, and
the screen shows when it already has been.

## 9. Not in stage 1

These were agreed for later stages:

* the office week/month grid of free and booked slots (stage 2)
* an “endorse” link in the advisor's e-mail, so a student's request needs their
  supervisor's click before the office sees it
* a waiting list, so somebody can be told when a full slot frees up
* usage figures for the Head (hours per room per month, refusals for want of space)
* a retention rule that strips phone numbers and roll numbers from old bookings
* bookings showing on the public calendar for students (stage 3), and the export
  of that data so it works on the GitHub copy too
* repeating bookings for a whole semester, calendar invitations attached to the
  approval e-mail, approve/reject links inside the e-mail, printable booking
  slips, a daily digest and reminder e-mails (stage 4)

The groundwork for the public calendar is already in place:
`GET /api/bookings/public` returns confirmed bookings as JSON, honouring both the
"show who booked it" setting and each person's "do not show my name" tick.
