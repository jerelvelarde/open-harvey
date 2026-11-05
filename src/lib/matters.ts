// The matters in Maya's queue: each is a contract (markdown, read on the server) and its deal terms
// (a structured record beside it, *.terms.json, imported here). Every term carries the passage it
// comes from and the exact words, so a finding can cite and highlight it; a term that a redline
// replaces also carries its whole sentence, the words the redline strikes (contract.test.ts checks
// every quote and clause against the text). The terms files are hand-written: they stand in for an
// extraction step, so the checks, routing and learning run on them in code.

import acme from "@/data/contracts/acme-msa.terms.json";
import brightwater from "@/data/contracts/brightwater-order-form.terms.json";
import type { PassageId } from "./contract";

/** A term: its value, the passage it comes from, the exact words, and (when a redline replaces it) the whole sentence. */
export type Cited<T> = { value: T; cite: PassageId; quote: string; clause?: string };

export type DealTerms = {
  parties: Cited<string[]>;
  orderOfPrecedence: Cited<string>;
  productScope: Cited<string>;
  annualFee: Cited<number>;
  initialTermMonths: Cited<number>;
  renewalTermMonths: Cited<number>;
  renewalNoticeDays: Cited<number>;
  paymentDays: Cited<number>;
  priceIncreasePct: Cited<number>;
  liabilityCapMonths: Cited<number>;
  ipIndemnity: Cited<{ byVendor: boolean; outsideCap: boolean }>;
  processesCustomerPersonalData: Cited<boolean>;
  dataProcessingAddendum: Cited<boolean>;
  breachNoticeHours: Cited<number>;
  securityProgram: Cited<string>;
  usageData: Cited<{ owner: "vendor" | "customer"; vendorUse: string }>;
  confidentialityYearsAfter: Cited<number>;
  terminationForConvenienceDays: Cited<number | null>;
  assignment: Cited<{ consentRequired: boolean; successorAllowed: boolean }>;
  insurance: Cited<{ generalLiability: number; cyberLiability: number }>;
  governingLaw: Cited<string>;
};

export type MatterRecord = {
  id: string;
  matterNumber: string;
  kind: string;
  vendor: string;
  /** How the contract names the vendor ("Acme"), for redlines written in its own terms. */
  vendorTerm: string;
  vendorShort: string;
  product: string;
  businessOwner: string;
  receivedAt: string;
  pricingHoldsUntil: string | null;
  terms: DealTerms;
};

export const MATTERS = [acme, brightwater] as unknown as readonly MatterRecord[];
export const MATTER_IDS = MATTERS.map((m) => m.id);
export type MatterId = string;

/** The matter the story opens on. */
export const ACME_ID = "acme-msa";
/** The order form that arrives the same afternoon, at 4:40 pm (step 7). */
export const BRIGHTWATER_ID = "brightwater-order-form";

export function getMatter(id: string): MatterRecord {
  const matter = MATTERS.find((m) => m.id === id);
  if (!matter) throw new Error(`Unknown matter: ${id}`);
  return matter;
}

export const isMatterId = (id: unknown): id is MatterId => typeof id === "string" && MATTER_IDS.includes(id);

/** "Acme Cloud · Master Services Agreement" */
export const matterTitle = (m: MatterRecord) => `${m.vendorShort} · ${m.kind}`;
