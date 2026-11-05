// The plan: the 17 tasks in order, what each one reads and finds, and the learned task a published
// rule adds to the next plan.

import { describe, expect, it } from "vitest";
import { getMatter } from "./matters";
import { buildPlan, heldLine, learnedLabel, reviewState, taskOutcome } from "./plan";

const acme = getMatter("acme-msa");
const brightwater = getMatter("brightwater-order-form");
const SEC = { id: "PB-SEC-01", version: 1, title: "Security evidence for data processors" };

describe("the 17-task plan", () => {
  const plan = buildPlan(acme);

  it("has the 17 tasks in the spec's order, each tied to its rule", () => {
    expect(plan.map((t) => [t.title, t.ruleIds.join("/")])).toEqual([
      ["Identify the parties, products and order of precedence", ""],
      ["Term, renewal and notice", "PB-REN-01"],
      ["Fees, payment terms and price increases", "PB-PAY-01"],
      ["Limitation of liability", "PB-LIAB-01"],
      ["Indemnities", "PB-IND-01"],
      ["Data protection and DPA", "PB-DATA-01"],
      ["Security incident notice", "PB-DATA-02"],
      ["Security standards and audits", ""],
      ["IP, usage data and customer outputs", "PB-IP-01"],
      ["Confidentiality", "PB-CONF-01"],
      ["Termination rights", "PB-TERM-01"],
      ["Assignment and change of control", "PB-ASSIGN-01"],
      ["Insurance", "PB-INS-01"],
      ["Governing law and disputes", "PB-LAW-01"],
      ["Draft a redline for every deviation", ""],
      ["Route for approval", "PB-APR-01/PB-APR-02/PB-APR-03"],
      ["Send the redline package to Acme (only after every approval)", ""],
    ]);
  });

  it("says what each task read, found and cites, from the same functions as the review table", () => {
    const review = reviewState(acme, []);
    const outcome = (id: string) => taskOutcome(plan.find((t) => t.id === id)!, acme, review);
    expect(outcome("liability")).toMatchObject({
      status: "attention",
      reads: ["§8.2"],
      cite: "§8.2",
      line: "Cap = fees paid in the 3 months before the claim; the playbook wants 12 months of fees.",
    });
    // Neutral: no rule asks for audit evidence, so the task notes what it read and moves on.
    expect(outcome("security").line).toBe("Security program described in §5.1. The playbook has no rule on audit evidence.");
    expect(outcome("indemnities").line).toBe("Vendor defends IP claims, outside the cap.");
    expect(outcome("indemnities")).toMatchObject({ status: "done", cite: "§9.1" });
    expect(outcome("fees").reads).toEqual(["§4.1", "§4.2", "§4.3"]);
    expect(outcome("parties").line).toContain("Acme Cloud, Inc. and Northstar Software, Inc.");
    expect(outcome("redlines").line).toBe("7 redlines drafted, one per deviation. Edit any of them in the review table.");
    expect(outcome("route").line).toBe("Rachel Adler → Jordan Blake → Elena Ortiz · $720,000 is over the $500,000 line.");
    expect(heldLine(acme, review)).toBe("Held until all 3 approvers approve. Then the redline package goes to Acme Cloud.");
    expect(outcome("packet").line).toBe("All 3 approved: the redline package (7 redlines and a cover note) is released to send to Acme Cloud.");
    const attention = plan.filter((t) => taskOutcome(t, acme, review).status === "attention").map((t) => t.id);
    expect(attention).toEqual(["renewal", "fees", "liability", "data-protection", "incident-notice", "usage-data", "termination"]);
  });
});

describe("a published rule adds a task to the next plan", () => {
  it("adds the learned task after security standards for a vendor that processes customer data", () => {
    const plan = buildPlan(brightwater, [SEC]);
    expect(plan).toHaveLength(18);
    const learned = plan[8];
    expect(learned).toMatchObject({ id: "learned-PB-SEC-01", kind: "learned", title: "Request the SOC 2 Type II report and pen-test summary", ruleIds: ["PB-SEC-01"] });
    expect(`${learned.title} ${learnedLabel(learned.learned!)}`).toBe("Request the SOC 2 Type II report and pen-test summary (PB-SEC-01 v1, learned)");
    expect(plan[7].id).toBe("security");
    expect(taskOutcome(learned, brightwater, reviewState(brightwater, [SEC]))).toMatchObject({ status: "done", cite: "§4.3" });
  });

  it("leaves the plan at 17 tasks before the rule is published", () => {
    expect(buildPlan(brightwater)).toHaveLength(17);
  });

  it("does not add it for a vendor that holds no customer data", () => {
    const noData = { terms: { ...brightwater.terms, processesCustomerPersonalData: { ...brightwater.terms.processesCustomerPersonalData, value: false } } };
    expect(buildPlan(noData, [SEC])).toHaveLength(17);
  });
});
