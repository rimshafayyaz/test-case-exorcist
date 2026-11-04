# Benchmark data

`gemini3-sample.json` — 103 labelled step items from 14 Ubuntu manual test cases, extracted from:

Lucas, K., Gheyi, R., Ribeiro, M., Palomba, F., Martins, L., Soares, E. *Dumps and Data for "An Empirical Study of Gemini 3 for Detecting Natural Language Test Smells in Manual Test Case"*. Zenodo, 2026. https://doi.org/10.5281/zenodo.20549059

Licence: CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/). Changes: converted from the "Gemini 3.html" sheet to JSON; smell names normalised to our identifiers. See `bench/README.md`.

`gemini3-outputs.json` — Gemini 3's output for 101 Ubuntu test cases (2,624 items), from the same Zenodo record, file "Gemini-3 (outputs).txt". These are **model predictions, not human labels**; used as a silver standard in `bench/heldout.ts`. Same licence and credit as above.
