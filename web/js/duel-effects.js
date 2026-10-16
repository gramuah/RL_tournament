// One outcome rule for both the status announcement and the visual celebration.
export function duelOutcome(states) {
  if (states.length !== 2 || !states.every((state) => state.done)) return null;
  const [a, b] = states;
  if (a.score !== b.score)
    return { winner: a.score > b.score ? 0 : 1, reason: "reward" };
  if (a.steps !== b.steps)
    return { winner: a.steps < b.steps ? 0 : 1, reason: "steps" };
  return { winner: null, reason: "draw" };
}

export class DuelEffects {
  constructor(canvases) {
    this.scenes = canvases.map((canvas) => {
      const scene = document.createElement("div");
      scene.className = "duel-scene";
      canvas.before(scene);
      scene.append(canvas);
      return scene;
    });
    this.countdowns = this.scenes.map((scene) =>
      this.layer(scene, "duel-countdown"),
    );
    this.results = this.scenes.map((scene) => this.layer(scene, "duel-result"));
    this.particles = this.scenes.map((scene) =>
      this.layer(scene, "duel-confetti"),
    );
  }
  layer(scene, className) {
    const element = document.createElement("div");
    element.className = className;
    element.setAttribute("aria-hidden", "true"); // #duel-status announces changes once.
    element.hidden = true;
    scene.append(element);
    return element;
  }
  countdown(number) {
    for (const layer of this.countdowns) {
      layer.hidden = !number;
      layer.textContent = number ? String(number) : "";
    }
  }
  clear() {
    this.countdown(null);
    for (const layer of [...this.results, ...this.particles]) {
      layer
        .getAnimations({ subtree: true })
        .forEach((animation) => animation.cancel());
      layer.replaceChildren();
      layer.hidden = true;
      delete layer.dataset.outcome;
    }
  }
  celebrate(outcome) {
    this.clear();
    for (let i = 0; i < 2; i++) {
      const draw = outcome.winner === null;
      if (!draw && outcome.winner !== i) continue;
      const result = this.results[i];
      result.dataset.outcome = draw ? "draw" : "winner";
      const title = document.createElement("strong");
      title.textContent = draw ? "Draw" : "Winner!";
      const detail = document.createElement("span");
      detail.textContent = draw
        ? "Same reward · same steps"
        : outcome.reason === "steps"
          ? "Equal reward · fewer steps"
          : "Highest reward";
      result.append(title, detail);
      result.hidden = false;
      if (!draw && !matchMedia("(prefers-reduced-motion: reduce)").matches)
        this.confetti(i);
    }
  }
  confetti(index) {
    const layer = this.particles[index];
    layer.hidden = false;
    const height = this.scenes[index].clientHeight;
    for (let i = 0; i < 48; i++) {
      const piece = document.createElement("i");
      piece.style.left = `${(i * 37) % 100}%`;
      piece.style.backgroundColor = [
        "#002c91",
        "#91b4ff",
        "#e4be54",
        "#ffffff",
      ][i % 4];
      layer.append(piece);
      const animation = piece.animate(
        [
          { transform: `translate(0, -20px) rotate(${i * 23}deg)`, opacity: 0 },
          { opacity: 1, offset: 0.1 },
          {
            transform: `translate(${((i % 7) - 3) * 22}px, ${height + 30}px) rotate(${i * 23 + 720}deg)`,
            opacity: 0,
          },
        ],
        {
          duration: 1800 + (i % 5) * 180,
          delay: (i % 9) * 45,
          easing: "cubic-bezier(.2,.5,.7,1)",
          fill: "both",
        },
      );
      animation.onfinish = () => piece.remove();
    }
  }
}
