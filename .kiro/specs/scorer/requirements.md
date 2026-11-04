# Requirements Document

## Introduction

The scorer turns the detector output for a test suite into one A–F grade, a 0–100 score and a breakdown per smell and per test case, so teams can track the quality of their manual tests over time (product.md) and see the grade move from D to A after fixes in the demo. It is a pure, synchronous function in `@exorcist/core` with no network calls.

Out of scope: detecting smells (spec `smell-detector`), proposing fixes (spec `fixer`) and storing score history.

## Requirements

### Requirement 1 — Suite score

**User Story:** As a QA lead, I want one grade for a whole suite, so that I can see its quality at a glance and compare it over time.

#### Acceptance Criteria

1. WHEN `scoreSuite` receives a `TestSuite` and its `DetectionResult` THEN the system SHALL return a `score` from 0 to 100 and a `grade` from A to F.
2. WHEN the score is computed THEN it SHALL be the share of ghost-free step weight: `100 × (1 − Σ stepPenalty / totalSteps)`, rounded to a whole number, where a step's penalty is the sum of its finding weights capped at 1.
3. WHEN a finding has `severity: "normal"` THEN its weight SHALL be 1; WHEN it has `severity: "low"` THEN its weight SHALL be 0.25.
4. WHEN the grade is derived THEN A SHALL be ≥ 90, B ≥ 80, C ≥ 70, D ≥ 60 and F < 60.
5. WHEN the suite has no steps THEN the system SHALL return score 100, grade A and zero counts without error.
6. WHEN review candidates exist THEN they SHALL NOT lower the score and SHALL be counted separately as `uncertainSteps`.

### Requirement 2 — Breakdown

**User Story:** As a QA engineer, I want to see which smells and which test cases pull the grade down, so that I know where to start fixing.

#### Acceptance Criteria

1. WHEN a score is returned THEN it SHALL include `totalSteps`, `cleanSteps`, `findingCount` and a count per smell for all 7 smells (0 when absent).
2. WHEN a score is returned THEN it SHALL include one entry per test case with `caseId`, `title`, `score`, `grade` and `findingCount`, in suite order.
3. WHEN a score is returned THEN it SHALL include `worstSmell`: the smell with the most findings, or `null` when there are none.

### Requirement 3 — Public API

1. WHEN another package imports `@exorcist/core` THEN it SHALL be able to use `scoreSuite`, `gradeFor` and the `SuiteScore` and `CaseScore` types.
