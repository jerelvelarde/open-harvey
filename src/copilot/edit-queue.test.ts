// A redline edit made while the agent is busy is queued, never dropped, and goes out once.

import { describe, expect, it } from "vitest";
import { parseRedlineEdits } from "@/lib/demo-script";
import { changedSpan, describeEdit, editMessage, editSummary, enqueueEdit, isBusy, readEditMessage, type Edit } from "./edit-queue";

const TWELVE = "Cap each party's liability at 12 months of fees paid or payable before the claim.";
const SIX = "Cap each party's liability at 6 months of fees paid or payable before the claim.";
const liab = (before: string, after: string): Edit => ({ matterId: "acme-msa", ruleId: "PB-LIAB-01", cite: "§8.2", before, after });

describe("the edit queue", () => {
  it("describes an edit the way the agent hears it, and the mock reads it back", () => {
    const message = describeEdit(liab(TWELVE, SIX));
    expect(message).toBe(`I changed the §8.2 redline (PB-LIAB-01) from "${TWELVE}" to "${SIX}".`);
    expect(parseRedlineEdits(message)).toEqual([{ cite: "§8.2", ruleId: "PB-LIAB-01", before: TWELVE, after: SIX }]);
  });

  it("coalesces edits to one redline: the text the agent last knew, then the latest", () => {
    let queue = enqueueEdit([], liab(TWELVE, "Cap at 9 months."));
    queue = enqueueEdit(queue, liab("Cap at 9 months.", SIX));
    expect(queue).toHaveLength(1);
    expect(editMessage(queue, "acme-msa")).toBe(describeEdit(liab(TWELVE, SIX)));
  });

  it("keeps one entry per redline, oldest first, in one message the chat reads back", () => {
    let queue = enqueueEdit([], liab(TWELVE, SIX));
    queue = enqueueEdit(queue, { matterId: "acme-msa", ruleId: "PB-PAY-01", cite: "§4.2", before: "Net 45.", after: 'Net 30, "firm".' });
    const message = editMessage(queue, "acme-msa")!;
    expect(readEditMessage(message)).toEqual([
      { cite: "§8.2", ruleId: "PB-LIAB-01", before: TWELVE, after: SIX },
      { cite: "§4.2", ruleId: "PB-PAY-01", before: "Net 45.", after: 'Net 30, "firm".' },
    ]);
  });

  it("says nothing for an edit that ended where it started, or for a matter that is no longer open", () => {
    expect(editMessage(enqueueEdit(enqueueEdit([], liab(TWELVE, SIX)), liab(SIX, TWELVE)), "acme-msa")).toBeNull();
    expect(editMessage([liab(TWELVE, SIX)], null)).toBeNull();
    expect(editMessage([liab(TWELVE, SIX)], "brightwater-order-form")).toBeNull();
  });

  it("is null for anything a person typed", () => {
    expect(readEditMessage("Send it for approval.")).toBeNull();
    expect(readEditMessage(`${describeEdit(liab(TWELVE, SIX))} Also send it.`)).toBeNull();
  });
});

describe("changedSpan: the words that changed, for the event row", () => {
  it("reads 12 → 6 as the story says it", () => {
    expect(changedSpan(TWELVE, SIX)).toEqual({ before: "12 months of fees", after: "6 months of fees" });
  });
  it("handles an insertion at the end", () => {
    expect(changedSpan("Net 45.", "Net 45, or 60 for disputed amounts.")).toEqual({ before: "45", after: "45, or 60 for disputed amounts" });
  });
});

describe("isBusy", () => {
  it("is busy while running, while a card waits, and right after a tool result", () => {
    expect(isBusy({ isRunning: true, messages: [] })).toBe(true);
    expect(isBusy({ isRunning: false, messages: [{ role: "assistant", toolCalls: [{ id: "a" }] }] })).toBe(true);
    expect(isBusy({ isRunning: false, messages: [{ role: "assistant", toolCalls: [{ id: "a" }] }, { role: "tool", toolCallId: "a" }] })).toBe(true);
    expect(isBusy({ isRunning: false, messages: [{ role: "assistant", toolCalls: [{ id: "a" }] }, { role: "tool", toolCallId: "a" }] }, false)).toBe(false);
    expect(isBusy({ isRunning: false, messages: [{ role: "assistant" }] })).toBe(false);
  });
});

describe("an edit in a few words", () => {
  it("sums up Maya's liability edit in the spec's words", () => {
    const drafted = "Each party's total liability arising out of or relating to this Agreement will not exceed the fees paid by Northstar in the twelve (12) months before the event giving rise to the claim.";
    const maya =
      "Each party's total liability arising out of or relating to this Agreement will not exceed the fees paid by Northstar in the six (6) months before the event giving rise to the claim, except that liability for data-protection breaches is capped at $1,000,000.";
    expect(editSummary("PB-LIAB-01", drafted, maya)).toEqual({ before: "12 months of fees", after: "6 months of fees, with a $1,000,000 cap for data-protection breaches" });
  });

  it("falls back to the words that changed for other rules", () => {
    expect(editSummary("PB-PAY-01", "within forty-five (45) days of the invoice date.", "within thirty (30) days of the invoice date.")).toEqual({ before: "forty-five (45) days of the", after: "thirty (30) days of the" });
  });
});
