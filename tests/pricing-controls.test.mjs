import test from 'node:test';
import assert from 'node:assert/strict';
import {betaQuote} from '../assets/pricing-controls.mjs';

test('beta proposal charges a base and only additional executors above five',()=>{
  for(let count=1;count<=10;count++){
    const quote=betaQuote(count);
    assert.deepEqual(quote,{executors:count,base:7200,included:5,additional:Math.max(0,count-5),rate:500,total:7200+500*Math.max(0,count-5)});
  }
  assert.equal(betaQuote(5).total,7200);
  assert.equal(betaQuote(6).total,7700);
  assert.equal(betaQuote(10).total,9700);
});
test('invalid or unsupported counts are refused without clamping or coercion',()=>{
  for(const count of [0,-1,11,100,1.5,NaN,Infinity,-Infinity,true,false,'5','',null,undefined,{},[],5n]){
    assert.throws(()=>betaQuote(count),/EXECUTOR_COUNT/);
  }
});
test('a calculation returns fresh values and does not turn a prior result into an order',()=>{
  const first=betaQuote(6);first.total=1;
  assert.equal(betaQuote(6).total,7700);
  assert.equal(Object.hasOwn(betaQuote(5),'accepted'),false);
  assert.equal(Object.hasOwn(betaQuote(5),'payment'),false);
});
