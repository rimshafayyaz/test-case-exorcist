# Benchmark

Our rule-based detectors on the public sample of the 2026 Gemini 3 study:
103 step items from 14 Ubuntu manual test cases, labelled by the study's authors.

```
npx tsx bench/run.ts        # writes bench/results/gemini3-sample.md and .json
```

## Data and credit

`datasets/benchmark/gemini3-sample.json` is extracted from "Gemini 3.html" in:

> Lucas, K., Gheyi, R., Ribeiro, M., Palomba, F., Martins, L., Soares, E. *Dumps and Data for "An Empirical Study of Gemini 3 for Detecting Natural Language Test Smells in Manual Test Case"*. Zenodo, 2026. https://doi.org/10.5281/zenodo.20549059 — CC BY 4.0.

Each item keeps the test case, step order, field (`<dt>` action / `<dd>` verification), text, the authors' baseline labels and Gemini 3's labels.

## Scoring

Same as the study's confusion-matrix sheet: per item and smell label, TP = in both, FP = predicted only, FN = baseline only, TN = 1 when neither has a smell; F1 = 2·TP / (2·TP + FP + FN). Unverified Action is counted on the action item, as in the study.

Check: with Gemini 3's own labels this scoring gives TP 97, FP 9, FN 10, TN 30, **F1 0.91**, exactly the study's figure. `packages/core/tests/benchmark` re-checks this on every test run.

## Results

| | Precision | Recall | F1 |
|---|---|---|---|
| Test Case Exorcist, rules only, first run (before tuning) | 0.77 | 0.57 | 0.66 |
| **Test Case Exorcist, rules only (now)** | **0.92** | **0.72** | **0.81** |
| Test Case Exorcist, rules + review candidates | 0.91 | 0.79 | 0.84 |
| Gemini 3 (study data) | 0.92 | 0.91 | 0.91 |
| GPT-5.2 (published) | | | 0.82 |
| Manual Test Sensei (published) | | | 0.66 |

Rules only: no network, no AI, about 0.2 s for the whole sample. Per-smell numbers and every disagreement are in `results/gemini3-sample.md`.

## What changed between the first run and now

The first run (`results/gemini3-sample-v1-before-tuning.md`) showed where our rules differed from the study's published smell rules (its Prompt sheet). We aligned the rules with that published definition, not with individual items:

1. A step that does something **and** checks something is both Eager Action and Misplaced Verification.
2. "make sure" / "ensure" + a state description at the start of **any** step is Misplaced Precondition.
3. A step that holds its own check or is a setup state is not also Unverified Action.
4. Alternatives joined by "or" (two commands or two quoted options) are Conditional Test.
5. Ambiguous Test: more indefinite determiners (either, several, various, a few) and the study's subjective words (reasonable, approximately, briefly, as expected, …).
6. Smaller fixes: "right-click" / "double-click" as verbs, a quoted label as a verb's object, "is running" as a state.

## Held-out check (never seen while tuning)

The Zenodo package has human labels only for the sample, but it also holds Gemini 3's output for 101 Ubuntu test cases. Gemini 3 agrees with the human labels at F1 0.91, so we use its labels as a **silver standard** on the 80 test cases (2,464 items) that are not in the sample.

These 80 cases are split once, by sorted name, into two halves:

- **dev** (40 cases): may be looked at to improve the rules;
- **test** (40 cases, 1,284 items): never looked at; this is the honest number.

```
npx tsx bench/heldout.ts    # writes bench/results/heldout-gemini3.md
EXORCIST_DEV_DUMP=MisplacedAction npx tsx bench/heldout.ts   # list dev-half disagreements for one smell
```

| Agreement with Gemini 3 on the **test half** (F1) | Before dev tuning | After dev tuning |
|---|---|---|
| All smells | 0.79 | **0.81** |
| Misplaced Action | 0.51 | **0.79** |
| Misplaced Precondition (only 8 labels) | 0.14 | **0.44** |

The dev-half changes (only general rules, no item-specific fixes):

1. Misplaced Action: a clause after "and"/"or"/"then" inside a **statement** shares its subject ("Apt hits each mirror and update all of them"), so it is not a command; a lone word ("Name, username and password are accepted") or a label before ":" ("Return: Prompt=normal") is not a command; a **shell command line** in an expected result ("sudo cat /proc/mdstat") is an action.
2. Misplaced Precondition: "make sure" / "ensure" + a possession, capability or place ("you have internet access", "your processor supports …", "Evince is not in fullscreen mode") is a setup state; a "With …:" prefix lists what must be set up first; "before proceeding" is prerequisite wording.

On the human-labelled sample the score is unchanged (0.81), and agreement on the test half went up, so the changes generalise.

## With the LLM reviewer (Gemini)

```
pnpm bench:llm              # needs GEMINI_API_KEY; answers cached in bench/llm-cache.json
pnpm bench:llm --dry-run    # no key: counts the questions
```

Human-labelled sample, model `gemini-3.5-flash-lite` (free tier, 500 requests/day):

| | Precision | Recall | F1 | Model calls |
|---|---|---|---|---|
| Rules only | 0.92 | 0.72 | 0.81 | 0 |
| **Rules + LLM reviewer** (review candidates only) | **0.91** | **0.77** | **0.83** | **8** |
| Rules + reviewer + Ambiguous sweep (every step) | 0.77 | 0.83 | 0.80 | 94 |
| Gemini 3 alone (study) | 0.92 | 0.91 | 0.91 | 103+ |
| GPT-5.2 (study) | | | 0.82 | 103+ |

What this shows:

- **The hybrid wins on cost:** 8 model calls instead of 103 lift F1 from 0.81 to 0.83, above GPT-5.2 (0.82), with almost no loss of precision. The reviewer confirmed 6 of the 8 uncertain cases and rejected 2.
- **Asking the model about every step does not pay off:** the Ambiguous sweep finds more real smells (recall 0.83) but also flags many clean steps (precision 0.77), so F1 drops to 0.80. The sweep is therefore off by default.
- **One reviewer mistake:** it confirmed a time-reference "when" as Conditional Test, so Conditional F1 dropped from 0.93 to 0.88 in that run.
- Small sample (8 reviewed cases): treat +0.02 as a direction, not a precise gain.

Held-out test half (40 unseen test cases, `pnpm bench:llm --heldout`, agreement with Gemini 3 as silver standard):

| | Precision | Recall | F1 | Model calls |
|---|---|---|---|---|
| Rules only | 0.89 | 0.74 | 0.81 | 0 |
| **Rules + LLM reviewer** | **0.88** | **0.79** | **0.83** | **90** for 1,284 items |

The same +0.02 gain appears on unseen test cases, so it is not a fluke of the sample. (The reference labels here are Gemini 3 output and the reviewer is a Gemini model, so this agreement may be higher than with human labels.)

## Limits — read before quoting the numbers

- **Tuned on the same sample.** The changes above were chosen after looking at this sample's disagreements, so 0.81 is an optimistic figure. The held-out check above suggests it generalises, but it uses Gemini 3's labels, not human ones.
- **Small sample.** 103 items; Misplaced Action has only 2 labelled cases, so per-smell numbers for rare smells are unstable.
- **Ambiguous Test is the weak spot** (recall 0.39): many cases ("Make a search", "Insert a media card") are judgement calls. They become review candidates, which the planned LLM reviewer will decide — the hybrid design.
