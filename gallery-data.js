/* =====================================================================
   PHOTOS — shown in the home page slideshow
   =====================================================================
   src     path of the image, e.g. "gallery/seminar-2026.jpg"  (put the file in the gallery folder)
   title   short caption
   album   a group name; the gallery page makes a filter button for each album
   date    optional, e.g. "Nov 2026"
   hero    true = also shown in the home page slideshow (every 3 seconds)

   A photo whose file is missing is simply skipped, so it is safe to list
   photos before you upload them.
   ===================================================================== */
window.DEPT_GALLERY = [
  { src: "gallery/iitkgp-campus.jpg", title: "IIT Kharagpur campus",  album: "Campus",     hero: true },
  { src: "gallery/Dept Photo.jpeg",   title: "Department Entrance",           album: "Department", hero: true },
  { src: "slide-3.jpg",   title: "Research across disciplines",       album: "Research",   hero: true }
  /* add more, one per line, for example:
  ,{ src: "gallery/colloquium-1.jpg", title: "Student colloquium", album: "Events", date: "Nov 2026", hero: true }
  ,{ src: "gallery/convocation.jpg",  title: "Convocation",         album: "Events" }
  */
];
