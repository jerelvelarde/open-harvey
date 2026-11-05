// Analytics: the imported history before go-live, this session since, the send-back reasons, the
// decision log and the next steps, each from the data and nothing else.

import { beforeEach, describe, expect, it } from "vitest";
import { analytics, beforeGoLive, decisionLog, median, nextSteps, rateFigure, sendBackReasons, sinceGoLive } from "./analytics";
import { answerPlan, answerSend } from "./gates";
import { proposeRules, groupSendBacks, sendBacksFrom } from "./learning";
import { appStore, humanRedline, openMatter, publishRule, recordDecision, resetStoreForTests, runTask, matterView, sessionSendBacks, setReason } from "./store";
import { history, loadTestLibrary } from "./testing";

const ACME = "acme-msa";
const SIX =
  "Each party's total liability arising out of or relating to this Agreement will not exceed the fees paid by Northstar in the six (6) months before the event giving rise to the claim, except that liability for data-protection breaches is capped at $1,000,000.";
const JORDAN = "Ask Acme for their SOC 2 Type II report and latest pen-test summary before we sign. We need this whenever a vendor holds customer data.";

beforeEach(() => {
  resetStoreForTests();
  loadTestLibrary();
});

/** The demo through step 6: review, edit, reason, send, Rachel approves, Jordan sends back, Rachel publishes. */
function playDemo() {
  openMatter(ACME);
  answerPlan(ACME, "approve");
  for (const task of matterView(appStore.getState(), ACME).plan) runTask(ACME, task.id);
  humanRedline(ACME, "PB-LIAB-01", SIX);
  setReason(ACME, "PB-LIAB-01", "Acme won't go above 6 months. The $1M data-breach cap covers the exposure we care about.");
  answerSend(ACME, "send");
  recordDecision(ACME, "approved", "");
  recordDecision(ACME, "sent_back", JORDAN);
  const [rule] = proposeRules(groupSendBacks([...sendBacksFrom(history), ...sessionSendBacks(appStore.getState())]));
  publishRule(rule);
}

describe("before go-live: the six imported reviews", () => {
  it("counts reviews, first-pass approvals, the median cycle and the days lost", () => {
    expect(beforeGoLive(history)).toEqual({ reviews: 6, firstPass: 2, sentBack: 4, medianCycleDays: 10.5, daysLost: 29 });
  });

  it("takes a median of an even or odd list, and of nothing", () => {
    expect(median([3, 13, 3, 11, 10, 11])).toBe(10.5);
    expect(median([5, 1, 3])).toBe(3);
    expect(median([])).toBeNull();
  });
});

describe("since go-live: this session", () => {
  it("is all zeros before anything happens, and suggests the first review", () => {
    expect(sinceGoLive(appStore.getState())).toEqual({ reviews: 0, tasksRun: 0, redlinesDrafted: 0, humanEdits: 0, approvalsRequested: 0, decisions: 0, firstPass: 0, sentBack: 0, rulesPublished: 0 });
    expect(decisionLog(appStore.getState())).toEqual([]);
    expect(nextSteps(appStore.getState(), history)).toEqual(["Review Acme Cloud: its pricing holds until Nov 13."]);
  });

  it("moves with the demo", () => {
    playDemo();
    expect(sinceGoLive(appStore.getState())).toEqual({ reviews: 1, tasksRun: 16, redlinesDrafted: 7, humanEdits: 1, approvalsRequested: 1, decisions: 2, firstPass: 0, sentBack: 1, rulesPublished: 1 });
  });
});

describe("the learning signal", () => {
  it("groups send-backs by reason: security evidence 3 before go-live, then 1 today", () => {
    expect(sendBackReasons(history, appStore.getState())).toEqual([
      { key: "security_evidence", label: "Missing security evidence (SOC 2 Type II, pen-test summary)", before: 3, since: 0 },
      { key: "indemnity", label: "Indemnity scope", before: 1, since: 0 },
    ]);
    playDemo();
    expect(sendBackReasons(history, appStore.getState())[0]).toMatchObject({ key: "security_evidence", before: 3, since: 1 });
  });
});

describe("the decision log", () => {
  it("records every gated action, who took it, in order", () => {
    playDemo();
    expect(decisionLog(appStore.getState()).map((e) => `${e.who}: ${e.action}`)).toEqual([
      "Maya Chen: approved the review plan",
      "Maya Chen: sent it for approval to Rachel Adler, Jordan Blake, Elena Ortiz",
      "Rachel Adler: approved",
      "Jordan Blake: sent it back",
      'Rachel Adler: published PB-SEC-01 v1, "Security evidence for data processors"',
    ]);
  });
});

describe("next steps", () => {
  it("asks for the resubmission with the evidence request once the rule is published", () => {
    playDemo();
    expect(nextSteps(appStore.getState(), history)).toEqual(["Resubmit Acme Cloud to Jordan Blake with the SOC 2 Type II report and pen-test summary request (PB-SEC-01)."]);
    expect(analytics(appStore.getState(), history).log).toHaveLength(5);
  });
});

describe("rates", () => {
  it("are a percentage of five or more, a count below that, a dash of none", () => {
    expect(rateFigure(2, 6)).toBe("33%");
    expect(rateFigure(0, 1)).toBe("0 of 1");
    expect(rateFigure(0, 0)).toBe("—");
  });
});
