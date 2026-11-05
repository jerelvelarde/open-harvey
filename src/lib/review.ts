// Concept: code does the analysis; the model chooses when to call it and explains the result.
//
// One check per playbook rule (src/data/playbook.md). Each reads the deal terms (lib/matters.ts),
// decides pass or deviation, sets the risk, cites the passage and quotes the vendor's words, and
// drafts the redline: replacement clause text for the vendor's own sentence, usually that sentence
// with Northstar's number in it ("twelve (12) months" for "three (3) months"). The same module re-checks
// a redline a person edited, works out the total contract value and the approval route. Nothing
// here calls a model, so every finding, number and route is the same on every run: tested in
// review.test.ts.

import { CFO_THRESHOLD, getPerson } from "./company";
import type { PassageId } from "./contract";
import type { Cited, DealTerms } from "./matters";
import { TOPICS, isDataOrSecurityRule, type CheckRuleId, type RoutingRuleId } from "./playbook";

export type Risk = "high" | "medium" | "low";
/** pass: meets the rule. deviation: does not. request: a learned rule asks for something before signing. info: checked, no rule. */
export type FindingStatus = "pass" | "deviation" | "request" | "info";

export type Finding = {
  /** The playbook rule, or null for a check with no rule (the parties, security standards). */
  ruleId: string | null;
  topic: string;
  status: FindingStatus;
  risk: Risk | null;
  cite: PassageId;
  /** The vendor's own words, exactly as they appear in the cited passage. */
  quote: string;
  /** The vendor's sentence the redline replaces, word for word (the quote when the term has no clause). */
  clause: string;
  /** What the vendor wrote, in a few words. */
  vendorWrote: string;
  /** Northstar's position, from the playbook. */
  position: string;
  /** The proposed redline for a deviation, or the request a learned rule sends. */
  redline: string | null;
  /** Set when the row comes from a rule a person published in Insights. */
  learned?: { id: string; version: number };
};

const usd = (n: number) => `$${n.toLocaleString("en-US")}`;

function finding(term: Cited<unknown>, fields: Omit<Finding, "cite" | "quote" | "clause" | "redline" | "risk" | "topic"> & { topic?: string; risk?: Risk | null; redline?: string | null }): Finding {
  const topic = fields.topic ?? (fields.ruleId ? TOPICS[fields.ruleId as keyof typeof TOPICS] : undefined) ?? fields.ruleId ?? "";
  return { risk: null, redline: null, ...fields, topic, cite: term.cite, quote: term.quote, clause: term.clause ?? term.quote };
}

// ---------------------------------------------------------------------------------------------
// Numbers as a contract writes them: "twelve (12)"

const NUMBER_WORDS: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12,
  fifteen: 15, eighteen: 18, twenty: 20, "twenty-four": 24, thirty: 30, "thirty-six": 36, "forty-five": 45,
  "forty-eight": 48, sixty: 60, "seventy-two": 72, ninety: 90,
};
const WORD_OF = Object.fromEntries(Object.entries(NUMBER_WORDS).map(([word, n]) => [n, word])) as Record<number, string>;
const NUMBER_PATTERN = Object.keys(NUMBER_WORDS).sort((a, b) => b.length - a.length).join("|");

/** 12 → "twelve (12)", the way the contracts write amounts. */
export const spelled = (n: number) => (WORD_OF[n] ? `${WORD_OF[n]} (${n})` : String(n));

/** The vendor's sentence with Northstar's amount in place of its own: the first "<n> <unit>" becomes `to`. */
function swapAmount(text: string, unit: "month" | "day" | "year", to: number): string {
  const pattern = new RegExp(`\\b(?:\\d+|${NUMBER_PATTERN})(?:\\s*\\(\\d+\\))?(?=[\\s-]+${unit}s?\\b)`, "i");
  return text.replace(pattern, spelled(to));
}

// ---------------------------------------------------------------------------------------------
// The checks, one per rule

export const CHECKS: Record<CheckRuleId, (t: DealTerms, vendor: string) => Finding> = {
  "PB-REN-01": (t) => {
    const months = t.renewalTermMonths.value;
    const notice = t.renewalNoticeDays.value;
    const ok = months <= 12 && notice <= 30;
    const clause = t.renewalTermMonths.clause ?? t.renewalTermMonths.quote;
    return finding(t.renewalTermMonths, {
      ruleId: "PB-REN-01",
      status: ok ? "pass" : "deviation",
      risk: ok ? null : "medium",
      vendorWrote: `Renews for ${months} months unless cancelled ${notice} days before the end`,
      position: "Renews for 12 months at most; cancel on 30 days' notice",
      redline: ok ? null : swapAmount(swapAmount(clause, "month", Math.min(months, 12)), "day", Math.min(notice, 30)),
    });
  },

  "PB-PAY-01": (t) => {
    const days = t.paymentDays.value;
    const ok = days >= 45;
    return finding(t.paymentDays, {
      ruleId: "PB-PAY-01",
      status: ok ? "pass" : "deviation",
      risk: ok ? null : "low",
      vendorWrote: `Net ${days}`,
      position: "Net 45 or longer",
      redline: ok ? null : swapAmount(t.paymentDays.clause ?? t.paymentDays.quote, "day", 45),
    });
  },

  "PB-LIAB-01": (t) => {
    const months = t.liabilityCapMonths.value;
    const ok = months >= 12;
    return finding(t.liabilityCapMonths, {
      ruleId: "PB-LIAB-01",
      status: ok ? "pass" : "deviation",
      risk: ok ? null : "high",
      vendorWrote: `Cap = fees paid in the ${months} months before the claim`,
      position: "Cap at fees paid or payable in the 12 months before the claim",
      redline: ok ? null : swapAmount(t.liabilityCapMonths.clause ?? t.liabilityCapMonths.quote, "month", 12),
    });
  },

  "PB-IND-01": (t, vendor) => {
    const { byVendor, outsideCap } = t.ipIndemnity.value;
    const ok = byVendor && outsideCap;
    return finding(t.ipIndemnity, {
      ruleId: "PB-IND-01",
      status: ok ? "pass" : "deviation",
      risk: ok ? null : "high",
      vendorWrote: byVendor ? `Vendor defends IP claims${outsideCap ? ", outside the cap" : ", inside the cap"}` : "No IP indemnity from the vendor",
      position: "Vendor defends IP claims, outside the cap",
      redline: ok ? null : `${vendor} will defend Northstar against third-party intellectual property claims, and this obligation is not subject to the liability cap.`,
    });
  },

  "PB-DATA-01": (t, vendor) => {
    const processes = t.processesCustomerPersonalData.value;
    const dpa = t.dataProcessingAddendum.value;
    const ok = !processes || dpa;
    return finding(t.dataProcessingAddendum, {
      ruleId: "PB-DATA-01",
      status: ok ? "pass" : "deviation",
      risk: ok ? null : "high",
      vendorWrote: !processes ? "No customer personal data" : dpa ? "Processes customer personal data under a signed DPA" : "Processes customer personal data; no data processing addendum",
      position: "Signed DPA before any customer personal data is processed",
      redline: ok
        ? null
        : `${vendor} will process Customer Data only to provide and support the Services, and only under Northstar's data processing addendum, signed by both parties before any processing begins.`,
    });
  },

  "PB-DATA-02": (t, vendor) => {
    const hours = t.breachNoticeHours.value;
    const ok = hours <= 72;
    return finding(t.breachNoticeHours, {
      ruleId: "PB-DATA-02",
      status: ok ? "pass" : "deviation",
      risk: ok ? null : "high",
      vendorWrote: `Notice within ${hours % 24 === 0 && hours > 72 ? `${hours / 24} days` : `${hours} hours`}`,
      position: "Notice within 72 hours",
      // The clock starts at discovery, not at the vendor's confirmation.
      redline: ok
        ? null
        : `If ${vendor} discovers any unauthorized access to Customer Data (a "Security Incident"), ${vendor} will notify Northstar within seventy-two (72) hours and will share what it knows about the cause, the data affected and the steps it is taking.`,
    });
  },

  "PB-IP-01": (t, vendor) => {
    const { owner, vendorUse } = t.usageData.value;
    const ok = owner === "customer" && vendorUse === "aggregated de-identified";
    return finding(t.usageData, {
      ruleId: "PB-IP-01",
      status: ok ? "pass" : "deviation",
      risk: ok ? null : "medium",
      vendorWrote: ok ? "Northstar owns its data and outputs; vendor uses aggregated, de-identified metrics" : `Vendor owns "usage data and derived insights", for ${vendorUse}`,
      position: "Northstar owns its data and outputs; vendor may use aggregated, de-identified metrics only",
      redline: ok
        ? null
        : `Northstar owns Customer Data and all outputs of the Services. ${vendor} may use only aggregated, de-identified metrics about the operation of the Services, and only to run and improve them.`,
    });
  },

  "PB-CONF-01": (t) => {
    const years = t.confidentialityYearsAfter.value;
    const ok = years >= 3;
    return finding(t.confidentialityYearsAfter, {
      ruleId: "PB-CONF-01",
      status: ok ? "pass" : "deviation",
      risk: ok ? null : "medium",
      vendorWrote: `Mutual; ${years} years after the term`,
      position: "Mutual; at least 3 years after the term",
      redline: ok ? null : swapAmount(t.confidentialityYearsAfter.clause ?? t.confidentialityYearsAfter.quote, "year", 3),
    });
  },

  "PB-TERM-01": (t, vendor) => {
    const days = t.terminationForConvenienceDays.value;
    const ok = days !== null && days <= 30;
    const clause = t.terminationForConvenienceDays.clause ?? t.terminationForConvenienceDays.quote;
    return finding(t.terminationForConvenienceDays, {
      ruleId: "PB-TERM-01",
      status: ok ? "pass" : "deviation",
      risk: ok ? null : "medium",
      vendorWrote: days === null ? "No termination for convenience" : `For convenience on ${days} days' notice`,
      position: "Northstar may terminate for convenience on 30 days' notice",
      // A vendor that offers it on longer notice keeps its own sentence, refund and all, with 30 days in it.
      redline: ok
        ? null
        : days === null
          ? `Northstar may terminate this Agreement or any Order Form for convenience on thirty (30) days' written notice, and ${vendor} will refund, pro rata, any prepaid fees for the period after termination.`
          : swapAmount(clause, "day", 30),
    });
  },

  "PB-ASSIGN-01": (t) => {
    const { consentRequired, successorAllowed } = t.assignment.value;
    const ok = consentRequired && successorAllowed;
    return finding(t.assignment, {
      ruleId: "PB-ASSIGN-01",
      status: ok ? "pass" : "deviation",
      risk: ok ? null : "low",
      vendorWrote: ok ? "Consent needed, except a successor in a merger or sale" : "Vendor may assign freely",
      position: "Consent needed, except a successor in a merger or sale",
      redline: ok ? null : "Neither party may assign this Agreement without consent, except to a successor in a merger or sale of its business.",
    });
  },

  "PB-INS-01": (t, vendor) => {
    const { cyberLiability, generalLiability } = t.insurance.value;
    const ok = cyberLiability >= 5_000_000 && generalLiability >= 2_000_000;
    return finding(t.insurance, {
      ruleId: "PB-INS-01",
      status: ok ? "pass" : "deviation",
      risk: ok ? null : "medium",
      vendorWrote: `Cyber ${usd(cyberLiability)} · general ${usd(generalLiability)}`,
      position: "Cyber at least $5,000,000 · general at least $2,000,000",
      redline: ok ? null : `${vendor} will carry cyber liability insurance of at least $5,000,000 per claim and general liability insurance of at least $2,000,000 per occurrence.`,
    });
  },

  "PB-LAW-01": (t) => {
    const law = t.governingLaw.value;
    const ok = law === "California" || law === "Delaware";
    return finding(t.governingLaw, {
      ruleId: "PB-LAW-01",
      status: ok ? "pass" : "deviation",
      risk: ok ? null : "low",
      vendorWrote: `${law} law and courts`,
      position: "California or Delaware law and courts",
      redline: ok ? null : "This Agreement is governed by the laws of the State of California, and disputes go to the courts in San Francisco County.",
    });
  },
};

/** The two checks with no playbook rule: who and what (plan task 1), and the security standards (task 8). */
export const NOTES = {
  parties: (t: DealTerms): Finding =>
    finding(t.parties, {
      ruleId: null,
      topic: TOPICS.parties,
      status: t.orderOfPrecedence.value === "agreement_controls" ? "pass" : "deviation",
      vendorWrote: `${t.parties.value.join(" and ")}; the signed agreement controls`,
      position: "Northstar's signed paper controls; no vendor online terms",
    }),
  /** Neutral on purpose: the playbook has no rule here, so the copilot notes what it read and moves on. */
  security: (t: DealTerms): Finding =>
    finding(t.securityProgram, {
      ruleId: null,
      topic: TOPICS.security,
      status: "info",
      vendorWrote: `Security program described in ${t.securityProgram.cite}`,
      position: "The playbook has no rule on audit evidence",
    }),
};

// ---------------------------------------------------------------------------------------------
// Rules a person published in Insights (lib/learning.ts proposes them)

export type LearnedRule = { id: string; version: number; title: string };

/**
 * What each learned rule checks. In the starter a published rule switches on a check prepared here, so
 * it holds as surely as the written rules; in production, Automatic Learning proposes the rule and a
 * person approves it before the agent loads it.
 */
export const LEARNED_CHECKS: Record<string, (t: DealTerms, rule: LearnedRule) => Finding | null> = {
  "PB-SEC-01": (t, rule) =>
    t.processesCustomerPersonalData.value
      ? finding(t.securityProgram, {
          ruleId: "PB-SEC-01",
          status: "request",
          risk: "medium",
          vendorWrote: "No SOC 2 Type II report or pen-test summary in the file",
          position: "SOC 2 Type II report and latest pen-test summary before signing",
          redline: "Before we sign, please send your SOC 2 Type II report and your latest penetration-test summary.",
          learned: { id: rule.id, version: rule.version },
        })
      : null,
};

// ---------------------------------------------------------------------------------------------
// The whole review

/** Every rule check, in playbook order, then any learned rule that applies. */
export function reviewContract(matter: { terms: DealTerms; vendorTerm: string }, learned: readonly LearnedRule[] = []): Finding[] {
  const { terms, vendorTerm } = matter;
  const checks = Object.values(CHECKS).map((check) => check(terms, vendorTerm));
  const fromLearned = learned.flatMap((rule) => LEARNED_CHECKS[rule.id]?.(terms, rule) ?? []);
  return [...checks, ...fromLearned];
}

export const deviations = (findings: readonly Finding[]) => findings.filter((f) => f.status === "deviation");

/**
 * How loud a finding is on screen, by risk (DESIGN.md "Red has one job"): only a high-risk
 * deviation is red; medium is amber; low and passes are quiet. Plan tags, strip marks, seal petals
 * and the contract's contents all use this one mapping.
 */
export type Tone = "red" | "amber" | "muted" | "green";
export function findingTone(f: Pick<Finding, "status" | "risk">): Tone {
  if (f.status === "pass") return "green";
  if (f.status === "request") return "amber";
  if (f.status === "deviation") return f.risk === "high" ? "red" : f.risk === "medium" ? "amber" : "muted";
  return "muted";
}

const RISK_ORDER: Record<Risk, number> = { high: 0, medium: 1, low: 2 };
/** Deviations, highest risk first, then by section. */
export const byRisk = (a: Finding, b: Finding) =>
  RISK_ORDER[a.risk ?? "low"] - RISK_ORDER[b.risk ?? "low"] || Number(a.cite.slice(1).split(".")[0]) - Number(b.cite.slice(1).split(".")[0]);

/** Total contract value: the annual fee times the initial term (PB-APR-03). Renewals and price increases are not counted. */
export function totalContractValue(terms: DealTerms): number {
  return Math.round((terms.annualFee.value * terms.initialTermMonths.value) / 12);
}

// ---------------------------------------------------------------------------------------------
// The approval route (PB-APR-01/02/03), worked out from the findings, never from memory

export type RouteStep = { personId: string; name: string; title: string; ruleId: RoutingRuleId; reason: string };

export function routeApprovals(findings: readonly Finding[], totalValue: number): RouteStep[] {
  const route: RouteStep[] = [];
  const step = (personId: string, ruleId: RoutingRuleId, reason: string) => {
    const person = getPerson(personId);
    route.push({ personId, name: person.name, title: person.title, ruleId, reason });
  };
  const open = findings.filter((f) => f.status === "deviation" || f.status === "request");
  const devs = deviations(findings);
  if (devs.length > 0) step("rachel", "PB-APR-01", `Northstar's position on ${devs.length} ${devs.length === 1 ? "deviation" : "deviations"}`);
  const security = open.filter((f) => f.ruleId && isDataOrSecurityRule(f.ruleId));
  if (security.length > 0) step("jordan", "PB-APR-02", `Data and security: ${security.map((f) => f.cite).join(", ")}`);
  if (totalValue > CFO_THRESHOLD) step("elena", "PB-APR-03", `The spend: ${usd(totalValue)} is over the ${usd(CFO_THRESHOLD)} line`);
  return route;
}

// ---------------------------------------------------------------------------------------------
// Re-checking a redline someone edited: does it still meet the rule?

/** The first amount of a unit in a sentence: "6 months", "six (6) months", "a 12-month term". */
export function amountOf(text: string, unit: "month" | "day" | "hour" | "year"): number | null {
  const pattern = new RegExp(`\\b(\\d+|${NUMBER_PATTERN})(?:\\s*\\((\\d+)\\))?[\\s-]+(?:calendar\\s+|business\\s+)?${unit}s?\\b`, "i");
  const match = pattern.exec(text);
  if (!match) return null;
  if (match[2]) return Number(match[2]);
  return /^\d+$/.test(match[1]) ? Number(match[1]) : NUMBER_WORDS[match[1].toLowerCase()];
}

export type Recheck = { meets: boolean; detail: string };

/**
 * A redline in a few words, for the rules where the clause is long and one figure matters: the
 * liability cap reads "6 months of fees, with a $1,000,000 cap for data-protection breaches".
 * The edit row, the re-check card and the approvals read it. Null when the rule has no summary.
 */
export function redlineSummary(ruleId: string, text: string): string | null {
  if (ruleId !== "PB-LIAB-01") return null;
  const months = amountOf(text, "month");
  if (months === null) return null;
  const cap = /\$\s?\d[\d,]*(?:\.\d+)?(?:\s?(?:million|M)\b)?/.exec(text)?.[0];
  const forData = /data[- ]protection|data breach|security incident/i.test(text);
  return `${months} months of fees${cap ? `, with a ${cap} cap${forData ? " for data-protection breaches" : ""}` : ""}`;
}

/** For each rule: does this redline text meet it? Used when a person edits a redline in the review table. */
export const RECHECKS: Record<string, (text: string) => Recheck> = {
  "PB-LIAB-01": (text) => {
    const summary = redlineSummary("PB-LIAB-01", text);
    if (summary === null) return { meets: false, detail: "No cap period found; PB-LIAB-01 asks for 12 months of fees" };
    return (amountOf(text, "month") ?? 0) >= 12
      ? { meets: true, detail: `Cap at ${summary} meets PB-LIAB-01` }
      : { meets: false, detail: `Cap at ${summary}; PB-LIAB-01 asks for at least 12 months` };
  },
  "PB-REN-01": (text) => {
    if (/does not renew|no automatic renewal/i.test(text)) return { meets: true, detail: "No automatic renewal meets PB-REN-01" };
    const months = amountOf(text, "month");
    const days = amountOf(text, "day");
    const ok = months !== null && months <= 12 && days !== null && days <= 30;
    return { meets: ok, detail: ok ? `Renews for ${months} months on ${days} days' notice: meets PB-REN-01` : `PB-REN-01 asks for 12-month renewals at most and 30 days' notice at most` };
  },
  "PB-PAY-01": (text) => {
    const days = amountOf(text, "day");
    return days !== null && days >= 45 ? { meets: true, detail: `Net ${days} meets PB-PAY-01` } : { meets: false, detail: `${days === null ? "No payment period found" : `Net ${days}`}; PB-PAY-01 asks for net 45 or longer` };
  },
  "PB-DATA-01": (text) => {
    const ok = /data processing addendum|\bDPA\b/i.test(text) && /\b(before|prior to)\b/i.test(text);
    return { meets: ok, detail: ok ? "A DPA signed before processing meets PB-DATA-01" : "PB-DATA-01 asks for a DPA signed before any processing" };
  },
  "PB-DATA-02": (text) => {
    const hours = amountOf(text, "hour") ?? ((d) => (d === null ? null : d * 24))(amountOf(text, "day"));
    if (hours === null) return { meets: false, detail: "No notice period found; PB-DATA-02 asks for 72 hours" };
    return hours <= 72 ? { meets: true, detail: `Notice within ${hours} hours meets PB-DATA-02` } : { meets: false, detail: `Notice within ${hours} hours; PB-DATA-02 asks for 72 at most` };
  },
  "PB-IP-01": (text) => {
    const ok = /northstar owns/i.test(text) && /aggregated/i.test(text) && /de-?identified/i.test(text);
    return { meets: ok, detail: ok ? "Northstar owns its data; aggregated, de-identified metrics only: meets PB-IP-01" : "PB-IP-01 asks that Northstar owns its data and outputs, with aggregated, de-identified metrics only" };
  },
  "PB-TERM-01": (text) => {
    const days = amountOf(text, "day");
    const ok = /convenience/i.test(text) && !/\b(neither|no)\b[^.]*\bconvenience\b/i.test(text) && days !== null && days <= 30;
    return { meets: ok, detail: ok ? `For convenience on ${days} days' notice meets PB-TERM-01` : "PB-TERM-01 asks for termination for convenience on 30 days' notice at most" };
  },
  "PB-CONF-01": (text) => {
    const years = amountOf(text, "year");
    return years !== null && years >= 3 ? { meets: true, detail: `${years} years meets PB-CONF-01` } : { meets: false, detail: "PB-CONF-01 asks for at least 3 years" };
  },
};

/** A redline meets its rule (or is a learned request, which needs no reason). Rules without a re-check pass through. */
export function recheckRedline(ruleId: string, text: string): Recheck {
  const check = RECHECKS[ruleId];
  return check ? check(text) : { meets: true, detail: `${ruleId} has no automatic re-check` };
}

/**
 * The deviations Northstar would accept as the redlines stand: a redline that no longer restores the
 * playbook position (a person negotiated it down). Each one needs a reason for the General Counsel
 * (PB-APR-01) before the review can be sent.
 */
export function acceptedDeviations(findings: readonly Finding[], redlines: Readonly<Record<string, string>>): Finding[] {
  return deviations(findings).filter((f) => f.ruleId && !recheckRedline(f.ruleId, redlines[f.ruleId] ?? f.redline ?? "").meets);
}
