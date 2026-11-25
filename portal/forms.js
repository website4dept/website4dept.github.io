/* =====================================================================
   forms.js — the Forms screen in the portal
   =====================================================================
   Goes with backend/forms.py. Loaded by portal/index.html BEFORE
   portal.js, and adds itself to window.PORTAL_MODULES, exactly as
   bookings.js does. Removing the one <script> line switches the screen
   off without touching anything else.

   The page it adds
     #forms     Forms     the department office and the admin

   WHAT IT DOES
   The office uploads the blank forms people download from the website:
   CL leave, sick leave, holiday, and so on. Each one has a title, an
   optional line of explanation and an optional group. The file itself is
   written into uploads/forms/ and served straight from disk, so downloads
   keep working even when this portal is stopped.

   AFTER ADDING OR CHANGING A FORM
   Administration -> Export for website, then copy the exported
   forms-data.js AND the uploads/forms/ folder to the website.
   ===================================================================== */
(function () {
  'use strict';

  window.PORTAL_MODULES = window.PORTAL_MODULES || [];
  var P = null;
  var ready = function () { return (P = P || window.PORTAL); };

  var STATE = { adding: false, editing: 0 };

  function esc(s) { return ready().esc(s); }

  function when(iso) {
    if (!iso) return '';
    var d = new Date(iso);
    return isNaN(d) ? '' : d.toLocaleDateString('en-GB',
      { day: '2-digit', month: 'short', year: 'numeric' });
  }

  /* Read the chosen file as a data URL. The server decodes it, checks what
     it really is by looking at the first bytes, and refuses anything that is
     not a PDF or a Word document. */
  function readFile(input) {
    return new Promise(function (resolve, reject) {
      var f = input && input.files && input.files[0];
      if (!f) return resolve(null);
      if (f.size > 10 * 1024 * 1024) return reject(new Error('That file is over 10 MB.'));
      var r = new FileReader();
      r.onload = function () { resolve({ data: r.result, name: f.name }); };
      r.onerror = function () { reject(new Error('Could not read that file.')); };
      r.readAsDataURL(f);
    });
  }

  function formRow(f, i, total) {
    var tag = String(f.kind || '').toLowerCase().indexOf('word') === 0 ? 'is-word' : 'is-pdf';
    return '<tr' + (f.active ? '' : ' class="fm-off"') + '>' +
      '<td class="fm-ord">' +
        '<button class="fm-move" data-up="' + f.id + '"' + (i === 0 ? ' disabled' : '') +
          ' title="Move up" aria-label="Move up">▲</button>' +
        '<button class="fm-move" data-down="' + f.id + '"' + (i === total - 1 ? ' disabled' : '') +
          ' title="Move down" aria-label="Move down">▼</button></td>' +
      '<td><span class="fm-icon ' + tag + '">' + esc(f.kind || '?') + '</span></td>' +
      '<td><strong>' + esc(f.title) + '</strong>' +
        (f.blurb ? '<br><small>' + esc(f.blurb) + '</small>' : '') +
        '<br><small class="fm-file">' + esc(f.file) + '</small></td>' +
      '<td>' + (f.group ? esc(f.group) : '<small>Other forms</small>') + '</td>' +
      '<td><small>' + esc(f.size) + '<br>updated ' + esc(when(f.updated)) + '</small></td>' +
      '<td>' + (f.active
        ? '<span class="pill-status st-approved">On the website</span>'
        : '<span class="pill-status st-pending">Hidden</span>') + '</td>' +
      '<td class="actions">' +
        '<button class="btn btn-light btn-sm" data-edit="' + f.id + '">Edit</button>' +
        '<button class="btn btn-light btn-sm" data-toggle="' + f.id + '">' +
          (f.active ? 'Hide' : 'Show') + '</button>' +
        '<button class="btn btn-danger btn-sm" data-del="' + f.id + '">Delete</button>' +
      '</td></tr>';
  }

  function fields(f, groups) {
    f = f || {};
    var list = (groups || []).map(function (g) {
      return '<option value="' + esc(g) + '">';
    }).join('');
    // The caption is one <span> so the "(optional)" hint sits beside the label
    // rather than becoming a second row of the column.
    var cap = function (t, hint) {
      return '<span class="fm-cap">' + t + (hint ? ' <small>' + hint + '</small>' : '') + '</span>';
    };
    return '<div class="fm-grid">' +
      '<label>' + cap('Title') +
        '<input id="fmTitle" maxlength="120" value="' + esc(f.title || '') + '" ' +
        'placeholder="Casual Leave (CL)"></label>' +
      '<label>' + cap('Group', '(optional)') +
        '<input id="fmGroup" maxlength="60" list="fmGroups" value="' + esc(f.group || '') + '" ' +
        'placeholder="Leave"><datalist id="fmGroups">' + list + '</datalist></label>' +
      '<label class="fm-wide">' + cap('One line of explanation', '(optional)') +
        '<input id="fmBlurb" maxlength="300" value="' + esc(f.blurb || '') + '" ' +
        'placeholder="One or two days at a time. Countersigned by the Head."></label>' +
      '<label class="fm-wide">' + (f.id
          ? cap('Replace the file', '(leave empty to keep the one that is there)')
          : cap('The file', '(PDF or Word, up to 10 MB)')) +
        '<input type="file" id="fmFile" accept=".pdf,.doc,.docx,application/pdf,application/msword,' +
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document"></label>' +
    '</div>';
  }

  function viewForms() {
    var R = ready();
    return R.api('GET', '/forms/manage').then(function (d) {
      var list = d.forms || [];
      var editing = STATE.editing && list.filter(function (f) { return f.id === STATE.editing; })[0];

      R.$('#view').innerHTML = R.head('Forms',
          'The blank forms people download from the website — leave applications and anything ' +
          'else the office hands out. Add one here and it appears on the Forms page straight away ' +
          'once you run Export for website.',
          '<button type="button" class="btn btn-maroon btn-sm" id="fmAdd">Add a form</button>') +

        (STATE.adding
          ? '<div class="card fm-panel"><h3>Add a form</h3>' + fields(null, d.groups) +
            '<div class="view-actions"><button class="btn btn-maroon" id="fmSave">Add it</button>' +
            '<button class="btn btn-light" id="fmCancel">Cancel</button></div></div>'
          : '') +

        (editing
          ? '<div class="card fm-panel"><h3>' + esc(editing.title) + '</h3>' +
            '<p class="hint">The download link stays the same when you replace the file, so anything ' +
            'already written down or e-mailed keeps working: <code>' + esc(editing.file) + '</code></p>' +
            fields(editing, d.groups) +
            '<div class="view-actions"><button class="btn btn-maroon" id="fmSave">Save</button>' +
            '<button class="btn btn-light" id="fmCancel">Cancel</button></div></div>'
          : '') +

        '<div class="ptable-wrap"><table class="ptable"><thead><tr>' +
          '<th>Order</th><th>Kind</th><th>Form</th><th>Group</th><th>File</th><th>State</th><th></th>' +
          '</tr></thead><tbody>' +
          (list.length
            ? list.map(function (f, i) { return formRow(f, i, list.length); }).join('')
            : '<tr><td colspan="7"><small>No forms yet. Press “Add a form” to put the first one up.</small></td></tr>') +
          '</tbody></table></div>' +

        '<div class="card"><h3>After you change anything here</h3>' +
          '<p class="hint">Run <strong>Administration → Export for website</strong>, then copy the ' +
          'exported <code>forms-data.js</code> <em>and</em> the <code>uploads/forms/</code> folder across. ' +
          'The forms are ordinary files, so they keep downloading even if this portal is stopped.</p></div>';

      wire(d);
    });
  }

  function wire(d) {
    var R = ready();
    var list = d.forms || [];

    if (R.$('#fmAdd')) R.$('#fmAdd').addEventListener('click', function () {
      STATE.adding = true; STATE.editing = 0; viewForms();
    });
    if (R.$('#fmCancel')) R.$('#fmCancel').addEventListener('click', function () {
      STATE.adding = false; STATE.editing = 0; viewForms();
    });

    if (R.$('#fmSave')) R.$('#fmSave').addEventListener('click', function () {
      var btn = R.$('#fmSave');
      var body = {
        title: R.$('#fmTitle').value.trim(),
        blurb: R.$('#fmBlurb').value.trim(),
        group: R.$('#fmGroup').value.trim()
      };
      if (!body.title) return R.toast('Give the form a title.', true);
      btn.disabled = true;
      readFile(R.$('#fmFile')).then(function (picked) {
        if (picked) { body.file = picked.data; body.original = picked.name; }
        if (!STATE.editing && !picked) throw new Error('Choose the file to upload.');
        return STATE.editing
          ? R.api('PUT', '/forms/' + STATE.editing, body)
          : R.api('POST', '/forms', body);
      }).then(function () {
        R.toast(STATE.editing ? 'Saved.' : 'Added. Run Export for website to put it on the site.');
        STATE.adding = false; STATE.editing = 0;
        viewForms();
      }).catch(function (err) {
        btn.disabled = false;
        R.toast(err.message, true);
      });
    });

    R.$$('[data-edit]').forEach(function (b) {
      b.addEventListener('click', function () {
        STATE.editing = Number(b.dataset.edit); STATE.adding = false; viewForms();
      });
    });

    R.$$('[data-toggle]').forEach(function (b) {
      b.addEventListener('click', function () {
        var f = list.filter(function (x) { return x.id === Number(b.dataset.toggle); })[0];
        R.api('PUT', '/forms/' + b.dataset.toggle, { active: !f.active })
          .then(function () {
            R.toast(f.active ? 'Hidden from the website.' : 'Back on the website.');
            viewForms();
          })
          .catch(function (err) { R.toast(err.message, true); });
      });
    });

    R.$$('[data-del]').forEach(function (b) {
      b.addEventListener('click', function () {
        var f = list.filter(function (x) { return x.id === Number(b.dataset.del); })[0];
        if (!confirm('Delete “' + f.title + '”? The file is removed as well. ' +
                     'If you only want it off the website, use Hide instead.')) return;
        R.api('DELETE', '/forms/' + b.dataset.del)
          .then(function () { R.toast('Deleted.'); viewForms(); })
          .catch(function (err) { R.toast(err.message, true); });
      });
    });

    function move(id, by) {
      var ids = list.map(function (f) { return f.id; });
      var i = ids.indexOf(Number(id));
      var j = i + by;
      if (i < 0 || j < 0 || j >= ids.length) return;
      ids.splice(j, 0, ids.splice(i, 1)[0]);
      R.api('POST', '/forms/order', { ids: ids })
        .then(viewForms)
        .catch(function (err) { R.toast(err.message, true); });
    }
    R.$$('[data-up]').forEach(function (b) {
      b.addEventListener('click', function () { move(b.dataset.up, -1); });
    });
    R.$$('[data-down]').forEach(function (b) {
      b.addEventListener('click', function () { move(b.dataset.down, 1); });
    });
  }

  window.PORTAL_MODULES.push({
    views: function (VIEWS) { VIEWS.forms = viewForms; },
    nav: function (items, me) {
      if (me.role !== 'office' && me.role !== 'admin') return;
      items.push(['Downloads']);
      items.push(['forms', '📄', 'Forms']);
    }
  });
})();
