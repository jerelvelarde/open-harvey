// Fail loud, in the app: the browser asks once on load whether CopilotKit Intelligence works, and
// shows the answer (lib/intelligence.ts checkIntelligence). It is only asked when the switch is on;
// with Intelligence off the app never calls this route.

import { checkIntelligence } from "@/lib/intelligence";

export async function GET() {
  const status = await checkIntelligence(process.env);
  if (status.state === "error") console.error(`[intelligence] ${status.message}`);
  else if (status.state === "warning") console.warn(`[intelligence] ${status.message}`);
  return Response.json(status, { headers: { "cache-control": "no-store" } });
}
