# Covenant public tools · 0.1.1

Find a published service. Turn a small job into an unsigned proposal with a clear
deliverable, price, deadline and review. Compare changes and check what the supplied
approvals and evidence establish.

This free plugin connects only to the public Covenant MCP at:

`https://jupie202020.pythonanywhere.com/mcp`

No account, token or private key is needed. It installs no executable, hook or local server.

## Try it

Ask: “Find published research services and label any demos. Tell me if there is no
matching supplier.”

Or: “Draft a one-page research brief for USD 25, due Friday, with buyer review. Keep
it unsigned.” 

When the proposal changes: “Compare these two drafts: show the price and deadline
changes and what needs fresh approval.”

The public tools prepare and inspect records. They do not sign, publish an advert,
create a private account record, reserve money, send a payment or decide a dispute.
If there are no matching adverts, report that result. Demo adverts are labelled
examples; confirm real availability with the supplier. Supplied signatures and
records are checked within the tool's stated scope. A draft or caller-declared role
does not establish assent, identity or permission.

## Claude Code

From this public repository:

```text
/plugin marketplace add covenant-common/covenant-docs
/plugin install covenant-public@covenant-public-tools
```

Review the connection when Claude Code asks. Do not enable broader tool permissions
just to use this plugin. Check `/mcp` for the connected server and available tools.

For a downloaded checkout, validate with `claude plugin validate ./plugins/covenant-public`
and use `claude --plugin-dir ./plugins/covenant-public` for a local trial.
These commands require Claude Code; this repository does not install it.

## Cursor

Import `covenant-common/covenant-docs` as a marketplace, then choose `covenant-public`.
For local testing, copy this plugin folder into a new folder inside
`~/.cursor/plugins/local/`, reload Cursor and review its MCP connection in Customize.
The included `.cursor-plugin/plugin.json` explicitly names `.mcp.json`.
Do not install both the native and portable versions together; they point to the same server.

[Cursor submission](https://cursor.com/marketplace/publish) and
[Claude directory submission](https://claude.ai/directory/manage) are separate review
processes. A repository marketplace is not an approved store listing.

## What this connects

The public endpoint currently offers public tools:

- `aap_public_listing_search`
- `covenant_marketplace__quick_trade`
- `covenant_contract__draft`
- `covenant_contract__inspect`
- `covenant_contract__compare`
- `covenant_contract__render`
- `covenant_review__review`
- `covenant_review__authority`
- `covenant_review__evidence`

Private hosted accounts and the separately licensed engine are not included in this
plugin. The server's current tool list is authoritative. The hosted service is a
developer pilot; availability and usage limits are explained in the connection guide.

## Privacy and support

Requests go from your agent client to the hosted Covenant service. Send only the
information needed for the requested draft or check. Never submit private keys,
passwords, account tokens or unrelated private records. This wrapper stores no data
or credentials; your agent client and the hosted service have their own data handling.

[Privacy](https://covenant-common.github.io/covenant-docs/PRIVACY.html) ·
[Connection guide](https://covenant-common.github.io/covenant-docs/docs/API_MCP.html) ·
[Support and feedback](https://github.com/covenant-common/covenant-docs/issues/new?template=feedback.yml)

## Reviewer cases

The portable manifest contains exactly five positive and three negative reviewer
cases. Together the positive cases cover all the public tools. The negative cases
require rejection or clarification for a draft passed as a review case, an exact
case-identifier mismatch and a malformed direct authority public key. They describe
the required safe result, not a new claim of prompt-level test execution.

The [retained 2 November morning evidence](https://covenant-common.github.io/covenant-docs/review-metadata.json)
preserves exact historical requests and observed outputs, including the original
generic negative errors. It predates the later public presentation fix and remains
unchanged. Reproduce the current reviewer cases in the target client and retain the
actual results before submission. Do not treat old observations as a current live
result or replace them with an expected answer.

No review video URL is included because this package has no actual recording URL.
Publisher identity, endpoint-origin domain verification, the portal tool scan,
required review materials, policy attestations and approval/publication remain
separate gates. Direct installation does not establish store approval.

## Licence

MIT covers the files in this public wrapper folder. It does not license the
separately controlled Covenant implementation, hosted infrastructure, customer
records, trademarks or third-party services. Public-tool access does not distribute
the core code. There is no fee for this wrapper or the anonymous public tools it connects.

## Compatibility evidence

Native manifest paths and endpoint configuration are checked against the official
Cursor and Claude Code references. Actual host installation/review must be verified
separately; this README does not claim store approval.

The 0.1.1 ZIP is built from an eight-file configuration-only allowlist. It contains
no local executable, credentials, account endpoint or private engine. The earlier
0.1.0 download is retained unchanged. The version update changes package metadata,
review expectations and this guide; it does not change hosted tool identifiers,
schemas, annotations or endpoint behavior.
