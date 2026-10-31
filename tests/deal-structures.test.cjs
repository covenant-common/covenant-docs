/* Synthetic fixtures only. No real service advert, identity or payment. */
'use strict';
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
if (!globalThis.crypto) globalThis.crypto = crypto.webcrypto;
const S = require('../assets/deal-structures.js');
const publisher='https://jupie202020.pythonanywhere.com';
const identifier='a'.repeat(64);
function publication(){return {id:identifier,url:publisher+'/marketplace/'+identifier,visibility:'INDEXED',fields:{title:'Synthetic fixture: research brief',category:'research',custom:{description:'One test brief.',scope:'For a synthetic test only.'},offer:[{amount:1,asset:{namespace:'service',identifier:'test-brief',unit:'brief',adapter:'not-copied'}}],want:[{amount:2500,asset:{namespace:'fiat',identifier:'USD',unit:'cents'}}]},consent:{not_verified:'never read or promoted'}};}
function input(template='fixed-deliverable',advert=null){return {template_id:template,fields:{title:'Synthetic structure test',buyer:'Synthetic buyer',supplier:'Synthetic supplier',deliverable:'Deliver one synthetic brief.',price:'USD 25.00'},details:'Stage one: outline, by Friday, buyer review.\nStage two: final brief, by Monday, buyer review.',selected_advert:advert,specialist_acknowledged:false};}
const checks=[];
(async()=>{
 const pins=[];
 for(const t of S.catalogue()){
  const pin=await S.templatePin(t.id);
  const independent=crypto.createHash('sha256').update(Buffer.from('AAP-DEAL-STRUCTURE-TEMPLATE-0.1\0'+S.canonical(t),'ascii')).digest('hex');
  assert.equal(pin.hash,independent);assert.equal(pin.snapshot.execution_authorized,false);
  pins.push({id:t.id,revision:t.revision,hash:pin.hash});
 }
 checks.push('All exact ASCII template snapshots match independently invoked SHA-256 with the declared domain.');
 const source=publication();
 Object.defineProperty(source.fields.custom,'private_note',{enumerable:true,get(){throw new Error('Private note read');}});
 Object.defineProperty(source.fields.offer[0].asset,'transfer_terms',{enumerable:true,get(){throw new Error('Transfer configuration read');}});
 const advert=S.advertFromPublication(source);assert.equal(advert.source_kind,'PUBLIC_SEARCH_PROJECTION');assert.equal(advert.provenance_verified,false);assert.ok(!('consent_hash'in advert));assert.ok(!JSON.stringify(advert).includes('private_note'));assert.ok(!JSON.stringify(advert).includes('transfer_terms'));assert.equal(advert.snapshot.want[0].amount,2500);
 checks.push('Public selection carries exact visible amounts/units and reference, omitting private custom fields and unverified consent metadata.');
 const fixed=await S.buildDraft(input('fixed-deliverable',advert));
 const e=fixed.request.extensions.aap_deal_structure;
 assert.equal(e.selected_advert.id,identifier);assert.equal(e.selected_advert.publisher,publisher);assert.equal(e.source_pin_status,'MISSING_EXACT_VERIFIED_SOURCE');assert.equal(e.role,'BUYER_PROPOSED');assert.equal(e.template_revision,1);assert.equal(e.template_hash,pins.find(p=>p.id==='fixed-deliverable').hash);assert.deepEqual(e.template_snapshot,S.template('fixed-deliverable'));
 const nativeBody={version:'covenant-contract-draft/0.1',title:fixed.request.title,parties:fixed.request.parties,clauses:fixed.request.clauses,conditions:[],settlement:{},dispute:{},extensions:fixed.request.extensions,supersedes:null};
 const reply={draft:JSON.parse(JSON.stringify(nativeBody))};
 assert.equal(S.responseRetains(fixed.request,reply),true);reply.draft.extensions.aap_deal_structure.selected_advert.id='b'.repeat(64);assert.equal(S.responseRetains(fixed.request,reply),false);assert.equal(S.responseRetains(fixed.request,{draft:{extensions:{}}}),false);
 for(const mutate of [body=>{body.title='Changed title';},body=>{body.parties[0]='Changed party';},body=>{body.clauses[1].text='USD 999.00';},body=>{body.extra='unexpected';},body=>{body.conditions.push('new condition');}]){const changedReply={draft:JSON.parse(JSON.stringify(nativeBody))};mutate(changedReply.draft);assert.equal(S.responseRetains(fixed.request,changedReply),false);}
 checks.push('The complete native draft body, defaults, exact recipe and advert reference must match; altered title, party, price clause, conditions or extra fields refuse.');
 const session=new S.SelectionSession();session.select(advert);const old=session.capture();assert.equal(session.retain(old,'old-result'),true);session.select(null);assert.equal(session.output,null);assert.equal(session.retain(old,'stale-result'),false);const edited=session.capture();session.invalidate();assert.equal(session.retain(edited,'stale-after-edit'),false);
 checks.push('Changed advert or edited terms invalidate old output and reject in-flight stale responses.');
 const handoff=await S.makeHandoff(publication());assert.deepEqual(await S.readHandoff(JSON.stringify(handoff)),advert);const changed=JSON.parse(JSON.stringify(handoff));changed.advert.snapshot.title='Changed title';await assert.rejects(S.readHandoff(JSON.stringify(changed)),/changed/);changed.advert.snapshot.private_note='not allowed';await assert.rejects(S.readHandoff(JSON.stringify(changed)),/Unexpected/);
 checks.push('Explicit handoff round-trips; changed content and unexpected private fields refuse without rewriting a hash.');
 const hostile=publication();hostile.url='javascript:alert(1)';assert.throws(()=>S.advertFromPublication(hostile),/link/);hostile.url=publisher+'/marketplace/'+'b'.repeat(64);assert.throws(()=>S.advertFromPublication(hostile),/link/);hostile.url='https://attacker.example/marketplace/'+identifier;assert.throws(()=>S.advertFromPublication(hostile),/link/);
 const escaped=input();escaped.fields.title='<img src=x onerror=alert(1)>';escaped.fields.deliverable='Literal <script> text & no execution.';const safe=await S.buildDraft(escaped);assert.equal(safe.request.title,escaped.fields.title);assert.equal(safe.request.clauses[0].text,escaped.fields.deliverable);for(const name of ['matrix.js','terminal.js','deal-structures.js'])assert.ok(!fs.readFileSync(require('node:path').join(__dirname,'../assets',name),'utf8').includes('innerHTML'));
 checks.push('Hostile or mismatched advert URLs refuse; authored markup remains literal text and every view uses text-node rendering.');
 const staged=await S.buildDraft(input('staged-milestones'));assert.equal(staged.extension.proposed_terms.milestones.length,2);assert.equal(staged.request.clauses.filter(c=>c.id.startsWith('milestone-')).length,2);const barter=await S.buildDraft(input('reciprocal-exchange'));assert.equal(barter.request.clauses[1].title,'Reciprocal undertaking');assert.equal(barter.extension.source_pin_status,'NOT_APPLICABLE_NO_ADVERT');
 checks.push('Staged and reciprocal recipes compile explicit duties without fabricating source pins, scheduling or settlement.');
 await assert.rejects(S.buildDraft(input('contingent-rights-draft')),/drafting-only/);const option=input('contingent-rights-draft');option.specialist_acknowledged=true;const descriptor=await S.buildDraft(option);assert.equal(descriptor.extension.template_snapshot.status,'DRAFTING_ONLY_NO_OPTIONS_LIFECYCLE');assert.equal(descriptor.extension.execution_authorized,false);assert.ok(descriptor.request.clauses.some(c=>c.id==='specialist-boundary'));assert.throws(()=>S.template('unknown-template'),/known/);
 checks.push('Specialist contingent rights require explicit acknowledgement and remain descriptors without an options lifecycle.');
 const result={status:'PASS',cases:checks.length,checks,template_pins:pins,scope:'Focused synthetic frontend proposal and privacy regressions; not source authenticity, legal effect, custody or market execution.'};
 fs.writeFileSync('/private/tmp/aap-deal-structures-public-checks-20261031.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
})().catch(error=>{console.error(error);process.exitCode=1;});
