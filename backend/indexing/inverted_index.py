import os
import sys
from collections import defaultdict
from typing import Dict, Set, List, Any

_current_dir = os.path.dirname(os.path.abspath(__file__))
_project_root = os.path.abspath(os.path.join(_current_dir, "../.."))
if _project_root not in sys.path:
    sys.path.insert(0, _project_root)
_backend_root = os.path.abspath(os.path.join(_current_dir, ".."))
if _backend_root not in sys.path:
    sys.path.insert(0, _backend_root)

try:
    from backend.indexing.log_parser import LogEntry, LogParser
except (ImportError, ModuleNotFoundError):
    try:
        from indexing.log_parser import LogEntry, LogParser
    except (ImportError, ModuleNotFoundError):
        from .log_parser import LogEntry, LogParser

class InvertedSearchIndex:
    def __init__(self):
        self.term_postings: Dict[str, Set[int]] = defaultdict(set)
        self.block_meta: Dict[int, Dict[str, Any]] = {}
        self.total_tokens_indexed = 0

    def add_block(self, block_id: int, entries: List[LogEntry], raw_bytes_len: int):
        if not entries:
            return

        for entry in entries:
            tokens = LogParser.tokenize(entry.raw)
            for tok in tokens:
                self.term_postings[tok].add(block_id)
                self.total_tokens_indexed += 1

        self.block_meta[block_id] = {
            "start_line": entries[0].line_no,
            "end_line": entries[-1].line_no,
            "line_count": len(entries),
            "raw_bytes": raw_bytes_len
        }

    def query_candidate_blocks(self, query: str) -> Set[int]:
        if not query or not query.strip():
            return set(self.block_meta.keys())

        query_tokens = LogParser.tokenize(query)
        if not query_tokens:
            q_clean = query.strip().lower()
            matching_blocks = set()
            for term, b_ids in self.term_postings.items():
                if q_clean in term:
                    matching_blocks.update(b_ids)
            return matching_blocks

        candidate_sets = []
        for token in query_tokens:
            t = token.lower().strip()
            if not t:
                continue

            matched_blocks = set()
            if t in self.term_postings:
                matched_blocks.update(self.term_postings[t])
            else:
                for indexed_token, b_ids in self.term_postings.items():
                    if t in indexed_token:
                        matched_blocks.update(b_ids)

            if matched_blocks:
                candidate_sets.append(matched_blocks)
            else:
                return set()

        if not candidate_sets:
            return set()

        return set.intersection(*candidate_sets)

    def calculate_index_size_bytes(self) -> int:
        vocab_bytes = sum(len(term.encode('utf-8')) for term in self.term_postings.keys())
        posting_unit = 1 if len(self.block_meta) <= 256 else 2
        postings_bytes = sum(len(blocks) * posting_unit for blocks in self.term_postings.values())
        meta_bytes = len(self.block_meta) * 16
        return vocab_bytes + postings_bytes + meta_bytes
