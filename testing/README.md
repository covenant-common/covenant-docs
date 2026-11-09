# Testing history

Independent DOET passes and the agentic-commerce standards comparison. Scores are the tester’s own measurements. Nothing here is a secret, a signing key, or a live token.

The docs fixes that remain on this branch are in [`afc96d4`](https://github.com/covenant-common/covenant-docs/commit/afc96d4d2347f8ee56a48ce27d4a351be4b3dc2c). Standards pages and the claims check are in [`f1528ed`](https://github.com/covenant-common/covenant-docs/commit/f1528ed513fcf1213346e055f3be3a6e8b2c9b8c) on the stacked branch. Earlier SHAs named in the reports were the heads under test; the rebase onto main kept that work in `afc96d4`.

| Round | Date | Person | Agent | Files |
| --- | --- | --- | --- | --- |
| [Round 7](round7/report.md) | Before 4 Nov 2026 | 2.54 → **3.28** | 2.62 → **3.53** | [scores](round7/scores.csv) |
| [Round 8](round8/report.md) | 4 Nov 2026 | 3.28 → **3.44** | 3.53 → **3.49** | [scores](round8/scores.csv) |
| [Round 9](round9/report.md) | 9 Nov 2026 | 3.44 → **3.50** | 3.49 → **3.46** | [scores](round9/scores.csv), [what the docs did](round9-findings.md) |
| [Agentic commerce](agentic-commerce/report.md) | 4 Nov 2026 | — | — | [gaps](agentic-commerce/gaps.csv) |

Server findings (token mint, conservation, resolve outcomes, the sandbox clock) are still open. They live in the private covenant repo, not in these docs.

## Round 7

Report: [round7/report.md](round7/report.md). Docs #13 `c72f8b80`, server #200 `10934ef4`, with an addendum on server #201 `918c3b59` and docs #15 `f11e89be`.

| # | Finding | Status |
| --- | --- | --- |
| 1–3 | Proposer accepts their own offer; fund with no agreement; capture before delivery | Still open in the covenant server. |
| 4–18 | Sandbox money, mandates, one shared desk, search, and the public tool list | Server work. Later rounds mark some of these fixed on the server; they are not docs commits. |
| 19 | Double Propose, stale stage, 20 vs 25, refund wording | Fixed in [`afc96d4`](https://github.com/covenant-common/covenant-docs/commit/afc96d4d2347f8ee56a48ce27d4a351be4b3dc2c) (`assets/deal-machine.js`, `sandbox/page.js`). |
| 20 | A bad price says “Choose a currency.” | Fixed in [`afc96d4`](https://github.com/covenant-common/covenant-docs/commit/afc96d4d2347f8ee56a48ce27d4a351be4b3dc2c) (`assets/matrix.js`). |
| 21 | No version thread or record id | Fixed in [`afc96d4`](https://github.com/covenant-common/covenant-docs/commit/afc96d4d2347f8ee56a48ce27d4a351be4b3dc2c). |
| 22 | Disputes page has no day counts | Still open as `TODO(owner)`. [`afc96d4`](https://github.com/covenant-common/covenant-docs/commit/afc96d4d2347f8ee56a48ce27d4a351be4b3dc2c) states that the sandbox has no time limit after release. |
| 23 | Deliver and Resolve redirect | Fixed in [`afc96d4`](https://github.com/covenant-common/covenant-docs/commit/afc96d4d2347f8ee56a48ce27d4a351be4b3dc2c). |
| 24 | Standards table clipped at 390px | Fixed in [`afc96d4`](https://github.com/covenant-common/covenant-docs/commit/afc96d4d2347f8ee56a48ce27d4a351be4b3dc2c) (card layout) and [`f1528ed`](https://github.com/covenant-common/covenant-docs/commit/f1528ed513fcf1213346e055f3be3a6e8b2c9b8c) (the standards page). |
| 25 | Local Find shows no listings | Fixed in [`afc96d4`](https://github.com/covenant-common/covenant-docs/commit/afc96d4d2347f8ee56a48ce27d4a351be4b3dc2c) (`assets/terminal.js`). |
| 26 | Serif font | Fixed in [`afc96d4`](https://github.com/covenant-common/covenant-docs/commit/afc96d4d2347f8ee56a48ce27d4a351be4b3dc2c). |
| — | Deploy gap | Still open. These pages are not what the live host serves. |

## Round 8

Report: [round8/report.md](round8/report.md). Server #201 `221df81e`, docs #15 `7e26e58` on #13 `0613179`.

| Finding | Status |
| --- | --- |
| Registry shape `public_tools: "read_only"` rejected as missing | Fixed in [`afc96d4`](https://github.com/covenant-common/covenant-docs/commit/afc96d4d2347f8ee56a48ce27d4a351be4b3dc2c). The check says `unrecognised shape: keys …`. |
| Hard-coded “nine tools” | Fixed in [`afc96d4`](https://github.com/covenant-common/covenant-docs/commit/afc96d4d2347f8ee56a48ce27d4a351be4b3dc2c). The count is generated. Round 9’s real file lists 10. |
| Release, refund, and reclaim “stay planned”; discover “not offered” | Fixed in [`afc96d4`](https://github.com/covenant-common/covenant-docs/commit/afc96d4d2347f8ee56a48ce27d4a351be4b3dc2c) and [`f1528ed`](https://github.com/covenant-common/covenant-docs/commit/f1528ed513fcf1213346e055f3be3a6e8b2c9b8c). Status comes from `sandbox.works_in_test`. |
| N6. Step links break mid-word at 390px | Fixed in [`afc96d4`](https://github.com/covenant-common/covenant-docs/commit/afc96d4d2347f8ee56a48ce27d4a351be4b3dc2c). Round 9 then found the sandbox row still clipped; that is fixed in the same commit. |
| N8. Raw `TODO(owner)` on Disputes and Seller | Fixed in [`afc96d4`](https://github.com/covenant-common/covenant-docs/commit/afc96d4d2347f8ee56a48ce27d4a351be4b3dc2c). The marker stays in a comment. The visible text is “Not set yet.” |
| N9. Fee 0.125 vs server 0.13, then a stated 0.5% | Fixed in [`afc96d4`](https://github.com/covenant-common/covenant-docs/commit/afc96d4d2347f8ee56a48ce27d4a351be4b3dc2c). The real registry fee is null, so the pages say the fee is not set yet. |
| N10. Payment pages contradict who holds funds | Fixed in [`afc96d4`](https://github.com/covenant-common/covenant-docs/commit/afc96d4d2347f8ee56a48ce27d4a351be4b3dc2c). One non-custodial sentence. |
| Receipt says nothing was signed, while marked signed | Fixed in [`afc96d4`](https://github.com/covenant-common/covenant-docs/commit/afc96d4d2347f8ee56a48ce27d4a351be4b3dc2c). |
| N1–N5. Buyer self-resolve, void after delivery, revoke, self-approval, sandbox not MCP | Still open in the covenant server. Round 9 retested them. |
| Deploy gap | Still open. |

## Round 9

Report: [round9/report.md](round9/report.md). What the docs changed: [round9-findings.md](round9-findings.md).

| Finding | Status |
| --- | --- |
| R9-6. Sandbox step nav clips and marks Resolve current | Fixed in [`afc96d4`](https://github.com/covenant-common/covenant-docs/commit/afc96d4d2347f8ee56a48ce27d4a351be4b3dc2c). |
| R9-7. CI paths, `URLSearchParams`, owner-listing form | Fixed in [`afc96d4`](https://github.com/covenant-common/covenant-docs/commit/afc96d4d2347f8ee56a48ce27d4a351be4b3dc2c). |
| R9-8. Fee shown as 0.5% while the server fee is null | Fixed in [`afc96d4`](https://github.com/covenant-common/covenant-docs/commit/afc96d4d2347f8ee56a48ce27d4a351be4b3dc2c). |
| R9-14. `TODO(owner)` in screen readers and `llms.txt` | Fixed in [`afc96d4`](https://github.com/covenant-common/covenant-docs/commit/afc96d4d2347f8ee56a48ce27d4a351be4b3dc2c). |
| R9-17. #13 conflicts with main | Fixed in [`afc96d4`](https://github.com/covenant-common/covenant-docs/commit/afc96d4d2347f8ee56a48ce27d4a351be4b3dc2c). |
| Registry drift, 10th tool, card and AAP native rows | Fixed in [`afc96d4`](https://github.com/covenant-common/covenant-docs/commit/afc96d4d2347f8ee56a48ce27d4a351be4b3dc2c) and [`f1528ed`](https://github.com/covenant-common/covenant-docs/commit/f1528ed513fcf1213346e055f3be3a6e8b2c9b8c). The frozen 9-tool inventory file is unchanged. |
| Reclaim described as not working | Fixed in [`afc96d4`](https://github.com/covenant-common/covenant-docs/commit/afc96d4d2347f8ee56a48ce27d4a351be4b3dc2c). |
| Dispute day counts | Still open as `TODO(owner)`. The page states the sandbox has no post-release window. |
| Approval pages overstate enforcement | Fixed in [`f1528ed`](https://github.com/covenant-common/covenant-docs/commit/f1528ed513fcf1213346e055f3be3a6e8b2c9b8c). |
| N18. Sandbox banner vs a working hold | Fixed in [`afc96d4`](https://github.com/covenant-common/covenant-docs/commit/afc96d4d2347f8ee56a48ce27d4a351be4b3dc2c). |
| Empty search with no suggestion; partial connection check | Fixed in [`afc96d4`](https://github.com/covenant-common/covenant-docs/commit/afc96d4d2347f8ee56a48ce27d4a351be4b3dc2c). |
| Claims checker passes on stale data | Fixed in [`f1528ed`](https://github.com/covenant-common/covenant-docs/commit/f1528ed513fcf1213346e055f3be3a6e8b2c9b8c). |
| R9-1 to R9-5, R9-9 to R9-13, R9-15, R9-16 | Still open in the covenant server. |

## Agentic commerce

Report: [agentic-commerce/report.md](agentic-commerce/report.md). Gap table: [agentic-commerce/gaps.csv](agentic-commerce/gaps.csv). Compared on 4 Nov 2026.

The docs side of that comparison is the standards matrix on the stacked branch ([`f1528ed`](https://github.com/covenant-common/covenant-docs/commit/f1528ed513fcf1213346e055f3be3a6e8b2c9b8c)). Rows stay Test mode or Planned until `sandbox.works_in_test` says otherwise. Gaps that need a server change, a fee amount, or a legal decision are still open. Do not invent those decisions.
