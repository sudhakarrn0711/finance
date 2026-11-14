(function(root) {
  'use strict';
  const parse = value => {
    if (value instanceof Date) return new Date(value.getFullYear(),value.getMonth(),value.getDate(),12);
    const raw = String(value || '');
    if (/^\d{2}-\d{2}-\d{4}$/.test(raw)) { const [d,m,y]=raw.split('-').map(Number); return new Date(y,m-1,d,12); }
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) { const [y,m,d]=raw.split('-').map(Number); return new Date(y,m-1,d,12); }
    const date = new Date(raw);
    return new Date(date.getFullYear(),date.getMonth(),date.getDate(),12);
  };
  const iso = value => { const date=parse(value);return date.getFullYear()+'-'+String(date.getMonth()+1).padStart(2,'0')+'-'+String(date.getDate()).padStart(2,'0'); };
  const addDays = (value, days) => { const date=parse(value);date.setDate(date.getDate()+days);return iso(date); };
  const lastDay = (year,month) => new Date(year,month+1,0).getDate();
  function period(year,month,today) {
    const now=parse(today);
    const current=now.getFullYear()===year && now.getMonth()===month;
    const day=current ? now.getDate() : lastDay(year,month);
    const previous=new Date(year,month-1,1,12);
    return {
      start:iso(new Date(year,month,1,12)),end:iso(new Date(year,month,day,12)),
      previousStart:iso(previous),previousEnd:iso(new Date(previous.getFullYear(),previous.getMonth(),Math.min(day,lastDay(previous.getFullYear(),previous.getMonth())),12)),
      partial:current
    };
  }
  function filter(rows,options) {
    return rows.filter(row => (!options.ids || options.ids.includes(row.id)) && (!options.currency || row.currency===options.currency) && (!options.account || row.account===options.account) &&
      (!options.type || row.type===options.type || row.kind===options.type) && (!options.category || row.category===options.category) &&
      (!options.start || iso(row.date)>=options.start) && (!options.end || iso(row.date)<=options.end));
  }
  function totals(rows) {
    const income=rows.filter(row=>row.type==='income').reduce((sum,row)=>sum+Number(row.amount||0),0);
    const expense=rows.filter(row=>row.type==='expense').reduce((sum,row)=>sum+Number(row.amount||0),0);
    return {income,expense,net:income-expense,rate:income>0?(income-expense)/income*100:null};
  }
  function change(current,previous) { return previous===0?null:(current-previous)/Math.abs(previous)*100; }
  function compare(rows,range,currency) {
    const current=totals(filter(rows,{start:range.start,end:range.end,currency}));
    const previous=totals(filter(rows,{start:range.previousStart,end:range.previousEnd,currency}));
    return {current,previous,changes:{income:change(current.income,previous.income),expense:change(current.expense,previous.expense),net:change(current.net,previous.net),rate:current.rate===null||previous.rate===null?null:current.rate-previous.rate}};
  }
  function categoryChanges(rows,range,currency) {
    const current=filter(rows,{start:range.start,end:range.end,currency,type:'expense'});
    const prior=filter(rows,{start:range.previousStart,end:range.previousEnd,currency,type:'expense'});
    const aggregate=entries=>entries.reduce((map,row)=>map.set(row.category,(map.get(row.category)||0)+Number(row.amount||0)),new Map());
    const a=aggregate(current),b=aggregate(prior),total=current.reduce((sum,row)=>sum+Number(row.amount||0),0);
    return [...new Set([...a.keys(),...b.keys()])].map(category=>({category,current:a.get(category)||0,previous:b.get(category)||0,difference:(a.get(category)||0)-(b.get(category)||0),change:change(a.get(category)||0,b.get(category)||0),share:total>0?(a.get(category)||0)/total*100:0})).sort((a,b)=>Math.abs(b.difference)-Math.abs(a.difference));
  }
  function occurrence(item,index) {
    const first=parse(item.due);
    if (item.frequency==='weekly'||item.frequency==='fortnightly') return addDays(first,index*(item.frequency==='weekly'?7:14));
    if(item.frequency==='once')return iso(first);
    const monthStep={monthly:1,quarterly:3,yearly:12}[item.frequency];
    const next=new Date(first.getFullYear(),first.getMonth()+index*monthStep,1,12);
    next.setDate(Math.min(first.getDate(),lastDay(next.getFullYear(),next.getMonth())));
    return iso(next);
  }
  function occurrences(item,start,end) {
    if(!item.active)return[];
    const out=[];
    for(let index=0;index<20000;index++) {
      const due=occurrence(item,index);
      if(due>end || item.end && due>item.end)break;
      if(due>=start)out.push({...item,due});
      if(item.frequency==='once')break;
    }
    return out;
  }
  function isRecorded(item,movements) {
    return movements.some(row=>row.state==='posted'&&row.commitment===item.id&&row.due===item.due&&!row.reverses&&!movements.some(other=>other.state==='posted'&&other.reverses===row.id));
  }
  function forecast(data,currency,account,today) {
    const end=addDays(today,29);
    let balance=data.accounts.filter(row=>row.currency===currency&&(!account||row.name===account)).reduce((sum,row)=>sum+Number(row.balance||0),0);
    const events=data.commitments.filter(item=>item.currency===currency&&(!account||item.account===account)).flatMap(item=>occurrences(item,today,end)).filter(item=>!isRecorded(item,data.movements)).sort((a,b)=>a.due.localeCompare(b.due)||a.id.localeCompare(b.id));
    return events.map(item=>{balance+=item.type==='income'?Number(item.amount):-Number(item.amount);return {...item,projected:balance};});
  }
  function annualCategories(rows,year,currency,type,today) {
    const now=today?parse(today):null;
    const partial=now&&now.getFullYear()===year;
    const end=partial?iso(now):year+'-12-31';
    const previousEnd=partial?iso(new Date(year-1,now.getMonth(),Math.min(now.getDate(),lastDay(year-1,now.getMonth())),12)):(year-1)+'-12-31';
    const selected=filter(rows,{start:year+'-01-01',end,currency,type});
    const prior=filter(rows,{start:(year-1)+'-01-01',end:previousEnd,currency,type});
    const names=[...new Set([...selected,...prior].map(row=>row.category))];
    const total=selected.reduce((sum,row)=>sum+Number(row.amount||0),0);
    return names.map(category=>{
      const months=Array(12).fill(0);
      selected.filter(row=>row.category===category).forEach(row=>months[parse(row.date).getMonth()]+=Number(row.amount||0));
      const value=months.reduce((a,b)=>a+b,0),previous=prior.filter(row=>row.category===category).reduce((sum,row)=>sum+Number(row.amount||0),0);
      return {category,total:value,average:value/12,active:months.filter(n=>n!==0).length,previous,change:change(value,previous),share:total>0?value/total*100:0,months};
    }).sort((a,b)=>b.total-a.total);
  }
  function accountFlow(data,start,end,currency) {
    return data.accounts.filter(account=>account.currency===currency&&account.balanceKnown!==false).map(account=>{
      const rows=filter(data.transactions,{account:account.name,currency});
      const journal=data.movements.filter(row=>row.state==='posted'&&row.currency===currency&&!row.transaction&&!row.transactions);
      const effects=journal.flatMap(row=>row.effects.filter(effect=>effect.account===account.name).map(effect=>({date:row.date,delta:effect.delta,kind:row.kind})));
      const delta=row=>row.type==='income'?Number(row.amount||0):-Number(row.amount||0);
      const opening=account.balance-rows.filter(row=>row.date>=start).reduce((sum,row)=>sum+delta(row),0)-effects.filter(row=>row.date>=start).reduce((sum,row)=>sum+row.delta,0);
      const within=filter(rows,{start,end}),selected=effects.filter(row=>row.date>=start&&row.date<=end);
      const income=within.filter(row=>row.type==='income').reduce((sum,row)=>sum+Number(row.amount),0),expense=within.filter(row=>row.type==='expense').reduce((sum,row)=>sum+Number(row.amount),0);
      const transfers=selected.filter(row=>row.kind.startsWith('transfer')).reduce((sum,row)=>sum+row.delta,0);
      const corrections=selected.filter(row=>!row.kind.startsWith('transfer')).reduce((sum,row)=>sum+row.delta,0);
      return {account:account.name,opening,income,expense,transfers,corrections,closing:opening+income-expense+transfers+corrections};
    });
  }
  root.FinancePlanner={parse,iso,addDays,period,filter,totals,change,compare,categoryChanges,occurrence,occurrences,isRecorded,forecast,annualCategories,accountFlow};
})(typeof window==='undefined'?globalThis:window);
