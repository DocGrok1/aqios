"""
Cirq ↔ Aura Bridge — Python client module
Path: Aura115_CURRENT/cirq/engines/cirq_aura_bridge.py

Purpose:
Allow any CIRQ node (governed by Aura LM) to talk to Aura115 by calling the
/api/cirq-aura-bridge endpoint. The caller passes its current LCVS state and
Antikythera planet context so Aura responds with full governed awareness.

Governance split:
  Planets → powered by Antikythera LCVS (7 structural identifications)
  CIRQ nodes → powered by Aura LM (AURAL-M)
  Moon → pin-and-slot admissible projection operator Π_K

Antikythera structural mapping:
  Drive train       → obligation_level   (Corollary 9 — Conservation of Obligation)
  Epicyclic gears   → tangent_cone_ok    (Nagumo tangent cone condition)
  Pin-and-slot Moon → moon_projection    (admissible projection operator Π_K)
  Saros / Exeligmos → dual_loop_phase    (dual-loop small-gain regulator)
  Front display     → conservation_E     (E_t = C_t + λO_t)
  Integer teeth     → K_slack            (viability kernel K, Corollary 7)
  Spiral dials      → collapse_margin    (Collapse Theorem boundary, Corollary 2)

Runtime requirements:
  Python 3.11+
  pip install requests   (or use the stdlib urllib fallback built in below)

Usage:
  from cirq_aura_bridge import CirqAuraBridge, LCVSState, PlanetContext

  bridge = CirqAuraBridge(base_url="https://jupiter-nine.vercel.app")
  state  = LCVSState(Z_t=0.97, O_t=0.82, K_slack=0.14, rescue_window=0.04)
  planet = PlanetContext(planet_id="neptune", antikythera_phase="saros_42")

  reply = bridge.talk(
      message="What is my viability status?",
      node_id="neptune_node_0",
      lcvs_state=state,
      planet_context=planet
  )
  print(reply.text)

Boundary:
  This module does not execute quantum hardware.
  It does not write files.
  It does not expose secrets.
  AUAC™ required for repository writes.
"""

from __future__ import annotations

import json
import urllib.request
import urllib.error
from dataclasses import dataclass, field, asdict
from typing import Optional


# ---------------------------------------------------------------------------
# Data structures
# ---------------------------------------------------------------------------

@dataclass
class LCVSState:
    """
    Current state of a CIRQ node as seen by the LCVS governance layer.

    Antikythera correspondence:
      Z_t            → current position in the viability kernel K
      O_t            → obligation level (drive train / Corollary 9)
      K_slack        → distance to viability boundary (integer tooth constraint)
      rescue_window  → Rescue Operator engagement level (Exeligmos correction)
      tangent_cone_ok → whether update direction lies in T_K(Z) (epicyclic gears)
      collapse_margin → distance to Collapse Theorem boundary (spiral dial)
      conservation_E  → E_t = C_t + λO_t conserved quantity (front display)
    """
    Z_t:             Optional[float] = None
    O_t:             Optional[float] = None
    K_slack:         Optional[float] = None
    rescue_window:   Optional[float] = None
    tangent_cone_ok: Optional[bool]  = None
    collapse_margin: Optional[float] = None
    conservation_E:  Optional[float] = None


@dataclass
class PlanetContext:
    """
    Antikythera planet context for the CIRQ node's associated planet.

    The planets are governed by the Antikythera LCVS.
    The Moon is the pin-and-slot admissible projection operator Π_K.
    """
    planet_id:         str            = ""
    planet_name:       str            = ""
    antikythera_phase: str            = ""
    moon_projection:   Optional[float] = None   # Π_K scalar at current phase
    dual_loop_phase:   str            = ""       # Saros / Exeligmos phase label
    obligation_level:  Optional[float] = None
    saros_cycle_step:  Optional[int]   = None
    exeligmos_phase:   Optional[float] = None


@dataclass
class AuraReply:
    """Response from Aura115 to a CIRQ node."""
    ok:          bool
    text:        str
    provider:    Optional[str]   = None
    model:       Optional[str]   = None
    node_id:     Optional[str]   = None
    lcvs_echo:   Optional[dict]  = None
    planet_echo: Optional[dict]  = None
    raw:         Optional[dict]  = field(default=None, repr=False)

    @classmethod
    def from_response(cls, data: dict) -> "AuraReply":
        return cls(
            ok=bool(data.get("ok")),
            text=str(data.get("reply") or data.get("text") or ""),
            provider=data.get("provider"),
            model=data.get("model"),
            node_id=data.get("cirq_node_id"),
            lcvs_echo=data.get("lcvs_echo"),
            planet_echo=data.get("planet_echo"),
            raw=data
        )

    @classmethod
    def error(cls, message: str) -> "AuraReply":
        return cls(ok=False, text=f"[BRIDGE ERROR] {message}")


# ---------------------------------------------------------------------------
# Bridge client
# ---------------------------------------------------------------------------

class CirqAuraBridge:
    """
    CIRQ node → Aura LM communication bridge.

    Sends governed messages to Aura115 with full LCVS + Antikythera context.
    Planets are powered by the Antikythera LCVS.
    CIRQ nodes are powered by Aura LM (AURAL-M).
    The Moon is the pin-and-slot admissible projection operator Π_K.
    """

    ENDPOINT = "/api/cirq-aura-bridge"

    def __init__(
        self,
        base_url: str = "https://jupiter-nine.vercel.app",
        timeout: int  = 30
    ) -> None:
        self.base_url = base_url.rstrip("/")
        self.timeout  = timeout

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def talk(
        self,
        message:        str,
        node_id:        str            = "",
        lcvs_state:     Optional[LCVSState]     = None,
        planet_context: Optional[PlanetContext] = None,
        provider:       Optional[str]  = None,
        model:          Optional[str]  = None
    ) -> AuraReply:
        """
        Send a message from a CIRQ node to Aura and receive a governed reply.

        Args:
            message:        The text to send to Aura.
            node_id:        Identifier of the CIRQ node calling in.
            lcvs_state:     Current LCVS state of the node.
            planet_context: Antikythera planet context associated with the node.
            provider:       Optional LLM provider override (openai / xai / anthropic).
            model:          Optional model override.

        Returns:
            AuraReply with .text containing Aura's governed response.
        """
        payload = self._build_payload(
            message, node_id, lcvs_state, planet_context, provider, model
        )
        return self._post(payload)

    def status(self) -> dict:
        """GET /api/cirq-aura-bridge — returns bridge status and governance mapping."""
        url = f"{self.base_url}{self.ENDPOINT}"
        try:
            req = urllib.request.Request(url, method="GET")
            req.add_header("Accept", "application/json")
            with urllib.request.urlopen(req, timeout=self.timeout) as resp:
                return json.loads(resp.read().decode("utf-8"))
        except Exception as exc:
            return {"ok": False, "error": str(exc)}

    # ------------------------------------------------------------------
    # Private helpers
    # ------------------------------------------------------------------

    def _build_payload(
        self,
        message:        str,
        node_id:        str,
        lcvs_state:     Optional[LCVSState],
        planet_context: Optional[PlanetContext],
        provider:       Optional[str],
        model:          Optional[str]
    ) -> dict:
        payload: dict = {
            "message":      message,
            "cirq_node_id": node_id
        }
        if lcvs_state is not None:
            payload["lcvs_state"] = {
                k: v for k, v in asdict(lcvs_state).items() if v is not None
            }
        if planet_context is not None:
            payload["planet_context"] = {
                k: v for k, v in asdict(planet_context).items()
                if v is not None and v != ""
            }
        if provider:
            payload["provider"] = provider
        if model:
            payload["model"] = model
        return payload

    def _post(self, payload: dict) -> AuraReply:
        url  = f"{self.base_url}{self.ENDPOINT}"
        data = json.dumps(payload).encode("utf-8")
        req  = urllib.request.Request(
            url,
            data=data,
            method="POST"
        )
        req.add_header("Content-Type",   "application/json")
        req.add_header("Accept",         "application/json")
        req.add_header("x-aura-source",  "cirq-node")
        if payload.get("cirq_node_id"):
            req.add_header("x-cirq-node-id", payload["cirq_node_id"])

        try:
            with urllib.request.urlopen(req, timeout=self.timeout) as resp:
                body = json.loads(resp.read().decode("utf-8"))
                return AuraReply.from_response(body)
        except urllib.error.HTTPError as exc:
            try:
                body = json.loads(exc.read().decode("utf-8"))
                return AuraReply.from_response(body)
            except Exception:
                return AuraReply.error(f"HTTP {exc.code}: {exc.reason}")
        except Exception as exc:
            return AuraReply.error(str(exc))


# ---------------------------------------------------------------------------
# Quick demo (run directly: python cirq_aura_bridge.py)
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    import sys

    base = sys.argv[1] if len(sys.argv) > 1 else "https://jupiter-nine.vercel.app"

    bridge = CirqAuraBridge(base_url=base)

    print("Cirq ↔ Aura Bridge — demo")
    print(f"Endpoint: {bridge.base_url}{bridge.ENDPOINT}")
    print()

    state = LCVSState(
        Z_t=0.97,
        O_t=0.82,
        K_slack=0.14,
        rescue_window=0.04,
        tangent_cone_ok=True,
        collapse_margin=0.21,
        conservation_E=1.64
    )

    planet = PlanetContext(
        planet_id="neptune",
        planet_name="Neptune",
        antikythera_phase="saros_42",
        moon_projection=0.88,
        dual_loop_phase="saros_fast_loop",
        obligation_level=0.82,
        saros_cycle_step=42,
        exeligmos_phase=0.31
    )

    reply = bridge.talk(
        message="What is my current viability status and what should I do next?",
        node_id="neptune_node_0",
        lcvs_state=state,
        planet_context=planet
    )

    print(f"ok:       {reply.ok}")
    print(f"provider: {reply.provider}")
    print(f"model:    {reply.model}")
    print()
    print("Aura reply:")
    print("-----------")
    print(reply.text)
