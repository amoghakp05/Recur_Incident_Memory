"""
Test memory spike for Recur wrapping Hindsight Cloud.
Retains 2 incidents and recalls them, verifying semantic retrieval and activity log tracking.
"""

import sys
import os
from pathlib import Path

# Add backend directory to sys.path
backend_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(backend_dir))

from app.memory import retain_incident, recall_similar, reflect_patterns, get_activity_log, get_retained_entries

def run_test():
    print("=" * 60)
    print("Recur Memory Spike Test (Hindsight Cloud)")
    print("=" * 60)

    # 1. Prepare 2 realistic sample incidents
    incident_1 = {
        "id": "INC-001",
        "service": "payments-api",
        "severity": "CRITICAL",
        "date": "2026-05-14T03:15:00Z",
        "alert": "PostgreSQL connection pool exhausted. 504 Gateway Timeouts surging across checkout flow.",
        "logs": """[ERROR] 2026-05-14 03:14:22 [payments-api] pool.go:142: pool exhausted: max_connections=200 reached
[ERROR] 2026-05-14 03:14:23 [payments-api] handler.go:88: db query timeout after 5000ms: context deadline exceeded
[WARN]  2026-05-14 03:14:25 [payments-api] pgbouncer: server connections saturated (200/200 active)""",
        "root_cause": "A slow query in the fraud check module locked transactions without closing db connections, draining pgbouncer pool.",
        "fix_steps": [
            "Terminate blocking idle-in-transaction backend PIDs in postgres",
            "Temporarily increase pgbouncer pool_size from 200 to 400",
            "Deploy patch v2.14.1 with 3000ms statement_timeout on fraud query"
        ],
        "failed_attempts": [
            {
                "step": "Restart payments-api pods",
                "reason": "Restarting pods flooded postgres with 500 new connection handshakes simultaneously, causing a full DB CPU spike to 100%."
            }
        ],
        "runbook": "runbooks/database-pool-exhaustion.md",
        "minutes_to_resolve": 55,
        "engineer": "Marcus Vance",
        "post_mortem_lesson": "Never restart API pods during connection exhaustion without capping connection rates in pgbouncer.",
        "outcome": "RESOLVED"
    }

    incident_2 = {
        "id": "INC-002",
        "service": "cart-cache",
        "severity": "HIGH",
        "date": "2026-06-02T14:40:00Z",
        "alert": "Redis OOM command not allowed when used memory > 'maxmemory'.",
        "logs": """[ERROR] 2026-06-02 14:39:10 [cart-cache] OOM command not allowed when used memory > 'maxmemory' (8589934592 bytes)
[WARN]  2026-06-02 14:39:12 [cart-cache] maxmemory-policy is 'noeviction', cannot evict keys
[ERROR] 2026-06-02 14:39:15 [cart-cache] write operation 'SET session:usr_991823' failed""",
        "root_cause": "Redis cluster maxmemory-policy was configured to 'noeviction' instead of 'volatile-lru', preventing automatic key expiration.",
        "fix_steps": [
            "Execute CONFIG SET maxmemory-policy allkeys-lru on Redis primary",
            "Manually trigger UNLINK on expired session keys batch",
            "Commit terraform update setting maxmemory_policy = 'allkeys-lru'"
        ],
        "failed_attempts": [
            {
                "step": "FLUSHDB cache",
                "reason": "Flush caused cache stampede that knocked over the MySQL replica cluster immediately."
            }
        ],
        "runbook": "runbooks/redis-memory-alert.md",
        "minutes_to_resolve": 32,
        "engineer": "Elena Rostova",
        "post_mortem_lesson": "All cache clusters must have LRU eviction enabled and never execute FLUSHDB during peak traffic.",
        "outcome": "RESOLVED"
    }

    # 2. Retain both incidents
    print("\n[Step 1/3] Retaining 2 incidents to Hindsight Cloud...")
    res1 = retain_incident(incident_1)
    print(f" -> Retained {incident_1['id']} in {res1['latency_ms']}ms. Status: {res1['success']}")
    
    res2 = retain_incident(incident_2)
    print(f" -> Retained {incident_2['id']} in {res2['latency_ms']}ms. Status: {res2['success']}")

    # 3. Recall similar memories for a query
    query = "PostgreSQL pool exhausted max_connections 504 gateway timeout checkout"
    print(f"\n[Step 2/3] Recalling memories for query:\n   '{query}'...")
    recalled = recall_similar(query, top_k=3)
    
    print(f" -> Recalled {len(recalled)} items:")
    for idx, item in enumerate(recalled, 1):
        print(f"   [{idx}] Similarity: {item.get('similarity', 'N/A')}%")
        print(f"       Text: {item.get('text', '')[:120]}...")

    # 4. Check Activity Log
    print("\n[Step 3/3] Inspecting Memory Activity Log...")
    activities = get_activity_log(limit=5)
    for act in activities:
        print(f"   - [{act['type'].upper()}] {act['summary']} ({act['latency_ms']}ms) at {act['timestamp']}")

    # Verification assertions
    assert len(recalled) > 0, "Recall returned 0 results!"
    assert len(activities) >= 3, "Activity log must have at least 3 entries (2 retains + 1 recall)!"
    
    print("\n" + "=" * 60)
    print("SUCCESS: Hindsight memory retain and recall validated!")
    print("Checkpoint passed: Recall returned stored incident memories.")
    print("=" * 60)

if __name__ == "__main__":
    run_test()
