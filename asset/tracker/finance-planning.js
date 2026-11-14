(() => {
  'use strict';
  const Planner=window.FinancePlanner;
  const byId=id=>document.getElementById(id);
  const escape=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const id=()=>crypto.randomUUID();
  let data=null,currency='',account='',loading=null,refreshTimer,drill={rows:[],page:0},editContext=null;
  const money=(value,code=currency)=>escape(code)+' '+Number(value||0).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2});
  const percentage=value=>value===null?'No previous activity':Number(value).toFixed(1)+'%';
  const tone=value=>value<0?'rose':value>0?'mint':'neutral';
  const pill=(value,color)=>'<span class="finance-pill tone-'+color+'">'+value+'</span>';
  const empty=(columns,message='No entries for this selection.')=>'<tr><td colspan="'+columns+'" class="fp-empty">'+message+'</td></tr>';
  const table=(heads,body,cls='')=>'<div class="fp-table-scroll"><table class="fp-table '+cls+'"><thead><tr>'+heads.map(head=>'<th>'+head+'</th>').join('')+'</tr></thead><tbody>'+body+'</tbody></table></div>';
  const notify=message=>window.trackerFeedback.notify(message);
  const monthNames=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  function getRange(monthly=false) {
    const now=Planner.parse(data.today);
    const year=monthly?Number(byId('reportYear').value)||now.getFullYear():now.getFullYear();
    const month=monthly?Number(byId('reportMonth').value)-1:now.getMonth();
    return Planner.period(year,month,data.today);
  }
  function periodLabel(range) { return range.start+' – '+range.end+' vs '+range.previousStart+' – '+range.previousEnd; }
  function comparisonMarkup(range) {
    const result=Planner.compare(data.transactions,range,currency);
    const fields=[['income','Income','mint'],['expense','Expenses','rose'],['net','Net cash flow',tone(result.current.net)],['rate','Savings rate',tone(result.current.rate||0)]];
    return '<p class="fp-caption">'+periodLabel(range)+'</p><div class="fp-comparison-grid">'+fields.map(([key,label,color])=>{
      const value=result.current[key], prior=result.previous[key], change=result.changes[key];
      const delta=key==='rate'?(change===null?'No comparable savings rate':(change>0?'+':'')+change.toFixed(1)+' pp'):(change===null?'No previous activity':(change>0?'+':'')+change.toFixed(1)+'%');
      const formatted=key==='rate'?(value===null?'—':value.toFixed(1)+'%'):money(value);
      const previous=key==='rate'?(prior===null?'—':prior.toFixed(1)+'%'):money(prior);
      return '<button type="button" class="fp-comparison tone-'+color+'" data-fp-drill="'+key+'" data-fp-start="'+range.start+'" data-fp-end="'+range.end+'"><small>'+label+'</small><strong>'+formatted+'</strong><span>Previous '+previous+'</span><b>'+delta+'</b></button>';
    }).join('')+'</div>';
  }
  function changesMarkup(range) {
    const rows=Planner.categoryChanges(data.transactions,range,currency);
    return '<p class="fp-caption">'+periodLabel(range)+'</p>'+table(['Category','Actual','Previous','Difference','Change','Share'],rows.map(row=>'<tr><td><button type="button" class="fp-link" data-fp-category="'+escape(row.category)+'" data-fp-start="'+range.start+'" data-fp-end="'+range.end+'">'+escape(row.category)+'</button></td><td>'+money(row.current)+'</td><td>'+money(row.previous)+'</td><td>'+pill(money(row.difference),row.difference>0?'rose':'mint')+'</td><td>'+percentage(row.change)+'</td><td>'+row.share.toFixed(1)+'%</td></tr>').join('')||empty(6));
  }
  function forecastMarkup() {
    if(data.accounts.some(a=>a.currency===currency&&(!account||a.name===account)&&a.balanceKnown===false))return '<p class="fp-error">Forecast unavailable: correct the unknown account balance shown in the data warnings.</p>';
    const rows=Planner.forecast(data,currency,account,data.today);
    const opening=data.accounts.filter(row=>row.currency===currency&&(!account||row.name===account)).reduce((sum,row)=>sum+row.balance,0);
    const low=Math.min(opening,...rows.map(row=>row.projected));
    const closing=rows.length?rows[rows.length-1].projected:opening;
    const overdue=data.commitments.filter(row=>row.currency===currency&&(!account||row.account===account)).flatMap(item=>Planner.occurrences(item,item.due,Planner.addDays(data.today,-1))).filter(item=>!Planner.isRecorded(item,data.movements));
    return '<p class="fp-caption">'+data.today+' – '+Planner.addDays(data.today,29)+' · Scheduled entries only. Overdue items are shown separately.</p><div class="fp-mini-grid"><div><small>Recorded balance</small><strong>'+money(opening)+'</strong></div><div><small>Lowest projected balance</small><strong class="fp-text-'+tone(low)+'">'+money(low)+'</strong></div><div><small>Projected closing balance</small><strong class="fp-text-'+tone(closing)+'">'+money(closing)+'</strong></div><div><small>Overdue occurrences</small><strong>'+overdue.length+'</strong></div></div>'+table(['Date','Commitment','Account','In / out','Projected balance'],rows.map(row=>'<tr><td>'+row.due+'</td><td>'+escape(row.name)+'</td><td>'+escape(row.account)+'</td><td>'+pill((row.type==='income'?'+':'−')+money(row.amount),row.type==='income'?'mint':'rose')+'</td><td>'+pill(money(row.projected),tone(row.projected))+'</td></tr>').join('')||empty(5,'No scheduled entries in the next 30 days. Add a recurring payment or planned expense.'));
  }
  function monthlyEquivalent(item) {
    const factor={weekly:52/12,fortnightly:26/12,monthly:1,quarterly:1/3,yearly:1/12}[item.frequency];
    return factor?money(item.amount*factor):'One-off';
  }
  function commitmentRows(annual=false) {
    const year=Number(byId('annualReportYear').value)||Planner.parse(data.today).getFullYear();
    const list=data.commitments.filter(item=>item.currency===currency&&(!annual||item.annual));
    if(annual) {
      const occurrences=list.flatMap(item=>Planner.occurrences(item,year+'-01-01',year+'-12-31')).sort((a,b)=>a.due.localeCompare(b.due));
      return table(['Due','Expense / income','Account','Amount','Status','Actions'],occurrences.map(item=>'<tr><td>'+item.due+'</td><td>'+escape(item.name)+'</td><td>'+escape(item.account)+'</td><td>'+pill(money(item.amount),item.type==='income'?'mint':'rose')+'</td><td>'+ (Planner.isRecorded(item,data.movements)?'Recorded':item.due<data.today?'Overdue':'Planned')+'</td><td>'+commitmentButtons(item)+'</td></tr>').join('')||empty(6,'No annual expenses for '+year+'.'));
    }
    return table(['Name','Account','Frequency','Next outstanding due','Amount','Monthly equivalent','Status','Actions'],list.map(item=>{
      const pending=Planner.occurrences({...item,active:true},item.due,Planner.addDays(data.today,366)).find(row=>!Planner.isRecorded(row,data.movements));
      return '<tr><td>'+escape(item.name)+'</td><td>'+escape(item.account)+'</td><td>'+escape(item.frequency)+'</td><td>'+(pending?pending.due:'Completed')+'</td><td>'+money(item.amount)+'</td><td>'+monthlyEquivalent(item)+'</td><td>'+(item.active?'Active':'Paused')+'</td><td>'+commitmentButtons(pending||item)+'</td></tr>';
    }).join('')||empty(8,'Add a subscription, bill or expected income.'));
  }
  function commitmentButtons(item) {
    const paid=Planner.isRecorded(item,data.movements);
    return '<div class="fp-actions"><button type="button" class="finance-pill tone-amber" data-fp-edit="'+escape(item.id)+'">Edit</button>'+
      (item.active&&!paid&&item.due<=data.today?'<button type="button" class="finance-pill tone-mint" data-fp-record="'+escape(item.id)+'" data-due="'+item.due+'">Record due</button>':'')+'</div>';
  }
  function reconciliationsMarkup() {
    const rows=data.accounts.filter(item=>item.currency===currency);
    return '<p class="fp-caption">Compare the current recorded balance with today’s statement balance. Saving a check records the difference; use a balance correction if you decide to adjust it.</p>'+table(['Account','Currency','Recorded balance','Last check','Difference','Actions'],rows.map(item=>{
      const latest=data.reconciliations.filter(row=>row.account===item.name).sort((a,b)=>b.captured.localeCompare(a.captured))[0];
      return '<tr><td>'+escape(item.name)+'</td><td>'+escape(item.currency)+'</td><td>'+money(item.balance)+'</td><td>'+(latest?latest.date:'Never checked')+'</td><td>'+(latest?pill(money(latest.difference),tone(latest.difference)):'—')+'</td><td><div class="fp-actions"><button class="finance-pill tone-sky" type="button" data-fp-reconcile="'+escape(item.name)+'">Reconcile</button><button class="finance-pill tone-violet" type="button" data-fp-profile="'+escape(item.name)+'">Currency</button></div></td></tr>';
    }).join('')||empty(6))+
      '<details><summary>Reconciliation history</summary>'+table(['Date','Account','Recorded','Statement','Difference','Note'],data.reconciliations.filter(row=>row.currency===currency).slice().reverse().map(row=>'<tr><td>'+row.date+'</td><td>'+escape(row.account)+'</td><td>'+money(row.book)+'</td><td>'+money(row.statement)+'</td><td>'+money(row.difference)+'</td><td>'+escape(row.note)+'</td></tr>').join('')||empty(6))+'</details>';
  }
  function movementMarkup() {
    const rows=data.movements.filter(row=>row.state==='posted'&&row.currency===currency&&row.kind!=='import').slice().reverse();
    return table(['Date','Entry type','Account','Amount','Details','Actions'],rows.map(row=>{
      const reversed=data.movements.some(other=>other.reverses===row.id);
      return '<tr><td>'+row.date+'</td><td>'+escape(row.kind.replace(/_/g,' '))+'</td><td>'+escape(row.account)+'</td><td>'+money(row.amount)+'</td><td>'+escape(row.note||'')+(row.kind==='transfer'?' → '+escape(row.effects[1]?.account||''):'')+(reversed?' · Reversed':'')+'</td><td>'+(!row.reverses&&!reversed?'<button class="finance-pill tone-rose" type="button" data-fp-reverse="'+escape(row.id)+'">Reverse</button>':'—')+'</td></tr>';
    }).join('')||empty(6));
  }
  function annualMarkup() {
    const year=Number(byId('annualReportYear').value)||Planner.parse(data.today).getFullYear();
    const section=type=>{
      const rows=Planner.annualCategories(data.transactions,year,currency,type,data.today);
      const rowMarkup=rows.map(row=>'<tr><td><button class="fp-link" type="button" data-fp-category="'+escape(row.category)+'" data-fp-type="'+type+'" data-fp-start="'+year+'-01-01" data-fp-end="'+year+'-12-31">'+escape(row.category)+'</button></td><td>'+pill(money(row.total),type==='income'?'mint':'rose')+'</td><td>'+money(row.average)+'</td><td>'+row.active+'</td><td>'+money(row.previous)+'</td><td>'+percentage(row.change)+'</td><td>'+row.share.toFixed(1)+'%</td>'+row.months.map(value=>'<td>'+money(value)+'</td>').join('')+'</tr>').join('');
      return '<h4>'+year+' '+(type==='income'?'income sources':'expense categories')+' vs '+(year-1)+'</h4><p class="fp-caption">Current year uses matching year-to-date dates. Monthly average divides the recorded total by 12.</p>'+table(['Category','Annual total','Monthly average','Active months','Previous year','Change','Share',...monthNames],rowMarkup||empty(19),'fp-year-detail');
    };
    return section('income')+section('expense');
  }
  function accountFlowMarkup() {
    const range=getRange(true), rows=Planner.accountFlow(data,range.start,range.end,currency);
    return '<p class="fp-caption">'+range.start+' – '+range.end+' · Opening and closing balances are reconstructed from recorded balances and logged movements.</p>'+table(['Account','Opening','Income','Expenses','Transfers net','Corrections net','Closing'],rows.map(row=>'<tr><td>'+escape(row.account)+'</td><td>'+money(row.opening)+'</td><td>'+pill(money(row.income),'mint')+'</td><td>'+pill(money(row.expense),'rose')+'</td><td>'+money(row.transfers)+'</td><td>'+money(row.corrections)+'</td><td>'+pill(money(row.closing),tone(row.closing))+'</td></tr>').join('')||empty(7));
  }
  function render() {
    if(!data)return;
    byId('fp-dashboard-comparison').innerHTML=comparisonMarkup(getRange());
    byId('fp-month-comparison').innerHTML=comparisonMarkup(getRange(true));
    byId('fp-changes').innerHTML=changesMarkup(getRange(true));
    byId('fp-forecast').innerHTML=forecastMarkup();
    byId('fp-recurring').innerHTML=commitmentRows(false);
    byId('fp-annual-planner').innerHTML=commitmentRows(true);
    byId('fp-annual-comparison').innerHTML=annualMarkup();
    byId('fp-reconciliation').innerHTML=reconciliationsMarkup();
    byId('fp-movement-history').innerHTML=movementMarkup();
    byId('fp-account-flow').innerHTML=accountFlowMarkup();
    for(const selector of ['fp-currency','fp-report-currency']) {
      const input=byId(selector),previous=currency;
      input.replaceChildren(...[...new Set([data.currency,...(data.currencies||[]),...data.accounts.map(item=>item.currency),...data.transactions.map(item=>item.currency)])].map(value=>new Option(value,value)));
      input.value=previous;
    }
    byId('fp-forecast-account').replaceChildren(new Option('All accounts',''),...data.accounts.filter(item=>item.currency===currency).map(item=>new Option(item.name,item.name)));
    byId('fp-forecast-account').value=account;
    updateTransactionCurrency();
    document.querySelectorAll('#dashboardSummary .metric-card,#quickSummary .metric-card,#reports .metric-card,#savingRateCard,#annualSavingRateCard').forEach(card=>{
      card.tabIndex=0;card.setAttribute('role','button');card.setAttribute('aria-label','View supporting transactions');
    });
    addMonthControls();
    byId('fp-status').classList.remove('fp-error');
    byId('fp-status').textContent='Updated '+new Date().toLocaleTimeString()+' · '+currency+' · '+window.trackerEnvironment.toUpperCase()+(data.warnings?.length?' · '+data.warnings.length+' legacy rows need review':'');
    document.dispatchEvent(new CustomEvent('tracker-data-status',{detail:byId('fp-status').textContent}));
    byId('fp-status').hidden=true;
    byId('fp-warnings').textContent=(data.warnings||[]).join(' · ');
  }
  async function refresh(force=false) {
    if(loading){
      if(force===true){await loading;return refresh();}
      return loading;
    }
    loading=(async()=>{
      try {
        const result=await apiGet('getFinanceInsights');
        if(result?.status!=='ok')throw new Error(result?.error||'Planning data is unavailable. Deploy the new Apps Script files first.');
        data=result;
        window.trackerFinanceSnapshot=result;
        window.dispatchEvent(new CustomEvent('tracker-insights-updated',{detail:result}));
        byId('fp-category-list').replaceChildren(...[...new Set(result.transactions.map(row=>row.category))].map(value=>new Option(value,value)));
        if(!currency)currency=result.currency;
        if(account&&!result.accounts.some(row=>row.name===account&&row.currency===currency))account='';
        render();
      } catch(error) {
        byId('fp-status').textContent=error.message;
        byId('fp-status').classList.add('fp-error');byId('fp-status').hidden=false;
        document.dispatchEvent(new CustomEvent('tracker-data-status',{detail:'Refresh failed · '+error.message}));
      }
    })().finally(()=>loading=null);
    return loading;
  }
  function options(values,selected='') { return values.map(value=>'<option value="'+escape(value)+'"'+(value===selected?' selected':'')+'>'+escape(value)+'</option>').join(''); }
  const field=(name,label,type='text',value='',extra='')=>'<label>'+label+'<input name="'+name+'" type="'+type+'" value="'+escape(value)+'" '+extra+'></label>';
  const select=(name,label,values,selected)=>'<label>'+label+'<select name="'+name+'">'+options(values,selected)+'</select></label>';
  function openForm(kind,item={}) {
    if(!data)return;
    editContext={kind,item:kind==='commitment'?{...item,id:item.id||id(),version:item.version||0}:item,requestId:id()};
    const accounts=data.accounts.filter(row=>row.name===item.account||!window.trackerCatalogUI?.item('account',row.name)?.archived).map(row=>row.name),currentAccount=item.account||accounts[0]||'';
    let title,html;
    if(kind==='commitment') {
      title=item.id?'Edit commitment':'New commitment';
      html=field('name','Name','text',item.name||'','required maxlength="160"')+select('type','Direction',['expense','income'],item.type||'expense')+
        select('account','Account',accounts,currentAccount)+field('amount','Amount','number',item.amount||'','required min="0.01" step="0.01"')+
        field('category','Category','text',item.category||'','required maxlength="160" list="fp-category-list"')+select('frequency','Frequency',['once','weekly','fortnightly','monthly','quarterly','yearly'],item.frequency||'monthly')+
        field('due','First due date','date',item.due||data.today,'required')+field('end','End date (optional)','date',item.end||'')+
        '<label class="fp-check"><input name="annual" type="checkbox" '+(item.annual?'checked':'')+'>Annual expense planner</label><label class="fp-check"><input name="active" type="checkbox" '+(item.active!==false?'checked':'')+'>Active</label>'+field('note','Note','text',item.note||'','maxlength="500"');
    } else if(kind==='movement') {
      title='Transfer, refund or balance entry';
      html=select('kind','Entry type',['transfer','refund','opening','correction'],'transfer')+select('account','Account',accounts,currentAccount)+
        '<div data-field="destination">'+select('destination','Destination account',accounts,accounts[1]||'')+'</div>'+
        '<div data-field="reference"><label>Original expense<select name="reference"></select></label></div>'+
        '<div data-field="direction">'+select('direction','Correction direction',['add','deduct'],'add')+'</div>'+
        field('amount','Amount','number','','required min="0.01" step="0.01"')+field('date','Date','date',data.today,'required max="'+data.today+'"')+field('note','Note','text','','maxlength="500"');
    } else if(kind==='reconcile') {
      title='Reconcile '+currentAccount;
      editContext.item.bookSnapshot=data.accounts.find(row=>row.name===currentAccount).balance;
      html='<p class="fp-dialog-hint">Current recorded balance '+money(data.accounts.find(row=>row.name===currentAccount).balance)+'. Compare with today’s statement; saving records a check without changing the balance.</p>'+field('statement','Statement balance today','number','','required step="0.01"')+field('note','Statement reference / note','text','','maxlength="500"');
    } else {
      title='Currency for '+currentAccount;
      html='<p class="fp-dialog-hint">Assign a currency before using an account. Existing transaction currencies are preserved; amounts are never converted.</p>'+field('currency','Currency code or symbol','text',data.accounts.find(row=>row.name===currentAccount).currency,'required maxlength="12"');
    }
    byId('fp-form-title').textContent=title;
    byId('fp-form-fields').innerHTML=html;
    byId('fp-form-error').textContent='';
    byId('fp-form-save').disabled=false;
    byId('fp-form-dialog').showModal();
    updateMovementFields();
  }
  function updateMovementFields() {
    if(editContext?.kind!=='movement')return;
    const form=byId('fp-entry-form'),kind=form.elements.kind.value;
    for(const name of ['destination','reference','direction']) {
      const enabled=name==='destination'?kind==='transfer':name==='reference'?kind==='refund':kind==='correction';
      const host=form.querySelector('[data-field="'+name+'"]');
      host.hidden=!enabled;
      host.querySelector('select').disabled=!enabled;
    }
    if(kind==='refund') {
      const input=form.elements.reference,prior=input.value;
      const rows=data.transactions.filter(row=>row.type==='expense'&&row.amount>0&&row.account===form.elements.account.value&&row.kind!=='refund_reversal');
      input.replaceChildren(...rows.map(row=>new Option(row.date+' · '+row.category+' · '+row.currency+' '+row.amount,row.id)));
      if(rows.some(row=>row.id===prior))input.value=prior;
    }
  }
  function updateTransactionCurrency() {
    if(!data)return;
    const account=byId('txAccount').value;
    byId('fp-transaction-currency').value=data.accounts.find(row=>row.name===account)?.currency||data.currency;
  }
  async function saveForm(event) {
    event.preventDefault();
    const button=byId('fp-form-save');if(button.disabled)return;
    button.disabled=true;
    const values=Object.fromEntries(new FormData(event.currentTarget));
    const {kind,item,requestId}=editContext;
    let action,payload;
    if(kind==='commitment') {
      action='saveCommitment';payload={item:JSON.stringify({...item,...values,amount:Number(values.amount),annual:values.annual==='on',active:values.active==='on'})};
    } else if(kind==='movement') { action='postMovement';payload={...values,requestId}; }
    else if(kind==='reconcile') { action='saveReconciliation';payload={...values,account:item.account,expectedBook:item.bookSnapshot,requestId}; }
    else { action='saveAccountProfile';payload={item:JSON.stringify({account:item.account,currency:values.currency})}; }
    try {
      const result=await apiPost(action,payload);
      if(result?.status!=='ok')throw new Error(result?.error||result?.message||'Unable to save.');
      byId('fp-form-dialog').close();
      notify(result.duplicate?'Already recorded.':'Saved');
      await refresh(true);
      if(kind==='movement') { await loadSetupData();await loadTransactions(); }
    } catch(error) { byId('fp-form-error').textContent=error.message; }
    finally { button.disabled=false; }
  }
  function openDrill(filters,title='Supporting transactions') {
    if(!data)return;
    drill={rows:Planner.filter(data.transactions,{currency,...filters}),page:0,title,currency:filters.currency||currency};
    byId('fp-drill-search').value='';
    byId('fp-drill-title').textContent=title;
    byId('fp-drill-dialog').showModal();
    renderDrill();
  }
  function renderDrill() {
    const query=byId('fp-drill-search').value.toLowerCase();
    const rows=drill.rows.filter(row=>[row.category,row.account,row.desc,row.date,row.kind].some(value=>String(value).toLowerCase().includes(query)));
    const pages=Math.max(1,Math.ceil(rows.length/50));drill.page=Math.min(drill.page,pages-1);
    const values=Planner.totals(rows);
    byId('fp-drill-summary').textContent=rows.length+' entries · '+drill.currency+' · income '+values.income.toFixed(2)+' · expenses '+values.expense.toFixed(2)+' · net '+values.net.toFixed(2);
    byId('fp-drill-body').innerHTML=table(['Date','Type','Category','Account','Amount','Note'],rows.slice(drill.page*50,drill.page*50+50).map(row=>'<tr><td>'+row.date+'</td><td>'+escape(row.kind)+'</td><td>'+escape(row.category)+'</td><td>'+escape(row.account)+'</td><td>'+pill(money(row.amount,drill.currency),row.type==='income'?'mint':'rose')+'</td><td>'+escape(row.desc)+'</td></tr>').join('')||empty(6));
    byId('fp-drill-page').textContent=(drill.page+1)+' / '+pages;
    byId('fp-drill-previous').disabled=drill.page===0;
    byId('fp-drill-next').disabled=drill.page>=pages-1;
  }
  async function confirmOperation(message,action,payload,button) {
    if(!await confirmFinanceAction(message,{title:'Confirm ledger entry'}))return;
    button.disabled=true;
    try {
      const result=await apiPost(action,{...payload,requestId:id()});
      if(result?.status!=='ok')throw new Error(result?.error||'Unable to save.');
      notify(result.duplicate?'Already recorded':'Ledger entry saved');
      await refresh(true);await loadSetupData();await loadTransactions();
    } catch(error) { window.trackerFeedback.notify(error.message,'error'); }
    finally { button.disabled=false; }
  }
  function contextRange(target) {
    if(target.closest('#annualDashboard')) {
      const source=window.trackerAnnualReportPeriod||{year:Number(byId('annualReportYear').value)||Planner.parse(data.today).getFullYear(),currency:data.currency};
      return {start:source.year+'-01-01',end:source.year+'-12-31',currency:source.currency};
    }
    if(target.closest('#monthlyDashboard')) {
      const source=window.trackerMonthlyReportPeriod||{year:Number(byId('reportYear').value),month:Number(byId('reportMonth').value),currency:data.currency};
      return {start:Planner.iso(new Date(source.year,source.month-1,1,12)),end:Planner.iso(new Date(source.year,source.month,0,12)),currency:source.currency};
    }
    if(target.closest('#dashboardSummary')) {
      const now=Planner.parse(data.today);
      return {start:Planner.iso(new Date(now.getFullYear(),now.getMonth(),1,12)),end:Planner.iso(new Date(now.getFullYear(),now.getMonth()+1,0,12)),currency:data.currency};
    }
    return {currency:data.currency,ids:window.trackerDisplayedLedgerIds};
  }
  function originalDrill(event) {
    if(!data)return;
    const kpi=event.target.closest('#summaryIncomeCard,#summaryExpenseCard,#summarySavingsCard,#sumIncomeCard,#sumExpenseCard,#sumBalanceCard,#kpiTotalIncome,#kpiTotalExpense,#kpiTotalBalance,#annualKpiIncome,#annualKpiExpense,#annualKpiBalance,#savingRateCard,#annualSavingRateCard');
    if(kpi){const type=/income/i.test(kpi.id)?'income':/expense/i.test(kpi.id)?'expense':null;openDrill({...contextRange(kpi),type},'Transactions behind '+kpi.textContent.trim());return;}
    const cell=event.target.closest('#reports tbody td');
    if(!cell||cell.closest('.fp-table')||event.target.closest('button,a,input'))return;
    const row=cell.parentElement,table=cell.closest('table'),first=row.cells[0]?.textContent.trim();
    if(!first||/no data/i.test(first))return;
    const holder=(table.id||table.closest('.table-holder')?.id||'').toLowerCase();
    const head=table.tHead?.rows[table.tHead.rows.length-1]?.cells[cell.cellIndex]?.textContent.trim()||'';
    let filters=contextRange(cell);
    if(holder.includes('cashflow')) {
      if(first==='Income')filters.type='income';
      if(first==='Expense')filters.type='expense';
    } else if(holder.includes('monthly_overview')) {
      const index=['January','February','March','April','May','June','July','August','September','October','November','December'].indexOf(first);
      if(index>=0){const year=Number(filters.start.slice(0,4));filters={start:Planner.iso(new Date(year,index,1,12)),end:Planner.iso(new Date(year,index+1,0,12)),currency:filters.currency};}
      if(/income/i.test(head))filters.type='income';if(/expense/i.test(head))filters.type='expense';
    } else {
      if(/income/.test(holder))filters.type='income';if(/expense/.test(holder))filters.type='expense';
      if(!/^(?:grand\s+)?(?:total|average)$/i.test(first))filters.category=first;
    }
    const monthIndex=monthNames.findIndex(name=>name.toLowerCase()===head.toLowerCase());
    if(monthIndex>=0){const year=Number(filters.start.slice(0,4));filters.start=Planner.iso(new Date(year,monthIndex,1,12));filters.end=Planner.iso(new Date(year,monthIndex+1,0,12));}
    openDrill(filters,first+' · supporting transactions');
  }
  function addMonthControls() {
    document.querySelectorAll('#annualDashboard table').forEach(table=>{
      const heads=[...table.querySelectorAll('thead th')],first=heads.findIndex(head=>monthNames.includes(head.textContent.trim()));
      if(first<0)return;
      table.classList.add('fp-wide-months');
      for(const row of table.rows)[...row.cells].forEach((cell,index)=>cell.classList.toggle('fp-month-cell',index>=first));
      const host=table.parentElement;
      if(!host.querySelector(':scope > .fp-month-toggle')) {
        const button=document.createElement('button');button.type='button';button.className='finance-pill tone-sky fp-month-toggle';button.textContent='Expand months';button.setAttribute('aria-expanded','false');
        button.addEventListener('click',()=>{const expanded=table.classList.toggle('fp-months-expanded');button.textContent=expanded?'Collapse months':'Expand months';button.setAttribute('aria-expanded',String(expanded));});
        host.prepend(button);
      }
    });
  }
  function setupEvents() {
    byId('fp-refresh').addEventListener('click',refresh);
    for(const selector of ['fp-currency','fp-report-currency'])byId(selector).addEventListener('change',event=>{currency=event.target.value;account='';render();});
    byId('fp-forecast-account').addEventListener('change',event=>{account=event.target.value;byId('fp-forecast').innerHTML=forecastMarkup();});
    byId('fp-entry-form').addEventListener('submit',saveForm);
    byId('fp-entry-form').addEventListener('change',updateMovementFields);
    byId('fp-form-cancel').addEventListener('click',()=>{if(!byId('fp-form-save').disabled)byId('fp-form-dialog').close();});
    byId('fp-form-dialog').addEventListener('cancel',event=>{if(byId('fp-form-save').disabled)event.preventDefault();});
    byId('fp-drill-close').addEventListener('click',()=>byId('fp-drill-dialog').close());
    byId('fp-drill-search').addEventListener('input',()=>{drill.page=0;renderDrill();});
    byId('fp-drill-previous').addEventListener('click',()=>{drill.page--;renderDrill();});
    byId('fp-drill-next').addEventListener('click',()=>{drill.page++;renderDrill();});
    byId('txAccount').addEventListener('change',updateTransactionCurrency);
    window.addEventListener('tracker-form-updated',updateTransactionCurrency);
    byId('accountAdjustmentPurpose').addEventListener('change',event=>{
      const cashflow=event.target.value==='cashflow';
      byId('accountAdjustmentForm').querySelector('[type=submit]').disabled=cashflow&&!byId('accountAdjustmentCategory').options.length;
      byId('accountAdjustmentCategory').disabled=!cashflow;
      byId('accountAdjustmentCategory').required=cashflow;
      byId('accountAdjustmentForm').querySelector('small').textContent=cashflow
        ? 'This entry updates the account and appears in your ledger and reports.'
        : 'This entry updates the account through Movements and is excluded from income and expense totals.';
    });
    byId('accountAdjustmentForm').addEventListener('submit',async event=>{
      const kind=byId('accountAdjustmentPurpose').value;
      if(kind==='cashflow')return;
      event.preventDefault();event.stopImmediatePropagation();
      const dialog=byId('accountAdjustmentDialog'),button=event.currentTarget.querySelector('[type=submit]');
      if(button.dataset.busy)return;
      const amount=Number(byId('accountAdjustmentAmount').value);
      if(!Number.isFinite(amount)||amount<=0)return;
      button.dataset.busy='true';button.disabled=true;
      try {
        if(kind==='opening'&&dialog.dataset.direction==='expense')throw new Error('Use Add for an opening balance, or use a correction to deduct.');
        const result=await apiPost('postMovement',{requestId:dialog.dataset.requestId,kind,account:byId('accountAdjustmentName').textContent,amount,direction:dialog.dataset.direction==='expense'?'deduct':'add',date:data.today,note:'Account balance '+kind});
        if(result?.status!=='ok')throw new Error(result?.error||'Unable to save.');
        dialog.close();notify('Balance entry saved');await refresh(true);await loadSetupData();await loadTransactions();
      } catch(error) { byId('accountAdjustmentStatus').textContent=error.message; }
      finally {delete button.dataset.busy;button.disabled=false;}
    },true);
    document.addEventListener('click',event=>{
      const button=event.target.closest('button');if(!button)return;
      if(button.dataset.fpManaged!==undefined)document.querySelector('[data-tab="movements"]').click();
      if(button.dataset.fpNew!==undefined)openForm(button.dataset.fpNew,button.dataset.annual?{annual:true,frequency:'once'}:{});
      if(button.dataset.fpEdit)openForm('commitment',data.commitments.find(row=>row.id===button.dataset.fpEdit));
      if(button.dataset.fpReconcile)openForm('reconcile',{account:button.dataset.fpReconcile});
      if(button.dataset.fpProfile)openForm('profile',{account:button.dataset.fpProfile});
      if(button.dataset.fpRecord)confirmOperation('Record this due payment in your ledger and account balance?','postCommitment',{id:button.dataset.fpRecord,due:button.dataset.due},button);
      if(button.dataset.fpReverse)confirmOperation('Reverse this movement? An opposite ledger/account entry will be recorded.','reverseMovement',{id:button.dataset.fpReverse},button);
      if(button.dataset.fpDrill!==undefined)openDrill({start:button.dataset.fpStart,end:button.dataset.fpEnd,type:['income','expense'].includes(button.dataset.fpDrill)?button.dataset.fpDrill:null},'Period comparison · '+button.dataset.fpDrill);
      if(button.dataset.fpCategory)openDrill({start:button.dataset.fpStart,end:button.dataset.fpEnd,category:button.dataset.fpCategory,type:button.dataset.fpType||'expense'},button.dataset.fpCategory);
      if(button.id==='genReport'||button.id==='genAnnual'||button.dataset.subtab)setTimeout(()=>{if(data){render();addMonthControls();}},0);
    });
    document.addEventListener('click',originalDrill);
    document.addEventListener('keydown',event=>{if((event.key==='Enter'||event.key===' ')&&event.target.matches('.metric-card[role=button],#savingRateCard[role=button],#annualSavingRateCard[role=button]')){event.preventDefault();event.target.click();}});
    ['reportMonth','reportYear','annualReportYear'].forEach(name=>byId(name).addEventListener('change',()=>{if(data)render();}));
    window.addEventListener('tracker-ledger-updated',()=>{clearTimeout(refreshTimer);refreshTimer=setTimeout(refresh,350);});
    let monthTimer;
    new MutationObserver(()=>{clearTimeout(monthTimer);monthTimer=setTimeout(addMonthControls,60);}).observe(byId('annualDashboard'),{childList:true,subtree:true});
    if(window.Chart)Chart.register({id:'financePlannerDrill',afterEvent(chart,args){
      if(args.event.type!=='click'||!data)return;
      const hits=chart.getElementsAtEventForMode(args.event.native,'nearest',{intersect:true},true);if(!hits.length)return;
      const hit=hits[0],label=String(chart.data.labels[hit.index]||''),canvas=chart.canvas;
      let filters=contextRange(canvas);
      if(canvas.id==='miniChart')filters={currency:data.currency,ids:window.trackerDisplayedLedgerIds};
      if(/income/i.test(label)&&!label.includes('('))filters.type='income';
      else if(/expense/i.test(label)&&!label.includes('('))filters.type='expense';
      const monthIndex=monthNames.findIndex(name=>label.startsWith(name));
      if(monthIndex>=0&&canvas.closest('#annualDashboard')){const year=Number(filters.start.slice(0,4));filters.start=Planner.iso(new Date(year,monthIndex,1,12));filters.end=Planner.iso(new Date(year,monthIndex+1,0,12));const series=String(chart.data.datasets[hit.datasetIndex]?.label||'');if(/income/i.test(series))filters.type='income';if(/expense/i.test(series))filters.type='expense';}
      if(/Distribution|breakdown/.test(canvas.id||canvas.parentElement.id)) {
        const category=data.transactions.map(row=>row.category).find(name=>label===name||label.startsWith(name+' ('));
        if(category)filters.category=category;
        if(/income/i.test(canvas.id||canvas.parentElement.id))filters.type='income';else if(/expense/i.test(canvas.id||canvas.parentElement.id))filters.type='expense';
      }
      openDrill(filters,label+' · supporting transactions');
    }});
  }
  window.trackerPlanning={refresh,openDrill,openForm};
  setupEvents();
  refresh();
})();
