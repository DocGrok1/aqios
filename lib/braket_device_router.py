"""
braket_device_router.py — Real AWS Braket Hardware Execution Router
DCGP.AI LLC — Joshua L. Lopez — USPTO 19/555,951

Submits ACTUAL quantum tasks to ACTUAL Braket devices — not simulation.
Every device ARN below is a real, addressable Braket resource. This module
makes the AwsDevice() call, submits the circuit, polls for completion, and
returns genuine hardware (or AWS-hosted simulator) measurement results.

Twelve-engine registry maps each named planet in AURA to its real backend.
Some engines route to real QPUs (IonQ, Rigetti, QuEra). Others route to
AWS's own hosted simulators (SV1, TN1, DM1) — these are still real AWS
compute, executed on AWS infrastructure, not local cirq.Simulator().
Distinguish the two honestly in every response: qpu vs managed_simulator.

Authority: Joshua Lopez — DCGP.AI — CIP USPTO 19/555,951
"""

import os
import json
import time
from datetime import datetime

try:
    from braket.aws import AwsDevice, AwsQuantumTask
    from braket.circuits import Circuit
    BRAKET_AVAILABLE = True
except ImportError:
    BRAKET_AVAILABLE = False

# ── Real Braket device ARNs — verified resource identifiers ─────────────────
# QPU = physical quantum processing unit. managed_simulator = AWS-hosted,
# not local. Both are "real hardware execution" in the sense that the task
# actually leaves this process and runs on AWS-operated infrastructure —
# but only "qpu" entries are physical qubits.
DEVICE_REGISTRY = {
    "venus":    {"arn": "arn:aws:braket:us-east-1::device/qpu/quera/Aquila",       "type": "qpu",               "vendor": "QuEra",   "substrate": "Neutral Atom"},
    "neptune":  {"arn": "arn:aws:braket:us-west-1::device/qpu/rigetti/Ankaa-3",    "type": "qpu",               "vendor": "Rigetti", "substrate": "Superconducting"},
    "saturn":   {"arn": "arn:aws:braket:::device/quantum-simulator/amazon/sv1",    "type": "managed_simulator",  "vendor": "Amazon",  "substrate": "State Vector"},
    "jupiter":  {"arn": "arn:aws:braket:::device/quantum-simulator/amazon/sv1",    "type": "managed_simulator",  "vendor": "Amazon",  "substrate": "State Vector"},
    "mercury":  {"arn": "arn:aws:braket:us-east-1::device/qpu/ionq/Forte-1",        "type": "qpu",               "vendor": "IonQ",    "substrate": "Trapped Ion"},
    "mars":     {"arn": "arn:aws:braket:us-east-1::device/qpu/ionq/Forte-1",        "type": "qpu",               "vendor": "IonQ",    "substrate": "Trapped Ion"},
    "earth":    {"arn": "arn:aws:braket:::device/quantum-simulator/amazon/dm1",    "type": "managed_simulator",  "vendor": "Amazon",  "substrate": "Density Matrix"},
    "moon":     {"arn": "arn:aws:braket:::device/quantum-simulator/amazon/dm1",    "type": "managed_simulator",  "vendor": "Amazon",  "substrate": "Density Matrix"},
    "pluto":    {"arn": "arn:aws:braket:::device/quantum-simulator/amazon/sv1",    "type": "managed_simulator",  "vendor": "Amazon",  "substrate": "State Vector"},
    "uranus":   {"arn": "arn:aws:braket:::device/quantum-simulator/amazon/tn1",    "type": "managed_simulator",  "vendor": "Amazon",  "substrate": "Tensor Network"},
    "bl7":      {"arn": "arn:aws:braket:us-west-1::device/qpu/rigetti/Ankaa-3",    "type": "qpu",               "vendor": "Rigetti", "substrate": "Superconducting"},
    "oricron":  {"arn": None, "type": "local_simulator", "vendor": "Google CIRQ", "substrate": "cirq.Simulator"},
}


def get_device_info(engine_name):
    key = (engine_name or "").lower()
    return DEVICE_REGISTRY.get(key, DEVICE_REGISTRY["saturn"])


def bell_circuit_braket():
    """Same Bell circuit (H, CNOT) authored in Braket's native circuit format."""
    circ = Circuit()
    circ.h(0)
    circ.cnot(0, 1)
    return circ


def submit_task(engine_name, circuit=None, shots=100, wait_seconds=30):
    """
    Submits a REAL quantum task to the named engine's real Braket device.
    Returns task status immediately if not complete within wait_seconds —
    caller should poll task_id via check_task() rather than block forever.
    """
    info = get_device_info(engine_name)

    if info["type"] == "local_simulator":
        return {
            "ok": False,
            "engine": engine_name,
            "error": "This engine routes to local cirq.Simulator, not Braket. Use /api/cirq-bell-pair instead.",
            "device": info
        }

    if not BRAKET_AVAILABLE:
        return {
            "ok": False,
            "engine": engine_name,
            "error": "amazon-braket-sdk not installed in this environment",
            "device": info
        }

    if circuit is None:
        circuit = bell_circuit_braket()

    # Extract region from the ARN itself (arn:aws:braket:REGION::device/...)
    # so boto3 always targets the correct region regardless of environment defaults.
    arn_parts = info["arn"].split(":")
    device_region = arn_parts[3] if len(arn_parts) > 3 and arn_parts[3] else os.environ.get("AWS_REGION", "us-east-1")

    try:
        import boto3
        braket_client = boto3.client("braket", region_name=device_region)
        # Force region via boto3 session explicitly
        from braket.aws import AwsSession
        session = AwsSession(braket_client=braket_client)
        device = AwsDevice(info["arn"], aws_session=session)
        task = device.run(circuit, shots=shots)
        task_id = task.id

        start = time.time()
        while time.time() - start < wait_seconds:
            state = task.state()
            if state in ("COMPLETED", "FAILED", "CANCELLED"):
                break
            time.sleep(2)

        final_state = task.state()
        result_payload = {
            "ok": True,
            "engine": engine_name,
            "device": info,
            "task_id": task_id,
            "task_arn": task.id,
            "state": final_state,
            "shots": shots,
            "submitted_at": datetime.utcnow().isoformat() + "Z"
        }

        if final_state == "COMPLETED":
            result = task.result()
            counts = dict(result.measurement_counts)
            result_payload["counts"] = {str(k): v for k, v in counts.items()}
            result_payload["measurements_available"] = True
        else:
            result_payload["measurements_available"] = False
            result_payload["note"] = f"Task in state {final_state} after {wait_seconds}s wait. Poll task_id for completion."

        return result_payload

    except Exception as e:
        return {
            "ok": False,
            "engine": engine_name,
            "device": info,
            "error": str(e)
        }


def check_task(task_arn):
    """Poll an existing Braket task by ARN — for tasks that outlive the initial wait."""
    if not BRAKET_AVAILABLE:
        return {"ok": False, "error": "amazon-braket-sdk not installed"}
    try:
        task = AwsQuantumTask(task_arn)
        state = task.state()
        payload = {"ok": True, "task_arn": task_arn, "state": state}
        if state == "COMPLETED":
            result = task.result()
            counts = dict(result.measurement_counts)
            payload["counts"] = {str(k): v for k, v in counts.items()}
        return payload
    except Exception as e:
        return {"ok": False, "task_arn": task_arn, "error": str(e)}


def list_engines():
    """Return the full 12-engine registry with real ARNs and device types for transparency."""
    return {
        name: {**info, "braket_sdk_available": BRAKET_AVAILABLE}
        for name, info in DEVICE_REGISTRY.items()
    }


if __name__ == "__main__":
    print(json.dumps(list_engines(), indent=2))
