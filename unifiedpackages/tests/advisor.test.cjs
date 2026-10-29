const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const crypto = require("node:crypto");

const root = path.join(__dirname, "..");
const dataFiles = ["data/catalogue.js", "data/packages.js", "data/addons.js", "data/config.js"];
const scripts = [...dataFiles, "scripts/state.js", "scripts/recommendations.js"];
const plain = value => JSON.parse(JSON.stringify(value));

function load(replacements = []) {
  const exported = new Map(replacements.map(file => [`data/${file.name}`, file.content]));
  const context = vm.createContext({
    window: {},
    localStorage: new Proxy({}, { get() { throw new Error("Configuration must not access localStorage"); } })
  });
  for (const file of scripts) {
    vm.runInContext(exported.get(file) ?? fs.readFileSync(path.join(root, file), "utf8"), context, { filename: file });
  }
  return { advisor: context.window.UnifiedAdvisor, data: context.window.UnifiedAdvisorData };
}

const deal = changes => ({
  licenses: 0, stage: 0, adoption: 0, agents: 0, complexity: 0, motion: "", triggers: [], ...changes
});

function loadAdminEditor({ renderPicker = false } = {}) {
  const { advisor, data } = load(), fields = {}, vbdFields = {}, elements = new Map(), notifications = [];
  const form = { querySelector: selector => fields[selector.match(/name="([^"]+)"/)[1]] ??= { value: "" } };
  const vbdForm = { querySelector: selector => vbdFields[selector.match(/name="([^"]+)"/)[1]] ??= { value: "", focus() {} } };
  const context = vm.createContext({
    state: advisor.defaults(), DATA: data, window: { UnifiedAdvisor: advisor },
    document: { addEventListener() {} }, esc: String, toast: message => notifications.push(message), $$: () => [], confirm: () => true,
    $: selector => {
      if (selector === "#pkgForm") return form;
      if (selector === "#vbdForm") return vbdForm;
      if (!elements.has(selector)) {
        const type = /data-wiz|#rCore|#printToggle/.test(selector) ? "checkbox" :
          /^#r(Band[12]|Thr[ML])$/.test(selector) ? "number" : "text";
        elements.set(selector, { type, replaceChildren() {} });
      }
      return elements.get(selector);
    },
    pkgByKey: key => context.state.packages.find(pkg => pkg.key === key),
    FileReader: class {
      readAsText(file) { this.result = file.content; this.onload(); }
    }
  });
  vm.runInContext(fs.readFileSync(path.join(root, "scripts/admin.js"), "utf8"), context);
  if (!renderPicker) vm.runInContext("renderPkgVbdPicker=()=>{};", context);
  vm.runInContext("renderVbdAdmin=()=>{}; renderAddonAdmin=()=>{}; renderSettings();", context);
  return { advisor, context, fields, vbdFields, notifications, elements };
}

test("package VBD bulk selection affects the entire catalogue and counts track package and catalogue changes", () => {
  const { context, elements } = loadAdminEditor({ renderPicker: true });
  const master = elements.get("#pickSelectAll");
  const count = elements.get("#pickCount");
  const total = context.state.vbds.length;
  const initial = context.state.packages[0].vbds.length;
  const otherPackage = plain(context.state.packages[1].vbds);
  assert.equal(count.textContent, `${initial} of ${total} selected`);
  assert.equal(master.indeterminate, true);
  elements.get("#pickSearch").value = "no matching VBD";
  context.renderPkgVbdPicker();
  assert.equal(elements.get("#vbdPicker").innerHTML, "");
  master.checked = true;
  context.selectAllPkgVbds();
  assert.deepEqual(plain(context.state.packages[0].vbds), plain(context.state.vbds.map(vbd => vbd.id)));
  assert.equal(count.textContent, `${total} of ${total} selected`);
  assert.equal(master.checked, true);
  assert.equal(master.indeterminate, false);
  assert.equal(elements.get("#pickSelectAllLabel").textContent, "Deselect all VBDs");
  master.checked = false;
  context.selectAllPkgVbds();
  assert.equal(count.textContent, `0 of ${total} selected`);
  assert.equal(master.checked, false);
  assert.equal(master.indeterminate, false);
  assert.deepEqual(plain(context.state.packages[1].vbds), otherPackage);
  vm.runInContext('editPkg="M"; renderSettings();', context);
  assert.equal(count.textContent, `${otherPackage.length} of ${total} selected`);
  vm.runInContext('editPkg="S"; renderSettings();', context);
  assert.equal(count.textContent, `0 of ${total} selected`);
  context.state.packages[0].vbds = [context.state.vbds[0].id];
  context.updatePkgVbdSelection();
  assert.equal(count.textContent, `1 of ${total} selected`);
  assert.equal(master.indeterminate, true);
  context.beginVbdDraft().vbds.push({ ...context.state.vbds[0], id: "new-vbd" });
  context.applyVbdChanges();
  assert.equal(count.textContent, `1 of ${total + 1} selected`);
  context.removeVbd(0);
  context.applyVbdChanges();
  assert.equal(count.textContent, `0 of ${total} selected`);
  context.state.vbds = [];
  context.renderPkgVbdPicker();
  assert.equal(count.textContent, "0 of 0 selected");
  assert.equal(master.disabled, true);
  assert.equal(master.checked, false);
  assert.equal(master.indeterminate, false);
});

function loadPublicPage() {
  const { advisor, data } = load();
  const elements = new Map();
  const context = vm.createContext({
    window: { UnifiedAdvisor: advisor, UnifiedAdvisorData: data, addEventListener() {} },
    document: {
      addEventListener() {},
      querySelector(selector) {
        if (!elements.has(selector)) elements.set(selector, {});
        return elements.get(selector);
      }
    }
  });
  for (const file of ["scripts/shared.js", "scripts/app.js"]) {
    vm.runInContext(fs.readFileSync(path.join(root, file), "utf8"), context, { filename: file });
  }
  return { context, elements, data };
}

test("package commercial panels show only escaped price and duration, without delivery hours or vehicle", () => {
  const { context, elements, data } = loadPublicPage();
  vm.runInContext(`state.packages.forEach(pkg => {
    pkg.price = "Price <value> & tax";
    pkg.duration = "12 <months>";
    pkg.vehicle = "Hidden delivery vehicle";
  }); renderPackages();`, context);
  const html = elements.get("#pkgGrid").innerHTML;
  const panels = [...html.matchAll(/<dl class="pkg-commercial">([\s\S]*?)<\/dl>/g)];
  assert.equal(panels.length, data.packageOrder.length);
  for (const [, panel] of panels) {
    assert.deepEqual([...panel.matchAll(/<dt>(.*?)<\/dt>/g)].map(match => match[1]), ["Price", "Duration"]);
    assert.match(panel, /<dd>Price &lt;value&gt; &amp; tax<\/dd>/);
    assert.match(panel, /<dd>12 &lt;months&gt;<\/dd>/);
  }
  assert.doesNotMatch(html, /EDE hours|Hidden delivery vehicle/);
});

test("package signals render only when populated and remain HTML-escaped", () => {
  const { context, elements, data } = loadPublicPage();
  for (const signals of [undefined, null, "", " \t\n", "Deal <signals> & details"]) {
    context.signals = signals;
    vm.runInContext("state.packages.forEach(pkg => pkg.signals = signals); renderPackages();", context);
    const html = elements.get("#pkgGrid").innerHTML;
    if (signals?.trim()) {
      const matches = [...html.matchAll(/<p class="small signals">📍 ([\s\S]*?)<\/p>/g)];
      assert.equal(matches.length, data.packageOrder.length);
      assert.ok(matches.every(match => match[1] === "Deal &lt;signals&gt; &amp; details"));
    } else {
      assert.doesNotMatch(html, /class="small signals"|📍/);
    }
  }
});

test("the public page contains no Settings editor, admin link, or admin handlers", () => {
  const source = fs.readFileSync(path.join(root, "scripts/app.js"), "utf8");
  const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
  assert.doesNotMatch(html, /settings|admin\.html|admin\.js|pkgForm|vbdForm|vbdModal|btnExport|btnImport|btnReset/i);
  assert.doesNotMatch(source, /renderSettings|savePkg|renderVbdAdmin|exportCfg|importCfg|vbdForm|btnSave|sessionStorage/);
  assert.deepEqual([...html.matchAll(/data-view="([^"]+)"/g)].map(match => match[1]), ["recommend", "packages", "catalogue"]);
});

test("the standalone admin page owns every editor without public-page dependencies", () => {
  const html = fs.readFileSync(path.join(root, "admin.html"), "utf8");
  const source = fs.readFileSync(path.join(root, "scripts/admin.js"), "utf8");
  assert.match(html, /id="adminSettings"/);
  assert.match(html, /id="vbdModal"/);
  assert.match(html, /id="vbdForm"/);
  assert.match(html, /Changes apply only to this admin session, not to the advisor page/);
  assert.deepEqual([...html.matchAll(/data-pane="([^"]+)"/g)].map(match => match[1]), ["paneSettings", "paneP", "paneV", "paneA"]);
  assert.doesNotMatch(html, /type="password"|pwModal|btnLock|scripts\/app\.js|id="dealForm"/);
  assert.doesNotMatch(source, /renderTriggers|updateLive|applyWizardFields|dealForm|sessionStorage/);
  assert.match(source, /renderSettings\(\);\s*\}\);/);
});

test("admin file actions are outside the editor and sections have distinct headings", () => {
  const html = fs.readFileSync(path.join(root, "admin.html"), "utf8");
  const toolbar = html.match(/<section class="admin-actions"[\s\S]*?<\/section>/);
  assert.ok(toolbar);
  for (const id of ["btnExport", "btnImport", "btnReset", "fileImport"]) {
    assert.ok(toolbar[0].includes(`id="${id}"`));
  }
  const editor = html.slice(html.indexOf('id="adminSettings"'), html.indexOf("</main>"));
  assert.doesNotMatch(editor, /id="(?:btnExport|btnImport|btnReset|fileImport)"/);
  const navigation = html.match(/<nav class="admin-sections"[\s\S]*?<\/nav>/);
  assert.ok(navigation);
  assert.equal([...navigation[0].matchAll(/data-pane=/g)].length, 4);
  assert.equal([...navigation[0].matchAll(/aria-current="true"/g)].length, 1);
  const headings = [...editor.matchAll(/class="setpane"[^>]*aria-labelledby="([^"]+)"/g)];
  assert.equal(headings.length, 4);
  for (const [, id] of headings) assert.ok(editor.includes(`<h2 id="${id}">`));
  assert.deepEqual([...editor.matchAll(/<legend>([^<]+)<\/legend>/g)].map(match => match[1]),
    ["Package identity", "Customer fit and outcomes", "Delivery and commercials", "VBD mapping"]);
});

test("Settings is first and groups rules, wizard, and output in one visible pane", () => {
  const html = fs.readFileSync(path.join(root, "admin.html"), "utf8");
  assert.match(html, /class="active" data-pane="paneSettings" aria-controls="paneSettings" aria-current="true"/);
  assert.match(html, /class="setpane" id="paneP"[^>]* hidden/);
  assert.match(html, /class="setpane" id="paneSettings" role="region" aria-labelledby="settingsHeading">/);
  const settings = html.slice(html.indexOf('id="paneSettings"'), html.indexOf("</main>"));
  assert.deepEqual([...settings.matchAll(/class="settings-section" id="([^"]+)"/g)].map(match => match[1]),
    ["paneR", "paneW", "paneO"]);
  for (const [pane, heading, control] of [
    ["paneR", "rulesHeading", "rThrM"],
    ["paneW", "wizardHeading", 'data-wiz="showCustomer"'],
    ["paneO", "outputHeading", "printToggle"]
  ]) {
    const section = settings.match(new RegExp(`<section class="settings-section" id="${pane}"[\\s\\S]*?</section>`))[0];
    assert.ok(section.includes(`<h3 id="${heading}">`));
    assert.ok(section.includes(control));
    assert.doesNotMatch(section, /\bhidden\b/);
    assert.doesNotMatch(html, new RegExp(`data-pane="${pane}"`));
  }
});

test("Apply Package is beside the Packages heading, above the package tabs and form", () => {
  const html = fs.readFileSync(path.join(root, "admin.html"), "utf8");
  const heading = html.match(/<div class="package-heading">[\s\S]*?<\/div>/)[0];
  assert.match(heading, /<h2 id="packagesHeading">Packages<\/h2>/);
  assert.match(heading, /id="btnSavePkg">.*Apply Package<\/button>/);
  assert.equal([...html.matchAll(/id="btnSavePkg"/g)].length, 1);
  assert.ok(html.indexOf('id="btnSavePkg"') < html.indexOf('id="pkgTabs"'));
  assert.match(html, /edits stay with each package tab until you apply that package/);
});

test("package drafts survive tab switches and rerenders until individually applied or replaced by import", () => {
  const { advisor, context, fields } = loadAdminEditor();
  const change = (name, value) => {
    fields[name].value = value;
    context.rememberPkgDraft({ target: { name, value } });
  };
  const select = key => vm.runInContext(`editPkg=${JSON.stringify(key)}; renderSettings();`, context);
  change("name", "  Draft S  ");
  change("outcomes", "  First outcome  \n\nSecond outcome\n");
  change("hoursMin", "");
  change("hoursMax", "275");
  select("M");
  change("name", "Draft M");
  change("price", "200 EUR");
  select("L");
  change("name", "Draft L");
  select("S");
  assert.equal(fields.name.value, "  Draft S  ");
  assert.equal(fields.outcomes.value, "  First outcome  \n\nSecond outcome\n");
  assert.equal(fields.hoursMin.value, "");
  assert.equal(fields.hoursMax.value, "275");
  assert.equal(context.state.packages[0].name, "Foundation");
  context.renderSettings();
  assert.equal(fields.name.value, "  Draft S  ");
  select("M");
  assert.equal(fields.price.value, "200 EUR");
  context.savePkg();
  assert.equal(context.state.packages[1].name, "Draft M");
  assert.equal(context.state.packages[1].price, "200 EUR");
  assert.equal(vm.runInContext('packageDrafts.has("M")', context), false);
  select("L");
  assert.equal(fields.name.value, "Draft L");
  select("S");
  context.savePkg();
  assert.equal(context.state.packages[0].name, "Draft S");
  assert.equal(context.state.packages[0].hoursMin, 0);
  assert.equal(context.state.packages[0].hoursMax, 275);
  assert.deepEqual(plain(context.state.packages[0].outcomes), ["First outcome", "Second outcome"]);
  select("L");
  context.importCfg({ content: "{}" });
  assert.equal(fields.name.value, "Draft L");
  assert.equal(vm.runInContext('packageDrafts.has("L")', context), true);
  const imported = advisor.defaults();
  imported.packages[2].name = "Imported L";
  context.importCfg({ content: JSON.stringify(imported) });
  assert.equal(fields.name.value, "Imported L");
  assert.equal(vm.runInContext("packageDrafts.size", context), 0);
});

test("Save Settings replaces Apply rules and sits beside the Settings heading", () => {
  const html = fs.readFileSync(path.join(root, "admin.html"), "utf8");
  const heading = html.match(/<div class="settings-heading">[\s\S]*?<\/div>/)[0];
  assert.match(heading, /<h2 id="settingsHeading">Settings<\/h2>/);
  assert.match(heading, /id="btnSaveSettings">.*Save Settings<\/button>/);
  assert.equal([...html.matchAll(/id="btnSaveSettings"/g)].length, 1);
  assert.ok(html.indexOf('id="btnSaveSettings"') < html.indexOf('id="paneR"'));
  assert.doesNotMatch(html, /btnSaveRules|Apply rules/);
  assert.match(html, /Edits stay as drafts until you click Save Settings/);
});

test("Save Settings commits all three sections together while retaining independent package drafts", () => {
  const { advisor, context, fields } = loadAdminEditor(), before = plain(context.state.rules);
  const desired = {
    ...before, band1: 100, band2: 1000, thrM: 3, thrL: 7,
    coreForcesL: !before.coreForcesL, highComplexityMin: "S",
    printEnabled: !before.printEnabled, showCustomer: !before.showCustomer,
    showSeller: !before.showSeller, showMotion: !before.showMotion
  };
  const controls = vm.runInContext("Object.entries(settingsControls)", context);
  for (const [key, selector] of controls) {
    const field = context.$(selector);
    if (field.type === "checkbox") field.checked = desired[key]; else field.value = String(desired[key]);
    context.rememberSettingsDraft({ target: field });
  }
  assert.deepEqual(plain(context.state.rules), before);
  fields.name.value = "Unapplied package";
  context.rememberPkgDraft({ target: { name: "name", value: fields.name.value } });
  vm.runInContext('editPkg="M"; renderSettings(); editPkg="S"; renderSettings();', context);
  for (const [key, selector] of controls) {
    const field = context.$(selector);
    assert.equal(field.type === "checkbox" ? field.checked : field.value,
      typeof desired[key] === "boolean" ? desired[key] : String(desired[key]));
  }
  assert.equal(fields.name.value, "Unapplied package");
  context.saveSettings();
  assert.deepEqual(plain(context.state.rules), desired);
  assert.equal(vm.runInContext("Object.keys(settingsDraft).length", context), 0);
  assert.equal(vm.runInContext('packageDrafts.has("S")', context), true);
  assert.equal(context.state.packages[0].name, advisor.defaults().packages[0].name);
  const exported = advisor.exportDataFiles(context.state, ["config.js"]);
  assert.deepEqual(plain(load(exported).advisor.defaults().rules), desired);
  const toggle = context.$("#printToggle");
  toggle.checked = !desired.printEnabled;
  context.rememberSettingsDraft({ target: toggle });
  context.importCfg({ content: "{}" });
  assert.equal(vm.runInContext("settingsDraft.printEnabled", context), !desired.printEnabled);
  context.importCfg({ content: JSON.stringify(advisor.defaults()) });
  assert.equal(vm.runInContext("Object.keys(settingsDraft).length", context), 0);
  assert.equal(toggle.checked, before.printEnabled);
});

test("VBDs have a top Apply Changes button and each editable section has a data export", () => {
  const html = fs.readFileSync(path.join(root, "admin.html"), "utf8");
  assert.equal([...html.matchAll(/id="btnApplyVbds"/g)].length, 1);
  assert.match(html, /class="vbd-heading"[\s\S]*?id="btnApplyVbds">.*Apply Changes<\/button>/);
  assert.ok(html.indexOf('id="btnApplyVbds"') < html.indexOf('id="admBody"'));
  assert.deepEqual([...html.matchAll(/data-export-section="([^"]+)"/g)].map(match => match[1]),
    ["packages", "vbds", "settings"]);
  for (const section of ["packages", "vbds", "settings"]) {
    assert.match(html, new RegExp(`data-export-section="${section}"[^>]*>.*Export Config</button>`));
    assert.ok(html.includes(`id="${section}Downloads"`));
  }
  assert.match(html, /Save VBD draft/);
});

test("catalogue edits, additions, and removals stay drafts until Apply Changes updates all mappings", () => {
  const { advisor, context, fields, vbdFields } = loadAdminEditor();
  const originalId = context.state.packages[0].vbds[0];
  const removedId = context.state.packages[0].vbds.find(id => id !== originalId);
  context.state.addons[0].vbds.push(originalId, removedId);
  const before = JSON.stringify(context.state), sourceBefore = JSON.stringify(context.DATA);
  const stageRename = (id, replacement) => {
    const records = vm.runInContext("vbdDraft?.vbds||state.vbds", context);
    context.openVbd(records.findIndex(vbd => vbd.id === id));
    vbdFields.id.value = replacement;
    vbdFields.name.value = "Renamed catalogue draft";
    vbdFields.url.value = "";
    context.saveVbd({ preventDefault() {} });
  };
  stageRename(originalId, "TEMP-ID");
  stageRename("TEMP-ID", "RENAMED-ID");
  context.openVbd(-1);
  vbdFields.id.value = "ADDED-ID";
  vbdFields.name.value = "Added catalogue draft";
  context.saveVbd({ preventDefault() {} });
  context.removeVbd(vm.runInContext("vbdDraft.vbds", context).findIndex(vbd => vbd.id === removedId));
  assert.equal(JSON.stringify(context.state), before);
  fields.name.value = "Independent package draft";
  context.rememberPkgDraft({ target: { name: "name", value: fields.name.value } });
  const band = context.$("#rBand1");
  band.value = "321";
  context.rememberSettingsDraft({ target: band });
  context.renderSettings();
  assert.ok(vm.runInContext("vbdDraft.vbds.some(vbd=>vbd.id==='RENAMED-ID')", context));
  context.applyVbdChanges();
  assert.equal(vm.runInContext("vbdDraft", context), null);
  assert.equal(context.state.vbds.some(vbd => vbd.id === originalId || vbd.id === removedId), false);
  assert.ok(context.state.vbds.some(vbd => vbd.id === "ADDED-ID"));
  assert.ok(context.state.packages[0].vbds.includes("RENAMED-ID"));
  assert.ok(context.state.addons[0].vbds.includes("RENAMED-ID"));
  for (const record of [...context.state.packages, ...context.state.addons]) {
    assert.equal(record.vbds.includes(originalId) || record.vbds.includes(removedId), false);
  }
  assert.equal(fields.name.value, "Independent package draft");
  assert.equal(band.value, "321");
  assert.equal(JSON.stringify(context.DATA), sourceBefore);
  const files = advisor.exportDataFiles(context.state, dataFiles.map(file => path.basename(file)));
  assert.deepEqual(plain(load(files).advisor.defaults()), plain(context.state));
  context.openVbd(0);
  vbdFields.name.value = "Discard on import";
  context.saveVbd({ preventDefault() {} });
  context.importCfg({ content: "{}" });
  assert.notEqual(vm.runInContext("vbdDraft", context), null);
  context.importCfg({ content: JSON.stringify(advisor.defaults()) });
  assert.equal(vm.runInContext("vbdDraft", context), null);
});

test("section exports select their data file, preserve related mappings, and require applied drafts", () => {
  const { advisor, context, fields, vbdFields, notifications } = loadAdminEditor(), downloads = [];
  context.downloadFiles = selected => downloads.push(plain(selected));
  for (const [section, filename] of [["settings", "config.js"], ["packages", "packages.js"], ["vbds", "catalogue.js"]]) {
    context.exportSection(section);
    assert.deepEqual(downloads.at(-1), [filename]);
  }
  assert.throws(() => context.sectionExportFiles("unknown"), /Unknown configuration section/);
  const before = downloads.length;
  const band = context.$("#rBand1");
  band.value = "234";
  context.rememberSettingsDraft({ target: band });
  context.exportSection("settings");
  assert.match(notifications.at(-1), /Save Settings before exporting/);
  fields.name.value = "Unapplied package";
  context.rememberPkgDraft({ target: { name: "name", value: fields.name.value } });
  context.exportSection("packages");
  assert.match(notifications.at(-1), /Apply all edited packages/);
  context.openVbd(0);
  vbdFields.name.value = "Pending catalogue";
  context.saveVbd({ preventDefault() {} });
  context.exportSection("vbds");
  assert.match(notifications.at(-1), /Apply Changes/);
  assert.equal(downloads.length, before);
  context.applyVbdChanges();
  context.exportSection("vbds");
  assert.deepEqual(downloads.at(-1), ["catalogue.js"]);
  context.saveSettings();
  context.exportSection("settings");
  assert.deepEqual(downloads.at(-1), ["config.js"]);
  context.savePkg();
  context.exportSection("packages");
  assert.deepEqual(downloads.at(-1), ["packages.js"]);

  const deletedId = context.state.addons.find(addon => addon.vbds.length).vbds[0];
  const renamedId = context.state.packages[0].vbds.find(id => id !== deletedId);
  context.removeVbd(context.state.vbds.findIndex(vbd => vbd.id === deletedId));
  context.openVbd(vm.runInContext("vbdDraft.vbds", context).findIndex(vbd => vbd.id === renamedId));
  vbdFields.id.value = deletedId;
  context.saveVbd({ preventDefault() {} });
  context.applyVbdChanges();
  const files = context.sectionExportFiles("vbds");
  assert.deepEqual(plain(files), ["catalogue.js", "packages.js", "addons.js"]);
  const exported = advisor.exportDataFiles(context.state, files);
  const restored = load(exported).advisor.defaults();
  assert.deepEqual(plain(restored.vbds), plain(context.state.vbds));
  assert.deepEqual(plain(restored.addons), plain(context.state.addons));
  assert.deepEqual(plain(restored.packages), plain(context.state.packages));
});

test("the decorative header overlay cannot intercept navigation clicks", () => {
  const css = fs.readFileSync(path.join(root, "stylesheets/main.css"), "utf8");
  const decoration = css.match(/\.top::after\s*\{([^}]+)\}/);
  assert.ok(decoration);
  assert.match(decoration[1], /pointer-events:\s*none/);
});

test("recommendation and package VBD chips hide IDs while the catalogue retains them", () => {
  const { advisor, data } = load(), state = advisor.defaults();
  const source = fs.readFileSync(path.join(root, "scripts/app.js"), "utf8");
  const shared = fs.readFileSync(path.join(root, "scripts/shared.js"), "utf8");
  const elements = Object.fromEntries(["catSearch", "catTag", "catStage", "catStatus", "catCount", "catBody"]
    .map(id => [`#${id}`, { value: "", innerHTML: "", textContent: "" }]));
  const context = vm.createContext({
    state, TAGS: data.catalogue.offerings,
    vbdById: id => state.vbds.find(vbd => vbd.id === id),
    pkgByKey: key => state.packages.find(pkg => pkg.key === key),
    $: selector => elements[selector]
  });
  vm.runInContext(shared.match(/^const esc = .*$/m)[0] + "\n" +
    source.slice(source.indexOf("function vbdChip(id)"), source.indexOf("function recommend()")) + "\n" +
    source.slice(source.indexOf("function renderCatalogue()"), source.indexOf("/* ---------- Init")), context);
  const chip = vm.runInContext('vbdChip("17072")', context);
  assert.ok(chip.includes(state.vbds.find(vbd => vbd.id === "17072").url));
  assert.match(chip, /Microsoft 365 Copilot Business Value Workshop/);
  assert.doesNotMatch(chip.replace(/<[^>]*>/g, ""), /17072/);
  assert.match(vm.runInContext('vbdChip("AMA")', context), /ID pending/);
  assert.doesNotMatch(vm.runInContext('vbdChip("unknown-id")', context), /unknown-id/);
  vm.runInContext("renderCatalogue()", context);
  assert.match(elements["#catBody"].innerHTML, /<td>17072<\/td>/);
  assert.equal(elements["#catCount"].textContent, "86 of 86 VBDs");
});

test("catalogue records, references, and cumulative mappings are intact", () => {
  const { advisor, data } = load(), state = advisor.defaults();
  assert.equal(state.vbds.length, 86);
  assert.equal(new Set(state.vbds.map(vbd => vbd.id)).size, 86);
  assert.equal(Object.keys(data.catalogue.offerings).length, 10);
  assert.equal(data.catalogue.stages.length, 4);
  assert.equal(data.catalogue.pillars.length, 4);
  assert.equal(data.catalogue.statuses.length, 5);
  const ids = new Set(state.vbds.map(vbd => vbd.id));
  for (const record of [...state.packages, ...state.addons]) {
    for (const id of record.vbds) assert.ok(ids.has(id), `Missing VBD ${id}`);
  }
  for (const vbd of state.vbds) {
    assert.ok(data.catalogue.offerings[vbd.tag]);
    assert.ok(data.catalogue.stages.includes(vbd.stage));
    assert.ok(data.catalogue.pillars.includes(vbd.pillar));
    assert.ok(data.catalogue.statuses.includes(vbd.status));
  }
  assert.deepEqual(plain(state.packages.map(pkg => pkg.vbds.length)), [8, 10, 11]);
  assert.deepEqual(["S", "M", "L"].map(key => advisor.cumulativeVbds(key, state.packages).length), [8, 17, 27]);
  assert.equal(advisor.cumulativeVbds("L", state.packages).filter(id => id === "16595").length, 1);
});

test("default state exactly preserves the original business data", () => {
  const { advisor } = load();
  const digest = crypto.createHash("sha256").update(JSON.stringify(advisor.defaults())).digest("hex");
  assert.equal(digest, "4f17575872f927a65c5cfd940a1c3fec4c923706ecb2b72dfdd0095370530d1c");
});

test("source objects are not mutated by runtime edits, imports, or reset", () => {
  const { advisor, data } = load(), before = JSON.stringify(data);
  const edited = advisor.defaults();
  edited.packages[0].name = "Session title";
  edited.packages[0].vbds.pop();
  edited.vbds[0].notes = "Session note";
  edited.rules.addonsEnabled = true;
  const imported = advisor.importConfiguration(edited);
  imported.packages[0].vbds.push("custom-id");
  assert.equal(edited.packages[0].vbds.includes("custom-id"), false);
  assert.equal(advisor.defaults().packages[0].name, "Foundation");
  assert.equal(advisor.defaults().rules.addonsEnabled, false);
  assert.equal(JSON.stringify(data), before);
  assert.equal(load().advisor.defaults().packages[0].name, "Foundation");
});

test("ESXP URLs distinguish numeric IDs, pending IDs, and custom links", () => {
  const { advisor, data } = load();
  assert.equal(advisor.esxpUrl("AMA"), "");
  assert.match(advisor.esxpUrl("17072"), /services\/17072\/geo\/USA\/details\/1$/);
  assert.equal(advisor.defaults().vbds.find(vbd => vbd.id === "AITW").url, "");
  data.catalogue.vbds[0].url = "https://example.com/custom";
  data.catalogue.vbds[0].notes = "Keep this note";
  assert.equal(advisor.defaults().vbds[0].url, "https://example.com/custom");
  assert.equal(advisor.defaults().vbds[0].notes, "Keep this note");
});

test("licence bands and score thresholds retain exact boundaries", () => {
  const { advisor } = load(), state = advisor.defaults();
  for (const [licenses, expected] of [[499, 0], [500, 1], [2499, 1], [2500, 2]]) {
    const result = advisor.evaluate(deal({ licenses }), state);
    assert.equal(result.scores.licenses, expected);
    assert.equal(result.size, "S");
  }
  state.rules.coreForcesL = false;
  state.rules.highComplexityMin = "S";
  for (const [input, total, size] of [
    [{ licenses: 500, stage: 1, adoption: 1 }, 3, "S"],
    [{ licenses: 500, stage: 1, adoption: 2 }, 4, "M"],
    [{ licenses: 2500, stage: 2, adoption: 2, complexity: 1 }, 7, "M"],
    [{ licenses: 2500, stage: 2, adoption: 2, complexity: 2 }, 8, "L"]
  ]) {
    const result = advisor.evaluate(deal(input), state);
    assert.equal(result.total, total);
    assert.equal(result.size, size);
  }
});

test("ambition and governance override seat count", () => {
  const { advisor } = load(), state = advisor.defaults();
  assert.equal(advisor.evaluate(deal({ agents: 1 }), state).size, "M");
  assert.equal(advisor.evaluate(deal({ agents: 2 }), state).size, "L");
  assert.equal(advisor.evaluate(deal({ complexity: 2 }), state).size, "M");
  state.rules.highComplexityMin = "L";
  assert.equal(advisor.evaluate(deal({ complexity: 2 }), state).size, "L");
  state.rules.coreForcesL = false;
  assert.equal(advisor.evaluate(deal({ agents: 2 }), state).size, "M");
});

test("sample deal outcomes remain S/0, M/6, and L/7", () => {
  const { advisor, data } = load(), state = advisor.defaults();
  const actual = data.config.samples.map(sample => {
    const result = advisor.evaluate({ ...sample, triggers: sample.trig }, state);
    return [result.size, result.total];
  });
  assert.deepEqual(plain(actual), [["S", 0], ["M", 6], ["L", 7]]);
});

test("add-on master, individual controls, manual triggers, and auto switches work", () => {
  const { advisor } = load(), state = advisor.defaults();
  const keys = input => plain(advisor.evaluate(deal(input), state).addons.map(addon => addon.key));
  assert.deepEqual(keys({ triggers: ["secure"] }), []);
  state.rules.addonsEnabled = true;
  assert.deepEqual(keys({ motion: "security" }), ["secure"]);
  assert.deepEqual(keys({ motion: "renewal" }), ["value"]);
  const secure = state.addons.find(addon => addon.key === "secure");
  secure.auto = false;
  assert.deepEqual(keys({ motion: "security" }), []);
  assert.deepEqual(keys({ triggers: ["secure"] }), ["secure"]);
  secure.enabled = false;
  assert.deepEqual(keys({ triggers: ["secure"], complexity: 2 }), []);
  state.addons.push({ key: "custom1", name: "+ Custom", enabled: true, auto: false, vbds: [] });
  assert.deepEqual(keys({ triggers: ["custom1"] }), ["custom1"]);
  state.addons.find(addon => addon.key === "value").vbds = ["16595"];
  assert.deepEqual(keys({ motion: "renewal" }), []);
});

test("data files contain no rendering markup; explanation text stays escaped", () => {
  const { advisor, data } = load();
  for (const file of dataFiles) assert.doesNotMatch(fs.readFileSync(path.join(root, file), "utf8"), /<b>|<option|<div/);
  data.config.questions[0].options[0].reason = "<img src=x>";
  data.config.explanations.coreAgents = "<script>bad</script> {package}";
  const result = advisor.evaluate(deal({ agents: 2 }), advisor.defaults());
  assert.ok(result.reasons[0].includes("&lt;img src=x&gt;"));
  assert.ok(result.reasons.at(-1).includes("&lt;script&gt;bad&lt;/script&gt; <b>L</b>"));
  assert.throws(() => advisor.evaluate(deal({ stage: 10 }), advisor.defaults()), /Unknown stage option/);
});

test("JSON export shape round trips and legacy imports still migrate", () => {
  const { advisor } = load(), original = advisor.defaults();
  assert.deepEqual(Object.keys(original), ["packages", "vbds", "addons", "rules"]);
  assert.deepEqual(plain(advisor.importConfiguration(JSON.parse(JSON.stringify(original)))), plain(original));
  const legacy = plain(original);
  legacy.rules = { v10: true };
  legacy.packages[0].price = "€XXk (indicative)";
  legacy.packages[0].hoursMin = 80;
  legacy.packages[0].hoursMax = 120;
  legacy.packages[0].scope = ["Business value and scenario workshop"];
  legacy.packages[0].vbds = ["17072", "16163", "17963", "18135", "17046", "17052", "17969", "17267", "16489"];
  delete legacy.addons[0].enabled;
  delete legacy.addons[0].auto;
  delete legacy.addons[0].trigger;
  const migrated = advisor.importConfiguration(legacy);
  assert.deepEqual(plain(migrated.packages[0]), plain(original.packages[0]));
  assert.equal(migrated.addons[0].enabled, true);
  assert.equal(migrated.addons[0].auto, true);
  assert.equal(migrated.addons[0].trigger, original.addons[0].trigger);
  assert.deepEqual(plain(migrated.rules), plain(original.rules));
  const older = plain(original);
  older.rules = {};
  older.vbds = older.vbds.filter(vbd => vbd.id !== "16595");
  older.packages.forEach(pkg => pkg.vbds = pkg.vbds.filter(id => id !== "16595"));
  const upgraded = advisor.importConfiguration(older);
  assert.ok(upgraded.vbds.some(vbd => vbd.id === "16595"));
  assert.ok(upgraded.packages.every(pkg => pkg.vbds.includes("16595")));
});

test("admin export offers four replaceable files separately from JSON backups", () => {
  const html = fs.readFileSync(path.join(root, "admin.html"), "utf8");
  assert.match(html, /id="btnExport" aria-expanded="false" aria-controls="exportPanel"/);
  const panel = html.match(/<section class="card export-panel"[\s\S]*?<\/section>/)[0];
  assert.deepEqual([...panel.matchAll(/name="dataFile" value="([^"]+)" checked/g)].map(match => match[1]),
    dataFiles.map(file => path.basename(file)));
  assert.match(panel, /id="btnDownloadData"/);
  assert.match(panel, /id="btnExportJson"/);
  assert.match(panel, /Apply package and VBD changes and save Settings before exporting/);
  assert.match(panel, /Individual download links/);
  assert.match(panel, /JSON backups are for Import, not direct replacement/);
});

test("exported JS files preserve edited state, metadata, and advisor behavior after replacement", () => {
  const { advisor, data } = load(), edited = advisor.defaults();
  const sourceBefore = JSON.stringify(data);
  const oldId = "16595", newId = "CUSTOM-RENAMED";
  Object.assign(edited.vbds.find(vbd => vbd.id === oldId), {
    id: newId, name: "Renamed VBD", url: "https://example.com/custom",
    notes: "Quotes \" and ' with \\ and a newline\n</script>"
  });
  const removedId = edited.vbds.find(vbd => vbd.id !== newId).id;
  edited.vbds = edited.vbds.filter(vbd => vbd.id !== removedId);
  for (const record of [...edited.packages, ...edited.addons]) {
    record.vbds = record.vbds.filter(id => id !== removedId).map(id => id === oldId ? newId : id);
  }
  edited.vbds.push({ ...edited.vbds[0], id: "CUSTOM-ADDED", name: "Added VBD", url: "" });
  edited.packages[0].vbds.push("CUSTOM-ADDED");
  edited.packages[0].name = "Edited package";
  edited.packages[0].price = "Custom price";
  edited.addons = edited.addons.filter(addon => addon.key !== "bpa");
  edited.addons.find(addon => addon.key === "secure").auto = false;
  edited.addons.push({
    ...plain(data.newAddon), key: "custom", name: "Custom add-on", trigger: "Custom trigger", vbds: [newId]
  });
  edited.rules.thrL = 1;
  edited.rules.showSeller = true;
  const stateBefore = JSON.stringify(edited);
  const files = advisor.exportDataFiles(edited, dataFiles.map(file => path.basename(file)));
  assert.deepEqual(plain(files.map(file => file.name)), dataFiles.map(file => path.basename(file)));
  const restored = load(files), actual = restored.advisor.defaults();
  assert.deepEqual(plain(actual), plain(edited));
  assert.equal(restored.advisor.evaluate(deal({ licenses: 1000 }), actual).size, "L");
  assert.equal(advisor.evaluate(deal({ licenses: 1000 }), advisor.defaults()).size, "S");
  assert.deepEqual(plain(restored.data.packageOrder), plain(data.packageOrder));
  assert.deepEqual(plain(restored.data.newAddon), plain(data.newAddon));
  for (const [key, value] of Object.entries(data.catalogue)) {
    if (key !== "vbds") assert.deepEqual(plain(restored.data.catalogue[key]), plain(value));
  }
  for (const [key, value] of Object.entries(data.config)) {
    if (key !== "rules") assert.deepEqual(plain(restored.data.config[key]), plain(value));
  }
  for (const addon of restored.data.addons) {
    assert.equal(addon.autoHint, data.addons.find(original => original.key === addon.key)?.autoHint);
  }
  assert.equal(restored.data.addons.some(addon => addon.key === "bpa"), false);
  assert.equal(JSON.stringify(data), sourceBefore);
  assert.equal(JSON.stringify(edited), stateBefore);
});

test("each selected data file can independently replace its original without changing other data", () => {
  const { advisor } = load(), edited = advisor.defaults();
  edited.vbds[0].name = "Edited VBD";
  edited.packages[0].price = "Edited price";
  edited.addons[0].enabled = !edited.addons[0].enabled;
  edited.rules.band1 = 123;
  const fields = { "catalogue.js": "vbds", "packages.js": "packages", "addons.js": "addons", "config.js": "rules" };
  for (const [name, field] of Object.entries(fields)) {
    const files = advisor.exportDataFiles(edited, [name]);
    assert.equal(files.length, 1);
    assert.equal(files[0].name, name);
    const expected = plain(advisor.defaults());
    expected[field] = plain(edited[field]);
    assert.deepEqual(plain(load(files).advisor.defaults()), expected);
  }
  const subset = advisor.exportDataFiles(edited, ["packages.js", "config.js"]);
  const expected = plain(advisor.defaults());
  expected.packages = plain(edited.packages);
  expected.rules = plain(edited.rules);
  assert.deepEqual(plain(load(subset).advisor.defaults()), expected);
});

test("export rejects invalid selections, malformed state, and broken cross-file VBD references", () => {
  const { advisor } = load(), edited = advisor.defaults();
  for (const selection of [undefined, [], ["unknown.js"], ["catalogue.js", "catalogue.js"], "packages.js"]) {
    assert.throws(() => advisor.exportDataFiles(edited, selection), /Select at least one/);
  }
  assert.throws(() => advisor.exportDataFiles(null, ["config.js"]), /Configuration/);
  const malformed = advisor.defaults();
  malformed.rules.band1 = "invalid";
  assert.throws(() => advisor.exportDataFiles(malformed, ["config.js"]), /invalid decision rules/);
  const id = "16595";
  edited.vbds.find(vbd => vbd.id === id).id = "REPLACEMENT-ID";
  for (const record of [...edited.packages, ...edited.addons]) {
    record.vbds = record.vbds.map(value => value === id ? "REPLACEMENT-ID" : value);
  }
  edited.addons[0].vbds.push("REPLACEMENT-ID");
  for (const selection of [["catalogue.js"], ["packages.js"], ["addons.js"]]) {
    assert.throws(() => advisor.exportDataFiles(edited, selection), /unresolved VBD references/);
  }
  const consistent = advisor.exportDataFiles(edited, ["catalogue.js", "packages.js", "addons.js"]);
  assert.deepEqual(plain(load(consistent).advisor.defaults()), plain(edited));
  edited.addons[0].vbds.push("MISSING-ID");
  assert.throws(() => advisor.exportDataFiles(edited, dataFiles.map(file => path.basename(file))), /unresolved VBD references/);
});

test("invalid imported data reports errors instead of replacing valid state", () => {
  const { advisor } = load();
  for (const invalid of [null, {}, { packages: [], vbds: [] }]) {
    assert.throws(() => advisor.importConfiguration(invalid), /Configuration/);
  }
  const broken = advisor.defaults();
  broken.packages[0].outcomes = null;
  assert.throws(() => advisor.importConfiguration(broken), /Invalid fields/);
  const invalidRules = advisor.defaults();
  invalidRules.rules.band1 = "not a number";
  assert.throws(() => advisor.importConfiguration(invalidRules), /invalid decision rules/);
});

test("HTML loads ordered local classic scripts and an external stylesheet", () => {
  const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
  const sources = [...html.matchAll(/<script defer src="([^"]+)"><\/script>/g)].map(match => match[1]);
  assert.deepEqual(sources, [...scripts, "scripts/shared.js", "scripts/app.js"]);
  assert.match(html, /<link rel="stylesheet" href="stylesheets\/main.css">/);
  assert.doesNotMatch(html, /<style>|style=|type="module"|const DEFAULT_/);
  for (const file of sources) {
    const source = fs.readFileSync(path.join(root, file), "utf8");
    new vm.Script(source, { filename: file });
    assert.doesNotMatch(source, /\blocalStorage\b/);
  }
});

test("Azure redirects the advisor directory to a trailing slash so relative assets resolve correctly", () => {
  const config = JSON.parse(fs.readFileSync(path.join(root, "..", "staticwebapp.config.json"), "utf8"));
  const route = config.routes.find(route => route.route === "/unifiedpackages");
  assert.ok(route, "The extensionless advisor URL needs a canonical directory redirect");
  assert.equal(route.statusCode, 301);
  assert.equal(route.redirect, "/unifiedpackages/");
  assert.ok(!config.routes.some(route => route.route === "/unifiedpackages/"), "The redirect target must not redirect again");
  const base = new URL(route.redirect, "https://example.test");
  for (const page of ["index.html", "admin.html"]) {
    const html = fs.readFileSync(path.join(root, page), "utf8");
    const assets = [...html.matchAll(/(?:src|href)="((?:stylesheets|scripts|data)\/[^"]+)"/g)];
    assert.ok(assets.length > 0);
    for (const [, asset] of assets) {
      assert.equal(new URL(asset, base).pathname, `/unifiedpackages/${asset}`);
      assert.ok(fs.existsSync(path.join(root, asset)), `${page} references missing asset ${asset}`);
    }
  }
});

test("admin loads only its shared data/state helpers and dedicated script", () => {
  const html = fs.readFileSync(path.join(root, "admin.html"), "utf8");
  const sources = [...html.matchAll(/<script defer src="([^"]+)"><\/script>/g)].map(match => match[1]);
  assert.deepEqual(sources, [...dataFiles, "scripts/state.js", "scripts/shared.js", "scripts/admin.js"]);
  assert.match(html, /href="stylesheets\/admin.css"/);
  assert.match(html, /name="robots" content="noindex, nofollow"/);
  for (const file of sources) {
    const source = fs.readFileSync(path.join(root, file), "utf8");
    new vm.Script(source, { filename: file });
    assert.doesNotMatch(source, /\blocalStorage\b/);
  }
});

test("14,580 evaluation cases match the original engine baseline", () => {
  const { advisor } = load(), digest = crypto.createHash("sha256");
  for (let mode = 0; mode < 5; mode++) {
    const state = advisor.defaults();
    if (mode > 0) state.rules.addonsEnabled = true;
    if (mode === 2) state.addons.find(addon => addon.key === "secure").enabled = false;
    if (mode === 3) state.addons.forEach(addon => addon.auto = false);
    if (mode === 4) Object.assign(state.rules, { coreForcesL: false, highComplexityMin: "S", thrM: 5, thrL: 9 });
    for (const licenses of [0, 499, 500, 2499, 2500, 10000])
      for (let stage = 0; stage <= 2; stage++)
        for (let adoption = 0; adoption <= 2; adoption++)
          for (let agents = 0; agents <= 2; agents++)
            for (let complexity = 0; complexity <= 2; complexity++)
              for (const motion of ["", "renewal", "security"])
                for (const triggers of [[], ["secure", "bpa", "cowork", "optimize", "value", "agentops"]]) {
                  const result = advisor.evaluate({ licenses, stage, adoption, agents, complexity, motion, triggers }, state);
                  digest.update(JSON.stringify({
                    ...result,
                    reasons: result.reasons.map(reason => reason.replace(/^📊 .* Copilot licences means /, "📊 {licenses} Copilot licences means ")),
                    addons: result.addons.map(addon => addon.key)
                  }));
                }
  }
  assert.equal(digest.digest("hex"), "977f9b02ed01fb8ec0afe1abe161ed22c2bde100ada8518a3626e50dc1fd464d");
});
