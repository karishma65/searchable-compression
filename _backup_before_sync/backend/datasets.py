import os
import sys
import random
import datetime
from typing import Dict, List, Any, Optional

# Ensure project root is in sys.path
_current_dir = os.path.dirname(os.path.abspath(__file__))
_project_root = os.path.abspath(os.path.join(_current_dir, ".."))
if _project_root not in sys.path:
    sys.path.insert(0, _project_root)
if _current_dir not in sys.path:
    sys.path.insert(0, _current_dir)

try:
    from backend.indexing.log_parser import LogParser, LogEntry
except (ImportError, ModuleNotFoundError):
    try:
        from indexing.log_parser import LogParser, LogEntry
    except (ImportError, ModuleNotFoundError):
        from .indexing.log_parser import LogParser, LogEntry

class DatasetManager:
    """
    Manages in-memory and persistent datasets of Kubernetes/Cloud logs.
    Includes built-in realistic cloud log generator with target research queries.
    """

    SERVICES = [
        "auth-service", "database-service", "payment-service", 
        "order-processor", "ingress-controller", "inventory-service", 
        "notification-worker", "analytics-pipeline", "redis-cache"
    ]

    LEVELS = ["INFO", "INFO", "INFO", "WARN", "ERROR", "DEBUG", "FATAL"]

    ERROR_TEMPLATES = [
        ("database-service", "ERROR", "Connection pool exhausted: database-service connection timeout after 3000ms"),
        ("database-service", "ERROR", "Query execution failed: connection timeout trying to reach replica node-2"),
        ("database-service", "WARN", "Slow query detected (>1200ms) on table 'user_sessions'"),
        ("auth-service", "ERROR", "JWT validation failed: signature verification timeout contacting keystore"),
        ("auth-service", "INFO", "User token issued for session id 9812-7634-12"),
        ("payment-service", "ERROR", "Upstream gateway connection refused: payment-service aborted transaction"),
        ("order-processor", "WARN", "Retry attempt 2/3 for order id ORD-99214 failed due to database-service latency"),
        ("ingress-controller", "INFO", "HTTP 200 GET /api/v1/health from client 10.244.1.4"),
        ("ingress-controller", "WARN", "HTTP 504 Gateway Timeout: backend database-service unresponsive"),
        ("inventory-service", "INFO", "Stock reservation updated for sku-9912"),
        ("redis-cache", "WARN", "Memory usage reached 85% of maxmemory limit"),
        ("redis-cache", "ERROR", "Read timeout while executing MGET against master shard"),
        ("notification-worker", "INFO", "Dispatched 45 push notifications in 23ms"),
        ("analytics-pipeline", "INFO", "Processed 12,500 event records successfully")
    ]

    def __init__(self, storage_dir: str = "backend/data"):
        self.storage_dir = storage_dir
        os.makedirs(storage_dir, exist_ok=True)
        self.datasets: Dict[str, Dict[str, Any]] = {}
        # Prepopulate with a default synthetic dataset if none exists
        self.generate_k8s_sample_dataset(name="k8s-cluster-production.log", line_count=1500)

    def generate_k8s_sample_dataset(self, name: str = "k8s-cluster-production.log", line_count: int = 1500) -> Dict[str, Any]:
        """Generates realistic structured Kubernetes logs for immediate experimentation."""
        start_time = datetime.datetime(2026, 10, 8, 10, 0, 0)
        lines = []

        for i in range(line_count):
            curr_time = start_time + datetime.timedelta(milliseconds=i * 120 + random.randint(0, 50))
            ts_str = curr_time.strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3] + "Z"

            # Occasionally inject specific research query patterns (e.g. database-service + timeout)
            if i % 15 == 0:
                svc = "database-service"
                lvl = "ERROR"
                msg = f"database-service connection timeout after {random.randint(3000, 5000)}ms while executing commit"
            elif i % 25 == 0:
                svc = "auth-service"
                lvl = "ERROR"
                msg = f"auth-service timeout waiting for database-service user query response"
            else:
                tmpl = random.choice(self.ERROR_TEMPLATES)
                svc = tmpl[0]
                lvl = tmpl[1]
                msg = tmpl[2]

            pod_hash = f"{svc}-{random.randint(100, 999)}-{random.randint(10000, 99999)}"
            trace_id = f"trace-{random.randint(100000, 999999)}"

            # Format: standard K8s log line
            line = f"{ts_str} {lvl} [{svc}] [pod/{pod_hash}] [trace:{trace_id}] {msg}"
            lines.append(line)

        content = "\n".join(lines) + "\n"
        file_path = os.path.join(self.storage_dir, name)
        with open(file_path, "w", encoding="utf-8") as f:
            f.write(content)

        return self.register_dataset(name, content, source="Generated K8s Production Logs")

    def register_dataset(self, name: str, content: str, source: str = "Uploaded") -> Dict[str, Any]:
        entries = LogParser.parse_content(content)
        raw_bytes = content.encode('utf-8')

        services = sorted(list(set(e.service for e in entries if e.service)))
        levels = {}
        for e in entries:
            levels[e.level] = levels.get(e.level, 0) + 1

        dataset_info = {
            "name": name,
            "source": source,
            "line_count": len(entries),
            "size_bytes": len(raw_bytes),
            "size_kb": round(len(raw_bytes) / 1024, 2),
            "size_mb": round(len(raw_bytes) / (1024 * 1024), 3),
            "unique_services": services,
            "level_distribution": levels,
            "first_timestamp": entries[0].timestamp if entries else "",
            "last_timestamp": entries[-1].timestamp if entries else "",
            "sample_lines": [e.raw for e in entries[:8]],
            "raw_content": content,
            "entries": entries
        }

        self.datasets[name] = dataset_info
        return {k: v for k, v in dataset_info.items() if k not in ("raw_content", "entries")}

    def get_dataset(self, name: str) -> Optional[Dict[str, Any]]:
        return self.datasets.get(name)

    def list_datasets(self) -> List[Dict[str, Any]]:
        return [
            {k: v for k, v in data.items() if k not in ("raw_content", "entries")}
            for data in self.datasets.values()
        ]
