# Graph Report - Turni-Assistenti-online  (2026-06-06)

## Corpus Check
- 12 files · ~10,524 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 183 nodes · 344 edges · 15 communities (9 shown, 6 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 1 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `991d3e27`
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
1. `getShift()` - 14 edges
2. `render()` - 11 edges
3. `validateWeek()` - 11 edges
4. `Convenzioni test` - 11 edges
5. `buildDesktopGrid()` - 10 edges
6. `buildShiftContent()` - 10 edges
7. `generateWeek()` - 9 edges
8. `regenerateAlternativeWithFeedback()` - 9 edges
9. `Audit & miglioramento solver turni — Design` - 9 edges
10. `buildMobileGrid()` - 8 edges

## Surprising Connections (you probably didn't know these)
- `CLAUDE.md - Project Documentation` --conceptually_related_to--> `settings.json - Claude Code Hooks Config`  [INFERRED]
  CLAUDE.md → .claude/settings.json
- `openTeamEditor()` --calls--> `generateWeek()`  [EXTRACTED]
  src/app.js → src/scheduler.js
- `openTeamEditor()` --calls--> `reconfigure()`  [EXTRACTED]
  src/app.js → src/scheduler.js
- `buildDesktopGrid()` --calls--> `formatDateShort()`  [EXTRACTED]
  src/app.js → src/scheduler.js
- `buildMobileGrid()` --calls--> `formatDateShort()`  [EXTRACTED]
  src/app.js → src/scheduler.js

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Shift Schedule Solver Pipeline** — index_generate_week, index_solve_week, index_solve_week_core, index_get_day_combos, index_validate_week [EXTRACTED 1.00]
- **Coverage Constraint Subsystem** — index_get_coverage, index_get_required_coverage, index_max_uncovered_gap, concept_studio_continuity [EXTRACTED 1.00]
- **UI Rendering Pipeline** — index_render, index_render_grid, index_render_summary, index_render_warnings, index_render_day_editor [EXTRACTED 1.00]

## Communities (15 total, 6 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.14
Nodes (13): Convenzioni test, Self-Review, Solver Audit & Fix — Implementation Plan, Task 10: Verifica finale + graphify update, Task 1: #1+#2 — `coverageDeficit` (copertura cumulativa + debito pranzo), Task 2: #3 — `validateWeek` segnala giorni lavorati > max, Task 3: #4 — Niente mutazione globale di ASSISTANTS, Task 4: #6 — `rem` calcolato una volta in `solveWeek` (+5 more)

### Community 2 - "Community 2"
Cohesion: 0.10
Nodes (19): #10 — Niente freeze UI durante il solve, #11 — jsPDF robusto, #1 + #2 — Copertura unificata: `coverageDeficit`, #3 — `validateWeek` controlla i giorni lavorati, #4 — Niente mutazione globale di `ASSISTANTS`, #5 — `getDayCombos` da O(N³) a ~O(K³), #6 — `rem` calcolato una volta, #7 — "Alternativa" con varietà oraria reale (+11 more)

### Community 3 - "Community 3"
Cohesion: 0.08
Nodes (35): _altHistory, applyTheme(), buildShiftBadge(), changeWeek(), currentStart, dayEditorDiv, ensureWeekShape(), exportPDF() (+27 more)

### Community 5 - "Community 5"
Cohesion: 0.07
Nodes (28): AFTERNOON_END_THRESHOLD, AFTERNOON_TIERS, ASSISTANT_NAMES, ASSISTANTS, BASE_PAIRS, buildRem(), buildWeekFromDayAssignments(), cloneStats() (+20 more)

### Community 8 - "Export Tests"
Cohesion: 0.36
Nodes (8): buildDesktopGrid(), buildMobileGrid(), buildThemeToggle(), createCell(), createLockToggle(), getContractLabel(), isDayClosed(), renderGrid()

### Community 10 - "Community 10"
Cohesion: 0.20
Nodes (16): applyShiftClass(), buildShiftContent(), getPrintShiftLabel(), renderWarnings(), deriveShift(), diversifyTimes(), fmt(), getAllowedShifts() (+8 more)

### Community 11 - "Community 11"
Cohesion: 0.17
Nodes (17): deferHeavy(), doGenerate(), doReset(), requestAlternative(), afternoonDemand(), applyPreviousWeekState(), assign(), createBaseWeek() (+9 more)

### Community 13 - "Community 13"
Cohesion: 0.22
Nodes (8): compilerOptions, checkJs, lib, module, moduleResolution, noEmit, target, include

### Community 14 - "Community 14"
Cohesion: 0.25
Nodes (7): description, name, private, scripts, test, type, version

## Knowledge Gaps
- **61 isolated node(s):** `PreToolUse`, `module`, `target`, `moduleResolution`, `lib` (+56 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **6 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `getShift()` connect `Community 10` to `Community 3`, `Community 5`?**
  _High betweenness centrality (0.005) - this node is a cross-community bridge._
- **What connects `PreToolUse`, `module`, `target` to the rest of the system?**
  _61 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.14285714285714285 - nodes in this community are weakly interconnected._
- **Should `Community 2` be split into smaller, more focused modules?**
  _Cohesion score 0.1 - nodes in this community are weakly interconnected._
- **Should `Community 3` be split into smaller, more focused modules?**
  _Cohesion score 0.08292682926829269 - nodes in this community are weakly interconnected._
- **Should `Community 5` be split into smaller, more focused modules?**
  _Cohesion score 0.06722689075630252 - nodes in this community are weakly interconnected._