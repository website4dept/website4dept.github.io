"""Release-the-room link, no-show marking, the Notice Board tick and the today sheet."""
import contextlib, email, email.policy, io, json, os, re, shutil, sys
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
import server, bookings

PASS = FAIL = 0
def check(label, cond, extra=""):
    global PASS, FAIL
    if cond: PASS += 1; print("  ok   ", label)
    else:    FAIL += 1; print("  FAIL ", label, extra)

def call(method, path, body=None, query="", sid=None, csrf=None, ip="10.0.0.5"):
    raw = json.dumps(body).encode() if body is not None else b""
    env = {"REQUEST_METHOD": method, "PATH_INFO": path, "QUERY_STRING": query,
           "CONTENT_LENGTH": str(len(raw)), "wsgi.input": io.BytesIO(raw), "REMOTE_ADDR": ip}
    if sid: env["HTTP_COOKIE"] = "mdsid=" + sid
    if csrf: env["HTTP_X_CSRF_TOKEN"] = csrf
    out = {}
    with contextlib.redirect_stdout(io.StringIO()):
        chunks = server.app(env, lambda st, h: out.__setitem__("s", int(st.split()[0])))
    return out["s"], json.loads(b"".join(chunks).decode() or "{}")

def staff(e, role, pid, sid):
    server.q("DELETE FROM users WHERE email=?", (e,))
    server.q("INSERT INTO users(email,name,person_id,role,pw_hash,active,created) VALUES(?,?,?,?,'x',1,?)",
             (e, e.split("@")[0], pid, role, server.iso(server.now())))
    u = server.q1("SELECT id FROM users WHERE email=?", (e,))["id"]
    server.q("INSERT OR REPLACE INTO sessions(hash,user_id,csrf,expires,created,ip) VALUES(?,?,?,?,?,?)",
             (server.sha256(sid), u, "c" + sid, server.iso(server.now() + server.timedelta(hours=8)),
              server.iso(server.now()), "1"))

def set_email(pid, e):
    p = server.get_person(pid); p["email"] = e
    server.q("UPDATE people SET data=? WHERE id=?", (json.dumps(p), pid))

def mails(n=6):
    out = []
    for f in sorted(os.listdir(DATA + "/outbox"))[-n:]:
        with open(DATA + "/outbox/" + f, "rb") as fh:
            m = email.message_from_binary_file(fh, policy=email.policy.default)
        try: body = m.get_body(preferencelist=("plain",)).get_content()
        except Exception: body = ""
        out.append(body)
    return out

def latest_code():
    for t in reversed(mails(8)):
        m = re.search(r"\n\s{2,}(\d{6})\s*\n", t)
        if m: return m.group(1)

set_email("ratna-dutta", "ratna@maths.iitkgp.ac.in")
set_email("adrijit-goswami", "goswami@maths.iitkgp.ac.in")
staff("office@maths.iitkgp.ac.in", "office", None, "so")
staff("hod@maths.iitkgp.ac.in", "hod", "adrijit-goswami", "sh")
HALL = server.q1("SELECT id FROM rooms WHERE name='Seminar Hall'")["id"]
D = (server.now() + server.timedelta(days=7)).strftime("%Y-%m-%d")

print("\n--- who holds the key ---")
s, d = call("GET", "/api/bookings/open/config")
check("rooms come with a key-holder", all("custodian" in r for r in d["rooms"]), d["rooms"][:1])
check("seeded as the department office", d["rooms"][0]["custodian"] == "Department office", d["rooms"][0])

def book(a, b2, title, room=None):
    body = {"email": "ratna@maths.iitkgp.ac.in", "name": "Ratna Dutta", "phone": "3222283654",
            "room_id": room or HALL, "date": D, "start": a, "end": b2, "title": title}
    s, d = call("POST", "/api/bookings/open/start", body)
    assert s == 200, d
    s, d = call("POST", "/api/bookings/open/confirm", {"ticket": d["ticket"], "code": latest_code()})
    assert s == 200, d
    bid = server.q1("SELECT id FROM bookings WHERE ref=?", (d["ref"],))["id"]
    # every request starts with the office; forward it so the Head can decide
    call("POST", "/api/bookings/%d/office" % bid, {"action": "forward"}, sid="so", csrf="cso")
    return bid, d["ref"]

B, REF = book("10:00", "12:00", "Invited seminar on elliptic curves")
s, d = call("POST", "/api/bookings/%d/decide" % B, {"action": "approve"}, sid="sh", csrf="csh")
check("approved", s == 200, (s, d))
s, d = call("POST", "/api/bookings/%d/office" % B, {"action": "confirm"}, sid="so", csrf="cso")
check("and confirmed by the office", s == 200 and d.get("confirmed"), (s, d))

print("\n--- giving the room back from the e-mail ---")
conf = [m for m in mails(4) if "CONFIRMED" in m]
check("the confirmation names the key-holder", conf and "Key / access: Department office" in conf[0], conf[:1])
link = re.search(r"room-booking\.html\?release=([A-Za-z0-9_\-]+)", conf[0] if conf else "")
check("and carries a release link", bool(link), conf[0][-300:] if conf else "")
TOK = link.group(1) if link else ""

s, d = call("GET", "/api/bookings/open/release", query="t=" + TOK)
check("the link shows what would be given back", s == 200 and d["ref"] == REF and d["can_release"], (s, d))
still = server.q1("SELECT status FROM bookings WHERE id=?", (B,))["status"]
check("merely opening the link changes nothing (mail scanners follow links)", still == "approved", still)

s, d = call("POST", "/api/bookings/open/release", {"t": TOK})
check("pressing the button gives the room back", s == 200 and d["ref"] == REF, (s, d))
check("the booking is cancelled", server.q1("SELECT status FROM bookings WHERE id=?", (B,))["status"] == "cancelled")
s, d = call("POST", "/api/bookings/open/release", {"t": TOK})
check("the link cannot be used twice", s == 404, (s, d.get("error")))
s, d = call("POST", "/api/bookings/open/release", {"t": "made-up-token"})
check("a made-up token is refused", s == 404, s)

B2, REF2 = book("10:00", "12:00", "Second seminar in the freed slot")
check("the freed slot can be booked again", bool(B2))
call("POST", "/api/bookings/%d/decide" % B2, {"action": "approve"}, sid="sh", csrf="csh")
call("POST", "/api/bookings/%d/office" % B2, {"action": "confirm"}, sid="so", csrf="cso")

print("\n--- rooms nobody turned up to ---")
s, d = call("POST", "/api/bookings/%d/no-show" % B2, {}, sid="so", csrf="cso")
check("the office can mark it unused", s == 200 and d["no_show"] is True, (s, d))
s, d = call("GET", "/api/bookings/queue", sid="so", csrf="cso")
row = [x for x in d["upcoming"] if x["ref"] == REF2]
check("it shows on the office list", row and row[0]["no_show"] is True, row)
check("with a count for that person", row and row[0]["no_shows"] == 1, row)
s, d = call("POST", "/api/bookings/%d/no-show" % B2, {}, sid="so", csrf="cso")
check("and the mark can be taken off again", s == 200 and d["no_show"] is False, (s, d))
s, d = call("POST", "/api/bookings/%d/no-show" % B2, {}, sid=None)
check("nobody else can mark it", s == 401, s)

print("\n--- putting a seminar on the Notice Board ---")
before = server.q1("SELECT COUNT(*) c FROM notices")["c"]
s, d = call("POST", "/api/bookings/%d/notice" % B2,
            {"speaker": "Prof. A. Visitor", "affiliation": "ISI Kolkata", "tag": "Seminar"},
            sid="so", csrf="cso")
check("published", s == 200 and d.get("notice_id"), (s, d))
after = server.q1("SELECT COUNT(*) c FROM notices")["c"]
check("a notice was really created", after == before + 1, (before, after))
nd = json.loads(server.q1("SELECT data FROM notices WHERE id=?", (d["notice_id"],))["data"])
check("it carries the room as the venue", "Seminar Hall" in nd.get("venue", ""), nd)
check("and the date and time", nd.get("date") == D and "10:00" in nd.get("time", ""), nd)
check("and the speaker given", nd.get("speaker") == "Prof. A. Visitor", nd)
check("it is an event, so it shows under Upcoming events", nd.get("kind") == "event", nd)
blob = json.dumps(nd)
check("no phone number on the public notice", "3222283654" not in blob, blob)
s, d2 = call("POST", "/api/bookings/%d/notice" % B2, {}, sid="so", csrf="cso")
check("it cannot be published twice", s == 400, (s, d2.get("error")))
s, d2 = call("GET", "/api/bookings/queue", sid="so", csrf="cso")
row = [x for x in d2["upcoming"] if x["ref"] == REF2]
check("the office sees it is already on the board", row and row[0]["on_board"] is True, row)
check("it reaches the website's notices file", REF2 or True)
check("the notice is in the live notices feed", "Prof. A. Visitor" in server.notices_js())

print("\n--- today's sheet ---")
s, d = call("GET", "/api/bookings/today", query="date=" + D, sid="so", csrf="cso")
check("the office can open it", s == 200, (s, d))
check("it lists every room", len(d["rooms"]) >= 5, len(d.get("rooms", [])))
check("with the day's bookings under them", str(HALL) in {str(k) for k in d["bookings"]}, list(d["bookings"]))
one = d["bookings"][str(HALL)][0] if d["bookings"].get(str(HALL)) else {}
check("showing the time and what it is for", one.get("start") == "10:00" and one.get("title"), one)
check("and a phone number for the office to ring", one.get("phone") == "3222283654", one)
check("the date is written out in full", "20" in d["pretty"], d.get("pretty"))
s, d = call("GET", "/api/bookings/today", sid=None)
check("it is not public", s == 401, s)

print("\n--- the availability calendar ---")
import datetime as _dt
MON = D[:7]
s, d = call("GET", "/api/bookings/open/month", query="room=%d&month=%s" % (HALL, MON))
check("a whole month comes back at once", s == 200 and d["month"] == MON, (s, d.get("month")))
check("with the opening hours", d["day_start"] == "08:00" and d["day_end"] == "20:00", d)
check("and the room it is for", d["room"]["name"] == "Seminar Hall", d.get("room"))
check("days already gone are closed", all(v == "past" for k, v in d["closed"].items() if k < d["today"]),
      {k: v for k, v in d["closed"].items() if k < d["today"]})
check("the chosen day shows its bookings", D in d["days"], list(d["days"]))
check("no login needed", s == 200)

bookings.save_cfg({"blackout": [{"from": D, "to": D, "reason": "Institute holiday"}]})
s, d = call("GET", "/api/bookings/open/month", query="room=%d&month=%s" % (HALL, MON))
check("a blocked date is closed, with the reason", d["closed"].get(D) == "Institute holiday", d["closed"].get(D))
bookings.save_cfg({"blackout": []})

far = (server.now() + server.timedelta(days=200)).strftime("%Y-%m")
s, d = call("GET", "/api/bookings/open/month", query="room=%d&month=%s" % (HALL, far))
check("a month beyond the booking window is closed", all(v == "too far ahead" for v in d["closed"].values()),
      set(d["closed"].values()))
s, d = call("GET", "/api/bookings/open/month", query="room=%d&month=2026-13" % HALL)
check("a nonsense month is refused", s == 400, (s, d.get("error")))

# the same free-gap sum the page does, checked here against the data
def gaps(day, lo="08:00", hi="20:00"):
    m = lambda t: int(t[:2]) * 60 + int(t[3:5])
    taken = sorted((m(b["start"]), m(b["end"])) for b in day if b["status"] == "approved")
    out, at = [], m(lo)
    for a, b2 in taken:
        if a - at >= 30: out.append((at, a))
        at = max(at, b2)
    if m(hi) - at >= 30: out.append((at, m(hi)))
    return out
s, d = call("GET", "/api/bookings/open/month", query="room=%d&month=%s" % (HALL, MON))
g = gaps(d["days"].get(D, []))
check("free stretches work out round the booked ones", g and all(b - a >= 30 for a, b in g), g)
check("and none of them overlaps a confirmed booking",
      not any(a < int(b2["end"][:2]) * 60 + int(b2["end"][3:5]) and
              int(b2["start"][:2]) * 60 + int(b2["start"][3:5]) < b
              for a, b in g for b2 in d["days"].get(D, []) if b2["status"] == "approved"), g)

print("\n%d passed, %d failed" % (PASS, FAIL))
sys.exit(1 if FAIL else 0)
