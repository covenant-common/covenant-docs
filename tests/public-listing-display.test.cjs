/* Public display regression. Fixture MCP replies only; no network, account, signature or payment. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = process.env.PUBLIC_SITE_ROOT || path.resolve(__dirname, '..');
if (!globalThis.crypto) globalThis.crypto = require('node:crypto').webcrypto;
const S = require(path.join(root, 'assets/deal-structures.js'));
const T = require(path.join(root, 'assets/terminal.js'));
const display = S.publicListingDisplay || T.publicListingDisplay;
const leg = (unit, amount = 4000, identifier = 'GBP', namespace = 'fiat') => ({amount, asset: {namespace, identifier, unit}});
const fixture = () => ({id: 'a'.repeat(64), visibility: 'INDEXED',
  url: 'https://jupie202020.pythonanywhere.com/marketplace/' + 'a'.repeat(64),
  fields: {title: 'DEMO - test a website', category: 'software',
    custom: {description: 'Review five pages and return a prioritised bug list.', scope: 'Fictional workflow; not open for orders.', private_note: 'DO-NOT-DISPLAY'},
    offer: [{amount: 1, asset: {namespace: 'service', identifier: 'five-page-review', unit: 'review'}}],
    want: [leg('penny')], private_note: 'DO-NOT-DISPLAY-TOP'},
  private_source: 'DO-NOT-DISPLAY-SOURCE'});
const clone = v => JSON.parse(JSON.stringify(v));

test('GBP penny and pence are display aliases without changing signed asset names or base units', () => {
  for (const unit of ['penny', 'pence']) {
    const input = leg(unit), before = JSON.stringify(input), result = T.publicLeg(input);
    assert.equal(result.label, 'GBP 40.00');
    assert.deepEqual(result.view, input); assert.equal(JSON.stringify(input), before);
  }
  assert.equal(T.publicLeg(leg('penny', 1)).label, 'GBP 0.01');
  assert.equal(T.publicLeg({amount: 25000000, asset: {namespace: 'eip155:8453', identifier: 'USDC', unit: 'USDC_MICRO'}}).label, '25 USDC');
  assert.equal(T.publicLeg({amount: 125000, asset: {namespace: 'eip155:8453', identifier: 'USDC', unit: 'USDC_MICRO'}}).label, '0.125 USDC');
  assert.equal(T.publicLeg(leg('penny', Number.MAX_SAFE_INTEGER)).label, 'GBP 90071992547409.91');
});

test('other fiat units and arbitrary resources retain their exact display meaning', () => {
  for (const [unit, amount, id, ns, expected] of [
    ['cents', 2500, 'USD', 'fiat', 'USD 25.00'], ['cents', 2500, 'EUR', 'fiat', 'EUR 25.00'],
    ['GBP', 40, 'GBP', 'fiat', '40 GBP · GBP [fiat]'], ['penny', 40, 'GBP', 'custom', '40 penny · GBP [custom]'],
    ['satoshi', 42, 'BTC', 'crypto', '42 satoshi · BTC [crypto]'], ['penny', 40, '__proto__', 'fiat', '40 penny · __proto__ [fiat]'],
    ['pennies', 40, 'GBP', 'fiat', '40 pennies · GBP [fiat]'], ['Penny', 40, 'GBP', 'fiat', '40 Penny · GBP [fiat]'],
    ['penny', 40, 'GBX', 'fiat', '40 penny · GBX [fiat]'], ['cent', 40, 'EUR', 'fiat', '40 cent · EUR [fiat]'],
    ['pence', 40, 'USD', 'fiat', '40 pence · USD [fiat]']
  ]) {
    const value=leg(unit,amount,id,ns), before=JSON.stringify(value), shown=T.publicLeg(value);
    assert.equal(shown.label,expected);assert.deepEqual(shown.view,value);assert.equal(JSON.stringify(value),before);
  }
  for (const amount of [-1, 0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) assert.equal(T.publicLeg(leg('penny', amount)), null);
});

test('shared display and retained Terminal API expose only the existing public field projection', () => {
  const fields = fixture().fields, before = JSON.stringify(fields), card = display(fields);
  assert.deepEqual(T.publicListingDisplay(fields), card);
  assert.equal(card.summary, fields.custom.description); assert.equal(card.scope, fields.custom.scope);
  assert.deepEqual(card.wants, ['GBP 40.00']);
  assert.equal(JSON.stringify(fields), before); assert.ok(!JSON.stringify(card).includes('DO-NOT-DISPLAY'));
  assert.equal(typeof T.personalizedPageRank, 'function'); assert.equal(typeof T.rankNavigation, 'function');
});

test('null, withheld and unrelated custom fields are not searched as fallback display data', () => {
  for (const custom of [undefined, null, [], {private_note: 'HIDDEN', terms: 'HIDDEN', contact: 'HIDDEN'}]) {
    const fields = {title: 'Visible'}; if (custom !== undefined) fields.custom = custom;
    const card = display(fields); assert.equal(card.summary, ''); assert.equal(card.scope, '');
    assert.equal(card.wants, null); assert.ok(!JSON.stringify(card).includes('HIDDEN'));
  }
  const custom = {description: 'Public description'};
  Object.defineProperty(custom, 'private_note', {enumerable: true, get() {throw Error('Unexpected private read');}});
  const fields = {title: 'Visible', custom};
  Object.defineProperty(fields, 'private_source', {get() {throw Error('Unexpected source read');}});
  assert.equal(display(fields).summary, 'Public description');
});

function matrixRig(publications, {structures = S} = {}) {
  class Element {
    constructor(id = '', tag = 'div') {this.id=id;this.tagName=tag.toUpperCase();this.attributes={};this.children=[];this.handlers={};this.value='';this.checked=false;this.hidden=false;this.disabled=false;this.files=[];this._text='';}
    set textContent(v) {this._text=String(v);this.children=[];}
    get textContent() {return this._text+this.children.map(x=>x.textContent).join('');}
    set innerHTML(_) {throw Error('Unsafe markup write');}
    setAttribute(k,v) {this.attributes[k]=String(v);}
    getAttribute(k) {return this.attributes[k];}
    removeAttribute(k) {delete this.attributes[k];}
    replaceChildren(...xs) {this.children=xs;this._text='';}
    appendChild(x) {this.children.push(x);return x;}
    addEventListener(k,f) {this.handlers[k]=f;}
    focus() {} scrollIntoView() {} reportValidity() {return true;}
  }
  const html = fs.readFileSync(path.join(root, 'docs/MATRIX.html'), 'utf8');
  const nodes = new Map([...html.matchAll(/\bid="([^"]+)"/g)].map(m=>[m[1],new Element(m[1])]));
  const get=id=>{assert.ok(nodes.has(id),'Real Matrix element missing: '+id);return nodes.get(id);};
  const tabs=['market','system','creations'].map(n=>{const t=get('tab-'+n);t.setAttribute('aria-controls','panel-'+n);return t;});
  get('draft-structure').value='fixed-deliverable';
  const calls=[];
  const document = {getElementById:get,createElement:tag=>new Element('',tag),querySelectorAll:s=>s==='#matrix-tabs [role="tab"]'?tabs:[]};
  const context = {window:{AAPDealStructures:structures,location:new URL('https://covenant-common.github.io/covenant-docs/docs/MATRIX.html'),addEventListener(){}},document,
    URL,Blob,TextEncoder,TextDecoder,Uint8Array,AbortController,setTimeout,clearTimeout,navigator:{},
    fetch:async(_url,opts)=>{const body=JSON.parse(opts.body);calls.push(body);
      const data={result:{items:publications.map(publication=>({publication})),total:publications.length,next_offset:null,scope:'CURRENT_INDEXED_PUBLICATIONS_ONLY'}};
      const result=body.method==='initialize'?{protocolVersion:'2025-11-25'}:{content:[{type:'text',text:JSON.stringify(data)}]};
      return {ok:true,status:200,headers:{get(){return null;}},text:async()=>JSON.stringify({jsonrpc:'2.0',id:body.id,result})};},
    localStorage:{getItem(){throw Error('Unexpected storage');},setItem(){throw Error('Unexpected storage');}}};
  vm.runInNewContext(fs.readFileSync(path.join(root,'assets/matrix.js'),'utf8'),context);
  return {get,calls};
}
const flush = () => new Promise(resolve=>setImmediate(resolve));
async function loaded(publications,options) {const r=matrixRig(publications,options);for(let i=0;i<8;i++)await flush();return r;}
const frontText = article => article.children.filter(x=>x.tagName!=='DETAILS').map(x=>x.textContent).join('\n');
const all = node => [node,...node.children.flatMap(all)];

test('actual Matrix search cards show public custom description, scope and requested price before collapsed details', async () => {
  const publication=fixture(), before=JSON.stringify(publication), r=await loaded([publication]);
  for (const id of ['market-results','creations-results']) {
    assert.equal(r.get(id).children.length,1);
    const text=frontText(r.get(id).children[0]);
    assert.ok(text.includes(publication.fields.custom.description)); assert.ok(text.includes(publication.fields.custom.scope));
    assert.ok(text.includes('Offers: 1 review · five-page-review [service]')); assert.ok(text.includes('Wants: GBP 40.00'));
    assert.ok(!r.get(id).textContent.includes('DO-NOT-DISPLAY'));
  }
  const actions = r.get('market-results').children[0].children.find((node) => node.className === 'card-actions');
  assert.deepEqual(actions.children.map((node) => node.tagName), ['A', 'BUTTON']);
  assert.equal(JSON.stringify(publication),before);
  assert.equal(r.calls.filter(c=>c.method==='tools/call').length,1);
  assert.ok(r.calls.every(c=>c.method==='initialize'||c.params.name==='aap_public_listing_search'));
});

test('Matrix uses literal text and excludes unsafe supplied advert links', async () => {
  for (const url of ['javascript:alert(1)','https://evil.example/marketplace/x','https://user:secret@jupie202020.pythonanywhere.com/marketplace/x']) {
    const publication=fixture();publication.url=url;publication.fields.title='<img src=x onerror=alert(1)>';
    publication.fields.summary='<script>DO NOT RUN</script>'; publication.fields.custom.description='';
    const r=await loaded([publication]), article=r.get('market-results').children[0];
    assert.ok(frontText(article).includes(publication.fields.title)); assert.ok(frontText(article).includes(publication.fields.summary));
    assert.ok(!all(article).some(e=>['IMG','SCRIPT'].includes(e.tagName)));
    assert.ok(!all(article).some(e=>e.tagName==='A'&&e.href===url));
  }
});

test('Matrix keeps basic adverts visible with an older cached helper lacking the new display function', async () => {
  const publication=fixture();publication.fields.summary='Public top-level summary';
  const older = {...S}; delete older.publicListingDisplay;
  const r=await loaded([publication],{structures:older});
  const article=r.get('market-results').children[0];
  assert.ok(article);assert.ok(frontText(article).includes(publication.fields.title));
  assert.ok(frontText(article).includes('Public top-level summary'));
  assert.ok(all(article).some(e=>e.tagName==='A'&&e.href===publication.url));
});

test('missing requested resources do not become an invented zero price', async () => {
  const publication=fixture();delete publication.fields.want;publication.fields.custom=null;
  const r=await loaded([publication]), text=frontText(r.get('market-results').children[0]);
  assert.ok(!text.includes('GBP 0.00'));assert.ok(!text.includes('Wants:'));assert.ok(!text.includes('free'));
});

test('both front doors expose the simple current-adverts page without requiring JavaScript', () => {
  for (const name of ['TERMINAL.html','MATRIX.html']) {
    const html=fs.readFileSync(path.join(root,'docs',name),'utf8').replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi,'');
    assert.match(html, /<a href="https:\/\/jupie202020\.pythonanywhere\.com\/marketplace\/browse\/">Open current adverts as a simple page<\/a>/);
  }
});
