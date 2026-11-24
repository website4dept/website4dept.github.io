"""The booking form on the website: register check, six-digit code, routing, threaded e-mails."""
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

def call(method, path, body=None, query="", sid=None, csrf=None, ip="10.0.0.9"):
    raw = json.dumps(body).encode() if body is not None else b""
    env = {"REQUEST_METHOD": method, "PATH_INFO": path, "QUERY_STRING": query,
           "CONTENT_LENGTH": str(len(raw)), "wsgi.input": io.BytesIO(raw), "REMOTE_ADDR": ip}
    if sid: env["HTTP_COOKIE"] = "mdsid=" + sid
    if csrf: env["HTTP_X_CSRF_TOKEN"] = csrf
    out = {}
    with contextlib.redirect_stdout(io.StringIO()):
        chunks = server.app(env, lambda st, h: out.__setitem__("s", int(st.split()[0])))
    return out["s"], json.loads(b"".join(chunks).decode() or "{}")

def staff(email, role, person_id, sid):
    server.q("DELETE FROM users WHERE email=?", (email,))
    server.q("INSERT INTO users(email,name,person_id,role,pw_hash,active,created) VALUES(?,?,?,?,'x',1,?)",
             (email, email.split("@")[0], person_id, role, server.iso(server.now())))
    uid = server.q1("SELECT id FROM users WHERE email=?", (email,))["id"]
    server.q("INSERT OR REPLACE INTO sessions(hash,user_id,csrf,expires,created,ip) VALUES(?,?,?,?,?,?)",
             (server.sha256(sid), uid, "c" + sid, server.iso(server.now() + server.timedelta(hours=8)),
              server.iso(server.now()), "127.0.0.1"))
    return uid

def set_email(pid, email):
    p = server.get_person(pid); p["email"] = email
    server.q("UPDATE people SET data=? WHERE id=?", (json.dumps(p), pid))

def last_mails(n=40):
    """Header block + decoded body, so quoted-printable line breaks do not confuse the checks."""
    out = []
    for f in sorted(os.listdir(DATA + "/outbox"))[-n:]:
        with open(DATA + "/outbox/" + f, "rb") as fh:
            m = email.message_from_binary_file(fh, policy=email.policy.default)
        head = "\n".join("{}: {}".format(k, v) for k, v in m.items())
        try:
            body = m.get_body(preferencelist=("plain",)).get_content()
        except Exception:
            body = ""
        out.append(head + "\n\n" + body)
    return out

def code_from_outbox():
    for t in reversed(last_mails(10)):
        m = re.search(r"\n\s{2,}(\d{6})\s*\n", t)
        if m: return m.group(1)
    return None

# ---------------------------------------------------------------- the register
print("\n--- before any addresses are loaded ---")
s, d = call("GET", "/api/bookings/open/config")
check("the form loads", s == 200 and len(d["rooms"]) > 0, s)
check("but says the register is empty", d["register_ready"] is False, d.get("register_ready"))
check("it offers the faculty list for the advisor box", len(d["faculty"]) == 40, len(d["faculty"]))
check("and flags which faculty have no address", all(f["has_email"] is False for f in d["faculty"]), d["faculty"][:1])

D = (server.now() + server.timedelta(days=12)).strftime("%Y-%m-%d")
form = {"name": "Mou Jana", "email": "mou.jana@iitkgp.ac.in", "roll": "21MA91R05", "phone": "9876543210",
        "room_id": None, "date": D, "start": "15:00", "end": "17:00",
        "title": "Research scholars' meeting", "attendees": 14}
s, d = call("POST", "/api/bookings/open/start", dict(form, room_id=1))
check("nobody can book yet", s == 403 and "not been loaded" in d.get("error", ""), (s, d.get("error", "")[:60]))

# ------------------------------------------------- load addresses, as they will
print("\n--- addresses imported (as the JSON upload will do) ---")
set_email("ratna-dutta", "ratna@maths.iitkgp.ac.in")
set_email("adrijit-goswami", "goswami@maths.iitkgp.ac.in")
set_email("mou-jana", "mou.jana@iitkgp.ac.in")
set_email("akshay-murmu", "akshay@maths.iitkgp.ac.in")
server.q("INSERT OR REPLACE INTO contacts(name,email,grp) VALUES(?,?,?)",
         ("Arjun Sen", "arjun.sen@kgpian.iitkgp.ac.in", "msc-2025"))
staff("office@maths.iitkgp.ac.in", "office", None, "sidoffice")
staff("hod@maths.iitkgp.ac.in", "hod", "adrijit-goswami", "sidhod")

HALL = server.q1("SELECT id FROM rooms WHERE name='Seminar Hall'")["id"]
ROOM = server.q1("SELECT id FROM rooms WHERE name='Classroom NC-141'")["id"]
server.q("UPDATE rooms SET needs_hod=0 WHERE name LIKE 'Classroom%' OR name LIKE 'Tutorial%'")

s, d = call("GET", "/api/bookings/open/config")
check("register now ready", d["register_ready"] is True)
check("faculty with an address are marked", sum(1 for f in d["faculty"] if f["has_email"]) == 2,
      sum(1 for f in d["faculty"] if f["has_email"]))

# --------------------------------------------------------------- a scholar books
print("\n--- a research scholar books a hall ---")
s, d = call("POST", "/api/bookings/open/start", dict(form, room_id=HALL))
check("code sent", s == 200 and d.get("ticket"), (s, d))
check("address is masked in the reply", "@" in d.get("sent_to", "") and "mou.jana@" not in d.get("sent_to", ""), d.get("sent_to"))
check("supervisor found from the data file", d.get("advisor") == "Adrijit Goswami", d.get("advisor"))
check("and we can e-mail that supervisor", d.get("advisor_notified") is True, d)
ticket = d["ticket"]
check("nothing is booked yet", server.q1("SELECT COUNT(*) c FROM bookings")["c"] == 0)

code = code_from_outbox()
check("the code e-mail reached the scholar", bool(code), code)
s, d = call("POST", "/api/bookings/open/confirm", {"ticket": ticket, "code": "000000" if code != "000000" else "111111"})
check("a wrong code is refused", s == 401, (s, d.get("error")))
s, d = call("POST", "/api/bookings/open/confirm", {"ticket": ticket, "code": code})
check("the right code makes the request", s == 200 and d.get("ok"), (s, d))
REF = d.get("ref")
check("every request starts with the office", d.get("status") == "pending", d.get("status"))
check("and the page says who has it", d.get("waiting_with") == "the department office", d.get("waiting_with"))
check("the ticket cannot be used twice", call("POST", "/api/bookings/open/confirm", {"ticket": ticket, "code": code})[0] == 400)

print("\n--- the first e-mail ---")
mails = last_mails(6)
sub = [m for m in mails if REF in m and "waiting for approval" in m]
check("sent, and names the reference", bool(sub), REF)
one = sub[0] if sub else ""
check("to the scholar", "To: mou.jana@iitkgp.ac.in" in one, one[:200])
headers = one.split("\n\n")[0]
check("supervisor in CC", "goswami@maths.iitkgp.ac.in" in headers, headers[:300])
check("office in CC", "office@maths.iitkgp.ac.in" in headers, headers[:300])
check("roll number is in it for the office", "21MA91R05" in one)
check("phone is in it for the office", "9876543210" in one)
flat = " ".join(one.split())
check("it says the Head has it", "Head of the Department" in flat, flat[:300])

# ---------------------------------------------------------------- the decision
print("\n--- the office forwards, the Head approves: same conversation ---")
bid = server.q1("SELECT id FROM bookings WHERE ref=?", (REF,))["id"]
s, d = call("POST", "/api/bookings/%d/decide" % bid, {"action": "approve"}, sid="sidhod", csrf="csidhod")
check("the Head cannot act before the office forwards", s == 400, (s, d.get("error")))
s, d = call("POST", "/api/bookings/%d/office" % bid, {"action": "forward"}, sid="sidoffice", csrf="csidoffice")
check("the office forwards it", s == 200 and d["status"] == "forwarded", (s, d))
check("only now is the Head e-mailed",
      any("for your approval" in m and REF in m for m in last_mails(4)), "no approval mail")
s, d = call("POST", "/api/bookings/%d/decide" % bid, {"action": "approve", "note": "Approved."},
            sid="sidhod", csrf="csidhod")
check("approved", s == 200 and d["status"] == "approved", (s, d))
check("but nothing is confirmed to the booker yet", d.get("confirmed") is False, d)
check("no confirmation has gone out", not [m for m in last_mails(4) if REF in m and "CONFIRMED" in m],
      "sent too early")
s, d = call("POST", "/api/bookings/%d/office" % bid, {"action": "confirm"},
            sid="sidoffice", csrf="csidoffice")
check("the office confirms it", s == 200 and d.get("confirmed"), (s, d))
mails = last_mails(4)
conf = [m for m in mails if REF in m and "CONFIRMED" in m]
check("confirmation e-mail sent", bool(conf))
c = conf[0] if conf else ""
check("same subject line, so it threads", ("Room booking " + REF) in c, c[:200])
check("In-Reply-To points at the first mail", "In-Reply-To:" in c, [l for l in c.split("\n") if "Reply-To" in l][:2])
check("supervisor and office still in CC", "goswami@maths.iitkgp.ac.in" in c and "office@maths.iitkgp.ac.in" in c)
stored = server.q1("SELECT thread_msgid FROM bookings WHERE id=?", (bid,))["thread_msgid"]
check("the thread id was stored", bool(stored) and stored in c, stored)

# ------------------------------------------------------------ student, classroom
print("\n--- a student books a classroom ---")
sform = {"name": "Arjun Sen", "email": "arjun.sen@kgpian.iitkgp.ac.in", "roll": "25MA60R02",
         "phone": "9123456780", "room_id": ROOM, "date": D, "start": "09:00", "end": "10:00",
         "title": "Group study session", "attendees": 8}
s, d = call("POST", "/api/bookings/open/start", sform)
check("a student with no supervisor on file must name one", s == 400 and "supervisor" in d.get("error", "").lower(),
      (s, d.get("error")))
s, d = call("POST", "/api/bookings/open/start", dict(sform, advisor_id="ratna-dutta"))
check("naming the advisor works", s == 200, (s, d.get("error")))
check("the advisor will be copied in", d.get("advisor_notified") is True, d)
s, d = call("POST", "/api/bookings/open/confirm", {"ticket": d["ticket"], "code": code_from_outbox()})
check("a classroom is the office's to confirm", d.get("status") == "pending", d.get("status"))
SREF = d["ref"]

print("\n--- what the public calendar shows ---")
srow = server.q1("SELECT id FROM bookings WHERE ref=?", (SREF,))["id"]
server.q("UPDATE bookings SET status='approved' WHERE id=?", (srow,))
s, d = call("GET", "/api/bookings/public", query="from=" + D)
student = [x for x in d["bookings"] if x["title"] == "Group study session"]
check("the student's booking is listed", bool(student), d["bookings"])
check("shown under the faculty advisor's name", student and student[0].get("by") == "Ratna Dutta", student)
blob = json.dumps(d)
check("no roll number anywhere in it", "25MA60R02" not in blob)
check("no phone number anywhere in it", "9123456780" not in blob)
check("not the student's own name", "Arjun Sen" not in blob)

print("\n--- a faculty member books ---")
fform = {"name": "Ratna Dutta", "email": "ratna@maths.iitkgp.ac.in", "phone": "3222283654",
         "room_id": HALL, "date": D, "start": "10:00", "end": "11:30", "title": "Invited seminar"}
s, d = call("POST", "/api/bookings/open/start", fform)
check("no supervisor needed for faculty", s == 200, (s, d.get("error")))
check("they are their own advisor", d.get("advisor") == "Ratna Dutta", d.get("advisor"))
s, d = call("POST", "/api/bookings/open/confirm", {"ticket": d["ticket"], "code": code_from_outbox()})
check("request made", s == 200, (s, d))
fm = [m for m in last_mails(3) if d["ref"] in m]
check("only one address on it, no CC of themselves", fm and fm[0].count("ratna@maths.iitkgp.ac.in") <= 2, fm[0][:300] if fm else "")

print("\n--- misuse ---")
s, d = call("POST", "/api/bookings/open/start", dict(form, room_id=HALL, email="outsider@gmail.com"))
check("an outside address is refused", s == 403, (s, d.get("error", "")[:50]))
s, d = call("POST", "/api/bookings/open/start", dict(form, room_id=HALL, phone=""))
check("the phone number is required", s == 400, (s, d.get("error")))
s, d = call("POST", "/api/bookings/open/start", dict(form, room_id=HALL, date="2020-01-01"))
check("a past date is refused", s == 400, (s, d.get("error")))
busy = 0
for i in range(8):
    st, _ = call("POST", "/api/bookings/open/start", dict(form, room_id=ROOM, start="11:00", end="12:00",
                                                          date=(server.now() + server.timedelta(days=20 + i)).strftime("%Y-%m-%d")))
    if st == 429: busy += 1
check("too many requests in an hour are stopped", busy > 0, busy)

print("\n--- the office screen ---")
s, d = call("GET", "/api/bookings/queue", sid="sidoffice", csrf="csidoffice")
check("the office sees website requests too", s == 200 and any(x.get("source") == "public" for x in d["queue"] + d["upcoming"]),
      [x.get("source") for x in d["queue"]])
check("with roll number and phone", any(x.get("roll") for x in d["queue"] + d["upcoming"]), d["queue"][:1])
check("it lists faculty with no address on file", len(d.get("no_address", [])) == 38, len(d.get("no_address", [])))
s, d2 = call("GET", "/api/bookings/public", query="from=" + D)
check("the public feed never carries the phone number", "9123456780" not in json.dumps(d2))

print("\n--- the office can still stop a hall request ---")
hb = server.q1("SELECT id,status FROM bookings WHERE status='forwarded' LIMIT 1")
if hb:
    s, d = call("POST", "/api/bookings/%d/office" % hb["id"], {"action": "return", "note": "Clash with convocation."},
                sid="sidoffice", csrf="csidoffice")
    check("office returns a request that is with the Head", s == 200 and d["status"] == "returned", (s, d))
    s, d = call("POST", "/api/bookings/%d/office" % hb["id"], {"action": "confirm"}, sid="sidoffice", csrf="csidoffice")
    check("but cannot confirm a hall itself", s == 400, (s, d.get("error", "")[:60]))

print("\n--- two people at a time on the office account ---")
uid = server.q1("SELECT id FROM users WHERE email='office@maths.iitkgp.ac.in'")["id"]
server.q("DELETE FROM sessions WHERE user_id=?", (uid,))
raws = [server.create_session(uid, "127.0.0.1")[0] for _ in range(3)]
alive = server.q1("SELECT COUNT(*) c FROM sessions WHERE user_id=?", (uid,))["c"]
check("only two sessions survive", alive == 2, alive)
check("the oldest was the one signed out",
      server.q1("SELECT COUNT(*) c FROM sessions WHERE hash=?", (server.sha256(raws[0]),))["c"] == 0)
check("the two newest still work",
      all(server.q1("SELECT COUNT(*) c FROM sessions WHERE hash=?", (server.sha256(r),))["c"] == 1 for r in raws[1:]))
hid = server.q1("SELECT id FROM users WHERE email='hod@maths.iitkgp.ac.in'")["id"]
server.q("DELETE FROM sessions WHERE user_id=?", (hid,))
for _ in range(4): server.create_session(hid, "127.0.0.1")
check("other accounts are not limited", server.q1("SELECT COUNT(*) c FROM sessions WHERE user_id=?", (hid,))["c"] == 4)

print("\n%d passed, %d failed" % (PASS, FAIL))
sys.exit(1 if FAIL else 0)
