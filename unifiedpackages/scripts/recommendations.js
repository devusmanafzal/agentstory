(function () {
  const data = window.UnifiedAdvisorData;
  const escape = value => String(value).replace(/[&<>"']/g, char =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
  const packageReason = (text, key) => text.split("{package}").map(escape).join(`<b>${escape(key)}</b>`);
  const activeAddons = state => state.rules.addonsEnabled ? state.addons.filter(addon => addon.enabled) : [];

  function cumulativeVbds(size, packages) {
    const out = [];
    for (const key of data.packageOrder) {
      const pkg = packages.find(value => value.key === key);
      if (pkg) pkg.vbds.forEach(id => { if (!out.includes(id)) out.push(id); });
      if (key === size) break;
    }
    return out;
  }

  function evaluate(deal, state) {
    const rules = state.rules, config = data.config, reasons = [];
    const lic = deal.licenses >= rules.band2 ? 2 : (deal.licenses >= rules.band1 ? 1 : 0);
    const scores = { licenses: lic, stage: deal.stage, adoption: deal.adoption, agents: deal.agents, complexity: deal.complexity };
    const total = Object.values(scores).reduce((a, b) => a + b, 0);
    let size = total >= rules.thrL ? "L" : (total >= rules.thrM ? "M" : "S");
    for (const question of config.questions) {
      const option = question.options.find(value => value.value === deal[question.name]);
      if (!option) throw new Error(`Unknown ${question.name} option: ${deal[question.name]}`);
      reasons.push(`${escape(question.reasonPrefix)}${escape(option.reason)}.`);
    }
    reasons.push(`📊 ${deal.licenses.toLocaleString()} Copilot licences means ${escape(config.rollouts[lic].reason)} rollout.`);
    const rank = key => data.packageOrder.indexOf(key);
    if (deal.agents === 2 && rules.coreForcesL && size !== "L") {
      size = "L";
      reasons.push(packageReason(config.explanations.coreAgents, size));
    }
    if (deal.complexity === 2 && rank(rules.highComplexityMin) > rank(size)) {
      size = rules.highComplexityMin;
      reasons.push(`${escape(config.explanations.highComplexity)} <b>${escape(size)}</b>.`);
    }
    if (deal.agents >= 1 && size === "S") {
      size = "M";
      reasons.push(packageReason(config.explanations.agentAmbition, size));
    }
    if (deal.stage === 0 && deal.licenses >= rules.band2) reasons.push(escape(config.explanations.earlyLargeRollout));
    const add = new Set(deal.triggers);
    const autoOn = key => state.addons.some(addon => addon.key === key && addon.auto);
    if (deal.complexity === 2 && autoOn("secure")) add.add("secure");
    if (deal.motion === "renewal" && autoOn("value")) add.add("value");
    if (deal.motion === "security" && autoOn("secure")) add.add("secure");
    if (deal.agents === 2 && size !== "L" && autoOn("bpa")) add.add("bpa");
    if (deal.agents >= 1 && deal.complexity >= 1 && autoOn("agentops")) add.add("agentops");
    const packageVbds = new Set(cumulativeVbds(size, state.packages));
    const addons = activeAddons(state).filter(addon =>
      add.has(addon.key) && !(addon.vbds.length && addon.vbds.every(id => packageVbds.has(id))));
    return { size, total, scores, reasons, addons };
  }

  Object.assign(window.UnifiedAdvisor, { activeAddons, cumulativeVbds, evaluate });
})();
