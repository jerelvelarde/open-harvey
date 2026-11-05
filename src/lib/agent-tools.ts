// What the frontend tools do, as plain functions. copilot/useReviewTools.ts registers them with
// CopilotKit (useFrontendTool); demo-script.test.ts calls the same functions, so the scripted demo is
// tested against the real handlers. Each one reads the store when it runs and calls the pure
// functions in lib/review.ts and lib/plan.ts: the model picks the inputs, the code does the analysis.

import { z } from "zod";
import { COLLECTION_DOCS, COLLECTION_DOC_IDS, COLLECTION_ID, COLLECTION_NAME, COLUMNS, COLUMN_KEYS, columnLabel, getCollectionDoc, securityNote, securityStatus, type ColumnKey } from "./collection";
import { CFO_THRESHOLD, getPerson } from "./company";
import { allPassages, currentText, isChanged, spanRuns } from "./document";
import { getContract, getLibrary } from "./library";
import { MATTER_IDS, getMatter, matterTitle } from "./matters";
import {
  addComment,
  agentRedline,
  agentSuggestEdit,
  appStore,
  documentView,
  fillCell,
  insertClause,
  matterView,
  openCollection,
  openMatter,
  recheck,
  replyToComment,
  resolveComment,
  runTask,
  setReason,
} from "./store";

const matterId = z.enum(MATTER_IDS as [string, ...string[]]).describe('The matter id, e.g. "acme-msa"');
const ruleId = z.string().describe('A playbook rule id, e.g. "PB-LIAB-01"');
const cite = z.string().describe('A passage id from readDocument, e.g. "§2.3" (an added clause has one too, e.g. "§5.4")');
const commentId = z.string().describe('A comment id from readDocument or the context, e.g. "C1"');
const collectionId = z.literal(COLLECTION_ID).describe(`The collection id: "${COLLECTION_ID}" (${COLLECTION_NAME})`);

export const toolSchemas = {
  readMatter: z.object({ matterId }),
  runPlanTask: z.object({ matterId, taskId: z.string().describe('A task id from the approved plan, e.g. "liability"') }),
  recheckRedline: z.object({ matterId, ruleId }),
  setDeviationReason: z.object({
    matterId,
    ruleId,
    reason: z.string().describe("The user's reason for accepting the deviation, in their words, for the General Counsel (PB-APR-01)"),
  }),
  updateRedline: z.object({
    matterId,
    ruleId,
    text: z.string().describe("The full redline, written as contract language"),
    userAsked: z.boolean().optional().describe("true only when the user asked for this change in their own words. Without it, a redline the user wrote is left alone."),
  }),
  readCollection: z.object({ collectionId }),
  fillCollectionCell: z.object({
    collectionId,
    docId: z.enum(COLLECTION_DOC_IDS as [string, ...string[]]).describe('A document in the collection, e.g. "lumen-ridge"'),
    column: z.enum(COLUMN_KEYS as [ColumnKey, ...ColumnKey[]]).describe('A column of the review table, e.g. "securityEvidence"'),
  }),
  readDocument: z.object({ matterId }),
  suggestEdit: z.object({
    matterId,
    cite,
    find: z.string().describe("The exact words to change, quoted from the passage as it reads now (readDocument), within one sentence"),
    replaceWith: z.string().describe("The words to put in their place, as contract language (empty to strike them)"),
    userAsked: z.boolean().optional().describe("true only when the user asked for this change in their own words. Without it, text the user wrote is left alone."),
  }),
  insertClause: z.object({
    matterId,
    section: z.number().int().positive().describe("The section number the clause belongs in, e.g. 5 for Security. It is added at the end of the section, with the next free number"),
    caption: z.string().describe('A short caption, e.g. "Security reports"'),
    text: z.string().describe("The clause, written as contract language"),
  }),
  addComment: z.object({
    matterId,
    cite,
    quote: z.string().describe("The exact words the comment is about, quoted from the passage"),
    text: z.string().describe("The comment, in a sentence or two"),
  }),
  replyToComment: z.object({ matterId, commentId, text: z.string().describe("The reply, in a sentence or two") }),
  resolveComment: z.object({
    matterId,
    commentId,
    userAsked: z.boolean().optional().describe("true only when the user asked to resolve a comment they wrote"),
  }),
};

/** The parameters of the tools that draw something: the two gates and the three cards (src/copilot/). */
export const uiToolSchemas = {
  proposePlan: z.object({ matterId }),
  requestApproval: z.object({ matterId }),
  showFindings: z.object({ matterId }),
  showRedlines: z.object({ matterId }),
  showRecheck: z.object({
    matterId,
    ruleId,
    before: z.string().describe("The redline as it was before the user's edit, quoted from their message"),
  }),
};

type Args<T extends keyof typeof toolSchemas> = z.infer<(typeof toolSchemas)[T]>;

export const toolHandlers = {
  /** Open a matter in the app and read what it is: the document, the deal and its value. */
  readMatter: ({ matterId }: Args<"readMatter">) => {
    openMatter(matterId);
    const view = matterView(appStore.getState(), matterId);
    const contract = getContract(matterId);
    const { matter, review } = view;
    return {
      matterId,
      matterNumber: matter.matterNumber,
      title: matterTitle(matter),
      document: contract.title,
      vendor: matter.vendor,
      product: matter.product,
      businessOwner: `${getPerson(matter.businessOwner).name} (${getPerson(matter.businessOwner).title})`,
      receivedAt: matter.receivedAt,
      pricingHoldsUntil: matter.pricingHoldsUntil,
      sections: contract.sections.length,
      passages: contract.sections.reduce((n, s) => n + s.passages.length, 0),
      words: contract.words,
      annualFee: matter.terms.annualFee.value,
      initialTermMonths: matter.terms.initialTermMonths.value,
      totalContractValue: review.totalValue,
      cfoLine: CFO_THRESHOLD,
      processesCustomerPersonalData: matter.terms.processesCustomerPersonalData.value,
      planApproved: view.planApproved,
      planTasks: view.plan.length,
      status: view.status,
    };
  },

  /** Run one task of the approved plan and tick it in the Plan. Refuses before the plan is approved. Task 17 stays held until every approver has approved. */
  runPlanTask: ({ matterId, taskId }: Args<"runPlanTask">) => {
    const result = runTask(matterId, taskId);
    if (!result.ok) return { error: result.error };
    const { outcome } = result;
    const f = outcome.finding;
    return {
      taskId,
      task: `${result.number} of ${result.of}: ${result.title}`,
      status: result.held ? "held until every approver approves" : outcome.status === "attention" ? "needs attention" : "done",
      finding: outcome.line,
      read: outcome.reads,
      ...(f?.ruleId ? { ruleId: f.ruleId, topic: f.topic, cite: f.cite, result: f.status, risk: f.risk } : {}),
      ...(taskId === "route" ? { route: matterView(appStore.getState(), matterId).review.route.map(({ name, title, ruleId, reason }) => ({ name, title, ruleId, reason })) } : {}),
      next: result.next,
    };
  },

  /** Re-check a redline against its rule, after the user edits it. */
  recheckRedline: ({ matterId, ruleId }: Args<"recheckRedline">) => recheck(matterId, ruleId),

  /** Record the reason Northstar accepts a deviation. The General Counsel reads it. */
  setDeviationReason: ({ matterId, ruleId, reason }: Args<"setDeviationReason">) => {
    const view = matterView(appStore.getState(), matterId);
    const finding = view.review.findings.find((f) => f.ruleId === ruleId);
    if (!finding) return { error: `${ruleId} is not a finding on ${matterId}.` };
    setReason(matterId, ruleId, reason);
    const after = matterView(appStore.getState(), matterId);
    return {
      ruleId,
      cite: finding.cite,
      recorded: true,
      stillToExplain: after.missingReasons.map((f) => `${f.cite} (${f.ruleId})`),
      readyToSend: after.status === "ready",
      redlines: Object.keys(after.redlines).filter((rule) => after.review.findings.some((f) => f.ruleId === rule && f.status === "deviation")).length,
      route: after.review.route.map((s) => s.name),
    };
  },

  /** Change a redline. A redline the user wrote is left alone unless the user asked. */
  updateRedline: ({ matterId, ruleId, text, userAsked }: Args<"updateRedline">) => agentRedline(matterId, ruleId, text, userAsked === true),

  /** Open the collection's thread and its review table beside it: what is in it, and the questions. */
  readCollection: ({ collectionId }: Args<"readCollection">) => {
    openCollection(collectionId);
    return {
      name: COLLECTION_NAME,
      documents: COLLECTION_DOCS.map((d) => ({ docId: d.id, vendor: d.vendor, agreement: d.agreement, status: d.signed ? `signed ${d.signed}` : "in review", holdsCustomerData: d.holdsCustomerData })),
      columns: COLUMNS.map(({ key, question }) => ({ column: key, question })),
    };
  },

  /** Open the contract in the document beside the thread, and read it as it reads now: every passage, the tracked changes and the comments. */
  readDocument: ({ matterId }: Args<"readDocument">) => {
    openMatter(matterId);
    const doc = documentView(appStore.getState(), matterId);
    const contract = getContract(matterId);
    const who = (by: string) => (by === "human" ? "user" : "copilot");
    return {
      matterId,
      document: contract.title,
      sections: doc.sections.map((s) => ({ section: s.number, title: s.title })),
      passages: allPassages(doc.sections).map((p) => ({
        cite: p.cite,
        caption: p.caption,
        text: currentText(spanRuns(p.spans)),
        ...(p.spans.some(isChanged) ? { changed: true } : {}),
        ...(p.inserted ? { added: true } : {}),
      })),
      changes: doc.changes.map((c) => ({
        changeId: c.id,
        cite: c.cite,
        kind: c.kind,
        by: who(c.by),
        before: c.before,
        after: c.after,
        ...(c.finding ? { ruleId: c.ruleId, topic: c.finding.topic, position: c.finding.position, quote: c.finding.quote } : {}),
      })),
      comments: doc.comments.map((c) => ({ commentId: c.id, cite: c.cite, by: who(c.by), resolved: c.resolved, quotedText: { quote: c.quote, text: c.text, replies: c.replies.map((r) => ({ by: who(r.by), text: r.text })) } })),
      requests: doc.requests.map((f) => ({ ruleId: f.ruleId, cite: f.cite, request: f.redline })),
    };
  },

  /** Suggest an edit to one passage, tracked in the copilot's name. Text the user wrote is left alone unless they asked. */
  suggestEdit: ({ matterId, cite, find, replaceWith, userAsked }: Args<"suggestEdit">) => agentSuggestEdit(matterId, cite, find, replaceWith, userAsked === true),

  /** Add a clause at the end of a section, as a tracked insertion in the copilot's name. */
  insertClause: ({ matterId, section, caption, text }: Args<"insertClause">) => insertClause(matterId, section, caption, text, "agent"),

  /** Comment on exact words in a passage, in the margin. */
  addComment: ({ matterId, cite, quote, text }: Args<"addComment">) => addComment(matterId, cite, quote, text, "agent"),

  replyToComment: ({ matterId, commentId, text }: Args<"replyToComment">) => replyToComment(matterId, commentId, text, "agent"),

  /** Resolve a comment: the copilot's own, or the user's only when they asked. */
  resolveComment: ({ matterId, commentId, userAsked }: Args<"resolveComment">) => resolveComment(matterId, commentId, "agent", userAsked === true),

  /** Answer one cell of the review table from its document: the answer, the passage and the exact words. */
  fillCollectionCell: ({ docId, column }: Args<"fillCollectionCell">) => {
    const doc = getCollectionDoc(docId);
    const cell = fillCell(docId, column);
    const security = column === "securityEvidence" ? securityStatus(doc, appStore.getState(), getLibrary().history ?? []) : null;
    return {
      vendor: doc.vendor,
      vendorShort: doc.vendorShort,
      column: columnLabel(column),
      answer: cell.answer,
      cite: cell.cite,
      quote: cell.quotes.join(" … "),
      status: doc.signed ? "signed" : "in review",
      holdsCustomerData: doc.holdsCustomerData,
      // Where the evidence stands (lib/collection.ts securityStatus): the history for a signed vendor, the store for a matter in review.
      ...(security ? { security: security.kind, note: securityNote(security), ...(security.kind === "received" ? { receivedAt: security.receivedAt, daysLost: security.daysLost } : {}) } : {}),
    };
  },
};
