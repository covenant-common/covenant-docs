const test=require('node:test'),assert=require('node:assert/strict');
const crypto=require('node:crypto').webcrypto;
const client=require('../assets/trial-client.js');
const hex=b=>Buffer.from(b).toString('hex');
async function proposal(access){
  const now=Math.floor(Date.now()/1000),body={version:'urn:aap:hosted-trial-access:0.1',domain:'AAP_SELF_SERVE_TRIAL_ACCESS',origin:client.ORIGIN,service:'a'.repeat(64),actor:access.actor,token_sha256:await client.tokenDigest(access.token,crypto),client_nonce:access.client_nonce,challenge:'b'.repeat(64),issued_at:now,challenge_expires:now+600,trial_expires:now+14*86400,scopes:['listings:read','listings:write','trades:read','trades:write']};
  const label='AAP-HOSTED-TRIAL-POSSESSION-0.1';
  return {now,response:{challenge:{body,mac:'c'.repeat(64)},signing_payload:{label,body,message_hex:hex(new TextEncoder().encode(label+'\0'+client.canonical(body)))}}};
}
test('browser credentials stay client-owned and actual Ed25519 signs only the matching trial message',async()=>{
  const access=await client.generate(crypto),{now,response}=await proposal(access);
  const ready=await client.approveChallenge(access,response,crypto,now);
  const key=await crypto.subtle.importKey('raw',Buffer.from(access.actor,'hex'),'Ed25519',false,['verify']);
  assert.equal(await crypto.subtle.verify('Ed25519',key,Buffer.from(ready.signature,'hex'),Buffer.from(response.signing_payload.message_hex,'hex')),true);
  assert.equal(access.challenge,null);assert.notEqual(access.private_seed,access.actor);
  const grant={version:'urn:aap:hosted-trial-access:0.1',tenant:'trial-'+'d'.repeat(32),actor:access.actor,token_id:response.challenge.body.token_sha256,expires:response.challenge.body.trial_expires,scopes:response.challenge.body.scopes,status:'ACTIVE',signing_authority_granted:false,token_returned:false};
  const active=client.acceptGrant(ready,grant),config=client.configuration(active);
  assert.equal(config.mcpServers['covenant-account'].headers.Authorization,'Bearer '+access.token);
  assert.ok(!JSON.stringify(config).includes(access.private_seed));
  assert.throws(()=>client.acceptGrant(ready,{...grant,actor:'0'.repeat(64)}));
});
test('malicious message bytes, scopes, origin, identity and expiry refuse before signing',async()=>{
  const access=await client.generate(crypto),{now,response}=await proposal(access);
  const changed=change=>{const copy=structuredClone(response);change(copy);return copy;};
  for(const input of [
    changed(p=>p.signing_payload.message_hex='00'),
    changed(p=>p.challenge.body.origin='https://evil.example'),
    changed(p=>p.challenge.body.actor='0'.repeat(64)),
    changed(p=>p.challenge.body.token_sha256='0'.repeat(64)),
    changed(p=>p.challenge.body.scopes.push('operator')),
    changed(p=>p.challenge.body.trial_expires+=86400),
    changed(p=>p.challenge.body.extra='not-approved'),
    changed(p=>p.challenge.body.issued_at=true)
  ]) await assert.rejects(client.approveChallenge(access,input,crypto,now));
  await assert.rejects(client.approveChallenge({...access,private_seed:'0'.repeat(64)},response,crypto,now));
});
test('restoration and configuration keep the target fixed and never import private credentials from another host',async()=>{
  const access=await client.generate(crypto);
  assert.throws(()=>client.validateAccess({...access,origin:'https://evil.example'}));
  assert.throws(()=>client.validateAccess({...access,command:'run-me'}));
  assert.throws(()=>client.configuration(access));
  assert.equal(client.validateAccess(JSON.parse(JSON.stringify(access))).actor,access.actor);
});
test('a status check that never answers is replaced by the fallback, and a normal answer still opens the trial',async()=>{
  const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
  const fallback='Automatic setup could not be reached. Public tools may still be available. You can request setup help below.';
  function boot(fetchImpl){
    const timers=[];
    const nodes={};
    function element(id){return {id,disabled:id==='trial-start',hidden:false,textContent:id==='trial-state'?'Checking whether trials are open…':'',addEventListener(){},files:[]};}
    const document={getElementById(id){return nodes[id]||(nodes[id]=element(id));},createElement(){return element('made');},body:{appendChild(){}}};
    const context={document,fetch:fetchImpl,TextEncoder,setTimeout(fn,ms){timers.push({fn,ms});return timers.length;},clearTimeout(){},addEventListener(){},AbortController:class{constructor(){this.signal={};}abort(){this.signal.aborted=true;}}};
    context.globalThis=context;
    vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../assets/trial-client.js'),'utf8'),context);
    return {timers,state:()=>document.getElementById('trial-state').textContent,start:()=>document.getElementById('trial-start')};
  }
  const hung=boot(()=>new Promise(()=>{}));
  assert.equal(hung.state(),'Checking whether trials are open…');
  const watchdog=hung.timers.find(timer=>timer.ms===15000);
  assert.ok(watchdog);
  watchdog.fn();
  assert.equal(hung.state(),fallback);
  assert.equal(hung.start().disabled,true);
  const closed=boot(async()=>({ok:true,json:async()=>({ok:true,result:{enabled:true,signup_open:false,limits:{total_calls:1000}}})}));
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(closed.state(),'Automatic trial setup is not open on this host. Public tools still work; you can request help below.');
  const open=boot(async()=>({ok:true,json:async()=>({ok:true,result:{enabled:true,signup_open:true,limits:{total_calls:1000}}})}));
  await new Promise(resolve=>setImmediate(resolve));
  assert.match(open.state(),/Trials are open\. Your trial lasts 14 days and includes up to 1000 account requests/);
  assert.equal(open.start().disabled,false);
});
