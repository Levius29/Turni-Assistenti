// UI / DOM / PDF. Estratto da index.html.
import {
  ASSISTANTS, ASSISTANT_NAMES, LEGACY_TEMPLATES, SHIFT_MIN_SPAN, SLOT, STUDIO_CLOSE, STUDIO_OPEN, addDays, applyPreviousWeekState, buildEquityLedger, countsAsAfternoon, createEmptyWeek, dayCloseMin, dayOpenMin, diversifyTimes, fmt, formatDateShort, formatWeekRange, generateWeek, getAllowedShifts, getAssistantStats, getCurrentMonday, getLockedShiftCount, getShift, inOvertime, isOff, regenerateAlternativeWithFeedback, regenerateCleanWeekWithFeedback, regenerateWeekWithFeedback, updateShiftWithFeedback, validateWeek, weekAssignmentSig,
  defaultStaffConfig, defaultSecretaryConfig, getStaffConfig, reconfigure,
  weekToCSV, summarizePeriod, summaryToCSV, monthBounds,
  effectiveWeeklyHours
} from './scheduler.js';

  // Escape HTML per i valori inseriti dall'utente (nomi assistenti) interpolati in innerHTML.
  const escHtml=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  // Colore identificativo per assistente (palette tenue in linea col tema), deterministico sull'ordine.
  const STAFF_PALETTE=['#2f6b5c','#a85f33','#4f63a8','#7d4fa8','#2f6b8a','#a84f6f','#5f8a2f'];
  // Offset di palette per roster: le segretarie non ricevono gli stessi colori delle assistenti.
  const staffColor=name=>{const i=ASSISTANT_NAMES.indexOf(name);const off=activeRoster==='segretarie'?3:0;return STAFF_PALETTE[((i>=0?i:0)+off)%STAFF_PALETTE.length];};
  // Data di oggi in ISO locale (niente UTC: a mezzanotte cambierebbe giorno sbagliato).
  const todayISO=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;};

  // ── STORAGE & ROSTER (due tabelle indipendenti: assistenti e segretarie) ──
  // Stesso motore turni per entrambe: il cambio tabella è reconfigure() + swap di `weeks`.
  const ROSTERS={
    assistenti:{label:'Assistenti',weeksKey:'turni-assistenti.weeks.v1',staffKey:'turni-assistenti.staff.v1',defaults:defaultStaffConfig},
    segretarie:{label:'Segretarie',weeksKey:'turni-segretarie.weeks.v1',staffKey:'turni-segretarie.staff.v1',defaults:defaultSecretaryConfig},
  };
  const rosterStoreKey='turni-assistenti.roster';
  let activeRoster=ROSTERS[localStorage.getItem(rosterStoreKey)]?localStorage.getItem(rosterStoreKey):'assistenti';
  const roster=()=>ROSTERS[activeRoster];
  const otherRosterId=()=>activeRoster==='assistenti'?'segretarie':'assistenti';
  function loadStaffFor(id){try{const s=JSON.parse(localStorage.getItem(ROSTERS[id].staffKey));if(s&&Object.keys(s).length)return s;}catch{}return ROSTERS[id].defaults();}
  function loadWeeksFor(id){try{return JSON.parse(localStorage.getItem(ROSTERS[id].weeksKey))??{};}catch{return{};}}
  const backupKey='turni-assistenti.lastBackup';
  const MOBILE_BREAKPOINT=1180; // sotto questa larghezza la griglia va in verticale (layout impilato)
  // Carica il team del roster attivo PRIMA di generare qualsiasi settimana.
  reconfigure(loadStaffFor(activeRoster));
  function saveStaff(){const json=JSON.stringify(getStaffConfig());if(localStorage.getItem(roster().staffKey)===json)return;localStorage.setItem(roster().staffKey,json);markChanged();}
  let weeks=loadWeeks();
  let currentStart=getCurrentMonday();
  // Chiede al browser di marcare lo storage come persistente: protegge i dati dalla
  // cancellazione automatica per inattività/pressione di spazio (best effort, iOS incluso).
  navigator.storage?.persist?.().catch(()=>{});
  let selectedDayKey='mon';
  // Ledger equità dalle ultime 8 settimane PASSATE salvate (le future non sono storico).
  function buildLedgerFromStorage(){return buildEquityLedger(Object.entries(weeks).filter(([s])=>s<currentStart).map(([,w])=>w),8);}
  // Festività e sabato aperto/chiuso valgono per lo studio: alla creazione di una settimana
  // si ereditano dall'altra tabella (orari del giorno, eventi, note e assenze restano separati).
  function studioFactsSeed(start){
    const other=loadWeeksFor(otherRosterId())[start];
    if(!other?.days)return null;
    return{days:other.days.map(d=>({key:d.key,exceptions:{holiday:!!d.exceptions?.holiday,satOpen:!!d.exceptions?.satOpen},absences:{},locks:{},assignments:{}}))};
  }
  // Rinomina persone in tutte le settimane salvate del roster attivo: turni, blocchi e assenze
  // seguono il nuovo nome (prima una rinomina nel Team rendeva orfani tutti i dati storici).
  function renameInWeeks(map){
    for(const wk of Object.values(weeks)){
      for(const d of wk.days||[]){
        for(const[o,n]of Object.entries(map)){
          if(d.assignments&&o in d.assignments&&!(n in d.assignments)){d.assignments[n]=d.assignments[o];delete d.assignments[o];}
          if(d.locks&&o in d.locks&&!(n in d.locks)){d.locks[n]=d.locks[o];delete d.locks[o];}
          if(d.absences&&o in d.absences){d.absences[n]=d.absences[o];delete d.absences[o];}
        }
      }
    }
  }
  // Riflette festività/sabato del giorno modificato sulla settimana salvata dell'altra tabella.
  function mirrorStudioFacts(day){
    const oid=otherRosterId(),other=loadWeeksFor(oid),wk=other[currentStart];
    if(!wk?.days)return;
    const od=wk.days.find(d=>d.date===day.date);
    if(!od)return;
    od.exceptions={...od.exceptions,holiday:!!day.exceptions.holiday,satOpen:!!day.exceptions.satOpen};
    if(od.exceptions.holiday)for(const n of Object.keys(od.assignments||{})){od.assignments[n]='OFF';if(od.locks)od.locks[n]=false;}
    localStorage.setItem(ROSTERS[oid].weeksKey,JSON.stringify(other));
    markChanged();
  }
  if(!weeks[currentStart])weeks[currentStart]=generateWeek({startDate:currentStart,previousWeek:studioFactsSeed(currentStart),ledger:buildLedgerFromStorage()});
  saveWeeks();

  // ── DOM REFS ──
  const scheduleGrid=document.querySelector('#scheduleGrid');
  const weekLabel=document.querySelector('#weekLabel');
  const weekLabelMob=document.querySelector('#weekLabelMob');
  const summaryDiv=document.querySelector('#summary');
  const warningsDiv=document.querySelector('#warnings');
  const dayEditorDiv=document.querySelector('#dayEditor');
  const statusMsg=document.querySelector('#statusMessage');

  // ── BLOCCO DOPPIO-TAP-ZOOM (iOS) ──
  // touch-action:manipulation in CSS non basta ovunque su Safari: il secondo tap ravvicinato
  // su elementi non interattivi viene annullato qui. Il pinch-zoom resta disponibile.
  let _lastTouchEnd=0;
  document.addEventListener('touchend',e=>{
    const now=Date.now();
    if(now-_lastTouchEnd<350&&!e.target.closest('select,input,textarea,button,label,a'))e.preventDefault();
    _lastTouchEnd=now;
  },{passive:false});

  // ── UNDO (un livello) per le operazioni che riscrivono la settimana ──
  let _undo=null;
  function snapshotUndo(){if(weeks[currentStart])_undo={start:currentStart,week:structuredClone(weeks[currentStart])};}
  function undoLast(){
    if(!_undo)return;
    weeks[_undo.start]=_undo.week;currentStart=_undo.start;_undo=null;
    resetAltHistory();saveWeeks();render();showStatus('Versione precedente ripristinata.');
  }
  const UNDO_ACTION={label:'Annulla',fn:undoLast};

  // ── EVENT LISTENERS ──
  // Mostra subito lo status e rimanda il solve sincrono al tick successivo, così l'UI ridisegna prima del blocco.
  function deferHeavy(label,job){showStatus(label);setTimeout(job,0);}
  const doGenerate=()=>deferHeavy('Calcolo turni…',()=>{resetAltHistory();snapshotUndo();const r=regenerateWeekWithFeedback(currentStart,getCurrentWeek(),buildLedgerFromStorage());weeks[currentStart]=r.week;saveWeeks();showStatus(r.message,UNDO_ACTION);render();});
  const doReset=()=>deferHeavy('Calcolo turni…',()=>{resetAltHistory();snapshotUndo();const r=regenerateCleanWeekWithFeedback(currentStart,buildLedgerFromStorage());weeks[currentStart]=r.week;saveWeeks();showStatus(r.message,UNDO_ACTION);render();});
  // Varia gli orari mantenendo identici turni/statistiche (alternative mescolate: ogni pressione un layout diverso).
  const doVary=()=>deferHeavy('Vario gli orari…',()=>{snapshotUndo();weeks[currentStart]=diversifyTimes(getCurrentWeek(),Math.random);saveWeeks();showStatus('Orari variati (stessi turni e ore).',UNDO_ACTION);render();});
  document.querySelector('#prevWeek').addEventListener('click',()=>changeWeek(-7));
  document.querySelector('#nextWeek').addEventListener('click',()=>changeWeek(7));
  weekLabel.title='Torna alla settimana corrente';weekLabel.addEventListener('click',goToToday);
  weekLabelMob.title='Torna alla settimana corrente';weekLabelMob.addEventListener('click',goToToday);
  document.querySelector('#generateWeek').addEventListener('click',doGenerate);
  document.querySelector('#altWeek').addEventListener('click',requestAlternative);
  document.querySelector('#varyTimes').addEventListener('click',doVary);
  document.querySelector('#resetWeek').addEventListener('click',doReset);
  document.querySelector('#printWeek').addEventListener('click',()=>window.print());
  document.querySelector('#exportPDF').addEventListener('click',exportPDF);
  document.querySelector('#prevWeekMob').addEventListener('click',()=>changeWeek(-7));
  document.querySelector('#nextWeekMob').addEventListener('click',()=>changeWeek(7));
  document.querySelector('#generateWeekMob').addEventListener('click',doGenerate);
  document.querySelector('#altWeekMob').addEventListener('click',requestAlternative);
  document.querySelector('#resetWeekMob').addEventListener('click',doReset);
  document.querySelector('#exportPDFMob').addEventListener('click',exportPDF);

  let _altHistory=[],_altStart=null;
  function resetAltHistory(){_altHistory=[];_altStart=null;}
  function requestAlternative(){
    deferHeavy('Cerco alternativa…',()=>{
      if(_altStart!==currentStart){_altHistory=[];_altStart=currentStart;}
      const cur=getCurrentWeek();
      _altHistory.push(weekAssignmentSig(cur));
      const avoid=new Set(_altHistory);
      const r=regenerateAlternativeWithFeedback(currentStart,cur,avoid,buildLedgerFromStorage());
      if(r.solved){snapshotUndo();weeks[currentStart]=r.week;saveWeeks();showStatus(r.message,UNDO_ACTION);render();return;}
      // Wrap: nessuna nuova → torna alla prima soluzione del ciclo
      _altHistory=[];
      const r2=regenerateAlternativeWithFeedback(currentStart,cur,null,buildLedgerFromStorage());
      if(r2.solved){snapshotUndo();weeks[currentStart]=r2.week;saveWeeks();showStatus('Ciclo completato — tornata alla prima soluzione.',UNDO_ACTION);render();}
      else{showStatus('Nessuna soluzione alternativa disponibile.');}
    });
  }

  // ── CAMBIO TABELLA (Assistenti ⇄ Segretarie) ──
  function switchRoster(id){
    if(id===activeRoster||!ROSTERS[id])return;
    saveWeeks(); // flush della tabella corrente
    activeRoster=id;localStorage.setItem(rosterStoreKey,id);
    reconfigure(loadStaffFor(id));
    weeks=loadWeeksFor(id);
    resetAltHistory();_undo=null;
    updateRosterTabs();
    if(!weeks[currentStart]){
      const s=currentStart;
      deferHeavy('Calcolo turni…',()=>{
        if(activeRoster===id&&!weeks[s]){weeks[s]=generateWeek({startDate:s,previousWeek:studioFactsSeed(s),ledger:buildLedgerFromStorage()});saveWeeks();}
        if(activeRoster===id&&currentStart===s)render();
      });
      return;
    }
    render();
  }
  function buildRosterTabs(){
    const board=document.querySelector('.board');
    const tabs=document.createElement('div');tabs.className='roster-tabs';tabs.id='rosterTabs';
    for(const id of Object.keys(ROSTERS)){
      const b=document.createElement('button');b.type='button';b.dataset.roster=id;b.textContent=ROSTERS[id].label;
      b.addEventListener('click',()=>switchRoster(id));
      tabs.appendChild(b);
    }
    board.insertBefore(tabs,board.firstChild);
    updateRosterTabs();
  }
  function updateRosterTabs(){document.querySelectorAll('#rosterTabs button').forEach(b=>b.classList.toggle('active',b.dataset.roster===activeRoster));}
  // Swipe orizzontale sulla griglia (solo layout verticale mobile) per passare all'altra tabella.
  let _swX=null,_swY=null;
  scheduleGrid.addEventListener('touchstart',e=>{if(e.touches.length===1){_swX=e.touches[0].clientX;_swY=e.touches[0].clientY;}else{_swX=null;}},{passive:true});
  scheduleGrid.addEventListener('touchend',e=>{
    if(_swX==null||!scheduleGrid.classList.contains('mobile-mode'))return;
    const t=e.changedTouches[0],dx=t.clientX-_swX,dy=t.clientY-_swY;_swX=null;
    if(Math.abs(dx)>60&&Math.abs(dy)<40)switchRoster(otherRosterId());
  },{passive:true});

  // ── NIGHT MODE ──
  // Senza preferenza salvata segue il tema di sistema (e i suoi cambi); il toggle esplicito la fissa.
  const themeKey='turni-assistenti.theme';
  const _systemDark=window.matchMedia?.('(prefers-color-scheme: dark)');
  const _storedTheme=localStorage.getItem(themeKey);
  let darkMode=_storedTheme?_storedTheme==='dark':!!_systemDark?.matches;
  applyTheme();
  _systemDark?.addEventListener?.('change',e=>{if(!localStorage.getItem(themeKey)){darkMode=e.matches;applyTheme();render();}});
  function applyTheme(){
    document.body?.classList.toggle('dark',darkMode);
    const m=document.querySelector('meta[name="theme-color"]');
    if(m)m.content=darkMode?'#161b19':'#faf7f2';
  }
  function toggleTheme(){darkMode=!darkMode;localStorage.setItem(themeKey,darkMode?'dark':'light');applyTheme();render();}
  const SUN_SVG='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>';
  const MOON_SVG='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>';
  function buildThemeToggle(){const btn=document.createElement('button');btn.type='button';btn.className='theme-toggle';btn.title=darkMode?'Modalità chiara':'Modalità scura (night mode)';btn.innerHTML=darkMode?SUN_SVG:MOON_SVG;btn.addEventListener('click',toggleTheme);return btn;}

  // Resize: re-render immediato quando si attraversa il breakpoint (desktop ⇄ verticale),
  // altrimenti ridisegno debounced della sola griglia.
  let resizeTimer,_wasMobile=window.innerWidth<MOBILE_BREAKPOINT;
  window.addEventListener('resize',()=>{
    const m=window.innerWidth<MOBILE_BREAKPOINT;
    if(m!==_wasMobile){_wasMobile=m;render();return;}
    clearTimeout(resizeTimer);resizeTimer=setTimeout(()=>renderGrid(getCurrentWeek()),150);
  });

  // ── TEAM EDITOR ──
  const TEAM_ICON='<svg class="icon-svg" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M17 20h5v-2a4 4 0 0 0-3-3.87M9 20H4v-2a4 4 0 0 1 3-3.87m6-1.13a4 4 0 1 0 0-8 4 4 0 0 0 0 8z"/></svg>';
  function injectTeamButtons(){
    const wc=document.querySelector('.week-controls');
    if(wc&&!document.querySelector('#teamBtn')){const b=document.createElement('button');b.type='button';b.id='teamBtn';b.title='Team & contratti';b.innerHTML=TEAM_ICON+' Team';b.addEventListener('click',openTeamEditor);wc.insertBefore(b,wc.firstChild);}
    const bb=document.querySelector('.bottom-bar');
    if(bb&&!document.querySelector('#teamBtnMob')){const b=document.createElement('button');b.type='button';b.id='teamBtnMob';b.className='bb-nav';b.title='Team & contratti';b.setAttribute('aria-label','Team');b.innerHTML=TEAM_ICON;b.addEventListener('click',openTeamEditor);bb.insertBefore(b,bb.firstChild);}
  }
  function openTeamEditor(){
    const overlay=document.createElement('div');overlay.className='modal-overlay';
    const card=document.createElement('div');card.className='modal-card';
    card.innerHTML=`<div class="modal-head"><h2>Team &amp; contratti — ${roster().label}</h2><button class="modal-x" type="button" aria-label="Chiudi">✕</button></div><div class="team-rows"></div><div class="modal-err" hidden></div><div class="modal-foot"><button type="button" class="btn-add">+ Persona</button><div class="modal-actions"><button type="button" class="btn-cancel">Annulla</button><button type="button" class="btn-save">Salva</button></div></div>`;
    overlay.appendChild(card);document.body.appendChild(overlay);
    const rowsBox=card.querySelector('.team-rows'),errBox=card.querySelector('.modal-err');
    // orig = nome alla apertura del modale: serve a riconoscere le rinomine e migrare i dati salvati.
    let rows=Object.entries(structuredClone(getStaffConfig())).map(([name,c])=>({name,orig:name,c}));
    const esc=s=>String(s).replace(/"/g,'&quot;');
    function renderRows(){
      rowsBox.innerHTML='';
      rows.forEach((row,i)=>{const c=row.c;const el=document.createElement('div');el.className='team-row';
        el.innerHTML=`<div class="team-row-top"><input class="field t-name" value="${esc(row.name)}" data-i="${i}" data-k="name" placeholder="Nome"><button class="t-del" type="button" data-i="${i}" title="Rimuovi">✕</button></div>
          <div class="t-grid">
            <label class="t-field">Ore/sett<input class="field" type="number" min="0" step="0.5" value="${c.weeklyHours}" data-i="${i}" data-k="weeklyHours"></label>
            <label class="t-field">Pom. min<input class="field" type="number" min="0" value="${c.minAfternoons}" data-i="${i}" data-k="minAfternoons"></label>
            <label class="t-field">Pom. max<input class="field" type="number" min="0" value="${c.maxAfternoons}" data-i="${i}" data-k="maxAfternoons"></label>
            <label class="t-field" title="Un turno conta come pomeriggio per questa persona se finisce DOPO quest'ora">Pom. dopo<input class="field" type="time" step="1800" value="${fmt(c.afternoonThresholdMin??960)}" data-i="${i}" data-k="afternoonThresholdMin"></label>
            <label class="t-field t-check" title="Può fare turni lunghi: presenza ≥7h30 fino a tutta la giornata (08:30-19:00 = 10h pagate), pausa 30 min inclusa"><input type="checkbox" ${c.canWorkLong?'checked':''} data-i="${i}" data-k="canWorkLong">Turni lunghi</label>
            <label class="t-field t-long-max"${c.canWorkLong?'':' hidden'} title="Quante lunghe al massimo a settimana (vuoto = nessun limite); oltre il limite serve lo straordinario">Lunghe max<input class="field" type="number" min="0" value="${c.maxLongShifts??''}" data-i="${i}" data-k="maxLongShifts"></label>
          </div>`;
        const pf=c.preferences||{};
        el.innerHTML+=`
          <div class="t-grid t-prefs">
            <label class="t-field">Libero pref.<select class="field" data-i="${i}" data-k="preferredDayOff">
              <option value=""${!pf.preferredDayOff?' selected':''}>—</option>
              ${['mon','tue','wed','thu','fri'].map((k,j)=>`<option value="${k}"${pf.preferredDayOff===k?' selected':''}>${['Lun','Mar','Mer','Gio','Ven'][j]}</option>`).join('')}
            </select></label>
            <label class="t-field">Finestra pref.<select class="field" data-i="${i}" data-k="preferredWindow">
              <option value=""${!pf.preferredWindow?' selected':''}>—</option>
              <option value="early"${pf.preferredWindow==='early'?' selected':''}>Presto</option>
              <option value="late"${pf.preferredWindow==='late'?' selected':''}>Tardi</option>
              <option value="morning"${pf.preferredWindow==='morning'?' selected':''}>Mattina</option>
              <option value="afternoon"${pf.preferredWindow==='afternoon'?' selected':''}>Pomeriggio</option>
            </select></label>
            <label class="t-field t-check"><input type="checkbox" ${pf.avoidClose?'checked':''} data-i="${i}" data-k="avoidClose">Evita chiusura</label>
            <label class="t-field t-check"><input type="checkbox" ${pf.avoidOpen?'checked':''} data-i="${i}" data-k="avoidOpen">Evita apertura</label>
            <label class="t-field" title="Numero di chiusure 19:00 preferito a settimana (il solver lo favorisce)">Chius. pref.<input class="field" type="number" min="0" value="${c.closePref?.preferred??''}" data-i="${i}" data-k="closePrefPreferred"></label>
            <label class="t-field" title="Tetto massimo di chiusure 19:00 a settimana (vuoto = nessuna preferenza)">Chius. max<input class="field" type="number" min="0" value="${c.closePref?.max??''}" data-i="${i}" data-k="closePrefMax"></label>
          </div>`;
        const ot=c.overtime,otOn=!!ot,req=ot?.requiresShift,otHide=otOn?'':' hidden';
        el.innerHTML+=`
          <div class="t-grid t-ot" title="Straordinario: ore/pomeriggi extra ammessi quando servono per coprire la settimana">
            <label class="t-field t-check"><input type="checkbox" ${otOn?'checked':''} data-i="${i}" data-k="otEnabled">Straordinario</label>
            <label class="t-field t-ot-detail"${otHide}>Ore max<input class="field" type="number" min="0" step="0.5" value="${otOn?ot.weeklyHours:''}" ${otOn?'':'disabled'} data-i="${i}" data-k="otHours"></label>
            <label class="t-field t-ot-detail"${otHide}>Pom. max<input class="field" type="number" min="0" value="${otOn?ot.maxAfternoons:''}" ${otOn?'':'disabled'} data-i="${i}" data-k="otAfternoons"></label>
            <label class="t-field t-ot-detail"${otHide} title="Lunghe ammesse in straordinario (vuoto = come il limite base)">Lunghe max<input class="field" type="number" min="0" value="${otOn&&ot.maxLongShifts!=null?ot.maxLongShifts:''}" ${otOn?'':'disabled'} data-i="${i}" data-k="otLongShifts"></label>
            <label class="t-field t-ot-detail"${otHide} title="Se impostato, i pomeriggi extra (oltre il max base) devono usare ESATTAMENTE questo turno (es. 15:00-19:00)">Pom. extra da<input class="field" type="time" step="1800" value="${req?fmt(req.s):''}" ${otOn?'':'disabled'} data-i="${i}" data-k="otReqStart"></label>
            <label class="t-field t-ot-detail"${otHide}>a<input class="field" type="time" step="1800" value="${req?fmt(req.e):''}" ${otOn?'':'disabled'} data-i="${i}" data-k="otReqEnd"></label>
          </div>`;
        rowsBox.appendChild(el);});
    }
    function onFieldChange(t){const i=+t.dataset.i,k=t.dataset.k;if(Number.isNaN(i)||!k)return;
      if(k==='name')rows[i].name=t.value;
      else if(k==='canWorkLong'){rows[i].c.canWorkLong=t.checked;const lm=t.closest('.team-row').querySelector('.t-long-max');if(lm){lm.hidden=!t.checked;if(!t.checked){lm.querySelector('input').value='';delete rows[i].c.maxLongShifts;}}}
      else if(k==='maxLongShifts'){const v=t.value===''?null:parseInt(t.value,10);if(v==null)delete rows[i].c.maxLongShifts;else rows[i].c.maxLongShifts=v;}
      else if(k==='closePrefPreferred'||k==='closePrefMax'){const cc=rows[i].c,v=t.value===''?null:parseInt(t.value,10),key=k==='closePrefPreferred'?'preferred':'max',cp={...(cc.closePref||{})};if(v==null)delete cp[key];else cp[key]=v;if(cp.preferred==null&&cp.max==null)delete cc.closePref;else cc.closePref=cp;}
      else if(k==='otLongShifts'){if(rows[i].c.overtime){const v=t.value===''?null:parseInt(t.value,10);if(v==null)delete rows[i].c.overtime.maxLongShifts;else rows[i].c.overtime.maxLongShifts=v;}}
      else if(k==='afternoonThresholdMin'){const[h,mm]=t.value.split(':').map(Number);if(!Number.isNaN(h))rows[i].c.afternoonThresholdMin=h*60+(mm||0);}
      else if(k==='preferredDayOff'||k==='preferredWindow'){rows[i].c.preferences={...(rows[i].c.preferences||{}),[k]:t.value||undefined};}
      else if(k==='avoidClose'||k==='avoidOpen'){rows[i].c.preferences={...(rows[i].c.preferences||{}),[k]:t.checked};}
      else if(k==='otEnabled'){const cc=rows[i].c,row=t.closest('.team-row'),oh=row.querySelector('input[data-k="otHours"]'),oa=row.querySelector('input[data-k="otAfternoons"]'),ol=row.querySelector('input[data-k="otLongShifts"]'),or=row.querySelector('input[data-k="otReqStart"]'),oe=row.querySelector('input[data-k="otReqEnd"]');row.querySelectorAll('.t-ot-detail').forEach(l=>{l.hidden=!t.checked;});if(t.checked){cc.overtime={weeklyHours:cc.overtime?.weeklyHours??(cc.weeklyHours+4),maxAfternoons:cc.overtime?.maxAfternoons??(cc.maxAfternoons+1),...(cc.overtime?.maxLongShifts!=null?{maxLongShifts:cc.overtime.maxLongShifts}:{}),...(cc.overtime?.requiresShift?{requiresShift:cc.overtime.requiresShift}:{})};oh.value=cc.overtime.weeklyHours;oh.disabled=false;oa.value=cc.overtime.maxAfternoons;oa.disabled=false;ol.value=cc.overtime.maxLongShifts??'';ol.disabled=false;or.disabled=false;oe.disabled=false;}else{delete cc.overtime;oh.value='';oh.disabled=true;oa.value='';oa.disabled=true;ol.value='';ol.disabled=true;or.value='';or.disabled=true;oe.value='';oe.disabled=true;}}
      else if(k==='otHours'){if(rows[i].c.overtime)rows[i].c.overtime.weeklyHours=parseFloat(t.value);}
      else if(k==='otAfternoons'){if(rows[i].c.overtime)rows[i].c.overtime.maxAfternoons=parseInt(t.value,10);}
      else if(k==='otReqStart'||k==='otReqEnd'){const cc=rows[i].c;if(cc.overtime){const row=t.closest('.team-row'),toMin=v=>{const[h,mm]=String(v).split(':').map(Number);return Number.isNaN(h)?null:h*60+(mm||0);},s=toMin(row.querySelector('input[data-k="otReqStart"]').value),e=toMin(row.querySelector('input[data-k="otReqEnd"]').value);if(s!=null&&e!=null&&e>s)cc.overtime.requiresShift={s,e};else delete cc.overtime.requiresShift;}}
      else rows[i].c[k]=k==='weeklyHours'?parseFloat(t.value):parseInt(t.value,10);}
    rowsBox.addEventListener('input',e=>onFieldChange(e.target));
    rowsBox.addEventListener('change',e=>onFieldChange(e.target));
    rowsBox.addEventListener('click',e=>{const del=e.target.closest('.t-del');if(!del)return;rows.splice(+del.dataset.i,1);renderRows();});
    card.querySelector('.btn-add').addEventListener('click',()=>{const pr=Math.max(0,...rows.map(r=>r.c.escalationPriority??0))+1;rows.push({name:'',orig:null,c:{weeklyHours:25,minAfternoons:1,maxAfternoons:2,canWorkLong:false,maxWorkDays:5,afternoonThresholdMin:960,escalationPriority:pr,preferences:{}}});renderRows();});
    const close=()=>{overlay.classList.remove('visible');setTimeout(()=>overlay.remove(),200);};
    const showErr=m=>{errBox.textContent=m;errBox.hidden=false;};
    card.querySelector('.modal-x').addEventListener('click',close);
    card.querySelector('.btn-cancel').addEventListener('click',close);
    overlay.addEventListener('click',e=>{if(e.target===overlay)close();});
    card.querySelector('.btn-save').addEventListener('click',()=>{
      errBox.hidden=true;
      const names=rows.map(r=>r.name.trim());
      if(rows.length<1)return showErr('Serve almeno una persona.');
      if(names.some(n=>!n))return showErr('Ogni persona deve avere un nome.');
      if(new Set(names).size!==names.length)return showErr('Nomi duplicati.');
      const newCfg={};
      for(const r of rows){const c=r.c;
        if(!Number.isFinite(c.weeklyHours)||!(c.weeklyHours>0))return showErr(`${r.name}: ore settimanali non valide.`);
        if(!Number.isInteger(c.minAfternoons)||c.minAfternoons<0)return showErr(`${r.name}: pomeriggi min non validi.`);
        if(!Number.isInteger(c.maxAfternoons)||c.maxAfternoons<0)return showErr(`${r.name}: pomeriggi max non validi.`);
        if(c.minAfternoons>c.maxAfternoons)return showErr(`${r.name}: pomeriggi min > max.`);
        if(c.maxLongShifts!=null&&(!Number.isInteger(c.maxLongShifts)||c.maxLongShifts<0))return showErr(`${r.name}: lunghe max non valide.`);
        if(c.closePref&&(!Number.isInteger(c.closePref.preferred??c.closePref.max)||!Number.isInteger(c.closePref.max??c.closePref.preferred)||(c.closePref.preferred??0)<0||(c.closePref.max??c.closePref.preferred)<(c.closePref.preferred??0)))return showErr(`${r.name}: chiusure pref/max non valide (pref ≤ max).`);
        if(c.overtime){
          if(!Number.isFinite(c.overtime.weeklyHours)||c.overtime.weeklyHours<c.weeklyHours)return showErr(`${r.name}: ore straordinario non valide (devono essere ≥ ore base).`);
          if(!Number.isInteger(c.overtime.maxAfternoons)||c.overtime.maxAfternoons<c.maxAfternoons)return showErr(`${r.name}: pomeriggi straordinario non validi (devono essere ≥ pomeriggi max base).`);
          if(c.overtime.maxLongShifts!=null&&(!Number.isInteger(c.overtime.maxLongShifts)||c.overtime.maxLongShifts<0||(c.maxLongShifts!=null&&c.overtime.maxLongShifts<c.maxLongShifts)))return showErr(`${r.name}: lunghe straordinario non valide (devono essere ≥ lunghe base).`);
        }
        const cleaned={...c,weeklyHours:c.weeklyHours,minAfternoons:c.minAfternoons,maxAfternoons:c.maxAfternoons,canWorkLong:!!c.canWorkLong};
        // closePref con un solo campo compilato: completa con l'altro; lunghe max solo se può fare le lunghe.
        if(cleaned.closePref)cleaned.closePref={preferred:cleaned.closePref.preferred??cleaned.closePref.max,max:cleaned.closePref.max??cleaned.closePref.preferred};
        if(!cleaned.canWorkLong)delete cleaned.maxLongShifts;
        newCfg[r.name.trim()]=cleaned;
      }
      // Rinomine: migra turni/blocchi/assenze in TUTTE le settimane salvate (niente dati orfani).
      const renames={};
      for(const r of rows){const nn=r.name.trim();if(r.orig&&r.orig!==nn&&nn in newCfg)renames[r.orig]=nn;}
      if(Object.keys(renames).length)renameInWeeks(renames);
      reconfigure(newCfg);saveStaff();
      // Rigenera la settimana corrente PRESERVANDO eccezioni, orari, assenze e turni bloccati,
      // con possibilità di Annulla (prima il salvataggio azzerava l'intera impostazione settimanale).
      snapshotUndo();
      const r=regenerateWeekWithFeedback(currentStart,getCurrentWeek(),buildLedgerFromStorage());
      weeks[currentStart]=r.week;saveWeeks();
      close();render();showStatus(`Team aggiornato. ${r.message}`,UNDO_ACTION);
    });
    renderRows();
    requestAnimationFrame(()=>overlay.classList.add('visible'));
  }
  injectTeamButtons();

  // ── DATI & STRUMENTI (Fase 5): CSV, riepilogo mensile, backup/ripristino ──
  const TOOLS_ICON='<svg class="icon-svg" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M4 6h16M4 12h16M4 18h16M8 4v4M16 10v4M11 16v4"/></svg>';
  function injectToolsButton(){
    const wc=document.querySelector('.week-controls');
    if(wc&&!document.querySelector('#toolsBtn')){const b=document.createElement('button');b.type='button';b.id='toolsBtn';b.title='Dati & strumenti';b.innerHTML=TOOLS_ICON+' Dati';b.addEventListener('click',openToolsMenu);wc.appendChild(b);}
    const bb=document.querySelector('.bottom-bar');
    if(bb&&!document.querySelector('#toolsBtnMob')){const b=document.createElement('button');b.type='button';b.id='toolsBtnMob';b.className='bb-nav';b.title='Dati & strumenti';b.setAttribute('aria-label','Dati');b.innerHTML=TOOLS_ICON;b.addEventListener('click',openToolsMenu);bb.appendChild(b);}
  }
  function downloadFile(filename,content,mime){
    const blob=new Blob([content],{type:mime});const url=URL.createObjectURL(blob);
    const a=document.createElement('a');a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  function exportCSV(){
    const week=getCurrentWeek();
    downloadFile(`turni-${activeRoster}-${week.startDate}.csv`,'﻿'+weekToCSV(week),'text/csv;charset=utf-8;');
    showStatus(`CSV ${roster().label} esportato!`);
  }
  function exportBackup(){
    const data={app:'turni-assistenti',version:2,exportedAt:new Date().toISOString(),
      weeks:loadWeeksFor('assistenti'),staff:JSON.parse(localStorage.getItem(ROSTERS.assistenti.staffKey)||'null'),
      secWeeks:loadWeeksFor('segretarie'),secStaff:JSON.parse(localStorage.getItem(ROSTERS.segretarie.staffKey)||'null'),
      theme:localStorage.getItem(themeKey)||null};
    downloadFile(`backup-turni-${new Date().toISOString().slice(0,10)}.json`,JSON.stringify(data,null,2),'application/json');
    localStorage.setItem(backupKey,String(Date.now()));
    showStatus('Backup esportato!');
  }
  function importBackup(file){
    const reader=new FileReader();
    reader.onload=()=>{
      try{
        const data=JSON.parse(reader.result);
        if(!data||typeof data!=='object'||!('weeks'in data))throw new Error('manca il campo "weeks"');
        if(!confirm('Ripristinare il backup? I dati attuali (team e settimane) verranno sostituiti.'))return;
        localStorage.setItem(ROSTERS.assistenti.weeksKey,JSON.stringify(data.weeks||{}));
        if(data.staff)localStorage.setItem(ROSTERS.assistenti.staffKey,JSON.stringify(data.staff));
        if(data.secWeeks)localStorage.setItem(ROSTERS.segretarie.weeksKey,JSON.stringify(data.secWeeks));
        if(data.secStaff)localStorage.setItem(ROSTERS.segretarie.staffKey,JSON.stringify(data.secStaff));
        if(data.theme)localStorage.setItem(themeKey,data.theme);
        localStorage.setItem(changeKey,String(Date.now())); // il ripristino conta come modifica → verrà sincronizzato
        showStatus('Backup ripristinato. Ricarico…');
        setTimeout(()=>location.reload(),600);
      }catch(e){showStatus('Backup non valido: '+e.message);}
    };
    reader.readAsText(file);
  }
  // ── SINCRONIZZAZIONE CLOUD (GitHub) ──
  // I dati (team + settimane) vivono come file JSON in un repo GitHub via Contents API:
  // stessa memoria da qualsiasi dispositivo. Conflitti: vince l'updatedAt più recente.
  // Pull all'avvio/ritorno in foreground/ritorno online; push debounced dopo ogni modifica.
  const syncKey='turni-assistenti.sync.v1';
  const changeKey='turni-assistenti.lastChangeAt';
  function getSyncCfg(){try{return JSON.parse(localStorage.getItem(syncKey));}catch{return null;}}
  function saveSyncCfg(c){localStorage.setItem(syncKey,JSON.stringify(c));}
  function markChanged(){localStorage.setItem(changeKey,String(Date.now()));scheduleSyncPush();}
  // Base64 di stringhe UTF-8 (a blocchi: niente stack overflow su payload grandi).
  function b64encode(str){const bytes=new TextEncoder().encode(str);let bin='';for(let i=0;i<bytes.length;i+=0x8000)bin+=String.fromCharCode(...bytes.subarray(i,i+0x8000));return btoa(bin);}
  function b64decode(b64){const bin=atob(String(b64).replace(/\s/g,''));const bytes=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)bytes[i]=bin.charCodeAt(i);return new TextDecoder().decode(bytes);}
  function ghContentsUrl(c){return `https://api.github.com/repos/${c.owner}/${c.repo}/contents/${c.path}`;}
  function ghHeaders(c){return{Authorization:`Bearer ${c.token}`,Accept:'application/vnd.github+json'};}
  function buildSyncPayload(){return{app:'turni-assistenti',version:2,updatedAt:+localStorage.getItem(changeKey)||Date.now(),
    weeks:loadWeeksFor('assistenti'),staff:JSON.parse(localStorage.getItem(ROSTERS.assistenti.staffKey)||'null'),
    secWeeks:loadWeeksFor('segretarie'),secStaff:JSON.parse(localStorage.getItem(ROSTERS.segretarie.staffKey)||'null'),
    theme:localStorage.getItem(themeKey)||null};}
  function applySyncPayload(p){
    localStorage.setItem(ROSTERS.assistenti.weeksKey,JSON.stringify(p.weeks||{}));
    if(p.staff)localStorage.setItem(ROSTERS.assistenti.staffKey,JSON.stringify(p.staff));
    if(p.secWeeks)localStorage.setItem(ROSTERS.segretarie.weeksKey,JSON.stringify(p.secWeeks));
    if(p.secStaff)localStorage.setItem(ROSTERS.segretarie.staffKey,JSON.stringify(p.secStaff));
    if(p.theme)localStorage.setItem(themeKey,p.theme);
    localStorage.setItem(changeKey,String(p.updatedAt||Date.now()));
    reconfigure(loadStaffFor(activeRoster));
    weeks=loadWeeksFor(activeRoster);
    if(!weeks[currentStart]){weeks[currentStart]=generateWeek({startDate:currentStart,previousWeek:studioFactsSeed(currentStart),ledger:buildLedgerFromStorage()});saveWeeks();}
    render();
  }
  let _syncTimer=null,_syncBusy=false;
  function scheduleSyncPush(){const c=getSyncCfg();if(!c?.enabled)return;clearTimeout(_syncTimer);_syncTimer=setTimeout(()=>syncNow(true),3000);}
  // quiet=true (push automatici): toast solo per eventi che l'utente deve sapere (pull dal cloud, errori).
  async function syncNow(quiet){
    const c=getSyncCfg();
    if(!c?.enabled||!c.token||!c.owner||!c.repo){if(!quiet)showStatus('⚠ Sincronizzazione non configurata.');return;}
    if(_syncBusy)return;_syncBusy=true;
    try{
      const localTs=+localStorage.getItem(changeKey)||0;
      const res=await fetch(`${ghContentsUrl(c)}?ref=${encodeURIComponent(c.branch)}&t=${Date.now()}`,{cache:'no-store',headers:ghHeaders(c)});
      let remote=null,sha=null;
      if(res.status===200){const j=await res.json();sha=j.sha;try{remote=JSON.parse(b64decode(j.content||''));}catch{}}
      else if(res.status===401||res.status===403){showStatus('⚠ Sync: token non valido o senza permessi sul repo.');return;}
      else if(res.status!==404){showStatus(`⚠ Sync: errore GitHub (${res.status}).`);return;}
      const remoteTs=remote?.updatedAt||0;
      if(remote&&remoteTs>localTs){
        applySyncPayload(remote);
        saveSyncCfg({...c,lastSyncAt:Date.now()});
        showStatus('☁ Dati aggiornati dal cloud.');
        return;
      }
      if(!remote||localTs>remoteTs){
        const put=await fetch(ghContentsUrl(c),{method:'PUT',headers:{...ghHeaders(c),'Content-Type':'application/json'},body:JSON.stringify({message:`sync turni ${new Date().toISOString()}`,content:b64encode(JSON.stringify(buildSyncPayload())),branch:c.branch,...(sha?{sha}:{})})});
        if(!put.ok){
          // Conflitto (un altro dispositivo ha appena scritto): riprova tra poco ripartendo dal GET.
          if(put.status===409||put.status===422){_syncBusy=false;scheduleSyncPush();return;}
          showStatus(`⚠ Sync: salvataggio fallito (${put.status}).`);return;
        }
        saveSyncCfg({...c,lastSyncAt:Date.now()});
        if(!quiet)showStatus('☁ Dati salvati nel cloud.');
        return;
      }
      saveSyncCfg({...c,lastSyncAt:Date.now()});
      if(!quiet)showStatus('☁ Già sincronizzato.');
    }catch(e){if(!quiet)showStatus('⚠ Sync: rete non disponibile.');}
    finally{_syncBusy=false;}
  }
  function openSyncSettings(){
    const c=getSyncCfg()||{token:'',owner:'Levius29',repo:'Turni-Assistenti',branch:'main',path:'data/turni-sync.json',enabled:false,lastSyncAt:0};
    const overlay=document.createElement('div');overlay.className='modal-overlay';
    const card=document.createElement('div');card.className='modal-card tools-card';
    card.innerHTML=`<div class="modal-head"><h2>Sincronizzazione cloud</h2><button class="modal-x" type="button" aria-label="Chiudi">✕</button></div>
      <div class="month-body">
        <p class="eq-note">I dati (team + settimane) vengono salvati in un file JSON su un repo GitHub: la stessa memoria su ogni dispositivo, ovunque. Serve un <a href="https://github.com/settings/personal-access-tokens/new" target="_blank" rel="noopener">token fine-grained</a> con accesso al solo repo scelto e permesso <strong>Contents: Read and write</strong>.</p>
        <p class="eq-note sync-warn">⚠ Se il repo è pubblico, i turni sono leggibili da chiunque: per i dati è preferibile un repo privato dedicato.</p>
        <div class="t-grid">
          <label class="t-field" style="grid-column:1/-1">Token<input class="field" type="password" id="syToken" value="${escHtml(c.token)}" placeholder="github_pat_…" autocomplete="off"></label>
          <label class="t-field">Proprietario<input class="field" id="syOwner" value="${escHtml(c.owner)}"></label>
          <label class="t-field">Repo<input class="field" id="syRepo" value="${escHtml(c.repo)}"></label>
          <label class="t-field">Branch<input class="field" id="syBranch" value="${escHtml(c.branch)}"></label>
          <label class="t-field">File<input class="field" id="syPath" value="${escHtml(c.path)}"></label>
          <label class="t-field t-check" style="grid-column:1/-1"><input type="checkbox" id="syEnabled"${c.enabled?' checked':''}>Sincronizzazione attiva</label>
        </div>
        <p class="eq-note">${c.lastSyncAt?`Ultima sincronizzazione: ${new Date(c.lastSyncAt).toLocaleString('it-IT')}`:'Mai sincronizzato.'}</p>
      </div>
      <div class="modal-foot"><button type="button" class="btn-add sy-now">Sincronizza ora</button><div class="modal-actions"><button type="button" class="btn-cancel">Annulla</button><button type="button" class="btn-save">Salva</button></div></div>`;
    overlay.appendChild(card);document.body.appendChild(overlay);
    const close=()=>{overlay.classList.remove('visible');setTimeout(()=>overlay.remove(),200);};
    const collect=()=>({...c,token:card.querySelector('#syToken').value.trim(),owner:card.querySelector('#syOwner').value.trim(),repo:card.querySelector('#syRepo').value.trim(),branch:card.querySelector('#syBranch').value.trim()||'main',path:card.querySelector('#syPath').value.trim()||'data/turni-sync.json',enabled:card.querySelector('#syEnabled').checked});
    card.querySelector('.modal-x').addEventListener('click',close);
    card.querySelector('.btn-cancel').addEventListener('click',close);
    overlay.addEventListener('click',e=>{if(e.target===overlay)close();});
    card.querySelector('.btn-save').addEventListener('click',()=>{const n=collect();if(n.enabled&&(!n.token||!n.owner||!n.repo)){showStatus('⚠ Sync: servono token, proprietario e repo.');return;}saveSyncCfg(n);close();if(n.enabled)syncNow(false);else showStatus('Sincronizzazione disattivata.');});
    card.querySelector('.sy-now').addEventListener('click',()=>{const n=collect();if(!n.token||!n.owner||!n.repo){showStatus('⚠ Sync: servono token, proprietario e repo.');return;}n.enabled=true;saveSyncCfg(n);card.querySelector('#syEnabled').checked=true;syncNow(false);});
    requestAnimationFrame(()=>overlay.classList.add('visible'));
  }

  const MONTH_NAMES=['Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno','Luglio','Agosto','Settembre','Ottobre','Novembre','Dicembre'];
  function openMonthlySummary(){
    const cur=new Date(currentStart+'T00:00:00Z');
    let year=cur.getUTCFullYear(),month=cur.getUTCMonth()+1;
    const overlay=document.createElement('div');overlay.className='modal-overlay';
    const card=document.createElement('div');card.className='modal-card';
    card.innerHTML=`<div class="modal-head"><h2>Riepilogo mensile — ${roster().label}</h2><button class="modal-x" type="button" aria-label="Chiudi">✕</button></div>
      <div class="month-nav"><button class="mn-prev" type="button" aria-label="Mese precedente">‹</button><span class="mn-label"></span><button class="mn-next" type="button" aria-label="Mese successivo">›</button></div>
      <div class="month-body"></div>
      <div class="modal-foot"><button type="button" class="btn-add mn-csv">Esporta CSV</button><div class="modal-actions"><button type="button" class="btn-cancel mn-close">Chiudi</button></div></div>`;
    overlay.appendChild(card);document.body.appendChild(overlay);
    let lastTotals={};
    function renderMonth(){
      const{start,end}=monthBounds(year,month);
      lastTotals=summarizePeriod(Object.values(weeks),start,end);
      card.querySelector('.mn-label').textContent=`${MONTH_NAMES[month-1]} ${year}`;
      const names=Object.keys(lastTotals),hasData=names.some(n=>lastTotals[n].workDays>0);
      card.querySelector('.month-body').innerHTML=hasData
        ?`<table class="month-table"><thead><tr><th>Assistente</th><th>Ore</th><th>Giorni</th><th>Pom.</th><th>Sab</th><th>Apert.</th><th>Chius.</th><th>Lunghi</th></tr></thead><tbody>${names.map(n=>{const t=lastTotals[n];return`<tr><td class="mt-name">${escHtml(n)}</td><td>${t.hours}</td><td>${t.workDays}</td><td>${t.afternoons}</td><td>${t.saturdays}</td><td>${t.opens}</td><td>${t.closes}</td><td>${t.longShifts}</td></tr>`;}).join('')}</tbody></table>`
        :`<p class="month-empty">Nessun turno salvato per questo mese.</p>`;
    }
    const close=()=>{overlay.classList.remove('visible');setTimeout(()=>overlay.remove(),200);};
    card.querySelector('.modal-x').addEventListener('click',close);
    card.querySelector('.mn-close').addEventListener('click',close);
    overlay.addEventListener('click',e=>{if(e.target===overlay)close();});
    card.querySelector('.mn-prev').addEventListener('click',()=>{if(--month<1){month=12;year--;}renderMonth();});
    card.querySelector('.mn-next').addEventListener('click',()=>{if(++month>12){month=1;year++;}renderMonth();});
    card.querySelector('.mn-csv').addEventListener('click',()=>{downloadFile(`riepilogo-${year}-${String(month).padStart(2,'0')}.csv`,'﻿'+summaryToCSV(lastTotals),'text/csv;charset=utf-8;');showStatus('CSV riepilogo esportato!');});
    renderMonth();
    requestAnimationFrame(()=>overlay.classList.add('visible'));
  }
  function openToolsMenu(){
    const overlay=document.createElement('div');overlay.className='modal-overlay';
    const card=document.createElement('div');card.className='modal-card tools-card';
    card.innerHTML=`<div class="modal-head"><h2>Dati &amp; strumenti</h2><button class="modal-x" type="button" aria-label="Chiudi">✕</button></div>
      <div class="tools-list">
        <button type="button" class="tool-item" data-act="vary"><strong>Varia orari</strong><span>Stessi turni e ore, orari d'ingresso/uscita diversi</span></button>
        <button type="button" class="tool-item" data-act="equity"><strong>Equità storica</strong><span>Aperture, chiusure e sabati nelle ultime settimane</span></button>
        <button type="button" class="tool-item" data-act="csv"><strong>Esporta CSV</strong><span>Turni della settimana corrente per foglio di calcolo</span></button>
        <button type="button" class="tool-item" data-act="month"><strong>Riepilogo mensile</strong><span>Ore e turni per assistente in un mese</span></button>
        <button type="button" class="tool-item" data-act="sync"><strong>Sincronizzazione cloud</strong><span>Stessa memoria su tutti i dispositivi (via GitHub)</span></button>
        <button type="button" class="tool-item" data-act="backup"><strong>Backup dati</strong><span>Scarica un file JSON con team e settimane</span></button>
        <button type="button" class="tool-item" data-act="restore"><strong>Ripristina da backup</strong><span>Carica un file JSON salvato in precedenza</span></button>
      </div>`;
    overlay.appendChild(card);document.body.appendChild(overlay);
    const close=()=>{overlay.classList.remove('visible');setTimeout(()=>overlay.remove(),200);};
    card.querySelector('.modal-x').addEventListener('click',close);
    overlay.addEventListener('click',e=>{if(e.target===overlay)close();});
    card.querySelector('.tools-list').addEventListener('click',e=>{
      const item=e.target.closest('.tool-item');if(!item)return;
      const act=item.dataset.act;
      if(act==='vary'){close();doVary();}
      else if(act==='sync'){close();openSyncSettings();}
      else if(act==='equity'){close();openEquitySummary();}
      else if(act==='csv'){exportCSV();close();}
      else if(act==='month'){close();openMonthlySummary();}
      else if(act==='backup'){exportBackup();close();}
      else if(act==='restore'){
        const inp=document.createElement('input');inp.type='file';inp.accept='.json,application/json';
        inp.addEventListener('change',()=>{if(inp.files[0])importBackup(inp.files[0]);});
        inp.click();close();
      }
    });
    requestAnimationFrame(()=>overlay.classList.add('visible'));
  }
  // Equità storica: oneri (aperture/chiusure/sabati) per persona sulle ultime 8 settimane passate
  // più quella corrente, col tasso sui giorni lavorati — gli stessi numeri usati dall'ottimizzatore.
  function openEquitySummary(){
    const led=buildLedgerFromStorage();
    const cur=getAssistantStats(getCurrentWeek());
    const overlay=document.createElement('div');overlay.className='modal-overlay';
    const card=document.createElement('div');card.className='modal-card tools-card';
    const cell=(v,days)=>`<td>${v} <span class="eq-rate">${days?Math.round(100*v/days):0}%</span></td>`;
    const rows=ASSISTANT_NAMES.map(n=>{
      const l=led[n]||{opens:0,closes:0,saturdays:0,workDays:0};
      const days=l.workDays+cur[n].workDays;
      return`<tr><td class="mt-name">${escHtml(n)}</td><td>${days}</td>${cell(l.opens+cur[n].opens,days)}${cell(l.closes+cur[n].closes,days)}${cell(l.saturdays+cur[n].saturdays,days)}</tr>`;
    }).join('');
    card.innerHTML=`<div class="modal-head"><h2>Equità storica — ${roster().label}</h2><button class="modal-x" type="button" aria-label="Chiudi">✕</button></div>
      <div class="month-body"><p class="eq-note">Ultime 8 settimane salvate + settimana corrente. La percentuale è il tasso sui giorni lavorati: valori simili tra le persone = carico equo.</p>
      <table class="month-table"><thead><tr><th>Assistente</th><th>Giorni</th><th>Aperture</th><th>Chiusure</th><th>Sabati</th></tr></thead><tbody>${rows}</tbody></table></div>
      <div class="modal-foot"><span></span><div class="modal-actions"><button type="button" class="btn-cancel eq-close">Chiudi</button></div></div>`;
    overlay.appendChild(card);document.body.appendChild(overlay);
    const close=()=>{overlay.classList.remove('visible');setTimeout(()=>overlay.remove(),200);};
    card.querySelector('.modal-x').addEventListener('click',close);
    card.querySelector('.eq-close').addEventListener('click',close);
    overlay.addEventListener('click',e=>{if(e.target===overlay)close();});
    requestAnimationFrame(()=>overlay.classList.add('visible'));
  }
  injectToolsButton();
  buildRosterTabs();

  render();

  // Sync cloud: pull all'avvio, quando l'app torna in primo piano e quando torna la rete.
  if(getSyncCfg()?.enabled)syncNow(true);
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&getSyncCfg()?.enabled)syncNow(true);});
  window.addEventListener('online',()=>{if(getSyncCfg()?.enabled)syncNow(true);});

  // Promemoria backup: i dati vivono nel browser di QUESTO dispositivo — un backup JSON
  // periodico è l'assicurazione contro cancellazioni di Safari/cambio telefono.
  (function backupReminder(){
    const last=+localStorage.getItem(backupKey)||0;
    const THIRTY_DAYS=30*24*3600*1000;
    if(Object.keys(weeks).length>=4&&Date.now()-last>THIRTY_DAYS){
      setTimeout(()=>showStatus(last?'Ultimo backup più di 30 giorni fa.':'Consiglio: esporta un backup dei tuoi dati.',{label:'Backup ora',fn:exportBackup}),1500);
    }
  })();

  // ── RENDER ──
  // Chi è in straordinario questa settimana (stats passate per non riscandire la settimana per ogni cella).
  function overtimeSet(week,stats){return new Set(ASSISTANT_NAMES.filter(n=>inOvertime(n,week,stats)));}
  function render(){
    const w=getCurrentWeek();
    ensureWeekShape(w);
    const stats=getAssistantStats(w);
    const otSet=overtimeSet(w,stats);
    weekLabel.textContent=formatWeekRange(w);
    weekLabelMob.textContent=formatWeekRangeCompact(w);
    renderGrid(w,otSet);
    renderSummary(w,stats,otSet);
    renderDayEditor(w);
    renderWarnings(w);
  }

  function renderGrid(week,otSet){
    otSet=otSet??overtimeSet(week,getAssistantStats(week));
    const isMobile=window.innerWidth<MOBILE_BREAKPOINT;
    scheduleGrid.classList.toggle('mobile-mode',isMobile);
    scheduleGrid.innerHTML='';
    if(isMobile){scheduleGrid.appendChild(buildMobileGrid(week,otSet));}
    else{buildDesktopGrid(week,otSet);}
  }

  function isDayClosed(day){return!!day.exceptions?.holiday||(day.key==='sat'&&!day.exceptions?.satOpen);}
  function buildDesktopGrid(week,otSet){
    const corner=createCell('','grid-cell head-cell');corner.append(buildThemeToggle());scheduleGrid.append(corner);
    const today=todayISO();
    for(const day of week.days){
      const closed=isDayClosed(day);
      const customHours=!closed&&(day.exceptions?.openMin!=null||day.exceptions?.closeMin!=null);
      const btn=document.createElement('button');btn.type='button';btn.className='day-button';
      btn.innerHTML=`<strong>${day.label}${day.exceptions?.note?` <span class="note-dot" title="${escHtml(day.exceptions.note)}">●</span>`:''}</strong><span class="date">${formatDateShort(day.date)}${day.date===today?'<span class="today-chip">oggi</span>':''}</span>${closed?'<span class="closed-tag">'+(day.exceptions?.holiday?'Festività':'Chiuso')+'</span>':''}${customHours?`<span class="hours-tag">${fmt(dayOpenMin(day))}–${fmt(dayCloseMin(day))}</span>`:''}`;
      btn.addEventListener('click',()=>{selectedDayKey=day.key;render();});
      const cell=createCell('',`grid-cell head-cell${day.key===selectedDayKey?' selected-day':''}${closed?' day-closed':''}${day.date===today?' today-col':''}`);
      cell.append(btn);scheduleGrid.append(cell);
    }
    for(const assistant of ASSISTANT_NAMES){
      const nameCell=document.createElement('div');nameCell.className='grid-cell assistant-name-cell';
      const color=staffColor(assistant);
      nameCell.innerHTML=`<div class="assistant-card"><div class="assistant-avatar" style="background:color-mix(in srgb, ${color} 16%, transparent);color:${color}">${escHtml((assistant.trim()[0]||'?').toUpperCase())}</div><div><span class="assistant-name">${escHtml(assistant)}</span><div class="assistant-meta">${getContractLabel(assistant)}</div></div></div>`;
      scheduleGrid.append(nameCell);
      for(const day of week.days){
        const{entry,exit,badge}=buildShiftContent(day,assistant,week,otSet);
        const lock=createLockToggle(day,assistant,'');
        const print=Object.assign(document.createElement('span'),{className:'print-shift',textContent:getPrintShiftLabel(day.assignments[assistant])});
        // Due righe: riga 1 = entrata + badge (alto a destra); riga 2 = uscita + blocco (a destra).
        const grid=document.createElement('div');grid.className='shift-grid';grid.append(entry,badge,exit,lock);
        const absent=!isDayClosed(day)&&day.absences?.[assistant];
        const cell=createCell('',`grid-cell${day.key===selectedDayKey?' selected-day':''}${isDayClosed(day)?' day-closed':''}${day.locks[assistant]?' locked-cell':''}${absent?' absent-cell':''}`);
        cell.append(grid,print);scheduleGrid.append(cell);
      }
    }
  }

  function buildMobileGrid(week,otSet){
    const grid=document.createElement('div');grid.className='mobile-grid';
    // Colonne dinamiche: 1 etichetta giorno + N assistenti (evita layout rotto aggiungendo persone).
    grid.style.gridTemplateColumns=`64px repeat(${ASSISTANT_NAMES.length}, minmax(0, 1fr))`;
    const corner=Object.assign(document.createElement('div'),{className:'mobile-header-cell'});corner.append(buildThemeToggle());grid.append(corner);
    ASSISTANT_NAMES.forEach((a,i)=>{const h=Object.assign(document.createElement('div'),{className:'mobile-header-cell'+(i===ASSISTANT_NAMES.length-1?' mg-end':''),textContent:a});h.style.boxShadow=`inset 0 -2px 0 ${staffColor(a)}`;grid.append(h);});
    const today=todayISO();
    for(const day of week.days){
      const isSelected=day.key===selectedDayKey;
      const closed=isDayClosed(day);
      const dayLabel=document.createElement('div');
      dayLabel.className=`mobile-day-label${isSelected?' selected-day':''}${closed?' day-closed':''}${day.date===today?' today-col':''}`;
      const customHours=!closed&&(day.exceptions?.openMin!=null||day.exceptions?.closeMin!=null);
      dayLabel.innerHTML=`<span class="day-abbr">${day.label.slice(0,3)}${day.exceptions?.note?` <span class="note-dot" title="${escHtml(day.exceptions.note)}">●</span>`:''}</span><span class="day-date">${formatDateShort(day.date)}</span>${day.date===today?'<span class="today-chip">oggi</span>':''}${closed?'<span class="closed-tag">'+(day.exceptions?.holiday?'Festività':'Chiuso')+'</span>':''}${customHours?`<span class="hours-tag">${fmt(dayOpenMin(day))}–${fmt(dayCloseMin(day))}</span>`:''}`;
      dayLabel.addEventListener('click',()=>{selectedDayKey=day.key;render();});
      grid.append(dayLabel);
      ASSISTANT_NAMES.forEach((assistant,ci)=>{
        const absent=!closed&&day.absences?.[assistant];
        const cell=document.createElement('div');cell.className=`mobile-shift-cell${isSelected?' selected-day':''}${closed?' day-closed':''}${ci===ASSISTANT_NAMES.length-1?' mg-end':''}${day.locks[assistant]?' locked-cell':''}${absent?' absent-cell':''}`;
        const{entry,exit,badge}=buildShiftContent(day,assistant,week,otSet);
        const lock=createLockToggle(day,assistant,'');
        const print=Object.assign(document.createElement('span'),{className:'print-shift',textContent:getPrintShiftLabel(day.assignments[assistant])});
        const sgrid=document.createElement('div');sgrid.className='shift-grid';sgrid.append(entry,badge,exit,lock);
        cell.append(sgrid,print);grid.append(cell);
      });
    }
    return grid;
  }

  // Due tendine per cella: Entrata (con "Riposo") e Uscita (orari validi dato l'ingresso).
  function buildShiftContent(day,assistant,week,otSet){
    const entry=document.createElement('select');entry.className='shift-select shift-entry';
    const exit=document.createElement('select');exit.className='shift-select shift-exit';
    entry.setAttribute('aria-label',`Entrata ${assistant} ${day.label}`);
    exit.setAttribute('aria-label',`Uscita ${assistant} ${day.label}`);
    // extended=true: le tendine manuali offrono anche le giornate oltre 8h30 fino a tutta la giornata.
    const allowed=getAllowedShifts(assistant,day,true,true).filter(a=>!isOff(a));
    const starts=[...new Set(allowed.map(a=>a.s))].sort((a,b)=>a-b);
    const mkOpt=(val,txt)=>{const o=document.createElement('option');o.value=val;o.textContent=txt;return o;};
    entry.append(mkOpt('OFF','Riposo'));
    for(const s of starts)entry.append(mkOpt(String(s),fmt(s)));
    const endsFor=start=>allowed.filter(a=>a.s===start).map(a=>a.e).sort((a,b)=>a-b);
    function fillExit(start,keepEnd){
      exit.innerHTML='';const ends=endsFor(start);
      // Formato compatto "16:30·7,5h": entra nelle colonne strette di iPhone senza troncarsi.
      for(const e of ends)exit.append(mkOpt(String(e),`${fmt(e)}·${String(getShift({s:start,e}).hours).replace('.',',')}h`));
      exit.value=ends.includes(keepEnd)?String(keepEnd):String(ends[0]);
      exit.disabled=false;
    }
    const cur=getShift(day.assignments[assistant]);
    if(cur.id==='OFF'){entry.value='OFF';exit.append(mkOpt('','—'));exit.value='';exit.disabled=true;}
    else{entry.value=String(cur.startMin);fillExit(cur.startMin,cur.endMin);}
    const commit=()=>{
      const val=entry.value==='OFF'?'OFF':{s:+entry.value,e:+exit.value};
      const res=updateShiftWithFeedback(week,day.key,assistant,val);
      weeks[currentStart]=res.week;saveWeeks();showStatus(res.message);render();
    };
    entry.addEventListener('change',()=>{
      if(entry.value==='OFF'){exit.disabled=true;}else{fillExit(+entry.value,+exit.value);}
      commit();
    });
    exit.addEventListener('change',commit);
    applyShiftClass(entry,day.assignments[assistant],day);
    // Badge S sulle celle che contribuiscono allo straordinario: pomeriggi in quota o turni lunghi.
    const curSh=getShift(day.assignments[assistant]);
    const otS=otSet.has(assistant)&&(countsAsAfternoon(assistant,curSh)||curSh.isLong);
    const badge=buildShiftBadge(day.assignments[assistant],otS,day);
    const absent=!isDayClosed(day)&&day.absences?.[assistant];
    if(absent){badge.innerHTML=`<span class="badge-code" style="background:#9b6dd6">${absent==='sick'?'Malattia':'Ferie'}</span>`;entry.disabled=true;}
    return{entry,exit,badge};
  }

  function buildShiftBadge(a,showS=false,day){
    const el=document.createElement('div');el.className='shift-badge';
    updateShiftBadge(el,a,showS,day);return el;
  }
  // Badge A/C relativi all'orario del giorno (apertura/chiusura eventualmente personalizzate).
  function updateShiftBadge(el,a,showS=false,day){
    const s=getShift(a);
    if(s.id==='OFF'){el.innerHTML='';return;}
    const badges=[];
    if(s.startMin===dayOpenMin(day))badges.push('<span class="badge-code badge-a">A</span>');
    if(s.endMin===dayCloseMin(day))badges.push('<span class="badge-code badge-c">C</span>');
    if(s.isLong)badges.push('<span class="badge-code badge-l">L</span>');
    if(showS)badges.push('<span class="badge-code badge-s">S</span>');
    el.innerHTML=badges.join('');
  }
  function getShiftBadgeCodes(shift,day){return[shift.isLong?'L':'',shift.startMin===dayOpenMin(day)?'A':'',shift.endMin===dayCloseMin(day)?'C':''].filter(Boolean);}

  function createLockToggle(day,assistant,labelText){
    const label=document.createElement('label');label.className='toggle-switch';
    if(!labelText)label.title='Blocca turno';
    label.innerHTML=`<input type="checkbox"${day.locks[assistant]?' checked':''}><span class="toggle-track"></span>${labelText?`<span>${labelText}</span>`:''}`;
    label.querySelector('input').addEventListener('change',e=>{
      day.locks[assistant]=e.target.checked;saveWeeks();
      showStatus(e.target.checked?'Turno bloccato.':'Blocco rimosso.');render();
    });
    return label;
  }

  function applyShiftClass(select,a,day){
    select.classList.remove('shift-morning','shift-afternoon','shift-long','shift-midday','shift-off');
    const s=getShift(a);
    select.classList.add(s.id==='OFF'?'shift-off':s.endMin===dayCloseMin(day)?'shift-afternoon':s.startMin===dayOpenMin(day)?'shift-morning':'shift-midday');
  }

  function renderSummary(week,stats,otSet){
    stats=stats??getAssistantStats(week);
    otSet=otSet??overtimeSet(week,stats);
    const locked=getLockedShiftCount(week);
    const rows=ASSISTANT_NAMES.map(a=>{
      const c=ASSISTANTS[a];
      const overtime=otSet.has(a);
      // Target effettivo: stesse regole di validateWeek (festività riducono il monte ore pro-quota).
      const tgt=effectiveWeeklyHours(a,week,overtime?c.overtime.weeklyHours:c.weeklyHours);
      const ok=stats[a].hours===tgt;
      const pct=tgt>0?Math.min(100,stats[a].hours/tgt*100):0;
      const over=stats[a].hours>tgt;
      const otBadge=overtime?` <span class="badge-code badge-s">S</span>`:'';
      const hoursDisp=overtime?`<strong class="sum-ot-hours">${stats[a].hours}</strong>`:`${stats[a].hours}`;
      const color=staffColor(a);
      const fillStyle=over?`width:${pct}%`:`width:${pct}%;background:${color}`;
      return`<div class="sum-row"><span class="sum-name"><span class="sum-dot" style="background:${color}"></span>${escHtml(a)}</span><span class="sum-stats"><span>${hoursDisp}/${tgt}h · ${stats[a].afternoons} Pom. · ${stats[a].saturdays} Sab · ${stats[a].closes} C · ${stats[a].opens} A${otBadge}</span><span class="sum-bar"><span class="sum-bar-fill${over?' over':''}" style="${fillStyle}"></span></span></span><span class="pill ${ok?'':'warn'}">${ok?'✓':'!'}</span></div>`;
    }).join('');
    const lockInfo=locked>0?`<div class="sum-locked">${locked} blocco${locked>1?'chi':''} attivo${locked>1?'i':''}</div>`:'';
    summaryDiv.innerHTML=rows+lockInfo;
  }

  function renderDayEditor(week){
    const day=week.days.find(d=>d.key===selectedDayKey)??week.days[0];
    const isSat=day.key==='sat';
    const isHol=!!day.exceptions.holiday;
    const toggle=isSat
      ?`<label class="checkbox-inline"><input id="satOpen" type="checkbox"><span>Aperto</span></label>`
      :`<label class="checkbox-inline" title="Doppia assistente di mattina (almeno fino alle 13:30)"><input id="extraMorning" type="checkbox"><span>2× Matt.</span></label> <label class="checkbox-inline" title="Doppia assistente il pomeriggio"><input id="extraAfternoon" type="checkbox"><span>2× Pom.</span></label> <label class="checkbox-inline" title="Studio chiuso (festività): nessuno lavora, ore ridotte"><input id="holiday" type="checkbox"><span>Festività</span></label>`;
    // Assenze: solo nei giorni feriali non festivi.
    const absHtml=(!isSat&&!isHol)?`<div class="day-fields-row" style="flex-wrap:wrap;gap:6px;margin-top:8px" title="Ferie/malattia: la persona riposa quel giorno e le sue ore settimanali si riducono pro-quota">${ASSISTANT_NAMES.map(n=>`<label class="t-field" style="flex:1;min-width:88px">${escHtml(n)}<select class="field field-sm abs-sel" data-n="${escHtml(n)}"><option value="">Presente</option><option value="vacation">Ferie</option><option value="sick">Malattia</option></select></label>`).join('')}</div>`:'';
    // Orario del giorno: modificabile se lo studio è aperto (feriale non festivo, o sabato aperto).
    const hoursHtml=(!isHol&&(!isSat||day.exceptions.satOpen))?`<div class="day-fields-row" style="margin-top:6px"><label class="t-field" style="flex:1" title="A che ora apre lo studio QUESTO giorno (standard 08:30)">Apre<input id="dayOpenT" class="field field-sm" type="time" step="1800" value="${fmt(dayOpenMin(day))}"></label><label class="t-field" style="flex:1" title="A che ora chiude lo studio QUESTO giorno (standard 19:00)">Chiude<input id="dayCloseT" class="field field-sm" type="time" step="1800" value="${fmt(dayCloseMin(day))}"></label></div>`:'';
    dayEditorDiv.innerHTML=`<div class="day-label-row">${day.label} <span class="day-date">${formatDateShort(day.date)}</span>${toggle}</div><div class="day-fields-row"><select id="eventType" class="field field-sm"><option value="">Nessun evento</option><option value="chirurgia">Chirurgia</option><option value="ortodonzia">Ortodonzia</option><option value="dottore">Dottore in più</option><option value="altro">Altro</option></select></div>${hoursHtml}<div class="day-fields-row" style="margin-top:6px"><input id="dayNote" class="field field-sm" type="text" maxlength="120" placeholder="Nota del giorno (finisce sul PDF)"></div>${absHtml}`;
    const sel=dayEditorDiv.querySelector('#eventType');
    sel.value=day.exceptions.eventType;
    sel.addEventListener('change',()=>{day.exceptions.eventType=sel.value;saveWeeks();render();});
    const note=dayEditorDiv.querySelector('#dayNote');
    note.value=day.exceptions.note||'';
    note.addEventListener('change',()=>{day.exceptions.note=note.value.trim();saveWeeks();render();});
    // Orario personalizzato del giorno: minimo 4h, dentro la finestra massima 08:30-19:00 (griglia turni).
    const oI=dayEditorDiv.querySelector('#dayOpenT'),cI=dayEditorDiv.querySelector('#dayCloseT');
    if(oI&&cI){
      const toMin=v=>{const[h,m]=String(v).split(':').map(Number);return Number.isNaN(h)?null:h*60+(m||0);};
      const commitHours=()=>{
        let o=toMin(oI.value),c=toMin(cI.value);
        if(o==null||c==null){render();return;}
        o=Math.max(STUDIO_OPEN,Math.round(o/SLOT)*SLOT);c=Math.min(STUDIO_CLOSE,Math.round(c/SLOT)*SLOT);
        if(c-o<SHIFT_MIN_SPAN){showStatus('⚠ La giornata deve durare almeno 4 ore.');render();return;}
        day.exceptions.openMin=o===STUDIO_OPEN?null:o;
        day.exceptions.closeMin=c===STUDIO_CLOSE?null:c;
        // I turni non bloccati fuori dal nuovo orario tornano a riposo (poi "Genera" sistema il resto).
        for(const n of ASSISTANT_NAMES){const sh=getShift(day.assignments[n]);if(sh.hours>0&&(sh.startMin<o||sh.endMin>c)&&!day.locks[n])day.assignments[n]='OFF';}
        saveWeeks();render();
        showStatus(o===STUDIO_OPEN&&c===STUDIO_CLOSE?'Orario standard ripristinato.':`Orario del giorno: ${fmt(o)}–${fmt(c)}. Premi Genera per riorganizzare i turni.`);
      };
      oI.addEventListener('change',commitHours);cI.addEventListener('change',commitHours);
    }
    if(isSat){
      const open=dayEditorDiv.querySelector('#satOpen');open.checked=day.exceptions.satOpen;
      open.addEventListener('change',()=>{day.exceptions.satOpen=open.checked;if(!open.checked)for(const n of ASSISTANT_NAMES){day.assignments[n]='OFF';day.locks[n]=false;}saveWeeks();mirrorStudioFacts(day);render();});
    }else{
      const extra=dayEditorDiv.querySelector('#extraAfternoon');extra.checked=day.exceptions.extraAfternoon;
      extra.addEventListener('change',()=>{day.exceptions.extraAfternoon=extra.checked;saveWeeks();render();});
      const extraM=dayEditorDiv.querySelector('#extraMorning');extraM.checked=day.exceptions.extraMorning;
      extraM.addEventListener('change',()=>{day.exceptions.extraMorning=extraM.checked;saveWeeks();render();});
      const hol=dayEditorDiv.querySelector('#holiday');hol.checked=isHol;
      hol.addEventListener('change',()=>{day.exceptions.holiday=hol.checked;if(hol.checked){day.absences={};for(const n of ASSISTANT_NAMES){day.assignments[n]='OFF';day.locks[n]=false;}}saveWeeks();mirrorStudioFacts(day);render();});
      day.absences=day.absences||{};
      for(const s of dayEditorDiv.querySelectorAll('.abs-sel')){const n=s.dataset.n;s.value=day.absences[n]||'';s.addEventListener('change',()=>{if(s.value)day.absences[n]=s.value;else delete day.absences[n];if(s.value){day.assignments[n]='OFF';day.locks[n]=false;}saveWeeks();render();});}
    }
  }

  function renderWarnings(week){
    const list=validateWeek(week);
    const count=document.querySelector('#warnCount');
    if(count){count.hidden=list.length===0;count.textContent=list.length;}
    warningsDiv.innerHTML=list.length
      ?list.map(w=>`<div class="warning"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 8v4M12 16h.01M3 12a9 9 0 1 0 18 0 9 9 0 0 0-18 0z"/></svg> ${w.message}</div>`).join('')
      :`<div class="empty"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6L9 17l-5-5"/></svg> Settimana valida</div>`;
  }

  function getCurrentWeek(){if(!weeks[currentStart]){weeks[currentStart]=createEmptyWeek(currentStart);const seed=studioFactsSeed(currentStart);if(seed)applyPreviousWeekState(weeks[currentStart],seed);}ensureWeekShape(weeks[currentStart]);return weeks[currentStart];}
  function setWeek(start){
    resetAltHistory();currentStart=start;selectedDayKey='mon';
    if(!weeks[currentStart]){
      // Genera al tick successivo: lo status "Calcolo turni…" appare prima del solve sincrono.
      const s=currentStart,rid=activeRoster;
      deferHeavy('Calcolo turni…',()=>{if(activeRoster!==rid)return;weeks[s]=generateWeek({startDate:s,previousWeek:studioFactsSeed(s),ledger:buildLedgerFromStorage()});saveWeeks();if(currentStart===s)render();});
      return;
    }
    saveWeeks();render();
  }
  function changeWeek(days){setWeek(addDays(currentStart,days));}
  // Tap sull'etichetta della settimana (desktop e mobile): torna alla settimana corrente.
  function goToToday(){
    const m=getCurrentMonday();
    if(m===currentStart){showStatus('Sei già sulla settimana corrente.');return;}
    showStatus('Settimana corrente.');
    setWeek(m);
  }
  // Memoria perenne: NESSUN pruning automatico — una settimana pesa ~2-3 KB, in 5 MB di
  // localStorage ci stanno decenni di storico (riepiloghi mensili ed equità inclusi).
  // Solo se la quota si esaurisse davvero: sacrifica le settimane più vecchie senza blocchi.
  // markChanged() solo se il contenuto è cambiato davvero (evita push di sync a vuoto).
  function saveWeeks(){
    for(let attempt=0;;attempt++){
      const json=JSON.stringify(weeks);
      if(localStorage.getItem(roster().weeksKey)===json)return;
      try{localStorage.setItem(roster().weeksKey,json);markChanged();return;}
      catch(e){
        const victims=Object.keys(weeks).filter(k=>k<currentStart&&!weeks[k]?.days?.some(d=>Object.values(d.locks||{}).some(Boolean))).sort().slice(0,10);
        if(!victims.length||attempt>20){showStatus('⚠ Spazio pieno: impossibile salvare. Esporta un backup dei dati.');return;}
        for(const k of victims)delete weeks[k];
      }
    }
  }
  function loadWeeks(){return loadWeeksFor(activeRoster);}
  function createCell(html,className){const el=document.createElement('div');el.className=className;el.innerHTML=html;return el;}
  function getContractLabel(a){const c=ASSISTANTS[a];if(!c)return'';const pom=c.minAfternoons===c.maxAfternoons?`max ${c.maxAfternoons}`:`${c.minAfternoons}-${c.maxAfternoons}`;return`${c.weeklyHours}h · ${pom} pom.`;}

  let statusTimer;
  // action opzionale {label,fn}: aggiunge un pulsante (es. "Annulla") e allunga la durata del messaggio.
  function showStatus(msg,action){
    statusMsg.textContent=msg;
    // Tono di avviso quando il messaggio segnala un problema (euristica sui testi esistenti).
    statusMsg.classList.toggle('warn',/⚠|Nessuna combinazione|Nessuna soluzione|non valid/i.test(msg));
    if(action){
      const b=document.createElement('button');
      b.type='button';b.className='status-action';b.textContent=action.label;
      b.addEventListener('click',()=>{statusMsg.classList.remove('visible');statusMsg.hidden=true;action.fn();});
      statusMsg.append(' ',b);
    }
    statusMsg.hidden=false;
    void statusMsg.offsetWidth;statusMsg.classList.add('visible');
    clearTimeout(statusTimer);statusTimer=setTimeout(()=>{statusMsg.classList.remove('visible');setTimeout(()=>{statusMsg.hidden=true;},250);},action?6000:2500);
  }
  function getPrintShiftLabel(a){const s=getShift(a);return s.id==='OFF'?'Riposo':`${fmt(s.startMin)}-${fmt(s.endMin)}`;}
  // Etichetta settimana per la bottom bar: "15–20/06" (o "29/06–04/07" a cavallo di mese).
  function formatWeekRangeCompact(week){const[,am,ad]=week.days[0].date.split('-');const[,bm,bd]=week.days[week.days.length-1].date.split('-');return am===bm?`${ad}–${bd}/${bm}`:`${ad}/${am}–${bd}/${bm}`;}
  // Normalizza la forma della settimana e migra eventuali vecchi id-template (v1) verso {s,e}.
  function ensureWeekShape(week){for(const day of week.days){const hadSatOpen='satOpen'in(day.exceptions??{});day.exceptions={eventType:'',note:'',extraAfternoon:false,extraMorning:false,satOpen:false,holiday:false,openMin:null,closeMin:null,...day.exceptions};day.absences=day.absences||{};day.assignments={...Object.fromEntries(ASSISTANT_NAMES.map(n=>[n,'OFF'])),...day.assignments};day.locks={...Object.fromEntries(ASSISTANT_NAMES.map(n=>[n,false])),...day.locks};for(const n of ASSISTANT_NAMES){const a=day.assignments[n];if(typeof a==='string'&&a!=='OFF')day.assignments[n]=LEGACY_TEMPLATES[a]??'OFF';}if(day.exceptions.holiday)for(const n of ASSISTANT_NAMES){day.assignments[n]='OFF';day.locks[n]=false;}else for(const n of ASSISTANT_NAMES)if(day.absences[n]){day.assignments[n]='OFF';day.locks[n]=false;}if(day.key==='sat'&&!hadSatOpen&&ASSISTANT_NAMES.some(n=>getShift(day.assignments[n]).hours>0))day.exceptions.satOpen=true;}const satDay=week.days.find(d=>d.key==='sat');if(satDay&&!satDay.exceptions.satOpen){for(const n of ASSISTANT_NAMES)if(!satDay.locks[n])satDay.assignments[n]='OFF';}}

  // ── PDF EXPORT ──
  function getDayVariationLabel(day){
    const eventLabels={chirurgia:'Chirurgia',ortodonzia:'Ortodonzia',dottore:'Dottore in più',altro:'Altro'};
    const satLabel=day.key==='sat'?(day.exceptions.satOpen?'Aperto':'Chiuso'):'';
    const holLabel=day.exceptions.holiday?'Festività (chiuso)':'';
    const absLabel=Object.entries(day.absences||{}).filter(([,v])=>v).map(([n,v])=>`${n}: ${v==='sick'?'Malattia':'Ferie'}`).join(', ');
    const hoursLabel=(day.exceptions.openMin!=null||day.exceptions.closeMin!=null)?`Orario ${fmt(dayOpenMin(day))}–${fmt(dayCloseMin(day))}`:'';
    return[satLabel,holLabel,hoursLabel,eventLabels[day.exceptions.eventType]??day.exceptions.eventType,day.exceptions.extraAfternoon&&day.key!=='sat'?'2× Pom.':'',day.exceptions.extraMorning&&day.key!=='sat'?'2× Matt.':'',absLabel,day.exceptions.note||''].filter(Boolean).join(' · ');
  }
  function drawPdfBadge(doc,x,y,code){
    doc.setDrawColor(30,30,30);doc.setFillColor(255,255,255);doc.roundedRect(x,y,5,4,0.8,0.8,'FD');
    doc.setFont('helvetica','bold');doc.setFontSize(7);doc.setTextColor(30,30,30);doc.text(code,x+2.5,y+2.9,{align:'center'});
  }
  // Tabella settimanale di un roster nel PDF; ritorna la Y finale. Indipendente dai global
  // del roster attivo: settimana e nomi passati esplicitamente.
  function drawRosterTable(doc,week,names,title,startY){
    const M=12;
    const shiftOf=(day,name)=>{const a=day.assignments?.[name];return getShift(a&&typeof a==='object'?a:'OFF');};
    doc.setFont('helvetica','bold');doc.setFontSize(11);doc.setTextColor(30,30,30);
    doc.text(title,M,startY);
    const head=[['Giorno',...names]];
    const body=week.days.map(day=>[`${day.label}  ${formatDateShort(day.date)}${getDayVariationLabel(day)?`\n${getDayVariationLabel(day)}`:''}`,...names.map(name=>{const shift=shiftOf(day,name);return shift.id==='OFF'?'Riposo':`${shift.label}\n${shift.hours}h`;})]);
    const foot=[['Totale ore',...names.map(name=>`${week.days.reduce((h,day)=>h+shiftOf(day,name).hours,0)}h`)]];
    doc.autoTable({head,body,foot,startY:startY+2,margin:{left:M,right:M},
      headStyles:{fillColor:[45,45,45],textColor:255,fontStyle:'bold',halign:'center',fontSize:8.5,cellPadding:2.5},
      footStyles:{fillColor:[230,230,230],textColor:[30,30,30],fontStyle:'bold',halign:'center',fontSize:8.5,cellPadding:2.5,lineWidth:{top:0.6,right:0.2,bottom:0.2,left:0.2},lineColor:[80,80,80]},
      bodyStyles:{halign:'center',fontSize:10,fontStyle:'bold',cellPadding:{top:3,right:3,bottom:7,left:3},minCellHeight:13.5,textColor:[20,20,20]},
      columnStyles:{0:{halign:'left',fontStyle:'bold',fontSize:8.5,cellWidth:40,textColor:[30,30,30]}},
      alternateRowStyles:{fillColor:[247,247,247]},
      styles:{font:'helvetica',lineColor:[150,150,150],lineWidth:0.2,valign:'middle'},
      theme:'grid',
      didParseCell:data=>{
        if(data.section!=='body')return;
        const day=week.days[data.row.index];
        const closed=day.exceptions.holiday||(day.key==='sat'&&!day.exceptions.satOpen);
        if(data.column.index===0){
          if(closed){data.cell.styles.fillColor=[235,235,235];data.cell.styles.textColor=[120,120,120];}
          return;
        }
        const shift=shiftOf(day,names[data.column.index-1]);
        if(shift.id==='OFF'||closed){data.cell.styles.fillColor=[235,235,235];data.cell.styles.textColor=[120,120,120];data.cell.styles.fontStyle='italic';data.cell.styles.fontSize=9;}
      },
      didDrawCell:data=>{
        if(data.section!=='body'||data.column.index===0)return;
        const day=week.days[data.row.index];
        const shift=shiftOf(day,names[data.column.index-1]);const codes=getShiftBadgeCodes(shift,day);
        let x=data.cell.x+3;const y=data.cell.y+data.cell.height-5.5;
        for(const code of codes){drawPdfBadge(doc,x,y,code);x+=6;}
      }});
    return doc.lastAutoTable.finalY;
  }
  function exportPDF(){
    if(!window.jspdf){showStatus('Libreria PDF non ancora caricata, riprova.');return;}
    const{jsPDF}=window.jspdf;
    // Foglio SINGOLO verticale: tabella Assistenti sopra, Segretarie sotto, note se resta spazio.
    const doc=new jsPDF({orientation:'portrait',unit:'mm',format:'a4'});
    const pageW=doc.internal.pageSize.getWidth(),pageH=doc.internal.pageSize.getHeight(),M=12;
    // Il roster non attivo viene letto dal suo storage (senza turni salvati esce tutta "Riposo").
    const weekOf=id=>activeRoster===id?getCurrentWeek():(loadWeeksFor(id)[currentStart]??createEmptyWeek(currentStart));
    const namesOf=id=>activeRoster===id?[...ASSISTANT_NAMES]:Object.keys(loadStaffFor(id));
    // Intestazione minimale (stampa B/N): solo la settimana, niente titolo brand.
    doc.setFont('helvetica','bold');doc.setFontSize(13);doc.setTextColor(30,30,30);
    doc.text(`Settimana ${formatWeekRange(getCurrentWeek())}`,M,14);
    doc.setDrawColor(150,150,150);doc.setLineWidth(0.3);doc.line(M,17,pageW-M,17);
    let y=drawRosterTable(doc,weekOf('assistenti'),namesOf('assistenti'),ROSTERS.assistenti.label,23);
    y=drawRosterTable(doc,weekOf('segretarie'),namesOf('segretarie'),ROSTERS.segretarie.label,y+9);
    // Area note per scrittura a mano: riempie lo spazio residuo fino al footer.
    const footerY=pageH-8;
    const ny=y+8;
    if(ny<footerY-16){
      doc.setFont('helvetica','bold');doc.setFontSize(10);doc.setTextColor(60,60,60);
      doc.text('Note',M,ny);
      const boxY=ny+2.5,boxH=footerY-5-boxY;
      doc.setDrawColor(170,170,170);doc.setLineWidth(0.3);doc.roundedRect(M,boxY,pageW-2*M,boxH,1.5,1.5);
      doc.setDrawColor(225,225,225);doc.setLineWidth(0.2);
      for(let ly=boxY+8;ly<boxY+boxH-3;ly+=8)doc.line(M+3,ly,pageW-M-3,ly);
    }
    // Footer: data di generazione + numero pagina (singolo foglio nei casi normali).
    const now=new Date();
    const gen=`Generato il ${String(now.getDate()).padStart(2,'0')}/${String(now.getMonth()+1).padStart(2,'0')}/${now.getFullYear()} ${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
    const pages=doc.internal.getNumberOfPages();
    for(let i=1;i<=pages;i++){doc.setPage(i);doc.setFont('helvetica','normal');doc.setFontSize(8);doc.setTextColor(130,130,130);doc.text(gen,M,footerY);doc.text(`Pag. ${i}/${pages}`,pageW-M,footerY,{align:'right'});}
    doc.save(`turni-${currentStart}.pdf`);
    showStatus('PDF esportato: un foglio con Assistenti + Segretarie!');
  }
