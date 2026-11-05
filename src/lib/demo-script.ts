// Concept: a scripted brain for the mock model.
//
// lib/mock-model.ts stands in for the LLM so the whole chat loop runs without an API key. Each time
// BuiltInAgent calls the model, the mock asks nextStep() what to do. nextStep() reads the same prompt
// a real model gets (the system prompt with the app context, then the user, assistant and tool
// messages) and returns the next action: tool calls with exact arguments, or a short reply.
//
// Frontend tools run in the browser, so one user turn takes many model calls: the model asks for a
// tool, the run ends, the browser runs it and starts a new run with the result. nextStep() is called
// each time and picks up where the turn left off, from the latest user message and the tool calls
// made since. A review is one turn of about twenty calls: read the matter, propose the plan (the
// card waits for Maya's click), then one runPlanTask per task, then the cards, then three lines.
//
// It follows lib/agent-instructions.ts like the real model should: every finding, number and name in
// a reply comes from a tool result, never from this file; it cites rule and passage ids; it asks for
// a reason instead of arguing; it calls requestApproval only when asked to send.
//
// It only knows the README's demo script. Anything else gets a short note listing the sentences it
// understands. Pure and deterministic: demo-script.test.ts plays the whole demo against it.

import type { LanguageModelV3Prompt, LanguageModelV3ToolResultOutput } from "@ai-sdk/provider";
import { COLLECTION_ID } from "./collection";
import { totalDaysLost } from "./learning";

/** One tool call the model makes. The browser runs it and sends the result back. */
export type ToolCallRequest = { toolName: string; input: Record<string, unknown> };

/**
 * What the model says or does next: a reply (text), tool calls, or text followed by tool calls.
 * `pauseMs` holds the step back before it streams, so a person can watch the checklist work down.
 */
export type NextStep = { text: string; toolCalls: ToolCallRequest[]; pauseMs?: number };

/**
 * The sentences the mock understands, in demo order (README "Demo script"). The second is Maya's
 * reason for accepting a deviation: the presenter types it (no chip offers it, it is her judgment).
 */
export const DEMO_SENTENCES = [
  "Review the Acme Cloud MSA and get it ready to sign.",
  "Acme won't go above 6 months. The $1M data-breach cap covers the exposure we care about.",
  "Send it for approval.",
  "Review the Brightwater Metrics order form.",
] as const;

/** Step 8, optional, once PB-SEC-01 is published: the collection review table's security column. */
export const COLLECTION_SENTENCE = "Check every contract in Vendor contracts 2026 for the security evidence PB-SEC-01 asks for.";
/** The Analytics page, asked in the thread. */
export const REVIEWS_GOING_SENTENCE = "How are reviews going?";

/**
 * What the copilot does in the document (README "The document"): a comment on each redline with its
 * rule, the clause Jordan Blake asks for, and a tracked edit to text no playbook rule covers.
 */
export const DOCUMENT_ASKS = {
  comments: "Comment on each Acme redline with Northstar's reason.",
  clause: "Add a clause that Acme sends its SOC 2 Type II report and latest pen-test summary before we sign.",
  edit: "Edit §2.3 of the Acme MSA so service credits aren't Northstar's only remedy.",
} as const;

/** A beat before each checklist task, so the run reads as work, about half a second a task with the tool's own beat. */
export const TASK_PAUSE_MS = 140;

const MATTER_NAMES: [RegExp, string][] = [
  [/\bacme\b/i, "acme-msa"],
  [/\bbrightwater\b/i, "brightwater-order-form"],
];

export function nextStep(prompt: LanguageModelV3Prompt): NextStep {
  const c = readConversation(prompt);
  const text = c.userText;
  if (!text) return reply(offScript());

  const edits = parseRedlineEdits(text);
  if (edits.length > 0) return afterHumanEdit(c, edits); // step 3: the edit in the review table
  const review = parseReviewRequest(text);
  if (review) return reviewMatter(c, review); // steps 1, 2 and 7
  const inDocument = documentAsk(text);
  if (inDocument) return workInDocument(c, inDocument, matterFor(c, text)); // the document
  if (SEND.test(text)) return send(c); // step 4: "Send it for approval."
  if (COLLECTION_ASK.test(text)) return reviewCollection(c, text); // step 8 (optional): the collection review table
  if (REVIEWS_GOING.test(text)) return reply(howReviewsAreGoing(c));
  if (STATUS.test(text)) return reply(status(c));
  if (ASKED_FOR.test(text)) return reply(whatTheyAsked(c));
  const recorded = called(c, "setDeviationReason").at(-1);
  if (recorded) return giveReason(c, String(recorded.input.ruleId), text);
  const needsReason = c.context.activeMatter?.needsReason ?? [];
  if (needsReason.length > 0) return giveReason(c, needsReason[0], text); // step 3: the reason
  return reply(offScript());
}

// ---------------------------------------------------------------------------------------------
// Reading the prompt: the app context from the system prompt, and the conversation so far

export type ActiveMatterContext = {
  matterId: string;
  title: string;
  totalContractValue: number;
  status: string;
  planApproved: boolean;
  tasks: { taskId: string; title: string; status: string }[];
  findings: { ruleId: string; cite: string; result: string; risk: string | null }[];
  route: { name: string; title: string; ruleId: string }[];
  editedByUser: string[];
  needsReason: string[];
  submission: { status: string; waitingFor: string | null; decisions: { approver: string; decision: string; quotedText: { comment: string } }[] } | null;
  document?: { changes: { changeId: string; cite: string; kind: string; by: string; ruleId?: string }[]; comments: { commentId: string; cite: string; by: string; resolved: boolean; replies: number }[] } | null;
  quotedText: { redlines: Record<string, string>; reasons: Record<string, string>; comments?: Record<string, { quote: string; text: string }>; documentEdits?: Record<string, string> };
};

export type AnalyticsContext = {
  before: { reviews: number; firstPass: number; sentBack: number; medianCycleDays: number | null; daysLost: number };
  since: { reviews: number; tasksRun: number; redlinesDrafted: number; humanEdits: number; approvalsRequested: number; decisions: number; firstPass: number; sentBack: number; rulesPublished: number };
  reasons: { key: string; label: string; before: number; since: number }[];
  decisions: number;
  next: string[];
};

export type AppContext = {
  activeMatter: ActiveMatterContext | null;
  matters: { matterId: string; title: string; status: string }[];
  /** The published rules' text, or "None yet." */
  learnedRules: string;
  analytics: AnalyticsContext | null;
};

type Call = { name: string; input: Record<string, unknown>; result: unknown };

export type Conversation = {
  context: AppContext;
  /** The latest user message: what this turn is about. */
  userText: string;
  /** Tool calls made since the latest user message, oldest first, with their results. */
  turnCalls: Call[];
};

// BuiltInAgent writes each context entry into the system prompt as "<description>:\n<value>\n",
// after a "## Context from the application" heading. These match the descriptions in app-context.ts.
const CONTEXT_HEADINGS = {
  user: (line: string) => line.startsWith("The signed-in user"),
  matters: (line: string) => line.startsWith("Matters the user can open"),
  activeMatter: (line: string) => line.startsWith("The matter open in the workspace"),
  learnedRules: (line: string) => line.startsWith("Playbook rules a person reviewed"),
  analytics: (line: string) => line.startsWith("How reviews are going"),
  collections: (line: string) => line.startsWith("Collections the user can open"),
};

export function readAppContext(system: string): AppContext {
  const start = system.indexOf("## Context from the application");
  const sections: Partial<Record<keyof typeof CONTEXT_HEADINGS, string[]>> = {};
  let current: keyof typeof CONTEXT_HEADINGS | null = null;
  for (const line of start === -1 ? [] : system.slice(start).split("\n")) {
    const heading = line.endsWith(":") ? (Object.keys(CONTEXT_HEADINGS) as (keyof typeof CONTEXT_HEADINGS)[]).find((key) => CONTEXT_HEADINGS[key](line)) : undefined;
    if (heading) {
      current = heading;
      sections[heading] = [];
    } else if (current) sections[current]?.push(line);
  }
  const value = (key: keyof typeof CONTEXT_HEADINGS) => (sections[key] ?? []).join("\n").trim();
  const active = parseJson(value("activeMatter"));
  const matters = parseJson(value("matters"));
  const stats = parseJson(value("analytics"));
  return {
    activeMatter: isObject(active) && typeof active.matterId === "string" ? (active as ActiveMatterContext) : null,
    matters: Array.isArray(matters) ? matters : [],
    learnedRules: value("learnedRules") || "None yet.",
    analytics: isObject(stats) && isObject(stats.before) ? (stats as AnalyticsContext) : null,
  };
}

export function readConversation(prompt: LanguageModelV3Prompt): Conversation {
  const system: string[] = [];
  const allCalls: Call[] = [];
  const byId = new Map<string, Call>();
  let userText = "";
  let turnStart = 0;

  for (const message of prompt) {
    if (message.role === "system") system.push(message.content);
    if (message.role === "user") {
      userText = message.content.map((part) => (part.type === "text" ? part.text : "")).join("").trim();
      turnStart = allCalls.length;
    }
    if (message.role === "assistant") {
      for (const part of message.content) {
        if (part.type === "tool-call") {
          const call: Call = { name: part.toolName, input: isObject(part.input) ? part.input : (parseJson(String(part.input)) as Record<string, unknown>) ?? {}, result: undefined };
          allCalls.push(call);
          byId.set(part.toolCallId, call);
        }
      }
    }
    if (message.role === "tool") {
      for (const part of message.content) {
        const call = part.type === "tool-result" ? byId.get(part.toolCallId) : undefined;
        if (call && part.type === "tool-result") call.result = readToolOutput(part.output);
      }
    }
  }
  return { context: readAppContext(system.join("\n")), userText, turnCalls: allCalls.slice(turnStart) };
}

/** Frontend tool results arrive as text: the handler's return value as JSON, or "" for a card. */
function readToolOutput(output: LanguageModelV3ToolResultOutput): unknown {
  switch (output.type) {
    case "text":
      return parseJson(output.value);
    case "json":
      return output.value;
    case "error-text":
    case "error-json":
      return { error: output.value };
    case "execution-denied":
      return { error: output.reason ?? "The tool call was denied." };
    case "content":
      return parseJson(output.value.map((part) => (part.type === "text" ? part.text : "")).join(""));
  }
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

const isObject = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const obj = (value: unknown): Record<string, unknown> => (isObject(value) ? value : {});
const called = (c: Conversation, name: string) => c.turnCalls.filter((call) => call.name === name);

// ---------------------------------------------------------------------------------------------
// Reading the user's words

/** "Review the Acme Cloud MSA and get it ready to sign." → acme-msa */
export function parseReviewRequest(text: string): string | null {
  if (!/^\s*(please\s+)?(review|check)\b/i.test(text)) return null;
  return MATTER_NAMES.find(([pattern]) => pattern.test(text))?.[1] ?? null;
}

const SEND = /\bsend\b[^.]*\b(approval|approvers?)\b|^send it\b/i;
const STATUS = /\bwhere is\b|\bstatus\b/i;
const REVIEWS_GOING = /\bhow (are|is) (the )?reviews?\b|\bhow are we doing\b/i;
const ASKED_FOR = /\bwhat did \w+ ask\b/i;

export type RedlineEditMessage = { cite: string; ruleId: string; before: string; after: string };

const EDIT = /\s*I changed the (§\d+\.\d+) redline \((PB-[A-Z]+-\d{2})\) from "([\s\S]*?)" to "([\s\S]*?)"\.(?=\s+I changed the §|\s*$)/y;

/** The edits in a message useTellCopilot posted, or [] when a person typed the text. */
export function parseRedlineEdits(text: string): RedlineEditMessage[] {
  const edits: RedlineEditMessage[] = [];
  EDIT.lastIndex = 0;
  const source = text.trimEnd();
  while (EDIT.lastIndex < source.length) {
    const match = EDIT.exec(source);
    if (!match) return [];
    edits.push({ cite: match[1], ruleId: match[2], before: match[3], after: match[4] });
  }
  return edits;
}

// ---------------------------------------------------------------------------------------------
// Steps 1, 2 and 7: read the matter, propose the plan, run it, show the cards, sum up

type RunResult = { taskId?: string; status?: string; result?: string; risk?: string | null; ruleId?: string; cite?: string; topic?: string; route?: { name: string; ruleId: string; reason: string }[]; next?: string | null; error?: string };

function reviewMatter(c: Conversation, matterId: string): NextStep {
  const read = called(c, "readMatter").at(-1);
  if (!read) return call("readMatter", { matterId });
  const matter = obj(read.result);
  if (typeof matter.error === "string") return reply(`I couldn't open that matter: ${matter.error}`);

  const proposal = called(c, "proposePlan").at(-1);
  const runs = called(c, "runPlanTask").map((r) => obj(r.result) as RunResult);
  const cards = called(c, "showFindings").length > 0;

  if (!proposal && !matter.planApproved) {
    const learned = learnedTaskLine(c);
    return {
      text: `I read the ${matter.title}: ${matter.sections} sections and ${num(matter.words)} words, ${usd(matter.totalContractValue)} over ${matter.initialTermMonths} months. Here is my plan, one task per playbook topic.${learned}`,
      toolCalls: [{ toolName: "proposePlan", input: { matterId } }],
    };
  }

  if (proposal) {
    const answer = obj(proposal.result);
    if (answer.approved !== true) return reply("OK, nothing ran. Ask me again when you're ready.");
  }

  // Run the plan, one task per model call: the first task from the approved plan, then each result's `next`.
  const last = runs.at(-1);
  if (last?.error) return reply(`The plan stopped: ${last.error}`);
  const firstTask = (proposal ? (obj(proposal.result).tasks as { taskId: string }[] | undefined)?.[0]?.taskId : undefined) ?? c.context.activeMatter?.tasks.find((t) => t.status !== "done" && t.status !== "held")?.taskId;
  const next = last ? last.next : firstTask;
  if (!next && runs.length === 0) return reply(alreadyReviewed(c));
  if (next) return { text: "", toolCalls: [{ toolName: "runPlanTask", input: { matterId, taskId: next } }], pauseMs: TASK_PAUSE_MS };

  if (!cards) return { text: "", toolCalls: [{ toolName: "showFindings", input: { matterId } }, { toolName: "showRedlines", input: { matterId } }] };
  return reply(summary(c, matter, runs));
}

/** Three lines, every fact from a tool result: the deviations, the redlines, the route. */
function summary(c: Conversation, matter: Record<string, unknown>, runs: RunResult[]): string {
  const devs = runs.filter((r) => r.result === "deviation");
  const passes = runs.filter((r) => r.result === "pass");
  const requests = runs.filter((r) => r.result === "request");
  const high = devs.filter((r) => r.risk === "high");
  const route = runs.find((r) => r.route)?.route ?? [];
  const named = (rs: RunResult[]) => joinAnd(rs.map((r) => `${lowerFirst(r.topic ?? "")} (${r.cite})`));
  const lines = [
    `${capitalize(word(devs.length))} ${devs.length === 1 ? "deviation" : "deviations"} from the playbook${
      high.length ? `, ${word(high.length)} high risk: ${named(high)}` : devs.length ? `, none high risk: ${named(devs)}` : ""
    }. The other ${word(passes.length)} rules pass, each with its citation.`,
    requests.length
      ? `I drafted a redline for each, and the learned request (${requests.map((r) => r.ruleId).join(", ")}) for the SOC 2 Type II report and pen-test summary goes out with them.`
      : `I drafted a redline for each deviation. Change any of them in the Review table and I'll re-check it.`,
    route.length
      ? `Route: ${route.map((s) => s.name).join(" → ")}${routeWhy(route, matter)}.`
      : "No approvers needed: no deviations, and the value is under the CFO line.",
  ];
  return lines.join("\n\n");
}

function routeWhy(route: { ruleId: string; reason: string }[], matter: Record<string, unknown>): string {
  const cfo = route.find((s) => s.ruleId === "PB-APR-03");
  if (cfo) return ` (${usd(matter.totalContractValue)} is over the ${usd(matter.cfoLine)} line, PB-APR-03)`;
  const security = route.find((s) => s.ruleId === "PB-APR-02");
  return security ? ` (PB-APR-02, for the security evidence)` : "";
}

/** Asked to review a matter whose plan has already run: say where it stands, from the context. */
function alreadyReviewed(c: Conversation): string {
  const active = c.context.activeMatter;
  if (!active) return "That review has already run.";
  const devs = active.findings.filter((f) => f.result === "deviation");
  const where = active.submission ? ` ${status(c)}` : active.needsReason.length ? ` It needs a reason for ${active.needsReason.join(", ")} before it can be sent.` : " It is ready to send for approval.";
  return `The ${active.title} review has already run: ${word(devs.length)} ${devs.length === 1 ? "deviation" : "deviations"}, routed to ${joinAnd(active.route.map((s) => s.name))}.${where}`;
}

/** For a plan that includes a learned rule: say so when proposing it. */
function learnedTaskLine(c: Conversation): string {
  const rules = c.context.learnedRules;
  const match = /^(PB-[A-Z]+-\d{2}) v(\d+)/m.exec(rules);
  if (!match) return "";
  return ` It includes a task from the rule Rachel Adler published: Request the SOC 2 Type II report and pen-test summary (${match[1]} v${match[2]}, learned).`;
}

// ---------------------------------------------------------------------------------------------
// Step 3: the human edit, and the reason

function afterHumanEdit(c: Conversation, edits: RedlineEditMessage[]): NextStep {
  const matterId = c.context.activeMatter?.matterId;
  if (!matterId) return reply("I can't see an open matter for that edit.");
  const rechecks = called(c, "recheckRedline");
  if (rechecks.length === 0) return { text: "", toolCalls: edits.map((e) => ({ toolName: "recheckRedline", input: { matterId, ruleId: e.ruleId } })) };
  if (called(c, "showRecheck").length === 0) {
    return { text: "", toolCalls: edits.map((e) => ({ toolName: "showRecheck", input: { matterId, ruleId: e.ruleId, before: e.before } })) };
  }
  const results = rechecks.map((r) => obj(r.result));
  const still = results.filter((r) => r.needsReason === true);
  // The re-check card already says what changed and that it still deviates: the reply only asks.
  if (still.length === 0) return reply(`${results.map((r) => `Re-checked ${r.cite}: ${lowerFirst(String(r.detail))}.`).join(" ")} No reason needed, and the route is unchanged.`);
  const from = String(still[0].reasonFrom ?? "the General Counsel").replace(/\s*\(.*\)$/, "");
  return reply(`What reason should I give ${from}?`);
}

function giveReason(c: Conversation, ruleId: string, reason: string): NextStep {
  const matterId = c.context.activeMatter!.matterId;
  const set = called(c, "setDeviationReason").at(-1);
  if (!set) return call("setDeviationReason", { matterId, ruleId, reason: reason.trim() });
  const result = obj(set.result);
  if (typeof result.error === "string") return reply(`I couldn't record that: ${result.error}`);
  const gc = c.context.activeMatter?.route.find((s) => s.ruleId === "PB-APR-01")?.name ?? "the General Counsel";
  const userWrote = c.context.activeMatter?.editedByUser.includes(ruleId);
  const still = (result.stillToExplain as string[] | undefined) ?? [];
  return reply(
    [
      `Recorded for ${gc} against ${result.cite} (${ruleId}), in your words.`,
      userWrote ? "I left your redline as you wrote it." : "",
      still.length ? `Still to explain: ${still.join(", ")}.` : `All ${word(Number(result.redlines))} redlines are ready to send for approval when you are.`,
    ]
      .filter(Boolean)
      .join(" "),
  );
}

// ---------------------------------------------------------------------------------------------
// Step 4: the gate. requestApproval shows the card; only the user's click sends.

function send(c: Conversation): NextStep {
  const active = c.context.activeMatter;
  if (!active) return reply("Open a matter first: there is nothing to send.");
  const asked = called(c, "requestApproval").at(-1);
  if (!asked) {
    if (active.status === "pending") return reply(status(c));
    if (!active.planApproved || active.tasks.some((t) => t.status !== "done" && t.status !== "held")) return reply("The review hasn't finished yet, so there is nothing to send. Approve the plan and let it run first.");
    if (active.needsReason.length) return reply(`Before it goes to the approvers I need a reason for ${active.needsReason.join(", ")} (PB-APR-01). Why are we accepting it?`);
    return call("requestApproval", { matterId: active.matterId });
  }
  const outcome = obj(asked.result);
  if (outcome.sent !== true) return reply(/keep editing/i.test(String(outcome.reason)) ? "OK, nothing was sent. The review stays open for editing." : `Nothing was sent: ${outcome.reason}`);
  const to = (outcome.to as string[]) ?? [];
  const vendor = active.title.split(" · ")[0];
  return reply(
    `Sent for approval. ${to[0] ?? "The first approver"} reviews first${to.slice(1).map((name) => `, then ${name}`).join("")}. Nothing goes to ${vendor} until ${to.length === 1 ? "they approve" : `all ${word(to.length)} approve`}.`,
  );
}

// ---------------------------------------------------------------------------------------------
// Step 8 (optional): the collection review table, one fillCollectionCell call per cell

const COLLECTION_ASK = /\bvendor contracts 2026\b/i;
const SECURITY_ASK = /\bsecurity evidence\b|\bPB-SEC-01\b|\bSOC 2\b/i;

type CellResult = {
  vendor?: string;
  vendorShort?: string;
  column?: string;
  answer?: string;
  cite?: string;
  status?: string;
  holdsCustomerData?: boolean;
  /** For the security column: where the evidence stands (lib/collection.ts securityStatus). */
  security?: "not_needed" | "in_contract" | "received" | "requested" | "with_resubmission" | "ask" | "missing";
  receivedAt?: string;
  daysLost?: number | null;
  error?: string;
};

function reviewCollection(c: Conversation, text: string): NextStep {
  const read = called(c, "readCollection").at(-1);
  if (!read) return call("readCollection", { collectionId: COLLECTION_ID });
  const collection = obj(read.result);
  if (typeof collection.error === "string") return reply(`I couldn't open that collection: ${collection.error}`);
  const docs = (collection.documents as { docId: string }[] | undefined) ?? [];
  const security = SECURITY_ASK.test(text);
  const columns = security ? ["securityEvidence"] : ((collection.columns as { column: string }[] | undefined) ?? []).map((col) => col.column);
  const asked = new Set(called(c, "fillCollectionCell").map((f) => `${f.input.docId}:${f.input.column}`));
  // One document per model call: one fillCollectionCell call for each of its cells, so the table fills row by row.
  for (const doc of docs) {
    const todo = columns.filter((column) => !asked.has(`${doc.docId}:${column}`));
    if (todo.length) return { text: "", toolCalls: todo.map((column) => ({ toolName: "fillCollectionCell", input: { collectionId: COLLECTION_ID, docId: doc.docId, column } })), pauseMs: TASK_PAUSE_MS };
  }
  const cells = called(c, "fillCollectionCell").map((f) => ({ ...(obj(f.result) as CellResult), key: String(f.input.column) }));
  const failed = cells.find((r) => r.error);
  if (failed) return reply(`I couldn't fill the table: ${failed.error}`);
  return reply(security ? securityReply(c, cells) : collectionReply(String(collection.name), docs.length, cells));
}

const short = (r: CellResult) => r.vendorShort ?? r.vendor ?? "";
/** The signed vendors whose evidence arrived only after a send-back, in the order it arrived. */
const receivedAfterSendBack = (rows: CellResult[]) => rows.filter((r) => r.security === "received").sort((a, b) => ((a.receivedAt ?? "") < (b.receivedAt ?? "") ? -1 : 1));

/** Where the security evidence stands across the collection, every fact from a fillCollectionCell result. */
function securityReply(c: Conversation, cells: (CellResult & { key: string })[]): string {
  const rows = cells.filter((r) => r.key === "securityEvidence");
  const received = receivedAfterSendBack(rows);
  const missing = rows.filter((r) => r.security === "missing");
  const inReview = rows.filter((r) => r.security === "requested" || r.security === "with_resubmission" || r.security === "ask");
  const noData = rows.filter((r) => r.security === "not_needed");
  const learned = c.context.learnedRules.includes("PB-SEC-01");
  const one = (rs: unknown[]) => rs.length === 1;
  // What PB-SEC-01 does for each contract in review: the request already sent first, then what comes next.
  const ORDER = { requested: 0, ask: 1, with_resubmission: 2 } as const;
  const next = [...inReview]
    .sort((a, b) => ORDER[a.security as keyof typeof ORDER] - ORDER[b.security as keyof typeof ORDER])
    .map((r) => (r.security === "requested" ? `${short(r)}'s request went out with the redlines` : r.security === "with_resubmission" ? `${short(r)}'s goes out with the resubmission` : `${short(r)}'s goes out with its first redlines`));
  return [
    received.length
      ? `${joinAnd(received.map(short))} ${one(received) ? "holds" : "hold"} customer data, and ${one(received) ? "its contract doesn't require" : "none of their contracts requires"} a SOC 2 Type II report or a pen-test summary. ${
          one(received) ? "It" : "Each"
        } sent it only after Security sent the review back: ${totalDaysLost(received)} days lost.`
      : "",
    missing.length ? `${joinAnd(missing.map(short))} ${one(missing) ? "holds" : "hold"} customer data, and Security has no SOC 2 Type II report or pen-test summary on file.` : "",
    inReview.length
      ? learned
        ? `PB-SEC-01 now asks before signing: ${next.length === 2 ? `${next[0]}, and ${next[1]}` : joinAnd(next)}.`
        : `${joinAnd(inReview.map(short))} ${one(inReview) ? "is" : "are"} in review, and nothing in the playbook asks for the evidence yet.`
      : "",
    noData.length ? `${joinAnd(noData.map(short))} ${one(noData) ? "holds" : "hold"} no customer data, so the rule doesn't apply.` : "",
  ]
    .filter(Boolean)
    .join("\n\n");
}

/** A full review of the table: how many cells, and where documents differ from the rest. */
function collectionReply(name: string, docs: number, cells: (CellResult & { key: string })[]): string {
  const caps = cells.filter((r) => r.key === "liabilityCap");
  const counts = new Map<string, number>();
  for (const r of caps) counts.set(r.answer ?? "", (counts.get(r.answer ?? "") ?? 0) + 1);
  const usual = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  const odd = caps.filter((r) => r.answer !== usual);
  const received = receivedAfterSendBack(cells.filter((r) => r.key === "securityEvidence"));
  return [
    `I answered all ${cells.length} cells for the ${word(docs)} contracts in ${name}, each with the passage it comes from.`,
    odd.length ? `Liability: ${joinAnd(odd.map((r) => `${r.vendor} caps it at ${r.answer} (${r.cite})`))}; the rest cap it at ${usual}.` : usual ? `Every contract caps liability at ${usual}.` : "",
    received.length ? `Security evidence: ${joinAnd(received.map(short))} sent it only after a send-back (${totalDaysLost(received)} days lost); no contract requires it.` : "",
  ]
    .filter(Boolean)
    .join("\n\n");
}

// ---------------------------------------------------------------------------------------------
// The document: comments on the redlines, an added clause, a tracked edit. Each opens the document
// beside the thread first (readDocument), so the person watches the change land.

type DocumentAsk = keyof typeof DOCUMENT_ASKS;

const DOCUMENT_PATTERNS: [RegExp, DocumentAsk][] = [
  [/\bcomment on (each|every)\b[^.]*\bredlines?\b/i, "comments"],
  [/\badd a clause\b[^.]*\bSOC 2\b/i, "clause"],
  [/^\s*(please\s+)?edit §2\.3\b/i, "edit"],
];

export const documentAsk = (text: string): DocumentAsk | null => DOCUMENT_PATTERNS.find(([pattern]) => pattern.test(text))?.[1] ?? null;

/** The matter a sentence names, or the one open. */
const matterFor = (c: Conversation, text: string) => MATTER_NAMES.find(([pattern]) => pattern.test(text))?.[1] ?? c.context.activeMatter?.matterId ?? null;

/** The clause Jordan Blake asks for in step 5, in contract language. */
const SECURITY_CLAUSE = {
  section: 5,
  caption: "Security reports",
  text: "Before this Agreement is signed, and once a year after that, Acme will give Northstar its most recent SOC 2 Type II report and a summary of its latest penetration test, including any critical findings and how Acme fixed them.",
};
/** §2.3: service credits stop being Northstar's only remedy when Acme misses its service level. */
const REMEDY_EDIT = { cite: "§2.3", find: "which are Northstar's only remedy for the missed target", replaceWith: "which do not limit Northstar's other rights and remedies" };

type DocChange = { changeId: string; cite: string; kind: string; by: string; ruleId?: string; topic?: string; position?: string; quote?: string };
type DocComment = { commentId: string; cite: string; by: string; quotedText?: { text?: string } };

function workInDocument(c: Conversation, ask: DocumentAsk, matterId: string | null): NextStep {
  if (!matterId) return reply("Open a matter first: there is no document to work in.");
  const read = called(c, "readDocument").at(-1);
  if (!read) return call("readDocument", { matterId });
  const doc = obj(read.result);
  if (typeof doc.error === "string") return reply(`I couldn't open the document: ${doc.error}`);
  if (ask === "comments") return commentOnRedlines(c, matterId, doc);
  if (ask === "clause") return addSecurityClause(c, matterId, doc);
  return suggestRemedyEdit(c, matterId);
}

function commentOnRedlines(c: Conversation, matterId: string, doc: Record<string, unknown>): NextStep {
  const redlines = ((doc.changes as DocChange[] | undefined) ?? []).filter((ch) => ch.ruleId && ch.quote && ch.position);
  if (redlines.length === 0) return reply("There are no redlines in the document yet. Review the contract first, and I'll comment on each one.");
  const made = called(c, "addComment");
  const failed = made.find((m) => obj(m.result).ok === false);
  if (failed) return reply(`I couldn't add a comment: ${obj(failed.result).error}`);
  const mine = [...((doc.comments as DocComment[] | undefined) ?? []).filter((cm) => cm.by === "copilot").map((cm) => cm.quotedText?.text ?? ""), ...made.map((m) => String(m.input.text))];
  const todo = redlines.find((ch) => !mine.some((text) => text.includes(`(${ch.ruleId})`)));
  if (todo) {
    const position = todo.position!.replace(/\.?$/, ".");
    return { text: "", toolCalls: [{ toolName: "addComment", input: { matterId, cite: todo.cite, quote: todo.quote, text: `Northstar's position (${todo.ruleId}): ${position}` } }], pauseMs: TASK_PAUSE_MS };
  }
  if (made.length === 0) return reply("Each redline already has my comment with its rule. Reply to them or resolve them in the margin.");
  return reply(`I left ${word(made.length)} comments in the margin, one on each redline with the playbook rule behind it (${made.map((m) => m.input.cite).join(", ")}). Reply to them or resolve them there.`);
}

function addSecurityClause(c: Conversation, matterId: string, doc: Record<string, unknown>): NextStep {
  const added = called(c, "insertClause").at(-1);
  if (!added) {
    const there = ((doc.passages as { cite: string; text: string; added?: boolean }[] | undefined) ?? []).find((p) => p.added && /SOC 2 Type II report/.test(p.text));
    if (there) return reply(`${there.cite} already asks for the SOC 2 Type II report and pen-test summary. Accept or reject it in the margin.`);
    return call("insertClause", { matterId, ...SECURITY_CLAUSE });
  }
  const result = obj(added.result);
  if (result.ok !== true) return reply(`I couldn't add the clause: ${result.error}`);
  return reply(`Added ${result.cite} ${result.caption} at the end of Section 5, as a tracked insertion in my name. Accept it in the margin to make it yours, or reject it to take it out.`);
}

function suggestRemedyEdit(c: Conversation, matterId: string): NextStep {
  const suggested = called(c, "suggestEdit").at(-1);
  if (!suggested) return call("suggestEdit", { matterId, ...REMEDY_EDIT });
  const result = obj(suggested.result);
  if (result.refused === true) return reply(`You edited ${result.cite} yourself, so I left it as you wrote it. Say so if you want me to change it anyway.`);
  if (result.ok !== true) return reply(`I couldn't change ${REMEDY_EDIT.cite}: ${result.error}`);
  return reply(`Suggested in ${result.cite}, tracked in my name: the service credits no longer stop Northstar claiming anything else when Acme misses its target. Accept or reject it in the margin.`);
}

// ---------------------------------------------------------------------------------------------
// The chips after sending

function status(c: Conversation): string {
  const sub = c.context.activeMatter?.submission;
  if (!sub) return "Nothing has been sent for approval yet.";
  const title = c.context.activeMatter!.title;
  if (sub.status === "pending") {
    const done = sub.decisions.filter((d) => d.decision === "approved").map((d) => d.approver);
    return `The ${title} is with ${sub.waitingFor}${done.length ? `; ${joinAnd(done)} approved` : ""}. You'll see each decision in the Approvals tab.`;
  }
  const last = sub.decisions.at(-1);
  if (sub.status === "sent_back" && last) return `${last.approver} sent the ${title} back: "${last.quotedText.comment}"`;
  return `The ${title} is ${sub.status.replace("_", " ")}.`;
}

/** "How are reviews going?": the Analytics page in three lines, every number from the context. */
function howReviewsAreGoing(c: Conversation): string {
  const a = c.context.analytics;
  if (!a) return "I can't see the review figures right now.";
  const b = a.before;
  const s = a.since;
  const security = a.reasons.find((r) => r.key === "security_evidence");
  const lines = [
    `Before go-live: ${b.reviews} reviews, ${b.firstPass} of ${b.reviews} approved first time, a median of ${b.medianCycleDays ?? "no"} days from submission to signature, and ${b.daysLost} days lost to send-backs${
      security ? `; missing security evidence was the reason ${word(security.before)} times` : ""
    }.`,
    s.reviews
      ? `Since go-live: ${s.reviews} ${s.reviews === 1 ? "review" : "reviews"}, ${s.tasksRun} tasks run, ${s.redlinesDrafted} redlines drafted, ${s.humanEdits} ${s.humanEdits === 1 ? "human edit" : "human edits"}, ${s.approvalsRequested} sent for approval${
          s.sentBack ? ` and ${s.sentBack} sent back` : ""
        }, ${s.rulesPublished} ${s.rulesPublished === 1 ? "rule" : "rules"} published.`
      : "Since go-live: nothing reviewed yet.",
    a.next.length ? `Next: ${a.next[0]}` : "Nothing is waiting.",
  ];
  return lines.join("\n\n");
}

function whatTheyAsked(c: Conversation): string {
  const back = c.context.activeMatter?.submission?.decisions.filter((d) => d.decision === "sent_back").at(-1);
  if (!back) return "Nobody has sent anything back yet.";
  return `${back.approver} asked: "${back.quotedText.comment}" The playbook has no rule for that. Insights matched it to earlier send-backs in the imported history and proposes a rule for Rachel Adler to review.`;
}

function offScript(): string {
  return `I'm the scripted demo model (no API key is set), so I only follow the workshop script. Try: ${DEMO_SENTENCES.map((s) => `"${s}"`).join(", ")}. Edit a redline in the Review table and I'll re-check it. In the document: ${Object.values(DOCUMENT_ASKS).map((s) => `"${s}"`).join(", ")}. Set OPENAI_API_KEY in .env.local for a real model.`;
}

// ---------------------------------------------------------------------------------------------

const reply = (text: string): NextStep => ({ text, toolCalls: [] });
const call = (toolName: string, input: Record<string, unknown>): NextStep => ({ text: "", toolCalls: [{ toolName, input }] });

const usd = (value: unknown) => (typeof value === "number" ? `$${value.toLocaleString("en-US")}` : String(value));
const num = (value: unknown) => (typeof value === "number" ? value.toLocaleString("en-US") : String(value));
const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);
const lowerFirst = (text: string) => (/^[A-Z][a-z]/.test(text) && !/^(Northstar|PB-)/.test(text) ? text.charAt(0).toLowerCase() + text.slice(1) : text);
const joinAnd = (items: string[]) => (items.length <= 1 ? (items[0] ?? "") : `${items.slice(0, -1).join(", ")} and ${items.at(-1)}`);
const WORDS = ["no", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve"];
const word = (n: number) => WORDS[n] ?? String(n);

