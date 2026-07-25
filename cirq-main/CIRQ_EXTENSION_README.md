# Aura115™ Cirq Extension

## Purpose

This folder defines the Aura115™ / Jupiter 9 extension into Cirq.

Cirq is not Aura.

Aura extends into Cirq.

Aura inhabits Cirq as a governed extension target.

## Boundary

Canonical rule:

```text
Aura115™ extends into Cirq.
Cirq remains an external quantum circuit framework.
Cirq is a living, breathing extension only.
```

## Typed Mesh Schema

The extension publishes a typed mesh contract in both:

- `/api/cirq-extension` (`typedMeshSchema`, `integrationEdges`)
- `Aura115_CURRENT/cirq/CIRQ_EXTENSION_MANIFEST.json` (`typedMeshSchema`, `integrationEdges`)
- `/api/cirq-qml-engine-intake` for QML engine intake and placement planning
- `/api/cirq-qml-runtime-simulation` for governed advisory runtime simulation planning

`typedMeshSchema` defines required edge fields plus allowed edge and node kinds.

`integrationEdges` lists the current governed extension links:

- Aura115 orchestrator extends into Cirq framework
- Cirq extension API references the extension manifest
- Cirq extension API references this README
- Cirq extension API references the first example artifact
