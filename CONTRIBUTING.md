# Contribute to AAP / Covenant

Start with a human need and one concrete improvement. [Choose a collaboration route](https://covenant-common.github.io/covenant-docs/docs/COLLABORATE.html) or use the public issue forms.

This is the **public documentation repository**. Runtime source and private development evidence belong in the separately controlled implementation repository. Do not export code, private reports, credentials, customer data or custody files here.

## Public documentation changes

1. Keep the first-use path accurate: implementation access is reviewed; the package is not publicly published.
2. Use clear language and distinguish implemented reference behavior, proposed services and untested assumptions. Do not imply independent audit, paying adoption or mainnet readiness.
3. Preserve each interface’s typography and the shared light sea-blue palette in `assets/theme.css`. Generated research reports retain Times New Roman, one font size, black on white, a rectangular border and tight proportional spacing. Keep README and other GitHub community files in Markdown.
4. Check local links, canonical URLs, metadata, contact routes and mobile layout. Maintain `sitemap.xml`, `llms.txt` and the asset manifest.
5. Preserve the Google-issued Search Console verification tag in the homepage and the public IndexNow verification file when exporting or refreshing this site. These identify the controlled website; they are not payment credentials, store approvals or endorsements.
6. Run `python3 tools/version_public_assets.py` to refresh local style/script URLs when their bytes change, then `python3 tools/check_public_site.py --write-manifest` and `python3 tools/check_public_site.py`. Run the focused browser fixtures when changing their behavior.

The technical guides retain their recorded implementation snapshot. Publisher-authored introduction and community pages may evolve separately. A future documentation export must review and preserve those public-facing assets rather than replace this repository wholesale.

## Signing-client fixtures

The browser signer tests compare real WebCrypto output with the standalone Python signer. Use a Python interpreter with `cryptography` installed and pass it as `COVENANT_TEST_PYTHON` when running `node --test tests/*.cjs tests/*.mjs`. Run the standalone fixtures with that same interpreter: `python -m unittest discover -s tests -p 'test_approve*.py' -v`. Optional private-core interoperability and source-projection checks are labelled separately; the public site needs no core installation. Never use a real access file as a test fixture.

## Public copy

Start with a concrete problem and a useful next step. Use everyday words and short sentences. Explain what a person can do before naming the underlying technology. Keep necessary availability and permission details concise, then link to the full guide; avoid repeating them throughout a page. Fictional stories stay clearly separate from working demonstrations. Technical references retain the exact interface names they need.

## Implementation work

[Apply to the developer pilot](https://github.com/covenant-common/covenant-docs/issues/new?template=pilot-tester.yml) or contact the founders if your contribution needs source access. Propose a small interface, reproducible synthetic case and explicit limits. Access and any paid work, employment, ownership or rewards are separately agreed; no entitlement is implied by contributing.

Report vulnerabilities through [SECURITY.md](SECURITY.md), not public issues. Ordinary docs bugs and non-sensitive integration goals can use the issue forms.

## Refresh the public engine observation

The default discovery generator uses the reviewed engine 0.2 observation, `2026-11-14.f6.v1`. Run these checks for the current profile:

```sh
python3 tools/build_public_discovery.py --check
python3 tools/build_public_discovery.py --check-live
```

For a separate capture of live engine 0.2 responses, choose a new file outside the website checkout:

```sh
python3 tools/build_live_engine_discovery.py --capture-for-review /tmp/engine-0.2-observation.json
```

This performs only anonymous server-card, initialization and tools/list requests to the fixed public host. It reports hashes for review and leaves website files untouched. Match the reported identity, complete schemas and access counts against the intended deployed build and confirm that build independently. Keep the original capture bytes apart from the maintained published observation.

The capture tool currently targets the configured 0.2 identity. When the live profile or schemas change, add a separately reviewed observation, review pins and version before moving the active aliases. The `--check-live` command reads public discovery and checks the existing files. The `--refresh` command checks public discovery and rebuilds aliases from the retained observation. Keep earlier observations, inventories and frozen task suites byte-for-byte. Website publication and connector catalogue updates have their own checks.

After the hiring release is independently verified on the host, capture its public metadata into a new file:

```sh
python3 tools/build_live_engine_discovery.py --profile 2026-11-14.d25.v1 \
  --capture-for-review /tmp/covenant-engine-d25-observation.json
```

The capture accepts six additional account operations with the same four public entry schemas. If other fields drift, inspect the external capture and keep the current aliases. After review, retain the exact capture bytes at the new version’s observation path, set `HIRING_PINS` to the reviewed hashes, and select the new `ACTIVE_VERSION`. Regenerate discovery and the site manifest. The connector 0.2.0 reviewer file keeps its original f6 observation and inventory.
