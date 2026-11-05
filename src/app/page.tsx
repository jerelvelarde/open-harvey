// Server component: reads the contracts, the playbook and the review history from disk, and names the
// model the chat runs on (OpenAI, or the scripted mock when there is no key), then hands off to the
// client app.

import { connection } from "next/server";
import { LegalApp } from "@/components/LegalApp";
import { parsePlaybook } from "@/lib/playbook";
import { intelligenceSettings, publicSettings } from "@/lib/intelligence";
import { chatEnabled, modelLabel, readContracts, readPlaybook, readReviewHistory } from "@/lib/server-data";

export default async function Page() {
  await connection(); // render at request time, so a key added to .env.local shows up after a restart
  return (
    <LegalApp
      library={{ contracts: readContracts(), playbook: parsePlaybook(readPlaybook()) }}
      history={readReviewHistory()}
      chatEnabled={chatEnabled()}
      model={modelLabel()}
      // CopilotKit Intelligence (optional, off by default): whether it is on, its Space, any setup problem. Never the key.
      intelligence={publicSettings(intelligenceSettings(process.env))}
    />
  );
}
