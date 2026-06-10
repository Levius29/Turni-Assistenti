// UI / DOM / PDF. Estratto da index.html.
import {
  AFTERNOON_END_THRESHOLD, AFTERNOON_TIERS, ASSISTANTS, ASSISTANT_NAMES, BASE_PAIRS, LEGACY_TEMPLATES, LONG_SPAN, LUNCH_GAP_MAX, SHIFT_MAX_SPAN, SHIFT_MIN_SPAN, SHIFT_OFF, SLOT, SOLVE_BUDGET_FAST, SOLVE_BUDGET_FULL, STUDIO_CLOSE, STUDIO_OPEN, WEEKDAY_KEYS, WEEK_DAYS, _shiftCache, addDays, afternoonDemand, applyPreviousWeekState, assign, buildEquityLedger, buildRem, buildWeekFromDayAssignments, cloneStats, countsAsAfternoon, coverageDeficit, coverageOf, createBaseWeek, createEmptyWeek, deriveShift, diversifyTimes, fmt, formatDateShort, formatItalianDate, formatWeekRange, formatWeekRangeShort, generateWeek, getAllowedShifts, getAssistantStats, getCoverage, getCurrentMonday, getDayCombos, getLockedShiftCount, getRequiredCoverage, getShift, heuristicCombos, inOvertime, isManuelaClose1519, isOff, maxUncoveredGap, regenerateAlternativeWithFeedback, regenerateCleanWeekWithFeedback, regenerateWeekWithFeedback, shiftsOf, solveWeek, solveWeekCore, updateShiftWithFeedback, validateWeek, weekAssignmentSig,
  defaultStaffConfig, getStaffConfig, reconfigure,
  weekToCSV, summarizePeriod, summaryToCSV, monthBounds,
  effectiveWeeklyHours
} from './scheduler.js';

  // Escape HTML per i valori inseriti dall'utente (nomi assistenti) interpolati in innerHTML.
  const escHtml=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  // ── STORAGE ──
  const storageKey='turni-assistenti.weeks.v1';
  const staffKey='turni-assistenti.staff.v1';
  const MOBILE_BREAKPOINT=1180; // sotto questa larghezza la griglia va in verticale (layout impilato)
  // Carica il team salvato (se presente) PRIMA di generare qualsiasi settimana.
  (function loadStaffConfig(){try{const s=JSON.parse(localStorage.getItem(staffKey));if(s&&Object.keys(s).length)reconfigure(s);}catch{}})();
  function saveStaff(){localStorage.setItem(staffKey,JSON.stringify(getStaffConfig()));}
  let weeks=loadWeeks();
  let currentStart=getCurrentMonday();
  let selectedDayKey='mon';
  // Ledger equità dalle ultime 8 settimane PASSATE salvate (le future non sono storico).
  function buildLedgerFromStorage(){return buildEquityLedger(Object.entries(weeks).filter(([s])=>s<currentStart).map(([,w])=>w),8);}
  if(!weeks[currentStart])weeks[currentStart]=generateWeek({startDate:currentStart,ledger:buildLedgerFromStorage()});
  saveWeeks();

  // ── DOM REFS ──
  const scheduleGrid=document.querySelector('#scheduleGrid');
  const weekLabel=document.querySelector('#weekLabel');
  const weekLabelMob=document.querySelector('#weekLabelMob');
  const summaryDiv=document.querySelector('#summary');
  const warningsDiv=document.querySelector('#warnings');
  const dayEditorDiv=document.querySelector('#dayEditor');
  const statusMsg=document.querySelector('#statusMessage');

  // ── EVENT LISTENERS ──
  // Mostra subito lo status e rimanda il solve sincrono al tick successivo, così l'UI ridisegna prima del blocco.
  function deferHeavy(label,job){showStatus(label);setTimeout(job,0);}
  const doGenerate=()=>deferHeavy('Calcolo turni…',()=>{resetAltHistory();const r=regenerateWeekWithFeedback(currentStart,getCurrentWeek(),buildLedgerFromStorage());weeks[currentStart]=r.week;saveWeeks();showStatus(r.message);render();});
  const doReset=()=>deferHeavy('Calcolo turni…',()=>{resetAltHistory();const r=regenerateCleanWeekWithFeedback(currentStart,buildLedgerFromStorage());weeks[currentStart]=r.week;saveWeeks();showStatus(r.message);render();});
  document.querySelector('#prevWeek').addEventListener('click',()=>changeWeek(-7));
  document.querySelector('#nextWeek').addEventListener('click',()=>changeWeek(7));
  document.querySelector('#generateWeek').addEventListener('click',doGenerate);
  document.querySelector('#altWeek').addEventListener('click',requestAlternative);
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
      if(r.solved){weeks[currentStart]=r.week;saveWeeks();showStatus(r.message);render();return;}
      // Wrap: nessuna nuova → torna alla prima soluzione del ciclo
      _altHistory=[];
      const r2=regenerateAlternativeWithFeedback(currentStart,cur,null,buildLedgerFromStorage());
      if(r2.solved){weeks[currentStart]=r2.week;saveWeeks();showStatus('Ciclo completato — tornata alla prima soluzione.');render();}
      else{showStatus('Nessuna soluzione alternativa disponibile.');}
    });
  }

  // ── NIGHT MODE ──
  const themeKey='turni-assistenti.theme';
  let darkMode=localStorage.getItem(themeKey)==='dark';
  applyTheme();
  function applyTheme(){document.body?.classList.toggle('dark',darkMode);}
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
    card.innerHTML=`<div class="modal-head"><h2>Team &amp; contratti</h2><button class="modal-x" type="button" aria-label="Chiudi">✕</button></div><div class="team-rows"></div><div class="modal-err" hidden></div><div class="modal-foot"><button type="button" class="btn-add">+ Persona</button><div class="modal-actions"><button type="button" class="btn-cancel">Annulla</button><button type="button" class="btn-save">Salva</button></div></div>`;
    overlay.appendChild(card);document.body.appendChild(overlay);
    const rowsBox=card.querySelector('.team-rows'),errBox=card.querySelector('.modal-err');
    let rows=Object.entries(structuredClone(getStaffConfig())).map(([name,c])=>({name,c}));
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
            <label class="t-field t-check"><input type="checkbox" ${c.canWorkLong?'checked':''} data-i="${i}" data-k="canWorkLong">Turni lunghi</label>
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
          </div>`;
        const ot=c.overtime,otOn=!!ot,req=ot?.requiresShift,otHide=otOn?'':' hidden';
        el.innerHTML+=`
          <div class="t-grid t-ot" title="Straordinario: ore/pomeriggi extra ammessi quando servono per coprire la settimana">
            <label class="t-field t-check"><input type="checkbox" ${otOn?'checked':''} data-i="${i}" data-k="otEnabled">Straordinario</label>
            <label class="t-field t-ot-detail"${otHide}>Ore max<input class="field" type="number" min="0" step="0.5" value="${otOn?ot.weeklyHours:''}" ${otOn?'':'disabled'} data-i="${i}" data-k="otHours"></label>
            <label class="t-field t-ot-detail"${otHide}>Pom. max<input class="field" type="number" min="0" value="${otOn?ot.maxAfternoons:''}" ${otOn?'':'disabled'} data-i="${i}" data-k="otAfternoons"></label>
            <label class="t-field t-ot-detail"${otHide} title="Se impostato, i pomeriggi extra (oltre il max base) devono usare ESATTAMENTE questo turno (es. 15:00-19:00)">Pom. extra da<input class="field" type="time" step="1800" value="${req?fmt(req.s):''}" ${otOn?'':'disabled'} data-i="${i}" data-k="otReqStart"></label>
            <label class="t-field t-ot-detail"${otHide}>a<input class="field" type="time" step="1800" value="${req?fmt(req.e):''}" ${otOn?'':'disabled'} data-i="${i}" data-k="otReqEnd"></label>
          </div>`;
        rowsBox.appendChild(el);});
    }
    function onFieldChange(t){const i=+t.dataset.i,k=t.dataset.k;if(Number.isNaN(i)||!k)return;
      if(k==='name')rows[i].name=t.value;
      else if(k==='canWorkLong')rows[i].c.canWorkLong=t.checked;
      else if(k==='afternoonThresholdMin'){const[h,mm]=t.value.split(':').map(Number);if(!Number.isNaN(h))rows[i].c.afternoonThresholdMin=h*60+(mm||0);}
      else if(k==='preferredDayOff'||k==='preferredWindow'){rows[i].c.preferences={...(rows[i].c.preferences||{}),[k]:t.value||undefined};}
      else if(k==='avoidClose'||k==='avoidOpen'){rows[i].c.preferences={...(rows[i].c.preferences||{}),[k]:t.checked};}
      else if(k==='otEnabled'){const cc=rows[i].c,row=t.closest('.team-row'),oh=row.querySelector('input[data-k="otHours"]'),oa=row.querySelector('input[data-k="otAfternoons"]'),or=row.querySelector('input[data-k="otReqStart"]'),oe=row.querySelector('input[data-k="otReqEnd"]');row.querySelectorAll('.t-ot-detail').forEach(l=>{l.hidden=!t.checked;});if(t.checked){cc.overtime={weeklyHours:cc.overtime?.weeklyHours??(cc.weeklyHours+4),maxAfternoons:cc.overtime?.maxAfternoons??(cc.maxAfternoons+1),...(cc.overtime?.requiresShift?{requiresShift:cc.overtime.requiresShift}:{})};oh.value=cc.overtime.weeklyHours;oh.disabled=false;oa.value=cc.overtime.maxAfternoons;oa.disabled=false;or.disabled=false;oe.disabled=false;}else{delete cc.overtime;oh.value='';oh.disabled=true;oa.value='';oa.disabled=true;or.value='';or.disabled=true;oe.value='';oe.disabled=true;}}
      else if(k==='otHours'){if(rows[i].c.overtime)rows[i].c.overtime.weeklyHours=parseFloat(t.value);}
      else if(k==='otAfternoons'){if(rows[i].c.overtime)rows[i].c.overtime.maxAfternoons=parseInt(t.value,10);}
      else if(k==='otReqStart'||k==='otReqEnd'){const cc=rows[i].c;if(cc.overtime){const row=t.closest('.team-row'),toMin=v=>{const[h,mm]=String(v).split(':').map(Number);return Number.isNaN(h)?null:h*60+(mm||0);},s=toMin(row.querySelector('input[data-k="otReqStart"]').value),e=toMin(row.querySelector('input[data-k="otReqEnd"]').value);if(s!=null&&e!=null&&e>s)cc.overtime.requiresShift={s,e};else delete cc.overtime.requiresShift;}}
      else rows[i].c[k]=k==='weeklyHours'?parseFloat(t.value):parseInt(t.value,10);}
    rowsBox.addEventListener('input',e=>onFieldChange(e.target));
    rowsBox.addEventListener('change',e=>onFieldChange(e.target));
    rowsBox.addEventListener('click',e=>{const del=e.target.closest('.t-del');if(!del)return;rows.splice(+del.dataset.i,1);renderRows();});
    card.querySelector('.btn-add').addEventListener('click',()=>{const pr=Math.max(0,...rows.map(r=>r.c.escalationPriority??0))+1;rows.push({name:'',c:{weeklyHours:25,minAfternoons:1,maxAfternoons:2,canWorkLong:false,maxWorkDays:5,afternoonThresholdMin:960,escalationPriority:pr,preferences:{}}});renderRows();});
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
        if(c.overtime){
          if(!Number.isFinite(c.overtime.weeklyHours)||c.overtime.weeklyHours<c.weeklyHours)return showErr(`${r.name}: ore straordinario non valide (devono essere ≥ ore base).`);
          if(!Number.isInteger(c.overtime.maxAfternoons)||c.overtime.maxAfternoons<c.maxAfternoons)return showErr(`${r.name}: pomeriggi straordinario non validi (devono essere ≥ pomeriggi max base).`);
        }
        newCfg[r.name.trim()]={...c,weeklyHours:c.weeklyHours,minAfternoons:c.minAfternoons,maxAfternoons:c.maxAfternoons,canWorkLong:!!c.canWorkLong};
      }
      reconfigure(newCfg);saveStaff();
      weeks[currentStart]=generateWeek({startDate:currentStart,ledger:buildLedgerFromStorage()});saveWeeks();
      close();render();showStatus('Team aggiornato.');
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
    downloadFile(`turni-${week.startDate}.csv`,'﻿'+weekToCSV(week),'text/csv;charset=utf-8;');
    showStatus('CSV esportato!');
  }
  function exportBackup(){
    const data={app:'turni-assistenti',version:1,exportedAt:new Date().toISOString(),
      weeks:loadWeeks(),staff:JSON.parse(localStorage.getItem(staffKey)||'null'),theme:localStorage.getItem(themeKey)||null};
    downloadFile(`backup-turni-${new Date().toISOString().slice(0,10)}.json`,JSON.stringify(data,null,2),'application/json');
    showStatus('Backup esportato!');
  }
  function importBackup(file){
    const reader=new FileReader();
    reader.onload=()=>{
      try{
        const data=JSON.parse(reader.result);
        if(!data||typeof data!=='object'||!('weeks'in data))throw new Error('manca il campo "weeks"');
        if(!confirm('Ripristinare il backup? I dati attuali (team e settimane) verranno sostituiti.'))return;
        localStorage.setItem(storageKey,JSON.stringify(data.weeks||{}));
        if(data.staff)localStorage.setItem(staffKey,JSON.stringify(data.staff));
        if(data.theme)localStorage.setItem(themeKey,data.theme);
        showStatus('Backup ripristinato. Ricarico…');
        setTimeout(()=>location.reload(),600);
      }catch(e){showStatus('Backup non valido: '+e.message);}
    };
    reader.readAsText(file);
  }
  const MONTH_NAMES=['Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno','Luglio','Agosto','Settembre','Ottobre','Novembre','Dicembre'];
  function openMonthlySummary(){
    const cur=new Date(currentStart+'T00:00:00Z');
    let year=cur.getUTCFullYear(),month=cur.getUTCMonth()+1;
    const overlay=document.createElement('div');overlay.className='modal-overlay';
    const card=document.createElement('div');card.className='modal-card';
    card.innerHTML=`<div class="modal-head"><h2>Riepilogo mensile</h2><button class="modal-x" type="button" aria-label="Chiudi">✕</button></div>
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
        <button type="button" class="tool-item" data-act="csv"><strong>Esporta CSV</strong><span>Turni della settimana corrente per foglio di calcolo</span></button>
        <button type="button" class="tool-item" data-act="month"><strong>Riepilogo mensile</strong><span>Ore e turni per assistente in un mese</span></button>
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
      if(act==='csv'){exportCSV();close();}
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
  injectToolsButton();

  render();

  // ── RENDER ──
  function render(){
    const w=getCurrentWeek();
    ensureWeekShape(w);
    weekLabel.textContent=formatWeekRange(w);
    weekLabelMob.textContent=formatWeekRangeCompact(w);
    renderGrid(w);
    renderSummary(w);
    renderDayEditor(w);
    renderWarnings(w);
  }

  function renderGrid(week){
    const isMobile=window.innerWidth<MOBILE_BREAKPOINT;
    scheduleGrid.classList.toggle('mobile-mode',isMobile);
    scheduleGrid.innerHTML='';
    if(isMobile){scheduleGrid.appendChild(buildMobileGrid(week));}
    else{buildDesktopGrid(week);}
  }

  function isDayClosed(day){return!!day.exceptions?.holiday||(day.key==='sat'&&!day.exceptions?.satOpen);}
  function buildDesktopGrid(week){
    const corner=createCell('','grid-cell head-cell');corner.append(buildThemeToggle());scheduleGrid.append(corner);
    for(const day of week.days){
      const closed=isDayClosed(day);
      const btn=document.createElement('button');btn.type='button';btn.className='day-button';
      btn.innerHTML=`<strong>${day.label}</strong><span class="date">${formatDateShort(day.date)}</span>${closed?'<span class="closed-tag">'+(day.exceptions?.holiday?'Festività':'Chiuso')+'</span>':''}`;
      btn.addEventListener('click',()=>{selectedDayKey=day.key;render();});
      const cell=createCell('',`grid-cell head-cell${day.key===selectedDayKey?' selected-day':''}${closed?' day-closed':''}`);
      cell.append(btn);scheduleGrid.append(cell);
    }
    for(const assistant of ASSISTANT_NAMES){
      const nameCell=document.createElement('div');nameCell.className='grid-cell assistant-name-cell';
      nameCell.innerHTML=`<div class="assistant-card"><div class="assistant-avatar"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z"/></svg></div><div><span class="assistant-name">${escHtml(assistant)}</span><div class="assistant-meta">${getContractLabel(assistant)}</div></div></div>`;
      scheduleGrid.append(nameCell);
      for(const day of week.days){
        const{entry,exit,badge}=buildShiftContent(day,assistant,true,week);
        const lock=createLockToggle(day,assistant,'');
        const print=Object.assign(document.createElement('span'),{className:'print-shift',textContent:getPrintShiftLabel(day.assignments[assistant])});
        // Due righe: riga 1 = entrata + badge (alto a destra); riga 2 = uscita + blocco (a destra).
        const grid=document.createElement('div');grid.className='shift-grid';grid.append(entry,badge,exit,lock);
        const cell=createCell('',`grid-cell${day.key===selectedDayKey?' selected-day':''}${isDayClosed(day)?' day-closed':''}`);
        cell.append(grid,print);scheduleGrid.append(cell);
      }
    }
  }

  function buildMobileGrid(week){
    const grid=document.createElement('div');grid.className='mobile-grid';
    // Colonne dinamiche: 1 etichetta giorno + N assistenti (evita layout rotto aggiungendo persone).
    grid.style.gridTemplateColumns=`64px repeat(${ASSISTANT_NAMES.length}, minmax(0, 1fr))`;
    const corner=Object.assign(document.createElement('div'),{className:'mobile-header-cell'});corner.append(buildThemeToggle());grid.append(corner);
    ASSISTANT_NAMES.forEach((a,i)=>grid.append(Object.assign(document.createElement('div'),{className:'mobile-header-cell'+(i===ASSISTANT_NAMES.length-1?' mg-end':''),textContent:a})));
    for(const day of week.days){
      const isSelected=day.key===selectedDayKey;
      const closed=isDayClosed(day);
      const dayLabel=document.createElement('div');
      dayLabel.className=`mobile-day-label${isSelected?' selected-day':''}${closed?' day-closed':''}`;
      dayLabel.innerHTML=`<span class="day-abbr">${day.label.slice(0,3)}</span><span class="day-date">${formatDateShort(day.date)}</span>${closed?'<span class="closed-tag">'+(day.exceptions?.holiday?'Festività':'Chiuso')+'</span>':''}`;
      dayLabel.addEventListener('click',()=>{selectedDayKey=day.key;render();});
      grid.append(dayLabel);
      ASSISTANT_NAMES.forEach((assistant,ci)=>{
        const cell=document.createElement('div');cell.className=`mobile-shift-cell${isSelected?' selected-day':''}${closed?' day-closed':''}${ci===ASSISTANT_NAMES.length-1?' mg-end':''}`;
        const{entry,exit,badge}=buildShiftContent(day,assistant,false,week);
        const lock=createLockToggle(day,assistant,'');
        const print=Object.assign(document.createElement('span'),{className:'print-shift',textContent:getPrintShiftLabel(day.assignments[assistant])});
        const sgrid=document.createElement('div');sgrid.className='shift-grid';sgrid.append(entry,badge,exit,lock);
        cell.append(sgrid,print);grid.append(cell);
      });
    }
    return grid;
  }

  // Due tendine per cella: Entrata (con "Riposo") e Uscita (orari validi dato l'ingresso).
  function buildShiftContent(day,assistant,showId,week){
    const entry=document.createElement('select');entry.className='shift-select shift-entry';
    const exit=document.createElement('select');exit.className='shift-select shift-exit';
    const allowed=getAllowedShifts(assistant,day,true).filter(a=>!isOff(a));
    const starts=[...new Set(allowed.map(a=>a.s))].sort((a,b)=>a-b);
    const mkOpt=(val,txt)=>{const o=document.createElement('option');o.value=val;o.textContent=txt;return o;};
    entry.append(mkOpt('OFF','Riposo'));
    for(const s of starts)entry.append(mkOpt(String(s),fmt(s)));
    const endsFor=start=>allowed.filter(a=>a.s===start).map(a=>a.e).sort((a,b)=>a-b);
    function fillExit(start,keepEnd){
      exit.innerHTML='';const ends=endsFor(start);
      for(const e of ends)exit.append(mkOpt(String(e),`${fmt(e)} · ${getShift({s:start,e}).hours}h`));
      exit.value=ends.includes(keepEnd)?String(keepEnd):String(ends[0]);
      exit.disabled=false;
    }
    const cur=getShift(day.assignments[assistant]);
    if(cur.id==='OFF'){entry.value='OFF';exit.append(mkOpt('','—'));exit.value='';exit.disabled=true;}
    else{entry.value=String(cur.startMin);fillExit(cur.startMin,cur.endMin);}
    const commit=()=>{
      const val=entry.value==='OFF'?'OFF':{s:+entry.value,e:+exit.value};
      applyShiftClass(entry,val);updateShiftBadge(badge,val);
      const res=updateShiftWithFeedback(week,day.key,assistant,val);
      weeks[currentStart]=res.week;saveWeeks();showStatus(res.message);render();
    };
    entry.addEventListener('change',()=>{
      if(entry.value==='OFF'){exit.disabled=true;}else{fillExit(+entry.value,+exit.value);}
      commit();
    });
    exit.addEventListener('change',commit);
    applyShiftClass(entry,day.assignments[assistant]);
    const otS=inOvertime(assistant,week)&&countsAsAfternoon(assistant,getShift(day.assignments[assistant]));
    const badge=buildShiftBadge(day.assignments[assistant],otS);
    const absent=!isDayClosed(day)&&day.absences?.[assistant];
    if(absent){badge.innerHTML=`<span class="badge-code" style="background:#9b6dd6">${absent==='sick'?'Malattia':'Ferie'}</span>`;entry.disabled=true;}
    return{entry,exit,badge};
  }

  function buildShiftBadge(a,showS=false){
    const el=document.createElement('div');el.className='shift-badge';
    updateShiftBadge(el,a,showS);return el;
  }
  function updateShiftBadge(el,a,showS=false){
    const s=getShift(a);
    if(s.id==='OFF'){el.innerHTML='';return;}
    const badges=[];
    if(s.coversMorning)badges.push('<span class="badge-code badge-a">A</span>');
    if(s.coversClose)badges.push('<span class="badge-code badge-c">C</span>');
    if(s.isLong)badges.push('<span class="badge-code badge-l">L</span>');
    if(showS)badges.push('<span class="badge-code badge-s">S</span>');
    el.innerHTML=badges.join('');
  }
  function getShiftBadgeCodes(shift){return[shift.isLong?'L':'',shift.coversMorning?'A':'',shift.coversClose?'C':''].filter(Boolean);}

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

  function applyShiftClass(select,a){
    select.classList.remove('shift-morning','shift-afternoon','shift-long','shift-midday','shift-off');
    const s=getShift(a);
    select.classList.add(s.id==='OFF'?'shift-off':s.coversClose?'shift-afternoon':s.coversMorning?'shift-morning':'shift-midday');
  }

  function renderSummary(week){
    const stats=getAssistantStats(week);
    const locked=getLockedShiftCount(week);
    const rows=ASSISTANT_NAMES.map(a=>{
      const c=ASSISTANTS[a];
      const overtime=!!c.overtime&&(stats[a].hours>c.weeklyHours||stats[a].afternoons>c.maxAfternoons);
      // Target effettivo: stesse regole di validateWeek (festività riducono il monte ore pro-quota).
      const tgt=effectiveWeeklyHours(a,week,overtime?c.overtime.weeklyHours:c.weeklyHours);
      const ok=stats[a].hours===tgt;
      const pct=tgt>0?Math.min(100,stats[a].hours/tgt*100):0;
      const over=stats[a].hours>tgt;
      const otBadge=overtime?` <span class="badge-code badge-s">S</span>`:'';
      const hoursDisp=overtime?`<strong class="sum-ot-hours">${stats[a].hours}</strong>`:`${stats[a].hours}`;
      return`<div class="sum-row"><span class="sum-name">${escHtml(a)}</span><span class="sum-stats"><span>${hoursDisp}/${tgt}h · ${stats[a].afternoons} Pom. · ${stats[a].saturdays} Sab · ${stats[a].closes} C · ${stats[a].opens} A${otBadge}</span><span class="sum-bar"><span class="sum-bar-fill${over?' over':''}" style="width:${pct}%"></span></span></span><span class="pill ${ok?'':'warn'}">${ok?'✓':'!'}</span></div>`;
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
    const absHtml=(!isSat&&!isHol)?`<div class="day-fields-row" style="flex-wrap:wrap;gap:6px;margin-top:8px">${ASSISTANT_NAMES.map(n=>`<label class="t-field" style="flex:1;min-width:88px">${escHtml(n)}<select class="field field-sm abs-sel" data-n="${escHtml(n)}"><option value="">Presente</option><option value="vacation">Ferie</option><option value="sick">Malattia</option></select></label>`).join('')}</div>`:'';
    dayEditorDiv.innerHTML=`<div class="day-label-row">${day.label} <span class="day-date">${formatDateShort(day.date)}</span>${toggle}</div><div class="day-fields-row"><select id="eventType" class="field field-sm"><option value="">Nessun evento</option><option value="chirurgia">Chirurgia</option><option value="ortodonzia">Ortodonzia</option><option value="dottore">Dottore in più</option><option value="altro">Altro</option></select></div>${absHtml}`;
    const sel=dayEditorDiv.querySelector('#eventType');
    sel.value=day.exceptions.eventType;
    sel.addEventListener('change',()=>{day.exceptions.eventType=sel.value;saveWeeks();render();});
    if(isSat){
      const open=dayEditorDiv.querySelector('#satOpen');open.checked=day.exceptions.satOpen;
      open.addEventListener('change',()=>{day.exceptions.satOpen=open.checked;if(!open.checked)for(const n of ASSISTANT_NAMES){day.assignments[n]='OFF';day.locks[n]=false;}saveWeeks();render();});
    }else{
      const extra=dayEditorDiv.querySelector('#extraAfternoon');extra.checked=day.exceptions.extraAfternoon;
      extra.addEventListener('change',()=>{day.exceptions.extraAfternoon=extra.checked;saveWeeks();render();});
      const extraM=dayEditorDiv.querySelector('#extraMorning');extraM.checked=day.exceptions.extraMorning;
      extraM.addEventListener('change',()=>{day.exceptions.extraMorning=extraM.checked;saveWeeks();render();});
      const hol=dayEditorDiv.querySelector('#holiday');hol.checked=isHol;
      hol.addEventListener('change',()=>{day.exceptions.holiday=hol.checked;if(hol.checked){day.absences={};for(const n of ASSISTANT_NAMES){day.assignments[n]='OFF';day.locks[n]=false;}}saveWeeks();render();});
      day.absences=day.absences||{};
      for(const s of dayEditorDiv.querySelectorAll('.abs-sel')){const n=s.dataset.n;s.value=day.absences[n]||'';s.addEventListener('change',()=>{if(s.value)day.absences[n]=s.value;else delete day.absences[n];if(s.value){day.assignments[n]='OFF';day.locks[n]=false;}saveWeeks();render();});}
    }
  }

  function renderWarnings(week){
    const list=validateWeek(week);
    warningsDiv.innerHTML=list.length
      ?list.map(w=>`<div class="warning"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 8v4M12 16h.01M3 12a9 9 0 1 0 18 0 9 9 0 0 0-18 0z"/></svg> ${w.message}</div>`).join('')
      :`<div class="empty"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6L9 17l-5-5"/></svg> Settimana valida</div>`;
  }

  function getCurrentWeek(){if(!weeks[currentStart])weeks[currentStart]=createEmptyWeek(currentStart);ensureWeekShape(weeks[currentStart]);return weeks[currentStart];}
  function changeWeek(days){
    resetAltHistory();currentStart=addDays(currentStart,days);selectedDayKey='mon';
    if(!weeks[currentStart]){
      // Genera al tick successivo: lo status "Calcolo turni…" appare prima del solve sincrono.
      const start=currentStart;
      deferHeavy('Calcolo turni…',()=>{weeks[start]=generateWeek({startDate:start,ledger:buildLedgerFromStorage()});saveWeeks();if(currentStart===start)render();});
      return;
    }
    saveWeeks();render();
  }
  // Pruning: conserva le 26 settimane passate (per il riepilogo mensile fino a ~6 mesi) e 8 future
  // attorno alla corrente, più quelle con almeno un turno bloccato (edit manuali da preservare).
  function saveWeeks(){
    const keep=new Set();
    for(let i=-26;i<=8;i++)keep.add(addDays(currentStart,i*7));
    for(const k of Object.keys(weeks)){
      const wk=weeks[k];
      const hasLock=wk?.days?.some(d=>Object.values(d.locks||{}).some(Boolean));
      if(!keep.has(k)&&!hasLock)delete weeks[k];
    }
    localStorage.setItem(storageKey,JSON.stringify(weeks));
  }
  function loadWeeks(){try{return JSON.parse(localStorage.getItem(storageKey))??{};}catch{return{};}}
  function createCell(html,className){const el=document.createElement('div');el.className=className;el.innerHTML=html;return el;}
  function getContractLabel(a){const c=ASSISTANTS[a];if(!c)return'';const pom=c.minAfternoons===c.maxAfternoons?`max ${c.maxAfternoons}`:`${c.minAfternoons}-${c.maxAfternoons}`;return`${c.weeklyHours}h · ${pom} pom.`;}

  let statusTimer;
  function showStatus(msg){
    statusMsg.textContent=msg;statusMsg.hidden=false;
    void statusMsg.offsetWidth;statusMsg.classList.add('visible');
    clearTimeout(statusTimer);statusTimer=setTimeout(()=>{statusMsg.classList.remove('visible');setTimeout(()=>{statusMsg.hidden=true;},250);},2500);
  }
  function getPrintShiftLabel(a){const s=getShift(a);return s.id==='OFF'?'Riposo':`${fmt(s.startMin)}-${fmt(s.endMin)}`;}
  // Etichetta settimana per la bottom bar: "15–20/06" (o "29/06–04/07" a cavallo di mese).
  function formatWeekRangeCompact(week){const[,am,ad]=week.days[0].date.split('-');const[,bm,bd]=week.days[week.days.length-1].date.split('-');return am===bm?`${ad}–${bd}/${bm}`:`${ad}/${am}–${bd}/${bm}`;}
  // Normalizza la forma della settimana e migra eventuali vecchi id-template (v1) verso {s,e}.
  function ensureWeekShape(week){for(const day of week.days){const hadSatOpen='satOpen'in(day.exceptions??{});day.exceptions={eventType:'',note:'',extraAfternoon:false,extraMorning:false,satOpen:false,holiday:false,...day.exceptions};day.absences=day.absences||{};day.assignments={...Object.fromEntries(ASSISTANT_NAMES.map(n=>[n,'OFF'])),...day.assignments};day.locks={...Object.fromEntries(ASSISTANT_NAMES.map(n=>[n,false])),...day.locks};for(const n of ASSISTANT_NAMES){const a=day.assignments[n];if(typeof a==='string'&&a!=='OFF')day.assignments[n]=LEGACY_TEMPLATES[a]??'OFF';}if(day.exceptions.holiday)for(const n of ASSISTANT_NAMES){day.assignments[n]='OFF';day.locks[n]=false;}else for(const n of ASSISTANT_NAMES)if(day.absences[n]){day.assignments[n]='OFF';day.locks[n]=false;}if(day.key==='sat'&&!hadSatOpen&&ASSISTANT_NAMES.some(n=>getShift(day.assignments[n]).hours>0))day.exceptions.satOpen=true;}const satDay=week.days.find(d=>d.key==='sat');if(satDay&&!satDay.exceptions.satOpen){for(const n of ASSISTANT_NAMES)if(!satDay.locks[n])satDay.assignments[n]='OFF';}}

  // ── PDF EXPORT ──
  function getDayVariationLabel(day){
    const eventLabels={chirurgia:'Chirurgia',ortodonzia:'Ortodonzia',dottore:'Dottore in più',altro:'Altro'};
    const satLabel=day.key==='sat'?(day.exceptions.satOpen?'Aperto':'Chiuso'):'';
    const holLabel=day.exceptions.holiday?'Festività (chiuso)':'';
    const absLabel=Object.entries(day.absences||{}).filter(([,v])=>v).map(([n,v])=>`${n}: ${v==='sick'?'Malattia':'Ferie'}`).join(', ');
    return[satLabel,holLabel,eventLabels[day.exceptions.eventType]??day.exceptions.eventType,day.exceptions.extraAfternoon&&day.key!=='sat'?'2× Pom.':'',day.exceptions.extraMorning&&day.key!=='sat'?'2× Matt.':'',absLabel].filter(Boolean).join(' · ');
  }
  function drawPdfBadge(doc,x,y,code){
    doc.setDrawColor(30,30,30);doc.setFillColor(255,255,255);doc.roundedRect(x,y,5,4,0.8,0.8,'FD');
    doc.setFont('helvetica','bold');doc.setFontSize(7);doc.setTextColor(30,30,30);doc.text(code,x+2.5,y+2.9,{align:'center'});
  }
  function exportPDF(){
    if(!window.jspdf){showStatus('Libreria PDF non ancora caricata, riprova.');return;}
    const week=getCurrentWeek();
    const{jsPDF}=window.jspdf;
    const doc=new jsPDF({orientation:'landscape',unit:'mm',format:'a4'});
    const pageW=doc.internal.pageSize.getWidth(),pageH=doc.internal.pageSize.getHeight(),M=14;
    const stats=getAssistantStats(week);
    // Intestazione minimale (stampa B/N): solo la settimana, niente titolo brand.
    doc.setFont('helvetica','bold');doc.setFontSize(13);doc.setTextColor(30,30,30);
    doc.text(`Settimana ${formatWeekRange(week)}`,M,16);
    doc.setDrawColor(150,150,150);doc.setLineWidth(0.3);doc.line(M,19,pageW-M,19);
    const head=[['Giorno',...ASSISTANT_NAMES]];
    const body=week.days.map(day=>[`${day.label}  ${formatDateShort(day.date)}${getDayVariationLabel(day)?`\n${getDayVariationLabel(day)}`:''}`,...ASSISTANT_NAMES.map(name=>{const shift=getShift(day.assignments[name]);return shift.id==='OFF'?'Riposo':`${shift.label}\n${shift.hours}h`;})]);
    const foot=[['Totale ore',...ASSISTANT_NAMES.map(n=>`${stats[n].hours}h`)]];
    doc.autoTable({head,body,foot,startY:24,
      headStyles:{fillColor:[45,45,45],textColor:255,fontStyle:'bold',halign:'center',fontSize:9,cellPadding:4},
      footStyles:{fillColor:[230,230,230],textColor:[30,30,30],fontStyle:'bold',halign:'center',fontSize:9,lineWidth:{top:0.6,right:0.2,bottom:0.2,left:0.2},lineColor:[80,80,80]},
      bodyStyles:{halign:'center',fontSize:11,fontStyle:'bold',cellPadding:{top:4,right:4,bottom:9,left:4},minCellHeight:16,textColor:[20,20,20]},
      columnStyles:{0:{halign:'left',fontStyle:'bold',fontSize:10,cellWidth:52,textColor:[30,30,30]}},
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
        const shift=getShift(day.assignments[ASSISTANT_NAMES[data.column.index-1]]);
        if(shift.id==='OFF'||closed){data.cell.styles.fillColor=[235,235,235];data.cell.styles.textColor=[120,120,120];data.cell.styles.fontStyle='italic';data.cell.styles.fontSize=10;}
      },
      didDrawCell:data=>{
        if(data.section!=='body'||data.column.index===0)return;
        const day=week.days[data.row.index],name=ASSISTANT_NAMES[data.column.index-1];
        const shift=getShift(day.assignments[name]);const codes=getShiftBadgeCodes(shift);
        let x=data.cell.x+4;const y=data.cell.y+data.cell.height-6;
        for(const code of codes){drawPdfBadge(doc,x,y,code);x+=6;}
      }});
    // Area note per scrittura a mano: riempie lo spazio residuo fino al footer.
    const footerY=pageH-9;
    let ny=doc.lastAutoTable.finalY+8;
    if(ny<footerY-18){
      doc.setFont('helvetica','bold');doc.setFontSize(10);doc.setTextColor(60,60,60);
      doc.text('Note',M,ny);
      const boxY=ny+2.5,boxH=footerY-6-boxY;
      doc.setDrawColor(170,170,170);doc.setLineWidth(0.3);doc.roundedRect(M,boxY,pageW-2*M,boxH,1.5,1.5);
      doc.setDrawColor(225,225,225);doc.setLineWidth(0.2);
      for(let ly=boxY+9;ly<boxY+boxH-3;ly+=9)doc.line(M+3,ly,pageW-M-3,ly);
    }
    // Footer: data di generazione + numero pagina su ogni pagina.
    const now=new Date();
    const gen=`Generato il ${String(now.getDate()).padStart(2,'0')}/${String(now.getMonth()+1).padStart(2,'0')}/${now.getFullYear()} ${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
    const pages=doc.internal.getNumberOfPages();
    for(let i=1;i<=pages;i++){doc.setPage(i);doc.setFont('helvetica','normal');doc.setFontSize(8);doc.setTextColor(130,130,130);doc.text(gen,M,footerY);doc.text(`Pag. ${i}/${pages}`,pageW-M,footerY,{align:'right'});}
    doc.save(`turni-${week.startDate}.pdf`);
    showStatus('PDF esportato!');
  }
