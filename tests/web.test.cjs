const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { chromium } = require("playwright");
const http = require("node:http");
const fs = require("node:fs/promises");
const path = require("node:path");
let server, browser, base;
const root = path.resolve(__dirname, "../web");
const mime = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".ttf": "font/ttf",
  ".mp4": "video/mp4",
  ".png": "image/png",
};
before(async () => {
  server = http.createServer(async (req, res) => {
    const url = new URL(req.url, "http://localhost");
    if (!url.pathname.startsWith("/RL_tournament/")) {
      res.writeHead(404).end();
      return;
    }
    const file = path.resolve(
      root,
      decodeURIComponent(url.pathname.slice("/RL_tournament/".length)) ||
        "index.html",
    );
    if (!file.startsWith(root + path.sep)) {
      res.writeHead(403).end();
      return;
    }
    try {
      const data = await fs.readFile(file);
      res
        .writeHead(200, {
          "Content-Type":
            mime[path.extname(file)] || "application/octet-stream",
        })
        .end(data);
    } catch {
      res.writeHead(404).end();
    }
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  base = `http://127.0.0.1:${server.address().port}/RL_tournament/`;
  browser = await chromium.launch({
    headless: true,
    ...(process.env.BROWSER_EXECUTABLE
      ? { executablePath: process.env.BROWSER_EXECUTABLE }
      : {}),
  });
});
after(async () => {
  await browser?.close();
  await new Promise((resolve) => server?.close(resolve));
});
async function page(options = {}) {
  const context = await browser.newContext(options);
  const p = await context.newPage();
  p.errors = [];
  p.on("pageerror", (error) => p.errors.push(error.message));
  return p;
}
async function loaded(p) {
  await p.goto(base);
  await p.locator("#standings-body tr").first().waitFor();
}
test("Pages subpath, honest data, navigation, search, comparison, and screenshots", async () => {
  const p = await page({ viewport: { width: 1440, height: 1000 } });
  await loaded(p);
  assert.equal(
    await p.locator('[data-lab="2"]').getAttribute("aria-pressed"),
    "true",
  );
  assert.match(
    await p.locator("#data-provenance").innerText(),
    /Historical snapshot/,
  );
  assert.equal(await p.locator("#standings-body tr").count(), 2);
  await p.locator("#search").fill("rafael");
  assert.equal(await p.locator("#standings-body tr").count(), 1);
  await p.locator("#search").fill("missing participant");
  assert.match(await p.locator("#data-state").innerText(), /No agents match/);
  await p.locator("#search").fill("");
  await p
    .getByRole("button", { name: "Compare rafael_flor", exact: true })
    .click();
  assert.equal(await p.locator("#comparison").isVisible(), true);
  await p
    .getByRole("button", { name: "Compare baseline_random", exact: true })
    .click();
  assert.equal(await p.locator(".comparison-card").count(), 2);
  await p.locator("#clear-comparison").click();
  await fs.mkdir(path.resolve(__dirname, "../artifacts/web"), {
    recursive: true,
  });
  await p.evaluate(() => window.scrollTo(0, 0));
  await p.screenshot({
    path: path.resolve(__dirname, "../artifacts/web/standings-desktop.png"),
    fullPage: true,
  });
  await p.locator('[data-lab="1"]').click();
  await p.waitForFunction(() =>
    document
      .querySelector("#environment-name")
      .textContent.startsWith("LunarLander"),
  );
  await p.locator('[data-view="submit"]').click();
  assert.match(await p.locator("#submission-tree").innerText(), /lab1/);
  await p.locator('[data-view="rules"]').click();
  assert.match(await p.locator("#rule-success").innerText(), /200/);
  assert.deepEqual(p.errors, []);
  await p.context().close();
});
test("Mobile navigation exposes Live Duel without a separate Playground", async () => {
  const p = await page({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  await loaded(p);
  assert.equal(
    await p.locator('[data-view="playground"], #playground').count(),
    0,
  );
  assert.equal(
    await p.evaluate(
      () =>
        document.documentElement.scrollWidth <=
        document.documentElement.clientWidth,
    ),
    true,
  );
  await p.screenshot({
    path: path.resolve(__dirname, "../artifacts/web/standings-mobile.png"),
    fullPage: true,
  });
  await p.locator('[data-view="arena"]').click();
  await p.locator("#duel-a-canvas").waitFor({ state: "visible" });
  assert.deepEqual(p.errors, []);
  await p.context().close();
});
test("Unavailable and malformed data never produces sample scores", async () => {
  const p = await page();
  await p.route("**/data/leaderboard_p*.json", (route) =>
    route.fulfill({ status: 503, body: "{}" }),
  );
  await p.goto(base);
  await p.waitForFunction(() =>
    document.querySelector("#data-state").textContent.includes("unavailable"),
  );
  assert.equal(await p.locator("#standings-body tr").count(), 0);
  await p.unroute("**/data/leaderboard_p*.json");
  await p.route("**/data/leaderboard_p*.json", (route) =>
    route.fulfill({
      json: [
        { participant: "invalid", success: true, mean_reward: "not a score" },
      ],
    }),
  );
  await p.locator("#reload-data").click();
  await p.waitForFunction(() =>
    document.querySelector("#data-state").textContent.includes("unavailable"),
  );
  assert.equal(await p.locator("#standings-body tr").count(), 0);
  await p.context().close();
});
test("Empty results, literal hostile names, provenance and reduced motion", async () => {
  const p = await page({ reducedMotion: "reduce" });
  await p.route("**/data/leaderboard_p*.json", (route) =>
    route.fulfill({ json: [] }),
  );
  await p.goto(base);
  await p.waitForFunction(() =>
    document
      .querySelector("#data-state")
      .textContent.includes("No evaluated agents"),
  );
  await p.unroute("**/data/leaderboard_p*.json");
  const row = JSON.parse(
    await fs.readFile(path.join(root, "data/leaderboard_p2.json"), "utf8"),
  )[0];
  await p.route("**/data/leaderboard_p*.json", (route) =>
    route.fulfill({
      json: [{ ...row, participant: "<img src=x onerror=alert(1)>" }],
    }),
  );
  await p.route("**/data/manifest.json", (route) =>
    route.fulfill({
      json: {
        schema_version: 1,
        source_sha: "a".repeat(40),
        generated_at: "2026-10-15T12:00:00Z",
        episodes: 30,
        base_seed: 42,
      },
    }),
  );
  await p.locator("#reload-data").click();
  await p.locator("#standings-body tr").waitFor();
  assert.equal(await p.locator("#standings-body img").count(), 0);
  assert.match(await p.locator(".agent-name").innerText(), /<img/);
  assert.match(await p.locator("#data-provenance").innerText(), /Official run/);
  assert.deepEqual(p.errors, []);
  await p.context().close();
});

async function openArena(p) {
  await loaded(p);
  await p.locator('[data-view="arena"]').click();
  await p.locator("#duel-a-canvas").waitFor({ state: "visible" });
}
test("Live duels finish, tie fairly, reset reproducibly, and expose original Taxi sprites", async () => {
  const p = await page({ viewport: { width: 1440, height: 1000 } });
  await openArena(p);
  await p.locator("#duel-a-policy").selectOption("heuristic");
  await p.locator("#duel-speed").selectOption("4");
  await p.locator("#duel-toggle").click();
  await p.waitForFunction(
    () => document.querySelector("#duel-status").textContent === "DRAW",
  );
  const reward = await p.locator("#duel-a-score").innerText();
  const steps = await p.locator("#duel-a-steps").innerText();
  assert.equal(await p.locator("#duel-b-score").innerText(), reward);
  assert.equal(await p.locator("#duel-b-steps").innerText(), steps);
  assert.match(
    await p.locator("#duel-a-telemetry").innerText(),
    /DESTINATION REACHED/,
  );
  await p.locator("#duel-reset").click();
  assert.equal(await p.locator("#duel-a-steps").innerText(), "0");
  await p.locator("#duel-toggle").click();
  await p.waitForFunction(
    () => document.querySelector("#duel-status").textContent === "DRAW",
  );
  assert.equal(await p.locator("#duel-a-score").innerText(), reward);
  assert.equal(await p.locator("#duel-a-steps").innerText(), steps);
  assert.equal(
    await p.evaluate(
      () =>
        performance
          .getEntriesByType("resource")
          .filter(
            (e) => e.name.includes("/assets/taxi/") && e.responseStatus === 200,
          ).length,
    ),
    11,
  );
  await p.locator("#duel-b-policy").selectOption("random");
  await p.locator("#duel-toggle").click();
  await p.waitForFunction(
    () => document.querySelector("#duel-status").textContent.includes("wins"),
    null,
    { timeout: 20000 },
  );
  assert.match(await p.locator("#duel-status").innerText(), /Player A wins/);
  await p.locator("#duel-new").click();
  assert.equal(await p.locator("#duel-seed").inputValue(), "43");
  await p.locator("#duel-seed").fill("-1");
  await p.locator("#duel-seed").press("Tab");
  assert.equal(await p.locator("#duel-toggle").isDisabled(), true);
  assert.match(
    await p.locator("#duel-status").innerText(),
    /whole-number seed/,
  );
  await p.locator("#duel-seed").fill("42");
  await p.locator("#duel-seed").press("Tab");
  assert.equal(await p.locator("#duel-toggle").isDisabled(), false);
  await p.screenshot({
    path: path.resolve(__dirname, "../artifacts/web/duel-desktop.png"),
    fullPage: true,
  });
  assert.deepEqual(p.errors, []);
  await p.context().close();
});
test("Every ranked policy is selectable and standings load the requested matchup", async () => {
  const p = await page();
  await loaded(p);
  const ranked = JSON.parse(
    await fs.readFile(path.join(root, "data/leaderboard_p2.json"), "utf8"),
  )
    .filter((row) => row.success)
    .map((row) => `agent:${row.participant}`);
  assert.deepEqual(
    await p
      .locator(
        '#duel-a-policy optgroup[label="Policies in the ranking"] option',
      )
      .evaluateAll((options) => options.map((o) => o.value)),
    ranked,
  );
  await p
    .getByRole("button", { name: "Duel rafael_flor", exact: true })
    .click();
  await p.locator("#duel-a-canvas").waitFor({ state: "visible" });
  assert.equal(await p.locator("#duel-a-policy").inputValue(), "manual");
  assert.equal(
    await p.locator("#duel-b-policy").inputValue(),
    "agent:rafael_flor",
  );
  assert.equal(await p.locator("#duel-toggle").isDisabled(), true);
  assert.equal(await p.locator("#duel-policy-help").isVisible(), true);
  assert.equal(await p.locator("#duel-b-score").innerText(), "—");
  await p.locator('[data-view="standings"]').click();
  await p
    .getByRole("button", { name: "Compare rafael_flor", exact: true })
    .click();
  await p
    .getByRole("button", { name: "Compare baseline_random", exact: true })
    .click();
  await p.locator("#duel-selected").click();
  assert.equal(
    await p.locator("#duel-a-policy").inputValue(),
    "agent:rafael_flor",
  );
  assert.equal(
    await p.locator("#duel-b-policy").inputValue(),
    "agent:baseline_random",
  );
  // Explicitly returning to built-in policies makes browser practice playable again.
  await p.locator("#duel-a-policy").selectOption("manual");
  await p.locator("#duel-b-policy").selectOption("heuristic");
  assert.equal(await p.locator("#duel-toggle").isDisabled(), false);
  assert.equal(await p.locator("#duel-policy-help").isVisible(), false);
  assert.deepEqual(p.errors, []);
  await p.context().close();
});
test("Human can play either side using original shortcuts and touch; navigation pauses both labs", async () => {
  const p = await page({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  await openArena(p);
  await p.locator("#duel-b-policy").selectOption("manual");
  assert.equal(await p.locator("#duel-a-policy").inputValue(), "heuristic");
  assert.match(await p.locator("#duel-human").innerText(), /player B/i);
  await p.locator("#duel-b-canvas").focus();
  await p.keyboard.press("w");
  assert.equal(await p.locator("#duel-b-steps").innerText(), "1");
  await p.locator('#arena [data-action="pickup"]').tap();
  assert.equal(await p.locator("#duel-b-steps").innerText(), "2");
  await p.locator("#duel-b-canvas").focus();
  await p.keyboard.press("Space");
  await p.keyboard.press("Enter");
  assert.equal(await p.locator("#duel-b-steps").innerText(), "4");
  await p.keyboard.press("r");
  assert.equal(await p.locator("#duel-b-steps").innerText(), "0");
  assert.equal(
    await p.evaluate(
      () =>
        document.documentElement.scrollWidth <=
        document.documentElement.clientWidth,
    ),
    true,
  );
  await p.screenshot({
    path: path.resolve(__dirname, "../artifacts/web/duel-mobile.png"),
    fullPage: true,
  });
  await p.locator('[data-lab="1"]').click();
  await p.waitForFunction(() =>
    document.querySelector("#duel-title").textContent.startsWith("LunarLander"),
  );
  await p.locator("#duel-toggle").click();
  await p.locator("#duel-b-canvas").focus();
  const thrust = p.locator(
    '#arena [data-controls="lander"] [data-action="up"]',
  );
  await thrust.scrollIntoViewIfNeeded();
  const box = await thrust.boundingBox();
  await p.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await p.mouse.down();
  await p.waitForFunction(
    () => Number(document.querySelector("#duel-b-score").textContent) < 0,
  );
  await p.mouse.up();
  await p.locator("#duel-b-canvas").focus();
  await p.keyboard.down("w");
  await p.waitForFunction(
    () => Number(document.querySelector("#duel-b-steps").textContent) > 3,
  );
  await p.keyboard.up("w");
  await p.locator("#duel-toggle").click();
  const count = await p.locator("#duel-b-steps").innerText();
  await p.waitForTimeout(120);
  assert.equal(await p.locator("#duel-b-steps").innerText(), count);
  await p.screenshot({
    path: path.resolve(__dirname, "../artifacts/web/duel-lander-mobile.png"),
    fullPage: true,
  });
  await p.locator("#duel-toggle").click();
  await p.locator('[data-view="standings"]').click();
  await p.locator("#arena").waitFor({ state: "hidden" });
  const stopped = await p.locator("#duel-b-steps").innerText();
  await p.waitForTimeout(120);
  assert.equal(await p.locator("#duel-b-steps").innerText(), stopped);
  assert.deepEqual(p.errors, []);
  await p.context().close();
});

test(
  "Real Gymnasium browser controls, frames, duels and connection failures",
  { skip: !process.env.GYM_PYTHON },
  async () => {
    const { spawn } = require("node:child_process");
    const { once } = require("node:events");
    const child = spawn(
      process.env.GYM_PYTHON,
      [
        "-m",
        "tournament.serve",
        "--port",
        "0",
        ...(process.env.GYM_ISOLATED_AGENTS === "1"
          ? ["--isolated-agents"]
          : []),
      ],
      { cwd: path.resolve(__dirname, "..") },
    );
    let output = "";
    const address = await new Promise((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error(`Gym server startup timed out: ${output}`)),
        30000,
      );
      child.on("error", (error) => {
        clearTimeout(timer);
        reject(error);
      });
      child.on("exit", (code) => {
        clearTimeout(timer);
        reject(new Error(`Gym server exited ${code}: ${output}`));
      });
      child.stderr.on("data", (data) => (output += data));
      child.stdout.on("data", (data) => {
        output += data;
        const match = output.match(/http:\/\/127\.0\.0\.1:\d+\//);
        if (match) {
          clearTimeout(timer);
          resolve(match[0]);
        }
      });
    }).catch((error) => {
      child.kill();
      throw error;
    });
    const p = await page({ viewport: { width: 1440, height: 1000 } });
    try {
      await p.goto(`${address}#arena?lab=2`);
      await p.waitForFunction(
        () =>
          document.querySelector("#duel-engine").value === "gym" &&
          !document.querySelector("#duel-toggle").disabled,
      );
      assert.match(await p.locator("#duel-a-telemetry").innerText(), /Taxi-v3/);
      await p.locator("#duel-a-canvas").focus();
      await p.keyboard.press("ArrowUp");
      await p.waitForFunction(
        () => document.querySelector("#duel-a-steps").textContent === "1",
      );
      await p.locator("#duel-toggle").click();
      await p.locator("#duel-a-policy").selectOption("heuristic");
      await p.waitForFunction(
        () => !document.querySelector("#duel-toggle").disabled,
      );
      await p.locator("#duel-speed").selectOption("4");
      await p.locator("#duel-toggle").click();
      await p.waitForFunction(
        () => document.querySelector("#duel-status").textContent === "DRAW",
      );
      assert.match(
        await p.locator("#duel-a-telemetry").innerText(),
        /DESTINATION REACHED/,
      );
      await p.screenshot({
        path: path.resolve(__dirname, "../artifacts/web/gym-taxi-duel.png"),
        fullPage: true,
      });
      if (process.env.GYM_ISOLATED_AGENTS === "1") {
        await p.locator('[data-view="standings"]').click();
        await p
          .getByRole("button", { name: "Duel rafael_flor", exact: true })
          .click();
        assert.equal(
          await p.locator("#duel-b-policy").inputValue(),
          "agent:rafael_flor",
        );
        await p.locator("#duel-a-policy").selectOption("heuristic");
        await p.waitForFunction(
          () => !document.querySelector("#duel-toggle").disabled,
        );
        await p.locator("#duel-toggle").click();
        await p.waitForFunction(() =>
          document
            .querySelector("#duel-b-telemetry")
            .textContent.includes("DESTINATION REACHED"),
        );
      }
      await p.locator("#duel-b-policy").selectOption("heuristic");
      await p.waitForFunction(() => !document.querySelector("#duel-toggle").disabled);
      await p.locator('[data-lab="1"]').click();
      await p.waitForFunction(
        () =>
          document
            .querySelector("#duel-a-telemetry")
            .textContent.includes("LunarLander-v3") &&
          !document.querySelector("#duel-toggle").disabled,
      );
      await p.locator("#duel-a-policy").selectOption("manual");
      await p.waitForFunction(
        () => !document.querySelector("#duel-toggle").disabled,
      );
      await p.locator("#duel-toggle").click();
      await p.locator("#duel-a-canvas").focus();
      await p.keyboard.down("Space");
      await p.waitForFunction(
        () => Number(document.querySelector("#duel-a-steps").textContent) >= 4,
      );
      await p.keyboard.up("Space");
      await p.locator("#duel-toggle").click();
      await p.screenshot({
        path: path.resolve(__dirname, "../artifacts/web/gym-lander-duel.png"),
        fullPage: true,
      });
      // Pending requests must not paint old frames after a reset or runtime switch.
      await p.route("**/api/step", async (route) => {
        await new Promise((resolve) => setTimeout(resolve, 200));
        await route.continue();
      });
      await p.locator("#duel-toggle").click();
      await p.waitForRequest("**/api/step");
      await p.locator("#duel-engine").selectOption("browser");
      await p.waitForTimeout(300);
      assert.equal(await p.locator("#duel-a-steps").innerText(), "0");
      assert.match(
        await p.locator("#duel-a-telemetry").innerText(),
        /Browser model/,
      );
      await p.unroute("**/api/step");
      await p.locator("#duel-engine").selectOption("gym");
      await p.waitForFunction(
        () => !document.querySelector("#duel-toggle").disabled,
      );
      await p.route("**/api/step", (route) =>
        route.fulfill({
          status: 503,
          json: { error: "Runtime disconnected. Reset to reconnect." },
        }),
      );
      await p.locator("#duel-toggle").click();
      await p.waitForFunction(() =>
        document
          .querySelector("#duel-status")
          .textContent.includes("Runtime disconnected"),
      );
      assert.equal(await p.locator("#duel-toggle").isDisabled(), true);
      assert.equal(await p.locator("#duel-engine").inputValue(), "gym");
      assert.deepEqual(p.errors, []);
    } finally {
      await p.context().close();
      const exit = once(child, "exit");
      child.kill("SIGINT");
      await exit;
    }
  },
);
