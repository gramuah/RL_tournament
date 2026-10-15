import {
  drawGymnasiumLander,
  drawGymnasiumTerrain,
  renderSingleTaxiGrid,
} from "./renderers.js";
// Browser practice model. Real Gymnasium mode uses the Python environment and renderer.
const stations = [
  [0, 0],
  [0, 4],
  [4, 0],
  [4, 3],
];
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
export class Simulation {
  constructor(lab, policy, seed = 42) {
    this.lab = lab;
    this.policy = policy;
    this.seed = seed;
    this.state =
      lab === 2
        ? {
            row: Math.floor(this.random() * 5),
            col: Math.floor(this.random() * 5),
            passenger: Math.floor(this.random() * 4),
            destination: 0,
            onboard: false,
            orientation: "down",
          }
        : {
            x: 260 + this.random() * 240,
            y: 75,
            vx: (this.random() - 0.5) * 1.2,
            vy: 0,
            angle: 0,
          };
    if (lab === 2)
      this.state.destination =
        (this.state.passenger + 1 + Math.floor(this.random() * 3)) % 4;
    Object.assign(this.state, {
      score: 0,
      steps: 0,
      done: false,
      message: "READY",
    });
  }
  step(keys = new Set(), manualAction = null) {
    if (this.state.done) return;
    if (this.lab === 1) this.landerStep(keys);
    else {
      const action =
        this.policy === "manual"
          ? manualAction
          : this.policy === "heuristic"
            ? this.taxiHeuristic()
            : ["up", "down", "left", "right", "pickup", "dropoff"][
                Math.floor(this.random() * 6)
              ];
      if (action) this.taxiStep(action);
    }
  }
  random() {
    this.seed = (Math.imul(1664525, this.seed) + 1013904223) >>> 0;
    return this.seed / 4294967296;
  }
  taxiStep(action) {
    const s = this.state;
    if (s.done) return;
    if (!["up", "down", "left", "right", "pickup", "dropoff"].includes(action))
      return;
    s.steps++;
    const moves = { up: [-1, 0], down: [1, 0], left: [0, -1], right: [0, 1] };
    if (moves[action]) {
      s.orientation = action;
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
      } else if (
        s.onboard &&
        stations.some(([r, c]) => r === s.row && c === s.col)
      ) {
        s.passenger = stations.findIndex(
          ([r, c]) => r === s.row && c === s.col,
        );
        s.onboard = false;
        s.score--;
        s.message = "PASSENGER AT STATION";
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
  landerStep(keys) {
    const s = this.state;
    let thrust = keys.has("up"),
      left = keys.has("left"),
      right = keys.has("right");
    if (this.policy === "heuristic") {
      const target = Math.max(
        -0.25,
        Math.min(0.25, (380 - s.x) * 0.006 - s.vx * 0.18),
      );
      left = s.angle > target + 0.02;
      right = s.angle < target - 0.02;
      thrust = s.vy > (s.y > 300 ? 0.45 : 1.4);
    } else if (this.policy === "random") {
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
    s.leftThrust = left;
    s.rightThrust = right;
    s.message = "IN FLIGHT";
    if (s.x < 20 || s.x > 740 || s.y < 0 || s.steps >= 1000) {
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
  draw(canvas) {
    const width = this.lab === 2 ? 500 : 760,
      height = this.lab === 2 ? 500 : 480;
    if (canvas.width !== width) canvas.width = width;
    if (canvas.height !== height) canvas.height = height;
    const c = canvas.getContext("2d"),
      s = this.state;
    c.fillStyle = this.lab === 1 ? "#000" : "#0a0d18";
    c.fillRect(0, 0, canvas.width, canvas.height);
    if (this.lab === 2) {
      renderSingleTaxiGrid(
        c,
        {
          ...s,
          passengerIdx: s.passenger,
          destinationIdx: s.destination,
          passengerInTaxi: s.onboard,
          delivered: s.message === "DESTINATION REACHED",
        },
        40,
        40,
        420,
        "Taxi",
      );
    } else {
      drawGymnasiumTerrain(c, 0, 760, 380, 410, 120);
      // Extend the original 450px ground to this canvas's height.
      c.fillStyle = "#fff";
      c.fillRect(0, 450, 760, 30);
      drawGymnasiumLander(
        c,
        s.x,
        s.y,
        s.angle,
        s.thrust,
        s.leftThrust,
        s.rightThrust,
        s.message === "SOFT LANDING",
        s.done && s.message !== "SOFT LANDING",
      );
      if (!s.done) {
        c.save();
        c.translate(s.x, s.y);
        c.rotate(s.angle);
        c.fillStyle = "#ff8b32";
        for (const [on, x, y, dx, dy] of [
          [s.thrust, 0, 12, 0, 25],
          [s.leftThrust, 17, 0, 18, 4],
          [s.rightThrust, -17, 0, -18, 4],
        ]) {
          if (!on) continue;
          c.beginPath();
          c.moveTo(x - 4, y);
          c.lineTo(x + dx, y + dy);
          c.lineTo(x + 4, y + 4);
          c.fill();
        }
        c.restore();
      }
    }
  }
}
