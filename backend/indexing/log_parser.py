import re
from typing import Dict, Any, List

class LogEntry:
    def __init__(self, raw: str, line_no: int):
        self.raw = raw
        self.line_no = line_no  # 1-indexed line number in original file

    def to_dict(self) -> Dict[str, Any]:
        return {
            "line_no": self.line_no,
            "raw": self.raw
        }

class LogParser:
    @classmethod
    def parse_content(cls, content: str) -> List[LogEntry]:
        lines = content.splitlines()
        entries = []
        for i, line in enumerate(lines, 1):
            entries.append(LogEntry(raw=line, line_no=i))
        return entries

    @classmethod
    def tokenize(cls, text: str) -> List[str]:
        if not text:
            return []
        tokens = set()
        # Extract delimited tokens (words, status codes, timestamps, IDs, methods, paths)
        delimited_tokens = re.findall(r'[a-zA-Z0-9_\-\.\:\/]+', text)
        for tok in delimited_tokens:
            t = tok.strip('.,:;()[]{}"\'').lower()
            if len(t) >= 2 or t.isdigit():
                tokens.add(t)
            # Extract alphanumeric sub-tokens (e.g. status code 200, 404, or sub-words)
            for sub in re.findall(r'[a-zA-Z0-9]+', tok):
                s = sub.lower()
                if len(s) >= 2 or s.isdigit():
                    tokens.add(s)
        return list(tokens)
