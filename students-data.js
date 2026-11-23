/* =====================================================================
   STUDENTS — shown on the Students page (Programmes tabs, alumni, placements)
   =====================================================================
   One line per student. Keep it minimal.
   name        required
   programme   required: "bsms", "msc" or "mtech"
   batch       admission year, e.g. 2024           (current students are grouped by this)
   roll        optional roll number (leave out to show the name only)
   status      "current" (default) or "alumni"
   passout     alumni: year of passing out
   outcome     alumni: "placed", "higher" (higher studies) or "other"
   org         alumni: company, or institution for higher studies
   role        alumni: job role, or course for higher studies

   Easier: keep one small file per batch in the JSON-files/6-students-current and JSON-files/5-alumni folders and run
   python build_students_data.py  (it rewrites this file). See JSON-files/README.md.

   When the department portal runs on the CIC server, this file is produced
   automatically from the portal (Students) and you never edit it by hand.
   Until then you can edit it, or import a JSON list in the portal.
   ===================================================================== */
window.DEPT_STUDENTS = [
  /* examples (remove the comment marks to use):
  { name: "A. Student", programme: "bsms", batch: 2024, roll: "24MA10001" },
  { name: "B. Student", programme: "msc", batch: 2025 },
  { name: "C. Alumnus", programme: "msc", status: "alumni", passout: 2025, outcome: "placed", org: "Company name", role: "Data Scientist" },
  { name: "D. Alumna", programme: "bsms", status: "alumni", passout: 2025, outcome: "higher", org: "University name", role: "Ph.D. in Mathematics" }
  */
];

/* =====================================================================
   JOB OPPORTUNITIES — shown under Students › Job Opportunity
   =====================================================================
   One entry per opening. Only "title" is required.
   title        the post, e.g. "Junior Research Fellow (JRF)"
   org          department, lab, project or company
   type         short label shown as a tag, e.g. "JRF", "Project", "Internship", "Placement"
   detail       one or two lines about the work
   eligibility  who may apply, e.g. "M.Sc. Mathematics with NET/GATE"
   deadline     closing date as you want it printed, e.g. "15 Dec 2026"
   url          link to the full advertisement (optional)
   status       "open" (default) or "closed" — closed entries are not shown
   ===================================================================== */
window.DEPT_JOBS = [
  /* examples (remove the comment marks to use):
  { title: "Junior Research Fellow (JRF)", org: "Department of Mathematics, IIT Kharagpur",
    type: "JRF", detail: "SERB-funded project on hyperbolic conservation laws.",
    eligibility: "M.Sc. Mathematics with NET/GATE", deadline: "15 Dec 2026",
    url: "https://www.iitkgp.ac.in/", status: "open" },
  { title: "Summer internship — data science", org: "Company name",
    type: "Internship", detail: "Eight-week internship for pre-final year students.",
    eligibility: "BS-MS / M.Sc. third year", deadline: "31 Jan 2027" }
  */
];
