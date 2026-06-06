// Logica pura turni (no DOM). Estratta da index.html.
//
// Tipi chiave (JSDoc documentale; checkJs è off, niente gate di tipo per ora):
/**
 * @typedef {'OFF' | {s:number, e:number}} Assignment  Riposo, oppure entrata/uscita in minuti.
 * @typedef {Object} Shift
 * @property {string} id
 * @property {number} hours        Ore pagate (turno lungo: span-0.5).
 * @property {boolean} isLong      Span >= 7h30.
 * @property {?number} startMin
 * @property {?number} endMin
 * @property {boolean} coversMorning  Apertura 08:30.
 * @property {boolean} coversClose    Chiusura 19:00.
 * @property {boolean} isAfternoon    Fine >= 18:00.
 * @typedef {{startDate:string, days:Object[], overtimeUsed?:boolean}} Week
 * @typedef {Object} Contract
 * @property {number} weeklyHours
 * @property {number} minAfternoons
 * @property {number} maxAfternoons
 * @property {boolean} canWorkLong
 * @property {number} [workDays]
 * @property {number} [maxWorkDays]
 */
  // ── DATI E LOGICA ──
export const ASSISTANT_NAMES = ['Lucrezia', 'Manuela', 'Madalina'];
export const ASSISTANTS = {
    Lucrezia: { weeklyHours: 38, minAfternoons: 2, maxAfternoons: 3, canWorkLong: true, maxWorkDays: 5 },
    Manuela:  { weeklyHours: 25, minAfternoons: 1, maxAfternoons: 1, canWorkLong: false, workDays: 5 },
    Madalina: { weeklyHours: 24, minAfternoons: 2, maxAfternoons: 3, canWorkLong: false, workDays: 5 },
  };
export const WEEKDAY_KEYS = ['mon','tue','wed','thu','fri'];
  // ── MODELLO TURNI FLESSIBILI ──
  // Un assegnamento è 'OFF' (riposo) oppure {s:minutiEntrata, e:minutiUscita}.
  // Le proprietà del turno (ore, copertura, lungo/pausa) sono derivate al volo da entrata/uscita.
export const SLOT=30, STUDIO_OPEN=8*60+30, STUDIO_CLOSE=19*60;
export const SHIFT_MIN_SPAN=4*60, SHIFT_MAX_SPAN=8*60+30, LONG_SPAN=7*60+30, LUNCH_GAP_MAX=30;
export function fmt(min){return `${String(Math.floor(min/60)).padStart(2,'0')}:${String(min%60).padStart(2,'0')}`;}
export function isOff(a){return !a||a==='OFF';}
export const SHIFT_OFF={id:'OFF',label:'Riposo',hours:0,isLong:false,startMin:null,endMin:null,coversMorning:false,coversAfternoon:false,coversClose:false,isAfternoon:false,isNearClose:false};
export const _shiftCache=new Map();
  // Pausa di 30 min solo nei turni lunghi (span>=7h30): ore pagate = span-0.5. Negli altri ore=span.
export function deriveShift(a){
    if(isOff(a))return SHIFT_OFF;
    const s=a.s,e=a.e,key=s*10000+e;
    let d=_shiftCache.get(key);
    if(d)return d;
    const span=(e-s)/60, isLong=(e-s)>=LONG_SPAN;
    d={
      id:`${fmt(s)}-${fmt(e)}`, label:`${fmt(s)}-${fmt(e)}`,
      hours:isLong?span-0.5:span, isLong, startMin:s, endMin:e,
      coversMorning:s===STUDIO_OPEN, coversClose:e===STUDIO_CLOSE,
      isAfternoon:e>=18*60, isNearClose:e===18*60, coversAfternoon:e>13*60,
    };
    _shiftCache.set(key,d);
    return d;
  }
export function getShift(a){return deriveShift(a);}
  // Tutte le coppie (entrata,uscita) sulla griglia 30-min con 4h<=durata<=8h30.
export const BASE_PAIRS=(()=>{const out=[];for(let s=STUDIO_OPEN;s+SHIFT_MIN_SPAN<=STUDIO_CLOSE;s+=SLOT)for(let e=s+SHIFT_MIN_SPAN;e<=Math.min(s+SHIFT_MAX_SPAN,STUDIO_CLOSE);e+=SLOT)out.push({s,e});return out;})();
  // Tabella SOLO per migrazione dei vecchi id-template salvati in localStorage (v1) → {s,e}.
export const LEGACY_TEMPLATES={M5:{s:510,e:810},P5:{s:840,e:1140},M4:{s:510,e:750},M6:{s:510,e:870},P4:{s:900,e:1140},L_OPEN:{s:510,e:1020},L_CLOSE:{s:630,e:1140},P4_18:{s:840,e:1080},P5_18:{s:780,e:1080},S5:{s:540,e:840},MD_09_14:{s:540,e:840},MD_10_14:{s:600,e:840},MD_10_15:{s:600,e:900},MD_11_16:{s:660,e:960},P5_5:{s:810,e:1140},P6:{s:780,e:1140},P6_18:{s:720,e:1080},P7_5_18:{s:630,e:1080},M4_5:{s:510,e:780},M5_5:{s:510,e:840},M7:{s:510,e:960},M7_5:{s:510,e:990},MD_09_15:{s:540,e:900},MD_10_16:{s:600,e:960},MD_10_17:{s:600,e:1020},MD_11_17:{s:660,e:1020},MD_11_18:{s:660,e:1080},MD_09_17:{s:540,e:1020},MD_10_18:{s:600,e:1080}};
export const WEEK_DAYS = [
    {key:'mon',label:'Lunedì'},{key:'tue',label:'Martedì'},{key:'wed',label:'Mercoledì'},
    {key:'thu',label:'Giovedì'},{key:'fri',label:'Venerdì'},{key:'sat',label:'Sabato'},
  ];

export function addDays(d,a){const date=new Date(`${d}T00:00:00Z`);date.setUTCDate(date.getUTCDate()+a);return date.toISOString().slice(0,10);}
export function getCurrentMonday(now=new Date()){const date=new Date(Date.UTC(now.getFullYear(),now.getMonth(),now.getDate()));const day=date.getUTCDay();const diff=day===0?-6:1-day;date.setUTCDate(date.getUTCDate()+diff);return date.toISOString().slice(0,10);}
export function formatItalianDate(s){const[y,m,d]=s.split('-');return`${d}/${m}/${y}`;}
export function formatDateShort(s){const[y,m,d]=s.split('-');return`${d}/${m}`;}
export function assign(week,dayKey,as){const day=week.days.find(d=>d.key===dayKey);Object.assign(day.assignments,as);}
export function createEmptyWeek(startDate){return{startDate,days:WEEK_DAYS.map((day,idx)=>({...day,date:addDays(startDate,idx),exceptions:{eventType:'',note:'',extraAfternoon:false,extraMorning:false,satOpen:false},assignments:Object.fromEntries(ASSISTANT_NAMES.map(n=>[n,'OFF'])),locks:Object.fromEntries(ASSISTANT_NAMES.map(n=>[n,false]))}))}}
  // Seed iniziale (orari equivalenti ai vecchi template); il solver riscrive gli slot non bloccati.
export function createBaseWeek(startDate){const w=createEmptyWeek(startDate);assign(w,'mon',{Lucrezia:{s:630,e:1140},Manuela:{s:510,e:810},Madalina:{s:510,e:810}});assign(w,'tue',{Lucrezia:{s:630,e:1140},Manuela:{s:510,e:810},Madalina:{s:840,e:1140}});assign(w,'wed',{Lucrezia:{s:510,e:1020},Manuela:'OFF',Madalina:{s:840,e:1140}});assign(w,'thu',{Lucrezia:{s:510,e:870},Manuela:{s:510,e:810},Madalina:{s:900,e:1140}});assign(w,'fri',{Lucrezia:{s:630,e:1140},Manuela:{s:510,e:810},Madalina:{s:510,e:810}});assign(w,'sat',{Lucrezia:'OFF',Manuela:'OFF',Madalina:'OFF'});return w;}
  // Quota pomeriggi: soglia oraria di fine turno per-assistente (Manuela >15:00, Madalina >15:30, Lucrezia >17:00)
export const AFTERNOON_END_THRESHOLD={Manuela:900,Madalina:960,Lucrezia:1020};
export function countsAsAfternoon(assistant,shift){if(shift.hours===0||shift.endMin==null)return false;return shift.endMin>AFTERNOON_END_THRESHOLD[assistant];}
  // Lo straordinario pomeridiano di Manuela richiede il turno di chiusura 15:00-19:00.
export function isManuelaClose1519(a){const s=getShift(a);return s.startMin===15*60&&s.endMin===STUDIO_CLOSE;}
export function getAssistantStats(week){const s=Object.fromEntries(ASSISTANT_NAMES.map(n=>[n,{hours:0,afternoons:0,longShifts:0,saturdays:0,opens:0,closes:0,workDays:0}]));for(const d of week.days)for(const n of ASSISTANT_NAMES){const sh=getShift(d.assignments[n]);s[n].hours+=sh.hours;if(sh.hours>0)s[n].workDays++;if(countsAsAfternoon(n,sh))s[n].afternoons++;if(sh.isLong)s[n].longShifts++;if(d.key==='sat'&&sh.hours>0)s[n].saturdays++;if(sh.coversMorning)s[n].opens++;if(sh.coversClose)s[n].closes++;}return s;}
export function getRequiredCoverage(day){if(day.key==='sun'||(day.key==='sat'&&!day.exceptions.satOpen))return{morning:0,afternoon:0,close:0,morningPair:0,afternoonPair:0};const isWeekday=WEEKDAY_KEYS.includes(day.key);const extraPom=isWeekday&&day.exceptions.extraAfternoon;const extraMatt=isWeekday&&day.exceptions.extraMorning;const afternoon=(isWeekday?1:0)+(extraPom?1:0);return{morning:1,afternoon:day.key==='sat'?0:afternoon,close:isWeekday?1:0,morningPair:extraMatt?2:0,afternoonPair:extraPom?2:0};}
export function shiftsOf(day){return ASSISTANT_NAMES.map(n=>getShift(day.assignments[n]));}
  // La copertura "afternoon" conta la presenza reale fino a tardi (turni che finiscono >=18:00 = isAfternoon), non chi esce alle 17:00.
  // Sabato: apertura flessibile con una sola assistente → "morning" = numero di assistenti che lavorano.
export function coverageOf(shifts,dayKey){
    if(dayKey==='sat'){const working=shifts.filter(s=>s.hours>0).length;return{morning:working,afternoon:0,close:0,morningPair:0,afternoonPair:0};}
    return{morning:shifts.filter(s=>s.coversMorning).length,afternoon:shifts.filter(s=>s.isAfternoon).length,close:shifts.filter(s=>s.coversClose).length,morningPair:shifts.filter(s=>s.startMin!=null&&s.startMin<=570&&s.endMin>=810).length,afternoonPair:shifts.filter(s=>s.startMin!=null&&s.startMin<=840&&s.endMin>=1080).length};
  }
export function getCoverage(day){return coverageOf(shiftsOf(day),day.key);}
  // Lo studio deve essere coperto in continuita' 08:30-19:00: l'unico buco ammesso e' la pausa pranzo (<= 30 min).
  // Minuti scoperti 08:30-19:00 (cumulativo) + debito pausa pranzo: una fascia coperta
  // da una sola persona in turno lungo lascia 30' realmente scoperti (la sua pausa).
export function coverageDeficit(shifts,dayKey){
    if(!WEEKDAY_KEYS.includes(dayKey))return 0;
    const working=shifts.filter(s=>s.hours>0&&s.startMin!=null);
    const N=(STUDIO_CLOSE-STUDIO_OPEN)/SLOT;
    let realGap=0;
    for(let i=0;i<N;i++){
      const t0=STUDIO_OPEN+i*SLOT,t1=t0+SLOT;
      if(!working.some(s=>s.startMin<=t0&&s.endMin>=t1))realGap+=SLOT;
    }
    // Debito pausa: un turno lungo che non si sovrappone MAI a un'altra presenza
    // lascia 30' scoperti (deve pranzare da solo); se si sovrappone, pranza al cambio.
    let lunchDebt=0;
    for(const ls of working){
      if(!ls.isLong)continue;
      const overlaps=working.some(o=>o!==ls&&o.startMin<ls.endMin&&o.endMin>ls.startMin);
      if(!overlaps)lunchDebt+=LUNCH_GAP_MAX;
    }
    return realGap+lunchDebt;
  }
export function maxUncoveredGap(day){return coverageDeficit(shiftsOf(day),day.key);}
export function validateWeek(week,rulesOverride){const ASSIST=rulesOverride??ASSISTANTS;const w=[],stats=getAssistantStats(week);for(const name of ASSISTANT_NAMES){const baseRules=ASSIST[name];const rules=(name==='Manuela'&&(stats.Manuela.hours>baseRules.weeklyHours||stats.Manuela.afternoons>baseRules.maxAfternoons))?{...baseRules,weeklyHours:29,maxAfternoons:2}:baseRules;const s=stats[name];if(s.hours!==rules.weeklyHours)w.push({message:`${name}: ${s.hours}h su ${rules.weeklyHours}h`});if(s.afternoons<rules.minAfternoons)w.push({message:`${name}: pochi pomeriggi (${s.afternoons}/${rules.minAfternoons})`});if(s.afternoons>rules.maxAfternoons)w.push({message:`${name}: troppi pomeriggi (${s.afternoons}/${rules.maxAfternoons})`});const maxWD=rules.workDays??rules.maxWorkDays;if(maxWD&&s.workDays>maxWD)w.push({message:`${name}: ${s.workDays} giorni lavorati (max ${maxWD})`});if(name==='Manuela'&&s.afternoons>=2&&!week.days.some(d=>isManuelaClose1519(d.assignments.Manuela)))w.push({message:'Manuela: straordinario pomeridiano richiede turno 15:00-19:00'});if(name==='Manuela'&&s.afternoons>2)w.push({message:'Manuela: mai più di 2 pomeriggi'});}for(const day of week.days){const req=getRequiredCoverage(day),cov=getCoverage(day);if(cov.morning<req.morning)w.push({message:`${day.label}: apertura 08:30 scoperta`});if(cov.morningPair<req.morningPair)w.push({message:`${day.label}: serve doppia mattina (9:30-13:30)`});if(day.key==='sat'&&cov.morning>1)w.push({message:`${day.label}: sabato solo un'assistente`});if(cov.afternoon<req.afternoon)w.push({message:`${day.label}: pomeriggio richiede ${req.afternoon}`});if(cov.close<req.close)w.push({message:`${day.label}: chiusura 19:00 scoperta`});if(cov.afternoonPair<req.afternoonPair)w.push({message:`${day.label}: serve doppio pomeriggio (14:00-18:00)`});if(maxUncoveredGap(day)>LUNCH_GAP_MAX)w.push({message:`${day.label}: studio scoperto >30 min (pausa pranzo max 30')`});for(const n of ASSISTANT_NAMES){const sh=getShift(day.assignments[n]);if(sh.isLong&&!ASSIST[n].canWorkLong)w.push({message:`${n}: turno lungo non previsto (${day.label})`});if(sh.hours>8.5)w.push({message:`${n}: giornata pesante >8.5h (${day.label})`});}}return w;}
export function formatWeekRange(week){return`${formatItalianDate(week.days[0].date)} - ${formatItalianDate(week.days[week.days.length-1].date)}`;}
export function formatWeekRangeShort(week){return`${formatDateShort(week.days[0].date)}–${formatDateShort(week.days[week.days.length-1].date)}`;}

  // Turni ammessi per assistente/giorno: 'OFF' + coppie {s,e}. Chi non può fare lunghi (span>=7h30) li esclude.
export function getAllowedShifts(assistant,day,skipLock=false){
    if(!skipLock&&day.locks?.[assistant])return[day.assignments[assistant]];
    if(day.key==='sat'){
      if(!day.exceptions?.satOpen)return['OFF'];
      // Sabato: una sola assistente, 5h o 6h, apertura flessibile.
      const out=['OFF'];
      for(let s=STUDIO_OPEN;s<=STUDIO_CLOSE-300;s+=SLOT){if(s+300<=STUDIO_CLOSE)out.push({s,e:s+300});if(s+360<=STUDIO_CLOSE)out.push({s,e:s+360});}
      return out;
    }
    const canLong=ASSISTANTS[assistant].canWorkLong;
    const out=['OFF'];
    for(const p of BASE_PAIRS){if(!canLong&&(p.e-p.s)>=LONG_SPAN)continue;out.push(p);}
    return out;
  }
export function generateWeek(options={}){const week=createBaseWeek(options.startDate??getCurrentMonday());applyPreviousWeekState(week,options.previousWeek);const r=solveWeek(week);const result=r.week??week;if(r.overtime)result.overtimeUsed=true;return result;}
  // Domanda di presenze pomeridiane (turni isAfternoon) richieste nella settimana, e tetto massimo dato il limite pomeriggi di Manuela.
  // Ogni presenza isAfternoon finisce >=18:00, oltre ogni soglia: consuma sempre 1 quota pomeriggio. Quindi domanda<=capacita' e' condizione necessaria.
export function afternoonDemand(week){return week.days.reduce((n,d)=>n+getRequiredCoverage(d).afternoon,0);}
  // Solver a priorità: cerca la distribuzione pomeriggi più semplice (Luc2/Man1/Mad2), poi sale a tier
  // via via meno preferiti (Madalina 3, poi Lucrezia 3, infine Manuela 2 con straordinario). Dentro ogni
  // tier preferisce 2 chiusure Lucrezia (poi 3). Il pre-check sulla domanda salta i tier matematicamente impossibili.
export const SOLVE_BUDGET_FAST=60000, SOLVE_BUDGET_FULL=1500000;
  // Ordina le combo di un giorno preferendo, per ogni assistente, le ore vicine alla sua media giornaliera:
  // così il backtracking trova quasi subito la soluzione nei casi normali. È solo un ordinamento, non scarta nulla.
export function heuristicCombos(combosByDay){
    const avg={};for(const n of ASSISTANT_NAMES)avg[n]=ASSISTANTS[n].weeklyHours/5;
    const score=c=>ASSISTANT_NAMES.reduce((s,n)=>{const h=getShift(c[n]).hours;return s+(h>0?Math.abs(h-avg[n]):avg[n]*0.5);},0);
    return combosByDay.map(day=>[...day].sort((a,b)=>score(a)-score(b)));
  }
  // Firma di una settimana (assegnamenti di tutti i giorni/assistenti): per riconoscere/escludere una soluzione già trovata.
export function weekAssignmentSig(week){return week.days.map(d=>ASSISTANT_NAMES.map(n=>{const a=d.assignments[n];return isOff(a)?'OFF':`${a.s}-${a.e}`;}).join(',')).join('|');}
  // avoidSigs (opzionale, Set<string>): scarta le soluzioni con queste firme, per ciclare tutte le proposte.
  // Tier di distribuzione pomeriggi, dal più preferito: base Luc2/Man1/Mad2, poi Madalina 3,
  // poi Lucrezia 3, infine Manuela 2 con straordinario (29h). minAfternoons restano Luc2/Man1/Mad2.
export const AFTERNOON_TIERS=[
    {caps:{Lucrezia:2,Manuela:1,Madalina:2},ot:false},
    {caps:{Lucrezia:2,Manuela:1,Madalina:3},ot:false},
    {caps:{Lucrezia:3,Manuela:1,Madalina:3},ot:false},
    {caps:{Lucrezia:3,Manuela:2,Madalina:3},ot:true},
  ];
export function solveWeek(seedWeek,avoidSigs){
    const demand=afternoonDemand(seedWeek);
    const baseCombos=seedWeek.days.map((day,idx)=>getDayCombos(seedWeek,day,idx));
    const fastCombos=heuristicCombos(baseCombos);
    // order/rem dipendono solo dalle lunghezze e dagli allowed shift (uguali per fast/base e per ogni tier): calcolati una volta.
    const D=seedWeek.days.length;
    const order=[...Array(D).keys()].sort((a,b)=>baseCombos[a].length-baseCombos[b].length);
    const pre={order,rem:buildRem(seedWeek.days,order)};
    const attempt=(combos,budget)=>{
      for(const tier of AFTERNOON_TIERS){
        if(demand>tier.caps.Lucrezia+tier.caps.Manuela+tier.caps.Madalina)continue;
        const tierRules=Object.fromEntries(ASSISTANT_NAMES.map(n=>[n,{...ASSISTANTS[n],maxAfternoons:tier.caps[n],...(tier.ot&&n==='Manuela'?{weeklyHours:29}:{})}]));
        let found=null;
        for(const maxCloses of [2,3]){const r=solveWeekCore(seedWeek,maxCloses,combos,budget,avoidSigs,tierRules,pre);if(r.solved){found=r;break;}}
        if(found){if(tier.ot)found.week.overtimeUsed=true;return{...found,overtime:tier.ot};}
      }
      return null;
    };
    // Fase A: ordinamento euristico con budget ridotto (caso comune, pochi ms).
    let r=attempt(fastCombos,SOLVE_BUDGET_FAST);
    if(r)return r;
    // Fase B: ordine completo con budget pieno (ricerca esaustiva, evita falsi "nessuna soluzione").
    r=attempt(baseCombos,SOLVE_BUDGET_FULL);
    return r??{week:null,solved:false,overtime:false};
  }
  // Solver sincrono: backtracking con potatura e memoizzazione degli stati senza uscita.
  // Stima dei residui (ore, pomeriggi, giorni) lungo l'ordine di visita, per la potatura.
  // Dipende solo dagli allowed shift (non dai cap del tier) → calcolabile una volta per settimana.
export function buildRem(days,order){const D=days.length,rem=[];for(let p=0;p<=D;p++){const r={};for(const a of ASSISTANT_NAMES){let minH=0,maxH=0,maxAf=0,minWD=0,maxWD=0;for(let q=p;q<D;q++){const allowed=getAllowedShifts(a,days[order[q]]).map(getShift);minH+=Math.min(...allowed.map(s=>s.hours));maxH+=Math.max(...allowed.map(s=>s.hours));maxAf+=allowed.some(s=>countsAsAfternoon(a,s))?1:0;minWD+=allowed.every(s=>s.hours>0)?1:0;maxWD+=allowed.some(s=>s.hours>0)?1:0;}r[a]={minHours:minH,maxHours:maxH,maxAfternoons:maxAf,minWorkDays:minWD,maxWorkDays:maxWD};}rem[p]=r;}return rem;}
export function solveWeekCore(seedWeek,maxClosesLucrezia=Infinity,combosByDay,budget=SOLVE_BUDGET_FULL,avoidSigs,tierRules,pre){
    tierRules=tierRules||Object.fromEntries(ASSISTANT_NAMES.map(n=>[n,{...ASSISTANTS[n]}]));
    let best=null,nodes=0;
    const days=seedWeek.days,D=days.length;
    combosByDay=combosByDay||days.map((day,idx)=>getDayCombos(seedWeek,day,idx));
    // Euristica "giorno piu' vincolato prima": visita i giorni con meno combinazioni per primi (es. sabato aperto), potando l'albero molto piu' in fretta.
    const order=pre?.order||[...Array(D).keys()].sort((a,b)=>combosByDay[a].length-combosByDay[b].length);
    const orderedCombos=order.map(i=>combosByDay[i]);
    const rem=pre?.rem||buildRem(days,order);
    function feasibleAhead(nextPos,st){for(const a of ASSISTANT_NAMES){const rules=tierRules[a],s=st[a],r=rem[nextPos][a];if(s.hours>rules.weeklyHours)return false;if(s.afternoons>rules.maxAfternoons)return false;if(rules.workDays&&s.workDays>rules.workDays)return false;if(rules.maxWorkDays&&s.workDays>rules.maxWorkDays)return false;if(s.hours+r.maxHours<rules.weeklyHours)return false;if(s.hours+r.minHours>rules.weeklyHours)return false;if(s.afternoons+r.maxAfternoons<rules.minAfternoons)return false;if(rules.workDays&&(s.workDays+r.maxWorkDays<rules.workDays||s.workDays+r.minWorkDays>rules.workDays))return false;if(rules.maxWorkDays&&s.workDays+r.minWorkDays>rules.maxWorkDays)return false;}return true;}
    const dead=new Set();
    const keyOf=(pos,st)=>{let s=pos+'|';for(const a of ASSISTANT_NAMES){const x=st[a];s+=Math.round(x.hours*2)+','+x.afternoons+','+x.workDays+','+(x.closes||0)+';';}return s;};
    const placed=new Array(D);
    function visit(pos,stats){
      if(best||nodes>budget)return;nodes++;
      if(pos===D){const w=buildWeekFromDayAssignments(seedWeek,placed);if(validateWeek(w,tierRules).length===0&&(!avoidSigs||!avoidSigs.has(weekAssignmentSig(w))))best=w;return;}
      const key=keyOf(pos,stats);if(dead.has(key))return;
      for(const combo of orderedCombos[pos]){
        const d=combo.d,next=cloneStats(stats);
        for(const a of ASSISTANT_NAMES){const da=d[a];next[a].hours+=da.h;next[a].afternoons+=da.af;next[a].workDays+=da.wd;}
        next.Lucrezia.closes+=d.Lclose;
        if(next.Lucrezia.closes>maxClosesLucrezia)continue;
        if(next.Manuela.afternoons>=2){let hasP4=d.Manuela.o;if(!hasP4)for(let q=0;q<pos;q++){const pc=placed[order[q]];if(pc&&pc.d.Manuela.o){hasP4=true;break;}}if(!hasP4)continue;}
        if(!feasibleAhead(pos+1,next))continue;
        placed[order[pos]]=combo;visit(pos+1,next);placed[order[pos]]=undefined;
        if(best||nodes>budget)return;
      }
      dead.add(key);
    }
    visit(0,Object.fromEntries(ASSISTANT_NAMES.map(n=>[n,{hours:0,afternoons:0,workDays:0,closes:0}])));
    return{week:best,solved:!!best};
  }
  // Combinazioni valide del giorno: copertura calcolata in modo diretto sui 3 oggetti turno (niente structuredClone per combo).
  // Con orari flessibili molte combinazioni sono indistinguibili per il solver: le deduplico per "firma" (ore, pomeriggio,
  // chiusura per assistente + turno 15-19 di Manuela). Tenere un solo rappresentante per firma riduce di molto il branching.
export function getDayCombos(seedWeek,day,_idx){
    const La=getAllowedShifts('Lucrezia',day),Ma=getAllowedShifts('Manuela',day),Da=getAllowedShifts('Madalina',day);
    const Ls=La.map(getShift),Ms=Ma.map(getShift),Ds=Da.map(getShift);
    const req=getRequiredCoverage(day),isSat=day.key==='sat'&&day.exceptions?.satOpen,isWeekday=WEEKDAY_KEYS.includes(day.key);
    const seen=new Map();
    // Valuta una tripla (indici i/j/k su La/Ma/Da): check di copertura + dedup per firma. Corpo identico per ogni percorso d'iterazione.
    const consider=(i,j,k)=>{
      const l=Ls[i],m=Ms[j],md=Ds[k];
      if(isSat){const working=(l.hours>0?1:0)+(m.hours>0?1:0)+(md.hours>0?1:0);if(working!==1)return;}
      else{
        // Una sola apertura alle 8:30: esattamente req.morning. La 2ª presenza mattutina (morningPair) parte dopo.
        {const _o=(l.coversMorning?1:0)+(m.coversMorning?1:0)+(md.coversMorning?1:0);if(_o!==req.morning)return;}
        // Doppia mattina: finestra 9:30-13:30 (570-810) coperta da 2 persone.
        if(req.morningPair&&(l.startMin!=null&&l.startMin<=570&&l.endMin>=810?1:0)+(m.startMin!=null&&m.startMin<=570&&m.endMin>=810?1:0)+(md.startMin!=null&&md.startMin<=570&&md.endMin>=810?1:0)<req.morningPair)return;
        if((l.isAfternoon?1:0)+(m.isAfternoon?1:0)+(md.isAfternoon?1:0)<req.afternoon)return;
        if((l.coversClose?1:0)+(m.coversClose?1:0)+(md.coversClose?1:0)<req.close)return;
        // Doppio pomeriggio: finestra 14:00-18:00 (840-1080) coperta da 2 persone.
        if(req.afternoonPair&&(l.startMin!=null&&l.startMin<=840&&l.endMin>=1080?1:0)+(m.startMin!=null&&m.startMin<=840&&m.endMin>=1080?1:0)+(md.startMin!=null&&md.startMin<=840&&md.endMin>=1080?1:0)<req.afternoonPair)return;
        if(isWeekday&&coverageDeficit([l,m,md],day.key)>LUNCH_GAP_MAX)return;
      }
      const lAf=countsAsAfternoon('Lucrezia',l)?1:0,mAf=countsAsAfternoon('Manuela',m)?1:0,mdAf=countsAsAfternoon('Madalina',md)?1:0;
      const mO=isManuelaClose1519(Ma[j])?1:0,lC=l.coversClose?1:0;
      const sig=`${l.hours},${lAf},${lC}|${m.hours},${mAf},${mO}|${md.hours},${mdAf}`;
      if(!seen.has(sig)){
        const combo={Lucrezia:La[i],Manuela:Ma[j],Madalina:Da[k]};
        combo.d={Lucrezia:{h:l.hours,af:lAf,wd:l.hours>0?1:0},Manuela:{h:m.hours,af:mAf,wd:m.hours>0?1:0,o:mO},Madalina:{h:md.hours,af:mdAf,wd:md.hours>0?1:0},Lclose:lC};
        seen.set(sig,combo);
      }
    };
    if(!isSat&&req.morning===1){
      // Esattamente 1 apertore (coversMorning): partiziona per chi apre, gli altri due tra i non-apertori.
      // Salta a priori le triple con 0 o 2+ aperture (≈ 60% del totale) senza cambiare l'output.
      const oL=[],nL=[],oM=[],nM=[],oD=[],nD=[];
      Ls.forEach((s,i)=>(s.coversMorning?oL:nL).push(i));
      Ms.forEach((s,j)=>(s.coversMorning?oM:nM).push(j));
      Ds.forEach((s,k)=>(s.coversMorning?oD:nD).push(k));
      for(const i of oL)for(const j of nM)for(const k of nD)consider(i,j,k); // Lucrezia apre
      for(const j of oM)for(const i of nL)for(const k of nD)consider(i,j,k); // Manuela apre
      for(const k of oD)for(const i of nL)for(const j of nM)consider(i,j,k); // Madalina apre
    }else{
      for(let i=0;i<La.length;i++)for(let j=0;j<Ma.length;j++)for(let k=0;k<Da.length;k++)consider(i,j,k);
    }
    return [...seen.values()];
  }
export function cloneStats(stats){return Object.fromEntries(ASSISTANT_NAMES.map(a=>[a,{...stats[a]}]));}
export function buildWeekFromDayAssignments(seedWeek,assignments){const w=structuredClone(seedWeek);for(let i=0;i<w.days.length;i++)for(const a of ASSISTANT_NAMES)w.days[i].assignments[a]=assignments[i][a];return w;}
export function applyPreviousWeekState(week,prev){if(!prev)return;for(const day of week.days){const p=prev.days.find(d=>d.key===day.key);if(!p)continue;day.exceptions={...day.exceptions,...p.exceptions};day.locks={...day.locks,...p.locks};for(const a of ASSISTANT_NAMES)if(day.locks[a])day.assignments[a]=p.assignments[a];}}
export function regenerateWeekWithFeedback(start,prev){const seed=createBaseWeek(start);applyPreviousWeekState(seed,prev);const r=solveWeek(seed);const week=r.week??seed;const locked=getLockedShiftCount(week);if(!r.solved)return{week,message:locked?`Nessuna combinazione valida con i ${locked} turni bloccati: probabilmente non e' possibile, prova a sbloccarne qualcuno.`:'Nessuna combinazione valida trovata.'};const otMsg=r.overtime?` ⚠️ Straordinario Manuela (+4h pom. extra, 29h totali).`:'';return{week,message:(locked?`Rigenerata. ${locked} turni bloccati mantenuti.`:'Settimana rigenerata.')+otMsg};}
export function regenerateCleanWeekWithFeedback(start){const week=generateWeek({startDate:start});const otMsg=week.overtimeUsed?` ⚠️ Straordinario Manuela (+4h pom. extra, 29h totali).`:'';return{week,message:'Settimana pulita rigenerata.'+otMsg};}
  // Varieta' oraria: per ogni assistente/giorno non bloccato prova a spostare gli orari
  // su un turno equivalente (stessa firma-ruolo: ore, apertura, chiusura, pomeriggio, quota,
  // 15-19 di Manuela), mantenendo la settimana valida. Non cambia le statistiche, solo i layout.
export function diversifyTimes(week){
    const w=structuredClone(week);
    for(const day of w.days){
      if(!WEEKDAY_KEYS.includes(day.key))continue;
      for(const n of ASSISTANT_NAMES){
        if(day.locks?.[n])continue;
        const curA=day.assignments[n],cur=getShift(curA);
        if(cur.id==='OFF')continue;
        const alts=getAllowedShifts(n,day,true).filter(a=>!isOff(a)).filter(a=>{
          if(a.s===cur.startMin&&a.e===cur.endMin)return false;
          const s=getShift(a);
          return s.hours===cur.hours&&s.coversMorning===cur.coversMorning&&s.coversClose===cur.coversClose&&s.isAfternoon===cur.isAfternoon&&countsAsAfternoon(n,s)===countsAsAfternoon(n,cur)&&isManuelaClose1519(a)===isManuelaClose1519(curA);
        });
        for(const alt of alts){day.assignments[n]=alt;if(validateWeek(w).length===0)break;day.assignments[n]=curA;}
      }
    }
    return w;
  }
export function regenerateAlternativeWithFeedback(start,current,avoidSigs){const seed=createBaseWeek(start);applyPreviousWeekState(seed,current);const r=solveWeek(seed,avoidSigs);if(!r.solved)return{week:null,solved:false};let week=r.week;const dv=diversifyTimes(week);if(validateWeek(dv).length===0&&(!avoidSigs||!avoidSigs.has(weekAssignmentSig(dv))))week=dv;const otMsg=r.overtime?` ⚠️ Straordinario Manuela (+4h pom. extra, 29h totali).`:'';return{week,solved:true,message:'Soluzione alternativa trovata.'+otMsg};}
export function updateShiftWithFeedback(week,dayKey,assistant,shiftId){const day=week.days.find(d=>d.key===dayKey);if(day)day.assignments[assistant]=shiftId;return{week,message:`${assistant} · ${day?.label} aggiornato.`};}
export function getLockedShiftCount(week){return week.days.reduce((c,d)=>c+Object.values(d.locks).filter(Boolean).length,0);}
