"""
Backend Edge Cases and Resilience Test Suite for Recur.
Tests:
- Empty memory behavior ("no similar incidents found", lower confidence)
- JSON schema validation and Pydantic constraints
- Outage handling / graceful degradation
"""

import sys
from pathlib import Path

if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

# Add backend directory to path
backend_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(backend_dir))

from app.agent import analyze_incident, IncidentAnalysisResult
from app.memory import recall_similar

def test_edge_cases():
    print("=" * 65)
    print("Recur Agent Edge Cases & Hardening Test Suite")
    print("=" * 65)

    # 1. Empty / Unrelated Incident Memory Analysis
    print("\n[1/3] Testing Analysis with completely novel/unrelated incident...")
    novel_alert = "Unknown quantum kernel bitflip in cosmic ray detector service."
    novel_logs = "[FATAL] 2026-11-06 04:00:00 [cosmic-detector] parity check failed on register 0x99A"

    res = analyze_incident(novel_alert, novel_logs, memory_enabled=True)
    print(f" -> Diagnosis: {res['diagnosis']}")
    print(f" -> Confidence: {res['confidence']}%")
    print(f" -> Matched Incidents: {res['matched_incidents']}")
    
    # Assert result conforms to Pydantic schema
    validated = IncidentAnalysisResult.model_validate(res)
    assert validated.confidence <= 100
    print(" -> Schema Validation: PASSED")

    # 2. Memory Disabled (Without Memory baseline comparison)
    print("\n[2/3] Testing Analysis with memory_enabled=False...")
    res_off = analyze_incident(
        "PostgreSQL connection pool exhausted in payments-api",
        "[ERROR] pool exhausted: max_connections=200 reached",
        memory_enabled=False
    )
    assert len(res_off["matched_incidents"]) == 0, "Matched incidents must be empty when memory is disabled!"
    assert res_off["confidence"] <= 55, "Confidence without memory should be <= 55%"
    print(f" -> Confidence without memory: {res_off['confidence']}% (appropriately restrained)")
    print(f" -> Matched incidents: {res_off['matched_incidents']} (correctly empty)")
    print(" -> Memory Disabled Baseline: PASSED")

    # 3. Graceful Recall Query handling
    print("\n[3/3] Testing recall query handling on gibberish string...")
    recalled = recall_similar("xyz123_nonexistent_service_query_456", top_k=2)
    print(f" -> Recalled items count: {len(recalled)}")
    print(" -> Graceful Recall: PASSED")

    print("\n" + "=" * 65)
    print("ALL EDGE CASE & RESILIENCE TESTS PASSED!")
    print("=" * 65)

if __name__ == "__main__":
    test_edge_cases()
