import { Lander } from "./lander.js";
import { renderSingleTaxiGrid } from "./renderers.js";
// Browser environment: Taxi transitions and Box2D LunarLander observation/action semantics.
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
  constructor(lab, policy, seed = 42, inference = null) {
    this.lab = lab;
    this.policy = policy;
    this.seed = seed;
    this.inference = inference;
    if (lab === 1) {
      this.lander = new Lander(() => this.random());
      this.state = this.lander.state;
      return;
    }
    this.state = {
      row: Math.floor(this.random() * 5),
      col: Math.floor(this.random() * 5),
      passenger: Math.floor(this.random() * 4),
      destination: 0,
      onboard: false,
      orientation: "down",
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
          : this.inference
            ? ["down", "up", "right", "left", "pickup", "dropoff"][
                this.inference(this.observation(), () => this.random())
              ]
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
        s.passenger = s.destination;
        s.onboard = false;
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
  observation() {
    if (this.lander) return this.lander.observation();
    const s = this.state;
    return (
      ((s.row * 5 + s.col) * 5 + (s.onboard ? 4 : s.passenger)) * 4 +
      s.destination
    );
  }
  landerStep(keys) {
    const action = this.inference
      ? this.inference(this.observation(), () => this.random())
      : this.policy === "heuristic"
        ? this.lander.heuristic()
        : this.policy === "random"
          ? Math.floor(this.random() * 4)
          : keys.has("up")
            ? 2
            : keys.has("left")
              ? 1
              : keys.has("right")
                ? 3
                : 0;
    this.lander.step(action);
  }
  draw(canvas) {
    if (this.lander) {
      this.lander.draw(canvas);
      return;
    }
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
    }
  }
}
