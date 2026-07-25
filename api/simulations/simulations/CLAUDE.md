# CLAUDE.md — api/simulations/

See root `CLAUDE.md` for full architecture.

## Spine calls from simulation handlers

Any HTTP call from simulation handlers must use:

```js
const SPINE = (process.env.WEBBHARNESS_SERVER_URL || process.env.BRAIN_SERVER_URL || 'https://cloud.aura115.ai').replace(/\/$/, '');
```

## Python runtime

QHP runtime Python files live in `api/simulations/qhp_runtime/`. The root `simulations/` directory is the standalone Python package. Both are included in the ECS container.

## Banned

- `aura115-production.up.railway.app` — Railway is dead
