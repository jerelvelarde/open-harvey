// The decisions that go to the Trajectory: one developer event per gated decision, built from the
// decision log so the names and wording match the Analytics page, plus Maya's redline edit.

import { beforeEach, describe, expect, it } from "vitest";
import { decisionLog } from "./analytics";
import { answerPlan, answerSend } from "./gates";
import { groupSendBacks, proposeRules, sendBacksFrom } from "./learning";
import { appStore, humanRedline, matterView, openMatter, publishRule, recordDecision, resetStoreForTests, runTask, sessionSendBacks, setReason } from "./store";
import { history, loadTestLibrary } from "./testing";
import { newDecisions, trajectoryDecisions } from "./trajectory-events";

const ACME = "acme-msa";
const SIX =
  "Each party's total liability arising out of or relating to this Agreement will not exceed the fees paid by Northstar in the six (6) months before the event giving rise to the claim, except that liability for data-protection breaches is capped at $1,000,000.";
const REASON = "Acme won't go above 6 months. The $1M data-breach cap covers the exposure we care about.";
const JORDAN = "Ask Acme for their SOC 2 Type II report and latest pen-test summary before we sign. We need this whenever a vendor holds customer data.";

beforeEach(() => {
  resetStoreForTests();
  loadTestLibrary();
});

function playDemo() {
  openMatter(ACME);
  answerPlan(ACME, "approve");
  for (const task of matterView(appStore.getState(), ACME).plan) runTask(ACME, task.id);
  humanRedline(ACME, "PB-LIAB-01", SIX);
  setReason(ACME, "PB-LIAB-01", REASON);
  answerSend(ACME, "send");
  recordDecision(ACME, "approved", "");
  recordDecision(ACME, "sent_back", JORDAN);
  const [rule] = proposeRules(groupSendBacks([...sendBacksFrom(history), ...sessionSendBacks(appStore.getState())]));
  publishRule(rule);
}

describe("trajectory decisions", () => {
  it("are none before anything is decided", () => {
    expect(trajectoryDecisions(appStore.getState())).toEqual([]);
  });

  it("name every gated decision, in the decision log's order and words, then Maya's edit", () => {
    playDemo();
    const events = trajectoryDecisions(appStore.getState());
    expect(events.map((e) => e.name)).toEqual(["review.plan_approved", "review.sent_for_approval", "review.approved", "review.sent_back", "playbook.rule_published", "redline.edited"]);
    // Same people and wording as the Analytics decision log.
    const log = decisionLog(appStore.getState());
    expect(events.slice(0, 5).map((e) => `${e.value.who}: ${e.value.action}`)).toEqual(log.map((e) => `${e.who}: ${e.action}`));
    const [, sent, rachel, jordan, rule, edit] = events;
    expect(sent.value).toMatchObject({ who: "Maya Chen", to: ["Rachel Adler", "Jordan Blake", "Elena Ortiz"], reasons: { "PB-LIAB-01": REASON }, matterId: ACME, matter: "Acme Cloud · Master Services Agreement" });
    expect(rachel.value).toMatchObject({ who: "Rachel Adler", role: "General Counsel", comment: "" });
    expect(jordan.value).toMatchObject({ who: "Jordan Blake", action: "sent it back", comment: JORDAN });
    expect(rule.value).toMatchObject({ who: "Rachel Adler", ruleId: "PB-SEC-01", version: 1, action: 'published PB-SEC-01 v1, "Security evidence for data processors"' });
    expect(edit.value).toMatchObject({ who: "Maya Chen", ruleId: "PB-LIAB-01", cite: "§8.2", after: SIX });
    expect(String(edit.value.before)).toContain("twelve (12) months");
  });

  it("go out once each: only what is new since the last look", () => {
    openMatter(ACME);
    answerPlan(ACME, "approve");
    const sent = new Set(trajectoryDecisions(appStore.getState()).map((d) => d.key));
    expect(newDecisions(appStore.getState(), sent)).toEqual([]);
    for (const task of matterView(appStore.getState(), ACME).plan) runTask(ACME, task.id);
    setReason(ACME, "PB-LIAB-01", REASON);
    answerSend(ACME, "send");
    expect(newDecisions(appStore.getState(), sent).map((d) => d.name)).toEqual(["review.sent_for_approval"]);
  });
});
