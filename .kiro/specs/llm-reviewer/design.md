# Design Document

```
packages/core/src/llm/
  types.ts     LlmClient (name + complete), LlmCache, LlmVerdict, LlmStats
  gemini.ts    createGeminiClient — native endpoint, header key, JSON, retries, rate interval
  prompt.ts    SMELL_DEFINITIONS, buildPrompt, parseVerdict
  reviewer.ts  reviewWithLlm, memoryCache
bench/llm.ts   benchmark with a file cache (bench/llm-cache.json)
```

## Decisions

- **One question per decision** ("Is THIS text a <smell>?"), not one prompt per test case: answers map exactly onto review candidates, are easy to cache, and one bad answer only affects one step.
- **The model never overrules a rule finding.** It only decides what the rules marked as uncertain (and, in a sweep, what the rules found nothing for).
- **Confidence:** `hybrid` = the rules suspected it and the model confirmed it; `llm` = found by the model alone in a sweep.
- **Provider-neutral core:** `LlmClient` is two members; Gemini is the first implementation, chosen because the 2026 benchmark study used Gemini 3.
- **Free tier:** a minimum interval between calls (default 6.5 s in the benchmark) and retries on 429. The cache file lets an interrupted run continue.
- **Privacy:** on Google's free tier, prompts may be used to improve Google's products — only public or synthetic test cases should be sent.
- **Fair comparison note:** on the held-out half the reference labels are Gemini 3 output; a Gemini reviewer may agree with them more than with human labels.
