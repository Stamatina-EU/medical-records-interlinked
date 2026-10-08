/** Shared display rules: count + noun, and date spans that collapse to one date when both ends read the same. */
import { describe, expect, it } from "vitest";
import { plural } from "@/lib/text/plural";
import { formatDate, formatSpan } from "@/lib/text/dates";

const monthYear = (iso: string) => formatDate(iso).split(" ").slice(1).join(" ");

describe("plural", () => {
  it("uses the singular for exactly one, the plural otherwise", () => {
    expect(plural(1, "source document")).toBe("1 source document");
    expect(plural(6, "source document")).toBe("6 source documents");
    expect(plural(0, "source document")).toBe("0 source documents");
    expect(plural(2, "treatment documented", "treatments documented")).toBe("2 treatments documented");
  });
});

describe("formatSpan", () => {
  it("shows one date when start and end are the same day", () => {
    expect(formatSpan("2026-09-25", "2026-09-25")).toBe("25 Sep 2026");
  });
  it("keeps multi-date spans unchanged", () => {
    expect(formatSpan("2025-03-14", "2026-09-25")).toBe("14 Mar 2025 to 25 Sep 2026");
  });
  it("applies the same rule to month-level spans", () => {
    expect(formatSpan("2026-09-03", "2026-09-25", monthYear, " – ")).toBe("Sep 2026");
    expect(formatSpan("2025-03-14", "2026-01-27", monthYear, " – ")).toBe("Mar 2025 – Jan 2026");
  });
});
