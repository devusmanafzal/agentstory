const activeAddons = () => window.UnifiedAdvisor.activeAddons(state);
const evaluate = deal => window.UnifiedAdvisor.evaluate(deal, state);
const cumulativeVbds = size => window.UnifiedAdvisor.cumulativeVbds(size, state.packages);

function renderDataControls() {
  const catalogue = DATA.catalogue;
  populate("#catTag", Object.entries(TAGS).map(([value, tag]) => ({ value, label: tag.filterLabel })));
  populate("#catStage", catalogue.stages);
  populate("#catStatus", catalogue.statuses);
  populate("#motion", DATA.config.motions);
  $("#licenses").value = DATA.config.initialLicenses;
  $("#catalogueSource").textContent = catalogue.sourceNote;
  $("#journeyQuestions").innerHTML = DATA.config.questions.map(question => `
    <div class="qrow" role="radiogroup" aria-label="${esc(question.title)}"><div class="qlbl">${esc(question.title)}</div><div class="opts">
      ${question.options.map(option => `<label class="opt"><input type="radio" name="${esc(question.name)}" value="${esc(option.value)}"${option.default ? " checked" : ""}><span><b>${esc(option.label)}</b><small>${esc(option.hint)}</small></span></label>`).join("")}
    </div></div>`).join("");
  $("#samples").innerHTML = DATA.config.samples.map(sample =>
    `<button class="btn" data-s="${esc(sample.key)}">${esc(sample.label)}</button>`).join("");
}

/* ---------- Navigation ---------- */
function show(view){
  if(view==="recommend") {
    const names=DATA.packageOrder.map(key=>pkgByKey(key).name);
    $("#packageStory").textContent=`${names.slice(0,-1).join(", ")} or ${names.at(-1)} — with the reasons, so you can explain it confidently.`;
  }
  $$(".view").forEach(v=>v.hidden = v.id!==`view-${view}`);
  $$(".nav button").forEach(b=>b.classList.toggle("active", b.dataset.view===view));
  if(view==="packages") renderPackages();
  if(view==="catalogue") renderCatalogue();
  window.scrollTo({top:0,behavior:"smooth"});
}

/* ---------- Wizard ---------- */
function applyWizardFields(){
  const r=state.rules, act=activeAddons().length;
  $("#fCustomer").hidden=!r.showCustomer; $("#fSeller").hidden=!r.showSeller; $("#fMotion").hidden=!r.showMotion;
  $("#secDetails").hidden=!(r.showCustomer||r.showSeller||r.showMotion);
  $("#secSignals").hidden=!act;
  $("#numDetails").textContent = act?"4":"3";
}
function renderTriggers(){
  const act=activeAddons(), keep=new Set($$("#triggers input:checked").map(i=>i.value));
  $("#triggers").innerHTML = act.map(a=>`<label><input type="checkbox" value="${esc(a.key)}" ${keep.has(a.key)?"checked":""}><span><b>${esc(a.icon)} ${esc(a.trigger||a.name)}</b><small>${esc(a.hint||a.desc)}</small></span></label>`).join("");
  applyWizardFields();
}
function goStep(){ applyWizardFields(); updateLive(); }
function readForm(){
  const f = $("#dealForm"); const g = n => (f.querySelector(`[name="${n}"]:checked`)||{}).value;
  return {
    customer: state.rules.showCustomer?$("#customer").value.trim():"", opp: state.rules.showCustomer?$("#opp").value.trim():"", seller: state.rules.showSeller?$("#seller").value.trim():"",
    motion: state.rules.showMotion?$("#motion").value:"", licenses: Math.max(0, parseInt($("#licenses").value||"0",10)),
    ...Object.fromEntries(DATA.config.questions.map(question => [question.name, +g(question.name)])),
    triggers: $$("#triggers input:checked").map(i=>i.value)
  };
}
function updateLive(){
  const d=readForm(), e=evaluate(d);
  $("#liveScore").textContent = e.total; $("#liveBar").style.width = (e.total*10)+"%";
  const p=pkgByKey(e.size); $("#livePkg").textContent = p?`${p.key} · ${p.name}`:e.size;
  $("#livePkg").style.background = p?p.color:"";
  $("#ladder").innerHTML = state.packages.map(x=>`<div class="rung ${x.key===e.size?"on":""}" style="--pc:${esc(x.color)}"><span class="rk">${esc(x.key)}</span><div><b>${esc(x.icon)} ${esc(x.name)}</b><small>${esc(x.tagline)}</small></div></div>`).join("");
  $("#licHint").textContent = `How many seats are in this deal? · ${DATA.config.rollouts[e.scores.licenses].label} rollout`;
}
function vbdChip(id){
  const v=vbdById(id); if(!v) return `<span class="chip muted">VBD unavailable</span>`;
  const st = v.status!=="Active"?`<span class="st st-${esc(v.status.replace(/\s/g,""))}">${esc(v.status)}</span>`:"";
  const inner = `<span class="tag t-${esc(v.tag)}">${esc(v.tag)}</span>${esc(v.name)} ${st}`;
  return v.url?`<a class="chip" href="${esc(v.url)}" target="_blank" rel="noopener">${inner}</a>`:`<span class="chip">${inner}</span>`;
}
function recommend(){
  const d=readForm(), e=evaluate(d), p=pkgByKey(e.size);
  const all = cumulativeVbds(e.size);
  const order=DATA.packageOrder; const nextKey = order[order.indexOf(e.size)+1]; const next = nextKey && pkgByKey(nextKey);
  const cust = d.customer||"your customer";
  const addTitle = e.addons.map(a=>a.name).join(" ");
  $("#result").innerHTML = `
  <div class="hero-result" style="--pc:${esc(p.color)}">
    <div class="hr-top">
      <div class="badge-xl">${esc(p.key)}</div>
      <div>
        <div class="eyebrow">Recommended Unified attachment ${d.opp?`· ${esc(d.opp)}`:""}</div>
        <h2>${esc(p.icon)} ${esc(p.name)} ${addTitle?`<span class="addon-title">${esc(addTitle)}</span>`:""}</h2>
        <p class="promise">${esc(p.promise)}</p>
        <p class="cheer">Great find! This gives <b>${esc(cust)}</b> a clear path from licences to outcomes — “${esc(p.tagline)}”</p>
      </div>
    </div>
    <div class="score-row">
      ${Object.entries(e.scores).map(([k,v])=>`<div class="sc"><span>${esc(DATA.config.scoreLabels[k])}</span><div class="dots">${[0,1].map(i=>`<i class="${i<v?"on":""}"></i>`).join("")}</div></div>`).join("")}
    </div>
  </div>
  <div class="offer" style="--pc:${esc(p.color)}">
    <section class="offer-card"><div class="offer-label">🧩 Scope of services</div>
      <ul class="offer-list">${p.scope.map(o=>`<li>${esc(o)}</li>`).join("")}</ul></section>
    <section class="offer-card price"><div class="offer-label">💶 Commercial offer</div>
      <div class="price-big">${esc(p.price)}</div>
      <div class="offer-kpis"><div><b>${hrs(p)}</b><span>EDE hours</span></div><div><b>${esc(p.duration)}</b><span>Typical duration</span></div></div>
      <p class="small"><b>Delivery vehicle:</b> ${esc(p.vehicle)}</p>
      <p class="small"><b>Customer commitment:</b> ${p.commitment.map(esc).join(" · ")}</p></section>
  </div>
  <div class="grid2">
    <section class="card"><h3>🧠 Why this package</h3><ul class="reasons">${e.reasons.map(r=>`<li>${r}</li>`).join("")}</ul>
      ${next?`<p class="hint">Not quite ${esc(next.key)} · ${esc(next.name)} yet — revisit when: ${esc(next.suitable[0].toLowerCase())}.</p>`:""}</section>
    <section class="card"><h3>🎯 Customer outcome</h3><ul class="ticks">${p.outcomes.map(o=>`<li>${esc(o)}</li>`).join("")}</ul></section>
  </div>
  ${e.addons.length?`<section class="card"><h3>➕ Recommended add-ons</h3><div class="addons">${e.addons.map(a=>`<div class="addon"><div class="ai">${esc(a.icon)}</div><div><b>${esc(a.name)}</b><p>${esc(a.desc)}</p><div class="chips">${a.vbds.map(vbdChip).join("")}</div></div></div>`).join("")}</div></section>`:""}
  <section class="card mapping"><details id="mapDetails"><summary><h3>📦 Delivery mapping — VBDs behind this package <span class="pill soft">${all.length} VBDs · cumulative</span></h3><span class="small muted chev">Show details</span></summary>
    <div class="chips mt-12">${all.map(vbdChip).join("")}</div>
    <p class="mapping-legend muted">Legend: ${Object.entries(TAGS).map(([k,t])=>`<span class="tag t-${k}">${k}</span> ${esc(t.short)}`).join(" &nbsp; ")}</p></details></section>
  <section class="card next"><h3>✅ Your next steps</h3>
    <ol class="nextsteps"><li>Share the package card with ${esc(cust)} and confirm the outcome resonates.</li><li>Engage your CSAM / Unified specialist to validate eligibility, funding and DE/EDE allocation.</li><li>Confirm delivery capacity and VBD availability (items marked New / ID pending / Retired need checking).</li><li>Attach the Unified opportunity to the deal and record the package in the proposal.</li></ol>
    <div class="actions"><button class="btn primary" id="btnCopy">📋 Copy summary</button>${state.rules.printEnabled?'<button class="btn" id="btnPrint">🖨️ Print / PDF</button>':''}<button class="btn ghost" id="btnRestart">↺ Start a new deal</button></div>
    <p class="disclaimer">Prototype logic is illustrative. Package thresholds, Unified eligibility, VBD mapping, DE/EDE delivery, capacity and commercial terms need formal validation before customer use.</p></section>`;
  $("#result").hidden=false; $("#wizard").hidden=true; $("#howItWorks").hidden=true; document.body.classList.add("has-result");
  $("#btnCopy").addEventListener("click",()=>copySummary(d,e,p,all));
  if($("#btnPrint")) $("#btnPrint").addEventListener("click",printRecommendation);
  $("#btnRestart").addEventListener("click",()=>{ $("#result").hidden=true; $("#wizard").hidden=false; $("#howItWorks").hidden=false; document.body.classList.remove("has-result"); goStep(1); window.scrollTo({top:0,behavior:"smooth"}); });
  confetti(p.color); window.scrollTo({top:0,behavior:"smooth"});
}
function hrs(p){ return p.hoursMin===p.hoursMax||!p.hoursMax ? `${p.hoursMin}` : `${p.hoursMin}–${p.hoursMax}`; }
function printRecommendation(){
  const det=$("#mapDetails"), wasOpen=det&&det.open; if(det) det.open=true;
  $("#printStamp").textContent = `Generated ${new Date().toLocaleDateString()} · Unified Deal Attach Advisor`;
  document.body.classList.add("printing");
  const done=()=>{ document.body.classList.remove("printing"); if(det) det.open=wasOpen; window.removeEventListener("afterprint",done); };
  window.addEventListener("afterprint",done); window.print(); setTimeout(done,1500);
}
function copySummary(d,e,p,all){
  const lines=[`Unified attachment recommendation${d.customer?` – ${d.customer}`:""}${d.opp?` (${d.opp})`:""}`,
   `Package: ${p.key} · ${p.name}${e.addons.length?" "+e.addons.map(a=>a.name).join(" "):""}`,
   `Promise: ${p.promise}`,"",
   "Customer outcome:",...p.outcomes.map(o=>"• "+o),"","Scope of services:",...p.scope.map(o=>"• "+o),"",
   `Commercial offer: ${hrs(p)} EDE hours · ${p.price} · ${p.duration}`,`Delivery vehicle: ${p.vehicle}`,"",
   "VBDs:",...all.map(id=>{const v=vbdById(id);return `• ${v?v.name:id}${/^\d+$/.test(id)?" ("+id+")":""}`;}),
   ...(e.addons.length?["","Add-ons:",...e.addons.map(a=>`• ${a.name}: ${a.desc}`)]:[]),"",
   "Note: illustrative – validate eligibility, funding, capacity and pricing with the Unified specialist."];
  const txt=lines.join("\n");
  (navigator.clipboard?navigator.clipboard.writeText(txt):Promise.reject()).then(()=>toast("Summary copied — paste it into your proposal ✨")).catch(()=>{
    const ta=document.createElement("textarea"); ta.value=txt; document.body.appendChild(ta); ta.select(); try{document.execCommand("copy");toast("Summary copied ✨");}catch(x){toast("Copy not available");} ta.remove(); });
}
function confetti(color){
  const box=$("#confetti"); box.innerHTML=""; const cols=[color,"#F59E0B","#10B981","#EC4899","#3B82F6"];
  for(let i=0;i<70;i++){ const s=document.createElement("span"); s.style.left=Math.random()*100+"%"; s.style.background=cols[i%cols.length];
    s.style.animationDelay=(Math.random()*0.6)+"s"; s.style.transform=`rotate(${Math.random()*360}deg)`; box.appendChild(s);}
  setTimeout(()=>box.innerHTML="",3200);
}

/* ---------- Packages view ---------- */
function renderPackages(){
  const names=DATA.packageOrder.map(key=>pkgByKey(key).name);
  $("#packageInheritance").textContent=`Packages are cumulative: ${names[1]} builds on ${names[0]}, ${names[2]} builds on ${names[1]}. Sizes reflect customer ambition — not customer size.`;
  $("#pkgGrid").innerHTML = state.packages.map(p=>`
   <article class="pkg" style="--pc:${esc(p.color)}">
     <header><span class="badge-l">${esc(p.key)}</span><div><h3>${esc(p.icon)} ${esc(p.name)}</h3><em>“${esc(p.tagline)}”</em></div></header>
     <p class="promise">${esc(p.promise)}</p>
     <h4>Suitable when</h4><ul>${p.suitable.map(x=>`<li>${esc(x)}</li>`).join("")}</ul>
     <h4>Customer outcome</h4><ul class="ticks">${p.outcomes.map(x=>`<li>${esc(x)}</li>`).join("")}</ul>
     <h4>Scope of services</h4><ul>${p.scope.map(x=>`<li>${esc(x)}</li>`).join("")}</ul>
     <h4>Commercial offer</h4>
     <dl class="pkg-commercial">
       <div class="pkg-commercial-price"><dt>Price</dt><dd>${esc(p.price)}</dd></div>
       <div><dt>Duration</dt><dd>${esc(p.duration)}</dd></div>
     </dl>
     <details><summary>Recommended VBDs</summary><div class="chips">${p.vbds.map(vbdChip).join("")}</div></details>
     ${p.signals?.trim()?`<p class="small signals">📍 ${esc(p.signals)}</p>`:""}
   </article>`).join("");
  const act=activeAddons(); $("#addonSection").hidden = !act.length;
  $("#addonGrid").innerHTML = act.map(a=>`<div class="addon"><div class="ai">${esc(a.icon)}</div><div><b>${esc(a.name)}</b><p>${esc(a.desc)}</p><div class="chips">${a.vbds.map(vbdChip).join("")}</div></div></div>`).join("");
}

/* ---------- Catalogue view ---------- */
function renderCatalogue(){
  const q=$("#catSearch").value.toLowerCase(), tag=$("#catTag").value, stage=$("#catStage").value, st=$("#catStatus").value;
  const usedIn = id => state.packages.filter(p=>p.vbds.includes(id)).map(p=>p.key);
  const rows = state.vbds.filter(v=>(!q||(v.name+" "+v.id+" "+v.notes).toLowerCase().includes(q))&&(!tag||v.tag===tag)&&(!stage||v.stage===stage)&&(!st||v.status===st));
  $("#catCount").textContent = `${rows.length} of ${state.vbds.length} VBDs`;
  $("#catBody").innerHTML = rows.map(v=>`<tr>
    <td><b>${esc(v.name)}</b>${v.notes?`<div class="small muted">${esc(v.notes)}</div>`:""}</td>
    <td>${/^\d+$/.test(v.id)?esc(v.id):`<span class="muted">pending</span>`}</td>
    <td><span class="tag t-${esc(v.tag)}">${esc(v.tag)}</span> <span class="small">${esc((TAGS[v.tag]||{}).short||v.tag)}</span></td>
    <td class="small">${esc(v.stage)}<br><span class="muted">${esc(v.pillar)}</span></td>
    <td><span class="st st-${esc(v.status.replace(/\s/g,""))}">${esc(v.status)}</span></td>
    <td>${usedIn(v.id).map(k=>{const p=pkgByKey(k);return `<span class="mini" style="background:${esc(p.color)}">${k}</span>`;}).join("")||'<span class="muted small">—</span>'}</td>
    <td>${v.url?`<a href="${esc(v.url)}" target="_blank" rel="noopener" class="link">ESXP ↗</a>`:""}</td></tr>`).join("");
}

/* ---------- Init ---------- */
document.addEventListener("DOMContentLoaded",()=>{
  renderDataControls();
  $$(".nav button").forEach(b=>b.addEventListener("click",()=>show(b.dataset.view)));
  $$("[data-goto]").forEach(b=>b.addEventListener("click",()=>show(b.dataset.goto)));
  $("#btnRecommend").addEventListener("click",recommend);
  $("#dealForm").addEventListener("input",updateLive); $("#dealForm").addEventListener("change",updateLive);
  $("#dealForm").addEventListener("submit",e=>e.preventDefault());
  $$("#samples button").forEach(b=>b.addEventListener("click",()=>loadSample(b.dataset.s)));
  ["catSearch","catTag","catStage","catStatus"].forEach(id=>$("#"+id).addEventListener("input",renderCatalogue));
  const tips=DATA.config.tips;
  $("#tip").textContent = tips[new Date().getDate()%tips.length];
  renderTriggers(); goStep(1); show("recommend");
});
function loadSample(s){
  const S=DATA.config.samples.find(sample=>sample.key===s);
  if(!S){ toast("That sample deal is not available."); return; }
  $("#customer").value=S.customer; $("#opp").value=S.opp; $("#licenses").value=S.licenses; $("#motion").value=S.motion;
  DATA.config.questions.forEach(({name})=>{ const el=$(`#dealForm [name="${name}"][value="${S[name]}"]`); if(el) el.checked=true; });
  $$("#triggers input").forEach(i=>i.checked=S.trig.includes(i.value));
  updateLive(); toast(`Sample loaded: ${S.customer}`);
}
