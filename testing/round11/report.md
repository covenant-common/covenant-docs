# Round 11 independent test: server #201 and #212, docs #13, #15 and #17

Tested on 9 Nov 2026, 21:47 to 22:10 (London, UTC+0). Nothing was pushed, posted, signed, paid or emailed. I left no GitHub comments or reviews, and I made no live calls apart from read-only GitHub API reads and a `git fetch` of public PR refs. All runs were local rebuilds.

## Heads verified

| PR | Head | Base | How I verified it |
|---|---|---|---|
| covenant #201 | `fa883649c9d1` | `cursor/deal-kernel-ce0e` | I applied the compare beb7457c…fa883649 (4 commits: 8ce4318c, 0bd04a60, a9977a1a, fa883649) to my byte-exact beb7457c tree. Every changed code file matches its git blob SHA. Build: `build_fa/`. |
| covenant #212 | `64d3eef73c5a` | fa883649 (stacked) | 1 commit (64d3eef7). I applied the patches on top of build_fa, blob-verified. Build: `build_212/`. |
| covenant-docs #13 | `7022e8a8098c` | main `c3b53327` | `git fetch pull/13/head`, then worktree `dk/w13`. Not a draft. Clean. |
| covenant-docs #15 | `561bf154a2f9` | #13 | `dk/w15`. Draft. Clean. |
| covenant-docs #17 | `8084d2a241ad` | #15 | `dk/w17`. Draft. Clean. 18 files, +719 −19. |

All five heads match what the server and docs agents reported.

## CI

| Head | Result | Meaning |
|---|---|---|
| #201 fa883649 | 55 check runs: 49 failure, 4 cancelled, 2 skipped | **No signal.** Every job has `runner_name` empty and 0 steps. The macOS suite jobs "ran" 5–15 minutes, but that was queue time; they also had 0 steps. This is still the Actions spending limit, not a code failure. |
| #212 64d3eef7 | 55 check runs: 49 failure, 4 cancelled, 2 skipped | Same. Run 42705603964: 25 jobs, all with 0 steps and no runner. |
| docs #13 7022e8a8 | 1 check, `links`: success (58 s) | Real green. |
| docs #15 561bf154 | `links`: success (45 s) | Real green. |
| docs #17 8084d2a2 | `links`: success (60 s) | Real green. |

## Server: status of each R9 and R10 finding

I rewrote the harness for the new minting flow (`agent/ip6.py`):
- buyer from HTTP `GET /sandbox/test-tokens`;
- seller from `?role=seller&invite=`;
- resolver, approver, reader and harness from the in-process `mint_harness_role`.

The same attack script (`agent/attacks6.py`) ran on both builds and both MCP versions, 82 rows each. It covers:
- a refused-call grid: 504 cases, 4 states × 9 money or price tools × 14 bad values, including 40.5, True, −100, 0, 0.5, "100", 10^30 and 2^53;
- a seeded random fuzz: 60 deals × 25 calls = 1500 calls, random tool, role and value.

The #201 results are identical on 2025-11-25 and 2026-07-28. #212 is identical to #201 once the shared global circuit is reset between calls (`attacks6_reset.py`, 0 diffs). Without that reset, #212 diverges because of N1 below.

| Id | Status on fa883649 | Evidence |
|---|---|---|
| R9-1 every role from one mint, reuse URL | **Verified fixed** | `GET /sandbox/test-tokens` returns only `role=buyer`, `token` and `seller_invite`. `?tenant=` and `?role=buyer&tenant=x` → 400 TENANT_REUSE_CLOSED. `role=resolver/approver/harness/reader` → 403 SEPARATION_OF_DUTIES. Seller without an invite, or with a bogus one → 403 SELLER_INVITE. The invite is single-use: the second use is 403. Adding `&role=resolver` to a valid invite → 403. The token does not contain the tenant id. Two buyer mints get different tenants. Tenant B's seller cannot accept tenant A's offer (ACCEPT_RECIPIENT). A random bearer gets 401. |
| Separation of duties | **Verified** | `mandate.approve` as buyer, seller, resolver or reader → 403. `resolve` as buyer, seller, approver, reader or harness → 403. The approval page is GET-only (POST 404, PUT 405). See N2: this also means nobody can approve over HTTP. |
| R9-2 refused calls move money | **Verified fixed** | 504-case grid and 1500-call fuzz: 0 conservation failures and 0 balance or state changes on a refused call, on both versions and both builds. The ledger total is always 1000, the platform treasury is 0, there are no negatives, and the escrow equals the open hold. |
| R9-3 resolve outcomes | **Partly fixed** | Junk outcomes (`split`, `''`) and bad splits (−1, 30.5) → RESOLVE_OUTCOME with no movement. `refund` returns everything and `release` captures the rest; receipts state the real rail delta. **But `partial` ignores `split` whenever nothing has been captured yet** (N3): from funded or delivered, split 0, 30, 50, 100 and 150 all end buyer 900 / seller 100, and the reply says "Resolved as partial. The rail moved 100". split=150 > price is accepted. |
| R9-4 the clock | **Verified fixed** | Buyer, seller, resolver, approver and reader → 403. The harness moves 1 → 5; then 1, 0, −5, True and 20000.5 → CLOCK_NOT_FORWARD; 20000 is accepted once, and repeating it is refused. Reclaim works after the deadline. |
| R9-5 dispute after release | **Verified fixed (server)** | Buyer or seller dispute after release → DISPUTE_WINDOW. Seller refund after release → DEAL_TRANSITION. No day count is published (owner). |
| R9-9 quick_trade USDC_MICRO | **Verified fixed** | 120000000 USDC_MICRO gives `amount_minor` 120000000 and `you_pay` 120000000. See N7 for a unit inconsistency on the GBP path. |
| R9-10 idempotency | **Verified fixed** | A money tool without a key → IDEMPOTENCY_KEY_REQUIRED and nothing moves. Replaying the same key and amount gives the same reply and moves no money. The same key with a different amount → IDEMPOTENCY_CONFLICT with no movement. A seller replaying the buyer's key → 403. Low: a replay is not marked `replayed: true`. |
| R9-11 shared schema, no ping | **Verified fixed** | `ping` → `{"result":{}}`. tools/list now has 13 distinct schemas for 25 tools, against 1 on beb. |
| R10-6 tools/list size | **Partly fixed; regresses on #212** | Sandbox tools/list: beb 34,834 B (~8.7k tokens), #201 25,745 B (~6.4k), **#212 36,335 B (~9.1k), 35 tools.** |
| R9-12 refused fund advances state | **Verified fixed** | After a bad offer price, fund → DEAL_TRANSITION and the state stays draft. A 2000 price → RAIL_FUNDS and the state stays agreed. |
| R9-13 stuck after void | **Verified fixed** | Void → expired with the mandate cleared. Offer, accept, a new mandate, approve and fund then succeed on a new hold. Money is conserved. |
| R9-15 401 header | **Verified fixed** | `WWW-Authenticate: Bearer realm="aap-account", resource_metadata=".../oauth-protected-resource/mcp/sandbox/v1"`. The sandbox PRM is served. Cosmetic: the realm still says "aap-account". |
| R9-16 stale 9-tool test | **Verified fixed** | No 9-tool assertion remains; the test asserts 10. |
| R10-3 next_actions caller-only, approve → status | **Verified fixed** | After an offer, the buyer gets `waiting_on: [{action: accept, for_role: seller, callable: false}]`. After `mandate.create_request`, next_actions has `tool: mandate.approve, for_role: approver, callable: false` with the URL. |
| R10-4 2026 fields | **Verified fixed** | 2026-07-28 structuredContent has `allowed_next_actions`, `errors`, `warnings`, `next_actions` and `waiting_on`. |
| R10-11 offer on agreed deal | **Verified fixed** | REFUSED DEAL_TRANSITION: "This deal is agreed. No new offer was sent." |
| Public MCP list | **Unchanged and compatible** | `/mcp` tools/list has 10 tools on beb, #201 and #212, on both 2025-11-25 and 2026-07-28. The same 10 names. The sorted-tool hash is identical across builds (2025 `16d3ca5a…`, 2026 `15627244…`). |

## #212 Scaling Trust: adversarial results

Script: `agent/st6.py`, 108 rows, plus `st6b.py` (seller-disputer bond) and `st6c.py` (reclaim under an open circuit). Money was conserved in every row. The one conservation flag comes from a fixture where I credited the seller 5 units from nowhere; that is my test setup, not a product bug.

| Question | Answer | Evidence |
|---|---|---|
| Can the wrong role reset a circuit? | **No** | `covenant_sandbox__circuit` reset, reset `scope=global`, and read as buyer, seller, resolver, approver or reader → 403. |
| Can a circuit be tripped by the wrong party? | **Yes. Critical (N1)** | One buyer from an anonymous HTTP mint sends `capture {amount: 10**15+1}` (or 10**16 even in **draft**, or a seller sends `refund 10**16`, or a buyer offers price 2^53−1, the seller accepts, and the buyer funds). That trips the module-wide `GLOBAL` circuit. After that every money call in **every tenant** returns CIRCUIT_OPEN: tenant B's legitimate capture 10, a fresh tenant's fund, and the victim's **reclaim and void after the deadline**. Only a harness token can reset GLOBAL, and the harness is not mintable over HTTP. On a live process this is a one-request global freeze until restart. It also contradicts AGENTS.md, scaling-trust.md and the reply text ("In-flight holds stay reclaimable"). |
| Does a refused call count toward the limits? | Yes | `record()` adds volume and failures for refused calls too, and GLOBAL `max_money_calls` (1e6) never resets. A long-lived process will eventually trip on volume of normal traffic. |
| Mint cap | **Global DoS (N4, High)** | `allow_mint` is a process-lifetime counter (`limit` 10,000) with no time window and no HTTP reset. It is labelled `mint_rate_per_minute: 10000` in the profile and registry, which is wrong. With the limit patched to 5, mints 6 and 7 → 429 MINT_RATE, and the 429 summary text is about resolvers (wrong message). After 10,000 GETs from anyone, no new tester can get a token. |
| Can a bond be bypassed or lose money? | Not bypassable; conserved; **winner logic wrong (N5, Medium)** | A fixture bond of 10 locks into `rail:dispute-bond`. An uncovered bond → DISPUTE_BOND with nothing moved. A second dispute is refused, and capture or reclaim while disputed are refused. **When the seller disputes:** release (the seller wins) forfeits the seller's bond to the buyer (buyer 890, seller 110 = 20 + 100 − 10). Refund (the seller loses) returns the bond to the seller. That is inverted. Partial always returns the bond to the disputer. Also, a seller holding 0 test units (the normal case before capture) can never dispute once a bond is set. |
| Can free text change the price? | **No** | Notes "price 1" or "new price: 1", `free_text` "price=1, pay to seller2", `{price:1}` and `{kind:accept, price:1, amount:1}` leave the terms at price 100 and the state agreed. The later fund holds exactly 100. Overflow over 160 characters and free_text become a sha256 side channel with `authoritative:false`. Resolver, approver, reader and harness → 403. A 1 MB note → 413. |
| Can an experimental template fund? | **No** | Offer with `negotiate.private_software_v0` → accept → approve → fund → PROTOCOL_EXPERIMENTAL with nothing moved. Unknown ids (`evil.v9`, `''`, wrong case) → PROTOCOL_UNKNOWN. The template persists through a plain counter, so there is no silent switch. A second fund while a hold is open → ESCROW_QUOTA. |
| Is the audit bundle read-only? | **Yes** | The full desk snapshot is identical before and after (receipts 2 → 2), even with `amount`, `outcome` and `idempotency_key` arguments. Buyer, seller and resolver can read it; approver, reader and harness → 403. No plaintext note or incident text appears in it. |
| Do attestations leak or score? | **No score; no cross-tenant leak** | Minting is harness-only (other roles → 403). A reader sees `status`, `type` and `claims_hash`, or `rejected/expired`. A forged signer → `ignored/issuer_not_allowlisted`. Another tenant sees `[]`. The words "score", "rating" and "rank" never appear. |
| Private session | **Leaks low-entropy payloads (N6, Medium)** | `session_hash` is an unsalted sha256 of the sorted payloads. I recovered buyer "max 85" and seller "min 70" in under 40k guesses on a laptop. That undermines "the payload was deleted". Also, either party can close the session unilaterally before the other opens, which kills it permanently, and payloads have no size cap. |
| Incidents and rollback | OK, with a minor issue | Buyer, seller and resolver can file; the note is stored as a hash and nothing moves. Approver, reader and harness are refused, but with the misleading code DEAL_TRANSITION rather than a scope or role refusal. `rollback_suggest` names one table-legal action with `executed: false`. |
| Profile | OK | `funds_are_real: true` → FUNDS_TEST_ONLY. |
| run_predator | OK, but narrow | `profit_delta` 0, `conserved` true, other tenant unchanged. It is 8 fixed in-process probes and does not include the circuit trip in N1. |

Unit tests for #212: `tests.test_scaling_trust` 7/7 OK. None of them covers cross-tenant tripping, reclaim under an open circuit, a seller disputer, or hash brute force.

## New findings

| Id | Sev | PR | Finding | Suggested fix |
|---|---|---|---|---|
| N1 | **Critical** | #212 | One anonymous buyer call with a huge `amount` (or a 2^53−1 price) trips the shared GLOBAL circuit. That freezes every money tool, including reclaim and void, for every tenant until a harness that HTTP cannot mint resets it. This contradicts "in-flight holds stay reclaimable". | Validate the amount (int, ≤ the hold or price) before `reason()`. Never let one tenant open GLOBAL; GLOBAL should trip only on aggregate, windowed rates. Exempt reclaim and void from the breaker. Add a cross-tenant test. |
| N2 | **High** | #201 (and #212) | No HTTP path can approve a mandate or resolve a dispute. Approver and resolver are only minted in-process, and `/sandbox/approve/<state>` is GET-only with no form. Over the network, an agent can offer and accept but never fund. The docs testing README says "the approver token or the passkey page approves", and docs #15/#17 say fund, capture and the rest "move test money in the server sandbox". Both are untrue for an external tester. | Add an approver invite (like the seller invite) or a POST approval with a one-time code. Do the same for the resolver, or a harness-resolved demo. Otherwise make the docs say the funded half is local-only. |
| N3 | **High** | #201 | `resolve partial` ignores `split` when nothing is captured: all funds go to the seller and split > price is accepted. The PR and round9-findings say R9-3 is fixed. | Define `split` as the buyer's share of the authorised amount: refund or void `split` and capture the rest. Refuse `split` > the hold. Add tests for funded and uncaptured cases. |
| N4 | High | #212 | The mint cap is a global lifetime counter (10,000), not a per-minute rate, and has no reset. Anyone can exhaust it. It is mislabelled `mint_rate_per_minute`, and the 429 message is about resolvers. | Use a sliding window per IP or client, with a global ceiling. Fix the label and the message. |
| N5 | Medium | #212 | The bond winner is inverted when the seller disputes; partial always refunds the disputer. A seller with a 0 balance can never dispute once a bond is set. | Winner = the party the outcome favours. Decide partial explicitly (owner). Allow the seller's bond to come from the held amount, or exempt it. |
| N6 | Medium | #212 | The private-session `session_hash` is an unsalted hash of the payloads and is brute-forceable. A unilateral close kills the other side's session. | HMAC with a per-session random key that is deleted on close, or return only `match` plus a commitment. Require both sides, or a timeout, to close. |
| N7 | Medium | #201 | `quick_trade` money units are inconsistent. For GBP £100 it gives `amount_minor` 10000 while `you_pay` and `seller_gets` are 100 (major units). For USDC_MICRO `you_pay` is in minor units. | Name the fields `you_pay_minor`, or always use minor units. |
| N8 | Low | #212 | Each refused CIRCUIT_OPEN call appends a `circuit_open` receipt (seen in draft), so a refused call changes the receipt chain. Incident refusals use DEAL_TRANSITION instead of a role or scope code. | — |
| N9 | Low | #201 | The approval page shows Python reprs and placeholders (`fee: None`, `agreement_hash: aaaa…`, `cnf: did:aap:local:cccc…`). | — |

## Unit tests (local, focused)

| Module | #201 | #212 |
|---|---|---|
| test_round9_attacks | 7 OK | 7 OK |
| test_round10_hints | 4 OK | 4 OK |
| test_sandbox_acceptance | 2 OK | 2 OK |
| test_sandbox_defects | 11 OK | 11 OK |
| test_authority_table | 9 OK | 9 OK |
| test_doet_checklist | 13 OK | 13 OK |
| test_trusted_surface | 1 OK | 1 OK |
| test_paid_hosted_access | 57 OK | 57 OK |
| test_scaling_trust | — | 7 OK |
| test_public_service_wsgi | 15/16 (1 error: no `jsonschema` here) | same |
| test_hosted_market_trust | 18/21 (3 errors: `examples/hosted_trust_demo.py` not in my rebuild, because I applied only the changed files) | same |

The 4 errors are environment or rebuild gaps, not product failures. The tests pass, but they miss N1 to N6.

## Server docs vs behaviour

- **round9-findings.md:**
  - Accurate for R9-1, R9-2, R9-4, R9-5, R9-9 to R9-13, R9-15 and R9-16.
  - **Overstates R9-3** (partial, N3).
  - Its line "approver token or passkey page approves" (in docs/testing/README.md) is not true over HTTP (N2).
  - The R9-6, R9-7, R9-14 and R9-17 rows say "Unresolved" for docs items that docs #13 has since fixed. That is stale but harmless.
- **round10-findings.md:**
  - Accurate for R10-3, R10-4 and R10-11.
  - R10-6 is "fixed" only partly (6.4k tokens), and #212 makes it worse (9.1k tokens).
- **AGENTS.md (#212):** "a tripped money circuit leaves an in-flight hold reclaimable … a stranger cannot reset it". The first half is **false** (N1). The second half is true, but nobody can reset it over HTTP.
- **scaling-trust.md:**
  - ST3 "leaves the hold … reclaimable" is false (N1).
  - ST4 "Release forfeits it to the other party" is wrong when the seller disputes (N5).
  - ST2 "mint rate" is actually a lifetime cap (N4).
  - The test names exist and pass.
- **llms.txt:** the minting text is accurate.
- **README:** unchanged by both PRs.
- **CLAUDE.md:** points reviewers to the right files; the rest is the usual long history.

## Docs PRs #13, #15 and #17

Docs tests (my runs):

| Check | #13 | #15 | #17 |
|---|---|---|---|
| check_public_site | PASS | PASS | PASS |
| check_links, build_site --check, registry_drift, lint_jargon, lint_tool_counts | PASS | PASS | PASS |
| check_agentic_claims | n/a (tool not on #13) | PASS | PASS |
| pytest (tests + tools) | 116 pass, 7 skip | 116 pass, 7 skip | 119 pass, 7 skip |
| node | 143 run, 140 pass, 0 fail, 3 skip | 143 run, 141 pass, 0 fail, 2 skip | 143 run, 141 pass, 0 fail, 2 skip |
| check_doet | 40/40 | 40/40 | 40/40 |

| Id | Status | Evidence |
|---|---|---|
| R10-1 fee sentence / £0.60 | **Mostly fixed** | £0.60 and 120.60 are gone from all three heads. The fee sentence appears at most once per page. Left over on #15/#17: custody and merchant sentences repeat within a page. TRUST_AND_LEGAL has "In test mode, the test rail holds it…" ×2 and "The seller is the merchant of record." ×2; RECEIPTS has "Covenant never holds your money." ×2; SELLER has "Covenant does not hold it." ×2 (also on #13). **New in #17:** SCALING_TRUST has "The seller is the merchant of record." ×3 in one paragraph. |
| R10-2 stale manifest | **Verified fixed** | check_public_site PASS on all three, and hosted `links` is green on all three. |
| R10-5 9-tool inventory | **Verified fixed** | `toolCount` is 10 in mcp/tool-inventory.json, .well-known/ai-catalog.json and the server card. |
| R10-7 PR text test count | **Fixed for #15; small new mismatch on #17** | #15 now says standards-cards has 2 tests, 2 pass (matches). #13's numbers match my run. #17 says "Node: 142 run, 140 pass, 2 skip"; I measured 143 run, 141 pass, 2 skip. #17's "test_scaling_trust.py 3 pass" matches. |
| R10-8 TODO(owner) | **Partly fixed** | The RESOLVE meta description is clean, and no visible or meta TODO remains in the HTML. On #15/#17, `distribution/glossary.json` still has `"owner_todo": "TODO(owner): the number of days."` (and one more entry); #13 has none. `check_owner_todos` passes because it only checks the glossary `body`. |
| R10-9 a11y | **Verified fixed** | `priceFieldErrors` echoes the typed text ("“…” is not a price"). `showFieldError` sets `aria-invalid` and moves focus. The AGENT.html onward link now reads "Connect an agent". The ~400 px of chrome above the H1 at 390 px remains, inside a collapsed "Stage names". |
| Connect link | **Verified fixed** | As above. |
| R10-10 comparison | **Fixed, honestly** | SELLER.html has a "Compared with other markets" section naming Etsy and Stripe. It gives payout timing and chargebacks as "Not set yet" with reasons. It contains no invented numbers. |
| 390 px pass (#17, 12 pages incl. 3 new) | **Pass** | scrollWidth 390 on all; tables 356 px wide (card layout); no element past the viewport; no tap target under 24 px; no page errors; DOET no-overflow-375 and tap-targets-44 pass. Screenshots: `shots/d17_*.png`. |

**#17 claims vs what #212 ships:**
- **No over-claims about ST features.** Every ST item is marked "Planned … Do not call this tool."
- **Over-claim inherited from #15 (N2):** "Offer, counter, accept, fund, deliver, capture, release, void, refund, reclaim and dispute … move test money in the server sandbox." Over HTTP, fund cannot happen because there is no approver. Nor can a dispute be resolved.
- **Mismatches with #212's design:**
  - The page promises `retry_after` on breakers; #212 returns none.
  - It says "a stranger must not be able to close the breaker"; #212 lets a stranger *open* it for everyone (N1).
- **Stale once #212 merges and the registry is synced.** #212's registry adds `sandbox_profile`, `limits`, `attestation_types`, `structured_channel` and the 10 ST tools to `works_in_test`. #17's sentences "the registry does not list covenant_deal__message", "no limits block" and "no attestation_types" would become false, and registry drift would fail.
- **Docs testing/README.md** says R10-3, R10-4, R10-6 and R10-11 are "still open in the covenant server"; a9977a1a fixed R10-3, R10-4 and R10-11.

## Codex-review readiness

| PR | Ready for a Codex review? | Why |
|---|---|---|
| covenant **#201** | **Yes, with these findings attached.** | All the critical R9 items (minting, conservation, clock, dispute window) are verified fixed on both protocol versions. The public list is unchanged. Codex should be pointed at N2 (no HTTP approver or resolver, so the sandbox cannot fund for external agents), N3 (partial ignores split) and N7. N2 and N3 should be fixed or documented before merge. CI gives no signal (no runners). |
| covenant **#212** | **Not yet.** | N1 is a one-request, cross-tenant money freeze that contradicts the PR's own docs. N4 is a global token DoS. N5 inverts the bond, and N6 leaks the private payload. Fix N1 and N4 at least, add cross-tenant tests, then send it to Codex. |
| docs **#13** | **Yes.** | Green CI, tests and DOET 40/40. R10-2, R10-5 and R10-9 are fixed. A few leftover duplicate custody sentences remain. |
| docs **#15** | **Yes, after one copy fix.** | Remove the duplicate custody and merchant sentences and the glossary.json TODO(owner). Reword "move test money in the server sandbox" until N2 is fixed. |
| docs **#17** | **Yes, for docs-accuracy review, but keep it draft.** | It honestly marks every ST item Planned. It needs: the triple merchant sentence, the Node count (143/141), the `retry_after` promise, and a note that its "registry does not list" lines must change when #212 lands. It should not merge ahead of #212's fixes. |

## Files

- Harness and scripts: `agent/ip6.py`, `attacks6.py`, `attacks6_reset.py`, `st6.py`, `st6b.py`, `st6c.py`, `legacy6.py`, `pub6.py`, `w401.py`, `qt.py`, `appr.py`.
- Raw results: `agent/attacks6_*.json`, `attacks6r_*.json`, `st6_2025-11-25.json`, `*.txt`.
- Unit tests: `ut_fa.txt`, `ut_212.txt`. Docs tests: `dk/tests_13|15|17.txt`. CI: `ci_*.json`. 390 px screenshots: `shots/`.

This report is ready to share with Codex or Claude. I did not request any review.
