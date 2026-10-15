# MRI — Medical Records Interlinked

*Every claim, back to its source.*

**No medical claim without provenance.**

MRI stands for Medical Records Interlinked. It is a hackathon proof of concept for an evidence-linked, longitudinal personal medical history. You add a medical document (a PDF). In live Add record, AI proposes only ferritin results and documented oral-iron status in this proof of concept. The curated synthetic baseline demonstrates the broader record model: laboratory results, medication statements, imaging, recommendations and a documented incident. Deterministic code checks each live proposal against the document's own text, you approve what goes in, and then deterministic code works out what changed. Every value, status and recommendation in the app links back to the exact wording and page it came from.

> ⚠️ **Synthetic data only.** Every person, clinic, laboratory, value and document in this repository is fictional ("Laurence Mercer" is not a real patient). The app is a proof of concept. It is not a medical device, gives no medical advice, and must not be used with real medical records.

> *MRI* is a working hackathon name, not a registered trademark.

## The idea

```
AI proposes → Source wording checked → You approve → Record updates
```

- **Live Add record support is deliberately narrow in this proof of concept:** AI (OpenAI Responses API, structured output) only *proposes* ferritin measurements and documented oral-iron status, each with the page and quoted wording it relies on.
- **The curated synthetic baseline demonstrates the broader MRI record model.** It contains 7 PDFs and 17 source facts: 10 laboratory results across five analytes, imaging, medication statements (an oral-iron prescription), recommendations, and one explicitly documented incident. These are curated source facts, not output from the live AI flow. A separate fixture verifier checks the authored rich corpus.
- **The displayed default record** combines that immutable baseline with separately stored patient-approved live additions. Live additions remain limited to ferritin and documented oral-iron status in this POC. The original six-document seed remains unchanged and runnable as the legacy profile.
- **Live Add record verification** is deliberately narrow: this POC verifies only a small set of supported ferritin and oral-iron source structures (`lib/extraction/grammar.ts`). A fact counts only when its complete source unit matches one of them. Anything else is rejected, even if it might be true; the verifier does not try to understand general medical language.
  - The quote must occur exactly once on that page and be the complete source sentence (oral iron) or result line (ferritin).
  - An oral-iron status counts only in a supported sentence that ties it to oral iron and, where a person is named, to the patient (for example "The patient continues to take oral iron …", "Oral iron was stopped.").
  - A ferritin result counts only as one exact value with its unit, an optional date and at most one supplied range. It must be written as a result sentence or a laboratory table row.
  - The document date comes only from a complete header line ("Date of consultation 25 Sep 2026").
  - Each fact must sit in a supported section, and dates must be real.

  The excerpt you see is cut from the document itself, not from the model's output.
- **You approve.** Nothing changes in your record until you choose what to add. You can exclude any proposed fact. Raw AI output is never stored. In the default rich profile, each server-owned verified proposal and its uploaded PDF are kept temporarily in `data/runtime/rich-default/pending/` (gitignored). Approval or cancellation removes that proposal; rich reset clears all rich pending proposals. A new rich upload does not automatically delete or invalidate older pending proposals: they still require a valid server-owned proposal, verified facts and your explicit approval, and duplicate approvals remain idempotent. In the legacy profile, pending files use `data/runtime/pending/`, and a new upload clears earlier pending proposals.
- **Calculated statements are recomputed, never stored.** The default interface shows counts, latest documented dates, comparisons with each result's own supplied range, and whether a later ferritin result is documented after a recommendation. These statements are recomputed from approved facts and marked "Calculated". Follow-up chronology does not establish timely, completed or appropriate care.
- **The Doctor Summary** is composed from templates with no AI. MRI does not infer diagnoses or introduce diagnostic labels of its own. It may preserve diagnostic wording explicitly stated in a source, such as the documented word “anaphylaxis”. It does not invent absence statements such as “no current medication”. Every line has numbered source chips.

## Where this fits

Structured, provider-backed health records already exist. In Greece, for example, the national MyHealth / electronic health record ecosystem holds examinations, prescriptions and diagnoses recorded by healthcare providers.

MRI is **not** a replacement for, or an integration with, any national EHR, patient portal or provider system. It does not give doctors access to anything they could not otherwise see.

What this proof of concept demonstrates is narrower: the **trust pipeline** that turns an unstructured external document into verified, patient-approved, evidence-linked updates to a longitudinal history.

See [the final integration note](devpost/rich-record-integration.md) for profile boundaries, composition, provenance and the preserved legacy story. The `/rich` routes retain the separate read-only study; the completed default Doctor Summary is `/summary`.

## Run it locally

Run the commands below from the cloned repository root. Dependency installation and the build may require network access, including font downloads.

You'll need:

- Node.js 22.12 or later
- Chrome or Edge. Their built-in PDF viewer honours `#page=N`, which the evidence links use.
- `OPENAI_API_KEY` and provider/network access for live Add record extraction. The configured model must be available to your API account. Browsing the synthetic record works without an API key.

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

1. **Record** starts with the rich synthetic baseline: five analytes with two dated results each, imaging, medication statements, recommendations and one documented incident. Values link to Direct evidence; counts and latest selections link to Calculated evidence.
2. Choose **Add record** and pick `demo-files/follow-up-consultation-2026-09-25.pdf`.
3. Review the proposed facts. Direct facts are shown with the source wording checked against the document. Exclude any you don't want, then add them.
4. **Latest approved update** appears on Record: a new ferritin result, oral iron documented as ongoing, and “Later ferritin result documented” after the earlier recommendation. The Evidence explanation establishes chronology only, not care completion.
5. Open **History** for dated measurements grouped by analyte and the separate source chronology. Each measurement retains its original unit and its own supplied range.
6. Open **Doctor Summary** for a concise, source-numbered brief to show or discuss with a doctor.

**Expected outcome after approving both supported facts** from the demo PDF:

| | Before (rich baseline) | After approval |
|---|---:|---:|
| Documents | 7 | 8 |
| Source facts | 17 | 19 |
| Laboratory measurements | 10 | 11 |
| Analytes | 5 | 5 |

The new ferritin result is **32 μg/L · 25 Sep 2026**; oral iron is documented as **Ongoing**. The earlier ferritin recommendation now has a later documented ferritin result. This establishes chronology only, not timely, completed or medically appropriate care. The immutable baseline remains unchanged.

**Why the demo starts with history.** A fresh clone starts with seven verified rich synthetic documents by design, so one live addition can demonstrate an updated latest ferritin result, a later result documented after a recommendation, and medication statements over time. Empty-record bootstrap and first-use UI are implemented and tested (`tests/bootstrap.test.ts`, `tests/emptyRecord.test.ts`): approving the first supported facts creates the first measurement and/or medication episode. The default interface presents dated results grouped by analyte alongside a separate source chronology.

## Reset and checks

| Command | What it does |
|---|---|
| `npm run demo:reset` | Clears only the selected profile’s additions and restores its baseline. Refresh afterwards |
| `npm run preflight` | Runs the demo note through the real AI + verification pipeline 5 times and reports pass/fail per run. Requires `OPENAI_API_KEY` and provider/network/model access, makes real provider calls that may incur normal API usage costs, and never writes state |
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
app/                 Record, History, Sources, Laboratory, Doctor Summary and API routes
components/          Recordbook UI, Evidence and Add record review
lib/demo/            rich baseline + approved additions; completed rich Doctor Summary
lib/rich/            broader record model support and separate fixture verification
lib/extraction/      narrow live AI proposal schema/prompt and deterministic verifier
lib/engine/          live calculations, deduplication and approval application
lib/summary/         shared Summary types and preserved legacy composer
lib/store/           preserved legacy state and proposal storage
corpus/              editable synthetic document sources (HTML → PDFs)
data/rich-synthetic/ immutable seven-document baseline for the DEFAULT demo
data/seed/           preserved six-document LEGACY baseline
demo-files/          synthetic PDF uploaded live in the demo
devpost/             original planning documents and final integration note
```

## Limits (on purpose)

- English only. Text-based PDFs only (no OCR). One synthetic patient.
- Live Add record extraction is intentionally restricted to ferritin measurements and documented oral-iron status in this POC; additional laboratory analytes, imaging, recommendations and the incident are included only through the verified curated baseline.
- A single local user. There are no accounts, no sharing and no deployment.
- The verifier checks that a fact is **faithfully stated in the document**. It does not establish clinical correctness or document authenticity.

## Acknowledgements and licensing

Original MRI project code and content are available under the [MIT License](LICENSE). Third-party components and separately licensed assets remain subject to their respective licenses; MRI’s license does not relicense them. Existing third-party notices are preserved.

MRI was developed using the [Devpost Learn Skill Pack](https://github.com/challengepost/learn-ai-basics) workflow: `1-start` → `2-scope` → `3-prd` → `4-spec` → `5-build` → `6-ship`. The Skill Pack itself is [MIT-licensed](https://github.com/challengepost/learn-ai-basics/blob/main/LICENSE). MRI’s project license is separate.

Visual and font resources:

- **Lucide icons**, including Feather-derived icons: notices are retained in [public/visual-icons/LICENSE](public/visual-icons/LICENSE).
- **Source Sans 3**, **Source Serif 4** and **Montserrat**: interface, evidence/heading and navigation typography, loaded through `next/font/google`. No system font installation is required.
- **MRi brand artwork**: the overlapping-square mark and outlined wordmark. The outlined wordmark lettering originated in Corporate E Demi via Adobe Fonts; no font software is committed.
- **Recordbook backgrounds, ribbon and interlinked-record illustrations**: developed for MRI with AI-assisted visual generation.
