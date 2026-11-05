// The contract as a live document: spans that stay put, tracked changes worked out from the vendor's
// words, highlights that land on the right words in either reading, and new clauses that never move
// an existing cite.

import { describe, expect, it } from "vitest";
import { findPassage } from "./contract";
import {
  anchorQuote,
  currentText,
  documentChanges,
  documentSections,
  emptyDoc,
  locateEdit,
  markRuns,
  nextClauseCite,
  originalText,
  passageSpans,
  spanRuns,
  type ClauseRedline,
  type DocState,
} from "./document";
import { getMatter } from "./matters";
import { reviewContract } from "./review";
import { contracts } from "./testing";

const acme = contracts["acme-msa"];
const findings = reviewContract(getMatter("acme-msa"));
const liability = findings.find((f) => f.ruleId === "PB-LIAB-01")!;
const p82 = findPassage(acme, "§8.2")!;
const p23 = findPassage(acme, "§2.3")!;

/** The clauses the review's deviations replace, drafted (the copilot's redlines) or not yet. */
const clauses = (drafted: boolean): ClauseRedline[] =>
  findings.filter((f) => f.ruleId && f.status === "deviation" && f.redline).map((f) => ({ ruleId: f.ruleId!, clause: f.clause, text: drafted ? f.redline : null, by: drafted ? "agent" : null, finding: f }));

describe("spans", () => {
  it("splits a passage around the sentence its redline replaces, with keys that stay put", () => {
    const before = passageSpans(p82, clauses(false), {});
    const after = passageSpans(p82, clauses(true), {});
    expect(before.map((s) => s.key)).toEqual(after.map((s) => s.key));
    const clause = after.find((s) => s.kind === "clause")!;
    expect(clause).toMatchObject({ key: "rule:PB-LIAB-01", base: liability.clause, text: liability.redline, by: "agent" });
    expect(before.find((s) => s.kind === "clause")!.text).toBe(liability.clause); // nothing drafted yet: no change
  });

  it("keeps a passage with no redline as one text span, and reads a free edit from the document state", () => {
    const spans = passageSpans(p23, clauses(true), { "§2.3:0": { text: "Acme will make the Services available.", by: "human" } });
    expect(spans).toHaveLength(1);
    expect(spans[0]).toMatchObject({ kind: "text", key: "§2.3:0", base: p23.text, text: "Acme will make the Services available.", by: "human" });
  });
});

describe("runs", () => {
  it("reads as the vendor's words one way and as Northstar's markup the other", () => {
    const runs = spanRuns(passageSpans(p82, clauses(true), {}));
    expect(originalText(runs)).toBe(p82.text);
    expect(currentText(runs)).toBe(p82.text.replace(liability.clause, liability.redline!));
    const struck = runs.filter((r) => r.kind === "del").map((r) => r.text.trim());
    const inserted = runs.filter((r) => r.kind === "ins").map((r) => r.text.trim());
    expect(struck).toEqual(["three (3)"]);
    expect(inserted).toEqual(["twelve (12)"]);
    expect(runs.filter((r) => r.kind !== "same").every((r) => r.change === "rule:PB-LIAB-01")).toBe(true);
  });

  it("reads every redlined passage exactly both ways, even where the redline only moves a comma (§6.1)", () => {
    for (const section of documentSections(acme, clauses(true), emptyDoc())) {
      for (const passage of section.passages) {
        const runs = spanRuns(passage.spans);
        const vendor = findPassage(acme, passage.cite)!.text;
        expect(originalText(runs), passage.cite).toBe(vendor);
        const clause = passage.spans.find((s) => s.kind === "clause");
        if (clause) expect(currentText(runs), passage.cite).toBe(vendor.replace(clause.base, clause.text));
      }
    }
    const p61 = spanRuns(passageSpans(findPassage(acme, "§6.1")!, clauses(true), {}));
    expect(p61.filter((r) => r.kind === "ins").map((r) => r.text.trim())).toContain(",");
  });

  it("draws an added clause as one insertion", () => {
    const doc: DocState = { ...emptyDoc(), inserts: [{ cite: "§5.4", section: 5, caption: "Security reports", text: "Acme will send its SOC 2 Type II report.", by: "agent", at: "2026-11-05T10:00" }] };
    const passage = documentSections(acme, clauses(true), doc).find((s) => s.number === 5)!.passages.at(-1)!;
    expect(passage.cite).toBe("§5.4");
    expect(spanRuns(passage.spans)).toEqual([{ kind: "ins", text: "Acme will send its SOC 2 Type II report.", span: "insert:§5.4", change: "insert:§5.4", marks: [] }]);
  });
});

describe("highlights", () => {
  const runs = spanRuns(passageSpans(p82, clauses(true), {}));

  it("finds the vendor's quote in the original reading when the redline struck part of it", () => {
    const at = anchorQuote(runs, liability.quote, "current");
    expect(at?.on).toBe("original");
    expect(originalText(runs).slice(at!.start, at!.end)).toBe(liability.quote);
  });

  it("finds Northstar's words in the current reading", () => {
    const at = anchorQuote(runs, "twelve (12) months before the event")!;
    expect(at.on).toBe("current");
  });

  it("marks exactly the quoted words, splitting runs at its edges and skipping the inserted ones", () => {
    const at = anchorQuote(runs, liability.quote, "original")!;
    const marked = markRuns(runs, [{ id: "cite", ...at }]);
    expect(marked.filter((r) => r.marks.includes("cite") && r.kind !== "ins").map((r) => r.text).join("")).toBe(liability.quote);
    expect(marked.filter((r) => r.kind === "ins").every((r) => !r.marks.includes("cite"))).toBe(true);
    expect(originalText(marked)).toBe(originalText(runs));
  });

  it("returns null for words that are in neither reading", () => {
    expect(anchorQuote(runs, "a sentence nobody wrote")).toBeNull();
  });
});

describe("changes", () => {
  it("lists the drafted redlines and free edits in document order, each with its author", () => {
    const doc: DocState = { ...emptyDoc(), edits: { "§2.3:0": { text: p23.text.replace("which are Northstar's only remedy for the missed target", "which do not limit Northstar's other rights and remedies"), by: "agent" } } };
    const changes = documentChanges(documentSections(acme, clauses(true), doc));
    expect(changes[0]).toMatchObject({ id: "§2.3:0", cite: "§2.3", kind: "edit", by: "agent", ruleId: null });
    expect(changes.filter((c) => c.kind === "replace").map((c) => c.ruleId)).toEqual(["PB-REN-01", "PB-PAY-01", "PB-DATA-01", "PB-DATA-02", "PB-IP-01", "PB-LIAB-01", "PB-TERM-01"]);
  });

  it("has no changes before anything is drafted or edited", () => {
    expect(documentChanges(documentSections(acme, clauses(false), emptyDoc()))).toEqual([]);
  });
});

describe("new clauses", () => {
  it("numbers a new clause after the section's last passage, counting clauses already added", () => {
    expect(nextClauseCite(acme, [], 5)).toBe("§5.4");
    expect(nextClauseCite(acme, [{ cite: "§5.4", section: 5, caption: "x", text: "x", by: "agent", at: "" }], 5)).toBe("§5.5");
    expect(nextClauseCite(acme, [], 99)).toBeNull();
  });
});

describe("suggested edits", () => {
  it("lands an edit in the span whose words it quotes", () => {
    const spans = passageSpans(p23, clauses(true), {});
    const result = locateEdit(spans, "which are Northstar's only remedy for the missed target", "which do not limit Northstar's other rights and remedies");
    expect("span" in result && result.span.key).toBe("§2.3:0");
    expect("next" in result && result.next).toContain("which do not limit Northstar's other rights and remedies.");
  });

  it("lands an edit inside a redlined sentence on that redline", () => {
    const result = locateEdit(passageSpans(p82, clauses(true), {}), "twelve (12) months", "eighteen (18) months");
    expect("span" in result && result.span.key).toBe("rule:PB-LIAB-01");
  });

  it("refuses words that are not in the passage as it reads now, and says what it reads", () => {
    const result = locateEdit(passageSpans(p82, clauses(true), {}), "three (3) months", "six (6) months");
    expect("error" in result && result.error).toContain("is not in §8.2 as it reads now");
  });
});
