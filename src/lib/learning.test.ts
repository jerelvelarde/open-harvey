// Learning from send-backs: the three Security send-backs in the history, the days each cost, the
// proposed rule PB-SEC-01 and its evidence, and today's send-back joining them.

import { describe, expect, it } from "vitest";
import { classifyComment, groupSendBacks, insightSignal, proposeRules, sendBacksFrom, type SendBack } from "./learning";
import { history } from "./testing";

describe("the review history", () => {
  it("has six past reviews", () => {
    expect(history.map((r) => r.vendor)).toEqual([
      "Halden Payroll Services",
      "Lumen Ridge Analytics",
      "Orchard Lane Recruiting",
      "Cobalt Harbor Logging",
      "Kestrel Language Services",
      "Fernway Data",
    ]);
  });

  it("has three Security send-backs for the missing SOC 2 / pen-test ask, each dated and resubmitted about a week later", () => {
    const security = sendBacksFrom(history).filter((s) => classifyComment(s.comment) === "security_evidence");
    expect(security.map((s) => [s.vendor, s.approver, s.at, s.resubmitted, s.daysLost])).toEqual([
      ["Lumen Ridge Analytics", "jordan", "2026-04-09", "2026-04-16", 7],
      ["Cobalt Harbor Logging", "jordan", "2026-07-14", "2026-07-22", 8],
      ["Fernway Data", "jordan", "2026-09-22", "2026-09-29", 7],
    ]);
  });

  it("files the unrelated send-back under a reason a rule already covers", () => {
    const groups = groupSendBacks(sendBacksFrom(history));
    expect(groups.map((g) => [g.key, g.sendBacks.length])).toEqual([
      ["security_evidence", 3],
      ["indemnity", 1],
    ]);
    expect(groups[1].coveredBy).toMatch(/PB-IND-01/);
  });
});

describe("the proposed rule", () => {
  const today: SendBack = {
    matterId: "MAT-2026-047",
    vendor: "Acme Cloud",
    agreement: "Master Services Agreement",
    approver: "jordan",
    at: "2026-11-05T10:00",
    comment: "Ask Acme for their SOC 2 Type II report and latest pen-test summary before we sign. We need this whenever a vendor holds customer data.",
    resubmitted: null,
    daysLost: null,
    source: "session",
  };

  it("proposes PB-SEC-01 from the three before today, with the evidence in the approvers' words", () => {
    const [rule] = proposeRules(groupSendBacks(sendBacksFrom(history)));
    expect(rule.id).toBe("PB-SEC-01");
    expect(rule.title).toBe("Security evidence for data processors");
    expect(rule.evidence.map((s) => s.vendor)).toEqual(["Lumen Ridge Analytics", "Cobalt Harbor Logging", "Fernway Data"]);
    expect(rule.markdown).toContain("request the vendor's SOC 2 Type II report and its latest penetration-test summary before signing");
    expect(rule.markdown).toContain("lost 22 days between them");
  });

  it("adds today's send-back as the fourth piece of evidence", () => {
    const [rule] = proposeRules(groupSendBacks([...sendBacksFrom(history), today]));
    expect(rule.evidence).toHaveLength(4);
    expect(rule.evidence.at(-1)).toMatchObject({ vendor: "Acme Cloud", source: "session", daysLost: null });
    expect(rule.markdown).toContain("Jordan Blake sent back 4 vendor reviews for this evidence, 3 of them before go-live.");
  });

  it("says what it found in one line: the first new send-back since go-live, matching the imported history", () => {
    const [before] = proposeRules(groupSendBacks(sendBacksFrom(history)));
    expect(insightSignal(before.evidence)).toBeNull();
    const [rule] = proposeRules(groupSendBacks([...sendBacksFrom(history), today]));
    expect(insightSignal(rule.evidence)).toBe("First new send-back since go-live · matches 3 in the imported history");
  });

  it("proposes nothing for fewer than three send-backs", () => {
    const two = sendBacksFrom(history).filter((s) => s.vendor !== "Fernway Data");
    expect(proposeRules(groupSendBacks(two))).toEqual([]);
  });
});
