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
let editingTradeId = null;
try {
  firebase.initializeApp(firebaseConfig);
  db = firebase.firestore();
  auth = firebase.auth();
  
  auth.onAuthStateChanged((user) => {
    if(user) {
      currentUser = user;
      loadObsTrades();
    } else {
      // Auto sign in anonymously — no login screen needed
      auth.signInAnonymously().catch(e => console.error("Anon auth failed:", e));
    }
  });
} catch(e) { console.error("Firebase init error:", e); }

// Auth removed: auto sign-in anonymously for Firestore access
async function loginUser() {} // kept for compatibility

// Strictly isolated collection
function getObsTradesRef() {
  if(!currentUser) throw new Error("Not authenticated");
  return db.collection("users").doc(currentUser.uid).collection("obs_trades");
}

let obsTrades = [];
let chartData = null;
let currentSetup = 1;
let checklist = { 
  index_trend: null,
  sp_ce: false, sp_pe: false, ce_fl: null, pe_fl: null, ce_close: false, pe_close: false,
  s2_sweep_ce: false, s2_sweep_pe: false, s2_break_ce: false, s2_break_pe: false, s2_div: false, s2_exec: false
};

function switchSetup(n) {
  currentSetup = n;
  
  // UI Toggles
  document.getElementById('checklist-setup-1').classList.toggle('hidden', n !== 1);
  document.getElementById('checklist-setup-2').classList.toggle('hidden', n !== 2);
  
  // Button Styles
  document.getElementById('setup-btn-1').className = n === 1 ? 'flex-1 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all bg-indigo-500 text-white' : 'flex-1 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all text-gray-500 hover:text-white hover:bg-white/5';
  document.getElementById('setup-btn-2').className = n === 2 ? 'flex-1 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all bg-indigo-500 text-white' : 'flex-1 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all text-gray-500 hover:text-white hover:bg-white/5';
  
  // RR Label
  document.getElementById('rr-label').textContent = n === 1 ? 'Fixed 1:2 Reward' : 'Fixed 1:3 Reward';
  
  resetForm();
}

function updateStepperUI() {
  if (currentSetup === 1) {
    const s1 = checklist.sp_ce || checklist.sp_pe;
    const s2 = checklist.ce_fl !== null;
    const s3 = checklist.pe_fl !== null;
    const s4 = checklist.ce_close === true;
    const s5 = checklist.pe_close === true;
    const steps = [s1, s2, s3, s4, s5];
    
    for (let i = 0; i < steps.length; i++) {
        const nextCard = document.getElementById(`step-card-${i + 2}`);
        if (nextCard) {
            if (steps[i]) nextCard.classList.remove('opacity-40', 'pointer-events-none', 'grayscale');
            else {
                for (let j = i; j < steps.length; j++) {
                    const c = document.getElementById(`step-card-${j + 2}`);
                    if (c) c.classList.add('opacity-40', 'pointer-events-none', 'grayscale');
                }
                break;
            }
        }
    }
    updateFinalButton(s5);
  } else {
    const s1 = checklist.s2_sweep_ce || checklist.s2_sweep_pe;
    const s2 = checklist.s2_break_ce || checklist.s2_break_pe;
    const s3 = checklist.s2_div === true;
    const s4 = checklist.s2_exec === true;
    const steps = [s1, s2, s3, s4];
    
    for (let i = 0; i < steps.length; i++) {
        const nextCard = document.getElementById(`s2-card-${i + 2}`);
        if (nextCard) {
            if (steps[i]) nextCard.classList.remove('opacity-40', 'pointer-events-none', 'grayscale');
            else {
                for (let j = i; j < steps.length; j++) {
                    const c = document.getElementById(`s2-card-${j + 2}`);
                    if (c) c.classList.add('opacity-40', 'pointer-events-none', 'grayscale');
                }
                break;
            }
        }
    }
    updateFinalButton(s4);
  }
}

function updateFinalButton(ready) {
  const btn = document.getElementById('btn-final-save');
  if(!btn) return;
  
  if(ready) {
    btn.disabled = false;
    btn.classList.remove('opacity-40', 'grayscale', 'cursor-not-allowed');
    btn.classList.add('animate-pulse-green', 'hover:bg-green-500', 'shadow-[0_0_30px_rgba(34,197,94,0.4)]');
  } else {
    btn.disabled = true;
    btn.classList.add('opacity-40', 'grayscale', 'cursor-not-allowed');
    btn.classList.remove('animate-pulse-green', 'hover:bg-green-500', 'shadow-[0_0_30px_rgba(34,197,94,0.4)]');
  }
}

function toggleCheck(type, elementId, colorClass, val = true) {
  const el = document.getElementById(elementId);
  const colorMap = {
    green: 'bg-green-600',
    yellow: 'bg-yellow-600',
    blue: 'bg-blue-600',
    red: 'bg-red-600'
  };
  const activeClass = colorMap[colorClass];

  // Handle Mutual Exclusivity for FL Lines and Index Trend
  if (type === 'ce_fl' || type === 'pe_fl' || type === 'index_trend') {
    const isAlreadyThisVal = checklist[type] === val;
    
    const btnIds = {
      ce_fl: ['btn-ce-tap', 'btn-ce-break'],
      pe_fl: ['btn-pe-tap', 'btn-pe-break'],
      index_trend: ['btn-index-green', 'btn-index-red', 'btn-s2-index-green', 'btn-s2-index-red']
    };
    
    const group = btnIds[type] || [];
    group.forEach(id => {
      const btn = document.getElementById(id);
      if (btn) {
        btn.classList.remove('bg-green-600', 'bg-yellow-600', 'bg-blue-600', 'bg-red-600', 'text-white');
        btn.classList.add('bg-gray-700');
      }
    });

    if (isAlreadyThisVal) {
      checklist[type] = null;
    } else {
      checklist[type] = val;
      el.classList.remove('bg-gray-700');
      el.classList.add(activeClass, 'text-white');
    }
  } else {
    // Standard Toggle for SP and Candle Closes
    checklist[type] = !checklist[type];
    if (checklist[type]) {
      el.classList.remove('bg-gray-700');
      el.classList.add(activeClass, 'text-white');
    } else {
      el.classList.remove(activeClass, 'text-white');
      el.classList.add('bg-gray-700');
    }
  }
  updateStepperUI();
}

function updateRR() {
  const entry = parseFloat(document.getElementById('entry').value);
  const sl = parseFloat(document.getElementById('sl').value);
  const dir = document.getElementById('direction').value;
  const targetEl = document.getElementById('target');
  const pnlEl = document.getElementById('pnl');

  if(!isNaN(entry) && !isNaN(sl)) {
    const risk = Math.abs(entry - sl);
    let target = 0;
    const mult = currentSetup === 1 ? 2 : 3;
    if(dir === 'BUY') {
      target = entry + (risk * mult);
    } else {
      target = entry - (risk * mult);
    }
    targetEl.value = target.toFixed(2);
    
    // Calculate P&L based on result
    const res = document.getElementById('result').value;
    if(res === 'TP') {
      pnlEl.value = '+' + (risk * mult).toFixed(2);
      pnlEl.className = "w-full bg-gray-900 border border-white/10 rounded-lg px-4 py-2 text-green-500 font-bold";
    } else if(res === 'SL') {
      pnlEl.value = '-' + risk.toFixed(2);
      pnlEl.className = "w-full bg-gray-900 border border-white/10 rounded-lg px-4 py-2 text-red-500 font-bold";
    } else {
      pnlEl.value = '0.00';
      pnlEl.className = "w-full bg-gray-900 border border-white/10 rounded-lg px-4 py-2 text-gray-400";
    }
  }
}

async function saveObsTrade() {
  const entry = document.getElementById('entry').value;
  const sl = document.getElementById('sl').value;
  if(!entry || !sl) { alert("Entry and SL are required!"); return; }

  const tradePayload = {
    setup: currentSetup === 1 ? 'SP SYNC (1:2)' : 'TRAP REVERSAL (1:3)',
    date: document.getElementById('date').value,
    entryTime: document.getElementById('entryTime').value,
    exitTime: document.getElementById('exitTime').value,
    direction: document.getElementById('direction').value,
    entry: parseFloat(document.getElementById('entry').value),
    sl: parseFloat(document.getElementById('sl').value) || 0,
    target: parseFloat(document.getElementById('target').value) || 0,
    pnl: document.getElementById('pnl').value,
    result: document.getElementById('result').value,
    checklist: { ...checklist },
    chart: chartData,
    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  };

  const targetId = editingTradeId;
  try {
    if (targetId) {
      await getObsTradesRef().doc(targetId).update(tradePayload);
      cancelEdit();
      await loadObsTrades();
      alert("✅ Record Updated Successfully!");
      openTradeModal(targetId);
    } else {
      const newTrade = { ...tradePayload, created: firebase.firestore.FieldValue.serverTimestamp() };
      const docRef = await getObsTradesRef().add(newTrade);
      cancelEdit();
      await loadObsTrades();
      alert("✅ Backtest saved!");
      openTradeModal(docRef.id);
    }
  } catch(e) {
    console.error("SAVE ERROR:", e.message);
    alert("Error: " + e.message);
  }
}

function resetForm() {
  document.getElementById('date').value = new Date().toISOString().split('T')[0];
  document.getElementById('entryTime').value = "";
  document.getElementById('exitTime').value = "";
  document.getElementById('entry').value = '';
  document.getElementById('sl').value = '';
  document.getElementById('target').value = '0.00';
  document.getElementById('pnl').value = '';
  document.getElementById('result').value = 'TP';
  chartData = null;
  document.getElementById('chart-img').classList.add('hidden');
  document.getElementById('chart-ph').classList.remove('hidden');
  checklist = { 
    index_trend: null,
    sp_ce: false, sp_pe: false, ce_fl: null, pe_fl: null, ce_close: false, pe_close: false,
    s2_sweep_ce: false, s2_sweep_pe: false, s2_break_ce: false, s2_break_pe: false, s2_div: false, s2_exec: false
  };

  const allBtns = [
    'btn-index-green', 'btn-index-red', 'btn-s2-index-green', 'btn-s2-index-red',
    'btn-sp-ce', 'btn-sp-pe', 'btn-ce-tap', 'btn-ce-break', 'btn-pe-tap', 'btn-pe-break', 'btn-ce-close', 'btn-pe-close',
    'btn-s2-sweep-ce', 'btn-s2-sweep-pe', 'btn-s2-break-ce', 'btn-s2-break-pe', 'btn-s2-div', 'btn-s2-exec'
  ];
  allBtns.forEach(id => {
      const el = document.getElementById(id);
      if (el) {
          el.classList.remove('bg-green-600', 'bg-yellow-600', 'bg-blue-600', 'bg-red-600', 'text-white');
          el.classList.add('bg-gray-700');
      }
  });

  editingTradeId = null;
  document.getElementById('btn-cancel-edit').classList.add('hidden');
  document.getElementById('btn-final-save').innerHTML = `<span class="text-2xl">🟢</span> PROCEED TO ENTRY`;
  
  updateStepperUI();
}

function cancelEdit() {
  resetForm();
}

function loadObsTrades() {
  getObsTradesRef().orderBy('created', 'desc').get().then((qs) => {
    obsTrades = [];
    qs.forEach(doc => obsTrades.push({id: doc.id, ...doc.data()}));
    renderObsLog();
  });
}

function renderObsLog() {
  const logEl = document.getElementById('obsLog');
  if(!logEl) return;

  const countEl = document.getElementById('obs-trade-count');
  if(countEl) countEl.textContent = obsTrades.length ? `${obsTrades.length} record${obsTrades.length > 1 ? 's' : ''}` : '';

  if(obsTrades.length === 0) {
    logEl.innerHTML = '<div class="text-center py-10 text-gray-600 text-[10px] uppercase font-bold tracking-widest">No trades recorded in collection</div>';
    return;
  }

  logEl.innerHTML = `<div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">${obsTrades.map(t => {
    const pnlPos = String(t.pnl).startsWith('+');
    const isBuy  = t.direction === 'BUY';
    const resultBorder = t.result === 'TP' ? 'border-green-500/25 hover:border-green-500/50'
                       : t.result === 'SL' ? 'border-red-500/25 hover:border-red-500/50'
                       : 'border-white/5 hover:border-indigo-500/40';
    const pnlColor  = pnlPos ? 'text-green-400' : 'text-red-400';
    const dirBadge  = isBuy ? 'bg-green-500/15 text-green-400 border-green-500/20'
                            : 'bg-red-500/15 text-red-400 border-red-500/20';
    const resultTag = t.result === 'TP'
      ? '<span class="text-[7px] font-black text-green-500 bg-green-500/10 px-1.5 py-0.5 rounded border border-green-500/20">TP</span>'
      : t.result === 'SL'
      ? '<span class="text-[7px] font-black text-red-500 bg-red-500/10 px-1.5 py-0.5 rounded border border-red-500/20">SL</span>'
      : '';
    const thumbHtml = t.chart
      ? `<div class="relative w-full h-[110px] rounded-lg overflow-hidden mb-3 cursor-pointer group/thumb" onclick="openTradeModal('${t.id}')">
           <img src="${t.chart}" class="w-full h-full object-cover group-hover/thumb:scale-105 transition-transform duration-300">
           <div class="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent"></div>
           <div class="absolute inset-0 flex items-center justify-center opacity-0 group-hover/thumb:opacity-100 transition-opacity bg-black/30">
             <div class="w-8 h-8 rounded-full bg-white/10 backdrop-blur flex items-center justify-center border border-white/20">
               <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
             </div>
           </div>
         </div>`
      : `<div class="w-full h-[110px] rounded-lg bg-gray-900/60 border border-white/5 flex items-center justify-center mb-3 cursor-pointer hover:border-indigo-500/30 transition-all" onclick="openTradeModal('${t.id}')">
           <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#374151" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
         </div>`;
    return `
    <div class="bg-[#181d2a] border ${resultBorder} rounded-2xl p-3 flex flex-col gap-2 transition-all duration-200">
      ${thumbHtml}
      <div class="flex items-center justify-between gap-1">
        <span class="text-[9px] font-black text-gray-500 font-mono tracking-tight">${t.date}</span>
        <div class="flex items-center gap-1">${resultTag}<span class="text-[7px] font-black px-1.5 py-0.5 rounded border ${dirBadge}">${t.direction}</span></div>
      </div>
      <span class="text-[7px] font-black text-indigo-400/60 uppercase tracking-tighter truncate leading-none">${t.setup || 'SP SYNC'}</span>
      <div class="grid grid-cols-2 gap-x-3 gap-y-1 text-[9px] font-mono mt-0.5">
        <div class="flex justify-between items-center"><span class="text-gray-600 text-[8px]">EN</span><span class="text-gray-200 font-bold">${t.entry}</span></div>
        <div class="flex justify-between items-center"><span class="text-gray-600 text-[8px]">SL</span><span class="text-red-400 font-bold">${t.sl}</span></div>
        <div class="flex justify-between items-center"><span class="text-gray-600 text-[8px]">TG</span><span class="text-green-400 font-bold">${t.target}</span></div>
        <div class="flex justify-between items-center"><span class="text-gray-600 text-[8px]">PL</span><span class="${pnlColor} font-black text-[10px]">${t.pnl}</span></div>
      </div>
      <div class="flex gap-1.5 pt-1 border-t border-white/5 mt-auto">
        <button onclick="editTrade('${t.id}')" class="flex-1 bg-white/5 hover:bg-indigo-500/20 text-indigo-400 text-[7px] font-black uppercase py-1.5 rounded-lg transition-all border border-white/5 flex items-center justify-center gap-1">
          <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
          EDIT
        </button>
        <button onclick="openTradeModal('${t.id}')" class="flex-1 bg-indigo-500/10 hover:bg-indigo-500/25 text-indigo-400 text-[7px] font-black uppercase py-1.5 rounded-lg transition-all border border-indigo-500/10 flex items-center justify-center gap-1">
          <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
          VIEW
        </button>
        <button onclick="deleteTrade('${t.id}', '${t.date}')" class="bg-red-500/10 hover:bg-red-500/30 text-red-400 text-[7px] font-black uppercase py-1.5 px-2 rounded-lg transition-all border border-red-500/10 hover:border-red-500/30 flex items-center justify-center" title="Delete">
          <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"></path><path d="M10 11v6"></path><path d="M14 11v6"></path><path d="M9 6V4h6v2"></path></svg>
        </button>
      </div>
    </div>`;
  }).join('')}</div>`;
}

function openTradeModal(id) {
  const t = obsTrades.find(x => x.id === id);
  if(!t) return;
  
  document.getElementById('modalSetup').textContent = t.setup || "Option Setup";
  document.getElementById('modalDate').textContent = "Trade Date: " + t.date;
  document.getElementById('modalTime').textContent = (t.entryTime || "00:00") + " - " + (t.exitTime || "00:00");
  document.getElementById('modalImg').src = t.chart || "";
  document.getElementById('modalEntry').textContent = t.entry;
  document.getElementById('modalSL').textContent = t.sl;
  document.getElementById('modalTarget').textContent = t.target;
  document.getElementById('modalPNL').className = "text-xl font-black " + (String(t.pnl).startsWith('+') ? 'text-green-500' : 'text-red-500');
  
  // Set up the Edit button in the modal
  const editBtn = document.getElementById('modal-edit-btn');
  if(editBtn) {
      editBtn.onclick = () => {
          closeModal();
          editTrade(t.id);
      };
  }
  
  renderChecklistSummary(t.checklist);
  
  const modal = document.getElementById('tradeModal');
  const content = document.getElementById('modalContent');
  modal.classList.remove('hidden');
  setTimeout(() => {
    content.classList.remove('scale-95', 'opacity-0');
    content.classList.add('scale-100', 'opacity-100');
  }, 10);
}

function renderChecklistSummary(data) {
  const container = document.getElementById('modalChecklist');
  if(!container) return;
  container.innerHTML = '';
  
  const labels = {
    sp_ce: "SP Cross CE", sp_pe: "SP Cross PE",
    ce_close: "CE Close Confirmed", pe_close: "PE Close Confirmed",
    s2_sweep_ce: "SP Sweep CE", s2_sweep_pe: "SP Sweep PE",
    s2_div: "Divergence Filtered", s2_exec: "RR 1:3 Execution"
  };

  // Index Trend Badge
  if(data.index_trend) {
    const span = document.createElement('span');
    const color = data.index_trend === 'green' ? 'bg-green-500/10 text-green-500 border-green-500/10' : 'bg-red-500/10 text-red-500 border-red-500/10';
    span.className = `${color} text-[8px] font-bold px-3 py-1.5 rounded-full border flex items-center gap-1`;
    span.innerHTML = `INDEX ${data.index_trend.toUpperCase()}`;
    container.appendChild(span);
  }

  // Standard Boolean Checks
  Object.keys(labels).forEach(key => {
    if(data[key] === true) {
      const span = document.createElement('span');
      span.className = "bg-green-500/10 text-green-500 text-[8px] font-bold px-3 py-1.5 rounded-full border border-green-500/10 flex items-center gap-1";
      span.innerHTML = `<svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg> ${labels[key]}`;
      container.appendChild(span);
    }
  });

  // Special handling for FL Line (strings: tap/break)
  if(data.ce_fl) {
    const span = document.createElement('span');
    span.className = "bg-blue-500/10 text-blue-400 text-[8px] font-bold px-3 py-1.5 rounded-full border border-blue-500/10";
    span.textContent = `CE FL: ${data.ce_fl.toUpperCase()}`;
    container.appendChild(span);
  }
  if(data.pe_fl) {
    const span = document.createElement('span');
    span.className = "bg-blue-500/10 text-blue-400 text-[8px] font-bold px-3 py-1.5 rounded-full border border-blue-500/10";
    span.textContent = `PE FL: ${data.pe_fl.toUpperCase()}`;
    container.appendChild(span);
  }
  if(data.s2_break_ce === true) {
    const span = document.createElement('span');
     span.className = "bg-indigo-500/10 text-indigo-400 text-[8px] font-bold px-3 py-1.5 rounded-full border border-indigo-500/10";
    span.textContent = "CE FL BROKEN";
    container.appendChild(span);
  }
  if(data.s2_break_pe === true) {
    const span = document.createElement('span');
     span.className = "bg-indigo-500/10 text-indigo-400 text-[8px] font-bold px-3 py-1.5 rounded-full border border-indigo-500/10";
    span.textContent = "PE FL BROKEN";
    container.appendChild(span);
  }
}

async function deleteTrade(id, date) {
  if(!confirm('Delete record from ' + date + '?\nThis cannot be undone.')) return;
  try {
    await getObsTradesRef().doc(id).delete();
    if(editingTradeId === id) cancelEdit();
    await loadObsTrades();
    alert("✅ Record deleted.");
  } catch(e) {
    console.error("Delete error:", e.message);
    alert("Error deleting: " + e.message);
  }
}

function closeModal() {
  const modal = document.getElementById('tradeModal');
  const content = document.getElementById('modalContent');
  if(!modal || !content) return;
  
  content.classList.remove('scale-100', 'opacity-100');
  content.classList.add('scale-95', 'opacity-0');
  setTimeout(() => {
    modal.classList.add('hidden');
  }, 200);
}

function viewImage(src) { openTradeModalByImage(src); }

function openTradeModalByImage(src) {
    const t = obsTrades.find(x => x.chart === src);
    if (t) openTradeModal(t.id);
}

// Chart Handling
function handleFile(e) {
  const file = e.target.files[0];
  if(!file) return;
  const reader = new FileReader();
  reader.onload = (ev) => {
    chartData = ev.target.result;
    const img = document.getElementById('chart-img');
    const ph = document.getElementById('chart-ph');
    img.src = chartData;
    img.classList.remove('hidden');
    ph.classList.add('hidden');
  };
  reader.readAsDataURL(file);
}

document.addEventListener('paste', (e) => {
  const items = (e.clipboardData || e.originalEvent.clipboardData).items;
  for(let i=0; i<items.length; i++) {
    if(items[i].type.indexOf("image") !== -1) {
      const blob = items[i].getAsFile();
      const reader = new FileReader();
      reader.onload = (ev) => {
        chartData = ev.target.result;
        const img = document.getElementById('chart-img');
        const ph = document.getElementById('chart-ph');
        img.src = chartData;
        img.classList.remove('hidden');
        ph.classList.add('hidden');
      };
      reader.readAsDataURL(blob);
    }
  }
});

function editTrade(id) {
  const t = obsTrades.find(x => x.id === id);
  if(!t) return;

  editingTradeId = id;
  
  // 1. Populate Setup
  if(t.setup.includes("SP SYNC")) switchSetup(1);
  else switchSetup(2);

  // 2. Populate Normal Fields
  document.getElementById('date').value = t.date;
  document.getElementById('entryTime').value = t.entryTime || "";
  document.getElementById('exitTime').value = t.exitTime || "";
  document.getElementById('direction').value = t.direction;
  document.getElementById('entry').value = t.entry;
  document.getElementById('sl').value = t.sl;
  document.getElementById('result').value = t.result;
  
  chartData = t.chart;
  if (chartData) {
      document.getElementById('chart-img').src = chartData;
      document.getElementById('chart-img').classList.remove('hidden');
      document.getElementById('chart-ph').classList.add('hidden');
  }

  // 3. Populate Checklist Objects
  checklist = { ...t.checklist };

  // 4. Update UI Button States (Force logical refresh)
  const allBtns = [
    {type: 'index_trend', id: 'btn-index-green', val: 'green', color: 'green'},
    {type: 'index_trend', id: 'btn-index-red', val: 'red', color: 'red'},
    {type: 'sp_ce', id: 'btn-sp-ce', val: true, color: 'green'},
    {type: 'sp_pe', id: 'btn-sp-pe', val: true, color: 'green'},
    {type: 'ce_fl', id: 'btn-ce-tap', val: 'tap', color: 'yellow'},
    {type: 'ce_fl', id: 'btn-ce-break', val: 'break', color: 'blue'},
    {type: 'pe_fl', id: 'btn-pe-tap', val: 'tap', color: 'yellow'},
    {type: 'pe_fl', id: 'btn-pe-break', val: 'break', color: 'blue'},
    {type: 'ce_close', id: 'btn-ce-close', val: true, color: 'green'},
    {type: 'pe_close', id: 'btn-pe-close', val: true, color: 'green'},
    {type: 's2_sweep_ce', id: 'btn-s2-sweep-ce', val: true, color: 'green'},
    {type: 's2_sweep_pe', id: 'btn-s2-sweep-pe', val: true, color: 'green'},
    {type: 's2_break_ce', id: 'btn-s2-break-ce', val: true, color: 'blue'},
    {type: 's2_break_pe', id: 'btn-s2-break-pe', val: true, color: 'blue'},
    {type: 's2_div', id: 'btn-s2-div', val: true, color: 'green'},
    {type: 's2_exec', id: 'btn-s2-exec', val: true, color: 'green'}
  ];

  const classMap = { green: 'bg-green-600', yellow: 'bg-yellow-600', blue: 'bg-blue-600', red: 'bg-red-600' };

  allBtns.forEach(b => {
      const el = document.getElementById(b.id);
      if(!el) return;
      
      const isActive = checklist[b.type] === b.val;
      if(isActive) {
          el.classList.remove('bg-gray-700');
          el.classList.add(classMap[b.color], 'text-white');
      } else {
          el.classList.remove(classMap[b.color], 'text-white');
          el.classList.add('bg-gray-700');
      }
  });

  // 5. Update UI State
  updateRR();
  updateStepperUI();
  
  // 6. Show Cancel/Update UX
  document.getElementById('btn-cancel-edit').classList.remove('hidden');
  document.getElementById('btn-final-save').innerHTML = `<span class="text-2xl">📝</span> UPDATE RECORD`;
  document.getElementById('btn-final-save').scrollIntoView({ behavior: 'smooth', block: 'center' });
}
