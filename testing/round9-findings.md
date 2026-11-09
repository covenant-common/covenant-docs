# Round 9 findings

Source: independent DOET report, 9 Nov 2026, plus the covenant #201 registry and authority table at `beb7457c`. This file records what the docs change did with each docs-relevant finding. Owner TODOs stay `TODO(owner)`.

Shared docs commit: `afc96d4d2347f8ee56a48ce27d4a351be4b3dc2c` on `cursor/docs-site-link-fixes-1065`.
Stacked standards commit: the tip of `cursor/agentic-commerce-docs-1065` (restacked on that commit).

## Fixed in the docs

| Finding | Status | Where |
| --- | --- | --- |
| R9-17. #13 conflicts with main | Fixed | Replayed onto `origin/main` as `afc96d4`. #15 is stacked on it. |
| R9-7. `check_doet.mjs` hard-codes `/workspace` | Fixed | Paths come from `import.meta.url`. CI runs `node --test tests/*.test.cjs` plus the module tests. `check_doet` passed 40/40. |
| R9-7. Eight vm tests throw `URLSearchParams is not defined` | Fixed | `tests/buyer-handoff.test.cjs` and `tests/public-listing-display.test.cjs` provide `URLSearchParams` and `location`. |
| R9-7. Owner listing page breaks the no-form rule | Fixed | `docs/OWNER_LISTING_APPROVAL.html` no longer gets the search form. Its CSP still sets `form-action 'none'`. |
| R9-6. Sandbox step nav clips at 390px and marks Resolve current | Fixed | `.journey ol` wraps in `assets/components.css`. The sandbox is not hard-coded as the Resolve step. `sandbox/page.js` sets `aria-current` from the deal state. `tests/standards-cards.mjs` checks the link stays inside the viewport. |
| Registry drift against a stand-in | Fixed | `distribution/capability-registry.server.json` is the attached server file. Drift and the claims check compare the projection with `normalize()` of that file. `python3 tools/check_registry_drift.py` passes. |
| PAYING.html missing card and aap-native | Fixed | Payment rows are generated from the server methods, including `data-method="card"` and `data-method="aap-native"`. |
| API_MCP says 9 tools | Fixed | `docs/API_MCP.html` and `llms.txt` take the tool sentence from the registry. It currently lists 10, including `covenant_payment__quote`. |
| llms.txt says reclaim does not work | Fixed | Reclaim is in `sandbox.works_in_test`. The standards row is Test mode. |
| R9-8. Fee shown as 0.5% while the server fee is null | Fixed | `platform_fee_bps` is null. Pages and the sandbox say the platform fee is not set yet. `tests/test_round_fixes.py` and `tests/deal-machine.test.mjs`. |
| R9-14. `TODO(owner)` reaches screen readers and llms.txt | Fixed | The marker stays in HTML comments. The visible text is “Not set yet. The owner will confirm this.” `llms.txt` has no `TODO(owner)` and no HTML comment. |
| Disputes day counts | Fixed as a docs statement | No number is invented. The page says the counts are not set, and that the authority table allows a dispute after release with no time limit. `TODO(owner)` remains for the three windows. |
| Approval pages overstate enforcement | Fixed on the stacked branch | `docs/APPROVALS.html` says one `GET /sandbox/test-tokens` response includes every role token. The page is planned, not a description of sandbox enforcement. |
| N18. Sandbox banner contradicts the working hold | Fixed | The banner says this page holds test USDC on the test rail, and that hosted USDC is a direct final transfer. |
| No-results page has no suggestion | Fixed | `assets/matrix.js` uses the same broader-word suggestion as the terminal. |
| Connection check is only partial | Fixed | `assets/start.js` separates a failed initialize from a failed `tools/list`, and each message has a next step. `tests/start.test.cjs`. |
| Claims checker passes on a stale projection | Fixed on the stacked branch | `tools/check_agentic_claims.py` fails if the projection’s tools, fee, or sandbox differ from the server file. |
| Main-only facts dropped by the rebase | Fixed | MMR Industries stays the operator. The trial client skips POSIX permission bits on Windows. Owner setup documents `listing.withdraw`. |

## Unresolved

| Finding | Why it is still open |
| --- | --- |
| R9-1 to R9-5, R9-9 to R9-13, R9-15, R9-16 | These are in the private covenant server (token mint, conservation, resolve outcomes, the clock, quick_trade scaling). This docs repo cannot change that code. |
| Fee amount and the three day counts | `TODO(owner)`. The registry fee is null and the authority table has no day count. |
| Frozen public-task inventory | `mcp/tool-inventory.json` stays the hashed 9-tool public-host snapshot. The attached registry does not include a live input schema for `covenant_payment__quote`, so that name was not copied into the frozen inventory. The docs list it from the registry. A new execution profile needs a reviewed live `tools/list`. |
| Public host still listing 9 tools | The 9 Nov report says the live host serves 9 tools. These pages describe the `beb7457c` registry, which lists 10. |
