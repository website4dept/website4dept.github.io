/* =====================================================================
   Department portal – login, password set-up, profile editor, admin panel
   Talks to backend/server.py through /api/...
   ===================================================================== */
(function(){
  'use strict';

  /* ------------------------------------------------------------------ */
  /* helpers                                                             */
  /* ------------------------------------------------------------------ */
  const $ = (s, el) => (el || document).querySelector(s);
  const $$ = (s, el) => Array.from((el || document).querySelectorAll(s));
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const page = document.body.dataset.page;
  let CSRF = '';
  let ME = null;

  async function api(method, path, body){
    let res;
    try {
      res = await fetch('../api' + path, {
        method, credentials: 'same-origin',
        headers: Object.assign({'Content-Type': 'application/json'}, CSRF ? {'X-CSRF-Token': CSRF} : {}),
        body: body === undefined ? undefined : JSON.stringify(body)
      });
    } catch (e) {
      throw Object.assign(new Error('Cannot reach the portal server.'), {status: 0});
    }
    let data = null;
    const ct = res.headers.get('content-type') || '';
    if (ct.includes('application/json')) data = await res.json();
    if (!res.ok){
      const msg = data && data.error ? data.error :
        (res.status === 404 || res.status === 405 ? 'The portal server is not running on this copy of the website.' : 'Request failed (' + res.status + ').');
      throw Object.assign(new Error(msg), {status: res.status});
    }
    return data;
  }

  function alertBox(msg, kind){
    const el = $('#alert');
    if (!el) return;
    if (!msg){ el.hidden = true; return; }
    el.className = 'portal-alert' + (kind ? ' ' + kind : '');
    el.innerHTML = msg;
    el.hidden = false;
    if (page === 'dashboard') window.scrollTo({top: 0, behavior: 'smooth'});
  }

  let toastTimer;
  function toast(msg, err){
    const t = $('#toast');
    if (!t) return alert(msg);
    t.textContent = msg;
    t.className = 'toast' + (err ? ' err' : '');
    t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { t.hidden = true; }, 3500);
  }

  function busy(btn, on, label){
    if (!btn) return;
    if (on){ btn.dataset.label = btn.innerHTML; btn.disabled = true; btn.innerHTML = label || 'Please wait…'; }
    else { btn.disabled = false; if (btn.dataset.label) btn.innerHTML = btn.dataset.label; }
  }

  function bindPasswordToggles(){
    $$('.pw-toggle').forEach(b => b.addEventListener('click', () => {
      const i = b.previousElementSibling;
      i.type = i.type === 'password' ? 'text' : 'password';
      b.textContent = i.type === 'password' ? 'Show' : 'Hide';
    }));
  }

  const fmtDate = s => {
    if (!s) return '—';
    const d = new Date(s);
    return isNaN(d) ? esc(s) : d.toLocaleString(undefined, {day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'});
  };

  async function serverCheck(){
    try { await api('GET', '/status'); return true; }
    catch (e) {
      alertBox('<strong>The staff portal is not active on this demo website yet.</strong> It will be switched on when the website moves to the department server. ' +
               'Until then, notices and people details are updated directly in the site files.', 'info');
      $$('form').forEach(f => f.hidden = true);
      return false;
    }
  }

  /* ------------------------------------------------------------------ */
  /* LOGIN                                                               */
  /* ------------------------------------------------------------------ */
  async function initLogin(){
    bindPasswordToggles();
    if (!await serverCheck()) return;
    try { await api('GET', '/auth/me'); location.replace('index.html'); return; } catch (e) {}
    const msg = new URLSearchParams(location.search).get('msg');
    if (msg === 'loggedout') alertBox('You have been logged out.', 'ok');
    if (msg === 'expired') alertBox('Your session has ended. Please log in again.', 'info');

    let ticket = '';
    const loginForm = $('#loginForm'), otpForm = $('#otpForm');
    const showOtp = data => {
      ticket = data.ticket;
      $('#otpTo').textContent = data.sent_to || 'your e-mail';
      $('#otpMins').textContent = data.minutes || 10;
      loginForm.hidden = true; otpForm.hidden = false;
      otpForm.code.value = ''; otpForm.code.focus();
      cooldown();
    };
    let cd;
    const cooldown = () => {
      const b = $('#resendBtn'); let s = 30;
      b.disabled = true; clearInterval(cd);
      b.textContent = 'Send a new code (' + s + 's)';
      cd = setInterval(() => { s--; b.textContent = s > 0 ? 'Send a new code (' + s + 's)' : 'Send a new code'; if (s <= 0){ clearInterval(cd); b.disabled = false; } }, 1000);
    };

    loginForm.addEventListener('submit', async e => {
      e.preventDefault(); alertBox('');
      const btn = loginForm.querySelector('button[type=submit]');
      if (!loginForm.email.value || !loginForm.password.value){ alertBox('Enter your e-mail and password.'); return; }
      busy(btn, true, 'Checking…');
      try {
        const d = await api('POST', '/auth/login', {email: loginForm.email.value, password: loginForm.password.value});
        loginForm.password.value = '';
        showOtp(d);
        alertBox('Code sent. Check your inbox (and spam folder).', 'ok');
      } catch (err) { alertBox(esc(err.message)); }
      busy(btn, false);
    });

    otpForm.code.addEventListener('input', () => {
      otpForm.code.value = otpForm.code.value.replace(/\D/g, '').slice(0, 6);
      if (otpForm.code.value.length === 6) otpForm.requestSubmit();
    });
    otpForm.addEventListener('submit', async e => {
      e.preventDefault();
      const btn = otpForm.querySelector('button[type=submit]');
      if (otpForm.code.value.length !== 6){ alertBox('Enter the 6-digit code.'); return; }
      busy(btn, true, 'Verifying…');
      try {
        await api('POST', '/auth/verify', {ticket, code: otpForm.code.value});
        location.replace('index.html');
        return;
      } catch (err) {
        alertBox(esc(err.message));
        if (/expired|log in again/i.test(err.message)){ otpForm.hidden = true; loginForm.hidden = false; }
        otpForm.code.value = '';
      }
      busy(btn, false);
    });
    $('#resendBtn').addEventListener('click', async () => {
      try { const d = await api('POST', '/auth/resend', {ticket}); showOtp(d); alertBox('A new code has been sent.', 'ok'); }
      catch (err) { alertBox(esc(err.message)); }
    });
    $('#restartBtn').addEventListener('click', () => { otpForm.hidden = true; loginForm.hidden = false; alertBox(''); loginForm.email.focus(); });
  }

  /* ------------------------------------------------------------------ */
  /* SET PASSWORD (invite / reset)                                       */
  /* ------------------------------------------------------------------ */
  function pwRules(form){
    const upd = () => {
      const p = form.password.value, c = form.confirm.value;
      const set = (r, ok) => { const li = $('[data-rule="' + r + '"]', form); if (li) li.classList.toggle('ok', ok); };
      set('len', p.length >= 10); set('mix', /[A-Za-z]/.test(p) && /\d/.test(p)); set('match', !!p && p === c);
    };
    form.password.addEventListener('input', upd); form.confirm.addEventListener('input', upd);
  }

  async function initSetPassword(){
    bindPasswordToggles();
    if (!await serverCheck()) return;
    const params = new URLSearchParams(location.search);
    const token = params.get('token');
    if (params.get('reset')){ $('#spEyebrow').textContent = 'Password reset'; $('#spTitle').textContent = 'Choose a new password'; }
    if (!token){ alertBox('This page needs the link from your e-mail.'); return; }
    try {
      const d = await api('POST', '/auth/check-token', {token});
      $('#spEmail').textContent = d.email;
      $('#setForm').hidden = false;
    } catch (err) { alertBox(esc(err.message) + ' <a href="forgot.html">Request a new link</a>.'); return; }
    const f = $('#setForm'); pwRules(f);
    f.addEventListener('submit', async e => {
      e.preventDefault(); alertBox('');
      if (f.password.value !== f.confirm.value){ alertBox('The two passwords do not match.'); return; }
      const btn = f.querySelector('button[type=submit]'); busy(btn, true, 'Saving…');
      try {
        await api('POST', '/auth/set-password', {token, password: f.password.value});
        f.hidden = true; $('#spDone').hidden = false;
        history.replaceState(null, '', location.pathname);
      } catch (err) { alertBox(esc(err.message)); }
      busy(btn, false);
    });
  }

  /* ------------------------------------------------------------------ */
  /* FORGOT PASSWORD                                                     */
  /* ------------------------------------------------------------------ */
  async function initForgot(){
    if (!await serverCheck()) return;
    const f = $('#forgotForm');
    f.addEventListener('submit', async e => {
      e.preventDefault();
      const btn = f.querySelector('button[type=submit]'); busy(btn, true, 'Sending…');
      try { const d = await api('POST', '/auth/forgot', {email: f.email.value}); alertBox(esc(d.message), 'ok'); f.email.value = ''; }
      catch (err) { alertBox(esc(err.message)); }
      busy(btn, false);
    });
  }

  /* ------------------------------------------------------------------ */
  /* DASHBOARD                                                           */
  /* ------------------------------------------------------------------ */
  const ROLE_LABEL = {admin: 'Admin', member: 'Member', notices: 'Content editor', people: 'People editor'};
  const VIEWS = {};
  let dirty = false;
  window.addEventListener('beforeunload', e => { if (dirty){ e.preventDefault(); e.returnValue = ''; } });

  async function initDashboard(){
    try {
      const d = await api('GET', '/auth/me');
      ME = d.user; CSRF = d.csrf;
    } catch (e) {
      if (e.status === 0 || e.status === 404 || e.status === 405){ $('#view').innerHTML = ''; await serverCheck(); return; }
      location.replace('login.html?msg=expired'); return;
    }
    $('#portalHeaderRight').innerHTML =
      '<span class="portal-user"><span>Signed in as <strong>' + esc(ME.name || ME.email) + '</strong></span>' +
      '<span class="role-chip' + (ME.role === 'admin' ? ' admin' : '') + '">' + (ROLE_LABEL[ME.role] || 'Member') + '</span></span>' +
      '<a class="portal-back" href="../index.html" target="_blank" rel="noopener">View website ↗</a>' +
      '<button type="button" class="btn btn-light btn-sm" id="logoutBtn">Log out</button>';
    $('#logoutBtn').addEventListener('click', async () => {
      if (dirty && !confirm('You have unsaved changes. Log out anyway?')) return;
      dirty = false;
      try { await api('POST', '/auth/logout'); } catch (e) {}
      location.replace('login.html?msg=loggedout');
    });

    if (ME.must_change){ buildNav([]); return VIEWS.password(true); }

    const items = [];
    if (ME.person_id && ME.can_edit_profile) items.push(['My account'], ['profile', '✎', 'Edit my profile']);
    else items.push(['My account']);
    items.push(['password', '🔑', 'Change password'], ['security', '🛡', 'Devices & security']);
    if (ME.role === 'admin'){
      items.push(['Administration'], ['overview', '◧', 'Overview'], ['accounts', '👤', 'Accounts'], ['people', '☷', 'People & profiles'], ['scholars', '🎓', 'Research scholars'], ['students', '🧑‍🎓', 'Students'],
                 ['import', '⇪', 'Import data (JSON)'], ['notices', '📌', 'Notices & events'], ['gallery', '🖼', 'Gallery'], ['email', '✉', 'Send e-mail'], ['lists', '☰', 'Mailing lists'],
                 ['activity', '⟲', 'Activity log'], ['export', '⬇', 'Export for website'], ['backup', '🗄', 'Backup & restore']);
    } else if (ME.role === 'notices'){
      items.push(['Content editor'], ['notices', '📌', 'Notices & events'], ['gallery', '🖼', 'Gallery']);
    } else if (ME.role === 'people'){
      items.push(['People editor'], ['people', '☷', 'People & profiles'], ['scholars', '🎓', 'Research scholars'], ['students', '🧑‍🎓', 'Students']);
    }
    buildNav(items);
    window.addEventListener('hashchange', route);
    route();
  }

  function buildNav(items){
    $('#portalNav').innerHTML = items.map(it => it.length === 1 ? '<h4>' + esc(it[0]) + '</h4>' :
      '<a href="#' + it[0] + '" data-view="' + it[0] + '"><span class="nav-ico" aria-hidden="true">' + it[1] + '</span>' + esc(it[2]) + '</a>').join('');
  }

  function route(){
    const raw = location.hash.slice(1) || (ME.role === 'admin' ? 'overview' : ME.role === 'notices' ? 'notices' : ME.role === 'people' ? 'people' : (ME.person_id && ME.can_edit_profile ? 'profile' : 'password'));
    const [name, arg] = raw.split('/');
    if (dirty && !confirm('You have unsaved changes. Leave without saving?')){
      history.replaceState(null, '', '#' + (route.last || ''));
      return;
    }
    dirty = false; removeSaveBar();
    route.last = raw;
    $$('#portalNav a').forEach(a => a.classList.toggle('is-active', a.dataset.view === name || (name === 'person' && a.dataset.view === 'people')));
    alertBox('');
    const fn = VIEWS[name];
    if (!fn){ $('#view').innerHTML = '<p>Page not found.</p>'; return; }
    $('#view').innerHTML = '<p class="muted">Loading…</p>';
    Promise.resolve(fn(arg)).catch(err => {
      if (err.status === 401){ location.replace('login.html?msg=expired'); return; }
      $('#view').innerHTML = '';
      alertBox(esc(err.message));
    });
  }

  // replace #view with a clean copy so event listeners from the previous view don't pile up
  function freshView(){ const v = $('#view'); const n = v.cloneNode(false); v.replaceWith(n); return n; }

  const head = (title, sub, actions) =>
    '<div class="view-head"><div><div class="eyebrow">Department portal</div><h2>' + esc(title) + '</h2>' +
    (sub ? '<p>' + sub + '</p>' : '') + '</div>' + (actions ? '<div class="view-actions">' + actions + '</div>' : '') + '</div>';

  /* ---------------- change password ---------------- */
  VIEWS.password = function(forced){
    $('#view').innerHTML = head(forced === true ? 'Choose a new password' : 'Change password',
      forced === true ? 'You logged in with a temporary password. Please choose your own password to continue.' : 'Use at least 10 characters with letters and numbers.') +
      '<div class="card" style="max-width:520px"><form class="pform" id="pwForm" novalidate>' +
      '<label>Current password<input type="password" name="current" autocomplete="current-password" required></label>' +
      '<label>New password<input type="password" name="password" autocomplete="new-password" required></label>' +
      '<ul class="pw-rules"><li data-rule="len">At least 10 characters</li><li data-rule="mix">Letters and numbers</li><li data-rule="match">Both entries match</li></ul>' +
      '<label>Repeat new password<input type="password" name="confirm" autocomplete="new-password" required></label>' +
      '<div><button class="btn btn-maroon" type="submit">Save new password</button></div></form></div>';
    const f = $('#pwForm'); pwRules(f);
    f.addEventListener('submit', async e => {
      e.preventDefault();
      if (f.password.value !== f.confirm.value){ alertBox('The two new passwords do not match.'); return; }
      const btn = f.querySelector('button'); busy(btn, true, 'Saving…');
      try {
        await api('POST', '/auth/change-password', {current: f.current.value, new: f.password.value});
        if (forced === true){ location.reload(); return; }
        f.reset(); alertBox('Password changed. Other devices have been logged out.', 'ok');
      } catch (err) { alertBox(esc(err.message)); }
      busy(btn, false);
    });
  };

  /* ------------------------------------------------------------------ */
  /* PROFILE EDITOR (members edit their own; admin edits anyone)         */
  /* ------------------------------------------------------------------ */
  const L = (k, label, type, extra) => Object.assign({k, label, type: type || 'text'}, extra || {});
  const opts = arr => arr.map(x => Array.isArray(x) ? x : [x, x]);

  const LISTS = [
    {k: 'education', title: 'Education', add: 'Add degree', fields: [L('degree', 'Degree (e.g. Ph.D.)'), L('subject', 'Subject'), L('institution', 'Institution'), L('year', 'Year'), L('thesis', 'Thesis title', 'text', {full: 1})]},
    {k: 'experience', title: 'Professional experience', add: 'Add position', fields: [L('position', 'Position'), L('organisation', 'Organisation'), L('from', 'From (year)'), L('to', 'To (blank = present)')]},
    {k: 'awards', title: 'Awards & honours', add: 'Add award', fields: [L('title', 'Award / honour'), L('body', 'Awarding body'), L('year', 'Year')]},
    {k: 'memberships', title: 'Professional memberships', add: 'Add membership', fields: [L('name', 'Society / body'), L('role', 'Membership type / role')]},
    {k: 'publications', title: 'Publications', add: 'Add publication', fields: [
      L('type', 'Type', 'select', {options: opts([['journal', 'Journal article'], ['conference', 'Conference paper'], ['book', 'Book'], ['chapter', 'Book chapter'], ['preprint', 'Preprint'], ['other', 'Other']])}),
      L('year', 'Year'), L('authors', 'Authors', 'text', {full: 1}), L('title', 'Title', 'text', {full: 1}), L('venue', 'Journal / conference / publisher', 'text', {full: 1}),
      L('volume', 'Volume (issue)'), L('pages', 'Pages'), L('doi', 'DOI (e.g. 10.1016/…)'), L('url', 'Link (if no DOI)')]},
    {k: 'projects', title: 'Sponsored projects', add: 'Add project', fields: [
      L('title', 'Project title', 'text', {full: 1}), L('agency', 'Funding agency'), L('role', 'Role', 'select', {options: opts(['PI', 'Co-PI', 'Investigator', 'Mentor'])}),
      L('from', 'From (year)'), L('to', 'To (year)'), L('amount', 'Amount (optional)'), L('status', 'Status', 'select', {options: opts([['ongoing', 'Ongoing'], ['completed', 'Completed']])})]},
    {k: 'consultancy', title: 'Consultancy', add: 'Add consultancy', facultyOnly: 1, fields: [L('title', 'Title', 'text', {full: 1}), L('client', 'Client / organisation'), L('from', 'From'), L('to', 'To')]},
    {k: 'patents', title: 'Patents', add: 'Add patent', facultyOnly: 1, fields: [L('title', 'Title', 'text', {full: 1}), L('number', 'Number'), L('status', 'Status (filed / granted)'), L('year', 'Year')]},
    {k: 'collaborators', title: 'Collaborators', add: 'Add collaborator', fields: [L('name', 'Name'), L('institution', 'Institution')]},
    {k: 'students', title: 'Students supervised', add: 'Add student', facultyOnly: 1,
      note: 'Scholars and postdocs who have their own profile on the website appear automatically – add others here (including graduated Ph.D.s and Master’s / BS-MS projects).',
      fields: [L('name', 'Name'), L('level', 'Level', 'select', {options: opts([['PhD', 'Ph.D.'], ['Postdoc', 'Postdoc'], ['M.Sc.', 'M.Sc.'], ['M.Tech.', 'M.Tech.'], ['BS-MS', 'BS-MS'], ['B.Tech.', 'B.Tech.']])}),
               L('topic', 'Thesis / project / area', 'text', {full: 1}), L('year', 'Year (joined / completed)'),
               L('status', 'Status', 'select', {options: opts([['current', 'Current'], ['graduated', 'Graduated / completed']])}), L('now', 'Current position (graduated)', 'text', {full: 1})]},
    {k: 'teaching', title: 'Courses taught', add: 'Add course', facultyOnly: 1, fields: [L('code', 'Course code'), L('title', 'Course title'), L('level', 'Level', 'select', {options: opts(['UG', 'PG', 'PhD'])}), L('semester', 'Semester (e.g. Autumn 2025)')]},
    {k: 'materials', title: 'Teaching material & notes', add: 'Add link', facultyOnly: 1, fields: [L('title', 'Title'), L('url', 'Link')]},
    {k: 'admin', title: 'Administrative responsibilities', add: 'Add responsibility', fields: [L('role', 'Responsibility', 'text', {full: 1}), L('from', 'From'), L('to', 'To (blank = present)')]},
    {k: 'talks', title: 'Invited talks', add: 'Add talk', fields: [L('title', 'Talk title', 'text', {full: 1}), L('event', 'Event'), L('place', 'Place'), L('date', 'Date (e.g. Jan 2025)')]},
    {k: 'editorial', title: 'Editorial & review work', add: 'Add entry', fields: [L('role', 'Role (Editor, Reviewer …)'), L('journal', 'Journal / body'), L('from', 'From'), L('to', 'To')]},
    {k: 'events', title: 'Conferences & workshops organised', add: 'Add event', fields: [L('title', 'Event', 'text', {full: 1}), L('role', 'Role (Convener …)'), L('date', 'Date')]},
    {k: 'visits', title: 'Academic visits', add: 'Add visit', fields: [L('institution', 'Institution'), L('place', 'Place'), L('date', 'Date')]},
  ];
  const LINKS = [['scholar', 'Google Scholar'], ['orcid', 'ORCID'], ['scopus', 'Scopus'], ['mathscinet', 'MathSciNet'], ['dblp', 'DBLP'], ['researchgate', 'ResearchGate'], ['arxiv', 'arXiv'], ['linkedin', 'LinkedIn']];

  function input(f, val, prefix){
    const name = (prefix || '') + f.k;
    const v = val == null ? '' : val;
    let ctl;
    if (f.type === 'select'){
      ctl = '<select data-f="' + f.k + '">' + (f.blank ? '<option value=""></option>' : '') +
            f.options.map(([o, t]) => '<option value="' + esc(o) + '"' + (String(v) === String(o) ? ' selected' : '') + '>' + esc(t) + '</option>').join('') + '</select>';
    } else if (f.type === 'textarea'){
      ctl = '<textarea data-f="' + f.k + '" rows="' + (f.rows || 4) + '">' + esc(v) + '</textarea>';
    } else if (f.type === 'checkbox'){
      return '<label class="check' + (f.full ? ' full' : '') + '"><input type="checkbox" data-f="' + f.k + '"' + (v ? ' checked' : '') + '> ' + esc(f.label) + '</label>';
    } else {
      ctl = '<input type="' + (f.type === 'url' ? 'url' : f.type === 'email' ? 'email' : 'text') + '" data-f="' + f.k + '" value="' + esc(v) + '"' + (f.ph ? ' placeholder="' + esc(f.ph) + '"' : '') + '>';
    }
    return '<label class="' + (f.full ? 'full' : '') + '">' + esc(f.label) + (f.note ? ' <span class="field-note">' + esc(f.note) + '</span>' : '') + ctl + '</label>';
  }

  function listItemHTML(def, item){
    item = typeof item === 'string' ? {[def.fields.find(x => x.full) ? def.fields.find(x => x.full).k : def.fields[0].k]: item} : (item || {});
    return '<div class="list-item"><div class="item-tools"><button type="button" data-act="up" title="Move up">↑</button>' +
           '<button type="button" data-act="down" title="Move down">↓</button><button type="button" data-act="del" title="Remove">✕</button></div>' +
           '<div class="pgrid">' + def.fields.map(f => input(f, item[f.k])).join('') + '</div></div>';
  }

  function section(title, body, opts2){
    opts2 = opts2 || {};
    return '<details class="editor-section' + (opts2.cls ? ' ' + opts2.cls : '') + '"' + (opts2.open ? ' open' : '') + ' data-sec="' + esc(opts2.key || '') + '">' +
           '<summary>' + esc(title) + (opts2.count != null ? '<span class="sec-count">' + opts2.count + '</span>' : '') + '</summary>' +
           '<div class="sec-body">' + body + '</div></details>';
  }

  /**
   * Render the editor.
   *   mode 'self'  -> PUT /me/profile
   *   mode 'admin' -> PUT /admin/people/<id>
   */
  function renderEditor(p, areas, people, mode){
    const isAdmin = mode === 'admin';
    const facultyLike = ['faculty', 'adjunct'].includes(p.type);
    const links = p.links || {};
    let html = '';

    if (isAdmin){
      const desigFaculty = p.type === 'faculty';
      html += section('Administrative details (admin only)',
        '<div class="pgrid pgrid-3">' +
          input(L('type', 'Type', 'select', {options: opts([['faculty', 'Faculty'], ['adjunct', 'Adjunct / INSPIRE'], ['postdoc', 'Postdoctoral fellow'], ['scholar', 'Research scholar'], ['staff', 'Staff']])}), p.type) +
          (desigFaculty ? input(L('designation', 'Designation', 'select', {blank: 1, options: opts([['professor', 'Professor'], ['associate-professor', 'Associate Professor'], ['assistant-professor', 'Assistant Professor']])}), p.designation)
                        : input(L('designation', 'Designation / position', 'text', {ph: 'e.g. NBHM Postdoctoral Fellow'}), p.designation)) +
          input(L('grade', 'Grade (optional)', 'text', {ph: 'Grade-I'}), p.grade) +
          input(L('status', 'Status', 'select', {options: opts([['current', 'Current'], ['former', 'Former (retired / left)'], ['alumni', 'Alumni (completed)'], ['sample', 'Hidden / sample']])}), p.status) +
          input(L('supervisor', 'Supervisor / mentor', 'select', {blank: 1, options: people.filter(x => ['faculty', 'adjunct'].includes(x.type)).map(x => [x.id, x.name])}), p.supervisor) +
          input(L('joined', 'Joined (year) – decides seniority order'), p.joined) +
          input(L('year', 'Year (joined / completed)'), p.year) +
          input(L('now', 'Current position (former / alumni)', 'text', {full: 1}), p.now) +
          input(L('profile', 'Official IIT KGP profile URL', 'url', {full: 1}), p.profile) +
          input(L('head', 'Head of the Department (only one person)', 'checkbox', {full: 1}), p.head) +
        '</div><p class="hint">Changing <b>Status</b> to “Former” or “Alumni” moves the person to the Former Faculty / Alumni section of the website automatically.</p>',
        {cls: 'admin-sec', open: true, key: 'admin'});
    }

    html += section('Basic details', '<div class="pgrid" data-group="basic">' +
      input(L('name', 'Full name'), p.name) + input(L('email', 'Public e-mail', 'email'), p.email) +
      input(L('phone', 'Phone'), p.phone) + input(L('office', 'Office / room'), p.office) +
      input(L('office_hours', 'Office hours'), p.office_hours) + input(L('roll', 'Roll number (scholars)'), p.roll) + input(L('website', 'Personal website', 'url'), p.website) +
      input(L('responsibilities', 'Current roles shown under your name', 'textarea', {full: 1, rows: 2, note: 'one per line'}), (p.responsibilities || []).join('\n')) +
      '</div>', {open: !isAdmin, key: 'basic'});

    const photo = p.photo || ('../photos/' + p.id + '.jpg');
    const initials = (p.name || '?').split(/\s+/).map(w => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();
    html += section('Photo & CV',
      '<div class="file-row"><div class="file-preview" id="photoPrev"><img src="' + esc(p.photo ? '../' + p.photo : photo) + '" alt="" onerror="this.remove()">' +
        '<span>' + esc(initials) + '</span></div><div class="file-actions">' +
        '<p class="hint" style="margin:0">Square photo works best. It is resized automatically before upload (JPG, PNG or WebP).</p>' +
        '<label class="btn btn-light btn-sm">Upload new photo<input type="file" accept="image/jpeg,image/png,image/webp" id="photoFile" hidden></label>' +
        (p.photo ? '<button type="button" class="btn btn-danger btn-sm" data-remove="photo">Remove uploaded photo</button>' : '') +
        '<hr style="width:100%;border:0;border-top:1px solid var(--line);margin:8px 0">' +
        '<p class="hint" style="margin:0">CV: ' + (p.cv ? '<a href="../' + esc(p.cv) + '" target="_blank" rel="noopener">current CV ↗</a>' : 'none uploaded') + ' (PDF, max 5 MB)</p>' +
        '<label class="btn btn-light btn-sm">Upload CV (PDF)<input type="file" accept="application/pdf" id="cvFile" hidden></label>' +
        (p.cv ? '<button type="button" class="btn btn-danger btn-sm" data-remove="cv">Remove CV</button>' : '') +
      '</div></div><p class="hint">Photos and CVs are saved immediately when uploaded.</p>', {key: 'files'});

    html += section('Research', '<div class="pform">' +
      '<label>Research areas <span class="field-note">(shown as tags and linked to the Research page)</span></label><div class="area-checks">' +
        Object.entries(areas).map(([id, t]) => '<label class="check"><input type="checkbox" data-area="' + esc(id) + '"' + ((p.areas || []).includes(id) ? ' checked' : '') + '> ' + esc(t) + '</label>').join('') +
      '</div>' +
      input(L('interests', 'Research interests', 'textarea', {rows: 3}), p.interests) +
      input(L('bio', 'About / biography', 'textarea', {rows: 7, note: 'leave a blank line between paragraphs'}), p.bio) +
      '</div>', {key: 'research'});

    html += section('Research profiles & links', '<div class="pgrid" data-group="links">' +
      LINKS.map(([k, t]) => input(L(k, t, 'url', {ph: 'https://…'}), links[k])).join('') + '</div>', {key: 'links'});

    LISTS.forEach(def => {
      if (def.facultyOnly && !facultyLike && !isAdmin) return;
      const items = Array.isArray(p[def.k]) ? p[def.k] : [];
      html += section(def.title,
        (def.note ? '<p class="hint">' + esc(def.note) + '</p>' : '') +
        '<div class="list" data-list="' + def.k + '">' + items.map(it => listItemHTML(def, it)).join('') + '</div>' +
        '<button type="button" class="btn btn-light btn-sm add-btn" data-add="' + def.k + '">＋ ' + esc(def.add) + '</button>',
        {count: items.length, key: def.k});
    });

    return html;
  }

  function collectProfile(root, base){
    const p = JSON.parse(JSON.stringify(base));
    const val = el => el.type === 'checkbox' ? el.checked : el.value.trim();
    $$('[data-sec="admin"] [data-f]', root).forEach(el => { p[el.dataset.f] = val(el); });
    $$('[data-group="basic"] [data-f]', root).forEach(el => { p[el.dataset.f] = val(el); });
    p.responsibilities = (p.responsibilities || '').split('\n').map(s => s.trim()).filter(Boolean);
    p.links = {};
    $$('[data-group="links"] [data-f]', root).forEach(el => { if (el.value.trim()) p.links[el.dataset.f] = el.value.trim(); });
    p.areas = $$('[data-area]', root).filter(c => c.checked).map(c => c.dataset.area);
    $$('[data-sec="research"] [data-f]', root).forEach(el => { p[el.dataset.f] = val(el); });
    LISTS.forEach(def => {
      const box = $('[data-list="' + def.k + '"]', root);
      if (!box) return;
      p[def.k] = $$('.list-item', box).map(it => {
        const o = {};
        $$('[data-f]', it).forEach(el => { const v = val(el); if (v !== '') o[el.dataset.f] = v; });
        return o;
      }).filter(o => Object.keys(o).some(k => !['type', 'role', 'status', 'level'].includes(k)));
    });
    return p;
  }

  function wireEditor(root, def){
    // list add / move / delete
    root.addEventListener('click', e => {
      const add = e.target.closest('[data-add]');
      if (add){
        const d = LISTS.find(x => x.k === add.dataset.add);
        const box = $('[data-list="' + d.k + '"]', root);
        box.insertAdjacentHTML('beforeend', listItemHTML(d, {}));
        $('.list-item:last-child input, .list-item:last-child select', box).focus();
        markDirty(); updateCounts(root); return;
      }
      const tool = e.target.closest('.item-tools button');
      if (tool){
        const item = tool.closest('.list-item');
        if (tool.dataset.act === 'del'){ if (confirm('Remove this entry?')){ item.remove(); } }
        if (tool.dataset.act === 'up' && item.previousElementSibling) item.parentNode.insertBefore(item, item.previousElementSibling);
        if (tool.dataset.act === 'down' && item.nextElementSibling) item.parentNode.insertBefore(item.nextElementSibling, item);
        markDirty(); updateCounts(root);
      }
    });
    root.addEventListener('input', e => { if (!e.target.closest('.file-actions')) markDirty(); });
    root.addEventListener('change', e => { if (!e.target.closest('.file-actions')) markDirty(); });

    // uploads
    const up = async (kind, file) => {
      if (!file) return;
      try {
        let data;
        if (kind === 'photo') data = await resizeImage(file, 800);
        else {
          if (file.size > 5 * 1024 * 1024) throw new Error('CV must be under 5 MB.');
          data = await readAsDataURL(file);
        }
        toast('Uploading…');
        const r = await api('POST', def.uploadPath, {kind, data});
        toast(kind === 'photo' ? 'Photo updated.' : 'CV uploaded.');
        def.onFileChange(kind, r.path);
      } catch (err) { toast(err.message, true); }
    };
    const pf = $('#photoFile', root), cf = $('#cvFile', root);
    if (pf) pf.addEventListener('change', () => up('photo', pf.files[0]));
    if (cf) cf.addEventListener('change', () => up('cv', cf.files[0]));
    $$('[data-remove]', root).forEach(b => b.addEventListener('click', async () => {
      if (!confirm('Remove this file?')) return;
      try { await def.removeFile(b.dataset.remove); toast('Removed.'); def.onFileChange(b.dataset.remove, ''); }
      catch (err) { toast(err.message, true); }
    }));
  }

  function updateCounts(root){
    $$('[data-list]', root).forEach(box => {
      const c = $('.sec-count', box.closest('.editor-section'));
      if (c) c.textContent = $$('.list-item', box).length;
    });
  }

  const readAsDataURL = file => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(file); });
  function resizeImage(file, max){
    return new Promise((res, rej) => {
      if (!/^image\/(jpeg|png|webp)$/.test(file.type)) return rej(new Error('Please choose a JPG, PNG or WebP image.'));
      const img = new Image();
      img.onload = () => {
        const s = Math.min(1, max / Math.max(img.width, img.height));
        const c = document.createElement('canvas');
        c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        res(c.toDataURL('image/jpeg', 0.86));
        URL.revokeObjectURL(img.src);
      };
      img.onerror = () => rej(new Error('Could not read that image.'));
      img.src = URL.createObjectURL(file);
    });
  }

  function markDirty(){
    dirty = true;
    const d = $('#saveState'); if (d){ d.textContent = 'Unsaved changes'; d.classList.add('is-dirty'); }
  }
  function removeSaveBar(){ const b = $('#saveBar'); if (b) b.remove(); }
  function saveBar(viewUrl, onSave){
    removeSaveBar();
    document.body.insertAdjacentHTML('beforeend',
      '<div class="save-bar" id="saveBar"><div class="shell"><span class="dirty" id="saveState">All changes saved</span>' +
      '<span class="view-actions"><a class="btn btn-light btn-sm" href="' + viewUrl + '" target="_blank" rel="noopener">View public profile ↗</a>' +
      '<button type="button" class="btn btn-maroon btn-sm" id="saveBtn">Save changes</button></span></div></div>');
    $('#saveBtn').addEventListener('click', async () => {
      const btn = $('#saveBtn'); busy(btn, true, 'Saving…');
      try { await onSave(); dirty = false; const d = $('#saveState'); d.textContent = 'All changes saved'; d.classList.remove('is-dirty'); toast('Saved. The website now shows your changes.'); }
      catch (err) { toast(err.message, true); }
      busy(btn, false);
    });
  }

  /* ---------------- my profile ---------------- */
  VIEWS.profile = async function(){
    const d = await api('GET', '/me/profile');
    const p = d.profile;
    const draw = () => {
      $('#view').innerHTML = head('Edit my profile',
        'Changes appear on your public profile as soon as you save. Empty sections show “To be added” on the website. ' +
        'Your designation, status and official profile link are managed by the department office.') +
        '<form class="pform" id="editor" onsubmit="return false">' + renderEditor(p, d.areas, d.people, 'self') + '</form>';
      wireEditor($('#editor'), {
        uploadPath: '/me/upload',
        removeFile: kind => api('POST', '/me/remove-file', {kind}),
        onFileChange: (kind, path) => { p[kind] = path; const keepDirty = dirty; const cur = collectProfile($('#editor'), p); Object.assign(p, cur, {[kind]: path}); draw(); if (keepDirty) markDirty(); $('[data-sec="files"]').open = true; }
      });
      saveBar('../profile.html?id=' + encodeURIComponent(p.id), async () => {
        const out = collectProfile($('#editor'), p);
        const r = await api('PUT', '/me/profile', {profile: out});
        Object.assign(p, r.profile);
      });
    };
    draw();
  };

  /* ---------------- admin: overview ---------------- */
  VIEWS.overview = async function(){
    const s = await api('GET', '/admin/summary');
    const warn = [];
    if (s.mail_mode === 'console') warn.push('<b>Test mode:</b> e-mails are not really sent – they are saved in <code>backend/data/outbox/</code> and printed in the server window. Set <code>"mode": "smtp"</code> in <code>backend/config.json</code> to send real e-mail.');
    warn.push('Allowed account e-mail domains: <b>' + s.domains.map(x => '@' + esc(x)).join(', ') + '</b>. Change <code>allowed_email_domains</code> in <code>config.json</code> when moving to institute IDs only.');
    $('#view').innerHTML = head('Overview', 'Welcome, ' + esc(ME.name || ME.email) + '.') +
      '<div class="stat-grid">' +
        '<div class="stat-card"><strong>' + s.people + '</strong><span>People & profiles</span><br><a href="#people">Manage →</a></div>' +
        '<div class="stat-card"><strong>' + s.accounts + '</strong><span>Portal accounts</span><br><a href="#accounts">Manage →</a></div>' +
        '<div class="stat-card"><strong>' + s.accounts_pending + '</strong><span>Invitations not yet accepted</span><br><a href="#accounts">View →</a></div>' +
        '<div class="stat-card"><strong>' + s.notices + '</strong><span>Notices & events</span><br><a href="#notices">Manage →</a></div>' +
        '<div class="stat-card"><strong>' + s.contacts + '</strong><span>Mailing-list contacts</span><br><a href="#lists">Manage →</a></div>' +
      '</div>' +
      '<div class="card"><h3>Settings in use</h3>' + warn.map(w => '<p class="hint">' + w + '</p>').join('') +
      '<p class="hint">Invitations: <b>' + (s.invite_mode === 'password' ? 'temporary password by e-mail' : 'set-password link by e-mail') + '</b>. Portal address: <b>' + esc(s.base_url) + '</b>.</p></div>' +
      '<div class="card" id="healthCard"><h3>Things to fix</h3><p class="hint">Checking…</p></div>' +
      '<div class="card"><h3>Common tasks</h3><p class="hint">' +
      '• <a href="#accounts">Create an account</a> for a faculty member and link it to their profile — they get an e-mail to set their password.<br>' +
      '• <a href="#notices">Post a notice or seminar</a> — it appears on the home page Notice Board and News &amp; Events.<br>' +
      '• <a href="#people">Move someone to Former Faculty / Alumni</a> — edit their profile and change Status.<br>' +
      '• <a href="#email">E-mail a group</a> — all faculty, research scholars, students on a mailing list, …</p></div>';
    api('GET', '/admin/health').then(h => {
      const li = (t, arr, link) => arr.length ? '<li><b>' + arr.length + '</b> ' + t + ': ' + arr.slice(0, 8).map(x => typeof x === 'string' ? esc(x) : '<a href="#person/' + esc(x.id) + '">' + esc(x.name || x.title) + '</a>').join(', ') + (arr.length > 8 ? ' …' : '') + '</li>' : '';
      const rows = li('faculty / staff without an e-mail', h.faculty_no_email) + li('faculty without a photo', h.faculty_no_photo) + li('faculty without a biography', h.faculty_no_bio) +
        li('scholars without a supervisor', h.scholars_no_supervisor) + (h.scholars_no_roll ? '<li><b>' + h.scholars_no_roll + '</b> of ' + h.scholars_total + ' scholars have no roll number – <a href="#scholars">fill them in</a></li>' : '') +
        li('accounts that never logged in', h.never_logged_in) + li('invitations not accepted', h.invites_pending) +
        (h.notices_expiring.length ? '<li><b>' + h.notices_expiring.length + '</b> notice(s) expire within 7 days: ' + h.notices_expiring.map(n => esc(n.title) + ' (' + esc(n.expires) + ')').join('; ') + '</li>' : '');
      $('#healthCard').innerHTML = '<h3>Things to fix</h3>' + (rows ? '<ul class="hint">' + rows + '</ul>' : '<p class="hint">Nothing to fix. ✓</p>') + '<p class="hint">' + h.notices_live + ' notice(s) are live on the website.</p>';
    }).catch(() => {});
  };

  /* ---------------- admin: accounts ---------------- */
  VIEWS.accounts = async function(){
    const d = await api('GET', '/admin/users');
    const linkedIds = new Set(d.users.map(u => u.person_id).filter(Boolean));
    const personName = id => (d.people.find(p => p.id === id) || {}).name || id;
    freshView();
    const statusOf = u => !u.active ? ['disabled', 'Disabled'] : u.locked ? ['locked', 'Locked'] : !u.has_password ? ['pending', 'Invited'] : u.must_change ? ['pending', 'Temp. password'] : ['active', 'Active'];
    const canLink = p => (d.self_edit_types || []).includes(p.type);
    const peopleOpts = '<option value="">— not linked —</option>' + d.people.filter(p => p.status !== 'sample' && canLink(p)).map(p =>
      '<option value="' + esc(p.id) + '"' + (linkedIds.has(p.id) ? ' disabled' : '') + '>' + esc(p.name) + ' (' + esc(p.type) + ')' + (linkedIds.has(p.id) ? ' – has account' : '') + '</option>').join('');

    $('#view').innerHTML = head('Accounts', 'Only official e-mail addresses (' + d.domains.map(x => '@' + esc(x)).join(', ') + ') can have accounts. ' +
        'New accounts receive an e-mail to ' + (d.invite_mode === 'password' ? 'log in with a temporary password' : 'set their own password') + '.') +
      '<div class="card"><h3>Create an account</h3><form class="pform" id="newUser" novalidate><div class="pgrid">' +
        '<label>Official e-mail<input type="email" name="email" required placeholder="name@' + esc(d.domains[0] || 'iitkgp.ac.in') + '"></label>' +
        '<label>Link to profile <span class="field-note">(research scholars can’t have accounts – the admin edits their profiles)</span><select name="person_id">' + peopleOpts + '</select></label>' +
        '<label>Display name <span class="field-note">(optional – taken from the profile)</span><input name="name"></label>' +
        '<label>Role<select name="role"><option value="member">Member – edits own profile</option><option value="admin">Admin – full access</option><option value="notices">Content editor – notices, events, gallery only</option><option value="people">People editor – profiles and scholars only</option></select></label>' +
        '<label class="check full"><input type="checkbox" name="send_invite" checked> Send the invitation e-mail now</label>' +
      '</div><div><button class="btn btn-maroon" type="submit">Create account</button></div></form></div>' +
      '<div class="card"><h3>Create several accounts</h3><p class="hint">One per line: <code>e-mail, profile-id</code> (profile id is optional — find it in People &amp; profiles). Invitations are sent to each.</p>' +
        '<form class="pform" id="bulkUsers"><textarea name="lines" rows="4" placeholder="ratna@iitkgp.ac.in, ratna-dutta"></textarea><div><button class="btn btn-light" type="submit">Create all</button></div></form></div>' +
      '<div class="toolbar"><input type="search" id="uFilter" placeholder="Search accounts…"></div>' +
      '<div class="ptable-wrap"><table class="ptable"><thead><tr><th>E-mail</th><th>Profile</th><th>Role</th><th>Status</th><th>Last login</th><th></th></tr></thead><tbody>' +
      d.users.map(u => {
        const [cls, txt] = statusOf(u);
        return '<tr data-row="' + esc((u.email + ' ' + u.name + ' ' + (u.person_id || '')).toLowerCase()) + '"><td><strong>' + esc(u.email) + '</strong><br><small>' + esc(u.name) + '</small></td>' +
          '<td>' + (u.person_id ? '<a href="#person/' + esc(u.person_id) + '">' + esc(personName(u.person_id)) + '</a>' : '<small>—</small>') + '</td>' +
          '<td>' + ('<span class="role-chip' + (u.role === 'admin' ? ' admin' : '') + '">' + esc(ROLE_LABEL[u.role] || u.role) + '</span>') + '</td>' +
          '<td><span class="pill-status st-' + cls + '">' + txt + '</span></td><td><small>' + fmtDate(u.last_login) + '</small></td>' +
          '<td class="actions">' +
            '<button class="btn btn-light btn-sm" data-u="' + u.id + '" data-a="invite" title="Send a new invitation / set-password e-mail">Re-send invite</button>' +
            (u.locked ? '<button class="btn btn-light btn-sm" data-u="' + u.id + '" data-a="unlock">Unlock</button>' : '') +
            '<button class="btn btn-light btn-sm" data-u="' + u.id + '" data-a="link">Link profile</button>' +
            (u.id !== ME.id ? '<button class="btn btn-light btn-sm" data-u="' + u.id + '" data-a="role">' + 'Change role</button>' +
              '<button class="btn btn-light btn-sm" data-u="' + u.id + '" data-a="logout" title="Log this person out of every device">Log out everywhere</button>' +
              '<button class="btn btn-light btn-sm" data-u="' + u.id + '" data-a="toggle">' + (u.active ? 'Disable' : 'Enable') + '</button>' +
              '<button class="btn btn-danger btn-sm" data-u="' + u.id + '" data-a="delete">Delete</button>' : '') +
          '</td></tr>';
      }).join('') + '</tbody></table></div>';

    const nf = $('#newUser');
    nf.addEventListener('submit', async e => {
      e.preventDefault();
      const btn = nf.querySelector('button'); busy(btn, true, 'Creating…');
      try {
        const r = await api('POST', '/admin/users', {email: nf.email.value, person_id: nf.person_id.value, name: nf.name.value, role: nf.role.value, send_invite: nf.send_invite.checked});
        toast(r.invite_sent ? 'Account created and invitation sent.' : 'Account created, but the e-mail could not be sent.', !r.invite_sent);
        VIEWS.accounts();
      } catch (err) { alertBox(esc(err.message)); }
      busy(btn, false);
    });
    $('#bulkUsers').addEventListener('submit', async e => {
      e.preventDefault();
      const lines = e.target.lines.value.split('\n').map(s => s.trim()).filter(Boolean);
      const results = [];
      for (const line of lines){
        const [email, pid] = line.split(/[,;\t]/).map(s => (s || '').trim());
        try { await api('POST', '/admin/users', {email, person_id: pid || ''}); results.push('✓ ' + email); }
        catch (err) { results.push('✕ ' + email + ' — ' + err.message); }
      }
      await VIEWS.accounts();
      alertBox(results.map(esc).join('<br>'), results.some(r => r[0] === '✕') ? 'info' : 'ok');
    });
    $('#uFilter').addEventListener('input', e => { const v = e.target.value.toLowerCase(); $$('[data-row]').forEach(r => r.hidden = !r.dataset.row.includes(v)); });
    $('#view').addEventListener('click', async e => {
      const b = e.target.closest('[data-a]'); if (!b) return;
      const id = b.dataset.u, a = b.dataset.a, u = d.users.find(x => String(x.id) === id);
      try {
        if (a === 'invite'){ if (!confirm('Send a new invitation e-mail to ' + u.email + '? Any earlier link stops working.')) return; await api('POST', '/admin/users/' + id + '/invite'); toast('Invitation sent.'); }
        if (a === 'unlock'){ await api('PUT', '/admin/users/' + id, {unlock: true}); toast('Unlocked.'); }
        if (a === 'role'){
          const r = prompt('Role for ' + u.email + ':\nmember = edits own profile\nadmin = full access\nnotices = notices, events, gallery only\npeople = profiles and scholars only', u.role);
          if (r === null) return;
          await api('PUT', '/admin/users/' + id, {role: r.trim().toLowerCase()}); toast('Role changed.');
        }
        if (a === 'logout'){ await api('POST', '/admin/users/' + id + '/logout'); toast('Logged out of all devices.'); }
        if (a === 'toggle'){ await api('PUT', '/admin/users/' + id, {active: !u.active}); toast(u.active ? 'Account disabled.' : 'Account enabled.'); }
        if (a === 'delete'){ if (!confirm('Delete the account ' + u.email + '? Their public profile is NOT deleted.')) return; await api('DELETE', '/admin/users/' + id); toast('Account deleted.'); }
        if (a === 'link'){
          const pid = prompt('Profile id to link (leave empty to unlink). Find ids under People & profiles.', u.person_id || '');
          if (pid === null) return;
          await api('PUT', '/admin/users/' + id, {person_id: pid.trim()}); toast('Updated.');
        }
        VIEWS.accounts();
      } catch (err) { toast(err.message, true); }
    });
  };

  /* ---------------- admin: people ---------------- */
  const TYPE_LABEL = {faculty: 'Faculty', adjunct: 'Adjunct', postdoc: 'Postdoc', scholar: 'Scholar', staff: 'Staff'};
  const DESIG = {professor: 'Professor', 'associate-professor': 'Associate Prof.', 'assistant-professor': 'Assistant Prof.'};
  VIEWS.people = async function(){
    const d = await api('GET', '/admin/people');
    $('#view').innerHTML = head('People & profiles', 'Everyone shown on the People page. Edit any profile, change designation, or move people to Former Faculty / Alumni.',
        '<button class="btn btn-maroon btn-sm" id="newPerson">＋ Add person</button>') +
      '<div class="toolbar"><input type="search" id="pFilter" placeholder="Search name or id…">' +
        '<select id="pType"><option value="">All types</option>' + Object.entries(TYPE_LABEL).map(([k, v]) => '<option value="' + k + '">' + v + '</option>').join('') + '</select>' +
        '<select id="pStatus"><option value="">All statuses</option><option value="current">Current</option><option value="former">Former</option><option value="alumni">Alumni</option><option value="sample">Hidden / sample</option></select></div>' +
      '<div class="ptable-wrap"><table class="ptable"><thead><tr><th>Name</th><th>Type</th><th>Designation</th><th>Status</th><th>Account</th><th>Last updated</th><th></th></tr></thead><tbody>' +
      d.people.map(p => '<tr data-row="' + esc((p.name + ' ' + p.id).toLowerCase()) + '" data-type="' + esc(p.type) + '" data-status="' + esc(p.status) + '">' +
        '<td><strong>' + esc(p.name) + '</strong><br><small>' + esc(p.id) + '</small></td><td>' + esc(TYPE_LABEL[p.type] || p.type) + '</td>' +
        '<td>' + esc(DESIG[p.designation] || p.designation || '—') + '</td><td><span class="pill-status st-' + (p.status === 'current' ? 'active' : esc(p.status)) + '">' + esc(p.status) + '</span></td>' +
        '<td><small>' + (p.account ? esc(p.account) : '—') + '</small></td><td><small>' + fmtDate(p.updated) + (p.updated_by ? '<br>' + esc(p.updated_by) : '') + '</small></td>' +
        '<td class="actions"><a class="btn btn-light btn-sm" href="#person/' + esc(p.id) + '">Edit</a> <a class="btn btn-light btn-sm" href="../profile.html?id=' + esc(p.id) + '" target="_blank" rel="noopener">View ↗</a></td></tr>').join('') +
      '</tbody></table></div>';
    const filter = () => {
      const v = $('#pFilter').value.toLowerCase(), t = $('#pType').value, s = $('#pStatus').value;
      $$('[data-row]').forEach(r => r.hidden = !(r.dataset.row.includes(v) && (!t || r.dataset.type === t) && (!s || r.dataset.status === s)));
    };
    ['#pFilter', '#pType', '#pStatus'].forEach(s => $(s).addEventListener('input', filter));
    $('#newPerson').addEventListener('click', async () => {
      const name = prompt('Full name of the new person:'); if (!name) return;
      const type = prompt('Type: faculty, adjunct, postdoc, scholar or staff', 'faculty'); if (!type) return;
      try {
        const r = await api('POST', '/admin/people', {profile: {name: name.trim(), type: type.trim().toLowerCase(), status: 'current'}});
        location.hash = 'person/' + r.profile.id;
      } catch (err) { toast(err.message, true); }
    });
  };

  VIEWS.person = async function(pid){
    const d = await api('GET', '/admin/people/' + encodeURIComponent(pid));
    const p = d.profile;
    const draw = () => {
      $('#view').innerHTML = head('Edit: ' + (p.name || p.id), 'Profile id <code>' + esc(p.id) + '</code> · public page: <a href="../profile.html?id=' + esc(p.id) + '" target="_blank" rel="noopener">profile.html?id=' + esc(p.id) + ' ↗</a>',
          '<a class="btn btn-light btn-sm" href="#people">← All people</a><button class="btn btn-danger btn-sm" id="delPerson">Delete person</button>') +
        '<form class="pform" id="editor" onsubmit="return false">' + renderEditor(p, d.areas, d.people, 'admin') + '</form>';
      wireEditor($('#editor'), {
        uploadPath: '/admin/people/' + encodeURIComponent(p.id) + '/upload',
        removeFile: async kind => { const cur = collectProfile($('#editor'), p); cur[kind] = ''; await api('PUT', '/admin/people/' + encodeURIComponent(p.id), {profile: cur}); },
        onFileChange: (kind, path) => { const cur = collectProfile($('#editor'), p); Object.assign(p, cur, {[kind]: path}); draw(); $('[data-sec="files"]').open = true; }
      });
      // switching type changes the designation control
      const typeSel = $('[data-sec="admin"] [data-f="type"]');
      typeSel.addEventListener('change', () => { Object.assign(p, collectProfile($('#editor'), p)); draw(); markDirty(); });
      const delBtn = $('#delPerson');
      delBtn.insertAdjacentHTML('beforebegin', '<button class="btn btn-light btn-sm" id="histBtn">Previous versions</button>');
      $('#histBtn').addEventListener('click', async () => {
        const v = (await api('GET', '/admin/people/' + encodeURIComponent(p.id) + '/versions')).versions;
        if (!v.length){ toast('No earlier versions yet.'); return; }
        const pick = prompt('Restore an earlier version of this profile. Type its number:\n\n' + v.map((x, i) => (i + 1) + ') ' + fmtDate(x.at) + ' by ' + (x.by || '?')).join('\n'));
        const i = parseInt(pick, 10); if (!(i >= 1 && i <= v.length)) return;
        const r = await api('POST', '/admin/people/' + encodeURIComponent(p.id) + '/restore', {version: v[i - 1].id});
        Object.assign(p, r.profile); dirty = false; toast('Earlier version restored.'); VIEWS.person(p.id);
      });
      $('#delPerson').addEventListener('click', async () => {
        if (!confirm('Delete ' + (p.name || p.id) + ' from the website completely? To keep their profile online instead, set Status to “Former” or “Alumni”.')) return;
        try { await api('DELETE', '/admin/people/' + encodeURIComponent(p.id)); dirty = false; location.hash = 'people'; toast('Deleted.'); }
        catch (err) { toast(err.message, true); }
      });
      saveBar('../profile.html?id=' + encodeURIComponent(p.id), async () => {
        const out = collectProfile($('#editor'), p);
        const r = await api('PUT', '/admin/people/' + encodeURIComponent(p.id), {profile: out});
        Object.assign(p, r.profile);
      });
    };
    draw();
  };

  /* ---------------- admin: notices & events ---------------- */
  const TAGS = ['Seminar', 'Colloquium', 'Admissions', 'Ph.D.', 'Examination', 'Workshop', 'Conference', 'Notice', 'Recruitment', 'Result'];
  VIEWS.notices = async function(editId){
    const d = await api('GET', '/admin/notices');
    const editing = editId ? d.notices.find(n => String(n.id) === String(editId)) : null;
    const n = editing || {kind: 'notice', is_new: true};
    const today = new Date().toISOString().slice(0, 10);
    const state = x => x.draft ? ['pending', 'Draft'] : (x.expires && x.expires < today) ? ['disabled', 'Expired'] : ['active', 'Live'];

    $('#view').innerHTML = head('Notices & events', 'Notices appear on the home page Notice Board and on News &amp; Events. Events (seminars, colloquia, workshops) also appear under “Upcoming events” until their date has passed.') +
      '<div class="card"><h3>' + (editing ? 'Edit notice' : 'Post a new notice or event') + '</h3>' +
        (editing ? '' : '<p class="hint">Quick start: <button type="button" class="btn btn-light btn-sm" id="semTpl">Seminar / colloquium form</button></p>') + '<form class="pform" id="nForm" novalidate>' +
        '<div class="pgrid pgrid-3">' +
          '<label>Kind<select name="kind"><option value="notice"' + (n.kind !== 'event' ? ' selected' : '') + '>Notice / announcement</option><option value="event"' + (n.kind === 'event' ? ' selected' : '') + '>Event (seminar, workshop…)</option></select></label>' +
          '<label>Tag<input name="tag" list="tagList" value="' + esc(n.tag || '') + '" placeholder="Seminar, Admissions…"><datalist id="tagList">' + TAGS.map(t => '<option value="' + t + '">').join('') + '</datalist></label>' +
          '<label>Date<input type="date" name="date" value="' + esc(n.date || '') + '"></label>' +
          '<label class="full">Title<input name="title" required value="' + esc(n.title || '') + '"></label>' +
          '<label class="ev">Speaker<input name="speaker" value="' + esc(n.speaker || '') + '"></label>' +
          '<label class="ev">Speaker affiliation<input name="affiliation" value="' + esc(n.affiliation || '') + '"></label>' +
          '<label class="ev">Time<input name="time" value="' + esc(n.time || '') + '" placeholder="4:00 pm"></label>' +
          '<label class="ev">Venue<input name="venue" value="' + esc(n.venue || '') + '"></label>' +
          '<label class="ev">End date (multi-day)<input type="date" name="end_date" value="' + esc(n.end_date || '') + '"></label>' +
          '<label>Link (page, PDF or URL)<input name="link" value="' + esc(n.link || '') + '" placeholder="https://… or a PDF link"></label>' +
          '<label class="full">Details (optional)<textarea name="body" rows="4">' + esc(n.body || '') + '</textarea></label>' +
          '<label>Show from (publish on)<input type="date" name="publish_on" value="' + esc(n.publish_on || '') + '"></label>' +
          '<label>Remove automatically after<input type="date" name="expires" value="' + esc(n.expires || '') + '"></label>' +
          '<label class="full">Attach a PDF or image <span class="field-note">(becomes the notice link)</span><input type="file" id="nFile" accept=".pdf,image/*">' +
            '<span class="field-note" id="nFileInfo">' + (n.attachment ? 'Attached: ' + esc(n.attachment) : '') + '</span></label>' +
          '<label class="check"><input type="checkbox" name="urgent"' + (n.urgent ? ' checked' : '') + '> Mark as urgent</label>' +
          '<label class="check"><input type="checkbox" name="is_new"' + (n.is_new ? ' checked' : '') + '> Show “New” badge</label>' +
          '<label class="check"><input type="checkbox" name="pinned"' + (n.pinned ? ' checked' : '') + '> Pin to top</label>' +
          '<label class="check"><input type="checkbox" name="draft"' + (n.draft ? ' checked' : '') + '> Save as draft (hidden)</label>' +
        (!editing && ME.role === 'admin' ? '<label class="check"><input type="checkbox" id="nMail"> E-mail this to: <select id="nMailGrp"><option value="faculty">Faculty</option><option value="scholar">Research scholars</option><option value="staff">Staff</option></select></label>' : '') +
        '</div><div class="view-actions"><button class="btn btn-maroon" type="submit">' + (editing ? 'Save changes' : 'Publish') + '</button>' +
        (editing ? '<a class="btn btn-light" href="#notices">Cancel</a>' : '') + '</div></form></div>' +
      '<div class="ptable-wrap"><table class="ptable"><thead><tr><th>Date</th><th>Title</th><th>Kind / tag</th><th>State</th><th></th></tr></thead><tbody>' +
      (d.notices.length ? d.notices.map(x => { const [c, t] = state(x); return '<tr><td><small>' + esc(x.date || '—') + '</small></td><td><strong>' + esc(x.title) + '</strong>' +
        (x.speaker ? '<br><small>' + esc(x.speaker) + '</small>' : '') + '</td><td><small>' + esc(x.kind) + ' · ' + esc(x.tag || '') + (x.pinned ? ' · pinned' : '') + '</small></td>' +
        '<td><span class="pill-status st-' + c + '">' + t + '</span></td><td class="actions"><a class="btn btn-light btn-sm" href="#notices/' + x.id + '">Edit</a>' +
        '<button class="btn btn-danger btn-sm" data-del="' + x.id + '">Delete</button></td></tr>'; }).join('') :
        '<tr><td colspan="5"><small>No notices yet.</small></td></tr>') + '</tbody></table></div>';

    const form = $('#nForm'), f = form.elements;
    const syncKind = () => $$('.ev', form).forEach(el => el.hidden = f.kind.value !== 'event');
    f.kind.addEventListener('change', syncKind); syncKind();
    let attachment = n.attachment || '';
    $('#nFile').addEventListener('change', async e => {
      const file = e.target.files[0]; if (!file) return;
      try {
        const r = await api('POST', '/admin/notice-file', {name: file.name, data: await readAsDataURL(file)});
        attachment = r.attachment || r.path; $('#nFileInfo').textContent = 'Attached: ' + attachment; if (!f.link.value) f.link.value = attachment;
      } catch (err) { toast(err.message, true); }
    });
    const sem = $('#semTpl');
    if (sem) sem.addEventListener('click', () => { f.kind.value = 'event'; f.tag.value = 'Seminar'; syncKind(); f.title.focus();
      f.body.value = 'Abstract:\n\nAbout the speaker:\n'; });
    form.addEventListener('submit', async e => {
      e.preventDefault();
      const body = {};
      ['kind', 'tag', 'date', 'title', 'speaker', 'affiliation', 'time', 'venue', 'end_date', 'link', 'body', 'expires', 'publish_on'].forEach(k => { const v = f[k].value.trim(); if (v) body[k] = v; });
      ['is_new', 'pinned', 'draft', 'urgent'].forEach(k => { if (f[k].checked) body[k] = true; });
      if (attachment) body.attachment = attachment;
      const btn = form.querySelector('button[type=submit]'); busy(btn, true, 'Saving…');
      try {
        if (editing) await api('PUT', '/admin/notices/' + editing.id, body); else await api('POST', '/admin/notices', body);
        const mailBox = $('#nMail');
        if (!editing && mailBox && mailBox.checked && !body.draft){
          const lines = [body.title, body.speaker ? 'Speaker: ' + body.speaker + (body.affiliation ? ' (' + body.affiliation + ')' : '') : '', body.date ? 'Date: ' + body.date : '', body.time ? 'Time: ' + body.time : '', body.venue ? 'Venue: ' + body.venue : '', '', body.body || ''].filter((x, i) => x || i === 5);
          try { await api('POST', '/admin/mail', {groups: [$('#nMailGrp').value], emails: [], subject: (body.tag ? body.tag + ': ' : '') + body.title, body: lines.join('\n')}); toast('E-mail is being sent.'); } catch (err) { toast('Notice saved, but the e-mail failed: ' + err.message, true); }
        }
        toast(editing ? 'Notice updated.' : 'Published. It is now on the website.');
        if (location.hash !== '#notices') location.hash = 'notices'; else VIEWS.notices();
      } catch (err) { alertBox(esc(err.message)); busy(btn, false); }
    });
    $$('[data-del]').forEach(b => b.addEventListener('click', async () => {
      if (!confirm('Delete this notice?')) return;
      try { await api('DELETE', '/admin/notices/' + b.dataset.del); toast('Deleted.'); VIEWS.notices(); } catch (err) { toast(err.message, true); }
    }));
  };

  /* ---------------- admin: e-mail ---------------- */
  VIEWS.email = async function(){
    const [c, log] = await Promise.all([api('GET', '/admin/contacts'), api('GET', '/admin/mail-log')]);
    $('#view').innerHTML = head('Send e-mail', 'Each person receives their own copy addressed to them – recipients never see each other’s addresses. Replies come to your e-mail (' + esc(ME.email) + ').') +
      (log.mail_mode === 'console' ? '<div class="portal-alert info"><b>Test mode:</b> messages are saved in <code>backend/data/outbox/</code> instead of being sent.</div>' : '') +
      '<div class="card"><form class="pform" id="mailForm" novalidate>' +
        '<label>Send to</label><div class="group-picks">' + c.groups.map(g => '<label class="check"><input type="checkbox" name="g" value="' + esc(g.key) + '"' + (g.count ? '' : ' disabled') + '> ' + esc(g.label) + ' <span class="count">(' + g.count + ')</span></label>').join('') + '</div>' +
        '<p class="hint">Faculty, postdocs, scholars and staff are taken from the People list (their public e-mail or their portal account). Students and other groups: create a <a href="#lists">mailing list</a>.</p>' +
        '<label>Extra addresses <span class="field-note">(optional, separated by commas or new lines)</span><textarea name="emails" rows="2"></textarea></label>' +
        '<label>Subject<input name="subject" required maxlength="200"></label>' +
        '<label>Message <span class="field-note">(“Dear Name,” is added automatically where the name is known)</span><textarea name="body" rows="9" required></textarea></label>' +
        '<div class="view-actions"><button type="button" class="btn btn-light" id="previewBtn">Preview recipients</button><button class="btn btn-maroon" type="submit">Send e-mail</button></div>' +
        '<div id="recips" hidden></div>' +
      '</form></div>' +
      '<div class="card"><h3>Sent messages</h3><div class="ptable-wrap"><table class="ptable"><thead><tr><th>When</th><th>Subject</th><th>By</th><th>Sent</th><th>Status</th></tr></thead><tbody id="mailLog">' +
      logRows(log.log) + '</tbody></table></div></div>';

    const form = $('#mailForm'), f = form.elements;
    const payload = () => ({groups: $$('[name=g]:checked', form).map(x => x.value), emails: f.emails.value.split(/[\s,;]+/).filter(Boolean), subject: f.subject.value, body: f.body.value});
    $('#previewBtn').addEventListener('click', async () => {
      try {
        const r = await api('POST', '/admin/mail/preview', payload());
        const box = $('#recips'); box.hidden = false;
        box.innerHTML = '<p class="hint"><b>' + r.recipients.length + ' recipient' + (r.recipients.length === 1 ? '' : 's') + '</b></p><div class="recipients">' +
          (r.recipients.map(x => esc(x.name ? x.name + ' <' + x.email + '>' : x.email)).join('<br>') || 'Nobody selected.') + '</div>';
      } catch (err) { toast(err.message, true); }
    });
    form.addEventListener('submit', async e => {
      e.preventDefault();
      const body = payload();
      if (!body.subject.trim() || !body.body.trim()){ alertBox('Write a subject and a message.'); return; }
      let n;
      try { n = (await api('POST', '/admin/mail/preview', body)).recipients.length; } catch (err) { alertBox(esc(err.message)); return; }
      if (!n){ alertBox('Choose at least one group or address.'); return; }
      if (!confirm('Send this e-mail to ' + n + ' recipient' + (n === 1 ? '' : 's') + '?')) return;
      const btn = form.querySelector('button[type=submit]'); busy(btn, true, 'Sending…');
      try {
        await api('POST', '/admin/mail', body);
        toast('Sending to ' + n + ' recipients…'); form.reset(); $('#recips').hidden = true;
        pollLog();
      } catch (err) { alertBox(esc(err.message)); }
      busy(btn, false);
    });
    function pollLog(){
      let i = 0;
      const t = setInterval(async () => {
        if (!$('#mailLog')){ clearInterval(t); return; }
        const l = await api('GET', '/admin/mail-log');
        $('#mailLog').innerHTML = logRows(l.log);
        if (++i > 60 || !l.log.some(x => ['queued', 'sending'].includes(x.status))) clearInterval(t);
      }, 2000);
    }
  };
  function logRows(rows){
    return rows.length ? rows.map(x => '<tr><td><small>' + fmtDate(x.created) + '</small></td><td>' + esc(x.subject) + '</td><td><small>' + esc(x.sender) + '</small></td>' +
      '<td>' + x.sent + ' / ' + x.total + (x.failed ? ' <small style="color:#a3261e">(' + x.failed + ' failed)</small>' : '') + '</td>' +
      '<td><span class="pill-status st-' + (x.status === 'done' ? 'active' : x.status === 'done with errors' ? 'locked' : 'pending') + '">' + esc(x.status) + '</span></td></tr>').join('')
      : '<tr><td colspan="5"><small>Nothing sent yet.</small></td></tr>';
  }

  /* ---------------- admin: mailing lists ---------------- */
  VIEWS.lists = async function(){
    const d = await api('GET', '/admin/contacts');
    freshView();
    const lists = {};
    d.contacts.forEach(c => (lists[c.grp] = lists[c.grp] || []).push(c));
    $('#view').innerHTML = head('Mailing lists', 'Lists for people who don’t have a profile on the website – students by programme and batch, visitors, etc. Use them in “Send e-mail”.') +
      '<div class="card"><h3>Add contacts to a list</h3><form class="pform" id="lForm" novalidate><div class="pgrid">' +
        '<label>List name<input name="group" list="lists" required placeholder="e.g. msc-2025, bsms-2023, mtech-2024"><datalist id="lists">' + Object.keys(lists).map(g => '<option value="' + esc(g) + '">').join('') + '</datalist></label>' +
        '<label class="full">Contacts <span class="field-note">one per line: <code>Name, e-mail</code> – you can paste straight from Excel</span><textarea name="csv" rows="6" placeholder="Student Name, student@kgpian.iitkgp.ac.in"></textarea></label>' +
      '</div><div><button class="btn btn-maroon" type="submit">Add to list</button></div></form></div>' +
      (Object.keys(lists).length ? Object.entries(lists).map(([g, cs]) =>
        '<details class="editor-section"><summary>' + esc(g) + '<span class="sec-count">' + cs.length + '</span></summary><div class="sec-body">' +
        '<div class="ptable-wrap"><table class="ptable"><tbody>' + cs.map(c => '<tr><td>' + esc(c.name || '—') + '</td><td>' + esc(c.email) + '</td><td class="actions"><button class="btn btn-danger btn-sm" data-cdel="' + c.id + '">Remove</button></td></tr>').join('') +
        '</tbody></table></div><p><button class="btn btn-danger btn-sm" data-ldel="' + esc(g) + '">Delete whole list</button></p></div></details>').join('')
        : '<p class="hint">No mailing lists yet.</p>');
    $('#lForm').addEventListener('submit', async e => {
      e.preventDefault();
      try {
        const r = await api('POST', '/admin/contacts', {group: e.target.elements.group.value, csv: e.target.elements.csv.value});
        await VIEWS.lists();
        alertBox(r.added + ' contact(s) added.' + (r.skipped.length ? '<br>Skipped (no valid e-mail):<br>' + r.skipped.map(esc).join('<br>') : ''), r.skipped.length ? 'info' : 'ok');
      } catch (err) { alertBox(esc(err.message)); }
    });
    $('#view').addEventListener('click', async e => {
      const c = e.target.closest('[data-cdel]'), l = e.target.closest('[data-ldel]');
      try {
        if (c){ await api('DELETE', '/admin/contacts/' + c.dataset.cdel); c.closest('tr').remove(); toast('Removed.'); }
        if (l && confirm('Delete the whole list “' + l.dataset.ldel + '”?')){ await api('DELETE', '/admin/lists/' + encodeURIComponent(l.dataset.ldel)); VIEWS.lists(); toast('List deleted.'); }
      } catch (err) { toast(err.message, true); }
    });
  };

  /* ---------------- admin: import ---------------- */
  VIEWS.import = function(){
    $('#view').innerHTML = head('Import data (JSON)', 'Add many research scholars, postdocs, alumni or mailing-list contacts at once from a JSON file.') +
      '<div class="card"><h3>1. Choose the file</h3><form class="pform" id="impForm" novalidate>' +
        '<label class="btn btn-light btn-sm" style="align-self:flex-start">Choose .json file<input type="file" accept=".json,application/json" id="impFile" hidden></label>' +
        '<label>…or paste the JSON here<textarea name="json" rows="10" placeholder="[ {&quot;name&quot;: &quot;…&quot;, &quot;type&quot;: &quot;scholar&quot;, … } ]"></textarea></label>' +
        '<div class="view-actions"><button class="btn btn-maroon" type="submit">Import</button></div></form></div>' +
      '<div id="impReport"></div>' +
      '<div class="card"><h3>How records are treated</h3><p class="hint">' +
      '• A record with <code>"list"</code> and <code>"email"</code> is added to that <a href="#lists">mailing list</a> (e.g. current M.Sc. students).<br>' +
      '• Any other record is a <b>profile</b>. If a profile with the same <code>id</code> already exists, the fields in the file are added to it; otherwise a new profile is created. ' +
      'The id is made from the name if you leave it out.<br>' +
      '• Research scholars: <code>"type": "scholar"</code>, postdocs: <code>"postdoc"</code>. Graduated ones: <code>"status": "alumni"</code> with <code>"year"</code> = year completed – they appear under Alumni.<br>' +
      '• <code>"supervisor"</code> must be the supervisor’s profile id (e.g. <code>ratna-dutta</code>) – it links the scholar to that professor’s Students tab.<br>' +
      '• Importing the same file twice does not create duplicates.<br>• Research scholars don’t get portal logins; update their profiles here or under People &amp; profiles.</p></div>';
    const form = $('#impForm');
    $('#impFile').addEventListener('change', async e => {
      const f = e.target.files[0]; if (!f) return;
      form.elements.json.value = await f.text();
      toast('File loaded – check it, then press Import.');
    });
    form.addEventListener('submit', async e => {
      e.preventDefault();
      const text = form.elements.json.value.trim();
      if (!text){ alertBox('Choose a file or paste the JSON first.'); return; }
      let data;
      try { data = JSON.parse(text); } catch (err) { alertBox('This is not valid JSON: ' + esc(err.message) + '. Check for missing commas or quotes.'); return; }
      const n = Array.isArray(data) ? data.length : '';
      if (!confirm('Import ' + n + ' record(s)?')) return;
      const btn = form.querySelector('button'); busy(btn, true, 'Importing…');
      try {
        const r = (await api('POST', '/admin/import', {data})).report;
        $('#impReport').innerHTML = '<div class="card"><h3>Result</h3><p class="hint"><b>' + r.created.length + '</b> profiles created, <b>' + r.updated.length +
          '</b> updated, <b>' + r.contacts + '</b> mailing-list contacts added.</p>' +
          (r.errors.length ? '<p class="hint" style="color:#a3261e">' + r.errors.map(esc).join('<br>') + '</p>' : '') +
          (r.created.length ? '<p class="hint">New: ' + r.created.map(id => '<a href="#person/' + esc(id) + '">' + esc(id) + '</a>').join(', ') + '</p>' : '') + '</div>';
        toast('Import finished.');
      } catch (err) { alertBox(esc(err.message)); }
      busy(btn, false);
    });
  };

  /* ---------------- admin: activity ---------------- */
  VIEWS.activity = async function(){
    const d = await api('GET', '/admin/audit');
    $('#view').innerHTML = head('Activity log', 'The last 300 actions: logins, failed logins, profile changes, invitations, e-mails and admin changes.') +
      '<div class="toolbar"><input type="search" id="aFilter" placeholder="Filter…"></div>' +
      '<div class="ptable-wrap"><table class="ptable"><thead><tr><th>When</th><th>Who</th><th>Action</th><th>Target</th><th>Details</th><th>IP</th></tr></thead><tbody>' +
      d.audit.map(a => '<tr data-row="' + esc((a.actor + ' ' + a.action + ' ' + a.target + ' ' + a.detail).toLowerCase()) + '"><td><small>' + fmtDate(a.at) + '</small></td><td><small>' + esc(a.actor) + '</small></td>' +
        '<td><strong>' + esc(a.action) + '</strong></td><td><small>' + esc(a.target) + '</small></td><td><small>' + esc(a.detail) + '</small></td><td><small>' + esc(a.ip) + '</small></td></tr>').join('') +
      '</tbody></table></div>';
    $('#aFilter').addEventListener('input', e => { const v = e.target.value.toLowerCase(); $$('[data-row]').forEach(r => r.hidden = !r.dataset.row.includes(v)); });
  };

  /* ---------------- admin: export ---------------- */
  VIEWS.export = function(){
    $('#view').innerHTML = head('Export for the website', 'While the public website is on GitHub Pages, it can’t read the portal database directly.') +
      '<div class="card"><h3>Update the GitHub copy</h3><p class="hint">1. Download the export below. It contains <code>people-data.js</code>, <code>notices-data.js</code> and the <code>uploads</code> folder (photos and CVs).<br>' +
      '2. Extract it and upload its contents to the top level of the GitHub repository (Add file → Upload files).<br>' +
      '3. The GitHub site then shows the same profiles and notices as the portal.</p>' +
      '<p><a class="btn btn-maroon" href="../api/admin/export.zip">⬇ Download website data (.zip)</a></p>' +
      '<p class="hint">Once the website runs on the CIC server together with the portal, this step is no longer needed – changes appear immediately.</p></div>';
  };

  /* ------------------------------------------------------------------ */

  /* ---------------- scholars: table editing, graduation, CSV import ---------------- */
  VIEWS.scholars = async function(){
    const d = await api('GET', '/admin/scholars');
    const fac = d.faculty, rows = d.scholars;
    const changed = {};
    const supOpts = sel => '<option value="">—</option>' + fac.map(f => '<option value="' + esc(f.id) + '"' + (f.id === sel ? ' selected' : '') + '>' + esc(f.name) + '</option>').join('');
    $('#view').innerHTML = head('Research scholars', 'Edit supervisor, roll number, official e-mail, office and joining year in one table. Scholars appear in their supervisor’s profile, numbered by seniority (joining year, then roll number).',
        '<button class="btn btn-maroon btn-sm" id="schSave" disabled>Save changes</button>') +
      '<div class="toolbar"><input type="search" id="sFilter" placeholder="Search name…"><select id="sSup"><option value="">All supervisors</option>' + fac.map(f => '<option value="' + esc(f.id) + '">' + esc(f.name) + '</option>').join('') + '</select>' +
        '<select id="sStat"><option value="current">Current</option><option value="alumni">Alumni</option><option value="">All</option></select>' +
        '<button class="btn btn-light btn-sm" id="schGrad">Mark selected as graduated…</button></div>' +
      '<div class="ptable-wrap"><table class="ptable"><thead><tr><th></th><th>Name</th><th>Supervisor</th><th>Roll no.</th><th>Official e-mail</th><th>Office</th><th>Joined</th></tr></thead><tbody>' +
      rows.map(p => '<tr data-id="' + esc(p.id) + '" data-row="' + esc((p.name || '').toLowerCase()) + '" data-sup="' + esc(p.supervisor || '') + '" data-status="' + esc(p.status) + '">' +
        '<td><input type="checkbox" data-sel></td><td><strong>' + esc(p.name) + '</strong></td>' +
        '<td><select data-k="supervisor">' + supOpts(p.supervisor) + '</select></td>' +
        '<td><input data-k="roll" value="' + esc(p.roll || '') + '" size="11"></td><td><input data-k="email" value="' + esc(p.email || '') + '" size="26"></td>' +
        '<td><input data-k="office" value="' + esc(p.office || '') + '" size="14"></td><td><input data-k="joined" value="' + esc(p.joined || (p.status === 'current' ? p.year : '') || '') + '" size="5"></td></tr>').join('') +
      '</tbody></table></div>' +
      '<div class="card"><h3>Import from a spreadsheet (CSV)</h3><p class="hint">Save your Excel sheet as <b>CSV</b>. First row must be headings from: <code>name, supervisor, roll, email, office, joined, topic, cosupervisor</code>. <code>supervisor</code> can be the professor’s name. Existing scholars are updated, new ones are added.</p>' +
      '<input type="file" id="csvFile" accept=".csv,text/csv"> <button class="btn btn-maroon btn-sm" id="csvGo">Import</button><div id="csvOut" class="hint"></div></div>';
    const apply = () => {
      const v = $('#sFilter').value.toLowerCase(), s = $('#sSup').value, st = $('#sStat').value;
      $$('tbody tr[data-id]').forEach(r => r.hidden = !(r.dataset.row.includes(v) && (!s || r.dataset.sup === s) && (!st || r.dataset.status === st)));
    };
    ['#sFilter', '#sSup', '#sStat'].forEach(x => $(x).addEventListener('input', apply)); apply();
    $('#view').addEventListener('input', e => {
      const el = e.target.closest('[data-k]'); if (!el) return;
      const tr = el.closest('tr'), id = tr.dataset.id;
      (changed[id] = changed[id] || {})[el.dataset.k] = el.value.trim();
      if (el.dataset.k === 'supervisor') tr.dataset.sup = el.value;
      $('#schSave').disabled = false; el.style.background = '#fff6dd';
    });
    $('#schSave').addEventListener('click', async () => {
      const updates = Object.keys(changed).map(id => ({id, fields: changed[id]}));
      try { const r = await api('POST', '/admin/people-bulk', {updates}); toast(r.changed + ' scholar(s) updated.'); VIEWS.scholars(); } catch (err) { toast(err.message, true); }
    });
    $('#schGrad').addEventListener('click', async () => {
      const ids = $$('[data-sel]:checked').map(x => x.closest('tr').dataset.id);
      if (!ids.length){ toast('Tick the scholars first.', true); return; }
      const year = prompt('Year of completion for these ' + ids.length + ' scholar(s):', String(new Date().getFullYear())); if (!year) return;
      try { await api('POST', '/admin/people-bulk', {graduate: {ids, year}}); toast('Moved to Alumni.'); VIEWS.scholars(); } catch (err) { toast(err.message, true); }
    });
    $('#csvGo').addEventListener('click', async () => {
      const file = $('#csvFile').files[0]; if (!file){ toast('Choose a CSV file first.', true); return; }
      const text = await file.text();
      const parse = t => { const out = []; let row = [], cur = '', q = false;
        for (let i = 0; i < t.length; i++){ const c = t[i];
          if (q){ if (c === '"' && t[i + 1] === '"'){ cur += '"'; i++; } else if (c === '"') q = false; else cur += c; }
          else if (c === '"') q = true; else if (c === ',' || c === '\t'){ row.push(cur); cur = ''; }
          else if (c === '\n' || c === '\r'){ if (c === '\r' && t[i + 1] === '\n') i++; row.push(cur); cur = ''; if (row.some(x => x.trim())) out.push(row); row = []; }
          else cur += c; }
        row.push(cur); if (row.some(x => x.trim())) out.push(row); return out; };
      const tbl = parse(text.replace(/^﻿/, '')); if (tbl.length < 2){ toast('The file has no data rows.', true); return; }
      const hd = tbl[0].map(h => h.trim().toLowerCase());
      const slug = n => n.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      const facBy = {}; fac.forEach(f => { facBy[f.id] = f.id; facBy[f.name.toLowerCase()] = f.id; facBy[f.name.toLowerCase().replace(/^(prof\.?|dr\.?)\s+/, '')] = f.id; });
      const recs = [], warn = [];
      tbl.slice(1).forEach((r, i) => {
        const o = {}; hd.forEach((h, j) => { if (r[j] && r[j].trim()) o[h] = r[j].trim(); });
        if (!o.name){ return; }
        const rec = {name: o.name, id: slug(o.name), type: 'scholar'};
        ['roll', 'email', 'office', 'joined', 'topic', 'cosupervisor'].forEach(k => { if (o[k]) rec[k] = o[k]; });
        if (o.supervisor){ const sid = facBy[o.supervisor.toLowerCase()] || facBy[o.supervisor.toLowerCase().replace(/^(prof\.?|dr\.?)\s+/, '')]; if (sid) rec.supervisor = sid; else warn.push('Row ' + (i + 2) + ': supervisor “' + o.supervisor + '” not found'); }
        recs.push(rec);
      });
      try {
        const r = (await api('POST', '/admin/import', {data: recs})).report;
        $('#csvOut').innerHTML = '<b>' + r.created.length + ' added, ' + r.updated.length + ' updated.</b>' + (warn.concat(r.errors).length ? '<br>' + warn.concat(r.errors).map(esc).join('<br>') : '');
        toast('Import finished.');
      } catch (err) { toast(err.message, true); }
    });
  };

  /* ---------------- gallery manager ---------------- */
  VIEWS.gallery = async function(){
    const d = await api('GET', '/admin/gallery');
    let items = d.items;
    const draw = () => {
      $('#view').innerHTML = head('Gallery', 'Photos shown on the Gallery page. Tick “Home slideshow” to also show a photo in the home page hero (3 seconds each, after the Head’s message).',
          '<button class="btn btn-maroon btn-sm" id="gSave">Save order & captions</button>') +
        '<div class="card"><h3>Upload a photo</h3><form class="pform" id="gUp"><div class="pgrid pgrid-3">' +
          '<label>Photo (JPG / PNG / WebP, up to 6 MB)<input type="file" name="file" accept="image/*" required></label>' +
          '<label>Caption<input name="title"></label><label>Album<input name="album" value="Events" list="albums"><datalist id="albums">' + [...new Set(items.map(x => x.album).filter(Boolean))].map(a => '<option value="' + esc(a) + '">').join('') + '</datalist></label>' +
          '<label>Date (optional)<input name="date" placeholder="Nov 2026"></label>' +
          '<label class="check"><input type="checkbox" name="hero"> Home slideshow</label></div><div><button class="btn btn-maroon" type="submit">Upload</button></div></form></div>' +
        '<div class="ptable-wrap"><table class="ptable"><thead><tr><th>Photo</th><th>Caption</th><th>Album</th><th>Home</th><th></th></tr></thead><tbody>' +
        (items.length ? items.map((x, i) => '<tr data-i="' + i + '"><td><img src="../' + esc(x.src) + '" alt="" style="width:90px;height:60px;object-fit:cover' + (x.exists === false ? ';opacity:.3' : '') + '">' + (x.exists === false ? '<br><small>file missing</small>' : '') + '</td>' +
          '<td><input data-k="title" value="' + esc(x.title) + '"></td><td><input data-k="album" value="' + esc(x.album) + '" size="12"></td>' +
          '<td><input type="checkbox" data-k="hero"' + (x.hero ? ' checked' : '') + '></td>' +
          '<td class="actions"><button class="btn btn-light btn-sm" data-m="up">↑</button><button class="btn btn-light btn-sm" data-m="down">↓</button><button class="btn btn-danger btn-sm" data-m="del">Delete</button></td></tr>').join('') : '<tr><td colspan="5"><small>No photos yet.</small></td></tr>') + '</tbody></table></div>';
      const sync = () => $$('tbody tr[data-i]').forEach(tr => { const it = items[+tr.dataset.i]; $$('[data-k]', tr).forEach(el => { it[el.dataset.k] = el.type === 'checkbox' ? el.checked : el.value; }); });
      $('#gUp').addEventListener('submit', async e => {
        e.preventDefault(); const f = e.target, file = f.file.files[0];
        const btn = f.querySelector('button'); busy(btn, true, 'Uploading…');
        try { await api('POST', '/admin/gallery/upload', {name: file.name, data: await readAsDataURL(file), title: f.title.value, album: f.album.value, date: f.date.value, hero: f.hero.checked}); toast('Uploaded.'); VIEWS.gallery(); }
        catch (err) { toast(err.message, true); busy(btn, false); }
      });
      $$('[data-m]').forEach(b => b.addEventListener('click', async () => {
        sync(); const i = +b.closest('tr').dataset.i, m = b.dataset.m;
        if (m === 'del'){ if (!confirm('Delete this photo?')) return; await api('POST', '/admin/gallery/delete', {src: items[i].src}); items.splice(i, 1); }
        else { const j = m === 'up' ? i - 1 : i + 1; if (j < 0 || j >= items.length) return; [items[i], items[j]] = [items[j], items[i]]; }
        draw();
      }));
      $('#gSave').addEventListener('click', async () => { sync(); try { await api('PUT', '/admin/gallery', {items}); toast('Saved.'); } catch (err) { toast(err.message, true); } });
    };
    draw();
  };

  /* ---------------- students (BS-MS / M.Sc. / M.Tech.) ---------------- */
  VIEWS.students = async function(){
    const d = await api('GET', '/admin/students');
    let items = d.items, filt = 'all';
    const PROG = {bsms: 'BS-MS', msc: 'M.Sc.', mtech: 'M.Tech.'};
    const sel = (k, opts, v) => '<select data-k="' + k + '">' + opts.map(o => '<option value="' + o[0] + '"' + (o[0] === (v || '') ? ' selected' : '') + '>' + o[1] + '</option>').join('') + '</select>';
    const draw = () => {
      const shown = items.map((x, i) => [x, i]).filter(([x]) => filt === 'all' || x.programme === filt || (filt === 'alumni' && x.status === 'alumni'));
      $('#view').innerHTML = head('Students', 'Current students (grouped by batch) and alumni with their placement, shown on the Students page. Keep it minimal: name, optional roll number, batch.',
          '<button class="btn btn-maroon btn-sm" id="sSave">Save changes</button>') +
        '<div class="card"><h3>Add a student</h3><form class="pform" id="sAdd"><div class="pgrid pgrid-3">' +
          '<label>Name<input name="name" required></label><label>Roll no. (optional)<input name="roll"></label>' +
          '<label>Programme<select name="programme"><option value="bsms">BS-MS</option><option value="msc">M.Sc.</option><option value="mtech">M.Tech.</option></select></label>' +
          '<label>Batch (admission year)<input name="batch" type="number" min="1951" max="2100" placeholder="2024"></label></div><div><button class="btn btn-maroon" type="submit">Add</button></div></form></div>' +
        '<div class="card"><h3>Import from a JSON file</h3><p class="hint">A list of students; existing ones (same programme, batch and name) are updated, new ones added. Per-batch files (programme and batch written once at the top) work too; see <code>JSON-files/5-alumni</code> and <code>JSON-files/6-students-current</code>.</p>' +
          '<input type="file" id="sFile" accept=".json,application/json"></div>' +
        '<p class="hint">Show: ' + [['all', 'All'], ['bsms', 'BS-MS'], ['msc', 'M.Sc.'], ['mtech', 'M.Tech.'], ['alumni', 'Alumni']].map(f => '<a href="#" data-f="' + f[0] + '"' + (f[0] === filt ? ' style="font-weight:800"' : '') + '>' + f[1] + '</a>').join(' · ') + ' &nbsp;(' + shown.length + ' of ' + items.length + ')</p>' +
        '<div class="ptable-wrap"><table class="ptable"><thead><tr><th>Name</th><th>Roll</th><th>Programme</th><th>Batch</th><th>Status</th><th>Passed out</th><th>Outcome</th><th>Company / institution</th><th>Role / course</th><th></th></tr></thead><tbody>' +
        (shown.length ? shown.map(([x, i]) => '<tr data-i="' + i + '"><td><input data-k="name" value="' + esc(x.name) + '"></td><td><input data-k="roll" size="9" value="' + esc(x.roll) + '"></td>' +
          '<td>' + sel('programme', [['bsms', 'BS-MS'], ['msc', 'M.Sc.'], ['mtech', 'M.Tech.']], x.programme) + '</td><td><input data-k="batch" size="5" value="' + esc(x.batch) + '"></td>' +
          '<td>' + sel('status', [['current', 'Current'], ['alumni', 'Alumni']], x.status) + '</td><td><input data-k="passout" size="5" value="' + esc(x.passout) + '"></td>' +
          '<td>' + sel('outcome', [['', '—'], ['placed', 'Placed'], ['higher', 'Higher studies'], ['other', 'Other']], x.outcome) + '</td>' +
          '<td><input data-k="org" value="' + esc(x.org) + '"></td><td><input data-k="role" value="' + esc(x.role) + '"></td>' +
          '<td class="actions"><button class="btn btn-danger btn-sm" data-m="del">Delete</button></td></tr>').join('') : '<tr><td colspan="10"><small>No students yet.</small></td></tr>') + '</tbody></table></div>';
      const sync = () => $$('tbody tr[data-i]').forEach(tr => { const it = items[+tr.dataset.i]; $$('[data-k]', tr).forEach(el => { it[el.dataset.k] = el.value; }); });
      const save = async () => { sync(); const r = await api('PUT', '/admin/students', {items}); const d2 = await api('GET', '/admin/students'); items = d2.items; return r; };
      $$('[data-f]').forEach(a => a.addEventListener('click', e => { e.preventDefault(); sync(); filt = a.dataset.f; draw(); }));
      $$('[data-m="del"]').forEach(b => b.addEventListener('click', () => { if (!confirm('Delete this student?')) return; sync(); items.splice(+b.closest('tr').dataset.i, 1); draw(); }));
      $('#sAdd').addEventListener('submit', e => { e.preventDefault(); sync(); const f = e.target;
        items.push({name: f.name.value, roll: f.roll.value, programme: f.programme.value, batch: f.batch.value, status: 'current'}); draw(); });
      $('#sSave').addEventListener('click', async () => { try { await save(); toast('Saved.'); draw(); } catch (err) { toast(err.message, true); } });
      $('#sFile').addEventListener('change', async e => {
        const file = e.target.files[0]; if (!file) return;
        try { const r = await api('POST', '/admin/students/import', JSON.parse(await file.text())); toast(r.added + ' added, ' + r.updated + ' updated.'); VIEWS.students(); }
        catch (err) { toast(err.message || 'That file is not valid JSON.', true); }
      });
    };
    draw();
  };

  /* ---------------- backup & restore ---------------- */
  VIEWS.backup = function(){
    $('#view').innerHTML = head('Backup & restore', 'Everything in the portal (people, notices, gallery list, accounts, uploads) in one file.') +
      '<div class="card"><h3>Download a backup</h3><p class="hint">Keep this file safe – it contains accounts. The server also keeps a daily copy of the database (last 14 days) in <code>backend/data/backups/</code>.</p>' +
      '<a class="btn btn-maroon" href="../api/admin/backup.zip">⬇ Download backup</a></div>' +
      '<div class="card"><h3>Restore from a backup</h3><p class="hint"><b>This replaces everything currently in the portal.</b> A safety copy of the current database is saved first. You will be asked to log in again.</p>' +
      '<input type="file" id="rFile" accept=".zip"> <button class="btn btn-danger btn-sm" id="rGo">Restore</button></div>';
    $('#rGo').addEventListener('click', async () => {
      const file = $('#rFile').files[0]; if (!file){ toast('Choose a backup .zip first.', true); return; }
      if (!confirm('Replace ALL portal data with this backup?')) return;
      try { await api('POST', '/admin/restore', {data: await readAsDataURL(file)}); alert('Restored. Please log in again.'); location.replace('login.html'); }
      catch (err) { toast(err.message, true); }
    });
  };

  /* ---------------- devices & security ---------------- */
  VIEWS.security = async function(){
    const d = await api('GET', '/me/sessions');
    $('#view').innerHTML = head('Devices & security', 'Places where your account is currently logged in. If you see something you do not recognise, log out the other devices and change your password.',
        '<button class="btn btn-danger btn-sm" id="outOthers">Log out all other devices</button>') +
      '<div class="ptable-wrap"><table class="ptable"><thead><tr><th>Logged in</th><th>Network address</th><th>Expires</th><th></th></tr></thead><tbody>' +
      d.sessions.map(s => '<tr><td>' + fmtDate(s.created) + '</td><td>' + esc(s.ip || '—') + '</td><td>' + fmtDate(s.expires) + '</td><td>' + (s.current ? '<span class="pill-status st-active">This device</span>' : '') + '</td></tr>').join('') + '</tbody></table></div>' +
      '<p class="hint">Sessions end automatically after a few hours. Accounts lock for 15 minutes after repeated wrong passwords.</p>';
    $('#outOthers').addEventListener('click', async () => { await api('POST', '/me/logout-others'); toast('Other devices logged out.'); VIEWS.security(); });
  };

  if (page === 'login') initLogin();
  if (page === 'set-password') initSetPassword();
  if (page === 'forgot') initForgot();
  if (page === 'dashboard') initDashboard();
})();
