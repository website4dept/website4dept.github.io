/* =====================================================================
   Seminar hall & classroom booking — the portal screens
   =====================================================================
   Goes with backend/bookings.py.  Loaded by portal/index.html BEFORE
   portal.js, and adds itself to window.PORTAL_MODULES; portal.js then
   gives it the menu and its pages.  Nothing in portal.js depends on this
   file, so removing the one <script> line switches the screens off.

   The pages it adds
     #bookings      Book a room      faculty and research scholars
     #bkqueue       Booking requests the two office staff
     #bkapprovals   Approvals        the Head of the Department
     #bkrooms       Rooms & halls    admin
   ===================================================================== */
(function(){
  'use strict';

  window.PORTAL_MODULES = window.PORTAL_MODULES || [];
  let P = null;                                   // the portal helpers, set on first use
  const ready = () => (P = P || window.PORTAL);

  /* The admin account can see every booking screen but decide nothing on it -
     the reasoning is in the note at the top of backend/bookings.py. These say
     whether the buttons should be drawn at all. The server checks again
     anyway, so a page left open cannot get round it. */
  const canOffice = () => ready().me().role === 'office';
  const canHod    = () => ready().me().role === 'hod';
  const watchOnly = () => ready().me().role === 'admin';
  const watchNote = whose =>
    !watchOnly() ? '' :
    '<div class="bk-watch"><strong>You are signed in as the admin.</strong> ' +
    'You can see everything on this page, but deciding a booking needs the ' + whose + '.</div>';

  // The office queue can be opened by the Head as well, so say whose desk it is.
  const queueNote = () =>
    canOffice() ? '' :
    watchOnly() ? watchNote('department office account') :
    '<div class="bk-watch">This is the <strong>department office\u2019s desk</strong>, shown to you so ' +
    'you can see what is coming. Forwarding, returning and refusing are theirs to do. ' +
    'What is waiting for you is on <a href="#bkapprovals">Approvals</a>.</div>';

  const recordsNote = () =>
    !watchOnly() ? '' :
    '<div class="bk-watch"><strong>You are signed in as the admin.</strong> ' +
    'This is the whole record, so you can follow anything that happens — but acting on a ' +
    'booking is the department office’s job, or the Head’s. If somebody needs to be able to ' +
    'act, give them the <strong>office</strong> role in Accounts rather than this one.</div>';

  /* ---------- small helpers ---------- */
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const STATE_CLASS = {approved: 'st-active', pending: 'st-pending', forwarded: 'st-pending',
                       returned: 'st-pending', rejected: 'st-disabled', cancelled: 'st-disabled'};
  const chip = b => '<span class="pill-status ' +
                    (b.awaiting_office ? 'st-pending' : (STATE_CLASS[b.status] || '')) + '">' +
                    esc(b.status_label) + (b.auto ? ' · auto' : '') + '</span>';

  /* The office checklist, shown before a request is forwarded or confirmed.
     Everything in it is checked again on the server, so a stale page cannot
     wave anything through. */
  const MARK = {ok: '✓', warn: '!', stop: '✕'};
  async function checkPanel(id, next, after){
    const {api, $, toast} = ready();
    const box = $('#bkCheckBox');
    if (!box) return;
    box.innerHTML = '<div class="card bk-check"><p class="hint">Checking…</p></div>';
    box.scrollIntoView({block: 'nearest'});
    let d;
    try { d = await api('GET', '/bookings/' + id + '/check'); }
    catch (err){ box.innerHTML = ''; return toast(err.message, true); }
    const b = d.booking;
    // 'look' is the read-only form: the same checklist with nothing to press.
    const label = next === 'forward' ? 'Forward to the Head' : 'Confirm booking';
    box.innerHTML =
      '<div class="card bk-check"><h3>' +
        (next === 'look' ? 'Checklist for ' : next === 'forward' ? 'Before you forward: '
                                                                : 'Before you confirm: ') + esc(b.ref) + '</h3>' +
      '<p class="hint"><strong>' + esc(b.room) + '</strong> · ' + when(b) + ' · ' +
        esc(b.title) + ' · asked by ' + esc(b.by) + '</p>' +
      '<ul class="bk-checklist">' + d.checks.map(c =>
        '<li class="is-' + c.level + '"><span class="bk-mark">' + MARK[c.level] + '</span>' +
        '<span><strong>' + esc(c.what) + '</strong>' +
        (c.detail ? '<small>' + esc(c.detail) + '</small>' : '') + '</span></li>').join('') + '</ul>' +
      (next !== 'confirm' && d.auto && d.auto.ok
        ? '<p class="hint">The Head’s standing approval covers this one, so forwarding approves it ' +
          'at once' + (d.office_auto_confirm ? ' and it goes straight out to the person who asked.'
                                             : ' and it then waits here for you to confirm.') + '</p>'
        : '') +
      (d.stop
        ? '<p class="bk-warn">This cannot go forward as it stands.' +
          (next === 'look' ? '' : ' Send it back for correction, or refuse it.') + '</p>'
        : '') +
      '<div class="view-actions">' +
        (d.stop || next === 'look' ? ''
          : '<button class="btn btn-maroon" data-go="' + id + '" data-next="' + next + '">' + label + '</button>') +
        '<button class="btn btn-light" id="bkCheckClose">Close</button></div></div>';
    $('#bkCheckClose').addEventListener('click', () => { box.innerHTML = ''; });
    const go = box.querySelector('[data-go]');
    if (go) go.addEventListener('click', async () => {
      go.disabled = true;
      try {
        const r = await api('POST', '/bookings/' + id + '/office', {action: next, note: ''});
        toast(r.confirmed ? 'Confirmed. The e-mail has gone to the person who asked'
                            + (b.supervisor ? ', with a copy to ' + b.supervisor + ' and the office.' : ' and the office.')
            : r.status === 'approved' ? 'Approved under the Head’s standing approval. It is now in '
                                        + '“Ready to confirm” — nothing has been sent yet.'
            : 'Forwarded to the Head of the Department.');
        box.innerHTML = '';
        after();
      } catch (err){ go.disabled = false; toast(err.message, true); }
    });
  }
  const when = b => esc(dayText(b.date)) + ', ' + esc(b.start) + '–' + esc(b.end);
  const slot = b => esc(b.start) + '–' + esc(b.end);

  function dayText(d){
    const dt = new Date(d + 'T00:00:00');
    return isNaN(dt) ? d : dt.toLocaleDateString(undefined, {weekday: 'short', day: '2-digit', month: 'short', year: 'numeric'});
  }
  function addDays(d, n){
    const dt = new Date(d + 'T00:00:00'); dt.setDate(dt.getDate() + n);
    return dt.toISOString().slice(0, 10);
  }
  function askNote(question, required){
    const v = prompt(question, '');
    if (v === null) return null;
    if (required && !v.trim()){ alert('Please give a short reason — it is sent to the person who asked.'); return null; }
    return v.trim();
  }

  /* =====================================================================
     1. Book a room   (faculty and research scholars)
     ===================================================================== */
  async function viewBookings(){
    const {api, esc: e, head, $, toast, alertBox, busy} = ready();
    const cfg = await api('GET', '/bookings/config');
    const mine = await api('GET', '/bookings/mine');

    if (!cfg.can_request){
      $('#view').innerHTML = head('Book a room',
        'Room requests are made by faculty members and research scholars. ' +
        'If you need a room, please ask the department office.') +
        myTable(mine.bookings);
      return wireMine();
    }

    const rooms = cfg.rooms;
    const first = cfg.today;
    $('#view').innerHTML = head('Book a room',
        'Choose a room, a date and a time. The department office checks every request; ' +
        'rooms marked “Head’s approval” then go to the Head of the Department. ' +
        'You are e-mailed at every step.') +
      '<div class="card"><h3>New request</h3><form class="pform" id="bkForm" novalidate><div class="pgrid pgrid-3">' +
        '<label>Room<select name="room_id" required>' +
          rooms.map(r => '<option value="' + r.id + '">' + e(r.name) +
            (r.capacity ? ' — ' + r.capacity + ' seats' : '') + '</option>').join('') +
        '</select></label>' +
        '<label>Date<input type="date" name="date" required min="' + e(cfg.today) +
          '" max="' + e(addDays(cfg.today, cfg.max_days_ahead)) + '" value="' + e(first) + '"></label>' +
        '<label>&nbsp;<span class="field-note" id="bkRoomNote"></span></label>' +
        '<label>From<input type="time" name="start" required value="10:00" min="' + e(cfg.day_start) + '" max="' + e(cfg.day_end) + '"></label>' +
        '<label>To<input type="time" name="end" required value="11:00" min="' + e(cfg.day_start) + '" max="' + e(cfg.day_end) + '"></label>' +
        '<label>People expected<input type="number" name="attendees" min="0" step="1" placeholder="e.g. 40"></label>' +
        '<label class="full">What is the room for? <span class="field-note">(this is what appears on the department calendar)</span>' +
          '<input name="title" required maxlength="160" placeholder="Seminar: Lattice-based cryptography"></label>' +
        '<label class="full">Anything the office should know <span class="field-note">(optional)</span>' +
          '<textarea name="purpose" rows="3" maxlength="2000" placeholder="Speaker, department, funding, special arrangements…"></textarea></label>' +
        '<label class="full">What you need in the room <span class="field-note">(optional)</span>' +
          '<input name="needs" maxlength="400" placeholder="Projector, microphone, extra chairs"></label>' +
        '<label class="check"><input type="checkbox" name="outside"> An outside organisation or visitor group is involved</label>' +
        '<label class="check"><input type="checkbox" name="hide_name"> Do not show my name on the public calendar</label>' +
        '<label class="full">Phone <span class="field-note">(for the office, never shown publicly)</span>' +
          '<input name="phone" maxlength="40" inputmode="tel"></label>' +
      '</div>' +
      '<div id="bkFree" class="bk-free" aria-live="polite"></div>' +
      '<div class="view-actions"><button class="btn btn-maroon" type="submit">Send the request</button></div></form></div>' +
      myTable(mine.bookings);

    const form = $('#bkForm'), f = form.elements;

    const showRoom = () => {
      const r = rooms.find(x => String(x.id) === f.room_id.value) || {};
      $('#bkRoomNote').innerHTML = [r.location ? e(r.location) : '', r.facilities ? e(r.facilities) : '',
        r.needs_hod ? '<strong>Head’s approval needed</strong>' : 'Confirmed by the office'].filter(Boolean).join(' · ');
    };

    /* what is already taken, so nobody asks for a slot that cannot be given */
    const showFree = async () => {
      const box = $('#bkFree');
      if (!f.date.value){ box.innerHTML = ''; return; }
      box.innerHTML = '<p class="hint">Checking what is free…</p>';
      try {
        const a = await api('GET', '/bookings/availability?date=' + encodeURIComponent(f.date.value) +
                                   '&room=' + encodeURIComponent(f.room_id.value));
        if (a.blackout){ box.innerHTML = '<p class="bk-warn">This date is blocked (' + e(a.blackout) + ').</p>'; return; }
        const taken = a.booked.filter(x => x.status === 'approved');
        const waiting = a.booked.filter(x => x.status !== 'approved');
        box.innerHTML = '<h4>' + e(dayText(f.date.value)) + '</h4>' +
          (taken.length ? '<ul class="bk-slots">' + taken.map(x =>
              '<li class="is-taken"><strong>' + e(x.start) + '–' + e(x.end) + '</strong> ' + e(x.title) +
              ' <small>' + e(x.by) + '</small></li>').join('') + '</ul>'
            : '<p class="hint">Nothing booked in this room on that day yet.</p>') +
          (waiting.length ? '<p class="hint">Also asked for, not yet decided: ' +
              waiting.map(x => e(x.start) + '–' + e(x.end)).join(', ') + '</p>' : '');
      } catch (err){ box.innerHTML = '<p class="hint">' + e(err.message) + '</p>'; }
    };

    f.room_id.addEventListener('change', () => { showRoom(); showFree(); });
    f.date.addEventListener('change', showFree);
    showRoom(); showFree();

    form.addEventListener('submit', async ev => {
      ev.preventDefault();
      const body = {room_id: Number(f.room_id.value), date: f.date.value, start: f.start.value, end: f.end.value,
                    title: f.title.value.trim(), purpose: f.purpose.value.trim(), needs: f.needs.value.trim(),
                    attendees: Number(f.attendees.value || 0), outside: f.outside.checked, hide_name: f.hide_name.checked,
                    phone: f.phone ? f.phone.value.trim() : ''};
      if (!body.title){ alertBox('Please say what the room is for.'); return; }
      const btn = form.querySelector('button[type=submit]');
      busy(btn, true, 'Sending…');
      try {
        const r = await api('POST', '/bookings', body);
        toast('Request sent — reference ' + r.booking.ref + '.');
        if (r.warning) alertBox(e(r.warning), 'info');
        viewBookings();
      } catch (err){ alertBox(e(err.message)); busy(btn, false); }
    });
    wireMine();
  }

  function myTable(list){
    return '<h3 class="bk-h3">My requests</h3>' +
      '<div class="ptable-wrap"><table class="ptable"><thead><tr><th>Date &amp; time</th><th>Room</th>' +
      '<th>Purpose</th><th>State</th><th></th></tr></thead><tbody>' +
      (list.length ? list.map(b =>
        '<tr><td>' + when(b) + '<br><small>' + esc(b.ref) + '</small></td>' +
        '<td>' + esc(b.room) + '</td>' +
        '<td>' + esc(b.title) + (b.note ? '<br><small>' + esc(b.note) + '</small>' : '') + '</td>' +
        '<td>' + chip(b) + '</td>' +
        '<td class="actions">' +
          (b.status === 'returned' ? '<button class="btn btn-light btn-sm" data-fix="' + b.id + '">Correct &amp; resend</button>' : '') +
          (['pending', 'returned', 'forwarded', 'approved'].indexOf(b.status) >= 0 ?
            '<button class="btn btn-danger btn-sm" data-cancel="' + b.id + '">Cancel</button>' : '') +
        '</td></tr>').join('')
        : '<tr><td colspan="5"><small>You have not asked for a room yet.</small></td></tr>') +
      '</tbody></table></div>';
  }

  function wireMine(){
    const {api, $$, toast} = ready();
    $$('[data-cancel]').forEach(b => b.addEventListener('click', async () => {
      if (!confirm('Cancel this booking? The office is told, and the slot becomes free.')) return;
      const note = askNote('Why are you cancelling? (optional)');
      if (note === null) return;
      try { await api('POST', '/bookings/' + b.dataset.cancel + '/cancel', {note: note}); toast('Cancelled.'); viewBookings(); }
      catch (err){ toast(err.message, true); }
    }));
    $$('[data-fix]').forEach(b => b.addEventListener('click', () => {
      window.scrollTo({top: 0, behavior: 'smooth'});
      alert('Change the details in the form above and send it again — it replaces the returned request.');
    }));
  }

  /* =====================================================================
     2. Booking requests   (the two office staff)
     ===================================================================== */
  async function viewQueue(){
    const {api, head, $, $$, toast} = ready();
    const d = await api('GET', '/bookings/queue');
    const c = d.counts;

    const row = b =>
      '<tr' + (b.conflict ? ' class="bk-conflict"' : '') + '><td>' + when(b) + '<br><small>' + esc(b.ref) + '</small></td>' +
      '<td>' + esc(b.room) + (b.needs_hod ? '<br><small>Head’s approval</small>' : '<br><small>office may confirm</small>') + '</td>' +
      '<td><strong>' + esc(b.title) + '</strong>' +
        (b.purpose ? '<br><small>' + esc(b.purpose) + '</small>' : '') +
        (b.needs ? '<br><small>Needs: ' + esc(b.needs) + '</small>' : '') +
        (b.attendees ? '<br><small>' + b.attendees + ' people</small>' : '') +
        (b.outside ? '<br><small><strong>Outside organisation</strong></small>' : '') + '</td>' +
      '<td>' + esc(b.by) + '<br><small>' + esc(b.email || '') + '</small>' +
        (b.roll ? '<br><small>Roll ' + esc(b.roll) + '</small>' : '') +
        (b.phone ? '<br><small>☎ ' + esc(b.phone) + '</small>' : '') +
        (b.advisor ? '<br><small>Advisor: ' + esc(b.advisor) +
          (b.advisor_notified ? '' : ' <em>(no e-mail on file)</em>') + '</small>' : '') +
        (b.source === 'public' ? '<br><small class="bk-src">from the website</small>' : '') + '</td>' +
      '<td>' + chip(b) +
        (b.conflict ? '<br><small class="bk-warn">clashes with a confirmed booking</small>' : '') +
        (b.competing.length ? '<br><small>also asked: ' + esc(b.competing.join('; ')) + '</small>' : '') + '</td>' +
      '<td class="actions">' +
        (b.status === 'forwarded'
          ? '<small class="bk-withhod">with the Head — his approval is still pending</small>'
          : (canOffice()
              ? '<button class="btn btn-maroon btn-sm" data-check="' + b.id + '" data-next="' +
                (b.needs_hod ? 'forward' : 'confirm') + '">Check &amp; ' +
                (b.needs_hod ? 'forward' : 'confirm') + '</button>'
              : '<button class="btn btn-light btn-sm" data-check="' + b.id + '" data-next="look">See the checklist</button>')) +
        (canOffice()
          ? '<button class="btn btn-light btn-sm" data-act="return" data-id="' + b.id + '">Return</button>' +
            '<button class="btn btn-danger btn-sm" data-act="reject" data-id="' + b.id + '">Reject</button>'
          : '') +
      '</td></tr>';

    const warn = (d.no_address || []).length
      ? '<div class="portal-alert info">The advisor e-mail cannot be sent for ' + d.no_address.length +
        ' faculty member' + (d.no_address.length === 1 ? '' : 's') + ' with no address on file: <strong>' +
        d.no_address.slice(0, 8).map(esc).join(', ') + (d.no_address.length > 8 ? ' and others' : '') +
        '</strong>. Import the addresses to switch those e-mails on.</div>'
      : '';
    const empty = !d.register
      ? '<div class="portal-alert">No e-mail addresses have been imported yet, so nobody can use the ' +
        'booking form on the website. Admin → Import data (JSON).</div>' : '';
    const confirmRow = b =>
      '<tr' + (b.conflict ? ' class="bk-conflict"' : '') + '><td>' + when(b) +
        '<br><small>' + esc(b.ref) + '</small></td>' +
      '<td>' + esc(b.room) + '</td>' +
      '<td><strong>' + esc(b.title) + '</strong>' +
        (b.needs ? '<br><small>Needs: ' + esc(b.needs) + '</small>' : '') + '</td>' +
      '<td>' + esc(b.by) + '<br><small>' + esc(b.email || '') + '</small>' +
        (b.supervisor ? '<br><small>Advisor: ' + esc(b.supervisor) + '</small>' : '') + '</td>' +
      '<td>' + (b.auto ? 'Standing approval' : 'Approved by the Head') +
        (b.note ? '<br><small>' + esc(b.note) + '</small>' : '') +
        (b.conflict ? '<br><small class="bk-warn">clashes with another confirmed booking</small>' : '') +
        (b.past ? '<br><small class="bk-warn">that date has passed</small>' : '') + '</td>' +
      '<td class="actions">' +
        (canOffice()
          ? '<button class="btn btn-maroon btn-sm" data-check="' + b.id + '" data-next="confirm">Check &amp; confirm</button>'
          : '<button class="btn btn-light btn-sm" data-check="' + b.id + '" data-next="look">See the checklist</button>') +
        '<button class="btn btn-danger btn-sm" data-revoke="' + b.id + '">Withdraw</button></td></tr>';

    $('#view').innerHTML = head('Booking requests',
        'Every room request lands here first. Check the details and that the room is really free, ' +
        'then forward a seminar hall to the Head of the Department or confirm a classroom yourself. ' +
        'The Head is only e-mailed once you forward. When he approves, the booking comes back to you ' +
        'in “Ready to confirm” — nothing reaches the person who asked until you confirm it.') +
      queueNote() + empty + warn +
      '<div class="stat-grid">' +
        '<div class="stat-card"><strong>' + c.pending + '</strong><span>waiting for you</span></div>' +
        '<div class="stat-card"><strong>' + c.forwarded + '</strong><span>with the Head, not yet approved</span></div>' +
        '<div class="stat-card' + (c.to_confirm ? ' is-urgent' : '') + '"><strong>' + c.to_confirm +
          '</strong><span>approved — ready for you to confirm</span></div>' +
        '<div class="stat-card"><strong>' + c.returned + '</strong><span>sent back for correction</span></div>' +
        '<div class="stat-card"><strong>' + d.upcoming.length + '</strong><span>confirmed, still to come</span></div>' +
      '</div>' +
      '<div id="bkCheckBox"></div>' +
      '<div class="ptable-wrap"><table class="ptable"><thead><tr><th>Date &amp; time</th><th>Room</th><th>Purpose</th>' +
        '<th>Asked by</th><th>State</th><th></th></tr></thead><tbody>' +
        (d.queue.length ? d.queue.map(row).join('') : '<tr><td colspan="6"><small>Nothing waiting. </small></td></tr>') +
        '</tbody></table></div>' +
      '<h3 class="bk-h3">Ready to confirm <small>(the Head has approved — nothing sent yet)</small></h3>' +
      '<div class="ptable-wrap"><table class="ptable"><thead><tr><th>Date &amp; time</th><th>Room</th><th>Purpose</th>' +
        '<th>Asked by</th><th>Approved</th><th></th></tr></thead><tbody>' +
        (d.to_confirm.length ? d.to_confirm.map(confirmRow).join('')
          : '<tr><td colspan="6"><small>Nothing is waiting to be confirmed.</small></td></tr>') +
        '</tbody></table></div>' +
      '<div class="card bk-switch"><label class="check"><input type="checkbox" id="bkAutoConfirm"' +
        (d.office_auto_confirm ? ' checked' : '') + (canOffice() ? '' : ' disabled') + '> ' +
        '<span><strong>Confirm as soon as the Head approves</strong>' +
        '<small>With this on, an approval goes straight out to the person who asked and nothing waits here. ' +
        'With it off (the usual setting) every approval comes back to you first.</small></span></label></div>' +
      '<h3 class="bk-h3">Confirmed bookings still to come</h3>' +
      '<div class="ptable-wrap"><table class="ptable"><thead><tr><th>Date &amp; time</th><th>Room</th><th>Purpose</th>' +
        '<th>Booked by</th><th></th></tr></thead><tbody>' +
        (d.upcoming.length ? d.upcoming.map(b => '<tr><td>' + when(b) + '<br><small>' + esc(b.ref) + '</small></td><td>' + esc(b.room) + '</td>' +
          '<td>' + esc(b.title) + (b.auto ? ' <small>(auto-approved)</small>' : '') + '</td><td>' + esc(b.by) + '</td>' +
          '<td class="actions">' +
          (b.on_board ? '<small>on the Notice Board</small>'
                      : (b.confirmed
                          ? (canOffice() || canHod()
                              ? '<button class="btn btn-light btn-sm" data-notice="' + b.id + '">Put on Notice Board</button>'
                              : '')
                          : '<small>confirm it first</small>')) +
          (canOffice() || canHod()
            ? '<button class="btn btn-light btn-sm" data-ns="' + b.id + '">' +
              (b.no_show ? 'Not used ✓' : 'Mark not used') + '</button>'
            : (b.no_show ? '<small>not used</small>' : '')) +
          '<button class="btn btn-danger btn-sm" data-revoke="' + b.id + '">Withdraw</button></td></tr>').join('')
          : '<tr><td colspan="5"><small>Nothing confirmed yet.</small></td></tr>') +
        '</tbody></table></div>';

    $$('[data-check]').forEach(btn => btn.addEventListener('click',
      () => checkPanel(Number(btn.dataset.check), btn.dataset.next, viewQueue)));

    const sw = $('#bkAutoConfirm');
    if (sw) sw.addEventListener('change', async () => {
      try {
        await api('PUT', '/bookings/settings', {office_auto_confirm: sw.checked});
        toast(sw.checked ? 'Bookings will now be confirmed the moment the Head approves.'
                         : 'Approvals will wait here for you to confirm.');
      } catch (err){ sw.checked = !sw.checked; toast(err.message, true); }
    });

    $$('[data-act]').forEach(btn => btn.addEventListener('click', async () => {
      const act = btn.dataset.act;
      let note = '';
      if (act === 'return') { note = askNote('What should they correct? This is e-mailed to them.', true); if (note === null) return; }
      if (act === 'reject') { note = askNote('Why is it refused? This is e-mailed to them.', true); if (note === null) return; }
      try {
        const r = await api('POST', '/bookings/' + btn.dataset.id + '/office', {action: act, note: note});
        toast(r.status === 'approved' ? (r.confirmed ? 'Confirmed and e-mailed.'
                                                     : 'Approved — now in “Ready to confirm”.')
            : r.status === 'forwarded' ? 'Forwarded to the Head of the Department.'
            : r.status === 'returned' ? 'Sent back for correction.' : 'Rejected.');
        viewQueue();
      } catch (err){ toast(err.message, true); }
    }));
    $$('[data-revoke]').forEach(btn => btn.addEventListener('click', async () => {
      const note = askNote('Why is this confirmed booking being withdrawn? The faculty member is e-mailed.', true);
      if (note === null) return;
      try { await api('POST', '/bookings/' + btn.dataset.revoke + '/revoke', {note: note}); toast('Withdrawn.'); viewQueue(); }
      catch (err){ toast(err.message, true); }
    }));
    wireExtras(viewQueue);
  }

  /* Buttons shared by the office queue and the Head's list. */
  function wireExtras(redraw){
    const {api, $$, toast} = ready();
    $$('[data-ns]').forEach(btn => btn.addEventListener('click', async () => {
      try { await api('POST', '/bookings/' + btn.dataset.ns + '/no-show', {}); toast('Updated.'); redraw(); }
      catch (err){ toast(err.message, true); }
    }));
    $$('[data-notice]').forEach(btn => btn.addEventListener('click', async () => {
      const speaker = prompt('Speaker\u2019s name for the Notice Board (leave empty if there is none):', '');
      if (speaker === null) return;
      const affiliation = speaker.trim() ? (prompt('Their institution (optional):', '') || '') : '';
      try {
        await api('POST', '/bookings/' + btn.dataset.notice + '/notice',
                  {speaker: speaker.trim(), affiliation: affiliation.trim()});
        toast('Added to the Notice Board and News & Events.');
        redraw();
      } catch (err){ toast(err.message, true); }
    }));
  }

  /* =====================================================================
     2b. Today   (the office: one page to print and pin up)
     ===================================================================== */
  async function viewToday(arg){
    const {api, head, $, $$, toast} = ready();
    const day = arg || '';
    const d = await api('GET', '/bookings/today' + (day ? '?date=' + encodeURIComponent(day) : ''));
    const shift = n => {
      const t = new Date(d.date + 'T00:00:00'); t.setDate(t.getDate() + n);
      return t.toISOString().slice(0, 10);
    };
    const room = r => {
      const list = d.bookings[r.id] || [];
      return '<section class="td-room' + (list.length ? '' : ' is-free') + '">' +
        '<h3>' + esc(r.name) + '<span>' + (r.capacity ? r.capacity + ' seats' : '') +
          (r.custodian ? ' · key: ' + esc(r.custodian) : '') + '</span></h3>' +
        (list.length
          ? '<ul class="td-list">' + list.map(b =>
              '<li' + (b.no_show ? ' class="is-noshow"' : '') + '><span class="td-time">' + esc(b.start) + '–' + esc(b.end) + '</span>' +
              '<span class="td-what"><strong>' + esc(b.title) + '</strong>' +
                (b.confirmed === false ? '<small class="bk-warn">not confirmed yet — the room is held but ' +
                  'nobody has been told</small>' : '') +
                (b.needs ? '<small>Needs: ' + esc(b.needs) + '</small>' : '') + '</span>' +
              '<span class="td-who">' + esc(b.by || '') +
                (b.phone ? '<small>☎ ' + esc(b.phone) + '</small>' : '') + '</span>' +
              '<span class="td-act">' + (canOffice() || canHod()
                ? '<button type="button" class="btn btn-light btn-sm" data-ns="' + b.id + '">' +
                  (b.no_show ? 'Not used ✓' : 'Mark not used') + '</button>'
                : (b.no_show ? '<small>not used</small>' : '')) +
              '</span></li>').join('') + '</ul>'
          : '<p class="td-free">Free all day</p>') +
      '</section>';
    };
    $('#view').innerHTML = head('Today',
        'Every confirmed booking for one day, across all rooms. Print this and pin it up.',
        '<button type="button" class="btn btn-maroon btn-sm" id="tdPrint">Print</button>') +
      '<div class="td-bar no-print">' +
        '<button type="button" class="btn btn-light btn-sm" data-day="' + shift(-1) + '">‹ Previous day</button>' +
        '<button type="button" class="btn btn-light btn-sm" data-day="">Today</button>' +
        '<button type="button" class="btn btn-light btn-sm" data-day="' + shift(1) + '">Next day ›</button>' +
        '<input type="date" id="tdDate" value="' + esc(d.date) + '">' +
      '</div>' +
      '<div class="td-sheet">' +
        '<div class="td-head"><h2>Room bookings — ' + esc(d.pretty) + '</h2>' +
          '<p>Department of Mathematics, IIT Kharagpur · ' + d.total +
          ' booking' + (d.total === 1 ? '' : 's') + '</p></div>' +
        (d.blackout ? '<p class="td-blackout">This date is blocked (' + esc(d.blackout) + ').</p>' : '') +
        d.rooms.map(room).join('') +
      '</div>';

    $('#tdPrint').addEventListener('click', () => window.print());
    $('#tdDate').addEventListener('change', e => viewToday(e.target.value));
    $$('[data-day]').forEach(b => b.addEventListener('click', () => viewToday(b.dataset.day)));
    $$('[data-ns]').forEach(b => b.addEventListener('click', async () => {
      try { await api('POST', '/bookings/' + b.dataset.ns + '/no-show', {});
            toast('Updated.'); viewToday(d.date); }
      catch (err){ toast(err.message, true); }
    }));
  }

  /* =====================================================================
     2c. Booking records   (the office, the Head and the admin)

     Every booking ever made, whatever became of it. This is where you answer
     "what happened to MA-B-2026-0042?" months later. Search covers the
     reference number, the name, the e-mail address, the roll number, the
     phone number, the purpose and the room.
     ===================================================================== */
  const REC = {q: '', status: 'all', room: '', from: '', to: '', sort: 'date', dir: 'desc', page: 1, open: 0};

  function recQuery(){
    const p = [];
    if (REC.q) p.push('q=' + encodeURIComponent(REC.q));
    if (REC.status && REC.status !== 'all') p.push('status=' + encodeURIComponent(REC.status));
    if (REC.room) p.push('room=' + encodeURIComponent(REC.room));
    if (REC.from) p.push('from=' + encodeURIComponent(REC.from));
    if (REC.to) p.push('to=' + encodeURIComponent(REC.to));
    p.push('sort=' + REC.sort, 'dir=' + REC.dir, 'page=' + REC.page);
    return '?' + p.join('&');
  }

  async function viewRecords(arg){
    const {api, head, $, $$, toast} = ready();
    // #bkrecords/42 opens that booking's record straight away, so a reference
    // number can be passed around as a link.
    if (arg && /^\d+$/.test(String(arg))) REC.open = Number(arg);
    const d = await api('GET', '/bookings/records' + recQuery());

    const arrow = key => REC.sort !== key ? '' : (REC.dir === 'asc' ? ' ▲' : ' ▼');
    const th = (key, label) =>
      '<th><button type="button" class="rec-sort' + (REC.sort === key ? ' is-on' : '') +
      '" data-sort="' + key + '">' + label + arrow(key) + '</button></th>';

    const row = b =>
      '<tr class="rec-row' + (REC.open === b.id ? ' is-open' : '') + '" data-open="' + b.id + '">' +
      '<td><strong>' + esc(b.ref || '—') + '</strong></td>' +
      '<td>' + when(b) + '</td>' +
      '<td>' + esc(b.room) + '</td>' +
      '<td>' + esc(b.title) + '</td>' +
      '<td>' + esc(b.by) + (b.roll ? '<br><small>Roll ' + esc(b.roll) + '</small>' : '') + '</td>' +
      '<td>' + chip(b) + '</td></tr>' +
      (REC.open === b.id ? '<tr class="rec-detail"><td colspan="6" id="recDetail">' +
        '<p class="hint">Loading…</p></td></tr>' : '');

    const first = d.total ? (d.page - 1) * d.per_page + 1 : 0;
    const last = Math.min(d.page * d.per_page, d.total);

    $('#view').innerHTML = head('Booking records',
        'Every room request ever made, whatever became of it. Search by reference number, ' +
        'name, e-mail address, roll number, phone number, purpose or room. Click any row to ' +
        'see everything that happened to that booking and who did it.') +
      recordsNote() +
      '<form class="rec-bar" id="recForm">' +
        '<input type="search" id="recQ" placeholder="MA-B-2026-0042, a name, a roll number…" ' +
          'value="' + esc(REC.q) + '" aria-label="Search the booking records">' +
        '<select id="recRoom" aria-label="Room"><option value="">Every room</option>' +
          d.rooms.map(r => '<option value="' + r.id + '"' + (String(REC.room) === String(r.id) ? ' selected' : '') +
            '>' + esc(r.name) + '</option>').join('') + '</select>' +
        '<label>From <input type="date" id="recFrom" value="' + esc(REC.from) + '"></label>' +
        '<label>To <input type="date" id="recTo" value="' + esc(REC.to) + '"></label>' +
        '<button class="btn btn-maroon btn-sm" type="submit">Search</button>' +
        '<button class="btn btn-light btn-sm" type="button" id="recClear">Clear</button>' +
      '</form>' +
      '<div class="rec-filters">' + d.filters.map(f =>
        '<button type="button" class="rec-pill' + (REC.status === f.key ? ' is-on' : '') +
        '" data-status="' + f.key + '">' + esc(f.label) +
        ' <span>' + (d.counts[f.key] || 0) + '</span></button>').join('') + '</div>' +
      '<p class="rec-count">' + (d.total
        ? 'Showing ' + first + '–' + last + ' of ' + d.total + ' booking' + (d.total === 1 ? '' : 's')
        : 'Nothing matches that search.') + '</p>' +
      '<div class="ptable-wrap"><table class="ptable rec-table"><thead><tr>' +
        th('ref', 'Reference') + th('date', 'Date &amp; time') + th('room', 'Room') +
        '<th>Purpose</th>' + th('by', 'Asked by') + th('status', 'State') +
        '</tr></thead><tbody>' +
        (d.rows.length ? d.rows.map(row).join('')
          : '<tr><td colspan="6"><small>No booking matches.</small></td></tr>') +
        '</tbody></table></div>' +
      (d.pages > 1
        ? '<div class="rec-pages">' +
            '<button class="btn btn-light btn-sm" data-page="' + (d.page - 1) + '"' +
              (d.page <= 1 ? ' disabled' : '') + '>‹ Previous</button>' +
            '<span>Page ' + d.page + ' of ' + d.pages + '</span>' +
            '<button class="btn btn-light btn-sm" data-page="' + (d.page + 1) + '"' +
              (d.page >= d.pages ? ' disabled' : '') + '>Next ›</button>' +
          '</div>'
        : '');

    const reload = () => { viewRecords(); };
    $('#recForm').addEventListener('submit', e => {
      e.preventDefault();
      REC.q = $('#recQ').value.trim();
      REC.room = $('#recRoom').value;
      REC.from = $('#recFrom').value;
      REC.to = $('#recTo').value;
      REC.page = 1; REC.open = 0;
      reload();
    });
    $('#recClear').addEventListener('click', () => {
      REC.q = ''; REC.room = ''; REC.from = ''; REC.to = '';
      REC.status = 'all'; REC.page = 1; REC.open = 0;
      reload();
    });
    $$('[data-status]').forEach(b => b.addEventListener('click', () => {
      REC.status = b.dataset.status; REC.page = 1; REC.open = 0; reload();
    }));
    $$('[data-sort]').forEach(b => b.addEventListener('click', () => {
      if (REC.sort === b.dataset.sort) REC.dir = (REC.dir === 'asc' ? 'desc' : 'asc');
      else { REC.sort = b.dataset.sort; REC.dir = 'desc'; }
      REC.page = 1; reload();
    }));
    $$('[data-page]').forEach(b => b.addEventListener('click', () => {
      REC.page = Number(b.dataset.page); REC.open = 0; reload();
    }));
    $$('[data-open]').forEach(tr => tr.addEventListener('click', () => {
      const id = Number(tr.dataset.open);
      REC.open = (REC.open === id ? 0 : id);
      reload();
    }));

    if (REC.open){
      try {
        const b = await api('GET', '/bookings/records/' + REC.open);
        const box = $('#recDetail');
        if (box) box.innerHTML = recordDetail(b);
      } catch (err){ toast(err.message, true); }
    }
  }

  function recordDetail(b){
    const line = (k, v) => v ? '<li><span>' + k + '</span>' + esc(v) + '</li>' : '';
    const stamp = t => { const d = new Date(t); return isNaN(d) ? t : d.toLocaleString(); };
    return '<div class="rec-detail-grid">' +
      '<div><h4>The request</h4><ul class="rec-facts">' +
        line('Reference', b.ref) +
        line('Room', b.room + (b.room_location ? ' · ' + b.room_location : '')) +
        line('When', dayText(b.date) + ', ' + b.start + '–' + b.end) +
        line('Purpose', b.title) +
        line('Details', b.purpose) +
        line('People', b.attendees ? String(b.attendees) : '') +
        line('Needs', b.needs) +
        (b.outside ? '<li><span>Outside</span>an outside organisation is involved</li>' : '') +
      '</ul></div>' +
      '<div><h4>Who asked</h4><ul class="rec-facts">' +
        line('Name', b.by) + line('E-mail', b.email) + line('Roll no.', b.roll) +
        line('Phone', b.phone) + line('Advisor', b.supervisor) +
        line('Came from', b.source === 'public' ? 'the booking form on the website' : 'the portal') +
      '</ul></div>' +
      '<div><h4>What happened</h4><ul class="rec-facts">' +
        line('Made', stamp(b.made)) +
        line('Forwarded', b.forwarded_at ? stamp(b.forwarded_at) + (b.forwarded_by ? ' by ' + b.forwarded_by : '') : '') +
        line('Decided', b.decided_at ? stamp(b.decided_at) + (b.decided_by ? ' by ' + b.decided_by : '') : '') +
        line('Confirmed', b.confirmed_at ? stamp(b.confirmed_at) + (b.confirmed_by ? ' by ' + b.confirmed_by : '') : '') +
        line('Note', b.note) +
        line('State', b.status_label) +
      '</ul></div></div>' +
      (b.history && b.history.length
        ? '<h4 class="rec-h4">Step by step</h4><ol class="rec-log">' + b.history.map(h =>
            '<li><span class="rec-when">' + esc(stamp(h.at)) + '</span>' +
            '<span class="rec-what">' + esc(h.action) +
            (h.note ? ' — ' + esc(h.note) : '') + '</span>' +
            '<span class="rec-who">' + esc(h.actor || '') + '</span></li>').join('') + '</ol>'
        : '');
  }

  /* =====================================================================
     3. Approvals   (the Head of the Department)
     ===================================================================== */
  async function viewApprovals(){
    const {api, head, $, $$, toast} = ready();
    const d = await api('GET', '/bookings/hod');

    const row = b =>
      '<tr><td><input type="checkbox" class="bk-pick" value="' + b.id + '" aria-label="Select ' + esc(b.ref) + '"></td>' +
      '<td>' + when(b) + '<br><small>' + esc(b.ref) + '</small></td>' +
      '<td>' + esc(b.room) + '</td>' +
      '<td><strong>' + esc(b.title) + '</strong>' +
        (b.purpose ? '<br><small>' + esc(b.purpose) + '</small>' : '') +
        (b.attendees ? '<br><small>' + b.attendees + ' people' +
          (b.room_capacity && b.attendees > b.room_capacity ? ' — more than the room holds' : '') + '</small>' : '') +
        (b.outside ? '<br><small><strong>Outside organisation</strong></small>' : '') + '</td>' +
      '<td>' + esc(b.by) +
        (b.roll ? '<br><small>Roll ' + esc(b.roll) + '</small>' : '') +
        (b.phone ? '<br><small>☎ ' + esc(b.phone) + '</small>' : '') +
        (b.advisor ? '<br><small>Advisor: ' + esc(b.advisor) + '</small>' : '') +
        (b.source === 'public' ? '<br><small class="bk-src">from the website</small>' : '') + '</td>' +
      '<td class="actions">' +
        (canHod()
          ? '<button class="btn btn-maroon btn-sm" data-decide="approve" data-id="' + b.id + '">Approve</button>' +
            '<button class="btn btn-danger btn-sm" data-decide="reject" data-id="' + b.id + '">Reject</button>'
          : '') + '</td></tr>';

    const dayBtns = (d.days || []).length && canHod()
      ? '<div class="bk-days"><span>Clear a whole day:</span>' + d.days.map(x =>
          '<button class="btn btn-light btn-sm" data-day-approve="' + esc(x.date) + '">' +
          esc(x.pretty) + ' (' + x.count + ')</button>').join('') + '</div>'
      : '';

    $('#view').innerHTML = head('Approvals',
        'Room requests the department office has checked and forwarded to you. Classrooms are ' +
        'confirmed by the office and do not appear here. Tick several and use “Approve selected”, ' +
        'or clear a whole day in one click. ' +
        (d.office_auto_confirm
          ? 'The office has asked for bookings to go out the moment you approve them.'
          : 'Your approval does not send anything on its own: the office confirms it afterwards, ' +
            'and that is what tells the person who asked. The list below shows what is still with them.')) +
      watchNote('Head of the Department’s own account') + dayBtns +
      '<div class="ptable-wrap"><table class="ptable"><thead><tr><th><input type="checkbox" id="bkAll" aria-label="Select all"></th>' +
        '<th>Date &amp; time</th><th>Room</th><th>Purpose</th><th>Asked by</th><th></th></tr></thead><tbody>' +
        (d.waiting.length ? d.waiting.map(row).join('')
          : '<tr><td colspan="6"><small>Nothing is waiting for you.</small></td></tr>') +
        '</tbody></table></div>' +
      (d.waiting.length && canHod()
        ? '<div class="view-actions"><button class="btn btn-maroon" id="bkMany">Approve selected</button>' +
          '<button class="btn btn-light" id="bkManyNo">Reject selected</button></div>' : '') +

      '<h3 class="bk-h3">Approved by you — waiting for the office to confirm</h3>' +
      '<div class="ptable-wrap"><table class="ptable"><thead><tr><th>Date &amp; time</th><th>Room</th>' +
        '<th>Purpose</th><th>Asked by</th><th>State</th></tr></thead><tbody>' +
        ((d.awaiting_office || []).length
          ? d.awaiting_office.map(b => '<tr><td>' + when(b) + '<br><small>' + esc(b.ref) + '</small></td>' +
              '<td>' + esc(b.room) + '</td><td>' + esc(b.title) + '</td><td>' + esc(b.by) + '</td>' +
              '<td>' + chip(b) + (b.auto ? '<br><small>standing approval</small>' : '') + '</td></tr>').join('')
          : '<tr><td colspan="5"><small>The office has confirmed everything you have approved.</small></td></tr>') +
        '</tbody></table></div>' +

      '<div class="card bk-auto"><h3>Standing approval</h3>' +
        '<p class="hint">Tick a room and <strong>routine</strong> requests for it are approved the moment ' +
        'the office checks them, without waiting for you. The office still confirms them afterwards. ' +
        'Anything unusual comes here instead: an outside organisation, longer than ' +
        d.max_hours + ' hours, more people than the room holds, or a clash. Every automatic approval is ' +
        'listed below and you can withdraw it.</p>' +
        '<form class="pform" id="bkAutoForm"><div class="pgrid pgrid-3">' +
          d.rooms.map(r => '<label class="check"><input type="checkbox" class="bk-auto-room" value="' + r.id + '"' +
            (r.auto_ok ? ' checked' : '') + (r.needs_hod ? '' : ' disabled') + '> ' + esc(r.name) +
            (r.needs_hod ? '' : ' <small>(office confirms this room anyway)</small>') + '</label>').join('') +
          '<label>Only until <span class="field-note">(leave empty for no end date)</span>' +
            '<input type="date" name="auto_until" value="' + esc(d.auto_until || '') + '" min="' + esc(d.today) + '"></label>' +
        '</div><div class="view-actions"><button class="btn btn-maroon" type="submit">Save</button></div></form></div>' +

      '<h3 class="bk-h3">The last few you decided ' +
        '<a class="bk-more" href="#bkrecords">All booking records \u2192</a></h3>' +
      '<div class="ptable-wrap"><table class="ptable"><thead><tr><th>Date &amp; time</th><th>Room</th><th>Purpose</th>' +
        '<th>Asked by</th><th>Outcome</th><th></th></tr></thead><tbody>' +
        (d.recent.length ? d.recent.slice(0, 5).map(b => '<tr><td>' + when(b) + '<br><small>' + esc(b.ref) + '</small></td>' +
          '<td>' + esc(b.room) + '</td><td>' + esc(b.title) + '</td>' +
          '<td>' + esc(b.by) + '</td><td>' + chip(b) + '</td>' +
          '<td class="actions">' + (b.status === 'approved' ?
            (b.confirmed
              ? (b.on_board ? '<small>on the Notice Board</small>'
                            : (canHod() || canOffice()
                                ? '<button class="btn btn-light btn-sm" data-notice="' + b.id + '">Put on Notice Board</button>'
                                : ''))
              : '<small class="bk-withhod">the office has still to confirm it</small>') +
            '<button class="btn btn-danger btn-sm" data-revoke="' + b.id + '">Withdraw</button>' : '') + '</td></tr>').join('')
          : '<tr><td colspan="6"><small>Nothing decided yet.</small></td></tr>') +
        '</tbody></table></div>' +
      '<p class="hint">Only the five most recent are shown here. Everything ever booked, ' +
        'searchable by reference number, is in <a href="#bkrecords">Booking records</a>.</p>';

    const picked = () => $$('.bk-pick').filter(x => x.checked).map(x => Number(x.value));
    const all = $('#bkAll');
    if (all) all.addEventListener('change', () => $$('.bk-pick').forEach(x => { x.checked = all.checked; }));

    $$('[data-decide]').forEach(btn => btn.addEventListener('click', async () => {
      const act = btn.dataset.decide;
      let note = '';
      if (act === 'reject'){ note = askNote('Why is it refused? This is e-mailed to them.', true); if (note === null) return; }
      try { const r = await api('POST', '/bookings/' + btn.dataset.id + '/decide', {action: act, note: note});
            toast(act !== 'approve' ? 'Rejected.'
                : r.confirmed ? 'Approved and sent out.'
                : 'Approved. The office will confirm it — nothing has been sent yet.');
            viewApprovals(); }
      catch (err){ toast(err.message, true); }
    }));

    const many = async act => {
      const ids = picked();
      if (!ids.length){ toast('Tick the requests first.', true); return; }
      let note = '';
      if (act === 'reject'){ note = askNote('Why are these refused? This is e-mailed to everyone concerned.', true); if (note === null) return; }
      else if (!confirm('Approve ' + ids.length + ' request' + (ids.length > 1 ? 's' : '') + '?')) return;
      try {
        const r = await api('POST', '/bookings/decide-many', {ids: ids, action: act, note: note});
        toast(r.done + ' done' + (r.failed.length ? ', ' + r.failed.length + ' could not be (clash or already decided)' : '') + '.',
              r.failed.length > 0);
        viewApprovals();
      } catch (err){ toast(err.message, true); }
    };
    if ($('#bkMany')) $('#bkMany').addEventListener('click', () => many('approve'));
    if ($('#bkManyNo')) $('#bkManyNo').addEventListener('click', () => many('reject'));

    $$('[data-day-approve]').forEach(btn => btn.addEventListener('click', async () => {
      const day = btn.dataset.dayApprove;
      if (!confirm('Approve everything waiting for ' + btn.textContent.trim() + '?')) return;
      try {
        const r = await api('POST', '/bookings/decide-many', {date: day, action: 'approve', note: ''});
        toast(r.done + ' approved' +
              (r.failed.length ? ', ' + r.failed.length + ' could not be (clash or already decided)' : '') +
              (d.office_auto_confirm ? ' and sent out.' : '. The office will confirm them.'),
              r.failed.length > 0);
        viewApprovals();
      } catch (err){ toast(err.message, true); }
    }));

    $('#bkAutoForm').addEventListener('submit', async ev => {
      ev.preventDefault();
      const rooms = $$('.bk-auto-room').filter(x => x.checked && !x.disabled).map(x => Number(x.value));
      try { await api('PUT', '/bookings/settings', {auto_rooms: rooms, auto_until: ev.target.elements.auto_until.value});
            toast('Saved.'); viewApprovals(); }
      catch (err){ toast(err.message, true); }
    });

    $$('[data-revoke]').forEach(btn => btn.addEventListener('click', async () => {
      const note = askNote('Why is this confirmed booking being withdrawn? The faculty member is e-mailed.', true);
      if (note === null) return;
      try { await api('POST', '/bookings/' + btn.dataset.revoke + '/revoke', {note: note}); toast('Withdrawn.'); viewApprovals(); }
      catch (err){ toast(err.message, true); }
    }));
    wireExtras(viewApprovals);
  }

  /* =====================================================================
     4. Rooms & halls   (admin)
     ===================================================================== */
  async function viewRooms(){
    const {api, head, $, $$, toast, alertBox} = ready();
    const d = await api('GET', '/bookings/rooms');

    $('#view').innerHTML = head('Rooms & halls',
        'The rooms people can ask for. “Head’s approval” decides whether a request for that room ' +
        'goes to the Head of the Department or can be confirmed by the office.') +
      '<div class="card"><h3>Add a room</h3><form class="pform" id="rmForm"><div class="pgrid pgrid-3">' +
        '<label>Name<input name="name" required placeholder="Seminar Hall"></label>' +
        '<label>Kind<select name="kind"><option value="hall">Seminar hall / committee room</option>' +
          '<option value="classroom">Classroom / tutorial room</option></select></label>' +
        '<label>Seats<input type="number" name="capacity" min="0" step="1" placeholder="120"></label>' +
        '<label>Where it is<input name="location" placeholder="Department of Mathematics"></label>' +
        '<label>Facilities<input name="facilities" placeholder="Projector, AC, Mic"></label>' +
        '<label>Who holds the key<input name="custodian" placeholder="Department office" value="Department office"></label>' +
        '<label class="check"><input type="checkbox" name="needs_hod" checked> Head’s approval needed</label>' +
      '</div><div class="view-actions"><button class="btn btn-maroon" type="submit">Add room</button></div></form></div>' +
      '<div class="ptable-wrap"><table class="ptable"><thead><tr><th>Room</th><th>Kind</th><th>Seats</th>' +
        '<th>Facilities</th><th>Key</th><th>Approval</th><th>State</th><th></th></tr></thead><tbody>' +
        d.rooms.map(r => '<tr><td><strong>' + esc(r.name) + '</strong>' +
          (r.location ? '<br><small>' + esc(r.location) + '</small>' : '') + '</td>' +
          '<td><small>' + (r.kind === 'hall' ? 'Hall' : 'Classroom') + '</small></td>' +
          '<td>' + (r.capacity || '—') + '</td><td><small>' + esc(r.facilities || '—') + '</small></td>' +
          '<td><small>' + esc(r.custodian || '—') + '</small></td>' +
          '<td><small>' + (r.needs_hod ? 'Head of Department' : 'Office') +
            (r.auto_ok ? '<br>standing approval on' : '') + '</small></td>' +
          '<td><span class="pill-status ' + (r.active ? 'st-active">In use' : 'st-disabled">Switched off') + '</span></td>' +
          '<td class="actions"><button class="btn btn-light btn-sm" data-edit="' + r.id + '">Edit</button>' +
          '<button class="btn btn-danger btn-sm" data-del="' + r.id + '">Remove</button></td></tr>').join('') +
        '</tbody></table></div>';

    $('#rmForm').addEventListener('submit', async ev => {
      ev.preventDefault();
      const f = ev.target.elements;
      try {
        await api('POST', '/bookings/rooms', {name: f.name.value.trim(), kind: f.kind.value,
          capacity: Number(f.capacity.value || 0), location: f.location.value.trim(),
          facilities: f.facilities.value.trim(), custodian: f.custodian.value.trim(),
          needs_hod: f.needs_hod.checked});
        toast('Room added.'); viewRooms();
      } catch (err){ alertBox(esc(err.message)); }
    });

    $$('[data-edit]').forEach(b => b.addEventListener('click', async () => {
      const r = d.rooms.find(x => String(x.id) === b.dataset.edit);
      const name = prompt('Room name', r.name); if (name === null) return;
      const cap = prompt('Seats', r.capacity); if (cap === null) return;
      const fac = prompt('Facilities', r.facilities); if (fac === null) return;
      const loc = prompt('Where it is', r.location); if (loc === null) return;
      const cus = prompt('Who holds the key', r.custodian || ''); if (cus === null) return;
      const hod = confirm('Does a request for this room need the Head’s approval?\nOK = yes, Cancel = the office can confirm it.');
      const on = confirm('Keep this room open for booking?\nOK = yes, Cancel = switch it off.');
      try { await api('PUT', '/bookings/rooms/' + r.id, {name: name.trim(), kind: r.kind, capacity: Number(cap || 0),
              facilities: fac.trim(), location: loc.trim(), custodian: cus.trim(), needs_hod: hod, active: on});
            toast('Saved.'); viewRooms(); }
      catch (err){ toast(err.message, true); }
    }));

    $$('[data-del]').forEach(b => b.addEventListener('click', async () => {
      if (!confirm('Remove this room? If it has bookings in its history it is switched off instead.')) return;
      try { const r = await api('DELETE', '/bookings/rooms/' + b.dataset.del);
            toast(r.message || 'Removed.'); viewRooms(); }
      catch (err){ toast(err.message, true); }
    }));
  }

  /* =====================================================================
     5. Register with the portal
     ===================================================================== */
  window.PORTAL_MODULES.push({
    views: function(VIEWS){
      VIEWS.bookings = viewBookings;
      VIEWS.bkqueue = viewQueue;
      VIEWS.bktoday = viewToday;
      VIEWS.bkapprovals = viewApprovals;
      VIEWS.bkrecords = viewRecords;
      VIEWS.bkrooms = viewRooms;
    },
    nav: function(items, me){
      items.push(['Rooms']);
      items.push(['bookings', '🏛', 'Book a room']);
      // The working screens belong to the people who work them. The admin gets
      // the record of every booking instead - see "Who sees what" in BOOKINGS.md.
      // The Head can look at the office's desk too - read-only, the buttons are
      // drawn only for the office. He often wants to see what is coming.
      if (me.role === 'office' || me.role === 'hod') items.push(['bkqueue', '📋', 'Booking requests']);
      if (me.role === 'office' || me.role === 'hod') items.push(['bktoday', '📅', 'Today']);
      if (me.role === 'hod') items.push(['bkapprovals', '✅', 'Approvals']);
      if (me.role === 'office' || me.role === 'hod' || me.role === 'admin') items.push(['bkrecords', '🗃', 'Booking records']);
      if (me.role === 'admin') items.push(['bkrooms', '🗝', 'Rooms & halls']);
    }
  });
})();
