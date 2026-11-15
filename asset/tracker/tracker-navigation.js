(() => {
  'use strict';
  const baselines=new WeakMap();
  const participants=new Set();
  const bypass=new WeakSet();
  let allowUnload=false;
  function values(dialog) {
    return JSON.stringify([...dialog.querySelectorAll('input,select,textarea')].filter(input=>!input.readOnly&&!['button','submit','hidden','file'].includes(input.type)).map(input=>[input.id||input.name,input.type==='checkbox'?input.checked:input.value]));
  }
  function dirtyDialogs() {
    return [...document.querySelectorAll('dialog[open]')].filter(dialog=>dialog.id!=='trackerLeaveDialog'&&dialog.id!=='financeConfirm'&&baselines.has(dialog)&&baselines.get(dialog)!==values(dialog));
  }
  function saving() {return [...document.querySelectorAll('dialog[open]')].some(dialog=>dialog.dataset.saving==='true'||dialog.querySelector('#saveTx:disabled,#fp-form-save:disabled,#financeSetupForm button[type=submit]:disabled,#currencyForm button[type=submit]:disabled,#accountAdjustmentForm button[data-busy=true]'));}
  function dirty() {
    const currency=document.getElementById('setupCurrency');
    return [...participants].some(fn=>fn())||saving()||dirtyDialogs().length>0||Boolean(currency&&(window.trackerSetupCurrency||window.trackerFinanceSnapshot?.currency)&&currency.value!==(window.trackerSetupCurrency||window.trackerFinanceSnapshot.currency));
  }
  function persist() { window.dispatchEvent(new Event('tracker-persist-draft')); }
  async function check(navigation=false) {
    if(document.getElementById('modalContent')?.dataset.saving==='true'){window.trackerFeedback?.notify('Wait for the current task save to finish.','error');return false;}
    if(saving()){window.trackerFeedback?.notify('Please wait for the current save to finish.','error');return false;}
    if(!dirty()){if(navigation)allowUnload=true;return true;}
    persist();
    const dialog=document.getElementById('trackerLeaveDialog');
    if(!dialog||dialog.open)return false;
    dialog.returnValue='cancel';dialog.showModal();
    const leave=await new Promise(resolve=>dialog.addEventListener('close',()=>resolve(dialog.returnValue==='leave'),{once:true}));
    if(leave&&navigation)allowUnload=true;
    return leave;
  }
  window.trackerNavigation={register(fn){participants.add(fn);return()=>participants.delete(fn);},check,isDirty:dirty,markDirty(dialog){baselines.set(dialog,'');},allowUnload(){persist();allowUnload=true;}};
  window.addEventListener('beforeunload',event=>{
    persist();
    if(!allowUnload&&dirty()){event.preventDefault();event.returnValue='';}
  });
  window.addEventListener('pagehide',persist);
  document.addEventListener('DOMContentLoaded',()=>{
    const prompt=document.createElement('dialog');prompt.id='trackerLeaveDialog';prompt.className='tracker-utility-dialog';
    prompt.innerHTML='<form method="dialog"><span class="finance-pill tone-amber">Unsaved changes</span><h2>Leave this form?</h2><p>Your changes have not been submitted. New transaction drafts are kept in this browser. Other unsaved form changes will be discarded.</p><div class="tracker-utility-actions"><button value="cancel" autofocus>Keep editing</button><button value="leave">Leave</button></div></form>';
    document.body.append(prompt);
    document.querySelectorAll('dialog').forEach(dialog=>{
      if(dialog===prompt||dialog.id==='financeConfirm')return;
      new MutationObserver(()=>{if(dialog.open&&!baselines.has(dialog))baselines.set(dialog,values(dialog));if(!dialog.open)baselines.delete(dialog);}).observe(dialog,{attributes:true,attributeFilter:['open']});
      dialog.addEventListener('cancel',async event=>{
        if(!dirtyDialogs().includes(dialog))return;
        event.preventDefault();if(await check())dialog.close();
      });
    });
    document.addEventListener('click',async event=>{
      const link=event.target.closest('a[href]');
      if(link&&!link.target&&link.origin===location.origin&&!link.getAttribute('href').startsWith('#')&&dirty()){
        event.preventDefault();event.stopImmediatePropagation();if(await check(true))location.assign(link.href);return;
      }
      const button=event.target.closest('button');
      if(!button||bypass.has(button))return;
      if(button.matches('.tab-btn,.report-subtab')&&dirty()){
        event.preventDefault();event.stopImmediatePropagation();if(await check()){bypass.add(button);button.click();bypass.delete(button);}return;
      }
      const dialog=button.closest('dialog');
      const closes=dialog&&(button.value==='cancel'||/cancel|close/i.test(button.id)||button.getAttribute('aria-label')?.startsWith('Close'));
      if(closes&&dirtyDialogs().includes(dialog)){
        event.preventDefault();event.stopImmediatePropagation();
        if(await check()){bypass.add(button);button.click();bypass.delete(button);}
      }
    },true);
  });
})();
