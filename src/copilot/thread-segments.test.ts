// Each matter reads as its own thread: Brightwater's review never opens on Acme's receipt.

import { describe, expect, it } from "vitest";
import { matterThread, threadSegments } from "./thread-segments";

const user = (id: string) => ({ id, role: "user" });
const read = (id: string, matterId: string) => ({ id, role: "assistant", toolCalls: [{ function: { name: "readMatter", arguments: JSON.stringify({ matterId }) } }] });
const say = (id: string) => ({ id, role: "assistant" });

const thread = [user("u1"), read("a1", "acme-msa"), say("a2"), user("u2"), say("a3"), user("u3"), read("a4", "brightwater-order-form"), say("a5")];

describe("threads by matter", () => {
  it("splits at the user message whose turn opened the next matter", () => {
    expect(threadSegments(thread)).toEqual([
      { matterId: "acme-msa", start: 0, end: 5 },
      { matterId: "brightwater-order-form", start: 5, end: 8 },
    ]);
  });

  it("shows only the open matter's messages, and says how many were set aside", () => {
    expect(matterThread(thread, "brightwater-order-form")).toEqual({ messages: thread.slice(5), setAside: 5 });
    expect(matterThread(thread, "acme-msa")).toEqual({ messages: thread.slice(0, 5), setAside: 3 });
  });

  it("a matter not opened in this thread yet starts empty, and so does a new thread", () => {
    expect(matterThread(thread.slice(0, 5), "brightwater-order-form")).toEqual({ messages: [], setAside: 5 });
    expect(matterThread(thread, null)).toEqual({ messages: [], setAside: 8 });
    expect(matterThread([user("u1")], null).messages).toHaveLength(1);
    expect(matterThread([user("u1")], "acme-msa").messages).toHaveLength(1);
  });
});
