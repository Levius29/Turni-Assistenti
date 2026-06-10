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
// ── CONFIG DICHIARATIVA DEL TEAM ──
// Unica fonte di verità: aggiungere/rimuovere/rinominare persone qui. Nessuna regola
// con nomi propri nel solver — i ruoli (chi fa straordinario, chi ha la preferenza
// sulle chiusure) sono DERIVATI dai campi sotto.
//   afternoonThresholdMin : fine turno oltre cui conta come "pomeriggio" per la quota.
//   escalationPriority    : ordine con cui si alza il tetto pomeriggi (più basso = prima).
//   closePref {preferred,max} : ricerca preferisce `preferred` chiusure, poi `max`.
//   overtime {weeklyHours,maxAfternoons,requiresShift} : politica straordinario opzionale.
export function defaultStaffConfig(){return {
    Lucrezia: { weeklyHours: 38, minAfternoons: 2, maxAfternoons: 3, canWorkLong: true,  maxWorkDays: 5, afternoonThresholdMin: 1020, escalationPriority: 2, closePref: { preferred: 2, max: 3 }, preferences: {} },
    Manuela:  { weeklyHours: 25, minAfternoons: 1, maxAfternoons: 1, canWorkLong: false, workDays: 5,    afternoonThresholdMin: 900,  escalationPriority: 3, preferences: {} },
    Madalina: { weeklyHours: 24, minAfternoons: 2, maxAfternoons: 3, canWorkLong: false, workDays: 5,    afternoonThresholdMin: 960,  escalationPriority: 1, preferences: {} },
  };}
// Stato del team mutabile a runtime: i `let` esportati sono live-binding, reconfigure() ricalcola tutto il derivato.
export let STAFF_CONFIG = defaultStaffConfig();
export let ASSISTANT_NAMES = Object.keys(STAFF_CONFIG);
export let ASSISTANTS = STAFF_CONFIG; // i campi extra sono ignorati dai check contrattuali
// Ruoli derivati dalla config (≤1 ciascuno per ora; null se nessuno).
export let OVERTIME_PERSON = ASSISTANT_NAMES.find(n => STAFF_CONFIG[n].overtime) ?? null;
export let CLOSE_PREF_PERSON = ASSISTANT_NAMES.find(n => STAFF_CONFIG[n].closePref) ?? null;
// Cambia il team a runtime e ricalcola nomi, ruoli, soglie e tier. cfg: { nome: Contract }.
export function reconfigure(cfg){
  STAFF_CONFIG = cfg;
  ASSISTANTS = cfg;
  ASSISTANT_NAMES = Object.keys(cfg);
  OVERTIME_PERSON = ASSISTANT_NAMES.find(n => cfg[n].overtime) ?? null;
  CLOSE_PREF_PERSON = ASSISTANT_NAMES.find(n => cfg[n].closePref) ?? null;
  AFTERNOON_END_THRESHOLD = Object.fromEntries(ASSISTANT_NAMES.map(n => [n, cfg[n].afternoonThresholdMin]));
  AFTERNOON_TIERS = computeAfternoonTiers();
  return STAFF_CONFIG;
}
export function getStaffConfig(){return STAFF_CONFIG;}
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
export function createEmptyWeek(startDate){return{startDate,days:WEEK_DAYS.map((day,idx)=>({...day,date:addDays(startDate,idx),exceptions:{eventType:'',note:'',extraAfternoon:false,extraMorning:false,satOpen:false,holiday:false},absences:{},assignments:Object.fromEntries(ASSISTANT_NAMES.map(n=>[n,'OFF'])),locks:Object.fromEntries(ASSISTANT_NAMES.map(n=>[n,false]))}))}}
  // Seed della settimana: tutto 'OFF'. Il solver riscrive gli slot non bloccati e il seed
  // non influenza la soluzione (verificato), quindi è indipendente dai nomi → team generico.
export function createBaseWeek(startDate){return createEmptyWeek(startDate);}
  // Quota pomeriggi: soglia oraria di fine turno per-assistente, derivata dalla config.
export let AFTERNOON_END_THRESHOLD=Object.fromEntries(ASSISTANT_NAMES.map(n=>[n,STAFF_CONFIG[n].afternoonThresholdMin]));
export function countsAsAfternoon(assistant,shift){if(shift.hours===0||shift.endMin==null)return false;return shift.endMin>AFTERNOON_END_THRESHOLD[assistant];}
  // Lo straordinario pomeridiano di una persona può richiedere un turno specifico (es. 15:00-19:00).
export function worksOvertimeShift(name,a){const o=STAFF_CONFIG[name]?.overtime?.requiresShift;if(!o)return false;const s=getShift(a);return s.startMin===o.s&&s.endMin===o.e;}
  // Retrocompat: alias per la persona straordinaria configurata.
export function isManuelaClose1519(a){return OVERTIME_PERSON?worksOvertimeShift(OVERTIME_PERSON,a):false;}
// Una persona è "in straordinario" in una settimana se ha lo straordinario abilitato e supera il suo target base (ore o pomeriggi).
export function inOvertime(name,week){const c=STAFF_CONFIG[name];if(!c?.overtime)return false;const s=getAssistantStats(week)[name];return s.hours>c.weeklyHours||s.afternoons>c.maxAfternoons;}
export function getAssistantStats(week){const s=Object.fromEntries(ASSISTANT_NAMES.map(n=>[n,{hours:0,afternoons:0,longShifts:0,saturdays:0,opens:0,closes:0,workDays:0}]));for(const d of week.days)for(const n of ASSISTANT_NAMES){const sh=getShift(d.assignments[n]);s[n].hours+=sh.hours;if(sh.hours>0)s[n].workDays++;if(countsAsAfternoon(n,sh))s[n].afternoons++;if(sh.isLong)s[n].longShifts++;if(d.key==='sat'&&sh.hours>0)s[n].saturdays++;if(sh.coversMorning)s[n].opens++;if(sh.coversClose)s[n].closes++;}return s;}
export function getRequiredCoverage(day){if(day.key==='sun'||(day.key==='sat'&&!day.exceptions.satOpen)||day.exceptions.holiday)return{morning:0,afternoon:0,close:0,morningPair:0,afternoonPair:0};const isWeekday=WEEKDAY_KEYS.includes(day.key);const extraPom=isWeekday&&day.exceptions.extraAfternoon;const extraMatt=isWeekday&&day.exceptions.extraMorning;const afternoon=(isWeekday?1:0)+(extraPom?1:0);return{morning:1,afternoon:day.key==='sat'?0:afternoon,close:isWeekday?1:0,morningPair:extraMatt?2:0,afternoonPair:extraPom?2:0};}
export function shiftsOf(day){return ASSISTANT_NAMES.map(n=>getShift(day.assignments[n]));}
// Festività (studio chiuso) riducono il monte ore pro-quota; le assenze personali (ferie/malattia)
// NON riducono il target (vanno recuperate nei giorni rimasti).
export function holidayWeekdayCount(week){return week.days.filter(d=>WEEKDAY_KEYS.includes(d.key)&&d.exceptions?.holiday).length;}
export function effectiveWeeklyHours(name,week,base){const wh=base??ASSISTANTS[name].weeklyHours;const hc=holidayWeekdayCount(week);if(!hc)return wh;const nd=ASSISTANTS[name].workDays??ASSISTANTS[name].maxWorkDays??5;return Math.round((wh-hc*(wh/nd))*2)/2;}
export function personalAbsenceDays(name,week){return week.days.filter(d=>WEEKDAY_KEYS.includes(d.key)&&!d.exceptions?.holiday&&d.absences?.[name]).length;}
// Festività e assenze personali riducono i GIORNI lavorativi richiesti (le ore restano: si recuperano).
export function effectiveWorkDays(name,week,base){if(base==null)return null;return Math.max(0,base-holidayWeekdayCount(week)-personalAbsenceDays(name,week));}
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
export function validateWeek(week,rulesOverride){const ASSIST=rulesOverride??ASSISTANTS;const w=[],stats=getAssistantStats(week);for(const name of ASSISTANT_NAMES){const baseRules=ASSIST[name];const _ot=STAFF_CONFIG[name]?.overtime;const rules=(_ot&&(stats[name].hours>baseRules.weeklyHours||stats[name].afternoons>baseRules.maxAfternoons))?{...baseRules,weeklyHours:_ot.weeklyHours,maxAfternoons:_ot.maxAfternoons}:baseRules;const s=stats[name];const target=rulesOverride?rules.weeklyHours:effectiveWeeklyHours(name,week,rules.weeklyHours);if(s.hours!==target)w.push({message:`${name}: ${s.hours}h su ${target}h`});if(s.afternoons<rules.minAfternoons)w.push({message:`${name}: pochi pomeriggi (${s.afternoons}/${rules.minAfternoons})`});if(s.afternoons>rules.maxAfternoons)w.push({message:`${name}: troppi pomeriggi (${s.afternoons}/${rules.maxAfternoons})`});const maxWD=rulesOverride?(rules.workDays??rules.maxWorkDays):effectiveWorkDays(name,week,rules.workDays??rules.maxWorkDays);if(maxWD!=null&&s.workDays>maxWD)w.push({message:`${name}: ${s.workDays} giorni lavorati (max ${maxWD})`});if(_ot){const _thr=STAFF_CONFIG[name].maxAfternoons+1;if(_ot.requiresShift&&s.afternoons>=_thr&&!week.days.some(d=>worksOvertimeShift(name,d.assignments[name])))w.push({message:`${name}: straordinario pomeridiano richiede turno ${fmt(_ot.requiresShift.s)}-${fmt(_ot.requiresShift.e)}`});if(s.afternoons>_ot.maxAfternoons)w.push({message:`${name}: mai più di ${_ot.maxAfternoons} pomeriggi`});}}for(const day of week.days){const req=getRequiredCoverage(day),cov=getCoverage(day);if(cov.morning<req.morning)w.push({message:`${day.label}: apertura 08:30 scoperta`});if(cov.morningPair<req.morningPair)w.push({message:`${day.label}: serve doppia mattina (9:30-13:30)`});if(day.key==='sat'&&cov.morning>1)w.push({message:`${day.label}: sabato solo un'assistente`});if(cov.afternoon<req.afternoon)w.push({message:`${day.label}: pomeriggio richiede ${req.afternoon}`});if(cov.close<req.close)w.push({message:`${day.label}: chiusura 19:00 scoperta`});if(cov.afternoonPair<req.afternoonPair)w.push({message:`${day.label}: serve doppio pomeriggio (14:00-18:00)`});if(!day.exceptions.holiday&&maxUncoveredGap(day)>LUNCH_GAP_MAX)w.push({message:`${day.label}: studio scoperto >30 min (pausa pranzo max 30')`});for(const n of ASSISTANT_NAMES){const sh=getShift(day.assignments[n]);if(sh.isLong&&!ASSIST[n].canWorkLong)w.push({message:`${n}: turno lungo non previsto (${day.label})`});if(sh.hours>8.5)w.push({message:`${n}: giornata pesante >8.5h (${day.label})`});}}return w;}
export function formatWeekRange(week){return`${formatItalianDate(week.days[0].date)} - ${formatItalianDate(week.days[week.days.length-1].date)}`;}
export function formatWeekRangeShort(week){return`${formatDateShort(week.days[0].date)}–${formatDateShort(week.days[week.days.length-1].date)}`;}

  // Turni ammessi per assistente/giorno: 'OFF' + coppie {s,e}. Chi non può fare lunghi (span>=7h30) li esclude.
export function getAllowedShifts(assistant,day,skipLock=false){
    // Festività (chiuso per tutti) o assenza personale (ferie/malattia): solo riposo.
    if(day.exceptions?.holiday||day.absences?.[assistant])return['OFF'];
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
export function generateWeek(options={}){const week=createBaseWeek(options.startDate??getCurrentMonday());applyPreviousWeekState(week,options.previousWeek);const r=solveWeekOptimized(week,options.ledger);const result=r.week??week;if(r.overtime)result.overtimeUsed=true;return result;}
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
  // Tier di distribuzione pomeriggi generati dalla config: si parte da tutti al loro
  // minAfternoons, poi si alza il tetto di una persona alla volta fino al suo soffitto
  // (maxAfternoons, o overtime.maxAfternoons se ha lo straordinario), nell'ordine di
  // escalationPriority. I tier che richiedono straordinario hanno ot:true.
export function computeAfternoonTiers(){
    const base=Object.fromEntries(ASSISTANT_NAMES.map(n=>[n,STAFF_CONFIG[n].minAfternoons]));
    const ceil=n=>{const c=STAFF_CONFIG[n];return c.overtime?c.overtime.maxAfternoons:c.maxAfternoons;};
    const escalators=ASSISTANT_NAMES.filter(n=>ceil(n)>STAFF_CONFIG[n].minAfternoons)
      .sort((a,b)=>STAFF_CONFIG[a].escalationPriority-STAFF_CONFIG[b].escalationPriority);
    const tiers=[{caps:{...base},ot:false}];
    let caps={...base};
    for(const n of escalators){caps={...caps,[n]:ceil(n)};tiers.push({caps:{...caps},ot:!!STAFF_CONFIG[n].overtime});}
    return tiers;
  }
export let AFTERNOON_TIERS=computeAfternoonTiers();
// Regole effettive per un tier di distribuzione pomeriggi (tetti pomeriggi + ore/giorni effettivi
// considerando festività/assenze). Estratto da solveWeek per riuso nel collettore ottimizzato.
export function buildTierRules(seedWeek,tier){
  return Object.fromEntries(ASSISTANT_NAMES.map(n=>{const c=STAFF_CONFIG[n];const inOt=tier.ot&&c.overtime&&tier.caps[n]>c.maxAfternoons;const baseWh=inOt?c.overtime.weeklyHours:ASSISTANTS[n].weeklyHours;const r={...ASSISTANTS[n],maxAfternoons:tier.caps[n],weeklyHours:effectiveWeeklyHours(n,seedWeek,baseWh)};if('workDays'in ASSISTANTS[n])r.workDays=effectiveWorkDays(n,seedWeek,ASSISTANTS[n].workDays);if('maxWorkDays'in ASSISTANTS[n])r.maxWorkDays=effectiveWorkDays(n,seedWeek,ASSISTANTS[n].maxWorkDays);return[n,r];}));
}
// Raccoglie settimane feasible (tutte valide) dal PRIMO tier di distribuzione pomeriggi ammesso,
// fino a `cap` soluzioni o esaurimento `budget`. Riusa getDayCombos/buildRem/validateWeek.
// Mantiene i vincoli hard (incluso il tetto chiusure closePref.max della persona con preferenza).
// Raccoglie settimane feasible (tutte valide) dal PRIMO tier di distribuzione pomeriggi ammesso,
// fino a `cap` soluzioni o esaurimento `budget`. Riusa getDayCombos/buildRem/validateWeek.
// Memoizza gli stati (pos,stats) SENZA alcuna completazione valida (dead): la validità dipende solo
// dagli aggregati, non dal prefisso, quindi è sound anche raccogliendo molte soluzioni distinte.
export function collectFeasibleWeeks(seedWeek,{cap=70,budget=SOLVE_BUDGET_FULL,avoidSigs}={}){
  const demand=afternoonDemand(seedWeek);
  const baseCombos=seedWeek.days.map((day,idx)=>getDayCombos(seedWeek,day,idx));
  const combosByDay=heuristicCombos(baseCombos);
  const D=seedWeek.days.length;
  const order=[...Array(D).keys()].sort((a,b)=>baseCombos[a].length-baseCombos[b].length);
  const orderedCombos=order.map(i=>combosByDay[i]);
  const rem=buildRem(seedWeek.days,order);
  const closeMax=CLOSE_PREF_PERSON?(STAFF_CONFIG[CLOSE_PREF_PERSON].closePref?.max??Infinity):Infinity;
  for(const tier of AFTERNOON_TIERS){
    if(demand>Object.values(tier.caps).reduce((a,b)=>a+b,0))continue;
    const tierRules=buildTierRules(seedWeek,tier);
    const pool=[],seen=new Set(),dead=new Set();let nodes=0;const placed=new Array(D);
    const keyOf=(pos,st)=>{let s=pos+'|';for(const a of ASSISTANT_NAMES){const x=st[a];s+=Math.round(x.hours*2)+','+x.afternoons+','+x.workDays+','+(x.closes||0)+';';}return s;};
    const feasibleAhead=(nextPos,st)=>{for(const a of ASSISTANT_NAMES){const rules=tierRules[a],s=st[a],r=rem[nextPos][a];if(s.hours>rules.weeklyHours)return false;if(s.afternoons>rules.maxAfternoons)return false;if(rules.workDays&&s.workDays>rules.workDays)return false;if(rules.maxWorkDays&&s.workDays>rules.maxWorkDays)return false;if(s.hours+r.maxHours<rules.weeklyHours)return false;if(s.hours+r.minHours>rules.weeklyHours)return false;if(s.afternoons+r.maxAfternoons<rules.minAfternoons)return false;if(rules.workDays&&(s.workDays+r.maxWorkDays<rules.workDays||s.workDays+r.minWorkDays>rules.workDays))return false;if(rules.maxWorkDays&&s.workDays+r.minWorkDays>rules.maxWorkDays)return false;}return true;};
    const visit=(pos,stats)=>{
      if(nodes>budget||pool.length>=cap)return false;nodes++;
      if(pos===D){const w=buildWeekFromDayAssignments(seedWeek,placed);if(validateWeek(w,tierRules).length!==0)return false;const sig=weekAssignmentSig(w);if((!avoidSigs||!avoidSigs.has(sig))&&!seen.has(sig)){seen.add(sig);pool.push(w);}return true;}
      const key=keyOf(pos,stats);if(dead.has(key))return false;
      let anyValid=false;
      for(const combo of orderedCombos[pos]){
        const d=combo.d,next=cloneStats(stats);
        for(const a of ASSISTANT_NAMES){const da=d[a];next[a].hours+=da.h;next[a].afternoons+=da.af;next[a].workDays+=da.wd;}
        if(CLOSE_PREF_PERSON){next[CLOSE_PREF_PERSON].closes+=d[CLOSE_PREF_PERSON].close;if(next[CLOSE_PREF_PERSON].closes>closeMax)continue;}
        if(OVERTIME_PERSON){const _thr=STAFF_CONFIG[OVERTIME_PERSON].maxAfternoons+1,_req=STAFF_CONFIG[OVERTIME_PERSON].overtime.requiresShift;if(_req&&next[OVERTIME_PERSON].afternoons>=_thr){let has=d[OVERTIME_PERSON].oReq;if(!has)for(let q=0;q<pos;q++){const pc=placed[order[q]];if(pc&&pc.d[OVERTIME_PERSON].oReq){has=true;break;}}if(!has)continue;}}
        if(!feasibleAhead(pos+1,next))continue;
        placed[order[pos]]=combo;const got=visit(pos+1,next);placed[order[pos]]=undefined;
        if(got)anyValid=true;
        if(nodes>budget||pool.length>=cap)return anyValid;
      }
      if(!anyValid)dead.add(key);
      return anyValid;
    };
    visit(0,Object.fromEntries(ASSISTANT_NAMES.map(n=>[n,{hours:0,afternoons:0,workDays:0,closes:0}])));
    if(pool.length)return{pool,overtime:tier.ot,tier};
  }
  return{pool:[],overtime:false,tier:null};
}
// Ottimizzatore: raccoglie le settimane feasible, le ordina per costo (poi per firma, per
// determinismo) e ritorna la migliore + le alternative. Se nessuna è feasible, diagnostica il motivo.
export function solveWeekOptimized(seedWeek,ledger,{avoidSigs}={}){
  const led=ledger||buildEquityLedger([],8);
  const{pool,overtime}=collectFeasibleWeeks(seedWeek,{avoidSigs});
  if(!pool.length)return{week:null,solved:false,overtime:false,reason:diagnoseInfeasibility(seedWeek)};
  pool.sort((a,b)=>{const ca=costOfWeek(a,led),cb=costOfWeek(b,led);if(ca!==cb)return ca-cb;const sa=weekAssignmentSig(a),sb=weekAssignmentSig(b);return sa<sb?-1:sa>sb?1:0;});
  const best=pool[0];if(overtime)best.overtimeUsed=true;
  return{week:best,solved:true,overtime,alternatives:pool.slice(1)};
}
// Spiegazione best-effort dell'infeasibilità: trova il primo vincolo hard non soddisfacibile.
export function diagnoseInfeasibility(seedWeek){
  const D=seedWeek.days.length,order=[...Array(D).keys()];
  const rem=buildRem(seedWeek.days,order),r0=rem[0];
  for(const n of ASSISTANT_NAMES){
    const target=effectiveWeeklyHours(n,seedWeek,ASSISTANTS[n].weeklyHours);
    if(r0[n].minHours>target)return`${n}: ore minime possibili ${r0[n].minHours} > target ${target} (sblocca un turno o riduci i giorni)`;
    if(r0[n].maxHours<target)return`${n}: ore massime possibili ${r0[n].maxHours} < target ${target}`;
    if(r0[n].maxAfternoons<ASSISTANTS[n].minAfternoons)return`${n}: pomeriggi disponibili insufficienti (${r0[n].maxAfternoons}/${ASSISTANTS[n].minAfternoons})`;
  }
  for(const day of seedWeek.days){
    const req=getRequiredCoverage(day);if(!req.morning&&!req.close)continue;
    if(req.morning&&!ASSISTANT_NAMES.some(n=>getAllowedShifts(n,day).some(a=>getShift(a).coversMorning)))return`${day.label}: nessuna disponibile per l'apertura 08:30`;
    if(req.close&&!ASSISTANT_NAMES.some(n=>getAllowedShifts(n,day).some(a=>getShift(a).coversClose)))return`${day.label}: nessuna disponibile per la chiusura 19:00`;
  }
  return'Vincoli combinati non soddisfacibili: prova a sbloccare qualche turno o ridurre le eccezioni.';
}
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
        if(demand>Object.values(tier.caps).reduce((a,b)=>a+b,0))continue;
        const tierRules=buildTierRules(seedWeek,tier);
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
export function solveWeekCore(seedWeek,maxClosesPref=Infinity,combosByDay,budget=SOLVE_BUDGET_FULL,avoidSigs,tierRules,pre){
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
        if(CLOSE_PREF_PERSON){next[CLOSE_PREF_PERSON].closes+=d[CLOSE_PREF_PERSON].close;if(next[CLOSE_PREF_PERSON].closes>maxClosesPref)continue;}
        if(OVERTIME_PERSON){const _thr=STAFF_CONFIG[OVERTIME_PERSON].maxAfternoons+1,_req=STAFF_CONFIG[OVERTIME_PERSON].overtime.requiresShift;if(_req&&next[OVERTIME_PERSON].afternoons>=_thr){let has=d[OVERTIME_PERSON].oReq;if(!has)for(let q=0;q<pos;q++){const pc=placed[order[q]];if(pc&&pc.d[OVERTIME_PERSON].oReq){has=true;break;}}if(!has)continue;}}
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
    // Generico su N persone, ma con indici per POSIZIONE (array, non oggetti per-nome) nel loop
    // caldo: il backtracking visita milioni di combinazioni e l'accesso per indice è molto più veloce.
    const names=ASSISTANT_NAMES,N=names.length;
    const allowed=names.map(n=>getAllowedShifts(n,day));
    const SH=allowed.map(a=>a.map(getShift));
    const req=getRequiredCoverage(day),isSat=day.key==='sat'&&day.exceptions?.satOpen,isHoliday=!!day.exceptions?.holiday,isWeekday=WEEKDAY_KEYS.includes(day.key)&&!isHoliday;
    const closePos=CLOSE_PREF_PERSON?names.indexOf(CLOSE_PREF_PERSON):-1;
    const otPos=OVERTIME_PERSON?names.indexOf(OVERTIME_PERSON):-1;
    const seen=new Map();
    const idx=new Array(N); // riusato per ogni foglia (niente allocazioni)
    const consider=()=>{
      if(isSat){let working=0;for(let p=0;p<N;p++)if(SH[p][idx[p]].hours>0)working++;if(working!==1)return;}
      else{
        let openers=0,aft=0,closes=0,mPair=0,aPair=0;
        for(let p=0;p<N;p++){const s=SH[p][idx[p]];
          if(s.coversMorning)openers++;
          if(s.isAfternoon)aft++;
          if(s.coversClose)closes++;
          if(req.morningPair&&s.startMin!=null&&s.startMin<=570&&s.endMin>=810)mPair++;
          if(req.afternoonPair&&s.startMin!=null&&s.startMin<=840&&s.endMin>=1080)aPair++;
        }
        if(openers!==req.morning)return;
        if(req.morningPair&&mPair<req.morningPair)return;
        if(aft<req.afternoon)return;
        if(closes<req.close)return;
        if(req.afternoonPair&&aPair<req.afternoonPair)return;
        // coverageDeficit alloca: solo per i pochi combo che passano tutti i check sopra.
        if(isWeekday){const sh=new Array(N);for(let p=0;p<N;p++)sh[p]=SH[p][idx[p]];if(coverageDeficit(sh,day.key)>LUNCH_GAP_MAX)return;}
      }
      // Firma + delta per persona. closePos aggiunge il flag chiusura, otPos il flag turno-straordinario.
      let sig='';const d={};
      for(let p=0;p<N;p++){const n=names[p],s=SH[p][idx[p]],af=countsAsAfternoon(n,s)?1:0,dn={h:s.hours,af,wd:s.hours>0?1:0};
        let part=s.hours+','+af;
        if(p===closePos){dn.close=s.coversClose?1:0;part+=','+dn.close;}
        if(p===otPos){dn.oReq=worksOvertimeShift(n,allowed[p][idx[p]])?1:0;part+=','+dn.oReq;}
        d[n]=dn;sig+=(p?'|':'')+part;
      }
      if(!seen.has(sig)){const combo={};for(let p=0;p<N;p++)combo[names[p]]=allowed[p][idx[p]];combo.d=d;seen.set(sig,combo);}
    };
    if(!isSat&&req.morning===1){
      // Esattamente 1 apertore: l'apertore è la posizione più esterna, gli altri (in ordine) tra i non-apertori.
      const openIdx=[],nonOpen=[];
      for(let p=0;p<N;p++){const oi=[],ni=[],arr=SH[p];for(let i=0;i<arr.length;i++)(arr[i].coversMorning?oi:ni).push(i);openIdx.push(oi);nonOpen.push(ni);}
      for(let op=0;op<N;op++){
        const others=[];for(let p=0;p<N;p++)if(p!==op)others.push(p);
        const rec=k=>{if(k===others.length){consider();return;}const p=others[k],list=nonOpen[p];for(let x=0;x<list.length;x++){idx[p]=list[x];rec(k+1);}};
        const ol=openIdx[op];for(let x=0;x<ol.length;x++){idx[op]=ol[x];rec(0);}
      }
    }else{
      const rec=p=>{if(p===N){consider();return;}const arr=SH[p];for(let i=0;i<arr.length;i++){idx[p]=i;rec(p+1);}};
      rec(0);
    }
    return [...seen.values()];
  }
export function cloneStats(stats){return Object.fromEntries(ASSISTANT_NAMES.map(a=>[a,{...stats[a]}]));}
export function buildWeekFromDayAssignments(seedWeek,assignments){const w=structuredClone(seedWeek);for(let i=0;i<w.days.length;i++)for(const a of ASSISTANT_NAMES)w.days[i].assignments[a]=assignments[i][a];return w;}
export function applyPreviousWeekState(week,prev){if(!prev)return;for(const day of week.days){const p=prev.days.find(d=>d.key===day.key);if(!p)continue;day.exceptions={...day.exceptions,...p.exceptions};day.absences={...day.absences,...(p.absences||{})};day.locks={...day.locks,...p.locks};for(const a of ASSISTANT_NAMES)if(day.locks[a])day.assignments[a]=p.assignments[a];}}
export function regenerateWeekWithFeedback(start,prev,ledger){const seed=createBaseWeek(start);applyPreviousWeekState(seed,prev);const r=solveWeekOptimized(seed,ledger);const week=r.week??seed;const locked=getLockedShiftCount(week);if(!r.solved)return{week,message:(locked?`Nessuna combinazione valida con i ${locked} turni bloccati: `:'Nessuna combinazione valida. ')+(r.reason||'')};const otMsg=r.overtime?` ⚠️ Straordinario attivato.`:'';return{week,message:(locked?`Rigenerata. ${locked} turni bloccati mantenuti.`:'Settimana rigenerata.')+otMsg};}
export function regenerateCleanWeekWithFeedback(start,ledger){const week=generateWeek({startDate:start,ledger});const otMsg=week.overtimeUsed?` ⚠️ Straordinario attivato.`:'';return{week,message:'Settimana pulita rigenerata.'+otMsg};}
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
          return s.hours===cur.hours&&s.coversMorning===cur.coversMorning&&s.coversClose===cur.coversClose&&s.isAfternoon===cur.isAfternoon&&countsAsAfternoon(n,s)===countsAsAfternoon(n,cur)&&worksOvertimeShift(n,a)===worksOvertimeShift(n,curA);
        });
        for(const alt of alts){day.assignments[n]=alt;if(validateWeek(w).length===0)break;day.assignments[n]=curA;}
      }
    }
    return w;
  }
export function regenerateAlternativeWithFeedback(start,current,avoidSigs,ledger){const seed=createBaseWeek(start);applyPreviousWeekState(seed,current);const r=solveWeekOptimized(seed,ledger,{avoidSigs});if(!r.solved)return{week:null,solved:false};const otMsg=r.overtime?` ⚠️ Straordinario attivato.`:'';return{week:r.week,solved:true,message:'Soluzione alternativa trovata.'+otMsg};}
export function updateShiftWithFeedback(week,dayKey,assistant,shiftId){const day=week.days.find(d=>d.key===dayKey);if(day)day.assignments[assistant]=shiftId;return{week,message:`${assistant} · ${day?.label} aggiornato.`};}
export function getLockedShiftCount(week){return week.days.reduce((c,d)=>c+Object.values(d.locks).filter(Boolean).length,0);}

// ── OTTIMIZZATORE (Fase 4): funzioni pure di costo ──
// Varianza di popolazione (media degli scarti quadratici). Misura di squilibrio.
export function variance(arr){if(arr.length===0)return 0;const m=arr.reduce((a,b)=>a+b,0)/arr.length;return arr.reduce((a,b)=>a+(b-m)*(b-m),0)/arr.length;}
// Ledger equità: somma opens/closes/saturdays/workDays per persona sulle ultime N settimane
// (più recenti per startDate). Persone non più in organico vengono ignorate (solo ASSISTANT_NAMES correnti).
export function buildEquityLedger(pastWeeks,N=8){
  const sorted=[...pastWeeks].filter(Boolean).sort((a,b)=>a.startDate<b.startDate?1:-1).slice(0,N);
  const led=Object.fromEntries(ASSISTANT_NAMES.map(n=>[n,{opens:0,closes:0,saturdays:0,workDays:0}]));
  for(const wk of sorted){const st=getAssistantStats(wk);for(const n of ASSISTANT_NAMES){const s=st[n];led[n].opens+=s.opens;led[n].closes+=s.closes;led[n].saturdays+=s.saturdays;led[n].workDays+=s.workDays;}}
  return led;
}
// Pesi globali della funzione costo (tarabili).
export let W_EQ=10, W_PREF=3, W_TIDY=0.1;
// Costo equità: per ogni onere {opens,closes,saturdays} calcola il tasso per persona
// rate_p = (storico_p + candidato_p) / max(1, workDays_storico_p + workDays_candidato_p)
// e somma la varianza dei tassi tra le persone. Tassi allineati = equo = costo basso.
export function equityCost(week,ledger){
  const cand=getAssistantStats(week);
  let cost=0;
  for(const duty of ['opens','closes','saturdays']){
    const rates=ASSISTANT_NAMES.map(n=>{const l=ledger[n]||{opens:0,closes:0,saturdays:0,workDays:0};const wd=l.workDays+cand[n].workDays;return (l[duty]+cand[n][duty])/Math.max(1,wd);});
    cost+=variance(rates);
  }
  return cost;
}
// Sotto-pesi del costo preferenze (tarabili).
export let PREF_W={dayOff:2, close:1, open:1, window:1};
// Costo preferenze: somma, per persona e per giorno lavorato, le violazioni soft dei desiderata.
export function preferenceCost(week){
  let cost=0;
  for(const n of ASSISTANT_NAMES){
    const pr=STAFF_CONFIG[n]?.preferences;if(!pr)continue;
    for(const day of week.days){
      const sh=getShift(day.assignments[n]);if(sh.hours===0)continue;
      if(pr.preferredDayOff&&day.key===pr.preferredDayOff)cost+=PREF_W.dayOff;
      if(pr.avoidClose&&sh.coversClose)cost+=PREF_W.close;
      if(pr.avoidOpen&&sh.coversMorning)cost+=PREF_W.open;
      if(pr.preferredWindow)cost+=PREF_W.window*windowPenalty(pr.preferredWindow,sh);
    }
  }
  return cost;
}
// Penalità finestra oraria preferita (in "ore" di scostamento, >=0).
export function windowPenalty(pref,sh){
  if(typeof pref==='object'&&pref){return (Math.abs(sh.startMin-pref.start)+Math.abs(sh.endMin-pref.end))/60;}
  if(pref==='early')return Math.max(0,sh.startMin-STUDIO_OPEN)/60;
  if(pref==='late')return Math.max(0,STUDIO_CLOSE-sh.endMin)/60;
  if(pref==='morning')return Math.max(0,sh.endMin-13*60)/60;
  if(pref==='afternoon')return sh.coversAfternoon?0:Math.max(0,13*60-sh.startMin)/60+1;
  return 0;
}
// Insieme di orari canonici {s,e} (dai template legacy) per il tie-break deterministico.
export const CANONICAL_SHIFTS=Object.values(LEGACY_TEMPLATES);
// Costo ordine: somma, per ogni turno lavorato, la distanza (in ore) dal template canonico più vicino.
// Termine minimo (W_TIDY piccolo): a parità di equità+preferenze preferisce orari "tondi" e rende la scelta stabile.
export function tidyCost(week){
  let cost=0;
  for(const day of week.days)for(const n of ASSISTANT_NAMES){
    const sh=getShift(day.assignments[n]);if(sh.hours===0)continue;
    let best=Infinity;
    for(const t of CANONICAL_SHIFTS){const d=(Math.abs(sh.startMin-t.s)+Math.abs(sh.endMin-t.e))/60;if(d<best)best=d;}
    cost+=best===Infinity?0:best;
  }
  return cost;
}
// Costo totale di una settimana (somma pesata). Più basso = migliore.
export function costOfWeek(week,ledger){
  return W_EQ*equityCost(week,ledger)+W_PREF*preferenceCost(week)+W_TIDY*tidyCost(week);
}

// ── EXPORT DATI (CSV) & RIEPILOGO PERIODO (Fase 5) ──
// Escape minimale CSV: racchiude tra virgolette se il campo contiene separatore, virgolette o a-capo.
export function csvEscape(v,sep=';'){const s=String(v??'');return new RegExp(`["\\n\\r]|\\${sep}`).test(s)?`"${s.replace(/"/g,'""')}"`:s;}
// Turni di una settimana in CSV: righe = giorni, colonne = assistenti; ultima riga = totale ore.
export function weekToCSV(week,{sep=';'}={}){
  const stats=getAssistantStats(week);
  const esc=v=>csvEscape(v,sep);
  const lines=[['Giorno','Data',...ASSISTANT_NAMES].map(esc).join(sep)];
  for(const day of week.days){
    const cells=ASSISTANT_NAMES.map(n=>{const sh=getShift(day.assignments[n]);return sh.id==='OFF'?'Riposo':`${fmt(sh.startMin)}-${fmt(sh.endMin)}`;});
    lines.push([day.label,formatItalianDate(day.date),...cells].map(esc).join(sep));
  }
  lines.push(['Totale ore','',...ASSISTANT_NAMES.map(n=>String(stats[n].hours))].map(esc).join(sep));
  return lines.join('\r\n');
}
// Estremi ISO (YYYY-MM-DD) di un mese 1-12.
export function monthBounds(year,month){
  const pad=n=>String(n).padStart(2,'0');
  const last=new Date(Date.UTC(year,month,0)).getUTCDate();
  return{start:`${year}-${pad(month)}-01`,end:`${year}-${pad(month)}-${pad(last)}`};
}
// Aggrega le statistiche per assistente sui giorni che cadono in [startDate,endDate] (confronto su stringa ISO).
// Granularità giornaliera: corretto anche per settimane a cavallo di due mesi.
export function summarizePeriod(weekList,startDate,endDate){
  const totals=Object.fromEntries(ASSISTANT_NAMES.map(n=>[n,{hours:0,afternoons:0,longShifts:0,saturdays:0,opens:0,closes:0,workDays:0}]));
  for(const wk of weekList){
    if(!wk?.days)continue;
    for(const d of wk.days){
      if(!d.date||d.date<startDate||d.date>endDate)continue;
      for(const n of ASSISTANT_NAMES){
        const t=totals[n];if(!t)continue;
        const sh=getShift(d.assignments?.[n]);
        t.hours+=sh.hours;
        if(sh.hours>0)t.workDays++;
        if(countsAsAfternoon(n,sh))t.afternoons++;
        if(sh.isLong)t.longShifts++;
        if(d.key==='sat'&&sh.hours>0)t.saturdays++;
        if(sh.coversMorning)t.opens++;
        if(sh.coversClose)t.closes++;
      }
    }
  }
  return totals;
}
// Riepilogo aggregato in CSV: una riga per assistente.
export function summaryToCSV(totals,{sep=';'}={}){
  const esc=v=>csvEscape(v,sep);
  const lines=[['Assistente','Ore','Giorni','Pomeriggi','Sabati','Aperture','Chiusure','Turni lunghi'].map(esc).join(sep)];
  for(const n of Object.keys(totals)){const t=totals[n]||{};
    lines.push([n,t.hours||0,t.workDays||0,t.afternoons||0,t.saturdays||0,t.opens||0,t.closes||0,t.longShifts||0].map(esc).join(sep));}
  return lines.join('\r\n');
}
