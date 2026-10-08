/**
 * Empty-record first use. The real Home, History and Doctor Summary pages are rendered to HTML, once with the
 * seeded demo and once with a genuinely empty record: the seeded demo must never show any empty-record UI, and the
 * empty record must show only that.
 */
import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import type { ReactElement } from "react";
import type { TrustedState } from "@/lib/model/types";

let current: TrustedState;
vi.mock("@/lib/store/stateStore", () => ({
  readState: async () => current,
  StateCorruptedError: class StateCorruptedError extends Error {},
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh() {}, push() {}, replace() {} }),
  usePathname: () => "/",
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));

import HomePage from "@/app/page";
import HistoryPage from "@/app/history/[topic]/page";
import DoctorSummaryPage from "@/app/summary/page";
import { isEmptyRecord } from "@/lib/view/emptyRecord";

const seed: TrustedState = JSON.parse(readFileSync(path.resolve(__dirname, "../data/seed/state.json"), "utf8"));
const empty: TrustedState = { ...seed, documents: [], episodes: [], facts: [], latestUpdate: null };

const EMPTY_UI = ["No records yet", "Start your record", "Add your first record", "No history yet.", "Nothing to summarize yet."];

async function render(state: TrustedState) {
  current = state;
  const html = async (page: Promise<ReactElement> | ReactElement) => renderToStaticMarkup(await page);
  return {
    home: await html(HomePage()),
    iron: await html(HistoryPage({ params: Promise.resolve({ topic: "iron" }) })),
    imaging: await html(HistoryPage({ params: Promise.resolve({ topic: "imaging" }) })),
    summary: await html(DoctorSummaryPage()),
  };
}

describe("the seeded demo never shows the empty-record UI", () => {
  it("starts with six synthetic documents and is not an empty record", () => {
    expect(seed.documents).toHaveLength(6);
    expect(isEmptyRecord(seed)).toBe(false);
  });

  it("Home, History and the Doctor Summary render their normal content", async () => {
    const pages = await render(seed);
    for (const [name, html] of Object.entries(pages)) {
      for (const text of EMPTY_UI) expect(html, `${name} shows "${text}"`).not.toContain(text);
    }
    expect(pages.home).toContain("Your record at a glance");
    expect(pages.home).toContain("6 source documents");
    expect(pages.home).toContain("Open Doctor Summary");
    expect(pages.home).toContain(">Add record<");
    expect(pages.summary).toContain("from 6 source documents");
  });

  it("a record with any document or any fact is not empty", () => {
    expect(isEmptyRecord({ ...empty, documents: seed.documents.slice(0, 1) })).toBe(false);
    expect(isEmptyRecord({ ...empty, facts: seed.facts.slice(0, 1) })).toBe(false);
  });
});

describe("a record with exactly one document (e.g. right after the first approval)", () => {
  // one source document, one date: the laboratory report of 27 Jan 2026 from the seed (it also opens a history card)
  const one: TrustedState = {
    ...seed,
    documents: seed.documents.filter((d) => d.id === "doc-03"),
    facts: seed.facts.filter((f) => f.source.documentId === "doc-03"),
    latestUpdate: null,
  };

  it("counts '1 source document' and shows a single date instead of 'X to X'", async () => {
    const { home, iron, summary } = await render(one);
    expect(home).toContain("1 source document");
    expect(home).not.toContain("1 source documents");
    expect(home).toContain("What your documented record contains · 27 Jan 2026<");
    expect(home).not.toContain("27 Jan 2026 to 27 Jan 2026");
    expect(home).toContain(">Jan 2026<"); // the history card's month span
    expect(home).not.toContain("Jan 2026 – Jan 2026");
    expect(iron).toContain("across time · 27 Jan 2026<");
    expect(iron).not.toContain("27 Jan 2026 to 27 Jan 2026");
    expect(summary).toContain("from 1 source document · latest source dated 27 Jan 2026");
  });

  it("the seeded demo keeps its multi-date spans and plural counts", async () => {
    const { home, iron, summary } = await render(seed);
    expect(home).toContain("What your documented record contains · 14 Mar 2025 to 12 Mar 2026");
    expect(home).toContain("Mar 2025 – Jan 2026");
    expect(home).toContain("Sep 2025 – Mar 2026");
    expect(iron).toMatch(/14 Mar 2025 to \d{1,2} \w{3} 2026/);
    expect(summary).toContain("from 6 source documents · latest source dated 12 Mar 2026");
  });
});

describe("a genuinely empty record uses Home itself as first use", () => {
  it("is recognised as empty", () => {
    expect(isEmptyRecord(empty)).toBe(true);
  });

  it("Home shows one clear start and nothing else", async () => {
    const { home } = await render(empty);
    expect(home).toContain("No records yet");
    expect(home).toContain("Start your record");
    expect(home).toContain(
      "Add your first medical document (PDF). MRI proposes supported facts, checks each one against the source page, and adds only what you approve.",
    );
    expect(home).toContain(">Add your first record<");
    expect(home).not.toContain(">Add record<"); // the header action is hidden: one clear action
    expect(home).not.toContain("Open Doctor Summary"); // nothing to summarize yet
    expect(home).not.toContain("Your record at a glance");
    expect(home).not.toContain("Record updated");
  });

  it("History and the Doctor Summary show one quiet line", async () => {
    const { iron, imaging, summary } = await render(empty);
    for (const html of [iron, imaging]) expect(html).toContain("No history yet.");
    expect(summary).toContain("Nothing to summarize yet.");
    expect(summary).not.toContain("source documents");
  });
});
