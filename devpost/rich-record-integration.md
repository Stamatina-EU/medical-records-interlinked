# Final rich-record integration

This note describes the implemented default product and supplements the original scope, PRD and technical specification. The original six-document story remains available as the explicit legacy profile. Repository-relative paths below identify the implementation and synthetic sources.

## Profiles and composed record

| Profile | Entry points | Source of truth | Live additions |
|---|---|---|---|
| Default (`rich`) | `/`, `/history`, `/laboratory`, `/sources`, `/summary` | Verified immutable rich baseline plus a separately persisted approved overlay | Ferritin measurements and oral-iron status only |
| Legacy (`legacy`) | The original destinations, selected with `start:legacy` or `dev:legacy` | Original six-document seed and its separate legacy runtime | Original ferritin/oral-iron flow |
| Read-only study | `/rich` and its child routes | Immutable rich baseline only | None |

`lib/demo/profile.ts` selects the writable profile on the server through `MRI_DEMO_PROFILE`, defaulting to `rich`. A browser header or request body cannot select a writable profile. The `/rich` study remains separate; its Summary route is a scope notice inherited from that study. The completed product Summary is `/summary` in the default rich profile.

The rich baseline in `data/rich-synthetic/` contains seven synthetic PDFs and 17 source facts: ten laboratory measurements across Ferritin, TSH, Vitamin D (25-OH), C-reactive protein and Creatinine; two imaging statements; one oral-iron prescription status; three recommendations; and one documented incident. These are authored, code-owned fixtures verified against their PDFs, not live AI extraction output.

`lib/demo/store.ts` composes the baseline with patient-approved additions from gitignored `data/runtime/rich-default/`. The overlay records its baseline digest and revision. The loader rejects an invalid shape, a baseline mismatch, conflicting identities, or additions that fail verification against their stored source PDFs. Approval and reset do not overwrite the baseline.

## Live extraction and approval boundary

The original `lib/model/types.ts` live contract and extraction schema, prompt, grammar and verifier remain narrow. Rich-only analytes and the documented incident are read-model extensions in `lib/model/rich.ts`; they are not accepted live proposal types.

The live Add record workflow is deliberately narrow in this proof of concept: AI proposes only ferritin results and documented oral-iron status from the uploaded text-based PDF. The curated synthetic baseline demonstrates the broader record model, including other laboratory analytes, imaging, recommendations and the documented incident. Deterministic verification binds supported ferritin results and oral-iron statements to the actual page and complete source unit. The patient chooses which verified source facts to add. The browser submits only selected IDs; Apply reloads the server-owned proposal, checks its profile/baseline binding, verifies it against the pending PDF, deduplicates under a profile-specific lock, allocates final identities and persists the selected facts and PDF.

`lib/demo/schema.ts` rejects broader categories in both proposals and approved overlays. `lib/demo/record.ts` supplies a projection for the original live engine without persisting that projection as the full record. Rich deduplication retains differences in literal units and supplied ranges; it performs no conversion or normalization. `lib/rich/verify.ts` is the separate fixture-verification path and cannot admit broader live proposals.

Approving both supported facts from `demo-files/follow-up-consultation-2026-09-25.pdf` changes the composed record as follows:

| State | Documents | Source facts | Laboratory measurements | Analytes |
|---|---:|---:|---:|---:|
| Baseline | 7 | 17 | 10 | 5 |
| Both live facts approved | 8 | 19 | 11 | 5 |

The new source facts are ferritin 32 μg/L, supplied range 15–150 μg/L, measured 25 Sep 2026, page 2; and oral iron `Current`, displayed as Ongoing, documented 25 Sep 2026, page 1. The original 17 baseline facts remain unchanged. Code recomputes counts, latest-by-analyte selection, ferritin comparison, medication status and chronological follow-up matching. Partial approval produces only the selected additions and their applicable consequences.

## Presentation and provenance

Record provides the current documented overview. History groups measurements by analyte and presents the other dated source statements separately. Laboratory shows every dated result with its literal unit and individual supplied range. Sources lists the original PDFs and the facts they support. Evidence opens either a Direct source fact or a Derived calculation with its rule and all input facts.

Every source fact has its document ID, page and exact verified excerpt. Baseline attribution is the code-owned synthetic fixture; an added source is attributed to patient approval. Counts, grouping, latest selections, range comparisons and follow-up matching are derived views, not statements attributed to a source document. Verification establishes faithful representation within the supported source grammar; it does not establish clinical correctness, authenticity or diagnosis.

`lib/demo/summary.ts` deterministically composes the completed rich Doctor Summary, rendered by `components/rich/RichDoctorSummary.tsx`. It includes the latest results for all five analytes, original ranges, medication statements, imaging, recommendations, incident wording and numbered sources. All Direct and Derived references resolve through the same composed record. The legacy Summary composer remains unchanged.

The incident preserves: “Anaphylaxis occurred after amoxicillin. Epinephrine was administered in the emergency department.” The explicit incident date is 18 Aug 2025; its document date is 19 Aug 2025. The system does not infer an allergy, stronger causality, a contraindication, clinical ranking or future treatment advice.

The approved visual system uses the outlined dark-header logo, blue environment and ribbon around white reading surfaces, source-blue references and berry calculation references. App typography uses `next/font`; no system font installation is required. Responsive rules cover the record, history, source collection, approval panel, evidence drawer and summary.

## Synthetic sources and reproducibility

Three new editable source documents and their stylesheet live in `corpus/rich/`. `npm run corpus:rich` rebuilds their three rich PDFs with local Edge. The other four rich PDFs are unchanged copies of the corresponding original synthetic source documents. All seven rich PDFs and their authored state ship with the repository; the demo does not require rebuilding them.

The original six PDFs, `data/seed/state.json`, their HTML sources and the live follow-up PDF remain preserved. No runtime state, pending proposal, private document, local credential, cache, screenshot or temporary review package belongs in the committed corpus.

## Reset and validation

`npm run demo:reset` resets the configured profile, rich by default. `demo:reset:rich` clears only rich additions and pending/upload artifacts; `demo:reset:legacy` restores only the legacy runtime. Both immutable baselines and the other profile are preserved. Reset is a terminal demo action, not a patient-facing control.

Final validation commands are `npm test` (including original seed verification), `npm run verify:rich`, `npm run verify:seed`, `npm run typecheck`, `npm run build`, and `npm run preflight -- 5`. The preflight uses the real AI provider against the synthetic note and writes no approvals. Integration tests use explicitly labeled deterministic provider stubs with real PDF verification, including full and partial approval, cancel, duplicate and concurrent approval, restart persistence, tampering rejection, provenance, complete Summary, extraction fences and reset isolation.

This remains an English-only, one-patient, single-user local proof of concept for text-based PDFs. It has no OCR, general medical extraction, clinical advice, EHR integration, account system, sharing or deployed multiuser service.
