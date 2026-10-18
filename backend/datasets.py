import os
import sys
import random
import datetime
from typing import Dict, List, Any, Optional

_current_dir = os.path.dirname(os.path.abspath(__file__))
_project_root = os.path.abspath(os.path.join(_current_dir, ".."))
if _project_root not in sys.path:
    sys.path.insert(0, _project_root)

try:
    from backend.indexing.log_parser import LogParser, LogEntry
except (ImportError, ModuleNotFoundError):
    try:
        from indexing.log_parser import LogParser, LogEntry
    except (ImportError, ModuleNotFoundError):
        from .indexing.log_parser import LogParser, LogEntry

class DatasetManager:
    SERVICES = [
        "auth-service", "database-service", "payment-service", 
        "order-processor", "ingress-controller", "inventory-service", 
        "notification-worker", "analytics-pipeline", "redis-cache"
    ]

    ROUTINE_TEMPLATES = [
        ("ingress-controller", "INFO", "HTTP 200 GET /api/v1/health from client 10.244.1.4"),
        ("ingress-controller", "INFO", "HTTP 200 GET /api/v1/catalog response time 14ms"),
        ("order-processor", "INFO", "Processed event checkout confirmed for order ORD-59182"),
        ("order-processor", "INFO", "Order queue worker idle - waiting for messages"),
        ("inventory-service", "INFO", "Stock reservation updated for sku-9912"),
        ("inventory-service", "INFO", "Inventory snapshot verified successfully against catalog"),
        ("notification-worker", "INFO", "Dispatched 45 push notifications in 23ms"),
        ("analytics-pipeline", "INFO", "Processed 12,500 event records successfully"),
        ("auth-service", "INFO", "User token issued for session id 9812-7634-12"),
        ("auth-service", "INFO", "Session refreshed successfully for tenant user-4819")
    ]

    def __init__(self, storage_dir: str = "backend/data"):
        self.storage_dir = storage_dir
        os.makedirs(storage_dir, exist_ok=True)
        self.datasets: Dict[str, Dict[str, Any]] = {}
        
        # Scan storage_dir for existing files
        for fname in os.listdir(storage_dir):
            if fname.endswith(('.log', '.txt', '.csv')):
                fpath = os.path.join(storage_dir, fname)
                try:
                    with open(fpath, "r", encoding="utf-8", errors="replace") as f:
                        content = f.read()
                    source = "Synthetic Test Data" if "bench" in fname or "production" in fname else "Existing File"
                    self.register_dataset(fname, content, source=source)
                except Exception as e:
                    print(f"Error loading {fname}: {e}")

        # If no dataset loaded, generate default sample
        if not self.datasets:
            self.generate_k8s_sample_dataset(name="k8s-cluster-production.log", line_count=1500)

    def generate_k8s_sample_dataset(self, name: str = "k8s-cluster-production.log", line_count: int = 1500) -> Dict[str, Any]:
        start_time = datetime.datetime(2026, 10, 8, 10, 0, 0)
        lines = []

        inc1_start = int(line_count * 0.15)
        inc1_end = int(line_count * 0.28)

        inc2_start = int(line_count * 0.45)
        inc2_end = int(line_count * 0.55)

        inc3_start = int(line_count * 0.72)
        inc3_end = int(line_count * 0.82)

        for i in range(line_count):
            curr_time = start_time + datetime.timedelta(milliseconds=i * 120 + random.randint(0, 50))
            ts_str = curr_time.strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3] + "Z"

            if inc1_start <= i <= inc1_end:
                svc = "database-service"
                lvl = "ERROR" if random.random() < 0.75 else "WARN"
                if lvl == "ERROR":
                    msg = f"database-service connection timeout after {random.randint(3000, 5000)}ms while executing commit"
                else:
                    msg = "Slow query detected (>1200ms) on database-service user_sessions"
            elif inc2_start <= i <= inc2_end:
                svc = "payment-service"
                lvl = "ERROR" if random.random() < 0.7 else "WARN"
                if lvl == "ERROR":
                    msg = "Upstream gateway connection refused: payment-service aborted transaction"
                else:
                    msg = "payment-service retry attempt 2/3 pending bank response"
            elif inc3_start <= i <= inc3_end:
                svc = "auth-service"
                lvl = "ERROR"
                msg = "JWT validation failed: signature verification timeout contacting keystore"
            else:
                tmpl = random.choice(self.ROUTINE_TEMPLATES)
                svc = tmpl[0]
                lvl = tmpl[1]
                msg = tmpl[2]

            pod_hash = f"{svc}-{random.randint(100, 999)}-{random.randint(10000, 99999)}"
            trace_id = f"trace-{random.randint(100000, 999999)}"
            line = f"{ts_str} {lvl} [{svc}] [pod/{pod_hash}] [trace:{trace_id}] {msg}"
            lines.append(line)

        content = "\n".join(lines) + "\n"
        file_path = os.path.join(self.storage_dir, name)
        with open(file_path, "w", encoding="utf-8") as f:
            f.write(content)

        return self.register_dataset(name, content, source="Synthetic Test Data (Simulated K8s Cluster)")

    def register_dataset(self, name: str, content: str, source: str = "Uploaded File") -> Dict[str, Any]:
        entries = LogParser.parse_content(content)
        raw_bytes = content.encode('utf-8')

        dataset_info = {
            "name": name,
            "source": source,
            "line_count": len(entries),
            "size_bytes": len(raw_bytes),
            "size_kb": round(len(raw_bytes) / 1024, 2),
            "size_mb": round(len(raw_bytes) / (1024 * 1024), 3),
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
