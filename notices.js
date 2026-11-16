/* =====================================================================
   Notices & events renderer
   Reads window.DEPT_NOTICES (notices-data.js) and fills:
     - the home page Notice Board  (#noticeTrack)
     - the News & Events page lists (#noticeList, #eventList, #pastEventList)
   If the data file is missing, the pages keep their built-in content.
   ===================================================================== */
(function(){
  const ALL = Array.isArray(window.DEPT_NOTICES) ? window.DEPT_NOTICES : null;
  if (!ALL) return;

  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  const today = new Date().toISOString().slice(0, 10);

  const parts = d => {
    if (!d || !/^\d{4}-\d{2}-\d{2}$/.test(d)) return null;
    const [y, m, day] = d.split('-').map(Number);
    const dt = new Date(Date.UTC(y, m - 1, day));
    return {dd: String(day).padStart(2, '0'), mon: MONTHS[m - 1], year: y, dow: DAYS[dt.getUTCDay()]};
  };
  const longDate = d => { const p = parts(d); return p ? p.dd + ' ' + p.mon + ' ' + p.year : ''; };
  const tagClass = t => {
    t = (t || '').toLowerCase();
    if (/seminar|colloquium|lecture|talk/.test(t)) return 'tag-seminar';
    if (/admission|ph\.?d|recruit/.test(t)) return 'tag-admission';
    if (/exam|schedule|result/.test(t)) return 'tag-exam';
    if (/workshop|conference|event|symposium/.test(t)) return 'tag-event';
    return 'tag-general';
  };

  const live = ALL.filter(n => !n.draft && !(n.expires && n.expires < today));
  const notices = live.filter(n => n.kind !== 'event');
  const events = live.filter(n => n.kind === 'event');
  const upcoming = events.filter(n => (n.end_date || n.date || '9999') >= today)
                         .sort((a, b) => (a.date || '').localeCompare(b.date || ''));
  const past = events.filter(n => (n.end_date || n.date || '9999') < today)
                     .sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  const linkOf = n => n.link || ('news-events.html#notice-' + n.id);
  const ext = url => /^https?:/i.test(url) ? ' target="_blank" rel="noopener noreferrer"' : '';

  /* ---------- home page notice board ---------- */
  const track = document.getElementById('noticeTrack');
  if (track){
    // notices first, then upcoming events, as the original board mixed both
    const board = notices.concat(upcoming).slice(0, 12);
    if (board.length){
      track.innerHTML = board.map(n => {
        const p = parts(n.date);
        const title = n.kind === 'event' && n.speaker ? n.title + ' — ' + n.speaker : n.title;
        return '<li class="notice-item">' +
          '<div class="notice-date"><strong>' + (p ? p.dd : '—') + '</strong><span>' + (p ? p.mon : '') + '</span></div>' +
          '<div class="notice-body"><div class="notice-meta">' +
            '<span class="notice-tag ' + tagClass(n.tag) + '">' + esc(n.tag || (n.kind === 'event' ? 'Event' : 'Notice')) + '</span>' +
            (n.is_new ? '<span class="badge-new">New</span>' : '') +
          '</div><a href="' + esc(linkOf(n)) + '"' + ext(linkOf(n)) + '>' + esc(title) + '</a></div>' +
        '</li>';
      }).join('');
    } else {
      track.innerHTML = '<li class="notice-item"><div class="notice-body"><a href="news-events.html">No current notices. See News &amp; Events.</a></div></li>';
    }
  }

  /* ---------- news & events page ---------- */
  const noticeList = document.getElementById('noticeList');
  if (noticeList && notices.length){
    noticeList.innerHTML = '<div class="news-list">' + notices.map(n => {
      const p = parts(n.date);
      return '<article class="news-item" id="notice-' + esc(n.id) + '">' +
        '<div class="notice-date"><strong>' + (p ? p.dd : '—') + '</strong><span>' + (p ? p.mon + ' ' + p.year : '') + '</span></div>' +
        '<div class="news-body"><div class="notice-meta"><span class="notice-tag ' + tagClass(n.tag) + '">' + esc(n.tag || 'Notice') + '</span>' +
          (n.is_new ? '<span class="badge-new">New</span>' : '') + (n.pinned ? '<span class="badge-pin">Pinned</span>' : '') + '</div>' +
          '<h3>' + (n.link ? '<a href="' + esc(n.link) + '"' + ext(n.link) + '>' + esc(n.title) + '</a>' : esc(n.title)) + '</h3>' +
          (n.body ? '<div class="news-text">' + String(n.body).split(/\n\s*\n/).map(t => '<p>' + esc(t) + '</p>').join('') + '</div>' : '') +
        '</div></article>';
    }).join('') + '</div>';
  }

  const eventCard = n => {
    const p = parts(n.date);
    const range = n.end_date && n.end_date !== n.date ? longDate(n.date) + ' – ' + longDate(n.end_date) : '';
    return '<article class="event-card" id="notice-' + esc(n.id) + '">' +
      '<div class="event-date"><strong>' + (p ? p.dd : '—') + '</strong><span>' + (p ? p.mon : '') + '</span><em>' + (p ? p.dow : '') + '</em></div>' +
      '<div class="event-body"><span class="notice-tag ' + tagClass(n.tag) + '">' + esc(n.tag || 'Event') + '</span>' +
        '<h4>' + (n.link ? '<a href="' + esc(n.link) + '"' + ext(n.link) + '>' + esc(n.title) + '</a>' : esc(n.title)) + '</h4>' +
        (n.speaker ? '<p class="event-speaker">' + esc(n.speaker) + (n.affiliation ? ', ' + esc(n.affiliation) : '') + '</p>' : '') +
        '<p class="event-meta">' + (range ? '<span>🗓 ' + esc(range) + '</span>' : '') + (n.time ? '<span>🕒 ' + esc(n.time) + '</span>' : '') +
          (n.venue ? '<span>📍 ' + esc(n.venue) + '</span>' : '') + '</p>' +
        (n.body ? '<div class="news-text">' + String(n.body).split(/\n\s*\n/).map(t => '<p>' + esc(t) + '</p>').join('') + '</div>' : '') +
      '</div></article>';
  };
  const eventList = document.getElementById('eventList');
  if (eventList && upcoming.length) eventList.innerHTML = '<div class="event-list">' + upcoming.map(eventCard).join('') + '</div>';
  const pastList = document.getElementById('pastEventList');
  if (pastList && past.length){
    pastList.hidden = false;
    pastList.innerHTML = '<details class="past-events"><summary>Past events (' + past.length + ')</summary><div class="event-list">' +
                         past.map(eventCard).join('') + '</div></details>';
  }

  // open the right item when arriving via news-events.html#notice-12
  if (location.hash.startsWith('#notice-')){
    const t = document.getElementById(location.hash.slice(1));
    if (t){ t.classList.add('is-target'); setTimeout(() => t.scrollIntoView({block: 'center'}), 60); }
  }
})();
