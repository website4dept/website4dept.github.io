"use strict";
// Static website utilities. No server or credentials are used.
const pages = [
  {name:'Home',url:'index.html',words:'homepage mathematics department IIT Kharagpur welcome'},
  {name:'About',url:'about.html',words:'department overview history mathematics teaching collaborations'},
  {name:'Research',url:'research.html',words:'algebra number theory analysis equations probability statistics applied computational mathematics'},
  {name:'People',url:'people.html',words:'faculty research scholars staff directory'},
  {name:'Academics',url:'academics.html',words:'programmes courses undergraduate postgraduate doctoral admissions'},
  {name:'Students',url:'students.html',words:'students research scholars resources teaching seminars'},
  {name:'News & Events',url:'news-events.html',words:'announcements seminars lectures news academic events'},
  {name:'Publications',url:'publications.html',words:'research publications papers articles bibliography'},
  {name:'Contact',url:'contact.html',words:'address contact mathematics department Kharagpur West Bengal'},
];
const nav=document.getElementById('navLinks');
const menu=document.getElementById('menuToggle');
if(menu && nav){
  menu.addEventListener('click',()=>{
    const open=nav.classList.toggle('open');
    menu.setAttribute('aria-expanded',String(open));
    menu.textContent=open?'✕':'☰';
  });
  document.addEventListener('click',e=>{
    if(!nav.contains(e.target)&&!menu.contains(e.target)){
      nav.classList.remove('open');menu.setAttribute('aria-expanded','false');menu.textContent='☰';
    }
  });
  window.addEventListener('resize',()=>{
    if(window.innerWidth>850){nav.classList.remove('open');menu.setAttribute('aria-expanded','false');menu.textContent='☰';}
  });
}
const searchToggle=document.getElementById('searchToggle');
const searchDrawer=document.getElementById('searchDrawer');
const searchForm=document.getElementById('searchForm');
const searchInput=document.getElementById('siteSearch');
const searchResults=document.getElementById('searchResults');
if(searchToggle && searchDrawer){
  searchToggle.addEventListener('click',()=>{
    const open=searchDrawer.classList.toggle('open');
    searchToggle.setAttribute('aria-expanded',String(open));
    searchDrawer.hidden=!open;
    if(open && searchInput)searchInput.focus();
  });
}
function renderSearch(){
  if(!searchInput||!searchResults)return;
  const q=searchInput.value.trim().toLowerCase();
  searchResults.replaceChildren();
  searchResults.classList.toggle('visible',!!q);
  if(!q)return;
  const matches=pages.filter(p=>(p.name+' '+p.words).toLowerCase().includes(q));
  if(matches.length===0){const p=document.createElement('p');p.textContent='No page titles or topics match your search.';searchResults.append(p);return;}
  for(const item of matches){const a=document.createElement('a');a.href=item.url;a.textContent=item.name;searchResults.append(a);}
}
if(searchInput)searchInput.addEventListener('input',renderSearch);
if(searchForm)searchForm.addEventListener('submit',e=>{e.preventDefault();renderSearch();const first=searchResults?.querySelector('a');if(first)first.focus();});


// ===== Hero slideshow =====
(function(){
  const hero=document.getElementById('heroCarousel');
  if(!hero)return;
  const slides=[...hero.querySelectorAll('.hero-slide')];
  if(slides.length<2)return;
  const dotsWrap=document.getElementById('heroDots');
  const prevBtn=document.getElementById('heroPrev');
  const nextBtn=document.getElementById('heroNext');
  const pauseBtn=document.getElementById('heroPause');
  const progress=hero.querySelector('.hero-progress');
  const bar=progress?progress.querySelector('span'):null;
  const reduce=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let current=Math.max(0,slides.findIndex(s=>s.classList.contains('is-active')));
  let paused=reduce;

  const dots=slides.map((s,i)=>{
    const b=document.createElement('button');
    b.type='button';b.className='hero-dot';
    b.setAttribute('aria-label','Go to slide '+(i+1));
    b.addEventListener('click',()=>go(i));
    dotsWrap.append(b);
    return b;
  });

  function restart(){
    if(!bar)return;
    progress.classList.remove('run');
    void bar.offsetWidth; // restart the CSS animation
    if(!paused)progress.classList.add('run');
  }
  function go(i){
    current=(i+slides.length)%slides.length;
    slides.forEach((s,j)=>{const on=j===current;s.classList.toggle('is-active',on);s.setAttribute('aria-hidden',String(!on));});
    dots.forEach((d,j)=>{d.classList.toggle('is-active',j===current);d.setAttribute('aria-current',j===current?'true':'false');});
    restart();
  }
  function setPaused(p){
    paused=p;
    pauseBtn.textContent=p?'▶':'❚❚';
    pauseBtn.setAttribute('aria-label',p?'Play slideshow':'Pause slideshow');
    restart();
  }

  if(bar)bar.addEventListener('animationend',()=>go(current+1));
  prevBtn.addEventListener('click',()=>go(current-1));
  nextBtn.addEventListener('click',()=>go(current+1));
  pauseBtn.addEventListener('click',()=>setPaused(!paused));

  // pause while the pointer or keyboard focus is inside the hero
  hero.addEventListener('mouseenter',()=>hero.classList.add('is-hovered'));
  hero.addEventListener('mouseleave',()=>hero.classList.remove('is-hovered'));
  hero.addEventListener('focusin',()=>hero.classList.add('is-hovered'));
  hero.addEventListener('focusout',e=>{if(!hero.contains(e.relatedTarget))hero.classList.remove('is-hovered');});

  // arrow keys
  hero.addEventListener('keydown',e=>{
    if(e.key==='ArrowLeft')go(current-1);
    if(e.key==='ArrowRight')go(current+1);
  });

  // swipe on touch screens
  let startX=null;
  hero.addEventListener('touchstart',e=>{startX=e.touches[0].clientX;},{passive:true});
  hero.addEventListener('touchend',e=>{
    if(startX===null)return;
    const dx=e.changedTouches[0].clientX-startX;
    if(Math.abs(dx)>50)go(current+(dx<0?1:-1));
    startX=null;
  });

  setPaused(paused);
  go(current);
})();

// ===== HOD message: read more =====
(function(){
  const text=document.getElementById('hodText');
  const btn=document.getElementById('hodToggle');
  if(!text||!btn)return;
  text.classList.add('is-clamped');
  if(text.scrollHeight<=text.clientHeight+4){text.classList.remove('is-clamped');return;}
  btn.hidden=false;
  btn.addEventListener('click',()=>{
    const open=text.classList.toggle('is-open');
    btn.setAttribute('aria-expanded',String(open));
    btn.firstChild.textContent=open?'Show less ':'Read full message ';
  });
})();

// ===== Notice board ticker =====
(function(){
  const board=document.getElementById('noticeBoard');
  const viewport=document.getElementById('noticeViewport');
  const track=document.getElementById('noticeTrack');
  const toggle=document.getElementById('tickerToggle');
  if(!board||!viewport||!track)return;
  const reduce=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const items=[...track.children];

  // only scroll if there are more notices than fit
  if(reduce||track.scrollHeight<=viewport.clientHeight+4){
    viewport.classList.add('is-static');
    if(toggle)toggle.hidden=true;
    return;
  }
  // duplicate the list so the loop is seamless
  items.forEach(li=>{
    const copy=li.cloneNode(true);
    copy.setAttribute('aria-hidden','true');
    copy.querySelectorAll('a,button').forEach(el=>el.tabIndex=-1);
    track.append(copy);
  });
  viewport.style.setProperty('--ticker-duration',(items.length*4.5)+'s');
  viewport.classList.add('is-scrolling');

  if(toggle)toggle.addEventListener('click',()=>{
    const p=board.classList.toggle('is-paused');
    toggle.setAttribute('aria-pressed',String(p));
    toggle.setAttribute('aria-label',p?'Resume notice scrolling':'Pause notice scrolling');
    toggle.textContent=p?'▶':'❚❚';
  });
})();

