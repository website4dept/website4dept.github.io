/* =====================================================================
   forms.js  —  draws the Forms & Downloads page
   =====================================================================
   WHERE THE LIST COMES FROM
   forms-data.js, which sets window.DEPT_FORMS. The department portal
   rewrites that file whenever the office adds, replaces or removes a
   form (portal -> Forms, then Export for website).

   TO ADD OR CHANGE A FORM
   Do it in the portal. Nothing in this file or in forms.html needs editing.

   IF A FORM IS MISSING FROM THE PAGE
   Either it is switched off in the portal, or forms-data.js and the files
   in uploads/forms/ have not been copied across since it was added.
   ===================================================================== */
(function () {
  'use strict';

  var LIST  = document.getElementById('formsList');
  var COUNT = document.getElementById('formsCount');
  var HELP  = document.getElementById('formsHelp');
  var BOX   = document.getElementById('formsQ');
  if (!LIST) return;

  var ALL = Array.isArray(window.DEPT_FORMS) ? window.DEPT_FORMS : [];

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  /* "2026-11-25T10:14:02+05:30" -> "25 Nov 2026". Anything we cannot read is
     left out rather than shown half-parsed. */
  function when(iso) {
    if (!iso) return '';
    var d = new Date(iso);
    if (isNaN(d)) return '';
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  function icon(kind) {
    var word = String(kind || '').toLowerCase().indexOf('word') === 0;
    return '<span class="form-icon' + (word ? ' is-word' : ' is-pdf') + '" aria-hidden="true">' +
           (word ? 'W' : 'PDF') + '</span>';
  }

  function card(f) {
    var updated = when(f.updated);
    return '<li class="form-row">' +
      icon(f.kind) +
      '<span class="form-main">' +
        '<strong>' + esc(f.title) + '</strong>' +
        (f.blurb ? '<small>' + esc(f.blurb) + '</small>' : '') +
        '<small class="form-meta">' + esc(f.kind || '') +
          (f.size ? ' &middot; ' + esc(f.size) : '') +
          (updated ? ' &middot; updated ' + esc(updated) : '') + '</small>' +
      '</span>' +
      '<a class="btn btn-maroon btn-sm form-get" href="' + esc(f.file) + '" download>' +
        'Download<span class="sr-only"> ' + esc(f.title) + '</span></a>' +
    '</li>';
  }

  function group(name, items) {
    return '<section class="form-group">' +
      '<h3 class="form-group-title">' + esc(name) + '</h3>' +
      '<ul class="form-rows">' + items.map(card).join('') + '</ul>' +
    '</section>';
  }

  function draw(items) {
    if (!ALL.length) {
      LIST.innerHTML = '<p class="forms-empty">No forms have been put up yet. ' +
        'Please <a href="contact.html">ask the department office</a> for the one you need.</p>';
      COUNT.textContent = '';
      return;
    }
    if (!items.length) {
      LIST.innerHTML = '<p class="forms-empty">No form matches that. Try a shorter word, ' +
        'or <a href="contact.html">ask the office</a>.</p>';
      COUNT.textContent = '';
      return;
    }

    /* Keep the order the office set, and keep each group in the place its
       first form appeared, so dragging a form to the top moves its group too. */
    var order = [], bucket = {};
    items.forEach(function (f) {
      var g = f.group || 'Other forms';
      if (!bucket[g]) { bucket[g] = []; order.push(g); }
      bucket[g].push(f);
    });

    LIST.innerHTML = order.map(function (g) { return group(g, bucket[g]); }).join('');
    COUNT.textContent = items.length === ALL.length
      ? items.length + (items.length === 1 ? ' form' : ' forms')
      : items.length + ' of ' + ALL.length + ' forms';
    HELP.hidden = false;
  }

  function search(term) {
    term = String(term || '').trim().toLowerCase();
    if (!term) return ALL;
    return ALL.filter(function (f) {
      return (f.title + ' ' + (f.blurb || '') + ' ' + (f.group || '')).toLowerCase().indexOf(term) !== -1;
    });
  }

  draw(ALL);
  if (BOX) {
    BOX.addEventListener('input', function () { draw(search(BOX.value)); });
  }
})();
