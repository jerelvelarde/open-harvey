---
name: Open Harvey · The Colleague's Desk
description: Northstar Software's contract-review workspace, an open-source demo of its category built on CopilotKit. Black and white only. A black labelled sidebar frames the app, content pages open on large serif titles, and the copilot is a colleague on the matter, with its thread at the centre and its live plan on a quiet rail. State is shown by fill, weight and shape, never by hue, and each fact is said once per screen.
colors:
  white: "#ffffff"
  paper: "#f6f5f1"
  surface: "#ffffff"
  stone: "#edebe6"
  stone-deep: "#e1ded6"
  ink: "#141310"
  ink-hover: "#2d2b27"
  muted: "#65615a"
  hairline: "#e2dfd8"
  rule: "#cbc7be"
  night: "#121110"
  night-raised: "#252421"
  night-line: "#2f2d29"
  night-muted: "#a9a59c"
  highlight: "#dedad1"
  on-ink: "#ffffff"
typography:
  figure:
    fontFamily: "Source Serif 4 Variable, Source Serif 4, Georgia, serif"
    fontSize: "40px"
    fontWeight: 500
    lineHeight: "44px"
    fontFeature: "tnum"
  display:
    fontFamily: "Source Serif 4 Variable, Source Serif 4, Georgia, serif"
    fontSize: "30px"
    fontWeight: 500
    lineHeight: "36px"
    letterSpacing: "-0.01em"
  title:
    fontFamily: "Source Serif 4 Variable, Source Serif 4, Georgia, serif"
    fontSize: "22px"
    fontWeight: 500
    lineHeight: "28px"
    letterSpacing: "-0.005em"
  body:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: "21px"
    fontFeature: "tnum"
  section-label:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 600
    lineHeight: "21px"
  quote:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "13.5px"
    fontWeight: 400
    lineHeight: "20px"
  small:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "12.5px"
    fontWeight: 400
    lineHeight: "17px"
    fontFeature: "tnum"
  id:
    fontFamily: "Geist Mono, ui-monospace, SFMono-Regular, Menlo, monospace"
    fontSize: "12.5px"
    fontWeight: 400
    lineHeight: "17px"
rounded:
  pinch: "2px"
  xs: "3px"
  sm: "4px"
  control: "5px"
  md: "8px"
  full: "9999px"
spacing:
  sidebar: "240px"
  sidebar-compact: "56px"
  top-bar: "48px"
  right-rail: "320px"
  thread-max: "720px"
  composer-max: "688px"
  thread-beside-output: "440px"
  content-max: "1180px"
  content-narrow: "960px"
  page-x: "24px"
  gutter: "16px"
  card-y: "12px"
  card-x: "14px"
components:
  sidebar:
    backgroundColor: "{colors.night}"
    textColor: "{colors.on-ink}"
    width: "240px"
  sidebar-compact:
    backgroundColor: "{colors.night}"
    width: "56px"
  sidebar-item:
    textColor: "{colors.night-muted}"
    rounded: "{rounded.md}"
    height: "32px"
    padding: "0 10px"
  sidebar-item-current:
    backgroundColor: "{colors.night-raised}"
    textColor: "{colors.on-ink}"
  top-bar:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.muted}"
    height: "48px"
    padding: "0 16px"
  page-title:
    textColor: "{colors.ink}"
    typography: "{typography.display}"
  open-mark:
    size: "24px"
  copilot-mark:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.on-ink}"
    rounded: "{rounded.full}"
    size: "20px"
  button-primary:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.on-ink}"
    rounded: "{rounded.control}"
    height: "32px"
    padding: "0 14px"
  button-primary-hover:
    backgroundColor: "{colors.ink-hover}"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    height: "32px"
    padding: "0 14px"
  button-secondary-hover:
    backgroundColor: "{colors.stone}"
  button-ghost:
    textColor: "{colors.muted}"
    rounded: "{rounded.control}"
  chip-act:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.on-ink}"
    rounded: "{rounded.control}"
    height: "20px"
    padding: "0 6px"
  chip-watch:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    height: "20px"
    padding: "0 6px"
  chip-settled:
    backgroundColor: "{colors.stone}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    height: "20px"
    padding: "0 6px"
  chip-quiet:
    textColor: "{colors.ink}"
    height: "20px"
    padding: "0"
  chip-provenance:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.muted}"
    rounded: "{rounded.control}"
    height: "20px"
    padding: "0 6px"
  chip-cite:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    typography: "{typography.id}"
    rounded: "{rounded.control}"
    height: "20px"
    padding: "0 6px"
  tab:
    textColor: "{colors.muted}"
    rounded: "{rounded.md}"
    height: "32px"
    padding: "0 12px"
  tab-selected:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
  card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "12px 14px"
  user-message:
    backgroundColor: "{colors.stone}"
    textColor: "{colors.ink}"
    padding: "8px 12px"
  composer:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
  send-button:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.on-ink}"
    rounded: "{rounded.control}"
    size: "28px"
---

# Design System: Open Harvey · The Colleague's Desk

## Overview

**Creative North Star: "The Colleague's Desk."** The matter is the workspace and the copilot is a colleague on it, inside a black-and-white legal workspace. A black labelled sidebar frames the app. Every content page opens on a large serif title over a warm off-white ground, with its work on white sheets. In the assistant view the copilot's thread sits at the centre like a conversation with a trusted associate, and its live plan and the work it has made sit on a quiet rail beside it. Its work is assigned to it in the matter's task list like any teammate's. The surface follows the category's working patterns (a labelled sidebar, serif page titles, a thread with a live plan rail, the AI assigned work like a colleague) in Open Harvey's own words, with an original mark. It copies no other product's logo, glyph, fonts, wording or screens.

It is shown live over Zoom at 1440 wide to engineers and technical leaders who will clone it, so it has to read at a glance. **One home per fact per screen**: a count, a status, a quote or a gate line is said once, in the place it belongs, and nothing narrates where to look.

**Key characteristics:**
- Black and white only: ink, white, a warm off-white, greys between, and a near-black sidebar. No hue anywhere.
- State is fill, weight and shape: a solid ink chip to act on, an ink outline to watch, a stone chip with a check when settled, plain text for the rest, a dashed hairline for provenance.
- Primary actions are ink buttons. The sidebar is the only dark surface.
- Source Serif 4 titles pages, matters and documents. Geist does everything else. Geist Mono marks ids and section cites.
- The plan shows in one place at a time: on the card while it waits, on the rail while it runs.
- The approval seal is the signature: shown once, at 56px, in the matter header, monochrome and shape-coded, with its counts in two plain lines beside it.
- Generous whitespace, hairline-ruled tables, no nested cards.
- The not-affiliated disclaimer (`DISCLAIMER` in `src/lib/company.ts`) is one quiet muted line on every content page and under the composer.

## Colors

Black and white: ink, white and a warm off-white, with greys between. Every text pairing meets WCAG AA.

### Neutral (the whole palette)
- **Paper** (warm off-white): the content ground, the top bar, the right rail and the output panel.
- **Surface / White**: sheets, cards, tables, inputs, the composer, selected tabs and outlined chips.
- **Stone**: Maya's message, settled chips, row and button hovers, phase rows, the cited passage's ground. **Stone Deep**: text selection.
- **Ink**: text, primary buttons, the send button, the copilot's mark, act-on chips, focus rings, the selected tab's underline, the seal's strokes. **Ink Hover**: the primary hover.
- **Muted**: secondary text, struck words and struck finished steps, icons at rest, provenance chips, the disclaimer.
- **Hairline** and **Rule**: every divider and border; rule is also the 1px underline under inserted redline words and the dashed provenance outline.
- **Highlight**: a grey, not a hue. The wash that fades behind a changed figure, and the mark on a cited passage's quoted words.

### The sidebar
- **Night**: the sidebar's ground, the app's one dark surface.
- **Night Raised**: the current item and item hovers. **Night Line**: the sidebar's dividers.
- **Night Muted**: item labels at rest, group labels ("Recents", "Spaces"), Maya's title.
- **On Ink** (white): the wordmark, the current item, and text on any ink fill.

### Named Rules
**The No Hue Rule.** Only the tokens above exist (`--color-*: initial` in `src/app/globals.css`). No hex value outside them anywhere: not in chips, not in the seal, not in the chat's theme.

**The Fill, Weight and Shape Rule.** State is drawn, never coloured. There are five chip treatments, and each always means the same thing:
1. **Act on** (solid ink, white word): what a person must act on: High, Sent back, Still deviates, Rejected, a verdict of Fix or Missing.
2. **Watch** (ink outline on white): what to watch or whose turn it is: Medium, Request, Your turn, Awaiting decision, Note, Not on file.
3. **Settled** (stone fill, ink word, a leading check): Pass, Done, Approved, Published v1.
4. **Quiet** (plain ink text, no box): Low, Queued, Working (with the spinner), After approvals, Proposed, Noted.
5. **Provenance** (dashed rule outline, muted word): who made a row or where it came from: "copilot · drafted", "edited by you", "Learned v1" (with the playbook's book glyph).

The **cite chip** ("§8.2", a file glyph, hairline border) is the only mono chip. In code the tone names stay `red`, `amber`, `plum`, `green`, `neutral` and `outline` (`src/components/ui/Card.tsx`). They are names, not colours.

**The One Ink Chip Per Event Rule.** A deviation takes the treatment of its risk everywhere a chip shows it (the plan step, the Tasks result, the contract's contents tag, the review table's risk): High acts on, Medium watches, Low is quiet. One function decides it: `findingTone` in `src/lib/review.ts`. A send-back is an ink chip once, in the matter's status chip. The approver's own route row says it with an outline. Tab counts are plain muted numbers, not chips.

## Typography

**Display and title font:** Source Serif 4 (with Georgia)
**Body font:** Geist (with ui-sans-serif, system-ui), tabular figures throughout
**Mono font:** Geist Mono, for ids and cites only; it never wraps

**Character:** a printed document's serif names the things that could be signed, and a quiet grotesque runs the workspace around them.

### Hierarchy
Six sizes, and nothing functional is smaller than 12.5px.
- **Figure** (serif, 40px/44px, tabular, `--text-figure`): the big numerals on the Analytics page's Before go-live and Since go-live sheets, with the label above in small muted and its basis below. A rate over fewer than 5 decisions shows as a count ("0 of 1"), never a percentage (`rateFigure` in `src/lib/analytics.ts`). A figure is not a title.
- **Display** (serif 500, 30px/36px, -0.01em): every content page's title (`Page` in `LegalApp.tsx`: "Vendor contracts", "Playbooks", "Agents", "Collections", "Analytics") and the matter's title in its header ("Acme Cloud · Master Services Agreement").
- **Title** (serif 500, 22px/28px): a document standing on its own, such as the contract and the proposed rule outside the matter view, or the matter's or the collection's name ("Vendor contracts 2026") at the top of its empty thread, and the Analytics page's since-counts. The thread's welcome line before a matter is open is Geist 600 at the same size.
- **Body** (Geist, 14px/21px): the thread, tables (review-table cells included), sidebar items, rail rows, buttons, card titles, page ledes.
- **Section label** (Geist 600, 14px, ink, sentence case): a section's own heading inside a sheet ("Deviations", "Goes to Acme once every approver has approved", "Approval route"), with its count as a plain muted number beside it.
- **Quote** (Geist, 13.5px/20px, ink): the contract's own words: the vendor quotes in the review table (in full, never clamped) and a redline's struck and inserted words.
- **Small** (Geist, 12.5px/17px): meta lines, chips, a collection column's question under its label, a cell's quoted words, rail metadata, sidebar group labels, the disclaimer.
- **Id** (Geist Mono, 12.5px): matter ids, rule ids, section cites, "PB-APR-01–03". The Agents page's tool names are the one mono run that wraps: plain ink text, comma-separated, never chips.

### Named Rules
**The One Display Title Rule.** Each view has one 30px serif title. Inside the matter view, the contract's and the rule's titles step down to 14px semibold serif under the matter's own title.

**The Section Label Is The Heading Rule.** Sheet sections are led by weight in sentence case. They are never all-caps, never tracked, and never an eyebrow above a heading.

The middle dot is for muted meta lines only ("Vendor contract · MAT-2026-047 · $720,000 over 36 months"). It never appears inside a title or a chip label, except the provenance chip "copilot · drafted" and a matter's own "vendor · document" title.

## Layout

- **Sidebar** (240px, night): the Open Harvey mark and the "Open Harvey" wordmark in Geist 600 in a 56px header; New thread, Agents, Collections, Analytics and Playbooks as 32px labelled items with 17px icons; then **Recents** (the threads, "Acme Cloud review", or "No threads yet") and **Spaces** (each open matter, then "All spaces"). Maya Chen · Senior Counsel sits at the foot behind a night-line rule. Her menu (a white raised popover) holds **Reset demo**. The current item sits on night-raised in white (in the collection's thread that is Collections, not New thread); the rest are night-muted. Playbooks carries a small white count only once a new send-back has made a proposal.
- **Fold:** while an output panel is open beside the thread, the sidebar folds to 56px. Its icons stay, with names as tooltips; the Spaces show as folder icons under a rule, and Maya shows as her initials. Below md (768px) the sidebar is a drawer over a 40% ink scrim, opened by the top bar's menu button.
- **Top bar** (48px, paper, hairline below): the breadcrumb (Spaces › the open matter) in muted, with the matter in ink. In the collection's thread it reads "Collections › Vendor contracts 2026". Elsewhere it shows the view's name. On narrow screens it holds the menu button and the rail toggle.
- **Content pages:** paper ground, 24px side padding, content capped at 1180px (Playbooks at 960px). A `Page` is a serif display title, one muted lede line, then white sheets. The disclaimer closes every content page in small muted text.
- **Assistant view:** the thread is centred on white, with the transcript and chips in one column of at most 720px. The thread's welcome names what it is about: the matter or the collection in serif title, or Maya's greeting. The composer lines up with the thread's cards (688px) with the disclaimer centred under it. The transcript fades out under the top bar. Each matter reads as its own thread. The right rail (320px, paper, hairline left) scrolls as a whole and holds Plan, Work and one closing line. Opening an output puts it beside the thread: the thread narrows to 440px, the rail steps aside, the sidebar folds, and the findings and redlines cards fold to one line each. A gate card waiting for a click closes the output so the card has the centre.
- **Output panel:** tabs in the matter's names and order (Review table · Contract · Approvals) in a 48px paper bar, with a close button. Beside the collection's thread the bar holds no tabs, only "Vendor contracts 2026 · Security evidence · 8 of 8 answered" (the name semibold, the rest small muted), and the table sits in one white sheet below.
- **Matter view (a Space):** capped at 1180px. The header sheet comes first, then a one-line note on the Tasks tab when work is ready for someone, then the tabs, then the tab's sheet.
- **Responsive:** below 1024px the right rail hides behind its toggle and an output takes the full width. Container queries collapse tables, and tables scroll inside their sheet, never the page.

**The No Inner Scroller Rule.** The rail and the sheets scroll as a whole. No text is cut by an inner scroller.

## Components

### Thread
- **Maya's message:** a quiet stone note on the right, with a hairline border and 8px corners (the lower right pinched to 2px).
- **The copilot's reply:** plain 14px ink text with no bubble. Cards sit inline in the same column. Turns keep one rhythm, so a message whose work is folded away takes no room.
- **The live line:** while a turn works, the thread shows one line, "Working: Security standards and audits · 8 of 17", with a spinner. The rail's Plan is the checklist. Once the turn replies, the line reads "Done in 11s · Read Acme Cloud · Ran 16 tasks · 7 deviations", or for the collection "Opened Vendor contracts 2026 · Filled 8 cells".
- **Edit event row:** a redline edit made in the review table shows as a hairline-ruled row, not a bubble ("You changed the §8.2 redline · 12 months of fees → 6 months of fees…", then "Saw your edit · re-checked"). The before value and its arrow never break apart.
- **Cards:** white, hairline, 8px corners, a body-semibold title, a small muted meta line, and at most one chip in the aside.
  - **Plan card:** "Review plan", with one gate line ("… · 17 tasks · nothing runs until you approve it"), the numbered rows with their rule ids, and **Approve plan** / **Not yet**. It folds to "Plan approved · 17 tasks".
  - **Findings:** "7 deviations", one row per deviation (its risk chip and topic, never truncated), and "5 pass, each cited in the Review table".
  - **Redlines:** "7 redlines", each a blackline of the vendor's own sentence.
  - **Re-check:** "Re-checked §8.2 after your edit" with "Still deviates" (an ink chip), and three rows: Playbook, Your redline, Route.
  - **Send for approval:** the route in order with the rule behind each approver, Maya's reason, and **Send for approval** / **Keep editing**. It folds to one line once sent.
- **Composer:** white, a rule border, 8px corners, a placeholder that follows the thread ("Ask about this matter…", "Ask about this collection…" or "Name a contract…"), and the 28px ink send button (stone while disabled). On focus the border turns muted and a soft 3px ink halo appears. Suggestion chips sit above it as white hairline labels (6px corners) without full stops, and offer only what the copilot could sensibly suggest. They hide while the copilot works or a card waits. The disclaimer sits under the composer in small muted text.

### Blackline
The vendor's words that Northstar changes are struck in muted. Northstar's inserted words are set in ink at medium weight with a 1px rule underline at a 3px offset, so a redline reads as legal markup, not a link. It is always the vendor's own sentence, never a summary.

### Right rail
- **Plan**, with its progress right-aligned in muted: "waiting for approval" while the plan card waits (no list, because the card holds the steps), then "16 of 17 done". It shows the running step (spinner), every step that found a deviation (never struck through), the learned step with its "Learned v1" chip, the next three queued steps, and task 17 held with a clock. The rest fold into "N queued" and "N done", and a clean finished step strikes through as it folds. "7 steps need a decision" sits under the heading once deviations appear. **Chips in one right-hand column:** each step's chip sits in a fixed right column (at least 52px, right-aligned) on the step's first line, so High, Medium and Low line up down the rail, and the title wraps to its left.
- **Work:** one row per object once it exists: Review table ("7 deviations · 5 pass"), Contract ("14 sections · 1,801 words"), Approvals ("Rachel → Jordan → Elena", then "1 of 3 approved"). Each row has a 16px ink icon, a medium label, and right-aligned muted meta.
- **Closing line:** "Checked against the vendor playbook (12 rules) and 1 learned rule · model: mock · scripted demo".

### Tabs
Matter tabs (Tasks · Review table · Contract · Approvals · Insights) and output tabs (Review table · Contract · Approvals) are both 32px with 8px corners. At rest they are muted, and they hover to stone. The selected tab is white in ink, with a hairline ring and a 2px **ink underline** drawn inside its bottom edge. Counts are plain muted numbers ("16 of 17", "7"). Arrow keys move between matter tabs.

### Matter view
- **Header** (a white sheet): the serif display title, with the status chip beside it only when the next step does not already say it (Sent back, Approved, Rejected). Under it comes one meta line ("Vendor contract · MAT-2026-047 · $720,000 over 36 months · pricing holds to Nov 13 (8 days)"), then the vendor, product and business owner in small muted text. On the right sit the seal with its counts and, behind a hairline, "Next step".
- **Next step:** only an actionable state gets a button (Review with the copilot; Send for approval, with "to Rachel, Jordan, Elena" under it). A waiting state is a quiet ink line ("Approve the plan in the copilot", "With Rachel Adler", "Resubmit to Jordan Blake"). It is never a disabled button.
- **Note:** one raised line on the Tasks tab, from the copilot's mark: "Rachel, Maya needs your approval on the Acme Cloud review. · 10:00 am", with **Open approvals**. After a send-back it quotes the approver's words.
- **Tasks:** a small toolbar (All tasks · Needs a decision · Done, and Mine) above a table of Title · Result · Assignee · Rule · Cite, grouped by phase. Result uses the review table's words. The copilot is the assignee of its work ("Copilot", with its mark), and people are the assignees of their decisions, shown with their initials.
- **Matter queue** ("Vendor contracts"): an "Open" sheet with one set of columns (Total value, Pricing holds until) and an ink **Open** button. Below it sits "Reviewed before go-live · imported Monday · 6", one hairline-ruled line each, outcomes only ("Signed Oct 2 · 1 send-back · Jordan Blake").

### Review table, contract, approvals, insights
- **Review table:** "Review table", "Vendor playbook 2026 · 12 of 12 rules checked". It groups rows into Deviations (highest risk first), Learned requests, Passes the playbook, and Context, no rule, each on a stone group row with its count. The columns are Topic (with the rule id in mono), What Acme wrote (its summary, then its words in full in 13.5px), Playbook position, Proposed redline (an editable field with a rule border and 5px corners that grows with its text, tagged "copilot · drafted" or "edited by you", with "Still deviates" when it no longer meets the rule and Maya's reason under it once given), Risk, and Cite.
- **One name per clause:** every surface names a clause by its topic from one source (`TOPICS` in `src/lib/playbook.ts`). Only the contract viewer's contents list keeps the document's own headings.
- **Cite chip:** the first click opens a raised 360px peek with the passage and its quoted words marked. A second click, or "Open in the contract", opens the full viewer on it. With `openable={false}` (a collection document, which has no matter to open) it peeks only and offers no "Open in the contract".
- **Contract viewer:** a contents list whose section titles wrap (never truncate) and carry their loudest finding as a chip, and the document (max 78ch). Opening a citation brings the passage's whole section in under a sticky "Showing §8.2 · cited by PB-LIAB-01" bar, with the passage on stone and its quoted words marked with the highlight and a 1.5px ink underline.
- **Approvals:** "What Northstar gives up, and why" (the risk chip, the topic and cite, Northstar's position, then the playbook's ask and Maya's reason), "Goes to Acme once every approver has approved" (each redline as a blackline with its cite), and the **Approval route**, which is the decision record. Each approver row shows their initials, name and role, decision time and decision chip (Approved settled, Sent back outlined, Queued quiet), and their comment in their own words, once. Acting as Rachel Adler, General Counsel, the route offers the comment and Approve / Send back / Reject. Reject is the danger button: white with a rule border and a rule underline on the word, never red.
- **Insights:** before a new send-back, "No new send-backs since go-live". After one, the headline at 14px semibold with the signal from the data, then Dismiss and **Publish to the copilot**, acting as Rachel Adler. The proposed rule is set as a document on paper beside the evidence in the approvers' words. Once published it carries one settled chip, "Published v1".

### Agents, Collections, Analytics
- **Agents:** three white cards in a row from the @4xl container (Vendor contract review, Collection review, Send-back analysis; `AGENTS` in `src/lib/agents.ts`). Each has a 32px stone icon tile with an ink icon, the name in body semibold, a small muted "Today: …" line counted from the store (`agentToday`), what it does in ink, then behind a hairline three small muted labels with ink values: Reads, Waits for a person (one line per gate), and Tools it calls (Geist Mono small ink, comma-separated, no chips). The footer, behind a hairline, reads "Opens with “…”" in small muted with the line in ink, beside a small primary **Start**. Start opens a new thread with that line as its only suggestion chip; Collection review opens the collection's thread.
- **Collections:** one sheet, "Vendor contracts 2026": its name semibold, a small muted meta line ("N documents (N signed, N in review) · N questions · nothing asked yet"), a primary **Ask in a thread** with its icon, then the wide review table. Every column shows, each header its label in ink with the question under it in small muted. Each row is the vendor in medium ink, the agreement, and its status and data in small muted ("In review · customer data"). Before anything is asked one muted cell spans the empty cells. Beside the collection's thread the same table narrows to the columns being answered, with a small muted footnote under a hairline naming the others.
- **Collection cell:** empty ("—", muted), working (the spinner and "Reading" in small muted), or filled. A filled cell holds the answer in medium ink, then a note in small muted text beside it. The security column answers whether Security has the evidence (`securityStatus` in `lib/collection.ts`), while its quote and cite show what the contract says. A signed data processor whose evidence arrived only after a send-back reads "Received after a send-back", with the note "Received Apr 17; the contract doesn't require it" (the date from the review history). A contract in review reads "Ask before signing" or "Requested with the redlines (PB-SEC-01)". A signed vendor with customer data and no evidence anywhere would carry an ink-outline "Not on file" chip (watch). Then come the contract's quoted words in small muted, in curly quotes, followed by a cite chip that only peeks. A filled cell settles in with the row-settle motion.
- **Analytics:** sheets in two columns from the @4xl container, each led by a section label and a sentence-case small muted meta line ("The 6 reviews imported on …", "Since Monday, Nov 2"). **Before go-live** and **Since go-live** hold figures in a two-column grid; Since go-live adds, behind a hairline, a since-counts row (Tasks run, Redlines, Human edits, Sent to approve, Rules learned) in serif title, 3 columns on a phone and 5 from the @xl container. **Why reviews come back**: one row per reason with its counts right-aligned in small muted and a 12px bar, solid ink for before go-live and an ink outline on white for since, with a legend. **Suggested next steps**: a numbered list, its numbers in small muted mono. **Decision log**: a hairline-ruled table (#, Who with a 24px avatar, name and role, Decision, Matter, When right-aligned in small muted).

### Marks
- **Open Harvey mark:** an open ring (a circle with a gap at its upper right) around one seal petal, drawn in currentColor at 24px: white on the sidebar and ink elsewhere. It is original to this demo (`OpenMark` in `src/components/ui/LegalTags.tsx`).
- **Copilot mark:** a 20px ink circle, in the same family as people's initials, holding one white seal petal (`CopilotGlyph`). It is the copilot's own mark wherever it did the work, distinct from the product mark, and there is no sparkle anywhere.
- **People:** initials in a round avatar, either ink on stone or ink on white with a hairline (Maya in the sidebar).

### Approval seal (signature)
Shown once, in the matter header, at 56px, monochrome (`src/components/ui/ApprovalSeal.tsx`). There is one petal per playbook check, in playbook order from the top, clockwise, and shape carries every state. A pass is a filled ink petal. A deviation is a hollow ink petal with a notch cut in its tip. A learned request is a hollow muted petal. A check not yet run is a faint hairline. The frame is one muted hairline circle. Each approver who has decided adds a ring outside it, innermost first: solid ink for approved, ink broken in three for a send-back, broken in six for a rejection. The centre dot inks in once every approver has approved. **Two-line counts caption:** to its left, right-aligned in small ink text, the checks on one line ("5 pass · 7 deviate") and, once sent, the approvals on their own line under it ("1 of 3 approved"). Each line stays whole and never wraps. Screen readers get the same facts as a sentence.

## Elevation & Depth

The system is flat. Sheets are white on paper behind a hairline, and depth comes from tone (night, paper, white, stone), not from shadow. One raised shadow (`0 1px 2px` plus `0 4px 12px -6px`, both of ink at 5–8%) marks only what floats or reports news: the matter note, Maya's menu, the cite peek, and the chat's scroll-to-latest button. The composer carries a 1px rest shadow, and its focus is a 3px ink halo at 6%. The selected tab's ring and underline are drawn as inset strokes, not elevation.

**Shapes:** chips, buttons, fields and the send button have 5px corners; sheets, cards, tabs, sidebar items, the composer and Maya's message have 8px corners (her message's lower right is pinched to 2px). The copilot's mark, people's initials and the Playbooks count are round. Every border is 1px; the only dashed border is the provenance chip.

**The Flat Sheet Rule.** No shadows on sheets, and no nested cards.

## Motion

- **Streaming:** the thread's replies stream in word by word.
- **Strike:** a clean plan step that finishes while on screen strikes through once (520ms, cubic-bezier(0.16, 1, 0.3, 1)), then folds into the done group. A step with a risk chip, and the learned step, never strike.
- **Row settle:** a review-table row, or a collection cell, that arrives while on screen settles in (opacity 0.35 to 1 with 2px of rise, over 520ms).
- **Figure highlight:** a changed figure gets the grey highlight wash, fading over 1800ms, once. It never plays on first render. When a run with a learned step starts, that step's title in the rail gets the highlight once.
- **Seal ink:** a changed stroke draws on over 900ms, staggered by 45ms.
- **Spinner:** 900ms linear, only on running work.
- **State changes:** colour transitions of 120–150ms on hovers and the composer's focus.
- **Reduced motion:** all of these are removed, and everything is visible by default.

## Browser surfaces

A paper canvas with ink text in Geist and tabular figures. Selection is ink on stone-deep, with an ink caret. Focus is a 2px ink outline at a 2px offset; fields draw a muted border and a soft ink halo instead. Scrollbars are thin, in rule on transparent. Links have a 1px underline at a 3px offset. The chat library's theme variables map onto the same palette, with ink as its primary and white on it.

## Do's and Don'ts

### Do:
- **Do** draw state with fill, weight and shape: solid ink to act on, an ink outline to watch, stone with a check when settled, plain text for the rest, a dashed hairline for provenance.
- **Do** use ink for the one primary action on screen, and a quiet line, not a disabled button, for a waiting state.
- **Do** open every content page on its 30px serif title and close it with the disclaimer line.
- **Do** say each fact once per screen, in the place it belongs.
- **Do** cite the rule id and the passage id beside every finding, in mono.
- **Do** strike the vendor's own words in a redline, never a summary of them.
- **Do** derive every count from `matterCounts`, so the badge, the table, the seal caption and the chat agree.
- **Do** give the copilot an assignee's place: its mark and "Copilot" in the task list, and its notes addressed to people by name.

### Don't:
- **Don't** use any hue, or any hex outside the palette: no coloured chips, rails, buttons, seal petals or chat theme.
- **Don't** make a second dark surface; night belongs to the sidebar alone.
- **Don't** use an ink chip more than once for one event, or show state as coloured text.
- **Don't** narrate the layout ("in the plan on the right", "in the thread", "via the card").
- **Don't** show the plan in two places at once, or cut text with an inner scroller.
- **Don't** nest cards, or put shadows on sheets.
- **Don't** set a section label in all caps or as an eyebrow above a heading.
- **Don't** copy another product's logo, glyph, fonts, wording or screens. Borrow patterns only, and keep the product's name to Open Harvey and its own mark.
