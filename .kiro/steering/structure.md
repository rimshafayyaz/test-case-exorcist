# structure.md — Test Case Exorcist

## Repo layout
```
test-case-exorcist/
  .kiro/
    steering/         # product.md  tech.md  structure.md  testing-domain.md
    specs/            # smell-detector/  llm-reviewer/  fixer/  scorer/
                      # importers/  cli-gate/  mcp-server/  haunted-ui/
    hooks/            # vitest-on-save.json  detector-on-dataset-save.json
                      # smells-doc-on-rule.json  benchmark-pre-commit.json
  packages/
    core/
      src/
        detectors/    # one .ts per smell + index.ts
        fixers/       # one .ts per smell transformation
        llm/          # reviewer.ts  schema.ts  cache.ts
        scorer/       # index.ts
        importers/    # csv.ts  excel.ts  gherkin.ts  paste.ts
        models/       # step.ts  finding.ts  suite.ts
      tests/          # mirrors src/ structure
    cli/
      src/index.ts    # commander entry point
    mcp/
      src/index.ts    # MCP stdio server
  apps/
    web/
      src/
        components/   # GhostBadge, DiffView, ScorePanel, UploadZone
        pages/        # Home, Results, About
      public/
  datasets/
    ubuntu/           # raw Ubuntu manual test cases
    labelled.csv      # ~150 hand-labelled steps (7 smells + clean)
    samples/          # small synthetic samples for hooks/demo
  bench/
    run.ts            # benchmark script
    results/          # JSON/Markdown benchmark results
  docs/
    project-brief.md  # problem, features, architecture, related work
    smells.md         # canonical smell definitions + examples
    architecture.md   # diagram + decision notes
    kiro-log.md       # date · feature · what Kiro did · screenshot
  LICENSE             # MIT
  README.md
```

## Naming conventions
- Smell detector files: `packages/core/src/detectors/<camelCaseSmellName>.ts`
  e.g., `ambiguousTest.ts`, `conditionalTest.ts`, `eagerAction.ts`
- Ghost persona names map 1-to-1 with smell names in `docs/smells.md`.
- Spec folders: `.kiro/specs/<kebab-case-feature>/`

## Import rules
- `apps/web` may import from `packages/core`.
- `packages/cli` and `packages/mcp` may import from `packages/core`.
- `packages/core` has **no** imports from apps or other packages.
- Circular imports are forbidden.
