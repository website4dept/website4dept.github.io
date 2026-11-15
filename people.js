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
  function listSection(title, items){
    if (!items || !items.length) return '';
    return '<div class="profile-block"><h3>' + esc(title) + '</h3><ul class="profile-list">' +
           items.map(i => '<li>' + esc(i) + '</li>').join('') + '</ul></div>';
  }
  function textSection(title, text){
    if (!text) return '';
    const paras = String(text).split(/\n\s*\n/).map(t => '<p>' + esc(t) + '</p>').join('');
    return '<div class="profile-block"><h3>' + esc(title) + '</h3><div class="prose">' + paras + '</div></div>';
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

    const t = titleOf(p);
    let badge = '';
    if (p.status === 'former') badge = '<span class="profile-badge">Former faculty</span>';
    if (p.status === 'alumni') badge = '<span class="profile-badge">Alumni' + (p.year ? ' · ' + esc(p.year) : '') + '</span>';

    head.innerHTML =
      '<div class="profile-head-grid">' +
        photoHTML(p, 'profile-photo') +
        '<div>' +
          '<div class="eyebrow">' + esc(TYPE_LABELS[p.type] || 'People') + '</div>' +
          '<h2>' + esc(p.name) + '</h2>' +
          (p.head && p.status === 'current' ? '<p class="profile-role">Head of the Department</p>' : '') +
          (t ? '<p class="profile-title">' + esc(t) + '</p>' : '') +
          badge +
          (p.now ? '<p class="profile-now">Now: ' + esc(p.now) + '</p>' : '') +
        '</div>' +
      '</div>';

    // contact card
    const rows = [];
    if (p.email) rows.push('<li><span>Email</span><a href="mailto:' + esc(p.email) + '">' + esc(p.email) + '</a></li>');
    if (p.phone) rows.push('<li><span>Phone</span>' + esc(p.phone) + '</li>');
    if (p.office) rows.push('<li><span>Office</span>' + esc(p.office) + '</li>');
    if (p.website) rows.push('<li><span>Website</span><a href="' + esc(p.website) + '" target="_blank" rel="noopener noreferrer">Personal page ↗</a></li>');
    if (p.profile) rows.push('<li><span>Institute</span><a href="' + esc(p.profile) + '" target="_blank" rel="noopener noreferrer">IIT KGP profile ↗</a></li>');
    if (p.cv) rows.push('<li><span>CV</span><a href="' + esc(p.cv) + '" target="_blank" rel="noopener noreferrer">Download CV ↗</a></li>');
    const sup = p.supervisor && findPerson(p.supervisor);
    if (sup) rows.push('<li><span>' + (p.type === 'postdoc' ? 'Mentor' : 'Supervisor') + '</span><a href="' + profileUrl(sup) + '">' + esc(sup.name) + '</a></li>');
    if (p.year && p.status === 'current') rows.push('<li><span>Joined</span>' + esc(p.year) + '</li>');

    // students and postdocs supervised by this person
    const supervised = PEOPLE.filter(x => x.supervisor === p.id);
    const curStudents = supervised.filter(x => x.status === 'current').sort(byName);
    const pastStudents = supervised.filter(x => x.status === 'alumni').sort(byName);
    const peopleList = (title, list) => list.length ?
      '<div class="profile-block"><h3>' + esc(title) + '</h3><ul class="profile-list">' +
      list.map(x => '<li><a href="' + profileUrl(x) + '">' + esc(x.name) + '</a> <span class="muted">· ' + esc(titleOf(x)) + (x.year ? ', ' + esc(x.year) : '') + '</span></li>').join('') +
      '</ul></div>' : '';

    const pills = areaPills(p);
    const main =
      (pills ? '<div class="profile-block"><h3>Research areas</h3><div class="pill-row">' + pills + '</div></div>' : '') +
      textSection('About', p.bio) +
      textSection('Research interests', p.interests) +
      listSection('Education', p.education) +
      listSection('Selected publications', p.publications) +
      peopleList('Current students & postdocs', curStudents) +
      peopleList('Former students & postdocs', pastStudents);

    const empty = !main && !rows.length;

    body.innerHTML =
      '<div class="profile-layout">' +
        '<div class="profile-main">' +
          (main || '') +
          (empty || (!p.bio && !p.publications?.length) ?
            '<div class="notice-box"><strong>Profile being updated.</strong> Biography, publications and CV will be added here.</div>' : '') +
          '<p><a class="link-arrow" href="people.html#' + esc(p.id) + '">← Back to people directory</a></p>' +
        '</div>' +
        '<aside class="surface profile-side"><h3>Contact &amp; links</h3>' +
          (rows.length ? '<ul class="profile-contact">' + rows.join('') + '</ul>'
                       : '<p class="muted">Contact details to be added.</p>') +
        '</aside>' +
      '</div>';
  }

  renderDirectory();
  renderProfile();
})();
