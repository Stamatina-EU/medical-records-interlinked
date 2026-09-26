# MyHeDo — My health, documented.

**No medical claim without provenance.**

MyHeDo is a hackathon proof of concept for an evidence-linked, longitudinal personal medical history. You add a medical document (a PDF). AI proposes facts from it, deterministic code checks each one against the document's own text, you approve what goes in, and then deterministic code works out what changed. Every value, status and recommendation in the app links back to the exact wording and page it came from.

> ⚠️ **Synthetic data only.** Every person, clinic, laboratory, value and document in this repository is fictional ("Alex Rowan" is not a real patient). The app is a proof of concept. It is not a medical device, gives no medical advice, and must not be used with real medical records.

> *MyHeDo* is a working hackathon name, not a registered trademark.

## The idea

```
AI proposes → deterministic code verifies → you approve the evidence
            → deterministic code derives the consequences → your history updates
```

- **AI (OpenAI Responses API, structured output)** only *proposes* facts: lab values, medication status, follow-up recommendations and imaging exams, each with the page and the quoted wording it relies on.
- **Deterministic verification** rejects anything it cannot find in the page text. Checks include:
  - the quote exists on that page;
  - the number and unit follow the named analyte;
  - the medication and its status cue appear in the same sentence;
  - dates are real.

  The excerpt you see is cut from the document itself, not from the model's output.
- **You approve.** Nothing changes in your record until you choose what to add. You can exclude any proposed fact.
- **Derived statements are calculated, never stored.** These include whether a value sits inside the range *supplied with that result*, the change since the previous result, and whether a later result matches a recommended recheck. They are recomputed from approved facts and marked "Derived".
- **The Doctor Summary** is composed from templates with no AI. It never states an absence ("no current medication") and never uses a diagnostic label. Every line has numbered source chips.

## Where this fits

Structured, provider-backed health records already exist. In Greece, for example, the national MyHealth / electronic health record ecosystem holds examinations, prescriptions and diagnoses recorded by healthcare providers.

MyHeDo is **not** a replacement for, or an integration with, any national EHR, patient portal or provider system. It does not give doctors access to anything they could not otherwise see.

What this proof of concept demonstrates is narrower: the **trust pipeline** that turns an unstructured external document into verified, patient-approved, evidence-linked updates to a longitudinal history.

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

Open http://localhost:3000. For development with hot reload, use `npm run dev`.

## Try the core journey

1. **Home** shows a synthetic record seeded from six documents: two ferritin results, an oral-iron prescription, a recheck recommendation and two thyroid ultrasounds. Tap any value to see its source excerpt and page.
2. Choose **Add record** and pick `demo-files/follow-up-consultation-2026-09-25.pdf`.
3. Review the proposed facts. Each is marked *Verified against this record* with its matched wording. Exclude any you don't want, then add them.
4. **What changed** appears on Home: a new ferritin result, oral iron now documented as ongoing, and a matching result for the earlier recheck recommendation.
5. Open **History** for the ferritin chart (each result against its own supplied range) and the imaging timeline.
6. Open **Doctor Summary** for a concise, source-numbered brief to show or discuss with a doctor.

## Reset and checks

| Command | What it does |
|---|---|
| `npm run demo:reset` | Restores the runtime history from the committed seed. Refresh the browser afterwards |
| `npm run preflight` | Runs the demo note through the real AI + verification pipeline 5 times and reports pass/fail per run. Needs the API key, costs well under a cent per run, and never writes state |
| `npm test` | Unit tests (verifier, engine, apply, history, summary), then `verify:seed` |
| `npm run verify:seed` | Checks every seed fact with the same deterministic verifier used for live facts |
| `npm run corpus:build` | Regenerates the synthetic PDFs from `corpus/src/` (uses local Edge via Playwright). `npm run corpus:build -- live` rebuilds only the demo note |

The runtime history lives in `data/runtime/`, which is gitignored. The committed seed is in `data/seed/`.

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
- Only a small set of fact types: ferritin results, oral-iron status, follow-up recommendations and imaging exams.
- A single local user. There are no accounts, no sharing and no deployment.
- The verifier checks that a fact is **faithfully stated in the document**. It does not check that the document is clinically correct.
