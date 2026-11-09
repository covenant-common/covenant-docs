# Covenant user testing, round 10 (9 Nov 2026, Europe/London)

This round tested 6 people and naive agents on both MCP versions, re-attacked R9-1 to R9-5, and checked the docs claims.

Everything was read-only. Nothing was signed, published, paid, emailed or pushed, no GitHub comments or reviews were posted, `/mcp/account/v1` was not used, and no forms were submitted. This report is on the box only, ready for the parent to share with Codex or Claude (owner request pt34u).

## Heads tested

Each head was checked with the GitHub connector or `git`.

| Target | Head | Notes |
|---|---|---|
| covenant PR #201 (server) | `beb7457c` | Unchanged since 4 Nov 15:31, so there was no rebuild. I reused the byte-exact `round4/build_beb` (1,748 .py files) and served it on 127.0.0.1:8774. |
| covenant-docs PR #13 | `38480c94` | Base is main. It is main `c3b5332` plus `afc96d4` (rebase plus the real registry) and `38480c9` (round 9 findings). Not a draft. GitHub says MERGEABLE. |
| covenant-docs PR #15 | `f1528ed5` | One commit on top of #13. Draft. MERGEABLE. |
| Live (read-only) | jupie202020.pythonanywhere.com and covenant-common.github.io | Unchanged. Live serves 9 tools. `/.well-known/mcp/server-card.json` and `/sandbox/test-tokens` return 404. The docs DISPUTES and AGENTIC_COMMERCE pages return 404. Live llms.txt has 0 TODO(owner). |

## Method, and its limits

- **People.** Six scripted personas ran in Playwright Chromium against local `python3 -m http.server` copies of #15 and #13, which gave identical results. These are simulated personas, not recruited humans.
  - Each persona starts on the home page and may only click visible link text that contains its own words, in priority order.
  - A wrong turn is a page that did not answer the task.
  - Time to success is an estimate: words read divided by reading speed (sighted users skim 35% of each page; screen-reader users hear 100% of it, in order), plus 5 s per click. Reading speeds: 230 wpm, 120 wpm for the non-native speaker, 180 wpm for the screen-reader user, 200 wpm for mobile and 250 wpm for the business owner.
  - The screen-reader persona also ran axe (WCAG 2.2 AA tags) on 7 pages, and I checked labels, landmarks, live regions and an ARIA snapshot (`people/d15_sandbox_aria.yml`).
  - The mobile persona ran at 390×844 with touch.
- **Agents.** `agent/naive.py` knows only the docs URL. It reads llms.txt, the AI catalog and the server card, follows `test_tokens`, connects, and then follows `next_actions` and `allowed_next_actions`. It tries buyer, then seller, approver and resolver on a refusal, and when no listed action moves the deal it guesses the next step from the tool order.
  - It ran on 2025-11-25 and 2026-07-28, with live URLs mapped to the local beb7457c server.
  - Tokens are estimated as characters ÷ 4.
- **Attacks.** I re-ran round 9's `attacks.py` (314 calls) and `matrix.py` (1,274 role × state × action rows) on both versions. The results are byte-identical to round 9.
- **Docs suites.** I ran the full pytest, node and check_doet suites, the CI workflow's check scripts, and the registry sync against the real server registry (`round4/capability_registry.server.json`, 26,285 bytes, blob 95c29221).
- **Scoring.** The 35-item checklist and 8 DOET principles × T1–T9. Baseline, R7 and R8 come from `round2` and `round3/scores.csv`; R9 comes from `round4/scores.csv`. Items not re-measured this round are marked "unchanged" or "carried".

## Scores

| | Baseline | R7 | R8 | R9 | **R10** |
|---|---|---|---|---|---|
| **Person overall** | 2.54 | 3.28 | 3.44 | 3.50 | **3.50** |
| **Agent overall** | 2.62 | 3.53 | 3.49 | 3.46 | **3.46** |

| Principle (person) | Baseline | R7 | R8 | R9 | **R10** |
|---|---|---|---|---|---|
| discoverability | 2.56 | 3.78 | 3.78 | 3.78 | **3.89** |
| affordances | 2.56 | 3.44 | 3.67 | 3.78 | **3.78** |
| signifiers | 2.56 | 3.33 | 3.56 | 3.78 | **3.56** |
| mapping | 2.56 | 3.22 | 3.33 | 3.33 | **3.56** |
| feedback | 3.00 | 3.11 | 3.56 | 3.56 | **3.56** |
| constraints | 2.22 | 3.22 | 3.44 | 3.44 | **3.44** |
| conceptual model | 2.56 | 3.11 | 3.00 | 3.11 | **3.00** |
| error prevention recovery | 2.33 | 3.00 | 3.22 | 3.22 | **3.22** |

| Principle (agent) | Baseline | R7 | R8 | R9 | **R10** |
|---|---|---|---|---|---|
| discoverability | 2.56 | 3.44 | 3.56 | 4.11 | **4.11** |
| affordances | 2.56 | 3.33 | 3.33 | 3.78 | **3.89** |
| signifiers | 2.33 | 3.44 | 3.56 | 3.56 | **3.67** |
| mapping | 2.44 | 3.44 | 3.56 | 3.67 | **3.56** |
| feedback | 2.78 | 3.89 | 3.89 | 3.56 | **3.44** |
| constraints | 3.00 | 3.44 | 3.33 | 2.78 | **2.78** |
| conceptual model | 2.44 | 3.44 | 3.11 | 3.22 | **3.22** |
| error prevention recovery | 2.89 | 3.78 | 3.56 | 3.00 | **3.00** |

**What moved since round 9**
- People:
  - Mapping and discoverability went up because the 390px step nav was fixed and aria-current now follows the deal (R9-6).
  - Signifiers and the conceptual model went down because of the new fee copy regression (R10-1).
- Agents:
  - Affordances and signifiers went up because the docs registry sync and drift checks pass and llms.txt and API_MCP list 10 tools.
  - Mapping and feedback went down because of the `next_actions` problems the naive agent hit (R10-3, R10-11).
- Server money and authority are unchanged: the build is the same, and the attacks reproduced round 9 exactly.
- Overall: person 3.50 (flat), agent 3.46 (flat).

### Checklist (35 items)

People: 16 pass and 4 partial (P6, P18, P19, P20). P2 now passes, and P18 dropped to partial because of the £0.60 example.
Agents: 13 pass, 1 partial (A8) and 1 fail (A14, carried). A1 fails on live.

| Item | R9 | R10 | Evidence |
|---|---|---|---|
| P1 | pass | pass | same nav all pages |
| P2 | partial | pass | 390px: 11 pages scrollWidth=390, journey links 2 rows, none outside viewport; sandbox nav fixed (R9-6) |
| P3 | pass | pass | unchanged |
| P4 | pass | pass | unchanged |
| P5 | pass | pass | unchanged |
| P6 | partial | partial | suggestion copy in matrix.js; TERMINAL no-results not reproduced from local preview |
| P7 | pass | pass | unchanged |
| P8 | pass | pass | per-field price error; message does not echo typed text |
| P9 | pass | pass | unchanged |
| P10 | pass | pass | thread with author + time |
| P11 | pass | pass | ACCEPTED announced |
| P12 | pass | pass | stepwise balances 100/80/20 |
| P13 | pass | pass | sandbox: "This sample does not add a fee", you pay 20 seller gets 20 |
| P14 | pass | pass | refund returns 20 to buyer |
| P15 | pass | pass | unchanged |
| P16 | pass | pass | no raw codes in sandbox |
| P17 | pass | pass | configured-not-verified wording |
| P18 | pass | partial | How you get paid linked; PAYING fee example still shows £0.60 under a "not set yet" label |
| P19 | partial | partial | DISPUTES: "no time limit" stated for the sandbox; windows Not set yet; RESOLVE meta description has TODO(owner) |
| P20 | partial | partial | Copied + check; check cannot reach live from local preview (CORS) |
| A1 | pass (local) / fail live 404 | pass (local) / fail live 404 | local card has sandbox + test_tokens; live server-card/test-tokens 404 (9 Nov 2026) |
| A2 | pass | pass | public tools/list unchanged |
| A3 | pass | pass | unchanged |
| A4 | pass | pass | unchanged |
| A5 | pass | pass | unchanged |
| A6 | pass | pass | unchanged |
| A7 | pass | pass | unchanged |
| A8 | partial | partial | next_actions only for caller; approve action points at mandate.status; 2026-07-28 omits allowed_next_actions |
| A9 | pass | pass | unchanged |
| A10 | pass | pass | fee null = not set |
| A11 | pass | pass | unchanged |
| A12 | pass | pass | unchanged |
| A13 | pass | pass | unchanged |
| A14 | fail | fail (carried) | same build beb7457c; not re-run |
| A15 | pass | pass | unchanged |

## People: six personas

Source: `people/d15_personas.json` (#15) and `d13_personas.json` (#13, identical results).

| Persona | Who holds the money | Fees | Sandbox trade | Dispute | Connect an agent | Error recovery | Words they would search |
|---|---|---|---|---|---|---|---|
| First-time seller (1280px) | ✓ 0 clicks, 0 wrong, ~39s | ✓ 0 clicks, 0 wrong, ~11s | ✓ 5 steps, seller ends with 20 | page ✓ 1 clicks, 0 wrong, ~72s; sandbox refund ✓ | ✓ 2 clicks, 1 wrong, ~86s; Copied ✓ | ✓ field error, then fixed | "how it works", "post a service", "fees", "how you get paid", "try", "dispute", "connect" |
| Buyer worried about scams (1280px) | ✓ 0 clicks, 0 wrong, ~39s | ✓ 0 clicks, 0 wrong, ~11s | ✓ 5 steps, seller ends with 20 | page ✓ 1 clicks, 0 wrong, ~72s; sandbox refund ✓ | ✓ 2 clicks, 1 wrong, ~86s; Copied ✓ | ✓ field error, then fixed | "who holds", "safe", "protect", "escrow", "refund", "scam", "fees" |
| Non-native English speaker (1280px) | ✓ 0 clicks, 0 wrong, ~76s | ✓ 0 clicks, 0 wrong, ~20s | ✓ 5 steps, seller ends with 20 | page ✓ 1 clicks, 0 wrong, ~133s; sandbox refund ✓ | ✓ 2 clicks, 1 wrong, ~156s; Copied ✓ | ✓ field error, then fixed | "about", "how it works", "price", "test", "problem", "help" |
| Screen-reader user (1280px) | ✓ 0 clicks, 0 wrong, ~144s | ✓ 0 clicks, 0 wrong, ~38s | ✓ 5 steps, seller ends with 20 | page ✓ 1 clicks, 0 wrong, ~250s; sandbox refund ✓ | ✗ stalled (1 click, ~182s); Copied ✓ | ✓ field error, then fixed | "about", "pricing", "demo", "dispute", "connect an agent" (heading/link list) |
| Mobile only (390px) (390px) | ✓ 0 clicks, 0 wrong, ~43s | ✓ 0 clicks, 0 wrong, ~9s | ✓ 5 steps, seller ends with 20 | page ✓ 2 clicks, 0 wrong, ~84s; sandbox refund ✓ | ✓ 4 clicks, 1 wrong, ~102s; Copied ✓ | ✓ field error, then fixed | "menu", "fees", "try", "dispute", "connect" |
| Small business owner (vs Stripe/Etsy) (1280px) | ✓ 0 clicks, 0 wrong, ~36s | ✓ 0 clicks, 0 wrong, ~10s | ✓ 5 steps, seller ends with 20 | page ✓ 1 clicks, 0 wrong, ~67s; sandbox refund ✓ | ✓ 2 clicks, 1 wrong, ~80s; Copied ✓ | ✓ field error, then fixed | "pricing", "fees", "vs Stripe", "Etsy", "chargeback", "payout", "seller path" |


**What the personas found**
- **Who holds the money.** All 6 found "Covenant never holds your money. In test mode, the test rail holds it…" on the home page with no clicks. The estimate is 36–76 s for sighted users and about 144 s for the screen-reader user, who hears about 100 words of chrome (search, Menu, 15 nav links, the step list) before the H1 on every page. A skip link exists.
- **Fees: "found", but nothing usable.** Every persona's first fee answer is "The platform fee is not set yet. The owner will confirm this.", repeated 4 times in the home hero paragraph (`d15_home_hero_fee_repeat_1280.png`).
  - The business owner comparing with Stripe or Etsy cannot compare at all. There is no number, no payout timing and no chargeback policy: "Etsy" appears on 0 pages, "chargeback" on 0 and "payout" on 1. Stripe is mentioned only as "Card through Stripe: Not connected".
  - PRICING says the fee is optional for 14 days "starting 1 November 2026" and then "This site does not state when that 14-day window ends."
  - PAYING shows **"The platform fee is not set yet. The owner will confirm this.** you pay £120.60, the seller gets £120, and the fee is £0.60." This is an implied 0.5% rate under a "not set" label (`d15_paying_fee_contradiction_1280.png`).
- **Sandbox trade.** All 6 completed Propose → Accept → Fund → Deliver → Release. Balances: buyer 100 → 80, held 20, seller 20. Each step is announced through the `#step-status` live region. You cannot click Release before paying, because the button is disabled.
- **Dispute.** All 6 reached DISPUTES in 1 click (2 on mobile, counting the Menu). The page says, truthfully, that in the sandbox a buyer or seller can dispute after release "with no time limit". In the sandbox, Dispute → Refund returns 20 to the buyer.
- **Connect an agent.** Five of 6 reached START in 2 clicks via AGENT.html (one wrong turn: the AGENT page itself does not have the address).
  - The screen-reader persona stalled. The onward link on AGENT.html reads "open the connection page", which contains neither "agent" nor "connect".
  - Copy works: the button says "Copied" and the clipboard holds `https://jupie202020.pythonanywhere.com/mcp`.
  - Check connection reports CORS or offline when run from a local preview, which is expected.
- **Error recovery.** Typing "about hundred pound" in the composer gives a field message, linked through `aria-describedby`, and entering 100 then works. Gaps:
  - the message quotes "a hundred quid", not what the user typed;
  - `aria-invalid` is not set;
  - focus does not move to the field.
- **Screen reader.** axe found 0 violations on home, PRICING, DISPUTES, START, MATRIX, sandbox and PAYING. Every page has one H1 and labelled landmarks ("Main" and "Deal steps" navs). The sandbox status is a live region.
- **Mobile at 390px.**
  - All 11 swept pages have scrollWidth 390. The step nav wraps to 2 rows with no link outside the viewport, and there are no tap targets under 24px.
  - aria-current follows the state: READY has none, then Agree, Pay, Deliver, and Resolve (on DISPUTED or SETTLED). **R9-6 is fixed.**
  - "Stage names" still sits above the H1.
- **Non-native reading.** Flesch reading ease is 58 (PRICING) to 72 (DISPUTES and PAYING), with about 10–13 words per sentence. Jargon counts: PAYING has 26 hits (USDC ×10, escrow ×3, capture, rail, registry, reclaim, merchant of record) and DISPUTES has 15. The raw field name `fee_opt_in` appears in people-facing PRICING copy.

## Agents: naive runs on both MCP versions

Source: `agent/naive_*.json`.

| | 2025-11-25 | 2026-07-28 |
|---|---|---|
| Discovery | llms.txt → AI catalog → server card → `test_tokens` URL → mint: 4 GETs locally. Live server card and test-tokens return **404**, a dead end for a real agent today. | same |
| Total calls (deal + dispute, two tenants) | 30 (7 GET + 23 JSON-RPC) | 30 (7 + 23) |
| Wrong calls | 7: accept as buyer (ACCE| Persona | Who holds the money | Fees | Sandbox trade | Dispute | Connect an agent | Error recovery | Words they would search |
|---|---|---|---|---|---|---|---|
| First-time seller (1280px) | ✓ 0 clicks, 0 wrong, ~39s | ✓ 0 clicks, 0 wrong, ~11s | ✓ 5 steps, seller ends with 20 | page ✓ 1 clicks, 0 wrong, ~72s; sandbox refund ✓ | ✓ 2 clicks, 1 wrong, ~86s; Copied ✓ | ✓ field error, then fixed | "how it works", "post a service", "fees", "how you get paid", "try", "dispute", "connect" |
| Buyer worried about scams (1280px) | ✓ 0 clicks, 0 wrong, ~39s | ✓ 0 clicks, 0 wrong, ~11s | ✓ 5 steps, seller ends with 20 | page ✓ 1 clicks, 0 wrong, ~72s; sandbox refund ✓ | ✓ 2 clicks, 1 wrong, ~86s; Copied ✓ | ✓ field error, then fixed | "who holds", "safe", "protect", "escrow", "refund", "scam", "fees" |
| Non-native English speaker (1280px) | ✓ 0 clicks, 0 wrong, ~76s | ✓ 0 clicks, 0 wrong, ~20s | ✓ 5 steps, seller ends with 20 | page ✓ 1 clicks, 0 wrong, ~133s; sandbox refund ✓ | ✓ 2 clicks, 1 wrong, ~156s; Copied ✓ | ✓ field error, then fixed | "about", "how it works", "price", "test", "problem", "help" |
| Screen-reader user (1280px) | ✓ 0 clicks, 0 wrong, ~144s | ✓ 0 clicks, 0 wrong, ~38s | ✓ 5 steps, seller ends with 20 | page ✓ 1 clicks, 0 wrong, ~250s; sandbox refund ✓ | ✗ stalled (1 click, ~182s); Copied ✓ | ✓ field error, then fixed | "about", "pricing", "demo", "dispute", "connect an agent" (heading/link list) |
| Mobile only (390px) (390px) | ✓ 0 clicks, 0 wrong, ~43s | ✓ 0 clicks, 0 wrong, ~9s | ✓ 5 steps, seller ends with 20 | page ✓ 2 clicks, 0 wrong, ~84s; sandbox refund ✓ | ✓ 4 clicks, 1 wrong, ~102s; Copied ✓ | ✓ field error, then fixed | "menu", "fees", "try", "dispute", "connect" |
| Small business owner (vs Stripe/Etsy) (1280px) | ✓ 0 clicks, 0 wrong, ~36s | ✓ 0 clicks, 0 wrong, ~10s | ✓ 5 steps, seller ends with 20 | page ✓ 1 clicks, 0 wrong, ~67s; sandbox refund ✓ | ✓ 2 clicks, 1 wrong, ~80s; Copied ✓ | ✓ field error, then fixed | "pricing", "fees", "vs Stripe", "Etsy", "chargeback", "payout", "seller path" |
_RECIPIENT) ×2, mandate.approve as buyer or seller (403) ×4, deliver as buyer (403) ×1 | 7, the same |
| Tokens (estimated) | 26,222, of which `tools/list` is 8,724 (34,834 characters) | 21,734, of which `tools/list` is 8,055 (32,090 characters) |
| Deal outcome | released: buyer 900, seller 100 | released: buyer 900, seller 100 |
| Dispute outcome | refunded: buyer 1000, seller 0 | refunded: buyer 1000, seller 0 |

**Dead ends hit by a literal agent**, in order:
1. After an offer, the buyer's `next_actions` is `[withdraw]`. Nothing says the seller must now accept.
2. After accept: `[cancel]`.
3. After `mandate.create_request`, the reply is `{"action":"approve","tool":"mandate.status","url":"/sandbox/approve/<hash>"}`. Following the tool name calls the read-only `mandate.status` and **loops forever**. My first literal run looped 12 times before it hit its step cap. You have to read the action name ("approve") and guess `mandate.approve` with the approver token.
4. After approve, `next_actions` is empty, and the agent must guess `fund`.
5. On 2026-07-28, `structuredContent` has no `allowed_next_actions`, `errors` or `warnings`, although `outputSchema` lists them. Only `next_actions` is present.
6. The server card's `capabilities` say `can_dispute:false` and `can_refund:false` (true for the public lane), while the same card advertises a sandbox that does both.
7. The docs AI catalog says `toolCount: 9`, but the server card lists 10 `source_tools`.

## Top findings (round 10)

Server findings were measured on beb7457c; docs findings on #13 and #15.

| ID | Sev | Where | Finding | Root cause |
|---|---|---|---|---|
| R9-1 | **Critical** | server | Still open. One `GET /sandbox/test-tokens` returns all five roles, and `?tenant=` reuse re-issues them. A stranger with a leaked reuse URL resolved a dispute (A1, identical to round 9). | `mint_tenant` issues every role to one caller, and the tenant id is a bearer secret. |
| R9-2 | **Critical** | server | Still open. Refused calls still move money: 7 conservation failures on each version. Capture 40.5 is REFUSED, yet the rail drops to 59.5. Fund at price -100 leaves the buyer at 1100. Fund at 0.5 leaves the buyer at 999.5. | `Desk.perform` mutates the rail and ledger before validating; offer and counter don't validate price. |
| R9-3 | **Critical** | server | Still open. `resolve(outcome="split")` replies "Dispute resolved and the rail moved the test funds" but moves nothing. | Only `"refund"` is wired; other outcomes fall through to a success summary. |
| R10-1 | **High** | docs #13 and #15 | The fee sentence is pasted in repeatedly: 4× in the home hero, 2 per step in NEGOTIATION, and on 19 files including llms.txt. PAYING keeps a "£120.60 … fee £0.60" example under a "fee is not set yet" label. PRICING says the window starts 1 Nov but "does not state when it ends". This is not on main `c3b5332` (0 occurrences). | Commit `afc96d4` replaced fee-amount phrases by hand with `FEE_NOT_SET`. The replacements are committed HTML, not generated by `build_site.py`, and no check catches duplicates, leftover amounts or "0.60". |
| R10-2 | **High** | docs CI | `tools/check_public_site.py` **fails on both heads** with "Asset inventory stale; run --write-manifest". That is the first step of `check-links.yml`, so CI will be red. #13 has 1 stale entry (`testing/round9-findings.md`); #15 has 72. Main passes. Neither PR body mentions it. | `manifest.json` was not regenerated after the new commits. |
| R9-4 | High | server | Still open. Any role can `advance_clock`, including backwards. The buyer jumped past the capture deadline and reclaimed at once. | No role or monotonic check. |
| R9-5 | High | server | Still open. Dispute and refund are allowed after release, with no window. The docs now state this honestly. | No dispute window in the authority table. |
| R10-3 | Medium | server | `next_actions` lists only the caller's own moves. `mandate.create_request` points the "approve" action at the tool `mandate.status`, so a literal agent loops. | Next actions are computed per caller role, and the approve step is mapped to the status tool instead of `mandate.approve` with role approver. |
| R10-4 | Medium | server | On 2026-07-28, `structuredContent` drops `allowed_next_actions`, `errors` and `warnings`, which `outputSchema` declares. On 2025-11-25 they are present. | The two version serializers build the result differently. |
| R10-5 | Medium | docs | Tool-count drift is invisible. `mcp/tool-inventory.json` and `.well-known/ai-catalog.json` (`toolCount` 9) still list 9 tools without `covenant_payment__quote`, while llms.txt, API_MCP and the server card say 10. check_registry_drift and lint_tool_counts pass. | The frozen 9-tool snapshot is excluded from the drift and claims checks. |
| R10-6 | Medium | server | Sandbox `tools/list` is about 8–9k tokens: 25 tools × one shared 15-property inputSchema with no `required` fields (R9-11). | One shared schema. |
| R10-7 | Low | docs #15 | The PR body says `tests/standards-cards.mjs`: "8 pass". The file has 2 tests, and I measured 2 pass on #15 and 1 pass plus 1 skip on #13. | The PR text was not checked against the run. |
| R10-8 | Low | docs | TODO(owner) is still published. The `<meta name="description">` on RESOLVE.html reads "…deadlines that are still TODO(owner)." (search snippets and link previews), and `distribution/glossary.json` has 2 raw TODO(owner) bodies. llms.txt is clean. | `badge_todos()` rewrites body text only, not meta attributes or JSON. |
| R10-9 | Low | a11y | The price error does not echo the typed text. `aria-invalid` is not set and focus does not move. AGENT.html's onward link "open the connection page" has no purpose words. There are about 100 words of chrome before every H1. | Composer validation and link copy. |
| R10-10 | Low | content | No comparison facts for a small business: no Etsy, chargebacks or payout timing. `fee_opt_in` appears in people-facing copy. | Copy gap. |
| R10-11 | Low | server | Calling `offer` on an already agreed deal returns 200 "Offer sent. Nothing is paid." while the state stays `agreed`. | Misleading summary on a no-op. |

## Status of each R9 finding

| R9 | Sev | Status (R10) | Evidence |
|---|---|---|---|
| R9-1 every role from one mint, reuse | Critical | **Open** | A1 re-run identical. Reuse URL returns the same tokens, and a stranger resolves. |
| R9-2 refused calls move money | Critical | **Open** | 7 conservation failures on each version: capture 40.5, fund -100, fund 0.5. |
| R9-3 non-refund resolve fakes success | Critical | **Open** | `resolve(split)` says "rail moved the test funds" while balances stay 900/0. |
| R9-4 any role moves the clock, including backwards | High | **Open** | The buyer jumps the clock, then reclaims immediately. |
| R9-5 dispute after release, no window | High | **Open (server)**, honestly documented | The DISPUTES page now says "no time limit". |
| R9-6 sandbox nav at 390, Resolve marked current | High | **Fixed** (docs) | 2-row wrap, scrollWidth 390, aria-current maps to state (`sandbox/page.js` JOURNEY). |
| R9-7 docs CI paths, 9 node failures | High | **Fixed, but CI is red for a new reason** | Node 143 run: #13 has 140 pass, 0 fail, 3 skip (matches its PR body); #15 has 141 pass, 0 fail, 2 skip. check_doet 40/40, unpatched. Python 116 pass + 7 skip (55 + 68, matches the body). check_public_site fails (R10-2). |
| R9-8 fee contradiction | Medium | **Partly fixed** | `platform_fee_bps` is null. 75 "not set yet" statements, but the PAYING £0.60 example and the duplicate sentences remain (R10-1). |
| R9-9 quick_trade USDC_MICRO double scale | Medium | Open (carried) | Same build. |
| R9-10 idempotency fakes a repeat capture | Medium | Open | A11 re-run identical. |
| R9-11 one shared inputSchema, no ping | Medium | Open | `tools/list` is 34,834 characters with one schema. |
| R9-12 refused fund still advances the state | Medium | Open | A7 re-run identical. |
| R9-13 deal stuck after void | Medium | Open | A10 re-run identical. |
| R9-14 TODO(owner) in llms.txt and for screen readers | Medium | **Mostly fixed** | llms.txt has 0 TODO and 0 `<!--`. No visible TODO in the HTML body. Left over: the RESOLVE meta description and glossary.json (R10-8). |
| R9-15 401 header points at account/v1 | Low | Open | `WWW-Authenticate: Bearer realm="aap-account", resource_metadata=".../oauth-protected-resource/mcp/account/v1"` on a sandbox 401. |
| R9-16 stale 9-tool test | Low | Open (carried) | Same build. |
| R9-17 #13 conflicts with main | Low | **Fixed** | #13 is main plus 2 commits and MERGEABLE. |

## Docs registry sync and claim checks

**Registry sync and checks**
- Both heads commit `distribution/capability-registry.server.json` **byte-identical** to the real beb7457c file.
- I ran `sync_capability_registry.py --file <real>` in a scratch copy. It reported PASS (10 tools, 8 payments) and left no diff.
- Then check_registry_drift, check_agentic_claims (#15), lint_tool_counts and `build_site.py --check` all PASS on both heads.

**round9-findings.md and AGENTS.md claims**

Verified true:
- `.journey ol` wraps (components.css:27).
- aria-current is set from the state.
- `platform_fee_bps` is null.
- llms.txt and API_MCP list `covenant_payment__quote`.
- `reclaim` is in `works_in_test`.
- APPROVALS says one GET returns every role "to the same caller".
- DISPUTES says "no time limit".
- matrix.js has the "Try a broader word…" suggestion.
- start.js separates the initialize and tools/list errors.
- MMR Industries is kept (5 mentions), and so is `listing.withdraw`.
- The CI runs `node --test tests/*.test.cjs`.

Not accurate, or incomplete:
- "pages say the fee is not set yet": true, but the £0.60 example and the duplicates remain.
- "TODO(owner) only in HTML comments": the RESOLVE meta description is an exception.
- The unresolved list correctly notes the frozen 9-tool inventory, but no check covers it (R10-5).
- AGENTS.md rule 2 (non-custodial wording) holds. Rule 3 (TODO only in comments) has the meta exception.

**PR bodies**
- #13: the numbers match my runs (node 143/140/0/3, check_doet 40, Python 55 + 68). It does not mention that check_public_site fails.
- #15: "standards-cards 8 pass" is wrong; there are 2 tests (R10-7). The drift and claims PASS and check_doet 40 match.

## 4 best screenshots

All are in `shots/`.

1. `d15_home_hero_fee_repeat_1280.png`: the home hero repeats "The platform fee is not set yet. The owner will confirm this." 4 times (R10-1).
2. `d15_paying_fee_contradiction_1280.png`: PAYING's bold "fee is not set yet" label followed by "you pay £120.60 … fee £0.60" (R9-8 and R10-1).
3. `d15_mobile390_sandbox_nav.png`: the 390px sandbox step nav now wraps cleanly, with nothing marked current at READY (R9-6 fixed).
4. `d15_mobile390_sandbox_disputed_nav.png`: the 390px dispute flow. Balances are correct, but every log line repeats the fee sentence.

Also in `shots/`: per-persona `*_sandbox_released`, `*_sandbox_disputed`, `*_bad_price` and `*_connect` for d13 and d15.

## Suggested fixes, in order

1. Server: validate before mutating in `Desk.perform`, and validate price in offer and counter (R9-2).
2. Server: issue one role per mint and stop the tenant-reuse re-issue (R9-1).
3. Server: wire every resolve outcome, or refuse it (R9-3); restrict `advance_clock` to an admin role and keep it monotonic (R9-4).
4. Docs: undo the hand replacements from `afc96d4`. Keep a single fee sentence per page and delete the £120.60 example. Add a check that fails on a repeated `FEE_NOT_SET`, or on "0.60" or "0.5%", while `platform_fee_bps` is null.
5. Docs: run `tools/check_public_site.py --write-manifest` on both branches.
6. Docs: include `mcp/tool-inventory.json` and the AI catalog's `toolCount` in the drift check, and correct the #15 PR body.
7. Server: return the counterparty's next move in `next_actions` (for example `{"role":"seller","tool":"accept","waiting":true}`), and map approve to `mandate.approve` with role approver. Add the missing fields to 2026-07-28 results.

## Files

| Path | Contents |
|---|---|
| `report.md`, `scores.csv`, `mkscores.py` | This report, the scores and the script that builds them |
| `suite13.txt`, `suite15.txt`, `runsuite.sh` | Sync, checks, pytest, node and check_doet runs |
| `people/personas.mjs`, `people/d1{3,5}_personas.json`, `people/d15_sandbox_aria.yml` | Persona journeys |
| `agent/naive.py`, `agent/naive_*.json` | Naive agent runs |
| `agent/attacks_*`, `agent/matrix_*` | R9-1 to R9-5 re-attacks |
| `pr13.json`, `pr15.json`, `pr201.json` | Heads and PR bodies |
| `shots/` | Screenshots |
