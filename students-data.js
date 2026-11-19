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
