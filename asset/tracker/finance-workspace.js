(() => {
  'use strict';
  const Core=window.FinanceWorkspace,Planner=window.FinancePlanner;
  const byId=id=>document.getElementById(id);
  const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const token=()=>crypto.randomUUID();
  const money=(value,currency)=>esc(currency||window.trackerFinanceSnapshot?.currency||'₹')+' '+Number(value||0).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2});
  const pill=(text,tone)=>'<span class="finance-pill tone-'+tone+'">'+text+'</span>';
  const table=(headers,rows,columns=headers.length)=>'<div class="fp-table-scroll"><table class="fp-table"><thead><tr>'+headers.map(value=>'<th>'+value+'</th>').join('')+'</tr></thead><tbody>'+ (rows||'<tr><td colspan="'+columns+'">No records for this selection.</td></tr>')+'</tbody></table></div>';
  let tools={items:[],activity:[]},snapshot=window.trackerFinanceSnapshot||null;
  let page=0,sortBy='date',sortDirection='desc',cachedRows=[],paceChart=null,parsedCSV=null,previewRows=[],previewPage=0,importJob=null,catalogEdit=null,toolsRequest=null;
  const ledgerFilters={search:'',from:'',to:'',type:'',account:'',category:'',min:'',max:''};
  function items(type) {return tools.items.filter(item=>item.type===type);}
  function metadata(type,name){return tools.items.find(item=>item.type===type&&item.name===name);}
  function usage(type,name) {
    const used=metadata(type,name)?.usage;if(!used)return '';
    return used.transactions+' transactions · '+used.commitments+' commitments ('+used.activeCommitments+' active)'+(type==='account'?' · balance '+used.balance:'');
  }
  function ensureOption(id,name) {
    const input=byId(id);if(!input||!name)return;
    let option=[...input.options].find(option=>option.value===name);
    if(!option){option=new Option(name,name);input.add(option);}
    option.hidden=false;option.disabled=false;
  }
  function filterSelects() {
    const editing=byId('transactionDialog').dataset.editor==='edit'||byId('transactionDialog').dataset.editor==='pending';
    for(const [id,type] of [['txAccount','account'],['txCategory',byId('txType').value]]) {
      const input=byId(id);if(!input)continue;
      for(const option of input.options) {
        const archived=metadata(type,option.value)?.archived||false;
        option.hidden=archived&&!(editing&&option.selected);
        option.disabled=option.hidden;
      }
      if(input.selectedOptions[0]?.disabled)input.value=[...input.options].find(option=>!option.disabled)?.value||'';
    }
  }
  window.trackerCatalogUI={item:metadata,usage,ensureOption,filterSelects,refresh:refreshTools};
  function options(input,values,includeAll=true) {
    if(!input)return;
    const previous=input.value;
    input.replaceChildren(...(includeAll?[new Option('All','')]:[]),...[...new Set(values)].sort().map(value=>new Option(value,value)));
    if([...input.options].some(option=>option.value===previous))input.value=previous;
  }
  function download(content,name,type) {
    const url=URL.createObjectURL(new Blob([content],{type})),link=document.createElement('a');link.href=url;link.download=name;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  function applyLedger(rows) {
    cachedRows=rows.slice();
    options(byId('ws-ledger-account'),rows.map(row=>row.account));options(byId('ws-ledger-category'),rows.map(row=>row.category));
    const all=Core.sort(Core.filter(rows,ledgerFilters),sortBy,sortDirection);
    const size=Number(byId('ws-page-size').value)||25,pages=Math.max(1,Math.ceil(all.length/size));page=Math.min(page,pages-1);
    byId('ws-ledger-page').textContent=(page+1)+' / '+pages+' · '+all.length+' matching entries';
    byId('ws-page-previous').disabled=page===0;byId('ws-page-next').disabled=page>=pages-1;
    const totals=Planner.totals(all),currency=byId('currencyDisplay').textContent;
    byId('ws-filtered-totals').innerHTML=pill('Income '+money(totals.income,currency),'mint')+pill('Expenses '+money(totals.expense,currency),'rose')+pill('Net '+money(totals.net,currency),totals.net<0?'rose':'mint');
    document.querySelectorAll('#txTable th[data-sort]').forEach(head=>head.setAttribute('aria-sort',head.dataset.sort===sortBy?(sortDirection==='asc'?'ascending':'descending'):'none'));
    return {all,rows:all.slice(page*size,page*size+size)};
  }
  function redrawLedger(){if(cachedRows.length||window.trackerAllLedgerRows)loadTransactions({rowsOverride:cachedRows.length?cachedRows:window.trackerAllLedgerRows||[]});}
  window.trackerLedger={apply:applyLedger,export(){
    const rows=Core.sort(Core.filter(cachedRows,ledgerFilters),sortBy,sortDirection);
    download(Core.exportCSV(rows,{start:ledgerFilters.from||'All',end:ledgerFilters.to||'All',account:ledgerFilters.account,category:ledgerFilters.category}),'RanSan-filtered-ledger.csv','text/csv;charset=utf-8');
  }};
  function draftKey(){return 'RanSan:transactionDraft:'+window.trackerEnvironment+':'+(localStorage.getItem('user')||'user');}
  function saveDraft() {
    const dialog=byId('transactionDialog');if(!dialog.open||dialog.dataset.editor==='edit'||dialog.dataset.editor==='pending')return;
    const values=Object.fromEntries(['txType','txDate','txCategory','txAccount','txAmount','txDesc','rpt-payment','rpt-classification'].map(id=>[id,byId(id).value]));
    if(!values.txAmount&&!values.txDesc&&!window.trackerNavigation?.isDirty())return;
    try{localStorage.setItem(draftKey(),JSON.stringify({values,updated:new Date().toISOString()}));byId('ws-draft-note').textContent='Draft saved in this browser';}catch(error){byId('ws-draft-note').textContent='Draft could not be saved in this browser';}
    showDraft();
  }
  function showDraft() {
    let draft;try{draft=JSON.parse(localStorage.getItem(draftKey())||'null');}catch(error){draft=null;}
    byId('ws-draft-bar').hidden=!draft;
    if(draft)byId('ws-draft-time').textContent='New transaction draft · '+new Date(draft.updated).toLocaleString();
  }
  function clearDraft(){localStorage.removeItem(draftKey());byId('ws-draft-note').textContent='';showDraft();}
  function restoreDraft() {
    let draft;try{draft=JSON.parse(localStorage.getItem(draftKey()));}catch(error){return;}
    if(!draft)return;
    byId('openTransaction').click();
    byId('txType').value=draft.values.txType;updateCategoryDropdown(draft.values.txType);
    ensureOption('txCategory',draft.values.txCategory);ensureOption('txAccount',draft.values.txAccount);
    for(const [id,value] of Object.entries(draft.values))if(byId(id))byId(id).value=value;
    window.dispatchEvent(new Event('tracker-form-updated'));
    setTimeout(()=>window.trackerNavigation?.markDirty(byId('transactionDialog')),0);
  }
  function renderCatalog() {
    for(const [listId,type] of [['accountList','account'],['incomeCatList','income'],['expenseCatList','expense']]) {
      const list=byId(listId);if(!list)continue;
      const filter=byId('ws-catalog-'+type)?.value||'active';
      for(const row of list.children) {
        const name=row.querySelector('div')?.textContent.trim();if(!name)continue;
        const item=metadata(type,name),archived=item?.archived||false;
        row.hidden=filter==='active'?archived:filter==='archived'?!archived:false;
        let extra=row.querySelector('.ws-catalog-extras');
        if(!extra){extra=document.createElement('div');extra.className='ws-catalog-extras';row.append(extra);}
        extra.innerHTML='<small>'+esc(item?.group||'Ungrouped')+' · '+esc(usage(type,name))+'</small><button type="button" class="finance-pill tone-violet" data-ws-catalog="'+esc(name)+'" data-type="'+type+'">Group / '+(archived?'restore':'archive')+'</button>';
      }
    }
    byId('ws-activity').innerHTML=table(['When','Change','Profile','Details'],tools.activity.map((row,index)=>'<tr><td>'+esc(new Date(row.date).toLocaleString())+'</td><td>'+esc(row.action)+'</td><td>'+esc(row.actor)+'</td><td><button type="button" class="fp-link" data-ws-activity="'+index+'">View before / after</button></td></tr>').join(''));
    filterSelects();
  }
  async function refreshTools() {
    if(toolsRequest)return toolsRequest;
    toolsRequest=(async()=>{try{
      const result=await apiGet('getWorkspaceTools');if(result?.status!=='ok')throw new Error(result?.error||'Deploy Workspace.gs before using these controls.');
      tools=result;byId('ws-tools-error').textContent='';renderCatalog();if(snapshot)renderReports();
    }catch(error){byId('ws-tools-error').textContent=error.message;}})().finally(()=>toolsRequest=null);
    return toolsRequest;
  }
  function openCatalog(type,name) {
    const item=metadata(type,name);if(!item)return;
    catalogEdit={...item};
    byId('ws-catalog-title').textContent='Edit '+type+': '+name;
    byId('ws-catalog-name').value=name;
    const used=item.usage.transactions||item.usage.commitments||item.usage.movements||item.usage.reconciliations||item.usage.balance;
    byId('ws-catalog-name').readOnly=Boolean(used);
    byId('ws-catalog-group').value=item.group||'';byId('ws-catalog-archived').checked=item.archived;
    byId('ws-catalog-usage').textContent=usage(type,name)+(used?' · Historical references keep this name.':'');
    byId('ws-catalog-error').textContent='';byId('ws-catalog-dialog').showModal();
  }
  async function saveCatalog(event) {
    event.preventDefault();const button=byId('ws-catalog-save');if(button.disabled)return;button.disabled=true;byId('ws-catalog-dialog').dataset.saving='true';
    try{
      const result=await apiPost('saveCatalogItem',{item:JSON.stringify({...catalogEdit,previousName:catalogEdit.name,name:byId('ws-catalog-name').value,group:byId('ws-catalog-group').value,archived:byId('ws-catalog-archived').checked})});
      if(result?.status!=='ok')throw new Error(result?.error||'Unable to save.');
      byId('ws-catalog-dialog').close();window.trackerFeedback.notify('Setup item updated');await loadSetupData();await refreshTools();await window.trackerPlanning.refresh(true);
    }catch(error){byId('ws-catalog-error').textContent=error.message;}finally{button.disabled=false;delete byId('ws-catalog-dialog').dataset.saving;}
  }
  const mapFields=[['date','Date'],['amount','Amount'],['type','Income / expense'],['debit','Debit / withdrawal'],['credit','Credit / deposit'],['description','Description'],['account','Account'],['category','Category'],['currency','Currency'],['kind','Entry kind']];
  function buildMappings() {
    if(!parsedCSV)return;
    const aliases={date:/^(date|transaction date|value date)$/i,amount:/^amount$/i,type:/^(type|direction)$/i,debit:/^(debit|withdrawal|withdrawals)$/i,credit:/^(credit|deposit|deposits)$/i,description:/^(description|narration|particulars|note)$/i,account:/^account$/i,category:/^category$/i,currency:/^currency$/i,kind:/^(entry kind|kind)$/i};
    byId('ws-csv-mappings').innerHTML=mapFields.map(([key,label])=>{
      const match=parsedCSV.headers.findIndex(header=>aliases[key].test(header.trim()));
      return '<label>'+label+'<select data-map="'+key+'"><option value="">Use default / unused</option>'+parsedCSV.headers.map((header,index)=>'<option value="'+index+'" '+(match===index?'selected':'')+'>'+esc(header||'Column '+(index+1))+'</option>').join('')+'</select></label>';
    }).join('');
  }
  async function openImport() {
    if(!snapshot)await window.trackerPlanning.refresh(true);
    byId('ws-import-status').textContent='';byId('ws-import-dialog').showModal();
    options(byId('ws-import-account'),tools.items.filter(item=>item.type==='account'&&!item.archived).map(item=>item.name),false);
    options(byId('ws-import-category'),tools.items.filter(item=>item.type==='expense'&&!item.archived).map(item=>item.name),false);
  }
  async function readFile() {
    const file=byId('ws-import-file').files[0];if(!file)return;
    parsedCSV=null;previewRows=[];byId('ws-csv-mappings').replaceChildren();renderPreview();
    if(file.size>5*1024*1024){byId('ws-import-status').textContent='Choose a CSV file under 5 MB.';return;}
    try{parsedCSV=Core.csv(await file.text(),byId('ws-csv-delimiter').value||undefined);buildMappings();byId('ws-import-status').textContent=parsedCSV.rows.length+' data rows found.';previewRows=[];renderPreview();}
    catch(error){byId('ws-import-status').textContent=error.message;}
  }
  function previewImport() {
    if(!parsedCSV||!snapshot)return;
    const mapping=Object.fromEntries([...document.querySelectorAll('[data-map]')].map(input=>[input.dataset.map,input.value]));
    const defaults={account:byId('ws-import-account').value,category:byId('ws-import-category').value,type:byId('ws-import-type').value,dateFormat:byId('ws-import-date').value,decimal:byId('ws-import-decimal').value};
    try{
      if(parsedCSV.rows.length>5000)throw new Error('Split this file into imports of 5,000 rows or fewer.');
      previewRows=Core.preview(parsedCSV,mapping,defaults,snapshot,tools.items);previewPage=0;importJob=null;renderPreview();
      byId('ws-import-status').textContent='Review errors and duplicates before saving. Flagged duplicates are excluded unless you select them.';
    }catch(error){byId('ws-import-status').textContent=error.message;}
  }
  function renderPreview() {
    const total=previewRows.filter(row=>row.selected).length,errors=previewRows.filter(row=>row.error).length,duplicates=previewRows.filter(row=>row.duplicate).length;
    byId('ws-import-summary').textContent=previewRows.length+' rows · '+total+' selected · '+errors+' errors · '+duplicates+' duplicates';
    byId('ws-import-save').disabled=!total||Boolean(importJob?.busy);
    const pages=Math.max(1,Math.ceil(previewRows.length/50));previewPage=Math.min(previewPage,pages-1);
    byId('ws-import-preview').innerHTML=table(['Include','CSV row','Date','Type','Category','Account','Amount','Review'],previewRows.slice(previewPage*50,previewPage*50+50).map(item=>'<tr><td><input type="checkbox" data-import-row="'+item.index+'" '+(item.selected?'checked':'')+' '+(item.error||importJob?'disabled':'')+' aria-label="Include CSV row '+(item.index+2)+'"></td><td>'+(item.index+2)+'</td><td>'+esc(item.row?.date||'')+'</td><td>'+esc(item.row?.type||'')+'</td><td>'+esc(item.row?.category||'')+'</td><td>'+esc(item.row?.account||'')+'</td><td>'+(item.row?money(item.row.amount,item.row.currency):'—')+'</td><td>'+esc(item.error||(item.duplicate?'Duplicate — select only if intentional':'Ready'))+'</td></tr>').join(''));
    byId('ws-import-page').textContent=(previewPage+1)+' / '+pages;
    byId('ws-import-previous').disabled=previewPage===0;byId('ws-import-next').disabled=previewPage>=pages-1;
  }
  async function submitImport() {
    if(importJob?.busy)return;
    if(!importJob){const rows=previewRows.filter(row=>row.selected&&!row.error).map(item=>({...item.row,includeDuplicate:item.duplicate}));if(!rows.length)return;importJob={id:token(),rows,completed:0,imported:0,skipped:0};}
    importJob.busy=true;byId('ws-import-save').disabled=true;byId('ws-import-dialog').dataset.saving='true';
    document.querySelectorAll('#ws-import-dialog input,#ws-import-dialog select,#ws-import-review').forEach(input=>input.disabled=true);
    try{
      const batches=Math.ceil(importJob.rows.length/25);
      for(let index=importJob.completed;index<batches;index++){
        byId('ws-import-status').textContent='Saving reviewed batch '+(index+1)+' of '+batches+'…';
        const result=await apiPost('importTransactions',{requestId:importJob.id+'-'+index,rows:JSON.stringify(importJob.rows.slice(index*25,index*25+25))});
        if(result?.status!=='ok')throw new Error(result?.error||'Unable to import this batch.');
        importJob.imported+=result.imported;importJob.skipped+=result.skipped;importJob.completed=index+1;
      }
      byId('ws-import-status').textContent='Imported '+importJob.imported+' · skipped '+importJob.skipped+'.';
      window.trackerFeedback.notify(byId('ws-import-status').textContent);previewRows=[];importJob=null;
      document.querySelectorAll('#ws-import-dialog input,#ws-import-dialog select,#ws-import-review').forEach(input=>input.disabled=false);byId('ws-import-save').textContent='Import selected rows';
      await loadSetupData();await loadTransactions();await window.trackerPlanning.refresh(true);await refreshTools();renderPreview();
    }catch(error){byId('ws-import-status').textContent=error.message+' Use Retry to continue the same reviewed import.';byId('ws-import-save').textContent='Retry reviewed import';}
    finally{
      if(importJob)importJob.busy=false;delete byId('ws-import-dialog').dataset.saving;
      byId('ws-import-save').disabled=!importJob;
      byId('ws-import-close').disabled=false;
    }
  }
  function reportContext() {
    if(!snapshot)return null;
    const range=Core.range(byId('ws-report-preset').value,snapshot.today,byId('ws-report-from').value,byId('ws-report-to').value);
    return {...range,currency:byId('ws-report-currency').value||snapshot.currency,account:byId('ws-report-account').value,category:byId('ws-report-category').value};
  }
  function heatmap(rows,range) {
    const spending=new Map();rows.filter(row=>row.type==='expense').forEach(row=>spending.set(row.date,(spending.get(row.date)||0)+Number(row.amount)));
    const maximum=Math.max(1,...[...spending.values()].map(Math.abs));let html='',cursor=Planner.parse(range.start),months=0;
    while(Planner.iso(cursor)<=range.end&&months<120) {
      const year=cursor.getFullYear(),month=cursor.getMonth();html+='<section class="ws-calendar"><h5>'+cursor.toLocaleDateString(undefined,{month:'long',year:'numeric'})+'</h5><div>';
      html+=['S','M','T','W','T','F','S'].map(day=>'<span class="ws-weekday">'+day+'</span>').join('');
      html+='<span></span>'.repeat(new Date(year,month,1,12).getDay());
      const last=new Date(year,month+1,0).getDate();
      for(let day=1;day<=last;day++) {
        const date=Planner.iso(new Date(year,month,day,12));if(date<range.start||date>range.end){html+='<span class="ws-weekday">'+day+'</span>';continue;}
        const value=spending.get(date)||0;
        html+='<button type="button" data-ws-day="'+date+'" style="--heat:'+Math.min(.7,.07+Math.abs(value)/maximum*.6)+'" title="'+date+' · '+esc(value.toFixed(2))+'"><span>'+day+'</span><small>'+Number(value).toLocaleString()+'</small></button>';
      }
      html+='</div></section>';cursor=new Date(year,month+1,1,12);months++;
    }
    return html;
  }
  function pace(rows,context) {
    const start=Planner.parse(context.start),end=Planner.parse(context.end),count=Math.round((end-start)/86400000)+1;
    const firstDay=start.getDate()===1&&start.getMonth()===end.getMonth()&&start.getFullYear()===end.getFullYear();
    const previousStart=firstDay?Planner.iso(new Date(start.getFullYear(),start.getMonth()-1,1,12)):Planner.addDays(context.start,-count);
    const previousLast=firstDay?Planner.iso(new Date(start.getFullYear(),start.getMonth(),0,12)):Planner.addDays(context.start,-1);
    const previousRows=Planner.filter(snapshot.transactions,{...context,start:previousStart,end:previousLast,type:'expense'});
    let current=0,prior=0;const currentData=[],priorData=[],labels=[];
    for(let index=0;index<count;index++) {
      const date=Planner.addDays(context.start,index),previous=Planner.addDays(previousStart,index);
      current+=rows.filter(row=>row.type==='expense'&&row.date===date).reduce((sum,row)=>sum+Number(row.amount),0);
      if(previous<=previousLast)prior+=previousRows.filter(row=>row.date===previous).reduce((sum,row)=>sum+Number(row.amount),0);
      labels.push(date);currentData.push(current);priorData.push(previous<=previousLast?prior:null);
    }
    return {labels,currentData,priorData,previousStart,previousLast,current,prior};
  }
  function renderReports() {
    if(!snapshot)return;
    options(byId('ws-report-currency'),[snapshot.currency,...snapshot.accounts.map(row=>row.currency)],false);
    options(byId('ws-annual-currency'),[snapshot.currency,...snapshot.accounts.map(row=>row.currency)],false);
    options(byId('ws-report-account'),snapshot.accounts.map(row=>row.name));options(byId('ws-report-category'),snapshot.transactions.map(row=>row.category));
    try{
      const context=reportContext(),rows=Planner.filter(snapshot.transactions,context),totals=Planner.totals(rows);
      if(byId('ws-report-preset').value!=='custom'){byId('ws-report-from').value=context.start;byId('ws-report-to').value=context.end;}
      byId('ws-report-context').textContent=context.start+' – '+context.end+' · '+context.currency+' · '+(context.account||'All accounts')+' · '+(context.category||'All categories');
      byId('ws-report-totals').innerHTML=pill('Income '+money(totals.income,context.currency),'mint')+pill('Expenses '+money(totals.expense,context.currency),'rose')+pill('Net '+money(totals.net,context.currency),totals.net<0?'rose':'mint');
      byId('ws-daily-heatmap').innerHTML=heatmap(rows,context);
      const scheduled=Core.scheduled(snapshot,context,context.currency,context.account,context.category);
      byId('ws-scheduled-report').innerHTML=table(['Due','Commitment','Direction','Expected','Status'],scheduled.map(item=>'<tr><td>'+item.due+'</td><td>'+esc(item.name)+'</td><td>'+esc(item.type)+'</td><td>'+money(item.amount,context.currency)+'</td><td>'+ (item.recorded?'Recorded':item.due<=snapshot.today?'Outstanding':'Planned')+'</td></tr>').join(''));
      const groups=Core.grouped(rows,tools.items);
      byId('ws-group-report').innerHTML=table(['Expense group','Net spending'],groups.map(row=>'<tr><td>'+esc(row.group)+'</td><td>'+money(row.amount,context.currency)+'</td></tr>').join(''));
      const chart=pace(rows,context);
      byId('ws-pace-caption').textContent='Cumulative spending · '+context.start+' – '+context.end+' vs '+chart.previousStart+' – '+chart.previousLast;
      byId('ws-pace-values').innerHTML=pill('Selected '+money(chart.current,context.currency),'rose')+pill('Comparison '+money(chart.prior,context.currency),'sky');
      if(paceChart){paceChart.destroy();paceChart=null;}
      if(window.Chart&&byId('ws-pace-chart').offsetParent)paceChart=new Chart(byId('ws-pace-chart'),{type:'line',data:{labels:chart.labels,datasets:[{label:'Selected period',data:chart.currentData,borderColor:'#fb7185',pointRadius:0,tension:.2},{label:'Comparison period',data:chart.priorData,borderColor:'#7dd3fc',pointRadius:0,tension:.2}]},options:{responsive:true,maintainAspectRatio:false}});
      const largest=[...new Set(rows.map(row=>row.category))].map(category=>({category,total:rows.filter(row=>row.type==='expense'&&row.category===category).reduce((sum,row)=>sum+Number(row.amount),0)})).sort((a,b)=>b.total-a.total).slice(0,20);
      byId('ws-report-top').innerHTML=table(['Category','Net expenses'],largest.map(row=>'<tr><td>'+esc(row.category)+'</td><td>'+money(row.total,context.currency)+'</td></tr>').join(''));
      renderAnnual();
    }catch(error){byId('ws-report-context').textContent=error.message;}
  }
  function annualContext() {
    const year=Number(byId('ws-annual-year').value)||Planner.parse(snapshot.today).getFullYear();
    return {...Core.annualRange(year,byId('ws-annual-mode').value,snapshot.today),currency:byId('ws-annual-currency').value||snapshot.currency};
  }
  function renderAnnual() {
    if(!snapshot)return;
    const context=annualContext(),review=Core.annualReview(snapshot,context,context.currency,tools.items);
    const increase=review.changes.find(row=>row.difference>0);
    byId('ws-annual-context').textContent=context.start+' – '+context.end+' · Recorded through '+context.actualEnd+' · '+context.currency;
    byId('ws-annual-months').innerHTML=table(['Month','Income','Expenses','Net cash flow'],review.months.map(month=>'<tr><td>'+esc(month.label)+'</td><td class="fp-text-mint">'+money(month.income,context.currency)+'</td><td class="fp-text-rose">'+money(month.expense,context.currency)+'</td><td class="'+(month.net<0?'fp-text-rose':'fp-text-mint')+'">'+money(month.net,context.currency)+'</td></tr>').join(''));
    byId('ws-annual-review').innerHTML='<div class="fp-mini-grid"><div><small>Highest-spending month</small><strong>'+esc(review.highest?.label||'—')+'</strong><span>'+money(review.highest?.expense,context.currency)+'</span></div><div><small>Strongest net cash-flow month</small><strong>'+esc(review.strongest?.label||'—')+'</strong><span>'+money(review.strongest?.net,context.currency)+'</span></div><div><small>Largest category increase</small><strong>'+esc(increase?.category||'No increase')+'</strong><span>'+money(increase?.difference,context.currency)+'</span></div><div><small>Planned expenses outstanding</small><strong>'+review.outstanding.length+'</strong><span>'+money(review.outstanding.reduce((sum,row)=>sum+row.amount,0),context.currency)+'</span></div></div>';
    const maximum=Math.max(1,...review.categories.flatMap(row=>row.months.map(Math.abs)));
    byId('ws-annual-heatmap').innerHTML=table(['Category',...review.months.map(month=>month.label)],review.categories.map(row=>'<tr><td>'+esc(row.category)+'</td>'+row.months.map((value,index)=>'<td><button type="button" class="ws-heat-value" style="--heat:'+(.06+Math.abs(value)/maximum*.6)+'" data-ws-annual-category="'+esc(row.category)+'" data-start="'+review.months[index].start+'" data-end="'+review.months[index].end+'">'+money(value,context.currency)+'</button></td>').join('')+'</tr>').join(''));
    byId('ws-income-consistency').innerHTML=table(['Income source','Total','Active months','Receipts','Average receipt','Share'],review.sources.map(row=>'<tr><td>'+esc(row.category)+'</td><td>'+money(row.total,context.currency)+'</td><td>'+row.active+'</td><td>'+row.receipts+'</td><td>'+money(row.average,context.currency)+'</td><td>'+row.share.toFixed(1)+'%</td></tr>').join(''));
  }
  function printReport(annual=false) {
    if(!snapshot)return;
    let context;try{context=annual?annualContext():reportContext();}catch(error){window.trackerFeedback.notify(error.message,'error');return;}
    if(annual)renderAnnual();else renderReports();
    const title=annual?'Annual finance review':'Income and expense report';
    const ids=annual?['ws-annual-review','ws-annual-months','ws-income-consistency','ws-annual-heatmap']:['ws-report-totals','ws-report-top','ws-group-report','ws-scheduled-report'];
    byId('ws-print-report').innerHTML='<h1>'+title+'</h1><p>RanSan Tracker · '+esc(context.currency)+' · '+context.start+' – '+context.end+'</p><p>Account '+esc(context.account||'All')+' · Category '+esc(context.category||'All')+' · '+window.trackerEnvironment.toUpperCase()+'</p>'+ids.map(id=>'<section><h2>'+esc({'ws-annual-review':'Annual review','ws-annual-months':'Monthly cash flow','ws-income-consistency':'Income-source consistency','ws-annual-heatmap':'Expense seasonality','ws-report-totals':'Period totals','ws-report-top':'Expense categories','ws-group-report':'Expense groups','ws-scheduled-report':'Scheduled vs recorded'}[id])+'</h2>'+byId(id).innerHTML+'</section>').join('');
    document.body.classList.add('ws-printing');window.print();
  }
  function events() {
    byId('ws-ledger-controls').addEventListener('input',event=>{
      const name=event.target.dataset.filter;if(!name)return;ledgerFilters[name]=event.target.value;page=0;clearTimeout(events.timer);events.timer=setTimeout(redrawLedger,180);
    });
    byId('ws-ledger-reset').addEventListener('click',()=>{for(const key in ledgerFilters)ledgerFilters[key]='';document.querySelectorAll('[data-filter]').forEach(input=>input.value='');page=0;redrawLedger();});
    byId('ws-page-previous').addEventListener('click',()=>{page--;redrawLedger();});byId('ws-page-next').addEventListener('click',()=>{page++;redrawLedger();});byId('ws-page-size').addEventListener('change',()=>{page=0;redrawLedger();});
    [...byId('txTable').tHead.rows[0].cells].slice(0,5).forEach((head,index)=>{head.dataset.sort=['date','type','category','account','amount'][index];const button=document.createElement('button');button.type='button';button.className='ws-sort';button.textContent=head.textContent;head.replaceChildren(button);button.addEventListener('click',()=>{sortDirection=sortBy===head.dataset.sort&&sortDirection==='asc'?'desc':'asc';sortBy=head.dataset.sort;page=0;redrawLedger();});});
    byId('transactionDialog').addEventListener('input',()=>{clearTimeout(events.draftTimer);events.draftTimer=setTimeout(saveDraft,350);});
    byId('transactionDialog').addEventListener('change',saveDraft);window.addEventListener('tracker-persist-draft',saveDraft);window.addEventListener('tracker-clear-draft',clearDraft);
    byId('ws-draft-restore').addEventListener('click',restoreDraft);byId('ws-draft-discard').addEventListener('click',clearDraft);
    byId('ws-import-open').addEventListener('click',openImport);byId('ws-import-file').addEventListener('change',readFile);byId('ws-csv-delimiter').addEventListener('change',readFile);byId('ws-import-review').addEventListener('click',previewImport);byId('ws-import-save').addEventListener('click',submitImport);
    byId('ws-import-previous').addEventListener('click',()=>{previewPage--;renderPreview();});byId('ws-import-next').addEventListener('click',()=>{previewPage++;renderPreview();});
    byId('ws-import-preview').addEventListener('change',event=>{if(event.target.dataset.importRow!==undefined){previewRows[Number(event.target.dataset.importRow)].selected=event.target.checked;renderPreview();}});
    byId('ws-import-reset').addEventListener('click',async()=>{if(importJob?.busy)return;importJob=null;document.querySelectorAll('#ws-import-dialog input,#ws-import-dialog select,#ws-import-review').forEach(input=>input.disabled=false);byId('ws-import-save').textContent='Import selected rows';await window.trackerPlanning.refresh(true);previewImport();});
    byId('ws-import-close').addEventListener('click',()=>{if(!importJob?.busy)byId('ws-import-dialog').close();});byId('ws-import-dialog').addEventListener('cancel',event=>{if(importJob?.busy)event.preventDefault();});
    byId('ws-import-dialog').addEventListener('change',event=>{if(!importJob&&event.target.matches('[data-map],#ws-import-account,#ws-import-category,#ws-import-type,#ws-import-date,#ws-import-decimal')){previewRows=[];renderPreview();byId('ws-import-status').textContent='Mapping changed. Build a new preview before importing.';}});
    byId('ws-import-type').addEventListener('change',event=>options(byId('ws-import-category'),tools.items.filter(item=>item.type===(event.target.value==='income'?'income':'expense')&&!item.archived).map(item=>item.name),false));
    byId('ws-catalog-form').addEventListener('submit',saveCatalog);byId('ws-catalog-cancel').addEventListener('click',()=>{if(!byId('ws-catalog-save').disabled)byId('ws-catalog-dialog').close();});byId('ws-catalog-dialog').addEventListener('cancel',event=>{if(byId('ws-catalog-save').disabled)event.preventDefault();});
    for(const type of ['account','income','expense'])byId('ws-catalog-'+type).addEventListener('change',renderCatalog);
    document.addEventListener('click',event=>{
      const button=event.target.closest('button');if(!button)return;
      if(button.dataset.wsCatalog)openCatalog(button.dataset.type,button.dataset.wsCatalog);
      if(button.dataset.wsActivity!==undefined){const item=tools.activity[Number(button.dataset.wsActivity)];byId('ws-activity-details').textContent=JSON.stringify({before:item.before,after:item.after},null,2);byId('ws-activity-dialog').showModal();}
      if(button.dataset.wsDay){const context=reportContext();window.trackerPlanning.openDrill({...context,start:button.dataset.wsDay,end:button.dataset.wsDay,type:'expense'},'Daily spending · '+button.dataset.wsDay);}
      if(button.dataset.wsAnnualCategory){const context=annualContext();window.trackerPlanning.openDrill({currency:context.currency,start:button.dataset.start,end:button.dataset.end,category:button.dataset.wsAnnualCategory,type:'expense'},button.dataset.wsAnnualCategory);}
      if(button.dataset.tab==='reports'||button.dataset.subtab)setTimeout(renderReports,0);
    });
    byId('ws-activity-close').addEventListener('click',()=>byId('ws-activity-dialog').close());
    byId('ws-report-apply').addEventListener('click',renderReports);byId('ws-report-preset').addEventListener('change',()=>{const custom=byId('ws-report-preset').value==='custom';byId('ws-report-from').disabled=!custom;byId('ws-report-to').disabled=!custom;renderReports();});
    byId('ws-report-print').addEventListener('click',()=>printReport(false));byId('ws-annual-print').addEventListener('click',()=>printReport(true));
    byId('ws-report-export').addEventListener('click',()=>{try{const context=reportContext();download(Core.exportCSV(Planner.filter(snapshot.transactions,context),context),'RanSan-scoped-report.csv','text/csv;charset=utf-8');}catch(error){window.trackerFeedback.notify(error.message,'error');}});
    byId('ws-annual-currency').addEventListener('change',renderAnnual);byId('ws-annual-mode').addEventListener('change',renderAnnual);byId('ws-annual-year').addEventListener('change',renderAnnual);byId('ws-pace-details').addEventListener('toggle',()=>{if(byId('ws-pace-details').open)renderReports();});
    window.addEventListener('afterprint',()=>{document.body.classList.remove('ws-printing');byId('ws-print-report').replaceChildren();});
    window.addEventListener('tracker-setup-ready',()=>{refreshTools();filterSelects();clearTimeout(events.setupTimer);events.setupTimer=setTimeout(()=>window.trackerPlanning?.refresh(true),250);});
    window.addEventListener('tracker-insights-updated',event=>{snapshot=event.detail;renderReports();refreshTools();});
    window.addEventListener('tracker-quick-add',event=>quickAdd(event.detail));
  }
  function quickAdd(kind) {
    if(kind==='transaction'){document.querySelector('[data-tab="transactions"]').click();byId('openTransaction').click();}
    else if(!snapshot)window.addEventListener('tracker-insights-updated',()=>quickAdd(kind),{once:true});
    else window.trackerPlanning?.openForm(kind==='movement'?'movement':'commitment');
  }
  const now=new Date();byId('ws-annual-year').replaceChildren(...Array.from({length:12},(_,index)=>new Option(String(now.getFullYear()-7+index),String(now.getFullYear()-7+index))));byId('ws-annual-year').value=String(now.getFullYear());
  events();showDraft();refreshTools();
  if(window.trackerAllLedgerRows){cachedRows=window.trackerAllLedgerRows;redrawLedger();}
  if(snapshot)renderReports();
  const ledgerId=new URLSearchParams(location.search).get('ledgerId');if(ledgerId){ledgerFilters.search=ledgerId;const input=document.querySelector('[data-filter=search]');if(input)input.value=ledgerId;if(window.trackerAllLedgerRows)redrawLedger();}
  const quick=new URLSearchParams(location.search).get('quick');
  if(['transaction','movement','commitment'].includes(quick)){const open=()=>{quickAdd(quick);history.replaceState(null,'',location.pathname);};if(snapshot)open();else window.addEventListener('tracker-insights-updated',open,{once:true});}
})();
