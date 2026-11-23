/* Students page: overview (photo cards) -> one section at a time.
   Photos come from gallery-data.js: give a photo the album name of a section
   ("Programmes", "Student Activities", "Achievements", "Placement", "Job Opportunity")
   and it appears here.
   Sections without photos show a neutral placeholder. */
(function(){
  'use strict';
  const SECS = [
    ['programmes',     'Programmes',        'BS-MS, M.Sc. and M.Tech. resources.',          'Programmes'],
    ['activities',     'Student activities','Clubs, culture, sports and outreach.',         'Student Activities'],
    ['achievements',   'Achievements',      'Awards, exams and recognitions.',              'Achievements'],
    ['placement',      'Placement',         'Campus placement, internships and higher studies.', 'Placement'],
    ['job-opportunity','Job Opportunity',   'Openings, fellowships and career resources.',  'Job Opportunity']
  ];
  const SYM = ['∑', 'π', '∫', '∞', '∇'];
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
    SECS.map((s, n) => { const ph = photos(s[3])[0];
      return '<a class="info-card people-card student-card" href="#' + s[0] + '"><div class="student-photo' + (ph ? '' : ' is-empty') + '" data-sym="' + SYM[n] + '">' + (ph ? img(ph) : '') + '</div>' +
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

  /* ---------- Programmes: BS-MS / M.Sc. / M.Tech. tabs, current students by batch, alumni ---------- */
  // students: a plain list (DEPT_STUDENTS) and/or per-batch groups (DEPT_STUDENT_BATCHES: {programme, batch, students:[...]})
  const fromBatches = [];
  (window.DEPT_STUDENT_BATCHES || []).forEach(b => { if (!b || !Array.isArray(b.students)) return;
    const d = Object.assign({}, b); delete d.students;
    b.students.forEach(r => { r = typeof r === 'string' ? {name: r} : r; if (r) fromBatches.push(Object.assign({}, d, r)); }); });
  const STU = (window.DEPT_STUDENTS || []).concat(fromBatches).filter(x => x && x.name && x.programme);
  const PROGS = [['bsms', 'BS-MS', 'bs-ms-students', 'academics.html#bs-ms', 'Five-year integrated programme'],
                 ['msc', 'M.Sc.', 'msc-students', 'academics.html#msc', 'Two-year M.Sc. programme'],
                 ['mtech', 'M.Tech. (CSDP)', 'mtech-students', 'academics.html#mtech', 'M.Tech. programme']];
  const byName = (a, b) => String(a.name).localeCompare(String(b.name));
  const outcomeText = x => x.outcome === 'placed' ? 'Placed' + (x.org ? ' at ' + x.org : '') + (x.role ? ' · ' + x.role : '')
    : x.outcome === 'higher' ? 'Higher studies' + (x.org ? ' at ' + x.org : '') + (x.role ? ' · ' + x.role : '')
    : (x.org || x.role || '');
  const nameLine = x => '<li><span class="stu-name">' + esc(x.name) + '</span>' + (x.roll ? '<span class="stu-roll">' + esc(x.roll) + '</span>' : '') + '</li>';
  const progPanel = pg => {
    const all = STU.filter(x => x.programme === pg[0]);
    const cur = all.filter(x => x.status !== 'alumni'), alu = all.filter(x => x.status === 'alumni');
    const batches = [...new Set(cur.map(x => x.batch || 0))].sort((a, b) => b - a);
    let h = '<div class="stu-head"><div><div class="eyebrow">' + esc(pg[1]) + '</div><h2 class="section-title">' + esc(pg[1]) + ' students</h2><p class="stu-sub">' + esc(pg[4]) + '. <a href="' + pg[3] + '">Programme details →</a></p></div>' +
      '<div class="stu-res"><span>Timetable [add link]</span><span>Curriculum &amp; syllabus [add link]</span></div></div>';
    h += '<h3 class="stu-h3">Current students <span class="pill-count">' + cur.length + '</span></h3>';
    h += batches.length ? '<div class="stu-batches">' + batches.map(b => {
      const L = cur.filter(x => (x.batch || 0) === b).sort(byName);
      return '<div class="stu-batch"><h4>' + (b ? b + ' batch' : 'Batch not set') + ' <span class="pill-count">' + L.length + '</span></h4><ul class="stu-list">' + L.map(nameLine).join('') + '</ul></div>'; }).join('') + '</div>'
      : '<div class="empty-state"><h3>Student list coming soon</h3><p>Current ' + esc(pg[1]) + ' students will be listed here by batch.</p></div>';
    h += '<h3 class="stu-h3" id="' + pg[0] + '-alumni">Alumni <span class="pill-count">' + alu.length + '</span></h3>';
    const years = [...new Set(alu.map(x => x.passout || 0))].sort((a, b) => b - a);
    h += years.length ? '<div class="stu-alumni">' + years.map(y => '<div class="stu-batch"><h4>' + (y ? 'Class of ' + y : 'Year not set') + '</h4><ul class="stu-list stu-alum">' +
      alu.filter(x => (x.passout || 0) === y).sort(byName).map(x => '<li><span class="stu-name">' + esc(x.name) + '</span><span class="stu-out ' + esc(x.outcome || '') + '">' + esc(outcomeText(x)) + '</span></li>').join('') + '</ul></div>').join('') + '</div>'
      : '<div class="empty-state"><h3>Alumni will be listed here</h3><p>Passed-out students with their placement or higher studies.</p></div>';
    return h;
  };
  const progSec = document.getElementById('programmes');
  let curProg = 'bsms';
  if (progSec){
    const box = progSec.querySelector('.content');
    box.querySelector('.prog-static') && box.querySelector('.prog-static').remove();
    const ph = document.createElement('div');
    ph.innerHTML = '<div class="pill-row people-tabs stu-tabs" role="tablist" aria-label="Programmes">' +
      PROGS.map(pg => '<button type="button" class="pill" role="tab" data-prog="' + pg[0] + '">' + esc(pg[1]) + '</button>').join('') + '</div>' +
      PROGS.map(pg => '<div class="stu-panel" id="' + pg[2] + '" data-panel="' + pg[0] + '" role="tabpanel">' + progPanel(pg) + '</div>').join('');
    while (ph.firstChild) box.appendChild(ph.firstChild);
  }
  const showProg = id => {
    curProg = PROGS.some(p => p[0] === id) ? id : 'bsms';
    document.querySelectorAll('.stu-panel').forEach(el => { el.hidden = el.dataset.panel !== curProg; });
    document.querySelectorAll('.stu-tabs .pill').forEach(b => { const on = b.dataset.prog === curProg; b.classList.toggle('is-current', on); b.setAttribute('aria-selected', on ? 'true' : 'false'); });
  };
  document.addEventListener('click', e => { const b = e.target.closest('.stu-tabs .pill'); if (b) showProg(b.dataset.prog); });
  const progFromHash = h => { const id = decodeURIComponent((h || '').replace(/^#/, '')); const pg = PROGS.find(p => p[2] === id || id === p[0] + '-alumni'); return pg ? pg[0] : null; };

  /* ---------- Job opportunity: openings listed in students-data.js (DEPT_JOBS) ---------- */
  const jobBox = document.getElementById('jobData');
  if (jobBox){
    const jobs = (window.DEPT_JOBS || []).filter(j => j && j.title);
    const open = jobs.filter(j => String(j.status || 'open').toLowerCase() !== 'closed');
    jobBox.innerHTML = open.length
      ? '<ul class="job-list">' + open.map(j => '<li class="job-item">' +
          '<div class="job-main"><h3>' + esc(j.title) + '</h3>' +
          (j.org ? '<p class="job-org">' + esc(j.org) + '</p>' : '') +
          (j.detail ? '<p class="job-detail">' + esc(j.detail) + '</p>' : '') + '</div>' +
          '<div class="job-meta">' +
            (j.type ? '<span class="pill">' + esc(j.type) + '</span>' : '') +
            (j.deadline ? '<span class="job-deadline">Apply by ' + esc(j.deadline) + '</span>' : '') +
            (j.eligibility ? '<span class="job-elig">' + esc(j.eligibility) + '</span>' : '') +
            (j.url ? '<a class="link-arrow" href="' + esc(j.url) + '" target="_blank" rel="noopener noreferrer">Details <span>→</span></a>' : '') +
          '</div></li>').join('') + '</ul>'
      : '<div class="empty-state"><h3>No openings listed at the moment</h3>' +
        '<p>Current openings will appear here. Add them in <code>students-data.js</code> under <code>DEPT_JOBS</code>.</p></div>';
  }

  /* ---------- Placement: summary from alumni data ---------- */
  const plBox = document.getElementById('placementData');
  if (plBox){
    const alu = STU.filter(x => x.status === 'alumni');
    const placed = alu.filter(x => x.outcome === 'placed'), higher = alu.filter(x => x.outcome === 'higher');
    if (alu.length){
      const recent = placed.concat(higher).sort((a, b) => (b.passout || 0) - (a.passout || 0) || byName(a, b)).slice(0, 12);
      plBox.innerHTML = '<div class="stu-stats"><div><b>' + alu.length + '</b><span>Alumni listed</span></div><div><b>' + placed.length + '</b><span>Placed in industry</span></div><div><b>' + higher.length + '</b><span>In higher studies</span></div></div>' +
        '<ul class="stu-list stu-alum stu-recent">' + recent.map(x => '<li><span class="stu-name">' + esc(x.name) + ' <small>' + esc((PROGS.find(p => p[0] === x.programme) || [0, x.programme])[1]) + (x.passout ? ' · ' + x.passout : '') + '</small></span><span class="stu-out ' + esc(x.outcome) + '">' + esc(outcomeText(x)) + '</span></li>').join('') + '</ul>' +
        '<p class="stu-sub">Full lists are in each programme’s alumni section under <a href="#programmes">Programmes</a>.</p>';
    }
  }

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
    if (cur === 'programmes') showProg(progFromHash(hash) || curProg);
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
  showProg('bsms');
  const first = show(location.hash);
  const t = location.hash && document.getElementById(decodeURIComponent(location.hash.slice(1)));
  if (t && t.id !== first && t.id !== 'overview') setTimeout(() => t.scrollIntoView({block: 'start'}), 50);
})();
