"use strict";
// Static website utilities. No server or credentials are used.
const pages = [
  {name:'Home',url:'index.html',words:'homepage mathematics department IIT Kharagpur welcome'},
  {name:'About',url:'about.html',words:'department overview history mathematics teaching collaborations'},
  {name:'Research',url:'research.html',words:'pure applied mathematics probability statistics theoretical computer science'},
  {name:'Research › Pure Mathematics',url:'research.html#pure-mathematics',words:'pure mathematics algebra analysis topology combinatorics number theory'},
  {name:'Research › Algebra',url:'research.html#algebra',words:'algebra commutative homological lie associative k-theory algebraic geometry'},
  {name:'Research › Analysis',url:'research.html#analysis',words:'analysis harmonic operator theory functional analysis geometric function theory'},
  {name:'Research › Topology',url:'research.html#topology',words:'topology algebraic geometric topology homotopy'},
  {name:'Research › Combinatorics & Number Theory',url:'research.html#combinatorics',words:'combinatorics graph theory matrix theory number theory zeta'},
  {name:'Research › Applied Mathematics',url:'research.html#applied-mathematics',words:'applied mathematics fluid differential equations computing optimisation optimization'},
  {name:'Research › Fluid Dynamics',url:'research.html#fluid-dynamics',words:'fluid dynamics biofluid microfluidics turbulence water waves porous media'},
  {name:'Research › Differential & Integral Equations',url:'research.html#differential-equations',words:'differential integral equations pde conservation laws boundary value homogenisation'},
  {name:'Research › Scientific Computing',url:'research.html#scientific-computing',words:'scientific computing numerical analysis finite volume linear algebra'},
  {name:'Research › Optimisation & Operations Research',url:'research.html#optimisation',words:'optimisation optimization operations research fuzzy inventory decision'},
  {name:'Research › Probability & Statistics',url:'research.html#probability-statistics',words:'probability statistics inference reliability data analysis'},
  {name:'Research › Statistical Inference',url:'research.html#statistical-inference',words:'statistical inference estimation classification clinical trials surrogate'},
  {name:'Research › Applied Probability',url:'research.html#stochastic-processes',words:'applied probability stochastic orders processes'},
  {name:'Research › Reliability & Survival Analysis',url:'research.html#reliability-survival',words:'reliability survival analysis entropy life testing censored'},
  {name:'Research › Data Analysis',url:'research.html#data-analysis',words:'data analysis directional statistics manifolds functional data mining'},
  {name:'Research › Theoretical Computer Science',url:'research.html#theoretical-computer-science',words:'theoretical computer science algorithms complexity cryptography geometry blockchain'},
  {name:'Research › Algorithms & Complexity',url:'research.html#algorithms-complexity',words:'algorithms complexity graph algorithms parameterized'},
  {name:'Research › Cryptography',url:'research.html#cryptography',words:'cryptography encryption post-quantum cryptanalysis security'},
  {name:'Research › Computational Geometry & Topology',url:'research.html#computational-geometry',words:'computational geometry topology visibility'},
  {name:'Research › Blockchain & Secure Computation',url:'research.html#blockchain',words:'blockchain cryptocurrency bitcoin zero-knowledge privacy'},
  {name:'People',url:'people.html',words:'faculty research scholars staff directory'},
  {name:'Academics',url:'academics.html',words:'programmes courses undergraduate postgraduate doctoral admissions'},
  {name:'Students',url:'students.html',words:'students research scholars resources teaching seminars'},
  {name:'News & Events',url:'news-events.html',words:'announcements seminars lectures news academic events'},
  {name:'Publications',url:'publications.html',words:'research publications papers articles bibliography'},
  {name:'Contact',url:'contact.html',words:'address contact mathematics department Kharagpur West Bengal'},
];
const nav=document.getElementById('navLinks');
function closeDropdowns(){document.querySelectorAll('.has-dropdown.open').forEach(d=>{d.classList.remove('open');const b=d.querySelector('.dropdown-toggle');if(b)b.setAttribute('aria-expanded','false');});}
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
    if(window.innerWidth>850){nav.classList.remove('open');menu.setAttribute('aria-expanded','false');menu.textContent='☰';closeDropdowns();}
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

// ===== Research dropdown in the main navbar =====
(function(){
  document.querySelectorAll('.nav-links .has-dropdown').forEach(item=>{
    const btn=item.querySelector('.dropdown-toggle');
    if(!btn)return;
    const set=open=>{item.classList.toggle('open',open);btn.setAttribute('aria-expanded',String(open));};
    btn.addEventListener('click',e=>{e.stopPropagation();set(!item.classList.contains('open'));});
    item.addEventListener('keydown',e=>{if(e.key==='Escape'){set(false);btn.focus();}});
    document.addEventListener('click',e=>{if(!item.contains(e.target))set(false);});
    item.querySelectorAll('.nav-dropdown a').forEach(a=>a.addEventListener('click',()=>{
      set(false);a.blur();
      if(nav&&menu){nav.classList.remove('open');menu.setAttribute('aria-expanded','false');menu.textContent='☰';}
    }));
  });
})();

// ===== Research page: area tabs, subtabs and topics =====
(function(){
  const areas=[...document.querySelectorAll('.area-panel')];
  if(!areas.length)return;
  const areaTabs=[...document.querySelectorAll('.area-tab')];
  const mark=(tabs,id)=>tabs.forEach(t=>{const on=t.dataset.target===id;t.classList.toggle('is-active',on);on?t.setAttribute('aria-current','true'):t.removeAttribute('aria-current');});
  function showArea(id,subId){
    areas.forEach(a=>a.hidden=a.id!==id);
    mark(areaTabs,id);
    const panel=document.getElementById(id);
    const subs=[...panel.querySelectorAll('.sub-panel')];
    const sid=subId||subs[0].id;
    subs.forEach(s=>s.hidden=s.id!==sid);
    mark([...panel.querySelectorAll('.sub-tab')],sid);
  }
  function route(scroll){
    let h='';try{h=decodeURIComponent(location.hash.slice(1));}catch(e){}
    let el=h?document.getElementById(h):null,topic=null,target=null;
    if(el&&el.classList.contains('topic')){topic=el;el=el.closest('.sub-panel');}
    if(el&&el.classList.contains('sub-panel')){showArea(el.closest('.area-panel').id,el.id);target=topic||el;}
    else if(el&&el.classList.contains('area-panel')){showArea(el.id);target=el;}
    else{showArea(areas[0].id);return;}
    if(topic)topic.open=true;
    if(scroll&&target)target.scrollIntoView({behavior:'smooth',block:'start'});
  }
  function go(e){
    e.preventDefault();
    const id=this.dataset.target;
    history.replaceState?history.replaceState(null,'','#'+id):(location.hash=id);
    route(this.classList.contains('area-tab'));
  }
  areaTabs.forEach(t=>t.addEventListener('click',go));
  document.querySelectorAll('.sub-tab').forEach(t=>t.addEventListener('click',go));
  window.addEventListener('hashchange',()=>route(true));
  route(!!location.hash);
})();
