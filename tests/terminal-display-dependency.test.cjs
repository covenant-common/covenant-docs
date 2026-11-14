/* Exercise the actual Terminal DOM/RPC path. Synthetic replies only; no outside call. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = process.env.PUBLIC_SITE_ROOT || path.resolve(__dirname,'..');
if (!globalThis.crypto) globalThis.crypto=require('node:crypto').webcrypto;
const S=require(path.join(root,'assets/deal-structures.js'));
const publication=()=>({id:'a'.repeat(64),visibility:'INDEXED',url:'https://jupie202020.pythonanywhere.com/marketplace/'+'a'.repeat(64),
 fields:{title:'DEMO - exact public test',category:'research',custom:{description:'One synthetic brief; not accepting orders.'},want:[{amount:4000,asset:{namespace:'fiat',identifier:'GBP',unit:'penny'}}]}});
const older=()=>{const value={...S};delete value.publicLeg;delete value.publicListingDisplay;return value;};
function rig({structures=S,publications=[publication()],mcpError=false,local=false,flags=null}={}) {
 class Element {
  constructor(id='',tag='div'){this.id=id;this.tagName=tag.toUpperCase();this.children=[];this.handlers={};this.attributes={};this._text='';this.value='';this.disabled=false;this.hidden=false;}
  set textContent(v){this._text=String(v);this.children=[];}
  get textContent(){return this._text+this.children.map(x=>x.textContent).join('');}
  set innerHTML(_){throw Error('Unexpected markup interpretation');}
  appendChild(v){this.children.push(v);return v;}
  replaceChildren(...values){this.children=values;this._text='';}
  setAttribute(k,v){this.attributes[k]=String(v);}
  addEventListener(k,v){this.handlers[k]=v;}
  focus(){}
 }
 const html=fs.readFileSync(path.join(root,'docs/TERMINAL.html'),'utf8');
 const nodes=new Map([...html.matchAll(/\bid="([^"]+)"/g)].map(m=>[m[1],new Element(m[1])]));
 const get=id=>{assert.ok(nodes.has(id),'Actual Terminal element missing: '+id);return nodes.get(id);};
 const calls=[];
 const document={getElementById:get,createElement:tag=>new Element('',tag),addEventListener(){}};
 const window={AAPDealStructures:structures,location:new URL(local?'http://127.0.0.1:8000/docs/TERMINAL.html':'https://covenant-common.github.io/covenant-docs/docs/TERMINAL.html'),addEventListener(){}};
 const copied=[];
 const context={window,document,URL,Blob,TextEncoder,TextDecoder,Uint8Array,AbortController,setTimeout,clearTimeout,
 navigator:{clipboard:{async writeText(value){copied.push(value);}}},
 fetch:async(_url,opts)=>{const request=JSON.parse(opts.body);calls.push(request);
  const items=request.params.arguments?.query==='missing service'?[]:publications.map(p=>({publication:p,text_flags:flags}));
  const data={result:{items,total:items.length,next_offset:null,scope:'CURRENT_INDEXED_PUBLICATIONS_ONLY'}};
  const result=request.method==='initialize'?{protocolVersion:'2025-11-25'}:{isError:mcpError,content:[{type:'text',text:JSON.stringify(mcpError?{code:'TEST_REFUSAL'}:data)}]};
  return {ok:true,status:200,headers:{get(){return null;}},text:async()=>JSON.stringify({jsonrpc:'2.0',id:request.id,result})};}};
 const file=process.env.TERMINAL_SCRIPT || path.join(root,'assets/terminal.js');
 vm.runInNewContext(fs.readFileSync(file,'utf8'),context);
 return {get,calls,window,copied,html};
}
const flush=()=>new Promise(resolve=>setImmediate(resolve));
async function loaded(options){const result=rig(options);for(let i=0;i<8;i++)await flush();return result;}
const recoveryLink=state=>state.children.find(x=>x.tagName==='A'&&x.href==='https://jupie202020.pythonanywhere.com/marketplace/browse/');

test('current Terminal display renders real decoded publication fields after initialize and search',async()=>{
 const r=await loaded();assert.equal(r.calls.length,2);
 assert.equal(r.calls[0].method,'initialize');assert.equal(r.calls[1].params.name,'aap_public_listing_search');
 assert.equal(r.get('terminal-listings').children.length,1);
 const text=r.get('terminal-listings').textContent;
 assert.match(text,/DEMO - exact public test/);assert.match(text,/One synthetic brief/);assert.match(text,/Wants: GBP 40\.00/);
 assert.match(text,/Example · no orders/);assert.match(text,/Draft from this example/);
 assert.match(r.get('terminal-market-state').textContent,/1 displayed/);
});

test('publisher text remains literal with two known flags and unknown flags stay hidden',async()=>{
 const advert=publication();advert.fields.title='<strong>Unofficial report</strong>';
 const r=await loaded({publications:[advert],flags:{plain:'<script>alert(1)</script>',flags:[{flag:'LINKS_IN_TEXT',detail:'<img>'},{flag:'AGENT_INSTRUCTIONS'},{flag:'UNRECOGNIZED'}]}});
 const text=r.get('terminal-listings').textContent;
 assert.match(text,/<strong>Unofficial report<\/strong>/);
 assert.match(text,/Publisher’s advert/);assert.match(text,/contains web addresses/);assert.match(text,/contains instructions addressed to agents/);
 assert.doesNotMatch(text,/<script>|<img>|UNRECOGNIZED/);
});

test('filtered empty results can be cleared without repeating initialization',async()=>{
 const r=await loaded();
 r.get('terminal-query').value='missing service';
 r.get('terminal-search').handlers.submit({preventDefault(){}});
 for(let i=0;i<8;i++)await flush();
 assert.match(r.get('terminal-market-state').textContent,/No public adverts matched/);
 assert.equal(r.get('terminal-empty-actions').hidden,false);
 assert.equal(r.get('terminal-reset').hidden,false);
 r.get('terminal-reset').handlers.click();
 for(let i=0;i<8;i++)await flush();
 assert.equal(r.calls.filter(call=>call.method==='initialize').length,1);
 assert.equal(r.calls.at(-1).params.arguments.query,'');
 assert.equal(r.get('terminal-query').value,'');
 assert.equal(r.get('terminal-listings').children.length,1);
 assert.equal(r.get('terminal-empty-actions').hidden,true);
});

test('local previews send no search, link to live browsing and copy the visible engine address',async()=>{
 const r=await loaded({local:true});
 assert.equal(r.calls.length,0);
 assert.equal(r.get('terminal-find').disabled,true);
 assert.equal(r.get('terminal-route').disabled,false);
 const state=r.get('terminal-market-state');
 assert.match(state.textContent,/local preview/);
 assert.ok(state.children.some(x=>x.tagName==='A'&&x.href==='https://covenant-common.github.io/covenant-docs/docs/TERMINAL.html'));
 await r.get('terminal-copy').handlers.click();
 const visible=r.html.match(/id="terminal-mcp"[^>]*>([^<]+)</)[1];
 assert.equal(visible,'https://jupie202020.pythonanywhere.com/mcp/engine/v1');
 assert.deepEqual(r.copied,[visible]);
});

test('older shared helper yields an explicit local display outcome after a successful search, not a false outage or phantom count',async()=>{
 const r=await loaded({structures:older()});assert.equal(r.calls.length,2);
 const state=r.get('terminal-market-state');assert.match(state.textContent,/Search succeeded, but this page could not display/);
 assert.match(state.textContent,/No adverts have been displayed/);assert.ok(recoveryLink(state));
 assert.doesNotMatch(state.textContent,/Public search unavailable|Previously loaded|1 displayed/);
 assert.equal(r.get('terminal-listings').children.length,0);assert.equal(r.get('terminal-more').hidden,true);
});

test('missing whole search helper makes no request and gives the independent current-adverts link',async()=>{
 const r=await loaded({structures:null});assert.equal(r.calls.length,0);
 const state=r.get('terminal-market-state');assert.match(state.textContent,/could not load its search helper/);
 assert.match(state.textContent,/No search was sent/);assert.ok(recoveryLink(state));
 assert.doesNotMatch(state.textContent,/Public search unavailable|No public adverts matched|Search succeeded/);
});

test('an actual MCP refusal remains a refused search even when the display helper is older',async()=>{
 const r=await loaded({structures:older(),mcpError:true});assert.equal(r.calls.length,2);
 const state=r.get('terminal-market-state');assert.match(state.textContent,/Public search unavailable: The service refused this search/);
 assert.doesNotMatch(state.textContent,/Search succeeded|could not display|No public adverts matched/);
 assert.equal(r.get('terminal-listings').children.length,0);assert.equal(recoveryLink(state),undefined);
});

test('valid empty inventory is not relabelled as local display failure when no card needs rendering',async()=>{
 const r=await loaded({structures:older(),publications:[]});assert.equal(r.calls.length,2);
 const state=r.get('terminal-market-state');assert.match(state.textContent,/No public adverts matched/);
 assert.doesNotMatch(state.textContent,/unavailable|could not display|No search was sent/);
 assert.equal(r.get('terminal-listings').children.length,0);
});

test('only successfully appended cards enter the displayed-id set and duplicate ids stay deduplicated',async()=>{
 const p=publication(),r=await loaded({publications:[p,p]});assert.equal(r.calls.length,2);
 assert.equal(r.get('terminal-listings').children.length,1);
 assert.match(r.get('terminal-market-state').textContent,/1 displayed; 2 matched/);
});

// A failed new query must not silently relabel an earlier page of adverts.
test('previous cards remain explicitly stale if the search helper disappears before another query',async()=>{
 const r=await loaded();assert.equal(r.get('terminal-listings').children.length,1);
 r.window.AAPDealStructures=null;r.get('terminal-query').value='a different service';
 r.get('terminal-search').handlers.submit({preventDefault(){}});
 for(let i=0;i<8;i++)await flush();
 assert.equal(r.calls.length,2);assert.equal(r.get('terminal-listings').children.length,1);
 assert.match(r.get('terminal-market-state').textContent,/No search was sent.*Previously displayed adverts remain below/);
 assert.ok(recoveryLink(r.get('terminal-market-state')));
});
