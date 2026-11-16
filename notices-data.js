/* =====================================================================
   NOTICES & EVENTS — shown on the home Notice Board and the News & Events page
   =====================================================================
   On the portal server this file is generated automatically from the admin
   panel. On the static (GitHub) copy, edit it by hand or use Admin → Export.

   kind      "notice" or "event"
   title     text shown in the list
   tag       Seminar | Colloquium | Admissions | Examination | Workshop | Notice | …
   date      "YYYY-MM-DD" (notice date, or event date)
   end_date  events lasting several days (optional)
   link      where the title points (optional; a page or a PDF/URL)
   body      longer text (optional; shown on the News & Events page)
   is_new    true shows a "New" badge     pinned  true keeps it at the top
   expires   "YYYY-MM-DD" after which it disappears automatically (optional)
   speaker, affiliation, venue, time   for events
   ===================================================================== */
window.DEPT_NOTICES = [
  {
    "kind": "notice",
    "title": "[Seminar title] — [Speaker], [Venue], [Time]",
    "tag": "Seminar",
    "date": "",
    "link": "news-events.html",
    "is_new": true,
    "id": 1
  },
  {
    "kind": "notice",
    "title": "[Admission notice title for programme]",
    "tag": "Admissions",
    "date": "",
    "link": "academics.html#admissions",
    "is_new": true,
    "id": 2
  },
  {
    "kind": "notice",
    "title": "[Course / examination schedule notice]",
    "tag": "Examination",
    "date": "",
    "link": "students.html",
    "id": 3
  },
  {
    "kind": "notice",
    "title": "[Workshop / conference name and details]",
    "tag": "Workshop",
    "date": "",
    "link": "news-events.html",
    "id": 4
  },
  {
    "kind": "notice",
    "title": "Colloquium: [Talk title] by [Speaker]",
    "tag": "Colloquium",
    "date": "",
    "link": "news-events.html",
    "id": 5
  },
  {
    "kind": "notice",
    "title": "[General departmental notice]",
    "tag": "Notice",
    "date": "",
    "link": "news-events.html",
    "id": 6
  }
];
