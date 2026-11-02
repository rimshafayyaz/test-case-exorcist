# Test Case Exorcist — Project Brief

Test Case Exorcist finds and fixes "smells" in manual test cases at the exact step, using the published research catalog of natural-language test smells. It offers one-click fixes shown as diffs, a suite score, measured accuracy, and works from a web app, a CLI quality gate, an MCP server and Kiro hooks.

Built for Kiroween 2026.

---

## Problem

Manual test cases are written by hand, and more and more by AI test generators. Steps are often vague, pack several actions together, hide preconditions, or have no expected result. A 2026 study of the public Ubuntu manual test suite found that **58.56% of test steps contain at least one smell**, and its authors note that "existing automated support remains limited."

Research prototypes exist, but there is no maintained, easy-to-use tool that detects these smells at step level, fixes them, and proves how accurate it is.

## Users

- Manual QA engineers writing and reviewing test cases
- QA leads reviewing large suites
- Teams using AI to generate test cases
- Students learning test design

## Principles

- Every finding points to an exact step and gives a one-sentence reason.
- Fixes are suggestions shown as diffs; nothing changes without user approval.
- Rules run first; the LLM is used only for uncertain or ambiguous steps.
- Only public or synthetic test data is used.

---

## The 7 smells

The 7 smells studied in 2025–2026 (from the 8-smell catalog of Soares et al. 2023, minus Tacit Knowledge). Full definitions, examples and fixes: [docs/smells.md](smells.md).

| Smell (ghost name) | Meaning | Smelly example | Detection (research rule) | Fix (2024 catalog) |
|---|---|---|---|---|
| Ambiguous Test (Fog Wraith) | Under-specified step | "Open any application and suspend machine" | Indefinite determiners/pronouns, comparatives, manner adverbs, vague words | Extract Ambiguity |
| Conditional Test (Fork Spirit) | Branching inside a step | "If you have a USB drive, plug it in" | Any subordinating conjunction | Extract Conditional |
| Eager Action (Hydra) | Several actions in one step | "Open settings, change language and save" | More than one imperative verb | Separate Actions |
| Misplaced Action (Wanderer) | Action written as a verification | Verification: "Click OK" | Non-verification imperative verb in a verification | Extract Action |
| Misplaced Precondition (Early Riser) | Precondition written as a step | Step 1: "The monitor is not connected" | First step describes state (subject + auxiliary + past participle) | Extract Precondition |
| Misplaced Verification (Mixed Soul) | Verification written as an action | "Close flip and check app continuity" | Verification verb anywhere in the action, or "should" | Extract Verification |
| Unverified Action (Silent Ghost) | Action with no verification | Action with no expected result | No verification before the next action | Fill Verification |

---

## Features

| Feature | MVP | Stretch |
|---|---|---|
| Import | Paste text; CSV/Excel (step, expected); Gherkin `.feature` | Xray/Zephyr/TestRail exports |
| Detect | 7 smells at step level, highlighted with reason | Custom team rules; confidence |
| Explain | One-sentence reason + link to definition | Learn mode with examples |
| Exorcise | One-click fix per finding as a before/after diff; accept/reject | "Exorcise all" |
| Score | Suite grade A–F, smells per step, counts by type | Trends over time |
| Export | Fixed CSV/Excel + Markdown report | Push back to test tools |
| Gate | `exorcist check tests.csv --max-density 0.2` (non-zero exit) | GitHub Action, pre-commit |
| MCP | `detect_smells`, `fix_step`, `score_suite` | Prompt templates for AI generators |
| Haunted UI | Dark theme, ghost per smell, exorcism animation | Sound toggle |

**Main demo path:** AI-generated test cases → upload → smelly steps highlighted → fixes shown as diffs → accept → grade improves → the same check runs from a Kiro hook and over MCP.

---

## Architecture

```mermaid
flowchart TD
  W[Web app] --> I[Importers: paste, CSV, Excel, Gherkin]
  C[CLI gate] --> I
  M[MCP server] --> I
  K[Kiro hook] --> I
  I --> R[Rule detectors]
  R --> L[LLM reviewer: uncertain steps only]
  L --> F[Fixer: research fix catalog, diffs]
  F --> S[Scorer: A-F grade]
  S --> O[Results: highlights, diffs, score, report, CI exit code]
```

## Tech stack

| Layer | Choice |
|---|---|
| Core | TypeScript package `@exorcist/core` |
| NLP rules | `compromise` + regex word lists |
| LLM | JSON-capable API, validated with `zod`, cached by step hash |
| Parsing | `papaparse`, `xlsx`, `@cucumber/gherkin` |
| Web | React + Vite + Tailwind; Monaco diff view |
| CLI | `commander` |
| MCP | `@modelcontextprotocol/sdk` (stdio) |
| Tests | Vitest, Playwright |

```
test-case-exorcist/
  .kiro/            # steering, specs, hooks
  packages/core/    # detectors, fixers, scorer
  packages/cli/     # exorcist check / fix
  packages/mcp/     # MCP server
  apps/web/         # haunted UI + API
  datasets/         # public samples + labelled benchmark set
  bench/            # benchmark scripts and results
  docs/             # smells, architecture, how Kiro built this
```

---

## Benchmark plan

1. Primary benchmark: the 2026 study's published labelled sample (103 Ubuntu steps, 15 test cases) from [Zenodo](https://doi.org/10.5281/zenodo.20549059). This allows a direct comparison on the same data with Gemini 3 (F1 0.91), GPT-5.2 (F1 0.82) and Manual Test Sensei (F1 0.66).
2. Extra set: about 100 more hand-labelled Ubuntu steps to cover rarer smells.
3. Compare rules only, LLM only, and hybrid.
4. Report precision, recall and F1 per smell and overall, plus time and cost per 100 steps.
5. Limits: small samples, single labeller for our extra set, English only.

---

## Related work

| Work | What it does | How this project differs |
|---|---|---|
| [Hunting for Smells in Natural Language Tests (2013)](https://wwwbroy.in.tum.de/publ/papers/ICSE13Hauptmann.pdf) | First natural-language test smells (7); every industrial suite had all of them | Builds on its Ambiguous and Conditional smells |
| [Manual Tests Do Smell! (2023)](https://arxiv.org/abs/2308.01386) | Smell catalog + NLP prototype | Usable product built on the catalog |
| [Transformation catalog (2024)](https://arxiv.org/pdf/2404.16992) | How to remove each smell | Applied as one-click diff fixes |
| [Beyond Green Tests (SBQS 2025)](https://sol.sbc.org.br/index.php/sbqs/article/view/39054) | Research tool that detects and corrects 7 smells (83.7% F-measure, 91.43% acceptance by 15 professionals) | Shows fixes are wanted; we ship them as a usable, multi-format product |
| [Quality attributes of test cases (2025)](https://arxiv.org/abs/2507.06343) | Survey of 354 testers: weak definitions, missing metrics and no review process are key problems | Gives teams a metric (grade) and a review step |
| [Small language models study (2025)](https://arxiv.org/html/2507.13035) | SLMs detect smells | Hybrid rules + LLM in a tool |
| [Gemini 3 study (2026)](https://arxiv.org/html/2606.13804) | LLM detection; 58.56% of steps smelly | Adds fixes, CI gate, MCP |
| [Manual Test Sensei](https://github.com/easy-software-ufal/manual-test-sensei) | Rule-based research detector | UI, more formats, LLM, benchmark |
| [Manual Test Alchemist](https://github.com/easy-software-ufal/manual-test-alchemist) | Research detector + remover | Multi-format, diffs, maintained |
| [NALABS](https://github.com/eduardenoiu/NALABS) | Smells in requirements and test specs | Step-level, test-specific |
| [Testomat.io quality review](https://testomat.io/blog/test-case-quality-review/) | AI score per whole test case | Step-level smells, fixes, measured accuracy |
