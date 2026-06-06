# Graph Report - Turni-Assistenti-online  (2026-06-06)

## Corpus Check
- 18 files · ~18,837 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 252 nodes · 445 edges · 20 communities (10 shown, 10 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 2 edges (avg confidence: 0.88)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `c5f07227`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- [[_COMMUNITY_Community 0|Community 0]]
- [[_COMMUNITY_PDF Export & Deploy|PDF Export & Deploy]]
- [[_COMMUNITY_Community 2|Community 2]]
- [[_COMMUNITY_Community 3|Community 3]]
- [[_COMMUNITY_Claude Code Hooks|Claude Code Hooks]]
- [[_COMMUNITY_Community 5|Community 5]]
- [[_COMMUNITY_Project Config|Project Config]]
- [[_COMMUNITY_Shift Templates|Shift Templates]]
- [[_COMMUNITY_Export Tests|Export Tests]]
- [[_COMMUNITY_Community 9|Community 9]]
- [[_COMMUNITY_Community 10|Community 10]]
- [[_COMMUNITY_Community 11|Community 11]]
- [[_COMMUNITY_Community 12|Community 12]]
- [[_COMMUNITY_Community 13|Community 13]]
- [[_COMMUNITY_Community 14|Community 14]]
- [[_COMMUNITY_Community 15|Community 15]]
- [[_COMMUNITY_Community 16|Community 16]]
- [[_COMMUNITY_Community 17|Community 17]]
- [[_COMMUNITY_Community 18|Community 18]]
- [[_COMMUNITY_Community 19|Community 19]]

## God Nodes (most connected - your core abstractions)
1. `getShift()` - 16 edges
2. `Ottimizzatore turni Fase 4 — Implementation Plan` - 15 edges
3. `validateWeek()` - 13 edges
4. `Convenzioni test` - 12 edges
5. `render()` - 11 edges
6. `buildShiftContent()` - 11 edges
7. `Audit & miglioramento solver turni — Design` - 11 edges
8. `buildDesktopGrid()` - 10 edges
9. `generateWeek()` - 10 edges
10. `regenerateAlternativeWithFeedback()` - 10 edges

## Surprising Connections (you probably didn't know these)
- `CLAUDE.md - Project Documentation` --conceptually_related_to--> `settings.json - Claude Code Hooks Config`  [INFERRED]
  CLAUDE.md → .claude/settings.json
- `CI Workflow` --calls--> `tests/solver-logic.test.mjs`  [EXTRACTED]
  .github/workflows/ci.yml → tests/solver-logic.test.mjs
- `Deploy Workflow` --calls--> `tests/solver-logic.test.mjs`  [EXTRACTED]
  .github/workflows/deploy.yml → tests/solver-logic.test.mjs
- `Audit & miglioramento solver turni — Design` --conceptually_related_to--> `coverageDeficit`  [EXTRACTED]
  docs/superpowers/specs/2026-06-06-solver-audit-design.md → index.html
- `openTeamEditor()` --calls--> `generateWeek()`  [EXTRACTED]
  src/app.js → src/scheduler.js

## Import Cycles
- None detected.

## Communities (20 total, 10 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.07
Nodes (49): _altHistory, applyTheme(), buildDesktopGrid(), buildLedgerFromStorage(), buildMobileGrid(), buildShiftBadge(), buildShiftContent(), buildThemeToggle() (+41 more)

### Community 1 - "PDF Export & Deploy"
Cohesion: 0.07
Nodes (40): renderWarnings(), AFTERNOON_END_THRESHOLD, AFTERNOON_TIERS, afternoonDemand(), ASSISTANT_NAMES, ASSISTANTS, BASE_PAIRS, buildRem() (+32 more)

### Community 2 - "Community 2"
Cohesion: 0.08
Nodes (23): coverageDeficit, getDayCombos, solveWeek, validateWeek, #10 — Niente freeze UI durante il solve, #11 — jsPDF robusto, #1 + #2 — Copertura unificata: `coverageDeficit`, #3 — `validateWeek` controlla i giorni lavorati (+15 more)

### Community 3 - "Community 3"
Cohesion: 0.18
Nodes (14): applyShiftClass(), renderSummary(), costOfWeek(), countsAsAfternoon(), equityCost(), getAssistantStats(), getLockedShiftCount(), getShift() (+6 more)

### Community 4 - "Claude Code Hooks"
Cohesion: 0.11
Nodes (18): CI Workflow, Deploy Workflow, jsPDF, Convenzioni test, Self-Review, Solver Audit & Fix — Implementation Plan, Task 10: Verifica finale + graphify update, Task 1: #1+#2 — `coverageDeficit` (copertura cumulativa + debito pranzo) (+10 more)

### Community 5 - "Community 5"
Cohesion: 0.10
Nodes (19): 1. Ledger equità — `buildEquityLedger(pastWeeks, N=8)`, 2. Costo equità — `equityCost(week, ledger)`, 3. Modello preferenze, 4. Costo preferenze — `preferenceCost(week)`, 5. Costo ordine — `tidyCost(week)`, 6. Funzione costo totale — `costOfWeek(week, ledger)`, 7. Motore cost-ranked — `solveWeekCore` modalità collect, 8. "Alternativa" — `regenerateAlternativeWithFeedback` (+11 more)

### Community 6 - "Project Config"
Cohesion: 0.22
Nodes (8): compilerOptions, checkJs, lib, module, moduleResolution, noEmit, target, include

### Community 7 - "Shift Templates"
Cohesion: 0.25
Nodes (7): description, name, private, scripts, test, type, version

### Community 8 - "Export Tests"
Cohesion: 0.12
Nodes (15): File Structure, Note di stile per l'esecutore, Ottimizzatore turni Fase 4 — Implementation Plan, Self-Review (eseguita dall'autore del piano), Task 10: app.js — ledger da storage + UI preferenze, Task 11: Performance, CSS, smoke browser, graphify, PR, Task 1: Ledger equità + helper varianza, Task 2: Costo equità (+7 more)

### Community 17 - "Community 17"
Cohesion: 0.20
Nodes (14): deferHeavy(), doGenerate(), doReset(), requestAlternative(), applyPreviousWeekState(), assign(), createBaseWeek(), createEmptyWeek() (+6 more)

## Knowledge Gaps
- **98 isolated node(s):** `PreToolUse`, `module`, `target`, `moduleResolution`, `lib` (+93 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **10 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Audit & miglioramento solver turni — Design` connect `Community 2` to `Claude Code Hooks`?**
  _High betweenness centrality (0.022) - this node is a cross-community bridge._
- **Why does `Solver Audit & Fix Implementation Plan` connect `Claude Code Hooks` to `Community 2`?**
  _High betweenness centrality (0.017) - this node is a cross-community bridge._
- **What connects `PreToolUse`, `module`, `target` to the rest of the system?**
  _98 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.07138047138047138 - nodes in this community are weakly interconnected._
- **Should `PDF Export & Deploy` be split into smaller, more focused modules?**
  _Cohesion score 0.07474747474747474 - nodes in this community are weakly interconnected._
- **Should `Community 2` be split into smaller, more focused modules?**
  _Cohesion score 0.08333333333333333 - nodes in this community are weakly interconnected._
- **Should `Claude Code Hooks` be split into smaller, more focused modules?**
  _Cohesion score 0.11052631578947368 - nodes in this community are weakly interconnected._