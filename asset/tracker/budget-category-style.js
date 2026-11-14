/* Stable category identity, shared by Budget cards and tables. Inline SVGs need no CDN. */
(()=>{'use strict';const shapes={
food:'M4 3v7a3 3 0 0 0 6 0V3M7 3v18M17 3v18M17 3c-4 3-4 9 0 9',
dining:'M4 11h16M5 11a7 7 0 0 1 14 0M12 2v2M3 16h18M6 20h12',
home:'M3 11l9-8 9 8M6 10v11h12V10M10 21v-7h4v7',
shirt:'M8 3l4 3 4-3 5 4-3 4-2-1v11H8V10l-2 1-3-4 5-4',
beauty:'M12 3l2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5L12 3',
health:'M9 3h6v6h6v6h-6v6H9v-6H3V9h6V3',
book:'M3 4h6l3 2 3-2h6v15h-6l-3 2-3-2H3V4M12 6v15',
travel:'M3 13l7-2 4-8h3l-2 8 6 2v2l-6-1-1 7h-2l-1-7-8 1v-2',
car:'M4 11l2-6h12l2 6M3 11h18v7H3v-7M6 18v3M18 18v3M6 14h2M16 14h2',
bolt:'M13 2L4 14h7l-1 8 10-13h-8l1-7',
wallet:'M3 6h17v15H3V6M3 6l14-4v4M15 11h6v5h-6v-5',
briefcase:'M8 7V3h8v4M3 7h18v14H3V7M3 12h18M10 12v3h4v-3',
chart:'M4 3v18h17M7 15l5-5 4 3 5-8',
gift:'M3 8h18v5H3V8M5 13v8h14v-8M12 8v13M12 8C4 8 6 1 10 4l2 4M12 8c8 0 6-7 2-4l-2 4',
shield:'M12 3l8 3v6c0 5-8 9-8 9s-8-4-8-9V6l8-3M8 12l3 3 5-6',
phone:'M7 2h10v20H7V2M10 18h4',
play:'M4 4h16v16H4V4M10 8l6 4-6 4V8',
pet:'M8 13c-2 3-3 7 0 7l4-1 4 1c3 0 2-4 0-7l-4-2-4 2M5 7v3M10 3v4M15 3v4M20 7v3',
category:'M3 3h7v7H3V3M14 3h7v7h-7V3M3 14h7v7H3v-7M14 14h7v7h-7v-7'};
const rules=[[/dining|restaurant|cafe|coffee|eating out/,'dining','252 211 77'],[/food|grocery|groceries|meal/,'food','110 231 183'],[/household|housing|home|rent|mortgage/,'home','125 211 252'],[/apparel|cloth|fashion|dress/,'shirt','196 181 253'],[/beauty|salon|cosmetic|personal care/,'beauty','249 168 212'],[/health|medical|doctor|pharma|fitness/,'health','253 164 175'],[/education|school|tuition|book|course/,'book','165 180 252'],[/travel|holiday|flight|vacation/,'travel','103 232 249'],[/transport|fuel|car|petrol|vehicle/,'car','147 197 253'],[/utilit|electric|water|gas|energy/,'bolt','253 224 71'],[/salary|wage|payroll/,'wallet','52 211 153'],[/business|freelance|professional/,'briefcase','94 234 212'],[/invest|interest|dividend|saving/,'chart','134 239 172'],[/gift|donation|charity/,'gift','216 180 254'],[/insurance|protection/,'shield','129 140 248'],[/phone|internet|mobile|telecom/,'phone','56 189 248'],[/entertain|movie|stream|music/,'play','244 114 182'],[/pet|animal/,'pet','251 191 36']];
const palette=['125 211 252','196 181 253','110 231 183','252 211 77','249 168 212','103 232 249'];
function style(name){const text=String(name||'Category').trim().toLowerCase(),match=rules.find(([r])=>r.test(text));let hash=0;for(const c of text)hash=(hash*31+c.charCodeAt(0))>>>0;return{icon:match?.[1]||'category',rgb:match?.[2]||palette[hash%palette.length]};}
function apply(el,name){if(!el||el.dataset.budgetCategoryName===String(name))return;const identity=style(name);el.dataset.budgetCategoryName=String(name);el.classList.add('bu-category-label');el.style.setProperty('--category-rgb',identity.rgb);el.innerHTML='<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="'+shapes[identity.icon]+'"/></svg>';const text=document.createElement('span');text.textContent=name;el.append(text);}
window.BudgetCategoryStyle={style,apply};
})();
