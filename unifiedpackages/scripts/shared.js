function startupError(message) {
  const alert = document.querySelector("#startupError");
  alert.textContent = `The advisor could not start: ${message}`;
  alert.hidden = false;
  document.querySelectorAll("button, input, select, textarea").forEach(element => element.disabled = true);
}
window.addEventListener("error", event => {
  if (document.querySelector("#startupError").hidden) startupError(`${event.message} Check the data/ and scripts/ files.`);
});
if (!window.UnifiedAdvisor?.defaults ||
    !["catalogue", "packages", "packageOrder", "addons", "config"].every(key => window.UnifiedAdvisorData?.[key])) {
  startupError("Check that all files in data/ and scripts/ are present.");
  throw new Error("Missing advisor scripts or data.");
}
const DATA = window.UnifiedAdvisorData;
const TAGS = DATA.catalogue.offerings;
let state;
try { state = window.UnifiedAdvisor.defaults(); }
catch (error) { startupError(error.message); throw error; }

const $ = (s,r=document)=>r.querySelector(s);
const $$ = (s,r=document)=>Array.from(r.querySelectorAll(s));
const esc = s => String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const vbdById = id => state.vbds.find(v=>v.id===id);
const pkgByKey = k => state.packages.find(p=>p.key===k);
function toast(msg){ const t=$("#toast"); t.textContent=msg; t.classList.add("show"); clearTimeout(toast._t); toast._t=setTimeout(()=>t.classList.remove("show"),2400); }

const options = values => values.map(value => {
  const option = typeof value === "string" ? { value, label: value } : value;
  return `<option value="${esc(option.value)}">${esc(option.label)}</option>`;
}).join("");
const populate = (selector, values) => {
  const select = $(selector);
  const all = select.querySelector('option[value=""]');
  select.innerHTML = (all ? all.outerHTML : "") + options(values);
};
