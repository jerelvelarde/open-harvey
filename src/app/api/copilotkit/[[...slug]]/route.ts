// Concept: connect the app and the agent with CopilotKit and AG-UI.
//
// One CopilotRuntime serving one BuiltInAgent. The browser talks to it over AG-UI (the runtime
// streams AG-UI events back); the frontend tools, context and generative UI registered in
// src/copilot/ travel with each run, so the agent needs no backend tools of its own.
// The catch-all route serves every runtime path (/info, /agent/default/run, ...).
//
// No auth: anyone who can reach this endpoint can run the agent on your model key. `npm run dev`
// and `npm start` bind to 127.0.0.1 for that reason. Put it behind your app's auth before deploying.
//
// CopilotKit Intelligence is optional and off by default (lib/intelligence.ts): with it off, the
// runtime below is exactly `{ agents: { default: agent } }`.

import { BuiltInAgent, CopilotRuntime, createCopilotRuntimeHandler } from "@copilotkit/runtime/v2";
import { agentInstructions } from "@/lib/agent-instructions";
import { checkIntelligence, intelligenceSettings, runtimeOptions } from "@/lib/intelligence";
import { agentModel, readPlaybook } from "@/lib/server-data";

const agent = new BuiltInAgent({
  // openai/gpt-5.4-mini unless COPILOT_MODEL is set (reads OPENAI_API_KEY from the environment).
  // Without a key, or with COPILOT_MODEL=mock, the scripted mock in lib/mock-model.ts plays the demo.
  model: agentModel(),
  prompt: agentInstructions(readPlaybook()),
});

const runtime = new CopilotRuntime(runtimeOptions(process.env, agent));

// Fail loud: with Intelligence switched on (or half switched on), say at startup whether it works.
const settings = intelligenceSettings(process.env);
if (settings.enabled || settings.problem) {
  void checkIntelligence(process.env).then((status) => {
    if (status.state === "connected") console.info(`[intelligence] ${status.message}`);
    else if (status.state === "warning") console.warn(`[intelligence] ${status.message}`);
    else if (status.state === "error") console.error(`[intelligence] ${status.message}`);
  });
}

const handler = createCopilotRuntimeHandler({ runtime, basePath: "/api/copilotkit" });

export const GET = (request: Request) => handler(request);
export const POST = (request: Request) => handler(request);
