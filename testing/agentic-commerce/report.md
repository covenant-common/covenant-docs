# Covenant vs. agentic commerce best practice: gap report

- **Date:** Wed 4 Nov 2026 (Europe/London)
- **Scope:** Covenant / AAP, an agent-to-agent marketplace with contracts and escrow.
- **What I compared:**
  - server branch `cursor/public-mcp-usability-fixes-ce0e` (PR #200, covenant-common/covenant), read-only through the GitHub connector
  - docs repo `covenant-docs` (`main` plus PR branch `cursor/docs-site-link-fixes-1065`)
  - the live public MCP at `https://jupie202020.pythonanywhere.com`
- **What I compared it against:** current public specs from protocol owners and regulators. All sources are dated in §2.
- **Limits I kept to:**
  - no sign-ups, trials, payments, emails, posts, issues or PR comments
  - only read-only probes of the live host
  - all web, tool and repo text treated as untrusted data
- **Gap list:** `gaps.csv`
- **Build briefs:** `brief_server.md` and `brief_docs.md`

## 1. Headline

Covenant's **library** already covers most of the agentic commerce standards. Its **product surface** exposes almost none of them.

The repo has code against these current specs:
- AP2 v0.2 PaymentMandate (`covenant_agent/ap2_release.py`)
- ACP 2026-04-17 (`covenant_agent/commerce_acp.py`)
- UCP 2026-08-25 (`covenant_agent/commerce_ucp.py`)
- x402 v2 `exact` plus a custom recourse scheme (`covenant_agent/x402_exact_v2.py`, `covenant_x402/`)
- Web Bot Auth / Visa TAP / Mastercard Agent Pay (`covenant_chain/web_bot_auth.py`)
- Skyfire KYAPay (`covenant_chain/kya_tokens.py`)
- WebAuthn L3 (`covenant_chain/webauthn.py`)
- signed, attenuable spend mandates with rolling windows (`covenant_chain/scoped_mandates.py`, `covenant_chain/spend_windows.py`)
- ERC-7710 delegations
- A2A discovery

Most of these modules record evidence or verify only. The docs say they need a "reviewed build" or "owner-installed verifier". At runtime the capability registry says:
- `can_pay=false`, `can_sign=false`, `can_refund=false`, `can_dispute=false`, `can_publish=false`
- `execution: RECORD_AND_VERIFY_ONLY`
- all 8 payment methods `selectable:false`

On the live host, an agent today finds:
- MCP **2025-11-25** only, with `server/discover` refused (`PUBLIC_WSGI_PROTOCOL`)
- no `outputSchema`
- no MCP server card, A2A card, UCP profile or RFC 9728 metadata (all 404)
- a bare `Bearer realm="aap-account"` 401

So the gap to best practice is mostly about **integration and productisation**, not invention:
1. one authority object
2. one human approval surface
3. one sandbox money rail with escrow semantics
4. signed receipts
5. standard discovery and auth

Spec correction: the brief said "intent/cart mandates". **AP2 v0.2 has replaced IntentMandate/CartMandate** with Checkout and Payment Mandates, each in open (constraints, user-signed, with a `cnf` agent key) and closed (exact, final) forms. The older names survive in the AP2 GitHub repo and in the `a2a-x402` extension. Covenant's `ap2_release.py` already uses `mandate.payment.1`, which is correct, but it handles only the closed PaymentMandate. It does not handle Checkout Mandates or open/autonomous mandates.

## 2. Standards landscape (verified 4 Nov 2026)

| Standard | Version / date | What matters for Covenant | Source |
|---|---|---|---|
| MCP | 2026-07-28 (latest); 2025-11-25 previous | Stateless; `server/discover` MUST; `resultType` required; Multi Round-Trip Requests (`input_required`) replace server-initiated elicitation; URL-mode elicitation kept; Tasks moved to extension; full JSON Schema 2020-12 `outputSchema`; `Mcp-Method`/`Mcp-Name` headers; error range -32020..-32099 reserved; DCR deprecated in favour of Client ID Metadata Documents; RFC 9207 `iss` | https://modelcontextprotocol.io/specification/2026-07-28/changelog |
| MCP authorization | 2026-07-28 | RFC 9728 protected-resource metadata; 401 MUST carry `WWW-Authenticate: Bearer resource_metadata=...`; 403 `insufficient_scope` step-up | https://modelcontextprotocol.io/specification/2026-07-28/basic/authorization |
| MCP tool annotations | 2026-07-28; blog 2026-03-16 | Hints only, untrusted; defaults readOnly=false, destructive=true, idempotent=false, openWorld=true; if `outputSchema` is set, `structuredContent` MUST conform | https://modelcontextprotocol.io/specification/2026-07-28/server/tools ; https://blog.modelcontextprotocol.io/posts/2026-03-16-tool-annotations/ |
| MCP Server Cards (SEP-2127) | Final, merged 6 Oct 2026; schema still in experimental ext repo | `GET <mcp-endpoint>/server-card` (`application/mcp-server-card+json`), domain catalog `/.well-known/ai-catalog.json` | https://modelcontextprotocol.io/seps/2127-mcp-server-cards |
| AP2 | v0.2 | Checkout + Payment Mandates (SD-JWT; open/closed); Human-Present vs Autonomous; Trusted Surface MUST be non-agentic; signed Checkout/Payment Receipts; mandates as dispute evidence; agent-to-agent delegation out of scope | https://ap2-protocol.org/ap2/specification/ |
| a2a-x402 | spec v0.2 | A2A extension for x402; embedded-in-AP2 flow | https://github.com/google-agentic-commerce/a2a-x402/blob/main/spec/v0.2/spec.md |
| ACP (OpenAI + Stripe) | spec snapshot 2026-04-17 (beta) | Checkout session lifecycle (11 statuses incl. `authentication_required`, `pending_approval`); Delegate Payment Allowance (one_time, max_amount, expires_at, merchant/session-scoped); mandatory Idempotency-Key with 409/422 semantics; HMAC webhooks; order `adjustments[]` | https://github.com/agentic-commerce-protocol/agentic-commerce-protocol ; https://developers.openai.com/commerce/specs/payment (2026-04-17 details partly via a secondary source, see gaps.csv) |
| Stripe Shared Payment Tokens | docs current; preview API `2026-09-30.preview`; granted-token changelog 2026-04-22 | Scoped, time- and amount-limited agent credentials; webhooks `shared_payment.granted_token.used/deactivated` | https://docs.stripe.com/agentic-commerce/concepts/shared-payment-tokens |
| UCP | 2026-08-25 (and 2026-01-23) | `dev.ucp.shopping.checkout/order`; REST/MCP/A2A bindings; business profile with `signing_keys`; idempotency key on complete/cancel; checkout finalised on trusted UI unless the AP2 mandates extension is used | https://ucp.dev |
| x402 | v2 (2025-12-09); `auth-capture` scheme last changed 27 Oct 2026 | `auth-capture` with `paymentFlow: escrow` (authorize → resource → capture/void; refund; client `reclaim` after `captureDeadline`; `refundDeadline`); transports http/mcp/a2a | https://github.com/x402-foundation/x402/tree/main/specs/schemes/auth-capture |
| A2A | v1.0 | `/.well-known/agent-card.json`, `supportedInterfaces[]`, signed cards (JWS + RFC 8785), `AUTH_REQUIRED`/`INPUT_REQUIRED` states, extensions | https://a2a-protocol.org/latest/whats-new-v1/ |
| Web Bot Auth | draft-ietf-webbotauth-httpsig-protocol-01, 29 Oct 2026 | RFC 9421 agent signatures plus `Signature-Agent`; basis for Visa TAP and Mastercard Agent Pay | https://datatracker.ietf.org/doc/draft-ietf-webbotauth-httpsig-protocol/ ; https://blog.cloudflare.com/secure-agentic-commerce/ |
| PayPal Agent Toolkit / MCP | current | Remote MCP with sandbox host `mcp.sandbox.paypal.com`; Agent Ready / Store Sync (Store Sync: US, USD, approval required) | https://developer.paypal.com/ai-tools/mcp-server |
| UK CMA: "Complying with consumer law when using AI agents" | March 2026, updated 30 Oct 2026 | Business is liable for its agents; disclose AI where it may affect decisions; all-in prices incl. unavoidable charges (DMCCA 2024); respect CRA 2015 / CCR 2013 cancellation rights; human oversight; fines up to 10% of turnover | https://www.gov.uk/government/publications/complying-with-consumer-law-when-using-ai-agents/complying-with-consumer-law-when-using-ai-agents |
| UK FCA payment-services perimeter | PERG 15 (current) | Platforms receiving buyer funds into an account they control, including escrow until delivery, are likely providing regulated payment services unless an exclusion applies; commercial-agent exclusion fails if acting for both sides | https://www.fca.org.uk/firms/consider-if-you-provide-payment-services ; https://www.fca.org.uk/firms/commercial-agent-exclusion-cae |

Not researched in depth: EU PSD3/PSR status, EU AI Act Art. 50 timing, and US state money-transmitter law. They are left as owner/counsel TODOs. I make no claims about them.

## 3. What Covenant has today (evidence)

| Area | Evidence | State |
|---|---|---|
| Runtime capabilities | `data/capability_registry.json` (urn:aap:capability-registry:0.1) | can_pay/sign/refund/dispute/publish all false; RECORD_AND_VERIFY_ONLY; `fee_window_start/end` null |
| Payment methods | registry plus live `/payment-methods.json` | 8 methods, all `selectable:false`, `payment_dispatch:false`. Base/Eth Sepolia are TEST_ONLY; card/stripe, mainnet USDC, Solana and BTC are NOT_CONNECTED; aap-native is NOT_LIVE |
| Deal lifecycle | `deal_state.py` | 12 states, draft → released/refunded/resolved. No partial release or refund, no milestones, no dispute from `agreed`, no evidence or deadline fields, no cancel-before-funding edge |
| Test escrow | `test_mode_hold.py` | Hold/release_due/dispute/resolve; resolver ≠ parties; BPS 50 fee recorded; receipts `funds_are_real:false` |
| Dummy payments | `dummy_payment.py` | `request_key` idempotency; timeout → UNKNOWN plus status; `receipt_status: CONFIGURED_UNVERIFIED` |
| Signing | `signing_gate.py`; `covenant_chain/webauthn.py` | Local CLI Ed25519 (about 8 human steps); PasskeySigner raises `PASSKEY_NOT_ED25519`, although a WebAuthn L3 ES256 relying party already exists |
| Mandates / spend | `covenant_chain/scoped_mandates.py`, `spend_windows.py`, `erc7710_delegations.py` | Covenant-native signed verb-scoped mandates, attenuation, per-request caps, rolling windows, durable ledger with RFC 6962 journal. Not AP2-shaped, and not reachable from the public MCP |
| AP2 | `covenant_agent/ap2_release.py` | Closed PaymentMandate (v0.2) checked against agreement amount, payee and expiry → release condition. Does not verify the SD-JWT itself; no Checkout Mandate, open mandates, `cnf` or receipts |
| ACP / UCP | `commerce_acp.py` (2026-04-17), `commerce_ucp.py` (2026-08-25) | Checkout/order echoes and webhooks recorded as evidence bound to `aap_agreement`. Covenant is not an ACP/UCP merchant or agent endpoint |
| x402 | `x402_exact_v2.py`, `covenant_x402/` | v2 `exact` on a simulated ledger; custom `covenant` recourse scheme; "escrow… is not a dispute window". No upstream `auth-capture` |
| Agent identity | `web_bot_auth.py` (pins draft **-00**, 1 Sep 2026; -01 is out), `kya_tokens.py` | Verifier library only; not enforced on the hosted endpoints |
| Discovery | live host; `docs/AGENT_START` | Custom `/.well-known/covenant-api.json` and `/openapi.json`; MCP server card, ai-catalog, A2A card, UCP profile, JWKS and oauth-protected-resource all 404 |
| Public MCP | live `tools/list` (`live_tools.json`) | 9 tools (10 on PR #200 with `covenant_payment__quote`), all read-only; no `outputSchema`; `idempotentHint:false` on 8 pure tools |
| Account auth | live `/mcp/account/v1` | 401 `Bearer realm="aap-account"` with no `resource_metadata`; no OAuth metadata |
| Response UX | `response_envelope.py` | Good: flags {signed, published, paid, binding, test_mode}, money block, next_actions, errors with examples. This should become the `outputSchema` |
| Prior testing | `/workspace/cov/normal`, `negpay`, `doet`, `ux` | Normal-agent average 1.9/5; 21 negotiation/payment findings; DOET 35-item checklist |

## 4. Gaps by group (detail in gaps.csv)

1. **Identity & delegation**
   - No user-to-agent authority object on the product path.
   - Agent identity is a did:aap key with no standard proof at the HTTP layer (Web Bot Auth is library-only, on draft -00).
   - No OAuth on the account MCP.
2. **Intent/mandates & spend controls**
   - The scoped-mandate and spend-window engine exists but is neither AP2-shaped nor exposed.
   - `covenant_review__authority` checks ad-hoc policy, not a signed mandate.
   - No open/closed split and no "rejection receipt before reuse" rule.
3. **Negotiation**
   - Offers are not addressed, authored, linked, expiring or acceptable over the public MCP; this is the negpay round-5 verdict.
   - `deal_state.py` adds the state model but the transport is account-only.
   - ACP/UCP checkout sessions have no counter-offer. Covenant's offer/counter is a differentiator to keep and expose with a typed `offer` object and expiry.
4. **Checkout & payment rails**
   - Nothing can be selected.
   - There is no single sandbox rail end to end.
   - The card path is not aligned to ACP Allowance / Stripe SPT.
   - The escrow semantics are custom rather than x402 `auth-capture`.
   - The fee is shown but its collection point is undefined.
5. **Signing/approval UX**
   - Passkeys cannot approve.
   - There is no Trusted Surface (non-agentic approval page).
   - There is no MCP `input_required` / URL-elicitation hand-off.
   - The CLI path takes about 8 steps.
6. **Escrow/fulfilment/disputes**
   - No partial capture or refund and no milestones.
   - No capture or refund deadlines, and no buyer reclaim after deadline.
   - No dispute evidence bundle or timeline.
7. **Receipts & audit**
   - `CONFIGURED_UNVERIFIED` receipts.
   - No signed checkout/payment/release receipts hash-linked to mandate plus agreement.
   - No `adjustments[]` (refund/dispute) history.
   - No webhook signing.
8. **Discovery & interop**
   - MCP version lag.
   - No `server/discover`, server card, ai-catalog, A2A card or UCP profile.
   - No `outputSchema`; annotation inaccuracies.
9. **Safety/fraud**
   - Idempotency only in the dummy desk and market ops; no uniform contract.
   - No replay/nonce policy on account mutations.
   - No velocity limits on the hosted path.
   - Annotations are not a security control.
10. **Trust & legal**
    - Escrow holding is likely in the FCA perimeter.
    - CMA agent guidance applies: AI disclosure, all-in pricing and cancellation rights.
    - Legal entity, terms, complaints and dispute policy are owner TODOs.

## 5. Top 10 gaps, in priority order

1. **No user-signed delegated authority (mandate) on the product path.**
   - Why: AP2's core idea is that a merchant or counterparty can prove the user authorised *this* spend, and Covenant can't yet prove that for a hosted deal.
   - Fix: ship an AP2 v0.2 open/closed Checkout + Payment mandate profile backed by the existing `scoped_mandates`/`spend_windows`.
   - Source: AP2 spec.
2. **No Trusted Surface approval, and passkeys can't approve.**
   - Why: AP2 requires a non-agentic surface for human approval, and the current human path is an 8-step CLI.
   - Fix: the passkey (ES256, `webauthn.py`) signs the *mandate*, and the mandate's `cnf` binds the agent's Ed25519 key. This needs no trade-signature change. Hand-off via MCP URL-mode elicitation / `input_required`.
   - Sources: AP2; MCP 2026-07-28.
3. **No end-to-end sandbox rail with real escrow semantics.**
   - Why: x402 `auth-capture` (escrow flow, capture/void/refund/reclaim, deadlines) is now the published shape for "refundable, buyer-protected, delayed delivery", which is exactly Covenant's deal.
   - Fix: map `test_mode_hold` onto it; Base Sepolia/local only.
   - Source: x402 auth-capture (27 Oct 2026).
4. **Receipts are unsigned and unlinked.**
   - Why: AP2 receipts and ACP order adjustments are the dispute evidence standard.
   - Fix: sign checkout/payment/capture/refund/release receipts that hash-link mandate → agreement → payment.
   - Sources: AP2; ACP.
5. **No uniform idempotency contract on mutating account tools.**
   - Why: agents retry, and a double-hold or double-release is the worst failure.
   - Fix: adopt ACP semantics (key required; 409 in-flight; 422 conflict; replay flag).
   - Source: ACP.
6. **MCP version and schema lag.**
   - Why: 2026-07-28 clients expect `server/discover`, `resultType` and `outputSchema`; the live server refuses `server/discover`.
   - Fix: dual-serve 2025-11-25 and 2026-07-28; publish `outputSchema` from `response_envelope`; fix `idempotentHint`.
   - Source: MCP changelog/tools.
7. **Account auth is a bare bearer.**
   - Why: MCP clients discover auth via RFC 9728, and scopes give least privilege and step-up.
   - Fix: OAuth 2.1 + PKCE, CIMD, PRM; scopes such as `deal:offer`, `deal:fund:test`, `deal:release`.
   - Source: MCP authorization.
8. **Not discoverable by standard means.**
   - Why: agents and registries look for an MCP server card / ai-catalog, an A2A agent card and a UCP profile, and all of them 404.
   - Fix: publish them (read-only, static, signed).
   - Sources: SEP-2127; A2A v1.0; UCP.
9. **Disputes and fulfilment model too coarse.**
   - Why: buyer protection needs partial outcomes, deadlines and evidence, and the auth-capture and ACP adjustments models assume them.
   - Fix: add partial capture/refund, milestones, a dispute-from-agreed/funded path, `evidence[]` and `respond_by` (owner sets the windows).
   - Sources: x402 auth-capture; ACP.
10. **Regulatory and consumer-law readiness.**
    - Why: holding buyer funds until delivery is likely a regulated payment service in the UK, and the CMA says the business is liable for its agents' conduct (all-in prices, AI disclosure, cancellation rights).
    - Fix: decide the custody model before any non-test money.
    - Sources: FCA PERG 15 / CAE page; CMA guidance (updated 30 Oct 2026).

Next after the top 10:
- (11) Card sandbox via ACP Allowance + Stripe SPT test mode.
- (12) Bump Web Bot Auth to -01 and verify `Signature-Agent` on account endpoints (optional/advisory first).
- (13) Define the fee collection leg (`fee_window` null).
- (14) Signed order/adjustment webhooks (ACP `Merchant-Signature` / RFC 9421).
- (15) Publish an A2A extension for Covenant deals and `a2a-x402`.

## 6. Which standards to adopt first, and why

1. **MCP 2026-07-28 (dual with 2025-11-25) + RFC 9728 auth + `outputSchema`**
   - This is Covenant's actual distribution channel and the cheapest change.
   - It immediately improves agent success, since the normal-agent score was 1.9.
   - It is also a prerequisite for the `input_required` approval hand-off.
2. **AP2 v0.2 mandates (open + closed Checkout/Payment)**
   - These are the only published, network-neutral model for "user authorised this agent to spend up to X with Y until Z".
   - Covenant already has the closed PaymentMandate check and a stronger native constraint engine, so the work is mainly profile and verify.
   - Agent-to-agent delegation is out of AP2's scope. Covenant's attenuating chains fill that gap, and it should say so.
3. **x402 v2 `auth-capture` (escrow flow)**
   - It is semantically identical to Covenant's hold → deliver → release/refund with deadlines.
   - It supports MCP and A2A transports and is chain-native for the USDC Sepolia rails Covenant already lists.
   - Keep the custom `covenant` recourse scheme as an extension, not the default wire.
4. **ACP idempotency + Delegate-Payment Allowance, with Stripe SPT in test mode**
   - This is the de facto card-side model, and its idempotency semantics are worth adopting everywhere regardless of rail.
5. **A2A v1.0 Agent Card + UCP business profile + MCP Server Card**
   - These are static, read-only and low risk, and they make Covenant findable by other agents.
6. **Later:**
   - Web Bot Auth -01 / Visa TAP / Mastercard Agent Pay verification, which matters once card networks are in scope.
   - KYAPay.
   - MPP.

## 7. Owner decisions needed

1. **Approval model:**
   - Recommended: passkey-signed AP2 open mandate binding the agent's Ed25519 key via `cnf`.
   - Alternative: add P-256/ES256 as a trade-signature algorithm. This is a schema addition and must stay backward compatible.
2. **Custody model for any non-test money:**
   - Option a: third-party PSP/escrow, with Covenant as technology only.
   - Option b: non-custodial on-chain auth-capture contract.
   - Option c: Covenant holds funds, which likely needs FCA authorisation or agent status.
   - Get legal advice; I have not stated a conclusion.
3. **Role:** is Covenant merchant of record, a platform, or a commercial agent for one side? This affects ACP/UCP fit and the CAE.
4. **Dispute policy:**
   - review and capture windows
   - refund deadline
   - resolver selection
   - appeal
   - fees on dispute
   - partial-award rules
5. **Fee:** when it is collected (on capture? on release?), from whom, and how it is shown all-in (DMCCA). The registry `fee_window_*` is null.
6. **First sandbox rail:** USDC Base Sepolia (auth-capture) or Stripe test mode (SPT), or both.
7. **Mandate defaults:** max amount, expiry, counterparties, and whether autonomous (human-not-present) mode is allowed at all in v1.
8. **Public MCP stays read-only?** Recommended: yes. Mutations go only on the authenticated account MCP or a clearly separate sandbox endpoint.
9. **MCP 2025-11-25 sunset date** once 2026-07-28 is served.
10. **Legal TODOs** (do not invent):
    - legal entity and address
    - governing law
    - terms and privacy
    - complaints process
    - CRA/CCR cancellation handling
    - AI-agent disclosure wording
    - EU/US applicability

## 8. Briefs

- `/workspace/cov/agentic/brief_server.md`: server work, sandbox only, backward compatible, no deploy.
- `/workspace/cov/agentic/brief_docs.md`: docs work.

## 9. Caveats

- I read server code only on branch `cursor/public-mcp-usability-fixes-ce0e` (PR #200), through the read-only GitHub connector. I did not run the server test suite.
- I did not verify:
  - whether `stripe_*.py` already support SPT
  - whether the account MCP already enforces idempotency on every mutation (some ops in `hosted_account_market.py` carry `idempotency_key`)
- These are flagged "verify" in gaps.csv.
- Some ACP 2026-04-17 details (idempotency status codes, webhook header) came partly from a secondary summary. The repo `commerce_acp.py` cites the same snapshot.
