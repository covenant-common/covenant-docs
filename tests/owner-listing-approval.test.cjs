'use strict';
// Synthetic only: no real credentials, browser, network, publication or payment.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {spawnSync} = require('node:child_process');
const {webcrypto,createHash} = require('node:crypto');
const clientPath = path.join(__dirname,'../assets/owner-listing-approval.js');
const client = require(clientPath);
const NOW = 1793440000;
const baseline = process.env.COVENANT_LISTING_CLI || path.join(__dirname,'../clients/approve_listing.py');
const python = process.env.COVENANT_TEST_PYTHON || 'python3';
const referenceScript = `
import importlib.util,json,sys
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey
from cryptography.hazmat.primitives.serialization import Encoding,PublicFormat
spec=importlib.util.spec_from_file_location('reference',sys.argv[1]); ref=importlib.util.module_from_spec(spec); spec.loader.exec_module(ref)
key=Ed25519PrivateKey.from_private_bytes(bytes.fromhex('21'*32)); actor=key.public_key().public_bytes(Encoding.Raw,PublicFormat.Raw).hex()
access={'version':ref.ACCESS_VERSION,'origin':ref.ORIGIN,'actor':actor,'private_seed':'21'*32,'token':'43'*32,'client_nonce':'65'*32,'challenge':None,'signature':None,'grant':{'status':'ACTIVE'}}
source={'type':'marketplace-listing','id':'a'*64}
import hashlib
item=hashlib.sha256(ref.ITEM_LABEL.encode()+b'\\0'+ref.canonical({'origin':ref.ORIGIN,'kind':'marketplace','source':source})).hexdigest()
fields={'title':'Synthetic fixture only','record_kind':'LISTING','custom':{'10':'ten','2':'two','text':'quotes: " slash: \\\\ angle: <tag>','n':9007199254740991,'negative':-9007199254740991,'flag':True},'want':[]}
body={'version':ref.PROFILE,'origin':ref.ORIGIN,'id':item,'kind':'marketplace','source':source,'principals':[actor],'sequence':1,'previous':None,'visibility':'INDEXED','fields':fields,'links':[],'expires':${NOW}+3600}
preview={'id':item,'body':body,'required_signers':[actor],'signing_label':ref.LABEL,'url':ref.ORIGIN+'/marketplace/'+item,'available_fields':sorted(fields),'preview':{'public_fields':fields,'public_metadata':['origin','source hash/type','signing identities','revision','visibility','expiry','explicit links','consent signatures'],'indexable':True,'private_source_exported':False,'boundary':'Synthetic fixture only.'},'execution_authorized':False,'published':False}
checked,message=ref.checked_listing(preview,actor,${NOW})
print(json.dumps({'access':access,'preview':preview,'wire':ref.canonical(checked).decode(),'message_hex':message.hex(),'signature':key.sign(message).hex(),'body_hash':hashlib.sha256(message).hexdigest()}))
`;
const referenceResult = spawnSync(python,['-c',referenceScript,baseline],{encoding:'utf8'});
assert.equal(referenceResult.status,0,'Python cryptography reference fixture failed: '+referenceResult.stderr);
const reference = JSON.parse(referenceResult.stdout);
const clone = value => JSON.parse(JSON.stringify(value));
const raw = value => new TextEncoder().encode(JSON.stringify(value));
const accessRaw = () => raw(reference.access);
const previewRaw = preview => raw(preview || reference.preview);
const checked = preview => client.checkedListing(preview,reference.access.actor,NOW,webcrypto);
const mutate = change => { const value=clone(reference.preview);change(value);return value; };
const fresh = () => client.createSession(webcrypto,()=>NOW);
async function prepared(session=fresh(),preview=reference.preview) { const review=await session.prepare(accessRaw(),previewRaw(preview));return {session,review}; }
const approve = (session,review,more={}) => session.approve({reviewed:true,displayedBody:review.bodyText,accessRaw:accessRaw(),previewRaw:previewRaw(),...more});
const advertFixture = JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures/advert-draft-v01.json'),'utf8'));
function proxyCrypto(overrides={}) {
  return {subtle:Object.fromEntries(['digest','importKey','exportKey','sign','verify'].map(name=>[name,overrides[name]||webcrypto.subtle[name].bind(webcrypto.subtle)]))};
}

test('Python CLI and Node WebCrypto produce identical canonical bytes, commitment, hash and Ed25519 signature',async()=>{
  const {session,review}=await prepared();
  assert.equal(review.bodyText,reference.wire);assert.equal(review.bodyHash,reference.body_hash);
  const result=await approve(session,review);
  assert.deepEqual(Object.keys(result).sort(),['signature','signer']);assert.equal(result.signer,reference.access.actor);assert.equal(result.signature,reference.signature);
  const key=await webcrypto.subtle.importKey('raw',Buffer.from(result.signer,'hex'),'Ed25519',false,['verify']);
  assert.equal(await webcrypto.subtle.verify('Ed25519',key,Buffer.from(result.signature,'hex'),Buffer.from(reference.message_hex,'hex')),true);
  for(const secret of [reference.access.private_seed,reference.access.token])assert.ok(!JSON.stringify({review,result}).toLowerCase().includes(secret));
  await assert.rejects(approve(session,review),/APPROVAL_NOT_GIVEN/);
});

test('bare preview, native receipt and hosted HTTP envelope match the CLI accepted wrappers',async()=>{
  const native={version:'urn:aap:hosted-api:0.1',operation:'listing.prepare',result:reference.preview,signing_performed:false,payment_dispatched:false,external_execution:false};
  for(const input of [reference.preview,native,{version:'urn:aap:hosted-api-http:0.1',ok:true,result:native}])assert.equal((await checked(input)).wire,reference.wire);
  for(const input of [{...native,operation:'trade.signing_payload'},{...native,payment_dispatched:true},{version:'urn:aap:hosted-api-http:0.1',ok:false,result:native},{jsonrpc:'2.0',id:1,result:reference.preview}])await assert.rejects(checked(input));
});

test('recognized advert-draft/0.1 augmented preview binds its returned source and signs identical historical body bytes',async()=>{
  const value=advertFixture.prepared;
  const legacy=clone(value);delete legacy.source;delete legacy.draft_profile;
  assert.equal((await checked(value)).wire,advertFixture.expected_canonical_body);
  assert.equal((await checked(legacy)).wire,advertFixture.expected_canonical_body);
  const native={version:'urn:aap:hosted-api:0.1',operation:'listing.prepare',result:value,signing_performed:false,payment_dispatched:false,external_execution:false};
  for(const wrapped of [value,native,{version:'urn:aap:hosted-api-http:0.1',ok:true,result:native}]) {
    const session=fresh(),previewBytes=raw(wrapped),review=await session.prepare(accessRaw(),previewBytes);
    assert.equal(review.bodyText,advertFixture.expected_canonical_body);
    const result=await approve(session,review,{previewRaw:previewBytes});assert.equal(result.signature,advertFixture.expected_signature);
    assert.equal(Buffer.from(advertFixture.expected_message_hex,'hex').toString(),client.LABEL+'\0'+review.bodyText);
    assert.ok(!review.bodyText.includes('"frame"')); // Unselected private source is not exported.
  }
});

test('augmented preview refuses unknown/additional profile fields and mismatched source hash, author or projection',async()=>{
  const changes=[p=>delete p.draft_profile,p=>delete p.source,p=>p.draft_profile='urn:aap:hosted-advert-draft:future',p=>p.unexpected=true,p=>p.source.extra='hidden',p=>p.source.author='b'.repeat(64),p=>p.source.title+='tampered',p=>p.source.data.market='b'.repeat(64),p=>p.available_fields=p.available_fields.filter(name=>name!=='archetype'),p=>{p.body.fields.title='Unbound title';p.preview.public_fields.title='Unbound title';}];
  for(const change of changes){const value=clone(advertFixture.prepared);change(value);await assert.rejects(checked(value));}
});

test('wrong origin, actor, signing label, item id, source commitment, kind or URL are refused',async()=>{
  const changes=[p=>p.body.origin='https://other.example',p=>p.signing_label='PAYMENT-APPROVAL',p=>p.body.kind='ledger',p=>p.body.source.type='marketplace-order',p=>p.body.principals=['b'.repeat(64)],p=>p.required_signers=['b'.repeat(64)],p=>p.id='b'.repeat(64),p=>p.body.id='b'.repeat(64),p=>p.url+='?extra=1',p=>p.body.source.id='c'.repeat(64)];
  for(const change of changes)await assert.rejects(checked(mutate(change)));
});

test('access origin, key mismatch, unexpected fields and secret text refuse before safe review exists',async()=>{
  for(const change of [a=>a.origin='https://other.example',a=>a.actor='b'.repeat(64),a=>a.private_seed='22'.repeat(32),a=>a.extra='unexpected']) {
    const access=clone(reference.access);change(access);await assert.rejects(fresh().prepare(raw(access),previewRaw()));
  }
  for(const secret of [reference.access.private_seed,reference.access.token.toUpperCase()]) {
    const preview=mutate(p=>{p.body.fields.custom.text=secret;p.preview.public_fields=clone(p.body.fields);});
    await assert.rejects(fresh().prepare(accessRaw(),previewRaw(preview)),/SECRET_IN_PUBLICATION/);
  }
});

test('strict JSON rejects duplicate keys, floats, exponents, unsafe numbers, non-ASCII, controls and bad UTF-8',()=>{
  const bad=['{"one":1,"one":2}','{"n":1.0}','{"n":1e0}','{"n":9007199254740990.1}','{"n":NaN}','{"n":Infinity}','{"n":9007199254740992}','{"t":"\\n"}','{"t":"\\u001b[31m"}','{"t":"\\u00e9"}','{"t":"unescaped\n"}','{"x":1,}','{"x":01}','\ufeff{}'];
  for(const text of bad)assert.throws(()=>client.decode(new TextEncoder().encode(text),262144));
  assert.throws(()=>client.decode(new Uint8Array([0xc0,0xaf]),262144),/JSON_INVALID/);
  assert.equal(client.canonical(client.decode(new TextEncoder().encode('{"__proto__":{"ok":true},"constructor":1,"n":-0}'),262144)),'{"__proto__":{"ok":true},"constructor":1,"n":0}');
  assert.equal({}.ok,undefined);
});

test('depth, visit, string, key, input and publication byte limits refuse oversized inputs',async()=>{
  assert.throws(()=>client.decode(new Uint8Array(262145).fill(32),262144),/INPUT_SIZE/);
  assert.throws(()=>client.canonical('x'.repeat(100001)),/JSON_ASCII/);
  assert.throws(()=>client.canonical({['x'.repeat(257)]:true}),/JSON_KEY/);
  assert.throws(()=>client.canonical(Array.from({length:20000},()=>null)),/JSON_BOUNDS/);
  let deep=null;for(let i=0;i<41;i++)deep=[deep];assert.throws(()=>client.canonical(deep),/JSON_BOUNDS/);
  await assert.rejects(checked(mutate(p=>{p.body.fields.custom.text='x'.repeat(64000);p.preview.public_fields=clone(p.body.fields);})),/PUBLICATION_SIZE/);
});

test('booleans are not integer revisions/expiry; repeated preview fields and metadata must exactly match',async()=>{
  for(const change of [p=>p.body.sequence=true,p=>p.body.expires=true,p=>p.preview.public_fields.title='Altered',p=>p.body.unexpected='hidden',p=>p.preview.indexable=1,p=>p.preview.public_metadata.push('extra'),p=>p.body.fields.record_kind='ORDER',p=>p.body.fields.custom.flag=true]){
    const preview=mutate(change);
    if(preview.body.fields.custom.flag===true&&JSON.stringify(preview)===JSON.stringify(reference.preview))preview.preview.public_fields.custom.flag=1;
    await assert.rejects(checked(preview));
  }
});

test('null expiry and safe far-future integer match CLI scope; expired publications refuse',async()=>{
  for(const expires of [null,Number.MAX_SAFE_INTEGER])assert.equal((await checked(mutate(p=>p.body.expires=expires))).body.expires,expires);
  for(const expires of [NOW,NOW-1,0,-1])await assert.rejects(checked(mutate(p=>p.body.expires=expires)),/PUBLICATION_EXPIRED/);
});

test('explicit review is required and changed displayed body or file bytes cannot be signed',async()=>{
  const {session,review}=await prepared();
  await assert.rejects(approve(session,review,{reviewed:false}),/APPROVAL_NOT_GIVEN/);
  await assert.rejects(approve(session,review,{displayedBody:review.bodyText+' '}),/REVIEW_CHANGED/);
  await assert.rejects(approve(session,review,{previewRaw:raw(mutate(p=>p.body.fields.title='Changed'))}),/INPUT_CHANGED/);
  await assert.rejects(approve(session,review,{accessRaw:raw({...reference.access,client_nonce:'12'.repeat(32)})}),/INPUT_CHANGED/);
  session.invalidate();await assert.rejects(approve(session,review),/APPROVAL_NOT_GIVEN/);
});

test('expiry is rechecked before and after async crypto, and invalidation prevents a late result',async()=>{
  let now=NOW;const session=client.createSession(webcrypto,()=>now);const review=await session.prepare(accessRaw(),previewRaw());now=NOW+3600;
  await assert.rejects(approve(session,review),/PUBLICATION_EXPIRED/);
  let expireAfter=false;
  const slow=proxyCrypto({sign:async(...args)=>{const signature=await webcrypto.subtle.sign(...args);if(expireAfter)now=NOW+3600;return signature;}});
  now=NOW;const second=client.createSession(slow,()=>now);const secondReview=await second.prepare(accessRaw(),previewRaw());expireAfter=true;
  await assert.rejects(approve(second,secondReview),/PUBLICATION_EXPIRED/);
  let finish,start;const wait=new Promise(resolve=>finish=resolve),started=new Promise(resolve=>start=resolve);
  const delayed=proxyCrypto({sign:async(...args)=>{start();await wait;return webcrypto.subtle.sign(...args);}});
  const third=client.createSession(delayed,()=>NOW);const thirdReview=await third.prepare(accessRaw(),previewRaw());
  const pending=approve(third,thirdReview);await started;third.invalidate();finish();await assert.rejects(pending,/INPUT_CHANGED/);
  let expireOnDigest=false,signs=0;now=NOW;
  const clocked=proxyCrypto({digest:async(...args)=>{const result=await webcrypto.subtle.digest(...args);if(expireOnDigest)now=NOW+3600;return result;},sign:async(...args)=>{signs++;return webcrypto.subtle.sign(...args);}});
  const fourth=client.createSession(clocked,()=>now);const fourthReview=await fourth.prepare(accessRaw(),previewRaw());expireOnDigest=true;
  await assert.rejects(approve(fourth,fourthReview),/PUBLICATION_EXPIRED/);assert.equal(signs,0);
});

test('unsupported browser Ed25519 returns only a fixed CLI-fallback error',async()=>{
  const unsupported=proxyCrypto({importKey:async()=>{throw new Error('untrusted supplied error');}});
  await assert.rejects(client.createSession(unsupported,()=>NOW).prepare(accessRaw(),previewRaw()),{message:'ED25519_UNAVAILABLE'});
  await assert.rejects(client.createSession(null,()=>NOW).prepare(accessRaw(),previewRaw()),{message:'ED25519_UNAVAILABLE'});
});

function uiFixture(crypto=webcrypto,framed=false,includeSummary=true) {
  const ids={},downloads=[],events={};let signCalls=0;
  class Element {
    constructor(id){this.id=id;this.listeners={};this.textContent='';this.checked=false;this.hidden=false;this.disabled=false;this.files=[];this.value='';}
    set innerHTML(_){throw new Error('Unsafe HTML rendering');}
    addEventListener(type,handler){this.listeners[type]=handler;}
    async fire(type){if(this.listeners[type])await this.listeners[type]({target:this});}
    async click(){if(!this.disabled)await this.fire('click');}
    remove(){}
  }
  for(const id of ['owner-listing-root','owner-access','owner-preview','owner-load','owner-sign','owner-confirm','owner-state','owner-body','owner-digest','owner-visibility','owner-review','owner-clear'])ids[id]=new Element(id);
  if(includeSummary)ids['owner-summary']=new Element('owner-summary');
  ids['owner-sign'].disabled=true;ids['owner-review'].hidden=true;
  const blobs=new Map();
  const context={module:{exports:{}},TextEncoder,TextDecoder,Uint8Array,Blob,atob,Date:{now:()=>NOW*1000},isSecureContext:true,setTimeout:fn=>fn(),crypto:proxyCrypto({...Object.fromEntries(['digest','importKey','exportKey','verify'].map(name=>[name,crypto.subtle[name].bind(crypto.subtle)])),sign:async(...args)=>{signCalls++;return crypto.subtle.sign(...args);}}),
    URL:{createObjectURL(blob){const url='blob:synthetic-'+blobs.size;blobs.set(url,blob);return url;},revokeObjectURL(){}},
    document:{getElementById:id=>ids[id],createElement:tag=>{assert.equal(tag,'a');const link=new Element('download');link.click=()=>downloads.push({blob:blobs.get(link.href),filename:link.download});return link;},body:{appendChild(){}}},
    addEventListener:(type,handler)=>events[type]=handler,fetch(){throw new Error('No network allowed');},localStorage:{setItem(){throw new Error('No storage allowed');}},sessionStorage:{setItem(){throw new Error('No storage allowed');}}};
  context.self=context;context.top=framed?{}:context;
  vm.runInNewContext(fs.readFileSync(clientPath,'utf8'),context,{filename:clientPath});
  const file=value=>({size:raw(value).byteLength,arrayBuffer:async()=>raw(value).buffer});
  ids['owner-access'].files=[file(reference.access)];ids['owner-preview'].files=[file(reference.preview)];
  return {ids,downloads,events,file,context,get signCalls(){return signCalls;},text:()=>Object.values(ids).map(node=>node.textContent).join('\n')};
}

test('UI has no automatic signatures, requires review checkbox/button and downloads only signature plus signer',async()=>{
  const fixture=uiFixture();assert.equal(fixture.signCalls,0);
  await fixture.ids['owner-load'].click();assert.equal(fixture.signCalls,0);assert.equal(fixture.ids['owner-sign'].disabled,true);
  await fixture.ids['owner-sign'].click();assert.equal(fixture.signCalls,0);
  fixture.ids['owner-confirm'].checked=true;await fixture.ids['owner-confirm'].fire('change');assert.equal(fixture.ids['owner-sign'].disabled,false);
  await fixture.ids['owner-sign'].click();assert.equal(fixture.signCalls,1);assert.equal(fixture.downloads.length,1);
  const downloaded=await fixture.downloads[0].blob.text();assert.deepEqual(JSON.parse(downloaded),{signer:reference.access.actor,signature:reference.signature});
  for(const secret of [reference.access.private_seed,reference.access.token])assert.ok(!(fixture.text()+downloaded).toLowerCase().includes(secret));
  assert.equal(fixture.ids['owner-confirm'].checked,false);assert.equal(fixture.ids['owner-sign'].disabled,true);
});

test('UI renders XSS-shaped public values as inert text and clears approval on either file change',async()=>{
  const fixture=uiFixture();const xss='</pre><img src=x onerror=alert(1)><script>alert(2)</script>';
  const preview=mutate(p=>{p.body.fields.custom.text=xss;p.preview.public_fields=clone(p.body.fields);});
  fixture.ids['owner-preview'].files=[fixture.file(preview)];await fixture.ids['owner-load'].click();assert.ok(fixture.ids['owner-body'].textContent.includes(xss));
  fixture.ids['owner-confirm'].checked=true;await fixture.ids['owner-confirm'].fire('change');
  await fixture.ids['owner-preview'].fire('change');assert.equal(fixture.ids['owner-confirm'].checked,false);assert.equal(fixture.ids['owner-body'].textContent,'');assert.equal(fixture.ids['owner-review'].hidden,true);assert.equal(fixture.signCalls,0);
  await fixture.ids['owner-load'].click();await fixture.ids['owner-access'].fire('change');assert.equal(fixture.ids['owner-body'].textContent,'');assert.equal(fixture.signCalls,0);
});

test('optional quick summary uses literal text and exact resource units, preserves full body and clears with review',async()=>{
  const fixture=uiFixture();const xss='<img src=x onerror=alert(1)> & <script>alert(2)</script>';
  const preview=mutate(p=>{
    p.body.fields.category='data-cleaning';p.body.fields.custom.description=xss;p.body.fields.custom.scope='One duplicate review';p.body.fields.custom.unknown_custom_field='Must remain in the full record';
    p.body.fields.offer=[{amount:1,asset:{namespace:'service',identifier:'cleanup',unit:'file'}}];
    p.body.fields.want=[{amount:2000,asset:{namespace:'fiat',identifier:'GBP',unit:'pence'}},{amount:7,asset:{namespace:'other',identifier:'USD',unit:'different-unit'}}];
    p.available_fields=Object.keys(p.body.fields).sort();p.preview.public_fields=clone(p.body.fields);
  });
  fixture.ids['owner-preview'].files=[fixture.file(preview)];await fixture.ids['owner-load'].click();
  const summary=fixture.ids['owner-summary'].textContent;
  for(const expected of ['Title: Synthetic fixture only','Category: data-cleaning','Description: '+xss,'Scope: One duplicate review','Offered resources:\n1. Amount: 1; resource: service / cleanup; unit: file','Requested resources:\n1. Amount: 2000; resource: fiat / GBP; unit: pence','2. Amount: 7; resource: other / USD; unit: different-unit'])assert.ok(summary.includes(expected),expected);
  assert.equal(fixture.ids['owner-body'].textContent,client.canonical(preview.body));assert.ok(fixture.ids['owner-body'].textContent.includes('unknown_custom_field'));assert.ok(!summary.includes('Must remain in the full record'));assert.ok(!summary.includes('£'));
  fixture.ids['owner-confirm'].checked=true;await fixture.ids['owner-confirm'].fire('change');await fixture.ids['owner-preview'].fire('change');
  assert.equal(fixture.ids['owner-summary'].textContent,'');assert.equal(fixture.ids['owner-confirm'].checked,false);assert.equal(fixture.ids['owner-sign'].disabled,true);
  await fixture.ids['owner-load'].click();await fixture.ids['owner-access'].fire('change');assert.equal(fixture.ids['owner-summary'].textContent,'');
  await fixture.ids['owner-load'].click();await fixture.ids['owner-clear'].click();assert.equal(fixture.ids['owner-summary'].textContent,'');assert.equal(fixture.signCalls,0);
});

test('older HTML without the optional summary retains exact review and signature behavior',async()=>{
  const fixture=uiFixture(webcrypto,false,false);await fixture.ids['owner-load'].click();assert.equal(fixture.ids['owner-body'].textContent,reference.wire);
  fixture.ids['owner-confirm'].checked=true;await fixture.ids['owner-confirm'].fire('change');await fixture.ids['owner-sign'].click();
  assert.equal(fixture.signCalls,1);assert.equal(JSON.parse(await fixture.downloads[0].blob.text()).signature,reference.signature);
});

test('UI refuses unsupported Ed25519 with CLI guidance and refuses embedded-frame operation',async()=>{
  const unsupported=proxyCrypto({importKey:async()=>{throw new Error('unsupported');}});
  const fixture=uiFixture(unsupported);await fixture.ids['owner-load'].click();assert.match(fixture.text(),/Use the standalone (?:CLI|signer)/);assert.equal(fixture.signCalls,0);assert.equal(fixture.downloads.length,0);
  const embedded=uiFixture(webcrypto,true);assert.equal(embedded.ids['owner-access'].disabled,true);assert.equal(embedded.ids['owner-load'].disabled,true);assert.match(embedded.text(),/outside any embedded frame/);
});

test('static document uses external same-origin assets, no forms/base and a no-connect CSP',()=>{
  const html=fs.readFileSync(path.join(__dirname,'../docs/OWNER_LISTING_APPROVAL.html'),'utf8');
  for(const directive of ["default-src 'none'","connect-src 'none'","object-src 'none'","base-uri 'none'","form-action 'none'","script-src 'self'","style-src 'self'"])assert.ok(html.includes(directive));
  assert.ok(!/<(?:form|base|iframe)\b/i.test(html));assert.ok(!/<script(?![^>]*\bsrc=)[^>]*>/i.test(html));assert.ok(!/\son\w+=|\sstyle=/i.test(html));
  const code=fs.readFileSync(clientPath,'utf8');
  for(const forbidden of ['innerHTML','fetch(','XMLHttpRequest','WebSocket','sendBeacon','localStorage','sessionStorage','indexedDB','console.'])assert.ok(!code.includes(forbidden),forbidden);
  assert.equal(createHash('sha256').update(reference.wire).digest('hex').length,64);
});
