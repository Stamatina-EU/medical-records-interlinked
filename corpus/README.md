# Synthetic demo corpus

**Every document in this folder is synthetic and fictional.**

The patient ("Alex Rowan"), the clinics, laboratories and imaging centre are all invented. No real person, provider, identifier, address, barcode or prescription number appears anywhere. Each page carries the footer *"SYNTHETIC DEMO DOCUMENT — fictional patient — not a real medical record."*

These HTML sources are rendered to PDF by `npm run corpus:build`:

| Source | Output | Role |
|---|---|---|
| `d1-lab-report-2025-03-14.html` | `data/seed/documents/` | Seed: ferritin 11 μg/L (range 30–400) |
| `d2-imaging-report-2025-09-10.html` | `data/seed/documents/` | Seed: thyroid ultrasound + follow-up recommendation |
| `d3-lab-report-2026-01-27.html` | `data/seed/documents/` | Seed: ferritin 19.6 μg/L (range 15–150), page 2 |
| `d4-consultation-note-2026-02-03.html` | `data/seed/documents/` | Seed: "Repeat ferritin in 3 months." |
| `d5-prescription-2026-02-03.html` | `data/seed/documents/` | Seed: oral iron prescribed |
| `d6-imaging-report-2026-03-12.html` | `data/seed/documents/` | Seed: comparison with the 10 Sep 2025 ultrasound |
| `live-follow-up-consultation-2026-09-25.html` | `demo-files/` | The record added live in the demo: ferritin 32 μg/L (page 2); "continues to take oral iron" (page 1, Current → shown as Ongoing) |

The wording follows the rules in `devpost/spec.md > Synthetic Demo Corpus` so every fact can pass the deterministic verifier.

To rebuild only the live note (leaving the seed PDFs byte-identical): `npm run corpus:build -- live`.

Never add real medical documents to this repository.
