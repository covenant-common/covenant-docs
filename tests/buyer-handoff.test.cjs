'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const {webcrypto} = require('node:crypto');
const S = require('../assets/deal-structures.js');
const P = require('../assets/pilot-workspace.js');
if (!globalThis.crypto) globalThis.crypto = webcrypto;

function note() {
  const plan = P.emptyBuyerComparison(), row = P.defaultBuyerAlternative();
  Object.assign(plan, {criteria: 'One page with linked sources and explicit buyer review.', capMinor: 4000});
  Object.assign(row, {label: 'TEST provider <literal>', acceptance: 'meets', basis: 'Buyer declaration only',
    quoteMinor: 2500, feesMinor: 0, reviewMinor: 300, coordinationMinor: 100, repairLowMinor: 0, repairHighMinor: 200});
  plan.alternatives.push(row);
  return JSON.stringify(P.buyerComparisonNote(plan, row.label));
}

function rig() {
  class Element {
    constructor(id = '') {this.id=id;this.attributes={};this.children=[];this.handlers={};this.value='';this.checked=false;this.hidden=false;this.disabled=false;this.files=[];this._text='';}
    set textContent(v) {this._text=String(v);this.children=[];}
    get textContent() {return this._text+this.children.map(x=>x.textContent).join('');}
    set innerHTML(_) {throw Error('Unsafe markup');}
    setAttribute(k,v) {this.attributes[k]=String(v);}
    getAttribute(k) {return this.attributes[k];}
    removeAttribute(k) {delete this.attributes[k];}
    replaceChildren(...xs) {this.children=xs;this._text='';}
    appendChild(x) {this.children.push(x);return x;}
    addEventListener(k,f) {this.handlers[k]=f;}
    focus() {}
    scrollIntoView() {}
    reportValidity() {return true;}
  }
  const html=fs.readFileSync(require('node:path').join(__dirname,'../docs/MATRIX.html'),'utf8');
  const nodes=new Map([...html.matchAll(/\bid="([^"]+)"/g)].map(m=>[m[1],new Element(m[1])]));
  const get=id=>{assert.ok(nodes.has(id),'Real Matrix element missing: '+id);return nodes.get(id);};
  const tabs=['market','system','creations'].map(n=>{const t=get('tab-'+n);t.setAttribute('aria-controls','panel-'+n);return t;});
  get('draft-structure').value='fixed-deliverable';
  const calls=[], revoked=[], blobs=[];
  class TestURL extends URL {}
  TestURL.createObjectURL=b=>{blobs.push(b);return 'blob:test-'+blobs.length;};
  TestURL.revokeObjectURL=u=>revoked.push(u);
  const document={getElementById:get,createElement:()=>new Element(),querySelectorAll:s=>s==='#matrix-tabs [role="tab"]'?tabs:[]};
  const window={AAPDealStructures:S,AAPPilotWorkspace:P,location:new URL('https://covenant-common.github.io/covenant-docs/docs/MATRIX.html'),addEventListener(){}};
  const context={window,document,URL:TestURL,Blob,TextEncoder,TextDecoder,Uint8Array,AbortController,setTimeout,clearTimeout,
    fetch:async (_url,opts)=>{const body=JSON.parse(opts.body);calls.push(body);const result=body.method==='initialize'?{protocolVersion:'2025-11-25'}:{content:[{type:'text',text:JSON.stringify({listings:[],next_offset:null})}]};return {ok:true,status:200,text:async()=>JSON.stringify({jsonrpc:'2.0',id:body.id,result})};},
    navigator:{},localStorage:{getItem(){throw Error('Unexpected storage');},setItem(){throw Error('Unexpected storage');}}};
  vm.runInNewContext(fs.readFileSync(require('node:path').join(__dirname,'../assets/matrix.js'),'utf8'),context);
  return {get,calls,revoked,blobs,click:id=>get(id).handlers.click({preventDefault(){}}),
    file:async content=>{get('buyer-note-file').files=[{size:1000,text:()=>Promise.resolve(content)}];return get('buyer-note-file').handlers.change({target:get('buyer-note-file')});}};
}
const flush=()=>new Promise(resolve=>setImmediate(resolve));

test('actual Matrix handoff replaces only explicit editable fields, clears old parties/results and makes no request',async()=>{
  const r=rig();await flush();await flush();const before=r.calls.length;
  r.get('draft-title').value='Old job';r.get('draft-buyer').value='Old buyer';r.get('draft-supplier').value='Old supplier';
  r.get('draft-result').hidden=false;r.get('draft-copy').disabled=false;r.get('proposal-copy').disabled=false;
  r.get('buyer-note-text').value=note();r.click('buyer-note-load');
  assert.equal(r.get('draft-title').value,'TEST provider <literal>');
  assert.equal(r.get('draft-buyer').value,'');assert.equal(r.get('draft-supplier').value,'');
  assert.equal(r.get('draft-structure').value,'fixed-deliverable');
  assert.match(r.get('draft-price').value,/USD 25\.00 quoted consideration/);
  assert.doesNotMatch(r.get('draft-price').value,/31\.00|review|coordination/);
  assert.match(r.get('draft-structure-details').value,/BUYER PLANNING NOTE/);
  assert.match(r.get('draft-structure-details').value,/not supplier payment obligations/);
  assert.equal(r.get('draft-result').hidden,true);assert.equal(r.get('draft-copy').disabled,true);assert.equal(r.get('proposal-copy').disabled,true);
  assert.match(r.get('selected-advert-state').textContent,/No advert selected/);
  assert.match(r.get('buyer-note-state').textContent,/No supplier was verified/);
  assert.equal(r.calls.length,before);
  const fields={};for(const k of ['title','buyer','supplier','deliverable','price'])fields[k]=r.get('draft-'+k).value;
  fields.buyer='TEST requester';fields.supplier='TEST performer';
  const draft=await S.buildDraft({template_id:'fixed-deliverable',fields,details:r.get('draft-structure-details').value,selected_advert:null,specialist_acknowledged:false});
  assert.ok(draft.request.clauses.some(c=>c.text.includes('Buyer-only modeled costs')));
  assert.equal(r.calls.length,before); // Preparing a request locally still does not send it.
});

test('bad flags, duplicate fields and credential files refuse without changing draft or displaying their values',async()=>{
  const r=rig();await flush();r.get('draft-title').value='Retained';
  const changed=JSON.parse(note());changed.binding=true;
  for(const raw of [JSON.stringify(changed),note().replace('"binding":false','"binding":true,"binding":false')]){
    r.get('buyer-note-text').value=raw;r.click('buyer-note-load');
    assert.equal(r.get('draft-title').value,'Retained');assert.match(r.get('buyer-note-state').textContent,/not changed/);
  }
  r.get('buyer-note-text').value='';await r.file('{"token":"TEST-DO-NOT-DISPLAY","private_key":"TEST-SECRET"}');
  assert.equal(r.get('buyer-note-text').value,'');assert.equal(r.get('draft-title').value,'Retained');
  assert.doesNotMatch(r.get('buyer-note-state').textContent,/TEST-DO-NOT-DISPLAY|TEST-SECRET/);
});

test('choosing a note alone changes no draft; late file reads cannot overwrite newer text or apply a stale selection',async()=>{
  const r=rig();await flush();r.get('draft-title').value='Original';const before=r.calls.length;
  await r.file(note());assert.equal(r.get('draft-title').value,'Original');assert.equal(r.calls.length,before);
  let resolve;const pending=r.file(new Promise(r=>{resolve=r;}));
  r.get('buyer-note-text').value='User editing newer text';r.get('buyer-note-text').handlers.input();
  resolve(note());await pending;
  assert.equal(r.get('buyer-note-text').value,'User editing newer text');assert.equal(r.get('draft-title').value,'Original');assert.equal(r.calls.length,before);
});

test('a slow earlier advert file cannot replace a newer buyer note or manual draft edit',async()=>{
  const id='a'.repeat(64), raw=JSON.stringify(await S.makeHandoff({id,url:'https://jupie202020.pythonanywhere.com/marketplace/'+id,visibility:'INDEXED',fields:{title:'OLD ADVERT',category:'research',custom:{description:'Fictional old work'},offer:[{amount:1,asset:{namespace:'service',identifier:'test',unit:'job'}}],want:[{amount:2500,asset:{namespace:'fiat',identifier:'USD',unit:'cents'}}]}}));
  const r=rig();await flush();let resolve;
  r.get('advert-handoff-file').files=[{size:1000,text:()=>new Promise(done=>{resolve=done;})}];
  const pending=r.get('advert-handoff-file').handlers.change({target:r.get('advert-handoff-file')});
  r.get('buyer-note-text').value=note();r.click('buyer-note-load');resolve(raw);await pending;await flush();
  assert.equal(r.get('draft-title').value,'TEST provider <literal>');
  assert.match(r.get('selected-advert-state').textContent,/No advert selected/);
  assert.match(r.get('draft-structure-details').value,/Buyer-only modeled costs/);
  let resolveSecond;
  r.get('advert-handoff-file').files=[{size:1000,text:()=>new Promise(done=>{resolveSecond=done;})}];
  const second=r.get('advert-handoff-file').handlers.change({target:r.get('advert-handoff-file')});
  r.get('draft-title').value='New manual scope';r.get('matrix-draft').handlers.input();resolveSecond(raw);await second;
  assert.equal(r.get('draft-title').value,'New manual scope');
  assert.match(r.get('selected-advert-state').textContent,/No advert selected/);
});
