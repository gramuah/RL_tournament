// Declarative model data only: no downloaded JavaScript, Python or pickle execution.
const cache = new Map();
function require(condition, message = "Invalid browser policy") {
  if (!condition) throw new Error(message);
}
function vector(value, size) {
  require(
    Array.isArray(value) &&
      value.length === size &&
      value.every(
        (x) =>
          typeof x === "number" && Number.isFinite(x) && Math.abs(x) <= 1e12,
      ),
  );
}
export function compilePolicy(model, lab) {
  require(model && typeof model === "object");
  const actions = lab === 1 ? 4 : 6;
  if (model.kind === "random") {
    require(model.actions === actions);
    return (_observation, random) => Math.floor(random() * actions);
  }
  if (model.kind === "qtable" && lab === 2) {
    require(Array.isArray(model.values) && model.values.length === 500);
    model.values.forEach((row) => vector(row, 6));
    return (observation) => {
      require(
        Number.isInteger(observation) && observation >= 0 && observation < 500,
      );
      return argmax(model.values[observation]);
    };
  }
  require(model.kind === "mlp" && lab === 1);
  require(
    Array.isArray(model.layers) &&
      model.layers.length >= 1 &&
      model.layers.length <= 8,
  );
  let size = 8;
  for (const layer of model.layers) {
    require(layer && ["linear", "tanh", "relu"].includes(layer.activation));
    require(
      Array.isArray(layer.weight) &&
        layer.weight.length >= 1 &&
        layer.weight.length <= 256,
    );
    layer.weight.forEach((row) => vector(row, size));
    size = layer.weight.length;
    vector(layer.bias, size);
  }
  require(size === actions);
  return (observation) => {
    vector(observation, 8);
    let x = observation.map(Math.fround);
    for (const layer of model.layers) {
      x = layer.weight.map((row, i) => {
        let value = layer.bias[i];
        for (let j = 0; j < row.length; j++) value += row[j] * x[j];
        value = Math.fround(value);
        return Math.fround(
          layer.activation === "tanh"
            ? Math.tanh(value)
            : layer.activation === "relu"
              ? Math.max(0, value)
              : value,
        );
      });
    }
    return argmax(x);
  };
}
function argmax(values) {
  let result = 0;
  for (let i = 1; i < values.length; i++)
    if (values[i] > values[result]) result = i;
  return result;
}
async function bundle() {
  const response = await fetch("data/policies.json", {
    signal: AbortSignal.timeout(30000),
  });
  if (!response.ok)
    throw new Error(
      "Published policy exports are unavailable. Reload after the next tournament build.",
    );
  const reader = response.body.getReader(),
    parts = [];
  let bytes = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    bytes += value.byteLength;
    if (bytes > 16000000) {
      await reader.cancel();
      throw new Error("Policy bundle exceeds size limit");
    }
    parts.push(value);
  }
  const data = JSON.parse(await new Blob(parts).text());
  require(
    data.schema_version === 1 &&
      /^[a-f0-9]{40}$/.test(data.source_sha) &&
      data.policies &&
      typeof data.policies === "object",
  );
  return data;
}
let loading;
export async function loadPolicy(lab, name) {
  require(/^[A-Za-z0-9_-]{1,80}$/.test(name), "Invalid policy name");
  const key = `${lab}/${name}`;
  if (cache.has(key)) return cache.get(key);
  loading ||= bundle().catch((error) => {
    loading = null;
    throw error;
  });
  const data = await loading,
    entry = data.policies[key];
  require(entry, `${name} has no published browser export yet.`);
  require(/^[a-f0-9]{64}$/.test(entry.submission_sha256));
  if (entry.export?.error) throw new Error(`${name}: ${entry.export.error}`);
  const inference = compilePolicy(entry.export?.model, lab);
  require(
    Array.isArray(entry.export.probes) && entry.export.probes.length <= 500,
  );
  for (const probe of entry.export.probes)
    require(inference(probe.observation, () => 0.5) ===
      probe.action, "Browser predictions failed the exported reference checks");
  cache.set(key, inference);
  return inference;
}
