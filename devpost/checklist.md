---
doc: checklist
status: approved
---

# Build Checklist

Build mode: fast (concise explanations, no full code walkthroughs; extra trust checkpoints after slices 2 and 4)

## Slices

- [x] **1. The fictional patient's records exist as real, verified evidence**
  Becomes usable: A running Next.js app where Alex Rowan's six synthetic source documents open as real PDFs through the Document Route. For checking, there's a **dev-only** internal harness page, which is not product scope and not a records library. It renders only when `NODE_ENV=development` and is removed in slice 3. `npm run verify:seed` proves every hand-authored seed fact against its PDF using the deterministic trust gate.
  Why now: Everything downstream depends on the corpus and the verifier. Writing seven plausible, consistent, verbatim-matchable documents is the biggest hidden risk (`spec.md > Decisions and Open Issues`). Building the trust gate first means every later slice stands on verified evidence. Project bootstrapping lives here.
  PRD ref: `prd.md > Synthetic Demo Record Set`, `prd.md > Evidence Drawer` (source document viewer)
  Spec ref: `spec.md > Synthetic Demo Corpus`, `spec.md > Fact Verifier`, `spec.md > Verifier Tests`, `spec.md > Seed Verifier Script`, `spec.md > Corpus Builder Script`, `spec.md > Document Route`, `spec.md > Data Model`, `spec.md > File Structure`, `spec.md > Stack`
  Build:
  - Verify the early-build unknowns (Next.js conventions, zod version for `zodOutputFormat`, the unpdf per-page API, Playwright install), and record any deviation under Revisions.
  - Scaffold Next.js + TypeScript and extend `.gitignore` (`node_modules/`, `.next/`, `/data/runtime/`, `test-results/`). Add `.env.example`.
  - Author `corpus/src` D1–D6 plus the live follow-up note, following the *Corpus wording rules*. Build the PDFs with `npm run corpus:build`.
  - Hand-author `data/seed/state.json`: the patient, documents, oral iron episode, and facts with `verifiedExcerpt`.
  - Implement `lib/text/normalize.ts` (`normalizeWithMap`), `lib/extraction/lexicon.ts`, `lib/extraction/pdfText.ts`, and `lib/extraction/verify.ts` with all shared checkers.
  - Write `tests/verify.test.ts` (every case in *Verifier Tests*) and `scripts/verify-seed.ts`.
  - Add the Document Route and a temporary **dev-only** harness at `/dev/documents` (returns 404 outside development; deleted in slice 3). `/` is a placeholder until slice 3.
  Verify (mechanical):
  - `npm run corpus:build` writes 6 seed PDFs plus the demo note.
  - `npm test` passes, including the canonical-excerpt, wrong-subject, wrong-binding, generic-medication, missing-cue, wrong-page and partial-failure cases.
  - `npm run verify:seed` exits 0. Deliberately corrupting one seed value makes it exit non-zero, then the value is restored.
  - `npm run dev` starts cleanly. `GET /api/documents/doc-03` returns a PDF, and an unknown ID returns 404.
  Learner check: In dev mode, open `http://localhost:3000/dev/documents` and click through the six documents plus `demo-files/follow-up-consultation-2026-09-25.pdf`. Do they read like plausible, calm, clearly synthetic medical records? Is anything in the wording, dates or tone off? Then run `npm run verify:seed` and see every fact reported as verified.
  Commit: `Add synthetic corpus, seed history and deterministic verifier`

- [x] **2. Live AI extraction is proven against the real trust gate**
  Becomes usable: `npm run preflight` sends the live follow-up note through PDF text → OpenAI Responses API (`EXTRACTION_MODEL`, default `gpt-6-luna`) → strict schema → verifier → dedupe against the seed, five times. It reports both expected facts (ferritin 32 μg/L, oral iron completed) verified on every run.
  Why now: The OpenAI API is the only external service and the riskiest unknown. This is the one allowed technical-layer slice, because it proves that risk with runnable evidence before any UI depends on it. If the default model isn't reliable, we learn it now and switch `EXTRACTION_MODEL` (e.g. to `gpt-6-sol`), not on camera.
  PRD ref: `prd.md > Adding a Record and Reviewing Proposed Changes` (extraction and verification), `prd.md > States and Boundaries` (unusable extraction)
  Spec ref: `spec.md > Extraction Client`, `spec.md > PDF Text Reader`, `spec.md > Preflight Script`, `spec.md > External Services and Dependencies`, `spec.md > Where It Runs and How Someone Tries It`
  Build:
  - Add `lib/extraction/schema.ts` (zod, no confidence field) and `prompt.ts`.
  - Add `extract.ts` using the OpenAI Responses API (`client.responses.parse` + `zodTextFormat`, strict JSON schema), with `EXTRACTION_MODEL` and `EXTRACTION_EFFORT` (as `reasoning.effort`) from env, refusal and `status: "incomplete"` checks, and a timeout.
  - Add a minimal `lib/engine/dedupe.ts`.
  - Add `scripts/preflight.ts`. It never writes runtime state and never logs document text beyond the verified facts.
  - **Needs the learner to add `OPENAI_API_KEY` to `.env.local` themselves.**
  Verify (mechanical): `npm run preflight` → 5/5 runs pass with both facts verified, with correct values, range and page numbers. Running it with a deliberately wrong API key produces a clear error and no state change.
  Learner check: Read the preflight output. For each run, you should see the two verified facts with their page numbers and source wording, and "PASS". Confirm that the source wording shown is the note's own text.
  Commit: `Add live extraction client and preflight check`

- [x] **3. The Snapshot shows the documented history, and every fact opens its evidence**
  Becomes usable: The real Snapshot for Alex Rowan, styled per Look and Feel. It shows the header, the Iron / Ferritin section (latest 19.6 μg/L, supplied range, previous 11 μg/L, medication Prescribed, documented follow-up with no matching result yet), the Imaging line and a Doctor Summary link. Clicking any value opens the right-side evidence drawer. Source facts show their page and `verifiedExcerpt` on paper, and calculated claims show "How this was determined" with clickable inputs. "Open source document" opens the PDF at the right page. `npm run demo:reset` restores the seed.
  Why now: This is the first real product screen and the provenance half of the kernel ("every claim has a source"). The live update in slice 4 needs a trusted state and a Snapshot to change. It's also the right moment for early visual feedback, before the most complex UI is built.
  PRD ref: `prd.md > Snapshot`, `prd.md > Evidence Drawer`, `prd.md > Look and Feel`, `prd.md > Demo Reset`
  Spec ref: `spec.md > Snapshot Page`, `spec.md > Top Navigation`, `spec.md > Evidence Drawer`, `spec.md > State Store`, `spec.md > Engine` (`derive`, medication status), `spec.md > Demo Reset Script`, `spec.md > Look and Feel`
  Build:
  - Add `tokens.css` and `globals.css`, with next/font Source Sans 3 and Source Serif 4 mapped to `--font-ui` and `--font-evidence`. Add the TopNav.
  - Add the State Store (seed → runtime, atomic write, corrupted-file message).
  - Add `lib/engine/derive.ts`: range status, changed since previous, previously outside range, follow-up match, medication status. Write `tests/engine.test.ts` for the derivations.
  - Build the Snapshot page (dynamic) with its components.
  - Build the EvidenceProvider, EvidenceDrawer, SourceFactView, CalculatedClaimView and DocumentViewerModal.
  - Add `scripts/demo-reset.ts`, and delete the dev-only `/dev/documents` harness.
  Verify (mechanical):
  - `npm test` passes, with derivation tests covering the pre-update seed state.
  - `npm run dev`. `/` renders with no console errors, and the page HTML contains 19.6, 15–150, 11, Prescribed and "Repeat ferritin in 3 months". There's no "Recent changes" and no red, amber or green.
  - Deleting `data/runtime/` and reloading recreates it from the seed. `npm run demo:reset` exits 0.
  Learner check: Open `http://localhost:3000`. Read the Snapshot top to bottom: does it feel like a calm editorial record rather than a dashboard? Click the latest ferritin value and check the drawer shows page 2 of the 27 Jan 2026 report with its source wording on paper. Click "Open source document" and land on that page. Then click the calculated "previously outside supplied range" label and follow its input fact back to the 14 Mar 2025 report.
  Commit: `Add Snapshot, trusted state store and evidence drawer`

- [ ] **4. Add one record, review verified evidence, approve, and watch the history update**
  Becomes usable: The kernel, end to end.
  - **Add record** → pick the demo note → the neutral processing state → a review panel with "Verified from this record" (both facts with page and source wording), a "This would also update…" preview that recomputes as facts are rejected, Apply all / Apply selected (disabled when all are rejected) / Cancel.
  - **Apply** updates the persisted trusted state. The Snapshot then shows the header status line, **What changed**, Latest in your record with ferritin 32 μg/L and oral iron "Completed · documented 25 Sep 2026", "Matching follow-up result found" under Follow-up on record, and latest-update marks.
  - The other states work: cancel, reject all, refresh mid-review, re-adding the same note ("No new history changes found…"), unusable file, and API failure with Try again.
  Why now: This is the unique kernel. It lands as early as its dependencies allow: the verifier (1), live extraction (2), and the trusted state plus Snapshot (3). Everything after this is presentation of the same state.
  PRD ref: `prd.md > Adding a Record and Reviewing Proposed Changes`, `prd.md > Deterministic State Update`, `prd.md > Latest Update Marking`, `prd.md > Snapshot` (C. What changed, A. Identity status line), `prd.md > States and Boundaries`
  Spec ref: `spec.md > Add Record Modal and Processing State`, `spec.md > Review Panel`, `spec.md > Extract Route`, `spec.md > Apply Route`, `spec.md > Cancel Route`, `spec.md > Proposal Store`, `spec.md > Engine` (`preview`, `apply`, `dedupe`, `changesSummary`), `spec.md > Latest Update Mark`, `spec.md > Important Failure Modes`
  Build:
  - Add the Proposal Store and the Extract, Apply and Cancel routes. Apply accepts only `{proposalId, approvedFactIds}`.
  - Add engine `preview`, `apply` and `changesSummary`, with tests for the dependency rules: reject ferritin → no follow-up match; reject medication → status unchanged.
  - Build the AddRecordModal, ProcessingState and ReviewPanel with every PRD state.
  - Add What changed, the header status line and the LatestUpdateMark on Snapshot. Call `router.refresh()` after apply.
  Verify (mechanical):
  - `npm test` passes, including the preview/apply dependency tests and an apply-route test that rejects unknown fact IDs.
  - Live run in `npm run dev`: extract → apply all, then confirm `data/runtime/state.json` contains the two new APPROVED facts with a `verifiedExcerpt` equal to the page text. `/` shows 32 μg/L, Completed, "Matching follow-up result found" and What changed. This survives a restart.
  - Re-adding the note returns `no_changes` and the state file is byte-identical.
  - `demo:reset` → reject ferritin → apply: the state has the medication fact only, with no follow-up match.
  - A text-less or non-medical PDF returns `unusable`, and the state is unchanged.
  Learner check: Run `npm run demo:reset`, refresh, then do the demo moment yourself. Add record → choose the demo note → read the review panel. Are both facts shown with the note's own wording and page? Does the preview say what you expect? Try rejecting the ferritin fact and watch the follow-up consequence disappear, then restore it and Apply all. Check the Snapshot: what changed, and is every change marked and clickable to its evidence? Finally, add the same note again and read the "No new history changes found" message.
  Commit: `Add record ingestion, evidence review and approved state update`

- [ ] **5. History shows each topic across time, with the new record visible in it**
  Becomes usable: `/history/iron` shows a hand-drawn SVG chart with per-result range bands, measurement rows with calculated labels and source markers, the oral iron status timeline (Prescribed → Completed after the update), and the documented follow-up with "Matching result found" and plain elapsed time. The topic switcher opens `/history/imaging`, the same template without a chart, with the comparison-backed "last related examination". Latest-update marks appear on the new row, the status and the follow-up. Every item opens the evidence drawer.
  Why now: It's the longitudinal view that makes the update legible across time. It reuses the drawer (3) and the updated state (4), so it's mostly presentation of proven logic.
  PRD ref: `prd.md > History (topic template)`, `prd.md > Latest Update Marking`
  Spec ref: `spec.md > History Page (Topic Template)`, `spec.md > Latest Update Mark`, `spec.md > Look and Feel`
  Build: Add `app/history/[topic]/page.tsx` (dynamic) with TopicSwitcher, MeasurementChart, MeasurementRows, MedicationTimeline, FollowUpBlock and ImagingTimeline. Wire the Snapshot sections and the "History" nav item to these routes.
  **Medication-timeline implementation note (learner rule, display semantics only):** `documentedOn` is the date of the *document that states the status*, not the date the status took effect. Never present it as an effective date, e.g. never "Completed 25 Sep 2026". Any date shown beside a medication status is labelled explicitly as the documentation date, e.g. "Completed · documented 25 Sep 2026" or "Prescribed · documented 3 Feb 2026". The source's own wording (e.g. "…in May 2026") stays visible through the verified excerpt in the evidence drawer. There's no data-model change and no effective-status date for this POC unless implementation later makes it necessary. The same labelling applies wherever a status date appears (Snapshot, What changed, Doctor Summary).
  Verify (mechanical):
  - `npm test` passes.
  - With `npm run dev` on the seed state, `/history/iron` renders 2 measurement rows and `/history/imaging` renders no chart.
  - After a live or preflight-equivalent apply, `/history/iron` renders 3 rows with the 32 μg/L row marked latest, and the medication timeline ends in Completed.
  - An unknown topic returns 404. No console errors.
  Learner check: Open History → Iron / Ferritin before and after an update (use `demo:reset` to compare). Does the chart and row layout read as a record across time, and does each row keep its own lab's range? Click "Matching result found" and confirm the drawer shows both the recommendation and the later result. Switch to Imaging follow-up and click "last related examination" to see the comparison sentence.
  Commit: `Add longitudinal History view for both topics`

- [ ] **6. The Doctor Summary reflects the approved evidence, and the whole demo runs from a production build**
  Becomes usable:
  - `/summary` is a typeset one-page brief with sections A–E. Each appears only when supported, with no absence statements. Every line has a source chip, and chips open the evidence drawer. A numbered Sources list sits at the foot.
  - Before the update it shows the pre-update facts. After approval it shows 32 μg/L, oral iron Completed and the follow-up line, with no regeneration step.
  - The full recording flow works from `npm run build && npm run start`. The README explains the project, the synthetic-data notice, and the run, reset, preflight and record steps.
  Why now: It's the last primary view and proves practical impact. It depends on the full approved-state pipeline (4). Finishing with a production-build run-through catches the dev-vs-prod differences (caching, dynamic pages) before the final review and the recording.
  PRD ref: `prd.md > Doctor Summary`, `prd.md > The Core Journey` (step 9)
  Spec ref: `spec.md > Summary Composer`, `spec.md > Doctor Summary Page`, `spec.md > Where It Runs and How Someone Tries It`, `spec.md > Look and Feel`
  Build:
  - Add `lib/summary/compose.ts` (templates only, no AI) and `tests/summary.test.ts`: no empty section, no absence statement, refs on every statement, no diagnostic label unless it's in an excerpt.
  - Build the SummarySection, SourceChip and SourcesList components and the `/summary` page (dynamic).
  - Write the README, using the positioning in `scope.md > Context and Positioning`: evidence outside structured records, and no overbroad claims.
  - Do a full production-build dry run of the recording script.
  Verify (mechanical):
  - `npm test` passes.
  - `npm run build` succeeds with no type errors.
  - `npm run start`, then the full core journey: demo:reset → Snapshot → History → drawer → add note → review → apply → Snapshot changes → `/summary` contains "32" and "Completed". Every summary statement renders at least one chip.
  - A restart keeps the state, and `demo:reset` plus a refresh returns to the seed.
  Learner check: Run the recording script from the README yourself in the production build: reset, start, walk the whole journey, finish on the Doctor Summary. Read it as a new doctor would. Is it short, factual and clearly sourced? Does any line say more than the documents do?
  Commit: `Add Doctor Summary and production-build demo flow`

## Hands-on Checkpoints

Slice 1 → mechanically verified only · Slice 5 → continue unless a material issue appears.

- [ ] Trust-pipeline checkpoint (report, no visual review) — after slice 2. It covers the corpus that exists, the `verify:seed` result, preflight results across all runs, the model used, whether both expected facts passed deterministic verification every run, and any verifier or extraction compromise or deviation from spec. Don't proceed silently if the pipeline differs materially from spec.
- [x] Early usable behavior explored — after slice 3 (Snapshot + evidence drawer): hands-on visual and provenance review. Covers visual direction, typography pairing and drawer feel.
- [ ] Kernel hands-on review — **STOP** after slice 4. The learner tries Add record → AI proposes → code verifies → patient reviews evidence → Apply → deterministic consequences → trusted state updates, before History and the Doctor Summary are built.
- [ ] Final kick-the-tires exploration and feedback completed — after slice 6, on the production build

## Final Review

- [ ] Final review complete — feedback resolved and learner confirms ready to ship

## Code Tour and App Map

- [ ] Learning activity complete — guided route, focused alternative, prior practice connected, or brief recap
- [ ] Optional edit and transfer reflection addressed — offered/declined/already covered/not applicable as appropriate
- [ ] `devpost/app-map.html` generated from finished code, checked, and shown, including a project-grounded practice to reuse

Activity and evidence:
Route and stops:
Edit outcome:
Reflection:
Activity mode:

## Revisions

- Corpus PDFs render through Playwright driving the locally installed Microsoft Edge (`channel: "msedge"`), not a downloaded Chromium. The Chromium download timed out on this network, and Edge produces the same clean text layer with no ~150 MB download. Only `scripts/build-corpus.ts` is affected, and the committed PDFs mean the app never needs it.
- Resolved stack versions: Next.js 16.3, React 19.3, zod 4 (supported by `@anthropic-ai/sdk` 0.128 as a peer), unpdf 1.8 (`extractText(pdf, { mergePages: false })` returns per-page strings as the spec assumed), and TypeScript pinned to 5.9 rather than 7.x for Next.js type-check compatibility.
- The "Prescribed" status cue matches only `Prescribed:` or `is/was/has been prescribed`, never the bare word. The live note's "completed the prescribed course of oral iron" would otherwise have let a model claim a *Prescribed* event from a completion sentence. Covered by a test.
- D6 comparison wording is now a single sentence naming both exam dates ("Thyroid ultrasound of 12 Mar 2026 compared with the thyroid ultrasound of 10 Sep 2025."), so one contiguous excerpt proves the relationship, the exam date and the earlier date together. This still satisfies the spec's corpus rule.
- Imaging exam excerpts may span consecutive source lines (e.g. exam sentence + finding). `verifiedExcerpt` keeps the original line breaks, because it is page text.
- AI provider changed from Anthropic to OpenAI before slice 2 (learner decision; provider-only change). `@anthropic-ai/sdk` was replaced by the official `openai` SDK (7.23), using the Responses API with strict JSON-schema Structured Outputs (`client.responses.parse` + `zodTextFormat`). The key is `OPENAI_API_KEY`, and the default model is `gpt-6-luna` with `gpt-6-sol` as the fallback, checked against current OpenAI docs. The schema, verifier, trust pipeline, data model, corpus and review flow are unchanged. The earlier zod note (zod 4 as an Anthropic SDK peer) is superseded: `openai` also accepts zod v3 or v4.
- Extraction schema `page` fields are `z.number().int().min(1)`. OpenAI's docs list Integer as a supported type and `minimum`/`maximum` as supported number properties (not for fine-tuned models, which we don't use). `zodTextFormat` emits `{"type":"integer","minimum":1,…}` with `strict: true` and re-validates each response locally, and the verifier's integer and page-range check stays as defense in depth.
- `scripts/preflight.ts` ends with `process.exitCode` instead of `process.exit()`. On Windows, `process.exit()` while the HTTP client's sockets were closing tripped a libuv assertion (exit 127 instead of 1). SDK-internal retries (`maxRetries: 2`) aren't surfaced by the script, so per-run latency is the only visible signal of a retry.
- The EvidenceProvider (context + drawer + document viewer) is mounted per page rather than once in the layout. Each page passes its own freshly derived evidence index, so the drawer can never show data older than the page, and pages refresh together after an approval. Behavior is unchanged: one drawer, reachable from every view.
- The Snapshot shows nothing for a documented follow-up with no matching result yet. It deliberately does *not* display "no matching result", which would be an absence claim. "Matching follow-up result found" appears only when the calculated claim exists.
- Supporting modules added: `lib/view/snapshot.ts` (pure Snapshot view model), `lib/evidence/index.ts` (serializable evidence index and headlines), `formatDateTime` in `lib/text/dates.ts`, and a styled `app/not-found.tsx`. Until slices 5 and 6, the History and Doctor Summary nav links land on that not-found page, and the Add record button is shown disabled until slice 4.
- **Snapshot information architecture revised after the slice 3 hands-on review (learner decision).** The Snapshot is now patient- and moment-centred, not topic-centred: Identity → Latest in your record → What changed (slice 4) → Follow-up on record → Your history → Doctor Summary line. Iron / Ferritin and Imaging are History topics one level deeper. "Latest in your record" shows only the latest documented information (renamed from "Right now" so it does not imply the patient's real-world state today); longitudinal claims move to History and What changed. "Recent changes" is renamed "What changed". `prd.md > Snapshot` and `spec.md > Snapshot Page` were updated to match. The data model, provenance, verifier, drawer, routes and scope are unchanged. Slice 3's original verify text (which mentions the previous value "11" on the Snapshot) reflects the pre-revision layout.
- **App-shell redesign after the second slice 3 review (learner decision).** MyHeDo is now a responsive personal app that contains records without looking like one: a sidebar (desktop) and a top bar + bottom tab bar (mobile) replace the top navigation; Home is composed of app modules (an asymmetric primary ferritin panel with supporting items, a What-changed module, follow-up items carried forward from documents, navigable history destinations with small documented-value traces, and a Doctor Summary entry); on Home, sources are quiet references; the evidence drawer becomes a full-height sheet on mobile, and the document viewer goes full screen. The brand is **MyHeDo — "My health, documented."** After review, the learner confirmed that What changed stays **hidden until the first approved update** (its first appearance is the demo reveal), and that the history traces stay only because they are extremely quiet (faint grey, 64×20px, no emphasis). MyHeDo is the working hackathon brand, not a cleared trademark, and is never abbreviated. The data model, trust pipeline, evidence semantics, verifier, routes and scope are unchanged, and the Doctor Summary is untouched.
- Final Home polish (learner decisions): the identity block leads with the name (no framing line above it), Follow-up on record is an open list (separators, no card surface), and the user-facing word for CALCULATED claims is **"Derived"** everywhere in the UI: a quiet italic "· derived" marker on Home, and "Derived" / "Derived from" in the evidence drawer. `CalculatedClaim` / CALCULATED stay the internal data-model terms.
- Small internal helpers added outside the planned tree: `lib/text/dates.ts` (date parse/format) and `lib/store/paths.ts` (seed/runtime locations). `vitest.config.mts` uses the ESM extension.
