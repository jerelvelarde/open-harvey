// Concept: a mock model, so the whole copilot runs with no API key.
//
// BuiltInAgent reaches its model through the AI SDK's LanguageModelV3 interface: an object with
// doGenerate and doStream, which take the prompt (system prompt with the app context, messages, tool
// results, the tools on offer) and return text and tool calls. Anything with that shape can stand in
// for gpt-5.4-mini. This one asks lib/demo-script.ts what to do next and streams the answer back the
// way a provider does: text in small deltas, then tool-call parts, then a finish part.
//
// That is the seam. Everything above it is unchanged: the runtime turns the stream into AG-UI events,
// the browser runs the frontend tools and renders the cards, and the next run brings the results back
// here. lib/server-data.ts picks this model when COPILOT_MODEL=mock or OPENAI_API_KEY is not set.

import type {
  LanguageModelV3,
  LanguageModelV3CallOptions,
  LanguageModelV3Content,
  LanguageModelV3FinishReason,
  LanguageModelV3StreamPart,
  LanguageModelV3Usage,
} from "@ai-sdk/provider";
import { nextStep, type NextStep } from "./demo-script";

export function createMockModel(): LanguageModelV3 {
  return {
    specificationVersion: "v3",
    provider: "mock",
    modelId: "scripted-demo",
    supportedUrls: {},

    async doGenerate(options) {
      const step = decide(options);
      const content: LanguageModelV3Content[] = [];
      if (step.text) content.push({ type: "text", text: step.text });
      for (const call of step.toolCalls) {
        content.push({ type: "tool-call", toolCallId: newId("call"), toolName: call.toolName, input: JSON.stringify(call.input) });
      }
      return { content, finishReason: finishReason(step), usage: NO_USAGE, warnings: [] };
    },

    async doStream(options) {
      const step = decide(options);
      let cancelled = false;
      const stopped = () => cancelled || options.abortSignal?.aborted === true;

      const stream = new ReadableStream<LanguageModelV3StreamPart>({
        async start(controller) {
          // A beat before a checklist task, so the audience can watch the plan work down (demo-script.ts).
          if (step.pauseMs) await new Promise((resolve) => setTimeout(resolve, step.pauseMs));
          if (stopped()) return;
          controller.enqueue({ type: "stream-start", warnings: [] });
          if (step.text) {
            const id = newId("text");
            controller.enqueue({ type: "text-start", id });
            for (const delta of words(step.text)) {
              await pause(); // so the reply streams in like a real model's
              if (stopped()) return;
              controller.enqueue({ type: "text-delta", id, delta });
            }
            controller.enqueue({ type: "text-end", id });
          }
          // A tool call is one part: its input is the JSON-encoded arguments.
          for (const call of step.toolCalls) {
            controller.enqueue({ type: "tool-call", toolCallId: newId("call"), toolName: call.toolName, input: JSON.stringify(call.input) });
          }
          controller.enqueue({ type: "finish", finishReason: finishReason(step), usage: NO_USAGE });
          controller.close();
        },
        cancel() {
          cancelled = true;
        },
      });
      return { stream };
    },
  };
}

/** Ask the script, and only call tools the app registered (a real model only sees those). */
function decide(options: LanguageModelV3CallOptions): NextStep {
  const step = nextStep(options.prompt);
  const offered = new Set((options.tools ?? []).map((tool) => tool.name));
  const missing = step.toolCalls.map((call) => call.toolName).filter((name) => !offered.has(name));
  if (missing.length === 0) return step;
  return {
    text: `The scripted mock wanted to call ${missing.join(", ")}, but the app did not register ${missing.length === 1 ? "that tool" : "those tools"}. See src/copilot/.`,
    toolCalls: [],
  };
}

/** "tool-calls" tells the runtime the browser has work to do; "stop" ends the turn. */
function finishReason(step: NextStep): LanguageModelV3FinishReason {
  return step.toolCalls.length > 0 ? { unified: "tool-calls", raw: "tool_calls" } : { unified: "stop", raw: "stop" };
}

/** No tokens: nothing was sent to a provider. */
const NO_USAGE: LanguageModelV3Usage = {
  inputTokens: { total: 0, noCache: 0, cacheRead: 0, cacheWrite: 0 },
  outputTokens: { total: 0, text: 0, reasoning: 0 },
};

const newId = (prefix: string) => `${prefix}_${crypto.randomUUID()}`;
/** One word and the space after it per delta. */
const words = (text: string) => text.match(/\S+\s*|\s+/g) ?? [];
/** 15 to 25 ms per delta. */
const pause = () => new Promise((resolve) => setTimeout(resolve, 15 + Math.random() * 10));
