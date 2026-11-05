// Which messages belong to which matter, so each matter reads as its own thread. A matter's thread
// starts at the user message whose turn opened it (the copilot's readMatter or readDocument call for it) and
// runs until another matter is opened. Messages before any matter was opened belong to the first one.
// Pure, so it is tested on its own (thread-segments.test.ts); ChatPanel.tsx uses it to show only the
// open matter's messages, with a divider when earlier matters' messages are set aside. A collection's
// thread works the same way: it starts at the turn whose readCollection call opened it, and its
// segment carries the collection id in place of a matter id.

type Msg = { id: string; role: string; toolCalls?: { function: { name: string; arguments: string } }[] };

export type Segment = { matterId: string; start: number; end: number };

/** The calls that open a thread, and the argument that names it. */
const OPENS: Record<string, "matterId" | "collectionId"> = { readMatter: "matterId", readDocument: "matterId", readCollection: "collectionId" };

function readThreadId(name: string, args: string): string | null {
  const key = OPENS[name];
  if (!key) return null;
  try {
    const parsed = JSON.parse(args) as Record<string, unknown>;
    return typeof parsed[key] === "string" ? (parsed[key] as string) : null;
  } catch {
    return null;
  }
}

/** The thread split by matter, in order. A matter opened twice gets two segments. */
export function threadSegments(messages: readonly Msg[]): Segment[] {
  const starts: { matterId: string; start: number }[] = [];
  let lastUser = 0;
  messages.forEach((m, i) => {
    if (m.role === "user") lastUser = i;
    if (m.role !== "assistant") return;
    for (const call of m.toolCalls ?? []) {
      const matterId = readThreadId(call.function.name, call.function.arguments);
      if (!matterId || starts.at(-1)?.matterId === matterId) continue;
      starts.push({ matterId, start: starts.length === 0 ? 0 : lastUser });
    }
  });
  return starts.map((s, i) => ({ ...s, end: starts[i + 1]?.start ?? messages.length }));
}

/**
 * The open matter's messages, and whether any other matter's messages were set aside. `newThreadFrom`
 * is where a new thread began (the message count when it opened, useThreadStart in ChatPanel.tsx):
 * what is typed there shows at once, before any readMatter or readCollection call claims it.
 */
export function matterThread<M extends Msg>(messages: readonly M[], matterId: string | null, newThreadFrom: number = messages.length): { messages: M[]; setAside: number } {
  const segments = threadSegments(messages);
  if (segments.length === 0) return { messages: [...messages], setAside: 0 };
  // A new thread (no matter open yet) starts empty: every earlier matter's messages are set aside.
  if (!matterId) {
    const mine = messages.slice(Math.min(newThreadFrom, messages.length));
    return { messages: mine, setAside: messages.length - mine.length };
  }
  const mine = segments.filter((s) => s.matterId === matterId);
  if (mine.length === 0) {
    // Not opened in this thread yet (a new matter, before its readMatter): everything after the last segment's start belongs to it.
    const last = segments.at(-1)!;
    const tail = messages.slice(last.end);
    return { messages: tail, setAside: messages.length - tail.length };
  }
  const kept = mine.flatMap((s) => messages.slice(s.start, s.end));
  return { messages: kept, setAside: messages.length - kept.length };
}
