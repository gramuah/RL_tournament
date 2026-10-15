const fs = require("node:fs");
fs.mkdirSync("web/vendor", { recursive: true });
fs.copyFileSync("node_modules/planck/dist/planck.mjs", "web/vendor/planck.mjs");
fs.copyFileSync(
  "node_modules/planck/LICENSE.txt",
  "web/vendor/planck-LICENSE.txt",
);
