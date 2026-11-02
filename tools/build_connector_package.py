#!/usr/bin/env python3
"""Build or check the public, configuration-only connector ZIP. No network calls."""
import argparse
import hashlib
import io
import json
from pathlib import Path
import stat
import zipfile

ROOT = Path(__file__).resolve().parents[1]
PLUGIN = ROOT / 'plugins' / 'covenant-public'
OUTPUT = ROOT / 'downloads' / 'covenant-public-0.1.0.zip'
FILES = (
    '.claude-plugin/plugin.json', '.cursor-plugin/plugin.json', '.mcp.json',
    'LICENSE', 'README.md', 'assets/icon.png', 'mcp.json', 'plugin.json',
)
ENDPOINT = 'https://jupie202020.pythonanywhere.com/mcp'


def build():
    found = {p.relative_to(PLUGIN).as_posix() for p in PLUGIN.rglob('*') if p.is_file()}
    if found != set(FILES):
        raise ValueError('Package inventory differs from the reviewed eight-file allowlist')
    for name in FILES:
        p = PLUGIN / name
        if p.is_symlink() or any(q.is_symlink() for q in p.parents if q != PLUGIN.parent):
            raise ValueError('Symlinks are not allowed in a public package')
        if p.stat().st_size > 100_000:
            raise ValueError('Unexpectedly large public wrapper member')
    native = json.loads((PLUGIN / '.mcp.json').read_text())
    portable = json.loads((PLUGIN / 'mcp.json').read_text())
    if native != {'mcpServers': {'covenant-public': {'type': 'http', 'url': ENDPOINT}}}:
        raise ValueError('Native wrapper must expose only the anonymous HTTPS endpoint')
    if portable != {'$schema': 'https://agent-plugins.org/schemas/1.0.0/mcp.schema.json',
                    'mcpServers': {'covenant-public': {'type': 'streamable-http', 'url': ENDPOINT}}}:
        raise ValueError('Portable wrapper must expose only the anonymous HTTPS endpoint')
    manifest = json.loads((PLUGIN / 'plugin.json').read_text())
    if (manifest['name'], manifest['version'], manifest['license']) != ('covenant-public', '0.1.0', 'MIT'):
        raise ValueError('Unexpected package identity or licence')
    ui = manifest['extensions']['com.openai']['interface']
    if len(ui['displayName']) > 30 or len(ui['shortDescription']) > 30:
        raise ValueError('Store title or subtitle exceeds the documented limit')
    for key in ('logo', 'composerIcon'):
        if ui[key] != './assets/icon.png':
            raise ValueError('Unexpected package image path')
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
                      'sha256': hashlib.sha256(data).hexdigest(), 'members': list(FILES),
                      'configuration_only': True, 'core_source_included': False,
                      'native_client_installation': 'SEPARATE_NOT_ESTABLISHED',
                      'store_acceptance': 'SEPARATE_NOT_ESTABLISHED'}, indent=2))


if __name__ == '__main__':
    main()
