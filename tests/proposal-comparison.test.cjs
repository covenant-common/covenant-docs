const test=require('node:test'),assert=require('node:assert/strict');
const d=require('../assets/deal-structures.js');
function record(id,clauses){return {id:id.repeat(64),status:'UNSIGNED_DRAFT',binding:false,execution_authorized:false,draft:{version:'covenant-contract-draft/0.1',title:'TEST ONLY',parties:['buyer','seller'],clauses,settlement:{},dispute:{},conditions:[],extensions:{},supersedes:null}};}
test('one deadline edit shows that clause alone, keeps exact before/after values and requires new assent',()=>{
  const a=record('a',[{id:'scope',title:'Work',text:'One page'},{id:'deadline',title:'Deadline',text:'Friday'}]);
  const b=structuredClone(a);b.id='b'.repeat(64);b.draft.clauses[1].text='Saturday';
  const result=d.compareProposals(a,b);
  assert.equal(result.changes.length,1);assert.equal(result.changes[0].id,'deadline');
  assert.equal(result.changes[0].before,'Deadline: Friday');assert.equal(result.changes[0].after,'Deadline: Saturday');
  assert.equal(result.requires_fresh_assent,true);
  assert.equal(d.compareProposals(a,a).requires_fresh_assent,false);
});
test('added/removed clauses and other fields are visible; misleading binding flags and duplicate IDs refuse',()=>{
  const a=record('a',[{id:'scope',title:'Work',text:'One page'}]);const b=structuredClone(a);b.id='b'.repeat(64);b.draft.clauses=[{id:'price',title:'Price',text:'USD25'}];b.draft.parties.push('reviewer');
  const result=d.compareProposals(a,b);assert.equal(result.changes.filter(c=>c.kind==='clause').length,2);assert.ok(result.changes.find(c=>c.title==='parties'));
  assert.throws(()=>d.compareProposals(a,{...b,binding:true}));
  b.draft.clauses.push(b.draft.clauses[0]);assert.throws(()=>d.compareProposals(a,b));
});
