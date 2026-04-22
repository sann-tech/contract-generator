// ── Helpers ──────────────────────────────────────
const g = id => document.getElementById(id);
const gv = id => (g(id)||{}).value||'';
const php = n => '₱'+Number(n||0).toLocaleString('en-PH',{minimumFractionDigits:2,maximumFractionDigits:2});
const ts = () => new Date().toLocaleString('en-PH',{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'});
const esc = s => s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

let contracts = [], currentId = null, logoDataUrl = '', autoSaveTimer = null;
const ICON = {
  check:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="13" height="13"><polyline points="20 6 9 17 4 12"/></svg>`,
  x:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`,
  plus:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="14" height="14"><path d="M12 5v14M5 12h14"/></svg>`,
};

// ── Toast ─────────────────────────────────────────
function toast(msg, type='ok', dur=2600){
  const t=g('toast'), ti=g('toast-icon'), tm=g('toast-msg');
  tm.textContent=msg;
  if(type==='err'){ti.innerHTML='<circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15">';t.style.background='#991b1b'}
  else{ti.innerHTML='<polyline points="20 6 9 17 4 12"/>';t.style.background=''}
  t.classList.add('show');
  setTimeout(()=>t.classList.remove('show'), dur);
}

// ── Section toggle ─────────────────────────────────
function toggleSec(h){h.classList.toggle('collapsed');h.nextElementSibling.classList.toggle('hidden')}
function goTo(id){
  const el=g(id); if(!el) return;
  // If collapsed, open it first
  const hdr=el.querySelector('.sec-header');
  const body=el.querySelector('.sec-body');
  if(hdr && hdr.classList.contains('collapsed')){
    hdr.classList.remove('collapsed');
    if(body) body.classList.remove('hidden');
  }
  el.scrollIntoView({behavior:'smooth',block:'start'});
  setActiveNav(id);
}

// Map section IDs → nav items (by onclick attribute)
const SEC_NAV_MAP={
  'sec-dev':0,'sec-client':1,'sec-scope':2,'sec-pricing':3,
  'sec-extras':4,'sec-support':5,'sec-tnc':6,'sec-smtp':7
};

function setActiveNav(secId){
  const items=document.querySelectorAll('.sidebar .nav-item');
  const idx=SEC_NAV_MAP[secId];
  items.forEach((it,i)=>it.classList.toggle('active', i===idx));
}

// ── Scroll spy via IntersectionObserver ────────────
function initScrollSpy(){
  const sections=['sec-dev','sec-client','sec-scope','sec-pricing','sec-extras','sec-support','sec-tnc','sec-smtp']
    .map(id=>g(id)).filter(Boolean);

  // Track which sections are currently intersecting and pick the topmost
  const visible=new Set();

  const obs=new IntersectionObserver(entries=>{
    entries.forEach(e=>{
      if(e.isIntersecting) visible.add(e.target.id);
      else visible.delete(e.target.id);
    });
    // Pick the first section (in DOM order) that is visible
    for(const sec of sections){
      if(visible.has(sec.id)){
        setActiveNav(sec.id);
        break;
      }
    }
  },{root:null, rootMargin:'-10% 0px -60% 0px', threshold:0});

  sections.forEach(s=>obs.observe(s));
}

// Run after DOM is ready
document.addEventListener('DOMContentLoaded', initScrollSpy);
// Also run immediately in case DOM already loaded
if(document.readyState!=='loading') initScrollSpy();

// ── Logo ──────────────────────────────────────────
function handleLogo(e){
  const f=e.target.files[0]; if(!f) return;
  const r=new FileReader();
  r.onload=ev=>{
    logoDataUrl=ev.target.result;
    const img=g('logo-preview'); img.src=logoDataUrl; img.style.display='block';
    g('upload-icon').style.display='none';
    g('upload-text').textContent='Logo uploaded ✓ — click to change';
    autoSave();
  };
  r.readAsDataURL(f);
}

// ── Item builders ─────────────────────────────────
const rmIcon = `<button class="rm-btn" onclick="this.closest('.item-row').remove();updateSummary();autoSave()">${ICON.x}</button>`;

function addPage(text=''){
  const r=document.createElement('div'); r.className='item-row';
  r.innerHTML=`<input type="checkbox" checked/><input class="row-text" type="text" value="${esc(text)}" placeholder="Page name..." oninput="autoSave()"/>${rmIcon}`;
  g('pages-list').appendChild(r);
}
function addExtra(text='',price=''){
  const r=document.createElement('div'); r.className='item-row';
  r.innerHTML=`<input type="checkbox" checked/><input class="row-text" type="text" value="${esc(text)}" placeholder="Extra service..." oninput="autoSave()"/><div class="item-price"><input type="number" value="${price}" placeholder="0.00" oninput="updateSummary();autoSave()"/></div>${rmIcon}`;
  g('extras-list').appendChild(r);
}
function addExclusion(text=''){
  const r=document.createElement('div'); r.className='item-row';
  r.innerHTML=`<input type="checkbox" checked/><input class="row-text" type="text" value="${esc(text)}" placeholder="Exclusion..." oninput="autoSave()"/>${rmIcon}`;
  g('excl-list').appendChild(r);
}
function addTech(val=''){
  const inp=g('tech-input'); val=val||inp.value.trim(); if(!val) return;
  const tag=document.createElement('div'); tag.className='tech-tag';
  tag.innerHTML=`<span>${esc(val)}</span><button class="rm-btn" onclick="this.closest('.tech-tag').remove();autoSave()">${ICON.x}</button>`;
  g('tech-tags').appendChild(tag); inp.value=''; autoSave();
}

// ── Summary ───────────────────────────────────────
function updateSummary(){
  const dev=parseFloat(gv('cost-dev'))||0, domain=parseFloat(gv('cost-domain'))||0, hosting=parseFloat(gv('cost-hosting'))||0;
  let extras=0;
  document.querySelectorAll('#extras-list .item-row').forEach(r=>{
    if(r.querySelector('input[type=checkbox]').checked)
      extras+=parseFloat((r.querySelector('.item-price input')||{}).value)||0;
  });
  const total=dev+domain+hosting+extras, pct=parseFloat(gv('down-pct'))||50, down=total*(pct/100);
  g('s-dev').textContent=php(dev); g('s-domain').textContent=php(domain);
  g('s-host').textContent=php(hosting); g('s-extras').textContent=php(extras);
  g('s-total').textContent=php(total); g('s-down').textContent=php(down); g('s-final').textContent=php(total-down);
}

// ── Collect & populate ────────────────────────────
function collect(){
  const pages=[...document.querySelectorAll('#pages-list .item-row')].map(r=>({text:r.querySelector('.row-text').value,checked:r.querySelector('input[type=checkbox]').checked}));
  const extras=[...document.querySelectorAll('#extras-list .item-row')].map(r=>({text:r.querySelector('.row-text').value,price:(r.querySelector('.item-price input')||{}).value||'',checked:r.querySelector('input[type=checkbox]').checked}));
  const excl=[...document.querySelectorAll('#excl-list .item-row')].map(r=>({text:r.querySelector('.row-text').value,checked:r.querySelector('input[type=checkbox]').checked}));
  const tech=[...document.querySelectorAll('#tech-tags span')].map(s=>s.textContent);
  return{devName:gv('dev-name'),devEmail:gv('dev-email'),devGcash:gv('dev-gcash'),devBiz:gv('dev-business'),
    cliCompany:gv('cli-company'),cliContact:gv('cli-contact'),cliPhone:gv('cli-phone'),cliEmail:gv('cli-email'),
    projDesc:gv('proj-desc'),projTimeline:gv('proj-timeline'),
    costDev:gv('cost-dev'),costDomain:gv('cost-domain'),costHosting:gv('cost-hosting'),
    downPct:gv('down-pct'),suppDays:gv('supp-days'),suppRate:gv('supp-rate'),
    tnc:gv('tnc-text'),logo:logoDataUrl,pages,extras,excl,tech};
}

function populate(d){
  const sv=(id,v)=>{const el=g(id);if(el)el.value=v||''};
  sv('dev-name',d.devName);sv('dev-email',d.devEmail);sv('dev-gcash',d.devGcash);sv('dev-business',d.devBiz);
  sv('cli-company',d.cliCompany);sv('cli-contact',d.cliContact);sv('cli-phone',d.cliPhone);sv('cli-email',d.cliEmail);
  sv('proj-desc',d.projDesc);sv('proj-timeline',d.projTimeline);
  sv('cost-dev',d.costDev);sv('cost-domain',d.costDomain);sv('cost-hosting',d.costHosting);
  sv('down-pct',d.downPct||'50');sv('supp-days',d.suppDays);sv('supp-rate',d.suppRate);sv('tnc-text',d.tnc);
  setTimeout(autoResizeTnc, 0);
  logoDataUrl=d.logo||'';
  if(logoDataUrl){g('logo-preview').src=logoDataUrl;g('logo-preview').style.display='block';g('upload-icon').style.display='none';g('upload-text').textContent='Logo uploaded ✓ — click to change';}
  else{g('logo-preview').style.display='none';g('upload-icon').style.display='';g('upload-text').textContent='Click to upload your logo (PNG, JPG, SVG)';}
  g('pages-list').innerHTML='';(d.pages||[]).forEach(p=>addPageRaw(p));
  g('extras-list').innerHTML='';(d.extras||[]).forEach(e=>addExtraRaw(e));
  g('excl-list').innerHTML='';(d.excl||[]).forEach(e=>addExclRaw(e));
  g('tech-tags').innerHTML='';(d.tech||[]).forEach(t=>addTechRaw(t));
  updateSummary();
}

function addPageRaw(p){const r=document.createElement('div');r.className='item-row';r.innerHTML=`<input type="checkbox" ${p.checked!==false?'checked':''}/><input class="row-text" type="text" value="${esc(p.text||'')}" placeholder="Page name..." oninput="autoSave()"/>${rmIcon}`;g('pages-list').appendChild(r);}
function addExtraRaw(e){const r=document.createElement('div');r.className='item-row';r.innerHTML=`<input type="checkbox" ${e.checked!==false?'checked':''}/><input class="row-text" type="text" value="${esc(e.text||'')}" placeholder="Extra service..." oninput="autoSave()"/><div class="item-price"><input type="number" value="${e.price||''}" placeholder="0.00" oninput="updateSummary();autoSave()"/></div>${rmIcon}`;g('extras-list').appendChild(r);}
function addExclRaw(e){const r=document.createElement('div');r.className='item-row';r.innerHTML=`<input type="checkbox" ${e.checked!==false?'checked':''}/><input class="row-text" type="text" value="${esc(e.text||'')}" placeholder="Exclusion..." oninput="autoSave()"/>${rmIcon}`;g('excl-list').appendChild(r);}
function addTechRaw(t){const tag=document.createElement('div');tag.className='tech-tag';tag.innerHTML=`<span>${esc(t)}</span><button class="rm-btn" onclick="this.closest('.tech-tag').remove();autoSave()">${ICON.x}</button>`;g('tech-tags').appendChild(tag);}

// ── Auth state ────────────────────────────────────
// Pre-seeded by Flask if logged in (avoids flicker)
const __DEVZAN_USER__ = document.getElementById('__devzan-user__');
let currentUser = __DEVZAN_USER__ ? JSON.parse(__DEVZAN_USER__.textContent) : null;

// Show logout immediately if Flask already gave us a user — don't wait for fetchMe
if(currentUser){
  document.addEventListener('DOMContentLoaded', ()=>{
    const lw = document.getElementById('sb-logout-wrap');
    if(lw) lw.style.display='block';
  });
}

async function fetchMe(){
  try{
    const r=await fetch('/api/me');
    const d=await r.json();
    currentUser=d.loggedIn?d.user:null;
    console.log('[DevZan] Auth:', d.loggedIn ? 'Logged in as '+d.user?.email : 'Guest');
  }catch(e){currentUser=null;console.warn('[DevZan] fetchMe failed:',e);}
}

function renderAuthUI(){
  const userPanel=g('sb-user-panel'), guestPanel=g('sb-guest-panel');
  const guestBanner=g('guest-banner');
  const logoutWrap=g('sb-logout-wrap');
  if(currentUser){
    userPanel.style.display='block';
    guestPanel.style.display='none';
    if(guestBanner) guestBanner.style.display='none';
    if(logoutWrap) logoutWrap.style.display='block';
    // Fill in user details
    g('sb-user-name').textContent=currentUser.name||currentUser.email||'User';
    g('sb-user-email').textContent=currentUser.email||'';
    const wrap=g('sb-avatar-wrap');
    if(currentUser.avatar){
      wrap.innerHTML=`<img src="${currentUser.avatar}" alt="avatar" referrerpolicy="no-referrer"/>`;
    } else {
      g('sb-avatar-initial').textContent=(currentUser.name||'?')[0].toUpperCase();
    }
    // Pre-fill dev email if empty
    if(!gv('dev-email')&&currentUser.email) g('dev-email').value=currentUser.email;
    if(!gv('dev-name')&&currentUser.name)   g('dev-name').value=currentUser.name;
  } else {
    userPanel.style.display='none';
    guestPanel.style.display='block';
    if(guestBanner) guestBanner.style.display='';
    if(logoutWrap) logoutWrap.style.display='none';
  }
}

// ── API calls ─────────────────────────────────────
async function apiSave(data){
  if(!currentUser) return null; // guest: local only
  try{
    const r=await fetch('/api/contracts',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});
    if(r.status===401){return null;} // not logged in
    return await r.json();
  }catch{return null;}
}
async function apiDelete(id){
  if(!currentUser){return;} // guest: just remove from local array
  try{await fetch('/api/contracts/'+id,{method:'DELETE'});}catch{}
}
async function apiRevision(id,note){
  if(!currentUser) return null;
  try{const r=await fetch(`/api/contracts/${id}/revisions`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({note})});return await r.json();}catch{return null;}
}
async function loadFromServer(){
  if(!currentUser){loadLocal();return;}
  try{
    const r=await fetch('/api/contracts');
    if(r.ok) contracts=await r.json();
    else loadLocal();
  }catch{loadLocal();}
}

// ── Guest migration: import localStorage contracts after login ──
async function migrateGuestContracts(){
  try{
    const raw=localStorage.getItem('dz_c');
    if(!raw) return;
    const local=JSON.parse(raw);
    if(!local.length) return;
    if(!confirm(`You have ${local.length} guest contract(s). Import them to your account?`)) return;
    await fetch('/api/contracts/import',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(local)});
    localStorage.removeItem('dz_c');
    toast('Guest contracts imported ✓','ok',3000);
  }catch{}
}

// ── Local fallback storage (guest mode) ───────────
function loadLocal(){try{const d=localStorage.getItem('dz_c');if(d)contracts=JSON.parse(d);}catch{}}
function persistLocal(){
  if(currentUser) return; // logged-in users: server is source of truth
  try{localStorage.setItem('dz_c',JSON.stringify(contracts));}catch{}
}

// ── Save ──────────────────────────────────────────
async function saveContract(silent=false){
  const data=collect();
  const name=data.cliCompany||data.devName||'Untitled';
  let payload={...data,name};
  if(currentId) payload.id=currentId;

  if(currentUser){
    // Server save
    const saved=await apiSave(payload);
    if(saved&&!saved.error){
      currentId=saved.id;
      const idx=contracts.findIndex(c=>c.id===saved.id);
      if(idx>=0) contracts[idx]=saved; else contracts.push(saved);
      g('contract-num-display').textContent=saved.num||'—';
      renderRevisions(saved.revisions||[]);
    }
  } else {
    // Guest: localStorage
    if(!currentId){
      const id='c_'+Date.now(); currentId=id;
      const num=`CONTRACT-${new Date().getFullYear()}-${String(contracts.length+1).padStart(3,'0')}`;
      const c={id,name,num,data:collect(),revisions:[{note:'Contract created',time:ts(),type:'info'}]};
      contracts.push(c);
      g('contract-num-display').textContent=num;
    } else {
      const c=contracts.find(x=>x.id===currentId);
      if(c){c.data=collect();c.name=name;}
    }
    persistLocal();
  }
  renderSbContracts();
  if(!silent){toast('Contract saved ✓');addRevisionUI('Saved manually');}
}

function autoSave(){
  clearTimeout(autoSaveTimer);
  autoSaveTimer=setTimeout(()=>{if(currentId)saveContract(true);},2000);
  updateSummary();
}

// ── New contract ──────────────────────────────────
async function newContract(){
  await saveContract(true);
  currentId=null; logoDataUrl='';
  populate({pages:DEF_PAGES.map(p=>({text:p,checked:true})),excl:DEF_EXCL.map(e=>({text:e,checked:true})),tech:DEF_TECH,downPct:'50',tnc:DEF_TNC});
  const num=`CONTRACT-${new Date().getFullYear()}-${String(contracts.length+1).padStart(3,'0')}`;
  g('contract-num-display').textContent=num;
  g('revision-list').innerHTML='<p class="rev-empty">No revisions yet — changes are logged automatically on save.</p>';
  renderSbContracts();
  toast('New contract started');
}

async function loadContract(id){
  await saveContract(true);
  const c=contracts.find(x=>x.id===id); if(!c) return;
  currentId=id;
  populate(c.data||c);
  g('contract-num-display').textContent=c.num||'—';
  renderRevisions(c.revisions||[]);
  renderSbContracts();
  toast('Loaded: '+c.name);
}

let _deleteTargetId=null;
async function deleteContract(id,e){
  e.stopPropagation();
  _deleteTargetId=id;
  const c=contracts.find(x=>x.id===id);
  g('delete-contract-name').textContent=c?.name||'this contract';
  g('delete-modal').classList.add('show');
  document.body.style.overflow='hidden';
}
function closeDeleteModal(){
  g('delete-modal').classList.remove('show');
  document.body.style.overflow='';
  _deleteTargetId=null;
}
async function confirmDelete(){
  const id=_deleteTargetId; if(!id) return;
  closeDeleteModal();
  await apiDelete(id);
  contracts=contracts.filter(x=>x.id!==id);
  persistLocal();
  if(currentId===id){currentId=null;await newContract();}
  else renderSbContracts();
  toast('Contract deleted');
}

// ── Revisions UI ──────────────────────────────────
function addRevisionUI(note,type='info'){
  const list=g('revision-list');
  if(list.querySelector('.rev-empty')) list.innerHTML='';
  const item=document.createElement('div'); item.className='rev-item';
  item.innerHTML=`<div class="rev-dot ${type}"></div><span>${esc(note)}</span><span class="rev-time">${ts()}</span>`;
  list.insertBefore(item,list.firstChild);
}
function renderRevisions(revs){
  const list=g('revision-list');
  if(!revs||!revs.length){list.innerHTML='<p class="rev-empty">No revisions yet — changes are logged automatically on save.</p>';return;}
  list.innerHTML=revs.slice(0,12).map(r=>`<div class="rev-item"><div class="rev-dot ${r.type||'info'}"></div><span>${esc(r.note)}</span><span class="rev-time">${r.time}</span></div>`).join('');
}
function promptRevision(){
  g('note-input').value='';
  g('note-modal').classList.add('show');
  document.body.style.overflow='hidden';
  setTimeout(()=>g('note-input').focus(),100);
}
function closeNoteModal(){
  g('note-modal').classList.remove('show');
  document.body.style.overflow='';
}
function submitNote(){
  const note=g('note-input').value.trim();
  if(!note) return;
  closeNoteModal();
  addRevisionUI(note,'warn');
  if(currentId) apiRevision(currentId,note);
}

// ── Sidebar render ────────────────────────────────
function renderSbContracts(){
  const el=g('sb-contracts');
  if(!contracts.length){el.innerHTML='<p style="font-size:11px;color:rgba(255,255,255,.28);padding:4px 4px 8px">No saved contracts yet</p>';return;}
  el.innerHTML=contracts.map(c=>`
    <div class="sb-contract-card${c.id===currentId?' active':''}" onclick="loadContract('${c.id}')">
      <div style="flex:1;overflow:hidden">
        <div class="cc-name">${esc(c.name||'Untitled')}</div>
        <div class="cc-num">${c.num||''}</div>
      </div>
      <button class="cc-del" title="Delete" onclick="deleteContract('${c.id}',event)">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
      </button>
    </div>`).join('');
}

// ── Generate contract HTML ─────────────────────────
function buildContractHTML(d){
  const devName=d.devName||'Developer', devBiz=d.devBiz, cliCo=d.cliCompany||'Client', cliCtc=d.cliContact;
  const costDev=parseFloat(d.costDev)||0, costDomain=parseFloat(d.costDomain)||0, costHosting=parseFloat(d.costHosting)||0;
  const downPct=parseFloat(d.downPct)||50;
  const pages=(d.pages||[]).filter(p=>p.checked&&p.text);
  let extrasTotal=0;
  const extraItems=(d.extras||[]).filter(e=>e.checked&&e.text).map(e=>{const p=parseFloat(e.price)||0;extrasTotal+=p;return{n:e.text,p};});
  const excl=(d.excl||[]).filter(e=>e.checked&&e.text).map(e=>e.text);
  const tech=(d.tech||[]);
  const total=costDev+costDomain+costHosting+extrasTotal, down=total*(downPct/100), fin=total-down;
  const tl=d.projTimeline||'TBD', suppDays=d.suppDays||'30', suppRate=d.suppRate||'100';
  const today=new Date().toLocaleDateString('en-PH',{year:'numeric',month:'long',day:'numeric'});
  const cNum=contracts.find(x=>x.id===currentId)?.num||g('contract-num-display').textContent;

  const logoHtml=d.logo
    ?`<img class="ct-logo" src="${d.logo}" alt="Logo"/>`
    :`<div class="ct-logo-placeholder"><div class="mark"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg></div><span>${esc(devBiz||devName)}</span></div>`;

  let rows='';
  if(costDev) rows+=`<tr><td>Website Development (all pages)</td><td style="text-align:center;font-family:'DM Mono',monospace;font-size:11.5px">${esc(tl)}</td><td>${php(costDev)}</td></tr>`;
  if(costDomain) rows+=`<tr><td>Domain Name</td><td style="text-align:center;color:var(--ink4)">—</td><td>${php(costDomain)}</td></tr>`;
  if(costHosting) rows+=`<tr><td>Web Hosting (1 year)</td><td style="text-align:center;color:var(--ink4)">—</td><td>${php(costHosting)}</td></tr>`;
  extraItems.forEach(e=>{rows+=`<tr><td>${esc(e.n)}</td><td style="text-align:center;color:var(--ink4)">—</td><td>${php(e.p)}</td></tr>`;});
  rows+=`<tr class="ct-total-row"><td colspan="2"><strong>TOTAL CONTRACT PRICE</strong></td><td>${php(total)}</td></tr>`;

  const tncClauses=d.tnc
    ? d.tnc.split(/\n\n+/).map(c=>c.trim()).filter(Boolean)
        .map(c=>`<div class="ct-tnc-clause">${esc(c)}</div>`).join('')
    : '';
  const tncSection=d.tnc?`
    <div class="ct-section ct-section-tnc">
      <div class="ct-sec-title"><div class="ct-num-label">${excl.length?7:6}</div>Additional Terms & Conditions</div>
      <div class="ct-tnc">${tncClauses}</div>
    </div>`:'';

  const acceptNum=excl.length?(d.tnc?8:7):(d.tnc?7:6);
  const xIcon=`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="13" height="13"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;

  return `
    <!-- Dark letterhead -->
    <div class="ct-letterhead">
      <div class="ct-lh-left">
        <div>
          <div class="ct-lh-name">${esc(devBiz||devName)}</div>
          <div class="ct-lh-sub">Web Development Agreement</div>
        </div>
      </div>
      <div class="ct-lh-right">
        <div class="ct-lh-num">${esc(cNum)}</div>
        <div class="ct-lh-date-label">Date Issued</div>
        <div class="ct-lh-date">${today}</div>
      </div>
    </div>

    <!-- Title block -->
    <div class="ct-title-block">
      ${logoHtml}
      <div class="ct-doc-title">Web Development Agreement</div>
      <div class="ct-doc-sub">Service Contract</div>
    </div>

    <!-- Parties -->
    <div class="ct-parties">
      <div class="ct-party">
        <div class="ct-party-role">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>
          Developer
        </div>
        <div class="ct-party-name">${esc(devName)}</div>
        ${devBiz?`<div class="ct-party-detail">${esc(devBiz)}</div>`:''}
        ${d.devEmail?`<div class="ct-party-detail">${esc(d.devEmail)}</div>`:''}
        ${d.devGcash?`<div class="ct-party-detail">GCash: ${esc(d.devGcash)}</div>`:''}
      </div>
      <div class="ct-party">
        <div class="ct-party-role">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="7" width="18" height="14" rx="2"/><path d="M8 7V5a4 4 0 018 0v2"/></svg>
          Client
        </div>
        <div class="ct-party-name">${esc(cliCo)}</div>
        ${cliCtc?`<div class="ct-party-detail">Attn: ${esc(cliCtc)}</div>`:''}
        ${d.cliEmail?`<div class="ct-party-detail">${esc(d.cliEmail)}</div>`:''}
        ${d.cliPhone?`<div class="ct-party-detail">${esc(d.cliPhone)}</div>`:''}
      </div>
    </div>

    <!-- 1. Scope -->
    <div class="ct-section">
      <div class="ct-sec-title"><div class="ct-num-label">1</div>Scope of Work</div>
      <p style="font-size:12.5px;color:var(--ink2);line-height:1.8">${esc(d.projDesc||'The developer agrees to design and develop a website as discussed and agreed upon by both parties.')}</p>
      ${pages.length?`
        <div style="margin-top:12px;font-size:9.5px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:var(--ink4);margin-bottom:7px">Deliverable Pages / Sections</div>
        <div class="ct-pages">${pages.map(p=>`<span class="ct-page-tag">${esc(p.text)}</span>`).join('')}</div>`:''}
      ${tech.length?`
        <div style="margin-top:14px;font-size:9.5px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:var(--ink4);margin-bottom:6px">Technology Stack</div>
        <p style="font-size:12px;color:var(--ink2);font-family:'DM Mono',monospace;line-height:1.8">${tech.map(t=>esc(t)).join(' &nbsp;·&nbsp; ')}</p>`:''}
    </div>

    <!-- 2. Pricing -->
    <div class="ct-section">
      <div class="ct-sec-title"><div class="ct-num-label">2</div>Project Cost</div>
      <table class="ct-table">
        <thead><tr><th>Description</th><th style="text-align:center">Timeline</th><th>Amount (PHP)</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <div class="ct-payment-box">
        <div class="ct-pay-header">Payment Schedule</div>
        <div class="ct-pay-row"><span>Down Payment (${downPct}% upon contract signing)</span><span class="amt">${php(down)}</span></div>
        <div class="ct-pay-row"><span>Final Payment (${100-downPct}% upon project completion)</span><span class="amt">${php(fin)}</span></div>
        <div class="ct-pay-total"><span>Total Contract Price</span><span class="amt">${php(total)}</span></div>
        <div class="ct-pay-gcash">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/></svg>
          Payment via GCash: <strong>${esc(d.devGcash||'—')}</strong>&nbsp;(${esc(devName)})
        </div>
      </div>
    </div>

    <!-- 3. Exclusions -->
    ${excl.length?`
    <div class="ct-section">
      <div class="ct-sec-title"><div class="ct-num-label">3</div>Exclusions</div>
      <ul class="ct-list two-col excl-list">${excl.map(e=>`<li>${xIcon}${esc(e)}</li>`).join('')}</ul>
    </div>`:''}

    <!-- 4. Warranty -->
    <div class="ct-section">
      <div class="ct-sec-title"><div class="ct-num-label">${excl.length?4:3}</div>Warranty & Support</div>
      <ul class="ct-list supp-list">
        <li>${ICON.check}${esc(suppDays)} days of free post-launch technical support for bug fixes and minor adjustments.</li>
        <li>${ICON.check}Major redesigns or new features are excluded from the free support period.</li>
        <li>${ICON.check}Post-support hourly rate: <strong style="font-family:'DM Mono',monospace">${php(suppRate)}/hr</strong></li>
      </ul>
    </div>

    ${tncSection}

    <!-- Acceptance -->
    <div class="ct-section">
      <div class="ct-sec-title"><div class="ct-num-label">${acceptNum}</div>Acceptance & Agreement</div>
      <p class="ct-sig-intro">By signing below, both parties confirm that they have read, understood, and agreed to all terms and conditions contained in this Contract. This agreement becomes legally binding upon both parties' signatures.</p>
      <div class="ct-sig-area">
        <div class="ct-sig-box">
          <div class="ct-sig-label">Developer Signature</div>
          <div class="ct-sig-rect"><span class="ct-sig-rect-label">SIGN HERE</span></div>
          <div class="ct-sig-name">${esc(devName)}</div>
          <div class="ct-sig-role">Developer${devBiz?' · '+esc(devBiz):''}</div>
          <div class="ct-sig-date">Date: ___________________</div>
        </div>
        <div class="ct-sig-box">
          <div class="ct-sig-label">Client Signature</div>
          <div class="ct-sig-rect"><span class="ct-sig-rect-label">SIGN HERE</span></div>
          <div class="ct-sig-name">${esc(cliCo)}</div>
          <div class="ct-sig-role">Client${cliCtc?' · '+esc(cliCtc):''}</div>
          <div class="ct-sig-date">Date: ___________________</div>
        </div>
      </div>
    </div>

    <!-- Footer bar -->
    <div class="ct-footer">
      <div class="ct-footer-num">${esc(cNum)}</div>
      <div>Confidential — ${esc(devName)} &amp; ${esc(cliCo)}</div>
      <div>${today}</div>
    </div>
  `;
}

function generateContract(){
  saveContract(true);
  const d=collect();
  g('contract-paper').innerHTML=buildContractHTML(d);
  addRevisionUI('Contract generated','success');
  if(currentId) apiRevision(currentId,'Contract generated');
  const overlay=g('preview-overlay');
  overlay.classList.add('show');
  document.body.style.overflow='hidden';
  requestAnimationFrame(()=>{
    requestAnimationFrame(()=>{
      window.print();
      overlay.classList.remove('show');
      document.body.style.overflow='';
    });
  });
}
function closePreview(){g('preview-overlay').classList.remove('show');document.body.style.overflow='';}

// ── Email templates ────────────────────────────────
function buildEmails(){
  const d=collect();
  const devName=d.devName||'Developer', cliCo=d.cliCompany||'Client', cliCtc=d.cliContact||'';
  const costDev=parseFloat(d.costDev)||0,costDomain=parseFloat(d.costDomain)||0,costHosting=parseFloat(d.costHosting)||0;
  let ext=0; d.extras.filter(e=>e.checked).forEach(e=>{ext+=parseFloat(e.price)||0;});
  const total=costDev+costDomain+costHosting+ext, downPct=parseFloat(d.downPct)||50, down=total*(downPct/100);
  const tl=d.projTimeline||'TBD', gcash=d.devGcash||'—';
  const cNum=contracts.find(x=>x.id===currentId)?.num||g('contract-num-display').textContent;
  const hi=cliCtc?`Hi ${cliCtc},`:`Dear ${cliCo} Team,`;
  const subj=`Web Development Contract – ${cliCo} | ${cNum}`;

  g('email-initial').textContent=
`Subject: ${subj}

${hi}

I hope this message finds you well. Thank you for choosing me to work on your project — I'm excited to get started!

Please find your Web Development Contract (${cNum}) attached to this email. Here is a brief summary of our agreement:

📋 CONTRACT SUMMARY
━━━━━━━━━━━━━━━━━━━
• Contract No.:  ${cNum}
• Developer:     ${devName}
• Client:        ${cliCo}
• Timeline:      ${tl}
• Total Amount:  ${php(total)}

💳 PAYMENT SCHEDULE
━━━━━━━━━━━━━━━━━━━
• Down Payment (${downPct}%):   ${php(down)}  ← due upon signing
• Final Payment (${100-downPct}%):  ${php(total-down)}  ← due upon completion
• Via GCash: ${gcash} (${devName})

📌 NEXT STEPS
━━━━━━━━━━━━━
1. Review the attached contract carefully.
2. Reply to confirm your agreement.
3. Send the down payment of ${php(down)} to GCash: ${gcash}.
4. Development begins once payment is confirmed!

Please don't hesitate to reach out for any questions or clarifications.

Looking forward to building something great together!

Warm regards,
${devName}
${d.devEmail||''}`;

  g('email-followup').textContent=
`Subject: Follow-up: ${subj}

${hi}

I'm following up regarding the Web Development Contract (${cNum}) I sent earlier.

A quick reminder of the key details:
• Total:          ${php(total)}
• Down Payment:   ${php(down)} via GCash (${gcash})

I'd love to get started on your project as soon as possible! Please let me know if you have any questions or if you'd like to discuss any part of the contract.

Looking forward to your response. 😊

Best regards,
${devName}
${d.devEmail||''}`;

  g('email-signed').textContent=
`Subject: Contract Confirmed — Project Starts Now! 🚀 | ${cNum}

${hi}

Fantastic news — I've received your signed contract and down payment of ${php(down)}. We're officially getting started! 🎉

🗓️ PROJECT TIMELINE: ${tl}

I'll be in touch regularly with progress updates, and I'll reach out whenever I need content, feedback, or approvals from your side.

📞 HOW WE'LL COMMUNICATE
━━━━━━━━━━━━━━━━━━━━━━━━
Feel free to message me at any time. I'll respond within 24 hours on business days.

Let's build something amazing! 💪

Best regards,
${devName}
${d.devEmail||''}`;

  // Store subjects for sending
  window._emailSubjects={initial:subj,followup:'Follow-up: '+subj,signed:'Contract Confirmed — Project Starts Now! 🚀 | '+cNum};
  window._emailTo=d.cliEmail;
}

// ── Generate PDF via Flask/WeasyPrint (server-side) ─────────────
// Gumagamit ng server-side PDF generation para sa malinis at kumpleto na PDF.
// Hindi na gumagamit ng html2pdf.js / html2canvas na nagre-result sa cropped output.

async function generateContractPdfBase64(){
  const d=collect();
  const cNum=contracts.find(x=>x.id===currentId)?.num||g('contract-num-display').textContent;
  const contractBody=buildContractHTML(d);

  const fullHtml=`<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<style>
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700&family=DM+Mono:wght@400;500&display=swap');
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'DM Sans',sans-serif;font-size:12.5px;line-height:1.7;background:#fff;color:#0f172a;padding:10mm 0}
.ct-paper{padding:0 14mm}
.ct-letterhead{background:#0f172a;color:#fff;padding:18px 14mm;margin:0 0 20px;display:flex;align-items:center;justify-content:space-between}
.ct-lh-left{display:flex;align-items:center;gap:12px}
.ct-lh-mark{width:30px;height:30px;background:#fff;border-radius:6px;display:flex;align-items:center;justify-content:center;flex-shrink:0}
.ct-lh-mark svg{color:#0e0e0e;width:14px;height:14px}
.ct-lh-name{font-size:15px;font-weight:600;letter-spacing:-.2px}
.ct-lh-sub{font-size:10px;color:rgba(255,255,255,.4);margin-top:1px;letter-spacing:.4px}
.ct-lh-right{text-align:right}
.ct-lh-num{font-family:'DM Mono',monospace;font-size:11px;font-weight:500;color:rgba(255,255,255,.9);letter-spacing:.8px;background:rgba(255,255,255,.1);padding:4px 10px;border-radius:4px;display:inline-block;margin-bottom:4px}
.ct-lh-date-label{font-size:9px;color:rgba(255,255,255,.35);text-transform:uppercase;letter-spacing:.8px}
.ct-lh-date{font-size:12px;color:rgba(255,255,255,.8);margin-top:1px}
.ct-title-block{margin-bottom:14px;padding-bottom:13px;border-bottom:1.5px solid #e2e8f0}
.ct-logo{max-height:52px;max-width:150px;object-fit:contain;margin-bottom:8px;display:block}
.ct-logo-placeholder{display:flex;align-items:center;gap:8px;margin-bottom:8px;font-size:17px;font-weight:700;color:#0f172a}
.ct-logo-placeholder .mark{width:28px;height:28px;background:#0f172a;border-radius:6px;display:flex;align-items:center;justify-content:center}
.ct-logo-placeholder .mark svg{width:13px;height:13px;color:#fff}
.ct-doc-title{font-size:22px;font-weight:700;color:#0f172a;letter-spacing:-.4px;margin-bottom:3px}
.ct-doc-sub{font-size:12px;color:#94a3b8;letter-spacing:.2px}
.ct-parties{display:grid;grid-template-columns:1fr 1fr;gap:0;border:1.5px solid #e2e8f0;border-radius:6px;overflow:hidden;margin-bottom:16px}
.ct-party{background:#fff;padding:12px 16px}
.ct-party:first-child{border-right:1.5px solid #e2e8f0}
.ct-party-role{font-size:9.5px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#94a3b8;margin-bottom:8px;display:flex;align-items:center;gap:5px}
.ct-party-role svg{width:11px;height:11px}
.ct-party-name{font-size:15px;font-weight:700;color:#0f172a;margin-bottom:3px}
.ct-party-detail{font-size:11.5px;color:#64748b;margin-top:2px;font-family:'DM Mono',monospace}
.ct-section{margin-bottom:18px}
.ct-sec-title{display:flex;align-items:center;gap:9px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1.2px;color:#0f172a;border-bottom:2px solid #0f172a;padding-bottom:6px;margin-bottom:12px}
.ct-num-label{display:inline-flex;align-items:center;justify-content:center;width:20px;height:20px;border-radius:4px;background:#0f172a;color:#fff;font-size:10px;font-weight:700;flex-shrink:0;font-family:'DM Mono',monospace}
.ct-table{width:100%;border-collapse:collapse;margin:6px 0;border:1.5px solid #e2e8f0}
.ct-table thead tr th{background:#0f172a;color:#fff;padding:8px 12px;font-size:10.5px;font-weight:600;text-align:left;letter-spacing:.4px}
.ct-table thead tr th:last-child{text-align:right}
.ct-table tbody tr:nth-child(even) td{background:#f8fafc}
.ct-table tbody tr:nth-child(odd) td{background:#fff}
.ct-table td{padding:8px 12px;border-bottom:1px solid #e2e8f0;font-size:12.5px;color:#334155}
.ct-table td:last-child{text-align:right;font-weight:500;font-family:'DM Mono',monospace}
.ct-table .ct-total-row td{border-bottom:none;font-weight:700;color:#fff;background:#0f172a;font-size:13px}
.ct-table .ct-total-row td:last-child{font-size:14px;letter-spacing:-.3px}
.ct-payment-box{background:#f8fafc;border:1.5px solid #e2e8f0;border-radius:6px;padding:12px 14px;margin-top:8px}
.ct-pay-header{font-size:9.5px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#94a3b8;margin-bottom:9px}
.ct-pay-row{display:flex;justify-content:space-between;align-items:center;font-size:12px;color:#334155;padding:4px 0;border-bottom:1px dashed #e2e8f0}
.ct-pay-row:last-of-type{border-bottom:none}
.ct-pay-row .amt{font-family:'DM Mono',monospace;font-weight:500}
.ct-pay-total{display:flex;justify-content:space-between;align-items:center;margin-top:8px;padding:8px 12px;background:#0f172a;border-radius:6px;color:#fff;font-weight:700;font-size:12.5px}
.ct-pay-total .amt{font-family:'DM Mono',monospace;color:#60a5fa;font-size:13.5px}
.ct-pay-gcash{margin-top:8px;font-size:11px;color:#64748b;display:flex;align-items:center;gap:5px}
.ct-pay-gcash strong{color:#0f172a;font-family:'DM Mono',monospace}
.ct-pages{display:flex;flex-wrap:wrap;gap:4px;margin-top:6px}
.ct-page-tag{padding:3px 8px;background:#f1f5f9;color:#334155;border-radius:4px;font-size:11px;font-weight:500;border:1px solid #e2e8f0}
.ct-list{list-style:none;padding:0;margin:0}
.ct-list li{display:flex;align-items:flex-start;gap:7px;font-size:12px;color:#334155;margin-bottom:4px;padding:6px 10px;border-radius:5px;background:#f8fafc;border:1px solid #e2e8f0}
.ct-list li svg{width:12px;height:12px;flex-shrink:0;margin-top:2px}
.ct-list.excl-list li svg{color:#991b1b}
.ct-list.supp-list li svg{color:#065f46}
.ct-list.two-col{display:grid;grid-template-columns:1fr 1fr;gap:4px}
.ct-list.two-col li{margin-bottom:0}
.ct-tnc{background:#f8fafc;border:1.5px solid #e2e8f0;border-radius:6px;padding:10px 14px}
.ct-tnc-clause{font-size:11.5px;line-height:1.75;color:#334155;white-space:pre-wrap;page-break-inside:avoid;break-inside:avoid;margin-bottom:8px;padding-bottom:8px;border-bottom:1px dashed #e2e8f0}
.ct-tnc-clause:last-child{margin-bottom:0;padding-bottom:0;border-bottom:none}
.ct-section-tnc{page-break-inside:auto}
.ct-sig-intro{font-size:12px;color:#334155;line-height:1.65;margin-bottom:20px}
.ct-sig-area{display:grid;grid-template-columns:1fr 1fr;gap:40px;margin-top:6px}
.ct-sig-box{display:flex;flex-direction:column}
.ct-sig-label{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#94a3b8;margin-bottom:6px}
.ct-sig-rect{border:1.5px solid #e2e8f0;border-radius:5px;height:48px;background:#fafaf9;margin-bottom:8px;display:flex;align-items:flex-end;padding:4px 8px}
.ct-sig-rect-label{font-size:9px;color:#cbd5e1;letter-spacing:.5px}
.ct-sig-name{font-size:12.5px;font-weight:700;color:#0f172a;margin-bottom:2px}
.ct-sig-role{font-size:11px;color:#64748b}
.ct-sig-date{font-size:10px;color:#94a3b8;margin-top:5px;font-family:'DM Mono',monospace;border-top:1.5px solid #e2e8f0;padding-top:5px}
.ct-footer{margin-top:24px;padding:9px 14px;background:#0f172a;border-radius:6px;display:flex;align-items:center;justify-content:space-between;color:rgba(255,255,255,.5);font-size:10px;font-family:'DM Mono',monospace;letter-spacing:.4px}
.ct-footer-num{color:rgba(255,255,255,.85);font-weight:500}
p{margin-bottom:6px}
</style>
</head>
<body>
<div class="ct-paper">
${contractBody}
</div>
</body>
</html>`;

  // Try server-side WeasyPrint first (produces perfect, complete PDFs)
  try{
    const resp=await fetch('/api/generate-pdf',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({html:fullHtml,filename:`${cNum}.pdf`})
    });
    const result=await resp.json();
    if(result.ok && result.pdf_base64){
      return{base64:result.pdf_base64,filename:result.filename||`${cNum}.pdf`};
    }
    console.warn('[PDF] WeasyPrint not available, falling back to html2pdf.js:',result.error);
  }catch(e){
    console.warn('[PDF] Server PDF failed, falling back:',e.message);
  }

  // Fallback: html2pdf.js (kapag hindi available ang WeasyPrint)
  const pdfStyle=document.createElement('style');
  pdfStyle.id='_pdf_style_';
  pdfStyle.textContent=`
    #_pdf_root_{font-family:'DM Sans',sans-serif;font-size:12.5px;line-height:1.7;background:#fff;width:794px;box-sizing:border-box;padding:36px 0 60px;}
    #_pdf_root_ .ct-paper{padding:0 72px;box-sizing:border-box;}
    #_pdf_root_ .ct-letterhead{margin:0 -72px 20px !important;padding:18px 72px !important;width:calc(100% + 144px) !important;box-sizing:border-box !important;}
  `;
  document.head.appendChild(pdfStyle);
  const host=document.createElement('div');
  host.style.cssText='position:absolute;left:-9999px;top:0;visibility:visible;z-index:-9999;pointer-events:none;width:794px;overflow:visible;';
  host.innerHTML=`<div id="_pdf_root_"><div class="ct-paper">${contractBody}</div></div>`;
  document.body.appendChild(host);
  try{ await document.fonts.ready; }catch(e){}
  await new Promise(r=>setTimeout(r,600));
  const root=host.querySelector('#_pdf_root_');
  try{
    const blob=await html2pdf().set({
      margin:[0,0],filename:`${cNum}.pdf`,
      image:{type:'jpeg',quality:0.98},
      html2canvas:{scale:2,useCORS:true,allowTaint:true,logging:false,width:794,windowWidth:794,x:0,y:0,scrollX:9999,scrollY:0},
      jsPDF:{unit:'mm',format:'a4',orientation:'portrait'}
    }).from(root).outputPdf('blob');
    const base64=await new Promise((resolve,reject)=>{
      const reader=new FileReader();
      reader.onload=()=>resolve(reader.result.split(',')[1]);
      reader.onerror=reject;
      reader.readAsDataURL(blob);
    });
    return{base64,filename:`${cNum}.pdf`};
  }finally{
    document.body.removeChild(host);
    document.head.removeChild(pdfStyle);
  }
}
// ── PDF Upload handlers ─────────────────────────
const _uploadedPdfs={};
function handlePdfUpload(type, input){
  const file=input.files[0];
  if(!file) return;
  const reader=new FileReader();
  reader.onload=e=>{
    _uploadedPdfs[type]={base64:e.target.result.split(',')[1], filename:file.name};
    const label=input.closest('.pdf-attach-label');
    label.classList.add('has-file');
    g(`pdf-attach-text-${type}`).textContent=`📎 ${file.name}`;
    g(`pdf-clear-${type}`).style.display='';
  };
  reader.readAsDataURL(file);
}
function clearPdfUpload(type){
  delete _uploadedPdfs[type];
  g(`pdf-upload-${type}`).value='';
  const label=g(`pdf-upload-${type}`).closest('.pdf-attach-label');
  label.classList.remove('has-file');
  const defaultText=type==='signed'?'Attach signed PDF (optional)':'Attach PDF (optional)';
  g(`pdf-attach-text-${type}`).textContent=defaultText;
  g(`pdf-clear-${type}`).style.display='none';
}
// ── Send email via Flask API ───────────────────────
async function sendEmailNow(type){
  const d=collect();
  const btn=g(`send-btn-${type}`);
  const to=d.cliEmail;
  if(!to){toast('No client email set in Client Info','err');return;}
  if(!gv('smtp-user')||!gv('smtp-pass')){toast('Set SMTP credentials in Email Settings section','err');return;}

  btn.disabled=true;

  let pdfBase64=null, pdfFilename='contract.pdf';

  // Manual PDF upload only
  if(_uploadedPdfs[type]){
    pdfBase64=_uploadedPdfs[type].base64;
    pdfFilename=_uploadedPdfs[type].filename;
  }

  btn.innerHTML=`<div class="spinner"></div> Sending…`;
  const bodyText=g(`email-${type}`).textContent;
  const subj=window._emailSubjects?.[type]||'Web Development Contract';

  try{
    const res=await fetch('/api/send-email',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({
        smtp:{host:gv('smtp-host'),port:gv('smtp-port'),user:gv('smtp-user'),password:gv('smtp-pass')},
        to, subject:subj, body:bodyText,
        pdf_base64:pdfBase64,
        pdf_filename:pdfFilename
      })
    });
    const result=await res.json();
    if(result.ok){
      const note=pdfBase64?' (with PDF attached)':'';
      toast(`Email sent to ${to} ✓${note}`,'ok',3500);
      addRevisionUI(`Email sent (${type}) to ${to}`,'success');
      if(currentId) apiRevision(currentId,`Email sent (${type}) to ${to}`);
    } else {
      toast(result.error||'Failed to send','err',4000);
    }
  }catch(e){
    toast('Cannot reach server. Is app.py running?','err',4000);
  }
  btn.disabled=false;
  btn.innerHTML=`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg> Send Now`;
}

function openEmailModal(){buildEmails();g('email-modal').classList.add('show');document.body.style.overflow='hidden';}
function closeEmailModal(){g('email-modal').classList.remove('show');document.body.style.overflow='';}

function switchTab(tabId){
  document.querySelectorAll('.tab-btn').forEach((b,i)=>b.classList.toggle('active',['tab-initial','tab-followup','tab-signed'][i]===tabId));
  document.querySelectorAll('.tab-panel').forEach(p=>p.classList.toggle('active',p.id===tabId));
}

function copyEmail(id,btn){
  navigator.clipboard.writeText(g(id).textContent).then(()=>{
    const orig=btn.innerHTML;
    btn.innerHTML=`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="14" height="14"><polyline points="20 6 9 17 4 12"/></svg> Copied!`;
    btn.classList.add('copied');
    setTimeout(()=>{btn.innerHTML=orig;btn.classList.remove('copied');},2000);
  });
}

// ── Auto-resize TnC textarea ──────────────────────
function autoResizeTnc(){
  const ta=g('tnc-text'); if(!ta) return;
  ta.style.height='auto';
  ta.style.height=ta.scrollHeight+'px';
}

// ── Defaults ──────────────────────────────────────
const DEF_PAGES=['Homepage','About Us Page (Company background, Mission, Vision & Core Values)','Services Page','Projects / Portfolio Page','Contact Page'];
const DEF_EXCL=['Hosting subscription fees','Domain registration fees','Third-party API subscription fees','No refund / No return policy','Major feature changes outside agreed scope','No Admin Panel'];
const DEF_TECH=['Frontend: HTML, CSS, JavaScript','CSS Framework: Bootstrap 5','Hosting: Hostinger with SSL Certificate'];
const DEF_TNC=`1. OWNERSHIP
Upon receipt of full payment, the Client shall own all deliverables produced under this contract, including source code and design files.

2. CONFIDENTIALITY
Both parties agree to maintain the confidentiality of all project-related information and shall not disclose it to third parties without prior written consent.

3. REVISIONS
This contract includes up to 3 rounds of minor revisions. Major scope changes or feature additions may require a new or amended agreement.

4. INTELLECTUAL PROPERTY
The Developer retains the right to display the completed project in their portfolio unless otherwise agreed in writing.

5. LATE PAYMENT
If the final payment is not received within 7 days of project completion, the Developer reserves the right to take the site offline until full payment is received.

6. DISPUTE RESOLUTION
Any disputes arising from this contract shall first be resolved through good-faith negotiation. If unresolved, both parties agree to binding arbitration.

7. GOVERNING LAW
This contract shall be governed by the laws of the Republic of the Philippines.`;

// ── Init ──────────────────────────────────────────
(async function init(){
  await fetchMe();
  if(currentUser) await migrateGuestContracts();
  renderAuthUI();
  await loadFromServer();
  renderSbContracts();
  if(contracts.length>0){
    const last=contracts[contracts.length-1];
    currentId=last.id;
    populate(last.data||last);
    g('contract-num-display').textContent=last.num||'—';
    renderRevisions(last.revisions||[]);
  } else {
    populate({pages:DEF_PAGES.map(p=>({text:p,checked:true})),excl:DEF_EXCL.map(e=>({text:e,checked:true})),tech:DEF_TECH,downPct:'50',tnc:DEF_TNC});
    const num=`CONTRACT-${new Date().getFullYear()}-001`;
    g('contract-num-display').textContent=num;
  }
  updateSummary();
})();