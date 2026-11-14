(()=>{'use strict';
const FALLBACK_ICONS = {
  travel:"✈️", vacation:"🌴", trip:"🧳", flight:"🛫",
  home:"🏠", house:"🏡", car:"🚗", auto:"🚙", bike:"🏍️",
  health:"💊", medical:"🏥", hospital:"🩺", fitness:"💪",
  education:"🎓", school:"🏫", college:"📚", study:"📝",
  wedding:"💍", marriage:"👰", honeymoon:"❤️", baby:"🍼",
  child:"👶", retirement:"👴", pension:"💼",
  electronics:"💻", laptop:"🖥️", phone:"📱", gadget:"⌚",
  party:"🥳", celebration:"🎉", birthday:"🎂"
};


let ICON_MAP=FALLBACK_ICONS;const fmt=n=>window.RanSanModule.money(n),escapeHtml=v=>window.RanSanModule.esc(v),formatDate=v=>v?new Date(v).toLocaleDateString():'';
function barHtml(pct,state='pos'){return '<div class="bar mt-1" style="--goal-progress:'+window.GoalsView.progress(pct)+'"><span class="'+(state==='neg'?'g-neg':'g-pos')+'" style="width:'+Math.max(0,Math.min(100,pct))+'%"></span></div>';}
function goalIcon(name="",type=""){
  const lower=(name||"").toLowerCase();
  for(const key in ICON_MAP){
    if(lower.includes(key)) return ICON_MAP[key];
  }
  if(lower.includes("debt")||(type||"").toLowerCase()==="debt") return "💸";
  return (type||"").toLowerCase()==="saving"?"💰":"📊";
}

// urgency chip
function urgencyChip(days,g){if(g.pct>=100)return '<span class="goals-pill" style="--goal-accent:#6ee7b7">✓ Completed</span>';const d=window.GoalsView.deadline(g.deadline,window.RanSanModule.data.today);return '<span class="goals-pill" style="--goal-accent:'+d.color+'">'+d.label+'</span>';}

// badges
function badgeChips(g){
  const chips=[];
  if(g.pct>=100){
    chips.push(`<span class="chip chip-green">✅ Done</span>`);
    const dateTxt=g.completion?formatDate(g.completion):'';
    chips.push(`<span class="chip chip-green">${dateTxt?'🎉 Achieved on '+dateTxt:'Completion date not recorded'}</span>`);
  } else if(g.pct>=50){
    chips.push(`<span class="chip chip-yellow">🏆 50%+</span>`);
  }
  if(g.daysLeft!=null && g.pct<100) chips.push(urgencyChip(g.daysLeft,g));
  chips.push(`<span class="goals-pill" style="--goal-accent:#fda4af">🎯 Target ${fmt(g.target)}</span>`);
  chips.push(`<span class="goals-pill" style="--goal-accent:#6ee7b7">💰 Current ${fmt(g.current)}</span>`);
  chips.push(`<span class="goals-pill" style="--goal-accent:${window.GoalsView.progress(g.configured===false?null:g.pct)}">📊 ${g.configured===false?'Not configured':g.pct.toFixed(1)+'%'}</span>`);
  return `<div class="chips mt-2">${chips.join("")}</div>`;
}

// card
function goalTile(g){
  const cardCls=g.tone==='neg'
    ?`goal-card neg bg-gradient-to-br from-orange-100/20 to-rose-200/20 text-orange-200 backdrop-blur-md rounded-xl p-4 border border-white/20`
    :`goal-card pos bg-gradient-to-br from-lime-200/20 to-green-200/20 text-green-200 backdrop-blur-md rounded-xl p-4 border border-white/20`;
  const icon=goalIcon(g.name,g.type);
  const state=g.tone==='neg'?'neg':'pos';
  return `<div id="goal-${g.id}" class="${cardCls}">
    ${g.pct>=100?`<div class="ribbon">✅ Completed</div>`:""}
    <div class="flex items-center gap-2 mb-2"><span class="p-2 rounded-full bg-white/20">${icon}</span><div class="font-medium goals-pill" style="--goal-accent:${window.GoalsView.color(g.name)}">${escapeHtml(g.name)}</div></div>
    <div class="text-sm text-soft">Target: <b>${fmt(g.target)}</b> • Current: <b>${fmt(g.current)}</b></div>
    <div class="mt-2 text-sm text-soft">${g.configured===false?'Not configured':g.pct.toFixed(1)+'%'} complete</div>
    ${barHtml(g.pct,state)}
    ${badgeChips(g)}
    <div class="chips mt-2">${g.actions||''}</div>
  </div>`;
}

// table row
function goalRow(g){
  const state=g.tone==='neg'?'neg':'pos';
  const icon=goalIcon(g.name,g.type);
  return `<tr id="goal-row-${g.id}" class="zebra">
    <td class="px-3 py-3"><span class="goals-pill" style="--goal-accent:${window.GoalsView.color(g.name)}">${icon} ${escapeHtml(g.name)}</span></td>
    <td class="px-3 py-3 capitalize">${escapeHtml(g.type)}</td>
    <td class="px-3 py-3 text-right">${fmt(g.target)}</td>
    <td class="px-3 py-3 text-right">${fmt(g.current)}</td>
    <td class="px-3 py-3">${barHtml(g.pct,state)} <div class="text-xs text-soft">${g.configured===false?'Not configured':g.pct.toFixed(1)+'%'}</div></td>
    <td class="px-3 py-3">${g.pct>=100?`<span class="chip chip-green">✅ Completed</span>`:(g.daysLeft!=null?urgencyChip(g.daysLeft,g):"")}</td>
    <td class="px-3 py-3">${badgeChips(g)}<div class="chips mt-2">${g.actions||''}</div></td>
  </tr>`;
}


window.OriginalGoalView={card:goalTile,row:goalRow};fetch('asset/tracker/original-five-goal-icons.json').then(r=>r.ok?r.json():null).then(map=>{if(map&&typeof map==='object'&&Object.values(map).every(v=>typeof v==='string')){ICON_MAP=map;window.RanSanModule.render();}}).catch(()=>{});})();