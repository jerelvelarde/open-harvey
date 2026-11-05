// The contracts as data: sections, passage ids, and every quoted term found word for word in the
// passage it cites (so a citation always highlights real text).

import { describe, expect, it } from "vitest";
import { findPassage, sectionRange } from "./contract";
import { MATTERS, getMatter } from "./matters";
import { CHECK_RULE_IDS, ROUTING_RULE_IDS } from "./playbook";
import { contracts, playbook } from "./testing";

describe("the Acme Cloud MSA", () => {
  const acme = contracts["acme-msa"];

  it("has 14 numbered sections and about 1,800 words", () => {
    expect(acme.title).toBe("Master Services Agreement");
    expect(acme.sections.map((s) => s.number)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]);
    expect(acme.words).toBeGreaterThan(1700);
    expect(acme.words).toBeLessThan(1900);
  });

  it("gives every passage a stable id", () => {
    expect(findPassage(acme, "§8.2")?.caption).toBe("Cap");
    expect(findPassage(acme, "§8.2")?.text).toContain("three (3) months");
    expect(findPassage(acme, "§6.4")?.caption).toBe("Security incidents");
    expect(findPassage(acme, "§99.1")).toBeNull();
    expect(sectionRange(acme, 8)).toBe("§8.1–8.3");
    // The cap is lifted only for indemnities and gross negligence, fraud or willful misconduct: a data breach stays capped,
    // which is what makes Maya's $1,000,000 data-breach cap a gain rather than a give-away.
    expect(findPassage(acme, "§8.3")?.text).toContain("claims arising from a Security Incident remain subject to the cap in Section 8.2");
    expect(findPassage(acme, "§8.3")?.text).not.toMatch(/do not apply to[^.]*Section 10/);
    const ids = acme.sections.flatMap((s) => s.passages.map((p) => p.id));
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("the deal terms", () => {
  for (const matter of MATTERS) {
    it(`${matter.id}: every term's quote is in its cited passage, word for word`, () => {
      const contract = contracts[matter.id];
      for (const [name, term] of Object.entries(matter.terms)) {
        const passage = findPassage(contract, term.cite);
        expect(passage, `${name} cites ${term.cite}, which does not exist`).not.toBeNull();
        expect(passage!.text, `${name}: "${term.quote}" is not in ${term.cite}`).toContain(term.quote);
        if (term.clause) {
          expect(passage!.text, `${name}: its clause is not in ${term.cite}`).toContain(term.clause);
          expect(term.clause, `${name}: its clause does not hold its quote`).toContain(term.quote);
        }
      }
    });
  }

  it("pins the Acme deal: $240,000 a year for 36 months, net 15, up to 9% at renewal, 36-month renewals on 90 days' notice", () => {
    const { terms } = getMatter("acme-msa");
    expect(terms.annualFee.value).toBe(240_000);
    expect(terms.initialTermMonths.value).toBe(36);
    expect(terms.paymentDays.value).toBe(15);
    expect(terms.priceIncreasePct.value).toBe(9);
    expect(terms.renewalTermMonths.value).toBe(36);
    expect(terms.renewalNoticeDays.value).toBe(90);
  });
});

describe("the playbook", () => {
  it("writes every rule the checks and the routing use, with plain text", () => {
    for (const id of [...CHECK_RULE_IDS, ...ROUTING_RULE_IDS]) {
      expect(playbook[id], id).toBeDefined();
      expect(playbook[id].text.length).toBeGreaterThan(20);
    }
    expect(playbook["PB-LIAB-01"].title).toBe("Limitation of liability");
  });

  it("has no rule for security evidence yet: that is the unwritten rule", () => {
    expect(Object.keys(playbook).some((id) => id.startsWith("PB-SEC"))).toBe(false);
  });
});
