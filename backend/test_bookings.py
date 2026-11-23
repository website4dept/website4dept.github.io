"""End-to-end test of the booking workflow, driven straight through the WSGI app."""
import contextlib, io, json, os, sys

BACKEND = "/home/claude/site/website4dept.github.io-main/backend"
os.chdir(BACKEND); sys.path.insert(0, BACKEND)
import server, bookings                                    # noqa: E402

PASS = FAIL = 0
def check(label, cond, extra=""):
    global PASS, FAIL
    if cond: PASS += 1; print("  ok   ", label)
    else:    FAIL += 1; print("  FAIL ", label, extra)

# ---- fake browser -----------------------------------------------------------
class Client:
    def __init__(self, sid=None, csrf=None): self.sid, self.csrf = sid, csrf
    def __call__(self, method, path, body=None, query=""):
        raw = json.dumps(body).encode() if body is not None else b""
        env = {"REQUEST_METHOD": method, "PATH_INFO": path, "QUERY_STRING": query,
               "CONTENT_LENGTH": str(len(raw)), "wsgi.input": io.BytesIO(raw),
               "REMOTE_ADDR": "127.0.0.1"}
        if self.sid:  env["HTTP_COOKIE"] = "mdsid=" + self.sid
        if self.csrf: env["HTTP_X_CSRF_TOKEN"] = self.csrf
        out = {}
        def start(status, headers): out["status"] = int(status.split()[0])
        with contextlib.redirect_stdout(io.StringIO()):      # e-mails still reach data/outbox
            chunks = server.app(env, start)
        return out["status"], json.loads(b"".join(chunks).decode() or "{}")

def make_user(email, role, person_id=None):
    server.q("DELETE FROM users WHERE email=?", (email,))
    server.q("INSERT INTO users(email,name,person_id,role,pw_hash,active,created) VALUES(?,?,?,?,'x',1,?)",
             (email, email.split("@")[0], person_id, role, server.iso(server.now())))
    uid = server.q1("SELECT id FROM users WHERE email=?", (email,))["id"]
    sid, csrf = "sid-" + email, "csrf-" + email
    server.q("INSERT OR REPLACE INTO sessions(hash,user_id,csrf,expires,created,ip) VALUES(?,?,?,?,?,?)",
             (server.sha256(sid), uid, csrf, server.iso(server.now() + server.timedelta(hours=8)),
              server.iso(server.now()), "127.0.0.1"))
    return Client(sid, csrf)



def last_office_mails(n=60):
    import email, email.policy
    out = []
    if not os.path.isdir("data/outbox"):
        return out
    for f in sorted(os.listdir("data/outbox"))[-n:]:
        with open("data/outbox/" + f, "rb") as fh:
            m = email.message_from_binary_file(fh, policy=email.policy.default)
        try:
            out.append((m["Subject"] or "") + "\n" + m.get_body(preferencelist=("plain",)).get_content())
        except Exception:
            out.append(m["Subject"] or "")
    return out

def booking_status(bid):
    return server.q1("SELECT status FROM bookings WHERE id=?", (bid,))["status"]
def is_auto(bid):
    return bool(server.q1("SELECT auto FROM bookings WHERE id=?", (bid,))["auto"])
def log_text(bid):
    return " ".join(r["action"] + " " + r["note"] for r in
                    server.q("SELECT action,note FROM booking_log WHERE booking_id=?", (bid,)).fetchall())

# people that exist in people-data.js
FACULTY, SCHOLAR = "ratna-dutta", "mou-jana"
prof    = make_user("prof@iitkgp.ac.in",    "member", FACULTY)
scholar = make_user("scholar@iitkgp.ac.in", "member", SCHOLAR)
staffp  = make_user("tech@iitkgp.ac.in",    "member", "akshay-murmu")   # staff: may NOT book
office  = make_user("office1@iitkgp.ac.in", "office")
office2 = make_user("office2@iitkgp.ac.in", "office")
hod     = make_user("hod@iitkgp.ac.in",     "hod", "adrijit-goswami")
admin   = make_user("admin@iitkgp.ac.in",   "admin")

HALL = server.q1("SELECT id FROM rooms WHERE name='Seminar Hall'")["id"]
ROOM = server.q1("SELECT id FROM rooms WHERE name='Classroom NC-141'")["id"]
DAY  = (server.now() + server.timedelta(days=10)).strftime("%Y-%m-%d")

print("\n--- who may request a room ---")
s, d = prof("GET", "/api/bookings/config");    check("faculty may request", d.get("can_request") is True, d)
s, d = scholar("GET", "/api/bookings/config"); check("scholar may request", d.get("can_request") is True, d)
s, d = staffp("GET", "/api/bookings/config");  check("technical staff may book too now", d.get("can_request") is True, d)
s, d = office("GET", "/api/bookings/config");  check("office sees office flag", d.get("office") is True, d)
s, d = hod("GET", "/api/bookings/config");     check("hod sees hod flag", d.get("hod") is True, d)

print("\n--- a faculty request ---")
req = {"room_id": HALL, "date": DAY, "start": "10:00", "end": "12:00",
       "title": "Cryptography seminar", "purpose": "Invited talk", "attendees": 60}
s, d = prof("POST", "/api/bookings", req)
check("request accepted", s == 200 and d.get("ok"), (s, d))
B1 = d["booking"]["id"]; REF1 = d["booking"]["ref"]
check("reference number issued", REF1.startswith("MA-B-"), REF1)
check("every request starts with the office", d["booking"]["status"] == "pending", d["booking"]["status"])

s, d = staffp("POST", "/api/bookings", dict(req, start="15:00", end="16:00"))
check("staff may book", s == 200, (s, d))
B_STAFF = d["booking"]["id"] if s == 200 else None

print("\n--- validation ---")
bad = [("end before start", dict(req, start="12:00", end="10:00"), 400),
       ("a date in the past", dict(req, date="2020-01-01"), 400),
       ("outside working hours", dict(req, start="06:00", end="07:00"), 400),
       ("too far ahead", dict(req, date=(server.now()+server.timedelta(days=400)).strftime("%Y-%m-%d")), 400),
       ("no purpose given", dict(req, title="", start="16:00", end="17:00"), 400)]
for label, body, want in bad:
    s, d = prof("POST", "/api/bookings", body)
    check(label + " refused", s == want, (s, d.get("error")))

print("\n--- two people, one slot ---")
s, d = scholar("POST", "/api/bookings", {"room_id": HALL, "date": DAY, "start": "11:00", "end": "13:00",
                                         "title": "Group meeting", "attendees": 10})
check("competing request allowed while undecided", s == 200, (s, d))
check("and the second person is warned", bool(d.get("warning")), d.get("warning"))
B2 = d["booking"]["id"]

print("\n--- the office queue ---")
s, d = office("GET", "/api/bookings/queue")
check("office still sees every request", s == 200 and len(d["queue"]) == 3, (s, len(d.get("queue", []))))
check("competing requests flagged", any(x["competing"] for x in d["queue"]), d["queue"])
check("hall is marked as needing the HoD", all(x["needs_hod"] for x in d["queue"]), d["queue"])
s, d = prof("GET", "/api/bookings/queue"); check("faculty cannot see the queue", s == 403, s)
s, d = prof("GET", "/api/bookings/hod");   check("faculty cannot see approvals", s == 403, s)

print("\n--- the office forwards, then the HoD decides ---")
s, d = hod("GET", "/api/bookings/hod")
check("the Head is told nothing until the office forwards", s == 200 and len(d["waiting"]) == 0,
      (s, len(d.get("waiting", []))))
mails_before = len([m for m in last_office_mails() if "for your approval" in m])
check("and no approval e-mail has been sent to him", mails_before == 0, mails_before)

s, d = office("POST", "/api/bookings/%d/office" % B1, {"action": "confirm"})
check("office cannot confirm a hall itself", s == 400, (s, d.get("error", "")[:50]))
s, d = office("POST", "/api/bookings/%d/office" % B1, {"action": "return", "note": "check the date"})
check("the office can send a request back", s == 200 and d["status"] == "returned", (s, d))
s, d = prof("PUT", "/api/bookings/%d" % B1, dict(req, room_id=HALL))
check("the asker can correct and resend it", s == 200, (s, d.get("error")))
check("which puts it back with the office, not the Head", d.get("status") == "pending", d.get("status"))
B1 = d["booking"]["id"] if s == 200 else B1

s, d = office("POST", "/api/bookings/%d/office" % B1, {"action": "forward"})
check("the office forwards it", s == 200 and d["status"] == "forwarded", (s, d))
check("now the Head gets his e-mail",
      len([m for m in last_office_mails() if "for your approval" in m]) >= 1, "none sent")
s, d = hod("GET", "/api/bookings/hod")
check("and it appears in his list", s == 200 and len(d["waiting"]) >= 1, (s, len(d.get("waiting", []))))
s, d = hod("POST", "/api/bookings/%d/decide" % B1, {"action": "approve", "note": "Approved."})
check("HoD approves", s == 200 and d["status"] == "approved", (s, d))

print("\n--- the slot is now really held ---")
office("POST", "/api/bookings/%d/office" % B2, {"action": "forward"})
s2, d2 = hod("POST", "/api/bookings/%d/decide" % B2, {"action": "approve"})
check("a competing request cannot be approved into the taken slot", s2 == 409, (s2, d2.get("error")))
s, d = prof("POST", "/api/bookings", {"room_id": HALL, "date": DAY, "start": "10:30", "end": "11:00",
                                      "title": "Overlapping talk"})
check("a new overlapping request is refused", s == 409, (s, d.get("error")))
s, d = prof("POST", "/api/bookings", {"room_id": HALL, "date": DAY, "start": "12:00", "end": "13:00",
                                      "title": "Back-to-back talk"})
check("the slot straight afterwards is fine", s == 200, (s, d.get("error")))
B3 = d["booking"]["id"] if s == 200 else None

print("\n--- classroom cleared by the office alone ---")
server.q("UPDATE rooms SET needs_hod=0 WHERE id=?", (ROOM,))
s, d = prof("POST", "/api/bookings", {"room_id": ROOM, "date": DAY, "start": "09:00", "end": "10:00",
                                      "title": "Make-up class"})
B4 = d["booking"]["id"]
s, d = office("POST", "/api/bookings/%d/office" % B4, {"action": "confirm"})
check("office confirms a classroom", s == 200 and d["status"] == "approved", (s, d))

print("\n--- the HoD's auto-approve ---")
server.q("UPDATE rooms SET needs_hod=1, auto_ok=1 WHERE id=?", (HALL,))
s, d = prof("POST", "/api/bookings", {"room_id": HALL, "date": DAY, "start": "14:00", "end": "15:00",
                                      "title": "Routine lab meeting", "attendees": 20})
B5 = d["booking"]["id"]
check("a routine hall request waits with the office first", d["booking"]["status"] == "pending", d["booking"]["status"])
s, d = office("POST", "/api/bookings/%d/office" % B5, {"action": "forward"})
check("forwarding it approves it at once under standing approval",
      s == 200 and d["status"] == "approved" and d.get("auto"), (s, d))
check("and it is marked as automatic", booking_status(B5) == "approved" and is_auto(B5),
      (booking_status(B5), is_auto(B5)))

s, d = prof("POST", "/api/bookings", {"room_id": HALL, "date": DAY, "start": "15:30", "end": "19:30",
                                      "title": "All-evening workshop", "attendees": 80, "outside": True})
B6 = d["booking"]["id"]
s, d = office("POST", "/api/bookings/%d/office" % B6, {"action": "forward"})
check("an outside booking still goes to the HoD", s == 200 and d["status"] == "forwarded", (s, d))
check("and the reason standing approval did not cover it is recorded",
      "outside" in (d.get("why") or "") or "outside" in log_text(B6), (d.get("why"), log_text(B6)))

bookings.save_cfg({"auto_until": DAY})
far = (server.now() + server.timedelta(days=30)).strftime("%Y-%m-%d")
s, d = prof("POST", "/api/bookings", {"room_id": HALL, "date": far, "start": "14:00", "end": "15:00",
                                      "title": "Later talk"})
B7 = d["booking"]["id"]
s, d = office("POST", "/api/bookings/%d/office" % B7, {"action": "forward"})
check("auto-approve stops after the end date", s == 200 and d["status"] == "forwarded", (s, d))
bookings.save_cfg({"auto_until": ""})

print("\n--- returning a request for correction ---")
s, d = scholar("POST", "/api/bookings", {"room_id": ROOM, "date": DAY, "start": "16:00", "end": "17:00",
                                         "title": "Practice talk"})
B8 = d["booking"]["id"]
s, d = office("POST", "/api/bookings/%d/office" % B8, {"action": "return", "note": "Please give the attendance."})
check("returned to the scholar", s == 200 and d["status"] == "returned", (s, d))
s, d = scholar("PUT", "/api/bookings/%d" % B8, {"room_id": ROOM, "date": DAY, "start": "16:00", "end": "17:00",
                                                "title": "Practice talk", "attendees": 12})
check("scholar corrects and resubmits", s == 200 and d["booking"]["status"] == "pending", (s, d))
s, d = prof("PUT", "/api/bookings/%d" % B8, {"room_id": ROOM, "date": DAY, "start": "16:00", "end": "17:00",
                                             "title": "Hijack"})
check("someone else cannot edit it", s == 403, s)

print("\n--- bulk approval and taking a booking back ---")
for x in office("GET", "/api/bookings/queue")[1]["queue"]:      # office clears its desk
    if x["status"] in ("pending", "returned"):
        office("POST", "/api/bookings/%d/office" % x["id"], {"action": "forward"})
ids = [x["id"] for x in hod("GET", "/api/bookings/hod")[1]["waiting"]]
check("the Head now has the forwarded ones", len(ids) >= 1, ids)
s, d = hod("POST", "/api/bookings/decide-many", {"ids": ids, "action": "approve", "note": "Cleared together."})
check("HoD approves several at once", s == 200 and d["done"] >= 1, (s, d))
check("every one is accounted for", d["done"] + len(d["failed"]) == len(ids), (d["done"], d["failed"], ids))
check("anything refused was refused for a real reason",
      all("booked" in f["error"] or "decided" in f["error"] for f in d["failed"]), d["failed"])
# the invariant that matters: no two confirmed bookings of one room may overlap
rows = server.q("SELECT room_id,on_date,t_start,t_end,ref FROM bookings WHERE status='approved'").fetchall()
overlapping = [(a["ref"], b2["ref"]) for i, a in enumerate(rows) for b2 in rows[i + 1:]
               if a["room_id"] == b2["room_id"] and a["on_date"] == b2["on_date"]
               and a["t_start"] < b2["t_end"] and b2["t_start"] < a["t_end"]]
check("no two confirmed bookings of a room overlap", not overlapping, overlapping)
s, d = hod("POST", "/api/bookings/%d/revoke" % B5, {"note": "Institute event in the hall."})
check("a confirmed booking can be withdrawn", s == 200, (s, d))
s, d = prof("POST", "/api/bookings", {"room_id": HALL, "date": DAY, "start": "14:00", "end": "15:00",
                                      "title": "Re-using the freed slot"})
check("the freed slot can be booked again", s == 200, (s, d.get("error")))

print("\n--- what the faculty member and the public see ---")
s, d = prof("GET", "/api/bookings/mine")
check("faculty sees own requests with their state", s == 200 and len(d["bookings"]) >= 5, (s, len(d.get("bookings", []))))
check("states are in plain words", all(x["status_label"] for x in d["bookings"]), d["bookings"][:1])
s, d = prof("GET", "/api/bookings/public", query="from=" + DAY)
check("public feed lists confirmed bookings only", s == 200 and all(x.get("title") for x in d["bookings"]), (s, d))
check("public feed names who booked", any(x.get("by") for x in d["bookings"]), d["bookings"][:2])

s, d = prof("POST", "/api/bookings", {"room_id": ROOM, "date": DAY, "start": "17:30", "end": "18:00",
                                      "title": "Quiet booking", "hide_name": True})
B9 = d["booking"]["id"]
server.q("UPDATE bookings SET status='approved' WHERE id=?", (B9,))
s, d = prof("GET", "/api/bookings/public", query="from=" + DAY)
quiet = [x for x in d["bookings"] if x["title"] == "Quiet booking"]
check("'hide my name' is respected", quiet and "by" not in quiet[0], quiet)

print("\n--- rooms and settings ---")
s, d = admin("POST", "/api/bookings/rooms", {"name": "Lecture Hall LH-2", "kind": "hall", "capacity": 200})
check("admin adds a room", s == 200, (s, d))
s, d = office("POST", "/api/bookings/rooms", {"name": "Sneaky room"})
check("office cannot add rooms", s == 403, s)
s, d = hod("PUT", "/api/bookings/settings", {"auto_rooms": [HALL], "max_hours": 3})
check("HoD changes the auto-approve settings", s == 200, (s, d))
s, d = prof("PUT", "/api/bookings/settings", {"max_hours": 99})
check("faculty cannot change them", s == 403, s)
check("the setting was stored", bookings.cfg()["max_hours"] == 3, bookings.cfg()["max_hours"])

print("\n--- security ---")
anon = Client()
for path in ("/api/bookings/config", "/api/bookings/queue", "/api/bookings/hod", "/api/bookings/mine"):
    s, d = anon("GET", path); check("logged out: " + path, s == 401, s)
nocsrf = Client("sid-prof@iitkgp.ac.in", None)
s, d = nocsrf("POST", "/api/bookings", req)
check("a POST without the CSRF token is refused", s == 403, s)

print("\n--- e-mails ---")
out = sorted(os.listdir("data/outbox")) if os.path.isdir("data/outbox") else []
check("e-mails were produced", len(out) > 10, len(out))
text = "".join(open("data/outbox/" + f, encoding="utf-8", errors="replace").read() for f in out)
for want in ("waiting for approval", "for your approval", "CONFIRMED", "SENT BACK", "CANCELLED"):
    check("e-mail sent: " + want, want in text, text[:200])
check("the office is copied in rather than sent a separate mail", "Cc:" in text)
check("e-mails carry the reference", REF1 in text)

print("\n--- the record of who did what ---")
n = server.q1("SELECT COUNT(*) c FROM booking_log")["c"]
check("every step logged", n >= 15, n)
a = server.q1("SELECT COUNT(*) c FROM audit WHERE action LIKE 'booking%'")["c"]
check("decisions in the portal activity log", a >= 8, a)

print("\n%d passed, %d failed" % (PASS, FAIL))
sys.exit(1 if FAIL else 0)
