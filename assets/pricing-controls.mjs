// Local-only proposed pricing controls. No metering, telemetry, requests, orders or payment.
export function betaQuote(n){if(typeof n!=='number'||!Number.isInteger(n)||n<1||n>10)throw Error('EXECUTOR_COUNT');return{executors:n,base:7200,included:5,additional:Math.max(0,n-5),rate:500,total:7200+500*Math.max(0,n-5)};}
if (typeof document !== "undefined") {
const field=document.getElementById('executors'),total=document.getElementById('beta-total'),detail=document.getElementById('beta-breakdown'),copy=document.getElementById('copy-beta'),status=document.getElementById('quote-copy-status');
let quote=null;
function renderQuote(){
 status.textContent='';
 try{
  quote=betaQuote(Number(field.value));
  total.textContent='USD '+quote.total.toLocaleString('en-US')+' a year for one deployment ('+quote.executors+' executor'+(quote.executors===1?'':'s')+').';
  detail.textContent='Five executors included. '+(quote.additional?quote.additional+' extra at USD 500 each a year.':'No extras needed.')+' Proposed price; not yet for sale.';
  copy.disabled=false;
 }catch{
  quote=null;total.textContent='Enter a whole number between 1 and 10.';
  detail.textContent='Need more than ten? Contact us.';copy.disabled=true;
 }
}
field.addEventListener('input',renderQuote);
copy.addEventListener('click',async()=>{
 if(!quote)return;
 const text=total.textContent+' '+detail.textContent+' This calculation covers one deployment. Final terms are agreed with us.';
 try{
  if(!navigator.clipboard?.writeText)throw Error('COPY_UNAVAILABLE');
  await navigator.clipboard.writeText(text);status.textContent='Calculation copied.';
 }catch{
  const range=document.createRange();range.selectNodeContents(total);const selected=window.getSelection();selected.removeAllRanges();selected.addRange(range);
  status.textContent='Total selected. Copy it manually.';
 }
});
renderQuote();
}
