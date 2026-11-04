# Implementation Plan

- [x] 1. Table importer `src/importers/rows.ts` (column synonyms, grouping, multi-line cells, warnings) — _Req 2.1–2.5, 4.1_
- [x] 2. CSV importer with papaparse `src/importers/csv.ts` — _Req 2.6_
- [x] 3. JSON importer `src/importers/json.ts` — _Req 3.1–3.3_
- [x] 4. Text importer `src/importers/text.ts` — _Req 1.1–1.5, 4.1_
- [x] 5. `importSuite(format, text)` for the web app dropdown; public API exports; unit tests
- [ ] 6. Excel (.xlsx) in the web app: read rows with `read-excel-file`, pass them to `importRows` (spec haunted-ui)
- [ ] 7. Gherkin (.feature) importer (stretch)
