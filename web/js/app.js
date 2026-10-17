import { LiveDuel } from "./duel.js";
const $ = (id) => document.getElementById(id);
const repo = "https://github.com/gramuah/RL_tournament";
const configs = {
  1: {
    eyebrow: "Lab 01 — Proximal policy optimization",
    description:
      "A precise descent. A learned policy.\nTrain your agent and find a softer landing.",
    art: "lander-route.svg",
    alt: "Illustrated LunarLander descent toward a landing pad",
    caption: "FIG. 01 / THE LANDING PROBLEM",
    env: "LunarLander",
    model: "ppo-LunarLander-v3.zip",
    objective: "Find a softer landing",
    reward:
      "LunarLander rewards progress toward the landing pad and penalizes fuel use and crashes. Four discrete actions control the engines. Episodes are capped at 1,000 steps.",
    success:
      "LunarLander success rate is the share of episodes earning at least 200 reward. Passing mean reward: 100. Mastery: 200.",
    actions: "4",
  },
  2: {
    eyebrow: "Lab 02 — Q-learning",
    description:
      "One city. Six actions. A better policy.\nTrain your agent and see how it measures up.",
    art: "taxi-route.svg",
    alt: "Illustrated Taxi grid: a route from passenger pickup to destination",
    caption: "FIG. 02 / THE PICKUP PROBLEM",
    env: "Taxi",
    model: "qtable.npy",
    objective: "Complete the trip",
    reward:
      "Taxi uses six discrete actions. Normal steps cost −1, illegal pickup/drop-off costs −10, and successful delivery earns +20. Episodes are capped at 200 steps.",
    success:
      "Taxi success rate is the share of episodes with a positive total reward. It is stricter than delivery alone. Passing mean reward: 4.5. Mastery: 7.0.",
    actions: "6",
  },
};
let lab = 2,
  view = "standings",
  records = [],
  manifest = null,
  selected = new Set(),
  request = 0,
  loadState = "loading";
const arena = new LiveDuel();
function route() {
  const [name, query = ""] = location.hash.slice(1).split("?");
  view = ["standings", "arena", "submit", "rules"].includes(name)
    ? name
    : "standings";
  const nextLab = new URLSearchParams(query).get("lab") === "1" ? 1 : 2;
  const changed = nextLab !== lab;
  lab = nextLab;
  document.querySelectorAll(".view").forEach((el) => {
    el.hidden = el.id !== view;
  });
  document.querySelectorAll("[data-view]").forEach((el) => {
    el.href = `#${el.dataset.view}?lab=${lab}`;
    if (el.dataset.view === view) el.setAttribute("aria-current", "page");
    else el.removeAttribute("aria-current");
  });
  document
    .querySelectorAll("[data-lab]")
    .forEach((el) =>
      el.setAttribute("aria-pressed", String(Number(el.dataset.lab) === lab)),
    );
  document
    .querySelectorAll("[data-submit-link]")
    .forEach((el) => (el.href = `#submit?lab=${lab}`));
  document
    .querySelectorAll("[data-rules-link]")
    .forEach((el) => (el.href = `#rules?lab=${lab}`));
  const config = configs[lab];
  $("lab-eyebrow").textContent = config.eyebrow;
  $("lab-description").replaceChildren(
    ...config.description
      .split("\n")
      .flatMap((line, i) =>
        i
          ? [document.createElement("br"), document.createTextNode(line)]
          : [document.createTextNode(line)],
      ),
  );
  $("hero-map").src = `assets/${config.art}`;
  $("hero-map").alt = config.alt;
  $("art-caption-label").textContent = config.caption;
  $("rule-objective-title").textContent = config.objective;
  $("rule-objective").textContent = config.reward;
  $("rule-success").textContent = config.success;
  $("rule-actions").textContent = config.actions;
  $("submission-tree").textContent =
    `submissions/lab${lab}/your-github-login/\n├── agent.py\n└── ${config.model}`;
  $("notebook-link").href =
    `${repo}/blob/main/Lab_sessions/Lab${lab}/Lab${lab}.ipynb`;
  $("submission-guide").href = `${repo}/tree/main/submissions/lab${lab}`;
  document.title = `${view[0].toUpperCase() + view.slice(1)} · Lab ${lab} — RL Tournament`;
  arena.setView(view === "arena", lab);
  document
    .querySelectorAll("[data-arena-link]")
    .forEach((el) => (el.href = `#arena?lab=${lab}`));
  if (changed) {
    selected.clear();
    $("search").value = "";
    loadData();
  }
}
function validResult(row) {
  return (
    row &&
    typeof row === "object" &&
    typeof row.participant === "string" &&
    row.participant.length <= 100 &&
    typeof row.success === "boolean" &&
    (!row.success ||
      ["mean_reward", "std_reward", "success_rate", "avg_steps"].every(
        (k) => typeof row[k] === "number" && Number.isFinite(row[k]),
      )) &&
    (!row.success ||
      (row.std_reward >= 0 &&
        row.avg_steps >= 0 &&
        row.success_rate >= 0 &&
        row.success_rate <= 100))
  );
}
async function fetchJSON(path, signal) {
  const response = await fetch(path, { cache: "no-cache", signal });
  if (!response.ok) throw new Error("Results unavailable");
  return response.json();
}
async function loadData() {
  const current = ++request,
    selectedLab = lab;
  loadState = "loading";
  records = [];
  manifest = null;
  $("standings-body").replaceChildren();
  $("data-state").hidden = false;
  $("data-state").textContent = "Loading standings…";
  $("standings-table-wrap").hidden = true;
  $("comparison").hidden = true;
  $("data-provenance").textContent = "Loading evaluation data";
  $("entry-count").textContent = "—";
  $("episode-count").textContent = "—";
  $("seed-value").textContent = "—";
  $("environment-name").textContent = configs[lab].env;
  const controller = new AbortController(),
    timer = setTimeout(() => controller.abort(), 12000);
  try {
    const [data, meta] = await Promise.all([
      fetchJSON(`data/leaderboard_p${selectedLab}.json`, controller.signal),
      fetchJSON("data/manifest.json", controller.signal).catch(() => null),
    ]);
    if (current !== request) return;
    if (!Array.isArray(data) || data.length > 5000 || !data.every(validResult))
      throw new Error("Invalid results");
    loadState = "ready";
    records = data.sort(
      (a, b) =>
        Number(b.success) - Number(a.success) ||
        (a.success ? b.mean_reward - a.mean_reward : 0) ||
        a.participant.localeCompare(b.participant),
    );
    if (
      meta?.schema_version === 1 &&
      typeof meta.source_sha === "string" &&
      /^[a-f0-9]{40}$/.test(meta.source_sha) &&
      typeof meta.generated_at === "string"
    )
      manifest = meta;
    selected = new Set(
      [...selected].filter((name) =>
        records.some((row) => row.participant === name && row.success),
      ),
    );
    arena.setRankedPolicies(selectedLab, records);
    render();
  } catch (error) {
    if (current !== request) return;
    loadState = "error";
    records = [];
    arena.setRankedPolicies(selectedLab, []);
    $("data-state").textContent =
      "Standings are unavailable right now. Try refreshing, or check the latest tournament run on GitHub.";
    $("data-provenance").textContent = "Evaluation data unavailable";
    $("standings-table-wrap").hidden = true;
  } finally {
    clearTimeout(timer);
  }
}
function text(tag, value, className) {
  const el = document.createElement(tag);
  el.textContent = value;
  if (className) el.className = className;
  return el;
}
function number(value, decimals = 1) {
  return typeof value === "number" && Number.isFinite(value)
    ? value.toLocaleString("en", {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      })
    : "—";
}
function render() {
  if (loadState !== "ready") return;
  const query = $("search").value.trim().toLowerCase(),
    filtered = records.filter((r) =>
      r.participant.toLowerCase().includes(query),
    );
  const successful = records.filter((r) => r.success),
    first = successful[0];
  $("entry-count").textContent = String(successful.length).padStart(2, "0");
  $("episode-count").textContent = first
    ? String(first.num_episodes ?? manifest?.episodes ?? "—")
    : "—";
  $("seed-value").textContent = first
    ? String(first.base_seed ?? manifest?.base_seed ?? "—")
    : "—";
  $("environment-name").textContent = first?.env_id ?? configs[lab].env;
  const date = manifest?.generated_at || first?.timestamp;
  const dateLabel =
    typeof date === "string"
      ? date.replace("T", " ").replace("Z", " UTC").slice(0, 16)
      : "date unavailable";
  $("data-provenance").textContent = manifest
    ? `Official run · ${dateLabel} UTC · ${manifest.source_sha.slice(0, 7)}`
    : `Historical snapshot · ${dateLabel}${date ? " UTC" : ""}`;
  document
    .querySelector(".status-dot")
    .classList.toggle("official", Boolean(manifest));
  $("standings-body").replaceChildren();
  for (const row of filtered) {
    const rank = successful.indexOf(row) + 1,
      top = rank === 1,
      tr = document.createElement("tr");
    tr.append(
      text(
        "td",
        row.success ? String(rank).padStart(2, "0") : "—",
        `rank${top ? " top" : ""}`,
      ),
    );
    const agentCell = document.createElement("td"),
      agent = text("div", "", "agent-cell"),
      avatar = text(
        "span",
        row.participant
          .split(/[_-]/)
          .map((x) => x[0] || "")
          .join("")
          .slice(0, 2)
          .toUpperCase(),
        `agent-avatar${top ? " top" : ""}`,
      ),
      info = document.createElement("div");
    info.append(
      text("span", row.participant, "agent-name"),
      text(
        "span",
        !row.success
          ? "Evaluation failed"
          : row.participant.startsWith("baseline_")
            ? "Reference baseline"
            : row.mean_reward >= (lab === 2 ? 7 : 200)
              ? "Mastery benchmark"
              : row.mean_reward >= (lab === 2 ? 4.5 : 100)
                ? "Passing benchmark"
                : "Participant",
        "agent-tag",
      ),
    );
    agent.append(avatar, info);
    agentCell.append(agent);
    tr.append(agentCell);
    tr.append(
      text(
        "td",
        row.success ? number(row.mean_reward, 2) : "—",
        "numeric score",
      ),
    );
    tr.append(
      text(
        "td",
        row.success ? `± ${number(row.std_reward, 2)}` : "—",
        "numeric number",
      ),
    );
    const successCell = text("td", "", "numeric"),
      success = text("div", "", "success-cell");
    success.append(
      text(
        "span",
        row.success ? `${number(row.success_rate)}%` : "—",
        "number",
      ),
    );
    if (row.success) {
      const track = text("span", "", "success-track"),
        fill = document.createElement("span");
      fill.style.width = `${row.success_rate}%`;
      track.append(fill);
      success.append(track);
    }
    successCell.append(success);
    tr.append(successCell);
    tr.append(
      text("td", row.success ? number(row.avg_steps) : "—", "numeric number"),
    );
    const action = document.createElement("td"),
      button = text(
        "button",
        selected.has(row.participant) ? "✓" : "+",
        "compare-button",
      );
    button.type = "button";
    button.setAttribute("aria-label", `Compare ${row.participant}`);
    button.setAttribute("aria-pressed", String(selected.has(row.participant)));
    button.disabled =
      !row.success || (selected.size >= 2 && !selected.has(row.participant));
    button.addEventListener("click", () => {
      if (selected.has(row.participant)) selected.delete(row.participant);
      else selected.add(row.participant);
      render();
    });
    action.append(button);
    if (row.success) {
      const duel = text("button", "Duel ↗", "quiet-button");
      duel.type = "button";
      duel.setAttribute("aria-label", `Duel ${row.participant}`);
      duel.addEventListener("click", () => launchDuel([row.participant]));
      action.append(duel);
    }
    tr.append(action);
    $("standings-body").append(tr);
  }
  $("standings-table-wrap").hidden = filtered.length === 0;
  $("data-state").hidden = filtered.length !== 0;
  $("data-state").textContent = records.length
    ? "No agents match your search."
    : "No evaluated agents yet. Be the first to submit a policy.";
  renderComparison();
}
function launchDuel(names) {
  arena.selectRanked(names);
  location.hash = `arena?lab=${lab}`;
}
$("duel-selected").addEventListener("click", () => launchDuel([...selected]));
function renderComparison() {
  $("comparison").hidden = selected.size === 0;
  $("comparison-cards").replaceChildren();
  for (const name of selected) {
    const row = records.find((r) => r.participant === name);
    if (!row) continue;
    const card = text("article", "", "comparison-card");
    card.append(text("h3", row.participant));
    const dl = document.createElement("dl");
    for (const [label, value] of [
      ["Mean reward", number(row.mean_reward, 2)],
      ["Standard deviation", number(row.std_reward, 2)],
      ["Success criterion met", `${number(row.success_rate)}%`],
      ["Average steps", number(row.avg_steps)],
    ]) {
      dl.append(text("dt", label), text("dd", value));
    }
    card.append(dl);
    $("comparison-cards").append(card);
  }
}
document.querySelectorAll("[data-lab]").forEach((button) =>
  button.addEventListener("click", () => {
    location.hash = `${view}?lab=${button.dataset.lab}`;
  }),
);
$("search").addEventListener("input", render);
$("reload-data").addEventListener("click", loadData);
$("clear-comparison").addEventListener("click", () => {
  selected.clear();
  render();
});
window.addEventListener("hashchange", () => {
  route();
  window.scrollTo(0, 0);
});
route();
loadData();
