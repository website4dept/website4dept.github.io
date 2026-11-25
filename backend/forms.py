# -*- coding: utf-8 -*-
"""
Department forms - the blank forms people download and fill in
===============================================================================
CL leave, sick leave, holiday, reimbursement: the forms the department hands out.
The office uploads them here; anybody may download them from the website without
signing in.

HOW IT FITS TOGETHER

    the office uploads a .pdf / .doc / .docx     portal -> Forms
              |
              v
    uploads/forms/<slug>.<ext>                   a real file on disk
              |
              +--> served by nginx straight from disk, so downloads keep
              |    working even when the Python portal is stopped
              |
              v
    forms-data.js                                the list: titles, groups, sizes
              |
              v
    forms.html                                   the public page, no login

WHY A FILE AND A LIST, RATHER THAN THE DATABASE
The website has to work with nothing running behind it - that is how it is
previewed on GitHub Pages, and it is why a Python fault cannot take the
downloads with it. So the forms are ordinary files in a folder and the list of
them is an ordinary .js file, exactly like people-data.js and notices-data.js.

TO ADD A FORM: portal -> Forms -> Add a form. Nothing here needs editing.
TO CHANGE WHICH FILE TYPES ARE ALLOWED: see KINDS below.
===============================================================================
"""
import io
import os
import re
import sys
import zipfile

S = None                       # the server module; set by install()
NAME = "forms"

MAX_BYTES = 10 * 1024 * 1024   # 10 MB: a blank form is a few hundred KB at most
FOLDER = "forms"               # inside uploads/

SCHEMA = """
CREATE TABLE IF NOT EXISTS forms(
  id INTEGER PRIMARY KEY,
  title TEXT NOT NULL,                      -- what people see, e.g. "Casual Leave (CL)"
  blurb TEXT NOT NULL DEFAULT '',           -- one line of explanation, optional
  grp TEXT NOT NULL DEFAULT '',             -- "Leave", "Travel", ... blank = Other forms
  slug TEXT NOT NULL UNIQUE,                -- the stored filename stem; the link never changes
  ext TEXT NOT NULL,                        -- pdf | docx | doc
  original TEXT NOT NULL DEFAULT '',        -- the name it was uploaded under, for the office
  bytes INTEGER NOT NULL DEFAULT 0,
  sort INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1,        -- 0 = kept, but off the website
  added TEXT, updated TEXT, by TEXT
);
CREATE INDEX IF NOT EXISTS idx_forms_sort ON forms(sort, title);
"""

# What may be uploaded.  Each entry is (extension, what to look for at the start
# of the file).  Checking the first few bytes matters: an extension is only a
# name, and anybody can rename anything.
KINDS = [
    ("pdf",  b"%PDF-"),
    ("docx", b"PK\x03\x04"),                                  # a zip; checked further below
    ("doc",  b"\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1"),            # the old Word format
]
NICE = {"pdf": "PDF", "docx": "Word", "doc": "Word"}


def init_db():
    """Called by server.init_db(). Safe to run again and again."""
    S.db().executescript(SCHEMA)


# ---------------------------------------------------------------------------
# Small helpers
# ---------------------------------------------------------------------------
def folder():
    d = os.path.join(S.UPLOADS, FOLDER)
    os.makedirs(d, exist_ok=True)
    return d


def text(v, limit, what):
    v = str(v or "").strip()
    if len(v) > limit:
        raise S.ApiError(400, "{} is too long (limit {} characters).".format(what, limit))
    return v


def slugify(title, taken=None):
    """A short, safe filename stem made from the title: 'Casual Leave (CL)' -> casual-leave-cl."""
    base = re.sub(r"[^a-z0-9]+", "-", str(title or "").lower()).strip("-")[:48] or "form"
    slug, n = base, 2
    while (taken and slug in taken) or S.q1("SELECT id FROM forms WHERE slug=?", (slug,)):
        slug = "{}-{}".format(base, n)
        n += 1
    return slug


def sniff(blob):
    """Work out what this really is, or refuse it. Returns the extension."""
    for ext, magic in KINDS:
        if blob[:len(magic)] != magic:
            continue
        if ext == "docx":
            # A .docx is a zip. So is a .jpg renamed to .docx, almost. Look inside
            # for the one file every Word document has.
            try:
                with zipfile.ZipFile(io.BytesIO(blob)) as z:
                    names = z.namelist()
            except Exception:
                raise S.ApiError(400, "That file looks damaged - it could not be opened.")
            if not any(n.startswith("word/") for n in names):
                raise S.ApiError(400, "That is not a Word document. Upload a PDF or a Word file.")
        return ext
    raise S.ApiError(400, "Forms must be a PDF or a Word file (.pdf, .doc or .docx).")


def decode(data_b64):
    import base64
    try:
        blob = base64.b64decode(str(data_b64 or "").split(",")[-1], validate=False)
    except Exception:
        raise S.ApiError(400, "Could not read that file.")
    if not blob:
        raise S.ApiError(400, "That file is empty.")
    if len(blob) > MAX_BYTES:
        raise S.ApiError(413, "A form must be under {} MB.".format(MAX_BYTES // (1024 * 1024)))
    return blob


def write_file(slug, ext, blob):
    """Write the file and clear away any older copy under a different extension."""
    d = folder()
    for old in os.listdir(d):
        if old.rsplit(".", 1)[0] == slug:
            try:
                os.remove(os.path.join(d, old))
            except OSError:
                pass
    with open(os.path.join(d, "{}.{}".format(slug, ext)), "wb") as f:
        f.write(blob)


def remove_file(slug):
    d = folder()
    for old in os.listdir(d):
        if old.rsplit(".", 1)[0] == slug:
            try:
                os.remove(os.path.join(d, old))
            except OSError:
                pass


def size_text(n):
    n = int(n or 0)
    if n >= 1024 * 1024:
        return "{:.1f} MB".format(n / (1024.0 * 1024.0))
    if n >= 1024:
        return "{:.0f} KB".format(n / 1024.0)
    return "{} bytes".format(n)


def form_public(r):
    return {"id": r["id"], "title": r["title"], "blurb": r["blurb"],
            "group": r["grp"], "slug": r["slug"], "ext": r["ext"],
            "kind": NICE.get(r["ext"], r["ext"].upper()),
            "file": "uploads/{}/{}.{}".format(FOLDER, r["slug"], r["ext"]),
            "bytes": r["bytes"], "size": size_text(r["bytes"]),
            "updated": r["updated"] or r["added"] or "",
            "sort": r["sort"], "active": bool(r["active"]),
            "original": r["original"], "by": r["by"] or ""}


def rows(active_only):
    sql = "SELECT * FROM forms"
    if active_only:
        sql += " WHERE active=1"
    sql += " ORDER BY sort, lower(grp), lower(title)"
    return [form_public(r) for r in S.q(sql).fetchall()]


def may_manage(u):
    """The office keeps the forms. The admin keeps the website, so both."""
    return u["role"] in ("office", "admin")


def require_manage(req):
    u = S.require_ready_user(req)
    if not may_manage(u):
        raise S.ApiError(403, "Only the department office or an admin can change the forms.")
    return u


# ---------------------------------------------------------------------------
# forms-data.js - the list the website reads, with nothing running behind it
# ---------------------------------------------------------------------------
def forms_js():
    import json
    items = [{k: v for k, v in f.items() if k in
              ("title", "blurb", "group", "file", "kind", "size", "updated")}
             for f in rows(True)]
    return ("/* Generated by the department portal on {} */\n"
            "window.DEPT_FORMS = {};\n").format(S.iso(S.now()), json.dumps(items, indent=2))


# ---------------------------------------------------------------------------
# API
# ---------------------------------------------------------------------------
def api_list(req):
    """The public list. No sign-in: anybody may download a blank form."""
    items = rows(True)
    return {"forms": items, "groups": sorted({f["group"] for f in items if f["group"]})}


def api_manage(req):
    require_manage(req)
    all_rows = rows(False)
    return {"forms": all_rows,
            "groups": sorted({f["group"] for f in all_rows if f["group"]}),
            "max_mb": MAX_BYTES // (1024 * 1024),
            "accept": [e for e, _m in KINDS]}


def api_add(req):
    u = require_manage(req)
    d = req.json() or {}
    title = text(d.get("title"), 120, "The title")
    if not title:
        raise S.ApiError(400, "Give the form a title, so people know what it is.")
    blob = decode(d.get("file"))
    ext = sniff(blob)
    slug = slugify(title)
    write_file(slug, ext, blob)
    at = S.iso(S.now())
    top = S.q1("SELECT MAX(sort) m FROM forms")["m"]
    S.q("INSERT INTO forms(title,blurb,grp,slug,ext,original,bytes,sort,active,added,updated,by)"
        " VALUES(?,?,?,?,?,?,?,?,1,?,?,?)",
        (title, text(d.get("blurb"), 300, "The description"), text(d.get("group"), 60, "The group"),
         slug, ext, text(d.get("original"), 160, "The file name"), len(blob),
         int(top or 0) + 1, at, at, u["email"]))
    S.audit(u["email"], "form.added", slug, "{} ({} bytes)".format(title, len(blob)), req.ip)
    return {"ok": True, "form": form_public(S.q1("SELECT * FROM forms WHERE slug=?", (slug,)))}


def api_edit(req, fid):
    u = require_manage(req)
    r = S.q1("SELECT * FROM forms WHERE id=?", (int(fid),))
    if not r:
        raise S.ApiError(404, "No such form.")
    d = req.json() or {}
    sets, args = [], []
    if "title" in d:
        t = text(d.get("title"), 120, "The title")
        if not t:
            raise S.ApiError(400, "A form needs a title.")
        sets.append("title=?"); args.append(t)
    for key, col, limit, what in (("blurb", "blurb", 300, "The description"),
                                  ("group", "grp", 60, "The group")):
        if key in d:
            sets.append(col + "=?"); args.append(text(d.get(key), limit, what))
    if "active" in d:
        sets.append("active=?"); args.append(1 if d.get("active") else 0)
    if "sort" in d:
        try:
            sets.append("sort=?"); args.append(int(d.get("sort")))
        except (TypeError, ValueError):
            raise S.ApiError(400, "The order must be a number.")
    # A new file keeps the same slug, so a link that has been e-mailed around or
    # bookmarked still works after the form is updated.
    if d.get("file"):
        blob = decode(d.get("file"))
        ext = sniff(blob)
        write_file(r["slug"], ext, blob)
        sets += ["ext=?", "bytes=?", "original=?"]
        args += [ext, len(blob), text(d.get("original"), 160, "The file name")]
    if not sets:
        return {"ok": True, "form": form_public(r)}
    sets.append("updated=?"); args.append(S.iso(S.now()))
    sets.append("by=?"); args.append(u["email"])
    args.append(r["id"])
    S.q("UPDATE forms SET " + ",".join(sets) + " WHERE id=?", tuple(args))
    S.audit(u["email"], "form.updated", r["slug"], ", ".join(x.split("=")[0] for x in sets), req.ip)
    return {"ok": True, "form": form_public(S.q1("SELECT * FROM forms WHERE id=?", (r["id"],)))}


def api_delete(req, fid):
    u = require_manage(req)
    r = S.q1("SELECT * FROM forms WHERE id=?", (int(fid),))
    if not r:
        raise S.ApiError(404, "No such form.")
    remove_file(r["slug"])
    S.q("DELETE FROM forms WHERE id=?", (r["id"],))
    S.audit(u["email"], "form.deleted", r["slug"], r["title"], req.ip)
    return {"ok": True}


def api_order(req):
    """The whole list in the order the office dragged it into."""
    u = require_manage(req)
    ids = (req.json() or {}).get("ids") or []
    for i, fid in enumerate(ids[:300]):
        try:
            S.q("UPDATE forms SET sort=? WHERE id=?", (i + 1, int(fid)))
        except (TypeError, ValueError):
            continue
    S.audit(u["email"], "form.reordered", "", "{} forms".format(len(ids)), req.ip)
    return {"ok": True, "forms": rows(False)}


ROUTE_TABLE = [
    ("GET",    r"/api/forms",            api_list),
    ("GET",    r"/api/forms/manage",     api_manage),
    ("POST",   r"/api/forms/order",      api_order),
    ("POST",   r"/api/forms",            api_add),
    ("PUT",    r"/api/forms/(\d+)",      api_edit),
    ("DELETE", r"/api/forms/(\d+)",      api_delete),
]


def install(srv):
    """Called once by server.py, the same way bookings.py is."""
    global S
    S = srv
    for method, pattern, fn in ROUTE_TABLE:
        srv.route(method, pattern)(fn)
    if hasattr(srv, "EXTENSIONS") and NAME not in [m.NAME for m in srv.EXTENSIONS]:
        srv.EXTENSIONS.append(sys.modules[__name__])
