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
