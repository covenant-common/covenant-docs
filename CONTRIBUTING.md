# Contribute to AAP / Covenant

Start with a human need and one concrete improvement. [Choose a collaboration route](https://covenant-common.github.io/covenant-docs/docs/COLLABORATE.html) or use the public issue forms.

This is the **public documentation repository**. Runtime source and private development evidence belong in the separately controlled implementation repository. Do not export code, private reports, credentials, customer data or custody files here.

## Public documentation changes

1. Keep the first-use path accurate: implementation access is reviewed; the package is not publicly published.
2. Use clear language and distinguish implemented reference behavior, proposed services and untested assumptions. Do not imply independent audit, paying adoption or mainnet readiness.
3. Preserve the HTML style: Times New Roman, one font size, black on white, rectangular border and tight proportional spacing. Keep README and other GitHub community files in Markdown.
4. Check local links, canonical URLs, metadata, contact routes and mobile layout. Maintain `sitemap.xml`, `llms.txt` and the asset manifest.
5. Run `python3 tools/check_public_site.py --write-manifest`, then `python3 tools/check_public_site.py` before submitting.

The technical guides retain their recorded implementation snapshot. Publisher-authored introduction and community pages may evolve separately. A future documentation export must review and preserve those public-facing assets rather than replace this repository wholesale.

## Implementation work

[Apply to the developer pilot](https://github.com/covenant-common/covenant-docs/issues/new?template=pilot-tester.yml) or contact the founders if your contribution needs source access. Propose a small interface, reproducible synthetic case and explicit limits. Access and any paid work, employment, ownership or rewards are separately agreed; no entitlement is implied by contributing.

Report vulnerabilities through [SECURITY.md](SECURITY.md), not public issues. Ordinary docs bugs and non-sensitive integration goals can use the issue forms.
