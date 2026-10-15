# Live policies on GitHub Pages

The published page runs inference and simulation entirely in the visitor's browser.
No Python server, Docker installation, account, external inference API or CDN is
needed to play. The existing optional Python server is retained as developer tooling
for comparisons with original Gymnasium frames.

Choose **Duel** beside any successful ranking entry, or select two policies in Live
Duel. A missing/incompatible export produces an explicit error; the page never
substitutes a heuristic for a named participant. Browser episodes do not write to
rankings. Those still come from isolated Python evaluation.

## Supported exports

- Taxi: `qtable.npy`, finite numeric shape `(500, 6)`, with first-maximum argmax.
- LunarLander: one SB3 discrete PPO ZIP, 8 observations / 4 actions, feed-forward
  MLP with Linear, Tanh and ReLU layers. No recurrent state or observation wrapper.
- An explicit `browser_policy.json` using either schema below. This allows authors
  to export compatible models from other training libraries.
- An explicit `{"kind":"random","actions":4}` (6 for Taxi) for random baselines.
  This declares stochastic behavior; it does not reproduce Python's random stream.

Q-table schema: `{"kind":"qtable","values":[...500 rows of 6 numbers...]}`.
MLP schema:

```json
{
  "kind": "mlp",
  "layers": [
    {"weight": [[0,0,0,0,0,0,0,0]], "bias": [0], "activation": "tanh"},
    {"weight": [[0],[0],[0],[0]], "bias": [0,0,0,0], "activation": "linear"}
  ]
}
```

Weights are `[output][input]`, with at most 8 layers and 256 units per layer.
The final layer must have 4 outputs. Actions use deterministic argmax (first index
wins ties). No softmax is needed for deterministic PPO action selection. Unsupported
architectures and arbitrary Python implementations can still compete in the official
tournament; they require a supported export for live browser play. We do not claim
that arbitrary `agent.py` programs can execute in a browser.

## Export and publication boundary

`python -m tournament.browser_artifacts build --sha <40-character git revision>`
starts a read-only, networkless, non-root container per submission with the same
CPU, memory, process and execution limits as evaluation. Checkpoint deserialization
and student imports stay inside that boundary. Output is bounded JSON, validated by
the host, and validated again in the fresh Pages build job against the expected
revision. The export includes a digest of each submission and reference predictions.
Exports are rebuilt on every tournament publish, including new submitted policies.

For Taxi, all 500 exported actions are checked against `agent.py`. For LunarLander,
130 deterministic observation probes check the exported forward pass against the
submitted agent. These checks detect common checkpoint/preprocessing discrepancies;
they are not a mathematical proof of equivalence for arbitrary Python programs.
The browser repeats those prediction checks before enabling a selected policy.

`web/data/policies.json` is also committed as a preview snapshot for a fresh static
checkout. Production CI replaces it with exports from the evaluated revision.

## Environment fidelity

Taxi has Gymnasium's 500-state encoding, six actions, walls, pickup/dropoff rules,
rewards and 200-step limit, rendered with the original Gymnasium sprites.
LunarLander ports Gymnasium 1.2.1's world geometry, fixtures/joints, forces, engine
impulses, eight observations, reward shaping, termination and 1,000-step limit to
Planck 1.5.1 (a JavaScript Box2D implementation). Its drawing follows the original
Gymnasium polygon/terrain/flag geometry. It is not a stream of Python/Pygame frames.

The browser uses a seeded JavaScript generator, not NumPy's PCG64, and the Box2D
implementations have numerical differences. Matching seed numbers reproduce a
browser scenario across both players and resets; they do not promise the identical
Python trajectory or reward. Official benchmark scores remain authoritative.

The Planck distribution is vendored, pinned by `package-lock.json`, and reproducible
with `npm ci && npm run vendor:web`. Its MIT license and Gymnasium's MIT license
are in `web/vendor/`. No runtime CDN is used.

## University identity

The unmodified blue UAH logo is from the university's [institutional identity page](https://www.uah.es/es/imagen-institucional/):
[official PNG](https://www.uah.es/export/shared/es/.galleries/imagen-institucional/logotipos-principales/vA_azul_LogoPrincipal.png).
The header preserves its aspect ratio. UI accents use its blue, `#002C91`.
