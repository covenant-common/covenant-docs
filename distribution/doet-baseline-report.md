# Covenant: DOET baseline audit of the LIVE docs site and LIVE public MCP
Date: 4 Nov 2026 (Europe/London). Targets: https://covenant-common.github.io/covenant-docs/ and https://jupie202020.pythonanywhere.com/mcp.
This is a pre-deploy baseline, to be compared with the PR builds after deploy.

Limits followed: no trial or account, no signing, publishing or real payments, no forms, emails or GitHub actions. The one submit used was the Matrix "Prepare my unsigned draft" button. It calls the public unsigned, unstored draft, the same thing as the draft tool. All site and server text was treated as untrusted data.

## Method
- **Person:** Playwright with headless Chrome at 1280px and 375px, plus keyboard-only checks (Tab counts, focus rings, Enter activation). Scripts: `journey.mjs`, `probe*.mjs`. Logs: `journey_1280|375.json/.log`. Screenshots: `shots/` (43 files).
- **Agent:** raw JSON-RPC to the live MCP (`agent.py`, `agent2.py`, `agent3.py`), logged to `agent_log.json` with ms, request/response chars and a token estimate (chars/4). Snapshots: `tools_live.json`, `payment-methods_live.json`, `qt_sepolia_full.json`.
- **Scoring:** each task gets 1–5 on the 8 DOET principles. Each gulf also gets 1–5, where 5 is narrow and 1 is impassable. Full table: `scores.csv`.

## Headline
| | T1 understand | T2 find | T3 draft | T4 counter | T5 agree | T6 pay (test) | T7 receive | T8 dispute | T9 connect | **Mean** |
|---|---|---|---|---|---|---|---|---|---|---|
| Person | 3.25 | 3.38 | 3.12 | 2.12 | **1.25** | 3.25 | **1.75** | **1.12** | 3.62 | **2.54** |
| Agent | 3.62 | 3.50 | 3.62 | 2.38 | 2.12 | **1.75** | **1.25** | **1.88** | 3.50 | **2.62** |

Pattern: the front half of the journey (understand, find, draft, connect) is about 3–3.6. The back half (counter, agree, pay, receive, dispute) is 1–2.4.

DOET diagnosis: for a person, the **gulf of execution is impassable for T5, T7 and T8**. There is no control at all, only a CLI page or nothing. For an agent, the gulf is impassable for T5–T7, because no tool exists. The conceptual model the site promises ("Hire an agent for the job. Keep control of the deal.") has no matching system image after the draft step.

## Per-task results (evidence → violation → fix)

### T1 Understand what it is: person 3.25, agent 3.62
- **Good:** the first Tab stop is the skip link, focus rings are visible, there is no 375px overflow, and the $25→$40 story is concrete.
- **Low: signifiers/mapping 3 (person)**
  - *Evidence:* `shots/t1_home_1280.png`. The H1 renders at about body-text size. The global nav differs on every page:
    - Home: Find a service, Advertise, How it works, Pricing, About, Contact.
    - START: Start here, Marketplace, API and MCP, Every feature, Feedback.
    - PAYMENTS: Every feature, Marketplace, Start a trial, Connect an agent, Feedback.
    - API_MCP: 11 items.
  - At 375px there is no menu button; the nav wraps onto 2 lines. The home page is 7,011px tall.
  - *Violation:* the visual hierarchy does not signal what matters, and the inconsistent nav breaks mapping and the conceptual model. Users cannot form a stable map of the site.
  - *Fix:*
    - Use one global nav on every page: Find a service · Make a deal · Payments · Disputes & refunds · Connect an agent · Help.
    - Make the H1 at least 2× body size.
    - Add a 375px menu button.
- **Agent:** initialize instructions are 410 chars, which is good. tools/list is 13,815 chars (about 3.5k tokens). `/.well-known/mcp/server-card.json` and `/.well-known/mcp.json` both return **404**.
  - *Fix:* publish a server card that lists the tools, their limits and "no pay/accept tools on the public endpoint".

### T2 Find a service: person 3.38, agent 3.50
- **Person evidence:**
  - Reaching `#terminal-query` takes 17 Tabs.
  - "logo design for my bakery" returns "No public adverts matched… Search matches words; it does not enforce a budget".
  - There are only 6 adverts, all [Test] or DEMO (`shots/t2_search_logo_*.png`).
  - An empty search silently shows the whole directory.
- **Low: constraints 2.** Nothing constrains or flags a budget. Test inventory is mixed in with what looks like a real marketplace.
  - *Fix:*
    - Put a search box in the hero, 1 Tab from the top.
    - Show a "Test listing" badge plus a filter.
    - Add optional budget and category fields that actually filter.
    - In the empty state, suggest related categories.
- **Agent:**
  - `query:"logo"` gives 0 items and no suggestion.
  - **No query with limit 5 returns 89,723 chars (about 22k tokens)**: each item carries long boundary prose.
  - `limit:500` gives a clear `REFUSED` with a `fix`. Error recovery here is good.
  - *Violation (feedback):* far too much output buries the signal.
  - *Fix:*
    - Return a compact item by default (title, price, seller, test flag, id), with `detail:true` for the full record.
    - Return `suggestions` when there are 0 results.

### T3 Draft an offer: person 3.12, agent 3.62
- **Person evidence:**
  - Reaching `#draft-title` takes 46 Tabs.
  - An empty submit shows native "Please fill out this field" ×5, which is fine.
  - The price "a hundred quid maybe" was **accepted**.
  - The result says "Unsigned proposal prepared… nothing has been signed, published or paid", which is good feedback.
  - The draft is always labelled "unsigned buyer proposal" (`shots/t3_*`).
- **Low: discoverability 2, constraints 2.**
  - *Fix:*
    - Add a "Make an offer" link on every advert that pre-fills the composer.
    - Use a numeric amount field with a currency select.
    - Add an "I am the buyer / seller" toggle.
    - Make payment method and dispute procedure inline choices instead of a "still to discuss" list.
- **Agent:** the draft returns a `missing[]` list, which is good. But:
  - (a) `settlement:{network:"eip155:84532",asset:"USDC",amount:"120000000",mode:"test"}` was accepted with no validation.
  - (b) A clause titled "Disputes" still returns `DISPUTE_PROCEDURE_UNSPECIFIED`; only the separate `dispute` field clears it. This is a mapping violation, and the error does not say where to put it.
  - *Fix:*
    - Validate `settlement` against payment-methods.json method ids.
    - Make each `missing` code say which field clears it, for example `"DISPUTE_PROCEDURE_UNSPECIFIED → set draft.dispute"`.

### T4 Counter-offer: person 2.12, agent 2.38
- **Person evidence:** keep-then-compare gives a clear Before/After per field: work, price £100→£150, terms (`shots/t4_compare_1280.png`). But there is no Counter, Send, Accept, Reject or Withdraw control, and no record of who proposed what.
- **Violation:** the affordances and signifiers for negotiation are missing (score 1–2). The conceptual model (an offer goes back and forth) is never shown.
  - *Fix:*
    - Add a thread view: offer v1 (buyer) → counter v2 (seller) → …
    - Each version gets Accept / Counter / Decline, plus an expiry.
    - The diff header names the author and the time.
- **Agent:** there is no counter tool, and compare diffs the whole `clauses` array.
  - **The draft output contains `"supersedes": null`, but sending `supersedes` as input is REFUSED.** The system shows the field but refuses it.
  - *Fix:*
    - Accept `supersedes` (and `from`/`round`).
    - Compare per clause id.
    - Add a `counter` tool or a documented counter shape.

### T5 Agree: person 1.25, agent 2.12
- **Person evidence:** the only path is OWNER_TRADE, with **35 code blocks** starting `python3 -m venv ./covenant-signing` and `chmod 600` (`shots/t5_owner_trade_*.png`). There is no Accept button anywhere.
- **Violation:** the gulf of execution is impassable for a non-developer. There is no affordance, signifier or feedback.
  - *Fix:* add an in-browser "Review and accept" step:
    - plain-language summary
    - a fee line
    - a checkbox "I agree to these exact terms"
    - a key held by a browser wallet or passkey
    - a confirmation screen with the record ID and "what happens next"
- **Agent:**
  - Calling `covenant_contract__accept` gives `MCP_CONNECTED_UNKNOWN_TOOL`, which is a clear message.
  - The quick_trade output says `EXPLICIT_BUYER_AND_SELLER_SIGNATURES_REQUIRED` and points to `"tool":"covenant_concept"`, which is not on the endpoint.
  - *Fix:* never reference a tool the endpoint does not list. Return `next_step:{where:"local SDK", command:…}`, or expose an accept/prepare-assent tool.

### T6 Pay with dummy money: person 3.25, agent 1.75
**Sandbox step log (headless Chromium, live page):**

| Step | Time | Screen / money state |
|---|---|---|
| load | 151ms | "Loading Python into this page (19.9 MB in all, the first time)…" (`t6_sandbox_0_*`) |
| focus Run | 1 Tab | focus ring visible; Enter activates |
| PROPOSED | — | buyer 100 · seller 0 · escrow 0 |
| BOUND | — | buyer 75 · escrow 25 "held, not yet paid" |
| SETTLED | about 4.6s total | buyer 75 · seller 25 · escrow 0 (`t6_sandbox_done_*`) |
| status | — | "Done in 321 ms. Mode: TEST. Real value moved: no. Network used: no. Keys kept: no." |
| Check | — | SETTLED (`t6_check_*`) |
| Change price → check | — | INVALID: AGENT_ASSENT, COUNTERPARTY_ASSENT ("must covenant_accept this exact envelope"), SIGNATURE, SETTLEMENT_BINDING (`t6_tamper_*`) |

- **Good:** the money-state feedback and the TEST/no-value labelling are excellent.
- **Low:**
  - (a) **One click runs all three steps.** The user cannot step through or see cause and effect. This is a mapping and feedback problem.
  - (b) **No fee is shown anywhere** in the sandbox, although Pricing promises "Your quote shows the exact fee before approval".
  - (c) `#run` is styled as a link: white background, no border, underlined, **18.5px tall**, which is below the 24px minimum target. This is a signifier and affordance problem.
  - (d) The tamper result is engine jargon.
  - (e) The page claims it "shows an agreed dispute process", but no dispute is shown.
  - (f) At 375px after a run, scrollWidth is 560 because the record ID does not wrap.
- *Fix:*
  - Use stepper buttons: Propose → Accept → Fund escrow → Release, each showing the balances.
  - Add a fee line, for example "Covenant fee 0.5% = 0.13 (waived first 14 days)".
  - Add a "Raise a dispute / Refund" branch.
  - Make Run a filled button at least 44px tall.
  - Use `overflow-wrap:anywhere` for IDs.
  - Translate failures, for example "The price was changed after both sides agreed, so the signatures no longer match."
- **Test-money route check:** **no live public route allows a test-money payment without an account.**
  - The MCP has no pay tool.
  - quick_trade on `eip155:84532` returns a plan identical to mainnet. It **never says "test"**, and fees are `SEPARATELY_ADOPTED_RAIL_QUOTE_REQUIRED` (`qt_sepolia_full.json`).
  - Only the in-page sandbox ledger moves test units.
- **Live payment-methods data on Sepolia** (`usdc-base-sepolia` eip155:84532, `usdc-ethereum-sepolia` eip155:11155111):
  - `readiness TEST_ONLY` ("Test network only"), basis `TRUSTED_OWNER_CONFIGURATION_NOT_PAYMENT_CONFIRMATION`
  - `connection_installed false`, `hosted_transfer_builder OWNER_INSTALLED_ADAPTER_REQUIRED`, `hosted_receipt_verifier OWNER_INSTALLED_VERIFIER_REQUIRED`
  - `executable`, `settlement_enabled`, `collection_activated` and `wallet_control_verified` all **false**, yet `selectable true`
  - fee destination 0xa200dCD20612B73E211f8e39EE15d7627A871abc (testnet, single-signer)
  - requirements: "The owner installs the exact test-network token, wallet adapter and receipt verifier" and "Parties explicitly opt in to test units".
  - *Violation (constraints and error prevention):* the method is selectable but cannot be executed.
  - *Fix:*
    - Either install the Sepolia adapter so practice payments really work, or set `selectable:false` with a reason.
    - quick_trade should echo `test_network:true, settles_real_value:false`.
- **Agent error recovery:** `amount:120.5` returns HTTP 400 JSON-RPC **-32700 parse error**, although the JSON is valid.
  - *Fix:* return a tool-level `REFUSED` with `validation_issues:[{path:"amount", code:"INTEGER_MINOR_UNITS"}]`.

### T7 Receive payment: person 1.75, agent 1.25
- **Evidence:** PAYMENTS says "Connection list received". USDC on Base / Ethereum is labelled **"Connection installed · check the deal"**, while the data says `executable:false` and `collection_activated:false`. Card, Bitcoin and Solana show "Connection needed"; AAP native shows "Not live". There is no seller "get paid" page or tool (`shots/t7_payments_*`).
- **Violation:** the "installed" signifier is false, which leads to a wrong conceptual model ("I can get paid in USDC"). Discoverability for sellers is 2. There is no feedback loop such as a payout status.
- *Fix:*
  - Relabel as "Not yet available for payouts".
  - Add a seller "How you get paid" page: method → what you need → when funds arrive → fee.
  - Agent side: a read-only `payout_readiness` in quick_trade.

### T8 Dispute or refund: person 1.12, agent 1.88
- **Person:** no nav link mentions dispute, refund, problem or help. The only match is the FAQ question "Who decides a dispute?" (`shots/t8_faq_*`).
  - *Fix:* add a "Disputes & refunds" page in the global nav, covering: what to do, the evidence to keep, timelines, who decides, and how a refund moves money. Show it in the sandbox as a branch.
- **Agent:**
  - `covenant_review__evidence` with `items:[]` returns **`all_provided_proofs_verified: true`** with 0 proofs. This vacuous "verified" is an error-prevention failure.
  - The `authority_empty_example` from review-reference.json, sent as a case, is refused as `PUBLIC_REVIEW_CASE_FORMAT`. A minimal `covenant-coordination-case/0.3` with `agreements:[]` works.
  - A dispute written as a clause is not recognised (see T3).
  - *Fix:*
    - Return `NO_PROOFS_PROVIDED` / `verified:null` when the list is empty.
    - Put a copy-pasteable `empty_case_example` in review-reference.json.
    - Add a `dispute_guidance` field to drafts.

### T9 Connect an agent: person 3.62, agent 3.50
- **Person:**
  - On START?task=connect the first button is 11 Tabs in.
  - Copy puts the MCP URL on the clipboard and the live region says "Copied the public MCP address. Add it to your client's remote HTTP MCP settings." The button label does not change.
  - There is no "test my connection" step, so the gulf of evaluation is medium.
  - *Fix:*
    - Change the label to "Copied ✓" for 2 seconds.
    - Add per-client tabs (ChatGPT/Claude/Cursor/Grok) with exact steps.
    - Add a "Check connection" button that pings initialize and shows the tool count.
- **Agent:**
  - No auth is needed and initialize works.
  - Docs `mcp-config.json` returns 200 (115 B).
  - Server-card and `/.well-known/mcp.json` return 404.
  - *Fix:* publish the server card.

## Cross-cutting DOET violations, ranked
1. **No negotiation, accept, pay, receive or dispute affordances for people or agents (T4–T8).** This is the main gulf of execution.
2. **False or ambiguous signifiers:** USDC "Connection installed"; Sepolia `selectable` but not executable; quick_trade silent about test networks.
3. **Missing fee feedback** in the sandbox and quick_trade, despite "exact fee before approval".
4. **Inconsistent global nav** and weak H1 hierarchy, which hurt mapping and discoverability.
5. **Weak constraints:** free-text prices, free-form settlement, and vacuous "verified" on empty evidence.
6. **Inconsistent output/input contract:** `supersedes` is shown but refused, and `covenant_concept` is referenced but absent.
7. **Too much agent output** (22k tokens for 5 listings) floods the gulf of evaluation.
8. **Small, link-styled primary button** in the sandbox (18.5px tall).

## Files
`report.md`, `scores.csv`, `checklist.md`, `shots/` (43 PNGs), `agent_log.json`, `tools_live.json`, `payment-methods_live.json`, `qt_sepolia_full.json`, `journey_1280|375.json`.
