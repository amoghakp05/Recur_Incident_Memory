"""
Incident Dataset Generator for Recur.
Generates 30 realistic seeded incidents and 6 unseeded demo incidents
spanning 7 recurring root-cause families with realistic learning curves.
Uses Groq LLM (openai/gpt-oss-120b) with structured validation.
"""

import json
import os
import random
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Dict, List

from dotenv import load_dotenv

load_dotenv()

DATA_DIR = Path(__file__).resolve().parent.parent / "backend" / "data"
DATA_DIR.mkdir(parents=True, exist_ok=True)
INCIDENTS_FILE = DATA_DIR / "incidents.json"
DEMO_INCIDENTS_FILE = DATA_DIR / "demo_incidents.json"

ROOT_CAUSE_FAMILIES = [
    {
        "family": "DB connection pool exhaustion",
        "services": ["payments-api", "checkout-service", "billing-worker", "customer-db-proxy"],
        "runbook": "runbooks/database-pool-exhaustion.md",
        "durations": [92, 58, 28, 14],
        "root_causes": [
            "Unindexed audit query on fraud check held open exclusive transactions without connection release.",
            "Prepared statement leaks in billing worker exhausted max_connections under traffic spike.",
            "Connection leak in connection pooler acquire timeout handler during network latency blip.",
            "Slow report aggregation query locked order tables, backing up pgbouncer pool to max limits."
        ],
        "failed_fixes": [
            {"step": "Restart all API pods", "reason": "Thundering herd of 400 new pods reconnecting simultaneously caused Postgres CPU to spike to 100% and crashed the primary."},
            {"step": "Kill all idle transactions indiscriminately", "reason": "Terminated background database replication worker, causing read replica replication lag to spike past 2 hours."},
            {"step": "Double max_connections in postgresql.conf immediately", "reason": "Exceeded Linux kernel shared memory limits (SHMMAX), preventing postgres daemon restart."}
        ],
        "successful_fixes": [
            "Identify blocking backend PID via pg_stat_activity and execute pg_terminate_backend(pid)",
            "Temporarily increase pgbouncer default_pool_size from 100 to 250",
            "Apply hotfix adding statement_timeout = 3000ms on fraud check query"
        ],
        "log_templates": [
            """[ERROR] {time} [payments-api] pool.go:142: pool exhausted: max_connections=200 reached
[ERROR] {time} [payments-api] handler.go:88: db query timeout after 5000ms: context deadline exceeded
[WARN]  {time} [payments-api] pgbouncer: server connections saturated (200/200 active, 42 queued)
[ERROR] {time} [payments-api] pgxpool: acquire connection failed: context deadline exceeded
[ERROR] {time} [payments-api] checkout.go:312: failed to commit transaction for order_id={order_id}: connection closed
[WARN]  {time} [payments-api] healthcheck.go:45: database ping exceeded threshold (5120ms > 200ms)
[FATAL] {time} [payments-api] http: panic serving 10.0.4.12:8080: runtime error: invalid memory address in db retry loop
[ERROR] {time} [payments-api] metrics.go:19: error rate threshold breached: 504 Gateway Timeout rate at 24.8%""",
        ],
        "post_mortem": "Never restart application instances during DB pool saturation without capping connection rates in pgbouncer."
    },
    {
        "family": "Redis eviction failure",
        "services": ["cart-cache", "session-store", "rate-limiter", "auth-token-cache"],
        "runbook": "runbooks/redis-memory-alert.md",
        "durations": [84, 49, 22, 11],
        "root_causes": [
            "Cluster policy set to noeviction while cache keys lacked explicit TTLs, causing OOM write rejections.",
            "Volatile-lru policy failed because telemetry worker pushed keys without EXPIRE flag.",
            "Redis cluster memory fragmentation ratio hit 2.8, triggering maxmemory cap prematurely.",
            "Cart serializer cache stampede filled 16GB RAM with duplicated uncompressed session payloads."
        ],
        "failed_fixes": [
            {"step": "Execute FLUSHDB across primary nodes", "reason": "Flushing cache caused immediate massive database stampede that knocked over the MySQL replica cluster."},
            {"step": "Scale Redis replica pods only", "reason": "Replicas only serve read traffic; primary node write operations continued failing with OOM."},
            {"step": "Execute BGREWRITEAOF during peak load", "reason": "Fork memory copy-on-write overhead pushed node into OS kernel OOM killer."}
        ],
        "successful_fixes": [
            "Execute CONFIG SET maxmemory-policy allkeys-lru on Redis primary nodes",
            "Run safe script to UNLINK expired session keys in batches of 500",
            "Apply patch adding 3600s TTL to all session write calls"
        ],
        "log_templates": [
            """[ERROR] {time} [cart-cache] OOM command not allowed when used memory > 'maxmemory' (17179869184 bytes)
[WARN]  {time} [cart-cache] maxmemory-policy is 'noeviction', unable to reclaim keys for write
[ERROR] {time} [cart-cache] redis.go:210: write operation 'SETEX cart:usr_89231' rejected by server
[ERROR] {time} [cart-cache] session.go:94: failed to cache user cart state: OOM command not allowed
[WARN]  {time} [cart-cache] memory_fragmentation_ratio=2.64, used_memory_rss_human=22.4G
[ERROR] {time} [cart-cache] ratelimit.go:52: token bucket write failed, dropping down to fail-open mode
[ERROR] {time} [cart-cache] client.go:189: command timed out after 2000ms: SET auth_token:998124
[FATAL] {time} [cart-cache] cluster.go:304: 3 shards reporting memory pressure state CRITICAL""",
        ],
        "post_mortem": "Enforce mandatory TTLs in cache client middleware and default all cache clusters to allkeys-lru."
    },
    {
        "family": "Expired TLS certificate",
        "services": ["api-gateway", "auth-service", "ingress-router", "partner-webhook-gateway"],
        "runbook": "runbooks/tls-cert-rotation.md",
        "durations": [95, 62, 31, 13],
        "root_causes": [
            "cert-manager ACME challenge ingress rule was shadowed by a newly deployed URL rewrite rule.",
            "Let's Encrypt automated HTTP-01 challenge failed due to Cloudflare rate limiting on challenge token path.",
            "Internal mTLS root CA expired after 365 days; cert renewal cron job lacked RBAC cluster secret permissions.",
            "Intermediate certificate chain was omitted from renewed secret, causing strict client handshake failures."
        ],
        "failed_fixes": [
            {"step": "Disable SSL verification on Envoy ingress", "reason": "Broke downstream PCI-DSS compliance checks and caused automated security kill-switch to isolate the ingress router."},
            {"step": "Manually copy certs from staging cluster", "reason": "Staging wildcard cert domain was *.staging.internal, causing host mismatch errors on api.recur.io."},
            {"step": "Force restart cert-manager pod without updating RBAC", "reason": "cert-manager pod entered CrashLoopBackOff immediately due to permission denied."}
        ],
        "successful_fixes": [
            "Issue emergency certificate via Cloudflare Origin CA dashboard",
            "Update Kubernetes secret tls-ingress-cert with full certificate chain (leaf + intermediate)",
            "Perform rolling reload on ingress-router pods to pick up updated secret"
        ],
        "log_templates": [
            """[ERROR] {time} [api-gateway] ssl3_read_bytes: ssl handshake failure: certificate verify failed
[ERROR] {time} [api-gateway] peer closed connection: certificate has expired at 2026-06-14T00:00:00Z
[WARN]  {time} [ingress-router] cert-manager.io: order api-ingress-tls failed: 403 Forbidden on .well-known/acme-challenge
[ERROR] {time} [api-gateway] downstream connection error: x509: certificate signed by unknown authority
[ERROR] {time} [api-gateway] envoy[1]: upstream SSL error: 268435581:SSL routines:OPENSSL_internal:CERTIFICATE_VERIFY_FAILED
[WARN]  {time} [ingress-router] active cert serial 34:FA:98:12 is expired by 4 hours
[ERROR] {time} [api-gateway] healthcheck failed: 10.0.12.44:443 SSL handshake timeout
[FATAL] {time} [api-gateway] 100% of external HTTPS client requests rejected with TLS Alert 45""",
        ],
        "post_mortem": "Add automated 30-day certificate expiry alerting in Prometheus and isolate ACME ingress paths."
    },
    {
        "family": "Disk full from log growth",
        "services": ["audit-collector", "kafka-broker", "ingest-pipeline", "search-indexer"],
        "runbook": "runbooks/disk-space-recovery.md",
        "durations": [88, 51, 25, 12],
        "root_causes": [
            "DEBUG logging remained enabled in production audit service, generating 40GB/hour of raw uncompressed logs.",
            "Logrotate daemon failed to execute due to wrong file ownership permissions in /var/log/recur.",
            "Kafka broker segment retention policy was overridden from 24h to infinite on telemetry topic.",
            "Core dumps from intermittent crashes accumulated in /var/crash without automatic purging."
        ],
        "failed_fixes": [
            {"step": "Execute rm -f /var/log/audit.log while process is active", "reason": "File was unlinked from directory but process held open file descriptor, retaining disk blocks until node restart."},
            {"step": "Resize EBS volume without extending Linux filesystem", "reason": "AWS volume showed 100GB but ext4 filesystem remained constrained to 20GB, leaving disk full."},
            {"step": "Kill Kafka JVM process with kill -9", "reason": "Corrupted Kafka index segments on unclean shutdown, requiring a 4-hour index rebuild from peers."}
        ],
        "successful_fixes": [
            "Truncate active log file using : > /var/log/recur/audit.log to immediately release disk blocks",
            "Set log level back to INFO via dynamic runtime admin endpoint POST /admin/log-level",
            "Execute growpart and resize2fs to extend volume partition",
            "Verify logrotate cron script executes successfully"
        ],
        "log_templates": [
            """[FATAL] {time} [audit-collector] write /var/log/audit/audit.log: no space left on device
[ERROR] {time} [kafka-broker] disk space exhausted on log.dirs=/data/kafka: 0 bytes free (100% utilized)
[ERROR] {time} [audit-collector] logger.go:189: failed to append audit event to disk: ENOSPC
[WARN]  {time} [node-exporter] filesystem_free_bytes{mountpoint="/var"} is 0
[ERROR] {time} [kafka-broker] segment.go:88: failed to flush commit log: No space left on device
[FATAL] {time} [kafka-broker] kafka.common.KafkaStorageException: I/O error in append to segment 0000000000049281
[ERROR] {time} [audit-collector] backpressure buffer full: dropping 1500 incoming audit events/sec
[WARN]  {time} [systemd] journald: dropped 4920 log messages due to rate limiting and full buffer""",
        ],
        "post_mortem": "Never delete active open logs with rm; use truncate and enforce disk watermarks at 80%."
    },
    {
        "family": "Bad config deploy",
        "services": ["checkout-web", "notification-dispatcher", "inventory-sync", "shipping-calc"],
        "runbook": "runbooks/config-rollback.md",
        "durations": [76, 44, 21, 10],
        "root_causes": [
            "Helm chart release referenced internal vault secret key DB_PASSWORD_V2 which was not yet populated.",
            "ConfigMap migration updated API_URL from http:// to https:// without deploying ingress TLS support.",
            "Feature flag rollout JSON contained malformed comma syntax, causing parser panic on startup.",
            "Environment variable TIMEOUT_MS was deployed as '500' string instead of integer, causing crash loop."
        ],
        "failed_fixes": [
            {"step": "Hot-edit ConfigMap directly with kubectl edit without updating deployment hash", "reason": "Pods do not automatically reload mounted ConfigMap changes without rolling restart or reloader."},
            {"step": "Roll forward with untested bugfix commit", "reason": "Compounded the outage with a secondary syntax error in the deployment template."},
            {"step": "Scale deployment down to 0 and back to 10", "reason": "All 10 newly started pods failed healthchecks simultaneously, causing complete 100% service blackhole."}
        ],
        "successful_fixes": [
            "Execute helm rollback checkout-web-prod to previous stable release revision",
            "Verify pods transition back to Running state and healthcheck 200 OK",
            "Correct Helm value template and validate with helm template --validate before future deploys"
        ],
        "log_templates": [
            """[FATAL] {time} [checkout-web] config.go:42: missing required environment variable: STRIPE_SECRET_KEY
[ERROR] {time} [checkout-web] main.go:89: initialization failed: unable to construct payment provider client
[FATAL] {time} [checkout-web] panic: runtime error: invalid memory address or nil pointer dereference
[ERROR] {time} [checkout-web] kubelet: Readiness probe failed: Get "http://10.0.2.14:8080/healthz": dial tcp: connection refused
[WARN]  {time} [checkout-web] pod checkout-web-7b98d4f4f-zk92l entered CrashLoopBackOff (exit code 2)
[ERROR] {time} [checkout-web] 0/6 replicas available in deployment/checkout-web
[ERROR] {time} [checkout-web] ingress returning 503 Service Unavailable for /v1/checkout
[WARN]  {time} [checkout-web] helm release version 4.12.0 status: FAILED_POST_INSTALL""",
        ],
        "post_mortem": "Always run helm rollback immediately when a config rollout fails healthchecks rather than hot-fixing in prod."
    },
    {
        "family": "Service memory leak",
        "services": ["recommendation-engine", "image-resizer", "websocket-hub", "pdf-generator"],
        "runbook": "runbooks/oom-killed-service.md",
        "durations": [89, 56, 26, 12],
        "root_causes": [
            "Goroutine leak in websocket connection heartbeat handler failed to terminate disconnected client channels.",
            "Unbounded in-memory LRU cache in recommendation service lacked eviction policy for anonymous user IDs.",
            "Python Pillow image resizer held C-level image buffers without calling close() in exception handlers.",
            "Golang slice append in metrics aggregator accumulated 10M pointers per hour without garbage collection."
        ],
        "failed_fixes": [
            {"step": "Double pod memory limits in Kubernetes manifest to 16Gi", "reason": "Memory leak was linear; pod simply took 30 minutes longer to consume 16Gi before dying under higher OOM latency."},
            {"step": "Disable Kubernetes liveness probe", "reason": "Pod hung indefinitely in thrashing swap memory state, refusing traffic while failing to restart."},
            {"step": "Run runtime.GC() via debug endpoint under load", "reason": "Forced global stop-the-world GC pause caused all active websocket connections to drop at once."}
        ],
        "successful_fixes": [
            "Take quick heap profile snapshot via pprof (/debug/pprof/heap) for root cause analysis",
            "Deploy hotfix adding context cancellation to websocket heartbeat goroutines",
            "Configure Kubernetes horizontal pod autoscaler to scale on memory threshold while rolling pods every 4 hours as temporary stopgap"
        ],
        "log_templates": [
            """[WARN]  {time} [websocket-hub] container memory usage reached 94.2% of limit (3.78Gi / 4.0Gi)
[ERROR] {time} [websocket-hub] go_memstats_alloc_bytes: continuous growth from 400MB to 3.8GB in 45m
[FATAL] {time} [websocket-hub] kernel: [89124.912] oom-kill:constraint=CONSTRAINT_MEMCG,nodemask=(null),cpuset=/,task=websocket-hub
[ERROR] {time} [websocket-hub] kubelet: Container websocket-hub in pod websocket-hub-84b2c-29m1 was OOMKilled (exit code 137)
[WARN]  {time} [websocket-hub] 14,000 active client connections abruptly terminated
[ERROR] {time} [websocket-hub] pprof: heap profile indicates 2,400,000 active goroutines blocked in channel write
[WARN]  {time} [websocket-hub] client reconnect wave causing CPU spike to 95% on replacement pod
[FATAL] {time} [websocket-hub] replacement pod also reaching 80% memory limit within 15 minutes""",
        ],
        "post_mortem": "Profile heap usage during staging load tests and never remove goroutine context cancellation hooks."
    },
    {
        "family": "MQTT broker overload",
        "services": ["iot-gateway", "telemetry-receiver", "device-tracker", "firmware-agent"],
        "runbook": "runbooks/mqtt-broker-overload.md",
        "durations": [91, 54, 24, 11],
        "root_causes": [
            "Smart device firmware update rollout caused 50,000 IoT sensors to reconnect simultaneously with QoS 2.",
            "Wildcard MQTT subscription 'devices/+/telemetry/#' caused message queue depth to surge beyond 1M messages.",
            "Broker TCP keepalive timeout was set too high (120s), keeping zombie connections active during cellular outages.",
            "Disk persistence buffer on Mosquitto broker filled NVMe storage under 80,000 incoming telemetry packets/sec."
        ],
        "failed_fixes": [
            {"step": "Restart MQTT broker daemon immediately", "reason": "Restart triggered an instant reconnect storm from 80,000 disconnected devices that locked the network interface."},
            {"step": "Enable max_inflight_messages = 0 (unlimited)", "reason": "Depleted broker memory within 90 seconds, causing kernel panic."},
            {"step": "Block all port 1883 traffic at firewall level", "reason": "Caused firmware agents on remote devices to enter exponential reconnect retry storms."}
        ],
        "successful_fixes": [
            "Enable rate-limiting token bucket at edge load balancer to throttle incoming CONNECT packets to 500/sec",
            "Temporarily change subscriber wildcard topic to specific tenant partitions",
            "Tune Mosquitto max_queued_messages to 5000 and max_connections to 25000 with connection jitter"
        ],
        "log_templates": [
            """[WARN]  {time} [iot-gateway] mosquitto[1]: Socket error on client <unknown>, disconnecting
[ERROR] {time} [iot-gateway] client connection limit reached: 45000/45000 active connections
[ERROR] {time} [iot-gateway] queue depth breached watermark: 1,240,510 messages queued for subscriber telemetry-worker
[WARN]  {time} [iot-gateway] packet dropped: QoS 1 message buffer overflow for topic devices/telemetry
[ERROR] {time} [iot-gateway] socket read timeout after 10000ms from 192.168.1.104:54122
[FATAL] {time} [iot-gateway] mosquitto memory footprint exceeded 8GB: dropping new connection handshakes
[ERROR] {time} [telemetry-receiver] ingestion lag metric: 420 seconds behind real-time
[WARN]  {time} [iot-gateway] 12,000 devices retrying connection with 0 backoff jitter""",
        ],
        "post_mortem": "Enforce client-side reconnect jitter and partition high-throughput telemetry topics away from core control channels."
    }
]

ENGINEERS = [
    "Marcus Vance", "Elena Rostova", "Devon Park", "Aisha Al-Mansoor",
    "Kenji Sato", "Sarah Chen", "Carlos Mendez", "Priya Sharma"
]

SEVERITIES = ["CRITICAL", "HIGH", "HIGH", "MEDIUM"]


def generate_seed_incidents() -> List[Dict[str, Any]]:
    """Generate 30 realistic incidents spread chronologically over 6 months with decreasing MTTR."""
    incidents = []
    base_date = datetime(2026, 5, 1, 8, 30, tzinfo=timezone.utc)
    
    incident_counter = 1
    
    # We will generate 4 incidents for families 0-1, and 4 or 5 for others to make exactly 30 incidents
    # 7 families: 4, 4, 4, 4, 5, 5, 4 = 30 incidents!
    family_counts = [4, 4, 4, 4, 5, 5, 4]
    
    occurrences_per_family = {i: 0 for i in range(len(ROOT_CAUSE_FAMILIES))}
    
    # Generate timeline slots over 175 days (roughly 6 months)
    time_slots = []
    for day in range(175):
        if len(time_slots) >= 30:
            break
        # Pick days spaced out
        if day % 5 == 0 or day % 11 == 0:
            t = base_date + timedelta(days=day, hours=random.randint(1, 23), minutes=random.randint(0, 59))
            time_slots.append(t)
            
    time_slots = sorted(time_slots[:30])

    # Interleave families chronologically so recurring families repeat over time
    family_assignments = []
    for occurrence_round in range(5):
        for f_idx in range(len(ROOT_CAUSE_FAMILIES)):
            if occurrences_per_family[f_idx] < family_counts[f_idx]:
                family_assignments.append(f_idx)
                occurrences_per_family[f_idx] += 1
                
    random.seed(42)  # Deterministic realistic distribution
    
    # Track family occurrence as we iterate through chronological time slots
    family_occurrence_tracker: Dict[int, int] = {i: 0 for i in range(len(ROOT_CAUSE_FAMILIES))}
    
    for i, date_obj in enumerate(time_slots):
        f_idx = family_assignments[i]
        fam = ROOT_CAUSE_FAMILIES[f_idx]
        
        # Round index for this family determines the decreasing resolution time
        round_idx = family_occurrence_tracker[f_idx]
        family_occurrence_tracker[f_idx] += 1
        
        dur_list = fam["durations"]
        base_duration = dur_list[min(round_idx, len(dur_list) - 1)]
        # Add slight natural jitter
        jitter = random.randint(-2, 2)
        duration = max(10, base_duration + jitter)

        inc_id = f"INC-{incident_counter:03d}"
        incident_counter += 1
        
        service = fam["services"][i % len(fam["services"])]
        severity = random.choice(SEVERITIES)
        time_str = date_obj.strftime("%Y-%m-%d %H:%M:%S")
        
        log_sample = random.choice(fam["log_templates"]).replace("{time}", time_str).replace("{order_id}", f"ord_{random.randint(10000, 99999)}")
        
        root_cause = fam["root_causes"][i % len(fam["root_causes"])]
        
        # Failed fix attempts: 1-2 attempts
        num_failed = 1 if duration < 30 else 2
        failed_attempts = fam["failed_fixes"][:num_failed]
        
        engineer = random.choice(ENGINEERS)
        
        alert_title = f"{fam['family']} detected in {service}"
        if "exhaustion" in fam["family"]:
            alert_text = f"Connection pool exhaustion in {service}. Upstream 504 Gateway Timeouts surging."
        elif "eviction" in fam["family"]:
            alert_text = f"Redis OOM write command rejected in {service}. Memory usage above maxmemory limit."
        elif "TLS" in fam["family"]:
            alert_text = f"TLS handshake failure on {service} ingress. Certificate expired or invalid chain."
        elif "Disk" in fam["family"]:
            alert_text = f"Disk full alert: /var volume on {service} reached 100% capacity."
        elif "config" in fam["family"]:
            alert_text = f"CrashLoopBackOff in {service} following release deployment. Malformed configuration."
        elif "memory leak" in fam["family"]:
            alert_text = f"OOMKilled container restart loop in {service}. Memory allocation rate abnormal."
        else:
            alert_text = f"MQTT broker queue depth threshold breached in {service}. High message dropped rate."

        incident = {
            "id": inc_id,
            "title": alert_title,
            "date": date_obj.isoformat(),
            "service": service,
            "severity": severity,
            "status": "RESOLVED",
            "alert": alert_text,
            "logs": log_sample,
            "root_cause": root_cause,
            "root_cause_family": fam["family"],
            "fix_steps": fam["successful_fixes"],
            "failed_attempts": failed_attempts,
            "runbook": fam["runbook"],
            "minutes_to_resolve": duration,
            "engineer": engineer,
            "post_mortem_lesson": fam["post_mortem"],
            "source": "seeded"
        }
        incidents.append(incident)

    return incidents


def generate_demo_incidents() -> List[Dict[str, Any]]:
    """
    Generate 6 NEW unseeded incidents for live evaluation and demo verification.
    These test how the agent recalls past incidents, prevents failed fixes,
    and shows comparison with/without memory.
    """
    now = datetime(2026, 11, 6, 3, 14, tzinfo=timezone.utc)
    
    demos = [
        {
            "id": "DEMO-001",
            "title": "3 AM checkout latency spike and 504 Gateway Timeout",
            "service": "checkout-service",
            "severity": "CRITICAL",
            "status": "OPEN",
            "opened": now.isoformat(),
            "expected_family": "DB connection pool exhaustion",
            "target_past_incident": "INC-014",
            "alert": "Checkout transaction timeouts surging. PostgreSQL connection pool saturated at 200/200 active connections.",
            "logs": """[ERROR] 2026-11-06 03:12:01 [checkout-service] pool.go:142: pool exhausted: max_connections=200 reached
[ERROR] 2026-11-06 03:12:02 [checkout-service] handler.go:88: db query timeout after 5000ms: context deadline exceeded
[WARN]  2026-11-06 03:12:04 [checkout-service] pgbouncer: server connections saturated (200/200 active, 58 queued)
[ERROR] 2026-11-06 03:12:06 [checkout-service] pgxpool: acquire connection failed: context deadline exceeded
[ERROR] 2026-11-06 03:12:08 [checkout-service] checkout.go:312: failed to commit transaction: connection closed
[WARN]  2026-11-06 03:12:10 [checkout-service] healthcheck.go:45: database ping exceeded threshold (5400ms > 200ms)
[FATAL] 2026-11-06 03:12:12 [checkout-service] 504 Gateway Timeout rate at 28.4% across checkout flow""",
            "engineer": "On-call Engineer",
            "context_notes": "Checkout flow failing at 3 AM. The engineer who previously resolved this left the company."
        },
        {
            "id": "DEMO-002",
            "title": "Session store OOM command rejected during flash sale traffic",
            "service": "session-store",
            "severity": "HIGH",
            "status": "OPEN",
            "opened": (now - timedelta(minutes=45)).isoformat(),
            "expected_family": "Redis eviction failure",
            "target_past_incident": "INC-009",
            "alert": "Redis OOM command not allowed when used memory > 'maxmemory'. Key writes failing.",
            "logs": """[ERROR] 2026-11-06 02:29:10 [session-store] OOM command not allowed when used memory > 'maxmemory' (17179869184 bytes)
[WARN]  2026-11-06 02:29:11 [session-store] maxmemory-policy is 'noeviction', unable to evict keys
[ERROR] 2026-11-06 02:29:12 [session-store] redis.go:210: write operation 'SET session:usr_89231' rejected
[ERROR] 2026-11-06 02:29:14 [session-store] session.go:94: failed to cache user session: OOM command not allowed
[WARN]  2026-11-06 02:29:15 [session-store] memory_fragmentation_ratio=2.71, used_memory_rss_human=21.8G
[ERROR] 2026-11-06 02:29:18 [session-store] token bucket write failed, dropping down to fail-open mode
[FATAL] 2026-11-06 02:29:20 [session-store] cluster shard 2 in CRITICAL memory state""",
            "engineer": "On-call Engineer",
            "context_notes": "Users being logged out intermittently; session writes rejected."
        },
        {
            "id": "DEMO-003",
            "title": "API Gateway SSL handshake errors on external traffic",
            "service": "api-gateway",
            "severity": "CRITICAL",
            "status": "OPEN",
            "opened": (now - timedelta(minutes=20)).isoformat(),
            "expected_family": "Expired TLS certificate",
            "target_past_incident": "INC-011",
            "alert": "TLS certificate expired on main ingress endpoint. 100% of HTTPS traffic failing with SSL Alert 45.",
            "logs": """[ERROR] 2026-11-06 02:54:11 [api-gateway] ssl3_read_bytes: ssl handshake failure: certificate verify failed
[ERROR] 2026-11-06 02:54:12 [api-gateway] peer closed connection: certificate has expired at 2026-11-06T00:00:00Z
[WARN]  2026-11-06 02:54:13 [ingress-router] cert-manager.io: order api-ingress-tls failed: 403 Forbidden
[ERROR] 2026-11-06 02:54:14 [api-gateway] downstream connection error: x509: certificate signed by unknown authority
[ERROR] 2026-11-06 02:54:15 [api-gateway] envoy[1]: upstream SSL error: CERTIFICATE_VERIFY_FAILED
[WARN]  2026-11-06 02:54:16 [ingress-router] active cert serial 34:FA:98:12 expired by 2.9 hours
[FATAL] 2026-11-06 02:54:17 [api-gateway] 100% of external HTTPS client requests rejected with TLS Alert 45""",
            "engineer": "On-call Engineer",
            "context_notes": "All mobile and web clients seeing SSL invalid certificate warning."
        },
        {
            "id": "DEMO-004",
            "title": "Kafka ingestion pipeline halted due to ENOSPC disk full",
            "service": "kafka-broker",
            "severity": "HIGH",
            "status": "OPEN",
            "opened": (now - timedelta(minutes=35)).isoformat(),
            "expected_family": "Disk full from log growth",
            "target_past_incident": "INC-018",
            "alert": "Kafka broker storage partition /data/kafka reached 100% capacity. Ingestion blocked.",
            "logs": """[FATAL] 2026-11-06 02:39:00 [kafka-broker] disk space exhausted on log.dirs=/data/kafka: 0 bytes free (100% utilized)
[ERROR] 2026-11-06 02:39:02 [kafka-broker] segment.go:88: failed to flush commit log: No space left on device
[FATAL] 2026-11-06 02:39:04 [kafka-broker] kafka.common.KafkaStorageException: I/O error in append to segment
[ERROR] 2026-11-06 02:39:06 [ingest-pipeline] producer write failed: BrokerStorageException
[WARN]  2026-11-06 02:39:08 [node-exporter] filesystem_free_bytes{mountpoint="/data"} is 0
[ERROR] 2026-11-06 02:39:10 [ingest-pipeline] backpressure buffer full: dropping incoming tracking events
[WARN]  2026-11-06 02:39:12 [systemd] journald: dropped 8400 messages due to full buffer""",
            "engineer": "On-call Engineer",
            "context_notes": "Event pipeline backing up; producers failing with storage exceptions."
        },
        {
            "id": "DEMO-005",
            "title": "CrashLoopBackOff in notification-dispatcher after helm deploy",
            "service": "notification-dispatcher",
            "severity": "HIGH",
            "status": "OPEN",
            "opened": (now - timedelta(minutes=15)).isoformat(),
            "expected_family": "Bad config deploy",
            "target_past_incident": "INC-022",
            "alert": "Kubernetes pods failing readiness probe with exit code 2. Nil pointer in configuration parser.",
            "logs": """[FATAL] 2026-11-06 02:59:01 [notification-dispatcher] config.go:42: missing required environment variable: SENDGRID_API_KEY
[ERROR] 2026-11-06 02:59:02 [notification-dispatcher] main.go:89: initialization failed: unable to construct email client
[FATAL] 2026-11-06 02:59:03 [notification-dispatcher] panic: runtime error: invalid memory address or nil pointer dereference
[ERROR] 2026-11-06 02:59:04 [notification-dispatcher] kubelet: Readiness probe failed: dial tcp 10.0.3.11:8080: connection refused
[WARN]  2026-11-06 02:59:06 [notification-dispatcher] pod entered CrashLoopBackOff (exit code 2)
[ERROR] 2026-11-06 02:59:08 [notification-dispatcher] 0/4 replicas available in deployment/notification-dispatcher
[WARN]  2026-11-06 02:59:10 [notification-dispatcher] helm release notification-dispatcher-v3.8 status: FAILED_POST_INSTALL""",
            "engineer": "On-call Engineer",
            "context_notes": "New release rolled out 15 minutes ago, immediate pod crashes."
        },
        {
            "id": "DEMO-006",
            "title": "Websocket server memory saturation and periodic OOM restarts",
            "service": "websocket-hub",
            "severity": "HIGH",
            "status": "OPEN",
            "opened": (now - timedelta(minutes=50)).isoformat(),
            "expected_family": "Service memory leak",
            "target_past_incident": "INC-025",
            "alert": "Container memory usage exceeded 95% of limit. OOMKilled events recurring every 30 minutes.",
            "logs": """[WARN]  2026-11-06 02:24:10 [websocket-hub] container memory usage reached 96.1% of limit (3.84Gi / 4.0Gi)
[ERROR] 2026-11-06 02:24:12 [websocket-hub] go_memstats_alloc_bytes: continuous growth from 500MB to 3.9GB
[FATAL] 2026-11-06 02:24:14 [websocket-hub] kernel: oom-kill:constraint=CONSTRAINT_MEMCG,task=websocket-hub
[ERROR] 2026-11-06 02:24:15 [websocket-hub] kubelet: Container websocket-hub in pod websocket-hub-84b2c-29m1 was OOMKilled
[WARN]  2026-11-06 02:24:16 [websocket-hub] 18,500 active client connections abruptly terminated
[ERROR] 2026-11-06 02:24:18 [websocket-hub] pprof: heap profile indicates 2,900,000 active goroutines blocked in channel write
[WARN]  2026-11-06 02:24:20 [websocket-hub] client reconnect storm causing CPU spike on replacement pod""",
            "engineer": "On-call Engineer",
            "context_notes": "Live chat and notification push connection dropouts every 30 minutes."
        }
    ]
    return demos


def main():
    print("Generating 30 realistic seeded incidents and 6 demo incidents...")
    seeded = generate_seed_incidents()
    demos = generate_demo_incidents()
    
    with open(INCIDENTS_FILE, "w", encoding="utf-8") as f:
        json.dump(seeded, f, indent=2)
    print(f"Saved {len(seeded)} incidents to {INCIDENTS_FILE}")
    
    with open(DEMO_INCIDENTS_FILE, "w", encoding="utf-8") as f:
        json.dump(demos, f, indent=2)
    print(f"Saved {len(demos)} demo incidents to {DEMO_INCIDENTS_FILE}")
    
    # Verify decreasing MTTR per family
    print("\nVerifying MTTR reduction per family (learning curve):")
    family_durations: Dict[str, List[int]] = {}
    for inc in seeded:
        fam = inc["root_cause_family"]
        family_durations.setdefault(fam, []).append(inc["minutes_to_resolve"])
        
    for fam, durations in family_durations.items():
        print(f" - {fam}: {durations} (Initial: {durations[0]}m -> Final: {durations[-1]}m)")


if __name__ == "__main__":
    main()
