# The Medical Recordbook experiment

Repository: Medical Recordbook checkout
Branch: design/medical-recordbook
Baseline: 7cfdec4

This note records the initial presentation experiment, now preserved in committed Recordbook checkpoints. The scope and validation below describe that initial stage; the current rich integration is documented in [the integration note](devpost/rich-record-integration.md). The original repository was not edited.

## Experience

- Four destinations: Record, History, Sources, Doctor Summary. Compact desktop navigation and labelled mobile tabs; Add record stays available.
- Record presents the latest source, Iron / Ferritin and Imaging chapters, sourced recommendations and separately calculated follow-up results, a summary route and compact document coverage.
- On large screens, evidence occupies an adjacent reader. On mobile, it becomes a modal sheet with keyboard focus containment and scroll locking.
- Direct evidence starts with the fact and exact source wording. Calculated claims show the existing deterministic rule and every input's source wording. Source PDFs remain accessible at the cited page.
- Sources lists the actual trusted documents, dates, types, issuers, page counts and supported chapters, with source-fact inspection.
- History retains the ferritin chart and each measurement's supplied range. Dated sequences bring measurements, medication statements and recommendations together. Secondary calculations are expandable.
- Add record introduces the text-PDF / ferritin / oral-iron scope before file selection. Review uses checked inclusion controls and a selection-count CTA, while retaining the same rejected set, preview engine, approvedFactIds payload and server behaviour. Uncertain approval outcomes retain their original meaning.
- Doctor Summary keeps its deterministic text and numbered evidence links, with document styling distinct from the application.

## Frozen boundary

Compared with 7cfdec4, all lib/ code, API routes, seed state and PDFs, corpus, demo documents, scripts, package manifest and lockfile, font definitions and logo assets are unchanged. No fonts were installed or repaired.

## Validation (10 October 2026)

- Existing 486 tests plus six review regression cases: 492 passing.
- TypeScript and production build passed.
- demo:reset and verify:seed passed: six documents and eight facts verified.
- All destinations checked at 1440, 390 and 320 px with no horizontal overflow.
- Direct and calculated evidence navigation, PDF access, Escape, focus restoration and mobile modal containment checked in the browser.
- Live AI extraction check omitted at the user's request: this isolated checkout has no OPENAI_API_KEY. Deterministic proposal/review selection and approval semantics remain covered by tests; a complete live upload-to-approval browser journey was not run.

## Preview

Production preview: http://127.0.0.1:3101

Run from this workspace only:

```powershell
npm run build
npm run start -- -p 3101
```

Local preview captures are in .design-checks/ (gitignored). Tool download cache is .npm-cache/ (gitignored).
