// The collection review table: every cell's quote is in its passage, word for word; the answers come
// from the terms; and the security column says whether Security has the evidence.

import { beforeEach, describe, expect, it } from "vitest";
import { toolHandlers } from "./agent-tools";
import { COLLECTION_DOCS, COLLECTION_ID, COLUMNS, RECEIVED_AFTER_SEND_BACK, answerCell, collectionContract, securityNote, securityStandings, securityStatus } from "./collection";
import { classifyComment, totalDaysLost } from "./learning";
import { findPassage } from "./contract";
import { appStore, openMatter, resetStoreForTests, startCell, validateSavedState } from "./store";
import { history, loadTestLibrary } from "./testing";

beforeEach(() => {
  resetStoreForTests();
  loadTestLibrary();
});

describe("Vendor contracts 2026", () => {
  it("holds the eight contracts: the two in review, then six signed, newest first", () => {
    expect(COLLECTION_DOCS.map((d) => `${d.vendor}${d.signed ? ` ${d.signed}` : " in review"}`)).toEqual([
      "Acme Cloud in review",
      "Brightwater Metrics in review",
      "Fernway Data 2026-10-02",
      "Kestrel Language Services 2026-08-13",
      "Cobalt Harbor Logging 2026-07-24",
      "Orchard Lane Recruiting 2026-05-21",
      "Lumen Ridge Analytics 2026-04-20",
      "Halden Payroll Services 2026-02-12",
    ]);
  });

  it("quotes every cell word for word from the passage it cites", () => {
    for (const doc of COLLECTION_DOCS) {
      for (const { key } of COLUMNS) {
        const cell = answerCell(doc.id, key);
        const passage = findPassage(collectionContract(doc), cell.cite);
        expect(passage, `${doc.id} ${key} cites ${cell.cite}`).not.toBeNull();
        for (const quote of cell.quotes) expect(passage!.text, `${doc.id} ${key}`).toContain(quote);
      }
    }
  });

  it("answers from the terms, in a few words", () => {
    const row = (id: string) => COLUMNS.map(({ key }) => answerCell(id, key).answer);
    expect(row("acme-msa")).toEqual(["3 months of fees", "36-month renewals · 90 days' notice", "None", "10 days", "None", "No SOC 2 report or pen-test summary"]);
    expect(row("halden-payroll")).toEqual(["12 months of fees", "12-month renewals · 30 days' notice", "Not needed: no customer data", "48 hours", "30 days' notice", "Not needed: no customer data"]);
    expect(row("cobalt-harbor")).toEqual(["12 months of fees", "12-month renewals · 30 days' notice", "Signed", "24 hours", "30 days' notice", "Received after a send-back"]);
  });

  it("says where the security evidence stands: received after a send-back, in review, or not needed", () => {
    const standings = securityStandings(appStore.getState(), history);
    expect(standings.receivedAfterSendBack.map((d) => d.id)).toEqual(["fernway-data", "cobalt-harbor", "lumen-ridge"]);
    expect(standings.inReview.map((d) => d.id)).toEqual(["acme-msa", "brightwater-order-form"]);
    expect(standings.missing).toEqual([]);
    expect(standings.noCustomerData.map((d) => d.id)).toEqual(["kestrel-language", "orchard-lane", "halden-payroll"]);
    expect(securityNote(securityStatus(COLLECTION_DOCS.find((d) => d.id === "lumen-ridge")!, null, history))).toBe("Received Apr 17; the contract doesn't require it");
  });

  it("agrees with the history: every signed data processor Security sent back and Jordan then approved reads Received after a send-back", () => {
    // Read straight from review-history.jsonl, independently of lib/collection.ts.
    const cleared = history.filter(
      (r) =>
        r.signed &&
        r.processesCustomerData &&
        r.rounds.some((round, i) => round.decisions.some((d) => d.decision === "sent_back" && classifyComment(d.comment) === "security_evidence") && r.rounds.slice(i + 1).some((later) => later.decisions.some((d) => d.approver === "jordan" && d.decision === "approved"))),
    );
    expect(cleared.map((r) => r.vendor)).toEqual(["Lumen Ridge Analytics", "Cobalt Harbor Logging", "Fernway Data"]);
    for (const review of cleared) {
      const doc = COLLECTION_DOCS.find((d) => d.matterNumber === review.id);
      expect(doc, review.vendor).toBeDefined();
      expect(answerCell(doc!.id, "securityEvidence").answer, review.vendor).toBe(RECEIVED_AFTER_SEND_BACK);
    }
    // And no other signed vendor claims it.
    const claimed = COLLECTION_DOCS.filter((d) => answerCell(d.id, "securityEvidence").answer === RECEIVED_AFTER_SEND_BACK).map((d) => d.matterNumber);
    expect(claimed.sort()).toEqual(cleared.map((r) => r.id).sort());
  });

  it("counts the days lost with the function Insights uses", () => {
    const received = securityStandings(null, history).receivedAfterSendBack.map((d) => securityStatus(d, null, history));
    expect(totalDaysLost(received.map((s) => (s.kind === "received" ? { daysLost: s.daysLost } : {})))).toBe(22);
  });
});

describe("the tools", () => {
  it("readCollection opens the collection's thread, with no matter open", () => {
    openMatter("acme-msa");
    const result = toolHandlers.readCollection({ collectionId: COLLECTION_ID });
    expect(result.documents).toHaveLength(8);
    expect(result.columns.map((c) => c.column)).toEqual(COLUMNS.map((c) => c.key));
    expect(appStore.getState()).toMatchObject({ activeMatterId: null, activeCollectionId: COLLECTION_ID });
  });

  it("fillCollectionCell answers one cell, records it once, and says where the evidence stands", () => {
    expect(startCell("lumen-ridge", "securityEvidence")).toBe(true);
    expect(appStore.getState().collectionWorking).toBe("lumen-ridge:securityEvidence");
    expect(toolHandlers.fillCollectionCell({ collectionId: COLLECTION_ID, docId: "lumen-ridge", column: "securityEvidence" })).toEqual({
      vendor: "Lumen Ridge Analytics",
      vendorShort: "Lumen Ridge",
      column: "Security evidence",
      answer: "Received after a send-back",
      cite: "§4.3",
      quote: "Lumen Ridge will maintain a written security program",
      status: "signed",
      holdsCustomerData: true,
      security: "received",
      note: "Received Apr 17; the contract doesn't require it",
      receivedAt: "2026-04-17",
      daysLost: 7,
    });
    toolHandlers.fillCollectionCell({ collectionId: COLLECTION_ID, docId: "lumen-ridge", column: "securityEvidence" });
    expect(appStore.getState()).toMatchObject({ collectionCells: ["lumen-ridge:securityEvidence"], collectionWorking: null });
    expect(startCell("lumen-ridge", "securityEvidence")).toBe(false);
  });

  it("a saved demo keeps its filled cells, and one from before Collections still loads", () => {
    toolHandlers.readCollection({ collectionId: COLLECTION_ID });
    toolHandlers.fillCollectionCell({ collectionId: COLLECTION_ID, docId: "fernway-data", column: "dpa" });
    const saved = validateSavedState(JSON.stringify(appStore.getState()));
    expect(saved.ok && saved.state.collectionCells).toEqual(["fernway-data:dpa"]);
    const old = validateSavedState(JSON.stringify({ matters: {}, activeMatterId: null, publishedRules: [], dismissedRuleIds: [] }));
    expect(old.ok && old.state).toMatchObject({ activeCollectionId: null, collectionCells: [] });
  });
});
