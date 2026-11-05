// The checks, one per playbook rule: exactly the seven deviations the story needs, the passes with
// their citations, $720,000, the route, and the re-check of a redline a person edited.

import { describe, expect, it } from "vitest";
import { getMatter } from "./matters";
import { findPassage } from "./contract";
import { CHECKS, NOTES, acceptedDeviations, amountOf, byRisk, deviations, findingTone, recheckRedline, redlineSummary, reviewContract, routeApprovals, totalContractValue } from "./review";
import { contracts } from "./testing";

const acme = getMatter("acme-msa");
const brightwater = getMatter("brightwater-order-form");
const SEC = { id: "PB-SEC-01", version: 1, title: "Security evidence for data processors" };
/** Maya's §8.2 redline after her edit in step 3. */
const MAYA =
  "Each party's total liability arising out of or relating to this Agreement will not exceed the fees paid by Northstar in the six (6) months before the event giving rise to the claim, except that liability for data-protection breaches is capped at $1,000,000.";

describe("the Acme Cloud review", () => {
  const findings = reviewContract(acme);

  it("finds exactly the seven deviations, each cited, with its risk", () => {
    expect(deviations(findings).sort(byRisk).map((f) => [f.cite, f.ruleId, f.risk])).toEqual([
      ["§6.1", "PB-DATA-01", "high"],
      ["§6.4", "PB-DATA-02", "high"],
      ["§8.2", "PB-LIAB-01", "high"],
      ["§3.3", "PB-REN-01", "medium"],
      ["§7.3", "PB-IP-01", "medium"],
      ["§11.2", "PB-TERM-01", "medium"],
      ["§4.2", "PB-PAY-01", "low"],
    ]);
  });

  it("says what Acme wrote and drafts each redline as clause text for Acme's own sentence", () => {
    const by = (rule: string) => findings.find((f) => f.ruleId === rule)!;
    expect(by("PB-LIAB-01").vendorWrote).toBe("Cap = fees paid in the 3 months before the claim");
    // The struck words are Acme's sentence, never a summary; the redline is that sentence with Northstar's number.
    expect(by("PB-LIAB-01").clause).toBe("Each party's total liability arising out of or relating to this Agreement will not exceed the fees paid by Northstar in the three (3) months before the event giving rise to the claim.");
    expect(by("PB-LIAB-01").redline).toBe("Each party's total liability arising out of or relating to this Agreement will not exceed the fees paid by Northstar in the twelve (12) months before the event giving rise to the claim.");
    expect(by("PB-REN-01").redline).toBe("Each Order Form renews automatically for successive twelve (12) month terms unless either party gives written notice of non-renewal at least thirty (30) days before the end of the then-current term.");
    expect(by("PB-PAY-01").redline).toBe("Northstar will pay each undisputed invoice within forty-five (45) days of the invoice date.");
    expect(by("PB-DATA-02").vendorWrote).toBe("Notice within 10 days");
    expect(by("PB-DATA-02").redline).toMatch(/^If Acme discovers any unauthorized access to Customer Data .* within seventy-two \(72\) hours/);
    expect(by("PB-PAY-01").vendorWrote).toBe("Net 15");
    expect(by("PB-IP-01").redline).toContain("aggregated, de-identified metrics");
    expect(by("PB-DATA-01").redline).toMatch(/^Acme will process Customer Data only to provide and support the Services, and only under Northstar's data processing addendum/);
    expect(by("PB-TERM-01").redline).toBe(
      "Northstar may terminate this Agreement or any Order Form for convenience on thirty (30) days' written notice, and Acme will refund, pro rata, any prepaid fees for the period after termination.",
    );
    const text = contracts["acme-msa"];
    for (const f of deviations(findings)) {
      expect(f.redline, f.ruleId!).toBeTruthy();
      expect(findPassage(text, f.cite)!.text, `${f.ruleId} strikes words that are not in ${f.cite}`).toContain(f.clause);
      expect(f.clause, f.ruleId!).toContain(f.quote);
    }
  });

  it("names each clause by one topic, the plan's", () => {
    expect(findings.map((f) => f.topic)).toEqual([
      "Term, renewal and notice",
      "Fees, payment terms and price increases",
      "Limitation of liability",
      "Indemnities",
      "Data protection and DPA",
      "Security incident notice",
      "IP, usage data and customer outputs",
      "Confidentiality",
      "Termination rights",
      "Assignment and change of control",
      "Insurance",
      "Governing law and disputes",
    ]);
  });

  it("passes everything else, and says so with a citation", () => {
    expect(findings.filter((f) => f.status === "pass").map((f) => [f.ruleId, f.cite])).toEqual([
      ["PB-IND-01", "§9.1"],
      ["PB-CONF-01", "§10.2"],
      ["PB-ASSIGN-01", "§12.1"],
      ["PB-INS-01", "§13.1"],
      ["PB-LAW-01", "§14.1"],
    ]);
    expect(NOTES.parties(acme.terms)).toMatchObject({ status: "pass", cite: "§1.1" });
    expect(NOTES.security(acme.terms)).toMatchObject({ status: "info", cite: "§5.1", vendorWrote: "Security program described in §5.1", position: "The playbook has no rule on audit evidence" });
  });

  it("totals $720,000: $240,000 a year for 36 months", () => {
    expect(totalContractValue(acme.terms)).toBe(720_000);
  });

  it("routes to Rachel, then Jordan, then Elena, each for a rule", () => {
    const route = routeApprovals(findings, totalContractValue(acme.terms));
    expect(route.map((s) => [s.name, s.ruleId])).toEqual([
      ["Rachel Adler", "PB-APR-01"],
      ["Jordan Blake", "PB-APR-02"],
      ["Elena Ortiz", "PB-APR-03"],
    ]);
    // Jordan covers usage data too (PB-IP-01, §7.3); Elena approves the spend.
    expect(route.map((s) => s.reason)).toEqual(["Northstar's position on 7 deviations", "Data and security: §6.1, §6.4, §7.3", "The spend: $720,000 is over the $500,000 line"]);
  });
});

describe("tone by risk: red has one job", () => {
  it("only high-risk deviations are red; medium amber; low quiet", () => {
    const findings = reviewContract(acme);
    const tone = (rule: string) => findingTone(findings.find((f) => f.ruleId === rule)!);
    expect(["PB-LIAB-01", "PB-DATA-01", "PB-DATA-02"].map(tone)).toEqual(["red", "red", "red"]);
    expect(["PB-REN-01", "PB-IP-01", "PB-TERM-01"].map(tone)).toEqual(["amber", "amber", "amber"]);
    expect(tone("PB-PAY-01")).toBe("muted");
    expect(tone("PB-IND-01")).toBe("green");
  });
});

describe("the checks on their own", () => {
  it("each one flips when its term meets the rule", () => {
    const fixed = {
      ...acme.terms,
      liabilityCapMonths: { ...acme.terms.liabilityCapMonths, value: 12 },
      paymentDays: { ...acme.terms.paymentDays, value: 45 },
      breachNoticeHours: { ...acme.terms.breachNoticeHours, value: 72 },
      terminationForConvenienceDays: { ...acme.terms.terminationForConvenienceDays, value: 30 },
    };
    expect(CHECKS["PB-LIAB-01"](fixed, "Acme").status).toBe("pass");
    expect(CHECKS["PB-PAY-01"](fixed, "Acme").status).toBe("pass");
    expect(CHECKS["PB-DATA-02"](fixed, "Acme").status).toBe("pass");
    expect(CHECKS["PB-TERM-01"](fixed, "Acme").status).toBe("pass");
    expect(CHECKS["PB-DATA-01"]({ ...acme.terms, processesCustomerPersonalData: { ...acme.terms.processesCustomerPersonalData, value: false } }, "Acme").status).toBe("pass");
    expect(CHECKS["PB-LAW-01"]({ ...acme.terms, governingLaw: { ...acme.terms.governingLaw, value: "New York" } }, "Acme").status).toBe("deviation");
  });
});

describe("Brightwater Metrics, before and after PB-SEC-01", () => {
  it("has two deviations, and goes to Rachel only while no security rule applies", () => {
    const findings = reviewContract(brightwater);
    expect(deviations(findings).map((f) => f.ruleId)).toEqual(["PB-PAY-01", "PB-TERM-01"]);
    // Brightwater's own termination sentence keeps its pro-rata refund, with 30 days in it.
    expect(findings.find((f) => f.ruleId === "PB-TERM-01")!.redline).toBe(
      "Northstar may end the subscription for convenience on thirty (30) days' written notice, with a refund of prepaid fees for the unused period.",
    );
    expect(findings.find((f) => f.ruleId === "PB-PAY-01")!.redline).toBe("Invoices are payable within forty-five (45) days of the invoice date.");
    expect(totalContractValue(brightwater.terms)).toBe(168_000);
    expect(routeApprovals(findings, 168_000).map((s) => s.name)).toEqual(["Rachel Adler"]);
  });

  it("with PB-SEC-01 published, adds the learned request and routes it to the Head of Security", () => {
    const findings = reviewContract(brightwater, [SEC]);
    const request = findings.find((f) => f.ruleId === "PB-SEC-01")!;
    expect(request).toMatchObject({ status: "request", cite: "§4.3", learned: { id: "PB-SEC-01", version: 1 } });
    expect(request.redline).toContain("SOC 2 Type II report");
    expect(routeApprovals(findings, 168_000).map((s) => [s.name, s.ruleId])).toEqual([
      ["Rachel Adler", "PB-APR-01"],
      ["Jordan Blake", "PB-APR-02"],
    ]);
  });
});

describe("re-checking an edited redline", () => {
  it("reads amounts in digits and in words", () => {
    expect(amountOf("Cap at 6 months of fees", "month")).toBe(6);
    expect(amountOf("the three (3) months before", "month")).toBe(3);
    expect(amountOf("successive 12-month terms ... at least 30 days before", "month")).toBe(12);
    expect(amountOf("within seventy-two hours", "hour")).toBe(72);
    expect(amountOf("no number here", "day")).toBeNull();
  });

  it("Maya's 6 months with a $1,000,000 data-breach cap still deviates from PB-LIAB-01; 12 meets it", () => {
    expect(recheckRedline("PB-LIAB-01", MAYA)).toEqual({
      meets: false,
      detail: "Cap at 6 months of fees, with a $1,000,000 cap for data-protection breaches; PB-LIAB-01 asks for at least 12 months",
    });
    expect(recheckRedline("PB-LIAB-01", reviewContract(acme).find((f) => f.ruleId === "PB-LIAB-01")!.redline!).meets).toBe(true);
  });

  it("sums a liability redline up in a few words", () => {
    expect(redlineSummary("PB-LIAB-01", MAYA)).toBe("6 months of fees, with a $1,000,000 cap for data-protection breaches");
    expect(redlineSummary("PB-LIAB-01", "the fees paid in the twelve (12) months before the claim")).toBe("12 months of fees");
    expect(redlineSummary("PB-PAY-01", "within 45 days")).toBeNull();
  });

  it("every drafted redline meets its own rule", () => {
    for (const f of deviations(reviewContract(acme))) expect(recheckRedline(f.ruleId!, f.redline!).meets, f.ruleId!).toBe(true);
  });

  it("an edited redline that no longer meets the rule is an accepted deviation", () => {
    const findings = reviewContract(acme);
    const drafted = Object.fromEntries(deviations(findings).map((f) => [f.ruleId!, f.redline!]));
    expect(acceptedDeviations(findings, drafted)).toEqual([]);
    const edited = { ...drafted, "PB-LIAB-01": MAYA };
    expect(acceptedDeviations(findings, edited).map((f) => f.ruleId)).toEqual(["PB-LIAB-01"]);
  });

  it("checks the other rules' words too", () => {
    expect(recheckRedline("PB-DATA-02", "within 10 days").meets).toBe(false);
    expect(recheckRedline("PB-DATA-02", "within 48 hours").meets).toBe(true);
    expect(recheckRedline("PB-PAY-01", "within 30 days of the invoice date").meets).toBe(false);
    expect(recheckRedline("PB-TERM-01", "Neither party may terminate for convenience").meets).toBe(false);
    expect(recheckRedline("PB-REN-01", "renews for 12-month terms unless notice at least 60 days before").meets).toBe(false);
  });
});
