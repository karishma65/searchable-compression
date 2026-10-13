import re
import json
from typing import Dict, Any, List, Optional

class LogEntry:
    def __init__(self, raw: str, line_no: int, timestamp: str = "", level: str = "INFO", service: str = "general", pod: str = "", message: str = ""):
        self.raw = raw
        self.line_no = line_no
        self.timestamp = timestamp
        self.level = level.upper() if level else "INFO"
        self.service = service.lower() if service else "general"
        self.pod = pod
        self.message = message if message else raw

    def to_dict(self) -> Dict[str, Any]:
        return {
            "line_no": self.line_no,
            "timestamp": self.timestamp,
            "level": self.level,
            "service": self.service,
            "pod": self.pod,
            "message": self.message,
            "raw": self.raw
        }

class LogParser:
    """
    Parses cloud and Kubernetes logs from JSON, standard formatted text, or CSV.
    Extracts structured fields and searchable tokens.
    """

    LEVEL_PATTERN = re.compile(r'\b(INFO|WARN|WARNING|ERROR|DEBUG|FATAL|CRITICAL|TRACE)\b', re.IGNORECASE)
    ISO_TIMESTAMP_PATTERN = re.compile(r'\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?')
    SERVICE_PATTERN = re.compile(r'\[([a-zA-Z0-9_\-\.\/]+(?:-service|-pod|-controller|-api|-db|[a-zA-Z0-9_-]+))\]')
    POD_PATTERN = re.compile(r'\b(?:pod\/)?([a-z0-9]+(?:-[a-z0-9]+)+-[a-z0-9]{5})\b', re.IGNORECASE)
    TOKEN_CLEAN_PATTERN = re.compile(r'[^a-zA-Z0-9_\-\.\:]+')

    @classmethod
    def parse_line(cls, line: str, line_no: int) -> LogEntry:
        line_clean = line.strip()
        if not line_clean:
            return LogEntry(raw=line, line_no=line_no)

        # 1. Try JSON parsing
        if line_clean.startswith("{") and line_clean.endswith("}"):
            try:
                data = json.loads(line_clean)
                ts = data.get("timestamp") or data.get("time") or data.get("@timestamp") or data.get("ts") or ""
                lvl = data.get("level") or data.get("severity") or data.get("loglevel") or "INFO"
                svc = data.get("service") or data.get("app") or data.get("component") or data.get("service_name") or "k8s-system"
                pod = data.get("pod") or data.get("pod_name") or data.get("hostname") or ""
                msg = data.get("message") or data.get("msg") or data.get("log") or line_clean
                return LogEntry(raw=line, line_no=line_no, timestamp=str(ts), level=str(lvl), service=str(svc), pod=str(pod), message=str(msg))
            except Exception:
                pass

        # 2. Try Regex parsing on standard string format
        ts_match = cls.ISO_TIMESTAMP_PATTERN.search(line_clean)
        ts = ts_match.group(0) if ts_match else ""

        lvl_match = cls.LEVEL_PATTERN.search(line_clean)
        lvl = lvl_match.group(0).upper() if lvl_match else "INFO"
        if lvl == "WARNING":
            lvl = "WARN"

        svc_matches = cls.SERVICE_PATTERN.findall(line_clean)
        svc = svc_matches[0].lower() if svc_matches else ""
        if not svc:
            # Fallback service extraction e.g. service: auth-service or name=payment-service
            svc_field = re.search(r'(?:service|app|component)[=:]\s*([a-zA-Z0-9_\-]+)', line_clean, re.IGNORECASE)
            svc = svc_field.group(1).lower() if svc_field else "k8s-workload"

        pod_match = cls.POD_PATTERN.search(line_clean)
        pod = pod_match.group(1) if pod_match else ""

        # Remove timestamp & brackets to form message
        msg = line_clean
        return LogEntry(raw=line, line_no=line_no, timestamp=ts, level=lvl, service=svc, pod=pod, message=msg)

    @classmethod
    def parse_content(cls, content: str) -> List[LogEntry]:
        lines = content.splitlines()
        entries = []
        for i, line in enumerate(lines):
            if line.strip():
                entries.append(cls.parse_line(line, line_no=i))
        return entries

    @classmethod
    def tokenize(cls, text: str) -> List[str]:
        """Tokenizes text into normalized lowercase tokens for indexing."""
        cleaned = cls.TOKEN_CLEAN_PATTERN.sub(' ', text.lower())
        tokens = [t for t in cleaned.split() if len(t) >= 2]
        return tokens
