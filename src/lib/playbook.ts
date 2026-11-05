// The written playbook, rule by rule, so the app can show the exact rule behind every finding.
// playbook.md writes each rule as one paragraph: **PB-LIAB-01 Limitation of liability.** The vendor's...
// The server reads the file (lib/server-data.ts) and hands the parsed rules to the client once.

export type PlaybookRule = { id: string; title: string; text: string };

const RULE = /^\*\*(PB-[A-Z]+-\d{2}) ([^*]+?)\.\*\*\s+(.+)$/;

/** Every rule in the playbook, by id, in the order written. */
export function parsePlaybook(markdown: string): Record<string, PlaybookRule> {
  const rules: Record<string, PlaybookRule> = {};
  for (const line of markdown.split("\n")) {
    const match = RULE.exec(line.trim());
    if (match) rules[match[1]] = { id: match[1], title: match[2], text: match[3].trim() };
  }
  return rules;
}

/** The rules a contract is checked against (the routing rules PB-APR-* decide who approves). */
export const CHECK_RULE_IDS = [
  "PB-REN-01",
  "PB-PAY-01",
  "PB-LIAB-01",
  "PB-IND-01",
  "PB-DATA-01",
  "PB-DATA-02",
  "PB-IP-01",
  "PB-CONF-01",
  "PB-TERM-01",
  "PB-ASSIGN-01",
  "PB-INS-01",
  "PB-LAW-01",
] as const;
export type CheckRuleId = (typeof CHECK_RULE_IDS)[number];

export const ROUTING_RULE_IDS = ["PB-APR-01", "PB-APR-02", "PB-APR-03"] as const;
export type RoutingRuleId = (typeof ROUTING_RULE_IDS)[number];

/**
 * Rules about data protection, security or customer data, usage data included: a deviation here also
 * goes to the Head of Security (PB-APR-02).
 */
export const isDataOrSecurityRule = (ruleId: string) => /^PB-(DATA|SEC|IP)-/.test(ruleId);

/**
 * Each rule's topic, in one place: the plan's task title, the finding's topic in the review table, the
 * chat cards, the rail and the Tasks table all read it, so one clause has one name everywhere. The
 * contract's own section headings stay the document's words, in the contract viewer.
 */
export const TOPICS: Record<CheckRuleId | "PB-SEC-01" | "parties" | "security", string> = {
  parties: "Identify the parties, products and order of precedence",
  "PB-REN-01": "Term, renewal and notice",
  "PB-PAY-01": "Fees, payment terms and price increases",
  "PB-LIAB-01": "Limitation of liability",
  "PB-IND-01": "Indemnities",
  "PB-DATA-01": "Data protection and DPA",
  "PB-DATA-02": "Security incident notice",
  security: "Security standards and audits",
  "PB-SEC-01": "Request the SOC 2 Type II report and pen-test summary",
  "PB-IP-01": "IP, usage data and customer outputs",
  "PB-CONF-01": "Confidentiality",
  "PB-TERM-01": "Termination rights",
  "PB-ASSIGN-01": "Assignment and change of control",
  "PB-INS-01": "Insurance",
  "PB-LAW-01": "Governing law and disputes",
};
