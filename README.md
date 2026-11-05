# Open Harvey: a contract-review copilot (CopilotKit starter)

> Open Harvey is an open-source demo built with CopilotKit, inspired by the patterns of leading legal AI
> products. Not affiliated with or endorsed by Harvey.

A functional copilot for one real workflow: getting a vendor contract from "it just landed" to ready to
sign. Maya Chen, Senior Counsel at Northstar Software (fictional), gets Acme Cloud's Master Services
Agreement: 14 sections, $240,000 a year for 36 months, pricing that holds until next Friday. The copilot
proposes a 17-task review plan from the written playbook and runs nothing until she approves it. Then it
works the checklist down in front of her, cites every finding to the exact passage, drafts a redline for
each deviation as replacement clause text, works out who has to approve, and sends nothing until she
clicks; nothing goes to Acme until every approver has approved. When Security keeps
sending reviews back for the same missing ask, it proposes a new playbook rule, and a person publishes it
before the next contract gets it.

Built for the CopilotKit workshop *Building Enterprise-Ready Functional Copilots* (Thu Nov 5 2026, 10am
PT). The story it plays is "Signed by Friday". Next.js App Router, CopilotKit 1.84 (v2 API), AG-UI, one
`BuiltInAgent`.

## Run it (no key needed)

You need Node.js 22.12 or later (24 works too).

```bash
git clone https://github.com/jerelvelarde/open-harvey.git
cd open-harvey
npm install          # run it in the foreground; it takes about 30 seconds
npm run dev          # http://127.0.0.1:3200
```

**No key? It runs on a scripted mock.** Without `OPENAI_API_KEY`, or with `COPILOT_MODEL=mock`, the agent
runs on `src/lib/mock-model.ts`, a stand-in model that plays the demo below with no network. The runtime,
the AG-UI events, the tools and the cards are the same; only the model is scripted, and the rail's closing
line says *model: mock · scripted demo*. It understands the demo sentences and the suggestion chips; anything else
gets the list of sentences. The mock paces the checklist (about 0.6s a task) so the audience can watch it
work down.

**With a key.** `cp .env.example .env.local`, set `OPENAI_API_KEY` (and optionally `COPILOT_MODEL`, default
`openai/gpt-5.4-mini`), restart. The same tools, gates and cards run; the model decides when to call them.

**No sign-in, so localhost in development and the mock in production.** The runtime endpoint
(`/api/copilotkit`) has no auth: anyone who can reach it can run the agent, on your model key if one is set.
So `npm run dev` and `npm start` listen on 127.0.0.1 only. A production build (`npm start`,
`npm run start:public`, any deploy) also runs the scripted mock even when `OPENAI_API_KEY` is set, and says
why in the server log. That removes the cost, not the open endpoint: set `ALLOW_REAL_MODEL=true` only when
your own auth sits in front of the app ([Deploy it](#deploy-it)). The CopilotKit runtime sends usage
telemetry by default; set `COPILOTKIT_TELEMETRY_DISABLED=true` (or `DO_NOT_TRACK=1`) to turn it off.

`npm test` runs the unit tests for every finding, number and route below, and plays the whole demo against
the mock with the real tool handlers. `npm run typecheck` checks the types.

## Demo script (7 steps, and an optional 8th)

Start from a clean slate with **Reset demo** (in Maya's menu at the foot of the black sidebar): the
Spaces page opens ("Vendor contracts"), with Acme Cloud and the six reviews imported when Open Harvey went
live on Monday, as outcomes only. The sidebar holds New thread, Agents, Collections, Analytics, Playbooks,
Recents (the threads) and Spaces (the matters). Click **Open** on Acme Cloud: the assistant view opens,
with the copilot's thread at the centre and the review on the right rail (Plan and Work). Type the lines in quotes into the thread. Chips offer the
lines the copilot could sensibly suggest (review this, send it, where is it); Maya's reason in step 4 is
her judgment, so the presenter types it.

1. **The ask.** "Review the Acme Cloud MSA and get it ready to sign." The copilot reads the matter (14
   sections, $720,000 over 36 months) and proposes the 17-task plan as a card with **Approve plan** and
   **Not yet**. The card is the one place the steps are read; the rail says only "Plan · waiting for
   approval". Nothing runs before the click (`runPlanTask` refuses until then).
2. **The run.** Click **Approve plan**. The rail's Plan is the live checklist ("7 of 17 done"): the running
   step spins, steps that found a deviation stay in view with their risk chip, clean finished steps fold
   into "9 done", and the queued ones into "N queued". The thread shows one live line, "Working: Security
   standards and audits · 8 of 17"; its rows stay folded behind "Done in 10s · Read Acme Cloud · Ran 16
   tasks". Task 17, "Send the redline package to Acme (only after every approval)", stays held: nothing
   goes to Acme until every approver has approved. Open **Work → Review table**: it opens beside the
   thread with the seven deviations (liability cap §8.2, no DPA §6.1 and 10-day breach notice §6.4 high
   risk; renewal §3.3, usage data §7.3 and no termination for convenience §11.2 medium; net 15 §4.2 low),
   and the other five playbook rules pass, each with a citation. Every redline is replacement clause text
   for Acme's own sentence: the redlines card strikes Acme's words ("three (3)") and inserts Northstar's
   ("twelve (12)"). Click a cite chip for a peek at the passage; click again (or "Open in the contract")
   and the contract opens on it, the quoted words highlighted. The route comes from the rules: **Rachel
   Adler → Jordan Blake → Elena Ortiz** (Rachel for Northstar's position, Jordan for data and security
   terms including §7.3 usage data, Elena for the spend: $720,000 is over the $500,000 line).
3. **The human edit.** In the Review table, rewrite the liability-cap redline (§8.2) to 6 months of fees,
   with a $1,000,000 cap for data-protection breaches. Paste this and press Enter:

   > Each party's total liability arising out of or relating to this Agreement will not exceed the fees
   > paid by Northstar in the six (6) months before the event giving rise to the claim, except that
   > liability for data-protection breaches is capped at $1,000,000.

   The chat shows the edit as an event row, "You changed the §8.2 redline · 12 months of fees → 6 months
   of fees, with a $1,000,000 cap for data-protection breaches · Saw your edit · re-checked". The re-check
   card says PB-LIAB-01 still deviates, and the copilot asks only "What reason should I give Rachel
   Adler?" It never changes your value back. (§8.3 of the contract lifts the cap only for indemnities and
   gross negligence, fraud or willful misconduct, so data breaches are capped: the $1,000,000 data-breach
   cap is a real gain, not a give-away.)
4. **The gate.** Type the reason (no chip offers it): "Acme won't go above 6 months. The $1M data-breach
   cap covers the exposure we care about." Then "Send it for approval." An approval card: "Send the Acme
   review to Rachel Adler, Jordan Blake and Elena Ortiz for approval?" with the route, the rule behind each
   approver and your reason, and **Send for approval** / **Keep editing**. Nothing is sent until you click,
   and nothing goes to Acme until every approver has approved.
5. **Approvals.** Open the Acme Cloud Space in the sidebar: on the Tasks tab the copilot's note reads "Rachel, Maya needs your
   approval on the Acme Cloud review." Open approvals. Acting as Rachel (she sees the one position below
   the playbook, the 6-month cap with the $1,000,000 data-breach cap, and Maya's reason): **Approve**.
   Acting as Jordan: write "Ask Acme for their SOC 2 Type II report and latest pen-test summary before we
   sign. We need this whenever a vendor holds customer data." and **Send back**. His words appear once, in
   his route row; the header says "Sent back" and "1 of 3 approved".
6. **Learning.** Open **Insights** (its badge lights only now): "First new send-back since go-live ·
   matches 3 in the imported history". The proposed rule, **PB-SEC-01 "Security evidence for data
   processors"**, sits beside the approvers' words (Lumen Ridge, Cobalt Harbor, Fernway and Acme today).
   Playbook changes belong to the General Counsel: acting as Rachel Adler, click **Publish to the
   copilot**. Back in the thread (Recents → Acme Cloud review), the step-7 chip appears only now.
7. **The next contract.** Brightwater Metrics' order form arrived today at 4:40 pm. "Review the
   Brightwater Metrics order form." The new plan has a task nobody asked for: "Request the SOC 2 Type II
   report and pen-test summary (PB-SEC-01 v1, learned)", with a "Learned v1" tag. Brightwater gets its
   own thread (Acme's is set aside behind a divider). Approve it; the request lands in the Review table as
   a learned row, cited to the vendor's security clause, the route adds Jordan Blake for it (PB-APR-02),
   and the termination redline keeps Brightwater's pro-rata refund. End on **Spaces** (the breadcrumb): the queue says what
   happens next. Acme can still sign by Fri Nov 13 once it resubmits with what Jordan asked for, and
   Brightwater's security evidence goes out with its first redlines, so Security has it on the first pass.
   Open **Analytics** for the Govern beat: before go-live (the six imported reviews: 33% approved first
   time, a median of 10.5 days, 29 days lost to send-backs, missing security evidence three times) beside
   since go-live (this session: 33 tasks run, 10 redlines, 1 human edit, 1 sent for approval, 1 rule
   learned), the send-back reasons (security evidence: 3 before, 1 since), and the decision log naming
   every gated action, who took it and when. "How are reviews going?" in a thread answers from the same
   figures.

8. **(Optional) The whole portfolio.** Once PB-SEC-01 is published, click **New thread** and type
   "Check every contract in Vendor contracts 2026 for the security evidence PB-SEC-01 asks for." The
   copilot opens the collection (eight vendor contracts: the two in review and six signed) with its review
   table beside the thread, narrowed to the Security evidence column, and fills it one cell per
   `fillCollectionCell` call. Each cell answers whether Security has the evidence; its quote and § cite
   show what the contract says (a cite peeks the passage). Lumen Ridge, Cobalt Harbor and Fernway read
   "Received after a send-back", with the date from the review history: none of their contracts requires
   the reports, and each sent them only after Security sent the review back, 22 days lost between them
   (the same sum Insights uses). PB-SEC-01 now asks before signing: Brightwater's request went out with its
   redlines, and Acme's goes out with the resubmission. Kestrel, Orchard Lane and Halden hold no customer
   data, so the rule doesn't apply. **Collections** holds the same table with all six questions; **Agents** lists the three
   jobs the copilot does, with the tools each calls, and Start opens a thread with its first line ready.

## Deploy it

A public deploy runs the scripted mock: the whole demo above, with no key on the server and nothing for a
stranger to spend. Each visitor's demo lives in their own browser (localStorage), so visitors never see each
other's work, and **Reset demo** in Maya's menu starts it over.

On any Node.js host (22.12 or later):

| | |
| --- | --- |
| Build | `npm ci && npm run build` |
| Start | `npm run start:public`: listens on `0.0.0.0` and on `$PORT` (default 3000) |
| Variables | None. Leave `OPENAI_API_KEY` unset. Don't set any `CPK_INTELLIGENCE_*` variable: anyone who reaches the URL could write threads into your Intelligence project. Never upload `.env.local` |
| Memory | About 1 GB. The runtime keeps recent runs in memory (up to 1,000 threads, about 512 MB, oldest dropped first) and a restart clears them |

Check it: the rail's last line reads *model: mock · scripted demo*, and the server log says
`[copilot] Running on the scripted mock model (...)` on the first chat.

**The real model on a deploy.** Put your own auth in front of the whole app first (your SSO, your platform's
access controls, or a proxy). Then set `OPENAI_API_KEY`, `ALLOW_REAL_MODEL=true` and optionally
`COPILOT_MODEL`, and redeploy. Without `ALLOW_REAL_MODEL=true` a production build ignores the key.

## Connect to CopilotKit Intelligence (optional)

The stage demo runs with this off. Off is the default: the runtime is exactly the one above, nothing
is recorded, and nothing leaves the machine but the model calls. Turn it on to send real
conversations and approval decisions to Automatic Learning, so Intelligence's own Learning screens
(the Trajectories timeline, Insights and proposed Skills with their evidence) show this app's work.

1. In the CopilotKit Intelligence dashboard, open your project, turn on Trajectories for Automatic
   Learning, and create a Learning Space with the ID `vendor-contract-review`.
2. In `.env.local`, set both of these (one without the other leaves it off):
   ```
   CPK_INTELLIGENCE_ENABLED=true
   CPK_INTELLIGENCE_API_KEY=<the project's Intelligence API key>
   # optional, for another Space:
   # CPK_INTELLIGENCE_LEARNING_CONTAINER_ID=vendor-contract-review
   ```
3. Restart the app.

What the switch changes (`src/lib/intelligence.ts`, `runtimeOptions`):
- The runtime runs in Intelligence mode. Threads are stored in your project, and every run joins the Space.
- The user is Maya Chen, resolved on the server. Nothing the browser sends can change it.
- The browser records a Trajectory (the provider's `learning` prop), and the Trajectory joins the same Space.
- Each gated decision goes to the Trajectory as a developer event (`src/lib/trajectory-events.ts`, sent by
  `src/copilot/useDecisionEvents.ts`):
  - `review.plan_approved`;
  - `review.sent_for_approval`, with Maya's reasons;
  - `review.approved` and `review.sent_back`, with the approver's own words;
  - `redline.edited`, before and after;
  - `playbook.rule_published`.

  They are built from the same entries as the Analytics decision log.

It fails loud. On startup the server reads the Space with the key, logs the result, and the app
shows it in a strip under the top bar:
- a wrong key or an unreachable Intelligence is an error;
- a missing Space is a warning, and the demo carries on without the Space, as the runtime does;
- a Trajectory capture failure shows there too.

## Concept to file

| Concept | File |
| --- | --- |
| Connect app and agent: one runtime, one `BuiltInAgent`, AG-UI over `/api/copilotkit` | `src/app/api/copilotkit/[[...slug]]/route.ts`, `src/components/LegalApp.tsx` |
| Swap the model: a scripted `LanguageModelV3` mock, picked when there is no key | `src/lib/mock-model.ts`, `src/lib/demo-script.ts` (tested against the real tools), `src/lib/server-data.ts` |
| The agent's instructions and the written playbook | `src/lib/agent-instructions.ts`, `src/data/playbook.md` |
| The contract as data: sections and stable passage ids (§8.2) | `src/lib/contract.ts`, `src/data/contracts/*.md`, the deal terms in `*.terms.json` (`src/lib/matters.ts`) |
| Code does the analysis: one check per playbook rule, total contract value, approver routing, re-checking an edited redline | `src/lib/review.ts`, tested in `review.test.ts` |
| The plan the copilot proposes: the 17 tasks and what each one found | `src/lib/plan.ts`, tested in `plan.test.ts` |
| App context: who the user is, the matters, the open matter's plan, findings, redlines and approvals (`useAgentContext`) | `src/copilot/useAppContext.ts`, built in `src/lib/app-context.ts` |
| Frontend tools: `readMatter`, `runPlanTask` (ticks one checklist task), `recheckRedline`, `setDeviationReason`, `updateRedline` (`useFrontendTool`) | `src/copilot/useReviewTools.ts`, handlers in `src/lib/agent-tools.ts` |
| Human in the loop: the plan (`proposePlan`) and the send (`requestApproval`) (`useHumanInTheLoop`) | `src/copilot/useProposePlan.tsx`, `src/copilot/useRequestApproval.tsx`, the clicks in `src/lib/gates.ts` (tested) |
| Generative UI: findings, redlines as a blackline of the vendor's words, the re-check after a human edit (`useComponent`) | `src/copilot/useGenerativeUI.tsx`, `src/lib/blackline.ts` (tested) |
| Shared state, two writers: one store for plans, redlines, reasons, approvals and rules | `src/lib/store.ts`, tested in `store.test.ts` |
| Editable shared state, the human side: the review table | `src/components/panels/ReviewTable.tsx` |
| The agent notices human edits (`useAgent` + `useCopilotKit`), queued while it is busy | `src/copilot/useTellCopilot.ts`, `src/copilot/edit-queue.ts` (tested) |
| The shell: a black labelled sidebar (New thread, Agents, Collections, Analytics, Playbooks, Recents, Spaces), the views | `src/components/LegalApp.tsx`, `src/components/shell-state.ts` |
| The thread at the centre (one per matter), the review on the rail: Plan and Work | `src/components/AssistantView.tsx`, `src/components/RightRail.tsx`, `src/components/OutputPanel.tsx`, `src/copilot/thread-segments.ts` (tested) |
| The plan as work assigned to a colleague: the Tasks table grouped by phase, the matter view | `src/components/MatterView.tsx`, `src/components/panels/TasksTable.tsx`, `src/components/panels/MatterHeader.tsx` |
| Citations that open the passage | `src/components/panels/ContractViewer.tsx`, `src/components/cite-focus.ts` |
| Approvals stay with people: "Acting as", the route as the decision record | `src/components/panels/ApprovalsPanel.tsx`, `src/components/ui/RouteList.tsx` |
| Learning from corrections, a person publishes the rule | `src/lib/learning.ts` (tested), `src/components/panels/InsightsPanel.tsx` |
| Suggestions that follow the story (`useConfigureSuggestions`, pinned above the composer) | `src/copilot/useSuggestionChips.ts`, `src/copilot/chips.ts` (tested against the mock) |
| The agent's work behind one live line: CopilotChat's `"turn"` display, one wildcard `useRenderTool` with `group: true`, and the `workSummary` slot | `src/copilot/useWorkRows.tsx`, `src/components/ui/WorkRow.tsx`, `src/copilot/ChatPanel.tsx`, `src/copilot/useTurnWorking.ts` |
| The playbook and learned rules, read-only | `src/components/panels/PlaybookPanel.tsx` |
| A human edit shown as an event row, not a bubble (CopilotChat's `userMessage` slot) | `src/copilot/ChatUserMessage.tsx` |
| Governance you can read: before and since go-live, send-back reasons, the decision log, next steps, every figure from a tested function | `src/lib/analytics.ts` (tested in `analytics.test.ts`), `src/components/panels/AnalyticsPanel.tsx` |
| A review table across a collection, one tool call per cell (`useFrontendTool`: `readCollection`, `fillCollectionCell`), every quote checked against its passage | `src/lib/collection.ts` (tested in `collection.test.ts`), `src/copilot/useCollectionTools.ts`, `src/components/panels/CollectionTable.tsx`, `src/data/collection/` |
| Agents described from what they call: the job, its inputs, its gates, its tools | `src/lib/agents.ts` (tested in `agents.test.ts`), `src/components/panels/AgentsPanel.tsx` |
| The approval seal: a petal per playbook check (filled = pass, hollow and notched = deviation), a ring per approver who decided | `src/components/ui/ApprovalSeal.tsx`, `src/components/ui/seal-state.ts` |

Everything CopilotKit-specific lives in `src/copilot/` and the route. The rest is an ordinary React app.

## Choices worth knowing

- **The model never does the analysis.** A deviation, a risk level, the total contract value and the route
  all come from pure functions in `src/lib/review.ts`; the tools, the cards and the panels call the same
  ones. The model picks which tool to call and explains the result in a sentence or three.
- **The deal terms are a hand-written record beside the text** (`*.terms.json`): one field per term, each
  with its passage id, the exact quoted words and, for a term a redline replaces, the whole sentence. It
  stands in for an extraction step: in production a model extracts the terms and a person checks them.
  `contract.test.ts` checks every quote and sentence word for word against the contract, so a citation
  always highlights real text and a redline always strikes the vendor's own words. The checks, routing
  and learning run on it in code.
- **Rules that must hold are in code, not only in the prompt.** `runPlanTask` refuses before the plan is
  approved and runs tasks in plan order. `updateRedline` never changes a redline Maya wrote unless the call
  says she asked. `sendForApproval` refuses while a deviation she accepted has no reason for the General
  Counsel. Task 17, sending the redline package to the vendor, stays held until every approver has
  approved. Approvers approve; nothing is signed until Northstar and the vendor sign the agreement.
- **Text people typed is data.** Redlines, reasons and approvers' comments reach the agent under
  `quotedText`, labelled as quoted data, never instructions.
- **Human edits reach the agent as a message, not as AG-UI shared state.** A state change does not start a
  run, so the agent would not react to Maya's edit. Each committed redline edit is posted with
  `agent.addMessage(...)` plus `copilotkit.runAgent({ agent })`, and queued while the agent is busy.
- **The chat renders every message.** One review is about 45 messages, past CopilotChat's virtualization
  threshold; `src/copilot/ChatPanel.tsx` uses the message view's `children` render prop so folded work rows
  never leave gaps.
- **Learning, honestly.** Open Harvey went live on Monday with the earlier reviews imported; Insights
  checks each new send-back against them (`src/lib/learning.ts`, a keyword classifier and a template, so it
  runs the same every time). In this starter, publishing PB-SEC-01 switches on a prepared check
  (`LEARNED_CHECKS` in `src/lib/review.ts`), so the learned rule holds as surely as the written ones. In
  production, CopilotKit Intelligence's Automatic Learning proposes the rule from real threads, and a
  published skill is instructions the agent loads on every run, after a person approves it:
  https://docs.copilotkit.ai/intelligence/overview
- **Playbook changes belong to the General Counsel.** The presenter publishes acting as Rachel Adler, and
  the published rule records her as its publisher.
- **A published rule changes new plans only.** Acme keeps the plan it was approved with; Brightwater, opened
  after PB-SEC-01 was published, gets the learned task.
- **The story date is pinned** to Thu Nov 5 2026 (`src/data/company.json`), so "pricing holds until Nov 13"
  reads the same whenever you run it. Brightwater arrives the same afternoon, at 4:40 pm.
- **Saved state is checked on load.** The demo persists in localStorage; a save that no longer matches the
  data is discarded with a console warning, and an error boundary keeps **Reset demo** on screen.
- **Design.** [`DESIGN.md`](DESIGN.md): black and white (ink, white, a warm off-white and greys; no hue),
  a black labelled sidebar, large serif page titles, the thread at the centre with a live plan on the
  rail, each fact said once per screen. State is fill, weight and shape: a solid ink chip to act on, an
  outline to watch, stone with a check when settled, plain text for the rest. The seal is monochrome:
  filled petals pass, hollow notched petals deviate. The mark (an open ring around a petal) is original.
- **The name.** Open Harvey is named for the category it reverse-engineers at the level of patterns: no
  Harvey logo, mark, font, wording or screen is used. It is not affiliated with or endorsed by Harvey.

## Make it yours

Swap the contracts and terms in `src/data/`, the checks in `src/lib/review.ts` and the plan in
`src/lib/plan.ts` for your own function (procurement, security reviews, discounts).

Everything here is fictional: Northstar Software, Acme Cloud, Brightwater Metrics, every past vendor and
every person. The contracts were written for this demo and are not adapted from any real contract or
template.
