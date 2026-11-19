/* =====================================================================
   SITE SETTINGS — edit this one file to change the footer on EVERY page
   =====================================================================
   address        one line per entry, shown line by line in the footer
   office_phone / fax / email   shown under the address
   webteam        copyright name + contact e-mail in the bottom strip
   shortcuts      the quick-link list (ERP, Zimbra, Gmail, calendars …)
   social         the DEPARTMENT's own pages. Leave "" until the page exists:
                  an empty entry is shown dimmed and does not link anywhere.
   ===================================================================== */
window.DEPT_SITE = {
  name: "Department of Mathematics",
  address: [
    "Department of Mathematics",
    "Indian Institute of Technology Kharagpur",
    "Kharagpur – 721302",
    "West Bengal, India"
  ],
  // Numbers as printed on the institute's department page (HoD line); confirm with the office.
  office_phone: "+91-3222-282275",
  office_phone_2: "+91-3222-282700",
  fax: "+91-3222-255303",
  email: "office@maths.iitkgp.ac.in",

  // bottom strip of the footer: copyright holder + web-team contact
  webteam: { name: "WebTeam@MathsDept", email: "webmathsiitkgp@gmail.com" },

  shortcuts: [
    { label: "ERP",                     url: "https://erp.iitkgp.ac.in" },
    { label: "Zimbra Webmail",          url: "https://iitkgpmail.iitkgp.ac.in/" },
    { label: "Gmail (students)",        url: "https://mail.google.com/" },
    { label: "Academic Calendar",       url: "https://www.iitkgp.ac.in/academic-calendar-ug" },
    { label: "Administrative Calendar", url: "https://www.iitkgp.ac.in/assets/pdf/AdministrativeCalendar.pdf" },
    { label: "Apna IIT KGP",            url: "http://apna.iitkgp.ac.in" },
    { label: "Career Development Centre (CDC)", url: "https://cdc.iitkgp.ac.in/" },
    { label: "SETU",                    url: "https://setuatcc.iitkgp.ac.in" },
    { label: "Central Library",         url: "https://www.iitkgp.ac.in/academics-library" },
    { label: "Communication Directory", url: "https://www.iitkgp.ac.in/assets/pdf/comdir.pdf" },
    { label: "Holidays",                url: "https://www.iitkgp.ac.in/holidays" },
    { label: "PMRF",                    url: "https://www.pmrf.in/" }
  ],

  social: {
    facebook: "",
    linkedin: "",
    x: "",
    youtube: ""
  }
};
