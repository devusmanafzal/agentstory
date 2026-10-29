(function () {
  const clone = value => JSON.parse(JSON.stringify(value));
  const esxpUrl = id => /^\d+$/.test(id)
    ? `https://esxp.microsoft.com/#/omexplanding/services/${id}/geo/USA/details/1`
    : "";

  function defaults() {
    const data = window.UnifiedAdvisorData;
    if (!data?.catalogue || !data.packages || !data.addons || !data.config) {
      throw new Error("Advisor data is missing. Check the files in the data folder.");
    }
    const state = {
      packages: clone(data.packages),
      vbds: clone(data.catalogue.vbds).map(vbd => ({ ...vbd, url: vbd.url || esxpUrl(vbd.id) })),
      addons: clone(data.addons).map(({ autoHint, ...addon }) => addon),
      rules: clone(data.config.rules)
    };
    validate(state);
    return state;
  }

  function validate(state) {
    const strings = value => Array.isArray(value) && value.every(item => typeof item === "string");
    const unique = values => new Set(values).size === values.length;
    if (!Array.isArray(state.packages) || state.packages.length !== 3 ||
        !["S", "M", "L"].every(key => state.packages.some(pkg => pkg?.key === key))) {
      throw new Error("Configuration must contain the S, M, and L packages.");
    }
    for (const pkg of state.packages) {
      if (!["name", "color", "icon", "tagline", "promise", "vehicle", "price", "duration", "signals"]
        .every(key => typeof pkg[key] === "string") ||
        !["suitable", "outcomes", "scope", "commitment", "vbds"].every(key => strings(pkg[key])) ||
        !Number.isFinite(pkg.hoursMin) || !Number.isFinite(pkg.hoursMax)) {
        throw new Error(`Invalid fields in package ${pkg.key}.`);
      }
    }
    if (!Array.isArray(state.vbds) || state.vbds.some(vbd => !vbd ||
        !["id", "name", "tag", "stage", "pillar", "status"].every(key => typeof vbd[key] === "string") ||
        (vbd.url != null && typeof vbd.url !== "string") || (vbd.notes != null && typeof vbd.notes !== "string")) ||
        !unique(state.vbds.map(vbd => vbd.id))) {
      throw new Error("VBDs must have valid fields and unique string IDs.");
    }
    if (!Array.isArray(state.addons) || state.addons.some(addon => !addon ||
        !["key", "name", "icon", "trigger", "hint", "desc"].every(key => typeof addon[key] === "string") ||
        !strings(addon.vbds) || typeof addon.enabled !== "boolean" || typeof addon.auto !== "boolean") ||
        !unique(state.addons.map(addon => addon.key))) {
      throw new Error("Add-ons must have valid fields and unique keys.");
    }
    const rules = state.rules;
    if (!rules || !["band1", "band2", "thrM", "thrL"].every(key => Number.isFinite(rules[key])) ||
        !["addonsEnabled", "printEnabled", "showCustomer", "showSeller", "showMotion", "coreForcesL"]
          .every(key => typeof rules[key] === "boolean") ||
        !["S", "M", "L"].includes(rules.highComplexityMin)) {
      throw new Error("Configuration contains invalid decision rules.");
    }
  }

  function migrate(s) {
    const current = defaults();
    const wasV7 = !!s.rules?.v7, wasV10 = !!s.rules?.v10, wasV11 = !!s.rules?.v11;
    s.rules = Object.assign(current.rules, s.rules || {});
    if (!wasV7) { s.rules.addonsEnabled = false; s.rules.v7 = true; }
    if (!wasV11) { s.rules.highComplexityMin = "M"; s.rules.printEnabled = true; s.rules.v11 = true; }
    if (!wasV10) {
      const have = new Set(s.vbds.map(vbd => vbd.id));
      current.vbds.forEach(vbd => { if (!have.has(vbd.id)) s.vbds.push(clone(vbd)); });
      s.packages.forEach(pkg => {
        if (["S", "M", "L"].includes(pkg.key) && !pkg.vbds.includes("16595")) pkg.vbds.unshift("16595");
      });
      s.rules.v10 = true;
    }
    s.addons = s.addons.map(addon => {
      const original = current.addons.find(value => value.key === addon.key) || {};
      return Object.assign({
        enabled: true, auto: true,
        trigger: original.trigger || String(addon.name || "").replace(/^\+\s*/, ""),
        hint: original.hint || "", icon: "➕", desc: "", vbds: []
      }, addon);
    });
    const oldPrices = { "€XXk (indicative)": "S", "€XXk – €XXk (indicative)": "M", "€XXk+ (indicative)": "L" };
    const oldHours = { S: [80, 120], M: [160, 220], L: [300, 450] };
    const oldVbds = {
      S: ["17072", "16163", "17963", "18135", "17046", "17052", "17969", "17267", "16489"],
      M: ["17966", "16796", "17957", "17736", "17747", "17739", "18017", "18051", "18339"],
      L: ["18273", "18276", "17743", "17995", "17452", "AMA", "18047", "14379", "18015", "15332"]
    };
    s.packages.forEach(pkg => {
      const original = current.packages.find(value => value.key === pkg.key);
      if (!original) return;
      if (JSON.stringify(pkg.vbds) === JSON.stringify(oldVbds[pkg.key])) pkg.vbds = clone(original.vbds);
      if (pkg.scope && /^(Business value and scenario workshop|Everything in )/.test(pkg.scope[0] || "")) {
        pkg.scope = clone(original.scope);
      }
      if (oldHours[pkg.key] && pkg.hoursMin === oldHours[pkg.key][0] && pkg.hoursMax === oldHours[pkg.key][1]) {
        pkg.hoursMin = original.hoursMin;
        pkg.hoursMax = original.hoursMax;
      }
      if (oldPrices[pkg.price] === pkg.key) pkg.price = original.price;
    });
    return s;
  }

  function importConfiguration(value) {
    if (!value || !Array.isArray(value.packages) || !Array.isArray(value.vbds)) {
      throw new Error("Configuration must contain packages and vbds arrays.");
    }
    const state = Object.assign(defaults(), clone(value));
    if (!Array.isArray(state.addons) || state.addons.some(addon => !addon || typeof addon !== "object") ||
        state.packages.some(pkg => !pkg || !Array.isArray(pkg.vbds)) ||
        state.vbds.some(vbd => !vbd || typeof vbd !== "object") ||
        (state.rules != null && (typeof state.rules !== "object" || Array.isArray(state.rules)))) {
      throw new Error("Configuration contains invalid package or add-on data.");
    }
    const migrated = migrate(state);
    validate(migrated);
    return { packages: migrated.packages, vbds: migrated.vbds, addons: migrated.addons, rules: migrated.rules };
  }

  function exportDataFiles(configuration, filenames) {
    const available = ["catalogue.js", "packages.js", "addons.js", "config.js"];
    if (!Array.isArray(filenames) || !filenames.length ||
        filenames.some(name => !available.includes(name)) || new Set(filenames).size !== filenames.length) {
      throw new Error("Select at least one of the four data files to export.");
    }
    if (!configuration || typeof configuration !== "object") {
      throw new Error("Configuration is missing or invalid.");
    }
    validate(configuration);
    const effective = defaults();
    const fields = { "catalogue.js": "vbds", "packages.js": "packages", "addons.js": "addons", "config.js": "rules" };
    filenames.forEach(name => { effective[fields[name]] = configuration[fields[name]]; });
    const ids = new Set(effective.vbds.map(vbd => vbd.id));
    if ([...effective.packages, ...effective.addons].some(record => record.vbds.some(id => !ids.has(id)))) {
      throw new Error("These files would leave unresolved VBD references. Include the related catalogue, packages, and add-ons files, and check their VBD IDs.");
    }
    const data = window.UnifiedAdvisorData;
    const assignment = (target, value) => `${target} = ${JSON.stringify(value, null, 2)};\n`;
    const content = {
      "catalogue.js": () => assignment("window.UnifiedAdvisorData", {
        catalogue: { ...data.catalogue, vbds: configuration.vbds }
      }),
      "packages.js": () => assignment("window.UnifiedAdvisorData.packageOrder", data.packageOrder) +
        assignment("window.UnifiedAdvisorData.packages", configuration.packages),
      "addons.js": () => assignment("window.UnifiedAdvisorData.addons", configuration.addons.map(addon => ({
        ...data.addons.find(original => original.key === addon.key), ...addon
      }))) + assignment("window.UnifiedAdvisorData.newAddon", data.newAddon),
      "config.js": () => assignment("window.UnifiedAdvisorData.config", { ...data.config, rules: configuration.rules })
    };
    return filenames.map(name => ({ name, content: content[name]() }));
  }

  window.UnifiedAdvisor = { defaults, importConfiguration, esxpUrl, exportDataFiles };
})();
