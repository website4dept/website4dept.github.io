/* =====================================================================
   Home page: large Notice Board + calendar
   Reads window.DEPT_NOTICES (notices-data.js).
   - By default the board scrolls through ALL notices and upcoming events.
   - Click a date in the calendar to see only that day's notices/events
     ("No notices or events" if there are none). Click it again to go back.
   ===================================================================== */
(function(){
  var board = document.getElementById('noticeBoard');
  var grid = document.getElementById('calGrid');
  if (!board || !grid) return;

  var MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  var MON3 = MONTHS.map(function(m){ return m.slice(0, 3); });
  var DAYS = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  var esc = function(s){ return String(s == null ? '' : s).replace(/[&<>"']/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); };
  var pad = function(n){ return String(n).padStart(2, '0'); };
  var iso = function(d){ return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); };
  var parse = function(s){ return /^\d{4}-\d{2}-\d{2}$/.test(s || '') ? new Date(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10)) : null; };
  var longDate = function(s){ var d = parse(s); return d ? DAYS[d.getDay()] + ', ' + d.getDate() + ' ' + MONTHS[d.getMonth()] + ' ' + d.getFullYear() : ''; };
  var todayISO = iso(new Date());

  var tagClass = function(t){
    t = (t || '').toLowerCase();
    if (/seminar|colloquium|lecture|talk/.test(t)) return 'tag-seminar';
    if (/admission|ph\.?d|recruit/.test(t)) return 'tag-admission';
    if (/exam|schedule|result/.test(t)) return 'tag-exam';
    if (/workshop|conference|event|symposium/.test(t)) return 'tag-event';
    return 'tag-general';
  };

  /* ---------- data ---------- */
  var RAW = Array.isArray(window.DEPT_NOTICES) ? window.DEPT_NOTICES : [];
  var items = RAW.filter(function(n){ return n && n.title && !n.draft && !(n.expires && n.expires < todayISO) && !(n.publish_on && n.publish_on > todayISO); })
                 .map(function(n){ var c = {}; for (var k in n) c[k] = n[k]; c.kind = n.kind === 'event' ? 'event' : 'notice'; return c; });

  // newest first, pinned on top, undated last
  var ordered = items.slice().sort(function(a, b){
    if (!!b.pinned !== !!a.pinned) return b.pinned ? 1 : -1;
    var da = a.date || '', db = b.date || '';
    if (!da !== !db) return da ? -1 : 1;
    return db.localeCompare(da);
  });

  // date -> items (events spanning several days appear on each day)
  var byDay = {};
  items.forEach(function(n){
    var s = parse(n.date); if (!s) return;
    var e = parse(n.end_date); if (!e || e < s) e = s;
    for (var d = new Date(s), i = 0; d <= e && i < 62; d.setDate(d.getDate() + 1), i++){
      var k = iso(d); (byDay[k] = byDay[k] || []).push(n);
    }
  });

  /* ---------- state ---------- */
  var filter = 'all', selected = '', paused = false;
  var now = new Date(), viewY = now.getFullYear(), viewM = now.getMonth();

  var track = document.getElementById('nbTrack'), viewport = document.getElementById('nbViewport');
  var filterBar = document.getElementById('nbFilter'), filterText = document.getElementById('nbFilterText');
  var countEl = document.getElementById('nbCount'), hint = document.getElementById('calHint');
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var linkOf = function(n){ return n.link || ('news-events.html#notice-' + (n.id || '')); };
  var extAttr = function(u){ return /^https?:/i.test(u) ? ' target="_blank" rel="noopener noreferrer"' : ''; };

  function itemHTML(n){
    var d = parse(n.date), href = linkOf(n);
    var title = n.kind === 'event' && n.speaker ? n.title + ' — ' + n.speaker : n.title;
    var sub = [n.affiliation, n.venue, n.time].filter(Boolean).join('  ·  ');
    var range = n.end_date && n.end_date !== n.date && parse(n.end_date) ? ' – ' + parse(n.end_date).getDate() + ' ' + MON3[parse(n.end_date).getMonth()] : '';
    return '<li class="nb-item k-' + n.kind + '">' +
      '<div class="nb-date' + (d ? '' : ' undated') + '">' + (d ? '<strong>' + pad(d.getDate()) + '</strong><span>' + MON3[d.getMonth()] + ' ' + d.getFullYear() + '</span>' : '<strong>—</strong><span>Notice</span>') + '</div>' +
      '<div class="nb-body"><div class="nb-meta">' +
        '<span class="notice-tag ' + tagClass(n.tag) + '">' + esc(n.tag || (n.kind === 'event' ? 'Event' : 'Notice')) + '</span>' +
        (n.kind === 'event' ? '<span class="nb-kind">Event' + esc(range) + '</span>' : '') +
        (n.pinned ? '<span class="nb-kind">Pinned</span>' : '') +
        (n.urgent ? '<span class="badge-new" style="background:#b00020">Urgent</span>' : (n.is_new ? '<span class="badge-new">New</span>' : '')) +
      '</div><a href="' + esc(href) + '"' + extAttr(href) + '>' + esc(title) + '</a>' +
      (sub ? '<div class="nb-sub">' + esc(sub) + '</div>' : '') +
      (n.body && selected ? '<div class="nb-sub nb-text">' + esc(n.body.length > 160 ? n.body.slice(0, 157) + '…' : n.body) + '</div>' : '') +
      '</div></li>';
  }

  function visible(){
    var list = selected ? (byDay[selected] || []) : ordered;
    if (selected) list = list.slice().sort(function(a, b){ return (a.kind === 'event') - (b.kind === 'event'); });
    return list.filter(function(n){ return filter === 'all' || n.kind === filter; });
  }

  /* ---------- notice list ---------- */
  function renderBoard(){
    var list = visible();
    viewport.classList.remove('is-scrolling', 'is-static');
    track.style.animation = '';
    if (selected){
      filterBar.hidden = false;
      filterText.innerHTML = list.length
        ? 'Showing <strong>' + esc(longDate(selected)) + '</strong> · ' + list.length + (list.length === 1 ? ' item' : ' items')
        : '<strong>' + esc(longDate(selected)) + '</strong>';
    } else filterBar.hidden = true;

    if (!list.length){
      track.innerHTML = '<li class="nb-empty"><svg viewBox="0 0 48 48" width="56" height="56" aria-hidden="true"><rect x="6" y="10" width="36" height="32" rx="2" fill="none" stroke="currentColor" stroke-width="2.5"/><path d="M6 19h36M15 5v9M33 5v9" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/><path d="M18 28l12 8M30 28l-12 8" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/></svg>' +
        '<strong>' + (selected ? 'No notices or events' : 'Nothing to show yet') + '</strong>' +
        '<p>' + (selected ? 'Nothing is scheduled for ' + esc(longDate(selected)) + '.' : 'New notices and events will appear here.') + '</p>' +
        (selected ? '<button type="button" class="nb-reset">Show all notices</button>' : '') + '</li>';
      viewport.classList.add('is-static');
      countEl.textContent = '';
      return;
    }
    var html = list.map(itemHTML).join('');
    track.innerHTML = html;
    countEl.textContent = list.length + (list.length === 1 ? ' notice / event' : ' notices & events');

    // dynamic mode: scroll continuously when the list is longer than the box
    if (!selected && !reduce && track.scrollHeight > viewport.clientHeight + 8){
      track.innerHTML = html + html.replace(/<li class="nb-item/g, '<li aria-hidden="true" class="nb-item');
      viewport.style.setProperty('--nb-dur', Math.max(24, list.length * 5) + 's');
      viewport.classList.add('is-scrolling');
    } else viewport.classList.add('is-static');
    viewport.scrollTop = 0;
  }

  /* ---------- calendar ---------- */
  function renderCal(){
    document.getElementById('calTitle').textContent = MONTHS[viewM] + ' ' + viewY;
    var first = new Date(viewY, viewM, 1), start = new Date(viewY, viewM, 1 - first.getDay()), h = '';
    for (var i = 0; i < 42; i++){
      var d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i), k = iso(d), list = byDay[k] || [];
      var hasN = list.some(function(n){ return n.kind !== 'event'; }), hasE = list.some(function(n){ return n.kind === 'event'; });
      var cls = 'cal-day' + (d.getMonth() !== viewM ? ' out' : '') + (k === todayISO ? ' today' : '') + (k === selected ? ' sel' : '');
      h += '<button type="button" class="' + cls + '" data-d="' + k + '" aria-pressed="' + (k === selected) + '" aria-label="' + esc(longDate(k)) + (list.length ? ', ' + list.length + (list.length === 1 ? ' item' : ' items') : ', no items') + '">' +
           '<span>' + d.getDate() + '</span><span class="cal-dots">' + (hasN ? '<i></i>' : '') + (hasE ? '<i class="ev"></i>' : '') + '</span></button>';
    }
    grid.innerHTML = h;
    hint.textContent = selected ? 'Select the highlighted date again, or press “Show all notices”, to go back.' : 'Select a date to see that day’s notices and events.';
  }

  function select(k){
    selected = (k === selected) ? '' : k;
    if (selected){ var d = parse(selected); viewY = d.getFullYear(); viewM = d.getMonth(); }
    renderCal(); renderBoard();
  }
  function shift(n){ viewM += n; if (viewM < 0){ viewM = 11; viewY--; } if (viewM > 11){ viewM = 0; viewY++; } renderCal(); }

  grid.addEventListener('click', function(e){ var b = e.target.closest('.cal-day'); if (b) select(b.getAttribute('data-d')); });
  document.getElementById('calPrev').addEventListener('click', function(){ shift(-1); });
  document.getElementById('calNext').addEventListener('click', function(){ shift(1); });
  document.getElementById('calToday').addEventListener('click', function(){ var t = new Date(); viewY = t.getFullYear(); viewM = t.getMonth(); selected = todayISO; renderCal(); renderBoard(); });
  document.getElementById('nbClear').addEventListener('click', function(){ selected = ''; renderCal(); renderBoard(); });
  track.addEventListener('click', function(e){ if (e.target.closest('.nb-reset')){ selected = ''; renderCal(); renderBoard(); } });

  board.querySelectorAll('.nb-tab').forEach(function(b){
    b.addEventListener('click', function(){
      filter = b.getAttribute('data-f');
      board.querySelectorAll('.nb-tab').forEach(function(x){ x.classList.toggle('is-active', x === b); });
      renderBoard();
    });
  });

  var pauseBtn = document.getElementById('nbPause');
  pauseBtn.addEventListener('click', function(){
    paused = !paused;
    board.classList.toggle('is-paused', paused);
    pauseBtn.setAttribute('aria-pressed', String(paused));
    pauseBtn.textContent = paused ? '▶' : '❚❚';
    pauseBtn.setAttribute('aria-label', paused ? 'Resume scrolling' : 'Pause scrolling');
  });
  board.addEventListener('mouseenter', function(){ board.classList.add('is-hover'); });
  board.addEventListener('mouseleave', function(){ board.classList.remove('is-hover'); });

  renderCal();
  renderBoard();
})();
