"""
Aura115™ Cirq Extension Example
Path: Aura115_CURRENT/cirq/examples/aura_cirq_bell_pair.py

Purpose:
Create a simple Bell pair circuit using Cirq.

Boundary:
This file is an extension artifact.
It does not execute inside Vercel by itself.
Run it in a Python 3.11+ environment with Cirq installed:

    python -m pip install cirq matplotlib
    python Aura115_CURRENT/cirq/examples/aura_cirq_bell_pair.py

Outputs:
- Console: circuit diagram + measurement histogram
- File: outputs/bell_pair_histogram.png — measurement count bar chart
- File: outputs/bell_pair_amplitudes.png — ideal amplitude map bar chart

Aura115™ extends into Cirq.
Cirq is not Aura.
Cirq is an inhabited extension target.
"""

import os
import math
import cirq
import matplotlib
matplotlib.use("Agg")  # non-interactive backend; safe in all environments
import matplotlib.pyplot as plt


OUTPUTS_DIR = os.path.join(os.path.dirname(__file__), "outputs")


def build_bell_pair_circuit() -> cirq.Circuit:
    """Build a two-qubit Bell pair circuit."""
    q0, q1 = cirq.LineQubit.range(2)

    circuit = cirq.Circuit(
        cirq.H(q0),
        cirq.CNOT(q0, q1),
        cirq.measure(q0, q1, key="m"),
    )

    return circuit


def simulate(circuit: cirq.Circuit, repetitions: int = 1000):
    """Simulate the Bell pair circuit."""
    simulator = cirq.Simulator()
    result = simulator.run(circuit, repetitions=repetitions)
    return result


def plot_histogram(histogram: dict, repetitions: int, out_path: str) -> None:
    """Bar chart of measured bit-string counts."""
    labels = [format(k, "02b") for k in sorted(histogram)]
    counts = [histogram[k] for k in sorted(histogram)]
    colors = ["#00c8ff" if lbl in ("00", "11") else "#ff4060" for lbl in labels]

    fig, ax = plt.subplots(figsize=(6, 4))
    bars = ax.bar(labels, counts, color=colors, edgecolor="#1a1a2e", linewidth=1.2)
    ax.set_xlabel("Measurement outcome", fontsize=12)
    ax.set_ylabel("Count", fontsize=12)
    ax.set_title(
        f"Aura115™ Bell Pair — Measurement histogram (n={repetitions})",
        fontsize=13,
        fontweight="bold",
    )
    ax.bar_label(bars, padding=3, fontsize=10)
    ax.set_ylim(0, max(counts) * 1.2)
    fig.patch.set_facecolor("#0d0d1a")
    ax.set_facecolor("#12122b")
    ax.tick_params(colors="white")
    ax.xaxis.label.set_color("white")
    ax.yaxis.label.set_color("white")
    ax.title.set_color("white")
    for spine in ax.spines.values():
        spine.set_edgecolor("#333366")
    plt.tight_layout()
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    fig.savefig(out_path, dpi=150)
    plt.close(fig)
    print(f"  → Saved histogram: {out_path}")


def plot_amplitudes(out_path: str) -> None:
    """Bar chart of ideal Bell state probability amplitudes."""
    basis = ["|00⟩", "|01⟩", "|10⟩", "|11⟩"]
    amplitudes = [1 / math.sqrt(2), 0.0, 0.0, 1 / math.sqrt(2)]
    probabilities = [a ** 2 for a in amplitudes]
    colors = ["#00c8ff", "#333366", "#333366", "#00c8ff"]

    fig, ax = plt.subplots(figsize=(6, 4))
    bars = ax.bar(basis, probabilities, color=colors, edgecolor="#1a1a2e", linewidth=1.2)
    ax.set_xlabel("Basis state", fontsize=12)
    ax.set_ylabel("Probability |amplitude|²", fontsize=12)
    ax.set_title(
        "Aura115™ Bell Pair — Ideal amplitude map (Φ⁺)",
        fontsize=13,
        fontweight="bold",
    )
    ax.bar_label(bars, fmt="%.4f", padding=3, fontsize=10)
    ax.set_ylim(0, 0.75)
    fig.patch.set_facecolor("#0d0d1a")
    ax.set_facecolor("#12122b")
    ax.tick_params(colors="white")
    ax.xaxis.label.set_color("white")
    ax.yaxis.label.set_color("white")
    ax.title.set_color("white")
    for spine in ax.spines.values():
        spine.set_edgecolor("#333366")
    plt.tight_layout()
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    fig.savefig(out_path, dpi=150)
    plt.close(fig)
    print(f"  → Saved amplitude map: {out_path}")


def main() -> None:
    circuit = build_bell_pair_circuit()
    result = simulate(circuit)
    histogram = result.histogram(key="m")

    print("Aura115™ Cirq Extension: Bell Pair")
    print("----------------------------------")
    print(circuit)
    print()
    print("Measurement counts:")
    print(histogram)
    print()
    print("Generating graphs...")

    plot_histogram(
        histogram,
        repetitions=1000,
        out_path=os.path.join(OUTPUTS_DIR, "bell_pair_histogram.png"),
    )
    plot_amplitudes(
        out_path=os.path.join(OUTPUTS_DIR, "bell_pair_amplitudes.png"),
    )

    print()
    print("Done. Graphs written to outputs/")


if __name__ == "__main__":
    main()