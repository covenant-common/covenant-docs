# Review notes

Testing history, scores, and which commit fixed each finding: [testing/README.md](testing/README.md).

Priorities for a docs change:

1. Registry sync uses `distribution/capability-registry.server.json`, the real server file. Regenerate the projection and the pages from it. Do not treat an older projection as verified.
2. Keep the non-custodial wording: Covenant never holds your money. In test mode, the test rail holds it; for real payments, the payment provider or an escrow contract will. The seller is the merchant of record.
3. Owner TODOs stay `TODO(owner)` in source comments. Published text and `llms.txt` say the value is not set yet.
4. Check the deal-step links at 390px. A step link must stay on one line and inside the viewport, and the sandbox must not mark Resolve current before a dispute.
