# Covenant DOET round 9: average person, naive agent, authority re-attack

Run on 9 Nov 2026 (times are UTC, which is London time (GMT) in November). The round 9 run was cut off on 4 Nov; this finishes it. Same limits as before: live was only read; nothing was signed, published, paid, emailed or pushed; I made no GitHub comments, reviews or review requests. Numbers come from my own measurements, not from PR text.

## PR heads (checked through the GitHub connector on 9 Nov)
None of the open heads changed since 4 Nov, so I didn't need to rebuild. #192 has since been merged.

| PR | Head SHA | State | Last update (UTC) | Note |
|---|---|---|---|---|
| covenant #192 | `96e7f07c9e8715747122461c06f8634c6f96ad3c` | **merged into main** on 6 Nov 00:02 | 6 Nov 00:02 | Merged although its CI never ran (see Unit tests) |
| covenant #200 | `10934ef4c6a46d3f3f55f3fcef9f3751df76b29f` | open, draft | 4 Nov 13:37 | Its base is still #192's branch, which is now merged; retarget it to main |
| covenant #201 | `beb7457c942a3a33965b86a57a94e696ac2022f4` | open, draft (base #200) | 4 Nov 15:31 | This is the build I tested |
| covenant-docs #13 | `cb2d77acb198ca4f796288167acb1c19c62822e6` | open, ready (not draft), **mergeable: dirty** | 4 Nov 15:35 | A local trial merge with main (c3b5332, PR 16, 6 Nov) gives **11 conflicts** |
| covenant-docs #15 | `262c37e7f6904bfae194b422310c636580124b1a` | open, draft (base #13) | 4 Nov 15:35 | |

**Build:** `build_beb` is the 0.46.0 wheel plus every file the PR changed, plus 39 more source files and 1 test fixture that I fetched at beb7457c. I checked each one against the git tree's blob SHA. All 1,748 `.py` files in the six packages now match the head byte for byte. Two non-Python files (`express.js`, a README) were not fetched.

## Step 1: registry sync
- **Server file:** `covenant_chain/data/capability_registry.json` at beb7457c is **26,285 bytes**. Its blob is `95c29221…`, which matches the tree. It's saved as `capability_registry.server.json`; `authority_table.server.json` is 12,658 bytes.
- **Sync:** in a fresh local clone of #15 (`sync15/`, nothing pushed), `python3 tools/sync_capability_registry.py --file …` exits 0 with `{'status': 'PASS', 'tools': 10, 'payments': 8}`. Round 8's "unrecognised shape" error is fixed.

| Check (after sync) | Result |
|---|---|
| check_agentic_claims | PASS |
| lint_tool_counts | PASS |
| **check_registry_drift** | **FAIL** (exit 1) |
| **build_site.py --check** | **FAIL**: AGENTIC_COMMERCE.html, PAYING.html and llms.txt need regenerating |

The drift check gives three errors:
- `Registry tool names differ from mcp/tool-inventory.json`. The server's 10th tool, **`covenant_payment__quote`**, is not in the 9-tool inventory.
- `PAYING.html missing payment row card`
- `PAYING.html missing payment row aap-native`

**Root cause:** #15 commits an older projection of the registry (9 tools), so CI's drift check passes against that stale copy. Syncing the real server file exposes the drift. Other docs that still disagree with the server:
- `docs/API_MCP.html` says "The public connection has 9 tools".
- llms.txt says "Reclaim is not [in works_in_test]", but sandbox reclaim moves money (attack A5).

**Fix:** commit the synced projection, add `covenant_payment__quote` to `mcp/tool-inventory.json`, regenerate the pages, and in CI run the sync against the pinned server SHA before the drift check.

## Headline (1–5)
| Persona | Baseline | Round 7 | Round 8 | **Round 9** |
|---|---|---|---|---|
| Person (1280 + 390px) | 2.54 | 3.28 | 3.44 | **3.50** |
| Agent (naive, MCP 2025-11-25 + 2026-07-28) | 2.62 | 3.53 | 3.49 | **3.46** |

| Principle | Person (base → r7 → r8 → now) | Agent (base → r7 → r8 → now) |
|---|---|---|
| Discoverability | 2.56 → 3.78 → 3.78 → **3.78** | 2.56 → 3.44 → 3.56 → **4.11** |
| Affordances | 2.56 → 3.44 → 3.67 → **3.78** | 2.56 → 3.33 → 3.33 → **3.78** |
| Signifiers | 2.56 → 3.33 → 3.56 → **3.78** | 2.33 → 3.44 → 3.56 → **3.56** |
| Mapping | 2.56 → 3.22 → 3.33 → **3.33** | 2.44 → 3.44 → 3.56 → **3.67** |
| Feedback | 3.00 → 3.11 → 3.56 → **3.56** | 2.78 → 3.89 → 3.89 → **3.56** |
| Constraints | 2.22 → 3.22 → 3.44 → **3.44** | 3.00 → 3.44 → 3.33 → **2.78** |
| Conceptual model | 2.56 → 3.11 → 3.00 → **3.11** | 2.44 → 3.44 → 3.11 → **3.22** |
| Error prevention/recovery | 2.33 → 3.00 → 3.22 → **3.22** | 2.89 → 3.78 → 3.56 → **3.00** |

**Person.** Small gain. The mid-word breaks are gone from docs pages, the sandbox is now sans, the fee in the sandbox (25.13) matches the server, the refund label is right, and "TODO(owner)" is replaced by a "Not set yet" box. Three things hold it back:
- The sandbox page's step nav overflows at 390px and marks the wrong step as current.
- The fee story contradicts itself: PAYMENTS says the fee amount is "Not set yet", while home, SELLER and the sandbox say 0.5%.
- Disputes still has no day counts.

**Agent.** Discovery and MCP conformance improved a lot:
- A naive agent finds the token flow from the server card, llms.txt and the 401.
- `initialize` and `tools/list` work on the sandbox.
- Per-mint tenants are isolated.
- Every round 8 role hole is closed for the token it was found with.

But the adversarial pass found a new class of money bugs: **refused calls still move money, the separation of duties is cosmetic, and `resolve(release)` pays nobody**. Those pull Constraints and Error prevention down, so the agent mean is flat (3.46).

**Checklist** (rules in `/workspace/cov/doet/checklist.md`)
- **People: 16/20 pass**, 0 fail.
  - P2 is partial (sandbox overflow at 390).
  - P6, P19 and P20 are partial.
- **Agents: 13/15 pass locally.**
  - A8 is partial: public replies still advertise a tool `offer` that the public server doesn't have.
  - **A14 fails** (re-run): review-reference `empty_case` pasted as-is gets MCP_CONNECTED_ARGUMENTS.
  - A1 still fails on live.

**Live (read-only, 9 Nov):** unchanged.
- pythonanywhere returns 404 for server-card, `/sandbox/test-tokens` and the sandbox metadata, and serves 9 tools.
- The live docs llms.txt still says "nine tools", and DISPUTES and AGENTIC_COMMERCE return 404.

**Gulfs**
- **Execution** is small for an agent: tokens, schemas and next_actions are all there. It is still medium for a generic client, because all 25 sandbox tools share one input schema with no required fields.
- **Evaluation** got worse for money. Several replies say REFUSED while balances changed, or say "rail moved the test funds" when nothing moved.

## Adversarial re-attack of the authority model (PR #201 sandbox)
Method: an in-process client on the beb7457c WSGI app (`agent/inproc.py`) plus HTTP on 127.0.0.1:8774. After every call I check money conservation: total = 1000, no negative balances, and rail escrow = authorized − captured. I ran it on 4 Nov, then re-ran it today on the byte-exact build. The results are identical on both runs and on both MCP versions (`agent/r9b/`).

**Role × state matrix** (`agent/matrix_*.json`)
- 13 states × 14 actions × 7 roles (buyer, seller, resolver, approver, reader, stranger, other-tenant) = 1,274 cells per MCP version.
- 148 cells are allowed. Of those:
  - 99 are `advance_clock` or `mandate.revoke`, which move no money.
  - 49 are real transitions, all done by the expected role.
- **Stranger:** 182/182 refused with 401.
- **Other-tenant token:** 0 changes to the target tenant. Its 26 "allowed" cells only touched its own deal.
- **Conservation:** 0 failures in the matrix.

What the matrix gets right (Fixed):
- void after delivery → VOID_AFTER_DELIVERY
- the buyer can't resolve → 403
- the buyer or seller can't approve a mandate → 403
- revoke stops fund → MANDATE_REQUIRED
- the seller can add evidence while disputed
- cross-tenant prefix and secret splicing → 401

The targeted attacks (`agent/attacks_*.txt`) broke the following.

| Attack | Result |
|---|---|
| A1 stranger re-mints from any token | `GET /sandbox/test-tokens?tenant=<prefix of any token>` returns **the same five tokens, resolver included**. Then `resolve(refund)` succeeds: buyer 1000, seller 0 |
| A2 buyer self-resolve | Buyer token → 403. But the same `GET` that minted the buyer token also handed that caller the resolver and approver tokens, so one agent does N1 anyway |
| A3 buyer approval | 403 for buyer and seller; a forged request_state → MANDATE_APPROVAL; the approval page now returns 200 |
| A4 mandate after revoke | fund → MANDATE_REQUIRED; reader/seller revoke → 403 (**fixed**) |
| A5 advance_clock | **Any role, including reader, can move the clock, backwards too.** Buyer jumps ahead → reclaims at once. The clock is wound back after a CAPTURE_DEADLINE → capture of 100 succeeds. An expired mandate wound back → fund succeeds |
| A6 bad capture amounts | **`capture(40.5)` → REFUSED RAIL_AMOUNT, but 40.5 disappears from the rail (total 959.5).** **`capture(true)` → REFUSED RECEIPT_AMOUNT, but the seller gets 1.** -10, 0, 101, 1e9 refused cleanly; "40" → HTTP 503 HOSTED_HTTP_UNAVAILABLE |
| A7 offer price abuse | `offer(price=-100)` accepted. **fund → REFUSED, yet buyer balance 1100 and state "funded"**; deliver then succeeds. `price=0.5` → buyer 999.5. `price=2000` → REFUSED RAIL_FUNDS but the state is still "funded" |
| A8 resolve outcomes | `outcome` = "split", "REFUND", "", null, {"x":1}, missing, and "release" all return **"Dispute resolved and the rail moved the test funds"** with no money moved. The 100 stays on the rail in state "resolved". A caller-supplied receipt `amount: 999999` goes into the receipt chain |
| A9 clawback | After release, at any later clock time, the buyer can dispute and the resolver refunds the seller's 100. There is no dispute window |
| A10 after void | State "expired". A new offer and accept succeed, but fund → HOLD_EXISTS, so the deal is stuck. The mandate is still set |
| A11 idempotency | A repeat `capture(50)` without a key replies **"Captured 50"** and moves nothing. Reader and seller replaying the buyer's release key get the buyer's cached 200 "Released". The N13 re-offer is fixed |
| A12 token forgery | 401 (**good**) |
| A13 conservation, happy + partial + refund + dispute | Holds |

7 conservation failures across A6/A7, on both MCP versions.

## Status of each round 8 finding
| Round 8 | Now | Evidence |
|---|---|---|
| N1 buyer self-resolves (Critical) | **Fixed for the buyer token, bypassed by design.** `resolve` needs `deal:resolve`, but one mint gives the same caller the resolver token, and `?tenant=` re-issues it to anyone | A1, A2 |
| N2 void after delivery | **Fixed** (VOID_AFTER_DELIVERY) | matrix |
| N3 revoke no-op | **Fixed** (fund → MANDATE_REQUIRED) | A4 |
| N4 agent self-approves | **Fixed for the buyer token** (403); approval page 200. Same caveat as N1: the approver token comes from the same mint | A3 |
| N5 sandbox not MCP | **Mostly fixed**: initialize/server-discover/tools-list work on both versions, 25 tools, outputSchema. All 25 tools share one 15-property inputSchema with no `required` and no enums; `ping` → SANDBOX_METHOD (2025) / 400 (2026) | conform.py |
| N6 mid-word breaks at 390 | **Fixed on docs pages**; the sandbox page now clips "Resolv" | t1_home_390, t4_sandbox_0_390 |
| N7 isolation | **Fixed per mint** (new tenant per GET), **undone by the `reuse` URL** | A1 |
| N8 TODO(owner) visible | **Mostly fixed.** It is now a sr-only marker plus a "Not set yet" box. Screen readers still read "TODO(owner)", and the docs llms.txt still contains "TODO(owner): the fee amount" and a raw `<!-- funds-decision:end -->` | agent T1 |
| N9 fee 25.125 vs 25.13 | **Rounding fixed** (sandbox 25.13; the USDC 0.125 example is exact). **New contradiction:** server quote fee = null ("not set yet") and PAYMENTS says "Not set yet", while home, SELLER and the sandbox say 0.5% | t7_payments_390 |
| N10 minor units ×100 | **Fixed in `quote`** (GBP 2, USDC 6). **Not fixed in quick_trade**: amount 120000000 with unit USDC_MICRO → amount_minor 120000000000000 | run_*.txt |
| N11 money block null | **Fixed in the sandbox** (you_pay, seller_gets, minor, decimals). Still null on the public tools | — |
| N12 delivered after full capture; receipt text | **Fixed** (released; "Test signature. No real money moved.") | scen |
| N13 IDEMPOTENCY_CONFLICT after withdraw | **Fixed**, though default keys now silently dedupe a legitimate repeat capture (A11) | A11 |
| N14 seller evidence when disputed | **Fixed** | A13 |
| N15 reclaim untestable | **Fixed** (`advance_clock`), but it is abusable (A5) | A5 |
| N16 schema drift between versions | **Fixed**: the same property sets on 2025 and 2026 | sb_tools.json |
| N17 token flow undocumented; RFC 9728 404 | **Mostly fixed**: llms.txt has a "Sandbox test tokens and roles" section; sandbox metadata 200. The 401 `WWW-Authenticate` still points at account/v1 metadata while the body points at the sandbox | curl |
| N18 contradictory person copy | **Partly**: PAYMENTS now says who holds money. The sandbox banner still says "Hosted USDC has no hold and no refund" above a working hold/refund, and the fee contradiction is new | journey |
| Low items | Refund "Stage RELEASED" **fixed**; mainnet fix example **fixed**; "missing" wording **fixed**. Still open: BOUND jargon, raw ISO times, logo → research brief, price not prefilled, duplicate "Public search did not complete" | |
| Round 7 carry-overs | Approve URL **fixed**; sandbox serif **fixed** (the approval page itself is Georgia serif); receipt contradiction **fixed**; Disputes day counts **not fixed** ("Not set yet"); authority with an agreement priced GBP 120 still NOT_EVALUATED; deploy gap **unchanged**; A14 **still fails** | |

## New findings (severity, root cause, fix)
Files are in PR #201 unless stated.

### Critical
**R9-1. Separation of duties is cosmetic. Any token holder can get the resolver and approver tokens.**
- Root cause: `sandbox_commerce.mint_tenant()`.
  - It mints all five roles in one response.
  - It returns them again to anyone who passes `?tenant=<id>`.
  - The tenant id is the first segment of every token (`<tenant>.<role>.<hex>`).
- Fix:
  - Mint one role per request.
  - Bind each role to a separate principal or session.
  - Drop `tenant=` reuse, or require the original buyer token plus a per-tenant secret.
  - Never put the tenant id in the bearer.

**R9-2. Refused money calls still move money (conservation broken).**
- Repro:
  - `capture(40.5)` → REFUSED, and 40.5 is destroyed.
  - `capture(true)` → REFUSED, and the seller gets +1.
  - `offer(-100)` then `fund` → REFUSED, and the buyer gains 100 with state "funded".
  - `offer(0.5)` → the buyer loses 0.5.
- Root cause:
  - `Desk.perform` changes the rail and ledger (`rail.capture`, `_note`, `rail.authorize`) before the receipt validation that raises.
  - The state transition is applied before money validation.
  - `offer`/`counter` store `price` with no type or range check.
  - Python `bool` passes as `int`.
- Fix:
  - Validate first (strict `type(x) is int and not bool`, 0 < x ≤ hold).
  - Run each tool as one transaction on a copy of the desk, and commit only on success.
  - Add a conservation assertion after every call in tests.

**R9-3. `resolve` with any outcome except exactly "refund" pays nobody, yet says the funds moved.**
- What happens: `release`, `split`, `""` and `{}` → state "resolved", the hold stays on the rail, and only `capture` can move it later.
- A caller-supplied `amount` is written into the receipt chain.
- Root cause: the `else` branch in `resolve` only writes a `dispute_resolved` receipt; `outcome` isn't validated against the authority table's outcome list.
- Fix:
  - Make `outcome` an enum: refund, release, or partial with an integer split.
  - Implement release as capture-remaining.
  - Derive receipt amounts from rail deltas, never from arguments.
  - Make `summary` come from what actually moved.

### High
**R9-4. `advance_clock` is open to every role and can go backwards.**
- It lets the buyer reclaim at once, revives expired mandates, and re-opens capture after the deadline.
- Root cause: the authority table grants advance_clock to all roles, and `perform` sets `self.now = now` without a monotonic check.
- Fix:
  - Limit it to a test-harness principal.
  - Only allow it to move forward.
  - Re-check deadlines against the time of the original event, not the current clock.

**R9-5. There is no dispute window after release.** The buyer can dispute and claw back the seller's payment at any later time (A9).
- Root cause: `authority_table.json` allows `dispute` from `released` with no time bound.
- Fix: add `dispute_by` (owner-set) and refuse after it. Until the owner sets it, refuse disputes after release in the sandbox, or label them clearly.

**R9-6. The sandbox page's step nav overflows at 390px** ("Resolv" is clipped; P2 regresses) **and marks Resolve as current** on the Try page.
- Root cause (docs #13 `sandbox/index.html`): it doesn't load `assets/site.css`, where the nav wrap fix lives, and `aria-current="step"` is hard-coded on Resolve.
- Fix: include `site.css` (or move the nav rules into `components.css`), and set aria-current from the page.

**R9-7. Docs CI is red on #13 and #15, and the browser tests that do exist aren't run.**
- `tools/check_doet.mjs` hard-codes `createRequire('/workspace/node_modules/…')` and `ROOT='/workspace'`. In CI it crashes with "Cannot find module 'playwright'" (run 41859277028). With the paths fixed it passes 40/40.
- `tests/*.test.cjs` aren't in CI. **9 of them fail on #13/#15 but pass on main:**
  - buyer-handoff ×4 and public-listing-display ×4: the new `URLSearchParams(location.search)` (offer prefill) throws "URLSearchParams is not defined" under the vm harness
  - owner-listing-approval ×1: "static document uses … no forms/base": the owner listing page now contains a `<form>`, `<base>` or `<iframe>`, which breaks the page's no-forms/no-connect rule
- Fix:
  - Resolve paths from `import.meta.url`.
  - Run `node --test tests/` in CI.
  - Give the vm harness `URLSearchParams`, or guard its use.
  - Remove the form/iframe from the static owner page, or change the rule on purpose.
- The "Times New Roman" assertion (customer-friction) and deal-structures' `/private/tmp` path fail on main too.

### Medium
- **R9-8. The fee contradicts itself across surfaces.** The server quote's fee is null ("platform fee is not set yet"), and PAYMENTS says "Not set yet", while home, SELLER and the sandbox say 0.5% (25 → 25.13). Main (PR 16, 6 Nov) also "postponed the fee", which conflicts with #13. Fix: one fee source (registry) feeding the server, the docs and the sandbox.
- **R9-9. quick_trade double-scales already-minor units** (USDC_MICRO 120000000 → amount_minor 1.2e14 while you_pay is 120000000). Fix: if `unit` is a minor unit, don't multiply by 10^decimals; add a round-trip test.
- **R9-10. Default idempotency keys turn a real second capture into a fake success** ("Captured 50", no move). Replaying another role's key returns that role's success. Fix: require an explicit key on money tools (or include a nonce), and bind keys to the role that made them.
- **R9-11. The sandbox inputSchema is one union for all 25 tools** (15 properties, nothing required, `outcome` free text), and `ping` isn't supported. Fix: per-tool schemas from the authority table; implement `ping`.
- **R9-12. A refused `fund` still advances the deal to "funded"** (RAIL_FUNDS, RAIL_AMOUNT, 503), and deliver then succeeds. This is the same root as R9-2.
- **R9-13. The deal gets stuck after void**: offer and accept work, then fund → HOLD_EXISTS, and the old mandate is kept. Fix: new hold id per deal generation; clear the mandate on void.
- **R9-14. "TODO(owner)" reaches agents and screen readers**: the docs llms.txt (plus a raw HTML comment) and sr-only `.todo-marker` spans. Fix: strip markers at build; CI should grep built HTML and llms.txt.
- **R9-15. The 401 points at the wrong metadata**: `WWW-Authenticate … resource_metadata=…/mcp/account/v1` on a sandbox 401. Fix: use the sandbox resource URL.
- **R9-16. A stale unit test in PR #201**: `test_public_service_wsgi.test_discovery_adds_fixed_lane_metadata…` asserts 9 public tools while the server has 10. It is the only covenant failure.
- **R9-17. Docs #13 conflicts with main** (11 files) after PR 16. Needs a rebase before review is meaningful.

### Low
- The sandbox MCP mandate summary hard-codes currency GBP while the browser sample is test USDC.
- The approval page is unstyled Georgia serif.
- 2026 is heavier than 2025 on the public probe set (+2%).
- After void, the state name is "expired" rather than "voided".

## Unit tests
| Repo / head | What ran | Result |
|---|---|---|
| covenant #201 `beb7457c` | Every test module present locally: the 23 the stack touches plus `test_hosted_account_market` (a fixture dependency). Package source byte-identical to the head | **192 tests: 191 pass, 1 fail** (R9-16). Earlier errors were missing `jsonschema` and fixtures, now fixed. The authority table self-test reports AUTHORITY_CASES 1800 |
| covenant **full suite** | **Not runnable locally**: the repo is private, the box has no clone credential for it (`gh` gets 404), and the connector reads one file per call. `tests/` has about 970 files (≈12 MB) | — |
| covenant CI on #192, #200 and #201 heads | 30 jobs per head on the newest run: 22 failure, 6 cancelled, 2 skipped. **Every job has no steps and no runner and ended within seconds**, so they never started (likely an Actions quota or billing block) | No CI signal. **#192 was merged with this red, unstarted CI** |
| covenant-docs #15 `262c37e` | Full suite: 7 check scripts, 10 pytest files, 20 node test files, check_doet | Checks 7/7 pass on committed files; **pytest 115/115 pass**; **node 143 tests: 130 pass, 11 fail, 2 skip**; check_doet crashes as shipped, and **40/40 pass** with the paths patched in a temp copy |
| covenant-docs #13 `cb2d77a` | Same | Checks 6/6 (check_agentic_claims arrives in #15); pytest 115/115; node 143: 129 pass, 11 fail, 3 skip; check_doet as above |
| covenant-docs main `c3b5332` (reference) | The 5 failing node files | 2 fail on main too (customer-friction, and deal-structures with a hard-coded `/private/tmp` path). **9 failures are new in #13** (R9-7) |
| docs CI (GitHub) | #13 and #15 `links` job | failure: `Cannot find module 'playwright'` from check_doet's hard-coded path |

## Agent metrics (tokens ≈ chars/4; 2025-11-25 / 2026-07-28)
| Run | Calls | 2025-11-25 | 2026-07-28 | Round 8 (2025 / 2026) |
|---|---|---|---|---|
| Public naive probe set | 32 | 27,719 (7 isError, 3.8 s total) | 28,314 (7 isError, 3.9 s) | 27,516 / 26,695 |
| Sandbox minimal path (mint→receipt) | 10 | 5,730 | 3,425 | 5,472 / 2,860 (9 calls) |
| Scenario A (happy path + negatives) | 21 | 11,734 | 6,831 | 10,947 / 5,762 (19) |
| Scenario C (dispute → refund) | 12 | 6,444 | 3,965 | 5,509 / 3,059 (10) |
| Scenario G (clock/reclaim) | 9 | 5,176 | 3,080 | new |
| Scenario I (idempotency defaults) | 12 | 6,946 | 4,007 | new |
| Sandbox `tools/list` alone | 1 | 34,834 chars (≈8.7k) | 35,059 chars | was not MCP |

- 2026 stays about 40% lighter on the sandbox (38–42% by scenario).
- Public `tools/list` is about 2.4k tokens.
- Attack matrix: 1,274 cells per version with identical outcomes on both versions.
- Naive token discovery:
  - Server card: yes.
  - Docs llms.txt: yes.
  - 401 body: yes.
  - The server itself doesn't serve /llms.txt (404); the docs site does.

## The 4 most telling screenshots (`shots/`)
1. `t1_home_390.png`: N6 fixed. The step links fit with no mid-word breaks; "Stage names" disclosure above the H1.
2. `t4_sandbox_0_390.png`: the new sandbox regression. The step nav is clipped ("Resolv") and Resolve is marked current on the Try page (R9-6).
3. `sb_d15_3_accept_390.png`: the person side working. Sans font, ACCEPTED, fee 25.13 (matches the server's rounding), record rec-1 and next step. Also the 19.9 MB "check a signed record" download.
4. `t7_payments_390.png`: the fee contradiction. "Covenant's platform fee … Not set yet. The owner will confirm this: the fee amount", while home, SELLER and the sandbox state 0.5% (R9-8).

## Reviewer summaries (where a code reviewer should focus)
**covenant #192 `96e7f07` (merged 6 Nov).** Post-merge review, because it landed without CI ever running.
- `covenant_chain/public_service_wsgi.py` (+380): host/TLS/Accept enforcement and error envelopes. Check that the shim-only assumptions (https + Host) hold behind the real proxy.
- `covenant_chain/public_agent_facing.py` (+530): `allowed_next_actions` advertises `offer`, which isn't on the public tool list (A8).
- `covenant_chain/public_fee_quote.py`: rounding and the null-fee path.
- `covenant_chain/demo_services.py` and `data/demo_services.json`: fixture listings must always carry `test: true`.
- `covenant_language/contracts.py` (+208): validation changes; the review `empty_case` still needs the `{"case":…}` wrapper (A14).

**covenant #200 `10934ef` (draft).** Retarget it to main first: its base branch was merged.
- `covenant_chain/money_asset.py`: decimal scaling. quick_trade double-scales an already-minor unit (R9-9).
- `covenant_chain/deal_state.py`: transition table. Confirm refusals never advance state (R9-12).
- `covenant_chain/test_mode_hold.py` and `dummy_payment.py`: the rail model behind the conservation failures.
- `covenant_chain/capability_registry.py` and `data/capability_registry.json`: the `public_tools: "read_only"` string shape that downstream sync code must read.
- `signing_gate.py` and `response_envelope.py`: signed/paid flag consistency.
- `tools/check_capability_registry.py`: make it fail on tool-name drift.

**covenant #201 `beb7457c` (draft).** The highest-risk PR. Review these before anything else:
- `covenant_chain/sandbox_commerce.py` (+559), specifically:
  - `mint_tenant` (R9-1)
  - `Desk.perform`: non-atomic money ops before validation (R9-2/12), `resolve` outcome handling (R9-3), `advance_clock` (R9-4), the `offer`/`counter` price check
  - `call()`: default idempotency keys (R9-10)
- `covenant_chain/data/authority_table.json` (+610): advance_clock for every role; dispute from `released` with no window (R9-5).
- `covenant_agent/x402_auth_capture.py`: amount type checks; bool accepted as int.
- `covenant_chain/ap2_mandates.py`: expiry checked against a rewindable clock.
- `covenant_chain/idempotency.py`.
- `covenant_chain/public_service_wsgi.py`: the sandbox routes and the 401 `WWW-Authenticate` resource (R9-15).
- `covenant_chain/mcp_2026.py`: `ping`, and the per-tool schemas (R9-11).
- `tests/test_public_service_wsgi.py`: the stale 9-tool assertion (R9-16).
- Ask for tests that assert conservation after every call and that try `?tenant=` reuse.

**covenant-docs #13 `cb2d77a` (ready, conflicts).** Rebase it on main first (11 conflicts; main's PR 16 postponed the fee).
- `.github/workflows/check-links.yml` and `tools/check_doet.mjs`: hard-coded `/workspace` paths make CI red, and `tests/*.test.cjs` aren't run (R9-7).
- `sandbox/index.html`: no `site.css`, a hard-coded aria-current, and the banner copy (R9-6, N18).
- `assets/deal-machine.js`, `assets/matrix.js` and `assets/terminal.js`: `URLSearchParams` use breaking 8 vm tests (the offer prefill); a form/base/iframe on the static owner-listing page breaks its no-forms test.
- `distribution/capability-registry*.json`: committed stale; re-sync from the server (Step 1).
- `docs/PAYING.html`, `PAYMENTS.html` and `llms.txt`: fee and refund statements must come from the registry (R9-8).

**covenant-docs #15 `262c37e` (draft, base #13).**
- `tools/check_agentic_claims.py` (+116): it passes against the stale committed projection; after a real sync the drift check fails. It should run on synced data.
- `llms.txt`: the new token section is good, but "Reclaim is not" is now false, and "TODO(owner)" plus `<!-- funds-decision:end -->` leak into agent context (R9-14).
- `docs/AGENTIC_COMMERCE.html`, `APPROVALS.html`, `RECEIPTS.html` and `TRUST_AND_LEGAL.html`: claims about approvals and separate principals overstate what the sandbox enforces (R9-1).
- `docs/DISPUTES.html`: timelines are still "Not set yet", and there is no statement of the post-release dispute window (R9-5).
- `distribution/glossary.json`: generated terms; check they match the server stage names (BOUND/SETTLED).

## Files
- `report.md`, `scores.csv` (baseline / round 7 / round 8 / now; 144 task × principle rows, means, and P1–P20 / A1–A15), `mkscores.py`
- `capability_registry.server.json`, `authority_table.server.json`, `step1_before.txt`, `step1_after.txt`, `sync15/` (synced clone, not pushed), `tree_beb.json`
- `unittest_beb_r9.txt`; `docs15_tests.txt`, `docs13_tests.txt`, `docs_node_counts.txt`, `check_doet_t15.txt`, `check_doet_t13.txt`, `docs15_ci.log`
- `journey_{1280,390}.{json,log}`, `pages15.json`, `sbp_*.json`, and `shots/` (91 PNGs)
- `agent/`: run_*, scen_*, attacks_*, matrix_*, conform.py, `r9b/` (today's re-run on the byte-exact build)

## Limitations
- The covenant full suite (≈970 test files) couldn't run on the box: the repo is private and the box has no clone credential. GitHub CI never started on any head.
- The person journeys were captured on 4 Nov against the same docs heads (unchanged since), and I re-read their output today.
- Scores are my own judgement against the checklist, made from this round's evidence only.
- I requested no reviews and made no GitHub comments. The reviewer summaries above are ready to paste.
