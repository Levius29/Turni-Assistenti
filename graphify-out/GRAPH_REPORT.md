# Graph Report - .  (2026-06-04)

## Corpus Check
- Corpus is ~4,253 words - fits in a single context window. You may not need a graph.

## Summary
- 41 nodes · 44 edges · 9 communities (5 shown, 4 thin omitted)
- Extraction: 91% EXTRACTED · 9% INFERRED · 0% AMBIGUOUS · INFERRED: 4 edges (avg confidence: 0.9)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Constraint Solver Core|Constraint Solver Core]]
- [[_COMMUNITY_PDF Export & Deploy|PDF Export & Deploy]]
- [[_COMMUNITY_UI Rendering|UI Rendering]]
- [[_COMMUNITY_Schedule Generation|Schedule Generation]]
- [[_COMMUNITY_Claude Code Hooks|Claude Code Hooks]]
- [[_COMMUNITY_Stats & Afternoon Logic|Stats & Afternoon Logic]]
- [[_COMMUNITY_Project Config|Project Config]]
- [[_COMMUNITY_Shift Templates|Shift Templates]]
- [[_COMMUNITY_Export Tests|Export Tests]]

## God Nodes (most connected - your core abstractions)
1. `validateWeek - Week Validation Rules` - 7 edges
2. `solveWeekCore - Backtracking Solver` - 6 edges
3. `solveWeek - Constraint Solver Entry Point` - 5 edges
4. `render - Main UI Render` - 5 edges
5. `getDayCombos - Valid Shift Combinations Per Day` - 5 edges
6. `getAssistantStats - Weekly Hours/Afternoon Stats` - 4 edges
7. `exportPDF - PDF Export Function` - 4 edges
8. `maxUncoveredGap - Continuity Constraint Check` - 3 edges
9. `renderGrid - Schedule Grid Renderer` - 3 edges
10. `ui-export.test.mjs - UI/Export Tests` - 3 edges

## Surprising Connections (you probably didn't know these)
- `CLAUDE.md - Project Documentation` --conceptually_related_to--> `settings.json - Claude Code Hooks Config`  [INFERRED]
  CLAUDE.md → .claude/settings.json
- `ui-export.test.mjs - UI/Export Tests` --references--> `index.html - Main Application`  [EXTRACTED]
  tests/ui-export.test.mjs → index.html
- `ui-export.test.mjs - UI/Export Tests` --references--> `exportPDF - PDF Export Function`  [EXTRACTED]
  tests/ui-export.test.mjs → index.html
- `ui-export.test.mjs - UI/Export Tests` --references--> `iPhone Safe Area Inset Handling`  [EXTRACTED]
  tests/ui-export.test.mjs → index.html
- `deploy.yml - GitHub Pages Deploy Workflow` --references--> `index.html - Main Application`  [INFERRED]
  .github/workflows/deploy.yml → index.html

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Shift Schedule Solver Pipeline** — index_generate_week, index_solve_week, index_solve_week_core, index_get_day_combos, index_validate_week [EXTRACTED 1.00]
- **Coverage Constraint Subsystem** — index_get_coverage, index_get_required_coverage, index_max_uncovered_gap, concept_studio_continuity [EXTRACTED 1.00]
- **UI Rendering Pipeline** — index_render, index_render_grid, index_render_summary, index_render_warnings, index_render_day_editor [EXTRACTED 1.00]

## Communities (9 total, 4 thin omitted)

### Community 0 - "Constraint Solver Core"
Cohesion: 0.33
Nodes (9): Backtracking Solver with Pruning and Memoization, Studio Continuity Constraint (08:30-19:00, max 30min gap), ASSISTANTS - Assistant Contract Config, getCoverage - Day Coverage Analysis, getDayCombos - Valid Shift Combinations Per Day, getRequiredCoverage - Required Coverage Per Day, maxUncoveredGap - Continuity Constraint Check, solveWeekCore - Backtracking Solver (+1 more)

### Community 1 - "PDF Export & Deploy"
Cohesion: 0.29
Nodes (7): iPhone Safe Area Inset Handling, drawPdfBadge - PDF Badge Drawing, exportPDF - PDF Export Function, getDayVariationLabel - Day Variation Labeler, index.html - Main Application, ui-export.test.mjs - UI/Export Tests, deploy.yml - GitHub Pages Deploy Workflow

### Community 2 - "UI Rendering"
Cohesion: 0.33
Nodes (7): buildDesktopGrid - Desktop Layout Renderer, buildMobileGrid - Mobile Layout Renderer, localStorage Persistence Layer, render - Main UI Render, renderDayEditor - Day Editor Panel Renderer, renderGrid - Schedule Grid Renderer, renderWarnings - Validation Warnings Renderer

### Community 3 - "Schedule Generation"
Cohesion: 0.33
Nodes (6): Overtime Fallback Strategy (Manuela +4h), Shift Locking - User Lock/Unlock of Assignments, afternoonDemand - Weekly Afternoon Demand Counter, generateWeek - Week Generation, regenerateWeekWithFeedback - Regen Preserving Locks, solveWeek - Constraint Solver Entry Point

### Community 5 - "Stats & Afternoon Logic"
Cohesion: 0.67
Nodes (3): countsAsAfternoon - Per-Assistant Afternoon Threshold, getAssistantStats - Weekly Hours/Afternoon Stats, renderSummary - Summary Panel Renderer

## Knowledge Gaps
- **12 isolated node(s):** `PreToolUse`, `html`, `SHIFT_TEMPLATES - Shift Definitions`, `generateWeek - Week Generation`, `renderDayEditor - Day Editor Panel Renderer` (+7 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **4 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `validateWeek - Week Validation Rules` connect `Constraint Solver Core` to `UI Rendering`, `Stats & Afternoon Logic`?**
  _High betweenness centrality (0.319) - this node is a cross-community bridge._
- **Why does `solveWeekCore - Backtracking Solver` connect `Constraint Solver Core` to `Schedule Generation`, `Stats & Afternoon Logic`?**
  _High betweenness centrality (0.276) - this node is a cross-community bridge._
- **Why does `getAssistantStats - Weekly Hours/Afternoon Stats` connect `Stats & Afternoon Logic` to `Constraint Solver Core`, `PDF Export & Deploy`?**
  _High betweenness centrality (0.267) - this node is a cross-community bridge._
- **What connects `PreToolUse`, `html`, `SHIFT_TEMPLATES - Shift Definitions` to the rest of the system?**
  _17 weakly-connected nodes found - possible documentation gaps or missing edges._