# Covenant DOET round 8: average person and naive agent (re-measured)

**Builds tested locally:**
- Server: draft PR #201 @ 221df81e. It was rebuilt from compare patches read through the cursor-github MCP, with blob SHAs verified, and served on :8772.
- Docs: draft PR #15 @ 7e26e58, rebased on #13 @ 06131790, served on :8795 and :8796.

**Live (read-only):** https://jupie202020.pythonanywhere.com and covenant-common.github.io/covenant-docs.

**Limits kept:** nothing was signed, published, paid, emailed or pushed. I did not use /mcp/account/v1, any account or trial, or any form. I did not use any number from a PR body; every score below was re-measured.

## Step 1: registry sync
- `capability_registry.server.json`: **10,604 bytes**, git blob 66b85b65…
- `python3 tools/sync_capability_registry.py --file ../capability_registry.server.json`: **exit 1**, "unrecognised capability registry shape" (output in step1_out.txt).
  - Cause: the server file now has `public_tools: "read_only"` (a string, no tool names), plus new `sandbox` and `can_*` top-level keys. The sync script expects a list of tools.
- `check_agentic_claims.py` and `check_registry_drift.py`: both **FAIL, exit 1**. They fail closed, which is correct.
  - The message is misleading: it says the file is "missing server registry … from draft PR 201", but the file was supplied and only its shape was rejected.
- Mismatches that remain once you look past the sync failure:
  - `distribution/capability-registry.json` is still the 9-tool projection. "nine tools" appears in 7 docs files (llms.txt, MCP_DISCOVERY, PUBLIC_TASKS, API_MCP, EXPLORE, CONNECTORS, plugins README). The server exposes 10.
  - The server says `sandbox.works_in_test` includes release, refund and reclaim. The docs AGENTIC_COMMERCE and DISPUTES pages say release, refund and reclaim "stay planned". I verified that release and refund do move test money on #201.
  - The mcp-2026 row is "Test mode", but its text says "server/discover is not offered here". The server does offer it.
- **Root-cause fix:** make the sync script accept `public_tools` as a string enum and read tool names from `server-card.json` or tools/list. Generate the docs status rows and tool counts from the synced file instead of prose. Make the check report "unrecognised shape" instead of "missing".

## Headline (1–5, local builds)
| Persona | Baseline | Round 7 | **Now** |
|---|---|---|---|
| Person (desktop 1280 + 390px) | 2.54 | 3.28 | **3.44** |
| Agent (naive, MCP 2025-11-25 + 2026-07-28) | 2.62 | 3.53 | **3.49** |

**Person.** Most round 7 person failures are fixed: single-click Propose, correct stages, consistent amounts, a per-field price error, a version thread with author and time, record rec-1, fixture listings with a Test badge, and the table fitting at 390px. Three new problems hold the score down:
- Step-nav words break mid-word at 390px on every page.
- "TODO(owner)" text is visible on the Disputes and Seller pages.
- The conceptual model got worse: "held by escrow" is followed by "no rail holds funds", "Hosted USDC has no refund", and the fee shows 25.125 against the server's 25.13.

**Agent.** Every round 7 negative case is now refused, and money really moves. But new authorization holes of the same class appeared (buyer self-resolve, buyer void after delivery, revoke that does nothing, and the agent approving its own mandate). The sandbox also isn't a real MCP endpoint. These offset the gains, so the agent score is flat to slightly down.

**Live:** still at baseline. The server card, /sandbox/test-tokens, /mcp/sandbox/v1, DISPUTES.html and AGENTIC_COMMERCE.html all return 404 on live, and live llms.txt still says "nine-tool". The deploy gap is unchanged.

### Per principle (round 7 → now)
| Principle | Person | Agent |
|---|---|---|
| Discoverability | 3.78 → 3.78 | 3.44 → 3.56 |
| Affordances | 3.44 → 3.67 | 3.33 → 3.33 |
| Signifiers | 3.33 → 3.56 | 3.44 → 3.56 |
| Mapping | 3.22 → 3.33 | 3.44 → 3.56 |
| Feedback | 3.11 → 3.56 | 3.89 → 3.89 |
| Constraints | 3.22 → 3.44 | 3.44 → 3.33 |
| Conceptual model | 3.11 → 3.00 | 3.44 → 3.11 |
| Error prevention/recovery | 3.00 → 3.22 | 3.78 → 3.56 |

**Checklist:**
- People pass **16/20**, up from 11:
  - Pass: P1–5, P7–17.
  - Partial: P6 (no-results shows generic help), P18 (Owner TODO), P20 (the check can't reach live from a local preview).
  - Fail: P19 (TODO(owner) day counts).
- Agents pass **13/15 locally**, up from 9/10:
  - Pass: A1–7, A9–13, A15.
  - Partial: A8.
  - A14 was not re-run.
  - A1 still fails on live.

**Gulfs:**
- Execution is now small for an agent once it has a token.
- Execution is large for a generic MCP client: the sandbox has no `initialize` or `tools/list` and no input schemas.
- Evaluation is medium:
  - Every sandbox `money` block is null.
  - The state stays "delivered" after a full capture.
  - receipt.verify says "Nothing was signed or paid" after 100 was captured.

## Status of each round 7 finding
| # | Round 7 finding | Now | Evidence |
|---|---|---|---|
| 1 | Proposer can accept own offer | **Fixed** | buyer/seller self-accept → ACCEPT_RECIPIENT, both PVs (scen A) |
| 2 | fund with no deal | **Fixed** | DEAL_TRANSITION; fund before mandate → MANDATE_REQUIRED (scen B) |
| 3 | capture before delivery | **Fixed** | CAPTURE_BEFORE_DELIVERY (scen A) |
| 4 | resolve(refund) moves no money | **Fixed** | resolver refund → buyer 1000, seller 0, also after a partial capture of 60 (C, C2) |
| 5 | release and reclaim 503 | **Release fixed** (remainder 20 → seller; final 880/120). **Reclaim is untestable**: it is refused with RECLAIM_EARLY, `now` is ignored, and there is no clock tool (Medium) | scen A, G |
| 6 | Mandate not checked; approve URL 404 | **Partly fixed.** Over-mandate → MANDATE_REJECTED (150 vs 100). The approve URL `/sandbox/approve/<hash>` **still returns 404**, and the agent approves its own mandate | B2, curl |
| 7 | One global Desk for all tokens | **Not fixed.** All test tokens and 'reader' map to tenant 'demo'. Agent B sees agent A's deal, and B's offer → DEAL_TRANSITION | scen H |
| 8 | Naive agent can't get a token | **Largely fixed via the server card.** It has `test_tokens`, and the 401 says "GET /sandbox/test-tokens, then a Bearer test-role token". **Not fixed via llms.txt or docs** (0 mentions). The RFC 9728 resource_metadata points at account/v1, not the sandbox | curl |
| 9 | Authority PASS with no amount | **Fixed** (NOT_EVALUATED). A draft priced "GBP 120" is still NOT_EVALUATED because the amount isn't read from the agreement | run_*.txt |
| 10 | Fee rounded up to 1 | **Fixed on the server** (120 at 50 bps → 0.6). 25 → 0.13. **The docs (22 files) and the browser sandbox say 25.125 / 0.125** | module test, sb_fee25_390.png |
| 11 | Sepolia test_network:false | **Fixed** | A9 |
| 12 | settlement {mode:test} accepted | **Fixed**: refused with a fix | A6 |
| 13 | next_actions names a non-tool | Partial: the sandbox gives next_action, the public server has no accept/pay tool | A8 |
| 14 | "logo designer" 0 hits | **Fixed**: 1 hit (stemmed); a sentence query → 5 | run_*.txt |
| 15 | review empty_case | Not re-run | — |
| 16 | payment-methods.json 404 locally | **Fixed** (200) | — |
| 17 | 2026: no schemas, HeaderMismatch with no fix, server card | **Server card fixed** (lists 2026-07-28 and the sandbox). The 2026 public schemas are weaker (`{}` types, additionalProperties:true), and 2026 error content text is "" | tools_p221_* |
| 18 | Misc: fake hash, SIGNED_TEST vs signed:false, partial-capture prompt | Fake hash is now "unverified" (fixed). receipt.verify "Nothing was signed or paid" vs signed:true/SIGNED_TEST is **still contradictory** | scen C |
| 19 | Person sandbox: double Propose, stale stage, 25 vs 20, REFUTED | **Fixed** (single click, ACCEPTED, 20/25 consistent). The refund still shows "Stage RELEASED" | sb_d15_*, journey |
| 20 | Bad price → "Choose a currency." | **Fixed**: per-field "Use a number and a currency, such as USD 25" | t3_bad_price_390.png |
| 21 | No version thread / no record id | **Fixed** in the sandbox: ISO time + author per version, "Sample record rec-1. Next: …" | sb_d15_3_accept_390.png |
| 22 | Disputes: no day counts | **Not fixed, and worse**: the page now shows "Dispute window: TODO(owner) days" ×3 | t6_disputes_todo_390.png |
| 23 | #13 DELIVER/RESOLVE redirects | Fixed in #15. #13 still redirects FIND/AGREE/PAY (expected; superseded) | pages15.json |
| 24 | AGENTIC_COMMERCE clipped at 390 | **Fixed** (stacked cards, scrollWidth = 390) | d15_AGENTIC_COMMERCE_390.png |
| 25 | Find shows nothing locally | **Fixed**: fixture listings, Test badge, hide filter, Make an offer prefills (5 Tabs) | t2_* |
| 26 | Serif font | **Partly fixed**: docs pages are now sans. The sandbox page is still serif and Find is monospace (three type systems). The new font caused the regression N4 | shots |
| — | Deploy gap | **Unchanged** | live 404s |

## New findings (severity, root-cause fix)
**Critical**
- **N1. The buyer can resolve its own dispute as a refund after paying.**
  - Repro (scen D, both PVs): the buyer captures 100 to the seller, disputes, then calls `resolve(refund)`. The buyer ends at 1000 and the seller at 0.
  - Root cause: `resolve` is gated only by the `deal:dispute` scope, which buyer-test holds, and `Desk.perform` passes the hard-coded role `'resolver'` to the guard instead of the caller's role.
  - Fix: add a `deal:resolve` scope held only by the resolver, and pass the authenticated role into the guard.

**High**
- **N2. The buyer can `void` the hold after delivery.** The seller gets nothing, and capture then gives HOLD_CLOSED (scen E).
  - Root cause: `void` has no state or role guard.
  - Fix: allow void only before delivery (or by the resolver), using the same transition table as capture.
- **N3. `mandate.revoke` doesn't revoke.** Status says "No open approval", but `fund` still succeeds (scen B3).
  - Root cause: revoke clears `summary` but not `self.mandate`.
  - Fix: clear the mandate object and check it in fund.
- **N4. The agent approves its own spending mandate.** `mandate.approve` accepts the `request_state` that `create_request` just handed to the same buyer token. The human approve URL `/sandbox/approve/<hash>` returns 404, so no human is ever in the loop.
  - Fix: approval must come from a separate principal (an approval page or an approver token). Never return a self-usable approval secret to the requester.
- **N5. The sandbox isn't an MCP server.**
  - Every JSON-RPC method is treated as a tool name. `initialize` and `tools/list` return a discover envelope (2025) or "That tool is not on the sandbox" REFUSED (2026). `discover` lists 23 tools with **no input schemas**, so a generic MCP client can't connect or validate arguments.
  - Fix: route `initialize`, `tools/list` and `tools/call` through the same MCP handler as the public server, and publish inputSchema per tool.
- **N6. Person, 390px: the "The deal, in order" step links break mid-word on every page** ("Fin|d", "Agre|e", "Pa|y", "Delive|r", "Resolv|e"). It was fine with the round 7 serif.
  - Root cause: the wider sans font, plus `overflow-wrap:anywhere` on links (`.launch a`, components.css) inside a shrinking flex row.
  - Fix: `white-space:nowrap; overflow-wrap:normal` on the step links and `flex-wrap:wrap` on the row (shots/t1_home_390.png).
- **N7. Isolation is still not per token** (see #7).
  - Root cause: every token maps to tenant 'demo'.
  - Fix: key the Desk by token, or mint per-session tokens from /sandbox/test-tokens.

**Medium**
- N8. "TODO(owner)" is user-visible:
  - DISPUTES Timelines (×3)
  - SELLER "Owner TODO: publish an arrival time"
  - the agent output of the public tools

  Fix: CI should fail on `TODO(owner)` in built HTML or tool text. Show "Not set yet" instead.
- N9. The fee differs between surfaces:
  - server: 25 → fee 0.13, total 25.13
  - docs (22 files) and the browser sandbox: 25.125 / 0.125

  Fix: one fee function with minor-unit rounding, and generate the docs example from it.
- N10. Minor units are fixed at ×100. quick_trade with USDC_MICRO 120000000 → amount_minor 12000000000 (USDC has 6 decimals; JPY has 0). Fix: take exponents from the currency/asset table.
- N11. The sandbox `money` block (you_pay, seller_gets, fee, held_by) is null in every response. Fix: populate it from the same quote function.
- N12. State stays `delivered` after a full capture, and receipt.verify says "Nothing was signed or paid." with signed:true. Fix: transition to settled when captured = authorized; derive the receipt text from state.
- N13. After a withdraw, a new offer without a key gets a bare "IDEMPOTENCY_CONFLICT". The default key is name+role, and there is one deal per desk. Fix: make the default key include the deal id or args hash, and add a fix string.
- N14. Once a dispute is open, the seller can't add evidence (DEAL_TRANSITION). Fix: allow `dispute`-kind evidence from both parties in the disputed state.
- N15. Reclaim can't be exercised. Fix: add a test clock (`sandbox.advance_time`) or honour `now` in test mode.
- N16. Schema drift:
  - 2025 authority has additionalProperties:false and no `amount` property, yet its example uses `amount` and the server accepts it.
  - 2026 public schemas have empty `{}` types.

  Fix: generate both versions from one schema source.
- N17. The test-token flow isn't documented in llms.txt or the docs, and RFC 9728 metadata for /mcp/sandbox/v1 returns 404 (resource_metadata points to account/v1). Fix: add a sandbox protected-resource doc and a llms.txt line.
- N18. The person conceptual model contradicts itself:
  - PAYMENTS says "Payments are held by the payment provider or an escrow contract until release", then "No payment method… holds funds, so that rail is planned".
  - The sandbox banner says "Hosted USDC has no hold and no refund" right above a working hold and refund.

  Fix: one sentence per surface, generated from the registry status.

**Low**
- The refund outcome is labelled "Stage RELEASED".
- "BOUND" is jargon for "funded".
- The sandbox history uses raw ISO UTC timestamps.
- In local Find, a logo query surfaces only a research brief, and Make an offer prefills the title but not the price.
- The float-amount fix suggests a mainnet example (eip155:8453).
- Composer pages show "Public search did not complete" twice in the live region.
- Check scripts say "missing" for a shape error.

## Agent metrics (my measurements; tokens ≈ chars/4)
| Run | Calls | 2025-11-25 | 2026-07-28 |
|---|---|---|---|
| Public MCP, full naive probe set (10 tools) | 32 | 27,516 | 26,695 |
| Sandbox minimal happy path (discover → offer → accept → mandate → approve → fund → deliver → capture → receipt) | 9 | **5,472** | **2,860** |
| Sandbox scen A (happy + negatives) | 19 | 10,947 | 5,762 |
| Sandbox scen C (dispute → resolver refund) | 10 | 5,509 | 3,059 |
| Sandbox scen D (buyer self-resolve) | — | 5,229 | 2,816 |

- 2026 is now about 45–50% lighter on the sandbox. In round 7 it was 1.7× heavier, so that is reversed. Public MCP totals are roughly equal.
- Compared with round 7's #201 happy path (15 calls, about 8.9k / 9.3k tokens), the path is now 9 calls and 5.5k / 2.9k.
- Manual steps: 0 once the agent reads the server card. A naive agent starting from llms.txt alone still can't find the token.
- Unit tests on 221df81e: 76/77 pass. The 1 error is an import of `stripe_connect_checkout` that was missing from my rebuild (an artefact of my rebuild, not of the PR).

## The 4 most telling screenshots
1. `shots/t1_home_390.png`: the new mid-word breaks in the step nav at 390px (Fin|d, Agre|e…), on every page.
2. `shots/sb_d15_3_accept_390.png`: what got fixed (version thread with time + author, Stage ACCEPTED, record rec-1 + next step), next to the 25.125 fee that the server rounds to 25.13, and the serif font still on the sandbox.
3. `shots/t6_disputes_todo_390.png`: "Dispute window: TODO(owner) days" ×3, and "release, refund and reclaim stay planned" while the server does release and refund.
4. `shots/t3_bad_price_390.png`: the price error is fixed ("Use a number and a currency, such as USD 25. 'A hundred quid' is not a price."). The same view still says "Nine public tools" while the server has 10.

(The agent-side Critical finding N1 has no screenshot. It is in agent/scen_2511.txt and scen_2607.txt, scenario D.)

## Files
- `scores.csv`: item, round7, now, evidence. It has 144 task × principle rows, per-principle and overall means, and P1–P20 / A1–A15.
- `step1_out.txt`, `capability_registry.server.json`
- `journey_{1280,390}.json|txt`, `sb_d15_*.json`, `pages15.json`, `shots/` (80 PNGs)
- `agent/`: run_*.txt, agent_p221_*.json, scen_*.txt|json, mini_out.txt

## Limitations
- The server was rebuilt from compare patches, so 1 base module was missing (it affects only the Stripe import test).
- The server was served with wsgiref plus an https shim.
- No real chain, card or account was used.
- Live checks were read-only GETs.
- Scores are my judgement against the checklist evidence above.
- A14 was not re-run.
