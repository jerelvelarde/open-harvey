// The document in the store: a redlined sentence is its redline, the copilot's changes are tracked in
// its name and never overwrite what Maya wrote, accept makes a change hers, reject puts the vendor's
// words back, and comments stay on the words they are about.

import { beforeEach, describe, expect, it } from "vitest";
import { findPassage } from "./contract";
import {
  acceptChange,
  addComment,
  agentSuggestEdit,
  appStore,
  approvePlan,
  documentView,
  humanEditSpan,
  insertClause,
  matterView,
  openMatter,
  rejectChange,
  reopenComment,
  replyToComment,
  resetStoreForTests,
  resolveComment,
  runTask,
  validateSavedState,
} from "./store";
import { contracts, loadTestLibrary } from "./testing";

const ACME = "acme-msa";
const REMEDY = "which are Northstar's only remedy for the missed target";
const OTHER_REMEDIES = "which do not limit Northstar's other rights and remedies";

function runReview(id: string) {
  openMatter(id);
  approvePlan(id);
  for (const task of matterView(appStore.getState(), id).plan) runTask(id, task.id);
}

const doc = () => documentView(appStore.getState(), ACME);
const change = (id: string) => doc().changes.find((c) => c.id === id);

beforeEach(() => {
  resetStoreForTests();
  loadTestLibrary();
});

describe("redlined sentences", () => {
  it("shows the copilot's redlines as its tracked changes once the review has run", () => {
    openMatter(ACME);
    expect(doc().changes).toEqual([]);
    runReview(ACME);
    expect(doc().changes.filter((c) => c.kind === "replace")).toHaveLength(7);
    expect(change("rule:PB-LIAB-01")).toMatchObject({ cite: "§8.2", by: "agent", ruleId: "PB-LIAB-01" });
  });

  it("writes Maya's edit to a redlined sentence into the redline the Review table shows, and hands the copilot the edit", () => {
    runReview(ACME);
    const before = matterView(appStore.getState(), ACME).redlines["PB-LIAB-01"];
    const after = before.replace("twelve (12)", "six (6)");
    const edit = humanEditSpan(ACME, "rule:PB-LIAB-01", after);
    expect(edit).toEqual({ matterId: ACME, ruleId: "PB-LIAB-01", cite: "§8.2", before, after });
    expect(matterView(appStore.getState(), ACME).redlines["PB-LIAB-01"]).toBe(after);
    expect(matterView(appStore.getState(), ACME).redlinesBy["PB-LIAB-01"]).toBe("human");
  });

  it("puts the vendor's words back when Maya rejects a redline, which then needs a reason for the General Counsel", () => {
    runReview(ACME);
    const edit = rejectChange(ACME, "rule:PB-LIAB-01");
    const view = matterView(appStore.getState(), ACME);
    expect(edit?.after).toBe(view.review.findings.find((f) => f.ruleId === "PB-LIAB-01")!.clause);
    expect(change("rule:PB-LIAB-01")).toBeUndefined();
    expect(view.missingReasons.map((f) => f.ruleId)).toContain("PB-LIAB-01");
  });

  it("makes a copilot change Maya's when she accepts it, so the copilot leaves it alone after that", () => {
    runReview(ACME);
    acceptChange(ACME, "rule:PB-LIAB-01");
    expect(change("rule:PB-LIAB-01")?.by).toBe("human");
    const result = agentSuggestEdit(ACME, "§8.2", "twelve (12) months", "eighteen (18) months");
    expect(result).toMatchObject({ ok: false, refused: true });
  });
});

describe("the copilot's suggested edits", () => {
  it("tracks an edit to free text in the copilot's name", () => {
    openMatter(ACME);
    const result = agentSuggestEdit(ACME, "§2.3", REMEDY, OTHER_REMEDIES);
    expect(result).toMatchObject({ ok: true, changeId: "§2.3:0", cite: "§2.3" });
    expect(change("§2.3:0")).toMatchObject({ kind: "edit", by: "agent", before: findPassage(contracts[ACME], "§2.3")!.text });
    expect(change("§2.3:0")!.after).toContain(OTHER_REMEDIES);
  });

  it("refuses to change text Maya wrote, unless she asked", () => {
    openMatter(ACME);
    humanEditSpan(ACME, "§2.3:0", findPassage(contracts[ACME], "§2.3")!.text.replace(REMEDY, "which are one remedy among others"));
    expect(agentSuggestEdit(ACME, "§2.3", "one remedy among others", "Northstar's only remedy")).toMatchObject({ ok: false, refused: true });
    expect(agentSuggestEdit(ACME, "§2.3", "one remedy among others", "not Northstar's only remedy", true)).toMatchObject({ ok: true });
    expect(change("§2.3:0")?.by).toBe("human");
  });

  it("says what the passage reads when the words aren't there", () => {
    openMatter(ACME);
    const result = agentSuggestEdit(ACME, "§2.3", "a sentence nobody wrote", "anything");
    expect(result).toMatchObject({ ok: false });
    expect("error" in result && result.error).toContain("It reads:");
  });

  it("refuses before the matter is open", () => {
    expect(agentSuggestEdit(ACME, "§2.3", REMEDY, OTHER_REMEDIES)).toMatchObject({ ok: false, error: expect.stringContaining("not open") });
  });
});

describe("added clauses", () => {
  it("adds a clause at the end of its section as a tracked insertion, and rejecting it takes it out", () => {
    openMatter(ACME);
    const result = insertClause(ACME, 5, "Security reports.", "Before signing, Acme will give Northstar its SOC 2 Type II report.");
    expect(result).toEqual({ ok: true, changeId: "insert:§5.4", cite: "§5.4", caption: "Security reports" });
    expect(doc().sections.find((s) => s.number === 5)!.passages.map((p) => p.cite)).toEqual(["§5.1", "§5.2", "§5.3", "§5.4"]);
    expect(change("insert:§5.4")).toMatchObject({ kind: "insert", by: "agent" });
    expect(insertClause(ACME, 5, "Another", "Text.")).toMatchObject({ cite: "§5.5" });
    rejectChange(ACME, "insert:§5.4");
    expect(change("insert:§5.4")).toBeUndefined();
  });

  it("refuses a section that doesn't exist", () => {
    openMatter(ACME);
    expect(insertClause(ACME, 40, "x", "y")).toMatchObject({ ok: false, error: expect.stringContaining("no section 40") });
  });
});

describe("comments", () => {
  it("anchors a comment on the words it quotes, and the copilot must quote words that are there", () => {
    runReview(ACME);
    expect(addComment(ACME, "§8.2", "three (3) months", "Too low.", "agent")).toMatchObject({ ok: true, commentId: "C1", anchored: true });
    expect(doc().comments[0].on).toBe("original"); // struck by the redline: found in the vendor's words
    expect(addComment(ACME, "§8.2", "words that aren't there", "x", "agent")).toMatchObject({ ok: false });
    expect(addComment(ACME, "§8.2", "words that aren't there", "On the whole clause.", "human")).toMatchObject({ ok: true, anchored: false });
  });

  it("lets the copilot resolve its own comments, and Maya's only when she asked", () => {
    openMatter(ACME);
    addComment(ACME, "§2.3", "99.9%", "Ask for 99.95%.", "human");
    addComment(ACME, "§2.3", "five days", "Fine as is.", "agent");
    expect(resolveComment(ACME, "C1", "agent")).toMatchObject({ ok: false, refused: true });
    expect(resolveComment(ACME, "C2", "agent")).toEqual({ ok: true, commentId: "C2" });
    expect(resolveComment(ACME, "C1", "agent", true)).toEqual({ ok: true, commentId: "C1" });
    reopenComment(ACME, "C1");
    expect(replyToComment(ACME, "C1", "Acme offers 99.9% to everyone.", "agent")).toEqual({ ok: true, commentId: "C1", replies: 1 });
    expect(doc().comments[0]).toMatchObject({ resolved: false, replies: [{ by: "agent", text: "Acme offers 99.9% to everyone." }] });
  });
});

describe("saved demos", () => {
  it("loads a demo saved before the document existed, with an empty document", () => {
    openMatter(ACME);
    const saved = JSON.parse(JSON.stringify(appStore.getState()));
    delete saved.matters[ACME].doc;
    const result = validateSavedState(JSON.stringify(saved));
    expect(result.ok && result.state.matters[ACME].doc).toEqual({ edits: {}, inserts: [], comments: [] });
  });
});

describe("a person's selection", () => {
  it("quotes whole words when a selection starts or ends mid-word", () => {
    openMatter(ACME);
    expect(addComment(ACME, "§2.3", "e will make the Services av", "Ask for 99.95%.", "human")).toMatchObject({ ok: true, quote: "Acme will make the Services available", anchored: true });
  });
});
