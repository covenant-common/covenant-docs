# "Perfect experience" acceptance checklist (post-deploy retest)
Each item is pass/fail. Re-run with `journey.mjs 1280|375` and `agent2.py`/`agent3.py`, then compare with the baseline in `scores.csv`. Target: every task scores at least 4 on every principle, and both gulfs score at least 4.

## People (1280px, 375px, keyboard)
- [ ] P1 Every page has the same global nav, including "Disputes & refunds" and "Connect an agent". (Baseline: 4 different navs.)
- [ ] P2 At 375px, a menu button opens the nav. The nav does not wrap onto 2+ lines, and no page has scrollWidth > viewport, including after a sandbox run. (Baseline: 560px.)
- [ ] P3 The home H1 is at least 2× body font size, and a one-sentence "what it is" is visible without scrolling at 375px.
- [ ] P4 A service search box is reachable in ≤3 Tabs from page load. (Baseline: 17.)
- [ ] P5 Test or demo listings carry a visible "Test" badge and can be filtered out.
- [ ] P6 A search with no results suggests related categories or broader terms.
- [ ] P7 Every advert has a "Make an offer" control that pre-fills the composer. The composer is reachable in ≤5 Tabs from it. (Baseline: 46 Tabs.)
- [ ] P8 The price field rejects non-numeric input with an inline message, and it has a currency selector. (Baseline: "a hundred quid maybe" accepted.)
- [ ] P9 The composer lets you choose buyer or seller role; the draft label reflects the author.
- [ ] P10 A negotiation thread shows each version with author and time, plus Accept / Counter / Decline controls.
- [ ] P11 A person can accept an agreement in the browser without a terminal, and sees a confirmation with the record ID and next steps.
- [ ] P12 The sandbox is stepwise: Propose, Accept, Fund, Release are separate buttons, and balances update after each step.
- [ ] P13 The sandbox shows a fee line (amount and %, plus any waiver) before approval and on the receipt.
- [ ] P14 The sandbox offers a Dispute / Refund branch that visibly returns escrow to the buyer.
- [ ] P15 Every primary button looks like a button (filled or bordered) and has a target ≥24px, ideally ≥44px. (Baseline: #run 18.5px, link-styled.)
- [ ] P16 Sandbox failures are explained in plain language. No raw codes such as COUNTERPARTY_ASSENT appear without a translation.
- [ ] P17 Payment method labels match the data: nothing reads "installed" or "available" while `executable` or `collection_activated` is false.
- [ ] P18 A "How you get paid" page exists for sellers and is linked from the nav or Payments.
- [ ] P19 A "Disputes & refunds" page explains steps, evidence, timelines and who decides, and is reachable in one click from every page.
- [ ] P20 The Copy MCP address button changes its label to "Copied" and the live region announces it. A "Check connection" step exists.

## Agents (public MCP)
- [ ] A1 `/.well-known/mcp/server-card.json` returns 200, listing the tools, limits and the absence of pay/accept tools. (Baseline: 404.)
- [ ] A2 tools/list is ≤10k chars, or a compact mode exists.
- [ ] A3 `aap_public_listing_search` with no query and limit 5 returns ≤8k chars by default. (Baseline: 89,723.) Each item has a `test` flag.
- [ ] A4 Searches with 0 results return `suggestions`.
- [ ] A5 Each `missing` code in a draft names the field that clears it. A dispute clause in `clauses` is either recognised or redirected.
- [ ] A6 `settlement` is validated against payment-methods ids. A free-form `{mode:"test"}` is refused or normalised.
- [ ] A7 Drafts accept `supersedes` (the field shown in the output), and compare diffs per clause id.
- [ ] A8 A counter, accept or prepare-assent path is either exposed as a tool or returned as an explicit `next_step`. No response references an unlisted tool such as `covenant_concept`.
- [ ] A9 quick_trade on eip155:84532 or eip155:11155111 echoes `test_network:true` and `settles_real_value:false`.
- [ ] A10 quick_trade returns a concrete fee quote (amount, %, waiver) instead of `SEPARATELY_ADOPTED_RAIL_QUOTE_REQUIRED`.
- [ ] A11 payment-methods.json never has `selectable:true` together with `executable:false` unless a `reason` is given. Sepolia is either executable for practice or not selectable.
- [ ] A12 A non-integer `amount` returns a tool-level REFUSED with a `validation_issues` path, not HTTP 400 -32700.
- [ ] A13 `covenant_review__evidence` with empty items returns `NO_PROOFS_PROVIDED`, not `all_provided_proofs_verified:true`.
- [ ] A14 review-reference.json includes a copy-pasteable empty case that `covenant_review__review` accepts as-is.
- [ ] A15 A read-only payout/receive readiness call or field tells a seller agent which methods can receive funds today.
