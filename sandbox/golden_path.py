"""The golden path in test mode: propose, accept, settle.

A deal is a promise both sides sign. Proof shows it was kept. If it wasn't,
there is a fair way to fix it.

The browser sandbox (sandbox/index.html) runs this file inside Pyodide after
installing the locally built wheel; ``python sandbox/golden_path.py`` runs the
same steps against an installed package. It calls only the public verbs of
the wheel (covenant_agent.verbs). Every key is made fresh in memory, every
unit is simulated test USDC on an in-memory ledger, and nothing touches a
network, a chain, a key store or a real payment rail.
"""
from copy import deepcopy
import json
import sys
import time

from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey

from covenant_agent import verbs
from covenant_agent.codec import public_key
from covenant_agent.settlement import StablecoinLedger

FORMAT = 'aap-sandbox-demo/0.1'
SENTENCE = "A deal is a promise both sides sign. Proof shows it was kept. If it wasn't, there is a fair way to fix it."
ROLES = ('buyer', 'seller', 'resolver', 'appeal')
UNIT = 'USDC'
RAIL = 'x402'
OPENING = 100
PRICE = 25
DAY = 86400
TASK = 'Summarise the attached sales table as CSV.'
DELIVERY = 'region,total\nnorth,120\nsouth,95\n'
PAY_TO = '0x' + '11' * 20  # synthetic test address; no rail is contacted
MAX_RECORD = 65536


def _balances(ledger, ids):
    held = sum(row['amount'] for row in ledger.escrow.values() if row['status'] == 'HELD')
    return {'buyer': ledger.balance(ids['buyer'], UNIT), 'seller': ledger.balance(ids['seller'], UNIT), 'escrow': held}


def demo(*, now=None):
    """One complete synthetic deal. Returns the three steps and the final record."""
    started = time.perf_counter()
    clock = int(time.time()) if now is None else now
    keys = {role: Ed25519PrivateKey.generate() for role in ROLES}
    ids = {role: public_key(key) for role, key in keys.items()}
    ledger = StablecoinLedger({ids['buyer']: {UNIT: OPENING}})
    opening = _balances(ledger, ids)
    proposed = verbs.make(TASK, signer=keys['buyer'], counterparty=ids['seller'], resolver=ids['resolver'],
                          appeal_resolver=ids['appeal'], quantity=PRICE, unit=UNIT, rail=RAIL,
                          pay_to=PAY_TO, deadline=clock + DAY)
    accepted = verbs.accept(proposed['envelope'], keys['seller'], ledger)
    bound = verbs.verify(accepted)
    held = _balances(ledger, ids)
    delivered, content = verbs.deliver(accepted, DELIVERY, keys['seller'])
    settled = verbs.settle(delivered, keys['buyer'], ledger)
    proof = delivered['deliveries'][0]
    steps = [
        {'step': 'propose', 'job': 'Make a deal', 'verdict': proposed['verdict']['verdict'],
         'said': f'The buyer proposes "{TASK}" for {PRICE} test {UNIT} and signs the exact terms.',
         'signed_by': ['buyer'], 'record_id': proposed['cid'], 'balances': opening},
        {'step': 'accept', 'job': 'Make a deal', 'verdict': bound['verdict'],
         'said': f'The seller signs the same terms. Two signatures bind the deal, and {PRICE} test {UNIT} '
                 'move into escrow: held, not yet paid.',
         'signed_by': ['buyer', 'seller'], 'record_id': bound['cid'], 'balances': held},
        {'step': 'settle', 'job': 'Deliver and prove, then pay', 'verdict': settled['verdict']['verdict'],
         'said': 'The seller delivers the CSV with proof (its SHA-256 fingerprint, signed). The buyer checks '
                 f'the proof and releases the {PRICE} test {UNIT} to the seller.',
         'signed_by': ['buyer', 'seller'], 'record_id': settled['cid'], 'balances': _balances(ledger, ids),
         'proof': {'content_sha256': proof['content_hash'], 'content_bytes': len(content),
                   'signed_by': 'seller'},
         'payment': {'amount': PRICE, 'unit': UNIT, 'to': 'seller',
                     'assurance': settled['settlement']['assurance']}},
    ]
    return {
        'format': FORMAT, 'mode': 'TEST', 'model': SENTENCE, 'steps': steps,
        'terms_hash': bound['terms_hash'], 'parties': ids, 'record': settled['envelope'],
        'real_value_moved': False, 'network_used': False, 'keys_kept': False,
        'elapsed_ms': round((time.perf_counter() - started) * 1000),
    }


def check(record, *, tamper=False):
    """Check a deal record offline. tamper=True first changes the price, as a forger would."""
    if type(record) is not dict:
        raise ValueError('SANDBOX_RECORD')
    record = deepcopy(record)
    if tamper:
        record['terms']['quantity'] = PRICE * 100
    report = verbs.verify(record)
    problems = [{'code': row['code'], 'fix': row.get('remediation') or ''} for row in report['checks'] if not row['passed']]
    return {'verdict': report['verdict'], 'ok': report['ok'], 'tampered': tamper, 'problems': problems,
            'funds_observed': report['funds_observed'],
            'note': 'Signatures and proof were checked offline in this page. Escrow is a record here; '
                    'it is observed only by the ledger that holds it.'}


def demo_json():
    return json.dumps(demo(), sort_keys=True)


def check_json(raw, tamper=False):
    if type(raw) is not str or len(raw) > MAX_RECORD:
        raise ValueError('SANDBOX_RECORD')
    return json.dumps(check(json.loads(raw), tamper=bool(tamper)), sort_keys=True)


if __name__ == '__main__':
    result = demo()
    if '--record' not in sys.argv[1:]:
        result.pop('record')
    print(json.dumps(result, indent=2, sort_keys=True))
