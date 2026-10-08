---
doc: spec
status: approved
---

# MRI — Technical Spec

*Positioning (`scope.md > Context and Positioning`): a trust layer for medical documents outside structured health records. It is not an EHR, an EHR or government health-system integration, or a patient portal. This note doesn't change the architecture below.*

Implements `prd.md` (approved) within `scope.md > The POC Boundary`.
Working brand: **MRI** (primary mark) · **Medical Records Interlinked** (descriptor) · "Every claim, back to its source." (tagline, not part of the logo lockup or the nav shell). A hackathon working name, not a cleared trademark (`prd.md > Product Decisions`).

---

## How This Works, In Plain Language

The app is **one Next.js web app that runs on your laptop.** It has two halves:

- **The screens** (Snapshot, History, Doctor Summary, the drawer and panels) run in the browser.
- **The server part** is code running on your laptop, not in the browser. It holds the OpenAI API key, talks to the OpenAI API, checks everything the model says, and is the only thing allowed to write the trusted history.

The **trusted history** is a JSON file (a structured text file, like a very strict spreadsheet) at `data/runtime/state.json`. It holds only **approved source facts** and the documents they came from. **Calculated claims are never saved.** Every time a screen loads, code recalculates them from the approved facts: "outside supplied range," "changed since previous," "matching follow-up result found." That's why the Snapshot, History and Doctor Summary can never go stale or disagree.

The **starting history** for the fictional patient is a committed **seed**: `data/seed/state.json` plus the synthetic PDFs. The first time the app runs, and whenever you reset the demo, the seed is copied into `data/runtime/`. Runtime data is gitignored, and so is the API key.

**When you add the follow-up consultation note:**

| Step | Who does it | What happens |
|---|---|---|
| 1 | **Code** | Reads the PDF's text, page by page. No AI. |
| 2 | **AI (OpenAI model, set by `EXTRACTION_MODEL`)** | Proposes facts in a strict format. Only two kinds are allowed: a lab measurement and a medication status statement. Each comes with its page and a word-for-word excerpt. |
| 3 | **Code** | Checks each fact on its own. Is the excerpt really on that page, word for word? Does the source text itself name the subject (ferritin, oral iron) *and* contain the value, unit or status? Facts that fail are left out. The excerpt shown to the patient is then taken from the page, never from the model. |
| 4 | **Code** | Previews what would change if the verified facts were approved. |
| 5 | **Patient** | Approves evidence (source facts). Consequences aren't approvable. |
| 6 | **Code** | Writes the approved facts into the trusted history and recalculates everything. |
| 7 | **Code** | Composes the Doctor Summary from templates. No AI writing. |

The AI's only job is step 2: **it proposes, it never decides.** Changing the model never changes steps 1 or 3–7.

**Why this shape and not something bigger:**
- One project, one process, and one external service (the OpenAI API).
- No database server, no accounts and no hosting.
- It runs from a stable production build for the recording.

---

## The Core Journey Through the System
PRD ref: `prd.md > The Core Journey`.

1. **Arrival.** The browser opens `http://localhost:3000`. The server reads `data/runtime/state.json`, initialising it from the seed if it's missing. The Snapshot page asks the **engine** (pure calculation code) for the calculated claims, then renders them. What changed is absent because `latestUpdate` is empty.
2. **Understand the current state.** The Snapshot sections render from approved facts and calculated claims.
3. **Check a claim.** The patient clicks the Iron / Ferritin section and goes to `/history/iron`. Clicking a fact opens the **Evidence Drawer**. It already has the fact, its document and its excerpt, because the page sent them along. "Open source document" loads `/api/documents/{id}` in the browser's built-in PDF viewer, at `#page=N`.
4. **See breadth.** The topic switcher goes to `/history/imaging`, the same template with no chart.
5. **Add a record.** Add record opens a modal with a file picker. The PDF is sent to `POST /api/records/extract`, and the **Processing** state shows while it runs.
6. **Server work.** PDF → page text → OpenAI model → schema check → per-fact **verification** → duplicate check → consequence preview. The result is saved as a **pending proposal**, a temporary file on the server, and returned to the browser.
7. **Review.** The **Review Panel** shows the verified facts, a "left out" note if any facts failed, and "This would also update…". Rejecting a fact reruns the preview in the browser using the same pure engine code.
8. **Apply.** The browser sends only `{proposalId, approvedFactIds}` to `POST /api/records/apply`. The server reloads the pending proposal from its *own* temporary file. It never trusts fact contents sent back from the browser. It then applies the approved facts, stores the document, sets `latestUpdate`, saves `state.json` and deletes the pending proposal.
9. **See what changed.** The pages refresh from the new state. What changed and the latest-update marks come from `latestUpdate`.
10. **Doctor Summary.** `/summary` runs the **Summary Composer** on the current state. Every line carries source markers that open the same drawer.

```
Browser                          Server part (your laptop)                 OpenAI API
───────                          ─────────────────────────                 ──────────
Add record ──PDF──▶ /api/records/extract
                     ├─ PDF Text Reader (page text)
                     ├─ Extraction Client ──page text + schema──────────▶ EXTRACTION_MODEL
                     │                    ◀──proposed facts (JSON)────────
                     ├─ Fact Verifier (excerpt on page? value in excerpt?)
                     ├─ Engine: dedupe + preview
                     └─ Proposal Store (temp file)
Review Panel ◀──verified facts + preview
Apply ──{proposalId, approvedFactIds}──▶ /api/records/apply
                     ├─ Proposal Store (reload own copy)
                     ├─ Engine: apply
                     └─ State Store ──▶ data/runtime/state.json
Snapshot / History / Summary ◀── State Store + Engine: derive (+ Summary Composer)
```

---

## Stack

| Choice | Role | Why (learner-agreed unless marked) | Docs |
|---|---|---|---|
| **Next.js (App Router) + TypeScript** | Screens and the server part in one project | Learner accepted: one local app, the key stays server-side | https://nextjs.org/docs |
| **openai** (official TypeScript SDK) | Calls the OpenAI Responses API from the server part | Official SDK (learner choice of provider) | https://github.com/openai/openai-node |
| **OpenAI Structured Outputs** (`client.responses.parse` + `zodTextFormat`, strict JSON schema) | Forces the model's answer into our schema | Schema-valid output before verification even starts | https://developers.openai.com/api/docs/guides/structured-outputs |
| **zod** | Defines the extraction schema and validates it again | The SDK's `zodTextFormat` helper uses it | https://zod.dev |
| **unpdf** | Reads PDF text page by page on the server (built on Mozilla's pdf.js) | Deterministic step 1 *(agent-derived)* | https://github.com/unjs/unpdf |
| **Playwright** (dev-only) | Renders the synthetic HTML documents to PDF | Print-quality, realistic documents with a clean text layer *(agent-derived)* | https://playwright.dev/docs/api/class-page#page-pdf |
| **Vitest** | Tests for the engine, verifier and composer | Fast, TypeScript-native *(agent-derived)* | https://vitest.dev |
| **tsx** | Runs the TypeScript scripts (reset, preflight, corpus build) | *(agent-derived)* | https://tsx.is |
| **CSS Modules + CSS custom properties** | Styling | Direct control of an editorial look; tokens live in one file *(agent-derived)* | https://nextjs.org/docs/app/getting-started/css |
| **next/font** (Google Fonts, self-hosted at build) | Typography | Fonts are bundled, so nothing is fetched at runtime *(agent-derived)* | https://nextjs.org/docs/app/api-reference/components/font |

**Model:** `gpt-6-luna` by default. It's OpenAI's most efficient current model, for focused high-volume tasks, and the learner's criterion was a fast, cost-effective model for a narrow task. It's configurable server-side through `EXTRACTION_MODEL`, and `gpt-6-sol` is the step up if preflight shows Luna isn't reliable. Reasoning effort is configurable through `EXTRACTION_EFFORT`, sent as `reasoning.effort` (default `low`). Changing either never changes the schema or the pipeline. *(Provider switched from Anthropic to OpenAI by learner decision; see `checklist.md > Revisions`.)*

**Environment already present on this machine:** Node.js v24, Git. *(Python isn't needed.)*

**⚠ Unverified, so check at the start of the build.** No live lookup was done for this spec.
- The current Next.js major version and its App Router conventions.
- Which zod major version the installed SDK's `zodTextFormat` helper expects. *(Checked: `openai` 7.23 accepts zod v3 and v4.)*
- The `unpdf` per-page text API (`extractText(..., { mergePages: false })`). Fall back to `pdfjs-dist` directly if it differs.
- That Playwright's Chromium download (dev-only, roughly 150 MB) is acceptable.

---

## Where It Runs and How Someone Tries It

**Runtime:** a local Node.js process serving a web app, opened in a desktop browser. Both `dev` and `start` bind to `127.0.0.1` only (`-H 127.0.0.1`), so the app is never exposed on the local network. Chrome or Edge is recommended, because their built-in PDF viewer supports `#page=N`.

**Requirements:**
- Node.js 20+ (v24 is installed)
- `OPENAI_API_KEY` in `.env.local`, which is gitignored. The learner adds it locally. It's never pasted into chat or committed.

**Configuration (`.env.example` is committed with no values):**
```
OPENAI_API_KEY=
EXTRACTION_MODEL=gpt-6-luna
EXTRACTION_EFFORT=low
```

**Commands:**

| Command | Purpose |
|---|---|
| `npm install` | Install dependencies |
| `npm run dev` | Development mode while building (hot reload) |
| `npm run build` then `npm run start` | **Stable production build for recording.** Opens at `http://localhost:3000` |
| `npm run demo:reset` | Restore the runtime state from the seed. Then refresh the browser |
| `npm run preflight` | Live check: runs the demo note through the full pipeline several times (default 5) and reports pass/fail per run |
| `npm run verify:seed` | Runs every seed fact through the same deterministic semantic checks as live facts. Fails on any mismatch. Also runs inside `npm test` |
| `npm run corpus:build` | Regenerates the synthetic PDFs from `corpus/src/` |
| `npm test` | Unit tests (engine, verifier, composer) |

**Production build vs dev mode (learner asked for the tradeoff).** `npm run build && npm run start` adds no real complexity. It's the same code, runs faster, and avoids dev-only overlays and on-demand compile pauses on camera. The cost is that code changes need a rebuild. Pages that read the history must be marked **dynamic** (`export const dynamic = "force-dynamic"`), so Next.js never serves a cached copy made at build time. That's a known gotcha, written into the relevant components.

**Recording script:**
1. `npm run demo:reset`
2. `npm run preflight`, and confirm every run passes
3. `npm run start`
4. Open `http://localhost:3000`
5. Follow `prd.md > The Core Journey`
6. For the live record, pick `demo-files/follow-up-consultation-2026-09-25.pdf`

**Deployment:** none, by learner decision. The submission is the demo video plus the public GitHub repo. A public URL would expose API credits, and a file-based history doesn't persist on typical serverless hosting.

---

## Look and Feel
Carried forward from `prd.md > Look and Feel` and `scope.md > Inspiration & Identity`. This is direction, not a design system.

**Feel:** a calm editorial medical record combined with the clarity of a well-designed banking app. It's organised rows, sections, timelines and thin rules, not a grid of dashboard cards.

**Typography** *(confirmed as the starting pair; swappable through `--font-ui` / `--font-evidence`)*:
- UI and body: **Source Sans 3**, a humanist sans with excellent readability, used at weights 400/600 only.
- Evidence excerpts and the Doctor Summary's section titles: **Source Serif 4**. This gives source evidence its "paper" voice and the summary its typeset-brief character.
- The type scale is modest, with no oversized headings. Hierarchy comes from size, weight, spacing, rules and alignment. Numbers use tabular figures (`font-variant-numeric: tabular-nums`) so values align in rows.

**Colour tokens** (`app/tokens.css`):

| Token | Value | Use |
|---|---|---|
| `--paper` | `#FAF8F4` | App background (warm white) |
| `--ink` | `#1F2328` | Primary text (charcoal) |
| `--ink-muted` | `#5B6068` | Secondary text, labels |
| `--rule` | `#E4E0D8` | Thin separators |
| `--accent` | `#2F6F73` | Functional accent (muted teal): links, focus, actions, latest-update rule |
| `--accent-wash` | `#E8F0EF` | Latest-update tint |
| `--evidence-paper` | `#FFFDF7` + border `#E6DFCF` | Excerpt "paper" surface |
| `--calc` | `--ink-muted` + dotted underline | Calculated labels (visually "derived," not "documented") |

**Rules:** no red, amber or green anywhere. Colour signals interface state, never medical judgement. Messages about failure or nothing new use `--ink` on `--paper`, with no alert colours or icons. No gradients, glow, glassmorphism or sparkle icons.

**Evidence vs derivation:**
- **Source facts** carry a source marker. Their excerpts render in Source Serif 4 on `--evidence-paper`, with a slight inset border.
- **Calculated claims** are shown to users as **"Derived"**: the claim text with a dotted underline and a quiet italic "· derived" marker. The drawer kicker reads "Derived" and the inputs section is headed "Derived from". It still opens "How this was determined." `CalculatedClaim` / CALCULATED remain the internal data-model terms.

**Latest update:** a 2px `--accent` left rule plus `--accent-wash` tint, and a small "Added from latest record" or "Updated from latest record" label with the date. No green.

**Doctor Summary:** a single column around 68 characters wide, a serif section title with a thin rule, compact sans body, source markers as small superscript-style chips (`[Source 2]`), and a numbered source list at the foot.

**Copy tone:** factual and documentary. The vocabulary allowlist is in `prd.md > Non-Goals`.

---

## Components

### Snapshot Page
Implements `prd.md > Snapshot`. Route `/` (`app/page.tsx`, dynamic).
It is summary-first and scalable, composed from a pure view model (`lib/view/snapshot.ts`) that returns deterministic counts and the latest item per category. *(Revised through the slice 3 reviews.)*
- **Identity** (`SnapshotHeader`): monogram, name, "Record updated …", **Add record**, and after an update "Updated from {document type} · {date}".
- **Your record at a glance** (`HealthSummary`): the document date span, evidence coverage (source-document count by type) and **Open Doctor Summary →**.
- **What changed:** rendered only when `latestUpdate` exists (slice 4), between the summary and Latest in your record. It lists the change descriptions produced by the engine, and each opens the drawer.
- **Latest in your record** (`LatestInRecord`): one grouped row per category (measurements, treatment / medication, imaging), each with a count, the latest documented item (opening its evidence), a `SourceRef` ("Lab report · 27 Jan 2026 · p. 2", with the verified page only for multi-page documents) and a View link into History.
- **Follow-up on record** (`FollowUpOnRecord`): an open list of the latest documented recommendation per topic, with its derived chronology state: `followup_no_later_result` ("No later ferritin result found in your record", input: the recommendation) before a later result exists, then `followup_match` ("Matching follow-up result found · {date}", inputs: the recommendation + the result).
- **Your history** (`HistoryTopics`): destinations to `/history/iron` and `/history/imaging`, with factual counts and date spans (no sparklines on Home).

### History Page (Topic Template)
Implements `prd.md > History (topic template)`. Route `/history/[topic]` with topic `iron` | `imaging` (`app/history/[topic]/page.tsx`, dynamic). The `History` nav item goes to `/history/iron`.
- **Topic Switcher:** Iron / Ferritin · Imaging follow-up.
- **Measurement Chart** (iron only): a hand-drawn SVG line with one point per ferritin observation. Each point's supplied range is drawn as a faint band *for that point only*, because ranges differ by lab. No colour coding.
- **Measurement Rows:** date · value · unit · supplied range · calculated labels · source marker.
- **Medication Timeline:** the episode's explicit status events in date order (e.g. Prescribed → Ongoing), each with a source marker. The stored status `Current` is always shown as "Ongoing", beside its documentation date.
- **Follow-up Block:** the recommendation text, date and source. If there's a match, "Matching result found: Ferritin 32 μg/L — 25 Sep 2026" as a calculated claim, plus elapsed time as plain chronology.
- **Imaging Timeline** (imaging only): exams and recommendations as source facts. "Last related examination" is backed by the later report's explicit comparison sentence (a source fact, not an inference). Read-only.

### Doctor Summary Page
Implements `prd.md > Doctor Summary`. Route `/summary` (dynamic). It's a user-controlled, evidence-linked view of the history represented in this product, not a claim to be the doctor's only access to the patient's history. It renders the output of the **Summary Composer** as a typeset brief, with a numbered **Sources** list at the foot (document type · source · date). Each chip opens the drawer for the underlying fact or claim.

### App Shell and Navigation
`components/shell/AppNav.tsx` + `shell.module.css`, mounted in `app/layout.tsx`. It's one navigation system with two presentations. Desktop (> 860px) gets a fixed sidebar with the MRI mark and the descriptor "Medical Records Interlinked" (no tagline), Home · History · Doctor Summary, and the owning patient ("Laurence Mercer · Synthetic demo record"). Mobile gets a top bar with the mark + descriptor (mark only below 340px, never wrapped) and a bottom tab bar (Home · History · Summary) with 44px+ targets. Line icons are inline SVG (`components/shell/icons.tsx`), and there's no icon library.

### Evidence Drawer
Implements `prd.md > Evidence Drawer`. A client component mounted once in the layout (`components/evidence/`) and opened through a small React context (`EvidenceProvider`), so any view can open it with a fact or claim reference.
- **Source Fact View:** value, document type and title, document date, page, the highlighted `verifiedExcerpt` (always page wording), **Open source document**.
- **Calculated Claim View:** "How this was determined", the rule in one plain sentence, and its input facts as clickable rows. Each input switches the drawer to that fact's Source Fact View, with a back link.
- **Document Viewer Modal:** an `<iframe>` pointing at `/api/documents/{id}#page={n}`, which uses the browser's built-in PDF viewer. Closing it returns to the drawer.

The pages pass the drawer everything it needs (facts, documents, calculated claims with input IDs), so opening it needs no network call.

### Add Record Modal and Processing State
Implements `prd.md > Adding a Record and Reviewing Proposed Changes`. A file input limited to `application/pdf` (drag-and-drop only if it's essentially free). On selection it posts `multipart/form-data` to `/api/records/extract` and shows: "Reading this record… Extracted facts will be shown for your review before anything changes." No sparkle styling.

If the AI call fails (network, timeout, API error, truncated or malformed structured output), it shows "We couldn't process this record. Your history hasn't changed." with **Try again**, which resends the same file, and **Cancel**. A model refusal shows the same message with **Close** only.

### Review Panel
Implements `prd.md > Adding a Record and Reviewing Proposed Changes`.
- **"Verified against this record"** (with the note "Matched to the source wording shown below."): each verified source fact with its value, excerpt, page and an Exclude / "Excluded · undo" toggle. "Verified" means the fact matches the uploaded source text, not independent medical verification.
- **Left-out note** (only if `excludedCount > 0`): "1 extracted item could not be verified against the source document and was left out." Neutral styling.
- **"This would also update…"**: consequences from the engine's `preview()`, rerun in the browser whenever the reject toggles change.
- **Actions:** **Add all to my record** (nothing excluded) or **Add selected** (some excluded). Disabled when every fact is excluded. On mobile the actions are sticky at the bottom of the sheet. **Cancel** and the close control always discard the proposal: the client calls `/api/records/cancel`, and nothing is imported.
- **Nothing-new result**: if the server returns `status: "no_changes"`, the panel shows "No new history changes found. Your documented history hasn't changed." with a Close button.
- **Failure states, one per real pipeline outcome** (`lib/extraction/pipeline.ts`):
  - `no_text`: "This record doesn't contain readable text." / "This prototype currently works with text-based PDFs. Scanned documents would require OCR, which is outside this proof of concept."
  - `no_supported_facts` (no supported fact type was proposed): "No supported history changes were found in this record." / "This prototype currently extracts a limited set of demonstrated facts. Your history hasn't changed."
  - `no_verified_facts` (supported facts were proposed, but every one failed deterministic verification, including an unverifiable document date): "No verified history changes were found in this record." / "Possible facts were found, but they couldn't be verified against the source wording. Your history hasn't changed."
  - `processing_failed`: "We couldn't process this record." / "Your history hasn't changed." (Try again when retryable)
  - `no_changes`: "No new history changes found."
  - `unsupported_file` (not a PDF, over 10 MB, or a PDF that can't be opened): a one-line factual title plus "Your history hasn't changed."
- Model confidence isn't shown in the POC (`prd.md > Open Questions`, resolved here: the schema doesn't ask for it, which keeps confidence out of the trust path entirely).

### Latest Update Mark
Implements `prd.md > Latest Update Marking`. A small presentational component. It takes `isLatest` (computed by the engine from `latestUpdate.affected`) and renders the label, rule and tint. It's used in Snapshot, History and Doctor Summary.

### Extract Route
`POST /api/records/extract` (`app/api/records/extract/route.ts`). Orchestrates the server steps in order:
1. **PDF Text Reader** → pages. Not a PDF, too large, or can't be opened → `unsupported_file`. No text layer → `no_text` (the AI is never called).
2. **Extraction Client** → proposed facts. API error → `processing_failed` (`ai_unavailable`, HTTP 502, retryable). A refusal (`ai_refused`, not retryable), `max_output_tokens` (`ai_incomplete`) or a null/invalid parse (`ai_invalid_output`) → `processing_failed`.
3. **Fact Verifier** → verified and excluded facts.
4. **Engine dedupe:** drops verified facts that already exist in the approved state.
5. **Subject gate** (before the document-date and per-fact checks): a candidate counts only if it names a supported subject (ferritin, or a supported medication episode) *and* the document text itself names that subject. Other candidates are out of scope and ignored, not counted as left out. No candidate left → `no_supported_facts` (`no_candidate_facts`). Supported facts proposed but an unverifiable document date (`document_date_unverified`) or every fact failing verification (`none_verified`) → `no_verified_facts`. If the verified facts were all duplicates → `no_changes`. Outcomes and server logs carry only a status and a fixed reason code, never document text, model output or extracted values.
6. Otherwise, the **Proposal Store** saves `{proposalId, pdf, documentMeta, verifiedFacts, excludedCount}`, and the route returns it with `preview()`.

The trusted state isn't touched at any point.

### Apply Route
`POST /api/records/apply` with body `{proposalId, approvedFactIds}`. It reloads the proposal from the Proposal Store and rejects any ID not in it. With zero approved facts it returns 400 and changes nothing. Otherwise it runs `engine.apply()`, copies the PDF to `data/runtime/documents/`, writes `state.json` atomically (write to a temp file, then rename), deletes the proposal, and returns the new state.

### Cancel Route
`POST /api/records/cancel` with body `{proposalId}`. Deletes the pending proposal. Idempotent. Orphaned proposals (for example after a refresh mid-review) are cleared at the start of the next extract call and by `demo:reset`.

### Document Route
`GET /api/documents/[id]` streams the PDF for a known document ID, from `data/seed/documents/` or `data/runtime/documents/`. Unknown ID → 404. No directory browsing.

### PDF Text Reader
`lib/extraction/pdfText.ts`, server only. Converts the PDF to `string[]` (one entry per page) using unpdf. The page text is kept **as extracted, un-normalized**, because it's the source the canonical `verifiedExcerpt` is cut from. Normalization happens only inside the verifier, through the index map.

### Extraction Client
`lib/extraction/extract.ts`, server only. It calls the OpenAI Responses API, `client.responses.parse()`, with:
- `model = EXTRACTION_MODEL`
- `text: { format: zodTextFormat(ExtractionSchema, "extraction") }` (strict JSON schema)
- `reasoning: { effort: EXTRACTION_EFFORT }`
- `max_output_tokens: 16000`
- `instructions`: the system prompt from `prompt.ts`
- `input`: page-labelled text (`=== PAGE 1 ===\n…`)

The model sees **exactly the text the verifier checks against**, not the PDF image. Before reading `output_parsed`, it checks for a `refusal` content item and for `status: "incomplete"`. SDK retries stay at the default (2), with a request timeout of about 60 seconds. The model's raw output is never shown to the patient and never written to the trusted state.

**Extraction schema** (`lib/extraction/schema.ts`). It's deliberately narrow and has no confidence field:
```ts
ExtractionSchema = {
  document: { documentType: string, documentDate: "YYYY-MM-DD", page: int, excerpt: string },
  labMeasurements: [{ analyteName: string, value: number, unit: string,
                      referenceRangeText: string | null, measuredOn: "YYYY-MM-DD",
                      page: int, excerpt: string }],
  medicationStatements: [{ medicationName: string,
                           status: "prescribed" | "current" | "completed" | "stopped",
                           page: int, excerpt: string }]
}
```

The system prompt tells the model to:
- extract only what the document explicitly states
- copy excerpts word for word from one page
- never infer a status from a prescription
- return empty arrays when nothing qualifies

### Fact Verifier
`lib/extraction/verify.ts`, pure deterministic code. **This is the trust gate.** It verifies both the *claimed value or status* and the *subject the claim is about*, using only source text. Each fact is checked independently, and it fails if any check fails.

**Step A: locate and canonicalise the excerpt.** The model's `excerpt` is only a search key.
1. `normalizeWithMap(pageText)` (`lib/text/normalize.ts`) builds the normalized page string. It applies NFKC, collapses whitespace, unifies dash and quote variants, and lowercases. It also builds an **index map** from every normalized character back to its position in the original page text. That's needed because normalization changes string lengths, so normalized offsets can't be reused directly.
2. `normalize(modelExcerpt)` must be found inside the normalized page. If it isn't, the fact fails.
3. The **`verifiedExcerpt`** is the *original* page text between the mapped start and end positions, trimmed of outer whitespace. From this point on, the model's excerpt string is discarded.

**Step B: semantic checks, all run against `verifiedExcerpt`, never the model's text.** The alias and cue lists live in one shared **lexicon** (`lib/extraction/lexicon.ts`). The same lexicon is used by the Seed Verifier.

| Check | Applies to | Rule (evaluated on `verifiedExcerpt`) |
|---|---|---|
| Analyte identity | lab | The excerpt contains an accepted **ferritin alias** (`ferritin`, `serum ferritin`), and the model's `analyteName` maps to the same analyte. A model label with no alias in the source text fails. |
| Value bound to analyte | lab | The claimed value is the **first number + unit that follows the alias** in the excerpt. `Ferritin 20 μg/L; Vitamin B12 32 μg/L` does not verify 32 as ferritin. |
| Unit | lab | That number is immediately followed by the normalized unit (`µ`/`μ` unified by NFKC). |
| Range | lab | If a range is claimed, both range numbers appear in the excerpt after the value. They're parsed into `refLow`/`refHigh`. |
| Date | lab | `measuredOn` parses and appears in the excerpt, or equals the verified document date. |
| Medication identity | medication | The excerpt contains an accepted **oral iron episode alias** (`oral iron`, `ferrous sulfate`, `iron tablets`, `iron supplement`), and the model's `medicationName` maps to that episode. A generic phrase such as "treatment completed," with no alias, fails. |
| Status cue | medication | The same **sentence** of the excerpt that contains the alias also contains a cue for the claimed status: completed → `completed`/`finished`; stopped → `stopped`/`discontinued`; current → `currently taking`/`continues to take`; prescribed → `prescribed`. |
| Document date | document | The excerpt is on the page and contains the date. If this fails, the whole extraction is `no_verified_facts` (`document_date_unverified`), because facts can't be dated. |

Result: `{ verified: SourceFact[], excludedCount: number }`. Verified facts get new IDs and review status `PROPOSED`, in memory only. Their `source.verifiedExcerpt` is the canonical page text.

**Shared checkers.** The per-kind checks are exported as small pure functions. `verifyLabFact`, `verifyMedicationFact` and `verifyDocumentDate` are used by the live verifier. The Seed Verifier uses those plus `verifyFollowUpFact` and `verifyImagingFact` (see *Seed Verifier Script*). There is one implementation of "what counts as evidence," applied to both live and seed data.

### Verifier Tests
`tests/verify.test.ts` uses fixture page text written in the style of the synthetic corpus. It must prove at least:
- **Canonical excerpt (the trust promise).** Take a model excerpt that differs from the page only by allowed normalization: collapsed spaces, straight quotes instead of curly ones, a hyphen instead of an en dash in `15–150`, different case. It **matches**, and the resulting `verifiedExcerpt` **equals the original page substring character for character** (with the en dash, curly quotes and original spacing). It is **not equal to the model's excerpt.**
- **Wrong subject fails.** An excerpt `Vitamin B12 32 μg/L` labelled `analyteName: "ferritin"` fails the analyte-identity check.
- **Wrong binding fails.** `Ferritin 20 μg/L; Vitamin B12 32 μg/L` claimed as ferritin 32 fails the value-bound-to-analyte check.
- **Generic medication statement fails.** "Treatment completed." with `medicationName: "oral iron"` fails medication identity.
- **Missing cue fails.** An excerpt naming ferrous sulfate but with no completion cue, claimed as `completed`, fails.
- **Excerpt not on the stated page fails**, even if it exists on another page.
- **Partial failure.** One failing fact and one passing fact → `verified.length === 1`, `excludedCount === 1`.
- **Happy path.** The two facts of the live note verify with the correct values, ranges and page numbers.

### Engine
`lib/engine/`. Pure functions with no file or network access. It's shared by the server and the browser, and it's the core of the tests.
- **`derive(state) → CalculatedClaim[]`**
  - range status per ferritin observation: inside or outside *its supplied* range
  - `changed-since-previous` (latest vs previous by date)
  - `previously-outside-supplied-range`
  - `followup-match`: the earliest approved ferritin observation dated after an approved ferritin follow-up recommendation, plus the elapsed months
  - Each claim has a stable `key`, `text`, `inputFactIds[]` and a `ruleDescription`
- **Medication status** is the latest explicit status event by `documentedOn`. It's displayed as that event (a source fact), so there's never a status without one.
- **`dedupe(state, facts)`:** same analyte + date + value + unit → duplicate. Same episode + status + documented date → duplicate.
- **`preview(state, proposedFacts, approvedIds)`:** applies the approved subset to a copy, derives, and returns the human-readable differences. This is where "This would also update…" comes from.
- **`apply(state, proposal, approvedIds) → newState`:** adds the document and the approved facts (as `APPROVED`). A medication status event's `documentedOn` is the verified document date. and sets `latestUpdate = { documentId, approvedFactIds, affected: [...fact IDs and claim keys that are new or changed], approvedAt }`.
- **`changesSummary(state)`:** the What changed lines, derived from `latestUpdate`.

### Summary Composer
Implements `prd.md > Doctor Summary`. `lib/summary/compose.ts` is pure and deterministic, with **no AI**. It turns state and derived claims into `SummarySection[]` of `Statement { parts: text[], refs: (factId | claimKey)[] }` using fixed English templates. Its rules:
- A section is emitted only if it has at least one supported statement.
- It never writes absence ("No current medications").
- It never uses a diagnostic label unless that exact label appears in an approved excerpt.
- Source numbers are assigned by the order in which documents are first cited.

This confirms the learner's preferred approach from `scope.md`: deterministic composition is simpler *and* at least as safe as tightly controlled generation.

### State Store
`lib/store/stateStore.ts`, server only. `readState()` returns `data/runtime/state.json`, copying the seed first if the runtime file is missing. `writeState()` writes to a temp file and then renames it. If the runtime file isn't valid JSON, it returns an explicit error page telling you to run `npm run demo:reset`. It never silently overwrites approved data.

### Proposal Store
`lib/store/proposalStore.ts`, server only. Pending proposals live in `data/runtime/pending/{proposalId}/` (the PDF plus `proposal.json`). They're created by extract, read by apply, and deleted by apply, cancel, reset, or at the start of the next extract. They're never read by any page, so an unapproved proposal can't influence what's displayed.

### Demo Reset Script
Implements `prd.md > Demo Reset`. `scripts/demo-reset.ts` (`npm run demo:reset`) deletes `data/runtime/` and copies the seed back. It's **not in the product UI at all**. After running it, refresh the browser.

### Preflight Script
`scripts/preflight.ts` (`npm run preflight [runs]`). It runs the real pipeline (PDF Text Reader → Extraction Client → Fact Verifier → dedupe against the *seed* state) on the demo note N times, prints the verified facts and exclusions per run, and passes only if every run yields **both** expected facts: ferritin 32 μg/L and oral iron Current (shown as Ongoing). It never writes runtime state and uses the model set in `.env.local`. It costs a few cents per run.

### Seed Verifier Script
`scripts/verify-seed.ts` (`npm run verify:seed`, also run inside `npm test`). The seed is trusted state, so it gets **the same deterministic semantic checks as live facts, with the same seriousness.** For every seed fact, it reads the page text of the fact's PDF and runs:

| Seed fact | Checks (shared checkers from the Fact Verifier) |
|---|---|
| Every fact | Step A: the stored `verifiedExcerpt` is found on the stated page, **and is exactly equal to the canonical page text** that Step A produces. Seed excerpts are page wording, not paraphrase. |
| Lab measurement | `verifyLabFact`: ferritin alias, value bound to the alias, unit, supplied range (if stored) and date |
| Medication status event | `verifyMedicationFact`: episode alias + status cue in the same sentence (e.g. D5 must say "prescribed") |
| Follow-up | `verifyFollowUpFact`: a recommendation cue (`repeat`, `recheck`, `follow-up`, `recommended`) plus a target alias (ferritin alias, or the exam alias such as `ultrasound`), plus the stored interval text (e.g. "3 months") |
| Imaging exam | `verifyImagingFact`: exam alias + `performedOn` date. If `comparesToDocumentId` is set, the excerpt must contain a comparison cue (`comparison`, `compared with`) **and** the referenced document's date |
| Document record | Its date appears in its own page text |

Any failure prints the fact ID, the check that failed and the page, and the script exits non-zero. **No medical claim without provenance** holds for hand-authored seed facts exactly as it does for AI-proposed ones.

### Corpus Builder Script
`scripts/build-corpus.ts` (`npm run corpus:build`). It renders `corpus/src/*.html` with `corpus/corpus.css` to PDFs using Playwright's `page.pdf()`. Seed documents go to `data/seed/documents/`, and the live note goes to `demo-files/`. The PDFs are committed, so the app and the recording never need Playwright.

---

## Data Model

Implements `scope.md > The POC Boundary` ("One structured state using four entities").

```ts
type DocumentRecord = {
  id: string;                 // "doc-03"
  title: string;              // "Laboratory Report"
  documentType: "lab_report" | "prescription" | "consultation_note" | "imaging_report" | "other"; // added docs: from source text only, else "other" titled "Added document"
  issuer: string;             // fictional clinic/lab name
  date: string;               // ISO date
  file: string;               // PDF filename
  pageCount: number;
  origin: "seed" | "added";
};

type SourceRef = {
  documentId: string; page: number;
  verifiedExcerpt: string;   // ALWAYS original page text (canonicalised by the verifier), never model output
};

// SOURCE FACTS — the only thing ever persisted besides documents
type Observation = {
  id: string; kind: "lab_measurement"; topic: "iron";
  analyte: "ferritin"; value: number; unit: string;
  refLow: number | null; refHigh: number | null; refText: string | null;
  measuredOn: string; source: SourceRef; review: "APPROVED";
} | {
  id: string; kind: "imaging_exam"; topic: "imaging";
  examName: string; performedOn: string; statement: string;
  comparesToDocumentId: string | null;   // only when the report explicitly says so
  source: SourceRef; review: "APPROVED";
};

type MedicationEpisode = { id: string; topic: "iron"; name: string };  // "Oral iron (ferrous sulfate)"
type MedicationStatusEvent = {
  id: string; kind: "medication_status"; episodeId: string;
  status: "Prescribed" | "Current" | "Completed" | "Stopped";
  documentedOn: string; source: SourceRef; review: "APPROVED";
};

type FollowUp = {
  id: string; kind: "follow_up"; topic: "iron" | "imaging";
  recommendation: string;            // "Repeat ferritin in 3 months"
  intervalText: string | null;       // "3 months" — must appear in the verifiedExcerpt
  target: { analyte: "ferritin" } | { examName: string };
  recommendedOn: string; source: SourceRef; review: "APPROVED";
};

type TrustedState = {
  version: 1;
  patient: { displayName: string };  // fictional
  documents: DocumentRecord[];
  episodes: MedicationEpisode[];
  facts: (Observation | MedicationStatusEvent | FollowUp)[];
  latestUpdate: null | { documentId: string; approvedFactIds: string[];
                         affected: string[]; approvedAt: string };
};

// NEVER persisted — recomputed on every read
type CalculatedClaim = {
  key: string;             // "followup-match:fu-iron-1"
  kind: "range_status" | "changed_since_previous" | "previously_outside_range" | "followup_match";
  text: string;            // "Matching follow-up result found"
  ruleDescription: string; // "An approved ferritin result dated after the recommendation"
  inputFactIds: string[];
};
```

**Evidence type vs review status** (`prd.md > Product Decisions`). Everything in `facts` is a SOURCE FACT with `review: "APPROVED"`. `CalculatedClaim` is the CALCULATED type. `PROPOSED` exists only on in-memory or pending proposal facts. `REJECTED` exists only as UI toggle state. **USER CONFIRMED** has no representation in the POC.

**Where each piece of data lives:**

| Data | Lives in | Updated by | After leaving and coming back |
|---|---|---|---|
| Seed history | `data/seed/state.json` + `data/seed/documents/*.pdf` (committed) | You, by hand, verified by `verify:seed` | Unchanged |
| Trusted runtime history | `data/runtime/state.json` (gitignored) | Apply Route only | **Persists** |
| Added documents | `data/runtime/documents/` (gitignored) | Apply Route only | Persists |
| Pending proposal | `data/runtime/pending/` (gitignored) | Extract Route; deleted by apply, cancel or reset | Orphan ignored, then cleared (`prd.md > States and Boundaries`) |
| Calculated claims | Nowhere, derived per request | Engine | Always current |
| Reject toggles, drawer and modal state | Browser memory | UI | Gone on refresh (by design) |
| API key and model config | `.env.local` (gitignored) | You | n/a |

---

## Synthetic Demo Corpus
Implements `prd.md > Synthetic Demo Record Set`. Every document is fully fictional, in English, and has the footer **"SYNTHETIC DEMO DOCUMENT — fictional patient — not a real medical record."** There are no IDs, addresses, barcodes, QR codes or prescription numbers. Issuers are invented names.

**Fictional patient:** *Laurence Mercer* (proposed, editable). No date of birth.

| # | Document | Date | Establishes |
|---|---|---|---|
| D1 | Laboratory report, *Northfield Diagnostics* | 14 Mar 2025 | Ferritin **11 μg/L**, reference range **30–400** (outside the supplied range; a different lab's range) |
| D2 | Imaging report, thyroid ultrasound | 10 Sep 2025 | Exam finding statement + "**Follow-up ultrasound in 6 months is recommended.**" |
| D3 | Laboratory report, *Riverside Clinical Laboratory* (2 pages; ferritin on page 2) | 27 Jan 2026 | Ferritin **19.6 μg/L**, reference range **15–150** |
| D4 | Consultation note, GP | 3 Feb 2026 | "Start oral iron… **Repeat ferritin in 3 months.**" (the ferritin follow-up) |
| D5 | Prescription | 3 Feb 2026 | Oral iron (ferrous sulfate) → **Prescribed** only |
| D6 | Imaging report, thyroid ultrasound | 12 Mar 2026 | "**Comparison: ultrasound of 10 Sep 2025.**" (explicit relationship) + finding statement |
| **Live** | **Follow-up consultation note** (2 pages) | **25 Sep 2026** | Page 1: "The patient **continues to take** oral iron (ferrous sulfate) once daily." Page 2: "Ferritin on 25 Sep 2026: **32 μg/L** (reference range 15–150 μg/L)." It also includes some realistic out-of-scope text (history, examination) and **no** "follow-up satisfied" wording and no new recommendations |

**Expected demo derivations:**
- Before the update: D1 is outside its supplied range, D3 is inside its range, and D3 shows "previously outside supplied range." The follow-up has no matching result, and medication is **Prescribed**.
- After approving both facts: 32 μg/L is inside its supplied range and changed since the previous measurement. A matching follow-up result is found (about 7 months after the recommendation), and medication is **Ongoing** (stored as `Current`), sourced to the live note. The "Current medication" summary section appears.

**Corpus wording rules.** These are needed so every fact passes the verifier's subject-and-value checks. `verify:seed` and `preflight` enforce them.
- Every ferritin result sits in **one line or sentence**: the alias first, then value and unit, then the range, e.g. `Ferritin   32 μg/L   15–150`. No other number + unit falls between the alias and its value.
- Every medication statement names the medication (`oral iron` / `ferrous sulfate`) **in the same sentence** as its status cue. D5 must contain the word "Prescribed" next to the medication name. The live note says "The patient continues to take oral iron (ferrous sulfate) once daily." (it avoids the word "prescribed" so no Prescribed status is proposed from it).
- The follow-up recommendation in D4 is one sentence containing the cue, the target and the interval: "Repeat ferritin in 3 months."
- D6's comparison sentence contains the earlier exam's date in a parseable form: "Comparison: thyroid ultrasound of 10 Sep 2025."
- Each document's date appears in its own header text.

The finding wording for the imaging documents is written to be neutral and non-alarming. Exact wording is authored in the build, within these constraints.

---

## File Structure

```
medical-history/                     # repo root (current folder)
├── app/
│   ├── layout.tsx                   # fonts, app shell (AppNav) around every page
│   ├── tokens.css                   # colour/type/spacing tokens (Look and Feel)
│   ├── globals.css                  # base typography, rules, focus states
│   ├── page.tsx                     # Snapshot Page (dynamic)
│   ├── history/[topic]/page.tsx     # History Page — iron | imaging (dynamic)
│   ├── summary/page.tsx             # Doctor Summary Page (dynamic)
│   └── api/
│       ├── records/extract/route.ts # Extract Route
│       ├── records/apply/route.ts   # Apply Route
│       ├── records/cancel/route.ts  # Cancel Route
│       └── documents/[id]/route.ts  # Document Route
├── components/
│   ├── shell/                       # AppNav (sidebar + mobile top bar/tab bar), icons, shell.module.css
│   ├── snapshot/                    # SnapshotHeader, HealthSummary, WhatChanged (slice 4), LatestInRecord, FollowUpOnRecord, HistoryTopics
│   ├── history/                     # TopicSwitcher, MeasurementChart, MeasurementRows,
│   │                                #   MedicationTimeline, FollowUpBlock, ImagingTimeline
│   ├── evidence/                    # EvidenceProvider, EvidenceDrawer, SourceFactView,
│   │                                #   CalculatedClaimView, DocumentViewerModal
│   ├── add-record/                  # AddRecordModal, ProcessingState, ReviewPanel
│   ├── summary/                     # SummarySection, SourceChip, SourcesList
│   └── ui/                          # LatestUpdateMark, CalculatedLabel, SourceMarker
├── lib/
│   ├── model/types.ts               # Data Model types (single source of truth)
│   ├── engine/                      # derive.ts, preview.ts, apply.ts, dedupe.ts, changes.ts — pure
│   ├── extraction/                  # pdfText.ts, schema.ts, prompt.ts, extract.ts (server),
│   │                                #   verify.ts (pure trust gate + shared checkers),
│   │                                #   lexicon.ts (analyte/medication/exam aliases, status & follow-up cues)
│   ├── summary/compose.ts           # Summary Composer — pure, no AI
│   ├── store/                       # stateStore.ts, proposalStore.ts (server)
│   └── text/normalize.ts            # normalize() + normalizeWithMap() (index map back to original text)
├── data/
│   ├── seed/
│   │   ├── state.json               # committed initial trusted history (hand-authored)
│   │   └── documents/               # D1–D6 PDFs (committed, generated)
│   └── runtime/                     # GITIGNORED — state.json, documents/, pending/
├── corpus/
│   ├── README.md                    # "All documents are synthetic and fictional"
│   ├── corpus.css                   # document styling (lab/clinic look, paper)
│   └── src/                         # d1-lab-2025-03-14.html … live-followup-2026-09-25.html
├── demo-files/
│   └── follow-up-consultation-2026-09-25.pdf   # the live record picked in the demo (committed)
├── scripts/
│   ├── build-corpus.ts              # Corpus Builder Script
│   ├── verify-seed.ts               # Seed Verifier Script
│   ├── preflight.ts                 # Preflight Script (live, costs cents)
│   └── demo-reset.ts                # Demo Reset Script
├── tests/
│   ├── engine.test.ts               # derivations, dedupe, preview, apply, dependency rules
│   ├── verify.test.ts               # every verifier check, pass + fail cases (see Verifier Tests)
│   └── summary.test.ts              # sections, no-absence rule, refs on every statement
├── devpost/                         # planning docs (learner-profile.md is gitignored)
├── .env.example                     # OPENAI_API_KEY=, EXTRACTION_MODEL=, EXTRACTION_EFFORT=
├── .gitignore                       # + node_modules/, .next/, /data/runtime/, test-results/
├── package.json
├── tsconfig.json
├── next.config.ts
└── README.md                        # what it is, synthetic-data notice, run + record steps
```

---

## External Services and Dependencies

### OpenAI API (the only external service)
- **Call:** `client.responses.parse({ model, instructions, input: pageLabelledText, text: { format: zodTextFormat(ExtractionSchema, "extraction") }, reasoning: { effort }, max_output_tokens: 16000 })`
- **Response:** `output_parsed`, which is null if parsing failed. Check first: a `refusal` content item, or `status: "incomplete"` (e.g. `incomplete_details.reason: "max_output_tokens"`) → `processing_failed`.
- **Auth:** `OPENAI_API_KEY` from `.env.local` (the SDK's default variable), read only by server code.
- **Model:** `EXTRACTION_MODEL`, default `gpt-6-luna`, switchable to `gpt-6-sol` (or `gpt-6-astra`).
- **Cost:** well under a cent per extraction on `gpt-6-luna` ($0.10 / $0.50 per million input/output tokens), or about a cent on `gpt-6-sol` ($2 / $10). Preflight × 5 plus demo takes cost a few cents at most.
- **Limits:** the standard rate limits of your API account. Not a concern at this volume.
- **Errors:** the SDK retries 408/409/429/5xx up to 2 times. Remaining errors surface as the retry state in the UI.
- **Docs:** https://developers.openai.com/api/docs/guides/structured-outputs · https://developers.openai.com/api/docs/models · https://github.com/openai/openai-node
- **Privacy:** only synthetic documents are ever sent. Server logs never print document text or excerpts by default.

### Local, no account needed
Next.js, unpdf, zod, Vitest, tsx, next/font (fonts bundled at build), and Playwright (dev-only, corpus build).

---

## Important Failure Modes

- **The OpenAI call fails or times out during the demo** → "We couldn't process this record. Your history hasn't changed." **Try again** resends the same file. The trusted state stays untouched. No cached or replayed extraction, ever.
- **The model returns something unusable** (refusal, truncation, schema mismatch) → "We couldn't process this record." **No supported fact proposed** → "No supported history changes were found in this record." **Supported facts proposed but none verified** (unverifiable document date, or *every* fact failing verification) → "No verified history changes were found in this record." **No text layer** → "This record doesn't contain readable text." Nothing proceeds to review in any of these cases.
- **Some facts fail verification** → only verified facts appear. The note reads "1 extracted item could not be verified against the source document and was left out." Consequences are computed only from what remains.
- **The same note is added again after approval** → "No new history changes found. Your documented history hasn't changed." Nothing persisted.
- **A stale page after approval** (Next.js caching) → prevented by marking the state-reading pages dynamic. The apply response also triggers `router.refresh()`.
- **The runtime state file is corrupted** → an explicit message to run `npm run demo:reset`. It never silently resets away approved data.

---

## What Was Simplified and Why

- **A JSON file** instead of a database. It's one patient and one writer. The full version would use a real database with migrations and access control.
- **Clean text-layer PDFs that we author**, instead of OCR or layout analysis. The kernel is what happens after extraction. The full version would need OCR and table-aware parsing for real-world scans.
- **Page text sent to the model**, instead of the PDF image. The model sees exactly what the verifier checks. The full version might add vision input for complex layouts, but it would still verify against a text source.
- **Built-in excerpt verification** instead of any provider-side citation feature. We need our own page text to check against anyway, and it keeps the trust gate independent of the provider.
- **Pending proposals as temporary files**, instead of a job or queue system. There's one proposal at a time.
- **The browser's built-in PDF viewer** (`#page=N`) instead of a custom viewer or highlight overlay. Page-level provenance plus the exact excerpt in the drawer is enough (`scope.md > Explicitly Cut`: bounding boxes).
- **A hand-drawn SVG chart** instead of a charting library. It's one small series and gives full control over the editorial look.
- **A CLI demo reset** instead of any in-app control. It's guaranteed never to appear on camera.
- **A pre-structured seed, verified by script**, instead of live batch ingestion (`scope.md > Explicitly Cut`).
- **Local only**, with no deployment (learner decision).

---

## Decisions and Open Issues

### Learner decisions (4-spec)
- **Next.js + TypeScript, one local app, server-side API calls, no deployment.** Simplest shape that keeps the key off the browser.
- **Two data layers:** a committed seed and a gitignored runtime. Reset restores from the seed. Credentials and runtime data are never committed.
- **A production build for recording**, if practical. It is: see *Where It Runs*.
- **Per-fact independent verification.** Only verified facts reach review, and a partial failure doesn't invalidate the rest. All failing → `no_verified_facts`. *"Patients review evidence that code could verify."*
- **No fake fallback.** Never replay a cached extraction as live. A live preflight and a normal retry path instead.
- **OpenAI as the provider, `gpt-6-luna` by default,** for speed and cost on a narrow task. The model and effort are configurable server-side, with `gpt-6-sol` as the switch if preflight shows unreliability. Changing the provider or model never changes the schema or pipeline. *(Provider changed from Anthropic to OpenAI before slice 2 by learner decision.)*

### Agent-derived implementation details (follow from the above; change freely)
unpdf for page text; Playwright for authoring the corpus; Vitest/tsx; CSS Modules plus tokens; a hand-drawn SVG chart; the browser's PDF viewer; the proposal stored server-side, with apply accepting only IDs; atomic writes; model confidence omitted from the schema; a shared lexicon of aliases and cues; the "first number + unit after the alias" binding rule and the same-sentence rule for medication status; NFKC normalization with an index map back to the original page text.

### Carried forward, confirmed in this spec
- **Doctor Summary composition** (from `scope.md`): fully deterministic templates. It's simpler and at least as safe as controlled generation.
- **Model confidence display** (`prd.md > Open Questions`): not shown. The schema doesn't request it.
- **Exact corpus contents** (`prd.md > Open Questions`): timeline and constraints fixed above. The wording is authored in the build.

### One useful unknown — the learner's learning goal
**Question:** *Where exactly should AI reasoning stop and deterministic code take over, in a product where trust matters?*
**What clarified it:** the responsibility table in *How This Works*. The AI does exactly one thing, proposing facts in a closed schema, and every downstream decision is code or the patient. The sharpest concrete example is the **Fact Verifier**. The model's excerpt is only a *search key*. Code must find it on the stated page, confirm that the *source text itself* names the subject and contains the value or status, and then display the canonical page wording (`verifiedExcerpt`), never the model's string. The learner's review sharpened this further: verifying the value without verifying the subject would have let a correctly quoted number be attached to the wrong analyte. It also showed that the seed must meet the same bar as live data.
**Checked during the build by:** `verify.test.ts` (see *Verifier Tests*: wrong subject, wrong binding, generic medication, missing cue, wrong page, canonical excerpt), `npm run verify:seed`, and `npm run preflight` (does the configured model pass the gate on every run?).

### Confirmed in review
- **Demo reset is terminal-only** (`npm run demo:reset`, then refresh). There's no in-app control of any kind.
- **Typography:** Source Sans 3 + Source Serif 4 as the starting pair. It must stay **swappable in one place**: `app/layout.tsx` (next/font imports) maps the fonts to `--font-ui` and `--font-evidence` in `tokens.css`, and components use only those tokens. The learner reviews it after the first real visual pass. The logo is separate from the UI pair: the nav shows the outlined SVG mark (`public/brand/mark.svg`), and the descriptor beside it uses `--font-brand` (Montserrat 400).
- **Fictional patient name:** Laurence Mercer.
- **The verifier checks subject as well as value/status**, entirely in the source text (see *Fact Verifier*).
- **The seed meets the same semantic bar as live facts** (see *Seed Verifier Script*).
- **The displayed excerpt is always a canonical `verifiedExcerpt`** cut from the page text through an index map (see *Fact Verifier*, *Verifier Tests*).

### To verify at the start of the build (no live lookup was done)
Next.js current major and conventions; the zod version expected by the SDK's `zodTextFormat` (checked: v3 or v4); the `unpdf` per-page API; the Playwright Chromium install.
