#!/usr/bin/env python3
"""
Seminar hall & classroom booking  -  Department of Mathematics, IIT Kharagpur
=============================================================================

This file is an ADD-ON to server.py.  Nothing here changes how the rest of the
portal works: server.py calls install() once at start-up, this module creates
its own tables and registers its own /api/bookings/... addresses.

If you ever want to switch the booking system off, delete the two lines in
server.py marked "BOOKING SYSTEM" and this file.  Everything else keeps working.

WHO DOES WHAT  (the flow)
-------------------------
  faculty / research scholar   fills the request form          -> status "pending"
  the two office staff         check it, then either
                                 - return it for correction    -> "returned"
                                 - forward it to the HoD       -> "forwarded"
                                 - confirm it themselves       -> "approved"
                                   (only for rooms whose "HoD approval" tick is off)
  the Head of the Department   approves or rejects             -> "approved" / "rejected"

  If the HoD has switched AUTO-APPROVE on for that room and the request is
  routine (see auto_check below), forwarding approves it at once and the HoD
  still sees it in his list, marked "auto".

WHO CAN SEE WHAT
----------------
  role "member"  (faculty, scholars)  own requests only
  role "office"  (the two staff)      the queue + every booking + the room grid
  role "hod"     (Head)               what the office forwarded + settings + everything
  role "admin"                        all of the above, plus adding/editing rooms

The tables are rooms / bookings / booking_log.  Settings (working hours, how far
ahead people may book, the HoD's auto-approve dates) live in the portal's own
`settings` table under the key "bookings" - see DEFAULTS below.
"""

import hmac
import json
import re
import secrets
import sys
from datetime import datetime, timedelta

S = None            # the server module; set by install()
NAME = "bookings"

# ---------------------------------------------------------------------------
# 1. Database
# ---------------------------------------------------------------------------
SCHEMA = """
CREATE TABLE IF NOT EXISTS rooms(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  kind TEXT NOT NULL DEFAULT 'classroom',      -- 'hall' or 'classroom'
  capacity INTEGER NOT NULL DEFAULT 0,
  facilities TEXT NOT NULL DEFAULT '',         -- free text: "Projector, AC, Mic"
  location TEXT NOT NULL DEFAULT '',
  custodian TEXT NOT NULL DEFAULT '',          -- who holds the key / opens the room
  needs_hod INTEGER NOT NULL DEFAULT 1,        -- 1 = the HoD must approve
  auto_ok INTEGER NOT NULL DEFAULT 0,          -- 1 = HoD lets routine requests through
  active INTEGER NOT NULL DEFAULT 1,
  sort INTEGER NOT NULL DEFAULT 0,
  created TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS bookings(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ref TEXT NOT NULL DEFAULT '',
  room_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  person_id TEXT,
  on_date TEXT NOT NULL,                       -- YYYY-MM-DD
  t_start TEXT NOT NULL,                       -- HH:MM  (24-hour)
  t_end TEXT NOT NULL,
  title TEXT NOT NULL,                         -- shown on the public calendar
  purpose TEXT NOT NULL DEFAULT '',            -- internal reason / details
  attendees INTEGER NOT NULL DEFAULT 0,
  needs TEXT NOT NULL DEFAULT '',              -- projector, mic, extra chairs...
  outside INTEGER NOT NULL DEFAULT 0,          -- 1 = outside organisation involved
  hide_name INTEGER NOT NULL DEFAULT 0,        -- 1 = do not show my name publicly
  -- who asked. Filled from the register for a public request, from the account for a portal one.
  requester_name TEXT NOT NULL DEFAULT '',
  requester_email TEXT NOT NULL DEFAULT '',
  roll TEXT NOT NULL DEFAULT '',               -- roll number (students and scholars)
  phone TEXT NOT NULL DEFAULT '',              -- office and HoD only, never public
  advisor_id TEXT NOT NULL DEFAULT '',         -- the faculty member's profile id, when known
  advisor_name TEXT NOT NULL DEFAULT '',       -- supervisor / mentor / faculty advisor
  advisor_email TEXT NOT NULL DEFAULT '',
  thread_msgid TEXT NOT NULL DEFAULT '',       -- Message-ID of the first mail, to keep one thread
  source TEXT NOT NULL DEFAULT 'portal',       -- 'portal' (signed in) or 'public' (home page form)
  release_hash TEXT NOT NULL DEFAULT '',       -- lets the booker give the room back from the e-mail
  no_show INTEGER NOT NULL DEFAULT 0,          -- the office saw that nobody used the room
  notice_id INTEGER,                           -- the Notice Board entry made from this booking
  status TEXT NOT NULL DEFAULT 'pending',      -- pending|returned|forwarded|approved|rejected|cancelled
  auto INTEGER NOT NULL DEFAULT 0,             -- approved by the auto-approve rule
  forwarded_by INTEGER, forwarded_at TEXT,
  decided_by INTEGER, decided_at TEXT, decision_note TEXT NOT NULL DEFAULT '',
  created TEXT NOT NULL, updated TEXT
);
CREATE INDEX IF NOT EXISTS idx_bk_slot ON bookings(room_id, on_date, status);
CREATE INDEX IF NOT EXISTS idx_bk_user ON bookings(user_id, status);
CREATE TABLE IF NOT EXISTS booking_codes(
  ticket_hash TEXT PRIMARY KEY,
  code_hash TEXT NOT NULL,
  payload TEXT NOT NULL,                       -- the filled-in form, as JSON
  email TEXT NOT NULL,
  expires TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  created TEXT NOT NULL,
  ip TEXT NOT NULL DEFAULT ''
);
CREATE TABLE IF NOT EXISTS booking_log(
  id INTEGER PRIMARY KEY AUTOINCREMENT, booking_id INTEGER NOT NULL,
  at TEXT NOT NULL, actor TEXT NOT NULL DEFAULT '', action TEXT NOT NULL, note TEXT NOT NULL DEFAULT ''
);
"""

# Rooms created the first time the system starts, so there is something to try.
# Change them in the portal: Admin -> Rooms & halls.  Nothing here is fixed in code.
SEED_ROOMS = [
    ("Seminar Hall",        "hall",      120, "Projector, AC, Mic, Podium", "Department of Mathematics", 1),
    ("Committee Room",      "hall",       30, "Projector, AC",              "Department of Mathematics", 1),
    ("Classroom NC-141",    "classroom",  70, "Projector",                  "Nalanda Complex",           1),
    ("Classroom NC-142",    "classroom",  70, "Projector",                  "Nalanda Complex",           1),
    ("Tutorial Room MA-1",  "classroom",  25, "Whiteboard",                 "Department of Mathematics", 1),
]
# the office is the usual key-holder; change it per room in Admin -> Rooms & halls
SEED_CUSTODIAN = "Department office" 

# Everything here can be changed in the portal (HoD / Admin -> Booking settings).
DEFAULTS = {
    "day_start": "08:00",        # earliest a room may be booked
    "day_end": "20:00",          # latest
    "max_hours": 4,              # longest single booking the auto-rule will pass
    "max_days_ahead": 120,       # how far ahead anyone may book
    "buffer_min": 0,             # gap forced between two bookings of the same room
    "requester_types": ["faculty", "adjunct", "postdoc", "scholar", "staff"],  # may book from inside the portal
    "auto_until": "",            # HoD: auto-approve only up to this date ("" = no limit)
    "tz_offset_min": 330,        # India Standard Time, for working out "today"
    "blackout": [],              # [{"from":"2026-12-24","to":"2027-01-01","reason":"Institute holidays"}]
    "public_show_name": True,    # show who booked it on the public calendar
    "public_booking": True,      # the booking form on the website, open to everyone on the register
    "code_minutes": 15,          # how long the six-digit code stays valid
    "code_max_attempts": 5,
    "max_per_hour": 5,           # most requests one person may send in an hour
    "student_domains": ["iitkgp.ac.in", "kgpian.iitkgp.ac.in"],
}

STATUS_LABEL = {"pending": "With the office", "returned": "Returned for correction",
                "forwarded": "With the HoD", "approved": "Approved", "rejected": "Rejected",
                "cancelled": "Cancelled"}


NEW_COLUMNS = [
    ("requester_name", "TEXT NOT NULL DEFAULT ''"), ("requester_email", "TEXT NOT NULL DEFAULT ''"),
    ("roll", "TEXT NOT NULL DEFAULT ''"), ("phone", "TEXT NOT NULL DEFAULT ''"),
    ("advisor_id", "TEXT NOT NULL DEFAULT ''"), ("advisor_name", "TEXT NOT NULL DEFAULT ''"),
    ("advisor_email", "TEXT NOT NULL DEFAULT ''"), ("thread_msgid", "TEXT NOT NULL DEFAULT ''"),
    ("source", "TEXT NOT NULL DEFAULT 'portal'"), ("release_hash", "TEXT NOT NULL DEFAULT ''"),
    ("no_show", "INTEGER NOT NULL DEFAULT 0"), ("notice_id", "INTEGER"),
]
NEW_ROOM_COLUMNS = [("custodian", "TEXT NOT NULL DEFAULT ''")]


def init_db():
    """Called by server.init_db(). Safe to run again and again."""
    S.db().executescript(SCHEMA)
    # a database made before the public booking form was added gains the new columns
    have = {r["name"] for r in S.q("PRAGMA table_info(bookings)").fetchall()}
    for col, decl in NEW_COLUMNS:
        if col not in have:
            S.q("ALTER TABLE bookings ADD COLUMN {} {}".format(col, decl))
    have = {r["name"] for r in S.q("PRAGMA table_info(rooms)").fetchall()}
    for col, decl in NEW_ROOM_COLUMNS:
        if col not in have:
            S.q("ALTER TABLE rooms ADD COLUMN {} {}".format(col, decl))
    if S.q1("SELECT COUNT(*) c FROM rooms")["c"] == 0:
        for i, (name, kind, cap, fac, loc, hod) in enumerate(SEED_ROOMS):
            S.q("INSERT INTO rooms(name,kind,capacity,facilities,location,custodian,needs_hod,sort,created)"
                " VALUES(?,?,?,?,?,?,?,?,?)",
                (name, kind, cap, fac, loc, SEED_CUSTODIAN, hod, i, S.iso(S.now())))


def cfg():
    c = dict(DEFAULTS)
    saved = S.get_setting("bookings", {}) or {}
    if isinstance(saved, dict):
        c.update(saved)
    return c


def save_cfg(changes):
    c = S.get_setting("bookings", {}) or {}
    c.update(changes)
    S.set_setting("bookings", c)


# ---------------------------------------------------------------------------
# 2. Small helpers
# ---------------------------------------------------------------------------
def today_local():
    """Today's date in the department's own time zone, not UTC."""
    return (S.now() + timedelta(minutes=cfg()["tz_offset_min"])).strftime("%Y-%m-%d")


def mins(hhmm):
    h, m = hhmm.split(":")
    return int(h) * 60 + int(m)


def hhmm(value):
    value = str(value or "").strip()
    if not value or len(value) < 4 or ":" not in value:
        raise S.ApiError(400, "Please give the time as HH:MM, for example 14:30.")
    h, _, m = value.partition(":")
    try:
        h, m = int(h), int(m[:2])
    except ValueError:
        raise S.ApiError(400, "Please give the time as HH:MM, for example 14:30.")
    if not (0 <= h < 24 and 0 <= m < 60):
        raise S.ApiError(400, "That is not a real time of day.")
    return "{:02d}:{:02d}".format(h, m)


def ymd(value):
    value = str(value or "").strip()
    try:
        datetime.strptime(value, "%Y-%m-%d")
    except ValueError:
        raise S.ApiError(400, "Please give the date as YYYY-MM-DD.")
    return value


def pretty_date(d):
    try:
        return datetime.strptime(d, "%Y-%m-%d").strftime("%d %b %Y (%A)")
    except Exception:
        return d


def text(value, limit, field):
    value = str(value or "").strip()
    if len(value) > limit:
        raise S.ApiError(400, "{} is too long (limit {} characters).".format(field, limit))
    return value


def room_row(rid):
    r = S.q1("SELECT * FROM rooms WHERE id=?", (rid,))
    if not r:
        raise S.ApiError(404, "That room is not on the list.")
    return r


def booking_row(bid):
    b = S.q1("SELECT * FROM bookings WHERE id=?", (bid,))
    if not b:
        raise S.ApiError(404, "That booking no longer exists.")
    return b


def log(bid, actor, action, note=""):
    S.q("INSERT INTO booking_log(booking_id,at,actor,action,note) VALUES(?,?,?,?,?)",
        (bid, S.iso(S.now()), actor or "", action, (note or "")[:500]))


def user_label(uid):
    u = S.q1("SELECT * FROM users WHERE id=?", (uid,))
    if not u:
        return ""
    p = S.get_person(u["person_id"]) if u["person_id"] else None
    return (u["name"] or (p or {}).get("name") or u["email"])


def role_emails(role):
    return [r["email"] for r in S.q("SELECT email FROM users WHERE role=? AND active=1", (role,)).fetchall()]


def notify(to, subject, body):
    """E-mail that must never break the booking it is reporting on."""
    for address in ([to] if isinstance(to, str) else to):
        if not address:
            continue
        try:
            S.send_mail(address, subject, body)
        except Exception as e:                                  # pragma: no cover
            print("[bookings] could not e-mail {}: {}".format(address, e))


# ---------------------------------------------------------------------------
# 2b. The register: who is allowed to book
# ---------------------------------------------------------------------------
# Anyone from the department may book - faculty, research scholars, postdocs,
# staff and students - but only with the official e-mail address the department
# already holds for them. Two places hold addresses:
#     people   - faculty, adjunct, postdoc, scholar, staff (from people-data.js
#                or an admin JSON import; the "email" field)
#     contacts - students and alumni (the portal's mailing lists: name, e-mail)
# Nobody whose address is not in one of those two can book. Until the addresses
# are imported the form will say so plainly rather than failing silently.

def clean_email(value):
    return str(value or "").strip().lower()


def find_registered(email):
    """
    Look an address up in the register.
    Returns a dict describing the person, or None if the address is not on file.
    """
    email = clean_email(email)
    if not email or "@" not in email:
        return None
    for r in S.q("SELECT id,data FROM people").fetchall():
        try:
            p = json.loads(r["data"])
        except Exception:
            continue
        if clean_email(p.get("email")) != email:
            continue
        if p.get("status") not in ("current", None, ""):
            return None                                   # former staff / alumni cannot book
        sup = p.get("supervisor") and S.get_person(p.get("supervisor"))
        return {"kind": p.get("type", "member"), "person_id": r["id"], "name": p.get("name", ""),
                "roll": p.get("roll", ""), "email": email,
                "advisor_id": p.get("supervisor") or "", "advisor_name": (sup or {}).get("name", ""),
                "advisor_email": clean_email((sup or {}).get("email"))}
    c = S.q1("SELECT name,grp FROM contacts WHERE lower(email)=?", (email,))
    if c:                                                 # a student on one of the mailing lists
        return {"kind": "student", "person_id": "", "name": c["name"] or "", "roll": "", "email": email,
                "advisor_id": "", "advisor_name": "", "advisor_email": "", "list": c["grp"]}
    return None


def register_size():
    """How many people could actually book. Sample and former profiles do not count."""
    n = S.q1("SELECT COUNT(*) c FROM contacts")["c"]
    for r in S.q("SELECT data FROM people").fetchall():
        try:
            p = json.loads(r["data"])
        except Exception:
            continue
        if p.get("status") == "current" and clean_email(p.get("email")):
            n += 1
    return n


def faculty_choices():
    """The advisor dropdown: every current faculty member, with their address if we hold one."""
    out = []
    for r in S.q("SELECT id,data FROM people ORDER BY sort, id").fetchall():
        try:
            p = json.loads(r["data"])
        except Exception:
            continue
        if p.get("type") in ("faculty", "adjunct") and p.get("status") == "current":
            out.append({"id": r["id"], "name": p.get("name", ""), "has_email": bool(clean_email(p.get("email")))})
    return out


def advisor_for(person, chosen_id, typed_name):
    """
    Work out the supervisor / mentor / faculty advisor to put on the request and
    copy on the e-mails. A faculty member is their own advisor.
    """
    if person["kind"] in ("faculty", "adjunct"):
        return {"id": person["person_id"], "name": person["name"], "email": person["email"]}
    if chosen_id:
        p = S.get_person(chosen_id)
        if p:
            return {"id": chosen_id, "name": p.get("name", ""), "email": clean_email(p.get("email"))}
    if person.get("advisor_id"):                          # scholars already have one on file
        return {"id": person["advisor_id"], "name": person["advisor_name"], "email": person["advisor_email"]}
    return {"id": "", "name": text(typed_name, 120, "The supervisor's name"), "email": ""}


def missing_addresses():
    """Faculty with no address on file - their advisor e-mails cannot be sent yet."""
    return [f["name"] for f in faculty_choices() if not f["has_email"]]


# ---------------------------------------------------------------------------
# 3. Who may do what
# ---------------------------------------------------------------------------
def may_office(u):
    return u["role"] in ("office", "admin")


def may_hod(u):
    return u["role"] in ("hod", "admin")


def require_office(req):
    u = S.require_ready_user(req)
    if not may_office(u):
        raise S.ApiError(403, "This section is for the department office.")
    return u


def require_hod(req):
    u = S.require_ready_user(req)
    if not may_hod(u):
        raise S.ApiError(403, "This section is for the Head of the Department.")
    return u


def may_request(u):
    """Faculty and research scholars ask for rooms; the list is a setting."""
    if not u["person_id"]:
        return False
    p = S.get_person(u["person_id"])
    if not p or p.get("status") != "current":
        return False
    return p.get("type") in cfg()["requester_types"]


# ---------------------------------------------------------------------------
# 4. Clashes
# ---------------------------------------------------------------------------
BLOCKING = ("approved",)            # a confirmed booking holds the slot
WAITING = ("pending", "forwarded")  # still being decided - shown as "also asked for"


def overlaps(a_start, a_end, b_start, b_end, buffer_min=0):
    return mins(a_start) < mins(b_end) + buffer_min and mins(b_start) < mins(a_end) + buffer_min


def clashes(room_id, on_date, t_start, t_end, statuses, ignore_id=None):
    out = []
    rows = S.q("SELECT * FROM bookings WHERE room_id=? AND on_date=? AND status IN ({})".format(
        ",".join("?" * len(statuses))), (room_id, on_date) + tuple(statuses)).fetchall()
    buf = int(cfg()["buffer_min"])
    for r in rows:
        if ignore_id and r["id"] == ignore_id:
            continue
        if overlaps(t_start, t_end, r["t_start"], r["t_end"], buf):
            out.append(r)
    return out


def in_blackout(on_date):
    for b in cfg()["blackout"] or []:
        if str(b.get("from", "")) <= on_date <= str(b.get("to", b.get("from", ""))):
            return b.get("reason") or "the department calendar"
    return None


def check_slot(room, on_date, t_start, t_end, ignore_id=None):
    """Everything that makes a slot impossible, checked in one place."""
    c = cfg()
    if mins(t_end) <= mins(t_start):
        raise S.ApiError(400, "The finishing time has to be after the starting time.")
    if on_date < today_local():
        raise S.ApiError(400, "That date has already passed.")
    limit = (datetime.strptime(today_local(), "%Y-%m-%d") + timedelta(days=int(c["max_days_ahead"]))).strftime("%Y-%m-%d")
    if on_date > limit:
        raise S.ApiError(400, "Rooms can be booked up to {} days ahead (until {}).".format(c["max_days_ahead"], limit))
    if mins(t_start) < mins(c["day_start"]) or mins(t_end) > mins(c["day_end"]):
        raise S.ApiError(400, "Rooms can be booked between {} and {}.".format(c["day_start"], c["day_end"]))
    reason = in_blackout(on_date)
    if reason:
        raise S.ApiError(400, "That date is blocked ({}).".format(reason))
    if not room["active"]:
        raise S.ApiError(400, "That room is not available for booking at the moment.")
    taken = clashes(room["id"], on_date, t_start, t_end, BLOCKING, ignore_id)
    if taken:
        t = taken[0]
        raise S.ApiError(409, "{} is already booked on {} from {} to {}.".format(
            room["name"], pretty_date(on_date), t["t_start"], t["t_end"]))


# ---------------------------------------------------------------------------
# 5. The HoD's auto-approve rule
# ---------------------------------------------------------------------------
def auto_check(b, room):
    """
    Can this request be approved without the HoD looking at it?
    Returns (True, "") or (False, "the reason it still needs him").
    Only routine requests pass: everything unusual goes to the HoD.
    """
    c = cfg()
    if not room["auto_ok"]:
        return False, "auto-approve is off for this room"
    if c["auto_until"] and b["on_date"] > c["auto_until"]:
        return False, "beyond the auto-approve period (ends {})".format(c["auto_until"])
    if b["outside"]:
        return False, "an outside organisation is involved"
    hours = (mins(b["t_end"]) - mins(b["t_start"])) / 60.0
    if hours > float(c["max_hours"]):
        return False, "longer than {} hours".format(c["max_hours"])
    if room["capacity"] and b["attendees"] and b["attendees"] > room["capacity"]:
        return False, "more people than the room holds"
    if clashes(room["id"], b["on_date"], b["t_start"], b["t_end"], BLOCKING, b["id"]):
        return False, "it clashes with a confirmed booking"
    return True, ""


# ---------------------------------------------------------------------------
# 6. Turning rows into what the browser shows
# ---------------------------------------------------------------------------
def room_public(r):
    return {"id": r["id"], "name": r["name"], "kind": r["kind"], "capacity": r["capacity"],
            "facilities": r["facilities"], "location": r["location"], "custodian": r["custodian"],
            "needs_hod": bool(r["needs_hod"]), "auto_ok": bool(r["auto_ok"]),
            "active": bool(r["active"]), "sort": r["sort"]}


def booking_public(b, who=False):
    r = S.q1("SELECT name,kind FROM rooms WHERE id=?", (b["room_id"],))
    out = {"id": b["id"], "ref": b["ref"], "room": (r or {})["name"] if r else "", "room_id": b["room_id"],
           "kind": (r or {})["kind"] if r else "", "date": b["on_date"], "start": b["t_start"], "end": b["t_end"],
           "title": b["title"], "purpose": b["purpose"], "attendees": b["attendees"], "needs": b["needs"],
           "outside": bool(b["outside"]), "hide_name": bool(b["hide_name"]),
           "status": b["status"], "status_label": STATUS_LABEL.get(b["status"], b["status"]),
           "auto": bool(b["auto"]), "note": b["decision_note"], "created": b["created"]}
    out["advisor"] = b["advisor_name"]
    if who:
        # office and HoD only: the real person, their roll number and phone
        out["by"] = b["requester_name"] or user_label(b["user_id"])
        out["email"] = b["requester_email"] or (S.q1("SELECT email FROM users WHERE id=?", (b["user_id"],)) or {"email": ""})["email"]
        out["roll"] = b["roll"]
        out["phone"] = b["phone"]
        out["source"] = b["source"]
        out["advisor_notified"] = bool(b["advisor_email"])
        p = S.get_person(b["person_id"]) if b["person_id"] else None
        if p:
            out["by_type"] = p.get("type", "")
        out["supervisor"] = b["advisor_name"]
        out["no_show"] = bool(b["no_show"])
        out["no_shows"] = no_show_count(b["requester_email"])
        out["on_board"] = bool(b["notice_id"])
        out["custodian"] = (S.q1("SELECT custodian FROM rooms WHERE id=?", (b["room_id"],)) or {"custodian": ""})["custodian"]
    return out


def details_text(b, room):
    """The block of details repeated in every e-mail."""
    lines = [
        "Reference:  " + b["ref"],
        "Room:       " + room["name"] + (" ({})".format(room["location"]) if room["location"] else ""),
        "Date:       " + pretty_date(b["on_date"]),
        "Time:       {} to {}".format(b["t_start"], b["t_end"]),
        "Purpose:    " + (b["title"] or "-"),
    ]
    if b["purpose"]:
        lines.append("Details:    " + b["purpose"])
    if b["attendees"]:
        lines.append("Expected:   {} people".format(b["attendees"]))
    if b["needs"]:
        lines.append("Needs:      " + b["needs"])
    lines.append("Requested by: " + who_line(b))
    if b["advisor_name"]:
        lines.append("Faculty advisor: " + b["advisor_name"])
    if room["custodian"]:
        lines.append("Key / access: " + room["custodian"])
    return "\n".join(lines)


# ---------------------------------------------------------------------------
# 7. E-mails
# ---------------------------------------------------------------------------
# One conversation per booking. The first e-mail goes TO the person who asked,
# with the faculty advisor and the department office in CC. Its Message-ID is
# kept on the booking, so the decision e-mail joins the same thread for all
# three. A missing address is skipped, never an error.

def office_addresses():
    return role_emails("office")


def thread_people(b):
    """to, cc for every e-mail about this booking."""
    to = b["requester_email"] or (S.q1("SELECT email FROM users WHERE id=?", (b["user_id"],)) or {"email": ""})["email"]
    cc = []
    if b["advisor_email"] and clean_email(b["advisor_email"]) != clean_email(to):
        cc.append(b["advisor_email"])
    for a in office_addresses():
        if clean_email(a) != clean_email(to) and a not in cc:
            cc.append(a)
    return to, cc


def thread_subject(b, room):
    return "Room booking {} - {} on {}".format(b["ref"], room["name"], pretty_date(b["on_date"]))


def who_line(b):
    bits = [b["requester_name"] or user_label(b["user_id"])]
    if b["roll"]:
        bits.append("Roll no. " + b["roll"])
    if b["phone"]:
        bits.append("Phone " + b["phone"])
    return ", ".join(bits)


def mail_submitted(b, room):
    """First e-mail: received, waiting for approval. Keeps the Message-ID for the thread."""
    to, cc = thread_people(b)
    if not to:
        return
    with_whom = "the Head of the Department" if room["needs_hod"] else "the department office"
    body = ("This room request has been received and is waiting for approval by {}.\n\n".format(with_whom)
            + details_text(b, room) +
            "\n\nNothing is booked yet. A second e-mail will follow in this same conversation\n"
            "as soon as it has been decided.\n")
    if b["advisor_email"]:
        body += "\nThe faculty advisor named on this request has been copied in.\n"
    try:
        msg_id = S.send_mail(to, thread_subject(b, room), body, cc=cc)
        if msg_id:
            S.q("UPDATE bookings SET thread_msgid=? WHERE id=?", (msg_id, b["id"]))
    except Exception as e:                                           # pragma: no cover
        print("[bookings] could not e-mail {}: {}".format(to, e))


def mail_decided(b, room, approved, note, auto=False):
    """Second e-mail, in the same conversation as the first."""
    to, cc = thread_people(b)
    if not to:
        return
    if approved:
        body = ("CONFIRMED. The room is now booked.\n\n" + details_text(b, room) +
                ("\n\nNote: " + note if note else "") +
                ("\n\n(Approved automatically under the Head's standing approval for this room.)" if auto else "") +
                "\n\nIF YOU NO LONGER NEED THE ROOM, please give it back so that somebody else\n"
                "can use the slot:\n   " + release_link(b) + "\n")
    else:
        body = ("NOT APPROVED. This request has been refused.\n\n" + details_text(b, room) +
                "\n\nReason: " + (note or "no reason given") +
                "\n\nA fresh request can be made for another room or another time.\n")
    notify_thread(b, to, cc, thread_subject(b, room), body)


def mail_returned(b, room, note):
    to, cc = thread_people(b)
    if not to:
        return
    notify_thread(b, to, cc, thread_subject(b, room),
                  "SENT BACK. The department office needs something corrected before this can go further.\n\n"
                  + details_text(b, room) + "\n\nWhat to change: " + (note or "please check the details") +
                  "\n\nPlease send a fresh request with the correction.\n")


def mail_cancelled(b, room, by, note, to_staff=True):
    to, cc = thread_people(b)
    if not to:
        return
    notify_thread(b, to, cc, thread_subject(b, room),
                  "CANCELLED by {}. The slot is free again.\n\n".format(by) + details_text(b, room) +
                  ("\n\nReason: " + note if note else "") + "\n")


def notify_thread(b, to, cc, subject, body):
    try:
        S.send_mail(to, subject, body, cc=cc, in_reply_to=b["thread_msgid"] or None)
    except Exception as e:                                           # pragma: no cover
        print("[bookings] could not e-mail {}: {}".format(to, e))


def mail_code(email, name, code, room, on_date, t_start, t_end):
    """The six-digit code that finishes a request made from the website."""
    S.send_mail(email, "Your booking code: {}".format(code),
                "{}your six-digit code for the room request is:\n\n    {}\n\n"
                "Room: {}\nDate: {}\nTime: {} to {}\n\n"
                "Type it into the booking page to send the request. The code is valid for {} minutes.\n"
                "If you did not ask for a room, ignore this e-mail - nothing has been booked.\n".format(
                    (name + ", ") if name else "", code, room["name"], pretty_date(on_date), t_start, t_end,
                    cfg()["code_minutes"]))


# ---------------------------------------------------------------------------
# 8. API - everybody: what can I book, and when is it free?
# ---------------------------------------------------------------------------
def api_config(req):
    u = S.require_ready_user(req)
    c = cfg()
    rooms = [room_public(r) for r in S.q("SELECT * FROM rooms WHERE active=1 ORDER BY sort, name").fetchall()]
    return {"rooms": rooms, "can_request": may_request(u), "office": may_office(u), "hod": may_hod(u),
            "admin": u["role"] == "admin", "today": today_local(),
            "day_start": c["day_start"], "day_end": c["day_end"], "max_days_ahead": c["max_days_ahead"],
            "max_hours": c["max_hours"], "buffer_min": c["buffer_min"], "blackout": c["blackout"],
            "auto_until": c["auto_until"]}


def api_availability(req):
    """Everything already taken or asked for, for one date (optionally one room)."""
    S.require_ready_user(req)
    on_date = ymd(req.query.get("date") or today_local())
    room_id = req.query.get("room")
    sql = "SELECT * FROM bookings WHERE on_date=? AND status IN ('approved','pending','forwarded')"
    args = [on_date]
    if room_id:
        sql += " AND room_id=?"
        args.append(int(room_id))
    rows = S.q(sql + " ORDER BY t_start", tuple(args)).fetchall()
    return {"date": on_date,
            "booked": [{"room_id": r["room_id"], "start": r["t_start"], "end": r["t_end"],
                        "title": r["title"], "status": r["status"], "by": user_label(r["user_id"])}
                       for r in rows],
            "blackout": in_blackout(on_date)}


def api_mine(req):
    u = S.require_ready_user(req)
    rows = S.q("SELECT * FROM bookings WHERE user_id=? ORDER BY on_date DESC, t_start DESC LIMIT 200",
               (u["id"],)).fetchall()
    return {"can_request": may_request(u), "bookings": [booking_public(b) for b in rows]}


# ---------------------------------------------------------------------------
# 9. API - making and changing a request
# ---------------------------------------------------------------------------
def read_request_body(d):
    return {
        "room_id": int(d.get("room_id") or 0),
        "on_date": ymd(d.get("date")),
        "t_start": hhmm(d.get("start")),
        "t_end": hhmm(d.get("end")),
        "title": text(d.get("title"), 160, "The purpose"),
        "purpose": text(d.get("purpose"), 2000, "The details"),
        "attendees": max(0, min(100000, int(d.get("attendees") or 0))),
        "needs": text(d.get("needs"), 400, "What you need in the room"),
        "outside": 1 if d.get("outside") else 0,
        "hide_name": 1 if d.get("hide_name") else 0,
    }


def route_new_booking(req, b, room, actor_email):
    """
    Where a brand-new request goes.
      a room marked "Head's approval"  -> straight to the Head
                                          (or confirmed at once if his standing
                                           approval covers it and it is routine)
      any other room                   -> the department office confirms it
    The office sees every request either way; for halls they no longer have to
    forward it by hand.
    """
    if not room["needs_hod"]:
        log(b["id"], actor_email, "sent to the office")
        return "pending", ""
    ok, why = auto_check(b, room)
    if ok:
        hod = S.q1("SELECT * FROM users WHERE role='hod' AND active=1") or \
              S.q1("SELECT * FROM users WHERE role='admin' AND active=1")
        if hod:
            approve(req, b, hod, "", auto=True)
            return "approved", ""
    at = S.iso(S.now())
    S.q("UPDATE bookings SET status='forwarded',forwarded_at=?,updated=? WHERE id=?", (at, at, b["id"]))
    log(b["id"], actor_email, "sent to the HoD", why)
    mail_forwarded(booking_row(b["id"]), room, "the booking system")
    return "forwarded", why


def mail_forwarded(b, room, by):
    notify(role_emails("hod"), "Room booking for your approval - " + b["ref"],
           "A room request is waiting for your approval.\n\n" + details_text(b, room) +
           "\n\nOpen the portal -> Approvals to approve or reject it.\n")


def api_create(req):
    u = S.require_ready_user(req)
    if not may_request(u):
        raise S.ApiError(403, "Room requests can be made by faculty and research scholars. "
                              "Please ask the department office.")
    d = read_request_body(req.json())
    if not d["title"]:
        raise S.ApiError(400, "Please say what the room is for.")
    room = room_row(d["room_id"])
    check_slot(room, d["on_date"], d["t_start"], d["t_end"])

    me = S.get_person(u["person_id"]) or {}
    person = {"kind": me.get("type", "member"), "person_id": u["person_id"], "name": me.get("name") or u["name"],
              "email": clean_email(me.get("email")) or u["email"], "roll": me.get("roll", ""),
              "advisor_id": me.get("supervisor") or "", "advisor_name": "", "advisor_email": ""}
    if person["advisor_id"]:
        sup = S.get_person(person["advisor_id"]) or {}
        person["advisor_name"], person["advisor_email"] = sup.get("name", ""), clean_email(sup.get("email"))
    adv = advisor_for(person, (req.json() or {}).get("advisor_id"), (req.json() or {}).get("advisor_name"))
    b = insert_booking(d, user_id=u["id"], person_id=u["person_id"], source="portal",
                       requester_name=person["name"], requester_email=person["email"],
                       roll=text((req.json() or {}).get("roll") or person["roll"], 40, "The roll number"),
                       phone=text((req.json() or {}).get("phone"), 40, "The phone number"), advisor=adv)
    log(b["id"], u["email"], "submitted")
    S.audit(u["email"], "booking.create", b["ref"],
            "{} {} {}-{}".format(room["name"], d["on_date"], d["t_start"], d["t_end"]), req.ip)
    mail_submitted(booking_row(b["id"]), room)
    status, _ = route_new_booking(req, booking_row(b["id"]), room, u["email"])

    others = clashes(room["id"], d["on_date"], d["t_start"], d["t_end"], WAITING, b["id"])
    warning = ("Another request for this slot is already waiting for a decision. "
               "Both will be looked at, and only one can be approved.") if others else ""
    return {"ok": True, "booking": booking_public(booking_row(b["id"])), "warning": warning, "status": status}


def insert_booking(d, user_id, person_id, source, requester_name, requester_email, roll, phone, advisor):
    """Writes the row and gives it its reference number. Used by both ways in."""
    at = S.iso(S.now())
    cur = S.q("INSERT INTO bookings(ref,room_id,user_id,person_id,on_date,t_start,t_end,title,purpose,"
              "attendees,needs,outside,hide_name,status,created,updated,"
              "requester_name,requester_email,roll,phone,advisor_id,advisor_name,advisor_email,source)"
              " VALUES('',?,?,?,?,?,?,?,?,?,?,?,?, 'pending',?,?,?,?,?,?,?,?,?,?)",
              (d["room_id"], user_id, person_id, d["on_date"], d["t_start"], d["t_end"], d["title"],
               d["purpose"], d["attendees"], d["needs"], d["outside"], d["hide_name"], at, at,
               requester_name, requester_email, roll, phone,
               advisor["id"], advisor["name"], advisor["email"], source))
    bid = cur.lastrowid
    S.q("UPDATE bookings SET ref=? WHERE id=?", ("MA-B-{}-{:04d}".format(d["on_date"][:4], bid), bid))
    return booking_row(bid)


def api_update(req, bid):
    """Correcting a request that the office sent back, then sending it again."""
    u = S.require_ready_user(req)
    b = booking_row(int(bid))
    if b["user_id"] != u["id"]:
        raise S.ApiError(403, "This is not your request.")
    if b["status"] not in ("returned", "pending"):
        raise S.ApiError(400, "Only a request that is still with the office can be changed. "
                              "Cancel it and make a new one.")
    d = read_request_body(req.json())
    if not d["title"]:
        raise S.ApiError(400, "Please say what the room is for.")
    room = room_row(d["room_id"])
    check_slot(room, d["on_date"], d["t_start"], d["t_end"], ignore_id=b["id"])
    S.q("UPDATE bookings SET room_id=?,on_date=?,t_start=?,t_end=?,title=?,purpose=?,attendees=?,needs=?,"
        "outside=?,hide_name=?,status='pending',decision_note='',updated=? WHERE id=?",
        (room["id"], d["on_date"], d["t_start"], d["t_end"], d["title"], d["purpose"], d["attendees"],
         d["needs"], d["outside"], d["hide_name"], S.iso(S.now()), b["id"]))
    b = booking_row(b["id"])
    log(b["id"], u["email"], "resubmitted")
    mail_submitted(b, room)
    # a corrected request has to be sent on its way again, exactly like a new one,
    # otherwise a hall request would sit with the office and never reach the Head
    status, _ = route_new_booking(req, booking_row(b["id"]), room, u["email"])
    return {"ok": True, "booking": booking_public(booking_row(b["id"])), "status": status}


def api_cancel(req, bid):
    u = S.require_ready_user(req)
    b = booking_row(int(bid))
    mine = b["user_id"] == u["id"]
    if not (mine or may_office(u) or may_hod(u)):
        raise S.ApiError(403, "This is not your booking.")
    if b["status"] in ("cancelled", "rejected"):
        raise S.ApiError(400, "That request is already closed.")
    note = text((req.json() or {}).get("note"), 500, "The reason")
    S.q("UPDATE bookings SET status='cancelled',decision_note=?,updated=? WHERE id=?",
        (note, S.iso(S.now()), b["id"]))
    room = room_row(b["room_id"])
    who = user_label(u["id"])
    log(b["id"], u["email"], "cancelled", note)
    S.audit(u["email"], "booking.cancel", b["ref"], note, req.ip)
    mail_cancelled(booking_row(b["id"]), room, who, note, to_staff=not may_office(u))
    return {"ok": True}


# ---------------------------------------------------------------------------
# 10. API - the office
# ---------------------------------------------------------------------------
def api_queue(req):
    require_office(req)
    rows = S.q("SELECT * FROM bookings WHERE status IN ('pending','returned','forwarded')"
               " ORDER BY on_date, t_start").fetchall()
    out = []
    for b in rows:
        item = booking_public(b, who=True)
        room = room_row(b["room_id"])
        item["needs_hod"] = bool(room["needs_hod"])
        item["competing"] = [booking_public(x, who=True)["ref"] + " (" + user_label(x["user_id"]) + ")"
                             for x in clashes(b["room_id"], b["on_date"], b["t_start"], b["t_end"], WAITING, b["id"])]
        item["conflict"] = bool(clashes(b["room_id"], b["on_date"], b["t_start"], b["t_end"], BLOCKING, b["id"]))
        out.append(item)
    upcoming = S.q("SELECT * FROM bookings WHERE status='approved' AND on_date>=?"
                   " ORDER BY on_date, t_start LIMIT 100", (today_local(),)).fetchall()
    return {"queue": out, "upcoming": [booking_public(b, who=True) for b in upcoming],
            "no_address": missing_addresses(), "register": register_size(),
            "counts": {"pending": sum(1 for b in rows if b["status"] == "pending"),
                       "forwarded": sum(1 for b in rows if b["status"] == "forwarded"),
                       "returned": sum(1 for b in rows if b["status"] == "returned")}}


def api_office(req, bid):
    """action = forward | confirm | return | reject"""
    u = require_office(req)
    b = booking_row(int(bid))
    d = req.json()
    action = str(d.get("action") or "")
    note = text(d.get("note"), 500, "The note")
    room = room_row(b["room_id"])
    # hall requests go straight to the Head, but the office can still send one back
    # or refuse it outright before he gets to it.
    if b["status"] not in ("pending", "returned", "forwarded"):
        raise S.ApiError(400, "That request has already been decided.")
    if b["status"] == "forwarded" and action not in ("return", "reject"):
        raise S.ApiError(400, "That request is with the Head of the Department. "
                              "You can still send it back or refuse it.")
    at = S.iso(S.now())

    if action == "return":
        S.q("UPDATE bookings SET status='returned',decision_note=?,updated=? WHERE id=?", (note, at, b["id"]))
        log(b["id"], u["email"], "returned", note)
        mail_returned(booking_row(b["id"]), room, note)
        return {"ok": True, "status": "returned"}

    if action == "reject":
        S.q("UPDATE bookings SET status='rejected',decided_by=?,decided_at=?,decision_note=?,updated=? WHERE id=?",
            (u["id"], at, note, at, b["id"]))
        log(b["id"], u["email"], "rejected by office", note)
        S.audit(u["email"], "booking.reject", b["ref"], note, req.ip)
        mail_decided(booking_row(b["id"]), room, False, note)
        return {"ok": True, "status": "rejected"}

    if action == "confirm":
        if room["needs_hod"]:
            raise S.ApiError(400, "{} needs the Head's approval. Use Forward to the HoD.".format(room["name"]))
        return approve(req, b, u, note, auto=False, by_office=True)

    if action == "forward":
        if not room["needs_hod"]:
            # nothing to forward: this room is the office's to confirm
            return approve(req, b, u, note, auto=False, by_office=True)
        ok, why = auto_check(b, room)
        if ok:
            return approve(req, b, u, note, auto=True, by_office=True)
        S.q("UPDATE bookings SET status='forwarded',forwarded_by=?,forwarded_at=?,updated=? WHERE id=?",
            (u["id"], at, at, b["id"]))
        log(b["id"], u["email"], "forwarded to HoD", note or why)
        mail_forwarded(booking_row(b["id"]), room, user_label(u["id"]))
        return {"ok": True, "status": "forwarded", "why": why}

    raise S.ApiError(400, "Unknown action.")


# ---------------------------------------------------------------------------
# 11. API - the Head of the Department
# ---------------------------------------------------------------------------
def approve(req, b, u, note, auto=False, by_office=False):
    """
    The only place a booking becomes 'approved'.
    The slot is re-checked inside a locked transaction, so two people can never
    be approved into the same room at the same time.
    """
    room = room_row(b["room_id"])
    at = S.iso(S.now())
    S.q("BEGIN IMMEDIATE")
    try:
        still = S.q1("SELECT status FROM bookings WHERE id=?", (b["id"],))
        if not still or still["status"] in ("approved", "cancelled", "rejected"):
            S.q("ROLLBACK")
            raise S.ApiError(409, "That request has already been decided. Reload the page.")
        taken = clashes(b["room_id"], b["on_date"], b["t_start"], b["t_end"], BLOCKING, b["id"])
        if taken:
            S.q("ROLLBACK")
            raise S.ApiError(409, "{} was booked for that slot a moment ago by {}. "
                                  "This request cannot be approved.".format(room["name"], user_label(taken[0]["user_id"])))
        S.q("UPDATE bookings SET status='approved',decided_by=?,decided_at=?,decision_note=?,auto=?,updated=? WHERE id=?",
            (u["id"], at, note, 1 if auto else 0, at, b["id"]))
        S.q("COMMIT")
    except S.ApiError:
        raise
    except Exception:
        S.q("ROLLBACK")
        raise
    b = booking_row(b["id"])
    log(b["id"], u["email"], "approved automatically" if auto else
        ("confirmed by office" if by_office else "approved by HoD"), note)
    S.audit(u["email"], "booking.approve", b["ref"],
            "{} {} {}-{}{}".format(room["name"], b["on_date"], b["t_start"], b["t_end"], " (auto)" if auto else ""), req.ip)
    mail_decided(b, room, True, note, auto=auto)
    return {"ok": True, "status": "approved", "auto": auto}


def api_hod(req):
    require_hod(req)
    c = cfg()
    waiting = S.q("SELECT * FROM bookings WHERE status='forwarded' ORDER BY on_date, t_start").fetchall()
    recent = S.q("SELECT * FROM bookings WHERE status IN ('approved','rejected') ORDER BY id DESC LIMIT 40").fetchall()
    out = []
    for b in waiting:
        item = booking_public(b, who=True)
        room = room_row(b["room_id"])
        item["competing"] = [user_label(x["user_id"]) + " (" + x["ref"] + ")"
                             for x in clashes(b["room_id"], b["on_date"], b["t_start"], b["t_end"], WAITING, b["id"])]
        item["room_capacity"] = room["capacity"]
        out.append(item)
    return {"waiting": out,
            "recent": [booking_public(b, who=True) for b in recent],
            "rooms": [room_public(r) for r in S.q("SELECT * FROM rooms ORDER BY sort, name").fetchall()],
            "auto_until": c["auto_until"], "max_hours": c["max_hours"], "today": today_local()}


def api_decide(req, bid):
    u = require_hod(req)
    b = booking_row(int(bid))
    d = req.json()
    action = str(d.get("action") or "")
    note = text(d.get("note"), 500, "The note")
    if b["status"] != "forwarded":
        raise S.ApiError(400, "That request is not waiting for your approval.")
    if action == "approve":
        return approve(req, b, u, note)
    if action == "reject":
        at = S.iso(S.now())
        S.q("UPDATE bookings SET status='rejected',decided_by=?,decided_at=?,decision_note=?,updated=? WHERE id=?",
            (u["id"], at, note, at, b["id"]))
        log(b["id"], u["email"], "rejected by HoD", note)
        S.audit(u["email"], "booking.reject", b["ref"], note, req.ip)
        mail_decided(booking_row(b["id"]), room_row(b["room_id"]), False, note)
        return {"ok": True, "status": "rejected"}
    raise S.ApiError(400, "Unknown action.")


def api_decide_many(req):
    """Approve or reject several at once - one click instead of fifteen."""
    u = require_hod(req)
    d = req.json()
    action = str(d.get("action") or "")
    note = text(d.get("note"), 500, "The note")
    ids = [int(x) for x in (d.get("ids") or [])][:100]
    done, failed = [], []
    for i in ids:
        try:
            b = booking_row(i)
            if b["status"] != "forwarded":
                failed.append({"id": i, "error": "already decided"})
                continue
            if action == "approve":
                approve(req, b, u, note)
            elif action == "reject":
                at = S.iso(S.now())
                S.q("UPDATE bookings SET status='rejected',decided_by=?,decided_at=?,decision_note=?,updated=? WHERE id=?",
                    (u["id"], at, note, at, b["id"]))
                log(b["id"], u["email"], "rejected by HoD", note)
                mail_decided(booking_row(i), room_row(b["room_id"]), False, note)
            else:
                raise S.ApiError(400, "Unknown action.")
            done.append(i)
        except S.ApiError as e:
            failed.append({"id": i, "error": e.message})
    return {"ok": True, "done": len(done), "failed": failed}


def api_revoke(req, bid):
    """Take back a booking that was already confirmed (institute event, clash, mistake)."""
    u = S.require_ready_user(req)
    if not (may_hod(u) or may_office(u)):
        raise S.ApiError(403, "Only the office or the Head can take back a confirmed booking.")
    b = booking_row(int(bid))
    if b["status"] != "approved":
        raise S.ApiError(400, "That booking is not confirmed.")
    note = text((req.json() or {}).get("note"), 500, "The reason")
    S.q("UPDATE bookings SET status='cancelled',decision_note=?,updated=? WHERE id=?",
        (note, S.iso(S.now()), b["id"]))
    log(b["id"], u["email"], "withdrawn after approval", note)
    S.audit(u["email"], "booking.revoke", b["ref"], note, req.ip)
    mail_cancelled(booking_row(b["id"]), room_row(b["room_id"]), user_label(u["id"]), note)
    return {"ok": True}


# ---------------------------------------------------------------------------
# 11b. API - the booking form on the website (no login)
# ---------------------------------------------------------------------------
# Anyone from the department may use it, but only with the official address the
# department already holds for them (see "the register" above). A six-digit code
# is sent to that address and has to be typed back in, so a request cannot be
# made in somebody else's name.

def public_on():
    if not cfg()["public_booking"]:
        raise S.ApiError(403, "The booking form is switched off at the moment.")


def rate_check(email, ip):
    """A person may send only so many requests an hour; the same for one network."""
    limit = int(cfg()["max_per_hour"])
    since = S.iso(S.now() - timedelta(hours=1))
    mine = S.q1("SELECT COUNT(*) c FROM bookings WHERE lower(requester_email)=? AND created>?",
                (clean_email(email), since))["c"]
    # codes already sent count too, otherwise the form could be used to send
    # one e-mail after another to somebody else's address
    mine += S.q1("SELECT COUNT(*) c FROM booking_codes WHERE lower(email)=? AND created>?",
                 (clean_email(email), since))["c"]
    if mine >= limit:
        raise S.ApiError(429, "That is {} requests in the last hour from this address. "
                              "Please contact the department office instead.".format(mine))
    waiting = S.q1("SELECT COUNT(*) c FROM booking_codes WHERE ip=? AND created>?", (ip, since))["c"]
    if waiting >= limit * 4:
        raise S.ApiError(429, "Too many requests from this network just now. Please try again later.")


def api_open_config(req):
    """What the booking page needs before anyone types anything."""
    public_on()
    c = cfg()
    return {"rooms": [room_public(r) for r in S.q("SELECT * FROM rooms WHERE active=1 ORDER BY sort, name").fetchall()],
            "faculty": faculty_choices(), "today": today_local(),
            "day_start": c["day_start"], "day_end": c["day_end"], "max_days_ahead": c["max_days_ahead"],
            "blackout": c["blackout"], "register_ready": register_size() > 0,
            "domains": c["student_domains"]}


def api_open_availability(req):
    public_on()
    on_date = ymd(req.query.get("date") or today_local())
    room_id = req.query.get("room")
    sql = "SELECT room_id,t_start,t_end,title,status,advisor_name,requester_name FROM bookings" \
          " WHERE on_date=? AND status IN ('approved','pending','forwarded')"
    args = [on_date]
    if room_id:
        sql += " AND room_id=?"
        args.append(int(room_id))
    rows = S.q(sql + " ORDER BY t_start", tuple(args)).fetchall()
    return {"date": on_date, "blackout": in_blackout(on_date),
            "booked": [{"room_id": r["room_id"], "start": r["t_start"], "end": r["t_end"],
                        "title": r["title"], "status": r["status"],
                        "by": r["advisor_name"] or r["requester_name"] or ""} for r in rows]}


def read_public_form(d):
    """Everything the form sends, checked. Raises a plain message on anything wrong."""
    out = read_request_body(d)
    out["email"] = clean_email(d.get("email"))
    out["name"] = text(d.get("name"), 120, "Your name")
    out["roll"] = text(d.get("roll"), 40, "The roll number")
    out["phone"] = re.sub(r"[^\d+\- ]", "", str(d.get("phone") or ""))[:40].strip()
    out["advisor_id"] = text(d.get("advisor_id"), 80, "The faculty advisor")
    out["advisor_name"] = text(d.get("advisor_name"), 120, "The faculty advisor")
    if not out["name"]:
        raise S.ApiError(400, "Please give your name.")
    if not out["email"]:
        raise S.ApiError(400, "Please give your official e-mail address.")
    if not out["title"]:
        raise S.ApiError(400, "Please say what the room is for.")
    if not out["phone"]:
        raise S.ApiError(400, "Please give a phone number the office can reach you on.")
    return out


def api_open_start(req):
    """Step one: check everything, then e-mail a six-digit code."""
    public_on()
    d = read_public_form(req.json())
    person = find_registered(d["email"])
    if not person:
        if register_size() == 0:
            raise S.ApiError(403, "The list of department e-mail addresses has not been loaded yet, "
                                  "so online booking is not available. Please contact the department office.")
        raise S.ApiError(403, "That address is not on the department's list. Room booking is for members of "
                              "the department, using the official address the department holds for you. "
                              "If the address is new, please ask the department office to add it.")
    rate_check(d["email"], req.ip)
    room = room_row(d["room_id"])
    check_slot(room, d["on_date"], d["t_start"], d["t_end"])
    adv = advisor_for(person, d["advisor_id"], d["advisor_name"])
    if person["kind"] not in ("faculty", "adjunct") and not (adv["name"] or adv["id"]):
        raise S.ApiError(400, "Please name your supervisor, mentor or faculty advisor.")

    code = "{:06d}".format(secrets.randbelow(1000000))
    ticket = secrets.token_urlsafe(24)
    payload = dict(d)
    payload["person"] = person
    payload["advisor"] = adv
    S.q("DELETE FROM booking_codes WHERE expires < ?", (S.iso(S.now()),))
    S.q("INSERT INTO booking_codes(ticket_hash,code_hash,payload,email,expires,created,ip)"
        " VALUES(?,?,?,?,?,?,?)",
        (S.sha256(ticket), S.sha256(ticket + code), json.dumps(payload), d["email"],
         S.iso(S.now() + timedelta(minutes=int(cfg()["code_minutes"]))), S.iso(S.now()), req.ip))
    try:
        mail_code(d["email"], person["name"] or d["name"], code, room, d["on_date"], d["t_start"], d["t_end"])
    except Exception as e:                                           # pragma: no cover
        print("[bookings] could not send the code:", e)
        raise S.ApiError(500, "The code could not be e-mailed. Please try again, or contact the office.")
    return {"ok": True, "ticket": ticket, "sent_to": mask_email(d["email"]),
            "minutes": cfg()["code_minutes"],
            "advisor": adv["name"], "advisor_notified": bool(adv["email"])}


def mask_email(e):
    name, _, dom = str(e).partition("@")
    return (name[:2] + "…" if len(name) > 2 else name) + "@" + dom


def api_open_confirm(req):
    """Step two: the code is right, so make the request."""
    public_on()
    d = req.json()
    ticket = str(d.get("ticket") or "")
    code = re.sub(r"\D", "", str(d.get("code") or ""))
    row = S.q1("SELECT * FROM booking_codes WHERE ticket_hash=?", (S.sha256(ticket),))
    if not row or S.parse_iso(row["expires"]) < S.now():
        raise S.ApiError(400, "That code has expired. Please fill the form in again.")
    if row["attempts"] >= int(cfg()["code_max_attempts"]):
        S.q("DELETE FROM booking_codes WHERE ticket_hash=?", (row["ticket_hash"],))
        raise S.ApiError(429, "Too many wrong codes. Please fill the form in again.")
    if not hmac.compare_digest(S.sha256(ticket + code), row["code_hash"]):
        S.q("UPDATE booking_codes SET attempts=attempts+1 WHERE ticket_hash=?", (row["ticket_hash"],))
        left = int(cfg()["code_max_attempts"]) - row["attempts"] - 1
        raise S.ApiError(401, "That code is not right. {} attempt{} left.".format(left, "" if left == 1 else "s"))
    S.q("DELETE FROM booking_codes WHERE ticket_hash=?", (row["ticket_hash"],))

    f = json.loads(row["payload"])
    person, adv = f["person"], f["advisor"]
    room = room_row(f["room_id"])
    check_slot(room, f["on_date"], f["t_start"], f["t_end"])        # somebody may have taken it meanwhile
    b = insert_booking(f, user_id=0, person_id=person.get("person_id") or None, source="public",
                       requester_name=person.get("name") or f["name"], requester_email=f["email"],
                       roll=f["roll"], phone=f["phone"], advisor=adv)
    log(b["id"], f["email"], "submitted from the website")
    S.audit(f["email"], "booking.create", b["ref"],
            "{} {} {}-{} (website)".format(room["name"], f["on_date"], f["t_start"], f["t_end"]), req.ip)
    mail_submitted(booking_row(b["id"]), room)
    status, _ = route_new_booking(req, booking_row(b["id"]), room, f["email"])
    waiting_with = "the Head of the Department" if room["needs_hod"] else "the department office"
    return {"ok": True, "ref": b["ref"], "status": status, "waiting_with": waiting_with,
            "approved": status == "approved",
            "advisor": adv.get("name", ""), "advisor_notified": bool(adv.get("email"))}


# ---------------------------------------------------------------------------
# 11c. Giving the room back, and rooms nobody turned up to
# ---------------------------------------------------------------------------
# The confirmation e-mail carries a link so the room can be released in one tap.
# The link only OPENS a page; nothing changes until the person presses the button
# there. That matters because mail scanners follow links in e-mails on their own,
# and a plain link would cancel bookings by itself.

def release_token(b):
    """Make one if the booking has none yet, and give back the plain token."""
    if b["release_hash"]:
        return None                                   # already issued; the old link still works
    tok = secrets.token_urlsafe(18)
    S.q("UPDATE bookings SET release_hash=? WHERE id=?", (S.sha256(tok), b["id"]))
    return tok


def release_link(b):
    tok = release_token(b) or ""
    if not tok:
        row = S.q1("SELECT release_hash FROM bookings WHERE id=?", (b["id"],))
        if row and row["release_hash"]:
            return "(use the link in the first confirmation e-mail)"
    base = (S.CFG.get("base_url") or "").rstrip("/")
    return "{}/room-booking.html?release={}".format(base, tok)


def api_open_release_info(req):
    """What the page shows before the person presses the button."""
    public_on()
    tok = str(req.query.get("t") or "")
    b = S.q1("SELECT * FROM bookings WHERE release_hash=? AND release_hash<>''", (S.sha256(tok),))
    if not b:
        raise S.ApiError(404, "That link is not valid. It may already have been used.")
    room = room_row(b["room_id"])
    return {"ref": b["ref"], "room": room["name"], "date": b["on_date"], "pretty": pretty_date(b["on_date"]),
            "start": b["t_start"], "end": b["t_end"], "title": b["title"],
            "status": b["status"], "can_release": b["status"] == "approved" and b["on_date"] >= today_local()}


def api_open_release(req):
    """The person pressed the button: the slot goes back."""
    public_on()
    tok = str((req.json() or {}).get("t") or "")
    b = S.q1("SELECT * FROM bookings WHERE release_hash=? AND release_hash<>''", (S.sha256(tok),))
    if not b:
        raise S.ApiError(404, "That link is not valid. It may already have been used.")
    if b["status"] != "approved":
        raise S.ApiError(400, "That booking is not confirmed, so there is nothing to give back.")
    if b["on_date"] < today_local():
        raise S.ApiError(400, "That booking is in the past.")
    note = "Given back by the person who booked it."
    S.q("UPDATE bookings SET status='cancelled',decision_note=?,release_hash='',updated=? WHERE id=?",
        (note, S.iso(S.now()), b["id"]))
    room = room_row(b["room_id"])
    log(b["id"], b["requester_email"] or "", "released by the booker")
    S.audit(b["requester_email"] or "", "booking.release", b["ref"], room["name"], req.ip)
    mail_cancelled(booking_row(b["id"]), room, b["requester_name"] or "the person who booked it", note)
    return {"ok": True, "ref": b["ref"], "room": room["name"], "pretty": pretty_date(b["on_date"]),
            "start": b["t_start"], "end": b["t_end"]}


def api_no_show(req, bid):
    """The office records that a confirmed booking went unused."""
    u = S.require_ready_user(req)
    if not (may_office(u) or may_hod(u)):
        raise S.ApiError(403, "Only the department office can mark a booking as unused.")
    b = booking_row(int(bid))
    if b["status"] != "approved":
        raise S.ApiError(400, "Only a confirmed booking can be marked as unused.")
    on = 0 if b["no_show"] else 1
    S.q("UPDATE bookings SET no_show=? WHERE id=?", (on, b["id"]))
    log(b["id"], u["email"], "marked as not used" if on else "no-show mark removed")
    S.audit(u["email"], "booking.no_show", b["ref"], "on" if on else "off", req.ip)
    return {"ok": True, "no_show": bool(on)}


def no_show_count(email):
    if not email:
        return 0
    return S.q1("SELECT COUNT(*) c FROM bookings WHERE lower(requester_email)=? AND no_show=1",
                (clean_email(email),))["c"]


# ---------------------------------------------------------------------------
# 11d. An approved seminar, put on the Notice Board
# ---------------------------------------------------------------------------
# The booking already holds the title, the room, the date and the time. One tick
# turns it into a notice on the home page and the News & Events page, so nobody
# has to type it again. The requester's roll number and phone are never included.

def api_publish_notice(req, bid):
    u = S.require_ready_user(req)
    if not (may_office(u) or may_hod(u)):
        raise S.ApiError(403, "Only the department office or the Head can publish a notice.")
    b = booking_row(int(bid))
    if b["status"] != "approved":
        raise S.ApiError(400, "Only a confirmed booking can be published.")
    if b["notice_id"] and S.q1("SELECT id FROM notices WHERE id=?", (b["notice_id"],)):
        raise S.ApiError(400, "This booking is already on the Notice Board.")
    room = room_row(b["room_id"])
    d = req.json() or {}
    notice = S.clean_notice({
        "kind": "event",
        "tag": text(d.get("tag"), 40, "The tag") or "Seminar",
        "title": text(d.get("title"), 160, "The title") or b["title"],
        "date": b["on_date"],
        "time": "{} to {}".format(b["t_start"], b["t_end"]),
        "venue": room["name"] + ((", " + room["location"]) if room["location"] else ""),
        "speaker": text(d.get("speaker"), 120, "The speaker"),
        "affiliation": text(d.get("affiliation"), 160, "The affiliation"),
        "body": text(d.get("body"), 2000, "The details") or b["purpose"],
        "link": "news-events.html",
        "is_new": True,
        "expires": b["on_date"],
    })
    cur = S.q("INSERT INTO notices(data,created,updated) VALUES(?,?,?)",
              (json.dumps(notice, ensure_ascii=False), S.iso(S.now()), S.iso(S.now())))
    S.q("UPDATE bookings SET notice_id=? WHERE id=?", (cur.lastrowid, b["id"]))
    log(b["id"], u["email"], "published on the Notice Board")
    S.audit(u["email"], "booking.notice", b["ref"], notice["title"][:120], req.ip)
    return {"ok": True, "notice_id": cur.lastrowid}


# ---------------------------------------------------------------------------
# 11e. Today's bookings, for the office to print and pin up
# ---------------------------------------------------------------------------
def api_today(req):
    u = S.require_ready_user(req)
    if not (may_office(u) or may_hod(u) or u["role"] == "admin"):
        raise S.ApiError(403, "This sheet is for the department office.")
    day = ymd(req.query.get("date") or today_local())
    rooms = [room_public(r) for r in S.q("SELECT * FROM rooms WHERE active=1 ORDER BY sort, name").fetchall()]
    rows = S.q("SELECT * FROM bookings WHERE on_date=? AND status='approved' ORDER BY t_start", (day,)).fetchall()
    by_room = {}
    for b in rows:
        by_room.setdefault(b["room_id"], []).append({
            "ref": b["ref"], "start": b["t_start"], "end": b["t_end"], "title": b["title"],
            "by": b["advisor_name"] or b["requester_name"], "requester": b["requester_name"],
            "phone": b["phone"], "needs": b["needs"], "attendees": b["attendees"],
            "no_show": bool(b["no_show"]), "id": b["id"]})
    return {"date": day, "pretty": pretty_date(day), "rooms": rooms, "bookings": by_room,
            "total": len(rows), "blackout": in_blackout(day)}


# ---------------------------------------------------------------------------
# 12. API - rooms and settings
# ---------------------------------------------------------------------------
def api_rooms(req):
    S.require_ready_user(req)
    return {"rooms": [room_public(r) for r in S.q("SELECT * FROM rooms ORDER BY sort, name").fetchall()]}


def read_room(d):
    name = text(d.get("name"), 120, "The room name")
    if not name:
        raise S.ApiError(400, "Please give the room a name.")
    kind = "hall" if str(d.get("kind")) == "hall" else "classroom"
    return (name, kind, max(0, min(100000, int(d.get("capacity") or 0))),
            text(d.get("facilities"), 300, "Facilities"), text(d.get("location"), 200, "Location"),
            text(d.get("custodian"), 160, "Who holds the key"),
            1 if d.get("needs_hod", True) else 0, 1 if d.get("active", True) else 0,
            int(d.get("sort") or 0))


def api_room_create(req):
    u = S.require_admin(req)
    v = read_room(req.json())
    if S.q1("SELECT id FROM rooms WHERE name=?", (v[0],)):
        raise S.ApiError(400, "There is already a room with that name.")
    S.q("INSERT INTO rooms(name,kind,capacity,facilities,location,custodian,needs_hod,active,sort,created)"
        " VALUES(?,?,?,?,?,?,?,?,?,?)", v + (S.iso(S.now()),))
    S.audit(u["email"], "booking.room.add", v[0], "", req.ip)
    return {"ok": True}


def api_room_update(req, rid):
    u = S.require_admin(req)
    room = room_row(int(rid))
    v = read_room(req.json())
    clash = S.q1("SELECT id FROM rooms WHERE name=? AND id<>?", (v[0], room["id"]))
    if clash:
        raise S.ApiError(400, "There is already a room with that name.")
    S.q("UPDATE rooms SET name=?,kind=?,capacity=?,facilities=?,location=?,custodian=?,needs_hod=?,active=?,sort=? WHERE id=?",
        v + (room["id"],))
    S.audit(u["email"], "booking.room.edit", v[0], "", req.ip)
    return {"ok": True}


def api_room_delete(req, rid):
    u = S.require_admin(req)
    room = room_row(int(rid))
    used = S.q1("SELECT COUNT(*) c FROM bookings WHERE room_id=?", (room["id"],))["c"]
    if used:
        S.q("UPDATE rooms SET active=0 WHERE id=?", (room["id"],))
        S.audit(u["email"], "booking.room.hide", room["name"], "{} bookings kept".format(used), req.ip)
        return {"ok": True, "hidden": True,
                "message": "This room has {} bookings in its history, so it has been switched off "
                           "rather than deleted.".format(used)}
    S.q("DELETE FROM rooms WHERE id=?", (room["id"],))
    S.audit(u["email"], "booking.room.delete", room["name"], "", req.ip)
    return {"ok": True}


def api_settings(req):
    """The HoD's auto-approve ticks and the general booking rules."""
    u = S.require_ready_user(req)
    if not (may_hod(u) or u["role"] == "admin"):
        raise S.ApiError(403, "Only the Head of the Department or an admin can change these.")
    d = req.json()
    changes = {}
    if "auto_rooms" in d:                       # [room id, ...] the HoD lets through
        want = set(int(x) for x in (d.get("auto_rooms") or []))
        for r in S.q("SELECT id FROM rooms").fetchall():
            S.q("UPDATE rooms SET auto_ok=? WHERE id=?", (1 if r["id"] in want else 0, r["id"]))
    if "auto_until" in d:
        v = str(d.get("auto_until") or "").strip()
        changes["auto_until"] = ymd(v) if v else ""
    for key, limit in (("max_hours", 24), ("max_days_ahead", 730), ("buffer_min", 120)):
        if key in d:
            changes[key] = max(0, min(limit, int(d.get(key) or 0)))
    for key in ("day_start", "day_end"):
        if key in d:
            changes[key] = hhmm(d.get(key))
    if "public_show_name" in d:
        changes["public_show_name"] = bool(d.get("public_show_name"))
    if "blackout" in d:
        out = []
        for row in (d.get("blackout") or [])[:60]:
            out.append({"from": ymd(row.get("from")), "to": ymd(row.get("to") or row.get("from")),
                        "reason": text(row.get("reason"), 120, "The reason")})
        changes["blackout"] = out
    if "requester_types" in d:
        allowed = {"faculty", "adjunct", "postdoc", "scholar", "staff"}
        changes["requester_types"] = [t for t in (d.get("requester_types") or []) if t in allowed] or ["faculty"]
    if changes:
        save_cfg(changes)
    S.audit(u["email"], "booking.settings", "", ", ".join(sorted(set(list(changes) + (["auto_rooms"] if "auto_rooms" in d else [])))), req.ip)
    return {"ok": True}


# ---------------------------------------------------------------------------
# 13. API - what the public website shows (used by the calendar, stage 3)
# ---------------------------------------------------------------------------
def public_rows(date_from=None, date_to=None):
    c = cfg()
    date_from = date_from or today_local()
    date_to = date_to or (datetime.strptime(date_from, "%Y-%m-%d") + timedelta(days=120)).strftime("%Y-%m-%d")
    rows = S.q("SELECT * FROM bookings WHERE status='approved' AND on_date BETWEEN ? AND ?"
               " ORDER BY on_date, t_start", (date_from, date_to)).fetchall()
    out = []
    for b in rows:
        r = S.q1("SELECT name,kind,location FROM rooms WHERE id=?", (b["room_id"],))
        item = {"date": b["on_date"], "start": b["t_start"], "end": b["t_end"],
                "room": r["name"] if r else "", "kind": r["kind"] if r else "",
                "title": b["title"]}
        # A booking is shown under the faculty member's name: their own for a faculty
        # booking, the named advisor for a student's or scholar's. Roll numbers,
        # phone numbers and the requester's own name are never published.
        if c["public_show_name"] and not b["hide_name"]:
            item["by"] = b["advisor_name"] or (b["requester_name"] if b["source"] == "portal" else "")
        out.append(item)
    return out


def api_public(req):
    return {"bookings": public_rows(req.query.get("from"), req.query.get("to")),
            "generated": S.iso(S.now())}


# ---------------------------------------------------------------------------
# 14. Hooking into server.py
# ---------------------------------------------------------------------------
ROUTE_TABLE = [
    # open to everyone (the booking form on the website)
    ("GET",    r"/api/bookings/open/config",       api_open_config),
    ("GET",    r"/api/bookings/open/availability", api_open_availability),
    ("POST",   r"/api/bookings/open/start",        api_open_start),
    ("POST",   r"/api/bookings/open/confirm",      api_open_confirm),
    ("GET",    r"/api/bookings/open/release",      api_open_release_info),
    ("POST",   r"/api/bookings/open/release",      api_open_release),
    # signed in
    ("GET",    r"/api/bookings/config",        api_config),
    ("GET",    r"/api/bookings/availability",  api_availability),
    ("GET",    r"/api/bookings/mine",          api_mine),
    ("GET",    r"/api/bookings/queue",         api_queue),
    ("GET",    r"/api/bookings/hod",           api_hod),
    ("GET",    r"/api/bookings/today",         api_today),
    ("POST",   r"/api/bookings/(\d+)/no-show", api_no_show),
    ("POST",   r"/api/bookings/(\d+)/notice",  api_publish_notice),
    ("GET",    r"/api/bookings/rooms",         api_rooms),
    ("POST",   r"/api/bookings/rooms",         api_room_create),
    ("PUT",    r"/api/bookings/rooms/(\d+)",   api_room_update),
    ("DELETE", r"/api/bookings/rooms/(\d+)",   api_room_delete),
    ("PUT",    r"/api/bookings/settings",      api_settings),
    ("GET",    r"/api/bookings/public",        api_public),
    ("POST",   r"/api/bookings/decide-many",   api_decide_many),
    ("POST",   r"/api/bookings/(\d+)/cancel",  api_cancel),
    ("POST",   r"/api/bookings/(\d+)/office",  api_office),
    ("POST",   r"/api/bookings/(\d+)/decide",  api_decide),
    ("POST",   r"/api/bookings/(\d+)/revoke",  api_revoke),
    ("PUT",    r"/api/bookings/(\d+)",         api_update),
    ("POST",   r"/api/bookings",               api_create),
]


def install(srv):
    """Called once by server.py. Adds the two new roles and the addresses above."""
    global S
    S = srv
    srv.ROLES |= {"office", "hod"}
    for method, pattern, fn in ROUTE_TABLE:
        srv.route(method, pattern)(fn)
    if hasattr(srv, "EXTENSIONS") and NAME not in [m.NAME for m in srv.EXTENSIONS]:
        srv.EXTENSIONS.append(sys.modules[__name__])
