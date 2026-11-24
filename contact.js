/* =====================================================================
   contact.js  —  fills in the contact details on contact.html

   WHY THIS FILE EXISTS
   The address, phone numbers and e-mail addresses are written down in ONE
   place, site-config.js, so the footer and this page can never disagree.
   This script copies them into any element on the page that carries a
   data-site="..." attribute.

   TO CHANGE AN ADDRESS OR A PHONE NUMBER
   Edit site-config.js. Do not edit contact.html.

   (This used to be an inline <script> inside contact.html. It was moved out
   so the site can run under a strict Content-Security-Policy, which forbids
   scripts written inside the page itself.)
   ===================================================================== */
/* Show the department-building photo only if the file is actually there.
   (Put it at gallery/maths-department.jpg and this figure appears by itself.) */
(function(){
  document.querySelectorAll("img[data-show-if-loads]").forEach(function(img){
    var fig = img.parentNode;
    img.addEventListener("load", function(){ fig.hidden = false; });
    img.addEventListener("error", function(){ if (fig.parentNode) fig.parentNode.removeChild(fig); });
    if (img.complete) { if (img.naturalWidth) fig.hidden = false; else if (fig.parentNode) fig.parentNode.removeChild(fig); }
  });
})();

(function(){
  var C = window.DEPT_SITE; if (!C) return;
  var esc = function(s){ return String(s == null ? '' : s).replace(/[&<>"']/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); };
  var tel = function(n){ return 'tel:' + String(n).replace(/[^+\d]/g, ''); };
  document.querySelectorAll('[data-site]').forEach(function(el){
    var k = el.getAttribute('data-site');
    if (k === 'address') {
      if (C.address && C.address.length) el.innerHTML = C.address.map(function(l, i){ return i === 0 ? '<strong>' + esc(l) + '</strong>' : esc(l); }).join('<br>');
      return;
    }
    var v = k === 'webteam_email' ? (C.webteam && C.webteam.email) : C[k];
    var row = el.closest('li');
    if (!v) { if (row) row.remove(); return; }
    el.textContent = v;
    if (/phone/.test(k)) el.href = tel(v);
    else if (/email/.test(k)) el.href = 'mailto:' + v;
  });
})();
