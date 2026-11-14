(function(root) {
  'use strict';
  const Planner=root.FinancePlanner;
  function csv(text,delimiter) {
    text=String(text||'').replace(/^\uFEFF/,'');
    if(!delimiter) {
      const first=text.split(/\r?\n/)[0];
      delimiter=['\t',';',','].map(value=>({value,count:first.split(value).length})).sort((a,b)=>b.count-a.count)[0].value;
    }
    const rows=[];let row=[],field='',quoted=false;
    for(let i=0;i<text.length;i++) {
      const char=text[i];
      if(char==='"') {
        if(quoted&&text[i+1]==='"'){field+='"';i++;}
        else if(quoted){quoted=false;}
        else if(field===''){quoted=true;}
        else throw new Error('Unexpected quote in CSV row '+(rows.length+1));
      } else if(char===delimiter&&!quoted){row.push(field);field='';}
      else if((char==='\n'||char==='\r')&&!quoted) {
        if(char==='\r'&&text[i+1]==='\n')i++;
        row.push(field);if(row.some(value=>value.trim()))rows.push(row);row=[];field='';
      } else field+=char;
    }
    if(quoted)throw new Error('The CSV contains an unclosed quoted field.');
    row.push(field);if(row.some(value=>value.trim()))rows.push(row);
    return {headers:rows.shift()||[],rows,delimiter};
  }
  function date(value,format='iso') {
    const raw=String(value||'').trim();
    if(/^\d{4}-\d{2}-\d{2}(?:T.*)?$/.test(raw)) {
      const result=raw.slice(0,10);
      if(new Date(result+'T12:00:00Z').toISOString().slice(0,10)!==result)throw new Error('Invalid date');
      return result;
    }
    const parts=raw.split(/[-/.]/).map(Number);
    if(parts.length!==3||parts.some(value=>!Number.isInteger(value))||!['dmy','mdy'].includes(format))throw new Error('Select the date format used in the CSV.');
    const [a,b,year]=parts,month=format==='dmy'?b:a,day=format==='dmy'?a:b;
    if(year<1900||year>2200)throw new Error('Use a four-digit year.');
    const result=year+'-'+String(month).padStart(2,'0')+'-'+String(day).padStart(2,'0');
    if(new Date(result+'T12:00:00Z').toISOString().slice(0,10)!==result)throw new Error('Invalid date');
    return result;
  }
  function amount(value,decimal='dot') {
    let raw=String(value||'').trim().replace(/[\p{Sc}\s]/gu,'');
    const negative=/^\(.*\)$/.test(raw);raw=raw.replace(/[()]/g,'');
    if(decimal==='comma')raw=raw.replace(/\./g,'').replace(',','.');
    else raw=raw.replace(/,/g,'');
    if(!/^[+-]?\d*(?:\.\d{1,2})?$/.test(raw)||!raw||raw==='.'||raw==='-'||raw==='+')throw new Error('Invalid amount');
    const number=Number(raw)*(negative?-1:1);
    if(!Number.isFinite(number)||Math.abs(number)>1e12)throw new Error('Invalid amount');
    return Math.round(number*100)/100;
  }
  function key(row) {return JSON.stringify([row.date,row.type,row.category,row.account,Math.round(Number(row.amount)*100),row.currency||'',String(row.desc||'').trim()]);}
  function preview(parsed,mapping,defaults,snapshot,items) {
    const known=new Set(snapshot.transactions.map(key));
    return parsed.rows.map((values,index)=>{
      const cell=name=>mapping[name]!==''&&mapping[name]!=null?String(values[Number(mapping[name])]||'').trim():'';
      try {
        const kind=cell('kind');if(/refund|reversal|transfer|opening|correction/i.test(kind))throw new Error('Record this entry through Movements to preserve its links.');
        let type=cell('type').toLowerCase()||defaults.type,number;
        if(mapping.debit!=null&&mapping.debit!==''||mapping.credit!=null&&mapping.credit!=='') {
          const debit=cell('debit')?amount(cell('debit'),defaults.decimal):0;
          const credit=cell('credit')?amount(cell('credit'),defaults.decimal):0;
          if(debit&&credit)throw new Error('Both debit and credit have a value.');
          type=credit?'income':'expense';number=Math.abs(credit||debit);
        } else {
          number=amount(cell('amount'),defaults.decimal);
          if(type==='signed')type=number<0?'expense':'income';
          type=['credit','cr','deposit','income'].includes(type)?'income':['debit','dr','withdrawal','expense'].includes(type)?'expense':type;
          number=Math.abs(number);
        }
        if(!['income','expense'].includes(type)||number<=0)throw new Error('Choose an income/expense direction and positive amount.');
        const account=cell('account')||defaults.account,category=cell('category')||defaults.category;
        const accountRow=snapshot.accounts.find(row=>row.name===account);
        if(!accountRow)throw new Error('Unknown account: '+account);
        const categoryItem=items.find(row=>row.type===type&&row.name===category);
        const accountItem=items.find(row=>row.type==='account'&&row.name===account);
        if(!categoryItem||categoryItem.archived)throw new Error('Create or map an active '+type+' category: '+category);
        if(accountItem?.archived)throw new Error('The account is archived.');
        const currency=cell('currency')||accountRow.currency;
        if(currency!==accountRow.currency)throw new Error('Currency does not match the account.');
        const row={date:date(cell('date'),defaults.dateFormat),type,amount:number,account,category,currency,desc:cell('description')};
        if(row.date>snapshot.today)throw new Error('Future-dated rows must be reviewed as commitments.');
        const duplicate=known.has(key(row));known.add(key(row));
        return {index,row,duplicate,error:'',selected:!duplicate};
      } catch(error) {return {index,error:error.message,selected:false,raw:values};}
    });
  }
  function filter(rows,filters) {
    const search=String(filters.search||'').toLowerCase();
    return rows.filter(row=>(!search||[row.id,row.date,row.type,row.category,row.account,row.desc,row.amount].some(value=>String(value).toLowerCase().includes(search)))&&
      (!filters.from||row.date>=filters.from)&&(!filters.to||row.date<=filters.to)&&(!filters.type||row.type===filters.type)&&(!filters.account||row.account===filters.account)&&(!filters.category||row.category===filters.category)&&
      (filters.min===''||filters.min==null||Number(row.amount)>=Number(filters.min))&&(filters.max===''||filters.max==null||Number(row.amount)<=Number(filters.max)));
  }
  function sort(rows,column,direction='desc') {
    const copy=rows.slice(),factor=direction==='asc'?1:-1;
    copy.sort((a,b)=>factor*(column==='amount'?Number(a.amount)-Number(b.amount):String(a[column]||'').localeCompare(String(b[column]||'')))||String(a.id||a.row).localeCompare(String(b.id||b.row)));
    return copy;
  }
  function range(preset,today,start,end) {
    const now=Planner.parse(today),year=now.getFullYear(),month=now.getMonth();
    if(preset==='thisMonth')return {start:Planner.iso(new Date(year,month,1,12)),end:today};
    if(preset==='lastMonth')return {start:Planner.iso(new Date(year,month-1,1,12)),end:Planner.iso(new Date(year,month,0,12))};
    if(preset==='last90')return {start:Planner.addDays(today,-89),end:today};
    if(preset==='financialYear')return {start:(month<3?year-1:year)+'-04-01',end:today};
    start=date(start);end=date(end);if(start>end)throw new Error('Start date must precede end date.');
    if((Planner.parse(end)-Planner.parse(start))/86400000>3660)throw new Error('Choose a range of ten years or less.');
    return {start,end};
  }
  function annualRange(year,mode,today) {
    const start=mode==='financial'?year+'-04-01':year+'-01-01';
    const end=mode==='financial'?(year+1)+'-03-31':year+'-12-31';
    return {start,end,actualEnd:today<end?today:end};
  }
  function grouped(rows,items) {
    const groups=new Map();
    rows.filter(row=>row.type==='expense').forEach(row=>{
      const group=items.find(item=>item.type==='expense'&&item.name===row.category)?.group||'Ungrouped';
      groups.set(group,(groups.get(group)||0)+Number(row.amount));
    });
    return [...groups].map(([group,amount])=>({group,amount})).sort((a,b)=>b.amount-a.amount);
  }
  function scheduled(snapshot,range,currency,account,category) {
    const due=snapshot.commitments.filter(item=>item.currency===currency&&(!account||item.account===account)&&(!category||item.category===category)).flatMap(item=>Planner.occurrences(item,range.start,range.end));
    return due.map(item=>({...item,recorded:Planner.isRecorded(item,snapshot.movements)}));
  }
  function annualReview(snapshot,range,currency,items) {
    const rows=Planner.filter(snapshot.transactions,{start:range.start,end:range.actualEnd,currency});
    const months=[];let current=Planner.parse(range.start);
    for(let index=0;index<12;index++) {
      const start=Planner.iso(current),end=Planner.iso(new Date(current.getFullYear(),current.getMonth()+1,0,12));
      const selected=Planner.filter(rows,{start,end});months.push({start,end,label:start.slice(0,7),...Planner.totals(selected)});
      current=new Date(current.getFullYear(),current.getMonth()+1,1,12);
    }
    const elapsed=months.filter(month=>month.start<=range.actualEnd);
    const highest=elapsed.slice().sort((a,b)=>b.expense-a.expense)[0];
    const strongest=elapsed.slice().sort((a,b)=>b.net-a.net)[0];
    const income=rows.filter(row=>row.type==='income'),totalIncome=income.reduce((sum,row)=>sum+Number(row.amount),0);
    const sources=[...new Set(income.map(row=>row.category))].map(category=>{
      const entries=income.filter(row=>row.category===category),total=entries.reduce((sum,row)=>sum+Number(row.amount),0);
      return {category,total,receipts:entries.length,active:new Set(entries.map(row=>row.date.slice(0,7))).size,average:total/entries.length,share:totalIncome>0?total/totalIncome*100:0};
    }).sort((a,b)=>b.total-a.total);
    const previousStart=Planner.iso(new Date(Planner.parse(range.start).getFullYear()-1,Planner.parse(range.start).getMonth(),1,12));
    const last=Planner.parse(range.actualEnd),previousEnd=Planner.iso(new Date(last.getFullYear()-1,last.getMonth(),Math.min(last.getDate(),new Date(last.getFullYear()-1,last.getMonth()+1,0).getDate()),12));
    const changes=Planner.categoryChanges(snapshot.transactions,{start:range.start,end:range.actualEnd,previousStart,previousEnd},currency);
    const categories=[...new Set(rows.filter(row=>row.type==='expense').map(row=>row.category))].map(category=>({category,months:months.map(month=>Planner.filter(rows,{start:month.start,end:month.end,type:'expense',category}).reduce((sum,row)=>sum+Number(row.amount),0))}));
    const outstanding=scheduled(snapshot,range,currency).filter(item=>!item.recorded&&item.type==='expense');
    return {months,highest,strongest,sources,changes,categories,outstanding,groups:grouped(rows,items)};
  }
  function safeCell(value) {
    let text=String(value??'');
    if(typeof value!=='number'&&/^\s*[=+\-@]/.test(text))text="'"+text;
    return '"'+text.replace(/"/g,'""')+'"';
  }
  function exportCSV(rows,context) {
    const headers=['Date','Type','Category','Account','Amount','Currency','Description','Entry kind','Report start','Report end','Account filter','Category filter'];
    return '\uFEFF'+[headers,...rows.map(row=>[row.date,row.type,row.category,row.account,Number(row.amount),row.currency,row.desc,row.kind||row.type,context.start,context.end,context.account||'All',context.category||'All'])].map(row=>row.map(safeCell).join(',')).join('\r\n');
  }
  root.FinanceWorkspace={csv,date,amount,key,preview,filter,sort,range,annualRange,grouped,scheduled,annualReview,exportCSV};
})(typeof window==='undefined'?globalThis:window);
