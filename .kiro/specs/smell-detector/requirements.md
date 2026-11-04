# Requirements Document

## Introduction

The smell detector is the rule-based core of `@exorcist/core`. It checks every step of every manual test case for the 7 natural-language test smells defined in `docs/smells.md` and returns findings that point to an exact test case, step and field, with a one-sentence reason and the name of the research-defined fix. It runs synchronously with no network calls. Steps the rules cannot decide confidently are returned as review candidates for the LLM reviewer (a separate spec).

Out of scope: importing files (spec `importers`), LLM review (spec `llm-reviewer`), applying fixes (spec `fixer`) and scoring (spec `scorer`). The four stretch smells — Long Test Steps, Hard-Coded Values, Test Clones and Tacit Knowledge — are also out of scope for this spec.

## Requirements

### Requirement 1 — Run all detectors on a suite

**User Story:** As a QA engineer, I want every step of my test suite checked for all 7 smells in one call, so that I get a complete picture of my suite's quality.

#### Acceptance Criteria

1. WHEN `detectAll` receives a `TestSuite` THEN the system SHALL run all 7 detectors on every step of every test case.
2. WHEN the suite has no test cases or no steps THEN the system SHALL return an empty result without error.
3. WHEN detection runs THEN the system SHALL NOT make any network call and SHALL return synchronously.
4. WHEN a single detector throws an error THEN the system SHALL continue with the other detectors and SHALL report the error in the result's `errors` list.

### Requirement 2 — Precise findings

**User Story:** As a QA engineer, I want each finding to point to the exact step and field with a short reason, so that I can fix the problem quickly.

#### Acceptance Criteria

1. WHEN a smell is detected THEN the system SHALL produce a `Finding` with `caseId`, `stepIndex`, `field` (`action` | `verification` | `precondition`), `smellName`, `ghostName`, `reason`, `confidence: "rule"` and `fixName`.
2. WHEN a finding concerns specific words THEN the system SHALL include a `span` with the start and end character offsets in the field text.
3. WHEN a finding is produced THEN `reason` SHALL be one sentence of at most 25 words that names the problem in plain language.
4. WHEN a finding is produced THEN `ghostName` and `fixName` SHALL match the values in `docs/smells.md` for that smell.

### Requirement 3 — Ambiguous Test (Fog Wraith)

**User Story:** As a QA engineer, I want vague steps flagged, so that every tester runs the step the same way.

#### Acceptance Criteria

1. WHEN an action or verification contains a verb followed by an indefinite determiner (any, some, either, several, various, a few) or an indefinite pronoun THEN the system SHALL report Ambiguous Test.
2. WHEN an action or verification contains an indefinite pronoun, a comparative or superlative adjective, an adverb of manner or a comparative adverb THEN the system SHALL report Ambiguous Test.
3. WHEN an action or verification contains a word from the vague-word list in `docs/smells.md` THEN the system SHALL report Ambiguous Test.
4. WHEN a match relies only on a part-of-speech pattern (comparative/superlative) or on wording that is often fine (a command with an unnamed object "Insert a media card", "each"/"every", an unclear subject "It should …") THEN the system SHALL add the step to the review candidates instead of reporting a finding.

### Requirement 4 — Conditional Test (Fork Spirit)

**User Story:** As a QA engineer, I want steps with branching logic flagged, so that each test follows one path.

#### Acceptance Criteria

1. WHEN an action or verification contains a subordinating conjunction (e.g. if, when, whether, unless, otherwise, in case) THEN the system SHALL report Conditional Test.
2. WHEN "when" is used only as a time reference without a condition (e.g. "Note when the download finishes") THEN the system SHALL add the step to the review candidates instead of reporting a finding.
3. WHEN "or" joins two commands or two quoted options (alternative flows) THEN the system SHALL report Conditional Test; a list of labels ("Click OK, Cancel or Close") SHALL NOT be reported.

### Requirement 5 — Eager Action (Hydra)

**User Story:** As a QA engineer, I want steps that bundle several actions flagged, so that each step does one thing.

#### Acceptance Criteria

1. WHEN an action contains more than one imperative verb THEN the system SHALL report Eager Action.
2. WHEN reporting Eager Action THEN the reason SHALL state how many actions were found.
3. WHEN an action combines a command with a check ("Close flip and check app continuity") THEN the check SHALL count as an operation, so the step is reported as Eager Action as well as Misplaced Verification (2026 study rule). A step with only checks SHALL NOT be reported as Eager Action.

### Requirement 6 — Misplaced Action (Wanderer)

**User Story:** As a QA engineer, I want actions written in the verification field flagged, so that verifications only describe expected results.

#### Acceptance Criteria

1. WHEN a verification clause starts with an imperative verb that is not a verification verb THEN the system SHALL report Misplaced Action with `field: "verification"`.
2. WHEN a verification starts with a verification verb (verify, check, confirm, ensure, observe, see, …) THEN the system SHALL NOT report Misplaced Action.
3. WHEN a clause follows "and"/"or"/"then" inside a sentence that is a statement, or is a single word in a list, or is a label followed by ":" THEN the system SHALL NOT report it as Misplaced Action.
4. WHEN a verification starts with a shell command line (e.g. "sudo cat /proc/mdstat") THEN the system SHALL report Misplaced Action.

### Requirement 7 — Misplaced Precondition (Early Riser)

**User Story:** As a QA engineer, I want system state written as the first step flagged, so that preconditions are in the right place.

#### Acceptance Criteria

1. WHEN the first step's action describes system state (subject + auxiliary + past participle, e.g. "The monitor is not connected") THEN the system SHALL report Misplaced Precondition.
2. WHEN the first step's action contains prerequisite wording (prerequisite, beforehand, already) THEN the system SHALL report Misplaced Precondition.
3. WHEN the step is not the first step of its test case THEN the system SHALL NOT report plain state descriptions or prerequisite wording as Misplaced Precondition.
4. WHEN any step opens with "make sure" / "ensure that" / "ensure" followed by a setup state — a state description, a possession or capability ("you have", "supports") or a place ("is not in fullscreen mode") — THEN the system SHALL report Misplaced Precondition and NOT Misplaced Verification.
5. WHEN any step opens with a "With …:" prefix ("With an HDMI monitor plugged in: …") THEN the system SHALL report Misplaced Precondition with the span on the prefix.

### Requirement 8 — Misplaced Verification (Mixed Soul)

**User Story:** As a QA engineer, I want checks written in the action field flagged, so that actions only describe what to do.

#### Acceptance Criteria

1. WHEN an action contains a verification verb anywhere (e.g. "Close flip and check app continuity") THEN the system SHALL report Misplaced Verification.
2. WHEN an action contains outcome wording ("should", "must be displayed") THEN the system SHALL report Misplaced Verification.

### Requirement 9 — Unverified Action (Silent Ghost)

**User Story:** As a QA engineer, I want actions with no expected result flagged, so that every step can pass or fail.

#### Acceptance Criteria

1. WHEN a step has no non-empty verification THEN the system SHALL report Unverified Action with `field: "verification"`.
2. WHEN a step's verifications are all empty or whitespace THEN the system SHALL treat them as missing.
3. WHEN a verification starts with "TODO" (a placeholder added by the fixer) THEN every detector SHALL treat it as empty, so the step still counts as unverified until the tester writes the expected result.
4. WHEN the action already holds a check (Misplaced Verification) or is a setup state (Misplaced Precondition) THEN the system SHALL NOT also report Unverified Action.

### Requirement 10 — No double flagging

**User Story:** As a QA engineer, I want each problem reported once, so that results are easy to read.

#### Acceptance Criteria

1. WHEN two findings have the same `caseId`, `stepIndex`, `field`, `verificationIndex` and `smellName` THEN the system SHALL keep only one.
2. WHEN a word belongs to a group in the "Keyword ownership" table of `docs/smells.md` THEN only the detector that owns that group SHALL use it.

### Requirement 11 — Review candidates for the LLM

**User Story:** As a developer, I want uncertain cases passed to the LLM reviewer, so that accuracy improves without calling the LLM for every step.

#### Acceptance Criteria

1. WHEN a detector cannot decide confidently THEN the system SHALL add a `ReviewCandidate` with `caseId`, `stepIndex`, `smellName` and a short `hint`.
2. WHEN review candidates are returned THEN the system SHALL NOT also return a finding for the same step and smell. Each detector drops its review candidates for a step when it reports a finding for that step, and the orchestrator applies the same rule across detectors.
3. WHEN a review candidate concerns a verification THEN it SHALL include `field: "verification"` and `verificationIndex`, so the LLM reviewer knows which entry to examine.

### Requirement 12 — Performance and quality

**User Story:** As a developer, I want detection to be fast and well tested, so that it can run on save and in CI.

#### Acceptance Criteria

1. WHEN 1,000 steps are checked THEN detection SHALL complete in under 500 ms on a typical laptop.
2. WHEN tests run THEN every detector SHALL have unit tests with at least one smelly and one clean example from `docs/smells.md`.
3. WHEN the code is compiled THEN it SHALL pass TypeScript strict mode with no `any`.

### Requirement 13 — Public API

**User Story:** As a developer of the CLI, MCP server and web app, I want one simple entry point, so that every interface behaves the same.

#### Acceptance Criteria

1. WHEN another package imports `@exorcist/core` THEN it SHALL be able to use `detectAll`, `detectSmell` and the types `TestSuite`, `TestCase`, `Step`, `Finding`, `ReviewCandidate`, `DetectionResult`, `SmellName` and `FixName`.
