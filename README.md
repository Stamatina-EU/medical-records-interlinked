# MRI — Medical Records Interlinked

*Every claim, back to its source.*

**No medical claim without provenance.**

MRI stands for Medical Records Interlinked. It is a hackathon proof of concept for an evidence-linked, longitudinal personal medical history. You add a medical document (a PDF). AI proposes facts from it, deterministic code checks each one against the document's own text, you approve what goes in, and then deterministic code works out what changed. Every value, status and recommendation in the app links back to the exact wording and page it came from.

> ⚠️ **Synthetic data only.** Every person, clinic, laboratory, value and document in this repository is fictional ("Laurence Mercer" is not a real patient). The app is a proof of concept. It is not a medical device, gives no medical advice, and must not be used with real medical records.

> *MRI* is a working hackathon name, not a registered trademark.

## The idea

```
AI proposes → deterministic code verifies → you approve the evidence
            → deterministic code derives the consequences → your history updates
```

- **Live Add record support:** AI (OpenAI Responses API, structured output) only *proposes* ferritin measurements and oral-iron status, each with the page and quoted wording it relies on.
- **The default verified synthetic baseline contains** 7 PDFs and 17 source facts: 10 laboratory results across five analytes, imaging, oral-iron prescription, recommendations, and one explicitly documented incident. These are curated source facts, not output from the live AI flow. A separate fixture verifier checks the authored rich corpus.
- **The displayed default record** combines that immutable baseline with separately stored patient-approved live additions. Live additions remain limited to ferritin and oral-iron status. The original six-document seed remains unchanged and runnable as the legacy profile.
- **Deterministic verification** is deliberately narrow: this POC verifies only a small set of supported ferritin and oral-iron source structures (`lib/extraction/grammar.ts`). A fact counts only when its complete source unit matches one of them. Anything else is rejected, even if it might be true; the verifier does not try to understand general medical language.
  - The quote must occur exactly once on that page and be the complete source sentence (oral iron) or result line (ferritin).
  - An oral-iron status counts only in a supported sentence that ties it to oral iron and, where a person is named, to the patient (for example "The patient continues to take oral iron …", "Oral iron was stopped.").
  - A ferritin result counts only as one exact value with its unit, an optional date and at most one supplied range. It must be written as a result sentence or a laboratory table row.
  - The document date comes only from a complete header line ("Date of consultation 25 Sep 2026").
  - Each fact must sit in a supported section, and dates must be real.

  The excerpt you see is cut from the document itself, not from the model's output.
- **You approve.** Nothing changes in your record until you choose what to add. You can exclude any proposed fact. Raw AI output is never stored. In the default rich profile, each server-owned verified proposal and its uploaded PDF are kept temporarily in `data/runtime/rich-default/pending/` (gitignored). Approval or cancellation removes that proposal; rich reset clears all rich pending proposals. A new rich upload does not automatically delete or invalidate older pending proposals: they still require a valid server-owned proposal, verified facts and your explicit approval, and duplicate approvals remain idempotent. In the legacy profile, pending files use `data/runtime/pending/`, and a new upload clears earlier pending proposals.
- **Derived statements are calculated, never stored.** These include whether a value sits inside the range *supplied with that result*, the change since the previous result, and whether a later result matches a recommended recheck. They are recomputed from approved facts and marked "Derived".
- **The Doctor Summary** is composed from templates with no AI. It never states an absence ("no current medication") and never uses a diagnostic label. Every line has numbered source chips.

## Where this fits

Structured, provider-backed health records already exist. In Greece, for example, the national MyHealth / electronic health record ecosystem holds examinations, prescriptions and diagnoses recorded by healthcare providers.

MRI is **not** a replacement for, or an integration with, any national EHR, patient portal or provider system. It does not give doctors access to anything they could not otherwise see.

What this proof of concept demonstrates is narrower: the **trust pipeline** that turns an unstructured external document into verified, patient-approved, evidence-linked updates to a longitudinal history.

See [the final integration note](devpost/rich-record-integration.md) for profile boundaries, composition, provenance and the preserved legacy story. The `/rich` routes retain the separate read-only study; the completed default Doctor Summary is `/summary`.

## Run it locally

You'll need:

- Node.js 22.12 or later
- Chrome or Edge. Their built-in PDF viewer honours `#page=N`, which the evidence links use.
- An OpenAI API key, for adding a record. Everything else works without one.

```bash
npm install
```

```bash
cp .env.example .env.local
```

Then put your key in `.env.local`, which is gitignored and never committed:

```
OPENAI_API_KEY=...
EXTRACTION_MODEL=gpt-6-luna
EXTRACTION_EFFORT=low
```

For the stable production build (recommended for demos):

```bash
npm run build
```

```bash
npm run start
```

Open http://localhost:3000. The server binds to 127.0.0.1 only, so it is not reachable from other devices on your network. For development with hot reload, use `npm run dev`.

## Try the core journey

1. **Record** starts with the rich synthetic baseline: five analytes with two dated results each, imaging, medication statements, recommendations and one documented incident. Values link to Direct evidence; counts and latest selections link to Derived evidence.
2. Choose **Add record** and pick `demo-files/follow-up-consultation-2026-09-25.pdf`.
3. Review the proposed facts. Each is marked *Verified against this record* with its matched wording. Exclude any you don't want, then add them.
4. **What changed** appears on Home: a new ferritin result, oral iron now documented as ongoing, and a matching result for the earlier recheck recommendation.
5. Open **History** for dated measurements grouped by analyte and the separate source chronology. Each measurement retains its original unit and its own supplied range.
6. Open **Doctor Summary** for a concise, source-numbered brief to show or discuss with a doctor.

**Why the demo starts with history.** A fresh clone starts with seven verified rich synthetic documents by design, so one live addition can demonstrate a change since the previous result, a matching follow-up and medication status over time. Empty-record bootstrap and first-use UI are implemented and tested (`tests/bootstrap.test.ts`, `tests/emptyRecord.test.ts`): approving the first supported facts creates the first measurement and/or medication episode. Comparisons across time appear once there is history to compare.

## Reset and checks

| Command | What it does |
|---|---|
| `npm run demo:reset` | Clears only the selected profile’s additions and restores its baseline. Refresh afterwards |
| `npm run preflight` | Runs the demo note through the real AI + verification pipeline 5 times and reports pass/fail per run. Needs the API key, costs well under a cent per run, and never writes state |
| `npm test` | Full original + rich integration suite, then `verify:seed` |
| `npm run verify:rich` | Checks the immutable rich baseline against its seven real source PDFs using the separate fixture verifier |
| `npm run typecheck` | TypeScript validation |
| `npm run verify:seed` | Checks every seed fact with the same deterministic verifier used for live facts |
| `npm run corpus:rich` | Rebuilds the three new rich synthetic PDFs from `corpus/rich/`; the other four rich PDFs are preserved copies of original synthetic sources |
| `npm run corpus:build` | Regenerates the synthetic PDFs from `corpus/src/` (uses local Edge via Playwright). `npm run corpus:build -- live` rebuilds only the demo note |

The rich baseline is in `data/rich-synthetic/` and is never overwritten by approval or reset. Its additions, pending proposals and uploaded PDFs live only in gitignored `data/runtime/rich-default/`. The unchanged legacy seed is in `data/seed/`; its separate runtime remains `data/runtime/state.json`.

Run the fallback with `npm run start:legacy -- --port 3006` (or `npm run dev:legacy`). Profile selection is server-owned; it is not a browser switch. `npm run demo:reset:rich` resets only rich additions; `npm run demo:reset:legacy` resets only the legacy runtime. `npm run demo:reset` selects the configured profile, rich by default.

Rich Doctor Summary uses deterministic templates for all five latest analytes, medication statements, imaging, recommendations and exact incident wording. Incident date and document date remain separate. No allergy, stronger causality, clinical ranking or treatment advice is inferred.

## What's in the repo

```
app/            Next.js App Router pages (Home, History, Doctor Summary) and API routes
components/     UI: app shell, evidence drawer, Add record review, history chart, summary
lib/extraction/ PDF text, AI extraction (schema + prompt), deterministic verifier
lib/engine/     derive (calculated claims), dedupe, change description, apply
lib/summary/    Doctor Summary composer (deterministic templates)
lib/store/      file-based state and pending proposals (atomic writes)
corpus/         synthetic document sources (HTML) → PDFs
data/seed/      the synthetic starting record
demo-files/     the synthetic document added live in the demo
devpost/        scope, PRD, spec and build checklist
```

## Limits (on purpose)

- English only. Text-based PDFs only (no OCR). One synthetic patient.
- Live extraction is limited to ferritin measurements and oral-iron status; additional laboratory analytes, imaging, recommendations and the incident are included only through the verified curated baseline.
- A single local user. There are no accounts, no sharing and no deployment.
- The verifier checks that a fact is **faithfully stated in the document**. It does not check that the document is clinically correct.
