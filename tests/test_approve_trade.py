"""Owner journeys for the public, offline, direct-party trade approval helper.

All credentials and agreements are synthetic. Core interop is an optional test
harness dependency only: AAP_CORE_TEST_PATH points to a reviewed local checkout.
The downloaded client never imports that checkout or makes network calls.
"""
from copy import deepcopy
import importlib.util
import io
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey
from cryptography.hazmat.primitives.serialization import Encoding,PublicFormat

CLIENT = Path(__file__).resolve().parents[1]/'clients'/'approve_trade.py'
spec = importlib.util.spec_from_file_location('public_trade_signer',CLIENT)
signer = importlib.util.module_from_spec(spec)
spec.loader.exec_module(signer)


class Terminal(io.StringIO):
    def isatty(self):
        return True


def public(key):
    return key.public_key().public_bytes(Encoding.Raw,PublicFormat.Raw).hex()


def sign(key,label,body):
    return key.sign(signer.message(label,body)).hex()


class OwnerTrade(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name).resolve()
        self.keys = [Ed25519PrivateKey.from_private_bytes(bytes([n])*32) for n in (17,29,37)]
        self.actors = [public(key) for key in self.keys]
        self.access = {'version':signer.ACCESS_VERSION,'origin':signer.ORIGIN,
            'actor':self.actors[0],'private_seed':'11'*32,'token':'43'*32,
            'client_nonce':'65'*32,'challenge':None,'signature':None,'grant':None}
        self.access_path,self.bundle_path,self.payload_path,self.output = [self.root/name
            for name in ('access.json','bundle.json','payload.json','approval.json')]
        resource = {'kind':'SERVICE','identifier':'one-page chart','unit':'CHART','scale':0,
            'network':'NONE','metadata':None}
        row = {'id':'deliver','debtor':self.actors[1],'creditor':self.actors[0],
            'resource':resource,'amount':'1','mechanism':{'identifier':'MANUAL',
                'adapter':None,'request_hash':None},'evidence_policy':{
                'mode':'RECIPIENT_ACCEPTANCE','verifier':None,
                'finality':'RECIPIENT_SIGNED_ACCEPTANCE','minimum_confirmations':0},
            'depends_on':[],'due_at':1793449999}
        body = {'profile':signer.PROFILE,'parties':self.actors[:2],'legs':[row],
            'nonce':'a'*64,'context':{'description':'One chart, correction included'},'previous':None}
        self.bundle = {'id':signer.digest(signer.TERMS,body),'body':body,'assents':[],'events':[]}
        self.payload = self.assent_payload()
        self.write_all()

    def write(self,path,value):
        path.write_bytes(signer.canonical(value)+b'\n')
        path.chmod(0o600)

    def write_all(self):
        for path,value in ((self.access_path,self.access),(self.bundle_path,self.bundle),
                (self.payload_path,self.payload)):
            self.write(path,value)

    def assent_payload(self):
        return {'label':signer.ASSENT,'body':{'profile':signer.PROFILE,'trade':self.bundle['id']},
            'required_parties':self.bundle['body']['parties'],'direct_signatures_only':True}

    def bound(self):
        self.bundle['assents'] = [{'signer':public(key),'signature':sign(key,signer.ASSENT,
            {'profile':signer.PROFILE,'trade':self.bundle['id']})} for key in self.keys[:2]]

    def event(self,kind,actor,data,at=100):
        events = self.bundle['events']
        row = self.bundle['body']['legs'][0]
        body = {'profile':signer.PROFILE,'trade':self.bundle['id'],
            'previous':signer.digest(signer.EVENT,events[-1]) if events else self.bundle['id'],
            'sequence':len(events)+1,'leg':row['id'],
            'leg_ref':signer.digest(signer.LEG,{'trade':self.bundle['id'],'leg':row}),
            'kind':kind,'actor':actor,'data':data,'at':at}
        return {'label':signer.EVENT,'body':body,'signer':actor}

    def append(self,payload):
        key = self.keys[self.actors.index(payload['signer'])]
        record = {'body':payload['body'],'signer':payload['signer'],
            'signature':sign(key,signer.EVENT,payload['body'])}
        self.bundle['events'].append(record)
        return signer.digest(signer.EVENT,record)

    def phrase(self,mode):
        action = signer.payload_value(self.payload,mode)
        return 'APPROVE '+signer.digest('AAP-OWNER-LOCAL-REVIEW-0.1',
            {'mode':mode,'bundle':self.bundle,'action':action,'actor':self.access['actor'],'package':None})[:12]+'\n'

    def approve(self,mode='assent',stdin=None,stdout=None,**kwargs):
        self.write_all()
        stdout = Terminal() if stdout is None else stdout
        signer.run(self.access_path,self.bundle_path,self.payload_path,self.output,
            mode=mode,expected_trade=self.bundle['id'],
            stdin=Terminal(self.phrase(mode)) if stdin is None else stdin,stdout=stdout,**kwargs)
        return stdout.getvalue(),json.loads(self.output.read_bytes())

    def test_full_terms_review_exact_assent_private_output_no_network_or_secret(self):
        with patch('socket.socket',side_effect=AssertionError('network forbidden')):
            shown,record = self.approve()
        self.keys[0].public_key().verify(bytes.fromhex(record['signature']),
            signer.message(signer.ASSENT,self.payload['body']))
        self.assertEqual(set(record),{'signer','signature'})
        self.assertEqual(self.output.stat().st_mode & 0o777,0o600)
        self.assertIn(json.dumps(self.bundle,sort_keys=True,indent=2),shown)
        self.assertIn('One chart, correction included',shown)
        for secret in (self.access['private_seed'],self.access['token']):
            self.assertNotIn(secret,shown+self.output.read_text())

    def test_cli_real_terminal_with_optional_crypto_only_interpreter(self):
        import pty
        import select
        import time
        interpreter = os.environ.get('AAP_CRYPTO_ONLY_PYTHON',sys.executable)
        master,slave = pty.openpty()
        process = subprocess.Popen([interpreter,'-I',str(CLIENT),'--access',str(self.access_path),
            '--bundle',str(self.bundle_path),'--payload',str(self.payload_path),
            '--expected-trade',self.bundle['id'],'--mode','assent','--output',str(self.output)],
            stdin=slave,stdout=slave,stderr=slave,close_fds=True)
        os.close(slave)
        self.addCleanup(lambda:process.kill() if process.poll() is None else None)
        data = bytearray()
        sent = False
        deadline = time.monotonic()+20
        try:
            while time.monotonic()<deadline:
                readable,_,_ = select.select([master],[],[],.1)
                if readable:
                    try:
                        part = os.read(master,8192)
                    except OSError:
                        break
                    if not part:
                        break
                    data.extend(part)
                    if not sent and b'To approve, type exactly: ' in data:
                        os.write(master,self.phrase('assent').encode('ascii'))
                        sent = True
                if process.poll() is not None:
                    break
            self.assertEqual(process.wait(timeout=2),0,data.decode('ascii','replace'))
        finally:
            os.close(master)
        self.assertTrue(sent)
        record = json.loads(self.output.read_bytes())
        signer.verify(self.actors[0],signer.ASSENT,self.payload['body'],record['signature'])
        self.assertNotIn(self.access['private_seed'].encode(),data)
        self.assertNotIn(self.access['token'].encode(),data)

    def test_changed_terms_expected_id_and_payload_domain_refuse(self):
        changed = deepcopy(self.bundle)
        changed['body']['legs'][0]['amount'] = '2'
        for bundle,expected,payload in ((changed,self.bundle['id'],self.payload),
                (self.bundle,'b'*64,self.payload),
                (self.bundle,self.bundle['id'],{**self.payload,'label':'PAY-ANYTHING'})):
            with self.subTest(expected=expected),self.assertRaises(signer.Refused):
                signer.checked_action('assent',bundle,expected,self.actors[0],payload)
        with self.assertRaises(signer.Refused):
            signer.checked_action('assent',self.bundle,self.bundle['id'],self.actors[2],self.payload)

    def test_tampered_assent_foreign_party_and_duplicate_refuse(self):
        self.bound()
        for change in (lambda b:b['assents'][0].update(signature='00'*64),
                lambda b:b['assents'][0].update(signer=self.actors[2]),
                lambda b:b['assents'].__setitem__(1,deepcopy(b['assents'][0]))):
            value = deepcopy(self.bundle)
            change(value)
            with self.assertRaises(signer.Refused):
                signer.checked_bundle(value,value['id'])
        with self.assertRaisesRegex(signer.Refused,'OWNER_ALREADY_APPROVED'):
            signer.checked_action('assent',self.bundle,self.bundle['id'],self.actors[0],self.payload)

    def test_delivery_claim_acceptance_dispute_and_unanimous_resolution_history(self):
        self.bound()
        claim = self.append(self.event('CLAIM',self.actors[1],{'evidence':'a1'*32}))
        self.payload = self.event('ACCEPT',self.actors[0],{'claim':claim},101)
        shown,record = self.approve('event')
        self.assertEqual(record['body'],self.payload['body'])
        signer.verify(record['signer'],signer.EVENT,record['body'],record['signature'])
        self.bundle['events'].append(record)
        dispute = self.append(self.event('DISPUTE',self.actors[0],
            {'reason':'Axis label needs correction','evidence':'2'*64},102))
        for actor in self.actors[:2]:
            self.append(self.event('RESOLVE',actor,{'dispute':dispute,
                'resolution':'Corrected chart accepted'},103))
        state = signer.checked_bundle(self.bundle,self.bundle['id'])
        self.assertTrue(state['disputes'][dispute]['resolved'])
        self.assertIn('does not appoint a court',shown)

    def test_event_requires_exact_head_sequence_claim_role_and_all_assents(self):
        self.bound()
        claim = self.append(self.event('CLAIM',self.actors[1],{'evidence':'a1'*32}))
        payload = self.event('ACCEPT',self.actors[0],{'claim':claim},101)
        changes = [lambda p:p['body'].update(previous='3'*64),
            lambda p:p['body'].update(sequence=True),lambda p:p['body'].update(at=99),
            lambda p:p['body'].update(leg_ref='4'*64),
            lambda p:p['body']['data'].update(claim='5'*64),
            lambda p:p.update(signer=self.actors[1])]
        for change in changes:
            value = deepcopy(payload)
            change(value)
            with self.assertRaises(signer.Refused):
                signer.checked_action('event',self.bundle,self.bundle['id'],self.actors[0],value)
        incomplete = deepcopy(self.bundle)
        incomplete['assents'].pop()
        with self.assertRaises(signer.Refused):
            signer.checked_bundle(incomplete,incomplete['id'])
        invalid = deepcopy(self.bundle)
        invalid['events'][0]['signature'] = '00'*64
        with self.assertRaises(signer.Refused):
            signer.checked_bundle(invalid,invalid['id'])

    def test_dependency_cycle_unknown_unused_party_and_boolean_scale_refuse(self):
        for change in (lambda b:b['legs'][0]['depends_on'].append('missing'),
                lambda b:b['legs'][0]['depends_on'].append('deliver'),
                lambda b:b['parties'].append(self.actors[2]),
                lambda b:b['legs'][0]['resource'].update(scale=True)):
            value = deepcopy(self.bundle)
            change(value['body'])
            value['id'] = signer.digest(signer.TERMS,value['body'])
            with self.assertRaises(signer.Refused):
                signer.checked_bundle(value,value['id'])

    def usdc(self):
        row = self.bundle['body']['legs'][0]
        network = 'eip155:8453'
        row['resource'] = {'kind':'CRYPTO','identifier':network+'/erc20:'+signer.TOKENS[network],
            'unit':'USDC_MICRO','scale':6,'network':network,'metadata':None}
        row['amount'] = '25000000'
        self.bundle['id'] = signer.digest(signer.TERMS,self.bundle['body'])
        return row

    def wallet(self,kind='destination'):
        row = self.usdc()
        address = '0x'+'2a'*20
        actor = row['creditor'] if kind == 'destination' else row['debtor']
        body = {'profile':signer.USDC,'source_trade':self.bundle['id'],
            'source_leg':signer.digest(signer.USDC+'-source-leg',row),
            'network':'eip155:8453','token':signer.TOKENS['eip155:8453'],
            'creditor' if kind=='destination' else 'debtor':actor}
        if kind == 'destination':
            body['recipient'] = address
        else:
            body.update(sender=address,purpose='PAYER_SENDER_WALLET_INSTRUCTION')
        self.payload = {'label':'AAP-HOSTED-USDC-'+kind.upper()+'-0.1',
            'body':body,'signer':actor,'execution_authorized':False}
        return address

    def test_seller_destination_and_payer_sender_exact_wallet_instruction(self):
        for kind in ('destination','sender'):
            with self.subTest(kind=kind):
                self.setUp()
                address = self.wallet(kind)
                if kind == 'sender':
                    self.access.update(actor=self.actors[1],private_seed='1d'*32)
                shown,record = self.approve('wallet',kind=kind,leg='deliver',address=address)
                signer.verify(record['signer'],self.payload['label'],self.payload['body'],record['signature'])
                self.assertIn('does not approve the agreement',shown)
                self.assertEqual(self.bundle['assents'],[])

    def test_wallet_changed_source_resource_network_amount_address_and_purpose_refuse(self):
        address = self.wallet()
        for change in (lambda p:p['body'].update(source_trade='f'*64),
                lambda p:p['body'].update(source_leg='e'*64),
                lambda p:p['body'].update(network='eip155:1'),
                lambda p:p['body'].update(recipient='0x'+'3b'*20),
                lambda p:p.update(execution_authorized=True),
                lambda p:p['body'].update(purpose='SEND_MONEY')):
            value = deepcopy(self.payload)
            change(value)
            with self.assertRaises(signer.Refused):
                signer.checked_action('wallet',self.bundle,self.bundle['id'],self.actors[0],value,
                    leg='deliver',kind='destination',address=address)
        changed = deepcopy(self.bundle)
        changed['body']['legs'][0]['amount'] = '26000000'
        changed['id'] = signer.digest(signer.TERMS,changed['body'])
        with self.assertRaises(signer.Refused):
            signer.checked_action('wallet',changed,changed['id'],self.actors[0],self.payload,
                leg='deliver',kind='destination',address=address)

    def test_market_request_attachments_required_and_dispatch_label_never_signed(self):
        value = deepcopy(self.bundle)
        value['body']['context'] = {'version':'urn:aap:hosted-account-market:0.1',
            'all_attachments_required_before_assent':True,'plan':'b'*64}
        value['id'] = signer.digest(signer.TERMS,value['body'])
        payload = {'label':signer.ASSENT,'body':{'profile':signer.PROFILE,'trade':value['id']},
            'required_parties':value['body']['parties'],'direct_signatures_only':True}
        with self.assertRaisesRegex(signer.Refused,'COMPLETE_MARKET_PACKAGE_REQUIRED'):
            signer.checked_action('assent',value,value['id'],self.actors[0],payload)
        with self.assertRaises(signer.Refused):
            signer.checked_action('assent',self.bundle,self.bundle['id'],self.actors[0],
                {**self.payload,'label':'AAP-RECIPROCAL-TRADE-DISPATCH-0.1'})

    def test_opaque_execution_cannot_bypass_full_review_by_changing_context(self):
        for context in (None, {'description':'ordinary trade'}, {'version':'renamed-market'},
                        {'all_attachments_required_before_assent':False}):
            for mechanism,policy in (({'identifier':'automatic-payment','adapter':'7'*64,
                    'request_hash':'8'*64}, self.bundle['body']['legs'][0]['evidence_policy']),
                    (self.bundle['body']['legs'][0]['mechanism'], {'mode':'OWNER_VERIFIER',
                    'verifier':'9'*64,'finality':'OPAQUE_PROVIDER','minimum_confirmations':1})):
                value = deepcopy(self.bundle)
                value['body']['context'] = context
                value['body']['legs'][0]['mechanism'] = deepcopy(mechanism)
                value['body']['legs'][0]['evidence_policy'] = deepcopy(policy)
                value['id'] = signer.digest(signer.TERMS,value['body'])
                payload = {'label':signer.ASSENT,'body':{'profile':signer.PROFILE,'trade':value['id']},
                    'required_parties':value['body']['parties'],'direct_signatures_only':True}
                with self.subTest(context=context,mechanism=mechanism),self.assertRaisesRegex(
                        signer.Refused,'COMPLETE_MARKET_PACKAGE_REQUIRED'):
                    signer.checked_action('assent',value,value['id'],self.actors[0],payload)

    def test_nested_execution_fields_refuse_but_manual_arbitrary_units_and_command_text_remain_terms(self):
        changed = deepcopy(self.bundle)
        changed['body']['legs'][0]['mechanism']['hidden'] = {'adapter':'7'*64,'request_hash':'8'*64}
        changed['id'] = signer.digest(signer.TERMS,changed['body'])
        with self.assertRaises(signer.Refused):
            signer.checked_bundle(changed,changed['id'])
        for unit in ('BTC','SOL','CARD','BARTER'):
            value = deepcopy(self.bundle)
            value['body']['legs'][0]['resource']['unit'] = unit
            value['body']['context'] = {'description':'Literal terms: $(touch /tmp/NEVER_RUN) ; rm -rf fake'}
            value['id'] = signer.digest(signer.TERMS,value['body'])
            payload = {'label':signer.ASSENT,'body':{'profile':signer.PROFILE,'trade':value['id']},
                'required_parties':value['body']['parties'],'direct_signatures_only':True}
            signer.checked_action('assent',value,value['id'],self.actors[0],payload)

    def test_wrappers_only_for_exact_operation_and_unmodified_flags(self):
        native = {'version':'urn:aap:hosted-api:0.1','operation':'trade.signing_payload',
            'result':self.payload,'signing_performed':False,'payment_dispatched':False,
            'external_execution':False}
        wrapped = {'version':'urn:aap:hosted-api-http:0.1','ok':True,'result':native}
        signer.checked_action('assent',self.bundle,self.bundle['id'],self.actors[0],wrapped)
        for change in (lambda p:p['result'].update(operation='trade.event_payload'),
                lambda p:p['result'].update(signing_performed=True),lambda p:p.update(ok=1)):
            value = deepcopy(wrapped)
            change(value)
            with self.assertRaises(signer.Refused):
                signer.checked_action('assent',self.bundle,self.bundle['id'],self.actors[0],value)

    def test_private_files_refuse_bad_permissions_symlinks_hardlinks_and_changed_review(self):
        self.access_path.chmod(0o644)
        with self.assertRaises(signer.Refused):
            signer.read_document(self.access_path,32768)
        self.access_path.chmod(0o600)
        target = self.root/'target.json'
        target.symlink_to(self.bundle_path)
        with self.assertRaises(OSError):
            signer.read_document(target,262144)
        target.unlink()
        os.link(self.bundle_path,target)
        with self.assertRaises(signer.Refused):
            signer.read_document(target,262144)
        target.unlink()
        outer = self
        class Changed(Terminal):
            def readline(self,size=-1):
                outer.bundle_path.write_bytes(outer.bundle_path.read_bytes()+b' ')
                return super().readline(size)
        with self.assertRaisesRegex(signer.Refused,'INPUT_CHANGED'):
            self.approve(stdin=Changed(self.phrase('assent')))
        self.assertFalse(self.output.exists())

    def test_non_tty_wrong_confirmation_existing_output_and_no_general_signer(self):
        for stream in (io.StringIO(''),Terminal('yes\n'),Terminal(' '+self.phrase('assent')),
                       Terminal(self.phrase('assent').rstrip('\n')+' \n')):
            with self.assertRaises(signer.Refused):
                self.approve(stdin=stream)
            self.assertFalse(self.output.exists())
        self.output.write_text('KEEP')
        with self.assertRaisesRegex(signer.Refused,'OUTPUT_EXISTS'):
            self.approve()
        self.assertEqual(self.output.read_text(),'KEEP')
        with self.assertRaises(signer.Refused):
            signer.checked_action('payment',self.bundle,self.bundle['id'],self.actors[0],self.payload)
        result = subprocess.run([sys.executable,'-I',str(CLIENT),'--token',self.access['token']],
            capture_output=True,text=True)
        self.assertNotEqual(result.returncode,0)
        self.assertNotIn(self.access['token'],result.stderr+result.stdout)

    def test_secrets_controls_duplicates_floats_and_small_order_keys_refuse(self):
        for raw in (b'{"x":1,"x":2}',b'{"x":1.0}',b'{"x":"\\u001b[2J"}',
                b'{"x":9007199254740992}',b'{"x":"\\u00e9"}'):
            with self.assertRaises(signer.Refused):
                signer.decode(raw)
        for key in ('00'*32,'01'+'00'*31,'ff'*32):
            with self.assertRaises((signer.Refused,ValueError)):
                signer.party(key)
        self.bundle['body']['context']['private'] = self.access['token']
        self.bundle['id'] = signer.digest(signer.TERMS,self.bundle['body'])
        self.payload = self.assent_payload()
        out = Terminal()
        with self.assertRaisesRegex(signer.Refused,'SECRET_IN_REVIEW'):
            self.approve(stdout=out)
        self.assertEqual(out.getvalue(),'')
        self.assertFalse(self.output.exists())


@unittest.skipUnless(os.environ.get('AAP_CORE_TEST_PATH'),'optional reviewed core checkout for interoperability')
class NativeInteroperability(unittest.TestCase):
    def setUp(self):
        self.rig = OwnerTrade()
        self.rig.setUp()
        self.addCleanup(self.rig.doCleanups)
        sys.path.insert(0,os.environ['AAP_CORE_TEST_PATH'])
        from covenant_chain import reciprocal_trade,payment_instructions,hosted_usdc_payments
        self.core,self.instructions,self.usdc_core = reciprocal_trade,payment_instructions,hosted_usdc_payments

    def test_core_accepts_public_owner_assent_and_event_and_rejects_changed_terms(self):
        _,record = self.rig.approve()
        core = self.core.attach_assent(self.rig.bundle,record)
        core = self.core.assent(core,self.rig.keys[1])
        core = self.core.append_event(core,self.rig.keys[1],'CLAIM','deliver',{'evidence':'a1'*32},at=100)
        self.rig.bundle = core
        self.rig.payload = self.core.event_payload(core,self.rig.actors[0],'ACCEPT','deliver',
            {'claim':self.core.event_id(core['events'][-1])},at=101)
        self.rig.output.unlink()
        _,record = self.rig.approve('event')
        result = self.core.attach_event(core,record)
        self.assertEqual(self.core.inspect(result,result['id'])['status'],'COMPLETE')
        changed = deepcopy(result)
        changed['body']['legs'][0]['amount'] = '2'
        with self.assertRaises(ValueError):
            self.core.inspect(changed,result['id'])
        self.assertEqual(signer.checked_bundle(result,result['id'])['head'],
            self.core.inspect(result,result['id'])['head'])

    def test_core_wallet_payloads_accepted_and_signatures_verify(self):
        row = self.rig.usdc()
        for kind in ('destination','sender'):
            actor = row['creditor'] if kind=='destination' else row['debtor']
            key = self.rig.keys[self.rig.actors.index(actor)]
            self.rig.access.update(actor=actor,private_seed=key.private_bytes_raw().hex())
            address = '0x'+'2a'*20
            self.rig.payload = self.instructions.signing_payload(kind,self.rig.bundle,'deliver',address)
            if self.rig.output.exists():
                self.rig.output.unlink()
            _,record = self.rig.approve('wallet',kind=kind,leg='deliver',address=address)
            if kind == 'destination':
                self.assertEqual(self.usdc_core.verify_destination(self.rig.bundle['id'],row,
                    {'body':self.rig.payload['body'],'signature':record['signature']}),address)
            else:
                from covenant_chain import crypto
                self.assertTrue(crypto.verify(actor,self.rig.payload['label'],self.rig.payload['body'],record['signature']))

    def market_package(self,opt=True):
        from covenant_chain import crypto,hosted_api,hosted_usdc_payments as usdc
        from covenant_chain import hosted_payments,payment_instructions,marketplace_launch_economics as launch
        from covenant_language import marketplace
        path = Path(os.environ['AAP_CORE_TEST_PATH'])/'tests'/'test_hosted_account_market.py'
        spec = importlib.util.spec_from_file_location('core_market_fixture_for_public_client',path)
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        f = module.HostedAccountMarketTests()
        f.setUp()
        self.addCleanup(f.doCleanups)
        f.engine.close()
        f.api.close()
        f.api = hosted_api.HostedAPI(f.root/'public-origin-api',signer.ORIGIN,clock=lambda:f.now)
        self.addCleanup(f.api.close)
        for name,actor in (('buyer',f.buyer),('seller',f.seller),('founder',f.founder)):
            f.api.provision(name,actor,hosted_api.ALL_SCOPES,10000,f.tokens[name])
        f.money = marketplace.asset('eip155:8453','USDC','USDC_MICRO')
        f.native = usdc.usdc_resource('eip155:8453')
        adapter = usdc.USDCPaymentAdapter(f.root/'usdc',network='eip155:8453',
            fee_creditor=f.founder,clock=lambda:f.now)
        self.addCleanup(adapter.close)
        f.registry.register(adapter)
        store = payment_instructions.InstructionStore(f.root/'instructions')
        self.addCleanup(store.close)
        facade = hosted_payments.HostedPayments(f.api,store,usdc_adapters={'eip155:8453':adapter})
        source = f.source()
        for kind,who,address,key in (('destination','seller','0x'+'22'*20,f.keys[1]),
                ('sender','buyer','0x'+'11'*20,f.keys[0])):
            payload = payment_instructions.signing_payload(kind,source['bundle'],'give-0',address)
            facade.dispatch(f.api.authenticate(f.tokens[who]),'payment.register_instruction',
                {'kind':kind,'source_bundle':source['bundle'],'leg':'give-0','address':address,
                    'signature':crypto.sign(key,payload['label'],payload['body'])},'register-'+kind)
        posted = launch.posted_policy(beneficiary=f.founder,starts_at=1000,resources=[{
            'asset':f.money,'resource':f.native,'rail':adapter.adapter,'destination':{
                'network':'eip155:8453','account':usdc.FEE_RECIPIENT,'asset_locator':usdc.TOKENS['eip155:8453']}}],
            allocations=[{'account':f.founder,'bps':10000,'purpose':'FOUNDER'}],nonce='c'*64)
        approved = {'signer':f.founder,'signature':crypto.sign(f.keys[2],
            posted['signing_payload']['label'],posted['signing_payload']['body'])}
        economics = launch.LaunchEconomics(posted,approved,clock=lambda:f.now,
            sign=lambda label,body:crypto.sign(f.keys[2],label,body))
        f.engine = f.open_engine(economics=economics,route_for=None,routes_for=facade.routes_for,
            verifiers={adapter.verifier_id:adapter.verifier})
        package = f.call('market.prepare',{'source_packet':source,
            'expected_source_trade':source['bundle']['id'],'nonce':'b'*64,'maximum_fee':100,
            'fee_opt_in':opt})
        return f,package

    def approve_market(self,f,package,bundle,who):
        key = f.keys[0 if who=='buyer' else 1]
        access = {**self.rig.access,'actor':public(key),'private_seed':key.private_bytes_raw().hex()}
        payload = package['signing_payload']
        for path,value in ((self.rig.access_path,access),(self.rig.bundle_path,bundle),
                (self.rig.payload_path,payload)):
            self.rig.write(path,value)
        package_path = self.rig.root/'package.json'
        self.rig.write(package_path,package)
        output = self.rig.root/(who+'-approval.json')
        approval_hash = signer.digest('AAP-OWNER-LOCAL-REVIEW-0.1',{'mode':'assent','bundle':bundle,
            'action':payload,'actor':access['actor'],'package':package})
        terminal = Terminal()
        signer.run(self.rig.access_path,self.rig.bundle_path,self.rig.payload_path,output,
            mode='assent',expected_trade=bundle['id'],package_path=package_path,
            stdin=Terminal('APPROVE '+approval_hash[:12]+'\n'),stdout=terminal)
        return json.loads(output.read_bytes()),terminal.getvalue()

    def test_actual_complete_market_package_buyer_seller_approve_and_core_receives(self):
        f,package = self.market_package()
        checked = signer.checked_package(package,package['bundle'])
        self.assertEqual(checked['fee_amount'],13)
        bundle = package['bundle']
        for who in ('buyer','seller'):
            record,shown = self.approve_market(f,package,bundle,who)
            bundle = self.core.attach_assent(bundle,record)
            self.assertIn('Complete source, fee terms and payment request attachments',shown)
            self.assertIn('OWNER_CONFIGURED_RPC_FINALIZED_CANONICAL_BLOCK',shown)
            self.assertIn('OPTIONAL_OPT_IN',shown)
        for who in ('buyer','seller'):
            result = f.receive(package,bundle,who=who,key='public-approval-'+who)
            self.assertEqual(result['review']['missing_assents'],[])
        self.assertEqual(f.provider.calls,0)
        self.assertEqual(f.engine.adapters.get(next(iter(package['plan_body']['routes'].values()))['adapter'])
            .db.execute('SELECT count(*) FROM usdc_effects').fetchone(),(0,))

    def test_actual_market_buyer_and_supplier_use_crypto_only_cli_from_full_private_files(self):
        import pty
        import select
        import time
        f,package = self.market_package()
        bundle = package['bundle']
        interpreter = os.environ.get('AAP_CRYPTO_ONLY_PYTHON',sys.executable)
        for who,index in (('buyer',0),('seller',1)):
            key = f.keys[index]
            access = {**self.rig.access,'actor':public(key),'private_seed':key.private_bytes_raw().hex()}
            package_path = self.rig.root/'full-market-package.json'
            output = self.rig.root/(who+'-isolated-approval.json')
            for path,value in ((self.rig.access_path,access),(self.rig.bundle_path,bundle),
                    (self.rig.payload_path,package['signing_payload']),(package_path,package)):
                self.rig.write(path,value)
            phrase = 'APPROVE '+signer.digest('AAP-OWNER-LOCAL-REVIEW-0.1',{'mode':'assent',
                'bundle':bundle,'action':package['signing_payload'],'actor':access['actor'],'package':package})[:12]
            master,slave = pty.openpty()
            process = subprocess.Popen([interpreter,'-I',str(CLIENT),'--access',str(self.rig.access_path),
                '--bundle',str(self.rig.bundle_path),'--payload',str(self.rig.payload_path),
                '--package',str(package_path),'--expected-trade',bundle['id'],
                '--mode','assent','--output',str(output)],stdin=slave,stdout=slave,stderr=slave)
            os.close(slave)
            shown,sent,deadline = bytearray(),False,time.monotonic()+15
            try:
                while time.monotonic()<deadline:
                    if select.select([master],[],[],.1)[0]:
                        try:
                            part = os.read(master,8192)
                        except OSError:
                            break
                        if not part:
                            break
                        shown.extend(part)
                        if not sent and b'To approve, type exactly: ' in shown:
                            self.assertIn(b'Complete source, fee terms and payment request attachments',shown)
                            self.assertIn(b'OPTIONAL_OPT_IN',shown)
                            os.write(master,(phrase+'\n').encode('ascii'))
                            sent = True
                    if process.poll() is not None:
                        break
                self.assertEqual(process.wait(timeout=2),0,shown.decode('ascii','replace'))
            finally:
                if process.poll() is None:
                    process.kill()
                    process.wait()
                os.close(master)
            self.assertTrue(sent)
            self.assertNotIn(access['private_seed'].encode('ascii'),shown)
            self.assertNotIn(access['token'].encode('ascii'),shown)
            bundle = self.core.attach_assent(bundle,json.loads(output.read_bytes()))
        self.assertEqual(self.core.inspect(bundle,bundle['id'])['missing_assents'],[])
        self.assertEqual(f.provider.calls,0)

    def test_actual_market_package_request_fee_source_plan_and_hidden_attachment_tamper_refuse(self):
        f,package = self.market_package()
        mutations = [lambda p:p['requests']['give-0'].update(amount='9999'),
            lambda p:p['requests']['give-0'].update(recipient=signer.FEE_ADDRESS),
            lambda p:p['economics']['quote']['body']['fee'].update(amount=99),
            lambda p:p['economics']['disclosure']['body'].update(mode='OPTIONAL_WAIVED'),
            lambda p:p['plan_body'].update(maximum_fee=9999),
            lambda p:p['source_packet']['selection']['body']['order']['data']['terms']
                .update(extra='unreviewed change'),
            lambda p:p.update(hidden_attachment={'instruction':'pay me'}),
            lambda p:p['plan_body']['routes']['give-0'].update(finality='instant'),
            lambda p:p['source_packet']['bundle']['body']['legs'][0].update(amount='9000')]
        for mutate in mutations:
            value = deepcopy(package)
            mutate(value)
            with self.subTest(case=mutations.index(mutate)),self.assertRaises(signer.Refused):
                signer.checked_action('assent',package['bundle'],package['bundle']['id'],f.buyer,
                    package['signing_payload'],package=value)
        for profile in ('urn:aap:hosted-bitcoin-payment:0.1','urn:aap:hosted-solana-payment:0.1',
                        'urn:aap:hosted-card-payment:0.1','LEGAL','PAYMENT_INTENT'):
            value = deepcopy(package)
            value['requests']['give-0']['profile'] = profile
            with self.subTest(profile=profile),self.assertRaises(signer.Refused):
                signer.checked_action('assent',package['bundle'],package['bundle']['id'],f.buyer,
                    package['signing_payload'],package=value)

    def test_actual_market_optional_waiver_has_no_hidden_fee_leg(self):
        f,package = self.market_package(opt=False)
        self.assertEqual(signer.checked_package(package,package['bundle'])['fee_amount'],0)
        self.assertNotIn('marketplace-fee',[row['id'] for row in package['bundle']['body']['legs']])

    def test_market_source_cannot_hide_an_unattached_execution_request(self):
        f,package = self.market_package()
        packet = deepcopy(package['source_packet'])
        body = packet['bundle']['body']
        for row in body['legs']:
            if row['resource']['kind'] == 'SERVICE':
                row['mechanism'] = {'identifier':'opaque-service','adapter':'7'*64,'request_hash':'8'*64}
                for binding in packet['bindings']:
                    if binding['id'] == row['id']:
                        binding['mechanism'] = deepcopy(row['mechanism'])
        body['context']['resource_bindings'] = deepcopy(packet['bindings'])
        packet['bundle']['id'] = signer.digest(signer.TERMS,body)
        packet['signing_payload']['body']['trade'] = packet['bundle']['id']
        with self.assertRaisesRegex(signer.Refused,'SOURCE_EXECUTION_ATTACHMENTS_UNSUPPORTED'):
            signer.checked_source(packet)


if __name__ == '__main__':
    unittest.main()
