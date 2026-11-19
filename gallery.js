/* Gallery page: album filters + lightbox. Reads window.DEPT_GALLERY (gallery-data.js). */
(function(){
  var grid = document.getElementById('galleryGrid');
  var bar = document.getElementById('galleryFilters');
  var empty = document.getElementById('galleryEmpty');
  if (!grid) return;
  var esc = function(s){ return String(s == null ? '' : s).replace(/[&<>"']/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); };
  var all = (window.DEPT_GALLERY || []).slice();
  var ok = [], pending = all.length, album = 'All', lbIndex = -1, shown = [];

  function check(p){
    var im = new Image();
    im.onload = function(){ ok.push(p); done(); };
    im.onerror = function(){ done(); };
    im.src = p.src;
  }
  function done(){ if (--pending === 0){ ok.sort(function(a, b){ return all.indexOf(a) - all.indexOf(b); }); build(); } }
  if (!all.length) build(); else all.forEach(check);

  function build(){
    if (!ok.length){ empty.hidden = false; bar.hidden = true; return; }
    var albums = ['All'];
    ok.forEach(function(p){ var a = p.album || 'Photos'; if (albums.indexOf(a) < 0) albums.push(a); });
    bar.innerHTML = albums.map(function(a){ return '<button type="button" class="chip' + (a === 'All' ? ' is-active' : '') + '" data-album="' + esc(a) + '">' + esc(a) + '</button>'; }).join('');
    bar.hidden = albums.length < 3;
    bar.addEventListener('click', function(e){
      var b = e.target.closest('button'); if (!b) return;
      album = b.getAttribute('data-album');
      [].forEach.call(bar.children, function(c){ c.classList.toggle('is-active', c === b); });
      render();
    });
    render();
  }
  function render(){
    shown = ok.filter(function(p){ return album === 'All' || (p.album || 'Photos') === album; });
    grid.innerHTML = shown.map(function(p, i){
      return '<figure class="gal-item"><button type="button" data-i="' + i + '" aria-label="Open photo: ' + esc(p.title) + '">' +
             '<img src="' + esc(p.src) + '" alt="' + esc(p.title) + '" loading="lazy"></button>' +
             '<figcaption><strong>' + esc(p.title) + '</strong><span>' + esc([p.album, p.date].filter(Boolean).join(' · ')) + '</span></figcaption></figure>';
    }).join('');
  }
  grid.addEventListener('click', function(e){ var b = e.target.closest('button[data-i]'); if (b) open(+b.getAttribute('data-i')); });

  var lb = document.getElementById('lightbox'), lbImg = document.getElementById('lbImg'), lbCap = document.getElementById('lbCap');
  function open(i){ lbIndex = (i + shown.length) % shown.length; var p = shown[lbIndex]; lbImg.src = p.src; lbImg.alt = p.title; lbCap.textContent = p.title + (p.date ? ' · ' + p.date : ''); lb.hidden = false; document.body.style.overflow = 'hidden'; lb.querySelector('.lb-close').focus(); }
  function close(){ lb.hidden = true; lbImg.src = ''; document.body.style.overflow = ''; }
  lb.addEventListener('click', function(e){
    if (e.target === lb || e.target.closest('.lb-close')) close();
    else if (e.target.closest('.lb-prev')) open(lbIndex - 1);
    else if (e.target.closest('.lb-next')) open(lbIndex + 1);
  });
  document.addEventListener('keydown', function(e){
    if (lb.hidden) return;
    if (e.key === 'Escape') close();
    if (e.key === 'ArrowLeft') open(lbIndex - 1);
    if (e.key === 'ArrowRight') open(lbIndex + 1);
  });
})();
