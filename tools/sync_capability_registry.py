#!/usr/bin/env python3
"""Copy the server capability registry into this docs repo.

Source of truth:
  repo: covenant-common/covenant
  path: covenant_chain/data/capability_registry.json
  draft: https://github.com/covenant-common/covenant/pull/200
  alongside: https://github.com/covenant-common/covenant/pull/192

This docs environment cannot read that private repository (GitHub returns
404). Run this where the covenant checkout or a token for it is available.

  python3 tools/sync_capability_registry.py --checkout /path/to/covenant
  python3 tools/sync_capability_registry.py --file /path/to/capability_registry.json

The raw server JSON is saved as distribution/capability-registry.server.json.
The docs projection is rewritten to distribution/capability-registry.json.
Then commit both files. CI refuses a projection that does not match the
saved server JSON.
"""
import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from registry_view import PROJECTION, SERVER_COPY, SERVER_PATH, normalize

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--checkout', help='Path to a covenant-common/covenant checkout')
    parser.add_argument('--file', help='Path to capability_registry.json itself')
    args = parser.parse_args()
    if args.file:
        source = Path(args.file)
    elif args.checkout:
        source = Path(args.checkout) / SERVER_PATH
    else:
        parser.error('pass --checkout or --file; PR 200 is not readable from the docs agent')
    if not source.is_file():
        raise SystemExit('Server registry not found: ' + str(source))
    raw = json.loads(source.read_text())
    view = normalize(raw)
    view['source_path'] = SERVER_PATH
    view['source_repo'] = 'covenant-common/covenant'
    view['source_pr'] = 200
    view['related_pr'] = 192
    view['note'] = 'Projected from %s on draft PR 200. Do not edit payment or tool rows by hand.' % SERVER_PATH
    SERVER_COPY.write_text(json.dumps(raw, indent=2) + '\n')
    PROJECTION.write_text(json.dumps(view, indent=2) + '\n')
    print({'status': 'PASS', 'tools': len(view['public_tools']), 'payments': len(view['payments']), 'server_copy': str(SERVER_COPY)})
    return 0

if __name__ == '__main__':
    raise SystemExit(main())
