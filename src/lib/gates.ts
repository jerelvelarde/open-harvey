// What a person's click on a gate card does, as plain functions: the plan card's Approve plan / Not
// yet (copilot/useProposePlan.tsx) and the send card's Send for approval / Keep editing
// (copilot/useRequestApproval.tsx). The cards call these, and demo-script.test.ts calls the same
// ones, so "only a click approves or sends" is tested, not just drawn.

import { approvePlan, sendForApproval, type SendResult } from "./store";

export type PlanAnswer =
  | { approved: true; matterId: string; tasks: { taskId: string; title: string; ruleIds: string[] }[] }
  | { approved: false; matterId: string; reason: string };

export function answerPlan(matterId: string, click: "approve" | "not yet"): PlanAnswer {
  if (click === "not yet") return { approved: false, matterId, reason: "The user said not yet. Nothing ran." };
  const plan = approvePlan(matterId);
  return { approved: true, matterId, tasks: plan.map((t) => ({ taskId: t.id, title: t.title, ruleIds: t.ruleIds })) };
}

export type SendAnswer = SendResult;

export function answerSend(matterId: string, click: "send" | "keep editing"): SendAnswer {
  if (click === "keep editing") return { sent: false, reason: "The user wants to keep editing." };
  return sendForApproval(matterId, "copilot");
}
