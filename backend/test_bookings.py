"""End-to-end test of the booking workflow, driven straight through the WSGI app."""
import contextlib, io, json, os, shutil, sys

BACKEND = os.path.dirname(os.path.abspath(__file__))
os.chdir(BACKEND); sys.path.insert(0, BACKEND)
# Every run starts from an empty database in a folder of its own, so one run can
# never be upset by an earlier one and the real data/ folder is never touched.
DATA = "data-test"
shutil.rmtree(os.path.join(BACKEND, DATA), ignore_errors=True)
os.makedirs(os.path.join(BACKEND, DATA))
_cfg = json.load(open(os.path.join(BACKEND, "config.example.json")))
_cfg["data_dir"] = DATA
_cfg["mail"]["mode"] = "console"
_path = os.path.join(BACKEND, DATA, "config.json")
json.dump(_cfg, open(_path, "w"))
os.environ["PORTAL_CONFIG"] = _path
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
    if not os.path.isdir(DATA + "/outbox"):
        return out
    for f in sorted(os.listdir(DATA + "/outbox"))[-n:]:
        with open(DATA + "/outbox/" + f, "rb") as fh:
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
def is_confirmed(bid):
    return bool(server.q1("SELECT confirmed FROM bookings WHERE id=?", (bid,))["confirmed"])
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
check("but it is not confirmed by that alone", d.get("confirmed") is False, d)
check("and nothing is sent to the person who asked",
      not any("CONFIRMED" in m for m in last_office_mails()), "a confirmation went out too early")
check("the office is asked to confirm it",
      any("please confirm" in m.lower() for m in last_office_mails()), "the office was not told")

print("\n--- the office confirms, and only that sends the e-mail ---")
s, d = prof("GET", "/api/bookings/mine")
mine = [x for x in d["bookings"] if x["id"] == B1][0]
check("the asker is shown that the office has still to confirm",
      mine["awaiting_office"] and "office" in mine["status_label"].lower(), mine["status_label"])
s, d = hod("GET", "/api/bookings/hod")
check("the Head sees what the office has not confirmed",
      any(x["id"] == B1 for x in d["awaiting_office"]), d.get("awaiting_office"))
s, d = office("GET", "/api/bookings/queue")
check("the office has it in Ready to confirm",
      any(x["id"] == B1 for x in d["to_confirm"]) and d["counts"]["to_confirm"] >= 1, d["counts"])
s, d = office("GET", "/api/bookings/%d/check" % B1)
check("the office can run the checklist over it", s == 200 and len(d["checks"]) >= 5, (s, d))
check("the checklist says the e-mail has somewhere to go",
      any(c["what"].startswith("Address") and c["level"] == "ok" for c in d["checks"]), d["checks"])
s, d = office("POST", "/api/bookings/%d/office" % B1, {"action": "confirm"})
check("the office confirms it", s == 200 and d.get("confirmed"), (s, d))
check("now the confirmation goes out", any("CONFIRMED" in m for m in last_office_mails()), "none sent")
check("and the booking is marked confirmed", is_confirmed(B1), "not marked")
s, d = office("POST", "/api/bookings/%d/office" % B1, {"action": "confirm"})
check("it cannot be confirmed twice", s == 400, (s, d.get("error")))
s, d = hod("GET", "/api/bookings/hod")
check("the Head no longer sees it waiting on the office",
      not any(x["id"] == B1 for x in d["awaiting_office"]), d.get("awaiting_office"))

print("\n--- the slot is now really held ---")
s2, d2 = office("POST", "/api/bookings/%d/office" % B2, {"action": "forward"})
check("the office cannot forward a request whose slot is gone", s2 == 409, (s2, d2.get("error")))
check("and it says which room and when", "Seminar Hall" in (d2.get("error") or ""), d2.get("error"))
check("so the request is still on the office desk", booking_status(B2) == "pending", booking_status(B2))
s2, d2 = hod("POST", "/api/bookings/%d/decide" % B2, {"action": "approve"})
check("the Head was never given it to approve", s2 == 400, (s2, d2.get("error")))
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
check("an automatic approval still waits for the office", not is_confirmed(B5), "confirmed too early")
s, d = office("POST", "/api/bookings/%d/office" % B5, {"action": "confirm"})
check("which the office then confirms", s == 200 and d.get("confirmed"), (s, d))

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
check("and the booker is told it is cancelled",
      any("CANCELLED" in m for m in last_office_mails()), "no cancellation sent")
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

print("\n--- the office switch: confirm as soon as the HoD approves ---")
server.q("UPDATE rooms SET auto_ok=0 WHERE id=?", (HALL,))   # make the Head decide again
s, d = prof("PUT", "/api/bookings/settings", {"office_auto_confirm": True})
check("faculty cannot change booking settings", s == 403, s)
s, d = office("PUT", "/api/bookings/settings", {"max_hours": 9})
check("the office cannot change the Head's rules", s == 403, (s, d.get("error", "")[:40]))
s, d = office("PUT", "/api/bookings/settings", {"office_auto_confirm": True})
check("but the office can switch confirm-on-approval on", s == 200 and d["office_auto_confirm"], (s, d))
s, d = office("GET", "/api/bookings/queue")
check("and sees it switched on", d.get("office_auto_confirm") is True, d.get("office_auto_confirm"))

D9 = (server.now() + server.timedelta(days=55)).strftime("%Y-%m-%d")
s, d = prof("POST", "/api/bookings", {"room_id": HALL, "date": D9, "start": "10:00", "end": "11:00",
                                      "title": "Talk with the switch on"})
B9 = d["booking"]["id"]
office("POST", "/api/bookings/%d/office" % B9, {"action": "forward"})
s, d = hod("POST", "/api/bookings/%d/decide" % B9, {"action": "approve"})
check("with the switch on the HoD's approval confirms it straight away",
      s == 200 and d.get("confirmed") and is_confirmed(B9), (s, d))
check("no second click is left for the office",
      not any(x["id"] == B9 for x in office("GET", "/api/bookings/queue")[1]["to_confirm"]), B9)
s, d = office("PUT", "/api/bookings/settings", {"office_auto_confirm": False})
check("the office can switch it off again", s == 200 and d["office_auto_confirm"] is False, (s, d))

print("\n--- the HoD clears a whole day at once ---")
D10 = (server.now() + server.timedelta(days=56)).strftime("%Y-%m-%d")
made = []
for t0, t1, name in (("09:00", "10:00", "Day clear A"), ("11:00", "12:00", "Day clear B"),
                     ("13:00", "14:00", "Day clear C")):
    s, d = prof("POST", "/api/bookings", {"room_id": HALL, "date": D10, "start": t0, "end": t1, "title": name})
    check("request for " + name + " accepted", s == 200, (s, d.get("error")))
    made.append(d["booking"]["id"])
    office("POST", "/api/bookings/%d/office" % d["booking"]["id"], {"action": "forward"})
s, d = hod("GET", "/api/bookings/hod")
check("the Head's page lists the dates waiting on him",
      any(x["date"] == D10 and x["count"] == 3 for x in d["days"]), d.get("days"))
s, d = hod("POST", "/api/bookings/decide-many", {"date": D10, "action": "approve", "note": "Whole day cleared."})
check("approve everything on one date", s == 200 and d["done"] == 3, (s, d))
check("and every one of them still waits for the office",
      all(not is_confirmed(i) for i in made), [is_confirmed(i) for i in made])
s, d = office("GET", "/api/bookings/queue")
check("so all three sit in Ready to confirm",
      len([x for x in d["to_confirm"] if x["id"] in made]) == 3, d["counts"])
for i in made:
    office("POST", "/api/bookings/%d/office" % i, {"action": "confirm"})
check("the office lets them out one by one", all(is_confirmed(i) for i in made), made)

print("\n--- nothing unconfirmed reaches the Notice Board ---")
s, d = prof("POST", "/api/bookings", {"room_id": HALL, "date": D9, "start": "15:00", "end": "16:00",
                                      "title": "Unconfirmed talk"})
B11 = d["booking"]["id"]
office("POST", "/api/bookings/%d/office" % B11, {"action": "forward"})
hod("POST", "/api/bookings/%d/decide" % B11, {"action": "approve"})
s, d = office("POST", "/api/bookings/%d/notice" % B11, {"tag": "Seminar"})
check("an unconfirmed booking cannot be published", s == 400, (s, d.get("error", "")[:60]))
office("POST", "/api/bookings/%d/office" % B11, {"action": "confirm"})
s, d = office("POST", "/api/bookings/%d/notice" % B11, {"tag": "Seminar"})
check("a confirmed one can be", s == 200, (s, d.get("error")))

print("\n--- the admin may watch, but not decide ---")
D30 = (server.now() + server.timedelta(days=30)).strftime("%Y-%m-%d")
s, d = prof("POST", "/api/bookings", {"room_id": HALL, "date": D30, "start": "09:00", "end": "10:00",
                                      "title": "Something for the admin to look at"})
BA = d["booking"]["id"]

s, d = admin("GET", "/api/bookings/records")
check("the admin can read the record of every booking", s == 200 and d["total"] > 0, s)
s, d = admin("GET", "/api/bookings/records/%d" % BA)
check("and open any one of them in full", s == 200 and "history" in d, s)
s, d = admin("GET", "/api/bookings/config")
check("and is told it may only watch", s == 200 and d["watch_only"] is True, d.get("watch_only"))

s, d = admin("GET", "/api/bookings/queue")
check("but the office queue is not the admin's screen", s == 403, s)
check("and it says where to go instead", "Booking records" in (d.get("error") or ""), d.get("error"))
s, d = admin("GET", "/api/bookings/hod")
check("nor the Head's page", s == 403, s)
s, d = admin("GET", "/api/bookings/today")
check("nor Today", s == 403, s)
s, d = admin("GET", "/api/bookings/%d/check" % BA)
check("nor the checklist", s == 403, s)

s, d = admin("POST", "/api/bookings/%d/office" % BA, {"action": "forward"})
check("the admin cannot forward", s == 403, (s, d.get("error", "")[:40]))
check("and is told what to do instead", "department office" in (d.get("error") or ""), d.get("error"))
s, d = admin("POST", "/api/bookings/%d/office" % BA, {"action": "reject", "note": "No."})
check("cannot refuse", s == 403, s)
s, d = admin("POST", "/api/bookings/%d/office" % BA, {"action": "return", "note": "Fix it."})
check("cannot send back for correction", s == 403, s)
check("so the request is untouched", booking_status(BA) == "pending", booking_status(BA))

office("POST", "/api/bookings/%d/office" % BA, {"action": "forward"})
s, d = admin("POST", "/api/bookings/%d/decide" % BA, {"action": "approve"})
check("cannot approve", s == 403, (s, d.get("error", "")[:40]))
s, d = admin("POST", "/api/bookings/decide-many", {"date": D30, "action": "approve"})
check("cannot clear a whole day either", s == 403, s)
check("so it still sits with the Head", booking_status(BA) == "forwarded", booking_status(BA))

hod("POST", "/api/bookings/%d/decide" % BA, {"action": "approve"})
s, d = admin("POST", "/api/bookings/%d/office" % BA, {"action": "confirm"})
check("cannot confirm", s == 403, s)
check("so nothing has been sent", not is_confirmed(BA), "confirmed by the admin")
s, d = admin("POST", "/api/bookings/%d/notice" % BA, {"tag": "Seminar"})
check("cannot put it on the Notice Board", s == 403, s)

s, d = admin("PUT", "/api/bookings/settings", {"max_hours": 4})
check("but the admin can change the ordinary rules", s == 200, (s, d.get("error")))
s, d = admin("PUT", "/api/bookings/settings", {"auto_rooms": [HALL]})
check("and cannot give the Head's standing approval", s == 403, (s, d.get("error", "")[:40]))
s, d = hod("PUT", "/api/bookings/settings", {"auto_rooms": []})
check("only the Head can", s == 200, s)

office("POST", "/api/bookings/%d/office" % BA, {"action": "confirm"})
s, d = admin("POST", "/api/bookings/%d/revoke" % BA, {"note": "Room needed for an institute event."})
check("cannot withdraw a confirmed booking either", s == 403, s)
check("so the booking stands", booking_status(BA) == "approved", booking_status(BA))
s, d = office("POST", "/api/bookings/%d/revoke" % BA, {"note": "Room needed for an institute event."})
check("the office can", s == 200, (s, d.get("error")))
check("which frees the room", booking_status(BA) == "cancelled", booking_status(BA))
check("and the booker is told", any("CANCELLED" in m for m in last_office_mails()), "nothing sent")

print("\n--- classrooms never reach the Head ---")
check("a classroom does not need his approval",
      server.q1("SELECT needs_hod FROM rooms WHERE id=?", (ROOM,))["needs_hod"] == 0)
check("a seminar hall does",
      server.q1("SELECT needs_hod FROM rooms WHERE id=?", (HALL,))["needs_hod"] == 1)
DC = (server.now() + server.timedelta(days=33)).strftime("%Y-%m-%d")
s, d = prof("POST", "/api/bookings", {"room_id": ROOM, "date": DC, "start": "09:00", "end": "10:00",
                                      "title": "Make-up class"})
BC = d["booking"]["id"]
s, d = office("POST", "/api/bookings/%d/office" % BC, {"action": "confirm"})
check("so the office confirms it straight off", s == 200 and d.get("confirmed"), (s, d))

print("\n--- two people after the same slot ---")
DR = (server.now() + server.timedelta(days=35)).strftime("%Y-%m-%d")
server.q("UPDATE rooms SET auto_ok=0 WHERE id=?", (HALL,))
s, d = prof("POST", "/api/bookings", {"room_id": HALL, "date": DR, "start": "10:00", "end": "12:00",
                                      "title": "First to ask"})
R1 = d["booking"]["id"]
s, d = prof("POST", "/api/bookings", {"room_id": HALL, "date": DR, "start": "11:00", "end": "13:00",
                                      "title": "Second, overlapping"})
R2 = d["booking"]["id"]
check("an overlapping request is accepted, not blocked", s == 200, (s, d.get("error")))
s, d = prof("POST", "/api/bookings", {"room_id": HALL, "date": DR, "start": "15:00", "end": "16:00",
                                      "title": "Same day, no overlap"})
R3 = d["booking"]["id"]
# make the order of asking unambiguous
for n, bid in ((90, R1), (40, R2), (10, R3)):
    server.q("UPDATE bookings SET created=? WHERE id=?",
             (server.iso(server.now() - server.timedelta(minutes=n)), bid))

s, d = office("GET", "/api/bookings/%d/check" % R2)
check("the checklist names who else wants the slot", len(d["competitors"]) == 1, d.get("competitors"))
check("and says they asked first", d["competitors"][0]["earlier"] is True, d["competitors"][0])
check("the non-overlapping one is listed apart",
      len(d["same_day"]) == 1 and d["same_day"][0]["id"] == R3, d.get("same_day"))
s, d = office("GET", "/api/bookings/%d/check" % R1)
check("and from the other side, the later one is not marked as first",
      d["competitors"][0]["earlier"] is False, d["competitors"][0])

s, d = office("POST", "/api/bookings/%d/office" % R1, {"action": "forward", "refuse": [R2]})
check("refusing the others without a reason is not allowed", s == 400, (s, d.get("error", "")[:40]))
check("so nothing happened to them", booking_status(R2) == "pending", booking_status(R2))
s, d = office("POST", "/api/bookings/%d/office" % R1,
              {"action": "forward", "refuse": [R3], "refuse_note": "Nope."})
check("a request that does not overlap cannot be swept up",
      s == 200 and booking_status(R3) == "pending", (s, booking_status(R3)))

s, d = office("POST", "/api/bookings/%d/office" % R2,
              {"action": "forward", "refuse": [R1],
               "refuse_note": "The room went to an earlier request for the same slot."})
check("the office can give the slot to one and refuse the other", s == 200, (s, d.get("error")))
check("the refused one is marked rejected", booking_status(R1) == "rejected", booking_status(R1))
check("with the reason recorded",
      "earlier request" in (server.q1("SELECT decision_note n FROM bookings WHERE id=?", (R1,))["n"] or ""),
      server.q1("SELECT decision_note n FROM bookings WHERE id=?", (R1,))["n"])
check("and the person told", any("NOT APPROVED" in m or "not approved" in m.lower()
                                 for m in last_office_mails()), "nothing sent")

print("\n--- the Head hands room approvals to the office ---")
s, d = office("PUT", "/api/bookings/settings", {"hod_approval_off": True})
check("the office cannot switch it on", s == 403, s)
s, d = hod("PUT", "/api/bookings/settings", {"hod_approval_off": True})
check("nor can the Head while requests are still waiting for him", s == 409, (s, d.get("error", "")[:50]))
# clear his desk: approve what can be approved, refuse whatever clashes
for r in server.q("SELECT id FROM bookings WHERE status='forwarded'").fetchall():
    hod("POST", "/api/bookings/%d/decide" % r["id"], {"action": "approve"})
    if booking_status(r["id"]) == "forwarded":
        hod("POST", "/api/bookings/%d/decide" % r["id"], {"action": "reject", "note": "Clash."})
s, d = hod("GET", "/api/bookings/hod")
check("with his desk clear the switch is offered", d["can_switch_off"] is True, d.get("can_switch_off"))
s, d = hod("PUT", "/api/bookings/settings", {"hod_approval_off": True})
check("and he can switch it on", s == 200, (s, d.get("error")))
s, d = office("GET", "/api/bookings/queue")
check("the office is told", d["hod_approval_off"] is True, d.get("hod_approval_off"))

DH = (server.now() + server.timedelta(days=37)).strftime("%Y-%m-%d")
s, d = prof("POST", "/api/bookings", {"room_id": HALL, "date": DH, "start": "10:00", "end": "11:00",
                                      "title": "Hall while he is hands-off"})
BH = d["booking"]["id"]
s, d = office("POST", "/api/bookings/%d/office" % BH, {"action": "forward"})
check("forwarding a hall now approves it on the spot", s == 200 and d["status"] == "approved", (s, d))
check("it never sat with the Head", booking_status(BH) == "approved", booking_status(BH))
check("and it still waits for the office to confirm", not is_confirmed(BH), "confirmed too early")
s, d = hod("PUT", "/api/bookings/settings", {"hod_approval_off": False})
check("he can take it back", s == 200, s)

print("\n--- clearing a whole day, and a whole room ---")
DB = (server.now() + server.timedelta(days=39)).strftime("%Y-%m-%d")
batch = []
for t0, t1, title in (("09:00", "10:00", "Bulk A"), ("11:00", "12:00", "Bulk B"), ("13:00", "14:00", "Bulk C")):
    s, d = prof("POST", "/api/bookings", {"room_id": HALL, "date": DB, "start": t0, "end": t1, "title": title})
    batch.append(d["booking"]["id"])
s, d = office("POST", "/api/bookings/office-many", {"action": "forward", "date": DB})
check("the office can forward a whole day at once", s == 200 and len(d["done"]) == 3, (s, d))
check("and every one went to the Head",
      all(booking_status(i) == "forwarded" for i in batch), [booking_status(i) for i in batch])
s, d = hod("POST", "/api/bookings/decide-many", {"room": HALL, "action": "approve", "note": "Hall cleared."})
check("the Head can clear a whole room in one click", s == 200 and d["done"] >= 3, (s, d))
s, d = office("POST", "/api/bookings/office-many", {"action": "confirm", "date": DB})
check("and the office confirms the whole day", s == 200 and len(d["done"]) == 3, (s, d))
check("so all three are confirmed", all(is_confirmed(i) for i in batch), [is_confirmed(i) for i in batch])

print("\n--- the bulk buttons still check each one ---")
DX = (server.now() + server.timedelta(days=41)).strftime("%Y-%m-%d")
s, d = prof("POST", "/api/bookings", {"room_id": HALL, "date": DX, "start": "10:00", "end": "11:00",
                                      "title": "Will be taken"})
X1 = d["booking"]["id"]
s, d = prof("POST", "/api/bookings", {"room_id": HALL, "date": DX, "start": "10:30", "end": "11:30",
                                      "title": "Clashes with it"})
X2 = d["booking"]["id"]
office("POST", "/api/bookings/%d/office" % X1, {"action": "forward"})
hod("POST", "/api/bookings/%d/decide" % X1, {"action": "approve"})
office("POST", "/api/bookings/%d/office" % X1, {"action": "confirm"})
s, d = office("POST", "/api/bookings/office-many", {"action": "forward", "date": DX})
check("a clashing one is left behind rather than waved through",
      s == 200 and len(d["held"]) == 1 and d["held"][0]["ref"], (s, d))
check("and it says why", "free" in d["held"][0]["why"].lower() or "booked" in d["held"][0]["why"].lower(),
      d["held"][0]["why"])
check("so it is still on the office desk", booking_status(X2) == "pending", booking_status(X2))

print("\n--- the Head's two lists ---")
s, d = hod("GET", "/api/bookings/hod")
check("approved and rejected come back separately",
      isinstance(d.get("approved"), list) and isinstance(d.get("rejected"), list), list(d))
check("the one refused over the clash is in the rejected list",
      any(x["id"] == R1 for x in d["rejected"]), [x["ref"] for x in d["rejected"]])
check("and the reason travels with it",
      any(x["id"] == R1 and "earlier request" in (x["note"] or "") for x in d["rejected"]), "")
check("the Head also sees which rooms have something waiting", "rooms_waiting" in d, list(d))

print("\n--- the queues are in the order people asked ---")
s, d = office("GET", "/api/bookings/queue")
made = [b["created"] for b in d["queue"]]
check("office queue: oldest request first", made == sorted(made), made[:3])

print("\n--- the booking records: search, filter, sort ---")
s, d = prof("GET", "/api/bookings/records")
check("faculty cannot read the records", s == 403, s)
s, d = office("GET", "/api/bookings/records")
check("the office can", s == 200 and d["total"] >= 10, (s, d.get("total")))
check("they come back a page at a time", len(d["rows"]) <= d["per_page"], len(d["rows"]))
check("with a count for every state", set(d["counts"]) >= {"all", "confirmed", "awaiting", "hod", "office"}, d.get("counts"))
check("confirmed and unconfirmed are counted apart",
      d["counts"]["confirmed"] >= 1 and d["counts"]["all"] > d["counts"]["confirmed"], d["counts"])

s, d = office("GET", "/api/bookings/records", query="q=" + REF1)
check("found by reference number", s == 200 and d["total"] == 1 and d["rows"][0]["ref"] == REF1, (s, d.get("total")))
s, d = office("GET", "/api/bookings/records", query="q=Cryptography")
check("found by what it is for", s == 200 and d["total"] >= 1, (s, d.get("total")))
s, d = office("GET", "/api/bookings/records", query="q=prof@iitkgp.ac.in")
check("found by e-mail address", s == 200 and d["total"] >= 1, (s, d.get("total")))
s, d = office("GET", "/api/bookings/records", query="q=Seminar Hall")
check("found by room name", s == 200 and d["total"] >= 1, (s, d.get("total")))
s, d = office("GET", "/api/bookings/records", query="q=zzzznothing")
check("a search that matches nothing says so", s == 200 and d["total"] == 0, (s, d.get("total")))

s, d = office("GET", "/api/bookings/records", query="status=confirmed")
check("filter: confirmed only", s == 200 and all(x["confirmed"] for x in d["rows"]), (s, d.get("total")))
s, d = office("GET", "/api/bookings/records", query="status=awaiting")
check("filter: waiting for the office",
      s == 200 and all(x["status"] == "approved" and not x["confirmed"] for x in d["rows"]), s)
s, d = office("GET", "/api/bookings/records", query="status=rejected")
check("filter: refused", s == 200 and all(x["status"] == "rejected" for x in d["rows"]), s)
s, d = office("GET", "/api/bookings/records", query="room=%d&status=all" % HALL)
check("filter: one room", s == 200 and all(x["room_id"] == HALL for x in d["rows"]), s)
s, d = office("GET", "/api/bookings/records", query="from=%s&to=%s" % (DAY, DAY))
check("filter: one date", s == 200 and all(x["date"] == DAY for x in d["rows"]), s)

s, d = office("GET", "/api/bookings/records", query="sort=ref&dir=asc")
refs = [x["ref"] for x in d["rows"]]
check("sorted by reference, oldest first", refs == sorted(refs), refs[:4])
s, d = office("GET", "/api/bookings/records", query="sort=ref&dir=desc")
refs2 = [x["ref"] for x in d["rows"]]
check("and the other way round", refs2 == sorted(refs2, reverse=True), refs2[:4])
s, d = office("GET", "/api/bookings/records", query="sort=date&dir=asc")
dates = [x["date"] for x in d["rows"]]
check("sorted by date", dates == sorted(dates), dates[:4])
s, d = office("GET", "/api/bookings/records", query="sort=nonsense';DROP TABLE bookings;--")
check("a made-up sort order is ignored, not run", s == 200 and d["sort"] == "date", (s, d.get("sort")))
check("and the table is still there", server.q1("SELECT COUNT(*) c FROM bookings")["c"] > 0)

s, d = office("GET", "/api/bookings/records", query="page=99999")
check("asking past the last page gives the last page", s == 200 and d["page"] == d["pages"], (d.get("page"), d.get("pages")))

s, d = office("GET", "/api/bookings/records/%d" % B1)
check("one record opens in full", s == 200 and d["ref"] == REF1, (s, d.get("ref")))
check("with every step that was taken", len(d["history"]) >= 3, len(d.get("history", [])))
check("and who confirmed it, and when", bool(d["confirmed_at"]) and bool(d["confirmed_by"]),
      (d.get("confirmed_at"), d.get("confirmed_by")))
s, d = hod("GET", "/api/bookings/records/%d" % B1)
check("the Head can open a record too", s == 200, s)
s, d = prof("GET", "/api/bookings/records/%d" % B1)
check("the faculty member cannot", s == 403, s)

print("\n--- e-mails ---")
out = sorted(os.listdir(DATA + "/outbox")) if os.path.isdir(DATA + "/outbox") else []
check("e-mails were produced", len(out) > 10, len(out))
text = "".join(open(DATA + "/outbox/" + f, encoding="utf-8", errors="replace").read() for f in out)
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
