/* Copy-only controls: no command execution, network, storage or analytics. */
export function attachCopies(root=document){
  for(const button of root.querySelectorAll('[data-copy]')){
    button.disabled=false;
    button.addEventListener('click',async()=>{
      const source=root.getElementById(button.dataset.copy),status=button.nextElementSibling;
      if(!source||!status)return;
      try{
        if(!navigator.clipboard?.writeText)throw Error('COPY_UNAVAILABLE');
        await navigator.clipboard.writeText(source.textContent);
        status.textContent='Command copied. Review it before running.';
      }catch{
        const selection=window.getSelection(),range=document.createRange();
        range.selectNodeContents(source);selection.removeAllRanges();selection.addRange(range);
        status.textContent='Command selected. Copy it manually; nothing was run.';
      }
    });
  }
}
if(typeof document!=='undefined')attachCopies();
