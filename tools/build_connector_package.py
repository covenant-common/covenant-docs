#!/usr/bin/env python3
"""Build or check the public, configuration-only connector ZIP. No network calls."""
import argparse
import hashlib
import io
import json
from pathlib import Path
import re
import stat
from urllib.parse import urlsplit
import zipfile

ROOT = Path(__file__).resolve().parents[1]
PLUGIN = ROOT / 'plugins' / 'covenant-public'
VERSION = '0.1.1'
OUTPUT = ROOT / 'downloads' / f'covenant-public-{VERSION}.zip'
LEGACY_OUTPUT = ROOT / 'downloads' / 'covenant-public-0.1.0.zip'
LEGACY_SHA256 = '62b1d56df51c4f80bb36c5c5135d953657029f0a5fb017b2fd8571554d175dea'
FILES = (
    '.claude-plugin/plugin.json', '.cursor-plugin/plugin.json', '.mcp.json',
    'LICENSE', 'README.md', 'assets/icon.png', 'mcp.json', 'plugin.json',
)
ENDPOINT = 'https://jupie202020.pythonanywhere.com/mcp'
PUBLIC_TOOLS = frozenset((
    'aap_public_listing_search', 'covenant_contract__compare', 'covenant_contract__draft',
    'covenant_contract__inspect', 'covenant_contract__render', 'covenant_marketplace__quick_trade',
    'covenant_review__authority', 'covenant_review__evidence', 'covenant_review__review',
))
MANIFEST_FIELDS = frozenset(('$schema', 'name', 'version', 'description', 'author',
                             'homepage', 'repository', 'license', 'keywords', 'extensions'))
NATIVE_MANIFEST_FIELDS = frozenset(('name', 'version', 'description', 'author', 'homepage',
                                    'repository', 'license', 'keywords', 'mcpServers'))
# Submission metadata limits: https://developers.openai.com/plugins/deploy/submission
# These local checks complement the official portable schema and portal scan; they
# do not establish native installation, provider acceptance or operational readiness.
INTERFACE_FIELDS = frozenset((
    'displayName', 'shortDescription', 'longDescription', 'developerName', 'category',
    'capabilities', 'websiteURL', 'supportURL', 'privacyPolicyURL', 'termsOfServiceURL',
    'defaultPrompt', 'brandColor', 'brandColorDark', 'composerIcon', 'composerIconDark',
    'logo', 'logoDark', 'screenshots',
))
SENSITIVE_TEXT = re.compile(
    r'-----BEGIN (?:[A-Z ]+ )?PRIVATE KEY-----|'
    r'\b(?:sk-proj-|sk-live-|sk_test_|ghp_|github_pat_)[A-Za-z0-9_-]+|'
    r'\bBearer\s+[A-Za-z0-9._~+/-]{8,}|'
    r'\b[a-fA-F0-9]{64}\b|/mcp/account(?:/|\b)'
)


def https_url(value):
    if not isinstance(value, str) or len(value) > 1024:
        return False
    parsed = urlsplit(value)
    return parsed.scheme == 'https' and bool(parsed.hostname) and not parsed.username and not parsed.password


def validate_metadata(manifest):
    if set(manifest) - MANIFEST_FIELDS or set(manifest.get('author', {})) - {'name', 'email', 'url'}:
        raise ValueError('Unexpected manifest field outside the public metadata allowlist')
    if (set(manifest.get('extensions', {})) != {'com.openai'}
            or set(manifest['extensions']['com.openai']) != {'interface', 'review', 'publication'}):
        raise ValueError('Only the reviewed public presentation, review and publication metadata is allowed')
    publication = manifest['extensions']['com.openai']['publication']
    if set(publication) - {'countries', 'release_notes', 'translations'}:
        raise ValueError('Unsupported publication metadata')
    if (manifest['name'], manifest['version'], manifest['license']) != ('covenant-public', VERSION, 'MIT'):
        raise ValueError('Unexpected package identity or licence')
    ui = manifest['extensions']['com.openai']['interface']
    if set(ui) - INTERFACE_FIELDS:
        raise ValueError('Unsupported OpenAI presentation metadata')
    for key, limit in (('displayName', 30), ('shortDescription', 30), ('longDescription', 4000),
                       ('developerName', 80)):
        if not isinstance(ui.get(key), str) or not 1 <= len(ui[key]) <= limit:
            raise ValueError(f'Missing or over-limit presentation field: {key}')
    if not isinstance(ui.get('category'), str) or not ui['category'].strip():
        raise ValueError('A real dashboard category must be selected')
    for key in ('websiteURL', 'supportURL', 'privacyPolicyURL', 'termsOfServiceURL'):
        if not https_url(ui.get(key)):
            raise ValueError(f'Invalid public listing URL: {key}')
    prompts = ui.get('defaultPrompt', [])
    if isinstance(prompts, str):
        prompts = [prompts]
    if (not isinstance(prompts, list) or len(prompts) > 3
            or any(not isinstance(p, str) or not 1 <= len(p) <= 128 or '@' in p for p in prompts)
            or len(prompts) != len(set(prompts))):
        raise ValueError('Starter prompts must be unique, short user tasks without app mentions')
    capabilities = ui.get('capabilities', [])
    if (not isinstance(capabilities, list) or len(capabilities) > 20
            or any(not isinstance(c, str) or not 1 <= len(c) <= 120 for c in capabilities)):
        raise ValueError('Invalid capability labels')
    for key in ('logo', 'composerIcon'):
        if ui[key] != './assets/icon.png':
            raise ValueError('Unexpected package image path')
    review = manifest['extensions']['com.openai']['review']
    if set(review) - {'test_cases', 'demo_recording_url', 'commerce', 'commerce_description'}:
        raise ValueError('Unsupported review metadata or private reviewer access details')
    if 'demo_recording_url' in review and not https_url(review['demo_recording_url']):
        raise ValueError('A recording field requires an actual HTTPS recording URL')
    cases = review['test_cases']
    if set(cases) != {'positive', 'negative'} or len(cases['positive']) != 5 or len(cases['negative']) != 3:
        raise ValueError('Initial MCP review requires exactly five positive and three negative cases')
    covered = set()
    for kind in ('positive', 'negative'):
        for case in cases[kind]:
            if set(case) - {'description', 'prompt', 'tools_triggered', 'expected_behavior',
                            'file_attachment_urls', 'expected_output_url'}:
                raise ValueError('Unsupported reviewer case field')
            for key in ('description', 'prompt', 'expected_behavior'):
                if not isinstance(case.get(key), str) or not case[key].strip():
                    raise ValueError(f'Missing reviewer case field: {key}')
            names = {x.strip() for x in case.get('tools_triggered', '').split(',') if x.strip()}
            if not names <= PUBLIC_TOOLS or (kind == 'positive' and not names):
                raise ValueError('Reviewer case contains a non-public or missing tool')
            if kind == 'positive':
                covered.update(names)
    if covered != PUBLIC_TOOLS:
        raise ValueError('Positive reviewer cases must cover all nine public tools')


def build():
    if not LEGACY_OUTPUT.is_file() or hashlib.sha256(LEGACY_OUTPUT.read_bytes()).hexdigest() != LEGACY_SHA256:
        raise ValueError('The retained 0.1.0 archive must remain byte-exact')
    found = {p.relative_to(PLUGIN).as_posix() for p in PLUGIN.rglob('*') if p.is_file()}
    if found != set(FILES):
        raise ValueError('Package inventory differs from the reviewed eight-file allowlist')
    for name in FILES:
        p = PLUGIN / name
        parts = p.relative_to(PLUGIN).parts
        if any(PLUGIN.joinpath(*parts[:i]).is_symlink() for i in range(len(parts) + 1)):
            raise ValueError('Symlinks are not allowed in a public package')
        if p.stat().st_size > 100_000:
            raise ValueError('Unexpectedly large public wrapper member')
        if p.suffix in {'.json', '.md'} and SENSITIVE_TEXT.search(p.read_text()):
            raise ValueError(f'Potential credential, backend fingerprint or private endpoint in {name}')
    native = json.loads((PLUGIN / '.mcp.json').read_text())
    portable = json.loads((PLUGIN / 'mcp.json').read_text())
    if native != {'mcpServers': {'covenant-public': {'type': 'http', 'url': ENDPOINT}}}:
        raise ValueError('Native wrapper must expose only the anonymous HTTPS endpoint')
    if portable != {'$schema': 'https://agent-plugins.org/schemas/1.0.0/mcp.schema.json',
                    'mcpServers': {'covenant-public': {'type': 'streamable-http', 'url': ENDPOINT}}}:
        raise ValueError('Portable wrapper must expose only the anonymous HTTPS endpoint')
    manifest = json.loads((PLUGIN / 'plugin.json').read_text())
    validate_metadata(manifest)
    for name in ('.claude-plugin/plugin.json', '.cursor-plugin/plugin.json'):
        native_manifest = json.loads((PLUGIN / name).read_text())
        if (set(native_manifest) - NATIVE_MANIFEST_FIELDS
                or set(native_manifest.get('author', {})) - {'name', 'email', 'url'}):
            raise ValueError('Native manifest must remain configuration-only public metadata')
        if (native_manifest['name'], native_manifest['version'], native_manifest['license'],
                native_manifest['mcpServers']) != ('covenant-public', VERSION, 'MIT', './.mcp.json'):
            raise ValueError('Native manifest identity and connection path must match this release')
    if not (PLUGIN / 'assets/icon.png').read_bytes().startswith(b'\x89PNG\r\n\x1a\n'):
        raise ValueError('Invalid PNG icon')
    result = io.BytesIO()
    with zipfile.ZipFile(result, 'w', compression=zipfile.ZIP_DEFLATED, compresslevel=9) as z:
        for name in FILES:
            entry = zipfile.ZipInfo(name, (2026, 11, 2, 0, 0, 0))
            entry.create_system = 3
            entry.external_attr = (stat.S_IFREG | 0o644) << 16
            entry.compress_type = zipfile.ZIP_DEFLATED
            z.writestr(entry, (PLUGIN / name).read_bytes(), compresslevel=9)
    return result.getvalue()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true')
    args = parser.parse_args()
    data = build()
    if args.check:
        if not OUTPUT.is_file() or OUTPUT.read_bytes() != data:
            raise SystemExit('FAIL: missing or stale public connector ZIP')
    else:
        OUTPUT.parent.mkdir(exist_ok=True)
        OUTPUT.write_bytes(data)
    print(json.dumps({'status': 'PASS', 'archive': str(OUTPUT.relative_to(ROOT)),
                      'version': VERSION, 'retained_0_1_0_sha256': LEGACY_SHA256,
                      'sha256': hashlib.sha256(data).hexdigest(), 'members': list(FILES),
                      'configuration_only': True, 'core_source_included': False,
                      'native_client_installation': 'SEPARATE_NOT_ESTABLISHED',
                      'store_acceptance': 'SEPARATE_NOT_ESTABLISHED'}, indent=2))


if __name__ == '__main__':
    main()
