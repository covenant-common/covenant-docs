# Capability registry sync

The docs site does not invent payment status or the public tool list. Both are projected from the server file:

- Repository: `covenant-common/covenant`
- Path: `covenant_chain/data/capability_registry.json`
- Draft pull request: https://github.com/covenant-common/covenant/pull/200
- Related server work: https://github.com/covenant-common/covenant/pull/192

`distribution/capability-registry.json` is the projection the site build reads. `distribution/capability-registry.server.json` is the raw server file, saved only after a sync. It is not in this checkout yet: the docs agent receives HTTP 404 for that private pull request.

## Sync

From a machine that can read the covenant repository:

```sh
python3 tools/sync_capability_registry.py --checkout /path/to/covenant
```

Or, if you already have the JSON file:

```sh
python3 tools/sync_capability_registry.py --file /path/to/capability_registry.json
```

Then run `python3 tools/build_site.py` and commit the projection, the raw copy, and the regenerated pages.

## What the build accepts

`tools/registry_view.py` reads either:

- the docs projection (`public_tools`, `payments`, `badges`), or
- a nested server document that contains a tool list (`tools` / `public_tools`, each item a name or `{name}`) and payment methods (`methods` / `payment_methods`, each with `id` and `readiness`).

A file with neither shape fails and prints its top-level keys. Do not fill the gap by hand.

## CI

`tools/check_registry_drift.py` checks the projection against `mcp/tool-inventory.json` and the generated pages. When the raw server copy is present, the projection's tools and payment ids must match `normalize()` of that copy.
