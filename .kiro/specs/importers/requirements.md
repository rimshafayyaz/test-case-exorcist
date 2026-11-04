# Requirements Document

## Introduction

Importers turn the formats QA teams actually have — pasted text, CSV, Excel tables and our JSON — into a `TestSuite` for the detectors, fixer and scorer. They are pure functions in `@exorcist/core` (no file system): the web app and CLI read the file and pass its text or rows. Every importer returns the suite plus plain-language warnings, and fails with a clear `ImportError` when nothing usable is found. The web app offers them through one dropdown (spec haunted-ui).

## Requirements

### Requirement 1 — Pasted text
1. WHEN text with numbered lines ("1.", "1)", "Step 1:") is imported THEN each numbered line SHALL become a step.
2. WHEN a line starts with "Expected:", "Result:", "=>", "->", "→" or "✓", or is a "-" bullet under a step, THEN it SHALL become an expected result of that step.
3. WHEN a line starts with "Test case:", "TC:", "Title:" or "#" THEN it SHALL start a new test case; "Preconditions:" and the "-" lines after it SHALL become preconditions.
4. WHEN an indented line follows a step THEN it SHALL continue that step's action.
5. WHEN no numbered step is found THEN the importer SHALL fail with a message that explains the expected layout.

### Requirement 2 — CSV and Excel tables
1. WHEN a table is imported THEN its first non-empty row SHALL be the header, and columns SHALL be found by common names (test case / title / precondition / step / action / expected, with synonyms used by test-management exports).
2. WHEN rows share a test case id (or title, without an id column) THEN they SHALL form one test case; a row with only an expected result SHALL continue the step above.
3. WHEN an expected-result cell holds several lines THEN each line SHALL become a separate expected result, without list markers.
4. WHEN there is no action column THEN the importer SHALL fail and name the columns it found.
5. WHEN rows are skipped THEN a warning SHALL name the row number.
6. WHEN CSV is imported THEN comma, semicolon and tab delimiters and the Excel UTF-8 BOM SHALL be handled (papaparse).

### Requirement 3 — JSON
1. WHEN our `TestSuite` JSON is imported THEN it SHALL be read as is.
2. WHEN the JSON is a bare array of test cases, uses "expected" instead of "verifications", or lacks ids and step indexes, THEN the importer SHALL fill sensible defaults.
3. WHEN the JSON is invalid or has no test cases THEN the importer SHALL fail with a clear message.

### Requirement 4 — Traceability
1. WHEN a step is imported from text or a table THEN `step.source` SHALL hold its line or row number, so findings can point back to the original file.
