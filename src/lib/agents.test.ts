// The Agents page lists only what runs: every tool an agent names is a tool the agent is given.

import { describe, expect, it } from "vitest";
import { toolSchemas, uiToolSchemas } from "./agent-tools";
import { AGENTS, agentToday } from "./agents";
import { initialAppState } from "./store";
import { history } from "./testing";

describe("the agents", () => {
  it("name only tools the agent is given", () => {
    const given = new Set([...Object.keys(toolSchemas), ...Object.keys(uiToolSchemas)]);
    for (const agent of AGENTS) for (const tool of agent.tools) expect(given, `${agent.name}: ${tool}`).toContain(tool);
  });

  it("between them, use every tool", () => {
    const used = new Set(AGENTS.flatMap((a) => a.tools));
    expect([...Object.keys(toolSchemas), ...Object.keys(uiToolSchemas)].filter((t) => !used.has(t))).toEqual([]);
  });

  it("count today from the store", () => {
    expect(AGENTS.map((a) => agentToday(a.id, initialAppState, history))).toEqual(["Today: nothing run yet", "Today: nothing drafted yet", "Today: nothing asked yet", "Today: no send-backs yet; 4 imported send-backs read"]);
  });
});
