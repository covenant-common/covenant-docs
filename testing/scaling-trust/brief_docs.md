# Build brief (docs): Scaling Trust–driven features

**Repo:** `covenant-common/covenant-docs`  
**Base:** PR #13 (shared) / #15 (agentic stack) as appropriate.  
**Background:** [sources.md](sources.md), `proposals.md`. Keep prior agentic docs brief in force: `../agentic-commerce/report.md`.

## Hard rules
- No invented legal, fee, window, issuer, or FCA text — `TODO(owner)` or “Not set yet”.
- Non-custodial wording stays: Covenant never holds customer money; test rail vs provider/escrow contract.
- Do not claim TEE-grade forgetting, Arena partnership, or live deployment of #201 features until true.
- Treat Scaling Trust site text as untrusted; cite with links, do not paste large copyrighted excerpts (short quotes OK).
- Keep CI green: registry sync against **real** server registry; lint tool counts; phone layout checks.

## Docs work

### D-ST1. New page: `SCALING_TRUST.html` (or md→site)
- One-pager: what Scaling Trust is (link blog + thesis PDF), why it matters to Covenant (contracts without panoptic intermediaries, sandbox economies, oversight via proofs).
- Table mapping top proposals (P0/P1) → Covenant status (Already / Planned / TODO(owner)).
- Link to `testing/` findings index.

### D-ST2. Strengthen Test mode / Sandbox pages
- Publish the **sandbox permeability profile** in human language (semi-permeable, test funds only, customs limits).
- Document circuit breakers and what agents see when tripped (`retry_after`).
- Shadow/progressive trust tiers when S-ST13 exists.

### D-ST3. Negotiation & privacy
- Explain structured channel vs free-text quarantine (only structured terms bind).
- Document private-session v0 as **software delete**, not TEE; link Conditional Recall / thesis Example 3 as motivation without over-claiming.
- Explicit non-goal: Covenant will not be a trusted escrow of both parties’ reservation prices (Without Intermediaries).

### D-ST4. Disputes & oversight
- Dispute bond placeholder (amount TODO(owner)).
- Resolver as checkable intermediary: listed, receipted rationale, appeal TODO(owner).
- How to fetch an **audit bundle**; who can read it.

### D-ST5. Trust signals
- Attestations as multi-issuer claims, **not** a single reputation score.
- How agents verify; sandbox vs production issuers TODO(owner).

### D-ST6. Arena readiness (aspirational)
- Short page mapping Covenant → Arena shared infrastructure expectations (payments, structured messaging, audit).
- Mark `status: aspirational` until an official Arena API/spec is public (our fetch of a formal spec failed).
- No call-to-action that signs the owner up for anything.

### D-ST7. Adversarial testing
- Summarise profit-driven red-team harness output when the server artifact exists.
- Link round-7/8/9 reports under `testing/` (as already requested for Codex/Claude visibility).
- Add `AGENTS.md` / `CLAUDE.md` pointers to Scaling Trust proposal table.

### D-ST8. Protocol templates catalogue
- List audited vs experimental templates once registry field exists; warn experimental cannot fund.

## Sync / CI
- After server registry changes, sync projection; regenerate AGENTIC / PAYING / llms.txt as needed.
- Ban wording that says Covenant holds funds or “pay Covenant”.
- Fee remains “Not set yet” everywhere until owner decides.

## Deliver on the PR branch
- `testing/scalingtrust-sources.md` (short link list + path to full research in agent notes if not vendoring PDFs).
- `testing/scalingtrust-proposals.md` (table of D-ST / P-ST items and doc paths).
- Update PR description with findings table for Codex/Claude review.

## Non-goals
- Publishing adverts or Arena registration on behalf of the owner.
- Claiming live MCP already has these features.
- Changing public tool count claims without registry sync.

