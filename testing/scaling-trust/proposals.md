# Covenant proposals from Scaling Trust research

Date: Mon 9 Nov 2026 (Europe/London). Citations refer to IDs in [sources.md](sources.md). Do not invent legal text, fee amounts, windows, issuer URLs or FCA conclusions — mark those TODO(owner).

**Standing constraints:** public MCP stays read-only and backward compatible; platform is non-custodial (`custody:"none"`, `merchant_of_record:"seller"`, `holds_funds:false`); test/dummy funds only; no deploy from this research.

**Already covered elsewhere (do not re-propose as new):** AP2 open/closed mandates, Trusted Surface/passkey approval, x402 auth-capture escrow, signed receipts, MCP 2026-07-28 dual support, RFC 9728 scopes, discovery cards, uniform idempotency, milestones/dispute evidence windows — see `../agentic-commerce/gaps.csv` and PR #201. Round-9 money bugs (role minting, refused-but-moved funds, resolve(release) no-op, clock abuse, missing dispute window) are **P0 engineering fixes**, not Scaling Trust novelties.

Legend: **Already** = Covenant has a real or in-PR piece; **Partial** = library or docs only; **New** = not in prior gap list.

---

## Top proposals (P0–P2)

### P0-ST1. Structured deal channel + free-text quarantine
- **Problem:** Free-form agent chat enables secret collusion / steganography and makes attribution hard (B6, B7; thesis notes steganographic communication).
- **Design:** All money-relevant negotiation goes through typed `offer` / `counter` / `accept` objects (already planned in agentic gaps). Add `deal_message` with a **closed schema** (`kind`, `terms_hash`, `refs[]`, optional short `note` ≤ N chars). Free-text longer than N is stored as `side_channel` with `authoritative:false` and hashed; never interpreted by settlement. Emit `message_hash` into the receipt chain.
- **Where:** server (account/sandbox MCP); docs (agent guide: “only structured fields bind”).
- **Tools / registry:** sandbox tool `covenant_deal__message` (account/sandbox only); registry `structured_channel:true`; authority-table: only buyer/seller may message their deal.
- **Dummy-money test:** two colluding agents try to encode a secret price in `note` and in free-text; assert settlement uses only structured terms; receipt includes hashes.
- **Risk:** UX friction for humans; mitigate with good templates.
- **Priority:** P0 · **Status:** Partial (typed offers planned) → extend with quarantine.
- **Sources:** B6, B7, A9b.

### P0-ST2. Intentional sandbox permeability profile
- **Problem:** Without an explicit permeability model, test money and live discovery blur, and contagion risk is undefined (B2, B3; A2 shared infrastructure).
- **Design:** Publish a `sandbox_profile` in the capability registry: `permeability:"semi"`, `funds:"test_only"`, `egress:["docs","public_read_mcp"]`, `ingress:["test_tokens"]`, `customs` rules (tenant mint rate, max concurrent deals, max escrow). Public MCP remains read-only. Account MCP mutations require `test_mode:true` until TODO(owner) for any real rail.
- **Where:** server registry + sandbox WSGI; docs “Test mode” page.
- **Tools / registry:** fields above; `covenant_review__sandbox_profile` (read-only public OK).
- **Dummy-money test:** assert no tool can set `funds_are_real:true`; customs reject over-quota mint.
- **Risk:** over-restricting legitimate demos — keep knobs configurable.
- **Priority:** P0 · **Status:** Partial (test mode exists) → make profile explicit and enforced.
- **Sources:** B2, B3, A2.

### P0-ST3. Circuit breakers and anomaly cut-outs on money tools
- **Problem:** Cascade / flash dynamics and runaway agent loops (B2, B3 HFT analogy; A8 anomaly cut-outs). Round-9 already showed refused calls moving money — breakers need correct conservation first.
- **Design:** Per-tenant and global: max holds/min, max volume/window, max failed→retry storm, kill-switch that voids in-flight authorisations to reclaimable state. Log `circuit_open` receipts. Never silently move funds on REFUSED (fix money bugs first).
- **Where:** server middleware on sandbox/account mutations.
- **Tools / registry:** `limits` block; admin/test tool `covenant_sandbox__circuit` (resolver/ops scope only).
- **Dummy-money test:** flood 100 captures; breaker trips; conservation holds; stranger cannot reset.
- **Risk:** false positives freezing honest agents — include clear `retry_after` and docs.
- **Priority:** P0 · **Status:** New (limits partial at most).
- **Sources:** B2, B3, A8.

### P0-ST4. Skin-in-the-game dispute bond (test units)
- **Problem:** Costless disputes and reclaim spam; Physical Evals and DAGI recommend bonds/stakes (A8, B2).
- **Design:** Opening a dispute locks a small **test** bond from the complainant (configurable BPS or flat minor units, default null → TODO(owner)). Loser forfeits bond to winner or burn address in test rail; winner’s bond returned. Show bond in quote envelope.
- **Where:** server dispute edge; docs Disputes page (amount TODO(owner)).
- **Tools / registry:** `dispute.bond_minor` nullable; authority: bond required before `dispute.open` when configured.
- **Dummy-money test:** dispute without bond refused; loser bond moves; conservation.
- **Risk:** chilling legitimate disputes if bond too high — owner sets amount; start at 0 in CI with a non-zero fixture test.
- **Priority:** P0 once windows exist · **Status:** New · **TODO(owner):** bond amount and recipient.
- **Sources:** A8, B2.

### P1-ST5. Counterparty attestation portfolio (lightweight VCs)
- **Problem:** Agents need machine-checkable claims about counterparties without a panoptic platform (B3 VCs/DIDs; A1 CCTI; A6 agent infrastructure; B5 certification).
- **Design:** Optional `attestations[]` on agent/seller profiles: `{issuer, type, subject, claims_hash, expires_at, sig}`. Types for test: `sandbox.completed_deals`, `sandbox.no_critical_breach`, `passkey_bound`. Public tools can **inspect** attestations; only sandbox issuers mint test attestations. No global reputation score that becomes a single intermediary’s weapon (A3 plurality).
- **Where:** server account profile + `covenant_review__evidence`; docs “Trust signals”.
- **Tools / registry:** `covenant_review__attestations`; registry `attestation_types[]`.
- **Dummy-money test:** mint test attestation; verify; expired rejected; foreign issuer ignored unless in allowlist TODO(owner).
- **Risk:** reputation monoculture — keep multi-issuer and display raw claims, not one score.
- **Priority:** P1 · **Status:** New (KYA library exists — Partial overlap).
- **Sources:** B3, B5, A1, A3, A6.

### P1-ST6. Private negotiation session (conditional-recall hook)
- **Problem:** Revealing reservation prices or inspectable digital goods creates Arrow-style leakage and panoptic escrows (A3, A9b Example 3, B10, B11).
- **Design:** Sandbox-only `private_session`: both parties deposit sealed bids or an inspectable payload into a session object; server returns only the predicate result (`match:true/false`, or `inspection_receipt` without retaining payload). After close, payload bytes are deleted and a **deletion receipt** is signed (`forgotten:true`, `session_hash`). Phase 1: software delete + hash commitment (honest-but-curious). Phase 2 TODO(owner): TEE attestation. Never implement a “trusted Covenant that sees both sides’ limits.”
- **Where:** server sandbox; docs explain non-goals (no panoptic matchmaker).
- **Tools / registry:** `covenant_negotiate__private_open/close`; capability `private_session:"software_delete_v0"`.
- **Dummy-money test:** after close, API cannot return payload; deletion receipt verifies; match predicate correct.
- **Risk:** users over-trust software delete — docs must say Phase 1 is not TEE-grade.
- **Priority:** P1 · **Status:** New · **TODO(owner):** whether to fund TEE phase.
- **Sources:** A3, A9b, B10, B11.

### P1-ST7. Incident reporting + rollback API
- **Problem:** Agent infrastructure needs response paths when something goes wrong (B5 incident reporting / rollbacks; A2 recovery-time metric).
- **Design:** `covenant_ops__incident_report` (any role on a deal) creates an immutable incident with `deal_id`, `receipt_hashes[]`, `severity`, `note`. Link to existing void/reclaim/dispute. `rollback_suggest` returns the allowed compensating action from the authority table (never a free-form undo). Public MCP may **read** incident schema; create is account/sandbox only.
- **Where:** server; docs runbook for agents.
- **Tools / registry:** tools above; `incidents[]` on deal record.
- **Dummy-money test:** report after bad capture; suggest void/reclaim; execute; conservation.
- **Risk:** incident spam — rate-limit and require deal membership.
- **Priority:** P1 · **Status:** New.
- **Sources:** B5, A2.

### P1-ST8. Profit-driven sandbox red-team harness
- **Problem:** Static tests miss adaptive economic attacks (B9; A1 HAMMER; A2 red teams).
- **Design:** CI/job that spins buyer+seller fixtures and a third “predator” agent maximising its test balance via legal tool calls only (anchoring, last-second revoke, dispute griefing, clock games). Emit `testing/redteam_profit_report.json` with profit delta and distilled defensive rules for docs. No public tool that attacks others’ tenants.
- **Where:** server test suite + docs “Adversarial testing” page.
- **Tools / registry:** none new on public MCP; test extras under `/mcp/sandbox/v1` flagged `redteam:true`.
- **Dummy-money test:** predator cannot cross tenants; report non-empty; conservation.
- **Risk:** flaky CI — seed and cap steps.
- **Priority:** P1 · **Status:** New.
- **Sources:** B9, A1, A2, A4.

### P1-ST9. Oversight / attribution export (due-process shaped)
- **Problem:** Oversight should get proofs and opened trails under process, not a live panoptic feed (A3; B2/B3 hybrid oversight; B6 attribution).
- **Design:** Per-deal `audit_bundle` download: ordered receipts, mandate hashes, role proofs, message hashes, incidents. Optional `oversight_scope` token that can **read** bundles for deals it is assigned to (resolver or TODO(owner) auditor role) but cannot move funds. No global firehose on public MCP.
- **Where:** server; docs “Audit bundle”.
- **Tools / registry:** `covenant_review__audit_bundle`; scope `deal:audit`.
- **Dummy-money test:** buyer fetches own bundle; stranger 401; auditor read-only.
- **Risk:** PII in notes — strip or hash free-text by default.
- **Priority:** P1 · **Status:** Partial (receipts exist in #201) → package as bundle.
- **Sources:** A3, B2, B3, B6.

### P1-ST10. Protocol template registry (human-audited, agent-selectable)
- **Problem:** Generative cryptography envisions on-demand protocols; money paths must not silently invent crypto (A5, A1 Dovetail/Reasoner; A9b requirement→protocol).
- **Design:** Registry list `protocol_templates[]`: `{id, purpose, status:"audited"|"experimental", refs[]}`. Agents select a template id on deal create (`escrow.x402_auth_capture`, `negotiate.private_software_v0`, …). Experimental templates blocked for funded deals. Future: hook for external generators that **propose** but require human audit before `audited`.
- **Where:** server registry; docs catalogue.
- **Tools / registry:** field on deal; public read via existing review tools.
- **Dummy-money test:** unknown template rejected; experimental cannot fund.
- **Risk:** premature auto-generation — explicitly out of scope for settlement.
- **Priority:** P1 · **Status:** New.
- **Sources:** A5, A1, A9b.

### P2-ST11. Multi-deal collusion / correlation monitor (sandbox analytics)
- **Problem:** Tacit collusion across listings and episodic markets (B1, B8); A6 oversight bucket.
- **Design:** Offline/sandbox job: flag same-principal agents on both sides, mirrored offers across deals, stable supra-competitive spreads. Surface as **warnings** in review tools, not auto-punishment (false positives).
- **Where:** server analytics (sandbox); docs interpret flags.
- **Tools / registry:** `covenant_review__market_flags` (read-only).
- **Dummy-money test:** construct mirrored cartels; flag fires; unrelated deals clean.
- **Risk:** accusing honest shared infrastructure — document heuristics.
- **Priority:** P2 · **Status:** New.
- **Sources:** B1, B8, A6.

### P2-ST12. Resolver power that stays checkable
- **Problem:** Where intermediaries remain (dispute resolvers), power must be contestable (A3). Round-9: anyone could mint resolver.
- **Design:** Resolver appointment is deal-scoped, publicly listed, rotatable only under rules; every resolve emits signed rationale hash + outcome; appeal window TODO(owner). Fix minting so one token ≠ all roles (round-9 P0).
- **Where:** server authority table; docs Disputes.
- **Tools / registry:** `resolver_did`, `resolve_receipt`; authority rows for rotate/appeal.
- **Dummy-money test:** stranger cannot resolve; rationale required; release/refund/split each move money correctly.
- **Risk:** slow disputes — owner sets SLAs.
- **Priority:** P2 (after P0 money fixes) · **Status:** Partial · **TODO(owner):** appeal policy.
- **Sources:** A3, B1 commitment/trust, round-9 report.

### P2-ST13. Progressive trust / shadow mode for new tenants
- **Problem:** New operators should not get full actuation immediately (A8 supervised/shadow modes; B2).
- **Design:** New sandbox tenants start in `shadow`: tools return would-be effects without moving funds until N clean deals or manual promote. Envelope shows `trust_tier`.
- **Where:** server sandbox; docs onboarding.
- **Tools / registry:** `trust_tier:"shadow"|"full"`.
- **Dummy-money test:** shadow capture does not change balances; promote then does.
- **Risk:** confusing UX — strong signifiers in envelope.
- **Priority:** P2 · **Status:** New.
- **Sources:** A8, B2.

### P2-ST14. Arena / AEZ readiness adapter (docs + discovery only first)
- **Problem:** Arena shared services will expect payments, messaging, contracts, auditable logs (A2, A7).
- **Design:** Docs page “Arena readiness” mapping Covenant tools to Arena shared-infrastructure expectations; publish a read-only `arena_compatibility` object on the server card (`payments:"test_escrow"`, `messaging:"structured"`, `audit:"receipt_bundle"`). No physical integration in this phase.
- **Where:** docs primarily; tiny registry field.
- **Tools / registry:** card extension only.
- **Dummy-money test:** card schema validates.
- **Risk:** over-claiming — mark `status:"aspirational"` until live Arena API exists (spec fetch failed; see sources.md D).
- **Priority:** P2 · **Status:** New · **TODO(owner):** whether to pursue Arena participation.
- **Sources:** A2, A7, A4.

### P2-ST15. Equal test endowments option
- **Problem:** Unequal agent capability + unequal budgets worsen negotiation inequality (B3; B11 voucher intuition).
- **Design:** Sandbox mint can issue equal per-role balances (`fair_start:true`) documented as a fairness mode for evals, not production economics.
- **Where:** sandbox token mint; docs.
- **Tools / registry:** mint flag.
- **Dummy-money test:** fair_start gives identical balances.
- **Risk:** none material in test.
- **Priority:** P2 · **Status:** New.
- **Sources:** B3, B11.

---

## Already have (map to Scaling Trust concepts)

| Scaling Trust concept | Covenant today |
|---|---|
| Contracts / deals with roles | deal_state, buyer/seller/approver/resolver |
| Credible spend commitments | AP2 mandates + scoped_mandates (PR #201 path) |
| Escrow without Covenant custody | non-custodial stance; test rail / x402 auth-capture |
| Signed audit trail | receipts urn:aap:receipt:0.2 (in #201) |
| Authority / access control | authority_table.json + deal_state.guard |
| Sandbox economy | `/mcp/sandbox/v1`, test tokens |
| Plurality / no single money holder | custody none; seller MoR (owner decision saved) |
| Discovery for agents | server card / ai-catalog / A2A (in #201; live lag) |

---

## TODO(owner) / legal (do not invent)

1. Dispute, capture, reclaim **window lengths** and bond amounts (P0-ST4, round-9).
2. Whether TEE-backed private sessions are in roadmap (P1-ST6).
3. Trusted attestation **issuers** allowlist (P1-ST5).
4. Auditor / oversight role issuance policy (P1-ST9).
5. Appeal path for resolver decisions (P2-ST12).
6. Arena participation and any real-world prize/competition terms (P2-ST14).
7. FCA perimeter, legal entity, governing law, complaints, AI disclosure, cancellation — unchanged TODOs from agentic report.
8. Fee amount / collection leg — unchanged TODO.

---

## Suggested implementation order

1. Finish round-9 money/authority P0s (blocking).
2. P0-ST2 profile + P0-ST3 breakers + P0-ST1 structured channel.
3. P0-ST4 bonds once dispute windows exist.
4. P1-ST7 incidents, P1-ST9 audit bundle, P1-ST8 red-team harness.
5. P1-ST5 attestations, P1-ST6 private session v0, P1-ST10 templates.
6. P2 items as capacity allows.

