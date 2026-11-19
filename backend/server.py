#!/usr/bin/env python3
"""
Department of Mathematics, IIT Kharagpur - website portal server
=================================================================

One file, Python standard library only (Python 3.9+). No packages to install.

What it does
  * serves the whole website (the HTML/CSS/JS files one folder up)
  * builds people-data.js and notices-data.js live from the database
  * login with institute e-mail + password + a one-time code e-mailed every time
  * invitation e-mails (set-password link, or a generated temporary password)
  * "Edit my profile" for faculty / postdocs / scholars / staff
  * admin: accounts, people, notices & events, mailing lists, group e-mail,
    activity log, export for the static (GitHub) copy of the site

Run (development / testing)
  python3 server.py init                 # first time: creates database + config.json
  python3 server.py create-admin you@example.com
  python3 server.py import students.json      # bulk-add scholars / alumni / mailing lists
  python3 server.py                      # http://localhost:8000

Run on a real server (e.g. CIC): use any WSGI server with the `app` object, e.g.
  gunicorn --workers 2 --bind 127.0.0.1:8000 server:app
behind Apache/Nginx with HTTPS. See README.md.
"""

import base64
import hashlib
import hmac
import json
import mimetypes
import os
import re
import secrets
import smtplib
import sqlite3
import sys
import threading
import time
import zipfile
import io
from datetime import datetime, timedelta, timezone
from email.message import EmailMessage
from email.utils import formataddr, make_msgid
from http import cookies
from socketserver import ThreadingMixIn
from urllib.parse import parse_qs, unquote
from wsgiref.simple_server import WSGIServer, make_server, WSGIRequestHandler

# Windows sometimes maps .js/.css to the wrong type, which makes browsers refuse them
for _ext, _type in ((".js", "application/javascript"), (".css", "text/css"), (".svg", "image/svg+xml"),
                    (".json", "application/json"), (".webp", "image/webp"), (".pdf", "application/pdf")):
    mimetypes.add_type(_type, _ext)

# ---------------------------------------------------------------------------
# Paths & configuration
# ---------------------------------------------------------------------------
BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))
CONFIG_PATH = os.environ.get("PORTAL_CONFIG", os.path.join(BACKEND_DIR, "config.json"))

DEFAULT_CONFIG = {
    "site_name": "Department of Mathematics, IIT Kharagpur",
    "base_url": "http://localhost:8000",
    "host": "127.0.0.1",
    "port": 8000,
    "site_root": "..",
    "data_dir": "data",
    "allowed_email_domains": ["iitkgp.ac.in"],
    "invite_mode": "link",
    "invite_hours": 48,
    "reset_minutes": 60,
    "otp_minutes": 10,
    "otp_max_attempts": 5,
    "session_hours": 8,
    "max_failed_logins": 5,
    "lockout_minutes": 15,
    "min_password_length": 10,
    "self_edit_types": ["faculty", "adjunct", "postdoc", "staff"],
    "secure_cookies": False,
    "mail": {
        "mode": "console",
        "from_name": "Department of Mathematics, IIT Kharagpur",
        "from_email": "no-reply@example.com",
        "reply_to": "",
        "smtp_host": "smtp.gmail.com",
        "smtp_port": 587,
        "smtp_security": "starttls",
        "smtp_user": "",
        "smtp_password": "",
        "bulk_delay_seconds": 0.5
    }
}


def load_config():
    cfg = json.loads(json.dumps(DEFAULT_CONFIG))
    if os.path.exists(CONFIG_PATH):
        with open(CONFIG_PATH, encoding="utf-8") as f:
            user = json.load(f)
        mail = user.pop("mail", {})
        cfg.update(user)
        cfg["mail"].update(mail)
    # environment variables override secrets, so the password need not sit in a file
    if os.environ.get("PORTAL_SMTP_PASSWORD"):
        cfg["mail"]["smtp_password"] = os.environ["PORTAL_SMTP_PASSWORD"]
    cfg["site_root"] = os.path.abspath(os.path.join(BACKEND_DIR, cfg["site_root"]))
    cfg["data_dir"] = os.path.abspath(os.path.join(BACKEND_DIR, cfg["data_dir"]))
    cfg["base_url"] = cfg["base_url"].rstrip("/")
    cfg["allowed_email_domains"] = [d.lower().strip().lstrip("@") for d in cfg["allowed_email_domains"]]
    return cfg


CFG = load_config()
DB_PATH = os.path.join(CFG["data_dir"], "portal.db")
OUTBOX = os.path.join(CFG["data_dir"], "outbox")
UPLOADS = os.path.join(CFG["site_root"], "uploads")

# ---------------------------------------------------------------------------
# Small helpers
# ---------------------------------------------------------------------------
def now():
    return datetime.now(timezone.utc)


def iso(dt):
    return dt.strftime("%Y-%m-%dT%H:%M:%SZ")


def parse_iso(s):
    return datetime.strptime(s, "%Y-%m-%dT%H:%M:%SZ").replace(tzinfo=timezone.utc)


def sha256(s):
    return hashlib.sha256(s.encode()).hexdigest()


EMAIL_RE = re.compile(r"^[A-Za-z0-9._%+'-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$")
ID_RE = re.compile(r"^[a-z0-9][a-z0-9-]{1,79}$")


def norm_email(e):
    return (e or "").strip().lower()


def email_allowed(e):
    if not EMAIL_RE.match(e or ""):
        return False
    domain = e.rsplit("@", 1)[1]
    return any(domain == d or domain.endswith("." + d) for d in CFG["allowed_email_domains"])


def slugify(name):
    s = re.sub(r"[^a-z0-9]+", "-", (name or "").lower()).strip("-")
    return s[:80] or "person"


# ---------------------------------------------------------------------------
# Passwords (scrypt, salted)
# ---------------------------------------------------------------------------
def hash_password(pw):
    salt = secrets.token_bytes(16)
    n, r, p = 2 ** 14, 8, 1
    h = hashlib.scrypt(pw.encode(), salt=salt, n=n, r=r, p=p, dklen=32)
    return "scrypt${}${}${}${}${}".format(n, r, p, base64.b64encode(salt).decode(), base64.b64encode(h).decode())


def check_password(pw, stored):
    try:
        _, n, r, p, salt, h = stored.split("$")
        calc = hashlib.scrypt(pw.encode(), salt=base64.b64decode(salt), n=int(n), r=int(r), p=int(p), dklen=32)
        return hmac.compare_digest(calc, base64.b64decode(h))
    except Exception:
        return False


def password_problem(pw):
    if len(pw or "") < CFG["min_password_length"]:
        return "Password must be at least {} characters.".format(CFG["min_password_length"])
    if not re.search(r"[A-Za-z]", pw) or not re.search(r"\d", pw):
        return "Password must contain both letters and numbers."
    return None


def generate_temp_password():
    alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789"
    while True:
        pw = "".join(secrets.choice(alphabet) for _ in range(12))
        if not password_problem(pw):
            return pw


# ---------------------------------------------------------------------------
# Database
# ---------------------------------------------------------------------------
SCHEMA = """
CREATE TABLE IF NOT EXISTS users(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL DEFAULT '',
  person_id TEXT,
  role TEXT NOT NULL DEFAULT 'member',
  pw_hash TEXT,
  must_change INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1,
  failed INTEGER NOT NULL DEFAULT 0,
  locked_until TEXT,
  created TEXT NOT NULL,
  last_login TEXT
);
CREATE TABLE IF NOT EXISTS tokens(
  hash TEXT PRIMARY KEY, user_id INTEGER NOT NULL, kind TEXT NOT NULL,
  expires TEXT NOT NULL, used INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS otps(
  ticket_hash TEXT PRIMARY KEY, user_id INTEGER NOT NULL, code_hash TEXT NOT NULL,
  expires TEXT NOT NULL, attempts INTEGER NOT NULL DEFAULT 0, sent_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS sessions(
  hash TEXT PRIMARY KEY, user_id INTEGER NOT NULL, csrf TEXT NOT NULL,
  expires TEXT NOT NULL, created TEXT NOT NULL, ip TEXT
);
CREATE TABLE IF NOT EXISTS people(
  id TEXT PRIMARY KEY, data TEXT NOT NULL, sort INTEGER NOT NULL DEFAULT 0,
  updated TEXT, updated_by TEXT
);
CREATE TABLE IF NOT EXISTS settings(key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS notices(
  id INTEGER PRIMARY KEY AUTOINCREMENT, data TEXT NOT NULL, created TEXT NOT NULL, updated TEXT
);
CREATE TABLE IF NOT EXISTS contacts(
  id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL DEFAULT '', email TEXT NOT NULL,
  grp TEXT NOT NULL, UNIQUE(email, grp)
);
CREATE TABLE IF NOT EXISTS mail_log(
  id INTEGER PRIMARY KEY AUTOINCREMENT, created TEXT NOT NULL, sender TEXT, subject TEXT,
  groups TEXT, total INTEGER, sent INTEGER DEFAULT 0, failed INTEGER DEFAULT 0,
  status TEXT, errors TEXT
);
CREATE TABLE IF NOT EXISTS audit(
  id INTEGER PRIMARY KEY AUTOINCREMENT, at TEXT NOT NULL, actor TEXT, action TEXT,
  target TEXT, detail TEXT, ip TEXT
);
"""

_local = threading.local()


def db():
    conn = getattr(_local, "conn", None)
    if conn is None:
        os.makedirs(CFG["data_dir"], exist_ok=True)
        conn = sqlite3.connect(DB_PATH, timeout=15, isolation_level=None)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA journal_mode=WAL")
        conn.execute("PRAGMA foreign_keys=ON")
        _local.conn = conn
    return conn


def q(sql, args=()):
    return db().execute(sql, args)


def q1(sql, args=()):
    return db().execute(sql, args).fetchone()


def audit(actor, action, target="", detail="", ip=""):
    q("INSERT INTO audit(at,actor,action,target,detail,ip) VALUES(?,?,?,?,?,?)",
      (iso(now()), actor, action, target, detail[:500], ip))


def get_setting(key, default=None):
    r = q1("SELECT value FROM settings WHERE key=?", (key,))
    return json.loads(r["value"]) if r else default


def set_setting(key, value):
    q("INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
      (key, json.dumps(value, ensure_ascii=False)))


# ---------------------------------------------------------------------------
# Importing the existing static data files (first run)
# ---------------------------------------------------------------------------
def _js_to_json(text):
    text = re.sub(r"/\*.*?\*/", "", text, flags=re.S)          # block comments
    text = re.sub(r"^\s*//.*$", "", text, flags=re.M)          # line comments
    text = re.sub(r",(\s*[\]}])", r"\1", text)                 # trailing commas
    return json.loads(text)


def parse_people_js(path):
    with open(path, encoding="utf-8") as f:
        src = f.read()
    areas = {}
    m = re.search(r"window\.DEPT_AREAS\s*=\s*(\{.*?\});", src, re.S)
    if m:
        areas = _js_to_json(m.group(1))
    m = re.search(r"window\.DEPT_PEOPLE\s*=\s*(\[.*\]);", src, re.S)
    people = _js_to_json(m.group(1)) if m else []
    return areas, people


DEFAULT_NOTICES = [
    {"kind": "notice", "title": "[Seminar title] — [Speaker], [Venue], [Time]", "tag": "Seminar", "date": "", "link": "news-events.html", "is_new": True},
    {"kind": "notice", "title": "[Admission notice title for programme]", "tag": "Admissions", "date": "", "link": "academics.html#admissions", "is_new": True},
    {"kind": "notice", "title": "[Course / examination schedule notice]", "tag": "Examination", "date": "", "link": "students.html"},
    {"kind": "notice", "title": "[Workshop / conference name and details]", "tag": "Workshop", "date": "", "link": "news-events.html"},
    {"kind": "notice", "title": "Colloquium: [Talk title] by [Speaker]", "tag": "Colloquium", "date": "", "link": "news-events.html"},
    {"kind": "notice", "title": "[General departmental notice]", "tag": "Notice", "date": "", "link": "news-events.html"},
]


def init_db(verbose=True):
    os.makedirs(CFG["data_dir"], exist_ok=True)
    os.makedirs(OUTBOX, exist_ok=True)
    db().executescript(SCHEMA)
    if q1("SELECT COUNT(*) c FROM people")["c"] == 0:
        src = os.path.join(CFG["site_root"], "people-data.js")
        if os.path.exists(src):
            areas, people = parse_people_js(src)
            set_setting("areas", areas)
            for i, p in enumerate(people):
                q("INSERT OR IGNORE INTO people(id,data,sort,updated,updated_by) VALUES(?,?,?,?,?)",
                  (p["id"], json.dumps(p, ensure_ascii=False), i, iso(now()), "import"))
            if verbose:
                print("Imported {} people and {} research areas from people-data.js".format(len(people), len(areas)))
    if q1("SELECT COUNT(*) c FROM notices")["c"] == 0:
        for n in DEFAULT_NOTICES:
            q("INSERT INTO notices(data,created,updated) VALUES(?,?,?)", (json.dumps(n), iso(now()), iso(now())))
    if not os.path.exists(CONFIG_PATH):
        with open(CONFIG_PATH, "w", encoding="utf-8") as f:
            json.dump(DEFAULT_CONFIG, f, indent=2)
        if verbose:
            print("Created", CONFIG_PATH, "- edit it to set allowed e-mail domains and mail settings.")


# ---------------------------------------------------------------------------
# E-mail
# ---------------------------------------------------------------------------
def build_message(to, subject, text, html=None, reply_to=None):
    m = CFG["mail"]
    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = formataddr((m["from_name"], m["from_email"]))
    msg["To"] = to
    msg["Message-ID"] = make_msgid(domain=m["from_email"].split("@")[-1])
    if reply_to or m.get("reply_to"):
        msg["Reply-To"] = reply_to or m["reply_to"]
    msg.set_content(text)
    if html:
        msg.add_alternative(html, subtype="html")
    return msg


def send_mail(to, subject, text, html=None, reply_to=None):
    """Send one e-mail. Raises on failure."""
    msg = build_message(to, subject, text, html, reply_to)
    m = CFG["mail"]
    if m["mode"] == "console":
        os.makedirs(OUTBOX, exist_ok=True)
        name = "{}_{}.eml".format(now().strftime("%Y%m%d-%H%M%S-%f"), re.sub(r"[^a-z0-9]+", "_", to.lower())[:40])
        with open(os.path.join(OUTBOX, name), "wb") as f:
            f.write(bytes(msg))
        print("\n----- E-MAIL (console mode, saved to data/outbox/{}) -----".format(name))
        print("To:", to)
        print("Subject:", subject)
        print(text)
        print("-----------------------------------------------------------\n", flush=True)
        return
    if m["smtp_security"] == "ssl":
        server = smtplib.SMTP_SSL(m["smtp_host"], int(m["smtp_port"]), timeout=30)
    else:
        server = smtplib.SMTP(m["smtp_host"], int(m["smtp_port"]), timeout=30)
        if m["smtp_security"] == "starttls":
            server.starttls()
    try:
        if m["smtp_user"]:
            server.login(m["smtp_user"], m["smtp_password"])
        server.send_message(msg)
    finally:
        try:
            server.quit()
        except Exception:
            pass


def html_wrap(title, body_html):
    return (
        '<div style="font-family:Arial,Helvetica,sans-serif;max-width:600px;margin:0 auto;border-top:4px solid #6f1d2a">'
        '<div style="padding:18px 22px;background:#fbf8f2"><strong style="color:#6f1d2a;font-size:16px">'
        + CFG["site_name"] + '</strong></div><div style="padding:22px;color:#25292d;font-size:15px;line-height:1.6">'
        '<h2 style="font-size:19px;margin:0 0 14px">' + title + '</h2>' + body_html +
        '</div><div style="padding:14px 22px;font-size:12px;color:#777;border-top:1px solid #eee">'
        'This is an automated message from the department website portal.</div></div>'
    )


def esc_html(s):
    return (str(s).replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace('"', "&quot;"))


# ---------------------------------------------------------------------------
# Tokens, OTPs, sessions
# ---------------------------------------------------------------------------
def make_token(user_id, kind, minutes):
    raw = secrets.token_urlsafe(32)
    q("UPDATE tokens SET used=1 WHERE user_id=? AND kind=? AND used=0", (user_id, kind))
    q("INSERT INTO tokens(hash,user_id,kind,expires) VALUES(?,?,?,?)",
      (sha256(raw), user_id, kind, iso(now() + timedelta(minutes=minutes))))
    return raw


def use_token(raw, kinds):
    r = q1("SELECT * FROM tokens WHERE hash=?", (sha256(raw or ""),))
    if not r or r["used"] or r["kind"] not in kinds or parse_iso(r["expires"]) < now():
        return None
    return r


def send_invite(user, actor="system"):
    name = user["name"] or user["email"]
    login_url = CFG["base_url"] + "/portal/login.html"
    if CFG["invite_mode"] == "password":
        temp = generate_temp_password()
        q("UPDATE users SET pw_hash=?, must_change=1, failed=0, locked_until=NULL WHERE id=?",
          (hash_password(temp), user["id"]))
        text = ("Dear {},\n\nAn account has been created for you on the {} website portal.\n\n"
                "Login page: {}\nE-mail: {}\nTemporary password: {}\n\n"
                "You will be asked for a one-time code sent to this e-mail each time you log in, "
                "and to choose a new password at your first login.\n").format(name, CFG["site_name"], login_url, user["email"], temp)
        html = html_wrap("Your portal account", "<p>Dear {},</p><p>An account has been created for you on the department website portal.</p>"
                         "<p><b>E-mail:</b> {}<br><b>Temporary password:</b> <code style='font-size:16px'>{}</code></p>"
                         "<p><a href='{}' style='background:#6f1d2a;color:#fff;padding:10px 18px;text-decoration:none'>Go to login page</a></p>"
                         "<p>You will choose a new password at your first login. Each login also needs a one-time code sent to this e-mail.</p>"
                         .format(esc_html(name), esc_html(user["email"]), esc_html(temp), login_url))
    else:
        raw = make_token(user["id"], "invite", CFG["invite_hours"] * 60)
        link = CFG["base_url"] + "/portal/set-password.html?token=" + raw
        text = ("Dear {},\n\nAn account has been created for you on the {} website portal.\n\n"
                "Set your password here (link valid for {} hours, single use):\n{}\n\n"
                "After that, log in at {}. Each login also needs a one-time code sent to this e-mail.\n"
                ).format(name, CFG["site_name"], CFG["invite_hours"], link, login_url)
        html = html_wrap("Set up your portal account", "<p>Dear {},</p><p>An account has been created for you on the department website portal.</p>"
                         "<p><a href='{}' style='background:#6f1d2a;color:#fff;padding:10px 18px;text-decoration:none'>Set my password</a></p>"
                         "<p style='font-size:13px;color:#555'>The link is valid for {} hours and can be used once. "
                         "Each login also needs a one-time code sent to this e-mail.</p>"
                         .format(esc_html(name), link, CFG["invite_hours"]))
    send_mail(user["email"], "Your account – " + CFG["site_name"], text, html)
    audit(actor, "invite.sent", user["email"], CFG["invite_mode"])


def start_otp(user):
    ticket = secrets.token_urlsafe(24)
    code = "{:06d}".format(secrets.randbelow(1000000))
    q("DELETE FROM otps WHERE user_id=?", (user["id"],))
    q("INSERT INTO otps(ticket_hash,user_id,code_hash,expires,sent_at) VALUES(?,?,?,?,?)",
      (sha256(ticket), user["id"], sha256(ticket + code), iso(now() + timedelta(minutes=CFG["otp_minutes"])), iso(now())))
    text = ("Your login code for the {} portal is:\n\n    {}\n\nIt expires in {} minutes. "
            "If you did not try to log in, ignore this e-mail and consider changing your password.\n"
            ).format(CFG["site_name"], code, CFG["otp_minutes"])
    html = html_wrap("Your login code", "<p>Use this code to finish logging in:</p>"
                     "<p style='font-size:30px;letter-spacing:8px;font-weight:bold;color:#6f1d2a'>{}</p>"
                     "<p style='font-size:13px;color:#555'>It expires in {} minutes. If you did not try to log in, "
                     "ignore this e-mail and consider changing your password.</p>".format(code, CFG["otp_minutes"]))
    send_mail(user["email"], "Login code: {} – {}".format(code, CFG["site_name"]), text, html)
    return ticket


def create_session(user_id, ip):
    raw = secrets.token_urlsafe(32)
    csrf = secrets.token_urlsafe(24)
    q("DELETE FROM sessions WHERE expires < ?", (iso(now()),))
    q("INSERT INTO sessions(hash,user_id,csrf,expires,created,ip) VALUES(?,?,?,?,?,?)",
      (sha256(raw), user_id, csrf, iso(now() + timedelta(hours=CFG["session_hours"])), iso(now()), ip))
    return raw, csrf


def session_cookie(value, max_age):
    c = cookies.SimpleCookie()
    c["mdsid"] = value
    c["mdsid"]["path"] = "/"
    c["mdsid"]["httponly"] = True
    c["mdsid"]["samesite"] = "Strict"
    c["mdsid"]["max-age"] = max_age
    if CFG["secure_cookies"]:
        c["mdsid"]["secure"] = True
    return ("Set-Cookie", c["mdsid"].OutputString())


# simple in-memory rate limit per IP for auth endpoints
_rate = {}
_rate_lock = threading.Lock()


def rate_ok(key, limit, window_s):
    t = time.time()
    with _rate_lock:
        hits = [x for x in _rate.get(key, []) if t - x < window_s]
        if len(hits) >= limit:
            _rate[key] = hits
            return False
        hits.append(t)
        _rate[key] = hits
        return True


# ---------------------------------------------------------------------------
# People / notices helpers
# ---------------------------------------------------------------------------
ADMIN_ONLY_FIELDS = {"id", "type", "designation", "grade", "head", "status", "profile", "supervisor", "year", "now"}
FILE_FIELDS = {"photo", "cv"}
MAX_PROFILE_BYTES = 600_000


def get_person(pid):
    r = q1("SELECT data FROM people WHERE id=?", (pid,))
    return json.loads(r["data"]) if r else None


def save_person(p, actor):
    data = json.dumps(p, ensure_ascii=False)
    if len(data.encode()) > MAX_PROFILE_BYTES:
        raise ApiError(413, "Profile is too large.")
    exists = q1("SELECT 1 FROM people WHERE id=?", (p["id"],))
    if exists:
        q("UPDATE people SET data=?, updated=?, updated_by=? WHERE id=?", (data, iso(now()), actor, p["id"]))
    else:
        nxt = q1("SELECT COALESCE(MAX(sort),0)+1 n FROM people")["n"]
        q("INSERT INTO people(id,data,sort,updated,updated_by) VALUES(?,?,?,?,?)", (p["id"], data, nxt, iso(now()), actor))


def clean_value(v, depth=0):
    """Keep only JSON-safe strings/numbers/bools/lists/dicts with sane sizes."""
    if depth > 4:
        return None
    if isinstance(v, str):
        return v[:20000]
    if isinstance(v, bool) or v is None:
        return v
    if isinstance(v, (int, float)):
        return v
    if isinstance(v, list):
        return [clean_value(x, depth + 1) for x in v[:500]]
    if isinstance(v, dict):
        return {str(k)[:60]: clean_value(x, depth + 1) for k, x in list(v.items())[:80]}
    return None


def all_people():
    return [json.loads(r["data"]) for r in q("SELECT data FROM people ORDER BY sort, id")]


def people_js():
    areas = get_setting("areas", {})
    people = all_people()
    return ("/* Generated by the department portal on {} - do not edit by hand on the server. */\n"
            "window.DEPT_AREAS = {};\nwindow.DEPT_PEOPLE = [\n{}\n];\n").format(
        iso(now()), json.dumps(areas, ensure_ascii=False, indent=2),
        ",\n".join("  " + json.dumps(p, ensure_ascii=False) for p in people))


def all_notices(include_expired=True):
    out = []
    today = now().strftime("%Y-%m-%d")
    for r in q("SELECT id,data,created FROM notices"):
        n = json.loads(r["data"])
        n["id"] = r["id"]
        if not include_expired and n.get("expires") and n["expires"] < today:
            continue
        out.append(n)
    out.sort(key=lambda n: n["id"])
    out.sort(key=lambda n: (1 if n.get("pinned") else 0, n.get("date") or ""), reverse=True)
    return out


def notices_js():
    pub = [{k: v for k, v in n.items()} for n in all_notices(include_expired=False) if not n.get("draft")]
    return ("/* Generated by the department portal on {} */\nwindow.DEPT_NOTICES = {};\n"
            .format(iso(now()), json.dumps(pub, ensure_ascii=False, indent=2)))


# ---------------------------------------------------------------------------
# Mail groups
# ---------------------------------------------------------------------------
PEOPLE_GROUPS = {
    "faculty": "Faculty", "adjunct": "Adjunct / INSPIRE faculty", "postdoc": "Postdoctoral fellows",
    "scholar": "Research scholars", "staff": "Staff",
}


def group_members(group):
    """Return list of (name, email) for a group key."""
    out = []
    if group in PEOPLE_GROUPS:
        user_emails = {r["person_id"]: r["email"] for r in q("SELECT person_id,email FROM users WHERE person_id IS NOT NULL AND active=1")}
        for p in all_people():
            if p.get("type") == group and p.get("status") == "current":
                e = norm_email(p.get("email")) or user_emails.get(p["id"], "")
                if e:
                    out.append((p.get("name", ""), e))
    elif group == "accounts":
        out = [(r["name"], r["email"]) for r in q("SELECT name,email FROM users WHERE active=1")]
    elif group.startswith("list:"):
        out = [(r["name"], r["email"]) for r in q("SELECT name,email FROM contacts WHERE grp=?", (group[5:],))]
    return out


def all_groups():
    groups = [{"key": k, "label": v, "count": len(group_members(k))} for k, v in PEOPLE_GROUPS.items()]
    groups.append({"key": "accounts", "label": "Everyone with a portal account", "count": len(group_members("accounts"))})
    for r in q("SELECT grp, COUNT(*) c FROM contacts GROUP BY grp ORDER BY grp"):
        groups.append({"key": "list:" + r["grp"], "label": "Mailing list: " + r["grp"], "count": r["c"]})
    return groups


def bulk_send(log_id, recipients, subject, body, sender_email):
    """Runs in a background thread: one e-mail per recipient (no exposed address lists)."""
    sent = failed = 0
    errors = []
    delay = float(CFG["mail"].get("bulk_delay_seconds", 0.5))
    paras_html = "".join("<p>{}</p>".format(esc_html(p).replace("\n", "<br>")) for p in re.split(r"\n\s*\n", body))
    for name, email in recipients:
        try:
            greeting = "Dear {},\n\n".format(name) if name else ""
            greeting_html = "<p>Dear {},</p>".format(esc_html(name)) if name else ""
            send_mail(email, subject, greeting + body, html_wrap(esc_html(subject), greeting_html + paras_html),
                      reply_to=sender_email)
            sent += 1
        except Exception as e:
            failed += 1
            errors.append("{}: {}".format(email, e)[:200])
        q("UPDATE mail_log SET sent=?, failed=?, status=? WHERE id=?", (sent, failed, "sending", log_id))
        if CFG["mail"]["mode"] != "console":
            time.sleep(delay)
    q("UPDATE mail_log SET sent=?, failed=?, status=?, errors=? WHERE id=?",
      (sent, failed, "done" if not failed else "done with errors", json.dumps(errors[:50]), log_id))


# ---------------------------------------------------------------------------
# HTTP plumbing
# ---------------------------------------------------------------------------
class ApiError(Exception):
    def __init__(self, status, message):
        super().__init__(message)
        self.status = status
        self.message = message


STATUS_TEXT = {200: "200 OK", 201: "201 Created", 204: "204 No Content", 400: "400 Bad Request",
               401: "401 Unauthorized", 403: "403 Forbidden", 404: "404 Not Found", 405: "405 Method Not Allowed",
               409: "409 Conflict", 413: "413 Payload Too Large", 429: "429 Too Many Requests",
               500: "500 Internal Server Error"}

SECURITY_HEADERS = [
    ("X-Content-Type-Options", "nosniff"),
    ("Referrer-Policy", "same-origin"),
    ("X-Frame-Options", "SAMEORIGIN"),
]


class Request:
    def __init__(self, environ):
        self.env = environ
        self.method = environ["REQUEST_METHOD"].upper()
        self.path = unquote(environ.get("PATH_INFO", "/")) or "/"
        self.query = {k: v[0] for k, v in parse_qs(environ.get("QUERY_STRING", "")).items()}
        fwd = environ.get("HTTP_X_FORWARDED_FOR", "")
        self.ip = (fwd.split(",")[0].strip() if fwd else environ.get("REMOTE_ADDR", ""))
        self._json = None
        self.user = None
        self.session = None
        c = cookies.SimpleCookie(environ.get("HTTP_COOKIE", ""))
        self.sid = c["mdsid"].value if "mdsid" in c else None

    def json(self):
        if self._json is None:
            try:
                length = int(self.env.get("CONTENT_LENGTH") or 0)
            except ValueError:
                length = 0
            if length > 12 * 1024 * 1024:
                raise ApiError(413, "Request too large.")
            raw = self.env["wsgi.input"].read(length) if length else b""
            try:
                self._json = json.loads(raw.decode("utf-8")) if raw else {}
            except Exception:
                raise ApiError(400, "Invalid JSON.")
            if not isinstance(self._json, dict):
                raise ApiError(400, "Invalid request.")
        return self._json


def load_session(req):
    if not req.sid:
        return
    s = q1("SELECT * FROM sessions WHERE hash=?", (sha256(req.sid),))
    if not s or parse_iso(s["expires"]) < now():
        return
    u = q1("SELECT * FROM users WHERE id=?", (s["user_id"],))
    if not u or not u["active"]:
        return
    req.session, req.user = s, u


def require_user(req, csrf=True):
    load_session(req)
    if not req.user:
        raise ApiError(401, "Please log in.")
    if csrf and req.method in ("POST", "PUT", "DELETE"):
        token = req.env.get("HTTP_X_CSRF_TOKEN", "")
        if not hmac.compare_digest(token, req.session["csrf"]):
            raise ApiError(403, "Security check failed. Reload the page and try again.")
    return req.user


def require_admin(req):
    u = require_user(req)
    if u["role"] != "admin":
        raise ApiError(403, "Admin access only.")
    if u["must_change"]:
        raise ApiError(403, "Please change your temporary password first.")
    return u


def require_ready_user(req):
    u = require_user(req)
    if u["must_change"]:
        raise ApiError(403, "Please change your temporary password first.")
    return u


def can_self_edit(person):
    return bool(person) and person.get("type") in CFG.get("self_edit_types", [])


def check_linkable(pid):
    p = get_person(pid)
    if not p:
        raise ApiError(400, "Unknown profile.")
    if not can_self_edit(p):
        raise ApiError(400, "Portal accounts can't be linked to {} profiles – these are managed by the admin only.".format(
            {"scholar": "research scholar"}.get(p.get("type"), p.get("type", "this kind of"))))


def require_user_with_editable_profile(req):
    u = require_ready_user(req)
    if not u["person_id"]:
        raise ApiError(404, "Your account is not linked to a profile yet. Please contact the administrator.")
    if not can_self_edit(get_person(u["person_id"])):
        raise ApiError(403, "Profiles of this kind are updated by the department office. Please contact the administrator.")
    return u


def user_public(u):
    p = get_person(u["person_id"]) if u["person_id"] else None
    return {"id": u["id"], "email": u["email"], "name": u["name"] or (p or {}).get("name", ""),
            "role": u["role"], "person_id": u["person_id"], "must_change": bool(u["must_change"]),
            "active": bool(u["active"]), "last_login": u["last_login"], "created": u["created"],
            "has_password": bool(u["pw_hash"]),
            "can_edit_profile": can_self_edit(p),
            "locked": bool(u["locked_until"] and parse_iso(u["locked_until"]) > now())}


# ---------------------------------------------------------------------------
# API handlers
# ---------------------------------------------------------------------------
ROUTES = []


def route(method, pattern):
    rx = re.compile("^" + pattern + "$")

    def deco(fn):
        ROUTES.append((method, rx, fn))
        return fn
    return deco


GENERIC_LOGIN_ERROR = "Incorrect e-mail or password."


@route("GET", "/api/status")
def api_status(req):
    return {"ok": True, "site": CFG["site_name"], "mail_mode": CFG["mail"]["mode"],
            "invite_mode": CFG["invite_mode"], "domains": CFG["allowed_email_domains"]}


@route("POST", "/api/auth/login")
def api_login(req):
    if not rate_ok("login:" + req.ip, 20, 900):
        raise ApiError(429, "Too many attempts. Please wait 15 minutes.")
    d = req.json()
    email, pw = norm_email(d.get("email")), d.get("password") or ""
    u = q1("SELECT * FROM users WHERE email=?", (email,))
    if not u or not u["active"] or not u["pw_hash"]:
        check_password(pw, hash_password("dummy-timing"))  # keep timing similar
        raise ApiError(401, GENERIC_LOGIN_ERROR)
    if u["locked_until"] and parse_iso(u["locked_until"]) > now():
        raise ApiError(429, "This account is temporarily locked after repeated failed attempts. Try again later or use 'Forgot password'.")
    if not check_password(pw, u["pw_hash"]):
        failed = u["failed"] + 1
        locked = iso(now() + timedelta(minutes=CFG["lockout_minutes"])) if failed >= CFG["max_failed_logins"] else None
        q("UPDATE users SET failed=?, locked_until=? WHERE id=?", (0 if locked else failed, locked, u["id"]))
        audit(email, "login.failed", email, "locked" if locked else "", req.ip)
        raise ApiError(401, GENERIC_LOGIN_ERROR)
    q("UPDATE users SET failed=0, locked_until=NULL WHERE id=?", (u["id"],))
    try:
        ticket = start_otp(u)
    except Exception as e:
        audit(email, "otp.mail_failed", email, str(e), req.ip)
        raise ApiError(500, "Could not send the login code e-mail. Please contact the administrator.")
    audit(email, "login.password_ok", email, "", req.ip)
    return {"step": "otp", "ticket": ticket, "minutes": CFG["otp_minutes"],
            "sent_to": email[:2] + "•••@" + email.split("@")[1]}


@route("POST", "/api/auth/resend")
def api_resend(req):
    d = req.json()
    o = q1("SELECT * FROM otps WHERE ticket_hash=?", (sha256(d.get("ticket") or ""),))
    if not o:
        raise ApiError(400, "Your login attempt has expired. Please start again.")
    if (now() - parse_iso(o["sent_at"])).total_seconds() < 30:
        raise ApiError(429, "Please wait a few seconds before asking for a new code.")
    if not rate_ok("resend:" + str(o["user_id"]), 5, 900):
        raise ApiError(429, "Too many codes requested. Please wait 15 minutes.")
    u = q1("SELECT * FROM users WHERE id=?", (o["user_id"],))
    ticket = start_otp(u)
    return {"step": "otp", "ticket": ticket, "minutes": CFG["otp_minutes"]}


@route("POST", "/api/auth/verify")
def api_verify(req):
    d = req.json()
    ticket, code = d.get("ticket") or "", re.sub(r"\D", "", d.get("code") or "")
    o = q1("SELECT * FROM otps WHERE ticket_hash=?", (sha256(ticket),))
    if not o or parse_iso(o["expires"]) < now():
        raise ApiError(400, "The code has expired. Please log in again.")
    if o["attempts"] >= CFG["otp_max_attempts"]:
        q("DELETE FROM otps WHERE ticket_hash=?", (o["ticket_hash"],))
        raise ApiError(429, "Too many wrong codes. Please log in again.")
    if not hmac.compare_digest(sha256(ticket + code), o["code_hash"]):
        q("UPDATE otps SET attempts=attempts+1 WHERE ticket_hash=?", (o["ticket_hash"],))
        left = CFG["otp_max_attempts"] - o["attempts"] - 1
        raise ApiError(401, "Wrong code. {} attempt{} left.".format(left, "" if left == 1 else "s"))
    q("DELETE FROM otps WHERE ticket_hash=?", (o["ticket_hash"],))
    u = q1("SELECT * FROM users WHERE id=?", (o["user_id"],))
    if not u or not u["active"]:
        raise ApiError(401, "Account not available.")
    raw, csrf = create_session(u["id"], req.ip)
    q("UPDATE users SET last_login=? WHERE id=?", (iso(now()), u["id"]))
    audit(u["email"], "login.success", u["email"], "", req.ip)
    return ({"ok": True, "user": user_public(u), "csrf": csrf},
            [session_cookie(raw, CFG["session_hours"] * 3600)])


@route("POST", "/api/auth/logout")
def api_logout(req):
    load_session(req)
    if req.session:
        q("DELETE FROM sessions WHERE hash=?", (req.session["hash"],))
        audit(req.user["email"], "logout", "", "", req.ip)
    return ({"ok": True}, [session_cookie("", 0)])


@route("GET", "/api/auth/me")
def api_me(req):
    load_session(req)
    if not req.user:
        raise ApiError(401, "Not logged in.")
    return {"user": user_public(req.user), "csrf": req.session["csrf"],
            "expires": req.session["expires"]}


@route("POST", "/api/auth/forgot")
def api_forgot(req):
    if not rate_ok("forgot:" + req.ip, 5, 900):
        raise ApiError(429, "Too many requests. Please wait 15 minutes.")
    email = norm_email(req.json().get("email"))
    u = q1("SELECT * FROM users WHERE email=? AND active=1", (email,))
    if u:
        raw = make_token(u["id"], "reset", CFG["reset_minutes"])
        link = CFG["base_url"] + "/portal/set-password.html?token=" + raw + "&reset=1"
        text = ("A password reset was requested for your {} portal account.\n\nChoose a new password here "
                "(valid for {} minutes, single use):\n{}\n\nIf you did not ask for this, ignore this e-mail.\n"
                ).format(CFG["site_name"], CFG["reset_minutes"], link)
        html = html_wrap("Reset your password", "<p>A password reset was requested for your portal account.</p>"
                         "<p><a href='{}' style='background:#6f1d2a;color:#fff;padding:10px 18px;text-decoration:none'>Choose a new password</a></p>"
                         "<p style='font-size:13px;color:#555'>Valid for {} minutes, single use. If you did not ask for this, ignore this e-mail.</p>"
                         .format(link, CFG["reset_minutes"]))
        try:
            send_mail(email, "Password reset – " + CFG["site_name"], text, html)
        except Exception as e:
            audit(email, "reset.mail_failed", email, str(e), req.ip)
        audit(email, "reset.requested", email, "", req.ip)
    return {"ok": True, "message": "If that e-mail has an account, a reset link has been sent."}


@route("POST", "/api/auth/check-token")
def api_check_token(req):
    t = use_token(req.json().get("token"), ("invite", "reset"))
    if not t:
        raise ApiError(400, "This link is invalid or has expired. Ask the administrator for a new invitation, or use 'Forgot password'.")
    u = q1("SELECT email,name FROM users WHERE id=?", (t["user_id"],))
    return {"ok": True, "email": u["email"], "name": u["name"], "kind": t["kind"]}


@route("POST", "/api/auth/set-password")
def api_set_password(req):
    d = req.json()
    t = use_token(d.get("token"), ("invite", "reset"))
    if not t:
        raise ApiError(400, "This link is invalid or has expired.")
    prob = password_problem(d.get("password"))
    if prob:
        raise ApiError(400, prob)
    q("UPDATE users SET pw_hash=?, must_change=0, failed=0, locked_until=NULL WHERE id=?",
      (hash_password(d["password"]), t["user_id"]))
    q("UPDATE tokens SET used=1 WHERE hash=?", (t["hash"],))
    q("DELETE FROM sessions WHERE user_id=?", (t["user_id"],))
    u = q1("SELECT email FROM users WHERE id=?", (t["user_id"],))
    audit(u["email"], "password.set", u["email"], t["kind"], req.ip)
    return {"ok": True}


@route("POST", "/api/auth/change-password")
def api_change_password(req):
    u = require_user(req)
    d = req.json()
    if not check_password(d.get("current") or "", u["pw_hash"] or ""):
        raise ApiError(400, "Current password is incorrect.")
    prob = password_problem(d.get("new"))
    if prob:
        raise ApiError(400, prob)
    if d.get("new") == d.get("current"):
        raise ApiError(400, "Choose a password different from the current one.")
    q("UPDATE users SET pw_hash=?, must_change=0 WHERE id=?", (hash_password(d["new"]), u["id"]))
    q("DELETE FROM sessions WHERE user_id=? AND hash<>?", (u["id"], req.session["hash"]))
    audit(u["email"], "password.changed", u["email"], "", req.ip)
    return {"ok": True}


# ----- my profile -----
@route("GET", "/api/me/profile")
def api_my_profile(req):
    u = require_user_with_editable_profile(req)
    return {"profile": get_person(u["person_id"]), "areas": get_setting("areas", {}),
            "admin_only": sorted(ADMIN_ONLY_FIELDS), "people": [{"id": p["id"], "name": p["name"], "type": p.get("type")} for p in all_people()]}


@route("PUT", "/api/me/profile")
def api_save_my_profile(req):
    u = require_user_with_editable_profile(req)
    current = get_person(u["person_id"])
    incoming = clean_value(req.json().get("profile") or {})
    for k, v in incoming.items():
        if k in ADMIN_ONLY_FIELDS or k in FILE_FIELDS:
            continue
        current[k] = v
    current["updated"] = now().strftime("%d %b %Y")
    save_person(current, u["email"])
    audit(u["email"], "profile.updated", u["person_id"], "", req.ip)
    return {"ok": True, "profile": current}


def store_upload(person_id, kind, data_b64, actor, ip):
    try:
        blob = base64.b64decode(data_b64.split(",")[-1], validate=False)
    except Exception:
        raise ApiError(400, "Could not read the file.")
    if kind == "photo":
        if len(blob) > 2 * 1024 * 1024:
            raise ApiError(413, "Photo must be under 2 MB.")
        if blob[:3] == b"\xff\xd8\xff":
            ext = "jpg"
        elif blob[:8] == b"\x89PNG\r\n\x1a\n":
            ext = "png"
        elif blob[:4] == b"RIFF" and blob[8:12] == b"WEBP":
            ext = "webp"
        else:
            raise ApiError(400, "Photo must be a JPG, PNG or WebP image.")
        folder = "photos"
    elif kind == "cv":
        if len(blob) > 5 * 1024 * 1024:
            raise ApiError(413, "CV must be under 5 MB.")
        if blob[:5] != b"%PDF-":
            raise ApiError(400, "CV must be a PDF file.")
        ext, folder = "pdf", "cv"
    else:
        raise ApiError(400, "Unknown upload type.")
    d = os.path.join(UPLOADS, folder)
    os.makedirs(d, exist_ok=True)
    for old in os.listdir(d):
        if old.rsplit(".", 1)[0] == person_id:
            os.remove(os.path.join(d, old))
    fname = "{}.{}".format(person_id, ext)
    with open(os.path.join(d, fname), "wb") as f:
        f.write(blob)
    p = get_person(person_id)
    p[kind] = "uploads/{}/{}?v={}".format(folder, fname, int(time.time()))
    save_person(p, actor)
    audit(actor, kind + ".uploaded", person_id, "{} bytes".format(len(blob)), ip)
    return p[kind]


@route("POST", "/api/me/upload")
def api_my_upload(req):
    u = require_user_with_editable_profile(req)
    d = req.json()
    return {"ok": True, "path": store_upload(u["person_id"], d.get("kind"), d.get("data") or "", u["email"], req.ip)}


@route("POST", "/api/me/remove-file")
def api_my_remove_file(req):
    u = require_user_with_editable_profile(req)
    kind = req.json().get("kind")
    if kind not in FILE_FIELDS:
        raise ApiError(400, "Unknown file.")
    p = get_person(u["person_id"])
    p[kind] = ""
    save_person(p, u["email"])
    audit(u["email"], kind + ".removed", u["person_id"], "", req.ip)
    return {"ok": True}


# ----- admin: accounts -----
@route("GET", "/api/admin/users")
def api_users(req):
    require_admin(req)
    return {"users": [user_public(u) for u in q("SELECT * FROM users ORDER BY role DESC, email")],
            "people": [{"id": p["id"], "name": p["name"], "type": p.get("type"), "status": p.get("status"), "email": p.get("email", "")} for p in all_people()],
            "domains": CFG["allowed_email_domains"], "invite_mode": CFG["invite_mode"],
            "self_edit_types": CFG.get("self_edit_types", [])}


@route("POST", "/api/admin/users")
def api_create_user(req):
    admin = require_admin(req)
    d = req.json()
    email = norm_email(d.get("email"))
    if not email_allowed(email):
        raise ApiError(400, "Only official e-mail addresses are allowed ({}).".format(", ".join("@" + x for x in CFG["allowed_email_domains"])))
    if q1("SELECT 1 FROM users WHERE email=?", (email,)):
        raise ApiError(409, "An account with this e-mail already exists.")
    role = "admin" if d.get("role") == "admin" else "member"
    pid = d.get("person_id") or None
    if pid:
        check_linkable(pid)
    if pid and q1("SELECT 1 FROM users WHERE person_id=?", (pid,)):
        raise ApiError(409, "That profile is already linked to another account.")
    name = (d.get("name") or (get_person(pid) or {}).get("name") or "").strip()[:120]
    q("INSERT INTO users(email,name,person_id,role,created) VALUES(?,?,?,?,?)", (email, name, pid, role, iso(now())))
    u = q1("SELECT * FROM users WHERE email=?", (email,))
    audit(admin["email"], "user.created", email, "role={} person={}".format(role, pid), req.ip)
    sent = True
    if d.get("send_invite", True):
        try:
            send_invite(u, admin["email"])
        except Exception as e:
            sent = False
            audit(admin["email"], "invite.failed", email, str(e), req.ip)
    return {"ok": True, "user": user_public(q1("SELECT * FROM users WHERE email=?", (email,))), "invite_sent": sent}


@route("POST", r"/api/admin/users/(\d+)/invite")
def api_reinvite(req, uid):
    admin = require_admin(req)
    u = q1("SELECT * FROM users WHERE id=?", (int(uid),))
    if not u:
        raise ApiError(404, "No such account.")
    try:
        send_invite(u, admin["email"])
    except Exception as e:
        raise ApiError(500, "E-mail could not be sent: {}".format(e))
    return {"ok": True}


@route("PUT", r"/api/admin/users/(\d+)")
def api_update_user(req, uid):
    admin = require_admin(req)
    u = q1("SELECT * FROM users WHERE id=?", (int(uid),))
    if not u:
        raise ApiError(404, "No such account.")
    d = req.json()
    role = u["role"]
    if "role" in d:
        role = "admin" if d["role"] == "admin" else "member"
        if u["id"] == admin["id"] and role != "admin":
            raise ApiError(400, "You cannot remove your own admin rights.")
    active = u["active"]
    if "active" in d:
        active = 1 if d["active"] else 0
        if u["id"] == admin["id"] and not active:
            raise ApiError(400, "You cannot disable your own account.")
    pid = u["person_id"]
    if "person_id" in d:
        pid = d["person_id"] or None
        if pid:
            check_linkable(pid)
        if pid and q1("SELECT 1 FROM users WHERE person_id=? AND id<>?", (pid, u["id"])):
            raise ApiError(409, "That profile is already linked to another account.")
    name = (d.get("name", u["name"]) or "").strip()[:120]
    q("UPDATE users SET role=?, active=?, person_id=?, name=? WHERE id=?", (role, active, pid, name, u["id"]))
    if d.get("unlock"):
        q("UPDATE users SET failed=0, locked_until=NULL WHERE id=?", (u["id"],))
    if not active:
        q("DELETE FROM sessions WHERE user_id=?", (u["id"],))
    audit(admin["email"], "user.updated", u["email"], json.dumps({k: d[k] for k in d if k != "name"}), req.ip)
    return {"ok": True, "user": user_public(q1("SELECT * FROM users WHERE id=?", (u["id"],)))}


@route("DELETE", r"/api/admin/users/(\d+)")
def api_delete_user(req, uid):
    admin = require_admin(req)
    u = q1("SELECT * FROM users WHERE id=?", (int(uid),))
    if not u:
        raise ApiError(404, "No such account.")
    if u["id"] == admin["id"]:
        raise ApiError(400, "You cannot delete your own account.")
    for t in ("sessions", "tokens", "otps"):
        q("DELETE FROM {} WHERE user_id=?".format(t), (u["id"],))
    q("DELETE FROM users WHERE id=?", (u["id"],))
    audit(admin["email"], "user.deleted", u["email"], "", req.ip)
    return {"ok": True}


# ----- admin: people -----
@route("GET", "/api/admin/people")
def api_people(req):
    require_admin(req)
    rows = q("SELECT id,data,updated,updated_by FROM people ORDER BY sort, id").fetchall()
    linked = {r["person_id"]: r["email"] for r in q("SELECT person_id,email FROM users WHERE person_id IS NOT NULL")}
    out = []
    for r in rows:
        p = json.loads(r["data"])
        out.append({"id": p["id"], "name": p.get("name"), "type": p.get("type"), "designation": p.get("designation"),
                    "status": p.get("status"), "email": p.get("email", ""), "account": linked.get(p["id"], ""),
                    "updated": r["updated"], "updated_by": r["updated_by"]})
    return {"people": out, "areas": get_setting("areas", {})}


@route("GET", r"/api/admin/people/([a-z0-9-]+)")
def api_person(req, pid):
    require_admin(req)
    p = get_person(pid)
    if not p:
        raise ApiError(404, "No such person.")
    return {"profile": p, "areas": get_setting("areas", {}),
            "people": [{"id": x["id"], "name": x["name"], "type": x.get("type")} for x in all_people()]}


@route("POST", "/api/admin/people")
def api_create_person(req):
    admin = require_admin(req)
    p = clean_value(req.json().get("profile") or {})
    if not (p.get("name") or "").strip():
        raise ApiError(400, "Name is required.")
    pid = p.get("id") or slugify(p["name"])
    if not ID_RE.match(pid):
        raise ApiError(400, "ID must be lowercase letters, numbers and dashes.")
    if get_person(pid):
        raise ApiError(409, "A person with id '{}' already exists.".format(pid))
    p["id"] = pid
    p.setdefault("type", "faculty")
    p.setdefault("status", "current")
    save_person(p, admin["email"])
    audit(admin["email"], "person.created", pid, p.get("type", ""), req.ip)
    return {"ok": True, "profile": p}


@route("PUT", r"/api/admin/people/([a-z0-9-]+)")
def api_update_person(req, pid):
    admin = require_admin(req)
    cur = get_person(pid)
    if not cur:
        raise ApiError(404, "No such person.")
    p = clean_value(req.json().get("profile") or {})
    p["id"] = pid
    for k in FILE_FIELDS:
        if k not in p:
            p[k] = cur.get(k, "")
    if p.get("head"):
        for other in all_people():
            if other["id"] != pid and other.get("head"):
                other["head"] = False
                save_person(other, admin["email"])
    p["updated"] = now().strftime("%d %b %Y")
    save_person(p, admin["email"])
    changes = [k for k in set(cur) | set(p) if cur.get(k) != p.get(k) and k != "updated"]
    audit(admin["email"], "person.updated", pid, ", ".join(sorted(changes))[:400], req.ip)
    return {"ok": True, "profile": p}


# ----- bulk import (JSON) -----
PERSON_TYPES = {"faculty", "adjunct", "postdoc", "scholar", "staff"}
PERSON_STATUSES = {"current", "former", "alumni", "sample"}


def import_records(records, actor, ip=""):
    """Import a list of records.
    * a record with "list" (or "mailing_list") and "email" -> added to that mailing list
    * any other record -> a person/profile; created, or merged into the existing one with the same id
    Returns a report dict."""
    if isinstance(records, dict):
        records = records.get("people") or records.get("records") or records.get("students") or []
    if not isinstance(records, list):
        raise ApiError(400, "The file must contain a list of records [ {...}, {...} ].")
    rep = {"created": [], "updated": [], "contacts": 0, "errors": []}
    known = {p["id"] for p in all_people()}
    for i, raw in enumerate(records[:5000], 1):
        if not isinstance(raw, dict):
            rep["errors"].append("Record {}: not an object".format(i))
            continue
        r = clean_value(raw)
        label = "Record {} ({})".format(i, r.get("name") or r.get("email") or "no name")
        lst = r.pop("list", None) or r.pop("mailing_list", None)
        if lst:
            email = norm_email(r.get("email"))
            grp = re.sub(r"[^a-z0-9-]+", "-", str(lst).lower()).strip("-")[:40]
            if not EMAIL_RE.match(email) or not grp:
                rep["errors"].append(label + ": needs a valid e-mail and list name")
                continue
            q("INSERT OR IGNORE INTO contacts(name,email,grp) VALUES(?,?,?)", (str(r.get("name", ""))[:120], email, grp))
            rep["contacts"] += 1
            continue
        if not str(r.get("name", "")).strip():
            rep["errors"].append(label + ": 'name' is required")
            continue
        pid = r.get("id") or slugify(r["name"])
        if not ID_RE.match(str(pid)):
            rep["errors"].append(label + ": id must be lowercase letters, numbers and dashes")
            continue
        r["id"] = pid
        if r.get("type") and r["type"] not in PERSON_TYPES:
            rep["errors"].append(label + ": type must be one of " + ", ".join(sorted(PERSON_TYPES)))
            continue
        if r.get("status") and r["status"] not in PERSON_STATUSES:
            rep["errors"].append(label + ": status must be current, former or alumni")
            continue
        if r.get("supervisor") and r["supervisor"] not in known:
            rep["errors"].append(label + ": supervisor '{}' is not a known profile id (imported anyway, link left empty)".format(r["supervisor"]))
            r["supervisor"] = ""
        cur = get_person(pid)
        if cur:
            cur.update({k: v for k, v in r.items() if v not in (None, "", [], {})})
            save_person(cur, actor)
            rep["updated"].append(pid)
        else:
            r.setdefault("type", "scholar")
            r.setdefault("status", "current")
            save_person(r, actor)
            known.add(pid)
            rep["created"].append(pid)
    audit(actor, "import", "", "{} created, {} updated, {} contacts, {} errors".format(
        len(rep["created"]), len(rep["updated"]), rep["contacts"], len(rep["errors"])), ip)
    return rep


@route("POST", "/api/admin/import")
def api_import(req):
    admin = require_admin(req)
    d = req.json()
    data = d.get("data")
    if isinstance(data, str):
        try:
            data = json.loads(data)
        except Exception as e:
            raise ApiError(400, "This is not valid JSON: {}".format(e))
    return {"ok": True, "report": import_records(data, admin["email"], req.ip)}


@route("DELETE", r"/api/admin/people/([a-z0-9-]+)")
def api_delete_person(req, pid):
    admin = require_admin(req)
    if not get_person(pid):
        raise ApiError(404, "No such person.")
    q("UPDATE users SET person_id=NULL WHERE person_id=?", (pid,))
    q("DELETE FROM people WHERE id=?", (pid,))
    audit(admin["email"], "person.deleted", pid, "", req.ip)
    return {"ok": True}


@route("POST", r"/api/admin/people/([a-z0-9-]+)/upload")
def api_admin_upload(req, pid):
    admin = require_admin(req)
    if not get_person(pid):
        raise ApiError(404, "No such person.")
    d = req.json()
    return {"ok": True, "path": store_upload(pid, d.get("kind"), d.get("data") or "", admin["email"], req.ip)}


# ----- admin: notices -----
NOTICE_FIELDS = {"kind", "title", "tag", "date", "end_date", "link", "body", "is_new", "pinned", "expires", "draft",
                 "speaker", "affiliation", "venue", "time"}


def clean_notice(d):
    n = {k: clean_value(v) for k, v in d.items() if k in NOTICE_FIELDS}
    n["kind"] = "event" if n.get("kind") == "event" else "notice"
    if not (n.get("title") or "").strip():
        raise ApiError(400, "Title is required.")
    for k in ("date", "end_date", "expires"):
        if n.get(k) and not re.match(r"^\d{4}-\d{2}-\d{2}$", n[k]):
            raise ApiError(400, "Dates must be YYYY-MM-DD.")
    return n


@route("GET", "/api/admin/notices")
def api_notices(req):
    require_admin(req)
    return {"notices": all_notices(include_expired=True)}


@route("POST", "/api/admin/notices")
def api_create_notice(req):
    admin = require_admin(req)
    n = clean_notice(req.json())
    cur = q("INSERT INTO notices(data,created,updated) VALUES(?,?,?)", (json.dumps(n, ensure_ascii=False), iso(now()), iso(now())))
    audit(admin["email"], "notice.created", str(cur.lastrowid), n["title"][:120], req.ip)
    return {"ok": True, "id": cur.lastrowid}


@route("PUT", r"/api/admin/notices/(\d+)")
def api_update_notice(req, nid):
    admin = require_admin(req)
    if not q1("SELECT 1 FROM notices WHERE id=?", (int(nid),)):
        raise ApiError(404, "No such notice.")
    n = clean_notice(req.json())
    q("UPDATE notices SET data=?, updated=? WHERE id=?", (json.dumps(n, ensure_ascii=False), iso(now()), int(nid)))
    audit(admin["email"], "notice.updated", nid, n["title"][:120], req.ip)
    return {"ok": True}


@route("DELETE", r"/api/admin/notices/(\d+)")
def api_delete_notice(req, nid):
    admin = require_admin(req)
    q("DELETE FROM notices WHERE id=?", (int(nid),))
    audit(admin["email"], "notice.deleted", nid, "", req.ip)
    return {"ok": True}


# ----- admin: mailing lists & e-mail -----
@route("GET", "/api/admin/contacts")
def api_contacts(req):
    require_admin(req)
    return {"contacts": [dict(r) for r in q("SELECT id,name,email,grp FROM contacts ORDER BY grp, name, email")],
            "groups": all_groups()}


@route("POST", "/api/admin/contacts")
def api_add_contacts(req):
    """Body: {group: 'msc-2025', csv: 'Name, email\\n...'} - one contact per line."""
    admin = require_admin(req)
    d = req.json()
    grp = re.sub(r"[^a-z0-9-]+", "-", (d.get("group") or "").lower()).strip("-")[:40]
    if not grp:
        raise ApiError(400, "Give the mailing list a name, e.g. msc-2025.")
    added, skipped = 0, []
    for line in (d.get("csv") or "").splitlines():
        parts = [x.strip().strip('"') for x in re.split(r"[,;\t]", line) if x.strip()]
        if not parts:
            continue
        email = next((norm_email(x) for x in parts if "@" in x), "")
        name = next((x for x in parts if "@" not in x), "")
        if not EMAIL_RE.match(email):
            skipped.append(line[:80])
            continue
        q("INSERT OR IGNORE INTO contacts(name,email,grp) VALUES(?,?,?)", (name[:120], email, grp))
        added += 1
    audit(admin["email"], "contacts.added", grp, "{} added, {} skipped".format(added, len(skipped)), req.ip)
    return {"ok": True, "added": added, "skipped": skipped}


@route("DELETE", r"/api/admin/contacts/(\d+)")
def api_delete_contact(req, cid):
    admin = require_admin(req)
    q("DELETE FROM contacts WHERE id=?", (int(cid),))
    audit(admin["email"], "contact.deleted", cid, "", req.ip)
    return {"ok": True}


@route("DELETE", r"/api/admin/lists/([a-z0-9-]+)")
def api_delete_list(req, grp):
    admin = require_admin(req)
    q("DELETE FROM contacts WHERE grp=?", (grp,))
    audit(admin["email"], "list.deleted", grp, "", req.ip)
    return {"ok": True}


@route("POST", "/api/admin/mail/preview")
def api_mail_preview(req):
    require_admin(req)
    d = req.json()
    seen, rec = set(), []
    for g in d.get("groups") or []:
        for name, e in group_members(g):
            if e not in seen:
                seen.add(e)
                rec.append({"name": name, "email": e})
    for e in d.get("emails") or []:
        e = norm_email(e)
        if EMAIL_RE.match(e) and e not in seen:
            seen.add(e)
            rec.append({"name": "", "email": e})
    return {"recipients": rec}


@route("POST", "/api/admin/mail")
def api_send_mail(req):
    admin = require_admin(req)
    d = req.json()
    subject = (d.get("subject") or "").strip()[:200]
    body = (d.get("body") or "").strip()[:50000]
    if not subject or not body:
        raise ApiError(400, "Subject and message are required.")
    rec = api_mail_preview(req)["recipients"]
    if not rec:
        raise ApiError(400, "No recipients selected.")
    if len(rec) > 2000:
        raise ApiError(400, "Too many recipients in one go (max 2000).")
    cur = q("INSERT INTO mail_log(created,sender,subject,groups,total,status) VALUES(?,?,?,?,?,?)",
            (iso(now()), admin["email"], subject, json.dumps((d.get("groups") or []) + (d.get("emails") or [])), len(rec), "queued"))
    log_id = cur.lastrowid
    reply_to = admin["email"]
    t = threading.Thread(target=bulk_send, args=(log_id, [(r["name"], r["email"]) for r in rec], subject, body, reply_to), daemon=True)
    t.start()
    audit(admin["email"], "mail.sent", subject[:120], "{} recipients".format(len(rec)), req.ip)
    return {"ok": True, "log_id": log_id, "total": len(rec)}


@route("GET", "/api/admin/mail-log")
def api_mail_log(req):
    require_admin(req)
    return {"log": [dict(r) for r in q("SELECT * FROM mail_log ORDER BY id DESC LIMIT 100")],
            "mail_mode": CFG["mail"]["mode"]}


@route("GET", "/api/admin/audit")
def api_audit(req):
    require_admin(req)
    return {"audit": [dict(r) for r in q("SELECT * FROM audit ORDER BY id DESC LIMIT 300")]}


@route("GET", "/api/admin/summary")
def api_summary(req):
    require_admin(req)
    c = lambda sql: q1(sql)["c"]
    return {
        "people": c("SELECT COUNT(*) c FROM people"),
        "accounts": c("SELECT COUNT(*) c FROM users"),
        "accounts_pending": c("SELECT COUNT(*) c FROM users WHERE pw_hash IS NULL"),
        "notices": c("SELECT COUNT(*) c FROM notices"),
        "contacts": c("SELECT COUNT(*) c FROM contacts"),
        "mail_mode": CFG["mail"]["mode"], "invite_mode": CFG["invite_mode"],
        "domains": CFG["allowed_email_domains"], "base_url": CFG["base_url"],
    }


@route("GET", "/api/admin/export.zip")
def api_export(req):
    admin = require_admin(req)
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as z:
        z.writestr("people-data.js", people_js())
        z.writestr("notices-data.js", notices_js())
        if os.path.isdir(UPLOADS):
            for root, _, files in os.walk(UPLOADS):
                for f in files:
                    full = os.path.join(root, f)
                    z.write(full, os.path.relpath(full, CFG["site_root"]))
        z.writestr("README.txt", "Upload these files to the top level of the GitHub repository "
                                 "(keep the uploads folder as it is). Exported {}.\n".format(iso(now())))
    audit(admin["email"], "export", "", "", req.ip)
    return ("RAW", "application/zip", buf.getvalue(),
            [("Content-Disposition", 'attachment; filename="website-data-{}.zip"'.format(now().strftime("%Y%m%d-%H%M")))])


# ---------------------------------------------------------------------------
# Static files & WSGI app
# ---------------------------------------------------------------------------
BLOCKED = re.compile(r"(^|/)(backend|data|\.git|\.github)(/|$)|(^|/)\.")


def serve_static(req):
    path = req.path
    if BLOCKED.search(path.lstrip("/")):
        return None
    full = os.path.abspath(os.path.join(CFG["site_root"], path.lstrip("/")))
    if not full.startswith(CFG["site_root"] + os.sep) and full != CFG["site_root"]:
        return None
    if os.path.isdir(full):
        full = os.path.join(full, "index.html")
    if not os.path.isfile(full):
        return None
    ctype = mimetypes.guess_type(full)[0] or "application/octet-stream"
    if ctype.startswith("text/") or ctype in ("application/javascript", "application/json"):
        ctype += "; charset=utf-8"
    with open(full, "rb") as f:
        body = f.read()
    cache = "no-cache" if full.endswith((".html", ".js", ".css")) else "public, max-age=3600"
    return ctype, body, [("Cache-Control", cache)]


def app(environ, start_response):
    req = Request(environ)
    extra = []
    try:
        # live data files (replace the static copies when the server runs)
        if req.method == "GET" and req.path == "/people-data.js":
            return respond(start_response, 200, "application/javascript; charset=utf-8",
                           people_js().encode(), [("Cache-Control", "no-cache")])
        if req.method == "GET" and req.path == "/notices-data.js":
            return respond(start_response, 200, "application/javascript; charset=utf-8",
                           notices_js().encode(), [("Cache-Control", "no-cache")])

        if req.path.startswith("/api/"):
            for method, rx, fn in ROUTES:
                m = rx.match(req.path)
                if m and method == req.method:
                    result = fn(req, *m.groups())
                    if isinstance(result, tuple) and result and result[0] == "RAW":
                        _, ctype, body, hdrs = result
                        return respond(start_response, 200, ctype, body, hdrs)
                    if isinstance(result, tuple):
                        result, extra = result
                    return respond(start_response, 200, "application/json; charset=utf-8",
                                   json.dumps(result, ensure_ascii=False).encode(), extra + [("Cache-Control", "no-store")])
            if any(rx.match(req.path) for _, rx, _ in ROUTES):
                raise ApiError(405, "Method not allowed.")
            raise ApiError(404, "Not found.")

        if req.method not in ("GET", "HEAD"):
            raise ApiError(405, "Method not allowed.")
        st = serve_static(req)
        if st:
            ctype, body, hdrs = st
            return respond(start_response, 200, ctype, b"" if req.method == "HEAD" else body, hdrs)
        nf = os.path.join(CFG["site_root"], "404.html")
        body = open(nf, "rb").read() if os.path.exists(nf) else b"Not found"
        return respond(start_response, 404, "text/html; charset=utf-8", body, [])
    except ApiError as e:
        return respond(start_response, e.status, "application/json; charset=utf-8",
                       json.dumps({"error": e.message}).encode(), [("Cache-Control", "no-store")])
    except Exception as e:  # pragma: no cover
        import traceback
        traceback.print_exc()
        return respond(start_response, 500, "application/json; charset=utf-8",
                       json.dumps({"error": "Server error. Please try again."}).encode(), [])


def respond(start_response, status, ctype, body, headers):
    hdrs = [("Content-Type", ctype), ("Content-Length", str(len(body)))] + SECURITY_HEADERS + headers
    start_response(STATUS_TEXT.get(status, str(status)), hdrs)
    return [body]


class ThreadingWSGIServer(ThreadingMixIn, WSGIServer):
    daemon_threads = True


class QuietHandler(WSGIRequestHandler):
    def log_message(self, fmt, *args):
        if "/api/" in (args[0] if args else ""):
            sys.stderr.write("%s  %s\n" % (self.address_string(), fmt % args))


# ---------------------------------------------------------------------------
# Command line
# ---------------------------------------------------------------------------
def cli():
    for stream in (sys.stdout, sys.stderr):
        try:
            stream.reconfigure(errors="replace")   # Windows consoles can't print every character
        except Exception:
            pass
    args = sys.argv[1:]
    cmd = args[0] if args else "serve"
    init_db(verbose=(cmd != "serve"))
    if cmd == "init":
        print("Database ready:", DB_PATH)
        return
    if cmd == "create-admin":
        if len(args) < 2:
            print("Usage: python3 server.py create-admin email@domain [person-id]")
            return
        email = norm_email(args[1])
        if not EMAIL_RE.match(email):
            print("Not a valid e-mail address.")
            return
        pid = args[2] if len(args) > 2 else None
        if pid and not get_person(pid):
            print("No profile with id", pid)
            return
        if q1("SELECT 1 FROM users WHERE email=?", (email,)):
            q("UPDATE users SET role='admin', active=1 WHERE email=?", (email,))
            print("Existing account promoted to admin.")
            u = q1("SELECT * FROM users WHERE email=?", (email,))
        else:
            q("INSERT INTO users(email,name,person_id,role,created) VALUES(?,?,?,?,?)",
              (email, (get_person(pid) or {}).get("name", "Administrator") if pid else "Administrator", pid, "admin", iso(now())))
            u = q1("SELECT * FROM users WHERE email=?", (email,))
            print("Admin account created for", email)
        audit("cli", "admin.created", email)
        send_invite(u, "cli")
        print("Invitation e-mail sent (mail mode: {}).".format(CFG["mail"]["mode"]))
        return
    if cmd == "test-mail":
        to = args[1] if len(args) > 1 else ""
        send_mail(to, "Test e-mail – " + CFG["site_name"], "If you can read this, e-mail sending works.",
                  html_wrap("Test e-mail", "<p>If you can read this, e-mail sending works.</p>"))
        print("Sent (mode: {}).".format(CFG["mail"]["mode"]))
        return
    if cmd == "import":
        if len(args) < 2:
            print("Usage: python server.py import file.json")
            return
        with open(args[1], encoding="utf-8-sig") as f:
            data = json.load(f)
        rep = import_records(data, "cli")
        print("Created {}, updated {}, mailing-list contacts {}.".format(len(rep["created"]), len(rep["updated"]), rep["contacts"]))
        for e in rep["errors"]:
            print("  !", e)
        return
    if cmd == "export":
        out = args[1] if len(args) > 1 else CFG["site_root"]
        with open(os.path.join(out, "people-data.js"), "w", encoding="utf-8") as f:
            f.write(people_js())
        with open(os.path.join(out, "notices-data.js"), "w", encoding="utf-8") as f:
            f.write(notices_js())
        print("Wrote people-data.js and notices-data.js to", out)
        return
    if cmd != "serve":
        print(__doc__)
        return
    host, port = CFG["host"], int(CFG["port"])
    print("Serving {} on http://{}:{}  (mail mode: {}, invite mode: {})".format(
        CFG["site_name"], host, port, CFG["mail"]["mode"], CFG["invite_mode"]))
    print("Portal login: {}/portal/login.html   Press Ctrl+C to stop.".format(CFG["base_url"]))
    with make_server(host, port, app, server_class=ThreadingWSGIServer, handler_class=QuietHandler) as httpd:
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nStopped.")


# make sure tables exist when imported by a WSGI server (gunicorn / mod_wsgi)
if __name__ != "__main__":
    init_db(verbose=False)

if __name__ == "__main__":
    cli()
