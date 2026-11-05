// Concept: a review table across a collection. The same questions asked of every document in a set,
// one row per document and one column per question, every cell a short answer with the passage it
// comes from. "Vendor contracts 2026" holds the eight vendor contracts Northstar signed or is
// reviewing this year: the two matters in review (Acme Cloud, Brightwater Metrics) and six signed
// ones (src/data/collection/).
//
// As with the matters, the terms are a hand-written structured record standing in for an extraction
// step, each with its § cite and the contract's exact words; collection.test.ts checks every quote
// against its passage. The agent fills the table one cell at a time (fillCollectionCell, in
// lib/agent-tools.ts): the model picks the cell, this file works out the answer.

import cobalt from "@/data/collection/cobalt-harbor.terms.json";
import fernway from "@/data/collection/fernway-data.terms.json";
import halden from "@/data/collection/halden-payroll.terms.json";
import kestrel from "@/data/collection/kestrel-language.terms.json";
import lumen from "@/data/collection/lumen-ridge.terms.json";
import orchard from "@/data/collection/orchard-lane.terms.json";
import { getContract, getLibrary } from "./library";
import { securityEvidenceReceipts, type PastReview } from "./learning";
import type { AppState } from "./store";
import { ACME_ID, BRIGHTWATER_ID, getMatter, type Cited } from "./matters";
import type { Contract, PassageId } from "./contract";

export const COLLECTION_ID = "vendor-contracts-2026";
export const COLLECTION_NAME = "Vendor contracts 2026";

export type ColumnKey = "liabilityCap" | "renewal" | "dpa" | "breachNotice" | "termination" | "securityEvidence";

/** The questions, one per column, in order. */
export const COLUMNS: { key: ColumnKey; label: string; question: string }[] = [
  { key: "liabilityCap", label: "Liability cap", question: "What is each party's total liability capped at?" },
  { key: "renewal", label: "Renewal and notice", question: "How does it renew, and how much notice stops a renewal?" },
  { key: "dpa", label: "DPA", question: "Is there a signed data processing addendum?" },
  { key: "breachNotice", label: "Breach notice", question: "How soon must the vendor tell Northstar about a security breach?" },
  { key: "termination", label: "Termination for convenience", question: "Can Northstar end it for convenience, and on what notice?" },
  { key: "securityEvidence", label: "Security evidence", question: "Does the vendor give Security a SOC 2 Type II report and a pen-test summary (PB-SEC-01)?" },
];
export const COLUMN_KEYS = COLUMNS.map((c) => c.key);
export const columnLabel = (key: ColumnKey) => COLUMNS.find((c) => c.key === key)!.label;

type DocTerms = {
  liabilityCapMonths: Cited<number>;
  renewalTermMonths: Cited<number>;
  renewalNoticeDays: Cited<number>;
  dataProcessingAddendum: Cited<boolean>;
  breachNoticeHours: Cited<number>;
  terminationForConvenienceDays: Cited<number | null>;
  securityEvidence: Cited<{ soc2: boolean; pentest: boolean }>;
};

/** One document in the collection. `signed` is the signature date; null while it is in review. */
export type CollectionDoc = {
  id: string;
  /** The matter number, which the imported review history (review-history.jsonl) uses as its id. */
  matterNumber: string;
  vendor: string;
  /** How the contract names the vendor ("Lumen Ridge", "Acme"). */
  vendorShort: string;
  agreement: string;
  annualFee: number;
  signed: string | null;
  holdsCustomerData: boolean;
  /** The matter, for a document in review: its cite opens the matter's contract. */
  matterId: string | null;
  terms: DocTerms;
};

type SignedRecord = { id: string; matterNumber: string; vendor: string; vendorTerm: string; agreement: string; annualFee: number; signed: string; holdsCustomerData: boolean; terms: DocTerms };
const SIGNED = [halden, lumen, orchard, cobalt, kestrel, fernway] as unknown as SignedRecord[];

/** A matter in review, read from its deal terms. Neither contract offers an audit report (securityProgram says so). */
function fromMatter(id: string): CollectionDoc {
  const m = getMatter(id);
  const t = m.terms;
  return {
    id,
    matterNumber: m.matterNumber,
    vendor: m.vendor.replace(/, Inc\.$/, ""),
    vendorShort: m.vendorTerm,
    agreement: m.kind,
    annualFee: t.annualFee.value,
    signed: null,
    holdsCustomerData: t.processesCustomerPersonalData.value,
    matterId: id,
    terms: {
      liabilityCapMonths: t.liabilityCapMonths,
      renewalTermMonths: t.renewalTermMonths,
      renewalNoticeDays: t.renewalNoticeDays,
      dataProcessingAddendum: t.dataProcessingAddendum,
      breachNoticeHours: t.breachNoticeHours,
      terminationForConvenienceDays: t.terminationForConvenienceDays,
      securityEvidence: { value: { soc2: /SOC 2/i.test(t.securityProgram.value) && !/no audit reports/.test(t.securityProgram.value), pentest: false }, cite: t.securityProgram.cite, quote: t.securityProgram.quote },
    },
  };
}

/** The eight documents, in review first (as the queue has them), then signed, newest first. */
export const COLLECTION_DOCS: CollectionDoc[] = [
  fromMatter(ACME_ID),
  fromMatter(BRIGHTWATER_ID),
  ...[...SIGNED]
    .sort((a, b) => (a.signed < b.signed ? 1 : -1))
    .map((d) => ({ id: d.id, matterNumber: d.matterNumber, vendor: d.vendor, vendorShort: d.vendorTerm, agreement: d.agreement, annualFee: d.annualFee, signed: d.signed, holdsCustomerData: d.holdsCustomerData, matterId: null, terms: d.terms })),
];
export const COLLECTION_DOC_IDS = COLLECTION_DOCS.map((d) => d.id);
/** The six signed contracts, whose text lives in src/data/collection/ (the server reads them with the matters). */
export const SIGNED_DOC_IDS = SIGNED.map((d) => d.id);

export function getCollectionDoc(id: string): CollectionDoc {
  const doc = COLLECTION_DOCS.find((d) => d.id === id);
  if (!doc) throw new Error(`Unknown document in ${COLLECTION_NAME}: ${id}`);
  return doc;
}

/** The document's text: a matter's contract, or a signed contract from the collection. */
export const collectionContract = (doc: CollectionDoc): Contract => getContract(doc.id);

// ---------------------------------------------------------------------------------------------
// The security column answers whether Security has the evidence PB-SEC-01 asks for. The contract
// says what the vendor must provide (the quote and cite); the review history says what Security
// actually received, and when (lib/learning.ts securityEvidenceReceipts).

/** The security answer while Security has neither report and the contract requires neither. */
export const NO_EVIDENCE = "No SOC 2 report or pen-test summary";
/** The security answer for a signed vendor whose evidence arrived only after Security sent the review back. */
export const RECEIVED_AFTER_SEND_BACK = "Received after a send-back";

export type SecurityStatus =
  /** The vendor holds no customer data: PB-SEC-01 does not apply. */
  | { kind: "not_needed" }
  /** The contract itself commits the vendor to both reports. */
  | { kind: "in_contract" }
  /** Signed; the history shows the evidence arrived after a send-back. */
  | { kind: "received"; receivedAt: string; approver: string; daysLost: number | null }
  /** In review; the learned PB-SEC-01 request went out with the first redlines. */
  | { kind: "requested" }
  /** In review and sent back; PB-SEC-01 is published, so the request goes out with the resubmission. */
  | { kind: "with_resubmission" }
  /** In review; nothing has asked for the evidence yet. */
  | { kind: "ask" }
  /** Signed, holds customer data, and neither the contract nor the history gives Security the evidence. */
  | { kind: "missing" };

const hasBoth = (doc: CollectionDoc) => doc.terms.securityEvidence.value.soc2 && doc.terms.securityEvidence.value.pentest;
const receiptFor = (doc: CollectionDoc, history: readonly PastReview[]) => securityEvidenceReceipts(history).find((r) => r.matterId === doc.matterNumber) ?? null;

/** Where the security evidence stands for one document, from its contract, the history and (for a matter in review) the store. */
export function securityStatus(doc: CollectionDoc, state: Pick<AppState, "matters" | "publishedRules"> | null, history: readonly PastReview[]): SecurityStatus {
  if (!doc.holdsCustomerData) return { kind: "not_needed" };
  if (hasBoth(doc)) return { kind: "in_contract" };
  if (doc.signed) {
    const receipt = receiptFor(doc, history);
    return receipt ? { kind: "received", receivedAt: receipt.receivedAt, approver: receipt.approver, daysLost: receipt.daysLost } : { kind: "missing" };
  }
  const matter = doc.matterId ? state?.matters[doc.matterId] : undefined;
  if (matter?.redlines["PB-SEC-01"]) return { kind: "requested" };
  if (matter?.submission?.status === "sent_back" && state?.publishedRules.some((r) => r.id === "PB-SEC-01")) return { kind: "with_resubmission" };
  return { kind: "ask" };
}

const monthDay = (iso: string) => new Date(`${iso.slice(0, 10)}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

/** The line under a security answer, or null. */
export function securityNote(status: SecurityStatus): string | null {
  switch (status.kind) {
    case "received":
      return `Received ${monthDay(status.receivedAt)}; the contract doesn't require it`;
    case "requested":
      return "Requested with the redlines (PB-SEC-01)";
    case "with_resubmission":
    case "ask":
      return "Ask before signing";
    default:
      return null;
  }
}

/** One answered cell: a short answer, the passage it comes from, and the contract's exact words. */
export type Cell = { docId: string; column: ColumnKey; answer: string; cite: PassageId; quotes: string[] };

const months = (n: number) => `${n} ${n === 1 ? "month" : "months"}`;
const notice = (days: number) => `${days} days' notice`;

export function answerCell(docId: string, column: ColumnKey): Cell {
  const doc = getCollectionDoc(docId);
  const t = doc.terms;
  const cell = (answer: string, ...fields: Cited<unknown>[]): Cell => ({ docId, column, answer, cite: fields[0].cite, quotes: fields.map((f) => f.quote) });
  switch (column) {
    case "liabilityCap":
      return cell(`${months(t.liabilityCapMonths.value)} of fees`, t.liabilityCapMonths);
    case "renewal":
      return cell(`${t.renewalTermMonths.value}-month renewals · ${notice(t.renewalNoticeDays.value)}`, t.renewalTermMonths, t.renewalNoticeDays);
    case "dpa":
      return cell(t.dataProcessingAddendum.value ? "Signed" : doc.holdsCustomerData ? "None" : "Not needed: no customer data", t.dataProcessingAddendum);
    case "breachNotice": {
      const h = t.breachNoticeHours.value;
      return cell(h > 72 && h % 24 === 0 ? `${h / 24} days` : `${h} hours`, t.breachNoticeHours);
    }
    case "termination": {
      const d = t.terminationForConvenienceDays.value;
      return cell(d === null ? "None" : notice(d), t.terminationForConvenienceDays);
    }
    case "securityEvidence": {
      const { soc2, pentest } = t.securityEvidence.value;
      if (!doc.holdsCustomerData) return cell("Not needed: no customer data", t.securityEvidence);
      if (soc2 && pentest) return cell("SOC 2 Type II and a pen-test summary", t.securityEvidence);
      if (doc.signed && receiptFor(doc, getLibrary().history ?? [])) return cell(RECEIVED_AFTER_SEND_BACK, t.securityEvidence);
      return cell(soc2 ? "SOC 2 Type II only" : pentest ? "Pen-test summary only" : NO_EVIDENCE, t.securityEvidence);
    }
  }
}

/** The security column across the collection, grouped by where the evidence stands. */
export function securityStandings(state: Pick<AppState, "matters" | "publishedRules"> | null, history: readonly PastReview[], docs: readonly CollectionDoc[] = COLLECTION_DOCS) {
  const of = (...kinds: SecurityStatus["kind"][]) => docs.filter((d) => kinds.includes(securityStatus(d, state, history).kind));
  return {
    receivedAfterSendBack: of("received"),
    inReview: of("requested", "with_resubmission", "ask"),
    missing: of("missing"),
    noCustomerData: of("not_needed"),
  };
}

export const cellKey = (docId: string, column: ColumnKey) => `${docId}:${column}`;
export const isColumnKey = (key: unknown): key is ColumnKey => typeof key === "string" && (COLUMN_KEYS as string[]).includes(key);
export function isCellKey(key: string): boolean {
  const [docId, column] = key.split(":");
  return COLLECTION_DOC_IDS.includes(docId) && isColumnKey(column);
}
