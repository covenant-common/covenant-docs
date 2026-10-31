/* Client-owned signing and access credentials. No private signing key leaves this page. */
(function (global) {
  'use strict';
  const ORIGIN='https://jupie202020.pythonanywhere.com', VERSION='aap-private-trial-client/0.1';
  const LABEL='AAP-HOSTED-TRIAL-POSSESSION-0.1', SCOPES=['listings:read','listings:write','trades:read','trades:write'];
  const encoder=new TextEncoder(), hex=(bytes)=>Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');
  function need(value,message){if(!value)throw new Error(message);}
  function unhex(value){need(typeof value==='string'&&/^(?:[0-9a-f]{2})+$/.test(value),'The setup bytes are incomplete.');return Uint8Array.from(value.match(/../g),b=>parseInt(b,16));}
  function canonical(value){if(Array.isArray(value))return '['+value.map(canonical).join(',')+']';if(value&&typeof value==='object')return '{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+canonical(value[k])).join(',')+'}';return JSON.stringify(value);}
  function bytes64(value){return Uint8Array.from(global.atob(value.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0));}
  async function tokenDigest(token,crypto){return hex(new Uint8Array(await crypto.subtle.digest('SHA-256',encoder.encode('AAP-HOSTED-API-TOKEN-0.1\0'+token))));}
  function validateAccess(value){
    need(value&&typeof value==='object'&&!Array.isArray(value)&&value.version===VERSION&&value.origin===ORIGIN,'Use the private access file for this service.');
    need(Object.keys(value).every(k=>['version','origin','actor','private_seed','token','client_nonce','challenge','signature','grant'].includes(k)),'The access file has unexpected fields.');
    for(const name of ['actor','private_seed','token','client_nonce'])need(typeof value[name]==='string'&&/^[0-9a-f]{64}$/.test(value[name]),'The access file is incomplete.');
    return value;
  }
  async function generate(crypto){
    const keys=await crypto.subtle.generateKey({name:'Ed25519'},true,['sign','verify']);
    const privateJwk=await crypto.subtle.exportKey('jwk',keys.privateKey);
    const actor=hex(new Uint8Array(await crypto.subtle.exportKey('raw',keys.publicKey)));
    return {version:VERSION,origin:ORIGIN,actor,private_seed:hex(bytes64(privateJwk.d)),
      token:hex(crypto.getRandomValues(new Uint8Array(32))),client_nonce:hex(crypto.getRandomValues(new Uint8Array(32))),challenge:null,signature:null,grant:null};
  }
  async function approveChallenge(access,response,crypto,now){
    validateAccess(access);
    const envelope=response&&response.challenge, payload=response&&response.signing_payload;
    need(envelope&&Object.keys(envelope).sort().join(',')==='body,mac'&&/^[0-9a-f]{64}$/.test(envelope.mac),'The service returned an incomplete setup request.');
    const body=envelope.body;
    const fields=['version','domain','origin','service','actor','token_sha256','client_nonce','challenge','issued_at','challenge_expires','trial_expires','scopes'];
    need(body&&Object.keys(body).sort().join(',')===fields.sort().join(','),'The service changed the setup format.');
    need(body.version==='urn:aap:hosted-trial-access:0.1'&&body.domain==='AAP_SELF_SERVE_TRIAL_ACCESS'&&body.origin===ORIGIN&&body.actor===access.actor&&body.client_nonce===access.client_nonce&&body.token_sha256===await tokenDigest(access.token,crypto),'The setup does not match your identity and access file.');
    need(/^[0-9a-f]{64}$/.test(body.service)&&/^[0-9a-f]{64}$/.test(body.challenge)&&canonical(body.scopes)===canonical(SCOPES),'The service requested different account permissions.');
    for(const field of ['issued_at','challenge_expires','trial_expires'])need(Number.isSafeInteger(body[field]),'The setup dates are invalid.');
    need(Math.abs(body.issued_at-now)<=300&&body.challenge_expires>now&&body.challenge_expires>body.issued_at&&body.challenge_expires<=body.issued_at+600&&body.trial_expires>body.issued_at&&body.trial_expires<=body.issued_at+14*86400,'The setup request has expired or has different dates.');
    const message=encoder.encode(LABEL+'\0'+canonical(body));
    need(payload&&payload.label===LABEL&&canonical(payload.body)===canonical(body)&&payload.message_hex===hex(message),'The signing bytes do not match the account request.');
    const prefix=unhex('302e020100300506032b657004220420'), seed=unhex(access.private_seed), pkcs8=new Uint8Array(prefix.length+seed.length);pkcs8.set(prefix);pkcs8.set(seed,prefix.length);
    const signer=await crypto.subtle.importKey('pkcs8',pkcs8,{name:'Ed25519'},true,['sign']);
    const jwk=await crypto.subtle.exportKey('jwk',signer);
    need(hex(bytes64(jwk.x))===access.actor,'The private signing key does not match this account.');
    const signature=hex(new Uint8Array(await crypto.subtle.sign('Ed25519',signer,message)));
    return {...access,challenge:envelope,signature};
  }
  function acceptGrant(access,grant){
    const body=access.challenge&&access.challenge.body;
    need(body&&grant&&grant.version==='urn:aap:hosted-trial-access:0.1'&&grant.actor===access.actor&&grant.token_id===body.token_sha256&&grant.expires===body.trial_expires&&canonical(grant.scopes)===canonical(SCOPES)&&/^trial-[0-9a-f]{32}$/.test(grant.tenant)&&grant.signing_authority_granted===false&&grant.token_returned===false,'The returned account does not match your trial request.');
    need(grant.status==='ACTIVE','This trial is no longer active. Use the original access file to check its expiry.');
    return {...access,grant};
  }
  function configuration(access){validateAccess(access);need(access.grant&&access.grant.status==='ACTIVE','Activate the trial first.');return {mcpServers:{'covenant-account':{url:ORIGIN+'/mcp/account/v1',headers:{Authorization:'Bearer '+access.token}},'covenant-public':{url:ORIGIN+'/mcp'}}};}
  const api={ORIGIN,VERSION,generate,validateAccess,approveChallenge,acceptGrant,configuration,tokenDigest,canonical};
  if(typeof module==='object'&&module.exports)module.exports=api;
  global.AAPTrialClient=api;
  if(typeof document==='undefined'||!document.getElementById('trial-start'))return;
  let access=null,busy=false,urls=[],downloadAttempted=false;
  const el=id=>document.getElementById(id),say=value=>{el('trial-state').textContent=value;};
  async function call(path,body){
    const response=await global.fetch(ORIGIN+path,{method:body?'POST':'GET',mode:'cors',credentials:'omit',cache:'no-store',redirect:'error',headers:body?{'Content-Type':'application/json'}:{},body:body?JSON.stringify(body):undefined});
    const result=await response.json();
    if(!response.ok||result.ok!==true){const error=new Error(result.error&&result.error.fix||'Trial setup could not complete. Your current access file is unchanged.');error.code=result.error&&result.error.code;throw error;}
    return result.result;
  }
  function update(){el('trial-start').disabled=busy||!!access;el('trial-restore').disabled=busy;el('trial-save').disabled=!access;el('trial-config').disabled=!access||!access.grant;el('trial-retry').hidden=!access||!!access.grant;el('trial-retry').disabled=busy;el('trial-ready').hidden=!access||!access.grant;if(access&&access.grant)el('trial-expiry').textContent=new Date(access.grant.expires*1000).toLocaleString();}
  function save(value,name,containsSigningKey){const url=URL.createObjectURL(new Blob([JSON.stringify(value,null,2)+'\n'],{type:'application/json'}));urls.push(url);const a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();if(containsSigningKey)downloadAttempted=true;say('Download started. Check that the file was saved, and keep it private.');}
  async function activate(){
    if(busy||!access)return;busy=true;update();
    try{
      if(!access.challenge){say('Creating your trial request…');const response=await call('/trial/challenge',{actor:access.actor,token_sha256:await tokenDigest(access.token,global.crypto),client_nonce:access.client_nonce});access=await approveChallenge(access,response,global.crypto,Math.floor(Date.now()/1000));}
      say('Activating your account…');const grant=await call('/trial/start',{challenge:access.challenge,signature:access.signature,token:access.token});access=acceptGrant(access,grant);say('Your trial is ready. Save your private access file and connect your agent below.');
    }catch(error){say(error.message+' Keep this page open or save your access file. Continue uses the same request.');}
    finally{busy=false;update();}
  }
  el('trial-start').addEventListener('click',async()=>{
    if(busy||access)return;busy=true;update();
    try{need(global.isSecureContext&&global.crypto&&global.crypto.subtle,'Use a current browser over HTTPS to create your private signing key.');say('Creating your signing key in this browser…');access=await generate(global.crypto);downloadAttempted=false;}
    catch(_){say('This browser could not create an Ed25519 signing key. Try a current browser, or request setup help.');}
    finally{busy=false;update();}
    if(access)await activate();
  });
  el('trial-retry').addEventListener('click',activate);
  el('trial-save').addEventListener('click',()=>{if(access)save(access,'AAP-private-trial-access-'+access.actor.slice(0,8)+'.json',true);});
  el('trial-config').addEventListener('click',()=>{if(access&&access.grant)save(configuration(access),'AAP-private-MCP-config.json');});
  el('trial-restore').addEventListener('change',async(event)=>{
    const file=event.target.files[0];if(!file||busy)return;
    try{need(file.size<=32768,'That access file is too large.');const loaded=validateAccess(JSON.parse(await file.text()));access=loaded;downloadAttempted=true;update();say('Access file loaded in this browser. Continue uses its original request; it does not extend the trial.');}
    catch(_){say('That file could not be read as a trial access file. No file was sent to the service.');}
  });
  global.addEventListener('beforeunload',event=>{if(access&&!downloadAttempted){event.preventDefault();event.returnValue='';}});
  global.addEventListener('pagehide',()=>urls.forEach(url=>URL.revokeObjectURL(url)));
  call('/trial/status').then(status=>{if(status.enabled&&status.signup_open){el('trial-start').disabled=false;say('Trials are open. Your trial lasts 14 days and includes up to '+status.limits.total_calls+' account requests. No email or card needed.');}else{el('trial-start').disabled=true;say('Automatic trial setup is not open on this host. Public tools still work; you can request help below.');}}).catch(()=>{el('trial-start').disabled=true;say('Automatic setup could not be reached. Public tools may still be available. You can request setup help below.');});
})(typeof globalThis==='object'?globalThis:this);
