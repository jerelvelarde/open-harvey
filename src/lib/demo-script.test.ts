// The scripted mock plays the README demo. These tests play it too: each model call goes to
// nextStep(), each tool call runs the real handlers (lib/agent-tools.ts) and the real gate functions
// (lib/gates.ts) against the real store, and the system prompt is rebuilt from the store before every
// call with lib/app-context.ts, the way useAgentContext sends it. If a test here fails, the mock would
// say or do the wrong thing on stage.

import type { LanguageModelV3Message, LanguageModelV3Prompt } from "@ai-sdk/provider";
import { beforeEach, describe, expect, it } from "vitest";
import type { z } from "zod";
import { chipsFor } from "@/copilot/chips";
import { describeEdit } from "@/copilot/edit-queue";
import { agentInstructions } from "./agent-instructions";
import { toolHandlers, toolSchemas, uiToolSchemas } from "./agent-tools";
import { appContext } from "./app-context";
import { COLLECTION_DOC_IDS, COLLECTION_ID } from "./collection";
import { COLLECTION_SENTENCE, DEMO_SENTENCES, DOCUMENT_ASKS, REVIEWS_GOING_SENTENCE, TASK_PAUSE_MS, documentAsk, nextStep, parseReviewRequest, type NextStep } from "./demo-script";
import { answerPlan, answerSend } from "./gates";
import { groupSendBacks, proposeRules, sendBacksFrom, totalDaysLost } from "./learning";
import { appStore, closeMatter, documentView, humanEditSpan, humanRedline, matterCounts, matterView, openMatter, pendingProposals, publishRule, recordDecision, resetStoreForTests, sessionSendBacks } from "./store";
import { history, loadTestLibrary, playbookText } from "./testing";

// Strict, so a stray argument fails too.
const SCHEMAS: Record<string, z.ZodTypeAny> = Object.fromEntries(
  Object.entries({ ...toolSchemas, ...uiToolSchemas }).map(([name, schema]) => [name, (schema as z.AnyZodObject).strict()]),
);
const CARDS = new Set(["showFindings", "showRedlines", "showRecheck"]);
const GATES = new Set(["proposePlan", "requestApproval"]);

// ---------------------------------------------------------------------------------------------
// A small stand-in for the browser: the store, the tool handlers, the gates and the app context

type Pending = { name: string; id: string; matterId: string };
type Session = { messages: LanguageModelV3Message[]; steps: NextStep[]; replies: string[]; nextId: number; pending: Pending | null };

const newSession = (): Session => ({ messages: [], steps: [], replies: [], nextId: 1, pending: null });

beforeEach(() => {
  resetStoreForTests();
  loadTestLibrary();
});

const ACME = "acme-msa";
const BRIGHTWATER = "brightwater-order-form";
/** Maya's §8.2 redline after her edit in step 3: 6 months of fees, with a $1,000,000 cap for data-protection breaches. */
const SIX =
  "Each party's total liability arising out of or relating to this Agreement will not exceed the fees paid by Northstar in the six (6) months before the event giving rise to the claim, except that liability for data-protection breaches is capped at $1,000,000.";
const TWELVE = "Each party's total liability arising out of or relating to this Agreement will not exceed the fees paid by Northstar in the twelve (12) months before the event giving rise to the claim.";
const JORDAN = "Ask Acme for their SOC 2 Type II report and latest pen-test summary before we sign. We need this whenever a vendor holds customer data.";

/** The system prompt as BuiltInAgent builds it: instructions, then "<description>:\n<value>\n" per context entry. */
function systemPrompt(): string {
  const entries = Object.values(appContext(appStore.getState(), history)).map(({ description, value }) => `${description}:\n${typeof value === "string" ? value : JSON.stringify(value)}\n`);
  return `${agentInstructions(playbookText)}\n## Context from the application\n${entries.join("")}`;
}

function toolResult(session: Session, id: string, name: string, result: unknown) {
  const value = result === undefined ? "" : JSON.stringify(result);
  session.messages.push({ role: "tool", content: [{ type: "tool-result", toolCallId: id, toolName: name, output: { type: "text", value } }] });
}

/** Call the model, run its tools, repeat until it replies or a gate waits for a click. */
function play(session: Session): NextStep[] {
  const steps: NextStep[] = [];
  for (let i = 0; i < 60; i++) {
    const prompt: LanguageModelV3Prompt = [{ role: "system", content: systemPrompt() }, ...session.messages];
    const step = nextStep(prompt);
    steps.push(step);
    session.steps.push(step);
    const ids = step.toolCalls.map(() => `call_${session.nextId++}`);
    session.messages.push({
      role: "assistant",
      content: [
        ...(step.text ? [{ type: "text" as const, text: step.text }] : []),
        ...step.toolCalls.map((c, j) => ({ type: "tool-call" as const, toolCallId: ids[j], toolName: c.toolName, input: c.input })),
      ],
    });
    if (step.text) session.replies.push(step.text);
    if (step.toolCalls.length === 0) return steps;
    for (const [j, call] of step.toolCalls.entries()) {
      SCHEMAS[call.toolName].parse(call.input); // schema-valid arguments, or the test fails here
      if (GATES.has(call.toolName)) {
        session.pending = { name: call.toolName, id: ids[j], matterId: String(call.input.matterId) };
        return steps; // the card is waiting for the person
      }
      const result = CARDS.has(call.toolName) ? undefined : (toolHandlers[call.toolName as keyof typeof toolHandlers] as (a: never) => unknown)(call.input as never);
      toolResult(session, ids[j], call.toolName, result);
    }
  }
  throw new Error("The turn did not end");
}

function say(session: Session, text: string): NextStep[] {
  session.messages.push({ role: "user", content: [{ type: "text", text }] });
  return play(session);
}

/** The person clicks a button on the waiting card; the turn carries on. */
function click(session: Session, button: "approve" | "not yet" | "send" | "keep editing"): NextStep[] {
  const pending = session.pending;
  if (!pending) throw new Error("No card is waiting");
  session.pending = null;
  const result = pending.name === "proposePlan" ? answerPlan(pending.matterId, button as "approve" | "not yet") : answerSend(pending.matterId, button as "send" | "keep editing");
  toolResult(session, pending.id, pending.name, result);
  return play(session);
}

const names = (steps: NextStep[]) => steps.flatMap((s) => s.toolCalls.map((c) => c.toolName));
const inputs = (steps: NextStep[], tool: string) => steps.flatMap((s) => s.toolCalls).filter((c) => c.toolName === tool).map((c) => c.input);
const lastReply = (steps: NextStep[]) => steps.at(-1)!.text;
const view = (id = ACME) => matterView(appStore.getState(), id);
const chips = () => chipsFor(appStore.getState());

// The demo, one README step at a time
function step1(s: Session) {
  return say(s, DEMO_SENTENCES[0]);
}
function step2(s: Session) {
  return click(s, "approve");
}
function step3(s: Session) {
  const edit = humanRedline(ACME, "PB-LIAB-01", SIX)!;
  return say(s, describeEdit(edit));
}
function step3Reason(s: Session) {
  return say(s, DEMO_SENTENCES[1]);
}
function step4(s: Session) {
  return say(s, DEMO_SENTENCES[2]);
}
function step5() {
  recordDecision(ACME, "approved", "");
  recordDecision(ACME, "sent_back", JORDAN);
}
function step6() {
  const [rule] = proposeRules(groupSendBacks([...sendBacksFrom(history), ...sessionSendBacks(appStore.getState())]));
  publishRule(rule);
  return rule;
}
function throughStep4(s: Session) {
  step1(s);
  step2(s);
  step3(s);
  step3Reason(s);
  step4(s);
  return click(s, "send");
}

// ---------------------------------------------------------------------------------------------

describe("0. the opening", () => {
  it("offers the opening line, and the mock understands it", () => {
    expect(chips()).toEqual([DEMO_SENTENCES[0], DOCUMENT_ASKS.edit, REVIEWS_GOING_SENTENCE]);
    expect(parseReviewRequest(DEMO_SENTENCES[0])).toBe(ACME);
  });
});

describe("1. the ask: the plan, and the gate that holds it", () => {
  it("reads the matter, proposes the 17-task plan, and runs nothing before the click", () => {
    const s = newSession();
    const steps = step1(s);
    expect(names(steps)).toEqual(["readMatter", "proposePlan"]);
    expect(s.pending).toMatchObject({ name: "proposePlan", matterId: ACME });
    expect(lastReply(steps)).toBe(
      "I read the Acme Cloud · Master Services Agreement: 14 sections and 1,801 words, $720,000 over 36 months. Here is my plan, one task per playbook topic.",
    );
    expect(appStore.getState().activeMatterId).toBe(ACME);
    expect(view().planApproved).toBe(false);
    expect(view().plan).toHaveLength(17);
    expect(view().plan.every((t) => t.status === "proposed")).toBe(true);
  });

  it("Not yet: nothing runs, and the copilot waits", () => {
    const s = newSession();
    step1(s);
    const steps = click(s, "not yet");
    expect(names(steps)).toEqual([]);
    expect(lastReply(steps)).toBe("OK, nothing ran. Ask me again when you're ready.");
    expect(view().doneCount).toBe(0);
    expect(chips()).toEqual([DEMO_SENTENCES[0], DOCUMENT_ASKS.clause, DOCUMENT_ASKS.edit, REVIEWS_GOING_SENTENCE]);
  });
});

describe("2. the run", () => {
  it("ticks 16 tasks in order, one call each, paced, holds task 17 for the approvers, then shows the cards and sums up in three lines", () => {
    const s = newSession();
    step1(s);
    const steps = step2(s);
    const runs = inputs(steps, "runPlanTask");
    expect(runs.map((r) => r.taskId)).toEqual(view().plan.slice(0, 16).map((t) => t.id));
    expect(runs).toHaveLength(16);
    expect(steps.filter((st) => st.toolCalls[0]?.toolName === "runPlanTask").every((st) => st.pauseMs === TASK_PAUSE_MS)).toBe(true);
    expect(names(steps).slice(-2)).toEqual(["showFindings", "showRedlines"]);
    expect(view().doneCount).toBe(16);
    expect(view().plan.at(-1)).toMatchObject({ id: "packet", status: "held" });
    expect(view().plan.filter((t) => t.outcome?.status === "attention")).toHaveLength(7);
    expect(Object.keys(view().redlines)).toHaveLength(7);

    const text = lastReply(steps);
    expect(text.split("\n\n")).toEqual([
      "Seven deviations from the playbook, three high risk: limitation of liability (§8.2), data protection and DPA (§6.1) and security incident notice (§6.4). The other five rules pass, each with its citation.",
      "I drafted a redline for each deviation. Change any of them in the Review table and I'll re-check it.",
      "Route: Rachel Adler → Jordan Blake → Elena Ortiz ($720,000 is over the $500,000 line, PB-APR-03).",
    ]);
    // The chat's words and every screen's counts come from the same place
    expect(matterCounts(view())).toMatchObject({ checks: 12, pass: 5, deviations: 7, high: 3, toVendor: 7 });
    expect(chips()).toEqual([DEMO_SENTENCES[2], DOCUMENT_ASKS.comments, DOCUMENT_ASKS.clause, DOCUMENT_ASKS.edit]);
  });
});

describe("3. the human edit", () => {
  it("re-checks without being asked, shows the re-check card, keeps Maya's value, and asks for a reason", () => {
    const s = newSession();
    step1(s);
    step2(s);
    const steps = step3(s);
    expect(names(steps)).toEqual(["recheckRedline", "showRecheck"]);
    expect(inputs(steps, "showRecheck")[0]).toEqual({ matterId: ACME, ruleId: "PB-LIAB-01", before: TWELVE });
    // The re-check card says what changed and that it still deviates; the reply only asks.
    expect(lastReply(steps)).toBe("What reason should I give Rachel Adler?");
    expect(toolHandlers.recheckRedline({ matterId: ACME, ruleId: "PB-LIAB-01" })).toMatchObject({
      meetsPlaybook: false,
      detail: "Cap at 6 months of fees, with a $1,000,000 cap for data-protection breaches; PB-LIAB-01 asks for at least 12 months",
      reasonFrom: "Rachel Adler (General Counsel)",
    });
    expect(view().redlines["PB-LIAB-01"]).toBe(SIX);
    expect(view().status).toBe("needs_reason");
    expect(chips()).toEqual([DEMO_SENTENCES[1], DOCUMENT_ASKS.comments, DOCUMENT_ASKS.clause, DOCUMENT_ASKS.edit]); // the demo script's reason, ready to send
  });

  it("records the reason in Maya's words and leaves her redline alone", () => {
    const s = newSession();
    [step1, step2, step3].forEach((run) => run(s));
    const steps = step3Reason(s);
    expect(inputs(steps, "setDeviationReason")).toEqual([{ matterId: ACME, ruleId: "PB-LIAB-01", reason: DEMO_SENTENCES[1] }]);
    expect(lastReply(steps)).toBe(
      "Recorded for Rachel Adler against §8.2 (PB-LIAB-01), in your words. I left your redline as you wrote it. All seven redlines are ready to send for approval when you are.",
    );
    expect(view().redlines["PB-LIAB-01"]).toBe(SIX);
    expect(view().status).toBe("ready");
    expect(chips()).toEqual([DEMO_SENTENCES[2], DOCUMENT_ASKS.comments, DOCUMENT_ASKS.clause, DOCUMENT_ASKS.edit]);
  });

  it("asks for the reason instead of opening the send card while one is missing", () => {
    const s = newSession();
    [step1, step2, step3].forEach((run) => run(s));
    const steps = step4(s);
    expect(names(steps)).toEqual([]);
    expect(lastReply(steps)).toContain("I need a reason for PB-LIAB-01");
  });
});

describe("4. the gate", () => {
  it("opens the send card, sends nothing until the click, then names the route", () => {
    const s = newSession();
    [step1, step2, step3, step3Reason].forEach((run) => run(s));
    const steps = step4(s);
    expect(names(steps)).toEqual(["requestApproval"]);
    expect(s.pending?.name).toBe("requestApproval");
    expect(view().state?.submission).toBeNull();

    const after = click(s, "send");
    expect(lastReply(after)).toBe(
      "Sent for approval. Rachel Adler (General Counsel) reviews first, then Jordan Blake (Head of Security), then Elena Ortiz (Chief Financial Officer). Nothing goes to Acme Cloud until all three approve.",
    );
    expect(view().status).toBe("pending");
    expect(view().state?.submission?.reasons).toEqual({ "PB-LIAB-01": DEMO_SENTENCES[1] });
    expect(chips()).toEqual(["Where is the Acme Cloud review?", DOCUMENT_ASKS.comments, DOCUMENT_ASKS.clause, DOCUMENT_ASKS.edit]);
  });

  it("Keep editing sends nothing", () => {
    const s = newSession();
    [step1, step2, step3, step3Reason, step4].forEach((run) => run(s));
    const after = click(s, "keep editing");
    expect(lastReply(after)).toBe("OK, nothing was sent. The review stays open for editing.");
    expect(view().state?.submission).toBeNull();
  });
});

describe("5 and 6. approvals, then learning", () => {
  it("Rachel approves, Jordan sends back, and the copilot answers the chips from the record", () => {
    const s = newSession();
    throughStep4(s);
    recordDecision(ACME, "approved", "");
    expect(lastReply(say(s, "Where is the Acme Cloud review?"))).toBe(
      "The Acme Cloud · Master Services Agreement is with Jordan Blake; Rachel Adler approved. You'll see each decision in the Approvals tab.",
    );
    recordDecision(ACME, "sent_back", JORDAN);
    expect(chips()).toEqual(["What did Jordan ask for?", DOCUMENT_ASKS.clause, DOCUMENT_ASKS.comments, DOCUMENT_ASKS.edit]); // the clause Jordan asked for comes next
    expect(lastReply(say(s, "What did Jordan ask for?"))).toContain(`Jordan Blake asked: "${JORDAN}"`);
  });

  it("proposes PB-SEC-01 from three past send-backs plus today's, and publishing it offers the next contract", () => {
    const s = newSession();
    throughStep4(s);
    step5();
    const rule = step6();
    expect(rule.id).toBe("PB-SEC-01");
    expect(rule.evidence.map((e) => e.vendor)).toEqual(["Lumen Ridge Analytics", "Cobalt Harbor Logging", "Fernway Data", "Acme Cloud"]);
    expect(chips()).toEqual([DEMO_SENTENCES[3], "What did Jordan ask for?", DOCUMENT_ASKS.clause, COLLECTION_SENTENCE]); // the next contract first
    expect(pendingProposals(appStore.getState(), history)).toBe(0); // published: nothing left to review
  });

  it("the Insights badge stays dark until today's send-back joins the evidence", () => {
    const s = newSession();
    throughStep4(s);
    expect(pendingProposals(appStore.getState(), history)).toBe(0);
    recordDecision(ACME, "approved", "");
    expect(pendingProposals(appStore.getState(), history)).toBe(0);
    recordDecision(ACME, "sent_back", JORDAN);
    expect(pendingProposals(appStore.getState(), history)).toBe(1);
  });
});

describe("Analytics: how reviews are going", () => {
  it("answers from the app context, every number from lib/analytics.ts", () => {
    const s = newSession();
    expect(lastReply(say(s, "How are reviews going?")).split("\n\n")).toEqual([
      "Before go-live: 6 reviews, 2 of 6 approved first time, a median of 10.5 days from submission to signature, and 29 days lost to send-backs; missing security evidence was the reason three times.",
      "Since go-live: nothing reviewed yet.",
      "Next: Review Acme Cloud: its pricing holds until Nov 13.",
    ]);
    throughStep4(s);
    step5();
    step6();
    expect(lastReply(say(s, "How are reviews going?")).split("\n\n").slice(1)).toEqual([
      "Since go-live: 1 review, 16 tasks run, 7 redlines drafted, 1 human edit, 1 sent for approval and 1 sent back, 1 rule published.",
      "Next: Resubmit Acme Cloud to Jordan Blake with the SOC 2 Type II report and pen-test summary request (PB-SEC-01).",
    ]);
  });
});

describe("7. the next contract", () => {
  it("plans Brightwater with the learned task nobody asked for, runs it, and the request lands in the review table", () => {
    const s = newSession();
    throughStep4(s);
    step5();
    step6();
    const proposed = say(s, DEMO_SENTENCES[3]);
    expect(names(proposed)).toEqual(["readMatter", "proposePlan"]);
    expect(lastReply(proposed)).toContain("It includes a task from the rule Rachel Adler published: Request the SOC 2 Type II report and pen-test summary (PB-SEC-01 v1, learned).");
    expect(view(BRIGHTWATER).plan).toHaveLength(18);
    expect(view(BRIGHTWATER).plan[8]).toMatchObject({ id: "learned-PB-SEC-01", title: "Request the SOC 2 Type II report and pen-test summary" });

    const run = click(s, "approve");
    expect(inputs(run, "runPlanTask").map((r) => r.taskId)).toContain("learned-PB-SEC-01");
    expect(view(BRIGHTWATER).doneCount).toBe(17);
    expect(view(BRIGHTWATER).plan.at(-1)).toMatchObject({ title: "Send the redline package to Brightwater (only after every approval)", status: "held" });
    expect(view(BRIGHTWATER).found.find((f) => f.ruleId === "PB-SEC-01")).toMatchObject({ status: "request", cite: "§4.3", learned: { id: "PB-SEC-01", version: 1 } });
    expect(lastReply(run).split("\n\n")).toEqual([
      "Two deviations from the playbook, none high risk: fees, payment terms and price increases (§3.2) and termination rights (§7.1). The other ten rules pass, each with its citation.",
      "I drafted a redline for each, and the learned request (PB-SEC-01) for the SOC 2 Type II report and pen-test summary goes out with them.",
      "Route: Rachel Adler → Jordan Blake (PB-APR-02, for the security evidence).",
    ]);
    // One count for the tab (3 to the vendor), the table (10 pass), the seal key and the chat ("the other ten rules pass")
    expect(matterCounts(view(BRIGHTWATER))).toEqual({ checks: 13, checked: 13, pass: 10, deviations: 2, high: 0, learned: 1, toVendor: 3, context: 2 });
    // Acme's review reads as it was reviewed: the rule published later does not change it.
    expect(view(ACME).plan).toHaveLength(17);
    expect(chips()).toEqual([DEMO_SENTENCES[2]]);
  });
});

describe("the chips and the script", () => {
  it("the mock understands every chip it is offered, at every step", () => {
    const s = newSession();
    const seen = new Set<string>();
    const check = () => {
      for (const chip of chips()) {
        seen.add(chip);
        const prompt: LanguageModelV3Prompt = [{ role: "system", content: systemPrompt() }, { role: "user", content: [{ type: "text", text: chip }] }];
        expect(nextStep(prompt).text, chip).not.toContain("scripted demo model");
      }
    };
    check();
    step1(s);
    step2(s);
    check();
    step3(s);
    check();
    step3Reason(s);
    check();
    step4(s);
    click(s, "send");
    check();
    step5();
    check();
    step6();
    check();
    expect(seen.size).toBeGreaterThanOrEqual(5); // opening, send, where is it, what did Jordan ask, Brightwater
  });

  it("anything else gets the list of sentences", () => {
    const prompt: LanguageModelV3Prompt = [{ role: "system", content: systemPrompt() }, { role: "user", content: [{ type: "text", text: "Write me a poem." }] }];
    expect(nextStep(prompt).text).toContain('"Review the Acme Cloud MSA and get it ready to sign."');
  });
});

describe("8. (optional) the collection: whether Security has the evidence", () => {
  it("opens the collection, fills the security column one call per cell, and says where the evidence stands, as the history has it", () => {
    const s = newSession();
    throughStep4(s);
    step5();
    step6();
    say(s, DEMO_SENTENCES[3]); // step 7: Brightwater, with the learned request
    click(s, "approve");
    closeMatter();
    toolHandlers.readCollection({ collectionId: COLLECTION_ID }); // Ask in a thread, or Start on the Agents page
    expect(chips()).toEqual([COLLECTION_SENTENCE, REVIEWS_GOING_SENTENCE]);
    const steps = say(s, COLLECTION_SENTENCE);
    expect(names(steps).filter((n) => n !== "fillCollectionCell")).toEqual(["readCollection"]);
    // One call per cell, one cell per document, every document in the collection.
    expect(steps.filter((st) => st.toolCalls.some((c) => c.toolName === "fillCollectionCell")).every((st) => st.toolCalls.length === 1)).toBe(true);
    expect(inputs(steps, "fillCollectionCell")).toEqual(COLLECTION_DOC_IDS.map((docId) => ({ collectionId: COLLECTION_ID, docId, column: "securityEvidence" })));
    expect(lastReply(steps).split("\n\n")).toEqual([
      "Lumen Ridge, Cobalt Harbor and Fernway hold customer data, and none of their contracts requires a SOC 2 Type II report or a pen-test summary. Each sent it only after Security sent the review back: 22 days lost.",
      "PB-SEC-01 now asks before signing: Brightwater's request went out with the redlines, and Acme's goes out with the resubmission.",
      "Kestrel, Orchard Lane and Halden hold no customer data, so the rule doesn't apply.",
    ]);
    // The 22 is Insights' own sum over the same send-backs, not a number of the script's.
    const security = groupSendBacks(sendBacksFrom(history)).find((g) => g.key === "security_evidence")!;
    expect(lastReply(steps)).toContain(`${totalDaysLost(security.sendBacks)} days lost`);
    expect(appStore.getState().collectionCells).toHaveLength(8);
    expect(chips()).toEqual([REVIEWS_GOING_SENTENCE]);
  });

  it("a full review fills all 48 cells, a row per model call, one tool call per cell", () => {
    const s = newSession();
    const steps = say(s, "Review every contract in Vendor contracts 2026.");
    expect(inputs(steps, "fillCollectionCell")).toHaveLength(48);
    expect(steps.filter((st) => st.toolCalls[0]?.toolName === "fillCollectionCell").every((st) => st.toolCalls.length === 6)).toBe(true);
    expect(lastReply(steps).split("\n\n")).toEqual([
      "I answered all 48 cells for the eight contracts in Vendor contracts 2026, each with the passage it comes from.",
      "Liability: Acme Cloud caps it at 3 months of fees (§8.2); the rest cap it at 12 months of fees.",
      "Security evidence: Lumen Ridge, Cobalt Harbor and Fernway sent it only after a send-back (22 days lost); no contract requires it.",
    ]);
  });

  it("an agent's Start leaves its opening line ready in the new thread", () => {
    expect(chipsFor(appStore.getState(), REVIEWS_GOING_SENTENCE)).toEqual([REVIEWS_GOING_SENTENCE, DEMO_SENTENCES[0], DOCUMENT_ASKS.edit]); // its line first, then the rest
    expect(lastReply(say(newSession(), REVIEWS_GOING_SENTENCE))).toContain("Before go-live: 6 reviews");
  });
});

// ---------------------------------------------------------------------------------------------

describe("the document", () => {
  const doc = () => documentView(appStore.getState(), ACME);

  it("understands every document ask, and nothing else as one", () => {
    expect(Object.values(DOCUMENT_ASKS).map(documentAsk)).toEqual(["comments", "clause", "edit"]);
    expect([...DEMO_SENTENCES, COLLECTION_SENTENCE, REVIEWS_GOING_SENTENCE].map(documentAsk).every((a) => a === null)).toBe(true);
  });

  it("opens the document, then comments on each redline with its rule, one paced call each, in document order", () => {
    const s = newSession();
    step1(s);
    step2(s);
    const steps = say(s, DOCUMENT_ASKS.comments);
    expect(names(steps)[0]).toBe("readDocument");
    expect(inputs(steps, "addComment").map((c) => c.cite)).toEqual(["§3.3", "§4.2", "§6.1", "§6.4", "§7.3", "§8.2", "§11.2"]);
    expect(steps.filter((st) => st.toolCalls[0]?.toolName === "addComment").every((st) => st.pauseMs === TASK_PAUSE_MS)).toBe(true);
    expect(doc().comments).toHaveLength(7);
    expect(doc().comments.every((c) => c.by === "agent" && c.on !== null)).toBe(true); // each on the vendor's own words
    expect(doc().comments.find((c) => c.cite === "§8.2")!.text).toBe("Northstar's position (PB-LIAB-01): Cap at fees paid or payable in the 12 months before the claim.");
    expect(lastReply(steps)).toBe(
      "I left seven comments in the margin, one on each redline with the playbook rule behind it (§3.3, §4.2, §6.1, §6.4, §7.3, §8.2, §11.2). Reply to them or resolve them there.",
    );
    const again = say(s, DOCUMENT_ASKS.comments);
    expect(inputs(again, "addComment")).toEqual([]);
    expect(lastReply(again)).toBe("Each redline already has my comment with its rule. Reply to them or resolve them in the margin.");
  });

  it("asks for the review first when there are no redlines to comment on", () => {
    const s = newSession();
    expect(lastReply(say(s, DOCUMENT_ASKS.comments))).toBe("There are no redlines in the document yet. Review the contract first, and I'll comment on each one.");
    expect(appStore.getState().activeMatterId).toBe(ACME); // readDocument opened it
  });

  it("adds the SOC 2 clause Jordan asks for as §5.4, a tracked insertion in its name, once", () => {
    const s = newSession();
    const steps = say(s, DOCUMENT_ASKS.clause);
    expect(names(steps)).toEqual(["readDocument", "insertClause"]);
    expect(doc().changes.find((c) => c.id === "insert:§5.4")).toMatchObject({ kind: "insert", by: "agent" });
    expect(lastReply(steps)).toBe("Added §5.4 Security reports at the end of Section 5, as a tracked insertion in my name. Accept it in the margin to make it yours, or reject it to take it out.");
    const again = say(s, DOCUMENT_ASKS.clause);
    expect(names(again)).toEqual(["readDocument"]);
    expect(lastReply(again)).toBe("§5.4 already asks for the SOC 2 Type II report and pen-test summary. Accept or reject it in the margin.");
  });

  it("suggests the §2.3 edit as a tracked change, and leaves text Maya wrote alone", () => {
    const s = newSession();
    const steps = say(s, DOCUMENT_ASKS.edit);
    expect(names(steps)).toEqual(["readDocument", "suggestEdit"]);
    expect(doc().changes.find((c) => c.id === "§2.3:0")).toMatchObject({ kind: "edit", by: "agent" });
    expect(lastReply(steps)).toContain("Suggested in §2.3, tracked in my name");

    const maya = newSession();
    resetStoreForTests();
    openMatter(ACME);
    const p23 = doc().sections[1].passages.find((p) => p.cite === "§2.3")!.spans[0];
    humanEditSpan(ACME, p23.key, p23.base.replace("which are Northstar's only remedy for the missed target", "which are one remedy among several"));
    expect(lastReply(say(maya, DOCUMENT_ASKS.edit))).toContain("I couldn't change §2.3");
  });
});
