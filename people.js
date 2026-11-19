/* =====================================================================
   People directory + profile pages
   Reads window.DEPT_PEOPLE and window.DEPT_AREAS from people-data.js
   ===================================================================== */
(function(){
  const PEOPLE = (window.DEPT_PEOPLE || []).filter(p => p && p.id && p.name);
  const AREAS = window.DEPT_AREAS || {};

  /* ---------- helpers ---------- */
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const byName = (a, b) => a.name.localeCompare(b.name);
  const findPerson = id => PEOPLE.find(p => p.id === id);
  const profileUrl = p => 'profile.html?id=' + encodeURIComponent(p.id);
  const initials = name => name.replace(/^(Prof\.|Dr\.)\s*/i, '').split(/\s+/).filter(Boolean)
                               .map(w => w[0]).filter(c => /[A-Za-z]/.test(c)).slice(0, 2).join('').toUpperCase();
  const photoSrc = p => p.photo ? p.photo : 'photos/' + p.id + '.jpg';

  const FACULTY_TITLES = {
    'professor': 'Professor',
    'associate-professor': 'Associate Professor',
    'assistant-professor': 'Assistant Professor'
  };
  const TYPE_LABELS = {
    faculty: 'Faculty', adjunct: 'Adjunct / INSPIRE Faculty', postdoc: 'Postdoctoral Fellow',
    scholar: 'Ph.D. Scholar', staff: 'Staff'
  };

  function titleOf(p){
    if (p.type === 'faculty'){
      const t = FACULTY_TITLES[p.designation] || '';
      return t && p.grade ? t + ' ' + p.grade : t;
    }
    return p.designation || TYPE_LABELS[p.type] || '';
  }

  // photo with automatic fallback to initials when the image file is missing
  function photoHTML(p, cls){
    return '<div class="' + cls + '" data-initials="' + esc(initials(p.name)) + '">' +
             '<img src="' + esc(photoSrc(p)) + '" alt="' + esc(p.name) + '" loading="lazy" ' +
             'onerror="this.parentElement.classList.add(\'no-photo\');this.remove()">' +
           '</div>';
  }

  function areaPills(p, limit){
    const ids = (p.areas || []).filter(id => AREAS[id]);
    const shown = limit ? ids.slice(0, limit) : ids;
    let h = shown.map(id => '<a class="pill" href="research.html#' + esc(id) + '">' + esc(AREAS[id]) + '</a>').join('');
    if (limit && ids.length > limit) h += '<span class="pill pill-more">+' + (ids.length - limit) + '</span>';
    return h;
  }

  /* ---------- people.html ---------- */
  function card(p){
    const t = titleOf(p);
    const sup = p.supervisor && findPerson(p.supervisor);
    let meta = '';
    if (p.head && p.status === 'current') meta += '<span class="person-role">Head of the Department</span>';
    if (t) meta += '<span class="person-title">' + esc(t) + '</span>';
    if (sup) meta += '<span class="person-meta">Supervisor: <a href="' + profileUrl(sup) + '">' + esc(sup.name) + '</a></span>';
    if (p.cosupervisor) meta += '<span class="person-meta">Co-supervisor: ' + esc(p.cosupervisor) + '</span>';
    if (p.topic && (p.type === 'scholar' || p.type === 'postdoc')) meta += '<span class="person-meta person-topic">' + esc(p.topic) + '</span>';
    if (p.status === 'alumni' && p.year) meta += '<span class="person-meta">Completed ' + esc(p.year) + '</span>';
    if (p.now) meta += '<span class="person-meta">Now: ' + esc(p.now) + '</span>';
    const pills = areaPills(p, 3);
    return '<article class="person-card" id="' + esc(p.id) + '">' +
             '<a class="person-photo-link" href="' + profileUrl(p) + '" tabindex="-1" aria-hidden="true">' + photoHTML(p, 'person-photo') + '</a>' +
             '<div class="person-info">' +
               '<h3><a href="' + profileUrl(p) + '">' + esc(p.name) + '</a></h3>' + meta +
               (pills ? '<div class="pill-row">' + pills + '</div>' : '') +
               '<a class="person-more" href="' + profileUrl(p) + '">View profile →</a>' +
             '</div>' +
           '</article>';
  }

  function group(title, list, note){
    if (!list.length) return '';
    return '<div class="people-group">' +
             (title ? '<h3 class="people-group-title">' + esc(title) + '<span>' + list.length + '</span></h3>' : '') +
             (note ? '<p class="people-group-note">' + esc(note) + '</p>' : '') +
             '<div class="person-grid">' + list.map(card).join('') + '</div>' +
           '</div>';
  }

  function renderDirectory(){
    const holders = document.querySelectorAll('[data-people]');
    if (!holders.length) return;

    holders.forEach(el => {
      const kind = el.dataset.people;
      let html = '';

      if (kind === 'faculty'){
        const cur = PEOPLE.filter(p => p.type === 'faculty' && p.status === 'current');
        const head = cur.filter(p => p.head);
        const rest = cur.filter(p => !p.head);
        html += group('Head of the Department', head);
        html += group('Professors', rest.filter(p => p.designation === 'professor').sort(byName));
        html += group('Associate Professors', rest.filter(p => p.designation === 'associate-professor').sort(byName));
        html += group('Assistant Professors', rest.filter(p => p.designation === 'assistant-professor').sort(byName));
        html += group('Faculty', rest.filter(p => !FACULTY_TITLES[p.designation]).sort(byName),
                      'Designation to be updated.');
      } else if (kind === 'former'){
        const list = PEOPLE.filter(p => ['faculty', 'adjunct', 'staff'].includes(p.type) && p.status === 'former').sort(byName);
        html += group('', list);
      } else if (kind === 'alumni'){
        const list = PEOPLE.filter(p => ['scholar', 'postdoc'].includes(p.type) && p.status === 'alumni')
          .sort((a, b) => (String(b.year || '')).localeCompare(String(a.year || '')) || byName(a, b));
        html += group('Ph.D. alumni', list.filter(p => p.type === 'scholar'));
        html += group('Postdoctoral alumni', list.filter(p => p.type === 'postdoc'));
      } else {
        html += group('', PEOPLE.filter(p => p.type === kind && p.status === 'current').sort(byName));
      }

      el.innerHTML = html || '<div class="empty-state"><h3>List to be added</h3><p>' + esc(el.dataset.empty || '') + '</p></div>';
    });

    // re-apply #hash scrolling now that the cards exist (e.g. people.html#ratna-dutta)
    if (location.hash){
      const t = document.getElementById(decodeURIComponent(location.hash.slice(1)));
      if (t) setTimeout(() => t.scrollIntoView({block: 'start'}), 50);
    }
  }

  /* ---------- profile.html ---------- */

  // values can be plain strings or objects; these turn either into display text
  const str = v => v == null ? '' : String(v);
  const join = (...parts) => parts.filter(x => str(x).trim()).join(', ');
  const years = (a, b) => (a || b) ? esc(str(a)) + (b ? ' – ' + esc(str(b)) : (a ? ' – present' : '')) : '';
  const link = (url, text) => url ? '<a href="' + esc(url) + '" target="_blank" rel="noopener noreferrer">' + text + '</a>' : text;
  const arr = v => Array.isArray(v) ? v.filter(x => x !== '' && x != null) : (v ? [v] : []);
  const TBA = '<p class="profile-empty">To be added.</p>';

  function block(title, inner, opts){
    opts = opts || {};
    if (!inner && opts.hideEmpty) return '';
    return '<div class="profile-block"' + (opts.id ? ' id="' + opts.id + '"' : '') + '>' +
             '<h3>' + esc(title) + (opts.count ? '<span class="block-count">' + opts.count + '</span>' : '') + '</h3>' +
             (inner || TBA) +
           '</div>';
  }
  function ul(items, fmt){
    items = arr(items);
    if (!items.length) return '';
    return '<ul class="profile-list">' + items.map(i => '<li>' + (typeof i === 'string' ? esc(i) : fmt(i)) + '</li>').join('') + '</ul>';
  }
  function paras(text){
    if (!text) return '';
    return '<div class="prose">' + String(text).split(/\n\s*\n/).map(t => '<p>' + esc(t) + '</p>').join('') + '</div>';
  }
  function table(rows, head){
    if (!rows.length) return '';
    return '<div class="table-wrap"><table class="profile-table"><thead><tr>' + head.map(h => '<th>' + esc(h) + '</th>').join('') +
           '</tr></thead><tbody>' + rows.map(r => '<tr>' + r.map(c => '<td>' + c + '</td>').join('') + '</tr>').join('') + '</tbody></table></div>';
  }

  const PUB_TYPES = {journal: 'Journal articles', conference: 'Conference papers', book: 'Books', chapter: 'Book chapters', preprint: 'Preprints', other: 'Other'};

  function pubHTML(x){
    if (typeof x === 'string') return esc(x);
    const title = x.url || x.doi ? link(x.url || ('https://doi.org/' + x.doi), esc(x.title)) : esc(x.title);
    const where = join(x.venue && '<em>' + esc(x.venue) + '</em>', x.volume && esc('Vol. ' + x.volume), x.pages && esc('pp. ' + x.pages));
    return '<span class="pub-authors">' + esc(x.authors) + '</span>' +
           (x.title ? (x.authors ? ', ' : '') + '<span class="pub-title">“' + title + '”</span>' : '') +
           (where ? ', ' + where : '') + (x.year ? ' (' + esc(x.year) + ')' : '') + '.' +
           (x.doi ? ' <a class="pub-doi" href="https://doi.org/' + esc(x.doi) + '" target="_blank" rel="noopener noreferrer">DOI</a>' : '');
  }

  function publicationsTab(p){
    const pubs = arr(p.publications).map(x => typeof x === 'string' ? {raw: x, type: 'other', year: (x.match(/(19|20)\d{2}/) || [''])[0]} : x);
    if (!pubs.length) return block('Publications', '') + scholarLinks(p);
    const typesPresent = Object.keys(PUB_TYPES).filter(t => pubs.some(x => (x.type || 'other') === t));
    const counts = typesPresent.map(t => '<button type="button" class="pub-filter" data-type="' + t + '">' + PUB_TYPES[t] +
                   ' <span>' + pubs.filter(x => (x.type || 'other') === t).length + '</span></button>').join('');
    const sorted = pubs.slice().sort((a, b) => str(b.year).localeCompare(str(a.year)));
    let lastYear = null, list = '';
    sorted.forEach(x => {
      const y = str(x.year) || 'Undated';
      if (y !== lastYear){ list += '<li class="pub-year" data-year>' + esc(y) + '</li>'; lastYear = y; }
      list += '<li class="pub-item" data-type="' + esc(x.type || 'other') + '">' + (x.raw ? esc(x.raw) : pubHTML(x)) + '</li>';
    });
    return '<div class="profile-block"><h3>Publications<span class="block-count">' + pubs.length + '</span></h3>' +
             '<div class="pub-tools"><button type="button" class="pub-filter is-on" data-type="all">All <span>' + pubs.length + '</span></button>' + counts +
             '<input type="search" class="pub-search" placeholder="Search title, author, journal…" aria-label="Search publications"></div>' +
             '<ol class="pub-list">' + list + '</ol>' +
           '</div>' + scholarLinks(p);
  }

  function scholarLinks(p){
    const L = p.links || {};
    const items = [
      ['scholar', 'Google Scholar'], ['orcid', 'ORCID'], ['scopus', 'Scopus'], ['mathscinet', 'MathSciNet'],
      ['dblp', 'DBLP'], ['researchgate', 'ResearchGate'], ['arxiv', 'arXiv'], ['linkedin', 'LinkedIn']
    ].filter(([k]) => L[k]);
    if (!items.length) return '';
    return block('Research profiles', '<div class="pill-row">' + items.map(([k, n]) => '<a class="pill" href="' + esc(L[k]) + '" target="_blank" rel="noopener noreferrer">' + n + ' ↗</a>').join('') + '</div>');
  }

  function renderProfile(){
    const head = document.getElementById('profileHead');
    const body = document.getElementById('profileBody');
    if (!head || !body) return;

    const id = new URLSearchParams(location.search).get('id');
    const p = id && findPerson(id);
    if (!p){
      head.innerHTML = '<div class="eyebrow">Department of Mathematics</div><h2>Profile not found.</h2><p>This profile may have moved. Please browse the people directory.</p>';
      body.innerHTML = '<a class="link-arrow" href="people.html">← Back to people directory</a>';
      return;
    }

    document.title = p.name + ' | Department of Mathematics | IIT Kharagpur';
    document.getElementById('profileCrumb').textContent = p.name;
    const isFaculty = ['faculty', 'adjunct'].includes(p.type);
    const t = titleOf(p);

    /* ----- header ----- */
    let badge = '';
    if (p.status === 'former') badge = '<span class="profile-badge">Former faculty</span>';
    if (p.status === 'alumni') badge = '<span class="profile-badge">Alumni' + (p.year ? ' · ' + esc(p.year) : '') + '</span>';
    const resp = arr(p.responsibilities);
    const quick = [];
    if (p.email) quick.push('<a href="mailto:' + esc(p.email) + '">✉ ' + esc(p.email) + '</a>');
    if (p.phone) quick.push('<span>☎ ' + esc(p.phone) + '</span>');
    if (p.office) quick.push('<span>⌂ ' + esc(p.office) + '</span>');

    head.innerHTML =
      '<div class="profile-head-grid">' +
        photoHTML(p, 'profile-photo') +
        '<div>' +
          '<div class="eyebrow">' + esc(TYPE_LABELS[p.type] || 'People') + '</div>' +
          '<h2>' + esc(p.name) + '</h2>' +
          (p.head && p.status === 'current' ? '<p class="profile-role">Head of the Department</p>' : '') +
          (t ? '<p class="profile-title">' + esc(t) + ', Department of Mathematics</p>' : '') +
          (resp.length ? '<p class="profile-resp">' + resp.map(esc).join(' · ') + '</p>' : '') +
          badge +
          (p.now ? '<p class="profile-now">Now: ' + esc(p.now) + '</p>' : '') +
          (quick.length ? '<div class="profile-quick">' + quick.join('') + '</div>' : '') +
        '</div>' +
      '</div>';

    /* ----- side card ----- */
    const rows = [];
    if (p.email) rows.push('<li><span>Email</span><a href="mailto:' + esc(p.email) + '">' + esc(p.email) + '</a></li>');
    if (p.phone) rows.push('<li><span>Phone</span>' + esc(p.phone) + '</li>');
    if (p.office) rows.push('<li><span>Office</span>' + esc(p.office) + '</li>');
    if (p.office_hours) rows.push('<li><span>Office hours</span>' + esc(p.office_hours) + '</li>');
    if (p.website) rows.push('<li><span>Website</span>' + link(p.website, 'Personal page ↗') + '</li>');
    if (p.profile) rows.push('<li><span>Institute</span>' + link(p.profile, 'IIT KGP profile ↗') + '</li>');
    const sup = p.supervisor && findPerson(p.supervisor);
    if (sup) rows.push('<li><span>' + (p.type === 'postdoc' ? 'Mentor' : 'Supervisor') + '</span><a href="' + profileUrl(sup) + '">' + esc(sup.name) + '</a></li>');
    if (p.cosupervisor) rows.push('<li><span>Co-supervisor</span>' + esc(p.cosupervisor) + '</li>');
    if (p.topic && !(p.areas || []).length) rows.push('<li><span>Research topic</span>' + esc(p.topic) + '</li>');
    if (p.year && p.status === 'current') rows.push('<li><span>Joined</span>' + esc(p.year) + '</li>');
    const side =
      '<aside class="profile-side">' +
        '<div class="surface"><h3>Contact &amp; links</h3>' +
          (rows.length ? '<ul class="profile-contact">' + rows.join('') + '</ul>' : '<p class="muted">Contact details to be added.</p>') +
          (p.cv ? '<a class="btn btn-maroon cv-btn" href="' + esc(p.cv) + '" target="_blank" rel="noopener noreferrer">⬇ Download CV</a>' : '') +
        '</div>' +
        (areaPills(p) ? '<div class="surface"><h3>Research areas</h3><div class="pill-row">' + areaPills(p) + '</div></div>' : '') +
      '</aside>';

    /* ----- tab contents ----- */
    const edu = ul(p.education, x => '<strong>' + esc(x.degree) + '</strong>' + (x.subject ? ' in ' + esc(x.subject) : '') +
                     (x.institution ? ', ' + esc(x.institution) : '') + (x.year ? ' (' + esc(x.year) + ')' : '') +
                     (x.thesis ? '<span class="sub">Thesis: ' + esc(x.thesis) + '</span>' : ''));
    const exp = ul(p.experience, x => '<strong>' + esc(x.position) + '</strong>' + (x.organisation ? ', ' + esc(x.organisation) : '') +
                     (x.from || x.to ? ' <span class="muted">(' + years(x.from, x.to) + ')</span>' : ''));
    const awards = ul(p.awards, x => '<strong>' + esc(x.title) + '</strong>' + (x.body ? ', ' + esc(x.body) : '') + (x.year ? ' (' + esc(x.year) + ')' : ''));
    const memberships = ul(p.memberships, x => esc(x.name || x.title) + (x.role ? ' – ' + esc(x.role) : ''));

    const projRows = arr(p.projects).map(x => typeof x === 'string' ? [esc(x), '', '', '', ''] :
      ['<strong>' + esc(x.title) + '</strong>', esc(x.agency), esc(x.role), years(x.from, x.to), esc(x.amount || '')]);
    const ongoing = arr(p.projects).filter(x => typeof x !== 'string' && x.status !== 'completed');
    const completed = arr(p.projects).filter(x => typeof x !== 'string' && x.status === 'completed');
    const projTable = list => table(list.map(x => ['<strong>' + esc(x.title) + '</strong>', esc(x.agency), esc(x.role), years(x.from, x.to), esc(x.amount || '')]),
                                    ['Project', 'Funding agency', 'Role', 'Duration', 'Amount']);
    const patents = ul(p.patents, x => '<strong>' + esc(x.title) + '</strong>' + (x.number ? ', ' + esc(x.number) : '') + (x.status ? ' – ' + esc(x.status) : '') + (x.year ? ' (' + esc(x.year) + ')' : ''));
    const consultancy = ul(p.consultancy, x => '<strong>' + esc(x.title) + '</strong>' + (x.client ? ', ' + esc(x.client) : '') + (x.from || x.to ? ' (' + years(x.from, x.to) + ')' : ''));

    // students: people in the data file who list this person as supervisor + any extra entries
    const supervised = PEOPLE.filter(x => x.supervisor === p.id);
    const extra = arr(p.students);
    const studentRows = (status, level) => {
      const fromData = supervised.filter(x => (status === 'current' ? x.status === 'current' : x.status === 'alumni') &&
                                              (level === 'postdoc' ? x.type === 'postdoc' : x.type === 'scholar'))
        .map(x => ['<a href="' + profileUrl(x) + '">' + esc(x.name) + '</a>', esc((x.areas || []).map(a => AREAS[a]).filter(Boolean).join(', ') || x.topic || ''), esc(x.year || ''), esc(x.now || '')]);
      const fromExtra = extra.filter(x => (x.status || 'current') === status && (x.level || 'PhD').toLowerCase() === (level === 'postdoc' ? 'postdoc' : 'phd'))
        .map(x => [esc(x.name), esc(x.topic || ''), esc(x.year || ''), esc(x.now || '')]);
      return fromData.concat(fromExtra);
    };
    const masters = extra.filter(x => !['phd', 'postdoc'].includes((x.level || 'PhD').toLowerCase()))
      .map(x => [esc(x.name), esc(x.level), esc(x.topic || ''), esc(x.year || '')]);
    const sCurPhd = studentRows('current', 'phd'), sOldPhd = studentRows('graduated', 'phd').concat(studentRows('alumni', 'phd'));
    const sPd = studentRows('current', 'postdoc').concat(studentRows('graduated', 'postdoc'), studentRows('alumni', 'postdoc'));

    const teachRows = arr(p.teaching).map(x => typeof x === 'string' ? [esc(x), '', '', ''] :
      ['<strong>' + esc(x.code || '') + '</strong>', esc(x.title), esc(x.level || ''), esc(x.semester || '')]);

    const talks = ul(p.talks, x => '<strong>' + esc(x.title) + '</strong>' + (x.event ? ', ' + esc(x.event) : '') + (x.place ? ', ' + esc(x.place) : '') + (x.date ? ' (' + esc(x.date) + ')' : ''));
    const editorial = ul(p.editorial, x => esc(x.role) + (x.journal ? ', <em>' + esc(x.journal) + '</em>' : '') + (x.from || x.to ? ' (' + years(x.from, x.to) + ')' : ''));
    const organised = ul(p.events, x => '<strong>' + esc(x.title) + '</strong>' + (x.role ? ' – ' + esc(x.role) : '') + (x.date ? ' (' + esc(x.date) + ')' : ''));
    const visits = ul(p.visits, x => esc(x.institution) + (x.place ? ', ' + esc(x.place) : '') + (x.date ? ' (' + esc(x.date) + ')' : ''));
    const admin = ul(p.admin, x => esc(x.role) + (x.from || x.to ? ' <span class="muted">(' + years(x.from, x.to) + ')</span>' : ''));
    const collab = ul(p.collaborators, x => esc(x.name) + (x.institution ? ', ' + esc(x.institution) : ''));

    const isStudent = ['scholar', 'postdoc'].includes(p.type);
    const tabs = [
      {id: 'overview', label: 'Overview', html:
        block('About', paras(p.bio)) +
        block('Research interests', paras(p.interests)) +
        block('Education', edu) +
        block('Professional experience', exp, {hideEmpty: isStudent}) +
        block('Awards & honours', awards) +
        block('Professional memberships', memberships, {hideEmpty: isStudent})},
      {id: 'publications', label: 'Publications', html: publicationsTab(p)},
      {id: 'projects', label: 'Research & Projects', html:
        block('Ongoing sponsored projects', projTable(ongoing)) +
        block('Completed sponsored projects', projTable(completed), {hideEmpty: !completed.length && !ongoing.length ? false : false}) +
        block('Consultancy', consultancy, {hideEmpty: isStudent}) +
        block('Patents', patents, {hideEmpty: true}) +
        block('Collaborators', collab, {hideEmpty: true})},
      {id: 'students', label: 'Students', hide: !isFaculty, html:
        block('Current Ph.D. scholars', table(sCurPhd, ['Name', 'Research area', 'Joined', '']), {count: sCurPhd.length || ''}) +
        block('Ph.D. graduated', table(sOldPhd, ['Name', 'Thesis / area', 'Year', 'Current position']), {count: sOldPhd.length || ''}) +
        block('Postdoctoral fellows', table(sPd, ['Name', 'Research area', 'Year', 'Current position']), {count: sPd.length || ''}) +
        block('Master’s & BS-MS projects', table(masters, ['Name', 'Programme', 'Project', 'Year']), {count: masters.length || ''})},
      {id: 'teaching', label: 'Teaching', hide: !isFaculty, html:
        block('Courses taught', table(teachRows, ['Code', 'Course', 'Level', 'Semester'])) +
        block('Teaching material & notes', ul(p.materials, x => link(x.url, esc(x.title))), {hideEmpty: true})},
      {id: 'activities', label: 'Activities', html:
        block('Administrative responsibilities', admin || ul(resp, x => esc(x))) +
        block('Invited talks', talks) +
        block('Editorial & review work', editorial) +
        block('Conferences & workshops organised', organised) +
        block('Academic visits', visits, {hideEmpty: true})}
    ].filter(tb => !tb.hide);

    body.innerHTML =
      '<div class="profile-tabs" role="tablist" aria-label="Profile sections">' +
        tabs.map(tb => '<a class="profile-tab" role="tab" href="#' + tb.id + '" data-tab="' + tb.id + '" aria-controls="tab-' + tb.id + '">' + esc(tb.label) + '</a>').join('') +
      '</div>' +
      '<div class="profile-layout">' +
        '<div class="profile-main">' +
          tabs.map(tb => '<section class="profile-panel" role="tabpanel" id="tab-' + tb.id + '" data-panel="' + tb.id + '">' + tb.html + '</section>').join('') +
          '<p class="profile-back"><a class="link-arrow" href="people.html#' + esc(p.id) + '">← Back to people directory</a>' +
          (p.updated ? '<span class="muted">Last updated: ' + esc(p.updated) + '</span>' : '') + '</p>' +
        '</div>' + side +
      '</div>';

    /* ----- tab switching (remembers the tab in the address, e.g. #publications) ----- */
    const showTab = name => {
      if (!tabs.some(tb => tb.id === name)) name = tabs[0].id;
      body.querySelectorAll('.profile-tab').forEach(a => {
        const on = a.dataset.tab === name;
        a.classList.toggle('is-active', on); a.setAttribute('aria-selected', String(on));
      });
      body.querySelectorAll('.profile-panel').forEach(s => { s.hidden = s.dataset.panel !== name; });
    };
    body.querySelectorAll('.profile-tab').forEach(a => a.addEventListener('click', e => {
      e.preventDefault(); history.replaceState(null, '', location.search + '#' + a.dataset.tab); showTab(a.dataset.tab);
    }));
    showTab(location.hash.slice(1));

    /* ----- publication filter + search ----- */
    const tools = body.querySelector('.pub-tools');
    if (tools){
      let type = 'all';
      const search = tools.querySelector('.pub-search');
      const apply = () => {
        const q = search.value.trim().toLowerCase();
        const items = [...body.querySelectorAll('.pub-list li')];
        let headerEl = null, visibleInYear = 0;
        const closeYear = () => { if (headerEl) headerEl.hidden = visibleInYear === 0; };
        items.forEach(li => {
          if (li.hasAttribute('data-year')){ closeYear(); headerEl = li; visibleInYear = 0; return; }
          const ok = (type === 'all' || li.dataset.type === type) && (!q || li.textContent.toLowerCase().includes(q));
          li.hidden = !ok; if (ok) visibleInYear++;
        });
        closeYear();
      };
      tools.querySelectorAll('.pub-filter').forEach(b => b.addEventListener('click', () => {
        type = b.dataset.type;
        tools.querySelectorAll('.pub-filter').forEach(x => x.classList.toggle('is-on', x === b));
        apply();
      }));
      search.addEventListener('input', apply);
    }
  }

  renderDirectory();
  renderProfile();
})();
