# Test Case Exorcist 👻

> Finds and fixes smells in manual test cases at the exact step.
> A Kiroween 2026 entry, built with [Kiro](https://kiro.dev).

**Status:** work in progress (build period Oct 30 – Dec 4, 2026).

## Why

Research on the public Ubuntu manual test suite found that **58.56% of test steps contain at least one natural-language test smell**: vague wording, several actions in one step, hidden preconditions, or no expected result ([2026 study](https://arxiv.org/abs/2606.13804)). Researchers have catalogued these smells since 2013, but there is still no easy-to-use tool for QA teams. Test Case Exorcist turns that research into one.

## What it will do

- Detect the 7 research-defined smells at the exact step ([catalog](docs/smells.md))
- Explain each finding in one sentence
- Propose the research-defined fix as a before/after diff you approve
- Grade the suite A–F
- Work everywhere: web app, CLI quality gate for CI, MCP server for AI agents, Kiro hooks

## Docs

- [Project brief](docs/project-brief.md): problem, features, benchmark plan, related work
- [Smell catalog](docs/smells.md): definitions, detection rules, examples, fixes
- [Architecture](docs/architecture.md)
- [Kiro log](docs/kiro-log.md): how Kiro was used to build this

## License

[MIT](LICENSE)
