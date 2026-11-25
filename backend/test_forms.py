"""The department forms: uploading, replacing, hiding, ordering and downloading."""
import base64, contextlib, io, json, os, shutil, sys, zipfile
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
import server, forms
# Uploads normally go into the website folder (site_root/uploads). A test must
# never write there, so point them at the throwaway folder for this run.
server.UPLOADS = os.path.join(BACKEND, DATA, "uploads")

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

def staff(e, role, sid):
    server.q("DELETE FROM users WHERE email=?", (e,))
    server.q("INSERT INTO users(email,name,person_id,role,pw_hash,active,created)"
             " VALUES(?,?,NULL,?,'x',1,?)",
             (e, e.split("@")[0], role, server.iso(server.now())))
    u = server.q1("SELECT id FROM users WHERE email=?", (e,))["id"]
    server.q("INSERT OR REPLACE INTO sessions(hash,user_id,csrf,expires,created,ip) VALUES(?,?,?,?,?,?)",
             (server.sha256(sid), u, "c" + sid, server.iso(server.now() + server.timedelta(hours=8)),
              server.iso(server.now()), "1"))
    return lambda m, p, b=None, q="": call(m, p, b, q, sid=sid, csrf="c" + sid)

def b64(blob):
    return "data:application/octet-stream;base64," + base64.b64encode(blob).decode()

def a_pdf(tag=b"x"):
    return b"%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\n% " + tag + b"\ntrailer<</Root 1 0 R>>\n%%EOF\n"

def a_docx():
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as z:
        z.writestr("[Content_Types].xml", "<Types/>")
        z.writestr("word/document.xml", "<document/>")
    return buf.getvalue()

def stored():
    d = os.path.join(server.UPLOADS, "forms")
    return sorted(os.listdir(d)) if os.path.isdir(d) else []

server.init_db()
office = staff("office@iitkgp.ac.in", "office", "sofc")
admin  = staff("admin@iitkgp.ac.in",  "admin",  "sadm")
hod    = staff("hod@iitkgp.ac.in",    "hod",    "shod")
member = staff("prof@iitkgp.ac.in",   "member", "sprf")

print("\n--- who may change the forms ---")
s, d = call("GET", "/api/forms")
check("anybody may read the list, signed in or not", s == 200 and d["forms"] == [], (s, d))
s, d = member("POST", "/api/forms", {"title": "Mine", "file": b64(a_pdf())})
check("a faculty member cannot add one", s == 403, s)
s, d = hod("POST", "/api/forms", {"title": "His", "file": b64(a_pdf())})
check("nor the Head", s == 403, s)
s, d = member("GET", "/api/forms/manage")
check("nor open the management list", s == 403, s)

print("\n--- the office adds a form ---")
s, d = office("POST", "/api/forms", {"title": "Casual Leave (CL)", "blurb": "One day at a time.",
                                     "group": "Leave", "original": "CL form.pdf", "file": b64(a_pdf())})
check("added", s == 200 and d["form"]["title"] == "Casual Leave (CL)", (s, d))
F1 = d["form"]["id"]
check("the link is made from the title", d["form"]["file"] == "uploads/forms/casual-leave-cl.pdf", d["form"]["file"])
check("it says what kind of file it is", d["form"]["kind"] == "PDF", d["form"]["kind"])
check("and how big", d["form"]["size"].endswith(("bytes", "KB", "MB")), d["form"]["size"])
check("the file really is on disk", "casual-leave-cl.pdf" in stored(), stored())

s, d = admin("POST", "/api/forms", {"title": "Sick Leave", "group": "Leave", "file": b64(a_docx())})
check("the admin may add one too", s == 200, (s, d))
F2 = d["form"]["id"]
check("a Word file is recognised", d["form"]["kind"] == "Word" and d["form"]["ext"] == "docx", d["form"])

s, d = office("POST", "/api/forms", {"title": "Casual Leave (CL)", "file": b64(a_pdf())})
check("two forms with the same title do not fight over the file name",
      s == 200 and d["form"]["slug"] == "casual-leave-cl-2", d.get("form", {}).get("slug"))
F3 = d["form"]["id"]

print("\n--- what may be uploaded ---")
s, d = office("POST", "/api/forms", {"title": "Nope", "file": b64(b"\x89PNG\r\n\x1a\nnot a form")})
check("an image is refused", s == 400 and "PDF" in d.get("error", ""), (s, d.get("error")))
bad = io.BytesIO()
with zipfile.ZipFile(bad, "w") as z:
    z.writestr("pictures/holiday.jpg", "x")
s, d = office("POST", "/api/forms", {"title": "Nope", "file": b64(bad.getvalue())})
check("a zip that is not a Word file is refused", s == 400, (s, d.get("error")))
s, d = office("POST", "/api/forms", {"title": "Nope", "file": b64(b"")})
check("an empty file is refused", s == 400, s)
s, d = office("POST", "/api/forms", {"title": "Nope", "file": b64(a_pdf() + b"\0" * (11 * 1024 * 1024))})
check("anything over 10 MB is refused", s == 413, s)
s, d = office("POST", "/api/forms", {"title": "", "file": b64(a_pdf())})
check("a form without a title is refused", s == 400, s)
check("and none of those left a file behind", len(stored()) == 3, stored())

print("\n--- the public list ---")
s, d = call("GET", "/api/forms")
check("all three are listed without signing in", s == 200 and len(d["forms"]) == 3, (s, len(d.get("forms", []))))
check("the groups come back too", d["groups"] == ["Leave"], d["groups"])
check("every entry carries what the page needs to draw it",
      all({"title", "file", "kind", "size", "group"} <= set(f) for f in d["forms"]), d["forms"][0])

print("\n--- editing ---")
s, d = office("PUT", "/api/forms/%d" % F2, {"title": "Sick / Medical Leave", "blurb": "With a certificate."})
check("the title and the note can be changed", s == 200 and d["form"]["title"] == "Sick / Medical Leave", (s, d))
check("but the link does not move", d["form"]["file"] == "uploads/forms/sick-leave.docx", d["form"]["file"])

old = open(os.path.join(server.UPLOADS, "forms", "casual-leave-cl.pdf"), "rb").read()
s, d = office("PUT", "/api/forms/%d" % F1, {"file": b64(a_pdf(b"version two"))})
new = open(os.path.join(server.UPLOADS, "forms", "casual-leave-cl.pdf"), "rb").read()
check("a form can be replaced with a newer version", s == 200 and new != old, s)
check("and the link still does not move", d["form"]["file"] == "uploads/forms/casual-leave-cl.pdf", d["form"]["file"])
check("no stray copy of the old one is left", len(stored()) == 3, stored())

s, d = office("PUT", "/api/forms/%d" % F2, {"file": b64(a_pdf())})
check("swapping a Word form for a PDF works", s == 200 and d["form"]["ext"] == "pdf", (s, d))
check("and the old .docx is cleared away",
      "sick-leave.pdf" in stored() and "sick-leave.docx" not in stored(), stored())

s, d = office("PUT", "/api/forms/%d" % F3, {"active": False})
check("a form can be taken off the website without deleting it", s == 200, s)
s, d = call("GET", "/api/forms")
check("so the public list is down to two", len(d["forms"]) == 2, len(d["forms"]))
s, d = office("GET", "/api/forms/manage")
check("but the office still sees all three", len(d["forms"]) == 3, len(d["forms"]))
check("and is told the size limit and what it may upload",
      d["max_mb"] == 10 and set(d["accept"]) == {"pdf", "docx", "doc"}, (d.get("max_mb"), d.get("accept")))

print("\n--- the order they appear in ---")
s, d = office("POST", "/api/forms/order", {"ids": [F2, F3, F1]})
check("the office can set the order", s == 200, s)
s, d = office("GET", "/api/forms/manage")
check("and it sticks", [f["id"] for f in d["forms"]] == [F2, F3, F1], [f["id"] for f in d["forms"]])

print("\n--- forms-data.js, for the website with nothing running behind it ---")
js = forms.forms_js()
check("it is a plain assignment the browser can read", js.strip().endswith(";") and "window.DEPT_FORMS" in js, js[:60])
check("only the forms that are switched on are in it", js.count('"title"') == 2, js.count('"title"'))
check("and it carries the link, the kind and the size",
      '"file"' in js and '"kind"' in js and '"size"' in js, "")
check("but not who uploaded it, or the name it arrived under",
      '"by"' not in js and '"original"' not in js, js[:120])

print("\n--- deleting ---")
s, d = member("DELETE", "/api/forms/%d" % F3)
check("a faculty member cannot delete a form", s == 403, s)
s, d = office("DELETE", "/api/forms/%d" % F3)
check("the office can", s == 200, s)
check("and the file goes with it", "casual-leave-cl-2.pdf" not in stored(), stored())
s, d = office("DELETE", "/api/forms/9999")
check("deleting one that is not there says so", s == 404, s)

print("\n--- it is all written down in the activity log ---")
rows = [r["action"] for r in server.q("SELECT action FROM audit WHERE action LIKE 'form.%'").fetchall()]
check("adding, updating, reordering and deleting are all recorded",
      {"form.added", "form.updated", "form.reordered", "form.deleted"} <= set(rows), sorted(set(rows)))

print("\n%d passed, %d failed" % (PASS, FAIL))
sys.exit(1 if FAIL else 0)
