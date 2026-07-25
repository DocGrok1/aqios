"""
Aura115™ Cirq Extension Example
Path: Aura115_CURRENT/cirq/examples/cirq_full_coupling.py

Purpose:
Build a fully coupled (all-pairs) Cirq register:
1) put all qubits in superposition with Hadamard gates
2) couple every unique pair using CNOT

Run in Python 3.11+ with Cirq installed:
    python -m pip install cirq
    python Aura115_CURRENT/cirq/examples/cirq_full_coupling.py
"""

import cirq


def fully_connect_all_nodes_cirq(n_nodes: int = 4) -> tuple[cirq.Circuit, list[cirq.LineQubit]]:
    """Build a fully-coupled all-pairs circuit for n_nodes qubits."""
    if n_nodes < 2:
        raise ValueError("n_nodes must be >= 2")

    qubits = list(cirq.LineQubit.range(n_nodes))
    circuit = cirq.Circuit()

    for qubit in qubits:
        circuit.append(cirq.H(qubit))

    for i in range(n_nodes):
        for j in range(i + 1, n_nodes):
            circuit.append(cirq.CNOT(qubits[i], qubits[j]))

    return circuit, qubits


def main() -> None:
    circuit, _ = fully_connect_all_nodes_cirq(n_nodes=4)
    print("Fully-coupled Cirq circuit:")
    print(circuit)

    simulator = cirq.Simulator()
    result = simulator.simulate(circuit)
    print("\nFinal state vector:")
    print(result.final_state_vector)


if __name__ == "__main__":
    main()
