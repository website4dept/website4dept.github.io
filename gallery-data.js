/* =====================================================================
   PHOTOS — shown in the home page slideshow
   =====================================================================
   src     path of the image, e.g. "gallery/seminar-2026.jpg"  (put the file in the gallery folder)
   title   short caption
   album   a group name; the gallery page makes a filter button for each album
   date    optional, e.g. "Nov 2026"
   hero    true = also shown in the home page slideshow (every 3 seconds)

   A photo whose file is missing simply shows the plain maroon panel instead,
   so it is safe to list photos before you upload them.

   Keep file names simple: lower case, no spaces (use dashes), e.g. "dept-photo.jpg".
   Resize large camera photos to about 2000 px on the long side so the home
   page stays fast.
   ===================================================================== */
window.DEPT_GALLERY = [
  { src: "gallery/dept-photo.jpg",    title: "Department of Mathematics", album: "Department", hero: true },
  { src: "gallery/iitkgp-campus.jpg", title: "IIT Kharagpur campus",      album: "Campus",     hero: true }
  /* add more, one per line, for example:
  ,{ src: "gallery/colloquium-1.jpg", title: "Student colloquium", album: "Events", date: "Nov 2026", hero: true }
  ,{ src: "gallery/convocation.jpg",  title: "Convocation",         album: "Events" }
  */
];
