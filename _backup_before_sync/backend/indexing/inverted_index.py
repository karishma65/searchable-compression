import json
import sys
import os
from collections import defaultdict
from typing import Dict, Set, List, Any, Optional

# Ensure project root is in sys.path
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
    """
    Inverted Search Index for Block-based Searchable Compression.
    Maps:
      - Term -> Set of Block IDs
      - Level -> Set of Block IDs
      - Service -> Set of Block IDs
      - Block ID -> Metadata (line ranges, timestamps, line count, byte length)
    """

    def __init__(self):
        # term -> set of block_ids
        self.term_postings: Dict[str, Set[int]] = defaultdict(set)
        # field-specific postings for fast attribute filtering
        self.level_postings: Dict[str, Set[int]] = defaultdict(set)
        self.service_postings: Dict[str, Set[int]] = defaultdict(set)
        
        # Detailed posting: (term, block_id) -> list of line indices inside that block
        self.term_block_lines: Dict[str, Dict[int, List[int]]] = defaultdict(lambda: defaultdict(list))
        
        # Block metadata for range/time searches
        self.block_meta: Dict[int, Dict[str, Any]] = {}
        self.total_tokens_indexed = 0

    def add_block(self, block_id: int, entries: List[LogEntry], raw_bytes_len: int):
        if not entries:
            return

        min_time = None
        max_time = None

        for entry in entries:
            if entry.timestamp:
                if min_time is None or entry.timestamp < min_time:
                    min_time = entry.timestamp
                if max_time is None or entry.timestamp > max_time:
                    max_time = entry.timestamp

            # Index level & service attributes
            if entry.level:
                lvl = entry.level.upper()
                self.level_postings[lvl].add(block_id)
                self.term_postings[f"level:{lvl.lower()}"].add(block_id)

            if entry.service:
                svc = entry.service.lower()
                self.service_postings[svc].add(block_id)
                self.term_postings[f"service:{svc}"].add(block_id)

            # Tokenize message and raw entry
            tokens = set(LogParser.tokenize(f"{entry.level} {entry.service} {entry.pod} {entry.message}"))
            for tok in tokens:
                self.term_postings[tok].add(block_id)
                self.term_block_lines[tok][block_id].append(entry.line_no)
                self.total_tokens_indexed += 1

        self.block_meta[block_id] = {
            "start_line": entries[0].line_no,
            "end_line": entries[-1].line_no,
            "line_count": len(entries),
            "raw_bytes": raw_bytes_len,
            "min_time": min_time or "",
            "max_time": max_time or ""
        }

    def query_candidate_blocks(self, query_terms: List[str], level: Optional[str] = None, service: Optional[str] = None, match_all: bool = True) -> Set[int]:
        """
        Determines the exact set of candidate block IDs that MUST be decompressed.
        All other blocks will be bypassed!
        """
        candidate_sets = []

        # 1. Level filter
        if level and level.strip():
            lvl_clean = level.strip().upper()
            if lvl_clean in self.level_postings:
                candidate_sets.append(self.level_postings[lvl_clean])
            else:
                return set()  # No block matches this level

        # 2. Service filter
        if service and service.strip():
            svc_clean = service.strip().lower()
            matching_blocks = set()
            for s, b_ids in self.service_postings.items():
                if svc_clean in s:
                    matching_blocks.update(b_ids)
            if matching_blocks:
                candidate_sets.append(matching_blocks)
            else:
                return set()  # No block matches this service

        # 3. Keyword / Query terms
        for term in query_terms:
            t = term.lower().strip()
            if not t:
                continue

            # Look for exact term or prefix match in indexed tokens
            matched_blocks = set()
            if t in self.term_postings:
                matched_blocks.update(self.term_postings[t])
            else:
                # Substring/prefix search across vocabulary
                for indexed_token, b_ids in self.term_postings.items():
                    if t in indexed_token:
                        matched_blocks.update(b_ids)

            if matched_blocks:
                candidate_sets.append(matched_blocks)
            elif match_all:
                # If term has no match anywhere and AND logic is required, whole query returns empty
                return set()

        if not candidate_sets:
            # If no search terms given, return all blocks
            return set(self.block_meta.keys())

        if match_all:
            result = set.intersection(*candidate_sets)
        else:
            result = set.union(*candidate_sets)

        return result

    def calculate_index_size_bytes(self) -> int:
        """
        Computes accurate byte overhead of the search index:
        Vocabulary strings (char bytes) + Posting list integers (4 bytes per block ID pointer).
        """
        vocab_bytes = sum(len(term.encode('utf-8')) for term in self.term_postings.keys())
        postings_bytes = sum(len(blocks) * 4 for blocks in self.term_postings.values())
        meta_bytes = len(self.block_meta) * 32  # 32 bytes per block header
        return vocab_bytes + postings_bytes + meta_bytes
