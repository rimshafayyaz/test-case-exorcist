# tech.md — Test Case Exorcist

## Language & style
- TypeScript everywhere, strict mode (`"strict": true` in all tsconfigs).
- ESM modules; no CommonJS unless a dependency forces it.
- Prettier + ESLint; match existing formatting before adding code.

## Package structure
```
test-case-exorcist/
  packages/core/   # detectors, fixers, scorer — zero UI deps
  packages/cli/    # commander → npx exorcist check
  packages/mcp/    # @modelcontextprotocol/sdk stdio server
  apps/web/        # React + Vite + Tailwind + Monaco diff
```
pnpm workspaces; build with Vite/tsup per package.

## Core engine rules
- **Rules run before the LLM.** Only escalate to LLM when the rule result is uncertain/ambiguous.
- Rule detectors live in `packages/core/src/detectors/`; one file per smell.
- NLP rules: `compromise` for POS tagging + regex word lists.
- LLM: any JSON-capable API (e.g. Amazon Bedrock or Gemini). Validate every response with `zod`.
- **Cache LLM calls by step hash** to avoid redundant API calls and control cost.
- No secrets in code; use `.env` (listed in `.gitignore`).

## Data & accuracy
- Parse with `papaparse` (CSV), `xlsx` (Excel), `@cucumber/gherkin` (Gherkin).
- Web: React + Vite + Tailwind; Monaco editor for diff views.
- API layer: Fastify (or Vite server routes for simplicity).
- Tests: Vitest (core/cli/mcp), Playwright E2E (demo happy path).
- Hosting: Vercel / Render / AWS free tier.

## LLM output contract
LLM must return JSON; always validate with zod before trusting any field.
Schema lives in `packages/core/src/llm/schema.ts`.
