# Covenant public tools · 0.2.0

Find a published service, draft the exact terms for a job, and check what changed.
This free plugin connects to the Covenant engine:

`https://jupie202020.pythonanywhere.com/mcp/engine/v1`

Use remote Streamable HTTP without authentication. The plugin contains only connection
settings and public metadata. Keep credentials and signing keys outside this connection.

## Try it

Ask “Find published research services. Label test adverts and say if nothing matches.”
Then try “Draft a one-page research brief for USD 25, due Friday, with buyer review.
Keep it unsigned.”

The host starts with four tools:

- `covenant_onboard` gives you available routes and access requirements.
- `covenant_find` finds services or looks up features. Use `kind: "features"` for tools.
- `covenant_explain` gives you the exact schema of an action such as
  `covenant_contract__draft`.
- `covenant_call` takes the selected action name under `tool` and its input under
  `arguments`. Use only actions the host identifies as public or keyless.

Anonymous drafting creates an unsigned proposal. Signing, publishing, paying and
private account work have separate owner and account steps. Confirm a seller’s
availability before commissioning work.

## Install or refresh

**Claude Code.** Add `covenant-common/covenant-docs` with
`/plugin marketplace add covenant-common/covenant-docs`, then select
`covenant-public@covenant-public-tools`. If already installed, refresh that
marketplace and update Covenant from the plugin manager. Restart Claude Code and
check `/mcp` for the new tool list. For a downloaded checkout, use
`claude plugin validate ./plugins/covenant-public` before a local
`claude --plugin-dir ./plugins/covenant-public` trial.

**Cursor.** Import the repository marketplace and choose `covenant-public`, or
add the engine URL above to your project’s MCP settings using
`covenant-engine` as the connection name. Refresh the server and open a new chat.
If the tool list stays stale, quit Cursor completely and reopen it. Prefer the
direct connection if a managed marketplace still supplies an older plugin.

**Other clients.** Refresh discovery. If a client still shows nine standalone
tools, disable only the old public Covenant connection and add the URL above as a
new no-auth connection. Leave private account and unrelated connections in place.
Start a new chat, confirm the four tools above, then try the draft prompt.

[Current connection guide](https://covenant-common.github.io/covenant-docs/docs/ENGINE_MCP.html) ·
[Privacy](https://covenant-common.github.io/covenant-docs/PRIVACY.html) ·
[Feedback](https://github.com/covenant-common/covenant-docs/issues/new?template=feedback.yml)

## Reviewer cases and compatibility

The [0.2.0 reviewer cases](https://covenant-common.github.io/covenant-docs/distribution/engine-connector-review-0.2.0.json)
provide five positive and three negative scenarios using the four observed tools.
They specify exact requests and expected responses, with only public or synthetic
inputs. External model behavior, native installation and store acceptance are
separate checks.

The nine original action names remain callable for existing integrations.
The [original review records](https://covenant-common.github.io/covenant-docs/review-metadata.json)
and their release downloads retain the earlier snapshots. For a new connection, use
the current tools and inspect the action schema before calling.

MIT covers the wrapper files. The hosted service and separately controlled core
have their own terms. [Public tool terms](https://covenant-common.github.io/covenant-docs/docs/PUBLIC_TOOL_USE.html).
