# Graph Report - .  (2026-06-06)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 195 nodes · 364 edges · 17 communities (9 shown, 8 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 2 edges (avg confidence: 0.88)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `5ce31525`
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

## God Nodes (most connected - your core abstractions)
1. `getShift()` - 14 edges
2. `validateWeek()` - 13 edges
3. `render()` - 11 edges
4. `buildShiftContent()` - 11 edges
5. `Convenzioni test` - 11 edges
6. `Audit & miglioramento solver turni — Design` - 11 edges
7. `buildDesktopGrid()` - 10 edges
8. `generateWeek()` - 9 edges
9. `regenerateAlternativeWithFeedback()` - 9 edges
10. `buildMobileGrid()` - 8 edges

## Surprising Connections (you probably didn't know these)
- `CLAUDE.md - Project Documentation` --conceptually_related_to--> `settings.json - Claude Code Hooks Config`  [INFERRED]
  CLAUDE.md → .claude/settings.json
- `CI Workflow` --calls--> `tests/solver-logic.test.mjs`  [EXTRACTED]
  .github/workflows/ci.yml → tests/solver-logic.test.mjs
- `Deploy Workflow` --calls--> `tests/solver-logic.test.mjs`  [EXTRACTED]
  .github/workflows/deploy.yml → tests/solver-logic.test.mjs
- `Audit & miglioramento solver turni — Design` --conceptually_related_to--> `coverageDeficit`  [EXTRACTED]
  docs/superpowers/specs/2026-06-06-solver-audit-design.md → index.html
- `openTeamEditor()` --calls--> `fmt()`  [EXTRACTED]
  src/app.js → src/scheduler.js

## Import Cycles
- None detected.

## Communities (17 total, 8 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.07
Nodes (42): _altHistory, changeWeek(), currentStart, dayEditorDiv, deferHeavy(), doGenerate(), doReset(), renderSummary() (+34 more)

### Community 1 - "PDF Export & Deploy"
Cohesion: 0.12
Nodes (25): AFTERNOON_END_THRESHOLD, buildRem(), cloneStats(), countsAsAfternoon(), coverageDeficit(), coverageOf(), defaultStaffConfig(), diversifyTimes() (+17 more)

### Community 2 - "Community 2"
Cohesion: 0.08
Nodes (23): coverageDeficit, getDayCombos, solveWeek, validateWeek, Audit & miglioramento solver turni — Design, #10 — Niente freeze UI durante il solve, #11 — jsPDF robusto, #1 + #2 — Copertura unificata: `coverageDeficit` (+15 more)

### Community 3 - "Community 3"
Cohesion: 0.17
Nodes (20): applyShiftClass(), buildDesktopGrid(), buildMobileGrid(), buildShiftBadge(), buildShiftContent(), buildThemeToggle(), createCell(), createLockToggle() (+12 more)

### Community 4 - "Claude Code Hooks"
Cohesion: 0.11
Nodes (17): CI Workflow, Deploy Workflow, jsPDF, Convenzioni test, Self-Review, Task 10: Verifica finale + graphify update, Task 1: #1+#2 — `coverageDeficit` (copertura cumulativa + debito pranzo), Task 2: #3 — `validateWeek` segnala giorni lavorati > max (+9 more)

### Community 5 - "Community 5"
Cohesion: 0.23
Nodes (12): applyTheme(), ensureWeekShape(), exportPDF(), getCurrentWeek(), render(), renderDayEditor(), renderWarnings(), toggleTheme() (+4 more)

### Community 6 - "Project Config"
Cohesion: 0.22
Nodes (8): compilerOptions, checkJs, lib, module, moduleResolution, noEmit, target, include

### Community 7 - "Shift Templates"
Cohesion: 0.25
Nodes (7): description, name, private, scripts, test, type, version

### Community 8 - "Export Tests"
Cohesion: 0.40
Nodes (5): openTeamEditor(), saveStaff(), computeAfternoonTiers(), getStaffConfig(), reconfigure()

## Knowledge Gaps
- **65 isolated node(s):** `PreToolUse`, `module`, `target`, `moduleResolution`, `lib` (+60 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **8 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Audit & miglioramento solver turni — Design` connect `Community 2` to `Claude Code Hooks`?**
  _High betweenness centrality (0.036) - this node is a cross-community bridge._
- **Why does `Solver Audit & Fix Implementation Plan` connect `Claude Code Hooks` to `Community 2`?**
  _High betweenness centrality (0.028) - this node is a cross-community bridge._
- **What connects `PreToolUse`, `module`, `target` to the rest of the system?**
  _65 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.06914893617021277 - nodes in this community are weakly interconnected._
- **Should `PDF Export & Deploy` be split into smaller, more focused modules?**
  _Cohesion score 0.11822660098522167 - nodes in this community are weakly interconnected._
- **Should `Community 2` be split into smaller, more focused modules?**
  _Cohesion score 0.08333333333333333 - nodes in this community are weakly interconnected._
- **Should `Claude Code Hooks` be split into smaller, more focused modules?**
  _Cohesion score 0.10526315789473684 - nodes in this community are weakly interconnected._