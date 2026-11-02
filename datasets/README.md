# Datasets

Only public or synthetic test cases are used in this project.

| Folder / file | Content | Source | Status |
|---|---|---|---|
| `samples/` | Small synthetic test suites for demos, hooks and tests | Written for this project | To do |
| `ubuntu/` | Ubuntu manual test cases (`<dl>`: `<dt>` action, `<dd>` verification) | Launchpad `ubuntu-manual-tests` | Check license before committing; otherwise use a download script |
| `benchmark/` | Labelled sample from the 2026 Gemini study (103 steps, 15 test cases) | Zenodo: https://doi.org/10.5281/zenodo.20549059 | Check license, then download |
| `labelled.csv` | Extra hand-labelled Ubuntu steps (`caseId, stepIndex, action, verifications, labels`) | Labelled by the author | To do |

## Rules

- Never add employer, client or real customer test cases.
- Record the source and license of every external file in this table.
- Labels use the smell ids from `docs/smells.md`, or `clean`.
