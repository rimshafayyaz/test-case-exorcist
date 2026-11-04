# Requirements Document

## Introduction

The LLM reviewer decides the cases the rule engine was unsure about (review candidates), turning the rule-based detector into a hybrid one. It is optional: detection stays synchronous, offline and free (smell-detector Req 1.3); the reviewer is a separate async step that needs a Gemini API key. Answers are cached, so the same question is never paid for twice and benchmarks can be re-run without a key.

Out of scope: LLM-written fixes (a later extension of spec `fixer`), the UI.

## Requirements

### Requirement 1 — Review candidates

**User Story:** As a QA engineer, I want uncertain steps decided by an AI model, so that I get more correct findings without paying for a model call on every step.

1. WHEN `reviewWithLlm(suite, result, client)` runs THEN the system SHALL ask one question per review candidate, with the smell's definition, the whole step and the rule engine's hint.
2. WHEN the model answers yes THEN the review candidate SHALL become a finding with `confidence: "hybrid"`, the model's reason (at most 25 words) and a span on the words it names when they occur in the text.
3. WHEN the model answers no THEN the review candidate SHALL be dropped.
4. WHEN a call fails or the answer is not the expected JSON THEN the review candidate SHALL be kept and the failure SHALL be recorded in `errors`; the reviewer SHALL NOT throw.
5. WHEN a cache is given THEN an answer for the same model and prompt SHALL be reused, and only valid answers SHALL be cached.
6. WHEN the reviewer runs THEN it SHALL NOT remove or change any rule finding.

### Requirement 2 — Gemini client

1. WHEN a call is made THEN the key SHALL be sent once, in the `x-goog-api-key` header, to the native `generateContent` endpoint; keys SHALL be treated as opaque strings ("AIza…" and "AQ.…").
2. WHEN a call is made THEN it SHALL ask for JSON output with temperature 0.
3. WHEN the server answers 429 or 5xx THEN the client SHALL retry with back-off, honouring the server's retry delay, up to `maxRetries`; other errors SHALL fail at once.
4. WHEN an error is reported THEN its message SHALL NOT contain the key.

### Requirement 3 — Sweep

1. WHEN `sweep` names smells THEN the reviewer SHALL also ask about every action and expected result that has no finding or review candidate for that smell.
2. WHEN a sweep question is answered yes THEN it SHALL become a finding with `confidence: "llm"`.
3. WHEN a sweep runs THEN the number of questions SHALL be reported, because every question is a model call.

### Requirement 4 — Benchmark

1. WHEN `pnpm bench:llm` runs THEN it SHALL report rules only, rules + reviewer and rules + reviewer + Ambiguous sweep on the human-labelled sample, and, with `--heldout`, rules vs rules + reviewer on the held-out test half.
2. WHEN `--dry-run` is given THEN no key and no network SHALL be needed, and the number of questions SHALL be shown.
