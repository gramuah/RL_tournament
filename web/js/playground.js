// An intentionally simplified teaching aid. Official evaluation runs in Gymnasium.
const stations = [
    [0, 0],
    [0, 4],
    [4, 0],
    [4, 3],
  ],
  ink = "#272c28",
  paper = "#f5f3ec",
  orange = "#d74b2c";
function blocked(row, col, nextRow, nextCol) {
  return (
    nextRow < 0 ||
    nextRow > 4 ||
    nextCol < 0 ||
    nextCol > 4 ||
    (row === nextRow &&
      ((Math.min(col, nextCol) === 1 && row < 2) ||
        ([0, 2].includes(Math.min(col, nextCol)) && row > 2)))
  );
}
export class Playground {
  constructor() {
    this.canvas = document.getElementById("demo-canvas");
    this.ctx = this.canvas.getContext("2d");
    this.lab = 2;
    this.active = false;
    this.running = false;
    this.last = 0;
    this.frame = 0;
    this.keys = new Set();
    this.policy = document.getElementById("demo-policy");
    this.toggle = document.getElementById("demo-toggle");
    this.toggle.addEventListener("click", () => {
      if (this.state.done) this.reset();
      this.running = !this.running;
      this.update();
    });
    document
      .getElementById("demo-reset")
      .addEventListener("click", () => this.reset());
    this.policy.addEventListener("change", () => this.reset());
    this.canvas.addEventListener("keydown", (event) => {
      const key = {
        ArrowUp: "up",
        ArrowDown: "down",
        ArrowLeft: "left",
        ArrowRight: "right",
        p: "pickup",
        P: "pickup",
        o: "dropoff",
        O: "dropoff",
      }[event.key];
      if (!key) return;
      event.preventDefault();
      this.keys.add(key);
      if (this.lab === 2 && !event.repeat) this.action(key);
    });
    this.canvas.addEventListener("keyup", (event) => {
      const key = {
        ArrowUp: "up",
        ArrowDown: "down",
        ArrowLeft: "left",
        ArrowRight: "right",
      }[event.key];
      if (key) {
        event.preventDefault();
        this.keys.delete(key);
      }
    });
    this.canvas.addEventListener("blur", () => this.keys.clear());
    window.addEventListener("blur", () => this.pause());
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) this.pause();
    });
    document.querySelectorAll("[data-action]").forEach((button) => {
      button.addEventListener("pointerdown", (event) => {
        if (this.policy.value !== "manual") return;
        this.keys.add(button.dataset.action);
        button.setPointerCapture(event.pointerId);
      });
      for (const event of ["pointerup", "pointercancel", "lostpointercapture"])
        button.addEventListener(event, () =>
          this.keys.delete(button.dataset.action),
        );
      button.addEventListener("click", () => {
        if (this.lab === 2) this.action(button.dataset.action);
      });
    });
    this.reset();
  }
  setView(active, lab) {
    const changed = this.lab !== lab;
    cancelAnimationFrame(this.frame);
    this.active = active;
    this.lab = lab;
    this.pause();
    if (changed) this.reset();
    document.getElementById("taxi-controls").hidden = lab !== 2;
    document.getElementById("lander-controls").hidden = lab !== 1;
    document.getElementById("demo-title").textContent =
      `${lab === 2 ? "Taxi" : "LunarLander"} / illustrative environment`;
    if (active) {
      this.draw();
      this.frame = requestAnimationFrame((time) => this.tick(time));
    }
  }
  pause() {
    this.running = false;
    this.keys.clear();
    this.update();
  }
  reset() {
    this.running = false;
    this.keys.clear();
    this.seed = 42;
    this.state =
      this.lab === 2
        ? {
            row: 4,
            col: 2,
            passenger: 0,
            destination: 1,
            onboard: false,
            score: 0,
            steps: 0,
            done: false,
            message: "READY",
          }
        : {
            x: 290,
            y: 75,
            vx: 0.6,
            vy: 0,
            angle: 0,
            score: 0,
            steps: 0,
            done: false,
            message: "READY",
          };
    this.update();
    this.draw();
  }
  random() {
    this.seed = (Math.imul(1664525, this.seed) + 1013904223) >>> 0;
    return this.seed / 4294967296;
  }
  action(action) {
    if (this.policy.value !== "manual" || this.lab !== 2 || this.state.done)
      return;
    this.running = true;
    this.taxiStep(action);
    this.update();
    this.draw();
  }
  taxiStep(action) {
    const s = this.state;
    if (s.done) return;
    s.steps++;
    const moves = { up: [-1, 0], down: [1, 0], left: [0, -1], right: [0, 1] };
    if (moves[action]) {
      const [dr, dc] = moves[action];
      if (!blocked(s.row, s.col, s.row + dr, s.col + dc)) {
        s.row += dr;
        s.col += dc;
      }
      s.score--;
      s.message = s.onboard ? "TO DESTINATION" : "FIND THE PASSENGER";
    } else if (action === "pickup") {
      if (
        !s.onboard &&
        s.row === stations[s.passenger][0] &&
        s.col === stations[s.passenger][1]
      ) {
        s.onboard = true;
        s.score--;
        s.message = "PASSENGER ON BOARD";
      } else {
        s.score -= 10;
        s.message = "NO PASSENGER HERE";
      }
    } else if (action === "dropoff") {
      if (
        s.onboard &&
        s.row === stations[s.destination][0] &&
        s.col === stations[s.destination][1]
      ) {
        s.score += 20;
        s.done = true;
        s.message = "DESTINATION REACHED";
      } else {
        s.score -= 10;
        s.message = "NOT THE DESTINATION";
      }
    }
    if (s.steps >= 200 && !s.done) {
      s.done = true;
      s.message = "STEP LIMIT REACHED";
    }
    if (s.done) this.running = false;
  }
  taxiHeuristic() {
    const s = this.state,
      [tr, tc] = stations[s.onboard ? s.destination : s.passenger];
    if (s.row === tr && s.col === tc) return s.onboard ? "dropoff" : "pickup";
    const queue = [[s.row, s.col, null]],
      seen = new Set([`${s.row},${s.col}`]);
    for (let i = 0; i < queue.length; i++) {
      const [r, c, first] = queue[i];
      for (const [action, dr, dc] of [
        ["up", -1, 0],
        ["down", 1, 0],
        ["left", 0, -1],
        ["right", 0, 1],
      ]) {
        const nr = r + dr,
          nc = c + dc,
          key = `${nr},${nc}`;
        if (blocked(r, c, nr, nc) || seen.has(key)) continue;
        if (nr === tr && nc === tc) return first || action;
        seen.add(key);
        queue.push([nr, nc, first || action]);
      }
    }
    return "down";
  }
  landerStep() {
    const s = this.state;
    let thrust = this.keys.has("up"),
      left = this.keys.has("left"),
      right = this.keys.has("right");
    if (this.policy.value === "heuristic") {
      const target = Math.max(
        -0.25,
        Math.min(0.25, (380 - s.x) * 0.006 - s.vx * 0.18),
      );
      left = s.angle > target + 0.02;
      right = s.angle < target - 0.02;
      thrust = s.vy > (s.y > 300 ? 0.45 : 1.4);
    } else if (this.policy.value === "random") {
      thrust = this.random() > 0.48;
      left = this.random() < 0.14;
      right = this.random() < 0.14;
    }
    if (left) s.angle -= 0.025;
    if (right) s.angle += 0.025;
    s.angle = Math.max(-1, Math.min(1, s.angle));
    s.vy += 0.045;
    if (thrust) {
      s.vx += Math.sin(s.angle) * 0.075;
      s.vy -= Math.cos(s.angle) * 0.075;
      s.score -= 0.03;
    }
    s.vx *= 0.998;
    s.x += s.vx;
    s.y += s.vy;
    s.steps++;
    s.thrust = thrust;
    s.message = "IN FLIGHT";
    if (s.x < 20 || s.x > 740 || s.y < 0 || s.steps >= 1800) {
      s.done = true;
      s.message = "OUT OF BOUNDS";
      s.score -= 100;
    }
    if (s.y >= 388) {
      s.y = 388;
      s.done = true;
      const landed =
        Math.abs(s.x - 380) < 60 &&
        Math.abs(s.vx) < 1 &&
        s.vy < 1.5 &&
        Math.abs(s.angle) < 0.25;
      s.message = landed ? "SOFT LANDING" : "HARD LANDING";
      s.score += landed ? 100 : -100;
    }
    if (s.done) this.running = false;
  }
  tick(time) {
    if (!this.active) return;
    const interval = this.lab === 2 ? 300 : 1000 / 60;
    if (this.running && !this.state.done && time - this.last >= interval) {
      this.last = time;
      if (this.lab === 1) this.landerStep();
      else if (this.policy.value !== "manual") {
        const action =
          this.policy.value === "heuristic"
            ? this.taxiHeuristic()
            : ["up", "down", "left", "right", "pickup", "dropoff"][
                Math.floor(this.random() * 6)
              ];
        this.taxiStep(action);
      }
      this.update();
      this.draw();
    }
    this.frame = requestAnimationFrame((t) => this.tick(t));
  }
  update() {
    if (!this.state) return;
    document.getElementById("demo-score").textContent = Number(
      this.state.score.toFixed(1),
    ).toString();
    document.getElementById("demo-steps").textContent = String(
      this.state.steps,
    );
    document.getElementById("demo-status").textContent = this.state.message;
    this.toggle.textContent = this.state.done
      ? "Try again ↻"
      : this.running
        ? "Pause demo Ⅱ"
        : "Start demo →";
    document
      .querySelectorAll("[data-action]")
      .forEach((button) => (button.disabled = this.policy.value !== "manual"));
  }
  draw() {
    if (!this.ctx || !this.state) return;
    const c = this.ctx;
    c.fillStyle = paper;
    c.fillRect(0, 0, 760, 480);
    if (this.lab === 2) this.drawTaxi(c);
    else this.drawLander(c);
  }
  drawTaxi(c) {
    const size = 68,
      x = 210,
      y = 55,
      s = this.state;
    c.strokeStyle = "#cfd2c1";
    c.lineWidth = 1;
    for (let i = 0; i <= 5; i++) {
      c.beginPath();
      c.moveTo(x + i * size, y);
      c.lineTo(x + i * size, y + 5 * size);
      c.moveTo(x, y + i * size);
      c.lineTo(x + 5 * size, y + i * size);
      c.stroke();
    }
    c.strokeStyle = ink;
    c.lineWidth = 6;
    for (const [col, start, end] of [
      [2, 0, 2],
      [1, 3, 5],
      [3, 3, 5],
    ]) {
      c.beginPath();
      c.moveTo(x + col * size, y + start * size);
      c.lineTo(x + col * size, y + end * size);
      c.stroke();
    }
    stations.forEach(([r, col], i) => {
      c.fillStyle =
        i === s.destination ? orange : i === s.passenger ? ink : "#d9dcce";
      c.beginPath();
      c.arc(
        x + col * size + size / 2,
        y + r * size + size / 2,
        18,
        0,
        Math.PI * 2,
      );
      c.fill();
      c.fillStyle =
        i === s.passenger || i === s.destination ? "#fffef9" : "#596052";
      c.font = "14px PlexMono, monospace";
      c.textAlign = "center";
      c.fillText(
        ["R", "G", "Y", "B"][i],
        x + col * size + size / 2,
        y + r * size + size / 2 + 5,
      );
    });
    const tx = x + s.col * size + size / 2,
      ty = y + s.row * size + size / 2;
    c.fillStyle = orange;
    c.strokeStyle = ink;
    c.lineWidth = 2;
    c.beginPath();
    c.roundRect(tx - 21, ty - 13, 42, 26, 5);
    c.fill();
    c.stroke();
    c.fillStyle = "#fff3d4";
    c.fillRect(tx - 10, ty - 9, 15, 18);
    c.fillStyle = ink;
    for (const dx of [-13, 12])
      for (const dy of [-17, 13]) c.fillRect(tx + dx, ty + dy, 9, 4);
    if (s.onboard) {
      c.fillStyle = ink;
      c.beginPath();
      c.arc(tx - 3, ty, 4, 0, Math.PI * 2);
      c.fill();
    }
    c.textAlign = "left";
    c.fillStyle = "#656b60";
    c.font = "11px PlexMono, monospace";
    c.fillText("PICKUP", 35, 80);
    c.fillStyle = ink;
    c.font = "25px Plex, sans-serif";
    c.fillText("R", 35, 112);
    c.fillStyle = "#656b60";
    c.font = "11px PlexMono, monospace";
    c.fillText("DESTINATION", 595, 80);
    c.fillStyle = orange;
    c.font = "25px Plex, sans-serif";
    c.fillText("G", 595, 112);
    c.fillStyle = "#656b60";
    c.font = "11px PlexMono, monospace";
    c.textAlign = "center";
    c.fillText("Fixed demo scenario / reset to try another policy", 380, 440);
  }
  drawLander(c) {
    const s = this.state;
    c.strokeStyle = "#e1e2d7";
    c.lineWidth = 1;
    for (let i = 40; i < 760; i += 60) {
      c.beginPath();
      c.moveTo(i, 0);
      c.lineTo(i, 480);
      c.stroke();
    }
    for (let i = 40; i < 480; i += 60) {
      c.beginPath();
      c.moveTo(0, i);
      c.lineTo(760, i);
      c.stroke();
    }
    c.fillStyle = "#dddccc";
    c.beginPath();
    c.moveTo(0, 420);
    c.lineTo(100, 375);
    c.lineTo(230, 410);
    c.lineTo(310, 407);
    c.lineTo(450, 407);
    c.lineTo(560, 365);
    c.lineTo(680, 403);
    c.lineTo(760, 380);
    c.lineTo(760, 480);
    c.lineTo(0, 480);
    c.fill();
    c.strokeStyle = orange;
    c.lineWidth = 5;
    c.beginPath();
    c.moveTo(320, 410);
    c.lineTo(440, 410);
    c.stroke();
    c.save();
    c.translate(s.x, s.y);
    c.rotate(s.angle);
    c.fillStyle = ink;
    c.beginPath();
    c.moveTo(-18, -15);
    c.lineTo(-8, -24);
    c.lineTo(8, -24);
    c.lineTo(18, -15);
    c.lineTo(18, 6);
    c.lineTo(8, 13);
    c.lineTo(-8, 13);
    c.lineTo(-18, 6);
    c.closePath();
    c.fill();
    c.strokeStyle = ink;
    c.lineWidth = 3;
    c.beginPath();
    c.moveTo(-18, 4);
    c.lineTo(-29, 20);
    c.lineTo(-35, 20);
    c.moveTo(18, 4);
    c.lineTo(29, 20);
    c.lineTo(35, 20);
    c.stroke();
    c.fillStyle = paper;
    c.fillRect(-10, -14, 20, 12);
    if (s.thrust && !s.done) {
      c.fillStyle = orange;
      c.beginPath();
      c.moveTo(-6, 14);
      c.lineTo(0, 34);
      c.lineTo(6, 14);
      c.fill();
    }
    c.restore();
    c.font = "11px PlexMono, monospace";
    c.fillStyle = "#656b60";
    c.textAlign = "left";
    c.fillText("SIMPLIFIED FLIGHT MODEL", 30, 32);
    c.fillText("LANDING ZONE", 465, 430);
  }
}
