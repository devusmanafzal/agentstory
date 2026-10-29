window.UnifiedAdvisorData.config = {
  "initialLicenses": 1000,
  "rules": {
    "v7": true,
    "v10": true,
    "v11": true,
    "addonsEnabled": false,
    "printEnabled": true,
    "showCustomer": false,
    "showSeller": false,
    "showMotion": false,
    "band1": 500,
    "band2": 2500,
    "thrM": 4,
    "thrL": 8,
    "coreForcesL": true,
    "highComplexityMin": "M"
  },
  "questions": [
    {
      "name": "stage",
      "title": "Where is the customer with Copilot today?",
      "scoreLabel": "Deployment",
      "reasonPrefix": "📍 The customer ",
      "options": [
        {
          "value": 0,
          "label": "🔍 Evaluating",
          "hint": "Just purchased or getting started",
          "reason": "is evaluating or just getting started with Copilot",
          "default": true
        },
        {
          "value": 1,
          "label": "🛠️ Deploying",
          "hint": "Rollout is underway",
          "reason": "is in the middle of deploying Copilot"
        },
        {
          "value": 2,
          "label": "🏁 Broadly deployed",
          "hint": "In use across the organisation",
          "reason": "has Copilot broadly deployed"
        }
      ]
    },
    {
      "name": "adoption",
      "title": "What does adoption need most?",
      "scoreLabel": "Adoption",
      "reasonPrefix": "👥 It ",
      "options": [
        {
          "value": 0,
          "label": "👋 First users",
          "hint": "Initial enablement & skilling",
          "reason": "needs to enable its first users",
          "default": true
        },
        {
          "value": 1,
          "label": "📣 Scale",
          "hint": "Expand across teams / BUs",
          "reason": "needs to scale adoption across teams"
        },
        {
          "value": 2,
          "label": "📈 Optimise",
          "hint": "Improve usage & prove value",
          "reason": "needs to improve usage and prove value"
        }
      ]
    },
    {
      "name": "agents",
      "title": "What is the agent ambition?",
      "scoreLabel": "Agents",
      "reasonPrefix": "🤖 It ",
      "options": [
        {
          "value": 0,
          "label": "— None yet",
          "hint": "Copilot focus for now",
          "reason": "has no agent plans yet",
          "default": true
        },
        {
          "value": 1,
          "label": "🤖 First agents",
          "hint": "1–3 productivity agents",
          "reason": "is planning its first agents"
        },
        {
          "value": 2,
          "label": "⚙️ Core processes",
          "hint": "Automate business-critical work",
          "reason": "wants agents to run core business processes"
        }
      ]
    },
    {
      "name": "complexity",
      "title": "Governance / integration complexity",
      "scoreLabel": "Complexity",
      "reasonPrefix": "🛡️ It ",
      "options": [
        {
          "value": 0,
          "label": "Standard",
          "hint": "Single BU, standard data",
          "reason": "has a standard governance setup",
          "default": true
        },
        {
          "value": 1,
          "label": "Moderate",
          "hint": "Several BUs or integrations",
          "reason": "has several business units or integrations to consider"
        },
        {
          "value": 2,
          "label": "High",
          "hint": "Regulated, multi-country, testing needed",
          "reason": "has regulated data or complex, multi-country governance"
        }
      ]
    }
  ],
  "motions": [
    {
      "value": "netnew",
      "label": "Net-new Copilot"
    },
    {
      "value": "expansion",
      "label": "Copilot expansion"
    },
    {
      "value": "agents",
      "label": "Agents expansion"
    },
    {
      "value": "security",
      "label": "E7 / security-led"
    },
    {
      "value": "renewal",
      "label": "Renewal & value realisation"
    }
  ],
  "scoreLabels": {
    "licenses": "Licences",
    "stage": "Deployment",
    "adoption": "Adoption",
    "agents": "Agents",
    "complexity": "Complexity"
  },
  "rollouts": [
    {
      "label": "Focused",
      "reason": "a focused"
    },
    {
      "label": "Mid-sized",
      "reason": "a mid-sized"
    },
    {
      "label": "Broad",
      "reason": "a broad"
    }
  ],
  "explanations": {
    "coreAgents": "⬆️ Core-process agent ambition lifts the recommendation to {package} — this is a transformation conversation.",
    "highComplexity": "⬆️ High governance / integration complexity requires at least",
    "agentAmbition": "⬆️ Agent ambition needs pilots and activation — moved to {package}.",
    "earlyLargeRollout": "💡 Large seat count but early stage — keep the Foundation activities inside the plan."
  },
  "samples": [
    {
      "key": "s",
      "label": "🌱 Starter",
      "customer": "Nordic Retail AB",
      "opp": "OPP-1042",
      "licenses": 300,
      "stage": 0,
      "adoption": 0,
      "agents": 0,
      "complexity": 0,
      "motion": "netnew",
      "trig": []
    },
    {
      "key": "m",
      "label": "🚀 Scaling",
      "customer": "Contoso Manufacturing",
      "opp": "OPP-2210",
      "licenses": 3000,
      "stage": 1,
      "adoption": 1,
      "agents": 1,
      "complexity": 1,
      "motion": "expansion",
      "trig": [
        "optimize"
      ]
    },
    {
      "key": "l",
      "label": "✨ Transforming",
      "customer": "Fabrikam Insurance",
      "opp": "OPP-3307",
      "licenses": 1500,
      "stage": 1,
      "adoption": 1,
      "agents": 2,
      "complexity": 2,
      "motion": "agents",
      "trig": [
        "secure"
      ]
    }
  ],
  "tips": [
    "Every Copilot deal deserves a success plan. 💪",
    "Outcomes sell better than hours — lead with the promise.",
    "A Unified attachment turns licences into lasting value.",
    "You're one click away from a stronger proposal! 🚀"
  ]
};
