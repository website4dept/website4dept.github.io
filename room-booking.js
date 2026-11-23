/* =====================================================================
   Book a seminar hall or classroom — the public form
   =====================================================================
   Talks to backend/bookings.py through /api/bookings/open/...
   Anyone in the department may use it, but only with the official e-mail
   address the department already holds for them. A six-digit code sent to
   that address finishes the request, so nobody can book in another
   person's name.

   This page needs the portal server. On the GitHub copy of the website
   there is no server, so the form explains that instead of failing.
   ===================================================================== */
(function(){
  'use strict';

  const $ = s => document.querySelector(s);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const wrap = $('#bkFormWrap');
  if (!wrap) return;

  let CFG = null, TICKET = null, LAST = null;

  async function api(method, path, body){
    let res;
    try {
      res = await fetch('api/bookings/open' + path, {
        method, headers: {'Content-Type': 'application/json'},
        body: body === undefined ? undefined : JSON.stringify(body)
      });
    } catch (e){ throw Object.assign(new Error('offline'), {offline: true}); }
    let data = null;
    if ((res.headers.get('content-type') || '').includes('application/json')) data = await res.json();
    if (!res.ok){
      if (res.status === 404 || res.status === 405) throw Object.assign(new Error('offline'), {offline: true});
      throw new Error((data && data.error) || ('Request failed (' + res.status + ').'));
    }
    return data;
  }

  function say(msg, kind){
    const el = $('#bkStatus');
    if (!msg){ el.hidden = true; return; }
    el.className = 'rb-status' + (kind ? ' is-' + kind : '');
    el.innerHTML = msg;
    el.hidden = false;
    el.scrollIntoView({block: 'center', behavior: 'smooth'});
  }

  function offline(){
    wrap.innerHTML = '<div class="empty-state"><h3>Online booking is not available on this copy of the site</h3>' +
      '<p>The booking system runs on the department server. This page is being served from the public ' +
      'copy of the website, which cannot take requests.</p>' +
      '<p>Please contact the department office &mdash; see <a href="contact.html">Contact Us</a>.</p></div>';
  }

  const dayText = d => {
    const dt = new Date(d + 'T00:00:00');
    return isNaN(dt) ? d : dt.toLocaleDateString(undefined, {weekday: 'long', day: '2-digit', month: 'short', year: 'numeric'});
  };
  const addDays = (d, n) => { const t = new Date(d + 'T00:00:00'); t.setDate(t.getDate() + n); return t.toISOString().slice(0, 10); };

  /* ---------------- time helpers ---------------- */
  const mins = t => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
  const hhmm = m => String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');
  const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const monthOf = d => d.slice(0, 7);
  const shiftMonth = (ym, n) => {
    let y = Number(ym.slice(0, 4)), m = Number(ym.slice(5, 7)) - 1 + n;
    y += Math.floor(m / 12); m = ((m % 12) + 12) % 12;
    return y + '-' + String(m + 1).padStart(2, '0');
  };
  const MIN_SLOT = 30;                       // a gap shorter than this is not worth offering

  /* Free stretches of a day: the opening hours minus what is already confirmed. */
  function freeGaps(booked, dayStart, dayEnd){
    const taken = booked.filter(b => b.status === 'approved')
                        .map(b => [mins(b.start), mins(b.end)])
                        .sort((a, b) => a[0] - b[0]);
    const gaps = [];
    let at = mins(dayStart);
    const end = mins(dayEnd);
    for (const [s0, e0] of taken){
      if (s0 - at >= MIN_SLOT) gaps.push([at, s0]);
      at = Math.max(at, e0);
    }
    if (end - at >= MIN_SLOT) gaps.push([at, end]);
    return gaps;
  }

  /* ---------------- the page ---------------- */
  let SEL = {room: null, month: null, date: null, data: null};

  function drawForm(){
    const rooms = CFG.rooms;
    SEL.room = SEL.room || rooms[0].id;
    SEL.date = SEL.date || CFG.today;
    SEL.month = monthOf(SEL.date);

    wrap.innerHTML =
      (CFG.register_ready ? '' :
        '<div class="rb-status is-warn">The department’s list of e-mail addresses has not been loaded yet, ' +
        'so the form cannot accept requests. Please contact the department office.</div>') +

      '<section class="card rb-pick">' +
        '<h3>1 &nbsp;Choose a room and a time</h3>' +
        '<div class="rb-roomrow">' +
          '<label><span class="lbl">Room</span><select id="rbRoom">' +
            rooms.map(r => '<option value="' + r.id + '"' + (r.id === SEL.room ? ' selected' : '') + '>' +
              esc(r.name) + (r.capacity ? ' — ' + r.capacity + ' seats' : '') + '</option>').join('') +
          '</select></label>' +
          '<p class="rb-roomnote" id="rbRoomNote"></p>' +
        '</div>' +
        '<div id="rbCal" class="rb-cal"><p class="hint">Loading the calendar…</p></div>' +
        '<div id="rbDay" class="rb-day"></div>' +
      '</section>' +

      '<form class="pform rb-form" id="rbForm" novalidate>' +
        '<h3>2 &nbsp;Who is asking</h3>' +
        '<div class="rb-grid">' +
          '<label><span class="lbl">Your name <b class="req">*</b></span><input name="name" required maxlength="120" autocomplete="name"></label>' +
          '<label><span class="lbl">Official e-mail <b class="req">*</b></span>' +
            '<input type="email" name="email" required maxlength="160" autocomplete="email" placeholder="name@iitkgp.ac.in">' +
            '<span class="field-note">The address the department has on record for you.</span></label>' +
          '<label><span class="lbl">Roll number</span>' +
            '<input name="roll" maxlength="40"><span class="field-note">Students and research scholars.</span></label>' +
          '<label><span class="lbl">Phone <b class="req">*</b></span><input name="phone" required maxlength="40" inputmode="tel" autocomplete="tel"></label>' +
          '<label class="full"><span class="lbl">Supervisor, mentor or faculty advisor <b class="req">*</b></span>' +
            '<select name="advisor_id"><option value="">— choose a faculty member —</option>' +
              CFG.faculty.map(f => '<option value="' + esc(f.id) + '">' + esc(f.name) + '</option>').join('') +
            '</select>' +
            '<span class="field-note">Faculty members booking for themselves may choose their own name. ' +
            'This person is copied in on the e-mails.</span></label>' +
        '</div>' +

        '<h3>3 &nbsp;When, and what for</h3>' +
        '<div class="rb-grid">' +
          '<label><span class="lbl">Date <b class="req">*</b></span><input type="date" name="date" required ' +
            'min="' + esc(CFG.today) + '" max="' + esc(addDays(CFG.today, CFG.max_days_ahead)) + '" value="' + esc(SEL.date) + '"></label>' +
          '<label><span class="lbl">From <b class="req">*</b></span><input type="time" name="start" required value="10:00"></label>' +
          '<label><span class="lbl">To <b class="req">*</b></span><input type="time" name="end" required value="11:00"></label>' +
          '<label><span class="lbl">People expected</span><input type="number" name="attendees" min="0" step="1"></label>' +
          '<label class="rb-spacer"><span class="lbl">&nbsp;</span><span class="field-note">Rooms can be booked between ' +
            esc(CFG.day_start) + ' and ' + esc(CFG.day_end) + '. Pick a free slot above and these fill in for you.</span></label>' +
          '<label class="full"><span class="lbl">What is the room for? <b class="req">*</b></span>' +
            '<input name="title" required maxlength="160" placeholder="Seminar: Lattice-based cryptography">' +
            '<span class="field-note">This is what appears on the department calendar.</span></label>' +
          '<label class="full"><span class="lbl">Anything the office should know</span>' +
            '<textarea name="purpose" rows="3" maxlength="2000"></textarea></label>' +
          '<label class="full"><span class="lbl">What you need in the room</span>' +
            '<input name="needs" maxlength="400" placeholder="Projector, microphone, extra chairs"></label>' +
          '<label class="check"><input type="checkbox" name="outside"> An outside organisation or visitor group is involved</label>' +
        '</div>' +
        '<div class="rb-actions"><button class="btn btn-maroon" type="submit">Send me a code</button></div>' +
      '</form>';

    const f = $('#rbForm').elements;

    $('#rbRoom').addEventListener('change', e => {
      SEL.room = Number(e.target.value); SEL.data = null; roomNote(); loadMonth();
    });
    f.date.addEventListener('change', () => {
      if (!f.date.value) return;
      SEL.date = f.date.value;
      if (monthOf(SEL.date) !== SEL.month){ SEL.month = monthOf(SEL.date); loadMonth(); }
      else { paintCal(); showDay(); }
    });

    function roomNote(){
      const r = rooms.find(x => x.id === SEL.room) || {};
      $('#rbRoomNote').innerHTML = [r.location ? esc(r.location) : '', r.facilities ? esc(r.facilities) : '',
        r.custodian ? 'Key: ' + esc(r.custodian) : '',
        r.needs_hod ? '<strong>Approved by the Head of the Department</strong>' : 'Confirmed by the department office'
      ].filter(Boolean).join(' · ');
    }
    roomNote();

    /* ----- the month grid ----- */
    async function loadMonth(){
      $('#rbCal').innerHTML = '<p class="hint">Loading the calendar…</p>';
      try {
        SEL.data = await api('GET', '/month?room=' + SEL.room + '&month=' + SEL.month);
        paintCal(); showDay();
      } catch (err){
        if (err.offline) return offline();
        $('#rbCal').innerHTML = '<p class="hint">' + esc(err.message) + '</p>';
      }
    }

    function dayState(date){
      const d = SEL.data;
      if (d.closed[date]) return ['closed', d.closed[date]];
      const list = d.days[date] || [];
      const gaps = freeGaps(list, d.day_start, d.day_end);
      if (!gaps.length) return ['full', 'Fully booked'];
      if (list.some(x => x.status === 'approved')) return ['part', 'Part free'];
      return ['free', 'Free'];
    }

    function paintCal(){
      const d = SEL.data;
      const y = Number(SEL.month.slice(0, 4)), m = Number(SEL.month.slice(5, 7)) - 1;
      const firstDow = new Date(y, m, 1).getDay();
      const total = new Date(y, m + 1, 0).getDate();
      const canPrev = SEL.month > monthOf(CFG.today);
      const canNext = SEL.month < monthOf(d.horizon);
      let cells = '';
      for (let i = 0; i < firstDow; i++) cells += '<span class="rb-pad"></span>';
      for (let n = 1; n <= total; n++){
        const date = SEL.month + '-' + String(n).padStart(2, '0');
        const [state, label] = dayState(date);
        const on = date === SEL.date;
        cells += '<button type="button" class="rb-dy is-' + state + (on ? ' is-sel' : '') + '"' +
          (state === 'closed' ? ' disabled' : '') + ' data-date="' + date + '" ' +
          'title="' + esc(label) + '" aria-label="' + esc(date + ' — ' + label) + '">' +
          '<span class="rb-dn">' + n + '</span><span class="rb-dm"></span></button>';
      }
      $('#rbCal').innerHTML =
        '<div class="rb-calhead">' +
          '<button type="button" class="rb-nav" id="rbPrev"' + (canPrev ? '' : ' disabled') + ' aria-label="Previous month">‹</button>' +
          '<strong>' + MONTHS[m] + ' ' + y + '</strong>' +
          '<button type="button" class="rb-nav" id="rbNext"' + (canNext ? '' : ' disabled') + ' aria-label="Next month">›</button>' +
        '</div>' +
        '<div class="rb-dow"><span>Sun</span><span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span></div>' +
        '<div class="rb-grid-days">' + cells + '</div>' +
        '<div class="rb-legend"><span><i class="k-free"></i>Free</span><span><i class="k-part"></i>Partly booked</span>' +
          '<span><i class="k-full"></i>Fully booked</span><span><i class="k-closed"></i>Not available</span></div>';

      const prev = $('#rbPrev'), next = $('#rbNext');
      if (prev) prev.addEventListener('click', () => { SEL.month = shiftMonth(SEL.month, -1); loadMonth(); });
      if (next) next.addEventListener('click', () => { SEL.month = shiftMonth(SEL.month, 1); loadMonth(); });
      wrap.querySelectorAll('.rb-dy').forEach(b => b.addEventListener('click', () => {
        SEL.date = b.dataset.date;
        f.date.value = SEL.date;
        paintCal(); showDay();
      }));
    }

    /* ----- the chosen day ----- */
    function showDay(){
      const d = SEL.data;
      const box = $('#rbDay');
      if (!d || monthOf(SEL.date) !== SEL.month){ box.innerHTML = ''; return; }
      const closed = d.closed[SEL.date];
      if (closed){
        box.innerHTML = '<h4>' + esc(dayText(SEL.date)) + '</h4><p class="rb-warn">Not available (' + esc(closed) + ').</p>';
        return;
      }
      const list = d.days[SEL.date] || [];
      const booked = list.filter(x => x.status === 'approved');
      const waiting = list.filter(x => x.status !== 'approved');
      const gaps = freeGaps(list, d.day_start, d.day_end);
      box.innerHTML = '<h4>' + esc(dayText(SEL.date)) + '</h4>' +
        (booked.length
          ? '<p class="rb-sub">Already booked</p><ul class="rb-slots">' + booked.map(x =>
              '<li><strong>' + esc(x.start) + '–' + esc(x.end) + '</strong> ' + esc(x.title) +
              (x.by ? ' <small>' + esc(x.by) + '</small>' : '') + '</li>').join('') + '</ul>'
          : '<p class="hint">Nothing booked in this room on that day.</p>') +
        (gaps.length
          ? '<p class="rb-sub">Free — choose one to fill the form in</p><div class="rb-gaps">' +
            gaps.map(g => '<button type="button" class="rb-gap" data-s="' + hhmm(g[0]) + '" data-e="' + hhmm(g[1]) + '">' +
              hhmm(g[0]) + ' – ' + hhmm(g[1]) + '</button>').join('') + '</div>'
          : '<p class="rb-warn">This room is fully booked that day.</p>') +
        (waiting.length ? '<p class="hint">Also asked for, not yet decided: ' +
            waiting.map(x => esc(x.start) + '–' + esc(x.end)).join(', ') + '</p>' : '');

      wrap.querySelectorAll('.rb-gap').forEach(b => b.addEventListener('click', () => {
        const s0 = mins(b.dataset.s), e0 = mins(b.dataset.e);
        f.date.value = SEL.date;
        f.start.value = b.dataset.s;
        f.end.value = hhmm(Math.min(s0 + 60, e0));        // an hour by default; change it if you like
        wrap.querySelectorAll('.rb-gap').forEach(x => x.classList.remove('is-on'));
        b.classList.add('is-on');
        f.name.focus({preventScroll: true});
        document.querySelector('#rbForm').scrollIntoView({behavior: 'smooth', block: 'start'});
      }));
    }

    loadMonth();

    $('#rbForm').addEventListener('submit', async ev => {
      ev.preventDefault();
      const body = {name: f.name.value.trim(), email: f.email.value.trim(), roll: f.roll.value.trim(),
                    phone: f.phone.value.trim(), advisor_id: f.advisor_id.value,
                    room_id: SEL.room, date: f.date.value, start: f.start.value, end: f.end.value,
                    title: f.title.value.trim(), purpose: f.purpose.value.trim(), needs: f.needs.value.trim(),
                    attendees: Number(f.attendees.value || 0), outside: f.outside.checked};
      for (const [k, label] of [['name', 'your name'], ['email', 'your e-mail address'],
                                ['phone', 'a phone number'], ['date', 'a date'], ['title', 'what the room is for']]){
        if (!body[k]){ say('Please give ' + label + '.', 'warn'); return; }
      }
      const btn = ev.target.querySelector('button[type=submit]');
      btn.disabled = true; btn.textContent = 'Sending the code…';
      try {
        const r = await api('POST', '/start', body);
        LAST = body; TICKET = r.ticket;
        drawCode(r);
      } catch (err){
        if (err.offline) return offline();
        say(esc(err.message), 'warn');
        btn.disabled = false; btn.textContent = 'Send me a code';
      }
    });
  }

  /* ---------------- step two: the code ---------------- */
  function drawCode(r){
    say('');
    wrap.innerHTML =
      '<div class="card rb-code"><h3>Check your e-mail</h3>' +
      '<p>We have sent a six-digit code to <strong>' + esc(r.sent_to) + '</strong>. ' +
      'Type it in below to send the request. The code is valid for ' + r.minutes + ' minutes.</p>' +
      (r.advisor ? '<p class="hint">' + esc(r.advisor) + ' will be copied in on the e-mails' +
        (r.advisor_notified ? '' : ', once the department has their address on file') + '.</p>' : '') +
      '<form class="pform" id="rbCode"><div class="rb-grid">' +
        '<label><span class="lbl">Six-digit code</span><input name="code" inputmode="numeric" autocomplete="one-time-code" ' +
          'maxlength="6" pattern="[0-9]{6}" required class="rb-otp" autofocus></label>' +
      '</div><div class="rb-actions"><button class="btn btn-maroon" type="submit">Send the request</button>' +
      '<button class="btn btn-outline" type="button" id="rbBack">Start again</button></div></form></div>';

    $('#rbBack').addEventListener('click', () => { TICKET = null; drawForm(); });
    $('#rbCode').addEventListener('submit', async ev => {
      ev.preventDefault();
      const code = ev.target.elements.code.value.trim();
      const btn = ev.target.querySelector('button[type=submit]');
      btn.disabled = true; btn.textContent = 'Sending…';
      try {
        const done = await api('POST', '/confirm', {ticket: TICKET, code: code});
        drawDone(done);
      } catch (err){
        if (err.offline) return offline();
        say(esc(err.message), 'warn');
        btn.disabled = false; btn.textContent = 'Send the request';
      }
    });
  }

  /* ---------------- step three: done ---------------- */
  function drawDone(d){
    say('');
    const who = d.approved ? '' : 'It is now with <strong>' + esc(d.waiting_with) + '</strong>.';
    wrap.innerHTML =
      '<div class="card rb-done">' +
        '<h3>' + (d.approved ? 'Your room is booked' : 'Request sent') + '</h3>' +
        '<p class="rb-ref">Reference <strong>' + esc(d.ref) + '</strong></p>' +
        '<p>' + (d.approved
          ? 'The room is confirmed and a confirmation e-mail is on its way.'
          : 'A confirmation e-mail is on its way. ' + who +
            ' You will be e-mailed again in the same conversation once it has been decided.') + '</p>' +
        (d.advisor ? '<p class="hint">' + esc(d.advisor) + ' and the department office have been copied in.</p>' : '') +
        '<div class="rb-actions"><button class="btn btn-maroon" type="button" id="rbAgain">Book another room</button>' +
        '<a class="btn btn-outline" href="index.html">Back to the home page</a></div>' +
      '</div>';
    $('#rbAgain').addEventListener('click', () => { TICKET = null; drawForm(); });
  }

  /* ---------------- giving a room back ----------------
     Reached from the link in the confirmation e-mail. Opening the page changes
     nothing: the booking is only released when the button here is pressed,
     because mail scanners follow links in e-mails by themselves. */
  async function drawRelease(token){
    let info;
    try {
      info = await api('GET', '/release?t=' + encodeURIComponent(token));
    } catch (err){
      if (err.offline) return offline();
      wrap.innerHTML = '<div class="empty-state"><h3>That link is no longer valid</h3><p>' + esc(err.message) +
        '</p><p><a class="link-arrow" href="room-booking.html">Book a room</a></p></div>';
      return;
    }
    const when = esc(info.pretty) + ', ' + esc(info.start) + '–' + esc(info.end);
    if (!info.can_release){
      wrap.innerHTML = '<div class="card"><h3>Nothing to give back</h3>' +
        '<p>Booking <strong>' + esc(info.ref) + '</strong> (' + esc(info.room) + ', ' + when +
        ') is no longer a confirmed future booking.</p>' +
        '<div class="rb-actions"><a class="btn btn-maroon" href="room-booking.html">Book a room</a></div></div>';
      return;
    }
    wrap.innerHTML =
      '<div class="card"><h3>Give this room back?</h3>' +
      '<p>If you no longer need it, releasing the slot lets somebody else use it.</p>' +
      '<ul class="rb-slots"><li><strong>' + esc(info.room) + '</strong> — ' + when + '</li></ul>' +
      '<p>' + esc(info.title) + ' <small>(' + esc(info.ref) + ')</small></p>' +
      '<div class="rb-actions"><button class="btn btn-maroon" type="button" id="rbRel">Yes, give it back</button>' +
      '<a class="btn btn-outline" href="index.html">No, keep it</a></div></div>';
    $('#rbRel').addEventListener('click', async ev => {
      ev.target.disabled = true; ev.target.textContent = 'Releasing…';
      try {
        const r = await api('POST', '/release', {t: token});
        wrap.innerHTML = '<div class="card rb-done"><h3>Room given back</h3>' +
          '<p><strong>' + esc(r.room) + '</strong>, ' + esc(r.pretty) + ', ' + esc(r.start) + '–' + esc(r.end) +
          ' is free again. The department office has been told.</p>' +
          '<div class="rb-actions"><a class="btn btn-maroon" href="room-booking.html">Book another room</a>' +
          '<a class="btn btn-outline" href="index.html">Back to the home page</a></div></div>';
      } catch (err){
        if (err.offline) return offline();
        say(esc(err.message), 'warn');
        ev.target.disabled = false; ev.target.textContent = 'Yes, give it back';
      }
    });
  }

  /* ---------------- start ---------------- */
  (async function(){
    const token = new URLSearchParams(location.search).get('release');
    if (token) return drawRelease(token);
    try {
      CFG = await api('GET', '/config');
      drawForm();
    } catch (err){
      if (err.offline) return offline();
      wrap.innerHTML = '<div class="empty-state"><h3>The booking form could not be loaded</h3><p>' +
        esc(err.message) + '</p></div>';
    }
  })();
})();
