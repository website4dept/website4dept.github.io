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

  var S = C.social || {};
  var ytLogo = '<svg class="soc-yt" viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" focusable="false">' +
    '<path fill="#FF0000" d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.6 12 3.6 12 3.6s-7.5 0-9.4.5A3 3 0 0 0 .5 6.2 31 31 0 0 0 0 12a31 31 0 0 0 .5 5.8 3 3 0 0 0 2.1 2.1c1.9.5 9.4.5 9.4.5s7.5 0 9.4-.5a3 3 0 0 0 2.1-2.1A31 31 0 0 0 24 12a31 31 0 0 0-.5-5.8z"/>' +
    '<path fill="#FFFFFF" d="M9.6 15.6 15.8 12 9.6 8.4z"/></svg>';
  var icons = [['facebook', 'Facebook', 'f'], ['linkedin', 'LinkedIn', 'in'], ['x', 'X (Twitter)', 'X'], ['youtube', 'YouTube', ytLogo]];
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
      '<span>© ' + new Date().getFullYear() + ' ' + esc((C.webteam && C.webteam.name) || 'Department of Mathematics, IIT Kharagpur') +
        (C.webteam && C.webteam.email ? ' · Contact web team: <a href="mailto:' + esc(C.webteam.email) + '">' + esc(C.webteam.email) + '</a>' : '') + '</span>' +
      '<span><a href="https://www.iitkgp.ac.in/" target="_blank" rel="noopener noreferrer">IIT Kharagpur ↗</a> · <a href="portal/login.html">Portal Login</a></span>' +
    '</div></div>';
})();
