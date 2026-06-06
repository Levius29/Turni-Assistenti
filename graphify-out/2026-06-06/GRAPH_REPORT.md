# Graph Report - Turni-Assistenti-online  (2026-06-06)

## Corpus Check
- 6 files · ~8,615 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 52 nodes · 43 edges · 13 communities (5 shown, 8 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 1 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `6b448c5b`
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

## God Nodes (most connected - your core abstractions)
1. `Convenzioni test` - 11 edges
2. `Audit & miglioramento solver turni — Design` - 9 edges
3. `Fix di correttezza` - 4 edges
4. `Migliorie` - 4 edges
5. `hooks` - 3 edges
6. `Solver Audit & Fix — Implementation Plan` - 3 edges
7. `Fix di velocità` - 3 edges
8. `Combinazioni` - 3 edges
9. `PreToolUse` - 1 edges
10. `html` - 1 edges

## Surprising Connections (you probably didn't know these)
- `CLAUDE.md - Project Documentation` --conceptually_related_to--> `settings.json - Claude Code Hooks Config`  [INFERRED]
  CLAUDE.md → .claude/settings.json

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Shift Schedule Solver Pipeline** — index_generate_week, index_solve_week, index_solve_week_core, index_get_day_combos, index_validate_week [EXTRACTED 1.00]
- **Coverage Constraint Subsystem** — index_get_coverage, index_get_required_coverage, index_max_uncovered_gap, concept_studio_continuity [EXTRACTED 1.00]
- **UI Rendering Pipeline** — index_render, index_render_grid, index_render_summary, index_render_warnings, index_render_day_editor [EXTRACTED 1.00]

## Communities (13 total, 8 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.18
Nodes (11): Convenzioni test, Task 10: Verifica finale + graphify update, Task 1: #1+#2 — `coverageDeficit` (copertura cumulativa + debito pranzo), Task 2: #3 — `validateWeek` segnala giorni lavorati > max, Task 3: #4 — Niente mutazione globale di ASSISTANTS, Task 4: #6 — `rem` calcolato una volta in `solveWeek`, Task 5: #5 — `getDayCombos` pre-dedup per-assistente, Task 6: #7 — "Alternativa" con varietà oraria (+3 more)

### Community 2 - "Community 2"
Cohesion: 0.22
Nodes (8): #5 — `getDayCombos` da O(N³) a ~O(K³), #6 — `rem` calcolato una volta, Audit & miglioramento solver turni — Design, Contesto, Fix di velocità, Fuori scope, Principio architetturale, Test

### Community 3 - "Community 3"
Cohesion: 0.50
Nodes (4): #10 — Niente freeze UI durante il solve, #11 — jsPDF robusto, #9 — Pruning storage, Migliorie

### Community 5 - "Community 5"
Cohesion: 0.50
Nodes (4): #1 + #2 — Copertura unificata: `coverageDeficit`, #3 — `validateWeek` controlla i giorni lavorati, #4 — Niente mutazione globale di `ASSISTANTS`, Fix di correttezza

### Community 11 - "Community 11"
Cohesion: 0.67
Nodes (3): #7 — "Alternativa" con varietà oraria reale, #8 — Griglia 30 minuti, Combinazioni

## Knowledge Gaps
- **33 isolated node(s):** `PreToolUse`, `html`, `html`, `graphify`, `Task 1: #1+#2 — `coverageDeficit` (copertura cumulativa + debito pranzo)` (+28 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **8 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Audit & miglioramento solver turni — Design` connect `Community 2` to `Community 3`, `Community 11`, `Community 5`?**
  _High betweenness centrality (0.120) - this node is a cross-community bridge._
- **Why does `Convenzioni test` connect `Community 0` to `Community 10`?**
  _High betweenness centrality (0.059) - this node is a cross-community bridge._
- **Why does `Fix di correttezza` connect `Community 5` to `Community 2`?**
  _High betweenness centrality (0.040) - this node is a cross-community bridge._
- **What connects `PreToolUse`, `html`, `html` to the rest of the system?**
  _33 weakly-connected nodes found - possible documentation gaps or missing edges._