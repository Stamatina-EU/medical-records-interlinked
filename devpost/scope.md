---
doc: scope
status: approved
---

> **Historical planning artifact:** This is the original scope-stage document. The project later evolved into **MRI — Medical Records Interlinked**. Historical decisions and placeholders below are preserved; the final implemented architecture and default demo are documented in [README](../README.md) and [the rich-record integration note](rich-record-integration.md).

# Working title: TBD

Medical evidence can exist outside a structured health record as older PDFs, scans or reports from other providers. This proof of concept demonstrates, using a clean text-layer PDF, how such external evidence can safely become part of a verified, source-linked longitudinal history. The history updates only after the patient approves the proposed evidence. *(Working description, not final copy.)*

## The Unique Kernel
**New evidence proposes changes to a longitudinal medical history. The patient approves them, and every resulting claim stays traceable to its evidence.** Every source fact is traceable to an exact supporting excerpt. Every calculated or derived claim is traceable to the structured facts that produced it, and through them to their supporting source excerpts.

The AI proposes, deterministic code decides what can change, and the patient confirms. Extraction is only the way in. The product is the trusted, source-linked history and the visible, reviewable way it changes.

Core principle: *no medical claim without provenance.*

## Who It's For
An **adult patient managing their own medical history**. They've built up records over several years across different providers and diagnostic centres. Some of that evidence may already be in a provider-backed structured health record, and some exists only as PDFs, scans or reports that aren't represented there. **They're about to see a new doctor or specialist.**

They need to quickly understand and communicate:
- what's current
- what happened before
- what's being monitored
- what follow-up was documented
- which medication is current and which is historical
- where every statement came from

Documents that aren't represented in a structured record stay as separate files. A folder of documents doesn't answer those questions, and any summary of them is only as trustworthy as its link back to what the documents actually say.

## Context and Positioning
**Existing context.** Structured, provider-backed health records already exist. In Greece, for example, the National Electronic Health Record / MyHealth ecosystem gives citizens access to centrally recorded examinations, prescriptions, diagnoses and hospitalisations. Doctors can access patient history through the corresponding national system, and a MyHealth Agent answers questions using information already in the citizen's record. Only information recorded by healthcare providers appears there.

**Commodity or existing capabilities** (not our differentiation): centralised health records; prescriptions and referrals; structured provider-entered health data; search and question answering over existing health-record data; and generic document upload, OCR and trend charts in other products.

**What this POC demonstrates:** an unstructured external medical document → structured proposed facts → deterministic source verification → patient approval → an evidence-linked longitudinal update. **The trust pipeline is the differentiator.**

**This POC is not:** a replacement for a national EHR, MyHealth or any other provider-backed record system; an EHR or government health-system integration; or a general patient portal.

**Claims we don't make:** that it "finally brings all your medical history into one place," that it gives doctors access to history they otherwise can't see, or that it creates a record national systems don't have.

## The Core Loop
1. A new medical record arrives, and the patient adds it.
2. The system proposes what the record would change, with a source excerpt for each change.
3. The patient approves (or rejects) the changes, and the trusted history updates.
4. Before an appointment, the patient opens the Doctor Summary, which always reflects the current approved state.

They come back with every new record and before every new appointment.

## Inspiration & Identity
- Calm, trustworthy and polished. Intentional product design, even at small technical scope.
- Evidence is always one click away, and evidence is visibly different from inference.
- Not an AI doctor. The tone is factual and documentary: "outside the supplied laboratory range," never "bad" or "dangerous."
- English throughout. No copying competitor UI, wording or branding.
- *Visual direction not yet defined. `3-prd` will cover it.*

## Why This Matters to the Learner
Practising how to turn product judgment into an implementation-ready spec "that keeps an AI coding agent aligned without overbuilding". Especially "deciding what should be handled by AI reasoning and what should remain deterministic code" in a product where trust, provenance and accuracy matter. This project's kernel is exactly that boundary.

Hackathon judging criteria (weighted equally): Design, Potential Impact, Innovation/Idea, Presentation.

## What "Working" Looks Like
A demo that starts from an **existing fictional patient history**, already built from ~5–6 synthetic source records that can be opened:

1. Open the Health Snapshot: what matters now and what changed.
2. Open the Iron / Ferritin history. Click a fact and see its source excerpt.
3. Briefly show a second, non-numeric topic (Imaging follow-up) to show breadth.
4. Add **one new synthetic medical document.**
5. The AI processes it live and extracts proposed structured facts.
6. **The "oh, that's cool" beat:** a compact review panel appears. It lists the extracted source facts (a new ferritin measurement and documented ongoing oral iron), each with its supporting excerpt. Below them, it previews what code would derive: "This would also update… · matching follow-up result found · medication episode → Ongoing."
7. The patient approves. Deterministic code updates the trusted state.
8. The history shows exactly what changed.
9. Open the Doctor Summary. It now reflects the approved evidence, and every statement traces back to its supporting facts and source excerpts.

If extraction is schema-invalid or unusable, it can't proceed to review. Nothing touches the trusted state, and the patient sees why.

## The POC Boundary
- **One fictional adult patient.** ~5–6 synthetic English source documents, pre-structured and treated as already reviewed (review status APPROVED). They can be opened as evidence.
- **One structured state** using four entities: Document, Observation, MedicationEpisode and FollowUp. Each source fact carries provenance: source document, date, page and exact excerpt.
- **Evidence type and review status are separate things.**
  - *Evidence type:* **SOURCE FACT**, stated in a document and linked to an exact excerpt. **CALCULATED**, derived by code from structured facts (e.g., "outside supplied range," "changed since previous," "matching follow-up result found") and linked to the facts that produced it.
  - *Review status:* **PROPOSED**, **APPROVED**, **REJECTED**. Patient approval changes only the review status. An approved extracted fact is still a SOURCE FACT.
  - **USER CONFIRMED** is reserved for things the patient confirms from their own knowledge (e.g., "I'm still taking this"). It isn't part of the proof-of-concept demo flow.
- **Health Snapshot:** the patient's view of the current state and what changed.
- **Iron / Ferritin topic:** the fully functional topic. It covers measurements over time with their supplied ranges, the related medication episode and the documented follow-up.
- **Imaging follow-up topic:** a small, read-only topic that already exists in the history. It reuses the same model and view, with no live update logic.
- **One live addition:** the AI extracts facts from one new synthetic document, then deterministic code validates them. Schema-invalid or unusable extraction can't proceed to review. Valid extracted changes stay PROPOSED until the patient explicitly approves them. Model confidence may be shown as review context, but it never authorizes a trusted-state update. *Model confidence is not medical truth.*
- **Proposed-changes review:** a lightweight panel, not a new screen. It shows a change summary and the supporting evidence for each change, with "Apply all" or reject per change.
- **Deterministic state update** on approval, with the change made visible.
- **Doctor Summary:** a second presentation of the same state, rebuilt after every change. Every statement traces back to its supporting facts and source excerpts. No free-form LLM prose. The preferred approach is deterministic or tightly controlled composition, to be confirmed in spec.
- **Medication states come only from explicit sources.** Each state needs a document that explicitly says so:
  - **Prescribed:** a prescription or other source.
  - **Current:** a source that documents current use.
  - **Completed:** a source that documents completion.
  - **Stopped:** a source that documents stopping.

  Inferring "a prescription exists → the medication is Current" is forbidden. In the future, USER CONFIRMED could be another way to establish current use. It's not needed for this demo.
- **Safety rules built into the language:** a prescription is not proof the medication was taken, ranges are always "as supplied," and a relationship is never claimed unless a document states it.

## Later
- Live extraction for arbitrary uploads and for the initial batch
- Live updates for the imaging topic and for further topics
- "Possibly related to an earlier finding" connections (the POSSIBLE CONNECTION state)
- USER CONFIRMED input, e.g., the patient confirming from their own knowledge that they're still taking a medication (an additional way to establish Current alongside explicit sources)
- Manual correction of facts, and undoing an approved change
- Exporting or sharing the Doctor Summary (PDF, link)
- Private local testing with real documents, always outside the repository
- Multilingual support
- Product name and brand identity
- Possible integration with structured health-record systems (outside this hackathon POC)

## Explicitly Cut
- **Empty state and batch-upload demo opening.** The initial history is preprocessed, so a live batch opening would stage processing that isn't actually happening.
- **Caregivers, family members, multiple profiles, permissions, consent flows.** These are a different product problem.
- **Auto-applying "high-confidence" changes.** Model confidence isn't medical truth, and patient approval is part of the trust model.
- **Free-form LLM summaries.** Nobody can guarantee the provenance of each statement.
- **Model confidence as authorization.** Confidence can inform the review, but it never replaces the patient's approval.
- **Diagnosis, symptom checking, treatment, medication or interaction advice, risk scoring.** This isn't an AI doctor.
- **Appointments, messaging, hospital/national/EHR integrations, insurance, billing, wellness, fitness, wearables.** None of these is needed to prove the kernel.
- **Acting as, or replacing, a national EHR, MyHealth, a provider-backed record system or a general patient portal.** This POC is not a national EHR, a provider-backed record system, an EHR/government-health-system integration, or a general patient portal. It is a trust layer for incorporating external medical evidence into a user-controlled, source-linked longitudinal history.
- **Bounding boxes, OCR research, a large medical ontology, generalized medical reasoning.** Page-level provenance plus the exact excerpt is enough.
- **Any real medical data anywhere in the repository or its history.** The repo will be public.
