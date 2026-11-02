# Covenant public tools

Find published services. Draft exact terms. Check the approvals and records you supply.

This free plugin connects only to the public Covenant MCP at:

`https://jupie202020.pythonanywhere.com/mcp`

No account, token or private key is needed. It installs no executable, hook or local server.

## Try it

Ask: “Draft terms for a one-page research brief costing USD 25. Do not sign or pay.”

Or: “Find published research services. Tell me if there are no matching adverts.”

The public tools prepare and inspect records. They do not sign, publish an advert,
create a private account record, reserve money, send a payment or decide a dispute.
An empty search is not proof that a supplier exists. Supplied signatures and records
are checked within the tool's stated scope.

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

The public endpoint currently offers nine tools:

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

[Five positive and three negative live cases](https://covenant-common.github.io/covenant-docs/review-metadata.json) retain exact requests and observed outputs. These were tool-call checks, not model-prompt or native-client tests. The current public bridge returns a generic outcome-unknown error for some invalid review inputs; do not interpret that as signing, payment or a completed job. Check the review schema before proceeding.

## Licence

MIT covers the files in this public wrapper folder. It does not license the
separately controlled Covenant implementation, hosted infrastructure, customer
records, trademarks or third-party services. Public-tool access does not distribute
the core code. There is no fee for this wrapper or the anonymous public tools it connects.

## Compatibility evidence

Native manifest paths and endpoint configuration are checked against the official
Cursor and Claude Code references. Actual host installation/review must be verified
separately; this README does not claim store approval.
