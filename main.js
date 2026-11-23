"use strict";
// Static website utilities. No server or credentials are used.
const pages = [
  {name:'Home',url:'index.html',words:'homepage mathematics department IIT Kharagpur welcome'},
  {name:'Research',url:'research.html',words:'pure applied mathematics probability statistics theoretical computer science artificial intelligence'},
  {name:'Research › Pure Mathematics',url:'research.html#pure-mathematics',words:'pure mathematics algebra analysis topology combinatorics number theory'},
  {name:'Research › Algebra',url:'research.html#algebra',words:'algebra commutative homological lie associative k-theory algebraic geometry'},
  {name:'Research › Analysis',url:'research.html#analysis',words:'analysis harmonic operator theory functional analysis geometric function theory'},
  {name:'Research › Topology',url:'research.html#topology',words:'topology algebraic geometric topology homotopy'},
  {name:'Research › Combinatorics & Number Theory',url:'research.html#combinatorics',words:'combinatorics graph theory matrix theory number theory zeta'},
  {name:'Research › Applied Mathematics',url:'research.html#applied-mathematics',words:'applied mathematics fluid differential equations optimisation optimization'},
  {name:'Research › Fluid Dynamics',url:'research.html#fluid-dynamics',words:'fluid dynamics biofluid microfluidics turbulence water waves porous media'},
  {name:'Research › Differential & Integral Equations',url:'research.html#differential-equations',words:'differential integral equations pde conservation laws boundary value homogenisation'},
  {name:'Research › Optimization & Operations Research',url:'research.html#optimisation',words:'optimisation optimization operations research fuzzy inventory decision'},
  {name:'Research › Probability & Statistics',url:'research.html#probability-statistics',words:'probability statistics inference reliability data analysis'},
  {name:'Research › Statistical Inference',url:'research.html#statistical-inference',words:'statistical inference estimation classification clinical trials surrogate'},
  {name:'Research › Applied Probability',url:'research.html#stochastic-processes',words:'applied probability stochastic orders processes'},
  {name:'Research › Reliability & Survival Analysis',url:'research.html#reliability-survival',words:'reliability survival analysis entropy life testing censored'},
  {name:'Research › Data Analysis',url:'research.html#data-analysis',words:'data analysis directional statistics manifolds functional data'},
  {name:'Research › Theoretical Computer Science',url:'research.html#theoretical-computer-science',words:'theoretical computer science algorithms complexity cryptography'},
  {name:'Research › Algorithms & Complexity',url:'research.html#algorithms-complexity',words:'algorithms complexity graph algorithms parameterized'},
  {name:'Research › Cryptography',url:'research.html#cryptography',words:'cryptography encryption post-quantum cryptanalysis security'},
  {name:'Research › Artificial Intelligence',url:'research.html#artificial-intelligence',words:'artificial intelligence ai machine learning deep learning neural networks nlp image processing computer vision data mining'},
  {name:'Research › Machine Learning',url:'research.html#machine-learning',words:'machine learning ml prediction classification ai'},
  {name:'Research › Deep Learning',url:'research.html#deep-learning',words:'deep learning neural networks ai'},
  {name:'Research › Natural Language Processing',url:'research.html#natural-language-processing',words:'natural language processing nlp text language ai'},
  {name:'Research › Image Processing',url:'research.html#image-processing',words:'image processing computer vision images video ai'},
  {name:'Research › Data Mining',url:'research.html#data-mining',words:'data mining association rules frequent patterns fuzzy'},
  {name:'People',url:'people.html',words:'faculty research scholars staff directory'},
  {name:'People › Faculty',url:'people.html#faculty',words:'faculty professors members'},
  {name:'People › Adjunct & INSPIRE Faculty',url:'people.html#adjunct-faculty',words:'adjunct inspire faculty'},
  {name:'People › Postdoctoral Fellows',url:'people.html#postdoctoral-fellows',words:'postdoctoral fellows postdoc pdf'},
  {name:'People › Research Scholars',url:'people.html#research-scholars',words:'research scholars phd students'},
  {name:'People › Administrative & Technical Staff',url:'people.html#staff',words:'staff office administrative technical'},
  {name:'People › Alumni',url:'people.html#alumni',words:'alumni former students graduated phd postdoc'},
  {name:'People › Former Faculty',url:'people.html#former-faculty',words:'former retired faculty'},
  {name:'Academics',url:'academics.html',words:'programmes courses undergraduate postgraduate doctoral admissions'},
  {name:'Academics › Programmes Overview',url:'academics.html#programmes',words:'programmes degrees overview'},
  {name:'Academics › BS-MS (Integrated)',url:'academics.html#bs-ms',words:'bs-ms bs ms integrated msc undergraduate dual degree'},
  {name:'Academics › M.Sc. (Two-Year)',url:'academics.html#msc',words:'msc m.sc postgraduate jam'},
  {name:'Academics › M.Tech. (CSDP)',url:'academics.html#mtech',words:'mtech m.tech csdp computer science data processing gate'},
  {name:'Academics › Ph.D.',url:'academics.html#phd',words:'phd ph.d doctoral research'},
  {name:'Academics › Courses & Curriculum',url:'academics.html#courses',words:'courses curriculum syllabus timetable'},
  {name:'Academics › Admissions (IIT Kharagpur)',url:'https://www.iitkgp.ac.in/navpage/admissions',words:'admissions apply eligibility jee advanced jam gate phd institute'},
  {name:'Students',url:'students.html',words:'students research scholars resources teaching seminars'},
  {name:'Students › BS-MS Students',url:'students.html#bs-ms-students',words:'bs-ms students integrated'},
  {name:'Students › M.Sc. Students',url:'students.html#msc-students',words:'msc m.sc students'},
  {name:'Students › M.Tech. Students',url:'students.html#mtech-students',words:'mtech m.tech csdp students'},
  {name:'Students › Student Activities',url:'students.html#activities',words:'activities colloquium clubs culture sports extracurricular'},
  {name:'Students › Achievements',url:'students.html#achievements',words:'achievements awards fellowships recognitions'},
  {name:'Students › Placement',url:'students.html#placement',words:'placement placements campus recruitment internships careers higher studies cdc recruiters'},
  {name:'Students › Job Opportunity',url:'students.html#job-opportunity',words:'job opportunity opportunities jobs openings vacancy vacancies recruitment jrf srf project fellowship internship career'},
  {name:'News & Events',url:'news-events.html',words:'announcements seminars lectures news academic events'},
  {name:'Publications',url:'publications.html',words:'research publications papers articles bibliography'},
  {name:'Contact Us',url:'contact.html',words:'contact us address phone telephone fax email e-mail office map location directions route railway station airport kolkata reach Kharagpur West Bengal'},
];

/* ===== People in the site search =====
   Built from people-data.js (loaded on every page), so faculty, adjunct faculty,
   postdoctoral fellows, research scholars and staff are ALL searchable here —
   not only faculty. Nothing to maintain by hand: add a person to people-data.js
   and they become searchable everywhere. */
(function(){
  const ALL = window.DEPT_PEOPLE || [];
  const AREAS = window.DEPT_AREAS || {};
  const LABEL = {faculty:'Faculty', adjunct:'Adjunct & INSPIRE Faculty', postdoc:'Postdoctoral Fellows',
                 scholar:'Research Scholars', staff:'Staff'};
  ALL.forEach(p=>{
    if(!p || !p.id || !p.name || p.status==='sample') return;
    let group = LABEL[p.type] || 'People';
    if(p.status==='former') group = 'Former Faculty';
    else if(p.status==='alumni') group = 'Alumni';
    const sup = p.supervisor && ALL.find(x=>x.id===p.supervisor);
    const words = [p.type, p.designation, p.grade, p.topic, p.roll, p.now, p.email,
                   p.head ? 'head of the department hod' : '',
                   sup ? 'supervisor ' + sup.name : '',
                   p.cosupervisor ? 'co-supervisor ' + p.cosupervisor : '',
                   (p.areas||[]).map(a=>AREAS[a]).filter(Boolean).join(' '),
                   group].filter(Boolean).join(' ');
    pages.push({name: group + ' › ' + p.name, url: 'profile.html?id=' + encodeURIComponent(p.id), words: words});
  });
})();
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
  const toks=q.split(/\s+/).filter(Boolean);
  const matches=pages.filter(p=>{const hay=(p.name+' '+p.words).toLowerCase();return toks.every(t=>hay.includes(t));});
  if(matches.length===0){const p=document.createElement('p');p.textContent='Nothing on the site matches that. Try a name, a research area or a page name.';searchResults.append(p);return;}
  const LIMIT=40;
  if(matches.length>LIMIT){
    const n=document.createElement('p');
    n.textContent=matches.length+' matches — showing the first '+LIMIT+'.';
    searchResults.append(n);
  }
  for(const item of matches.slice(0,LIMIT)){
    const a=document.createElement('a');a.href=item.url;a.textContent=item.name;
    if(/^https?:/i.test(item.url)){a.target='_blank';a.rel='noopener noreferrer';}
    searchResults.append(a);
  }
}
if(searchInput)searchInput.addEventListener('input',renderSearch);
if(searchForm)searchForm.addEventListener('submit',e=>{e.preventDefault();renderSearch();const first=searchResults?.querySelector('a');if(first)first.focus();});


// ===== Hero slideshow: the Head's message first, then photos every 3 seconds =====
(function(){
  const hero=document.getElementById('heroCarousel');
  if(!hero)return;
  const wrap=hero.querySelector('.hero-slides');
  const templates=[...wrap.querySelectorAll('[data-photo-template]')];
  templates.forEach(t=>t.remove());

  // photos come from gallery-data.js (entries with "hero": true).
  // The slides are built straight away so the slideshow never waits for a download;
  // a photo whose file is missing falls back to the plain panel.
  const photos=(window.DEPT_GALLERY||[]).filter(p=>p&&p.hero&&p.src);
  const n=Math.max(templates.length,photos.length);
  for(let i=0;i<n;i++){
    const t=templates[i%templates.length].cloneNode(true);
    t.removeAttribute('data-photo-template');
    const p=photos[i];
    const media=t.querySelector('.hero-media'),img=t.querySelector('img');
    if(p&&img){
      img.alt=p.title||'';
      img.loading=i<2?'eager':'lazy';
      img.decoding='async';
      img.addEventListener('error',()=>{if(media)media.classList.add('no-photo');img.remove();});
      img.src=p.src;
      const cap=t.querySelector('.hero-caption');
      if(cap&&p.title&&i>=templates.length)cap.textContent=p.title;
    }
    else{if(img)img.remove();if(media)media.classList.add('no-photo');}
    wrap.append(t);
  }
  start();

  function start(){
    const slides=[...wrap.querySelectorAll('.hero-slide')];
    const controls=hero.querySelector('.hero-controls'),progress=hero.querySelector('.hero-progress');
    if(slides.length<2){if(controls)controls.hidden=true;if(progress)progress.hidden=true;return;}
    const dotsWrap=document.getElementById('heroDots');
    const prevBtn=document.getElementById('heroPrev');
    const nextBtn=document.getElementById('heroNext');
    const pauseBtn=document.getElementById('heroPause');
    const bar=progress?progress.querySelector('span'):null;
    const reduce=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let current=0;
    let paused=reduce;
    let videoHold=false;

    slides.forEach((s,i)=>s.setAttribute('aria-label',(i+1)+' of '+slides.length));
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
      const ms=+slides[current].dataset.duration||3000;
      progress.style.setProperty('--hero-interval',ms+'ms');
      if(!paused)progress.classList.add('run');
    }
    function go(i){
      current=(i+slides.length)%slides.length;
      slides.forEach((s,j)=>{
        const on=j===current;
        s.classList.toggle('is-active',on);s.setAttribute('aria-hidden',String(!on));
        if(!on)s.querySelectorAll('video').forEach(v=>v.pause());
      });
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
    pauseBtn.addEventListener('click',()=>{videoHold=false;setPaused(!paused);});

    // while the Head's video plays, hold the slideshow; carry on when it stops
    hero.querySelectorAll('video').forEach(v=>{
      v.addEventListener('play',()=>{videoHold=true;setPaused(true);});
      v.addEventListener('ended',()=>{if(videoHold){videoHold=false;setPaused(false);}});
    });

    // hold while someone is reading the Head's message (dialog open / touching or scrolling the panel)
    const dlg=document.getElementById('hodDialog');
    let dlgHold=false,touchTimer=null;
    const holdOn=()=>{dlgHold=true;setPaused(true);};
    const holdOff=()=>{if(dlgHold){dlgHold=false;if(!videoHold)setPaused(false);}};
    if(dlg){
      dlg.addEventListener('close',holdOff);
      new MutationObserver(()=>{dlg.open?holdOn():holdOff();}).observe(dlg,{attributes:true,attributeFilter:['open']});
    }
    const hodPanel=hero.querySelector('.hod-panel');
    if(hodPanel){
      const touch=()=>{holdOn();clearTimeout(touchTimer);touchTimer=setTimeout(holdOff,15000);};
      hodPanel.addEventListener('touchstart',touch,{passive:true});
      hodPanel.addEventListener('wheel',touch,{passive:true});
    }

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
    go(0);
  }
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

// ===== Highlight the current page in the navbar =====
(function(){
  const file=(location.pathname.split('/').pop()||'index.html').toLowerCase();
  document.querySelectorAll('#navLinks > a, #navLinks > .has-dropdown > a').forEach(a=>{
    if((a.getAttribute('href')||'').toLowerCase()===file){a.classList.add('active');a.setAttribute('aria-current','page');}
  });
})();

// ===== Homepage: "Latest" ticker, filled from the top 3 Notice Board items =====
(function(){
  const ticker=document.getElementById('newsTicker');
  const track=document.getElementById('newsTickerTrack');
  const source=document.getElementById('noticeTrack');
  if(!ticker||!track||!source)return;
  const items=[...source.querySelectorAll('.notice-item:not([aria-hidden])')].slice(0,3);
  if(!items.length){ticker.hidden=true;return;}
  const build=hidden=>items.forEach(li=>{
    const link=li.querySelector('.notice-body a');
    const tag=li.querySelector('.notice-tag');
    const isNew=li.querySelector('.badge-new');
    const span=document.createElement('span');
    span.className='news-ticker-item';
    if(hidden)span.setAttribute('aria-hidden','true');
    if(tag){const t=tag.cloneNode(true);span.append(t);}
    if(isNew){const n=isNew.cloneNode(true);span.append(n);}
    const a=document.createElement('a');
    a.href=link?link.getAttribute('href'):'news-events.html';
    a.textContent=link?link.textContent.trim():'';
    if(hidden)a.tabIndex=-1;
    span.append(a);
    track.append(span);
  });
  build(false);
  const reduce=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const viewport=track.parentElement;
  if(reduce||track.scrollWidth<=viewport.clientWidth)return;
  build(true); // second copy for a seamless loop
  ticker.style.setProperty('--news-duration',Math.max(25,track.scrollWidth/2/60)+'s');
  ticker.classList.add('is-moving');
})();

// ===== Homepage: key numbers count up when they come into view =====
(function(){
  const nums=document.querySelectorAll('.stat-item strong[data-count]');
  if(!nums.length||!('IntersectionObserver' in window))return;
  if(window.matchMedia('(prefers-reduced-motion: reduce)').matches)return;
  const run=el=>{
    const end=parseInt(el.dataset.count,10);
    const start=end>1000?end-60:0;
    const t0=performance.now(),dur=1400;
    const step=t=>{
      const p=Math.min(1,(t-t0)/dur),e=1-Math.pow(1-p,3);
      el.textContent=Math.round(start+(end-start)*e);
      if(p<1)requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  };
  const io=new IntersectionObserver(entries=>entries.forEach(en=>{
    if(en.isIntersecting){run(en.target);io.unobserve(en.target);}
  }),{threshold:.6});
  nums.forEach(n=>io.observe(n));
})();

// ===== Homepage: pop-ups for the Head's full message and video =====
(function(){
  document.querySelectorAll('[data-open]').forEach(btn=>{
    const dlg=document.getElementById(btn.dataset.open);
    if(!dlg)return;
    btn.addEventListener('click',()=>{
      if(typeof dlg.showModal==='function')dlg.showModal();else dlg.setAttribute('open','');
    });
  });
  document.querySelectorAll('.home-dialog').forEach(dlg=>{
    const stopMedia=()=>{
      dlg.querySelectorAll('video').forEach(v=>v.pause());
      dlg.querySelectorAll('iframe').forEach(f=>{const s=f.src;f.src='';f.src=s;});
    };
    const close=()=>{if(typeof dlg.close==='function')dlg.close();else dlg.removeAttribute('open');};
    dlg.querySelectorAll('[data-close]').forEach(b=>b.addEventListener('click',close));
    dlg.addEventListener('click',e=>{if(e.target===dlg)close();}); // click on backdrop
    dlg.addEventListener('close',stopMedia);
  });
})();
