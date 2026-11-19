/* Builds the large footer on every page from site-config.js */
(function(){
  var host = document.getElementById('siteFooter');
  var C = window.DEPT_SITE;
  if (!host || !C) return;
  var esc = function(s){ return String(s == null ? '' : s).replace(/[&<>"']/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); };
  var ext = function(u){ return /^https?:/i.test(u) ? ' target="_blank" rel="noopener noreferrer"' : ''; };
  var tel = function(n){ return 'tel:' + String(n).replace(/[^+\d]/g, ''); };

  var addr = (C.address || []).map(function(l, i){ return i === 0 ? '<strong>' + esc(l) + '</strong>' : '<span>' + esc(l) + '</span>'; }).join('');

  var rows = '';
  if (C.office_phone) rows += '<li><span class="fk">Office</span><span><a href="' + tel(C.office_phone) + '">' + esc(C.office_phone) + '</a>' + (C.office_phone_2 ? ' · <a href="' + tel(C.office_phone_2) + '">' + esc(C.office_phone_2) + '</a>' : '') + '</span></li>';
  if (C.fax) rows += '<li><span class="fk">Fax</span><span>' + esc(C.fax) + '</span></li>';
  if (C.email) rows += '<li><span class="fk">E-mail</span><span><a href="mailto:' + esc(C.email) + '">' + esc(C.email) + '</a></span></li>';
  if (C.webmail && C.webmail.url) rows += '<li><span class="fk">Webmail</span><span><a href="' + esc(C.webmail.url) + '"' + ext(C.webmail.url) + '>' + esc(C.webmail.label || 'Webmail') + ' ↗</a></span></li>';

  var S = C.social || {};
  var icons = [['facebook', 'Facebook', 'f'], ['linkedin', 'LinkedIn', 'in'], ['x', 'X (Twitter)', 'X'], ['youtube', 'YouTube', '▶']];
  var social = icons.map(function(i){
    var u = S[i[0]];
    return u ? '<a class="soc" href="' + esc(u) + '" target="_blank" rel="noopener noreferrer" aria-label="' + i[1] + '" title="' + i[1] + '">' + i[2] + '</a>'
             : '<span class="soc is-pending" title="' + i[1] + ' – link to be added" aria-label="' + i[1] + ' (link to be added)">' + i[2] + '</span>';
  }).join('');

  var quick = (C.shortcuts || []).map(function(s){ return '<a href="' + esc(s.url) + '"' + ext(s.url) + '>' + esc(s.label) + '</a>'; }).join('');

  host.className = 'site-footer';
  host.innerHTML =
    '<div class="content footer-large">' +
      '<div class="fcol fcol-contact">' +
        '<h3>Department of Mathematics</h3>' +
        '<address class="faddr">' + addr + '</address>' +
        '<ul class="fcontact">' + rows + '</ul>' +
        '<div class="fsocial"><span>Follow the department</span><div>' + social + '</div></div>' +
      '</div>' +
      '<div class="fcol fcol-quick"><h4>Quick links</h4><div class="fquick">' + quick + '</div></div>' +
      '<div class="fcol fcol-dept"><h4>Department</h4>' +
        '<a href="about.html">About</a><a href="people.html">People</a><a href="research.html">Research</a>' +
        '<a href="academics.html">Academics</a><a href="students.html">Students</a><a href="publications.html">Publications</a>' +
        '<a href="news-events.html">News &amp; Events</a><a href="gallery.html">Gallery</a><a href="contact.html">Contact</a>' +
      '</div>' +
    '</div>' +
    '<div class="footer-bottom-wrap"><div class="content footer-bottom">' +
      '<span>© ' + new Date().getFullYear() + ' Department of Mathematics, Indian Institute of Technology Kharagpur</span>' +
      '<span><a href="https://www.iitkgp.ac.in/" target="_blank" rel="noopener noreferrer">IIT Kharagpur ↗</a> · <a href="portal/login.html">Portal Login</a></span>' +
    '</div></div>';
})();
