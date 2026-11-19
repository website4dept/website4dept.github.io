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
    "date": "2026-11-24",
    "link": "news-events.html",
    "is_new": true,
    "id": 1
  },
  {
    "kind": "notice",
    "title": "[Admission notice title for programme]",
    "tag": "Admissions",
    "date": "2026-11-12",
    "link": "academics.html#admissions",
    "is_new": true,
    "id": 2
  },
  {
    "kind": "notice",
    "title": "[Course / examination schedule notice]",
    "tag": "Examination",
    "date": "2026-11-19",
    "link": "students.html",
    "id": 3
  },
  {
    "kind": "event",
    "title": "[Workshop / conference name and details]",
    "tag": "Workshop",
    "date": "2026-12-03",
    "end_date": "2026-12-05",
    "venue": "[Venue]",
    "link": "news-events.html",
    "id": 4
  },
  {
    "kind": "event",
    "title": "Colloquium: [Talk title]",
    "tag": "Colloquium",
    "date": "2026-11-26",
    "speaker": "[Speaker]",
    "venue": "[Venue]",
    "time": "[Time]",
    "link": "news-events.html",
    "id": 5
  },
  {
    "kind": "notice",
    "title": "[General departmental notice]",
    "tag": "Notice",
    "date": "2026-11-19",
    "link": "news-events.html",
    "id": 6
  }
];
