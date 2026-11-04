# Implementation Plan

- [x] 1. Types, prompt and answer parsing (`src/llm/types.ts`, `src/llm/prompt.ts`)
  - _Requirements: 1.1, 1.2_
- [x] 2. Gemini client with header key, JSON output, retries and rate interval (`src/llm/gemini.ts`), tested with a fake fetch
  - _Requirements: 2.1–2.4_
- [x] 3. Reviewer: review candidates, cache, failures kept, rule findings untouched, sweep (`src/llm/reviewer.ts`), tested with a fake model
  - _Requirements: 1.1–1.6, 3.1–3.3_
- [x] 4. Public API exports (`src/index.ts`)
- [x] 5. Benchmark script `bench/llm.ts` with file cache, `--heldout` and `--dry-run`; root scripts `bench`, `bench:heldout`, `bench:llm`
  - _Requirements: 4.1, 4.2_
- [x] 6. Run the benchmark with a real key and record the results in `bench/README.md` (gemini-3.5-flash-lite: rules 0.81 → rules + reviewer 0.83 with 8 calls; sweep 0.80, off by default)
  - _Requirements: 4.1_
