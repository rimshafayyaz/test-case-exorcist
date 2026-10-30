# product.md — Test Case Exorcist

Test Case Exorcist finds and fixes smells in manual test cases.

## Users
- Manual QA engineers reviewing hand-written or imported test suites.
- Teams using AI test generators (the exorcist acts as a quality gate for AI output).

## Core rules
- Every finding must point to an **exact step** (step number + field) and give a **one-sentence reason**.
- Fixes are **suggestions shown as before/after diffs**; never change a test without explicit user approval.
- The suite receives an **A–F score** so teams can track quality over time.
- Smell names and ghost personas come from `docs/smells.md`; never invent new names.

## Positioning
Turn 2023–2026 research prototypes into the first usable product:
- Step-level detection of the 7 published smells with ghost icons.
- One-click exorcism based on the research transformation catalog.
- Published precision/recall/F1 on a public dataset.
- Tool-agnostic: paste, CSV, Excel, Gherkin; CLI/CI gate; MCP server; Kiro hook.

## Demo happy path (must always work)
AI generates 15 test cases → upload → haunted steps light up → "Exorcise" shows diffs → accept → score D → A → same check via Kiro hook and via MCP.
