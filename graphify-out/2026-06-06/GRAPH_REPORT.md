# Graph Report - Turni-Assistenti-online  (2026-06-06)

## Corpus Check
- 11 files · ~9,274 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 170 nodes · 320 edges · 15 communities (8 shown, 7 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 1 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `a2d7715e`
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

## God Nodes (most connected - your core abstractions)
1. `getShift()` - 13 edges
2. `render()` - 11 edges
3. `Convenzioni test` - 11 edges
4. `buildDesktopGrid()` - 10 edges
5. `buildShiftContent()` - 10 edges
6. `validateWeek()` - 10 edges
7. `regenerateAlternativeWithFeedback()` - 9 edges
8. `Audit & miglioramento solver turni — Design` - 9 edges
9. `buildMobileGrid()` - 8 edges
10. `generateWeek()` - 8 edges

## Surprising Connections (you probably didn't know these)
- `CLAUDE.md - Project Documentation` --conceptually_related_to--> `settings.json - Claude Code Hooks Config`  [INFERRED]
  CLAUDE.md → .claude/settings.json
- `buildDesktopGrid()` --calls--> `formatDateShort()`  [EXTRACTED]
  src/app.js → src/scheduler.js
- `buildMobileGrid()` --calls--> `formatDateShort()`  [EXTRACTED]
  src/app.js → src/scheduler.js
- `buildShiftContent()` --calls--> `getAllowedShifts()`  [EXTRACTED]
  src/app.js → src/scheduler.js
- `updateShiftBadge()` --calls--> `getShift()`  [EXTRACTED]
  src/app.js → src/scheduler.js

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Shift Schedule Solver Pipeline** — index_generate_week, index_solve_week, index_solve_week_core, index_get_day_combos, index_validate_week [EXTRACTED 1.00]
- **Coverage Constraint Subsystem** — index_get_coverage, index_get_required_coverage, index_max_uncovered_gap, concept_studio_continuity [EXTRACTED 1.00]
- **UI Rendering Pipeline** — index_render, index_render_grid, index_render_summary, index_render_warnings, index_render_day_editor [EXTRACTED 1.00]

## Communities (15 total, 7 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.14
Nodes (13): Convenzioni test, Self-Review, Solver Audit & Fix — Implementation Plan, Task 10: Verifica finale + graphify update, Task 1: #1+#2 — `coverageDeficit` (copertura cumulativa + debito pranzo), Task 2: #3 — `validateWeek` segnala giorni lavorati > max, Task 3: #4 — Niente mutazione globale di ASSISTANTS, Task 4: #6 — `rem` calcolato una volta in `solveWeek` (+5 more)

### Community 2 - "Community 2"
Cohesion: 0.10
Nodes (19): #10 — Niente freeze UI durante il solve, #11 — jsPDF robusto, #1 + #2 — Copertura unificata: `coverageDeficit`, #3 — `validateWeek` controlla i giorni lavorati, #4 — Niente mutazione globale di `ASSISTANTS`, #5 — `getDayCombos` da O(N³) a ~O(K³), #6 — `rem` calcolato una volta, #7 — "Alternativa" con varietà oraria reale (+11 more)

### Community 3 - "Community 3"
Cohesion: 0.09
Nodes (32): _altHistory, applyTheme(), buildShiftBadge(), changeWeek(), currentStart, dayEditorDiv, ensureWeekShape(), exportPDF() (+24 more)

### Community 5 - "Community 5"
Cohesion: 0.09
Nodes (29): renderWarnings(), AFTERNOON_END_THRESHOLD, AFTERNOON_TIERS, afternoonDemand(), ASSISTANT_NAMES, ASSISTANTS, BASE_PAIRS, buildRem() (+21 more)

### Community 10 - "Community 10"
Cohesion: 0.19
Nodes (17): applyShiftClass(), buildDesktopGrid(), buildMobileGrid(), buildShiftContent(), buildThemeToggle(), createCell(), createLockToggle(), getContractLabel() (+9 more)

### Community 11 - "Community 11"
Cohesion: 0.20
Nodes (14): deferHeavy(), doGenerate(), doReset(), requestAlternative(), applyPreviousWeekState(), assign(), createBaseWeek(), createEmptyWeek() (+6 more)

### Community 13 - "Community 13"
Cohesion: 0.22
Nodes (8): compilerOptions, checkJs, lib, module, moduleResolution, noEmit, target, include

### Community 14 - "Community 14"
Cohesion: 0.25
Nodes (7): description, name, private, scripts, test, type, version

## Knowledge Gaps
- **58 isolated node(s):** `PreToolUse`, `module`, `target`, `moduleResolution`, `lib` (+53 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **7 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What connects `PreToolUse`, `module`, `target` to the rest of the system?**
  _58 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.14285714285714285 - nodes in this community are weakly interconnected._
- **Should `Community 2` be split into smaller, more focused modules?**
  _Cohesion score 0.1 - nodes in this community are weakly interconnected._
- **Should `Community 3` be split into smaller, more focused modules?**
  _Cohesion score 0.09309309309309309 - nodes in this community are weakly interconnected._
- **Should `Community 5` be split into smaller, more focused modules?**
  _Cohesion score 0.09475806451612903 - nodes in this community are weakly interconnected._