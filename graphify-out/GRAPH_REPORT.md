# Graph Report - Turni-Assistenti  (2026-06-04)

## Corpus Check
- 3 files · ~4,599 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 11 nodes · 6 edges · 5 communities (0 shown, 5 thin omitted)
- Extraction: 83% EXTRACTED · 17% INFERRED · 0% AMBIGUOUS · INFERRED: 1 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `58043cdf`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- [[_COMMUNITY_PDF Export & Deploy|PDF Export & Deploy]]
- [[_COMMUNITY_Claude Code Hooks|Claude Code Hooks]]
- [[_COMMUNITY_Project Config|Project Config]]
- [[_COMMUNITY_Shift Templates|Shift Templates]]
- [[_COMMUNITY_Export Tests|Export Tests]]

## God Nodes (most connected - your core abstractions)
1. `hooks` - 2 edges
2. `html` - 1 edges
3. `PreToolUse` - 1 edges
4. `graphify` - 1 edges
5. `CLAUDE.md - Project Documentation` - 1 edges
6. `settings.json - Claude Code Hooks Config` - 1 edges
7. `deploy.yml - GitHub Pages Deploy Workflow` - 0 edges

## Surprising Connections (you probably didn't know these)
- `CLAUDE.md - Project Documentation` --conceptually_related_to--> `settings.json - Claude Code Hooks Config`  [INFERRED]
  CLAUDE.md → .claude/settings.json

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Shift Schedule Solver Pipeline** — index_generate_week, index_solve_week, index_solve_week_core, index_get_day_combos, index_validate_week [EXTRACTED 1.00]
- **Coverage Constraint Subsystem** — index_get_coverage, index_get_required_coverage, index_max_uncovered_gap, concept_studio_continuity [EXTRACTED 1.00]
- **UI Rendering Pipeline** — index_render, index_render_grid, index_render_summary, index_render_warnings, index_render_day_editor [EXTRACTED 1.00]

## Communities (5 total, 5 thin omitted)

## Knowledge Gaps
- **6 isolated node(s):** `html`, `PreToolUse`, `graphify`, `deploy.yml - GitHub Pages Deploy Workflow`, `CLAUDE.md - Project Documentation` (+1 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **5 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What connects `html`, `PreToolUse`, `graphify` to the rest of the system?**
  _6 weakly-connected nodes found - possible documentation gaps or missing edges._