let ckState={},radios={},ckTimes={},ckOrder={},liveOrdCounter=0;
let multiLog=[]; // [{key, seqNo, time, val, label}] — for multi-tick items
let globalSeq=0;  // unified sequence counter for all live items
let dir=null,res=null,pat=null,tn=null,idxRes=null,optType=null;
let discSc=[0,0,0,0,0,0];
let trades=[];
function sortTrades() {
  trades.sort((a,b) => {
    const da = (a.date || '') + (a.time || '');
    const db = (b.date || '') + (b.time || '');
    return db.localeCompare(da);
  });
}
let viewMode = localStorage.getItem('kj4-view') || 'grid';

function toggleViewMode() {
  viewMode = viewMode === 'list' ? 'grid' : 'list';
  localStorage.setItem('kj4-view', viewMode);
  renderTable();
}
const firebaseConfig = {
  apiKey: "AIzaSyB1P_GX8l3ANj-dwmTbthCkMpYGlvQPJO8",
  authDomain: "krishmarjournal.firebaseapp.com",
  projectId: "krishmarjournal",
  storageBucket: "krishmarjournal.firebasestorage.app",
  messagingSenderId: "668094141527",
  appId: "1:668094141527:web:297df00e12c046970cbf12",
  measurementId: "G-C6BRE5NS4B"
};
let db, auth, currentUser = null;
try {
  firebase.initializeApp(firebaseConfig);
  db = firebase.firestore();
  auth = firebase.auth();
  
  auth.onAuthStateChanged((user) => {
    if(user) {
      currentUser = user;
      document.getElementById('authOverlay').style.display = 'none';
      document.getElementById('mainApp').style.display = 'block';
      loadUserTrades();
    } else {
      currentUser = null;
      document.getElementById('authOverlay').style.display = 'flex';
      document.getElementById('mainApp').style.display = 'none';
      trades = [];
      updateStats();
      if(document.getElementById('page-trades') && document.getElementById('page-trades').classList.contains('active')) renderTable();
    }
  });
} catch(e) { console.log(e); }

function getTradesRef() {
  if(!currentUser) throw new Error("Not authenticated");
  return db.collection("users").doc(currentUser.uid).collection("trades");
}

function loadUserTrades() {
  getTradesRef().get().then((qs) => {
    trades = [];
    qs.forEach((doc) => { let t = doc.data(); t.id = doc.id; trades.push(t); });
    sortTrades();
    updateStats();
    if(document.getElementById('page-trades') && document.getElementById('page-trades').classList.contains('active')) renderTable();
  }).catch(e => console.log("Firestore error:", e));
}

document.addEventListener('DOMContentLoaded',()=>{
  const authPass = document.getElementById('authPass');
  if(authPass) authPass.addEventListener('keydown', e=>{ if(e.key==='Enter') loginUser(); });
  const authEmail = document.getElementById('authEmail');
  if(authEmail) authEmail.addEventListener('keydown', e=>{ if(e.key==='Enter') loginUser(); });
});

async function loginUser() {
  const e = document.getElementById('authEmail').value, p = document.getElementById('authPass').value;
  const err = document.getElementById('authErr');
  if(!e || !p) { err.textContent = "Email and Password required"; return; }
  err.textContent = "Logging in...";
  try { await auth.signInWithEmailAndPassword(e, p); err.textContent = ""; }
  catch(error) { err.textContent = error.message; }
}

async function logoutUser() {
  try { await auth.signOut(); } catch(e) { console.log("Logout error", e); }
}

let editId=null,pendingDel=null,chartData=null;

const LIVE_CKS=['pdh','pdl','pdob','spcross','flcross','wkh','wkl','dyh','dyl','spsw','flsw','choch','bos','chochtap','bostap'];
const KEY_LEVEL_CKS=['pdh','pdl','pdob','wkh','wkl','dyh','dyl'];
const MULTI_TICK_CKS=['spcross','flcross','spsw','flsw','choch','bos','chochtap','bostap'];
const PRE_CKS=['gapup','gapdn','pdc','pdsp'];
const ALL_CKS=[...PRE_CKS,...LIVE_CKS];
const CK_LABELS={pdh:'PDH',pdl:'PDL',pdob:'PD OB',spcross:'SP CROSS',flcross:'FL CROSS',wkh:'WEEK HIGH',wkl:'WEEK LOW',dyh:'DAY HIGH',dyl:'DAY LOW',spsw:'SP SWEEP',flsw:'FL SWEEP',choch:'CHoCH',bos:'BOS',chochtap:'CHoCH OB TAP',bostap:'BOS OB TAP',gapup:'GAP UP',gapdn:'GAP DOWN',pdc:'PDC',pdsp:'PD SP CROSS'};
const CK_MAP={gap:'gapup',gapd:'gapdn',pdsp:'pdsp',pdh:'pdh',pdl:'pdl',pdob:'pdob',spc:'spcross',flc:'flcross',wkh:'wkh',wkl:'wkl',dyh:'dyh',dyl:'dyl',spsw:'spsw',flsw:'flsw',choch:'choch',bos:'bos',chobt:'chochtap',bobt:'bostap'};

function goPage(p,btn){
  document.querySelectorAll('.page').forEach(x=>x.classList.remove('active'));
  document.querySelectorAll('.tab').forEach(x=>x.classList.remove('active'));
  document.getElementById('page-'+p).classList.add('active');
  btn.classList.add('active');
  document.getElementById('sigBox').style.display=(p==='checklist'||p==='entry')?'flex':'none';
  if(p==='trades') renderTable();
  if(p==='stats')  renderStats();
  if(p==='entry')  renderEntrySummary();
}

function goToChecklist(){
  document.querySelectorAll('.page').forEach(x=>x.classList.remove('active'));
  document.querySelectorAll('.tab').forEach(x=>x.classList.remove('active'));
  document.getElementById('page-checklist').classList.add('active');
  document.querySelector('.tab').classList.add('active');
  document.getElementById('sigBox').style.display='flex';
}

function proceedToEntry(){
  document.querySelectorAll('.page').forEach(x=>x.classList.remove('active'));
  document.querySelectorAll('.tab').forEach(x=>x.classList.remove('active'));
  document.getElementById('page-entry').classList.add('active');
  document.querySelectorAll('.tab')[1].classList.add('active');
  document.getElementById('sigBox').style.display='flex';
  renderEntrySummary();
}

function renderEntrySummary(){
  const checked=ALL_CKS.filter(k=>ckState[k]);
  const sumEl=document.getElementById('ck-summary');
  if(!checked.length){sumEl.innerHTML='<span style="color:var(--muted)">No checklist items completed yet. <a href="#" onclick="goToChecklist();return false;" style="color:var(--teal)">Go to Checklist →</a></span>';return;}
  sumEl.innerHTML=checked.map(k=>{const grp=Object.keys(CK_MAP).find(g=>CK_MAP[g]===k);const val=grp&&radios[grp]?' · '+radios[grp]:'';const t=ckTimes[k]?' @ '+ckTimes[k]:'';return`<span class="ck-tag">${CK_LABELS[k]||k}${val}${t}</span>`;}).join('');
  const tlKeys=Object.keys(ckOrder).sort((a,b)=>ckOrder[a]-ckOrder[b]);
  const etl=document.getElementById('entry-timeline');
  if(!tlKeys.length){etl.innerHTML='';return;}
  // Merge ckOrder items and multiLog items into a unified sorted timeline
  const allItems=[];
  tlKeys.forEach(k=>{const grp=Object.keys(CK_MAP).find(g=>CK_MAP[g]===k);const val=grp&&radios[grp]?radios[grp]:'';allItems.push({seq:ckOrder[k],label:CK_LABELS[k]||k,val,t:ckTimes[k]||'--:--'});});
  multiLog.forEach(m=>{allItems.push({seq:m.seqNo,label:CK_LABELS[m.key]||m.key,val:m.val||'',t:m.time||'--:--'});});
  allItems.sort((a,b)=>a.seq-b.seq);
  etl.innerHTML=`<div class="tl-title">📍 SEQUENCE TIMELINE</div>`+allItems.map(it=>`<div class="tl-item"><div class="tl-ord">${it.seq}</div><span class="tl-name">${it.label}</span><span class="tl-val">${it.val}</span><span class="tl-t">${it.t}</span></div>`).join('');
}

function updateProceedBtn(){
  const ok=ckState['spcross']&&ckState['flcross']&&(ckState['spsw']||ckState['flsw'])&&(ckState['choch']||ckState['bos']);
  const btn=document.getElementById('proceed-btn');
  btn.disabled=!ok;
  btn.textContent=ok?'✅ READY — PROCEED TO ENTRY ➜':'⏳ WAITING — Need SP Cross + FL Cross + Sweep + Structure';
}

function showToast(m,t='success'){const c=document.getElementById('toast-container');if(!c)return;const el=document.createElement('div');el.className=`toast ${t}`;el.textContent=m;c.appendChild(el);setTimeout(()=>el.remove(),3500);}

function tick(){
  const n=new Date();
  document.getElementById('clk').textContent=n.toLocaleTimeString('en-IN',{hour12:false});
  document.getElementById('dstr').textContent=n.toLocaleDateString('en-IN',{weekday:'short',day:'2-digit',month:'short',year:'numeric'});
  const fd=document.getElementById('f-date');if(!fd.value)fd.value=n.toISOString().split('T')[0];
  const h=n.getHours(),m=n.getMinutes();
  if(h>14||(h===14&&m>=30)) setSig('no','⛔ NO ENTRY — After 2:30 PM IST');
}
setInterval(tick,1000); tick();

function tog(k, fromButton = false){
  const isLive=LIVE_CKS.includes(k);
  const isMulti=MULTI_TICK_CKS.includes(k);

  // LOGIC FIX: Ignore row clicks (non-button) for adding live timeline items
  if(isLive && !fromButton && (!ckState[k] || isMulti)) return;
  if(isMulti){
    const ts=new Date().toLocaleTimeString('en-IN',{hour12:false,hour:'2-digit',minute:'2-digit'});
    globalSeq++;
    multiLog.push({key:k,seqNo:globalSeq,time:ts,val:''});
    ckState[k]=true;
    document.getElementById('ck-'+k)?.classList.add('on');
    const cnt=multiLog.filter(e=>e.key===k).length;
    document.getElementById('ord-'+k).textContent=cnt+'×';
    document.getElementById('tim-'+k).textContent=ts;
  } else {
    if(ckState[k]){
      ckState[k]=false;
      if(isLive){const ro=ckOrder[k];delete ckTimes[k];delete ckOrder[k];Object.keys(ckOrder).forEach(key=>{if(ckOrder[key]>ro)ckOrder[key]--;});globalSeq=Object.values(ckOrder).length?Math.max(...Object.values(ckOrder)):0;}
      document.getElementById('ck-'+k)?.classList.remove('on');
      document.getElementById('ord-'+k).textContent='—';
      document.getElementById('tim-'+k).textContent='--:--';
    } else {
      ckState[k]=true;
      const ts=new Date().toLocaleTimeString('en-IN',{hour12:false,hour:'2-digit',minute:'2-digit'});
      ckTimes[k]=ts;
      if(isLive){globalSeq++;ckOrder[k]=globalSeq;document.getElementById('ord-'+k).textContent='✓';}
      else document.getElementById('ord-'+k).textContent='✓';
      document.getElementById('tim-'+k).textContent=ts;
      document.getElementById('ck-'+k)?.classList.add('on');
    }
  }
  updateTimeline();updateProg();evalSig();updateProceedBtn();
}

function updateTimeline(){
  const items=[];
  Object.keys(ckOrder).forEach(k=>{
    const grp=Object.keys(CK_MAP).find(g=>CK_MAP[g]===k);
    const val=grp&&radios[grp]?radios[grp]:'';
    items.push({seqNo:ckOrder[k],label:CK_LABELS[k]||k,val,time:ckTimes[k]||'--:--'});
  });
  multiLog.forEach(e=>{
    items.push({seqNo:e.seqNo,label:CK_LABELS[e.key]||e.key,val:e.val,time:e.time});
  });
  items.sort((a,b)=>b.seqNo-a.seqNo);
  const tl=document.getElementById('timeline'),ti=document.getElementById('tl-items');
  if(!items.length){tl.classList.remove('show');return;}
  tl.classList.add('show');
  ti.innerHTML=items.map(e=>{
    const cls=e.val==='BULL'||e.val==='YES'||e.val==='BREAK'||e.val==='UP'?'ag':e.val==='BEAR'||e.val==='NO'||e.val==='SWEEP'?'ar':'ao';
    const badge = e.val ? `<span class="tl-badge ${cls}">${e.val}</span>` : '';
    return `<div class="tl-item" draggable="true" ondragstart="dragTl(event, ${e.seqNo})" ondragover="dragOverTl(event)" ondragleave="dragLeaveTl(event)" ondrop="dropTl(event, ${e.seqNo})" ondragend="dragEndTl(event)">
      <div class="tl-left">
        <div class="tl-ord">${e.seqNo}</div>
        <span class="tl-name">${e.label}</span>
      </div>
      <div class="tl-right">
        ${badge}
        <span class="tl-t">${e.time}</span>
        <button class="tl-del" onclick="rmTl(${e.seqNo}, event)">×</button>
      </div>
    </div>`;
  }).join('');
}

let draggedSeq = null;
function dragTl(e, seq) {
  draggedSeq = seq;
  e.dataTransfer.effectAllowed = 'move';
  setTimeout(()=>e.target.style.opacity='0.4', 0);
}
function dragOverTl(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  const rect = e.currentTarget.getBoundingClientRect();
  const relY = e.clientY - rect.top;
  if(relY > rect.height/2){ e.currentTarget.style.borderBottom='2px solid var(--blue)'; e.currentTarget.style.borderTop=''; }
  else{ e.currentTarget.style.borderTop='2px solid var(--blue)'; e.currentTarget.style.borderBottom=''; }
  return false;
}
function dragLeaveTl(e) {
  e.currentTarget.style.borderTop = '';
  e.currentTarget.style.borderBottom = '';
}
function dragEndTl(e) {
  e.target.style.opacity = '1';
  e.target.style.borderTop = '';
  e.target.style.borderBottom = '';
}
function dropTl(e, targetSeq) {
  e.stopPropagation();
  e.currentTarget.style.borderTop = '';
  e.currentTarget.style.borderBottom = '';
  if (draggedSeq === null || draggedSeq === targetSeq) return false;
  const rect = e.currentTarget.getBoundingClientRect();
  reorderTl(draggedSeq, targetSeq, (e.clientY - rect.top) > rect.height / 2);
  return false;
}
function reorderTl(dragSeq, tgtSeq, after) {
  let seqs = [];
  Object.values(ckOrder).forEach(s => seqs.push(s));
  multiLog.forEach(m => seqs.push(m.seqNo));
  seqs.sort((a,b)=>a-b);
  if (dragSeq !== null && tgtSeq !== null) {
    seqs = seqs.filter(s => s !== dragSeq);
    let idx = seqs.indexOf(tgtSeq);
    if(idx === -1) idx = seqs.length;
    if(after) idx++;
    seqs.splice(idx, 0, dragSeq);
  }
  Object.keys(ckOrder).forEach(k => { ckOrder[k] = seqs.indexOf(ckOrder[k]) + 1; });
  multiLog.forEach(m => { m.seqNo = seqs.indexOf(m.seqNo) + 1; });
  globalSeq = seqs.length;
  liveOrdCounter = seqs.length;
  ALL_CKS.forEach(k => {
    if(ckOrder[k] !== undefined) {
      document.getElementById('ord-'+k).textContent = LIVE_CKS.includes(k) ? ckOrder[k] : '✓';
    }
  });
  updateTimeline();updateProg();evalSig();updateProceedBtn();
}

function rmTl(seq, e){
  if(e) e.stopPropagation();
  const mIdx = multiLog.findIndex(x=>x.seqNo===seq);
  if(mIdx > -1){
    const k = multiLog[mIdx].key;
    multiLog.splice(mIdx,1);
    const cnt = multiLog.filter(x=>x.key===k).length;
    if(cnt===0) {
      ckState[k]=false;
      document.getElementById('ck-'+k)?.classList.remove('on');
      document.getElementById('ord-'+k).textContent='—';
      document.getElementById('tim-'+k).textContent='--:--';
    } else {
      document.getElementById('ord-'+k).textContent=cnt+'×';
      const last = [...multiLog].reverse().find(x=>x.key===k);
      document.getElementById('tim-'+k).textContent=last ? last.time : '--:--';
    }
  } else {
    const k = Object.keys(ckOrder).find(key=>ckOrder[key]===seq);
    if(k){
      ckState[k]=false;
      delete ckTimes[k];
      delete ckOrder[k];
      document.getElementById('ck-'+k)?.classList.remove('on');
      document.getElementById('ord-'+k).textContent='—';
      document.getElementById('tim-'+k).textContent='--:--';
      const grp=Object.keys(CK_MAP).find(g=>CK_MAP[g]===k);
      if(grp){
        delete radios[grp];
        document.querySelectorAll(`.opt[onclick*=",'${grp}',"]`).forEach(b=>b.className='opt');
      }
    }
  }
  reorderTl(null, null, false);
}

function pk(e,grp,val){
  e.stopPropagation();
  const ck=CK_MAP[grp];
  const isMulti=ck&&MULTI_TICK_CKS.includes(ck);
  if(isMulti){
    const ts=new Date().toLocaleTimeString('en-IN',{hour12:false,hour:'2-digit',minute:'2-digit'});
    globalSeq++;
    multiLog.push({key:ck,seqNo:globalSeq,time:ts,val});
    ckState[ck]=true;
    document.getElementById('ck-'+ck)?.classList.add('on');
    const cnt=multiLog.filter(en=>en.key===ck).length;
    document.getElementById('ord-'+ck).textContent=cnt+'×';
    document.getElementById('tim-'+ck).textContent=ts;
    document.querySelectorAll(`.opt[onclick*=",'${grp}',"]`).forEach(b=>b.className='opt');
    const btn=document.querySelector(`.opt[onclick*=",'${grp}','${val}'"]`);
    if(btn){const cls=val==='BULL'||val==='YES'||val==='BREAK'||val==='UP'?'ag':val==='BEAR'||val==='NO'||val==='SWEEP'?'ar':'ao';btn.classList.add(cls);setTimeout(()=>btn.classList.remove(cls),1200);}
    updateTimeline();updateProg();evalSig();updateProceedBtn();
  } else {
    radios[grp]=val;
    document.querySelectorAll(`.opt[onclick*=",'${grp}',"]`).forEach(b=>b.className='opt');
    const btn2=document.querySelector(`.opt[onclick*=",'${grp}','${val}'"]`);
    if(btn2)btn2.classList.add(val==='BULL'||val==='YES'||val==='BREAK'||val==='UP'?'ag':val==='BEAR'||val==='NO'||val==='SWEEP'?'ar':'ao');
    if(ck&&!ckState[ck])tog(ck, true);
    else if(ck){updateTimeline();updateProg();evalSig();updateProceedBtn();}
  }
}

function resetLiveChecks(){
  LIVE_CKS.forEach(k=>{
    ckState[k]=false;delete ckTimes[k];delete ckOrder[k];
    document.getElementById('ck-'+k)?.classList.remove('on');
    document.getElementById('ord-'+k).textContent='—';
    document.getElementById('tim-'+k).textContent='--:--';
    Object.keys(CK_MAP).forEach(g=>{if(CK_MAP[g]===k){delete radios[g];document.querySelectorAll(`.opt[onclick*=",'${g}',"]`).forEach(b=>b.className='opt');}});
  });
  multiLog=[];globalSeq=0;liveOrdCounter=0;
  updateTimeline();updateProg();evalSig();updateProceedBtn();
}

function setDir(d){dir=d;document.getElementById('d-buy').className='dbtn'+(d==='BUY'?' buy':'');document.getElementById('d-sell').className='dbtn'+(d==='SELL'?' sell':'');updateProg();evalSig();}
function setPat(p){pat=p;['P1','P2','P3'].forEach(x=>{const b=document.getElementById('pt-'+x);b.className='opt';b.style.cssText='padding:4px 12px;font-size:10px';});document.getElementById('pt-'+p).classList.add('ab');updateProg();evalSig();}
function setTN(t){tn=t;['1ST','2ND'].forEach(x=>document.getElementById('tn-'+x).className='opt'+(x===t?' ag':''));}

function updateCalculations(){
  // Index R:R
  const ie=parseFloat(document.getElementById('f-idx-entry').value),
        isl=parseFloat(document.getElementById('f-idx-sl').value),
        itg=parseFloat(document.getElementById('f-idx-tl').value),
        ieod=parseFloat(document.getElementById('f-idx-eod').value);
  const irk=document.getElementById('f-idx-risk'),irw=document.getElementById('f-idx-rew'),
        irr=document.getElementById('f-idx-rr'),ipl=document.getElementById('f-idx-pnl');
        
  if(!isNaN(ie)&&!isNaN(isl)){if(irk)irk.textContent=Math.abs(ie-isl).toFixed(0)+'pts';}
  if(!isNaN(ie)&&!isNaN(itg)){if(irw)irw.textContent=Math.abs(ie-itg).toFixed(0)+'pts';}
  if(!isNaN(ie)&&!isNaN(isl)&&!isNaN(itg)){if(irr)irr.value='1:'+(Math.abs(itg-ie)/Math.abs(ie-isl)).toFixed(1);}
  
  if(ipl){
    let pts = 0;
    if(idxRes==='TL'&&!isNaN(ie)&&!isNaN(itg)) pts=dir==='SELL'?(ie-itg):(itg-ie);
    else if(idxRes==='SL'&&!isNaN(ie)&&!isNaN(isl)) pts=dir==='SELL'?(ie-isl):(isl-ie);
    else if(idxRes==='EOD'&&!isNaN(ie)&&!isNaN(ieod)) pts=dir==='SELL'?(ie-ieod):(ieod-ie);
    
    if(idxRes) { ipl.value=(pts>=0?'+':'')+pts.toFixed(0)+' pts'; ipl.style.color=pts>=0?'var(--green)':'var(--red)'; }
    else { ipl.value='—'; ipl.style.color='var(--muted)'; }
  }

  // Option R:R & P&L
  const pe=parseFloat(document.getElementById('f-prem-entry').value),
        px=parseFloat(document.getElementById('f-prem-exit').value),
        sl=parseFloat(document.getElementById('f-sl').value),
        tp=parseFloat(document.getElementById('f-tp').value),
        q=parseFloat(document.getElementById('f-qty').value)||1,LOT=65;
  const ork=document.getElementById('f-risk'),orw=document.getElementById('f-rew'),
        orr=document.getElementById('f-rr'),opl=document.getElementById('f-pnl');
  const qlab=document.getElementById('f-qty-pts');
  if(qlab) qlab.textContent = `= ${Math.round(q * LOT)} qty`;
  
  if(!isNaN(pe)&&!isNaN(sl)){if(ork)ork.textContent=Math.abs(pe-sl).toFixed(1)+'pts';}
  if(!isNaN(pe)&&!isNaN(tp)){if(orw)orw.textContent=Math.abs(pe-tp).toFixed(1)+'pts';}
  if(!isNaN(pe)&&!isNaN(sl)&&!isNaN(tp)){if(orr)orr.value='1:'+(Math.abs(tp-pe)/Math.abs(pe-sl)).toFixed(1);}

  let curRes = res;
  if(!curRes && idxRes) {
    if(idxRes === 'TL') curRes = 'TP';
    else if(idxRes === 'SL') curRes = 'SL';
    else if(idxRes === 'EOD') curRes = 'EOD';
  }

  let exitPrice=NaN;
  if(!isNaN(px) && px > 0) exitPrice=px;
  else if(curRes==='TP'&&!isNaN(tp)) exitPrice=tp;
  else if(curRes==='SL'&&!isNaN(sl)) exitPrice=sl;
  
  if(opl){
    if(!isNaN(pe) && pe > 0 && !isNaN(exitPrice)){
      const pts=exitPrice-pe;
      const total=Math.round(pts*q*LOT);
      opl.value=(pts>=0?'+':'')+total+' ₹'; opl.style.color=pts>=0?'var(--green)':'var(--red)';
    } else { opl.value='—'; opl.style.color='var(--muted)'; }
  }
}

const TOTAL_STEPS = 21;
function updateProg(){const done=ALL_CKS.filter(k=>ckState[k]).length+(dir?1:0)+(pat?1:0);document.getElementById('prg-fill').style.width=Math.round(done/TOTAL_STEPS*100)+'%';document.getElementById('prg-txt').textContent=done+' / '+TOTAL_STEPS;updateCalculations();}

function setSig(t,txt){document.getElementById('sigBox').className='sig '+t;document.getElementById('sigTxt').textContent=txt;}
function evalSig(){
  const h=new Date().getHours(),m=new Date().getMinutes();
  if(h>14||(h===14&&m>=30)){setSig('no','⛔ NO ENTRY — After 2:30 PM IST');return;}
  if(!ckState['spcross']){setSig('wait','⏳ WAIT — SP CROSS not confirmed');return;}
  if(!ckState['flcross']){setSig('wait','⏳ WAIT — FL CROSS not confirmed');return;}
  if(!dir){setSig('wait','⏳ WAIT — Select BUY or SELL direction');return;}
  if(!pat){setSig('wait','⏳ WAIT — Select Entry Pattern');return;}
  if(!ckState['spsw']&&!ckState['flsw']){setSig('wait','⏳ WAIT — Need SP Sweep or FL Sweep');return;}
  if(!ckState['choch']&&!ckState['bos']){setSig('wait','⏳ WAIT — Need CHoCH or BOS');return;}
  setSig('go',`✅ VALID ENTRY — ${dir==='BUY'?'▲':'▼'} ${dir} | ${pat} | ${ckState['spsw']?'SP Sweep':'FL Sweep'} | ${ckState['choch']?'CHoCH':'BOS'}`);
}

function buildDisc(){for(let i=1;i<=6;i++){const c=document.getElementById('d'+i);if(!c)continue;c.innerHTML='';for(let s=1;s<=3;s++){const el=document.createElement('div');el.className='star'+(s<=discSc[i-1]?' on':'');el.onclick=(function(ii,ss){return function(){discSc[ii-1]=ss;buildDisc();const tot=discSc.reduce((a,b)=>a+b,0);document.getElementById('dtot').textContent=tot+'/18';document.getElementById('dbar').style.width=(tot/18*100)+'%';};})(i,s);c.appendChild(el);}}}
buildDisc();

async function saveTrade(){if(!dir||(!res && !idxRes)){showToast('Select Direction and Result!','error');return;}const t=buildObj();t.created=new Date().toISOString();try{if(!db)throw new Error("DB not init");const docRef=await getTradesRef().add(t);t.id=docRef.id;trades.push(t);sortTrades();updateStats();renderTable();showToast('✅ Trade #'+t.no+' saved!');newTrade();}catch(e){console.error(e);showToast("Error saving trade","error");}}
function buildObj(){
  const no = document.getElementById('f-no').value || String(trades.length+1).padStart(3,'0');
  const pdcVal = parseFloat(document.getElementById('pdc-val')?.value) || 0;
  const date = document.getElementById('f-date').value || new Date().toISOString().split('T')[0];
  const time = document.getElementById('f-time').value || '--:--';
  const exit = document.getElementById('f-exit').value || '';
  const notes = document.getElementById('f-notes').value;
  const strikeVal = document.getElementById('f-strike').value || '';
  const pe = parseFloat(document.getElementById('f-prem-entry').value) || NaN;
  const px = parseFloat(document.getElementById('f-prem-exit').value) || NaN;
  const sl = parseFloat(document.getElementById('f-sl').value) || NaN;
  const tp = parseFloat(document.getElementById('f-tp').value) || NaN;
  const q = parseFloat(document.getElementById('f-qty').value) || 1;
  const ie = parseFloat(document.getElementById('f-idx-entry').value) || NaN;
  const isl = parseFloat(document.getElementById('f-idx-sl').value) || NaN;
  const itg = parseFloat(document.getElementById('f-idx-tl').value) || NaN;
  const ieod = parseFloat(document.getElementById('f-idx-eod').value) || NaN;

  // Map idxRes to res if res is missing
  let currentRes = res;
  if(!currentRes && idxRes) {
    if(idxRes === 'TL') currentRes = 'TP';
    else if(idxRes === 'SL') currentRes = 'SL';
    else if(idxRes === 'EOD') currentRes = 'EOD';
  }
  
  let finalPnl = 0;
  const LOT = 65;
  let exitPrice = NaN;
  if(px > 0) exitPrice = px;
  else if(currentRes === 'TP' && tp > 0) exitPrice = tp;
  else if(currentRes === 'SL' && sl > 0) exitPrice = sl;
  
  if(pe > 0 && !isNaN(exitPrice)) {
    finalPnl = Math.round((exitPrice - pe) * q * LOT);
  }

  return {
    no, date, time, exit, dir, res: currentRes, pat: pat || '—', tn: tn || '1ST',
    strike: (strikeVal + (optType || '')).trim(), optType: optType || '',
    sl, tp, pnl: finalPnl, notes,
    premEntry: pe, premExit: px, qty: q,
    idxRes: idxRes || '', idxEntry: ie, idxSl: isl, idxTl: itg, idxEod: ieod,
    pdcVal, checks: {...ckState}, radios: {...radios}, ckTimes: {...ckTimes}, ckOrder: {...ckOrder}, multiLog: [...multiLog],
    disc: discSc.reduce((a, b) => a + b, 0),
    chartIdx: chartDataIdx || null, chartStr: chartDataStr || null, chart: chartDataIdx || null,
    psyTags: [...psyTags]
  };
}

function renderTable(){
  const fd=document.getElementById('flt-dir').value,fr=document.getElementById('flt-res').value,fp=document.getElementById('flt-pat').value,fs=document.getElementById('flt-src').value.toLowerCase();
  let list=[...trades].filter(t=>{
    let effectiveRes = t.res;
    if(!effectiveRes || effectiveRes === '—') {
      if(t.idxRes === 'TL') effectiveRes = 'TP';
      else if(t.idxRes === 'SL') effectiveRes = 'SL';
      else if(t.idxRes === 'EOD') effectiveRes = 'EOD';
    }
    if(fd&&t.dir!==fd)return false;
    if(fr&&effectiveRes!==fr)return false;
    if(fp&&t.pat!==fp)return false;
    if(fs&&!JSON.stringify(t).toLowerCase().includes(fs))return false;
    return true;
  });
  const tb=document.getElementById('tlog');
  const btnTgl=document.getElementById('btn-view-toggle');
  if(btnTgl) btnTgl.innerHTML = viewMode === 'list' ? '⊞ Grid View' : '☰ List View';

  if(!list.length){
    tb.style.gridTemplateColumns='1fr';
    tb.innerHTML='<div style="text-align:center;color:var(--muted);padding:30px;font-size:12px">No trades found</div>';
    document.getElementById('tbl-cnt').textContent='0 trades';
    return;
  }
  
  if (viewMode === 'grid') {
    tb.style.gridTemplateColumns = 'repeat(auto-fill, minmax(300px, 1fr))';
    tb.innerHTML = list.map(t => {
      let idxPnlHtml = '', optPnlHtml = '';
      const e = t.idxEntry || t.entry, s = t.idxSl || t.sl, tg = t.idxTl || t.tp;
      if(t.idxRes) {
        let pts=0;
        if(t.idxRes==='TL'&&e&&tg) pts=t.dir==='SELL'?(e-tg):(tg-e);
        else if(t.idxRes==='SL'&&e&&s) pts=t.dir==='SELL'?(e-s):(s-e);
        else if(t.idxRes==='EOD'&&e&&t.idxEod) pts=t.dir==='SELL'?(e-t.idxEod):(t.idxEod-e);
        const c=pts>=0?'var(--green)':'var(--red)';
        idxPnlHtml = `<div style="display:flex;justify-content:space-between;width:100%;align-items:center"><span class="tc-pnl-lbl">INDEX P&amp;L</span><span class="tc-pnl-amt" style="color:${c};font-size:15px">${pts>=0?'+':''}${Math.round(pts)} PTS</span></div>`;
      }
      if(t.premEntry || t.premExit) {
        const c=(t.pnl||0)>=0?'var(--green)':'var(--red)';
        optPnlHtml = `<div style="display:flex;justify-content:space-between;width:100%;align-items:center"><span class="tc-pnl-lbl">OPTION P&amp;L</span><span class="tc-pnl-amt" style="color:${c};font-size:15px">${(t.pnl||0)>=0?'+':''}${t.pnl||0} ₹</span></div>`;
      }
      if(!idxPnlHtml && !optPnlHtml) {
        optPnlHtml = `<div style="display:flex;justify-content:space-between;width:100%;align-items:center"><span class="tc-pnl-lbl">TOTAL P&amp;L</span><span class="tc-pnl-amt" style="color:var(--muted);font-size:15px">+0 ₹</span></div>`;
      }

      const cImg=t.chartIdx||t.chart;
      const chartHtml = cImg ? `<img src="${cImg}" class="tc-chart" loading="lazy">` : `<div class="tc-chart-ph"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="3" y1="9" x2="21" y2="9"></line><line x1="9" y1="21" x2="9" y2="9"></line></svg><span>NO INDEX CHART</span></div>`;
      
      return `
      <div class="tc-card" id="tr-${t.id}">
        ${chartHtml}
        <div class="tc-stripe" style="background:${t.dir==='BUY'?'var(--green)':'var(--red)'}"></div>
        <div class="tc-body">
          <div class="tc-top">
            <span class="tc-num">#${t.no}</span>
            <span class="tc-date">${t.date||'—'}</span>
            <span class="tc-time">${t.time||''}${t.exit?'→'+t.exit:''}</span>
          </div>
          <div class="tc-tags">
            <span class="tc-tag tc-tag-dir-${(t.dir||'none').toLowerCase()}">${t.dir==='BUY'?'▲':'▼'} ${t.dir||'—'}</span>
            <span class="tc-tag tc-tag-res-${(t.res||'eod').toLowerCase()}">${t.res||'—'}</span>
            ${t.idxRes?`<span class="tc-tag" style="background:rgba(255,255,255,.05);color:var(--text);border:1px solid var(--border)">IDX ${t.idxRes}</span>`:''}
            ${t.expiry?`<span class="tc-tag tc-tag-exp">${t.expiry}</span>`:''}
            ${t.pat&&t.pat!=='—'?`<span class="tc-tag tc-tag-pat">${t.pat}</span>`:''}
            ${t.strike?`<span class="tc-tag tc-tag-str">${t.optDir?t.optDir+' ':''}${t.strike}</span>`:''}
          </div>
          <div class="tc-metrics">
            <div class="tc-met"><div class="tc-met-lbl">IDX EN</div><div class="tc-met-val">${t.idxEntry||t.entry||'—'}</div></div>
            <div class="tc-met"><div class="tc-met-lbl">IDX SL</div><div class="tc-met-val" style="color:var(--red)">${t.idxSl||t.sl||'—'}</div></div>
            <div class="tc-met"><div class="tc-met-lbl">IDX TGT</div><div class="tc-met-val" style="color:var(--green)">${t.idxTl||t.tp||'—'}</div></div>
            <div class="tc-met"><div class="tc-met-lbl">PREM EN</div><div class="tc-met-val">${t.premEntry||'—'}</div></div>
            <div class="tc-met"><div class="tc-met-lbl">PREM EX</div><div class="tc-met-val">${t.premExit||'—'}</div></div>
            <div class="tc-met"><div class="tc-met-lbl">STRIKE</div><div class="tc-met-val" style="color:var(--teal)">${t.strike||'—'}</div></div>
          </div>
          <div class="tc-pnl" style="flex-direction:column;align-items:stretch;gap:6px">
            ${idxPnlHtml}
            ${optPnlHtml}
          </div>
          <div class="tc-disc-wrap">
            <div class="tc-disc-top"><span>Discipline Score</span> <span style="font-family:'JetBrains Mono',monospace;color:var(--yellow)">${t.disc||0}/18</span></div>
            <div class="tc-disc-bar"><div class="tc-disc-fill" style="width:${Math.round(((t.disc||0)/18)*100)}%"></div></div>
          </div>
          <div class="tc-actions">
            <button style="background:var(--blue);color:#fff" onclick="viewTrade('${t.id}')">VIEW</button>
            <button style="background:var(--dim);color:var(--text)" onclick="editTrade('${t.id}')">EDIT</button>
            <button style="background:rgba(255,59,92,0.1);color:var(--red)" onclick="deleteTrade('${t.id}')">DEL</button>
          </div>
        </div>
      </div>`;
    }).join('');
  } else {
    tb.style.gridTemplateColumns = '1fr';
    const resColor={TP:'var(--green)',SL:'var(--red)',EOD:'var(--orange)'};
    const resIcon={TP:'✅',SL:'❌',EOD:'🔔'};
    
    let tableHtml = `<div style="overflow-x:auto;"><table style="width:100%; border-collapse: collapse; font-size: 12px; text-align: left; background: var(--panel); border: 1px solid var(--border); border-radius: 8px; overflow: hidden;">
      <thead style="background: var(--dim);">
        <tr style="border-bottom: 2px solid #333; color: var(--muted); font-size: 10px; font-family: 'JetBrains Mono', monospace; text-transform: uppercase;">
          <th style="padding: 12px; border-top-left-radius: 8px;">Date & Time</th>
          <th style="padding: 12px;">Result / Dir</th>
          <th style="padding: 12px;">Pattern / Strike</th>
          <th style="padding: 12px;">Idx Entry</th>
          <th style="padding: 12px;">Target / SL</th>
          <th style="padding: 12px;">P&L</th>
          <th style="padding: 12px; text-align: right; border-top-right-radius: 8px;">Actions</th>
        </tr>
      </thead>
      <tbody>`;
    
    tableHtml += list.map(t=>{
      // Determine result for display and stats
      let effectiveRes = t.res;
      if(!effectiveRes || effectiveRes === '—') {
        if(t.idxRes === 'TL' || t.idxRes === 'TP') effectiveRes = 'TP';
        else if(t.idxRes === 'SL') effectiveRes = 'SL';
        else if(t.idxRes === 'EOD') effectiveRes = 'EOD';
      }

      const rc=resColor[effectiveRes]||'var(--muted)';
      const ri=resIcon[effectiveRes]||'—';
      
      let idxPnlHtml = '', optPnlHtml = '';
      if(t.idxRes && t.idxEntry && (t.idxTl || t.idxSl || t.idxEod)) {
        let pts=0; 
        const e=parseFloat(t.idxEntry), tg=parseFloat(t.idxTl), sl=parseFloat(t.idxSl), eod=parseFloat(t.idxEod);
        if(t.idxRes==='TL'&&e&&tg) pts=t.dir==='SELL'?(e-tg):(tg-e);
        else if(t.idxRes==='SL'&&e&&sl) pts=t.dir==='SELL'?(e-sl):(sl-e);
        else if(t.idxRes==='EOD'&&e&&eod) pts=t.dir==='SELL'?(e-eod):(eod-e);
        const c=pts>=0?'var(--green)':'var(--red)';
        idxPnlHtml = `<div style="color:${c};font-size:11px;font-weight:700">${pts>=0?'+':''}${Math.round(pts)} PTS</div>`;
      }
      if(t.pnl !== undefined && t.premEntry > 0) {
        const c=(t.pnl||0)>=0?'var(--green)':'var(--red)';
        optPnlHtml = `<div style="color:${c};font-size:14px;font-weight:700">${(t.pnl||0)>=0?'+':''}${t.pnl||0} ₹</div>`;
      }
      if(!idxPnlHtml && !optPnlHtml) optPnlHtml = `<div style="color:var(--muted);font-size:14px;font-weight:700">INDEX ONLY</div>`;

      // Simplified Result label for List view
      let resLabel = t.res || '—';
      if(t.idxRes && (!t.res || t.res === '—' || t.res === 'TP' || t.res === 'SL' || t.res === 'EOD')) {
         resLabel = (t.idxRes === 'TL' ? 'TL' : t.idxRes) + ' HIT';
         if(t.idxRes === 'EOD') resLabel = 'EOD EXIT';
      }

      return`<tr style="border-bottom: 1px solid #333; transition: background 0.2s;" onmouseenter="this.style.background='#2a2a2a'" onmouseleave="this.style.background='transparent'" id="tr-${t.id}">
        <td style="padding: 12px;">
          <div style="font-size:12px; color:var(--text); font-weight:500;">${t.date||'—'}</div>
          <div style="font-size:10px; color:var(--muted); font-family:'JetBrains Mono',monospace; margin-top:2px;">#${t.no} · ${t.time||''}${t.exit?' → '+t.exit:''}</div>
        </td>
        <td style="padding: 12px;">
          <div style="display:flex; gap:4px; margin-bottom:4px; flex-wrap:wrap">
            <span class="bdg bdg-${(t.dir||'').toLowerCase()}">${t.dir||'—'}</span>
            ${t.tn ? `<span class="bdg" style="background:var(--dim); color:var(--muted); border:1px solid var(--border); font-size:8px">${t.tn}</span>` : ''}
          </div>
          <div style="font-size:11px; font-weight:600; color:${rc}; font-family:'JetBrains Mono',monospace;">${ri} ${resLabel}</div>
        </td>
        <td style="padding: 12px;">
          <div style="font-size:11px; color:var(--blue); font-weight:600; margin-bottom:4px;">${t.pat&&t.pat!=='—'?t.pat:'—'}</div>
          <div style="font-size:10px; color:var(--teal); font-family:'JetBrains Mono',monospace;">${t.strike?t.strike:'—'}</div>
        </td>
        <td style="padding: 12px; font-family:'JetBrains Mono',monospace; font-size:12px; color:var(--text);">
          ${t.idxEntry||t.entry||'—'}
        </td>
        <td style="padding: 12px; font-family:'JetBrains Mono',monospace; font-size:11px;">
          <div style="color:var(--green); margin-bottom:2px;">Tgt: ${t.idxTl||t.tp||'—'}</div>
          <div style="color:var(--red);">SL: ${t.idxSl||t.sl||'—'}</div>
        </td>
        <td style="padding: 12px; font-family:'JetBrains Mono',monospace;">
          ${idxPnlHtml}
          ${optPnlHtml}
        </td>
        <td style="padding: 12px; text-align: right;">
          <div style="display:inline-flex; gap: 8px; border: 1px solid rgba(255,255,255,0.05); padding: 4px 8px; border-radius: 6px; background: var(--dim);">
            <button style="background:transparent; border:none; cursor:pointer; color:var(--blue); font-size:12px; opacity:0.8;" onmouseenter="this.style.opacity=1" onmouseleave="this.style.opacity=0.8" onclick="viewTrade('${t.id}')" title="View">👁️</button>
            <button style="background:transparent; border:none; cursor:pointer; color:var(--muted); font-size:12px; opacity:0.8;" onmouseenter="this.style.opacity=1" onmouseleave="this.style.opacity=0.8" onclick="editTrade('${t.id}')" title="Edit">✏️</button>
            <button style="background:transparent; border:none; cursor:pointer; color:var(--red); font-size:12px; opacity:0.8;" onmouseenter="this.style.opacity=1" onmouseleave="this.style.opacity=0.8" onclick="deleteTrade('${t.id}')" title="Delete">🗑️</button>
          </div>
        </td>
      </tr>`;
    }).join('');
    
    tableHtml += `</tbody></table></div>`;
    tb.innerHTML = tableHtml;
  }
  document.getElementById('tbl-cnt').textContent=list.length+' trade'+(list.length!==1?'s':'');
}

function viewTrade(id){
  const t=trades.find(x=>x.id===id);if(!t)return;
  const checked=Object.keys(t.checks||{}).filter(k=>t.checks[k]);
  
  let idxMetric = '';
  if(t.idxRes) {
    const e = t.idxEntry || t.entry, s = t.idxSl || t.sl, tg = t.idxTl || t.tp;
    let pts=0;
    if(t.idxRes==='TL'&&e&&tg) pts=t.dir==='SELL'?(e-tg):(tg-e);
    else if(t.idxRes==='SL'&&e&&s) pts=t.dir==='SELL'?(e-s):(s-e);
    else if(t.idxRes==='EOD'&&e&&t.idxEod) pts=t.dir==='SELL'?(e-t.idxEod):(t.idxEod-e);
    idxMetric = `<div class="mvm"><div class="mvm-lbl">Index P&amp;L</div><div class="mvm-val" style="color:${pts>=0?'var(--green)':'var(--red)'}">${pts>=0?'+':''}${Math.round(pts)} PTS</div></div><div class="mvh-sep"></div>`;
  }
  let optMetric = '';
  if(t.premEntry || t.premExit) {
    optMetric = `<div class="mvm"><div class="mvm-lbl">Option P&amp;L</div><div class="mvm-val" style="color:${(t.pnl||0)>=0?'var(--green)':'var(--red)'}">${(t.pnl||0)>=0?'+':''}${t.pnl||0} ₹</div></div><div class="mvh-sep"></div>`;
  }
  if(!idxMetric && !optMetric) {
    optMetric = `<div class="mvm"><div class="mvm-lbl">Total P&amp;L</div><div class="mvm-val" style="color:var(--muted)">+0 ₹</div></div><div class="mvh-sep"></div>`;
  }
  
  const vc=v=>v==='BULL'||v==='YES'||v==='BREAK'||v==='UP'?'cg':v==='BEAR'||v==='NO'||v==='SWEEP'?'cr':'co';

  const items=[];
  Object.keys(t.ckOrder||{}).forEach(k=>{
    const grp=Object.keys(CK_MAP).find(g=>CK_MAP[g]===k);
    const val=grp&&t.radios&&t.radios[grp]?t.radios[grp]:'';
    items.push({seqNo:t.ckOrder[k],label:CK_LABELS[k]||k,val,time:t.ckTimes&&t.ckTimes[k]?t.ckTimes[k]:'—'});
  });
  (t.multiLog||[]).forEach(e=>{
    items.push({seqNo:e.seqNo,label:CK_LABELS[e.key]||e.key,val:e.val,time:e.time});
  });
  items.sort((a,b)=>a.seqNo-b.seqNo);
  const tlHtml=items.length?items.map(e=>{
    return`<div class="mvh-tli"><div class="mvh-tlo">${e.seqNo}</div><span style="flex:1;font-size:12px;color:var(--text)">${e.label}</span>${e.val?`<span class="mvh-vbadge ${vc(e.val)}">${e.val}</span>`:''}<span style="font-family:'JetBrains Mono',monospace;font-size:10px;color:var(--yellow);min-width:36px;text-align:right">${e.time}</span></div>`;
  }).join(''):`<div style="color:var(--muted);font-size:11px;padding:8px 0">No sequence recorded</div>`;
  const sep='<div class="mvh-sep"></div>';
  const met=(lbl,val,col='')=>`<div class="mvm"><div class="mvm-lbl">${lbl}</div><div class="mvm-val"${col?` style="color:${col}"`:''} >${val}</div></div>`;
  const psyHtml=(t.psyTags||[]).length?`<div class="mvh-sec" style="margin-top:10px">🧠 Psychology</div><div>${(t.psyTags||[]).map(i=>`<span class="ck-tag" style="background:rgba(74,140,219,.1);color:var(--blue)">${PSY_LABELS[i]||i}</span>`).join('')}</div>`:'';
  document.getElementById('m-body').innerHTML=`
<div class="mvh-hdr">
  <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
    <span class="mvh-no">#${t.no}</span><span class="mvh-date">${t.date}</span>
    <span class="mvh-dbadge ${t.dir==='BUY'?'buy':'sell'}">${t.dir==='BUY'?'▲':'▼'} ${t.dir}</span>
    <span class="mvh-rbadge ${(t.res||'eod').toLowerCase()}">${t.res||'—'}</span>
    ${t.expiry?`<span style="padding:2px 8px;border-radius:4px;background:var(--dim);color:var(--muted);font-size:10px;font-family:'JetBrains Mono',monospace">${t.expiry}</span>`:''}
    ${t.pat&&t.pat!=='—'?`<span style="padding:2px 8px;border-radius:4px;background:rgba(74,140,219,.15);color:var(--blue);font-size:11px;font-weight:700;font-family:'JetBrains Mono',monospace">${t.pat}</span>`:''}
  </div>
  <button class="mvh-closebtn" onclick="closeM('viewModal')">✕</button>
</div>
<div class="mvh-metrics">
  ${met('Spot',t.entry||'—')}${sep}
  ${t.idxEntry?met('Idx Entry',t.idxEntry)+''+sep:''}  ${t.idxSl?met('Idx SL',t.idxSl,'var(--red)')+''+sep:''}  ${t.idxTl?met('Idx TL',t.idxTl,'var(--green)')+''+sep:''}
  ${met('Strike',t.strike||'—','var(--blue)')}${sep}
  ${met('Prem Entry',t.premEntry||'—')}${sep}
  ${met('Prem Exit',t.premExit||'—')}${sep}
  ${met('SL',t.sl||'—','var(--red)')}${sep}
  ${met('Target',t.tp||'—','var(--green)')}${sep}
  ${met('Qty',t.qty||1)}${sep}
  ${idxMetric}${optMetric}
  ${met('Entry',t.time||'—','var(--teal)')}${sep}
  ${met('Exit',t.exit||'—','var(--teal)')}${sep}
  ${met('Disc',(t.disc||0)+'/18','var(--yellow)')}
</div>
<div class="mvh-body">
  <div class="mvh-col">
    <div class="mvh-sec">📍 Sequence Timeline</div>
    ${tlHtml}
  </div>
  <div class="mvh-col">
    ${checked.length?`<div class="mvh-sec">✅ Checklist · <span style="color:var(--green)">${checked.length}</span><span style="color:var(--muted)">/18</span></div><div style="margin-bottom:4px">${checked.map(k=>`<span class="ck-tag">${CK_LABELS[k]||k}</span>`).join('')}</div>`:''}
    ${psyHtml}
    <div class="mvh-sec">📝 Notes</div>
    <div style="font-size:12px;color:${t.notes?'var(--text)':'var(--muted)'};line-height:1.7;background:var(--dim);padding:10px;border-radius:6px;min-height:50px">${t.notes||'No notes recorded.'}</div>
  </div>
</div>
${(t.chartIdx||t.chartStr||t.chart)?`<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:10px">
  <div><div style="font-size:9px;color:var(--muted);letter-spacing:1.5px;text-transform:uppercase;font-family:'JetBrains Mono',monospace;margin-bottom:5px">📊 INDEX CHART</div>${(t.chartIdx||t.chart)?`<img src="${t.chartIdx||t.chart}" style="width:100%;border-radius:6px;display:block">`:`<div style="height:100px;display:flex;align-items:center;justify-content:center;color:var(--muted);font-size:11px;background:var(--dim);border-radius:6px">No index chart</div>`}</div>
  <div><div style="font-size:9px;color:var(--muted);letter-spacing:1.5px;text-transform:uppercase;font-family:'JetBrains Mono',monospace;margin-bottom:5px">🎯 STRIKE CHART</div>${t.chartStr?`<img src="${t.chartStr}" style="width:100%;border-radius:6px;display:block">`:`<div style="height:100px;display:flex;align-items:center;justify-content:center;color:var(--muted);font-size:11px;background:var(--dim);border-radius:6px">No strike chart</div>`}</div>
</div>`:''}`;
  document.getElementById('viewModal').classList.add('open');
}

function editTrade(id){
  const t=trades.find(x=>x.id===id);if(!t)return;
  editId=id;
  document.querySelectorAll('.page').forEach(x=>x.classList.remove('active'));
  document.querySelectorAll('.tab').forEach(x=>x.classList.remove('active'));
  document.getElementById('page-checklist').classList.add('active');
  document.querySelector('.tab').classList.add('active');
  document.getElementById('sigBox').style.display='flex';
  ckState={...(t.checks||{})};radios={...(t.radios||{})};ckTimes={...(t.ckTimes||{})};ckOrder={...(t.ckOrder||{})};
  multiLog=[...(t.multiLog||[])];
  liveOrdCounter=Object.values(ckOrder).length?Math.max(...Object.values(ckOrder)):0;
  ALL_CKS.forEach(k=>{const el=document.getElementById('ck-'+k),ord=document.getElementById('ord-'+k),tim=document.getElementById('tim-'+k);if(ckState[k]){el?.classList.add('on');ord.textContent=LIVE_CKS.includes(k)?(ckOrder[k]||'?'):'✓';tim.textContent=ckTimes[k]||'--:--';}else{el?.classList.remove('on');ord.textContent='—';tim.textContent='--:--';}});
  Object.keys(radios).forEach(grp=>{const val=radios[grp];document.querySelectorAll(`.opt[onclick*=",'${grp}',"]`).forEach(b=>b.className='opt');const btn=document.querySelector(`.opt[onclick*=",'${grp}','${val}'"]`);if(btn)btn.classList.add(val==='BULL'||val==='YES'||val==='BREAK'||val==='UP'?'ag':val==='BEAR'||val==='NO'||val==='SWEEP'?'ar':'ao');});
  updateTimeline();updateProg();evalSig();updateProceedBtn();
  document.getElementById('f-no').value=t.no;
  if(t.pdcVal && document.getElementById('pdc-val')) document.getElementById('pdc-val').value=t.pdcVal;
  document.getElementById('f-date').value=t.date;
  document.getElementById('f-time').value=t.time;
  document.getElementById('f-exit').value=t.exit||'';
  document.getElementById('f-idx-entry').value=t.idxEntry||'';
  document.getElementById('f-idx-sl').value=t.idxSl||'';
  document.getElementById('f-idx-tl').value=t.idxTl||'';
  document.getElementById('f-idx-eod').value=t.idxEod||'';
  const st=t.strike||'';
  if(st.endsWith('CE')){setOptType('CE');document.getElementById('f-strike').value=st.replace('CE','').trim();}
  else if(st.endsWith('PE')){setOptType('PE');document.getElementById('f-strike').value=st.replace('PE','').trim();}
  else{document.getElementById('f-strike').value=st;}
  document.getElementById('f-sl').value=t.sl||'';
  document.getElementById('f-tp').value=t.tp||'';
  document.getElementById('f-prem-entry').value=t.premEntry||'';
  document.getElementById('f-prem-exit').value=t.premExit||'';
  document.getElementById('f-qty').value=t.qty||1;
  document.getElementById('f-notes').value=t.notes||'';
  psyTags=[...(t.psyTags||[])];
  [0,1,2,3].forEach(i=>{const b=document.getElementById('psy-'+i);if(b)b.className='opt'+(psyTags.includes(i)?' ag':'');});
  setDir(t.dir);if(t.res)setRes(t.res);if(t.pat&&t.pat!=='—')setPat(t.pat);if(t.tn)setTN(t.tn);
  if(t.idxRes) setIdxRes(t.idxRes);
  if(t.chartIdx)showChart(t.chartIdx,'idx'); else clearChart('idx');
  if(t.chartStr)showChart(t.chartStr,'str'); else clearChart('str');
  if(!t.chartIdx&&t.chart)showChart(t.chart,'idx');
  document.getElementById('btn-save').style.display='none';document.getElementById('btn-upd').style.display='flex';
  document.getElementById('editBar').classList.add('show');document.getElementById('editNo').textContent='#'+t.no;
  updateCalculations(); window.scrollTo({top:0,behavior:'smooth'});
}

async function updateTrade(){if(!editId){showToast('No trade selected','error');return;}if(!dir||(!res && !idxRes)){showToast('Select Direction and Result!','error');return;}const idx=trades.findIndex(x=>x.id===editId);if(idx===-1){showToast('Trade not found','error');return;}const u=buildObj();u.created=trades[idx].created;u.updated=new Date().toISOString();try{if(!db)throw new Error("DB not init");await getTradesRef().doc(editId).set(u);u.id=editId;trades[idx]=u;sortTrades();updateStats();renderTable();showToast('✅ Trade #'+u.no+' updated!');cancelEdit();}catch(e){console.error(e);showToast("Error updating trade","error");}}
function cancelEdit(){editId=null;document.getElementById('btn-save').style.display='flex';document.getElementById('btn-upd').style.display='none';document.getElementById('editBar').classList.remove('show');clearAll();}
function deleteTrade(id){const t=trades.find(x=>x.id===id);if(!t)return;pendingDel=id;document.getElementById('del-no').textContent='#'+t.no;document.getElementById('delModal').classList.add('open');}
async function confirmDel(){if(!pendingDel)return;try{if(!db)throw new Error("DB not init");await getTradesRef().doc(pendingDel).delete();trades=trades.filter(x=>x.id!==pendingDel);pendingDel=null;updateStats();renderTable();closeM('delModal');}catch(e){console.error(e);alert("Error deleting trade");}}
async function clearAllData(){if(!confirm('Delete ALL trades?'))return;try{if(!db)throw new Error("DB not init");const qs=await getTradesRef().get();const batch=db.batch();qs.forEach(doc=>{batch.delete(doc.ref);});await batch.commit();trades=[];updateStats();renderTable();}catch(e){console.error(e);alert("Error clearing trades");}}
function closeM(id){document.getElementById(id).classList.remove('open');}
window.addEventListener('click',e=>{if(e.target.classList.contains('modal-bg'))e.target.classList.remove('open');});
function updateStats(){
  if(!trades.length) {
    ['s-tot','s-win','s-los','s-wr','s-pnl','s-tod'].forEach(id=>{
      const el=document.getElementById(id); if(el) el.textContent=(id==='s-wr'?'0%':id==='s-pnl'?'+0':id==='s-tod'?'0/0':'0');
    });
    return;
  }
  
  // Create a version of trades with effective result mapping for stats
  const mappedTrades = trades.map(t => {
    let r = t.res;
    if(!r || r === '—') {
      if(t.idxRes === 'TL' || t.idxRes === 'TP') r = 'TP';
      else if(t.idxRes === 'SL') r = 'SL';
      else if(t.idxRes === 'EOD') r = 'EOD';
    }
    return {...t, effectiveRes: r};
  });

  const tot=mappedTrades.length;
  const wins=mappedTrades.filter(t=>t.effectiveRes==='TP').length;
  const loss=mappedTrades.filter(t=>t.effectiveRes==='SL').length;
  const wr=tot>0?Math.round(wins/tot*100):0;
  const pnl=mappedTrades.reduce((a,b)=>a+(b.pnl||0),0);
  const today=new Date().toISOString().slice(0,10);
  const tt=mappedTrades.filter(t=>t.date===today);
  const tw=tt.filter(t=>t.effectiveRes==='TP').length;
  const tl=tt.filter(t=>t.effectiveRes==='SL').length;
  
  document.getElementById('s-tot').textContent=tot;
  document.getElementById('s-win').textContent=wins;
  document.getElementById('s-los').textContent=loss;
  document.getElementById('s-wr').textContent=wr+'%';
  document.getElementById('s-pnl').textContent=(pnl>=0?'+':'')+pnl;
  document.getElementById('s-pnl').className='sv '+(pnl>=0?'cg':'cr');
  document.getElementById('s-tod').textContent=tw+'/'+tt.length;
  document.getElementById('s-tod').className='sv '+(tw>=tl?'cg':'cr');

  const sr=d=>`<div style="display:flex;justify-content:space-between;padding:1px 0;font-size:11px"><span>${d[0]}</span><span style="color:${d[2]};font-weight:700">${d[1]}</span></div>`;
  
  let ph='',dh='';
  ['P1','P2','P3'].forEach(p=>{
    const pt=mappedTrades.filter(t=>t.pat===p);
    const pw=pt.filter(t=>t.effectiveRes==='TP').length;
    const pwr=pt.length>0?Math.round(pw/pt.length*100):0;
    ph+=sr([p+' ('+pt.length+')',pwr+'% WR',pwr>=50?'var(--green)':'var(--muted)']);
  });
  document.getElementById('st-pt').innerHTML=ph;
  
  ['BUY','SELL'].forEach(d=>{
    const dt=mappedTrades.filter(t=>t.dir===d);
    const dw=dt.filter(t=>t.effectiveRes==='TP').length;
    const dwr=dt.length>0?Math.round(dw/dt.length*100):0;
    dh+=sr([d+' ('+dt.length+')',dwr+'% WR',dwr>=50?'var(--green)':dwr>=30?'var(--orange)':'var(--red)']);
  });
  document.getElementById('st-di').innerHTML=dh;
  
  const months={};
  mappedTrades.forEach(t=>{
    if(!t.date)return;
    const m=t.date.slice(0,7);
    if(!months[m])months[m]={tot:0,wins:0,pnl:0};
    months[m].tot++;
    if(t.effectiveRes==='TP')months[m].wins++;
    months[m].pnl+=(t.pnl||0);
  });
  document.getElementById('st-mo').innerHTML=Object.keys(months).sort().reverse().map(m=>{
    const mo=months[m];
    return sr([m,mo.tot+'T '+(Math.round(mo.wins/mo.tot*100))+'%WR '+(mo.pnl>=0?'+':'')+mo.pnl.toFixed(0)+'₹',mo.pnl>=0?'var(--green)':'var(--red)']);
  }).join('')||'<div style="color:var(--muted);font-size:12px">No data</div>';
  
  const sorted=[...mappedTrades].sort((a,b)=>(b.pnl||0)-(a.pnl||0));
  const trRow=t=>`<div style="display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid var(--border);font-family:'JetBrains Mono',monospace;font-size:11px"><span style="color:var(--muted)">#${t.no} ${t.date}</span><span style="color:${(t.pnl||0)>=0?'var(--green)':'var(--red)'};font-weight:700">${(t.pnl>=0?'+':'')+t.pnl}</span></div>`;
  document.getElementById('st-be').innerHTML=sorted.slice(0,5).map(trRow).join('')||'<div style="color:var(--muted);font-size:12px">No data</div>';
  document.getElementById('st-wo').innerHTML=sorted.slice(-5).reverse().map(trRow).join('')||'<div style="color:var(--muted);font-size:12px">No data</div>';
}

function setOptType(t){optType=t;const ce=document.getElementById('opt-ce'),pe=document.getElementById('opt-pe');if(ce&&pe){ce.className='opt'+(t==='CE'?' ag':'');pe.className='opt'+(t==='PE'?' ar':'');}}
function setRes(r){res=r;['r-tp','r-sl','r-eod'].forEach(id=>document.getElementById(id).className='rbtn');document.getElementById(r==='TP'?'r-tp':r==='SL'?'r-sl':'r-eod').className='rbtn '+(r==='TP'?'ag':r==='SL'?'ar':'ao');updateCalculations();updateProceedBtn();}

function newTrade(){
  clearAll();
  const next = trades.length ? Math.max(...trades.map(t=>parseInt(t.no)||0)) + 1 : 1;
  document.getElementById('f-no').value=String(next).padStart(3,'0');
  document.getElementById('f-time').value=new Date().toTimeString().slice(0,5);
}
function clearAll(){
  editId=null;
  ckState={};radios={};ckTimes={};ckOrder={};liveOrdCounter=0;globalSeq=0;multiLog=[];dir=null;res=null;pat=null;tn=null;idxRes=null;optType=null;psyTags=[];
  document.getElementById('btn-save').style.display='flex';
  document.getElementById('btn-upd').style.display='none';
  document.getElementById('editBar').classList.remove('show');
  ALL_CKS.forEach(k=>{document.getElementById('ck-'+k)?.classList.remove('on');document.getElementById('ord-'+k).textContent='—';document.getElementById('tim-'+k).textContent='--:--';});
  document.querySelectorAll('.opt').forEach(b=>b.className='opt');
  document.getElementById('d-buy').className='dbtn';
  document.getElementById('d-sell').className='dbtn';
  const obb=document.getElementById('od-buy'), obs=document.getElementById('od-sell');
  if(obb) obb.className='dbtn'; if(obs) obs.className='dbtn';
  ['r-tp','r-sl','r-eod'].forEach(id=>document.getElementById(id).className='rbtn');
  ['ir-tl','ir-sl','ir-eod'].forEach(id=>{const el=document.getElementById(id);if(el)el.className='rbtn';});
  ['f-strike','f-sl','f-tp','f-rr','f-pnl','f-notes','f-exit','f-prem-entry','f-prem-exit','f-qty','f-idx-entry','f-idx-sl','f-idx-tl','f-idx-eod','f-idx-rr','f-idx-pnl'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});
  const rk=document.getElementById('f-risk'),rw=document.getElementById('f-rew');
  if(rk)rk.textContent='—';if(rw)rw.textContent='—';
  const pl=document.getElementById('f-pnl');
  if(pl){pl.value='';pl.style.color='var(--text)';}
  [0,1,2,3].forEach(i=>document.getElementById('psy-'+i)?.classList.remove('ag'));
  discSc=[0,0,0,0,0,0];
  buildDisc();
  document.getElementById('dtot').textContent='0/18';
  document.getElementById('dbar').style.width='0%';
  setSig('wait','Complete checklist to evaluate signal');
  clearChart();
  document.getElementById('prg-fill').style.width='0%';
  document.getElementById('prg-txt').textContent='0 / '+TOTAL_STEPS;
  document.getElementById('timeline').classList.remove('show');
  document.getElementById('tl-items').innerHTML='';
  updateProceedBtn();
}
let chartDataIdx=null,chartDataStr=null;
function loadChart(e,id){const f=e.target.files[0];if(!f)return;const r=new FileReader();r.onload=ev=>showChart(ev.target.result,id);r.readAsDataURL(f);}
function dropChart(e,id){e.preventDefault();const f=e.dataTransfer.files[0];if(!f||!f.type.startsWith('image/'))return;const r=new FileReader();r.onload=ev=>showChart(ev.target.result,id);r.readAsDataURL(f);}
function showChart(src,id){
  if(id==='str'){chartDataStr=src;document.getElementById('chart-img-str').src=src;document.getElementById('chart-img-str').style.display='block';document.getElementById('chart-ph-str').style.display='none';}
  else{chartDataIdx=src;document.getElementById('chart-img-idx').src=src;document.getElementById('chart-img-idx').style.display='block';document.getElementById('chart-ph-idx').style.display='none';}
}
function clearChart(id){
  if(!id||id==='idx'){chartDataIdx=null;const i=document.getElementById('chart-img-idx');if(i){i.src='';i.style.display='none';}const p=document.getElementById('chart-ph-idx');if(p)p.style.display='flex';const f=document.getElementById('cf-idx');if(f)f.value='';}
  if(!id||id==='str'){chartDataStr=null;const i=document.getElementById('chart-img-str');if(i){i.src='';i.style.display='none';}const p=document.getElementById('chart-ph-str');if(p)p.style.display='flex';const f=document.getElementById('cf-str');if(f)f.value='';}
}
document.addEventListener('paste',e=>{const isShift=e.shiftKey;for(const item of e.clipboardData.items){if(item.type.startsWith('image/')){const r=new FileReader();r.onload=ev=>showChart(ev.target.result,isShift?'str':'idx');r.readAsDataURL(item.getAsFile());break;}}});

function toggleTheme(){
  const isLight=!document.body.classList.toggle('dark');
  const btn=document.getElementById('theme-toggle');
  btn.textContent=isLight?'☀️ LIGHT':'🌙 DARK';
  localStorage.setItem('kj4-theme',isLight?'light':'dark');
}
(function(){if(localStorage.getItem('kj4-theme')==='dark'){document.body.classList.add('dark');document.getElementById('theme-toggle').textContent='☀️ LIGHT';}})();

const PSY_LABELS=['✅ Followed Plan','⚡ FOMO Entry','😤 Revenge Trade','🧘 Patient'];
let psyTags=[];

function togglePsy(i){
  const idx=psyTags.indexOf(i);
  if(idx>-1){psyTags.splice(idx,1);document.getElementById('psy-'+i)?.classList.remove('ag');}
  else{psyTags.push(i);document.getElementById('psy-'+i)?.classList.add('ag');}
}

// Logic moved to updateCalculations()

// Logic moved to updateCalculations()

function setIdxRes(r){
  idxRes=r;
  document.getElementById('ir-tl').className='rbtn'+(r==='TL'?' ag':'');
  document.getElementById('ir-sl').className='rbtn'+(r==='SL'?' ar':'');
  document.getElementById('ir-eod').className='rbtn'+(r==='EOD'?' ao':'');
  updateCalculations();
}

updateStats();newTrade();updateProceedBtn();
