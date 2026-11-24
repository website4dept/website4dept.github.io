#!/usr/bin/env python3
"""
Set the booking system up on your own computer, in one command.
================================================================

    python3 try-it.py your.email@gmail.com

It does everything the first run needs:
  * creates the database and config.json
  * allows your e-mail domain so the booking form will accept you
  * puts your address on a faculty profile, so you can book a room
  * makes three portal logins - admin, office and HoD - with the password below
  * adds a few sample bookings, so the calendar has something in it

Then start the server:   python3 server.py
and open:                http://localhost:8000

Nothing leaves your computer: e-mails are printed in the terminal window and
saved in backend/data/outbox/ instead of being sent.

Run it again any time to start over (it wipes the database first).
"""

import json
import os
import shutil
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
os.chdir(HERE)
sys.path.insert(0, HERE)

PASSWORD = "DeptMaths2026!"           # the three demo logins share this
FACULTY_ID = "ratna-dutta"            # the profile your address is attached to


def main():
    if len(sys.argv) < 2 or "@" not in sys.argv[1]:
        print(__doc__)
        print("Give your e-mail address, for example:\n    python3 try-it.py you@gmail.com\n")
        return 1
    me = sys.argv[1].strip().lower()
    domain = me.split("@")[1]

    # start clean
    for path in ("data",):
        if os.path.isdir(path):
            shutil.rmtree(path)
    if os.path.exists("config.json"):
        os.remove("config.json")

    import server                                   # creates config.json and the database
    server.init_db(verbose=False)

    # let your own domain in, for testing only
    cfg = json.load(open("config.json", encoding="utf-8"))
    cfg["allowed_email_domains"] = sorted({"iitkgp.ac.in", "kgpian.iitkgp.ac.in", domain})
    json.dump(cfg, open("config.json", "w", encoding="utf-8"), indent=2)
    server.CFG = server.load_config()

    import bookings

    # your address goes on a faculty profile, so the booking form knows you
    person = server.get_person(FACULTY_ID)
    person["email"] = me
    server.q("UPDATE people SET data=? WHERE id=?", (json.dumps(person), FACULTY_ID))

    # a research scholar and a student, so you can try those too
    scholar = server.get_person("mou-jana")
    scholar["email"] = "scholar.demo@" + domain
    server.q("UPDATE people SET data=? WHERE id=?", (json.dumps(scholar), "mou-jana"))
    head = server.get_person("adrijit-goswami")
    head["email"] = "hod.demo@" + domain
    server.q("UPDATE people SET data=? WHERE id=?", (json.dumps(head), "adrijit-goswami"))
    server.q("INSERT OR REPLACE INTO contacts(name,email,grp) VALUES(?,?,?)",
             ("Demo Student", "student.demo@" + domain, "msc-2025"))

    # three logins, ready to use
    pw = server.hash_password(PASSWORD)
    accounts = [(me, "admin", FACULTY_ID), ("office.demo@" + domain, "office", None),
                ("hod.demo@" + domain, "hod", "adrijit-goswami")]
    for email, role, pid in accounts:
        server.q("DELETE FROM users WHERE email=?", (email,))
        server.q("INSERT INTO users(email,name,person_id,role,pw_hash,active,created)"
                 " VALUES(?,?,?,?,?,1,?)",
                 (email, email.split("@")[0], pid, role, pw, server.iso(server.now())))

    # classrooms are the office's to confirm; halls go to the Head
    server.q("UPDATE rooms SET needs_hod=0 WHERE kind='classroom'")
    server.q("UPDATE rooms SET custodian='Department office, Room 203'")

    # a few bookings so the calendar is not empty
    hall = server.q1("SELECT * FROM rooms WHERE name='Seminar Hall'")
    def day(n):
        return (server.now() + server.timedelta(days=n)).strftime("%Y-%m-%d")
    # One booking in each state, so every screen has something on it and you can
    # see the whole flow without having to create it all by hand:
    #   confirmed  - settled; shows on the public calendar and on Today's sheet
    #   approved   - the Head has said yes, waiting in the office's "Ready to confirm"
    #   forwarded  - sitting with the Head, on his Approvals page
    #   pending    - just arrived, on the office's desk
    samples = [(3, "08:00", "20:00", "Departmental workshop (all day)",      "confirmed"),
               (5, "10:00", "12:00", "Invited seminar: post-quantum signatures", "confirmed"),
               (5, "15:00", "17:00", "Research scholars' colloquium",        "approved"),
               (8, "14:00", "16:00", "Faculty meeting",                      "forwarded"),
               (9, "11:00", "13:00", "Departmental colloquium",              "pending")]
    at = server.iso(server.now())
    # These sample bookings are attributed to a separate demo address on purpose.
    # If they used your address they would count against the "requests per hour"
    # limit, and your own first booking would be refused.
    seeded_by = "samples.demo@" + domain
    for n, a, b, title, state in samples:
        status = "approved" if state in ("confirmed", "approved") else state
        confirmed = 1 if state == "confirmed" else 0
        cur = server.q(
            "INSERT INTO bookings(ref,room_id,user_id,person_id,on_date,t_start,t_end,title,purpose,"
            "attendees,needs,outside,hide_name,status,confirmed,created,updated,requester_name,"
            "requester_email,roll,phone,advisor_id,advisor_name,advisor_email,source)"
            " VALUES('',?,0,?,?,?,?,?,'',40,'',0,0,?,?,?,?,?,?,'','3222283654',?,?,?,'public')",
            (hall["id"], FACULTY_ID, day(n), a, b, title, status, confirmed, at, at,
             "Ratna Dutta", seeded_by, FACULTY_ID, "Ratna Dutta", me))
        server.q("UPDATE bookings SET ref=? WHERE id=?",
                 ("MA-B-{}-{:04d}".format(day(n)[:4], cur.lastrowid), cur.lastrowid))

    print("""
=====================================================================
 Ready. Now run:     python3 server.py
 and open:           http://localhost:8000
=====================================================================

TRY THE BOOKING FORM (no login needed)
  Click "Room Booking" at the top right.
  The calendar shows which days are free. Choose a day, then a free slot.
  Book as yourself using:   {me}
  A six-digit code is printed in the terminal window - type it in.

LOG IN TO THE PORTAL                 http://localhost:8000/portal/login.html
  Password for all three:  {pw}
  After the password, a code appears in the terminal - type that in too.

    {me}
        Admin. Everything, including Rooms & halls.
    office.demo@{dom}
        The department office. Booking requests, Today.
    hod.demo@{dom}
        The Head. Approvals, and the Standing approval switch.

ALSO ON THE REGISTER (so you can book as them)
    scholar.demo@{dom}     a research scholar
    student.demo@{dom}     an M.Sc. student

WHERE THE E-MAILS GO
  Nothing is sent. Every message is printed in the terminal window and saved
  in  backend/data/outbox/  as a .eml file you can open.

START OVER
  python3 try-it.py {me}
=====================================================================
""".format(me=me, pw=PASSWORD, dom=domain))
    return 0


if __name__ == "__main__":
    sys.exit(main())
