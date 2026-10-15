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
test("Mobile layout, keyboard navigation and deterministic demo controls", async () => {
  const p = await page({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  await loaded(p);
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
  await p.locator('[data-view="playground"]').click();
  await p.locator("#demo-canvas").waitFor({ state: "visible" });
  await p.locator("#demo-canvas").focus();
  await p.keyboard.press("ArrowUp");
  assert.equal(await p.locator("#demo-steps").innerText(), "1");
  await p.locator("#demo-reset").click();
  assert.equal(await p.locator("#demo-steps").innerText(), "0");
  await p.locator("#demo-policy").selectOption("heuristic");
  await p.locator("#demo-toggle").click();
  await p.waitForFunction(
    () =>
      document.querySelector("#demo-status").textContent ===
      "DESTINATION REACHED",
    null,
    { timeout: 15000 },
  );
  assert.equal(
    await p.evaluate(
      () =>
        document.documentElement.scrollWidth <=
        document.documentElement.clientWidth,
    ),
    true,
  );
  await p.locator('[data-lab="1"]').click();
  await p.locator("#demo-policy").selectOption("manual");
  await p.locator("#demo-toggle").click();
  await p.waitForFunction(
    () => Number(document.querySelector("#demo-steps").textContent) > 2,
  );
  await p.locator('[data-view="standings"]').click();
  const steps = await p.locator("#demo-steps").innerText();
  await p.waitForTimeout(100);
  assert.equal(await p.locator("#demo-steps").innerText(), steps);
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
