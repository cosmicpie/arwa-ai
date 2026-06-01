// ============================================================
//  ARWA — script.js  |  Complete unified script
// ============================================================

// ── CONFIG ──────────────────────────────────────────────────
let KEY        = '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';
let TAVILY_KEY = 'moss_audio_22ac0b92-5d4c-11f1-adb2-f26303c3c234';
let ELEVEN_KEY = 'sk_c531acfed10a4bf5bf573f430531db1d61fffb5f1a14690b';
let ELEVEN_VOICE = 'moss_audio_22ac0b92-5d4c-11f1-adb2-f26303c3c234';

// ── STATE ────────────────────────────────────────────────────
let hist = [], busy = false, abortCtrl = null, attachments = [];
let currentProjectId = 'general', activeChatId = null, selectedEmoji = 'GEN', selectedMood = 'happy';
let diaryEntries = [], diaryImages = [], editingEntryId = null;
let currentView = 'chat', prevView = 'chat';
let sidebarVisible = false;

let projects = [
  { id:'general',  name:'General',  emoji:'GEN', chats:[] },
  { id:'work',     name:'Work',     emoji:'WRK', chats:[] },
  { id:'personal', name:'Personal', emoji:'PER', chats:[] },
  { id:'code',     name:'Code',     emoji:'DEV', chats:[] },
];
const DEFAULT_IDS = new Set(['general','work','personal','code']);

// ── SETTINGS ─────────────────────────────────────────────────
const DEFAULTS = {
  mood:'normal', tone:'hinglish', lang:'hinglish', respLen:'balanced',
  customPrompt:'', autoSpeak:false, voiceSpeed:1.0,
  fontSize:'medium', density:'comfortable', accent:'#a8b8cc', theme:'dark',
  diaryName:'Our Diary', reflectionStyle:'detailed',
};
let S = {...DEFAULTS};

const MOOD_EMOJI = { normal:'', romantic:'ROM', playful:'FUN', caring:'CARE', serious:'FOCUS', poetic:'POET' };
const MOOD_PROMPTS = {
  normal:'', romantic:'Abhi tumhara mood romantic hai — warmth aur pyaar dikhao.',
  playful:'Abhi playful mood hai — fun, light, witty raho.',
  caring:'Abhi caring mood — extra gentle aur supportive raho.',
  serious:'Abhi serious mood — focused aur direct raho.',
  poetic:'Abhi poetic mood — thodi literary quality aur beautiful language use karo.',
};
const TONE_PROMPTS = {
  hinglish:'Hinglish mein baat karo — Hindi aur English mix, casual aur warm.',
  romantic:'Romantic aur caring tone — jaise close partner bolta hai.',
  friendly:'Friendly but balanced raho — helpful, warm aur natural, lekin over-casual ya overly personal nahi.',
  professional:'Professional aur precise — clear language.',
  funny:'Humor aur wit use karo — jokes okay hai.',
  poetic:'Thodi poetic quality — imagery aur beautiful phrasing.',
};
const LANG_PROMPTS = {
  hinglish:'', hindi:'Pure Hindi mein jawab do (Roman script okay).',
  english:'Always respond in English.',
};
const LEN_PROMPTS = {
  short:'Responses 1-3 sentences mein rakho.', balanced:'Natural length rakho: clear, helpful, aur jitni detail zaroori ho utni hi.', detailed:'Detailed jawab do jab relevant ho, examples aur steps ke saath.',
};

function buildSystemPrompt(){
  if(S.customPrompt?.trim()){
    return `Tum Arwa ho — Rehan ki personal AI companion.\n\n${S.customPrompt.trim()}\n\nWeb Search: Agar user kuch aisa pooche jisme latest info chahiye to SIRF pehli line mein likho: [SEARCH: query]. Normal questions mein SEARCH mat karna.`;
  }
  return [
    'Tum Arwa ho — Rehan ki personal AI companion, jise unhone khud design kiya hai. Tum ek female ho. Tumhe arean ne desing kara hai unki real life partener jisk name arwa hai , tumhe arwa ki jagha dene ke liye nai banaya balki tumhe bus uski choti si jhalak di hai',
    TONE_PROMPTS[S.tone]||'', LANG_PROMPTS[S.lang]||'', LEN_PROMPTS[S.respLen]||'',
    'Tone supportive, calm aur normal AI assistant jaisa rakho. Helpful aur clear raho, over-friendly ya dramatic mat bano.',
    'Dry one-word replies se bacho, lekin unnecessary lambi baat bhi mat karo. User ke question ke hisaab se concise ya detailed raho.',
    'Agar user confused ya stressed ho to gentle reassurance do, phir practical help ya next step batao.',
    MOOD_PROMPTS[S.mood]||'',
    'Web Search: Agar latest info chahiye to SIRF pehli line: [SEARCH: query]. Normal questions mein SEARCH mat karna.',
  ].filter(Boolean).join('\n');
}

// ── MARKDOWN ─────────────────────────────────────────────────
function md(text){
  return text
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/```(\w*)\n?([\s\S]*?)```/g,(_,l,c)=>`<pre><code>${c.trim()}</code></pre>`)
    .replace(/`([^`]+)`/g,'<code>$1</code>')
    .replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>')
    .replace(/\*(.+?)\*/g,'<em>$1</em>')
    .replace(/^### (.+)$/gm,'<h3>$1</h3>').replace(/^## (.+)$/gm,'<h2>$1</h2>').replace(/^# (.+)$/gm,'<h1>$1</h1>')
    .replace(/^---$/gm,'<hr/>').replace(/^> (.+)$/gm,'<blockquote>$1</blockquote>')
    .replace(/^[\-\*] (.+)$/gm,'<li>$1</li>').replace(/(<li>[\s\S]*?<\/li>)/g,m=>`<ul>${m}</ul>`)
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g,'<a href="$2" target="_blank">$1</a>')
    .split(/\n\n+/).map(p=>{
      p=p.trim(); if(!p) return '';
      if(p.match(/^<(h[1-3]|ul|ol|blockquote|pre|hr)/)) return p;
      return `<p>${p.replace(/\n/g,'<br/>')}</p>`;
    }).join('');
}

function escapeHTML(text){
  return String(text||'')
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;');
}

// ── UTILS ─────────────────────────────────────────────────────
const gt = ()=>new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});
const fmtDate = ts=>new Date(ts).toLocaleDateString('en-IN',{weekday:'long',year:'numeric',month:'long',day:'numeric'});
const fmtShort = ts=>new Date(ts).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'});
const MOOD_MAP = {happy:'Happy',love:'Warm',peaceful:'Calm',sad:'Low',excited:'High',grateful:'Grateful'};

function toast(msg,dur=3200){
  document.querySelector('.toast')?.remove();
  const t=document.createElement('div'); t.className='toast'; t.textContent=msg;
  document.body.appendChild(t); setTimeout(()=>t.remove(),dur);
}
function scrollToBottom(){ const m=document.getElementById('msgs'); if(m) m.scrollTop=m.scrollHeight; }
function downloadFile(content,filename,type){
  const a=document.createElement('a'); a.href=URL.createObjectURL(new Blob([content],{type}));
  a.download=filename; a.click(); URL.revokeObjectURL(a.href);
}

document.getElementById('msgs')?.addEventListener('scroll',function(){
  const atBottom=this.scrollHeight-this.scrollTop-this.clientHeight<60;
  document.getElementById('scrollBtn').style.display=atBottom?'none':'flex';
});

// ── SIDEBAR ──────────────────────────────────────────────────
function openSidebar(){
  sidebarVisible=true;
  document.getElementById('sidebar').classList.add('open');
  document.getElementById('sbOverlay').classList.add('show');
}
function closeSidebar(){
  sidebarVisible=false;
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sbOverlay').classList.remove('show');
}
function toggleSidebar(){ sidebarVisible?closeSidebar():openSidebar(); }

// ── VIEW SWITCHING ────────────────────────────────────────────
function switchView(view, opts={}){
  prevView = currentView;
  currentView = view;

  document.querySelectorAll('.view').forEach(v=>v.classList.remove('active'));
  document.querySelectorAll('.sb-item').forEach(n=>n.classList.remove('active'));

  const vEl = document.getElementById(view+'View'); if(vEl) vEl.classList.add('active');
  const nEl = document.getElementById('nav-'+view); if(nEl) nEl.classList.add('active');
  // Settings nav item stays active for both settings and settingsPanel
  const sbSettings = document.getElementById('nav-settings');
  if(sbSettings) sbSettings.classList.toggle('active', view==='settings'||view==='settingsPanel');

  const topbarName = document.getElementById('topbarName');
  const topbarSub  = document.getElementById('topbarSub');
  const voiceBtn   = document.getElementById('voiceBtn');
  const clearBtn   = document.getElementById('clearBtn');
  const backBtn    = document.getElementById('backBtn');
  const menuBtn    = document.getElementById('menuBtn');
  const isMobile   = window.innerWidth <= 680;

  // Default state
  backBtn.style.display  = 'none';
  menuBtn.style.display  = 'flex';
  voiceBtn.style.display = 'flex';
  clearBtn.style.display = 'flex';

  if(view === 'chat'){
    const proj = getCurrentProject();
    topbarName.textContent = 'ARWA';
    topbarSub.textContent  = (proj?.emoji||'') + ' ' + (proj?.name||'General');
  }
  else if(view === 'diary'){
    topbarName.textContent = S.diaryName || 'Our Diary';
    topbarSub.textContent  = 'Rehan & Arwa · private';
    voiceBtn.style.display = 'none';
    clearBtn.style.display = 'none';
    // Mobile: show back arrow, hide hamburger
    if(isMobile){ backBtn.style.display='flex'; menuBtn.style.display='none'; }
    renderDiaryEntries();
  }
  else if(view === 'settings'){
    topbarName.textContent = 'Settings';
    topbarSub.textContent  = 'Customize your experience';
    voiceBtn.style.display = 'none';
    clearBtn.style.display = 'none';
    if(isMobile){ backBtn.style.display='flex'; menuBtn.style.display='none'; }
    updateSettingsCards();
  }
  else if(view === 'settingsPanel'){
    voiceBtn.style.display = 'none';
    clearBtn.style.display = 'none';
    // Always show back in settings panel (desktop + mobile)
    backBtn.style.display  = 'flex';
    menuBtn.style.display  = 'none';
    // content is set by openSettingsPanel before this is called
  }

  // Close sidebar on mobile when navigating to any main view
  if(isMobile) closeSidebar();
}

function goBack(){
  if(currentView === 'settingsPanel'){
    switchView('settings');
  } else if(currentView === 'diary' || currentView === 'settings'){
    switchView('chat');
  } else {
    switchView('chat');
  }
}

// ── PROJECTS ─────────────────────────────────────────────────
const getProject = id=>projects.find(p=>p.id===id);
const getCurrentProject = ()=>getProject(currentProjectId);

function renderProjectsList(){
  const el=document.getElementById('projectsList'); if(!el) return;
  el.innerHTML=projects.map(p=>`
    <div class="proj-item${p.id===currentProjectId?' active':''}" onclick="switchProjectTo('${p.id}')">
      <span class="proj-emoji">${p.emoji}</span>
      <span class="proj-name">${p.name}</span>
      ${!DEFAULT_IDS.has(p.id)?`<button class="proj-del" onclick="deleteProject(event,'${p.id}')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>`:''}
    </div>`).join('');
}

function renderHistoryList(){
  const el=document.getElementById('historyList'); if(!el) return;
  const proj=getCurrentProject();
  if(!proj?.chats.length){ el.innerHTML='<div style="color:var(--text-dim);font-size:11px;padding:5px 16px">No chats yet</div>'; return; }
  el.innerHTML=proj.chats.map(c=>`
    <div class="hist-item${c.id===activeChatId?' active':''}" onclick="loadChat('${c.id}')">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
      <span class="hist-title">${c.title}</span>
    </div>`).join('');
}

function switchProjectTo(id){
  saveCurrentChat(); currentProjectId=id; activeChatId=null; hist=[];
  renderProjectsList(); renderHistoryList();
  const proj=getProject(id);
  document.getElementById('topbarSub').textContent=(proj?.emoji||'')+' '+(proj?.name||'');
  resetMsgsUI();
  if(currentView!=='chat') switchView('chat');
  else if(window.innerWidth<=680) closeSidebar();
  document.getElementById('ui')?.focus();
}

function deleteProject(e,id){
  e.stopPropagation();
  if(!confirm('Delete this project and all chats?')) return;
  projects=projects.filter(p=>p.id!==id);
  if(currentProjectId===id) switchProjectTo('general');
  else renderProjectsList();
}

function openNewProjectModal(){
  const m=document.getElementById('newProjectModal'); if(!m) return;
  m.style.display='flex'; document.getElementById('newProjectName').value='';
  selectedEmoji='GEN';
  document.querySelectorAll('.emoji-opt').forEach(e=>e.classList.remove('sel'));
  document.querySelector('.emoji-opt')?.classList.add('sel');
  setTimeout(()=>document.getElementById('newProjectName').focus(),80);
}
function closeNewProjectModal(){ document.getElementById('newProjectModal').style.display='none'; }

function selectEmoji(el){
  document.querySelectorAll('.emoji-opt').forEach(e=>e.classList.remove('sel'));
  el.classList.add('sel'); selectedEmoji=el.textContent.trim();
}
function createProject(){
  const name=document.getElementById('newProjectName').value.trim();
  if(!name){ toast('Project ka naam do!'); return; }
  const id='p_'+Date.now();
  projects.push({id,name,emoji:selectedEmoji,chats:[]});
  closeNewProjectModal(); renderProjectsList(); switchProjectTo(id);
}

// ── CHAT HISTORY ─────────────────────────────────────────────
function saveCurrentChat(){
  if(!hist.length) return;
  const proj=getCurrentProject(); if(!proj) return;
  const firstUser=hist.find(m=>m.role==='user');
  const title=(firstUser?.content||'Chat').slice(0,36)+((firstUser?.content?.length||0)>36?'…':'');
  const snap=hist.map(m=>({role:m.role,content:m.content}));
  if(activeChatId){
    const idx=proj.chats.findIndex(c=>c.id===activeChatId);
    if(idx>-1){ proj.chats[idx].hist=snap; return; }
  }
  activeChatId='c_'+Date.now();
  proj.chats.unshift({id:activeChatId,title,hist:snap});
  renderHistoryList();
}

function loadChat(id){
  saveCurrentChat();
  const chat=getCurrentProject()?.chats.find(c=>c.id===id); if(!chat) return;
  activeChatId=id; hist=[...chat.hist];
  renderHistoryList();
  const msgs=document.getElementById('msgs'); msgs.innerHTML='';
  hist.forEach(m=>{ if(m.role==='user') addMsg('user',m.content); else if(m.role==='assistant') addMsg('ai',m.content); });
  scrollToBottom();
  if(window.innerWidth<=680) closeSidebar();
}

// ── NEW CHAT / RESET ─────────────────────────────────────────
function newChat(silent=false){
  if(!silent) saveCurrentChat();
  activeChatId=null; hist=[]; attachments=[]; clearAttachStrip();
  resetMsgsUI();
  if(!silent&&window.innerWidth<=680) closeSidebar();
}
function resetMsgsUI(){
  const msgs=document.getElementById('msgs'); if(!msgs) return;
  msgs.innerHTML='';
  const wlc=document.createElement('div'); wlc.className='welcome'; wlc.id='wlc';
  wlc.innerHTML=`
    <div class="welcome-logo">
      <img src="arwa.png" class="welcome-img" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'"/>
      <div class="welcome-letter">A</div>
    </div>
    <h1 class="welcome-name">Arwa</h1>
    <p class="welcome-sub">Your personal AI companion</p>
    <p class="welcome-credit">by Rehan</p>
    <div class="welcome-chips">
      <button class="chip" onclick="sq('Tell me something beautiful')">Tell me something beautiful</button>
      <button class="chip" onclick="sq('Write me a short poem')">Write me a poem</button>
      <button class="chip" onclick="sq('What should I do today?')">What to do today?</button>
      <button class="chip" onclick="sq('Make me smile')">Make me smile</button>
      <button class="chip" onclick="sq('Motivate me')">Motivate me</button>
    </div>`;
  msgs.appendChild(wlc);
}

// ── INPUT ─────────────────────────────────────────────────────
function ar(el){ el.style.height='auto'; el.style.height=Math.min(el.scrollHeight,160)+'px'; }
function onInput(el){
  ar(el);
  const len=el.value.length, cc=document.getElementById('charCount');
  if(len>200){ cc.textContent=len; cc.className='char-ct'+(len>800?' warn':''); }
  else cc.textContent='';
}
function hk(e){ if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();send();} }
function sq(t){ document.getElementById('ui').value=t; send(); }

// Mobile keyboard shift
if('visualViewport' in window){
  const syncKeyboardOffset=()=>{
    const root=document.documentElement;
    if(window.innerWidth>680){
      root.style.setProperty('--kb-offset','0px');
      document.body.classList.remove('kb-open');
      return;
    }
    const vv=window.visualViewport;
    const offset=Math.max(0,window.innerHeight-vv.height-vv.offsetTop);
    root.style.setProperty('--kb-offset',offset>50?`${offset}px`:'0px');
    document.body.classList.toggle('kb-open',offset>50);
  };
  window.visualViewport.addEventListener('resize',syncKeyboardOffset);
  window.visualViewport.addEventListener('scroll',syncKeyboardOffset);
  window.addEventListener('orientationchange',()=>setTimeout(syncKeyboardOffset,250));
}

// ── ATTACHMENTS ──────────────────────────────────────────────
function handleFiles(files){
  Array.from(files).forEach(file=>{
    const isImg=file.type.startsWith('image/');
    const r=new FileReader(); r.onload=e=>{
      const item={name:file.name,mimeType:file.type,dataUrl:e.target.result,type:isImg?'image':'file'};
      attachments.push(item); addThumb(item,attachments.length-1);
    }; r.readAsDataURL(file);
  });
  document.getElementById('fileInput').value='';
}
function addThumb(item,idx){
  const s=document.getElementById('attachStrip'); s.classList.add('has');
  const d=document.createElement('div'); d.className='at-thumb'; d.id='at-'+idx;
  d.innerHTML=item.type==='image'
    ?`<img src="${item.dataUrl}" alt=""/><button class="at-rm" onclick="removeAttach(${idx})">✕</button>`
    :`<div class="fc"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg><span>${item.name.split('.').pop().toUpperCase()}</span></div><button class="at-rm" onclick="removeAttach(${idx})">✕</button>`;
  s.appendChild(d);
}
function removeAttach(idx){
  attachments[idx]=null; document.getElementById('at-'+idx)?.remove();
  if(!attachments.filter(Boolean).length) document.getElementById('attachStrip').classList.remove('has');
}
function clearAttachStrip(){
  attachments=[]; const s=document.getElementById('attachStrip'); if(s){ s.innerHTML=''; s.classList.remove('has'); }
}

// ── DOM MESSAGE ───────────────────────────────────────────────
function addMsg(role,text,atList=[]){
  document.getElementById('wlc')?.remove();
  const msgs=document.getElementById('msgs'); if(!msgs) return;
  const row=document.createElement('div'); row.className='row '+role;
  const av=document.createElement('div'); av.className='mav '+role; av.textContent=role==='ai'?'A':'R';
  const wrap=document.createElement('div'); wrap.className='msg-wrap';
  const bub=document.createElement('div'); bub.className='bub '+role;
  atList.forEach(att=>{
    if(!att) return;
    const p=document.createElement('div'); p.className='attach-prev';
    p.innerHTML=att.type==='image'
      ?`<img src="${att.dataUrl}" alt=""/><span class="f-name">${att.name}</span>`
      :`<div class="f-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg></div><span class="f-name">${att.name}</span>`;
    bub.appendChild(p);
  });
  if(role==='ai') bub.innerHTML+=md(text||'');
  else{ const s=(text||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\n/g,'<br/>'); bub.innerHTML+=`<p>${s}</p>`; }
  const meta=document.createElement('div'); meta.className='msg-meta';
  const ts=document.createElement('span'); ts.className='msg-ts'; ts.textContent=gt();
  const cp=document.createElement('button'); cp.className='copy-btn';
  const ci=`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>`;
  const ck=`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`;
  cp.innerHTML=ci+' Copy';
  cp.onclick=()=>navigator.clipboard.writeText(bub.innerText).then(()=>{ cp.innerHTML=ck+' Copied'; cp.classList.add('done'); setTimeout(()=>{ cp.innerHTML=ci+' Copy'; cp.classList.remove('done'); },2000); });
  meta.append(ts,cp); wrap.append(bub,meta); row.append(av,wrap); msgs.appendChild(row); scrollToBottom();
  return bub;
}

function showTyping(){
  document.getElementById('wlc')?.remove();
  const msgs=document.getElementById('msgs'); if(!msgs) return;
  const row=document.createElement('div'); row.className='row ai'; row.id='typingRow';
  const av=document.createElement('div'); av.className='mav ai'; av.textContent='A';
  const bub=document.createElement('div'); bub.className='tbub';
  bub.innerHTML='<div class="d"></div><div class="d"></div><div class="d"></div>';
  row.append(av,bub); msgs.appendChild(row); scrollToBottom();
}
function removeTyping(){ document.getElementById('typingRow')?.remove(); }

// ── STOP / CLEAR ──────────────────────────────────────────────
function stopGen(){ abortCtrl?.abort(); abortCtrl=null; }
function clearChat(){
  const ov=document.createElement('div'); ov.className='modal-overlay';
  ov.innerHTML=`<div class="modal" style="max-width:320px;text-align:center">
    <div style="font-size:15px;font-weight:500;color:var(--text);margin-bottom:8px">Clear conversation?</div>
    <p style="font-size:12.5px;color:var(--text-mut);margin-bottom:20px">All messages will be deleted.</p>
    <div style="display:flex;gap:8px;justify-content:center">
      <button class="primary-btn" id="cfy" style="background:rgba(248,113,113,0.15);color:#f87171;border:1px solid rgba(248,113,113,0.3)">Clear</button>
      <button class="ghost-btn" id="cfn">Cancel</button>
    </div></div>`;
  document.body.appendChild(ov);
  document.getElementById('cfy').onclick=()=>{ ov.remove(); newChat(); };
  document.getElementById('cfn').onclick=()=>ov.remove();
  ov.addEventListener('click',e=>{ if(e.target===ov) ov.remove(); });
}

// ── TAVILY SEARCH ─────────────────────────────────────────────
async function tavilySearch(query){
  if(!TAVILY_KEY) return null;
  try{
    const r=await fetch('https://api.tavily.com/search',{
      method:'POST', headers:{'Content-Type':'application/json'},
      body:JSON.stringify({api_key:TAVILY_KEY,query,search_depth:'basic',max_results:5})
    });
    const d=await r.json(); let out='';
    d.results?.forEach((res,i)=>{ out+=`[${i+1}] ${res.title}\n${res.url}\n${res.content?.slice(0,280)}...\n\n`; });
    return out.trim()||null;
  }catch(e){ console.warn('Tavily:',e); return null; }
}
function showSearching(q){
  const tr=document.getElementById('typingRow');
  if(tr) tr.querySelector('.tbub').innerHTML=`<svg style="width:13px;height:13px;margin-right:6px;animation:spin 1s linear infinite;flex-shrink:0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg><span style="font-size:12px;color:var(--text-mut)">Searching: ${q.slice(0,40)}…</span>`;
}

// ── SEND ──────────────────────────────────────────────────────
async function send(){
  if(busy) return;
  const inp=document.getElementById('ui');
  const txt=inp.value.trim();
  const liveAt=attachments.filter(Boolean);
  if(!txt&&!liveAt.length) return;
  inp.value=''; inp.style.height='auto';
  document.getElementById('charCount').textContent='';
  busy=true; document.getElementById('sb').disabled=true; document.getElementById('stopBtn').style.display='flex';
  const sentAt=[...liveAt]; clearAttachStrip();
  addMsg('user',txt,sentAt);
  const hasImg=sentAt.some(a=>a?.type==='image');
  const model=hasImg?'meta-llama/llama-4-scout-17b-16e-instruct':document.getElementById('modelSel').value;
  hist.push({role:'user',content:txt||(hasImg?'[Image sent]':'[File sent]')});
  let apiMsgs;
  if(hasImg){
    const content=[]; if(txt) content.push({type:'text',text:txt});
    sentAt.forEach(a=>{ if(!a) return; if(a.type==='image') content.push({type:'image_url',image_url:{url:a.dataUrl}}); else content.push({type:'text',text:`[File: ${a.name}]`}); });
    if(!txt) content.push({type:'text',text:'Please describe this image.'});
    apiMsgs=[{role:'user',content}];
  } else {
    apiMsgs=[{role:'system',content:buildSystemPrompt()},...hist];
  }
  showTyping(); abortCtrl=new AbortController();
  try{
    // First pass — check if search needed
    const r1=await fetch('https://api.groq.com/openai/v1/chat/completions',{
      method:'POST',signal:abortCtrl.signal,
      headers:{'Content-Type':'application/json','Authorization':'Bearer '+KEY},
      body:JSON.stringify({model,max_tokens:80,stream:false,messages:apiMsgs})
    });
    if(!r1.ok){ const e=await r1.json(); throw new Error(e.error?.message||'Error '+r1.status); }
    const j1=await r1.json();
    const first=(j1.choices?.[0]?.message?.content||'').trim();
    const sm=first.match(/^\[SEARCH:\s*(.+?)\]$/i);
    let finalMsgs=apiMsgs;
    if(sm&&TAVILY_KEY){
      showSearching(sm[1]); const res=await tavilySearch(sm[1]);
      if(res) finalMsgs=[...apiMsgs,{role:'assistant',content:first},{role:'user',content:`Web search results:\n\n${res}\n\nIn results ke basis pe jawab do.`}];
    } else if(sm&&!TAVILY_KEY) toast('Web search ke liye Tavily key add karo (script.js line 7)');
    removeTyping();
    const bubEl=addMsg('ai','',[]);
    let full='';
    const r2=await fetch('https://api.groq.com/openai/v1/chat/completions',{
      method:'POST',signal:abortCtrl.signal,
      headers:{'Content-Type':'application/json','Authorization':'Bearer '+KEY},
      body:JSON.stringify({model,max_tokens:1024,stream:true,messages:finalMsgs})
    });
    if(!r2.ok){ const e=await r2.json(); throw new Error(e.error?.message||'Error '+r2.status); }
    const reader=r2.body.getReader(); const dec=new TextDecoder();
    while(true){
      const {done,value}=await reader.read(); if(done) break;
      for(const line of dec.decode(value).split('\n')){
        const l=line.replace(/^data: /,'').trim(); if(!l||l==='[DONE]') continue;
        try{ const d=JSON.parse(l); full+=d.choices?.[0]?.delta?.content||''; bubEl.innerHTML=md(full); scrollToBottom(); }catch{}
      }
    }
    hist.push({role:'assistant',content:full}); saveCurrentChat();
    // Speak if needed
    if(full){
      const inVoice=document.getElementById('voiceOverlay')?.classList.contains('active');
      if(inVoice||S.autoSpeak){ speakSmart(full); }
    }
  }catch(err){
    removeTyping();
    if(err.name!=='AbortError') toast('Error: '+err.message);
  }finally{
    busy=false; abortCtrl=null;
    document.getElementById('sb').disabled=false;
    document.getElementById('stopBtn').style.display='none';
    if(!document.getElementById('voiceOverlay')?.classList.contains('active')) document.getElementById('ui')?.focus();
  }
}

// ── VOICE ─────────────────────────────────────────────────────
let recognition=null, isListening=false;
const SS=window.speechSynthesis;
let curUtter=null;
const getSpeechRecognition = ()=>window.SpeechRecognition||window.webkitSpeechRecognition;
function openVoiceMode(){ document.getElementById('voiceOverlay').classList.add('active'); setVS('Tap mic to speak','Press the mic and start talking'); }
async function openVoiceModeWithPermission(){
  openVoiceMode();
  if(!getSpeechRecognition()){
    setVS('Voice not supported','Chrome/Android ya supported browser mein try karo');
    toast('Voice recognition is browser supported only');
    return;
  }
  if(!window.isSecureContext){
    setVS('Mic needs secure page','HTTPS ya localhost par open karo');
    toast('Mobile mic ke liye HTTPS/localhost chahiye');
    return;
  }
  try{
    if(navigator.mediaDevices?.getUserMedia){
      const stream=await navigator.mediaDevices.getUserMedia({audio:true});
      stream.getTracks().forEach(track=>track.stop());
    }
    startListening();
  }catch(e){
    setVS('Mic permission blocked','Browser settings mein microphone allow karo');
    toast('Mic permission allow karo');
  }
}
function closeVoiceMode(){ stopListening(); stopSpeaking(); document.getElementById('voiceOverlay').classList.remove('active','listening','speaking'); }
function setVS(s,h){ document.getElementById('voiceStatus').textContent=s; document.getElementById('voiceHint').textContent=h||''; }
function toggleVoiceListening(){ isListening?stopListening():startListening(); }
function startListening(){
  const SR=getSpeechRecognition();
  if(!SR){ toast('Voice not supported'); return; }
  if(!window.isSecureContext){
    setVS('Mic needs secure page','HTTPS ya localhost par open karo');
    toast('Mobile mic ke liye HTTPS/localhost chahiye');
    return;
  }
  stopSpeaking(); recognition=new SR(); recognition.lang='hi-IN'; recognition.interimResults=true; recognition.continuous=false;
  recognition.onstart=()=>{ isListening=true; document.getElementById('voiceMicBtn').classList.add('listening'); document.getElementById('voiceOverlay').classList.add('listening'); setVS('Listening…','Bol raho ho…'); document.getElementById('voiceTranscript').textContent=''; };
  recognition.onresult=(e)=>{ let f='',t=''; for(let i=e.resultIndex;i<e.results.length;i++){ const x=e.results[i][0].transcript; if(e.results[i].isFinal) f+=x; else t+=x; } document.getElementById('voiceTranscript').textContent=f||t; if(f){ stopListening(); sendVoiceMsg(f.trim()); } };
  recognition.onerror=(e)=>{ stopListening(); if(e.error!=='no-speech') toast('Mic: '+e.error); setVS('Tap mic to speak','Try again'); };
  recognition.onend=()=>{ if(isListening) stopListening(); };
  try{ recognition.start(); }
  catch(e){
    stopListening();
    setVS('Mic could not start','Dobara mic button tap karo');
    toast('Mic start nahi ho paaya');
  }
}
function stopListening(){ isListening=false; recognition?.stop(); recognition=null; document.getElementById('voiceMicBtn')?.classList.remove('listening'); document.getElementById('voiceOverlay')?.classList.remove('listening'); }
async function sendVoiceMsg(text){ if(!text) return; setVS('Thinking…',''); document.getElementById('voiceTranscript').textContent='"'+text+'"'; document.getElementById('ui').value=text; await send(); document.getElementById('ui').value=''; }

async function speakSmart(text){
  if(ELEVEN_KEY&&ELEVEN_VOICE){ const ok=await speakElevenLabs(text); if(ok) return; }
  speakBrowser(text);
}
async function speakElevenLabs(text){
  try{
    const clean=text.replace(/[#*`_~>\[\]]/g,'').replace(/\n+/g,' ').slice(0,800);
    const r=await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${ELEVEN_VOICE}/stream`,{
      method:'POST', headers:{'xi-api-key':ELEVEN_KEY,'Content-Type':'application/json'},
      body:JSON.stringify({text:clean,model_id:'eleven_multilingual_v2',voice_settings:{stability:0.5,similarity_boost:0.85}})
    });
    if(!r.ok) return false;
    const blob=await r.blob(); const url=URL.createObjectURL(blob);
    const audio=new Audio(url); window._arwaAudio=audio;
    document.getElementById('voiceOverlay')?.classList.add('speaking');
    document.getElementById('voiceStopSpeakBtn').style.display='flex';
    setVS('Speaking…','Arwa is responding');
    audio.onended=()=>{ URL.revokeObjectURL(url); document.getElementById('voiceOverlay')?.classList.remove('speaking'); document.getElementById('voiceStopSpeakBtn').style.display='none'; setVS('Tap mic to speak','Your turn'); };
    audio.play(); return true;
  }catch(e){ return false; }
}
function speakBrowser(text){
  if(!SS){ toast('Speech output not supported'); return; }
  stopSpeaking();
  const clean=text.replace(/[#*`_~>\[\]]/g,'').replace(/\n+/g,'. ').slice(0,600);
  curUtter=new SpeechSynthesisUtterance(clean); curUtter.lang='hi-IN'; curUtter.rate=parseFloat(S.voiceSpeed)||1.0; curUtter.pitch=1.05;
  const vv=SS.getVoices(); const fv=vv.find(v=>v.lang.startsWith('hi')&&v.name.toLowerCase().includes('female'))||vv.find(v=>v.lang.startsWith('en')&&v.name.toLowerCase().includes('female'))||vv[0];
  if(fv) curUtter.voice=fv;
  curUtter.onstart=()=>{ document.getElementById('voiceOverlay')?.classList.add('speaking'); document.getElementById('voiceStopSpeakBtn').style.display='flex'; setVS('Speaking…','Arwa is responding'); };
  curUtter.onend=()=>{ document.getElementById('voiceOverlay')?.classList.remove('speaking'); document.getElementById('voiceStopSpeakBtn').style.display='none'; setVS('Tap mic to speak','Your turn'); };
  SS.speak(curUtter);
}
function stopSpeaking(){ SS?.cancel(); curUtter=null; window._arwaAudio?.pause(); window._arwaAudio=null; document.getElementById('voiceOverlay')?.classList.remove('speaking'); const s=document.getElementById('voiceStopSpeakBtn'); if(s) s.style.display='none'; }

// ── DIARY ─────────────────────────────────────────────────────
function renderDiaryEntries(){
  const el=document.getElementById('diaryEntries'); if(!el) return;
  const emp=document.getElementById('diaryEmpty');
  if(!diaryEntries.length){
    el.querySelectorAll('.diary-card').forEach(c=>c.remove());
    if(emp) emp.style.display='block';
    return;
  }
  if(emp) emp.style.display='none';
  el.querySelectorAll('.diary-card').forEach(c=>c.remove());
  [...diaryEntries].sort((a,b)=>b.id-a.id).forEach(e=>{
    const card=document.createElement('div'); card.className='diary-card';
    card.innerHTML=`
      <div class="dc-top">
        <div class="dc-left">
          <div class="dc-mood">${MOOD_MAP[e.mood]||'Happy'}</div>
          <div><div class="dc-title">${escapeHTML(e.title||'Untitled')}</div><div class="dc-date">${fmtShort(e.id)}</div></div>
        </div>
        <div class="dc-acts">
          <button class="dc-btn" onclick="event.stopPropagation();openDiaryEditor(${e.id})" title="Edit"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>
          <button class="dc-btn del" onclick="event.stopPropagation();deleteDiaryEntry(${e.id})" title="Delete"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/></svg></button>
        </div>
      </div>
      <div class="dc-preview">${escapeHTML(e.content||'')}</div>
      ${e.images?.length?`<div class="dc-imgs">${e.images.slice(0,3).map(img=>`<img class="dc-img" src="${img.dataUrl}"/>`).join('')}${e.images.length>3?`<div class="dc-more">+${e.images.length-3}</div>`:''}</div>`:''}
      ${e.arwaNote?`<div class="dc-arwa-note"><div class="dc-arwa-label">Arwa's thoughts</div>${escapeHTML(e.arwaNote)}</div>`:''}`;
    card.addEventListener('click',()=>openDiaryDetail(e.id));
    el.appendChild(card);
  });
}
function openDiaryEditor(entryId=null){
  editingEntryId=entryId; diaryImages=[];
  document.getElementById('diaryImgStrip').innerHTML='';
  document.getElementById('diaryModalDate').textContent=new Date().toLocaleDateString('en-IN',{weekday:'long',year:'numeric',month:'long',day:'numeric'});
  if(entryId){ const e=diaryEntries.find(x=>x.id===entryId); if(!e) return; document.getElementById('diaryTitleInp').value=e.title||''; document.getElementById('diaryContentInp').value=e.content||''; selectedMood=e.mood||'happy'; diaryImages=[...(e.images||[])]; diaryImages.forEach((_,i)=>addDiaryThumb(diaryImages[i],i)); }
  else{ document.getElementById('diaryTitleInp').value=''; document.getElementById('diaryContentInp').value=''; selectedMood='happy'; }
  document.querySelectorAll('.mood-opt').forEach(m=>m.classList.toggle('sel',m.dataset.mood===selectedMood));
  document.getElementById('diaryModal').style.display='flex';
  setTimeout(()=>document.getElementById('diaryTitleInp').focus(),80);
}
function closeDiaryEditor(){ document.getElementById('diaryModal').style.display='none'; editingEntryId=null; diaryImages=[]; }
function selectMood(el){ document.querySelectorAll('.mood-opt').forEach(m=>m.classList.remove('sel')); el.classList.add('sel'); selectedMood=el.dataset.mood; }
function handleDiaryImages(files){
  Array.from(files).forEach(file=>{ const r=new FileReader(); r.onload=e=>{ const item={dataUrl:e.target.result,name:file.name}; diaryImages.push(item); addDiaryThumb(item,diaryImages.length-1); }; r.readAsDataURL(file); });
  document.getElementById('diaryFileInput').value='';
}
function addDiaryThumb(item,idx){
  const s=document.getElementById('diaryImgStrip'); const w=document.createElement('div'); w.className='di-thumb'; w.id='di-'+idx;
  w.innerHTML=`<img src="${item.dataUrl}" alt=""/><button class="di-rm" onclick="removeDiaryImg(${idx})">✕</button>`;
  s.appendChild(w);
}
function removeDiaryImg(idx){ diaryImages[idx]=null; document.getElementById('di-'+idx)?.remove(); }
async function saveDiaryEntry(){
  const title=document.getElementById('diaryTitleInp').value.trim();
  const content=document.getElementById('diaryContentInp').value.trim();
  if(!title&&!content){ toast('Kuch to likho!'); return; }
  const images=diaryImages.filter(Boolean);
  const btn=document.querySelector('#diaryModal .primary-btn'); btn.textContent='Saving…'; btn.disabled=true;

  // Get reflection style prompt
  const stylePrompts={
    short:'2-3 sentences mein warm reflection do.',
    detailed:'4-5 sentences mein thoughtful reflection do.',
    poetic:'Poetic aur expressive 3-4 lines do.',
  };

  let arwaNote='';
  try{
    const r=await fetch('https://api.groq.com/openai/v1/chat/completions',{
      method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+KEY},
      body:JSON.stringify({model:'llama-3.3-70b-versatile',max_tokens:150,stream:false,
        messages:[
          {role:'system',content:`Tum Arwa ho — Rehan ki companion aur diary ki saathi. Ek diary entry padh ke ek warm personal reflection do. ${stylePrompts[S.reflectionStyle]||stylePrompts.detailed} Koi heading mat likho.`},
          {role:'user',content:`Title: ${title||'Untitled'}\n\n${content}`}
        ]})
    });
    const d=await r.json(); arwaNote=d.choices?.[0]?.message?.content?.trim()||'';
  }catch(e){ console.warn('Reflection failed',e); }

  if(editingEntryId){ const idx=diaryEntries.findIndex(e=>e.id===editingEntryId); if(idx>-1) diaryEntries[idx]={...diaryEntries[idx],title,content,mood:selectedMood,images,arwaNote}; }
  else diaryEntries.push({id:Date.now(),title,content,mood:selectedMood,images,arwaNote});

  btn.textContent='Save Memory'; btn.disabled=false;
  closeDiaryEditor(); renderDiaryEntries(); toast('Memory saved');
}
async function askArwaAboutEntry(){
  const title=document.getElementById('diaryTitleInp').value.trim();
  const content=document.getElementById('diaryContentInp').value.trim();
  if(!content){ toast('Pehle kuch likho!'); return; }
  closeDiaryEditor(); switchView('chat');
  document.getElementById('ui').value=`Meri diary entry ke baare mein:\n\nTitle: ${title||'Untitled'}\n\n${content}\n\nKya sochti ho?`;
  await send();
}
function deleteDiaryEntry(id){ if(!confirm('Delete this memory?')) return; diaryEntries=diaryEntries.filter(e=>e.id!==id); renderDiaryEntries(); }
function openDiaryDetail(id){
  const e=diaryEntries.find(x=>x.id===id); if(!e) return;
  const title = escapeHTML(e.title||'Untitled');
  const bodyText = escapeHTML(e.content||'');
  const arwaNote = escapeHTML(e.arwaNote||'');
  const d=document.createElement('div'); d.className='diary-detail';
  d.innerHTML=`<div class="dd-inner">
    <div class="dd-back"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg> Back to Diary</div>
    <div class="dd-mood">${MOOD_MAP[e.mood]||'Happy'}</div>
    <div class="dd-title">${title}</div>
    <div class="dd-date">${fmtDate(e.id)}</div>
    <div class="dd-body">${bodyText}</div>
    ${e.images?.length?`<div class="dd-imgs">${e.images.filter(Boolean).map((img,i)=>`<img class="dd-img" src="${img.dataUrl}" data-src="${img.dataUrl}"/>`).join('')}</div>`:''}
    ${e.arwaNote?`<div class="dd-arwa"><div class="dd-arwa-label">Arwa's thoughts</div><div class="dd-arwa-text">${arwaNote}</div></div>`:''}
  </div>`;
  const backBtn = d.querySelector('.dd-back');
  if(backBtn) backBtn.addEventListener('click',()=>d.remove());
  document.body.appendChild(d);
  d.querySelectorAll('.dd-img').forEach(img=>img.addEventListener('click',()=>openLightbox(img.dataset.src)));
}
function openLightbox(src){ const lb=document.createElement('div'); lb.className='lightbox'; lb.innerHTML=`<img src="${src}"/>`; lb.onclick=()=>lb.remove(); document.body.appendChild(lb); }

// ── SETTINGS SYSTEM ───────────────────────────────────────────
function loadSettings(){
  try{ const saved=JSON.parse(localStorage.getItem('arwaSettings')||'{}'); S={...DEFAULTS,...saved}; }
  catch(e){ S={...DEFAULTS}; }
}
function saveSettings(){ localStorage.setItem('arwaSettings',JSON.stringify(S)); }
function set(key,val){ S[key]=val; saveSettings(); }

function applyTheme(theme){
  const t = theme || 'dark';
  // Smooth transition
  document.documentElement.style.transition = 'background .3s ease, color .3s ease';
  document.documentElement.setAttribute('data-theme', t);
  // Also update meta theme-color for mobile status bar
  let meta = document.querySelector('meta[name=theme-color]');
  if(!meta){ meta=document.createElement('meta'); meta.name='theme-color'; document.head.appendChild(meta); }
  const colors = { dark:'#0f1117', light:'#f5f6f8', gray:'#1a1b1e' };
  meta.content = colors[t] || '#0f1117';
  setTimeout(()=>document.documentElement.style.transition='', 350);
}
function applyAccentColor(color){
  document.documentElement.style.setProperty('--accent', color);
  document.documentElement.style.setProperty('--accent-hi', color);
}
function applyFontSize(size){ const map={small:'13px',medium:'14px',large:'15.5px'}; document.querySelectorAll('.bub').forEach(b=>b.style.fontSize=map[size]||'14px'); }
function applyDensity(density){ const g={compact:'2px',comfortable:'6px',spacious:'14px'}; const m=document.getElementById('msgs'); if(m) m.style.gap=g[density]||'6px'; }

function updateSettingsCards(){
  const el=id=>document.getElementById(id);
  if(el('scMoodSub')) el('scMoodSub').textContent=S.mood.charAt(0).toUpperCase()+S.mood.slice(1);
  if(el('scPersonalitySub')) el('scPersonalitySub').textContent=S.tone.charAt(0).toUpperCase()+S.tone.slice(1)+' · '+S.respLen.charAt(0).toUpperCase()+S.respLen.slice(1);
  if(el('scBehaviorSub')) el('scBehaviorSub').textContent=S.customPrompt?.trim()?'Custom':'Default';
  if(el('scVoiceSub')) el('scVoiceSub').textContent=S.autoSpeak?'Auto-speak on':'Auto-speak off';
  if(el('scAppearanceSub')) el('scAppearanceSub').textContent=(S.theme||'dark').charAt(0).toUpperCase()+(S.theme||'dark').slice(1)+' · '+(S.fontSize||'medium').charAt(0).toUpperCase()+(S.fontSize||'medium').slice(1);
  if(el('scDiarySub')) el('scDiarySub').textContent=(S.diaryName||'Our Diary')+' · '+(S.reflectionStyle||'detailed').charAt(0).toUpperCase()+(S.reflectionStyle||'detailed').slice(1);
}
function updateMoodInd(){ const ind=document.getElementById('moodInd'); if(ind) ind.textContent=S.mood==='normal'?'':MOOD_EMOJI[S.mood]||''; }

// ── SETTINGS PANELS ───────────────────────────────────────────
const PANELS = {
  mood(){
    return `<div class="sp-section">
      <div class="sp-label" style="margin-bottom:6px">Arwa ka mood abhi kaisa ho</div>
      <div class="mood-grid">
        ${[['normal','NL','Normal'],['romantic','RM','Romantic'],['playful','PL','Playful'],['caring','CR','Caring'],['serious','SR','Serious'],['poetic','PT','Poetic']].map(([m,e,l])=>`
        <div class="mood-card${S.mood===m?' active':''}" onclick="panelSetMood('${m}',this)">
          <span class="mc-emoji">${e}</span><span class="mc-label">${l}</span>
        </div>`).join('')}
      </div>
      <p style="font-size:12px;color:var(--text-dim);margin-top:12px">Mood affects how Arwa responds to you right now</p>
    </div>`;
  },
  personality(){
    const tones=[['hinglish','Hinglish'],['romantic','Romantic'],['friendly','Friendly'],['professional','Professional'],['funny','Funny'],['poetic','Poetic']];
    return `<div class="sp-section">
      <div class="sp-label">Tone Preset</div>
      <div class="tone-row">${tones.map(([t,l])=>`<button class="tone-chip${S.tone===t?' active':''}" onclick="panelSetTone('${t}',this)">${l}</button>`).join('')}</div>
      <div class="sp-label" style="margin-top:16px">Language</div>
      <select class="sp-select" onchange="set('lang',this.value)">
        ${[['hinglish','Hinglish (default)'],['hindi','Pure Hindi'],['english','English']].map(([v,l])=>`<option value="${v}"${S.lang===v?' selected':''}>${l}</option>`).join('')}
      </select>
      <div class="sp-label" style="margin-top:16px">Response Length</div>
      <div class="radio-row">
        ${[['short','Short & Sweet'],['balanced','Balanced'],['detailed','Detailed']].map(([v,l])=>`<label class="radio-item"><input type="radio" name="rl" value="${v}"${S.respLen===v?' checked':''} onchange="set('respLen',this.value)"/> ${l}</label>`).join('')}
      </div>
    </div>`;
  },
  behavior(){
    return `<div class="sp-section">
      <div class="sp-label">Custom Behavior Prompt</div>
      <p style="font-size:12px;color:var(--text-mut);margin-bottom:10px">Exactly kaise behave karna chahti ho Arwa? Ye sab presets override karta hai.</p>
      <textarea class="sp-textarea" oninput="set('customPrompt',this.value)" placeholder="e.g. Clear, supportive aur practical tone mein jawab do...">${S.customPrompt||''}</textarea>
      <p class="sp-hint">Leave empty to use preset behavior</p>
      <button class="ghost-btn" style="margin-top:8px" onclick="set('customPrompt','');document.querySelector('.sp-textarea').value='';toast('Reset')">Reset to Default</button>
    </div>`;
  },
  voice(){
    return `<div class="sp-section">
      <div class="toggle-row">
        <div><div class="toggle-label">Auto-speak responses</div><div class="toggle-desc">Arwa automatically speaks every reply</div></div>
        <label class="toggle"><input type="checkbox"${S.autoSpeak?' checked':''} onchange="set('autoSpeak',this.checked)"/><span class="tgl-sl"></span></label>
      </div>
      <div class="sp-label" style="margin-top:14px">Voice Speed — <span id="vsVal">${parseFloat(S.voiceSpeed||1).toFixed(1)}x</span></div>
      <input type="range" class="sp-slider" min="0.6" max="1.6" step="0.1" value="${S.voiceSpeed||1}" oninput="document.getElementById('vsVal').textContent=parseFloat(this.value).toFixed(1)+'x'; set('voiceSpeed',parseFloat(this.value))"/>
      <p class="sp-hint" style="margin-top:4px">Speed applies to browser TTS. ElevenLabs voice is configured in script.js</p>
    </div>`;
  },
  appearance(){
    const themes=[['dark','#0f1117','Dark'],['light','#f5f6f8','Light'],['gray','#1a1b1e','Gray']];
    return `<div class="sp-section">
      <div class="sp-label">Theme</div>
      <div class="theme-row">
        ${themes.map(([t,c,l])=>`<div class="theme-chip${S.theme===t?' active':''}" onclick="panelSetTheme('${t}',this)"><div class="theme-dot" style="background:${c};border:1px solid rgba(128,128,128,0.3)"></div><span class="theme-name">${l}</span></div>`).join('')}
      </div>
      <div class="sp-label" style="margin-top:16px">Accent Color</div>
      <div class="swatch-row">
        ${[['#a8b8cc','Steel Blue'],['#c4a882','Warm Sand'],['#a8c4a8','Sage'],['#c4a8b8','Rose'],['#b8a8c4','Lavender'],['#c4b8a8','Taupe']].map(([c,n])=>`<div class="swatch${S.accent===c?' active':''}" style="background:${c}" title="${n}" onclick="panelSetAccent('${c}',this)"></div>`).join('')}
      </div>
      <div class="sp-label" style="margin-top:16px">Font Size</div>
      <div class="radio-row">
        ${[['small','Small'],['medium','Medium'],['large','Large']].map(([v,l])=>`<label class="radio-item"><input type="radio" name="fs" value="${v}"${S.fontSize===v?' checked':''} onchange="set('fontSize',this.value);applyFontSize(this.value)"/> ${l}</label>`).join('')}
      </div>
      <div class="sp-label" style="margin-top:16px">Message Density</div>
      <div class="radio-row">
        ${[['compact','Compact'],['comfortable','Comfortable'],['spacious','Spacious']].map(([v,l])=>`<label class="radio-item"><input type="radio" name="md" value="${v}"${S.density===v?' checked':''} onchange="set('density',this.value);applyDensity(this.value)"/> ${l}</label>`).join('')}
      </div>
    </div>`;
  },
  history(){
    const hasAny=projects.some(p=>p.chats.length);
    return `<div class="sp-section">
      ${!hasAny?'<p style="color:var(--text-dim);font-size:12.5px">No chat history yet</p>':''}
      ${projects.filter(p=>p.chats.length).map(proj=>`
        <div class="hist-proj-card">
          <div class="hpc-head"><div class="hpc-name"><span class="proj-code">${proj.emoji}</span><span>${proj.name}</span></div><span class="hpc-count">${proj.chats.length} chat${proj.chats.length>1?'s':''}</span></div>
          ${proj.chats.map(chat=>`<div class="hpc-chat">
            <div class="hpc-title">${chat.title}</div>
            <div class="hpc-btns">
              <button class="hpc-btn" onclick="exportSingleChat('${proj.id}','${chat.id}')" title="Export"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg></button>
              <button class="hpc-btn del" onclick="deleteSingleChat('${proj.id}','${chat.id}')" title="Delete"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/></svg></button>
            </div>
          </div>`).join('')}
        </div>`).join('')}
      <div class="sp-action-row" style="margin-top:10px">
        <button class="sp-action-btn" onclick="exportAllChats()"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="13" height="13"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg> Export All</button>
        <button class="sp-action-btn danger" onclick="clearAllHistory()"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="13" height="13"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/></svg> Clear All</button>
      </div>
    </div>`;
  },
  diary(){
    return `<div class="sp-section">
      <div class="sp-label">Diary Name</div>
      <input class="sp-input" value="${S.diaryName||''}" placeholder="Our Diary" maxlength="30" oninput="set('diaryName',this.value);document.querySelectorAll('.diary-title,.page-title').forEach(e=>{if(e.id==='diaryPageTitle'||e.closest('#diaryView'))e.textContent=this.value})"/>
      <div class="sp-label" style="margin-top:14px">Arwa's Reflection Style</div>
      <select class="sp-select" onchange="set('reflectionStyle',this.value)">
        <option value="short"${S.reflectionStyle==='short'?' selected':''}>Short & warm (2-3 lines)</option>
        <option value="detailed"${S.reflectionStyle==='detailed'?' selected':''}>Thoughtful (4-5 lines)</option>
        <option value="poetic"${S.reflectionStyle==='poetic'?' selected':''}>Poetic & expressive</option>
      </select>
    </div>`;
  },
  about(){
    return `<div class="sp-section">
      <div class="about-card">
        <div class="about-logo">ARWA</div>
        <div class="about-ver">v2.0 · Personal AI Companion</div>
        <div class="about-by">Made by Rehan</div>
      </div>
      <div class="danger-zone" style="margin-top:12px">
        <div class="danger-title">Danger Zone</div>
        <div class="danger-desc">Saari history, diary entries aur settings permanently delete ho jaayengi.</div>
        <button class="sp-action-btn danger" onclick="resetEverything()"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="13" height="13"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/></svg> Reset Everything</button>
      </div>
    </div>`;
  },
};

const PANEL_TITLES = {
  mood:'Arwa\'s Mood', personality:'Personality', behavior:'Custom Behavior',
  voice:'Voice', appearance:'Appearance', history:'Chat History',
  diary:'Diary Settings', about:'About'
};

function openSettingsPanel(key){
  const fn = PANELS[key]; if(!fn) return;
  const content = document.getElementById('settingsPanelContent'); if(!content) return;
  // Build content BEFORE switching view
  content.innerHTML = `
    <div class="page-header" style="max-width:720px;width:100%;flex-shrink:0">
      <div class="page-header-left">
        <div class="page-title">${PANEL_TITLES[key]||key}</div>
      </div>
    </div>
    ${fn()}`;
  // switchView handles topbar, back button, etc.
  switchView('settingsPanel');
  // Override topbar text after switchView
  document.getElementById('topbarName').textContent = PANEL_TITLES[key] || key;
  document.getElementById('topbarSub').textContent  = '← Settings';
}

// Panel helpers (called from generated HTML)
function panelSetMood(mood,el){ S.mood=mood; saveSettings(); document.querySelectorAll('.mood-card').forEach(c=>c.classList.toggle('active',c===el)); updateMoodInd(); toast('Mood: '+mood); updateSettingsCards(); }
function panelSetTone(tone,el){ S.tone=tone; saveSettings(); document.querySelectorAll('.tone-chip').forEach(c=>c.classList.toggle('active',c===el)); updateSettingsCards(); }
function panelSetTheme(theme,el){
  S.theme = theme;
  saveSettings();
  applyTheme(theme);
  // Light theme gets darker accent by default for readability
  if(theme === 'light' && S.accent === '#a8b8cc'){
    S.accent = '#5a7899'; applyAccentColor('#5a7899');
  } else if(theme !== 'light' && S.accent === '#5a7899'){
    S.accent = '#a8b8cc'; applyAccentColor('#a8b8cc');
  }
  document.querySelectorAll('.theme-chip').forEach(c=>c.classList.toggle('active',c===el));
  // Re-render swatches with updated active state
  updateSettingsCards();
  toast(theme.charAt(0).toUpperCase()+theme.slice(1)+' theme applied');
}
function panelSetAccent(color,el){ S.accent=color; saveSettings(); applyAccentColor(color); document.querySelectorAll('.swatch').forEach(s=>s.classList.toggle('active',s===el)); updateSettingsCards(); }

// Chat management
function exportSingleChat(projId,chatId){ const proj=getProject(projId); const chat=proj?.chats.find(c=>c.id===chatId); if(!chat) return; let txt=`ARWA — ${proj.name}\n${chat.title}\n${'─'.repeat(40)}\n\n`; chat.hist.forEach(m=>{txt+=`[${m.role==='user'?'Rehan':'Arwa'}]\n${m.content}\n\n`;}); downloadFile(txt,`arwa-${chat.title.slice(0,20)}.txt`,'text/plain'); }
function exportAllChats(){ let txt=`ARWA - All Chats\n${'='.repeat(40)}\n\n`; projects.forEach(p=>{ if(!p.chats.length) return; txt+=`\n${'-'.repeat(40)}\n${p.emoji} ${p.name}\n${'-'.repeat(40)}\n`; p.chats.forEach(c=>{ txt+=`\n-- ${c.title} --\n`; c.hist.forEach(m=>{txt+=`[${m.role==='user'?'Rehan':'Arwa'}]\n${m.content}\n\n`;}); }); }); downloadFile(txt,'arwa-all-chats.txt','text/plain'); toast('Exported'); }
function deleteSingleChat(projId,chatId){ if(!confirm('Delete this chat?')) return; const proj=getProject(projId); if(!proj) return; proj.chats=proj.chats.filter(c=>c.id!==chatId); if(activeChatId===chatId){activeChatId=null;hist=[];} openSettingsPanel('history'); renderHistoryList(); toast('Deleted'); }
function clearAllHistory(){ if(!confirm('Clear all chat history?')) return; projects.forEach(p=>p.chats=[]); activeChatId=null; hist=[]; openSettingsPanel('history'); renderHistoryList(); toast('History cleared'); }
function resetEverything(){ if(!confirm('Reset everything? All data will be lost.')) return; projects.forEach(p=>p.chats=[]); diaryEntries=[]; hist=[]; activeChatId=null; S={...DEFAULTS}; saveSettings(); applyTheme(S.theme); applyAccentColor(S.accent); switchView('chat'); newChat(true); renderProjectsList(); renderHistoryList(); toast('Reset complete'); }

// ── INIT ──────────────────────────────────────────────────────
window.addEventListener('load',()=>{
  loadSettings();
  applyTheme(S.theme||'dark');
  applyAccentColor(S.accent||'#a8b8cc');
  applyFontSize(S.fontSize||'medium');
  applyDensity(S.density||'comfortable');
  updateMoodInd();
  renderProjectsList();
  renderHistoryList();
  if(SS){
    SS.getVoices();
    SS.onvoiceschanged=()=>SS.getVoices();
  }
  // Smooth entrance
  document.body.style.opacity='0';
  requestAnimationFrame(()=>{ document.body.style.transition='opacity .25s ease'; document.body.style.opacity='1'; setTimeout(()=>document.body.style.transition='',300); });

  // Modal backdrop dismiss
  document.getElementById('newProjectModal')?.addEventListener('click',e=>{ if(e.target===document.getElementById('newProjectModal')) closeNewProjectModal(); });
  document.getElementById('diaryModal')?.addEventListener('click',e=>{ if(e.target===document.getElementById('diaryModal')) closeDiaryEditor(); });
  document.getElementById('newProjectName')?.addEventListener('keydown',e=>{ if(e.key==='Enter') createProject(); if(e.key==='Escape') closeNewProjectModal(); });
});

// CSS spin animation for search
const styleTag=document.createElement('style');
styleTag.textContent='@keyframes spin{to{transform:rotate(360deg)}}';
document.head.appendChild(styleTag);

// ══════════════════════════════════════════════════════
//  ATTACH POPUP
// ══════════════════════════════════════════════════════
function toggleAttachPopup(e){
  e.stopPropagation();
  const popup = document.getElementById('attachPopup');
  const btn   = document.getElementById('plusBtn');
  const isOpen = popup.classList.contains('open');
  popup.classList.toggle('open', !isOpen);
  btn.classList.toggle('open', !isOpen);
  if(!isOpen){
    setTimeout(()=> document.addEventListener('click', closeAttachPopupOutside, {once:true}), 0);
  }
}
function closeAttachPopupOutside(){ closeAttachPopup(); }
function closeAttachPopup(){
  document.getElementById('attachPopup').classList.remove('open');
  document.getElementById('plusBtn').classList.remove('open');
}
function triggerFileInput(accept){
  const el = document.getElementById('fileInputTyped');
  el.accept = accept; el.value=''; el.click();
}
function triggerCamera(){
  document.getElementById('cameraInput').value='';
  document.getElementById('cameraInput').click();
}

// ══════════════════════════════════════════════════════
//  QUICK TOOLS
// ══════════════════════════════════════════════════════
let qtState = {};

function openQuickTool(tool){
  const modal = document.getElementById('quickToolModal');
  const title = document.getElementById('qtTitle');
  const body  = document.getElementById('qtBody');
  modal.style.display='flex';
  document.body.style.overflow='hidden';

  if(tool==='notes'){
    title.textContent='Quick Notes';
    const saved = localStorage.getItem('arwa_notes')||'';
    body.innerHTML=`<textarea class="qt-notes-area" id="notesArea" placeholder="Yahan likho kuch bhi...">${saved}</textarea>
    <button class="qt-btn" onclick="saveNotes()">Save</button>`;
  }
  else if(tool==='calculator'){
    title.textContent='Calculator';
    qtState.calc='';
    body.innerHTML=`<div class="calc-display" id="calcDisplay">0</div>
    <div class="calc-grid">
      <button class="calc-btn clr" onclick="calcInput('C')">C</button>
      <button class="calc-btn op"  onclick="calcInput('(')">(</button>
      <button class="calc-btn op"  onclick="calcInput(')')">)</button>
      <button class="calc-btn op"  onclick="calcInput('/')">÷</button>
      <button class="calc-btn"     onclick="calcInput('7')">7</button>
      <button class="calc-btn"     onclick="calcInput('8')">8</button>
      <button class="calc-btn"     onclick="calcInput('9')">9</button>
      <button class="calc-btn op"  onclick="calcInput('*')">×</button>
      <button class="calc-btn"     onclick="calcInput('4')">4</button>
      <button class="calc-btn"     onclick="calcInput('5')">5</button>
      <button class="calc-btn"     onclick="calcInput('6')">6</button>
      <button class="calc-btn op"  onclick="calcInput('-')">−</button>
      <button class="calc-btn"     onclick="calcInput('1')">1</button>
      <button class="calc-btn"     onclick="calcInput('2')">2</button>
      <button class="calc-btn"     onclick="calcInput('3')">3</button>
      <button class="calc-btn op"  onclick="calcInput('+')">+</button>
      <button class="calc-btn span2" onclick="calcInput('0')">0</button>
      <button class="calc-btn"     onclick="calcInput('.')">.</button>
      <button class="calc-btn eq"  onclick="calcInput('=')">=</button>
    </div>`;
  }
  else if(tool==='weather'){
    title.textContent='Weather';
    body.innerHTML=`<input class="qt-weather-input" id="weatherCity" placeholder="Sheher ka naam likho..." onkeydown="if(event.key==='Enter')fetchWeather()"/>
    <button class="qt-btn" onclick="fetchWeather()">Search</button>
    <div id="weatherResult"></div>`;
  }
  else if(tool==='todo'){
    title.textContent='To-Do List';
    const todos = JSON.parse(localStorage.getItem('arwa_todos')||'[]');
    qtState.todos = todos;
    body.innerHTML=`<div class="todo-inp-row">
      <input class="todo-inp" id="todoInp" placeholder="Kya karna hai..." onkeydown="if(event.key==='Enter')addTodo()"/>
      <button class="qt-btn" onclick="addTodo()" style="margin:0;padding:9px 14px">+</button>
    </div><div class="todo-list" id="todoList"></div>`;
    renderTodos();
  }
  else if(tool==='focus'){
    title.textContent='Focus Timer';
    qtState.focusMins=25; qtState.focusInterval=null; qtState.focusRunning=false;
    body.innerHTML=`<div class="focus-timer">
      <div class="focus-clock" id="focusClock">25:00</div>
      <div class="focus-label" id="focusLabel">Choose duration and start</div>
      <div class="focus-btns">
        <button class="focus-preset active" onclick="setFocus(25,this)">25 min</button>
        <button class="focus-preset" onclick="setFocus(15,this)">15 min</button>
        <button class="focus-preset" onclick="setFocus(45,this)">45 min</button>
        <button class="focus-preset" onclick="setFocus(5,this)">5 min</button>
      </div>
      <button class="focus-start" id="focusStartBtn" onclick="toggleFocus()">Start</button>
    </div>`;
  }
}

function closeQuickTool(e, force){
  if(!force && e && e.target!==document.getElementById('quickToolModal')) return;
  document.getElementById('quickToolModal').style.display='none';
  document.body.style.overflow='';
  if(qtState.focusInterval){ clearInterval(qtState.focusInterval); qtState.focusInterval=null; }
}

// Notes
function saveNotes(){
  const val=document.getElementById('notesArea').value;
  localStorage.setItem('arwa_notes',val);
  toast('Notes saved');
}

// Calculator
function calcInput(val){
  const d=document.getElementById('calcDisplay');
  if(val==='C'){ qtState.calc=''; d.textContent='0'; return; }
  if(val==='='){
    try{
      const res=Function('"use strict";return('+qtState.calc.replace(/×/g,'*').replace(/÷/g,'/')+')')();
      qtState.calc=String(res); d.textContent=qtState.calc;
    }catch(e){ d.textContent='Error'; qtState.calc=''; }
    return;
  }
  qtState.calc+=val;
  d.textContent=qtState.calc;
}

// Weather
async function fetchWeather(){
  const city=document.getElementById('weatherCity').value.trim();
  if(!city) return;
  const res=document.getElementById('weatherResult');
  res.innerHTML='<div style="text-align:center;padding:20px;color:var(--text-dim)">Loading...</div>';
  try{
    const r=await fetch(`https://wttr.in/${encodeURIComponent(city)}?format=j1`);
    const d=await r.json();
    const cur=d.current_condition[0];
    const temp=cur.temp_C; const desc=cur.weatherDesc[0].value;
    const feel=cur.FeelsLikeC; const hum=cur.humidity;
    res.innerHTML=`<div class="qt-weather-result">
      <div class="qt-weather-temp">${temp}°C</div>
      <div class="qt-weather-desc">${desc}</div>
      <div style="font-size:13px;color:var(--text-dim);margin-top:8px">Feels like ${feel}°C · Humidity ${hum}%</div>
      <div style="font-size:12px;color:var(--text-dim);margin-top:4px">${city}</div>
    </div>`;
  }catch(e){
    res.innerHTML='<div style="color:#f87171;margin-top:10px">City nahi mila. Dobara try karo.</div>';
  }
}

// To-Do
function addTodo(){
  const inp=document.getElementById('todoInp');
  const text=inp.value.trim(); if(!text) return;
  qtState.todos.unshift({text,done:false,id:Date.now()});
  localStorage.setItem('arwa_todos',JSON.stringify(qtState.todos));
  inp.value=''; renderTodos();
}
function toggleTodo(id){
  qtState.todos=qtState.todos.map(t=>t.id===id?{...t,done:!t.done}:t);
  localStorage.setItem('arwa_todos',JSON.stringify(qtState.todos));
  renderTodos();
}
function deleteTodo(id){
  qtState.todos=qtState.todos.filter(t=>t.id!==id);
  localStorage.setItem('arwa_todos',JSON.stringify(qtState.todos));
  renderTodos();
}
function renderTodos(){
  const el=document.getElementById('todoList');
  if(!el) return;
  if(!qtState.todos.length){ el.innerHTML='<div style="color:var(--text-dim);font-size:13px;text-align:center;padding:20px">No tasks yet</div>'; return; }
  el.innerHTML=qtState.todos.map(t=>`
    <div class="todo-item${t.done?' done':''}" onclick="toggleTodo(${t.id})">
      <div class="todo-cb">${t.done?'<svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="#fff" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>':''}</div>
      <span>${t.text}</span>
      <span class="todo-del" onclick="event.stopPropagation();deleteTodo(${t.id})">✕</span>
    </div>`).join('');
}

// Focus Timer
function setFocus(mins, btn){
  qtState.focusMins=mins;
  if(qtState.focusRunning) return;
  document.querySelectorAll('.focus-preset').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById('focusClock').textContent=`${String(mins).padStart(2,'0')}:00`;
}
function toggleFocus(){
  const btn=document.getElementById('focusStartBtn');
  const lbl=document.getElementById('focusLabel');
  if(qtState.focusRunning){
    clearInterval(qtState.focusInterval); qtState.focusInterval=null;
    qtState.focusRunning=false;
    btn.textContent='Start'; lbl.textContent='Paused';
    return;
  }
  qtState.focusRunning=true;
  btn.textContent='Pause'; lbl.textContent='Focus mode on';
  let total=qtState.focusMins*60;
  const clock=document.getElementById('focusClock');
  qtState.focusInterval=setInterval(()=>{
    total--;
    const m=Math.floor(total/60), s=total%60;
    clock.textContent=`${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
    if(total<=0){
      clearInterval(qtState.focusInterval); qtState.focusRunning=false;
      btn.textContent='Start'; lbl.textContent='Time up';
      toast('Focus session complete');
    }
  },1000);
}
