#!/usr/bin/env python3
"""Copy the server capability registry into this docs repo.

Source of truth:
  repo: covenant-common/covenant
  path: covenant_chain/data/capability_registry.json
  draft: https://github.com/covenant-common/covenant/pull/201
  alongside: https://github.com/covenant-common/covenant/pull/192

With no arguments this tries to read that file through the GitHub API.
A 404 or an unrecognised shape exits non-zero. The claims check then fails
closed instead of treating a stale projection as verified.

  python3 tools/sync_capability_registry.py --checkout /path/to/covenant
  python3 tools/sync_capability_registry.py --file /path/to/capability_registry.json

The raw server JSON is saved as distribution/capability-registry.server.json.
The docs projection is rewritten to distribution/capability-registry.json.
Then commit both files. CI refuses a projection that does not match the
saved server JSON.
"""
import argparse
import json
import subprocess
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from registry_view import PROJECTION, SERVER_COPY, SERVER_PATH, SERVER_PR, normalize

def fetch_pr(pr):
    api = 'repos/covenant-common/covenant/contents/%s?ref=refs/pull/%s/head' % (SERVER_PATH, pr)
    proc = subprocess.run(
        ['gh', 'api', api, '-H', 'Accept: application/vnd.github.raw'],
        capture_output=True, text=True)
    if proc.returncode != 0:
        detail = (proc.stderr or proc.stdout or 'no response').strip().splitlines()[-1][:240]
        raise SystemExit('PR %s registry is not readable (%s). Refusing to keep a stale projection.' % (pr, detail))
    try:
        return json.loads(proc.stdout)
    except json.JSONDecodeError as exc:
        raise SystemExit('PR %s registry was not JSON: %s' % (pr, exc))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--checkout', help='Path to a covenant-common/covenant checkout')
    parser.add_argument('--file', help='Path to capability_registry.json itself')
    parser.add_argument('--pr', type=int, default=SERVER_PR, help='Draft pull request to read when no file is given')
    args = parser.parse_args()
    if args.file:
        source = Path(args.file)
        if not source.is_file():
            raise SystemExit('Server registry not found: ' + str(source))
        raw = json.loads(source.read_text())
    elif args.checkout:
        source = Path(args.checkout) / SERVER_PATH
        if not source.is_file():
            raise SystemExit('Server registry not found: ' + str(source))
        raw = json.loads(source.read_text())
    else:
        raw = fetch_pr(args.pr)
    try:
        view = normalize(raw)
    except ValueError as exc:
        raise SystemExit(str(exc))
    view['source_path'] = SERVER_PATH
    view['source_repo'] = 'covenant-common/covenant'
    view['source_pr'] = args.pr
    view['related_pr'] = 192
    view['note'] = 'Projected from %s on draft PR %s. Do not edit payment or tool rows by hand.' % (SERVER_PATH, args.pr)
    SERVER_COPY.write_text(json.dumps(raw, indent=2) + '\n')
    PROJECTION.write_text(json.dumps(view, indent=2) + '\n')
    print({'status': 'PASS', 'tools': len(view['public_tools']), 'payments': len(view['payments']), 'server_copy': str(SERVER_COPY)})
    return 0

if __name__ == '__main__':
    raise SystemExit(main())
