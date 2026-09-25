---
doc: prd
status: approved
---

# MyHeDo — Product Requirements

An evidence-linked medical history for an adult patient about to see a new doctor. It focuses on medical documents that aren't already represented in a structured health record. A new record proposes changes, the patient approves the evidence, code derives the consequences, and every claim stays traceable to its source.
Source: `scope.md > The Unique Kernel`, `scope.md > Who It's For`, `scope.md > Context and Positioning`.

This POC is **not** a replacement for a national EHR, MyHealth or any other provider-backed record system. It isn't an EHR or government health-system integration, and it isn't a general patient portal. Its differentiator is the trust pipeline: unstructured external document → proposed facts → deterministic source verification → patient approval → evidence-linked longitudinal update.

**Working brand:** **MyHeDo** — "My health, documented." A working hackathon brand chosen by the learner during the build (it replaces the earlier label "Medical History"), not a legally cleared trademark. Always written "MyHeDo", never abbreviated to an acronym.

**Governing principles** (from `scope.md > The Unique Kernel` and `scope.md > The POC Boundary`):
- **No medical claim without provenance.** Every source fact is traceable to an exact supporting excerpt. Every calculated claim is traceable to the structured facts that produced it, and through them to their excerpts.
- **Patients approve evidence. Code derives consequences.**
- **Model confidence is not medical truth.**
- **Code may calculate chronology. The product doesn't turn chronology into medical judgement.**

---

## The Core Journey
Source: `scope.md > What "Working" Looks Like`, `scope.md > The Core Loop`.

1. **Arrival.** The app opens on the **Snapshot** for a fictional adult patient. The history already exists, built from the initial synthetic record set (see *Synthetic Demo Record Set*). There's no empty state and no onboarding.
2. **Understand the current state.** The patient scans Home: their identity, their record at a glance (with the Doctor Summary entry), the latest documented item per category, the follow-up on record, and the ways into their history.
3. **Check a claim.** The patient opens the Iron / Ferritin **History** and clicks a fact. The **evidence drawer** slides in from the right with the exact excerpt, the document, its date and the page.
4. **See breadth.** The patient briefly opens the Imaging follow-up topic in the same History view. It has no chart.
5. **Add a record.** The patient clicks **Add record**, picks the synthetic follow-up consultation note (PDF) from their computer, and a neutral processing state appears.
6. **Review the proposal.** A review panel lists the **extracted source facts**, each with its excerpt. Below them, it previews the **derived consequences** ("This would also update…"). The patient clicks **Add all to my record**, or excludes individual source facts and chooses **Add selected**.
7. **Trusted state updates.** Code applies the approved source facts, recomputes the calculated state, and saves the result.
8. **See what changed.** The Snapshot shows **What changed**. Affected items in Snapshot and History carry a subtle "latest update" treatment.
9. **Prepare for the doctor.** The patient opens the **Doctor Summary**. It now reflects the approved evidence, and every line has a source marker that opens the evidence drawer.

**Success** means the new record changed the longitudinal history only after approval, and every claim can still be clicked back to its evidence.

---

## Screens and Layout
Source: `scope.md > The POC Boundary`.

**Three primary destinations** in one consistent app navigation: **Home (the Snapshot) · History · Doctor Summary**. On desktop they sit in a sidebar that carries the MyHeDo identity. On mobile there's a top bar with the brand and a bottom tab bar with comfortable touch targets.

| Surface | Type | Purpose |
|---|---|---|
| Snapshot | Primary view | "What is documented now, and what changed?" |
| History | Primary view (one reusable topic template) | One longitudinal topic across time |
| Doctor Summary | Primary view | "What should I show or discuss with a new doctor?" |
| Add record | Modal / panel | File picker and the start of processing |
| Processing | Temporary state | Neutral progress while the record is read |
| Review panel | Modal / panel | Approve or reject extracted source facts |
| Evidence drawer | Right-side drawer (desktop) / full-height sheet (mobile) | Provenance for any fact or calculated claim |
| Source document viewer | Modal | The full synthetic document, opened from the drawer |
| Demo reset | Demo/dev-only control | Not part of the patient-facing interface |

**Movement:**
- Snapshot → a topic section → History for that topic → evidence drawer
- Snapshot → Add record → processing → review panel → approve → updated Snapshot
- Snapshot → View Doctor Summary
- Any fact or source marker, in any view → evidence drawer → Open source document → viewer

Imaging follow-up isn't a fourth screen. It's a second topic rendered through the History template.

---

## Look and Feel
The feel sits closer to **a calm editorial medical record combined with the clarity of a well-designed banking app** than to a health dashboard or an AI product.

- **Qualities:** calm, precise, documentary, trustworthy, mature, editorial. Information-dense when useful, never visually busy.
- **Typography:** a clear humanist or editorial sans-serif with excellent readability. Hierarchy comes mainly from size, weight, spacing, rules/separators and alignment.
  - *Avoid:* futuristic "AI" type, overly rounded "friendly health app" type, oversized marketing headings, excessive bold labels.
- **Colour:** restrained neutrals. A warm white, paper-like background; charcoal or near-black text; one muted blue, teal or blue-green as the functional accent; subtle greys for secondary information.
  - Colour communicates **interface state, not medical judgement.** Red doesn't mean "bad result," and green doesn't mean "healthy."
  - *Avoid:* purple AI gradients, neon, glassmorphism, sparkle icons, glowing elements, traffic-light red/amber/green health coding, decorative medical blue everywhere.
- **Layout:** structured rows, sections, timelines and thin separators, not a grid of dashboard cards. It should feel like an organised record, not a collection of widgets.
- **Evidence vs derivation:** source evidence (excerpts, the document viewer) has a slight **document/paper quality**, so "what the record says" and "what the system derives" are visually distinct.
- **Density:** moderately compact, with enough breathing room to feel premium and calm.
- **Doctor Summary:** should feel almost like **a beautifully typeset one-page clinical brief**.
- **Language:** English. Documentary tone: "outside the supplied laboratory range," never "good / bad / dangerous / healthy."

---

## Features and Behavior

### Snapshot
Source: `scope.md > The POC Boundary` ("Health Snapshot").

**Summary-first, patient-centred and built to scale.** Home must work for a person with 5 records or 500. It answers "what does my documented record contain right now?" with deterministic summaries, then shows the latest documented item per category. Details belong behind interaction (the evidence drawer) or in History. The feel is a personal app space ("the application contains medical records; it doesn't look like one"). It is precise, restrained, documentary and source-linked, and recognisably about one person. It never interprets health: no "healthy", "normal overall", "needs attention", "concerning", "urgent", "abnormal" or "bad". *(Revised through the slice 3 reviews; copy not final.)*

Top to bottom:

**A. Identity**
- The patient owns the space: monogram, the fictional name with real presence, and "Record updated …".
- A clear **Add record** action.
- After an approved update, a small neutral status line in patient language. Preferred when the metadata is available: "Updated from Follow-up consultation note · 25 Sep 2026". Otherwise: "Updated from your latest record". Internal terms like "source fact" never appear here.

**B. Your record at a glance**
- A concise record overview, not a set of metrics: the date span of the documents and the **evidence coverage** ("6 source documents · 2 imaging reports, 2 lab reports, 1 consultation note, 1 prescription"), because every item on Home links back to one of them. It doesn't repeat counts shown in the sections below, and there's no AI-written interpretation.
- The entry point **Open Doctor Summary →** lives here.

**C. What changed**
- A true app module, **hidden until the first approved update**, with no empty-state placeholder. It appears between Your record at a glance and Latest in your record. Its first appearance is the demo payoff: the patient adds evidence, approves it, the documented picture visibly changes, and What changed appears. *(Learner decision.)*
- Heading format: "Updated from [document type] — [document date]". It lists each change, and each item opens the evidence drawer. For example:
  - "New ferritin measurement added"
  - "Matching follow-up result found"
  - "Iron treatment marked Completed · documented 25 Sep 2026"

**D. Latest in your record** — compact, grouped, scalable
- One row per category (Measurements, Treatment / medication, Imaging), with a deterministic count, the latest documented item (which opens its evidence), its **source reference** and a **View** link into History. Never one card per value.
- **Source reference (MyHeDo's visual signature):** a quiet, tappable line with a teal document mark, e.g. "Lab report · 27 Jan 2026 · p. 2". It opens the evidence drawer or sheet. The page is the fact's verified page, shown only when the document has more than one page, and never invented.
- Latest documented information only, as recorded, not a claim about the patient's state today. Longitudinal claims live in History and What changed.
- If many values sit outside their supplied ranges, Home may show a deterministic count (e.g. "N measurements outside their supplied ranges"), never one card per value and never judgement words. *(Not shown in this POC by learner decision: that historical information belongs in History and, where relevant, What changed.)*

**E. Follow-up on record**
- An open list (separators, no card) of recommendations explicitly written in source documents, carried forward with their recommendation date and source, e.g. "Repeat ferritin in 3 months." · Recommended 3 Feb 2026 · from your consultation note.
- Beneath the ferritin recommendation, a **derived chronology state**: before a later ferritin result exists, "No later ferritin result found in your record". Once an approved later result exists, it becomes "Matching follow-up result found · 25 Sep 2026". It's scoped to the record (it doesn't say whether a test happened elsewhere), and it never says "due", "overdue", "late", "missed" or "should have been done". *(Learner decision; this transition is part of the slice 4 demo.)*
- Never "To do", "Needs attention" or "To check". This section is documentary, not advice.

**F. Your history**
- Navigable destinations (Iron / Ferritin, Imaging follow-up) with factual counts and date spans, leading into History. There are no decorative charts or sparklines on Home; longitudinal visualisation belongs in History.

Acceptance criteria:
- [ ] On first load, Home shows Identity, Your record at a glance (with Open Doctor Summary), Latest in your record, Follow-up on record and Your history. What changed is absent.
- [ ] Your record at a glance shows only the document date span and evidence coverage, with no interpretive words.
- [ ] Latest in your record shows one grouped row per category, each with a count, the latest documented item (the medication with its documentation date), a source reference and a View link. The latest item and its source reference both open its evidence.
- [ ] Before the live update, the ferritin follow-up shows "No later ferritin result found in your record". After approval it shows "Matching follow-up result found · 25 Sep 2026". Both are derived and open "How this was determined".
- [ ] Follow-up on record shows only recommendations from source documents, each opening its evidence.
- [ ] Each Your history destination opens History on that topic.
- [ ] After the live update is approved, What changed appears between the summary and Latest in your record, with the document type and date. Each item opens the evidence drawer.

### History (topic template)
Source: `scope.md > The POC Boundary` ("Iron / Ferritin topic," "Imaging follow-up topic").

One reusable topic-detail view. A simple topic switcher inside History selects Iron / Ferritin (the default) or Imaging follow-up.

**Iron / Ferritin shows:**
- **Measurements over time:** a simple chart, plus rows with date, value, unit, the supplied range *for that result* and a source marker. Different labs may supply different ranges, and each row keeps its own.
  - Calculated labels where applicable: "outside supplied laboratory range," "inside supplied laboratory range," "changed since previous measurement," "previously outside supplied range." Each is visibly marked as **derived** (the user-facing word for the CALCULATED evidence type).
- **Medication episode:** oral iron, shown as a small status timeline, e.g. Prescribed (date, source) → Completed (date, source). Each state comes from an explicit source.
- **Documented follow-up:** the recommendation text, e.g. "Repeat ferritin in 3 months", with its date and source. When a later matching result exists, the section shows "Matching result found: Ferritin 32 μg/L — 25 Sep 2026". Elapsed time may be shown as plain chronology ("5 months after recommendation").

**Imaging follow-up shows** the same template without a chart: the earlier imaging report, its documented follow-up recommendation, and the later related examination. Each item has its date and source. It's **read-only.** No live update logic applies to it.

**After an update**, the new ferritin observation appears as the newest row and chart point. The medication episode shows its new documented status, and the follow-up area shows that a matching result was found. All three carry the latest-update treatment (see *Latest Update Marking*).

Acceptance criteria:
- [ ] Every measurement row shows date, value, unit, the range supplied with that result, and a clickable source marker.
- [ ] Calculated labels are visually distinct from source facts and open "How this was determined" in the drawer.
- [ ] The medication episode never shows Current, Completed or Stopped unless a source explicitly documents that state.
- [ ] The Imaging topic renders in the same template with no chart and no add or update actions.

### Evidence Drawer
Source: `scope.md > The Unique Kernel`.

A right-side drawer on desktop and a full-height sheet on mobile, keeping the patient in context. It's used by every view. On Home, sources appear as quiet references; the detailed provenance lives here.

**For a source fact:**
- The fact and value, e.g. "Ferritin 32 μg/L"
- The source: document title/type, document date, page number
- **Evidence:** the exact supporting excerpt, visually highlighted with a paper-like treatment
- **Open source document** opens the viewer modal

**For a calculated claim:**
- The drawer starts with **"How this was determined"**
- It lists the structured input facts the deterministic rule used. Each input can be clicked and reveals its own excerpt.
- Example, "Changed since previous measurement": Ferritin 19.6 μg/L (27 Jan 2026) and Ferritin 32 μg/L (25 Sep 2026)
- Example, "Matching follow-up result found": the earlier follow-up recommendation *and* the later approved ferritin result
- A calculated claim never shows a single excerpt as though a document stated it

**Source document viewer:** a modal showing the full synthetic document. It's for reading only; there's no document-management interface.

Acceptance criteria:
- [ ] Clicking any source fact anywhere opens the drawer with the value, document type, date, page and the exact highlighted excerpt.
- [ ] Clicking any calculated claim opens "How this was determined" and lists at least one clickable input fact. Each input opens its own excerpt.
- [ ] "Open source document" shows the full document in a modal, and closing it returns to the same drawer and view.
- [ ] No statement in the app lacks a path to evidence.

### Adding a Record and Reviewing Proposed Changes
Source: `scope.md > The POC Boundary` ("One live addition," "Proposed-changes review").

**Add record** opens a simple modal with a file picker. The patient selects the synthetic follow-up consultation note PDF. Drag-and-drop is optional and only worth adding if it's essentially free. The file picker is the demo path.

**Processing** is a neutral temporary state that says honestly what's happening, e.g. "Reading this record… Extracted facts will be shown for your review before anything changes." No sparkle or "AI magic" styling.

**Review panel** (a modal or panel, not a new screen):
- **Reviewable items are extracted source facts only.** For the demo record:
  - Ferritin 32 μg/L, reference range 15–150 μg/L, 25 Sep 2026, with its excerpt and page
  - Oral iron course: Completed, with its excerpt and page
- Each source fact can be individually rejected.
- **"This would also update…"** shows the derived consequences previewed by code. They're not checkboxes:
  - adds the new ferritin measurement to the longitudinal history
  - matching follow-up result found for the earlier documented ferritin recommendation
  - medication episode → Completed
- The preview recomputes live as source facts are rejected. Consequences that depend on a rejected fact disappear.
- Actions:
  - **Add all to my record**, or **Add selected** when something is excluded. The user-facing words are "Exclude" / "Excluded · undo"; the internal review state stays REJECTED.
  - **Cancel** discards the whole proposal, and nothing is imported
  - If every source fact is excluded, Add all / Add selected is disabled. Cancel stays available and closes the review, importing nothing. The panel's standard close control has the same effect. **No approved source facts → no Apply action → nothing is persisted.**
- The proposal is temporary. PROPOSED and REJECTED exist only inside this review. Refreshing or closing the app during review discards the proposal.
- Model confidence isn't required in the panel. If it's shown, it's review context only (see *Open Questions*).

**Dependency rules** (code, not UI):
- Reject the ferritin fact → it isn't imported, and "matching follow-up result found" is not applied.
- Approve ferritin, reject the medication fact → the measurement is imported, the matching follow-up result is found if the rules support it, and the medication status doesn't change.
- There's no dependency-management UI.

Acceptance criteria:
- [ ] Choosing the demo note produces a review panel listing exactly the extracted source facts, each with its excerpt and page, and a separate "This would also update…" preview.
- [ ] Nothing in Snapshot, History or Doctor Summary changes until Apply is clicked.
- [ ] Rejecting the ferritin fact removes the follow-up consequence from the preview. Applying then leaves the follow-up with no matching result.
- [ ] Rejecting the medication fact leaves the medication episode unchanged after Apply.
- [ ] Cancel leaves the history exactly as it was.
- [ ] With every source fact rejected, Apply is disabled. Cancel, or the panel's close control, leaves the history and document list exactly as they were.
- [ ] Refreshing during review returns to the unchanged history, with no proposal pending.
- [ ] Adding the same note again after it has been approved shows "No new history changes found. Your documented history hasn't changed." Nothing is added, including the document.

### Deterministic State Update
Source: `scope.md > The POC Boundary` ("Deterministic state update").

On Apply (with at least one approved source fact), code:
- writes **only APPROVED source facts** into the trusted history, with their provenance (document, date, page, excerpt)
- **discards rejected facts.** They're never written to the trusted state.
- adds the new document to the record, because at least one fact from it was approved
- recomputes all calculated claims from the current approved facts
- records this document as the **latest update**
- saves the new state so it persists across refresh and reopening

An approved extracted fact stays a **SOURCE FACT**. Approval changes only its review status. **PROPOSED** and **REJECTED** are transient review states. Only APPROVED facts are persisted.

### Latest Update Marking
Source: `scope.md > What "Working" Looks Like` (step 8).

- The most recently approved record is the **latest update**. Items it affected stay marked until another record is approved. There's no time-based highlighting.
- Treatment: a small "Added from latest record" or "Updated from latest record" label, a subtle tint or left rule, and the source date nearby. **No success-green.**
- The marking appears on the Snapshot's What changed section and on the affected items in Snapshot, History and Doctor Summary.

Acceptance criteria:
- [ ] After approval, the new ferritin row, the medication status and the follow-up state each show the latest-update label.
- [ ] Refreshing the page keeps both the updated state and the marking.

### Doctor Summary
Source: `scope.md > The POC Boundary` ("Doctor Summary").

A concise, **user-controlled, evidence-linked view of the history represented in this product.** Its practical job is "what should I show or discuss with a new doctor quickly?" It doesn't imply that this is the doctor's only access to the patient's medical history.

It's a short, scannable, typeset one-page brief built from the same approved state and rebuilt from it every time it's shown. There's no free-form LLM prose. Every statement comes from structured facts. The composition approach is confirmed in `4-spec`.

**Sections appear only when supported information exists.** Empty sections aren't shown, and absence is never inferred (no "No current medications").

For this fictional patient:
- **A. Relevant documented history.** Factual, e.g. "Ferritin has been measured repeatedly across the documented record, including 19.6 μg/L on 27 Jan 2026 and 32 μg/L on 25 Sep 2026." No diagnostic label (e.g. "iron deficiency") unless a source explicitly uses it.
- **B. Recent investigations.** E.g. "Ferritin — 32 μg/L · Supplied reference range: 15–150 μg/L · 25 Sep 2026."
- **C. Medication / recent treatment.** E.g. "Oral iron course — Completed. Completion documented in follow-up consultation note dated 25 Sep 2026." A "Current medication" subsection appears only if a source explicitly documents current use.
- **D. Documented follow-up.** E.g. "Ferritin recheck recommended in an earlier record. A later approved ferritin result has been found." This is calculated, so its marker leads to both the recommendation and the result. No "satisfied," "on time" or "late."
- **E. Imaging follow-up.** A short factual line using only wording the synthetic documents support.

**Provenance:** every line carries a compact source marker, e.g. `[Source 1]` or `[Sources 2, 4]`. Clicking it opens the same evidence drawer. Full excerpts don't appear inline.

Acceptance criteria:
- [ ] Before the live update, the summary shows the pre-update state, and the new ferritin value and "Completed" are absent.
- [ ] After approval, sections B, C and D reflect the new facts without any manual regeneration step.
- [ ] Every statement has a source marker, and every marker opens the evidence drawer.
- [ ] No section appears empty, and no "none"/absence statement appears.

### Synthetic Demo Record Set
Source: `scope.md > The POC Boundary` ("One fictional adult patient").

All documents are **fully fictional, in English, and clearly marked as synthetic.** They contain no real names, IDs, addresses, barcodes, QR codes or prescription numbers. They're written so that they're internally consistent and produce the demo story.

**Initial history (5–6 documents, pre-structured, review status APPROVED)** must together establish:
- at least two earlier ferritin results on different dates, including 19.6 μg/L on 27 Jan 2026, each with the range supplied by its lab (ranges may differ between labs)
- an oral iron **prescription** (establishes Prescribed only)
- an explicit, dated recommendation to **repeat ferritin after a defined interval**
- an imaging report with an explicit follow-up recommendation, and a later imaging report that **explicitly references the earlier examination**. Otherwise "related" would be an inferred connection, which is out of scope.

**Live record (1 document):** a **follow-up consultation note** dated 25 Sep 2026 that explicitly states:
- "Ferritin on 25 Sep 2026: 32 μg/L (reference range 15–150)" or equivalent
- that the patient completed the prescribed oral iron course

It does **not** say "follow-up satisfied." That relationship is calculated.

Exact document contents and dates are finalised in `4-spec` and the build, within these constraints.

### Demo Reset
Source: `scope.md > The POC Boundary` (demo reliability).

- One reliable action, e.g. "Reset demo data", available **only in a demo/development mode or a hidden control.** It must never appear in the normal recorded product flow.
- It restores the initial documents, the initial Iron / Ferritin history, the original medication and follow-up states, and the Imaging topic. The live note is no longer imported, and there's no latest-update state.

Acceptance criteria:
- [ ] After a full demo run, one reset action returns the app to the exact first-load state, and it stays that way after a refresh.
- [ ] The reset control isn't visible in the normal product interface.

---

## States and Boundaries

- **First load / normal use.** The pre-built history appears immediately. There's no empty state, and What changed is absent.
- **Processing.** A neutral progress state. The history underneath is unchanged.
- **Proposal ready.** The review panel shows. Nothing is trusted yet.
- **Extraction unusable or schema-invalid.** It can't proceed to review. The patient sees a calm, factual message, e.g. "This record couldn't be read into structured facts. Your history hasn't changed." Nothing is imported.
- **Valid record, nothing new** (e.g. the same note added again after it's been approved). The message is neutral: "No new history changes found. Your documented history hasn't changed." There's no warning or failure language. **The document isn't persisted.** This isn't a document archive.
- **All facts rejected.** Apply is disabled. Cancel or close imports nothing, including the document, and the history is unchanged.
- **Cancelled or closed review.** Nothing is imported.
- **Refresh or close during review.** The temporary proposal is discarded, and the history is unchanged.
- **After approval.** The updated state, the latest-update marking and What changed appear everywhere.
- **Persistence.** Only approved source facts, documents with at least one approved fact, and the latest-update marker persist across refresh and reopening. PROPOSED and REJECTED are never persisted.
- **Boundaries.** One fictional patient, with no accounts, profiles or sharing.

---

## Product Decisions

- **The primary user is an adult patient managing their own history before seeing a new doctor.** Caregivers and multiple profiles are a different product problem.
- **Positioning: a trust layer for medical evidence outside structured health records.** Structured, provider-backed records (e.g. Greece's National EHR / MyHealth) already exist. This POC complements rather than replaces them, and its differentiator is the verification-and-approval pipeline, not storage or access (`scope.md > Context and Positioning`).
- **A hybrid live-AI approach.** The initial history is pre-structured, and one new document is extracted live. This proves the state isn't hardcoded, without staging a fake batch ingestion.
- **AI extracts; code validates, derives and composes; the patient approves.** This keeps the trust boundary explicit.
- **Patients approve evidence. Code derives consequences.** Only source facts are reviewable, and calculated consequences recompute automatically. This prevents inconsistent states and needs no dependency UI.
- **Evidence type is separate from review status.** SOURCE FACT and CALCULATED are types. PROPOSED, APPROVED and REJECTED are statuses. Only APPROVED is persisted, and PROPOSED and REJECTED exist only during review. USER CONFIRMED is reserved for the patient's own knowledge and isn't part of this POC.
- **Nothing is persisted without at least one approved fact.** Cancel, reject-all, a refresh mid-review and a nothing-new record all leave the history and document list unchanged, because this isn't a document archive.
- **Patient-facing language avoids internal model terms.** "Updated from Follow-up consultation note · 25 Sep 2026," not "source facts approved."
- **Medication states come only from explicit sources.** Prescription ≠ Current. Current, Completed and Stopped each need explicit documentation.
- **"Matching follow-up result found," not "follow-up satisfied."** Code may calculate chronology, but not judgement ("late," "on time," "satisfied").
- **The new document is a follow-up consultation note.** One realistic document gives two source facts plus a calculated consequence.
- **The demo opens on an existing history.** No empty-state or batch-upload opening, because live processing that isn't happening shouldn't be staged.
- **Three primary views.** Imaging reuses the History template, and everything else is a panel, drawer or modal. This avoids a records-management app.
- **The evidence drawer sits on the right**, keeping provenance immediate and in context.
- **Doctor Summary provenance uses compact source markers on every line.** It stays concise, and provenance is never hidden.
- **Latest-update marking works by update batch, not by time.** It's deterministic and reliable for the demo.
- **No "Needs attention" section and no traffic-light colours.** Both would imply medical prioritisation or judgement.
- **Working brand: MyHeDo, "My health, documented."** Chosen once the product was visible, as planned. It's a hackathon working brand, not a cleared trademark, and is never abbreviated to an acronym.
- **A responsive personal app, not a document.** The application contains medical records but doesn't look like one. Only the Doctor Summary is deliberately a typeset clinical brief.
- **Demo reset stays out of the product UI.** It's demo infrastructure, not a feature.

---

## What We're Building
- Home (the Snapshot), History (two topics through one template) and Doctor Summary, in a responsive app shell (sidebar on desktop, tab bar on mobile)
- The evidence drawer for source facts and calculated claims, plus a source document viewer modal
- An initial synthetic record set (5–6 documents) pre-structured into Document, Observation, MedicationEpisode and FollowUp
- Add record through a file picker → live AI extraction from one follow-up consultation note → validation
- A review panel: reviewable source facts, a live "This would also update…" preview, Add all to my record / Add selected / Cancel
- Deterministic state update, recomputation of calculated claims, and persistence of approved state
- Latest-update marking and the What changed section
- A Doctor Summary composed from approved structured facts, with source markers
- Unusable-extraction and nothing-new states
- A hidden demo reset

## Deferred From the POC
- **Live updates for the Imaging topic and other topics.** The mechanism is proven on one topic.
- **Live extraction of arbitrary uploads and the initial batch.** It's commodity work and a demo risk.
- **"Possibly related" connections (POSSIBLE CONNECTION).** It's the system's own inference and would need careful policing.
- **USER CONFIRMED input** (e.g. "I'm still taking this"). Not needed to prove the kernel.
- **Manual correction of facts, and undoing an approved change.** Correction flows add scope without proving the kernel.
- **Exporting, printing or sharing the Doctor Summary.** On-screen is enough for the demo.
- **Displaying model confidence.** Optional context only (see *Open Questions*).

## Possible Later Enhancements
- More longitudinal topics built on the same model and History template.
- Drag-and-drop upload.
- Private local testing with real documents, always outside the repository.
- Multilingual records and interface.
- Final product name and brand identity (before `6-ship`).
- Possible integration with structured health-record systems (outside this hackathon POC).

## Non-Goals
- **Diagnosis, symptom checking, treatment or medication advice, interaction checks, risk scoring.** This isn't an AI doctor.
- **Interpretive value labels** (good, bad, dangerous, healthy, low, high). Only "inside/outside supplied range."
- **Judgements about timing** (late, overdue, on time, satisfied). Chronology only.
- **Claiming two findings are the same** without a document that says so.
- **Auto-applying changes based on model confidence.**
- **Free-form LLM summary prose.**
- **Accounts, caregivers, multiple patients, permissions, consent flows.**
- **Appointments, messaging, integrations (hospital, national, EHR), insurance, billing, wellness, wearables.**
- **Replacing a national EHR, MyHealth or any provider-backed record system; acting as a general patient portal.** Integration with structured records is a possible future direction, outside this POC.
- **Overbroad positioning claims:** "all your medical history in one place," giving doctors history they "otherwise can't see," or creating a record national systems don't have.
- **A document-management interface, bounding-box annotation, OCR research, a large ontology.**
- **Any real medical data in the repository or its history.**

## Open Questions
- **Showing model confidence in the review panel.** Optional context only, never authorization. *Doesn't block `4-spec`.* Decide during spec or build based on cost.
- **Exact synthetic document contents and timeline.** The constraints are set above. *Doesn't block `4-spec`.* They're finalised there and in the build.