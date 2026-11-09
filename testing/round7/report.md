# Covenant DOET round 7: average person and naive agent (re-measured)

Builds tested locally: docs PR #13 c72f8b80, server PR #200 @10934ef4. Addendum: server draft PR #201 head 918c3b59, docs draft PR #15 head f11e89be.
Live (read-only): https://jupie202020.pythonanywhere.com/mcp and covenant-common.github.io/covenant-docs.
Limits kept: nothing signed, published, paid, emailed or pushed; no account or trial; live was read-only. I re-measured every score and did not use any number from a PR body.

## Headline (local builds, 1–5)
| Persona | Baseline | Now (#13/#200 local) | Live today |
|---|---|---|---|
| Person | 2.54 | **3.28** | ≈ baseline (DISPUTES/FIND/RESOLVE pages 404 on live) |
| Agent | 2.62 | **3.53** | ≈ baseline (server-card 404, search 92,981 chars, empty evidence returns true, float amount returns -32700) |

None of the fixes are live yet, which is the deploy gap. Every task × principle score, plus the P1–P20 and A1–A15 pass/fail results, are in `scores.csv`. The JSON summary is in `summary.json`.

### Per principle (before → now)
| Principle | Person | Agent |
|---|---|---|
| Discoverability | 2.56 → 3.78 | 2.56 → 3.44 |
| Affordances | 2.56 → 3.44 | 2.56 → 3.33 |
| Signifiers | 2.56 → 3.33 | 2.33 → 3.44 |
| Mapping | 2.56 → 3.22 | 2.44 → 3.44 |
| Feedback | 3.00 → 3.11 | 2.78 → 3.89 |
| Constraints | 2.22 → 3.22 | 3.00 → 3.44 |
| Conceptual model | 2.56 → 3.11 | 2.44 → 3.44 |
| Error prevention/recovery | 2.33 → 3.00 | 2.89 → 3.78 |

Checklist: people pass 11/20 (P1–4, P12*, P13, P15–18) and agents pass 9/15 locally (A1–5, A7, A10, A12, A13, A15). Gulfs: execution is small for the agent's read tasks and person T6, and still large for agree and pay (person T4/T5, agent T5/T6). Evaluation is medium almost everywhere, because state labels lag behind actions.

## Agent metrics (my measurements, harness agent/h.py)
| Run | Calls | Tokens (est) | Manual steps |
|---|---|---|---|
| Baseline (7 tasks) | 14 | ~7,100 | ~8 |
| Local #200, minimal 7-task path | 10 | ~9.5k | ~5 (no accept or pay tool) |
| Local #200, full probe set | 26 MCP + 3 HTTP | ~24.3k | — |
| DummyDesk negotiation + dummy pay (local test signer) | 18 | ~6.9k | ~5 |
| #201 sandbox, happy path, MCP 2025-11-25 | 15 | ~8.9k | ~2, and a naive agent cannot get the token |
| #201 sandbox, happy path, MCP 2026-07-28 | 15 | ~9.3k | same |
| #201 full probe set, 2025-11-25 / 2026-07-28 | 26 / 26 | 24.7k / 38.1k | 2026 costs about 1.7× the tokens |
| Live (read-only) | 17 | ~42.8k | — |

## Remaining failures (severity, root-cause fix)
**Critical (#201 sandbox)**
1. The proposer can accept their own offer. `sandbox_commerce.accept` always calls `apply('accept','seller')`, and the accept edges in deal_state.py still allow the author. Result: the seller accepted their own £130 counter and it got funded. Fix: only the recipient can accept, and pass the caller's real role.
2. `fund` works with no offer or agreement because it forces `state='agreed'`. Fix: remove that override and enforce the transition.
3. `capture` works before delivery. Fix: only allow capture from delivered or resolved.

**High**
4. `resolve(refund)` marks the deal refunded but moves no money. Refund then returns 503 and only `void` gives the money back. Fix: resolve should call void, or refund the captured amount.
5. `release` and `reclaim` are advertised but return 503. Fix: implement them or remove them from works_in_test.
6. The AP2 mandate is not checked before fund, and the approve URL returns 404. Fix: fund should require a valid mandate.
7. One global Desk is shared by every bearer holder. Fix: give each token its own store.
8. The hard-coded "sandbox" token has all scopes, and there is no authorization server metadata, so a naive agent cannot authenticate. Fix: publish RFC 9728 metadata plus a documented test token flow.
9. Authority returns PASS when no offer amount is given (budget 100). Fix: return NOT_EVALUATED or fail.
10. The fee is rounded up to a whole unit (0.6 becomes 1 on 120 at 50 bps) with no waiver. The sandbox quote says fee None while the public quote says 1. Fix: use minor units, one fee function, and show the waiver.
11. Base Sepolia `quick_trade` returns `test_network:false` (A9). Fix: map 84532 and 11155111 to test.

**Medium**
12. Free-form settlement `{mode:"test"}` is accepted (A6). Fix: validate against the payment-methods ids.
13. `next_actions` name "account offer", which is not a tool (A8). Fix: name real tools or say no tool exists.
14. Search uses AND matching with no stemming: "logo designer" finds 0 and "logo" finds 1. Fix: OR or stemming fallback.
15. review-reference `empty_case` is refused when pasted as-is, and only works wrapped in `{"case":…}` (A14). Fix: publish the wrapped form.
16. `/payment-methods.json` returns 404 on the local server build. The live server has it.
17. #201 with MCP 2026: tools/list drops input schemas, HeaderMismatch errors give no fix, and the server card lists neither 2026-07-28 nor the sandbox.
18. Generic 503 HOSTED_HTTP_UNAVAILABLE errors. A fake evidence hash "ddd…" is accepted. The receipt says SIGNED_TEST but also signed:false. flags.test_mode is false while top-level test_mode is true. A partial capture leaves money on hold with no prompt.
19. Person, sandbox: Propose has to be clicked twice and its label never changes. Stage still reads PROPOSED after Accept. The fund step holds 20 but the deliver and dispute messages say 25. A refund is described as "REFUTED … RELEASED". Fix: drive all of these from one state object and derive the labels and amounts from it.
20. Person: a bad price gives "Choose a currency." Fix: give a per-field message.
21. Person: no version thread with author and time (P10), and no record id after accept (P11).
22. Person: the Disputes page gives no day counts (P19).
23. The #13 DELIVER and RESOLVE pages redirect to unrelated anchors (fixed in #15).
24. #15 AGENTIC_COMMERCE table is clipped at 390px. Fix: wrap it in an overflow-x container or stack it.
25. The Find page calls the live MCP from the browser, so local previews show no listings, and P5/P7 cannot be tested before deploy. Fix: add a fixture fallback.
26. The site falls back to a serif font.

**Deploy gap:** none of the above fixes are on live.

## Addendum: #201 / #15 independent pass
- Tests: 56/56 unit tests pass on #201 (unittest201_out.txt) and 29/29 on #200.
- Naive agent through both MCP versions: both work. Initialize on 2025-11-25 first returned 400 because my harness sent mismatched protocol versions, which is a harness artifact; after that every call worked. 2026-07-28 needs the Mcp-Method/Mcp-Name headers and uses server/discover.
- End-to-end sandbox (sandbox201_*.json):
  - Happy path: buyer 870 / seller 120, with 10 still on hold.
  - Dispute path: the buyer only gets the 1000 back after void.
  - The critical findings are 1–3 above.
- Browser sandbox (#13 and #15): both paths complete. Happy ends buyer 75 / seller 25. Refund returns the buyer to 100. The wording problems are in item 19.
- Docs say "planned" but the #201 registry says works_in_test. The #15 AGENTIC_COMMERCE "What works today" page lists these as Planned or unpublished:
  - MCP 2026-07-28 ("server/discover is not offered")
  - RFC 9728 ("Not published")
  - agent card
  - AP2 ("Library only")
  - x402 auth-capture ("Not in the registry")
  - partial capture

  The #201 registry has a `sandbox` block with works_in_test: discover, quote, mandate, offer, counter, accept, authorize, capture, void, refund, reclaim, dispute, receipt. Part of that claim is also wrong: refund, reclaim and release return 503.
- Other docs/server drift:
  - The #15 distribution/capability-registry.json is still a 9-tool projection with a stale note ("Draft PR 200 was not readable (HTTP 404)"). The server has 10 tools.
  - `tools/sync_capability_registry.py --checkout build201` fails with ValueError "unrecognised capability registry shape" (new top-level public_tools and sandbox keys).
  - `tools/check_agentic_claims.py` still returns PASS.
- Registry sync on #13 against #200 was covered earlier in this round.

## Telling screenshots
- shots/t4_sandbox_proposed_1280.png (Propose shows no state change)
- shots/sb_d15d_6_refund_390.png (refund text: 25 vs 20, REFUTED/RELEASED)
- shots/t6_resolve_page_390.png (#13 RESOLVE lands on "How paying and getting paid works")
- shots/d15_AGENTIC_COMMERCE_390.png ("Planned" items that #201 implements; table clipped)
- shots/t8_connect_check_390.png (Copied + Check connection says Failed to fetch)
- shots/t2_find_390.png (local preview: no listings)

## Limitations
- The private server repo was read through cursor-github MCP and rebuilt from compare patches, with blob SHAs verified.
- Three non-code base files were missing from the rebuild.
- No account, no real chain or card.
- Served with wsgiref plus an https shim.
- The sandbox token came from fixtures in the source, which a real naive agent would not have.
- Token counts are estimated at chars/4.
