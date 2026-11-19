/* Students page: overview (photo cards) -> one section at a time.
   Photos come from gallery-data.js: give a photo the album name of a section
   ("Programmes", "Student Activities", "Achievements", "Placements") and it appears here.
   Sections without photos show a neutral placeholder. */
(function(){
  'use strict';
  const SECS = [
    ['programmes',  'Programmes',            'BS-MS, M.Sc. and M.Tech. resources.',        'Programmes'],
    ['activities',  'Student activities',    'Clubs, culture, sports and outreach.',       'Student Activities'],
    ['achievements','Achievements',          'Awards, exams and recognitions.',            'Achievements'],
    ['placements',  'Placements & industry', 'Careers, internships and higher studies.',  'Placements'],
    ['notices',     'Student notices',       'Exams, schedules and announcements.',        'Student Notices']
  ];
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const photos = album => (window.DEPT_GALLERY || []).filter(p => p && p.src && String(p.album || '').toLowerCase() === album.toLowerCase());
  const img = p => '<img src="' + esc(p.src) + '" alt="' + esc(p.title || '') + '" loading="lazy" onerror="this.parentNode.classList.add(\'is-empty\');this.remove()">';

  const secEls = SECS.map(s => document.getElementById(s[0])).filter(Boolean);
  const hero = document.querySelector('main > .page-hero');
  if (!secEls.length || !hero) return;

  const bar = document.createElement('div');
  bar.className = 'content people-tabs-wrap';
  bar.innerHTML = '<div class="pill-row people-tabs" role="tablist" aria-label="Student sections">' +
    '<a class="pill" href="#overview" data-sec="overview">‹ Overview</a>' +
    SECS.map(s => '<a class="pill" role="tab" href="#' + s[0] + '" data-sec="' + s[0] + '">' + esc(s[1]) + '</a>').join('') + '</div>';

  const ov = document.createElement('section');
  ov.className = 'page-section people-overview'; ov.id = 'overview';
  ov.innerHTML = '<div class="content"><p class="people-intro">Student life at the Department of Mathematics, IIT Kharagpur: our BS-MS, M.Sc. and M.Tech. programmes, the activities students run, what they achieve, and where they go next.</p>' +
    '<div class="people-cards student-cards">' +
    SECS.map(s => { const ph = photos(s[3])[0];
      return '<a class="info-card people-card student-card" href="#' + s[0] + '"><div class="student-photo' + (ph ? '' : ' is-empty') + '">' + (ph ? img(ph) : '') + '</div>' +
        '<div class="student-card-body"><h3>' + esc(s[1]) + '</h3><p>' + esc(s[2]) + '</p><span class="card-link">View →</span></div></a>'; }).join('') +
    '</div></div>';
  hero.insertAdjacentElement('afterend', ov);
  ov.insertAdjacentElement('beforebegin', bar);

  // photo strip at the top of each section
  SECS.forEach(s => {
    const el = document.getElementById(s[0]); if (!el) return;
    const list = photos(s[3]).slice(0, 5);
    const strip = document.createElement('div');
    strip.className = 'student-strip' + (list.length ? '' : ' is-placeholder');
    strip.innerHTML = list.length
      ? list.map((p, i) => '<figure class="' + (i === 0 ? 'big' : '') + '">' + img(p) + '</figure>').join('')
      : '<figure class="big is-empty"><figcaption>Photos for ' + esc(s[1].toLowerCase()) + ' will appear here. Add them in the gallery with the album name “' + esc(s[3]) + '”.</figcaption></figure>';
    el.querySelector('.content').insertAdjacentElement('afterbegin', strip);
  });

  const idOf = hash => {
    const id = decodeURIComponent(hash.replace(/^#/, ''));
    if (!id || id === 'overview') return 'overview';
    if (SECS.some(s => s[0] === id)) return id;
    const el = document.getElementById(id);            // e.g. #msc-students -> the section holding it
    const sec = el && el.closest('section.page-section');
    return sec && SECS.some(s => s[0] === sec.id) ? sec.id : 'overview';
  };
  const show = hash => {
    const cur = idOf(hash), isOv = cur === 'overview';
    secEls.forEach(el => { el.hidden = el.id !== cur; });
    ov.hidden = !isOv; bar.hidden = isOv;
    bar.querySelectorAll('.pill').forEach(a => {
      const on = a.dataset.sec === cur;
      a.classList.toggle('is-current', on); a.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    return cur;
  };
  const top = () => window.scrollTo({top: Math.max(0, (hero.offsetTop + hero.offsetHeight) - 70), behavior: 'smooth'});
  document.addEventListener('click', e => {
    const a = e.target.closest('a[href^="#"]'); if (!a || !(bar.contains(a) || ov.contains(a))) return;
    const id = a.getAttribute('href').slice(1); if (id !== 'overview' && !SECS.some(s => s[0] === id)) return;
    e.preventDefault(); history.pushState(null, '', '#' + id); show('#' + id); top();
  });
  window.addEventListener('hashchange', () => { show(location.hash); top(); });
  window.addEventListener('popstate', () => show(location.hash));
  const first = show(location.hash);
  const t = location.hash && document.getElementById(decodeURIComponent(location.hash.slice(1)));
  if (t && t.id !== first && t.id !== 'overview') setTimeout(() => t.scrollIntoView({block: 'start'}), 50);
})();
