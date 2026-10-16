// Gymnasium 1.2.1 LunarLander-v3 dynamics, ported to Planck (Box2D).
// Upstream: Farama-Foundation/Gymnasium, MIT license; see vendor/Gymnasium-LICENSE.txt.
// The seeded JS generator and Box2D port are not bit-identical to NumPy/pybox2d.
import {
  World,
  Vec2,
  Edge,
  Polygon,
  Box,
  RevoluteJoint,
} from "../vendor/planck.mjs";
const S = 30,
  H = 400 / S,
  W = 20;
const hull = [
  [-14, 17],
  [-17, 0],
  [-17, -10],
  [17, -10],
  [17, 0],
  [14, 17],
];
export class Lander {
  constructor(random) {
    this.random = random;
    this.world = new World(Vec2(0, -10));
    const heights = Array.from({ length: 12 }, () => (random() * H) / 2);
    for (let i = 3; i <= 7; i++) heights[i] = H / 4;
    this.terrain = Array.from({ length: 11 }, (_, i) => [
      2 * i,
      0.33 * (heights[(i + 11) % 12] + heights[i] + heights[i + 1]),
    ]);
    const moon = this.world.createBody();
    moon.createFixture(Edge(Vec2(0, 0), Vec2(W, 0)), { friction: 0.1 });
    for (let i = 0; i < 10; i++)
      moon.createFixture(
        Edge(Vec2(...this.terrain[i]), Vec2(...this.terrain[i + 1])),
        { friction: 0.1 },
      );
    this.body = this.world.createDynamicBody({ position: Vec2(10, H) });
    this.body.createFixture(Polygon(hull.map(([x, y]) => Vec2(x / S, y / S))), {
      density: 5,
      friction: 0.1,
      restitution: 0,
      filterCategoryBits: 0x10,
      filterMaskBits: 1,
    });
    this.body.applyForceToCenter(
      Vec2((random() * 2 - 1) * 1000, (random() * 2 - 1) * 1000),
      true,
    );
    this.legs = [-1, 1].map((i) => {
      const leg = this.world.createDynamicBody({
        position: Vec2(10 - (i * 20) / S, H),
        angle: i * 0.05,
      });
      leg.createFixture(Box(2 / S, 8 / S), {
        density: 1,
        restitution: 0,
        filterCategoryBits: 0x20,
        filterMaskBits: 1,
      });
      this.world.createJoint(
        new RevoluteJoint({
          bodyA: this.body,
          bodyB: leg,
          localAnchorA: Vec2(0, 0),
          localAnchorB: Vec2((i * 20) / S, 18 / S),
          enableMotor: true,
          enableLimit: true,
          maxMotorTorque: 40,
          motorSpeed: 0.3 * i,
          lowerAngle: i === -1 ? 0.4 : -0.9,
          upperAngle: i === -1 ? 0.9 : -0.4,
        }),
      );
      leg.contacts = 0;
      return leg;
    });
    this.world.on("begin-contact", (contact) => this.contact(contact, 1));
    this.world.on("end-contact", (contact) => this.contact(contact, -1));
    this.state = {
      score: 0,
      steps: 0,
      done: false,
      message: "READY",
      env_id: "LunarLander-v3 · browser Box2D",
    };
    this.step(0);
    this.state.score = 0;
    this.state.steps = 0;
    this.state.message = "READY";
  }
  contact(contact, delta) {
    const bodies = [
      contact.getFixtureA().getBody(),
      contact.getFixtureB().getBody(),
    ];
    if (delta > 0 && bodies.includes(this.body)) this.crashed = true;
    this.legs.forEach((leg) => {
      if (bodies.includes(leg)) leg.contacts += delta;
    });
  }
  observation() {
    const p = this.body.getPosition(),
      v = this.body.getLinearVelocity();
    return [
      (p.x - 10) / 10,
      (p.y - (H / 4 + 18 / S)) / (H / 2),
      (v.x * 10) / 50,
      (v.y * (H / 2)) / 50,
      this.body.getAngle(),
      (20 * this.body.getAngularVelocity()) / 50,
      ...this.legs.map((l) => (l.contacts > 0 ? 1 : 0)),
    ].map(Math.fround);
  }
  step(action) {
    const s = this.state;
    if (s.done) return;
    const angle = this.body.getAngle(),
      tx = Math.sin(angle),
      ty = Math.cos(angle),
      sx = -ty,
      sy = tx;
    const d0 = (this.random() * 2 - 1) / S,
      d1 = (this.random() * 2 - 1) / S,
      p = this.body.getPosition();
    if (action === 2) {
      const ox = tx * (4 / S + 2 * d0) + sx * d1,
        oy = -ty * (4 / S + 2 * d0) - sy * d1;
      this.body.applyLinearImpulse(
        Vec2(-ox * 13, -oy * 13),
        Vec2(p.x + ox, p.y + oy),
        true,
      );
    }
    if (action === 1 || action === 3) {
      const dir = action - 2,
        ox = tx * d0 + sx * (3 * d1 + (dir * 12) / S),
        oy = -ty * d0 - sy * (3 * d1 + (dir * 12) / S);
      this.body.applyLinearImpulse(
        Vec2(-ox * 0.6, -oy * 0.6),
        Vec2(p.x + ox - (tx * 17) / S, p.y + oy + (ty * 14) / S),
        true,
      );
    }
    this.world.step(1 / 50, 180, 60);
    const o = this.observation();
    const shaping =
      -100 * Math.hypot(o[0], o[1]) -
      100 * Math.hypot(o[2], o[3]) -
      100 * Math.abs(o[4]) +
      10 * (o[6] + o[7]);
    let reward = this.previous === undefined ? 0 : shaping - this.previous;
    this.previous = shaping;
    reward -= action === 2 ? 0.3 : action === 1 || action === 3 ? 0.03 : 0;
    s.steps++;
    s.message = "IN FLIGHT";
    if (this.crashed || Math.abs(o[0]) >= 1) {
      s.done = true;
      reward = -100;
      s.message = "CRASHED";
    }
    if (!this.body.isAwake()) {
      s.done = true;
      reward = 100;
      s.message = "LANDED";
    }
    if (s.steps >= 1000 && !s.done) {
      s.done = true;
      s.message = "STEP LIMIT REACHED";
    }
    s.score += reward;
    this.action = action;
  }
  heuristic() {
    const s = this.observation();
    let target = Math.max(-0.4, Math.min(0.4, s[0] * 0.5 + s[2]));
    let angle = (target - s[4]) * 0.5 - s[5],
      hover = (Math.abs(s[0]) * 0.55 - s[1]) * 0.5 - s[3] * 0.5;
    if (s[6] || s[7]) {
      angle = 0;
      hover = -s[3] * 0.5;
    }
    if (hover > Math.abs(angle) && hover > 0.05) return 2;
    if (angle < -0.05) return 3;
    if (angle > 0.05) return 1;
    return 0;
  }
  draw(canvas) {
    canvas.width = 600;
    canvas.height = 400;
    const c = canvas.getContext("2d");
    c.fillStyle = "#000";
    c.fillRect(0, 0, 600, 400);
    const point = ([x, y]) => [x * S, 400 - y * S];
    c.fillStyle = "#fff";
    c.beginPath();
    c.moveTo(0, 400);
    this.terrain.forEach((p) => c.lineTo(...point(p)));
    c.lineTo(600, 400);
    c.fill();
    for (const body of [...this.legs, this.body]) {
      for (
        let fixture = body.getFixtureList();
        fixture;
        fixture = fixture.getNext()
      ) {
        const shape = fixture.getShape();
        c.beginPath();
        shape.m_vertices.forEach((v, i) => {
          const p = body.getWorldPoint(v),
            [x, y] = point([p.x, p.y]);
          i ? c.lineTo(x, y) : c.moveTo(x, y);
        });
        c.closePath();
        c.fillStyle = "#8066e6";
        c.fill();
        c.strokeStyle = "#4d4d80";
        c.lineWidth = 2;
        c.stroke();
      }
    }
    for (const x of [8, 12]) {
      const [px, py] = point([x, H / 4]);
      c.strokeStyle = "#fff";
      c.beginPath();
      c.moveTo(px, py);
      c.lineTo(px, py - 50);
      c.stroke();
      c.fillStyle = "#cccc00";
      c.beginPath();
      c.moveTo(px, py - 50);
      c.lineTo(px, py - 40);
      c.lineTo(px + 25, py - 45);
      c.fill();
    }
    if (this.action && !this.state.done) {
      const pos = this.body.getWorldPoint(
        Vec2(
          this.action === 2 ? 0 : (this.action === 1 ? -14 : 14) / S,
          this.action === 2 ? -12 / S : 8 / S,
        ),
      );
      const [x, y] = point([pos.x, pos.y]);
      c.fillStyle = "#ff9933";
      c.beginPath();
      c.arc(x, y, 5, 0, Math.PI * 2);
      c.fill();
    }
  }
}
