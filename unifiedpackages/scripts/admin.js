const defaults = () => window.UnifiedAdvisor.defaults();
const addonAutoHint = key => DATA.addons.find(addon => addon.key === key)?.autoHint;

/* ---------- Settings ---------- */
let editPkg="S";
const packageDrafts=new Map();
const settingsControls={
  band1:"#rBand1",band2:"#rBand2",thrM:"#rThrM",thrL:"#rThrL",
  coreForcesL:"#rCore",highComplexityMin:"#rHigh",printEnabled:"#printToggle",
  showCustomer:'[data-wiz="showCustomer"]',showSeller:'[data-wiz="showSeller"]',showMotion:'[data-wiz="showMotion"]'
};
let settingsDraft={};
let vbdDraft=null;
function beginVbdDraft(){
  if(!vbdDraft) vbdDraft={
    vbds:state.vbds.map(vbd=>({...vbd})),
    ids:new Map(state.vbds.map(vbd=>[vbd.id,vbd.id]))
  };
  return vbdDraft;
}
function applyVbdChanges(){
  if(!vbdDraft){toast("No VBD changes to apply.");return;}
  const remap=ids=>ids.flatMap(id=>{
    const mapped=vbdDraft.ids.has(id)?vbdDraft.ids.get(id):id;
    return mapped===null?[]:[mapped];
  });
  state.packages.forEach(pkg=>pkg.vbds=remap(pkg.vbds));
  state.addons.forEach(addon=>addon.vbds=remap(addon.vbds));
  state.vbds=vbdDraft.vbds;
  vbdDraft=null;
  renderSettings(); toast("VBD catalogue changes applied for this session ✅");
}
function rememberSettingsDraft(event){
  const field=event.target;
  const entry=Object.entries(settingsControls).find(([,selector])=>$(selector)===field);
  if(entry) settingsDraft[entry[0]]=field.type==="checkbox"?field.checked:field.value;
}
function rememberPkgDraft(event){
  const field=event.target;
  if(field.name) packageDrafts.set(editPkg,{...packageDrafts.get(editPkg),[field.name]:field.value});
}
function renderSettings(){
  $("#pkgTabs").innerHTML = state.packages.map(p=>`<button type="button" class="ptab ${p.key===editPkg?"active":""}" data-k="${esc(p.key)}" aria-pressed="${p.key===editPkg}">${esc(p.key)} · ${esc(p.name)}</button>`).join("");
  $$("#pkgTabs .ptab").forEach(b=>b.addEventListener("click",()=>{editPkg=b.dataset.k; renderSettings();}));
  const p=pkgByKey(editPkg);
  const f=$("#pkgForm");
  const set=(n,v)=>{ const el=f.querySelector(`[name="${n}"]`); if(el) el.value=v; };
  ["name","icon","color","tagline","promise","vehicle","hoursMin","hoursMax","price","duration","signals"].forEach(k=>set(k,p[k]));
  ["suitable","outcomes","scope","commitment"].forEach(k=>set(k,p[k].join("\n")));
  Object.entries(packageDrafts.get(editPkg)||{}).forEach(([name,value])=>set(name,value));
  renderPkgVbdPicker();
  const settings={...state.rules,...settingsDraft};
  Object.entries(settingsControls).forEach(([key,selector])=>{
    const field=$(selector);
    if(field.type==="checkbox") field.checked=!!settings[key]; else field.value=settings[key];
  });
  renderVbdAdmin(); renderAddonAdmin();
}
function updatePkgVbdSelection(){
  const count=pkgByKey(editPkg).vbds.length, total=state.vbds.length, all=$("#pickSelectAll");
  $("#pickCount").textContent=`${count} of ${total} selected`;
  all.checked=total>0&&count===total;
  all.indeterminate=count>0&&count<total;
  all.disabled=total===0;
  $("#pickSelectAllLabel").textContent=all.checked?"Deselect all VBDs":"Select all VBDs";
}
function selectAllPkgVbds(){
  pkgByKey(editPkg).vbds=$("#pickSelectAll").checked?state.vbds.map(v=>v.id):[];
  renderPkgVbdPicker();
}
function renderPkgVbdPicker(){
  const p=pkgByKey(editPkg), q=($("#pickSearch").value||"").toLowerCase();
  updatePkgVbdSelection();
  $("#vbdPicker").innerHTML = state.vbds.filter(v=>!q||(v.name+v.id).toLowerCase().includes(q)).map(v=>`<label class="pick ${p.vbds.includes(v.id)?"on":""}"><input type="checkbox" value="${esc(v.id)}" ${p.vbds.includes(v.id)?"checked":""}><span class="tag t-${esc(v.tag)}">${esc(v.tag)}</span><span>${esc(v.name)}</span>${v.status!=="Active"?`<span class="st st-${esc(v.status.replace(/\s/g,""))}">${esc(v.status)}</span>`:""}</label>`).join("");
  $$("#vbdPicker input").forEach(i=>i.addEventListener("change",()=>{ const set=new Set(p.vbds); i.checked?set.add(i.value):set.delete(i.value); p.vbds=state.vbds.map(v=>v.id).filter(id=>set.has(id)); i.parentElement.classList.toggle("on",i.checked); updatePkgVbdSelection(); }));
}
function savePkg(){
  const p=pkgByKey(editPkg), f=$("#pkgForm"), g=n=>f.querySelector(`[name="${n}"]`).value;
  ["name","icon","color","tagline","promise","vehicle","price","duration","signals"].forEach(k=>p[k]=g(k).trim());
  p.hoursMin=+g("hoursMin")||0; p.hoursMax=+g("hoursMax")||0;
  ["suitable","outcomes","scope","commitment"].forEach(k=>p[k]=g(k).split("\n").map(s=>s.trim()).filter(Boolean));
  packageDrafts.delete(editPkg);
  renderSettings(); toast(`${p.key} · ${p.name} applied for this session 🎉`);
}
function saveSettings(){
  Object.entries(settingsControls).forEach(([key,selector])=>{
    const field=$(selector);
    state.rules[key]=field.type==="checkbox"?field.checked:field.type==="number"?(+field.value||0):field.value;
  });
  settingsDraft={};
  toast("Settings saved for this session ✅");
}
function renderVbdAdmin(){
  const q=($("#admSearch").value||"").toLowerCase();
  $("#admBody").innerHTML = (vbdDraft?.vbds||state.vbds).map((v,i)=>({v,i})).filter(({v})=>!q||(v.name+v.id).toLowerCase().includes(q)).map(({v,i})=>`<tr>
    <td class="small">${esc(v.id)}</td><td>${esc(v.name)}</td><td><span class="tag t-${esc(v.tag)}">${esc(v.tag)}</span></td><td class="small">${esc(v.stage)}</td><td><span class="st st-${esc(v.status.replace(/\s/g,""))}">${esc(v.status)}</span></td>
    <td class="nowrap"><button class="icon-btn" data-edit="${i}" title="Edit">✏️</button><button class="icon-btn" data-del="${i}" title="Delete">🗑️</button></td></tr>`).join("");
  $$("#admBody [data-edit]").forEach(b=>b.addEventListener("click",()=>openVbd(+b.dataset.edit)));
  $$("#admBody [data-del]").forEach(b=>b.addEventListener("click",()=>removeVbd(+b.dataset.del)));
}
function removeVbd(index){
  const v=(vbdDraft?.vbds||state.vbds)[index];
  if(!confirm(`Remove “${v.name}” from the catalogue?`)) return;
  const draft=beginVbdDraft();
  draft.vbds.splice(index,1);
  draft.ids.forEach((current,original)=>{if(current===v.id) draft.ids.set(original,null);});
  renderVbdAdmin(); toast("VBD removal staged. Click Apply Changes to save.");
}
let vbdEditIdx=-1;
function openVbd(i){
  vbdEditIdx=i; const v = i>=0?(vbdDraft?.vbds||state.vbds)[i]:DATA.catalogue.newVbd;
  const f=$("#vbdForm"); Object.keys(v).forEach(k=>{const el=f.querySelector(`[name="${k}"]`); if(el) el.value=v[k];});
  $("#vbdModalTitle").textContent = i>=0?"Edit VBD":"Add a new VBD"; $("#vbdModal").hidden=false; f.querySelector('[name="name"]').focus();
}
function saveVbd(ev){
  ev.preventDefault(); const f=$("#vbdForm"), g=n=>f.querySelector(`[name="${n}"]`).value.trim();
  const v={id:g("id"),name:g("name"),tag:g("tag"),stage:g("stage"),pillar:g("pillar"),status:g("status"),url:g("url"),notes:g("notes")};
  if(!v.id||!v.name){toast("ID and name are required");return;}
  if(v.url && !/^https:\/\//i.test(v.url)){toast("Link must start with https://");return;}
  if(!v.url) v.url=window.UnifiedAdvisor.esxpUrl(v.id);
  const dup=(vbdDraft?.vbds||state.vbds).findIndex(x=>x.id===v.id); if(dup>=0 && dup!==vbdEditIdx){toast("That ID already exists");return;}
  const draft=beginVbdDraft();
  if(vbdEditIdx>=0){
    const old=draft.vbds[vbdEditIdx].id;
    draft.vbds[vbdEditIdx]=v;
    draft.ids.forEach((current,original)=>{if(current===old) draft.ids.set(original,v.id);});
  } else draft.vbds.push(v);
  $("#vbdModal").hidden=true; renderVbdAdmin(); toast("VBD draft saved. Click Apply Changes to save the catalogue.");
}
function renderAddonAdmin(){
  $("#addonsMaster").checked = state.rules.addonsEnabled;
  $("#addonAdmin").classList.toggle("dim", !state.rules.addonsEnabled);
  $("#addonAdmin").innerHTML = state.addons.map((a,i)=>`<div class="addon-card ${a.enabled?"":"off"}">
    <div class="ac-head">
      <label class="switch" title="Show this add-on to sellers"><input type="checkbox" data-ai="${i}" data-f="enabled" ${a.enabled?"checked":""} aria-label="Show ${esc(a.name)}"><i></i></label>
      <span class="ac-icon">${esc(a.icon)}</span><b>${esc(a.name)}</b>
      <span class="st ${a.enabled?"":"st-Retired"}">${a.enabled?"ON":"OFF"}</span>
      <button class="icon-btn push-end" data-adel="${i}" title="Delete add-on">🗑️</button>
    </div>
    <div class="ac-body">
      <div class="row3">
        <div class="field"><label class="lbl">Icon</label><input type="text" data-ai="${i}" data-f="icon" value="${esc(a.icon)}"></div>
        <div class="field"><label class="lbl">Add-on name</label><input type="text" data-ai="${i}" data-f="name" value="${esc(a.name)}"></div>
        <div class="field"><label class="lbl">VBD IDs <span class="help">(comma-separated)</span></label><input type="text" data-ai="${i}" data-f="vbds" value="${esc(a.vbds.join(", "))}"></div>
      </div>
      <div class="row3">
        <div class="field"><label class="lbl">Seller question (wizard step 3)</label><input type="text" data-ai="${i}" data-f="trigger" value="${esc(a.trigger)}"></div>
        <div class="field"><label class="lbl">Question hint</label><input type="text" data-ai="${i}" data-f="hint" value="${esc(a.hint)}"></div>
        <div class="field"><label class="lbl">Description</label><input type="text" data-ai="${i}" data-f="desc" value="${esc(a.desc)}"></div>
      </div>
      ${addonAutoHint(a.key)?`<label class="small inline"><input type="checkbox" data-ai="${i}" data-f="auto" ${a.auto?"checked":""}> Also suggest automatically from deal signals <span class="muted">(${esc(addonAutoHint(a.key))})</span></label>`:`<div class="small muted">Suggested only when the seller ticks the question.</div>`}
    </div></div>`).join("");
  $$("#addonAdmin input").forEach(inp=>inp.addEventListener("change",()=>{ const a=state.addons[+inp.dataset.ai]; const f=inp.dataset.f;
    if(f==="enabled"||f==="auto") a[f]=inp.checked; else a[f]= f==="vbds"? inp.value.split(",").map(s=>s.trim()).filter(Boolean) : inp.value;
    if(["enabled","auto","icon","name"].includes(f)) renderAddonAdmin();
    toast(f==="enabled"?`${a.name} switched ${a.enabled?"ON ✅":"OFF"}`:"Add-on updated"); }));
  $$("#addonAdmin [data-adel]").forEach(b=>b.addEventListener("click",()=>{ const a=state.addons[+b.dataset.adel]; if(!confirm(`Delete add-on “${a.name}”? Tip: switch it OFF instead to hide it temporarily.`)) return; state.addons.splice(+b.dataset.adel,1); renderAddonAdmin(); toast("Add-on deleted"); }));
}
function addAddon(){
  let n=1; while(state.addons.some(a=>a.key==="custom"+n)) n++;
  state.addons.push({...DATA.newAddon,key:"custom"+n,vbds:[...DATA.newAddon.vbds]});
  renderAddonAdmin(); toast("Add-on created — fill in the details");
}
const exportUrls=new Map();
function clearExportDownloads(target=$("#exportDownloads")){
  (exportUrls.get(target)||[]).forEach(url=>URL.revokeObjectURL(url));
  exportUrls.delete(target);
  target.replaceChildren();
}
function updateExportSelection(){
  const count=$$('#exportPanel input[name="dataFile"]:checked').length;
  $("#btnDownloadData").disabled=!count;
  $("#exportSelection").textContent=count?`${count} ${count===1?"file":"files"} selected`:"Select at least one file.";
  clearExportDownloads();
}
function downloadDataFiles(){
  const selected=$$('#exportPanel input[name="dataFile"]:checked').map(input=>input.value);
  downloadFiles(selected,$("#exportDownloads"));
}
function downloadFiles(selected,target){
  let files;
  try { files=window.UnifiedAdvisor.exportDataFiles(state,selected); }
  catch(error) { toast(`Cannot export: ${error.message}`); return; }
  clearExportDownloads(target);
  const urls=[];
  exportUrls.set(target,urls);
  const note=document.createElement("p");
  note.textContent="Downloads requested for this snapshot. If any are blocked, use the individual links below. Export again after making further edits.";
  target.appendChild(note);
  const links=files.map(file=>{
    const link=document.createElement("a");
    const url=URL.createObjectURL(new Blob([file.content],{type:"text/javascript;charset=utf-8"}));
    urls.push(url);
    link.href=url; link.download=file.name; link.textContent=`Download ${file.name}`;
    target.appendChild(link);
    return link;
  });
  links.forEach(link=>link.click());
  toast(`Download requested for ${files.length} data ${files.length===1?"file":"files"}.`);
}
function sectionExportFiles(section){
  if(!["settings","packages","vbds"].includes(section)) throw new Error("Unknown configuration section.");
  const primary={settings:"config.js",packages:"packages.js",vbds:"catalogue.js"}[section];
  const selected=new Set([primary]), base=defaults();
  if(primary==="catalogue.js"){
    for(const [name,field] of [["packages.js","packages"],["addons.js","addons"]]){
      const mappings=records=>records.map(record=>[record.key,record.vbds]);
      if(JSON.stringify(mappings(state[field]))!==JSON.stringify(mappings(base[field]))) selected.add(name);
    }
  }
  let count;
  do {
    count=selected.size;
    const ids=new Set((selected.has("catalogue.js")?state:base).vbds.map(vbd=>vbd.id));
    for(const [name,field] of [["packages.js","packages"],["addons.js","addons"]]){
      const records=(selected.has(name)?state:base)[field];
      if(records.some(record=>record.vbds.some(id=>!ids.has(id)))){
        selected.add(selected.has("catalogue.js")?name:"catalogue.js");
      }
    }
  } while(selected.size!==count);
  return ["catalogue.js","packages.js","addons.js","config.js"].filter(name=>selected.has(name));
}
function exportSection(section){
  const target=$(`#${section}Downloads`);
  clearExportDownloads(target);
  let selected;
  try { selected=sectionExportFiles(section); }
  catch(error) { toast(`Cannot export: ${error.message}`); return; }
  if(selected.includes("config.js")&&Object.keys(settingsDraft).length){toast("Save Settings before exporting.");return;}
  if(selected.includes("packages.js")&&packageDrafts.size){toast("Apply all edited packages before exporting.");return;}
  if(selected.includes("catalogue.js")&&vbdDraft){toast("Click Apply Changes on the VBD catalogue before exporting.");return;}
  downloadFiles(selected,target);
}
function exportCfg(){
  const blob=new Blob([JSON.stringify(state,null,2)],{type:"application/json"}); const a=document.createElement("a");
  const url=URL.createObjectURL(blob);
  a.href=url; a.download="unified-attach-config.json"; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1000); toast("JSON backup download requested");
}
function importCfg(file){
  const rd=new FileReader();
  rd.onload=()=>{
    let imported;
    try { imported=window.UnifiedAdvisor.importConfiguration(JSON.parse(rd.result)); }
    catch(error) { toast(`Invalid configuration: ${error.message}`); return; }
    state=imported; packageDrafts.clear(); settingsDraft={}; vbdDraft=null; renderSettings(); toast("Configuration imported for this session 🎉");
  };
  rd.onerror=()=>toast("Could not read the configuration file. Please try again.");
  rd.readAsText(file);
}

/* ---------- Init ---------- */
document.addEventListener("DOMContentLoaded",()=>{
  populate('#vbdForm [name="tag"]', Object.entries(TAGS).map(([value, tag]) => ({ value, label: tag.editorLabel })));
  populate('#vbdForm [name="stage"]', DATA.catalogue.stages);
  populate('#vbdForm [name="pillar"]', DATA.catalogue.pillars);
  populate('#vbdForm [name="status"]', DATA.catalogue.statuses);
  populate("#rHigh", DATA.packageOrder);
  $("#pickSearch").addEventListener("input",renderPkgVbdPicker);
  $("#pickSelectAll").addEventListener("change",selectAllPkgVbds);
  $("#admSearch").addEventListener("input",renderVbdAdmin);
  $("#btnSavePkg").addEventListener("click",savePkg);
  $("#pkgForm").addEventListener("input",rememberPkgDraft);
  $("#pkgForm").addEventListener("change",rememberPkgDraft);
  $("#pkgForm").addEventListener("submit",event=>{ event.preventDefault(); savePkg(); });
  $("#btnSaveSettings").addEventListener("click",saveSettings);
  $("#paneSettings").addEventListener("input",rememberSettingsDraft);
  $("#paneSettings").addEventListener("change",rememberSettingsDraft);
  $("#btnAddVbd").addEventListener("click",()=>openVbd(-1));
  $("#btnApplyVbds").addEventListener("click",applyVbdChanges);
  $("#vbdForm").addEventListener("submit",saveVbd);
  $("#btnCancelVbd").addEventListener("click",()=>$("#vbdModal").hidden=true);
  $("#btnExport").addEventListener("click",()=>{
    const panel=$("#exportPanel");
    panel.hidden=!panel.hidden;
    $("#btnExport").setAttribute("aria-expanded",String(!panel.hidden));
    if(!panel.hidden) updateExportSelection(); else clearExportDownloads();
  });
  $$('#exportPanel input[name="dataFile"]').forEach(input=>input.addEventListener("change",updateExportSelection));
  $("#exportSelectAll").addEventListener("click",()=>{
    $$('#exportPanel input[name="dataFile"]').forEach(input=>input.checked=true);
    updateExportSelection();
  });
  $("#btnDownloadData").addEventListener("click",downloadDataFiles);
  $("#btnExportJson").addEventListener("click",exportCfg);
  $$("[data-export-section]").forEach(button=>button.addEventListener("click",()=>exportSection(button.dataset.exportSection)));
  window.addEventListener("pagehide",()=>Array.from(exportUrls.keys()).forEach(target=>clearExportDownloads(target)));
  $("#btnImport").addEventListener("click",()=>$("#fileImport").click());
  $("#fileImport").addEventListener("change",e=>{ if(e.target.files[0]) importCfg(e.target.files[0]); e.target.value=""; });
  $("#btnReset").addEventListener("click",()=>{ if(confirm("Reset packages, VBDs, add-ons and rules to the defaults?")){ state=defaults(); packageDrafts.clear(); settingsDraft={}; vbdDraft=null; renderSettings(); toast("Defaults restored"); }});
  $$(".admin-sections button").forEach(b=>b.addEventListener("click",()=>{
    $$(".admin-sections button").forEach(x=>{
      x.classList.toggle("active",x===b);
      if(x===b) x.setAttribute("aria-current","true"); else x.removeAttribute("aria-current");
    });
    $$(".setpane").forEach(p=>p.hidden=p.id!==b.dataset.pane);
  }));
  $("#addonsMaster").addEventListener("change",e=>{ state.rules.addonsEnabled=e.target.checked; renderAddonAdmin(); toast(e.target.checked?"Add-ons switched ON for this session":"Add-ons switched OFF for this session"); });
  $("#btnAddAddon").addEventListener("click",addAddon);
  renderSettings();
});
