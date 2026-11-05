// A redline reads as a blackline: the vendor's own words, the changed ones struck, Northstar's inserted.

import { describe, expect, it } from "vitest";
import { blackline } from "./blackline";
import { getMatter } from "./matters";
import { reviewContract } from "./review";

const struck = (before: string, after: string) => blackline(before, after).filter((p) => p.kind === "del").map((p) => p.text);
const inserted = (before: string, after: string) => blackline(before, after).filter((p) => p.kind === "ins").map((p) => p.text);

describe("the blackline", () => {
  it("strikes only Acme's changed words in the liability cap", () => {
    const f = reviewContract(getMatter("acme-msa")).find((x) => x.ruleId === "PB-LIAB-01")!;
    expect(blackline(f.clause, f.redline!)).toEqual([
      { kind: "same", text: "Each party's total liability arising out of or relating to this Agreement will not exceed the fees paid by Northstar in the" },
      { kind: "del", text: "three (3)" },
      { kind: "ins", text: "twelve (12)" },
      { kind: "same", text: "months before the event giving rise to the claim." },
    ]);
  });

  it("marks two changes in one sentence (the renewal term and its notice)", () => {
    const f = reviewContract(getMatter("acme-msa")).find((x) => x.ruleId === "PB-REN-01")!;
    expect(struck(f.clause, f.redline!)).toEqual(["thirty-six (36)", "ninety (90)"]);
    expect(inserted(f.clause, f.redline!)).toEqual(["twelve (12)", "thirty (30)"]);
  });

  it("reads a rewritten termination clause as a markup of Acme's own sentence", () => {
    const f = reviewContract(getMatter("acme-msa")).find((x) => x.ruleId === "PB-TERM-01")!;
    expect(struck(f.clause, f.redline!)[0]).toBe("Neither party");
    expect(inserted(f.clause, f.redline!)[0]).toBe("Northstar");
    expect(blackline(f.clause, f.redline!).filter((p) => p.kind !== "ins").map((p) => p.text).join(" ")).toBe(f.clause);
  });

  it("strikes the whole sentence when the redline shares too little of it", () => {
    expect(blackline("Acme owns all usage data.", "Northstar keeps its outputs; metrics only, de-identified.")).toEqual([
      { kind: "del", text: "Acme owns all usage data." },
      { kind: "ins", text: "Northstar keeps its outputs; metrics only, de-identified." },
    ]);
  });

  it("Brightwater's termination keeps its refund: only the notice changes", () => {
    const f = reviewContract(getMatter("brightwater-order-form")).find((x) => x.ruleId === "PB-TERM-01")!;
    expect(struck(f.clause, f.redline!)).toEqual(["sixty (60)"]);
    expect(f.redline).toContain("with a refund of prepaid fees for the unused period");
  });
});
