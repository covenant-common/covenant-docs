#!/usr/bin/env python3
"""Create/resume a Covenant trial. Keeps signing key and access token in local 0600 files.
Requires Python3.10+ and cryptography. No core package required. Does not sign deals or pay.
"""
import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import secrets
import stat
import tempfile
import time
import urllib.error
import urllib.request
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey
from cryptography.hazmat.primitives import serialization

ORIGIN='https://jupie202020.pythonanywhere.com'
LABEL='AAP-HOSTED-TRIAL-POSSESSION-0.1'
VERSION='aap-private-trial-client/0.1'
SCOPES=['listings:read','listings:write','trades:read','trades:write']
HEX64=re.compile(r'[0-9a-f]{64}\Z')
ACCESS_FIELDS={'version','origin','actor','private_seed','token','client_nonce','challenge','signature','grant'}

def canonical(value):
    return json.dumps(value,sort_keys=True,separators=(',',':'),ensure_ascii=True,allow_nan=False).encode('ascii')

class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self,*_):
        raise ValueError('Service redirected the request; credentials were not forwarded.')

def call(path,value):
    request=urllib.request.Request(ORIGIN+path,canonical(value),{'Content-Type':'application/json'},method='POST')
    try:
        with urllib.request.build_opener(NoRedirect).open(request,timeout=30) as response:
            raw=response.read(65537)
            if response.status!=200 or len(raw)>65536:raise ValueError('The service returned an unexpected response.')
            result=json.loads(raw)
    except urllib.error.HTTPError as error:
        # An error status never becomes a successful account, even if its body says ok.
        error.close()
        raise ValueError('Trial setup was refused. Keep the original access file.') from None
    if type(result) is not dict or result.get('ok') is not True or type(result.get('result')) is not dict:
        raise ValueError('Trial setup was refused. Keep the original access file.')
    return result['result']

def save(path,value):
    fd,name=tempfile.mkstemp(prefix='.aap-',dir=path.parent)
    try:
        os.fchmod(fd,0o600)
        with os.fdopen(fd,'wb') as out: out.write(canonical(value)+b'\n');out.flush();os.fsync(out.fileno())
        os.replace(name,path)
    finally:
        if os.path.exists(name):os.unlink(name)

def checked_body(access,envelope):
    expected_fields={'version','domain','origin','service','actor','token_sha256','client_nonce','challenge','issued_at','challenge_expires','trial_expires','scopes'}
    digest=hashlib.sha256(b'AAP-HOSTED-API-TOKEN-0.1\0'+access['token'].encode('ascii')).hexdigest()
    if type(envelope) is not dict or set(envelope)!={'body','mac'} or type(envelope['body']) is not dict:raise ValueError('Incomplete setup request.')
    body=envelope['body']
    if set(body)!=expected_fields or body['version']!='urn:aap:hosted-trial-access:0.1' or body['domain']!='AAP_SELF_SERVE_TRIAL_ACCESS' or body['origin']!=ORIGIN or body['actor']!=access['actor'] or body['token_sha256']!=digest or body['client_nonce']!=access['client_nonce'] or body['scopes']!=SCOPES:raise ValueError('Trial request does not match this identity or access file.')
    if not all(type(value) is str and HEX64.fullmatch(value) for value in (envelope['mac'],body['service'],body['challenge'])):raise ValueError('Incomplete setup request.')
    if not all(type(body[k]) is int and 0<=body[k]<=2**53-1 for k in ('issued_at','challenge_expires','trial_expires')) or not (body['issued_at']<body['challenge_expires']<=body['issued_at']+600 and body['issued_at']<body['trial_expires']<=body['issued_at']+14*86400):raise ValueError('Invalid setup dates.')
    return body

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output',required=True,type=Path,help='New private directory, or existing one with --resume')
    parser.add_argument('--resume',action='store_true',help='Repeat only the original retained setup request')
    args=parser.parse_args();home=args.output.expanduser().absolute()
    if args.resume:
        info=home.stat(follow_symlinks=False)
        if not stat.S_ISDIR(info.st_mode) or stat.S_IMODE(info.st_mode)&0o077:raise ValueError('Access directory must be private (0700).')
        path=home/'access.json';info=path.stat(follow_symlinks=False)
        if not stat.S_ISREG(info.st_mode) or stat.S_IMODE(info.st_mode)&0o077 or info.st_size>32768:raise ValueError('Use a private regular access file (0600).')
        access=json.loads(path.read_text())
        if type(access) is not dict or set(access)!=ACCESS_FIELDS or access.get('version')!=VERSION or access.get('origin')!=ORIGIN:raise ValueError('Wrong service access file.')
        if not all(type(access.get(k)) is str and HEX64.fullmatch(access[k]) for k in ('actor','private_seed','token','client_nonce')):raise ValueError('Incomplete access file.')
        if (access['challenge'] is None)!=(access['signature'] is None):raise ValueError('Incomplete setup request.')
        if access['signature'] is not None and (type(access['signature']) is not str or re.fullmatch(r'[0-9a-f]{128}',access['signature']) is None):raise ValueError('Incomplete setup signature.')
        key=Ed25519PrivateKey.from_private_bytes(bytes.fromhex(access['private_seed']))
        if key.public_key().public_bytes(serialization.Encoding.Raw,serialization.PublicFormat.Raw).hex()!=access['actor']:raise ValueError('Signing identity mismatch.')
    else:
        home.mkdir(mode=0o700,parents=False,exist_ok=False);path=home/'access.json'
        key=Ed25519PrivateKey.generate()
        access={'version':VERSION,'origin':ORIGIN,'actor':key.public_key().public_bytes(serialization.Encoding.Raw,serialization.PublicFormat.Raw).hex(),
            'private_seed':key.private_bytes(serialization.Encoding.Raw,serialization.PrivateFormat.Raw,serialization.NoEncryption()).hex(),
            'token':secrets.token_hex(32),'client_nonce':secrets.token_hex(32),'challenge':None,'signature':None,'grant':None}
        save(path,access)  # retained before any request; failures do not lose the identity/token
    digest=hashlib.sha256(b'AAP-HOSTED-API-TOKEN-0.1\0'+access['token'].encode('ascii')).hexdigest()
    if access['challenge'] is None:
        result=call('/trial/challenge',{'actor':access['actor'],'token_sha256':digest,'client_nonce':access['client_nonce']})
        envelope=result['challenge'];body=checked_body(access,envelope);payload=result['signing_payload'];now=int(time.time())
        if not (abs(now-body['issued_at'])<=300 and now<body['challenge_expires']):raise ValueError('Expired setup dates.')
        message=LABEL.encode('ascii')+b'\0'+canonical(body)
        if payload['label']!=LABEL or payload['body']!=body or payload['message_hex']!=message.hex():raise ValueError('Signing bytes changed; nothing was signed.')
        access.update(challenge=envelope,signature=key.sign(message).hex());save(path,access)
    else:
        # An interrupted issuance can recover after challenge expiry. Reuse and
        # verify its original signed bytes; never generate a fresh approval.
        body=checked_body(access,access['challenge'])
        key.public_key().verify(bytes.fromhex(access['signature']),LABEL.encode('ascii')+b'\0'+canonical(body))
    result=call('/trial/start',{'challenge':access['challenge'],'signature':access['signature'],'token':access['token']})
    if result.get('version')!='urn:aap:hosted-trial-access:0.1' or type(result.get('tenant')) is not str or re.fullmatch(r'trial-[0-9a-f]{32}',result['tenant']) is None or result.get('actor')!=access['actor'] or result.get('token_id')!=digest or type(result.get('expires')) is not int or result.get('expires')!=access['challenge']['body']['trial_expires'] or result.get('scopes')!=SCOPES or result.get('status')!='ACTIVE' or result.get('token_returned') is not False or result.get('signing_authority_granted') is not False:raise ValueError('Account response does not match this request.')
    access['grant']=result;save(path,access)
    config={'mcpServers':{'covenant-account':{'url':ORIGIN+'/mcp/account/v1','headers':{'Authorization':'Bearer '+access['token']}}}}
    save(home/'mcp.json',config)
    print(json.dumps({'status':'ACTIVE','tenant':result['tenant'],'actor':access['actor'],'expires':result['expires'],'access_file':str(path),'mcp_config':str(home/'mcp.json'),'private_keys_or_tokens_printed':False},indent=2))

if __name__=='__main__':
    try:main()
    except Exception as error:
        # Remote text is never a local instruction; raw credentials are not diagnostic output.
        print(json.dumps({'status':'SETUP_INCOMPLETE','next':'Keep the access file. Inspect the service status, then use --resume with the same directory. No new key or token is needed.','type':type(error).__name__}))
        raise SystemExit(1)
