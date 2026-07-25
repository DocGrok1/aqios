"""
Aura115™ QML Extension Example
Path: Aura115_CURRENT/cirq/examples/qml_full_coupling.py

Purpose:
Build a fully coupled (all-pairs) PennyLane register:
1) put all qubits in superposition with Hadamard gates
2) couple every unique pair using CNOT

Run in Python 3.11+ with PennyLane installed:
    python -m pip install pennylane
    python Aura115_CURRENT/cirq/examples/qml_full_coupling.py
"""

import pennylane as qml
from pennylane import numpy as np


def fully_connect_all_nodes_qml(n_nodes: int = 4):
    """Return a PennyLane QNode that prepares a fully-coupled all-pairs register."""
    if n_nodes < 2:
        raise ValueError("n_nodes must be >= 2")

    device = qml.device("default.qubit", wires=n_nodes)

    @qml.qnode(device)
    def circuit():
        for i in range(n_nodes):
            qml.Hadamard(wires=i)

        for i in range(n_nodes):
            for j in range(i + 1, n_nodes):
                qml.CNOT(wires=[i, j])

        return qml.state()

    return circuit


def main() -> None:
    n_nodes = 4
    circuit = fully_connect_all_nodes_qml(n_nodes=n_nodes)
    state = circuit()
    print("Fully-coupled PennyLane (qml) circuit state vector:")
    print(np.round(state, 6))


if __name__ == "__main__":
    main()
