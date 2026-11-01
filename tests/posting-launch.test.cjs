'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const P = require('../assets/posting-launch.js');
test('The launch notice lasts exactly thirty days', () => {
  assert.equal(P.endsAt-P.startsAt,30*86400000);
});
test('Start is included and expiry is excluded', () => {
  assert.equal(P.stateAt(P.startsAt-1).phase,'scheduled');
  assert.equal(P.stateAt(P.startsAt).phase,'active');
  assert.equal(P.stateAt(P.endsAt-1).phase,'active');
  assert.equal(P.stateAt(P.endsAt).phase,'ended');
});
test('The ordinary-posting message stays free on both sides of expiry', () => {
  for (const now of [P.startsAt-1,P.startsAt,P.endsAt-1,P.endsAt,P.endsAt+86400000]) {
    const state=P.stateAt(now);
    assert.ok(state.text.includes('posts are free'));
    assert.ok(state.text.includes('Promoted placements and deal fees are separate'));
    assert.equal(state.text.includes('launch month'),state.phase==='active');
  }
});
test('An invalid clock shows the normal message, without a launch claim', () => {
  for (const now of [NaN,Infinity,null,'2026-11-01']) {
    assert.equal(P.stateAt(now).phase,'unknown');
    assert.equal(P.stateAt(now).text,P.stateAt(P.endsAt).text);
  }
});
function fixture(now) {
  let value=now, next=0;
  const jobs=new Map(), listeners=new Map();
  const node={textContent:'',setAttribute(name,v){this[name]=v;}};
  const doc={hidden:false,querySelectorAll(selector){assert.equal(selector,'[data-posting-launch]');return [node];},addEventListener(k,f){listeners.set(k,f);},removeEventListener(k,f){if(listeners.get(k)===f)listeners.delete(k);}};
  const timers={setTimeout(f,delay){const id=++next;jobs.set(id,{f,delay});return id;},clearTimeout(id){jobs.delete(id);}};
  const stop=P.mount(doc,()=>value,timers);
  return {node,doc,jobs,listeners,stop,setNow(v){value=v;}};
}
test('An open page automatically returns to normal at the expiry boundary', () => {
  const f=fixture(P.endsAt-25);
  assert.equal(f.node['data-launch-phase'],'active');
  assert.equal(f.jobs.size,1);
  const [id,job]=[...f.jobs][0];assert.equal(job.delay,25);
  f.setNow(P.endsAt);f.jobs.delete(id);job.f();
  assert.equal(f.node['data-launch-phase'],'ended');
  assert.equal(f.node.textContent,P.stateAt(P.endsAt).text);
  assert.equal(f.jobs.size,0);f.stop();
});
test('Returning from a suspended tab refreshes expired launch copy immediately', () => {
  const f=fixture(P.startsAt);f.doc.hidden=true;f.setNow(P.endsAt+1);
  f.listeners.get('visibilitychange')();assert.equal(f.node['data-launch-phase'],'active');
  f.doc.hidden=false;f.listeners.get('visibilitychange')();
  assert.equal(f.node['data-launch-phase'],'ended');assert.equal(f.jobs.size,0);f.stop();
});
test('Long waits are bounded and cleanup cancels the timer and listener', () => {
  const f=fixture(P.startsAt-100000);assert.equal([...f.jobs.values()][0].delay,60000);
  f.stop();assert.equal(f.jobs.size,0);assert.equal(f.listeners.size,0);
});
test('Pages without the notice schedule nothing', () => {
  const stop=P.mount({querySelectorAll(){return [];}},()=>{throw Error('unused');},{setTimeout(){throw Error('unused');}});
  stop();
});

test('Minute refreshes do not repeat an unchanged status announcement', () => {
  let writes=0, text='';
  const node={get textContent(){return text;},set textContent(v){text=v;writes++;},setAttribute(){}};
  const tasks=new Map();let next=0;
  const doc={querySelectorAll(){return [node];},addEventListener(){},removeEventListener(){}};
  const timers={setTimeout(f){const n=++next;tasks.set(n,f);return n;},clearTimeout(n){tasks.delete(n);}};
  const stop=P.mount(doc,()=>P.startsAt,timers);assert.equal(writes,1);
  const [id,fn]=[...tasks][0];tasks.delete(id);fn();assert.equal(writes,1);stop();
});
