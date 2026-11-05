// The rules that live in code, not in the prompt: nothing runs before the plan is approved, tasks run
// in order, the agent never overwrites Maya's redline, nothing is sent without a reason for every
// accepted deviation, approvals go in route order, nothing goes to the vendor before every approval,
// and the General Counsel publishes playbook rules. Plus the saved demo check.

import { beforeEach, describe, expect, it } from "vitest";
import { answerPlan, answerSend } from "./gates";
import {
  agentRedline,
  appStore,
  humanRedline,
  matterCounts,
  matterView,
  openMatter,
  publishRule,
  recordDecision,
  resetStoreForTests,
  runTask,
  setReason,
  startTask,
  validateSavedState,
} from "./store";
import { loadTestLibrary } from "./testing";

const ACME = "acme-msa";
/** Maya's §8.2 redline after her edit in step 3: 6 months of fees, with a $1,000,000 cap for data-protection breaches. */
const SIX =
  "Each party's total liability arising out of or relating to this Agreement will not exceed the fees paid by Northstar in the six (6) months before the event giving rise to the claim, except that liability for data-protection breaches is capped at $1,000,000.";
const view = () => matterView(appStore.getState(), ACME);

function runAll() {
  for (const task of view().plan) {
    const result = runTask(ACME, task.id);
    if (!result.ok) throw new Error(result.error);
  }
}

beforeEach(() => {
  resetStoreForTests();
  loadTestLibrary();
});

describe("the plan gate", () => {
  it("refuses to run a task before the plan is approved", () => {
    openMatter(ACME);
    expect(runTask(ACME, "parties")).toEqual({ ok: false, error: expect.stringMatching(/not approved yet/) });
    expect(startTask(ACME, "parties")).toBe(false);
    expect(view().plan.every((t) => t.status === "proposed")).toBe(true);
  });

  it("Not yet approves nothing", () => {
    openMatter(ACME);
    expect(answerPlan(ACME, "not yet")).toMatchObject({ approved: false, reason: "The user said not yet. Nothing ran." });
    expect(view().planApproved).toBe(false);
  });

  it("runs the tasks in order once approved, and ticks each one", () => {
    openMatter(ACME);
    const answer = answerPlan(ACME, "approve");
    expect(answer.approved && answer.tasks).toHaveLength(17);
    expect(runTask(ACME, "liability")).toEqual({ ok: false, error: expect.stringMatching(/Run the tasks in order: parties/) });
    expect(startTask(ACME, "parties")).toBe(true);
    expect(view().plan[0].status).toBe("working");
    expect(runTask(ACME, "parties")).toMatchObject({ ok: true, number: 1, of: 17, next: "renewal" });
    runAll();
    // The review has run: 16 of 17, with task 17 held until every approver has approved.
    expect(view().doneCount).toBe(16);
    expect(view().plan.at(-1)).toMatchObject({ id: "packet", title: "Send the redline package to Acme (only after every approval)", status: "held" });
    expect(view().complete).toBe(true);
    expect(view().status).toBe("ready");
  });

  it("the run ends at the route: nothing asks for task 17 before the approvals", () => {
    openMatter(ACME);
    answerPlan(ACME, "approve");
    for (const task of view().plan.slice(0, 15)) runTask(ACME, task.id);
    expect(runTask(ACME, "route")).toMatchObject({ ok: true, number: 16, next: null });
    expect(startTask(ACME, "packet")).toBe(false);
    expect(runTask(ACME, "packet")).toMatchObject({ ok: true, held: true, next: null });
    expect(view().plan.at(-1)?.status).toBe("held");
  });
});

describe("redlines: two writers", () => {
  beforeEach(() => {
    openMatter(ACME);
    answerPlan(ACME, "approve");
    runAll();
  });

  it("drafts a redline for each of the seven deviations", () => {
    expect(Object.keys(view().redlines).sort()).toEqual(["PB-DATA-01", "PB-DATA-02", "PB-IP-01", "PB-LIAB-01", "PB-PAY-01", "PB-REN-01", "PB-TERM-01"]);
    expect(Object.values(view().redlinesBy).every((by) => by === "agent")).toBe(true);
  });

  it("a person's edit is kept: the agent cannot overwrite it unless the user asked", () => {
    const edit = humanRedline(ACME, "PB-LIAB-01", SIX);
    expect(edit).toMatchObject({ cite: "§8.2", after: SIX, before: expect.stringContaining("twelve (12) months") });
    expect(agentRedline(ACME, "PB-LIAB-01", "Cap at 12 months of fees.")).toMatchObject({ ok: false, refused: true, userValue: SIX });
    expect(view().redlines["PB-LIAB-01"]).toBe(SIX);
    expect(agentRedline(ACME, "PB-LIAB-01", "Cap at 12 months of fees.", true)).toMatchObject({ ok: true });
  });

  it("an accepted deviation needs a reason before anything is sent", () => {
    humanRedline(ACME, "PB-LIAB-01", SIX);
    expect(view().status).toBe("needs_reason");
    expect(view().missingReasons.map((f) => f.ruleId)).toEqual(["PB-LIAB-01"]);
    expect(answerSend(ACME, "send")).toMatchObject({ sent: false, reason: expect.stringMatching(/§8.2 \(PB-LIAB-01\)/) });
    setReason(ACME, "PB-LIAB-01", "Acme won't go above 6 months. The $1M data-breach cap covers the exposure we care about.");
    expect(view().status).toBe("ready");
  });

  it("Keep editing sends nothing; Send for approval sends 7 redlines to the route", () => {
    expect(answerSend(ACME, "keep editing")).toEqual({ sent: false, reason: "The user wants to keep editing." });
    expect(view().state?.submission).toBeNull();
    expect(answerSend(ACME, "send")).toEqual({
      sent: true,
      matterId: ACME,
      redlines: 7,
      to: ["Rachel Adler (General Counsel)", "Jordan Blake (Head of Security)", "Elena Ortiz (Chief Financial Officer)"],
    });
    expect(view().status).toBe("pending");
  });
});

describe("one count function for every screen", () => {
  it("Acme Cloud: 12 checks, 5 pass, 7 deviations (3 high), 7 to the vendor, 2 context rows with no rule", () => {
    openMatter(ACME);
    expect(matterCounts(view())).toEqual({ checks: 12, checked: 0, pass: 0, deviations: 0, high: 0, learned: 0, toVendor: 0, context: 0 });
    answerPlan(ACME, "approve");
    runAll();
    expect(matterCounts(view())).toEqual({ checks: 12, checked: 12, pass: 5, deviations: 7, high: 3, learned: 0, toVendor: 7, context: 2 });
  });

  it("Brightwater with PB-SEC-01: 13 checks, 10 pass, 2 deviations, 1 learned, 3 to the vendor", () => {
    const BW = "brightwater-order-form";
    publishRule({ id: "PB-SEC-01", title: "Security evidence for data processors", markdown: "# PB-SEC-01" });
    openMatter(BW);
    answerPlan(BW, "approve");
    for (const task of matterView(appStore.getState(), BW).plan) runTask(BW, task.id);
    expect(matterCounts(matterView(appStore.getState(), BW))).toEqual({ checks: 13, checked: 13, pass: 10, deviations: 2, high: 0, learned: 1, toVendor: 3, context: 2 });
  });
});

describe("approvals", () => {
  it("go in route order; a send-back stops the route", () => {
    openMatter(ACME);
    answerPlan(ACME, "approve");
    runAll();
    answerSend(ACME, "send");
    recordDecision(ACME, "approved", "");
    expect(view().state?.submission).toMatchObject({ status: "pending", decisions: [{ approverId: "rachel", decision: "approved" }] });
    recordDecision(ACME, "sent_back", "Ask Acme for their SOC 2 Type II report.");
    expect(view().state?.submission).toMatchObject({ status: "sent_back" });
    recordDecision(ACME, "approved", "");
    expect(view().state?.submission?.decisions).toHaveLength(2);
    expect(view().plan.at(-1)?.status).toBe("held");
  });

  it("task 17 ticks only when every approver has approved", () => {
    openMatter(ACME);
    answerPlan(ACME, "approve");
    runAll();
    answerSend(ACME, "send");
    recordDecision(ACME, "approved", "");
    recordDecision(ACME, "approved", "");
    expect(view().plan.at(-1)?.status).toBe("held");
    recordDecision(ACME, "approved", "");
    expect(view().state?.submission?.status).toBe("approved");
    expect(view().plan.at(-1)?.status).toBe("done");
    expect(view().doneCount).toBe(17);
  });
});

describe("the playbook belongs to the General Counsel", () => {
  it("a published rule records Rachel Adler as its publisher", () => {
    publishRule({ id: "PB-SEC-01", title: "Security evidence for data processors", markdown: "# PB-SEC-01" });
    expect(appStore.getState().publishedRules).toEqual([expect.objectContaining({ id: "PB-SEC-01", version: 1, publishedBy: "rachel" })]);
  });
});

describe("the saved demo", () => {
  it("loads a save that matches, and puts a task left working back in the queue", () => {
    openMatter(ACME);
    answerPlan(ACME, "approve");
    startTask(ACME, "parties");
    publishRule({ id: "PB-SEC-01", title: "Security evidence for data processors", markdown: "# PB-SEC-01" });
    const result = validateSavedState(JSON.stringify(appStore.getState()));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.state.matters[ACME].tasks.parties).toBe("queued");
  });

  it("discards a save from another shape or with an unknown matter", () => {
    expect(validateSavedState("{")).toEqual({ ok: false, reason: "it is not valid JSON" });
    openMatter(ACME);
    const saved = JSON.parse(JSON.stringify(appStore.getState()));
    saved.activeMatterId = "globex-msa";
    expect(validateSavedState(JSON.stringify(saved))).toMatchObject({ ok: false, reason: expect.stringMatching(/activeMatterId/) });
  });
});
