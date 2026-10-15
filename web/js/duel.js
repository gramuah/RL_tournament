import { Simulation } from "./simulation.js";
import { spritesReady } from "./renderers.js";

const keyActions = {
  ArrowUp: "up",
  w: "up",
  ArrowDown: "down",
  s: "down",
  ArrowLeft: "left",
  a: "left",
  ArrowRight: "right",
  d: "right",
  p: "pickup",
  o: "dropoff",
  Enter: "dropoff",
  " ": "space",
};
const labels = {
  manual: "You",
  heuristic: "Built-in heuristic",
  random: "Built-in random",
};
async function api(path, data) {
  const response = await fetch(`api/${path}`, {
    method: data ? "POST" : "GET",
    headers: data ? { "Content-Type": "application/json" } : {},
    body: data ? JSON.stringify(data) : undefined,
    signal: AbortSignal.timeout(90000),
  });
  const result = await response.json();
  if (!response.ok)
    throw new Error(result.error || "Gymnasium connection failed");
  return result;
}
// Only probe a local server; GitHub Pages needs no API or network dependencies.
const runtime = ["localhost", "127.0.0.1"].includes(location.hostname)
  ? api("config")
      .then((config) => (config.gymnasium ? config : null))
      .catch(() => null)
  : Promise.resolve(null);

export class LiveDuel {
  constructor() {
    this.root = document.getElementById("arena");
    this.get = (suffix) => document.getElementById(`duel-${suffix}`);
    this.canvases = [this.get("a-canvas"), this.get("b-canvas")];
    this.selects = [this.get("a-policy"), this.get("b-policy")];
    this.lab = 2;
    this.rankings = new Map();
    this.keys = new Set();
    this.pendingActions = [];
    this.active = false;
    this.running = false;
    this.generation = 0;
    this.states = [];
    this.get("toggle").addEventListener("click", () => {
      if (this.states.every((s) => s.done)) {
        this.reset();
        return;
      }
      this.running = !this.running;
      this.last = performance.now();
      this.update();
    });
    this.get("reset").addEventListener("click", () => this.reset());
    this.get("new").addEventListener("click", () => {
      this.get("seed").value = String(
        (Number(this.get("seed").value) + 1) % 1000001,
      );
      this.reset();
    });
    for (const select of this.selects)
      select.addEventListener("change", () => {
        // A single set of human controls can control either side, never both.
        if (select.value === "manual")
          this.selects
            .filter((s) => s !== select && s.value === "manual")
            .forEach((s) => (s.value = "heuristic"));
        this.useRequiredRuntime();
        this.reset();
      });
    this.get("seed").addEventListener("change", () => this.reset());
    this.get("engine").addEventListener("change", () => {
      this.populatePolicies();
      this.reset();
    });
    this.root.addEventListener("keydown", (event) => {
      if (event.target.matches("input, select, a, button")) return;
      if (event.key.toLowerCase() === "r") {
        event.preventDefault();
        this.reset();
        return;
      }
      const action =
        keyActions[event.key] || keyActions[event.key.toLowerCase()];
      if (!action) return;
      event.preventDefault();
      this.keys.add(action === "space" ? "up" : action);
      if (this.lab === 2 && !event.repeat)
        this.action(action === "space" ? "pickup" : action);
    });
    this.root.addEventListener("keyup", (event) => {
      const action =
        keyActions[event.key] || keyActions[event.key.toLowerCase()];
      if (action) this.keys.delete(action === "space" ? "up" : action);
    });
    this.root.addEventListener("focusout", (event) => {
      if (!this.root.contains(event.relatedTarget)) this.keys.clear();
    });
    window.addEventListener("blur", () => this.pause());
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) this.pause();
    });
    this.root.querySelectorAll("[data-action]").forEach((button) => {
      button.addEventListener("pointerdown", (event) => {
        this.keys.add(button.dataset.action);
        button.setPointerCapture(event.pointerId);
      });
      for (const name of ["pointerup", "pointercancel", "lostpointercapture"])
        button.addEventListener(name, () =>
          this.keys.delete(button.dataset.action),
        );
      button.addEventListener("click", () => {
        if (this.lab === 2) this.action(button.dataset.action);
      });
      // Keyboard activation also supports holding the LunarLander controls.
      button.addEventListener("keydown", (event) => {
        if ([" ", "Enter"].includes(event.key))
          this.keys.add(button.dataset.action);
      });
      button.addEventListener("keyup", () =>
        this.keys.delete(button.dataset.action),
      );
    });
    this.reset();
    spritesReady.then(() => this.draw());
    runtime.then((config) => {
      if (!config) return;
      this.config = config;
      this.get("engine").append(
        new Option(`Gymnasium ${config.gymnasium} / original renderer`, "gym"),
      );
      // Use real Gymnasium by default when served by the local Python runtime.
      this.get("engine").value = "gym";
      this.populatePolicies();
      this.reset();
    });
    window.addEventListener("pagehide", () => {
      if (this.session)
        fetch("api/close", {
          method: "POST",
          keepalive: true,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: this.session }),
        });
    });
  }
  setRankedPolicies(lab, records) {
    this.rankings.set(
      lab,
      records.filter((row) => row.success).map((row) => row.participant),
    );
    if (lab !== this.lab) return;
    const previous = this.selects.map((select) => select.value);
    this.populatePolicies();
    if (previous.some((value, index) => value !== this.selects[index].value))
      this.reset();
  }
  selectRanked(names) {
    this.populatePolicies();
    const values =
      names.length === 1
        ? ["manual", `agent:${names[0]}`]
        : names.map((name) => `agent:${name}`);
    this.selects.forEach((select, index) => (select.value = values[index]));
    this.useRequiredRuntime();
    this.reset();
  }
  useRequiredRuntime() {
    if (
      this.config &&
      this.selects.some((select) => select.value.startsWith("agent:"))
    )
      this.get("engine").value = "gym";
  }
  populatePolicies() {
    const ranked = this.rankings.get(this.lab) || [];
    const available = this.config?.agents[String(this.lab)] || [];
    for (const select of this.selects) {
      const previous = select.value;
      select.querySelectorAll("optgroup").forEach((group) => group.remove());
      const group = document.createElement("optgroup");
      group.label = "Policies in the ranking";
      for (const name of ranked)
        group.append(new Option(name, `agent:${name}`));
      if (group.children.length) select.append(group);
      const local = document.createElement("optgroup");
      local.label = "Other saved policies";
      for (const agent of available) {
        if (!ranked.some((name) => `agent:${name}` === agent.value))
          local.append(new Option(agent.label, agent.value));
      }
      if (local.children.length) select.append(local);
      select.value = [...select.options].some(
        (option) => option.value === previous,
      )
        ? previous
        : "heuristic";
    }
  }
  setView(active, lab) {
    const changed = this.lab !== lab;
    cancelAnimationFrame(this.frame);
    this.active = active;
    this.lab = lab;
    this.pause();
    this.root.querySelector('[data-controls="taxi"]').hidden = lab !== 2;
    this.root.querySelector('[data-controls="lander"]').hidden = lab !== 1;
    if (changed) {
      this.populatePolicies();
      this.reset();
    } else this.update();
    if (!active)
      this.root.querySelectorAll("video").forEach((video) => video.pause());
    if (active) {
      this.draw();
      this.frame = requestAnimationFrame((time) => this.tick(time));
    }
  }
  pause() {
    this.running = false;
    this.keys.clear();
    this.pendingActions = [];
    this.update();
  }
  async reset() {
    const generation = ++this.generation;
    this.pause();
    this.error = null;
    this.loading = true;
    this.busy = false;
    const seed = Number(this.get("seed").value);
    if (
      !Number.isInteger(seed) ||
      seed < 0 ||
      seed > 1000000 ||
      this.get("seed").value === ""
    ) {
      this.error = "Enter a whole-number seed between 0 and 1,000,000.";
      this.loading = false;
      this.update();
      return;
    }
    const old = this.session;
    this.session = null;
    this.images = null;
    this.simulations = [];
    this.states = [];
    this.update();
    try {
      if (old) await api("close", { id: old }).catch(() => {});
      if (generation !== this.generation) return;
      const agents = this.selects
        .map((select) => select.value)
        .filter((value) => value.startsWith("agent:"));
      if (agents.length) {
        if (this.get("engine").value !== "gym") {
          this.get("policy-help").hidden = false;
          this.get("runtime-help").open = true;
          throw new Error(
            "To run ranked policies, open this site with the Gymnasium server and isolated agents enabled.",
          );
        }
        const available = this.config?.agents[String(this.lab)] || [];
        if (
          agents.some(
            (value) => !available.some((agent) => agent.value === value),
          )
        ) {
          this.get("policy-help").hidden = false;
          this.get("runtime-help").open = true;
          throw new Error(
            "Selected policy is not available in this server. Update your checkout and enable isolated agents.",
          );
        }
      }
      this.get("policy-help").hidden = true;
      if (this.get("engine").value === "gym") {
        const response = await api("session", {
          lab: this.lab,
          seed,
          policies: this.selects.map((s) => s.value),
        });
        if (generation !== this.generation) {
          await api("close", { id: response.id });
          return;
        }
        this.session = response.id;
        await this.receive(response, generation);
      } else {
        this.simulations = this.selects.map(
          (select) => new Simulation(this.lab, select.value, seed),
        );
        this.states = this.simulations.map((simulation) => simulation.state);
      }
    } catch (error) {
      if (generation === this.generation) this.error = error.message;
    } finally {
      if (generation === this.generation) {
        this.loading = false;
        this.update();
        this.draw();
      }
    }
  }
  async receive(response, generation) {
    const images = await Promise.all(
      response.states.map(async (state) => {
        const img = new Image();
        img.src = state.frame;
        await img.decode();
        return img;
      }),
    );
    if (generation !== this.generation) return;
    this.states = response.states;
    this.images = images;
  }
  action(action) {
    if (
      !this.active ||
      this.loading ||
      this.error ||
      this.lab !== 2 ||
      !this.selects.some((s) => s.value === "manual")
    )
      return;
    const i = this.selects.findIndex((s) => s.value === "manual");
    if (this.states[i]?.done) return;
    this.running = true;
    if (this.session)
      this.pendingActions.length < 32 && this.pendingActions.push(action);
    else {
      this.simulations[i].step(new Set(), action);
      this.update();
      this.draw();
    }
  }
  async step(repeat = 1) {
    if (this.busy || this.loading || this.error) return;
    if (!this.session) {
      for (let i = 0; i < repeat; i++) {
        this.simulations.forEach((s) => {
          if (s.lab === 1 || s.policy !== "manual") s.step(this.keys);
        });
      }
      this.finishStep();
      return;
    }
    this.busy = true;
    const generation = this.generation;
    const action =
      this.lab === 2
        ? ({ down: 0, up: 1, right: 2, left: 3, pickup: 4, dropoff: 5 }[
            this.pendingActions.shift()
          ] ?? null)
        : this.keys.has("up")
          ? 2
          : this.keys.has("left")
            ? 1
            : this.keys.has("right")
              ? 3
              : 0;
    try {
      const response = await api("step", {
        id: this.session,
        repeat,
        actions: this.selects.map((select) =>
          select.value === "manual" ? action : null,
        ),
      });
      await this.receive(response, generation);
      if (generation === this.generation) this.finishStep();
    } catch (error) {
      if (generation === this.generation) {
        this.error = error.message;
        this.pause();
      }
    } finally {
      if (generation === this.generation) {
        this.busy = false;
        this.update();
      }
    }
  }
  finishStep() {
    if (this.states.every((s) => s.done)) this.running = false;
    this.update();
    this.draw();
  }
  tick(time) {
    if (!this.active) return;
    const interval =
      (this.lab === 2 ? 260 : 1000 / 50) / Number(this.get("speed").value);
    if (this.running && !this.busy && time - (this.last || 0) >= interval) {
      const elapsed = time - (this.last || time - interval);
      const repeat =
        this.lab === 1 ? Math.min(8, Math.floor(elapsed / interval)) : 1;
      this.last = time - (elapsed % interval);
      this.step(repeat);
    }
    this.frame = requestAnimationFrame((t) => this.tick(t));
  }
  update() {
    const gym = this.get("engine").value === "gym";
    this.get("title").textContent =
      `${this.lab === 2 ? "Taxi" : "LunarLander"} / ${gym ? "Gymnasium" : "browser practice"}`;
    this.get("notice").textContent = gym
      ? "Original Gymnasium environment and rendered frames. Both players reset with the same seed. Saved agents, when enabled, run in Docker. Practice results do not update the leaderboard."
      : "Live browser practice with the original Taxi sprites and LunarLander-style visuals. Policies are built-in demonstrations; physics and scores are illustrative. Use local Gymnasium mode for original physics, rendering and saved agents.";
    this.get("toggle").disabled =
      this.loading || Boolean(this.error) || this.states.length === 0;
    this.get("toggle").textContent = this.loading
      ? "Loading environment…"
      : this.states.length && this.states.every((s) => s.done)
        ? "Try again ↻"
        : this.running
          ? "Pause Ⅱ"
          : "Start duel →";
    this.get("status").textContent =
      this.error || (this.loading ? "LOADING" : this.result());
    if (!this.states.length) {
      for (const side of ["a", "b"]) {
        this.get(`${side}-score`).textContent = "—";
        this.get(`${side}-steps`).textContent = "—";
        this.get(`${side}-telemetry`).textContent = this.loading
          ? "Loading selected policy"
          : "No episode started";
      }
    }
    this.states.forEach((state, i) => {
      const stem = i === 0 ? "a-" : "b-";
      this.get(`${stem}score`).textContent = String(
        Number(state.score.toFixed(1)),
      );
      this.get(`${stem}steps`).textContent = String(state.steps);
      this.get(`${stem}telemetry`).textContent =
        `${state.env_id || "Browser model"} · ${state.message}`;
    });
    const manual = this.selects.findIndex((s) => s.value === "manual");
    this.get("human").textContent =
      manual < 0
        ? "Watching two policies"
        : `You control player ${manual === 0 ? "A" : "B"}`;
    this.root
      .querySelectorAll("[data-action]")
      .forEach(
        (button) =>
          (button.disabled = manual < 0 || this.loading || Boolean(this.error)),
      );
  }
  result() {
    if (!this.states.length) return "READY";
    if (!this.states.every((s) => s.done))
      return this.running
        ? "DUEL IN PROGRESS"
        : this.states.some((s) => s.steps)
          ? "PAUSED"
          : "READY";
    const [a, b] = this.states;
    const diff = a.score - b.score || b.steps - a.steps;
    if (!diff) return "DRAW";
    const winner = diff > 0 ? 0 : 1;
    const name =
      labels[this.selects[winner].value] ||
      this.selects[winner].selectedOptions[0].textContent;
    return `Player ${winner === 0 ? "A" : "B"} wins · ${name}`;
  }
  draw() {
    if (!this.states.length) {
      for (const canvas of this.canvases) {
        const ctx = canvas.getContext("2d");
        ctx.fillStyle = "#000";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
      return;
    }
    if (this.images)
      this.images.forEach((img, i) => {
        const canvas = this.canvases[i];
        if (canvas.width !== img.width) canvas.width = img.width;
        if (canvas.height !== img.height) canvas.height = img.height;
        const ctx = canvas.getContext("2d");
        ctx.fillStyle = "#000";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        const scale = Math.min(
          canvas.width / img.width,
          canvas.height / img.height,
        );
        ctx.drawImage(
          img,
          (canvas.width - img.width * scale) / 2,
          (canvas.height - img.height * scale) / 2,
          img.width * scale,
          img.height * scale,
        );
      });
    else
      this.simulations?.forEach((simulation, i) =>
        simulation.draw(this.canvases[i]),
      );
  }
}
