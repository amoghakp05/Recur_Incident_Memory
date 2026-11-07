"""
Comprehensive API test for Recur backend.
Tests every FastAPI endpoint using fastapi.testclient.TestClient.
"""

import sys
from pathlib import Path

# Set UTF-8 encoding for Windows terminal
if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

# Add backend directory to path
backend_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(backend_dir))

from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_endpoints():
    print("=" * 65)
    print("Recur FastAPI Endpoint Test Suite")
    print("=" * 65)

    # 1. Health
    print("\n[1/9] Testing GET /api/health...")
    r = client.get("/api/health")
    assert r.status_code == 200, f"Health check failed: {r.text}"
    print(f" -> OK: {r.json()}")

    # 2. Incidents List
    print("\n[2/9] Testing GET /api/incidents...")
    r = client.get("/api/incidents")
    assert r.status_code == 200, f"GET incidents failed: {r.text}"
    incidents = r.json()
    assert len(incidents) > 0, "Incidents list should not be empty"
    print(f" -> OK: Found {len(incidents)} incidents (first: {incidents[0]['id']} - {incidents[0]['title']})")

    # 3. Memory Activity Log
    print("\n[3/9] Testing GET /api/memory/activity...")
    r = client.get("/api/memory/activity")
    assert r.status_code == 200, f"GET memory activity failed: {r.text}"
    activities = r.json()
    print(f" -> OK: {len(activities)} activity entries logged")

    # 4. Memory Entries
    print("\n[4/9] Testing GET /api/memory/entries...")
    r = client.get("/api/memory/entries")
    assert r.status_code == 200, f"GET memory entries failed: {r.text}"
    entries = r.json()
    print(f" -> OK: {len(entries)} remembered incident entries stored in ledger")

    # 5. MTTR Insights
    print("\n[5/9] Testing GET /api/insights/mttr...")
    r = client.get("/api/insights/mttr")
    assert r.status_code == 200, f"GET MTTR failed: {r.text}"
    mttr = r.json()
    print(f" -> OK: Initial MTTR: {mttr['initial_mttr']}m -> Current MTTR: {mttr['current_mttr']}m ({mttr['improvement_pct']}% improvement)")

    # 6. Patterns Insights
    print("\n[6/9] Testing GET /api/insights/patterns...")
    r = client.get("/api/insights/patterns")
    assert r.status_code == 200, f"GET patterns failed: {r.text}"
    patterns = r.json()
    print(f" -> OK: Patterns synthesized via {patterns['source']}")

    # 7. Analyze Incident with Memory (Groq + Hindsight)
    print("\n[7/9] Testing POST /api/analyze (Memory Enabled = True)...")
    alert_sample = "Connection pool exhausted in payments-api. 504 Gateway Timeouts surging."
    logs_sample = """[ERROR] 2026-11-06 03:12:01 [payments-api] pool.go:142: pool exhausted: max_connections=200 reached
[WARN]  2026-11-06 03:12:04 [payments-api] pgbouncer: server connections saturated (200/200 active, 58 queued)
[ERROR] 2026-11-06 03:12:06 [payments-api] pgxpool: acquire connection failed: context deadline exceeded"""
    
    r = client.post("/api/analyze", json={
        "alert": alert_sample,
        "logs": logs_sample,
        "memory_enabled": True
    })
    assert r.status_code == 200, f"Analyze failed: {r.text}"
    analysis = r.json()
    print(f" -> Diagnosis: {analysis['diagnosis'][:70]}...")
    print(f" -> Confidence: {analysis['confidence']}%")
    print(f" -> Matched Incidents: {[m['id'] for m in analysis['matched_incidents']]}")
    print(f" -> Avoid Steps: {[a['step'] + ' (' + a['source_incident'] + ')' for a in analysis['avoid']]}")
    print(f" -> Recommended Steps: {analysis['recommended_steps'][:2]}")
    print(f" -> Estimated Minutes: {analysis['estimated_minutes']}m")

    # 8. Record Outcome (Resolve and learn)
    print("\n[8/9] Testing POST /api/outcome...")
    r = client.post("/api/outcome", json={
        "incident_id": "DEMO-001",
        "worked": ["Terminated blocking PID", "Increased pgbouncer default pool size to 250"],
        "failed": [{"step": "Restart pods", "reason": "Flooded DB handshakes"}],
        "minutes": 14,
        "notes": "Fast resolution using past INC-001 / INC-014 playbook.",
        "service": "checkout-service",
        "alert": alert_sample,
        "logs": logs_sample,
        "root_cause": "Postgres connection pool exhaustion"
    })
    assert r.status_code == 200, f"Record outcome failed: {r.text}"
    outcome_resp = r.json()
    print(f" -> OK: {outcome_resp}")

    # 9. Reset Demo Data
    print("\n[9/9] Testing POST /api/demo/reset...")
    r = client.post("/api/demo/reset")
    assert r.status_code == 200, f"Reset demo failed: {r.text}"
    print(f" -> OK: {r.json()}")

    print("\n" + "=" * 65)
    print("ALL 9 API ENDPOINTS VALIDATED SUCCESSFULLY!")
    print("=" * 65)

if __name__ == "__main__":
    test_endpoints()
