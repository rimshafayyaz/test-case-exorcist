# Natural-Language Test Smells — Canonical Catalog

This file is the single source of truth for smell names, definitions, detection rules and fixes.
Detectors, fixers, the LLM prompt and the UI must follow it. Change this file first, then the code.

## Scope

| Source | Smells | Status in this project |
|---|---|---|
| Hauptmann et al. 2013 (ICSE) | 7: Hard-Coded Values, Long Test Steps, Conditional Tests, Badly Structured Test Suite, Test Clones, Ambiguous Tests, Inconsistent Wording | Origin of Ambiguous + Conditional; others are stretch goals |
| Soares et al. 2023 (ESEM) | 8: Ambiguous, Conditional, Eager Action, Misplaced Action, Misplaced Precondition, Misplaced Verification, Tacit Knowledge, Unverified Action | Our core, minus Tacit Knowledge |
| Soares 2024 (thesis / SBQS) | 13 manual-test smells in total | Background |
| Aranda et al. 2024 + SBQS 2025 | Transformations for 7 smells | Our fix names |
| 2025 SLM study, 2026 Gemini study | Same 7 smells | Our MVP scope and benchmark |

**MVP = the 7 smells below.** Stretch candidates (easy, rule-based): Long Test Steps, Hard-Coded Values, Test Clones, Tacit Knowledge (needs a glossary).

## Data model assumed

- A **test case** has `preconditions[]` and ordered **steps**.
- A **step** has one `action` and zero or more `verifications[]` (Ubuntu format: `<dt>` action, `<dd>` verification).
- Findings point to `caseId` + `stepIndex` + `field` (`action` | `verification` | `precondition`).

## Keyword ownership (no overlaps)

| Word group | Owned by |
|---|---|
| Verification verbs: verify, check, confirm, ensure, assert, validate, observe, see | Misplaced Verification (in actions); excluded from Misplaced Action. A check next to another action is also a second operation, so the step is **also** Eager Action (2026 study rule: "mixes actions and verification language → both") |
| "make sure" / "ensure that" / "ensure" | **Tie-break:** when it **opens the step** and introduces a state description ("Make sure the user is logged in") → Misplaced Precondition, in any step; after another action ("Click Save and make sure the file is stored") or without a state description ("Make sure to click Save") → Misplaced Verification |
| Subordinating conjunctions: if, whether, unless, otherwise, in case, depending on | Conditional Test |
| "or" between two commands or two quoted options ("Press the Super key, or click the logo") | Conditional Test (alternative flows); a list of labels ("Click OK, Cancel or Close") is not reported |
| "when" | Conditional Test (confident finding) when followed by a condition clause; review candidate when used only as a time reference (e.g. "Note when the download finishes") |
| State description (subject + auxiliary + past participle) in the **first** step | Misplaced Precondition |
| Vague words, indefinite determiners/pronouns, comparatives, manner adverbs | Ambiguous Test |
| Navigation verbs: open, go to, navigate to, launch, start, switch to, return to, scroll to | Unverified Action (low-severity exception only) |

---

## 1. Ambiguous Test — "Fog Wraith"
- **Definition:** An under-specified step that leaves room for interpretation, so pass/fail can't be decided objectively.
- **Field:** action or verification
- **Detection (research rules):** verb + indefinite determiner ("open **any** application"); indefinite pronouns (something, anyone); comparative/superlative adjectives (faster, best); adverbs of manner (properly, correctly, quickly); comparative adverbs (more easily). Extra: vague-word list (similar, better, clear, easy, fast, works, normal, appropriate, reasonable, approximately, as expected, user-friendly, as you like) and manner adverbs (… adequately, randomly, briefly). Verb + indefinite determiner (any, some, either, several, various, a few) and indefinite pronouns are findings; comparatives, a command with an unnamed object ("Insert a media card"), "each"/"every" and an unclear subject ("It should …") are review candidates for the LLM reviewer.
- **Smelly:** "Open any application and suspend machine." · "Check the page loads quickly."
- **Clean:** "Open the Calculator application." · "The page loads within 2 seconds."
- **Fix — Extract Ambiguity:** rewrite the vague part into a specific, measurable statement (LLM suggestion; user confirms).

## 2. Conditional Test — "Fork Spirit"
- **Definition:** A step contains conditional logic, so different testers may follow different paths.
- **Field:** action (and verification)
- **Detection:** any subordinating conjunction (POS-based), e.g. if, whether, unless, otherwise, in case. "when" followed by a condition clause → confident finding; "when" used only as a time reference (e.g. "Note when the download finishes") → review candidate only.
- **Smelly:** "If you have a USB drive, plug it in." · "Unless the dialog closes, press Esc."
- **Clean:** "Plug the USB drive into a free port."
- **Fix — Extract Conditional:** remove the condition and create two tests: one with the condition as a precondition, one without the conditional step and the steps after it.

## 3. Eager Action — "Hydra"
- **Definition:** One action step groups several actions.
- **Field:** action
- **Detection:** more than one imperative verb in the same action step (clause/conjunction split).
- **Smelly:** "Open settings, change language and save." · "Close flip and reopen the app."
- **Clean:** "Open settings."
- **Fix — Separate Actions:** split into one step per action; the original verifications go to the last new step; prompt the tester to add verifications for the others.

## 4. Misplaced Action — "Wanderer"
- **Definition:** An action is written as a verification.
- **Field:** verification
- **Detection:** imperative verb that is **not** a verification verb at the start of a verification clause. A clause after "and"/"or"/"then" inside a statement shares its subject and is not a command ("Apt hits each mirror and update all of them"); a lone word or a label before ":" is not a command. A shell command line ("sudo cat /proc/mdstat") in an expected result is an action.
- **Smelly:** verification "Click OK to continue." · "Add the files to the folder as in the previous step."
- **Clean:** verification "The confirmation dialog closes."
- **Fix — Extract Action:** move the action from the verifications to the end of the actions.

## 5. Misplaced Precondition — "Early Riser"
- **Definition:** A precondition is written as an action step.
- **Field:** action of the **first** step
- **Detection:** the first action step declares system state: subject + auxiliary + past participle ("X is/are (not) <participle>"), or explicit prerequisite wording (prerequisite, beforehand, already). In **any** step: a step that opens with "make sure" / "ensure" + a setup state — a state description ("Ensure wireless is enabled"), a possession or capability ("Please ensure you have internet access", "Make sure your processor supports …") or a place ("is not in fullscreen mode") — or a "With …:" prefix that lists what must be set up ("With an HDMI monitor plugged in: …"). Prerequisite wording also includes "before proceeding".
- **Smelly:** step 1 "The monitor is not connected, and the PC is not paired." · step 1 "The user is already logged in."
- **Clean:** step 1 "Log in as the admin user." (with "User account exists" in preconditions)
- **Fix — Extract Precondition:** move the first-step state description into the test case preconditions.

## 6. Misplaced Verification — "Mixed Soul"
- **Definition:** A verification is written as an action.
- **Field:** action
- **Detection:** a verification verb **anywhere** in the action step, or outcome wording ("should", "must be displayed").
- **Smelly:** "Close flip and check app continuity." · "Verify the total is 100." · "The menu should appear."
- **Clean:** action "Close the flip."; verification "The app keeps running."
- **Fix — Extract Verification:** move the verification from the action to the start of the verifications.

## 7. Unverified Action — "Silent Ghost"
- **Definition:** An action step has no verification before the next action.
- **Field:** verification (missing)
- **Detection:** step with zero non-empty verifications. Exception rule (configurable): a pure navigation step (action starts with a navigation verb — open, go to, navigate to, launch, start, switch to, return to, scroll to) immediately followed by a step that has at least one non-empty verification is reported with `severity: "low"` rather than omitted; the reason notes the missing verification may be intentional.
- **Smelly:** action "Click Save." with no verification.
- **Clean:** action "Click Save." / verification "A 'Saved' message appears."
- **Fix — Fill Verification:** flag for the tester, or suggest a verification inferred from the action (LLM; user confirms).

---

## Benchmark references

- 2026 Gemini study: 2,618 Ubuntu steps; 58.56% contain ≥1 smell; labelled sample of 103 steps / 15 cases; Gemini F1 0.91, GPT-5.2 0.82, Manual Test Sensei 0.66. Artifacts: https://doi.org/10.5281/zenodo.20549059
- 2025 SLM study: 261 annotated sentences from 143 Ubuntu tests; Phi-4 pass@2 97%; models struggle with Misplaced Action/Verification/Precondition (need context beyond one sentence).
- 2023 catalog: NLP tool F-measure 93.5% (8 smells, 3 systems).
- SBQS 2025: detection + correction tool, 83.7% F-measure, 91.43% acceptance from 15 professionals.

## Sources

- Hauptmann et al., *Hunting for Smells in Natural Language Tests*, ICSE 2013 — https://wwwbroy.in.tum.de/publ/papers/ICSE13Hauptmann.pdf
- Soares et al., *Manual Tests Do Smell!*, ESEM 2023 — https://arxiv.org/abs/2308.01386
- Soares et al., *A Multimethod Study of Test Smells*, SBQS 2024 — https://sol.sbc.org.br/index.php/sbqs/article/view/32996
- Aranda et al., *A Catalog of Transformations to Remove Smells From Natural Language Tests*, 2024 — https://arxiv.org/abs/2404.16992
- *Beyond Green Tests: Removing Smells From Natural Language Tests*, SBQS 2025 — https://sol.sbc.org.br/index.php/sbqs/article/view/39054
- *Small Language Models in Detecting Test Smells in Manual Test Cases*, 2025 — https://arxiv.org/abs/2507.13035
- *An Empirical Study of Gemini 3 for Detecting Natural Language Test Smells*, 2026 — https://arxiv.org/abs/2606.13804
