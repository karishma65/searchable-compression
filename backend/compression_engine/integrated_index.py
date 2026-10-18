import re
from typing import Dict, Set, List, Any, Optional, Tuple
from backend.compression_engine.phrase_miner import CandidatePhrase

class IntegratedSearchIndex:
    """
    Step 4 of Gain-Gated Architecture:
    Integrated Search Index built over Promoted Shared Phrases and Block-Level Postings.
    Provides sub-archive random access to candidate blocks without decompressing the full archive.
    """

    def __init__(self):
        # Maps normalized term/phrase to set of block IDs
        self.postings: Dict[str, Set[int]] = {}
        # Maps phrase ID to candidate metadata
        self.phrase_meta: Dict[int, CandidatePhrase] = {}
        self.total_blocks: int = 0

    def build_index(
        self,
        promoted_phrases: List[CandidatePhrase],
        total_blocks: int,
        raw_blocks: Optional[List[Tuple[int, bytes]]] = None
    ):
        self.postings.clear()
        self.phrase_meta.clear()
        self.total_blocks = total_blocks

        # 1. Index promoted phrases from the Gain-Gated shared dictionary
        for p_id, cand in enumerate(promoted_phrases):
            self.phrase_meta[p_id] = cand
            norm_key = cand.phrase_str.lower().strip()
            self.postings[norm_key] = set(cand.block_ids)

            words = [w.strip("()[]\"':;,") for w in norm_key.split()]
            for w in words:
                if len(w) >= 2:
                    if w not in self.postings:
                        self.postings[w] = set()
                    self.postings[w].update(cand.block_ids)

        # 2. Build block-level postings for distinct keywords across raw blocks
        if raw_blocks:
            token_pattern = re.compile(rb'[a-zA-Z0-9_\-\.\:\/]+')
            for b_id, b_bytes in raw_blocks:
                tokens = {
                    t.decode('utf-8', errors='ignore').lower().strip("()[]\"':;,")
                    for t in token_pattern.findall(b_bytes)
                }
                for tok in tokens:
                    if len(tok) >= 2:
                        if tok not in self.postings:
                            self.postings[tok] = set()
                        self.postings[tok].add(b_id)

    def query_candidate_blocks(self, query: str) -> Tuple[Set[int], bool]:
        """
        Looks up candidate blocks for a query string.
        Returns (candidate_block_ids, used_promoted_index).
        """
        if not query or not query.strip():
            return set(range(self.total_blocks)), True

        q_norm = query.lower().strip()

        # 1. Direct exact match in index
        if q_norm in self.postings:
            return set(self.postings[q_norm]), True

        # 2. Substring match across multi-token indexed phrases
        phrase_matches: Set[int] = set()
        for term, b_ids in self.postings.items():
            if ' ' in term and q_norm in term:
                phrase_matches.update(b_ids)
        if phrase_matches:
            return phrase_matches, True

        # 3. Multi-token intersection across constituent keywords
        tokens = [
            t.strip("()[]\"':;,")
            for t in re.findall(r'[a-zA-Z0-9_\-\.\:\/]+', q_norm)
            if len(t.strip("()[]\"':;,")) >= 2
        ]

        if not tokens:
            return set(range(self.total_blocks)), False

        matching_sets: List[Set[int]] = []
        for tok in tokens:
            tok_blocks: Set[int] = set()
            if tok in self.postings:
                tok_blocks.update(self.postings[tok])
            else:
                for term, b_ids in self.postings.items():
                    if tok in term:
                        tok_blocks.update(b_ids)

            if tok_blocks:
                matching_sets.append(tok_blocks)
            else:
                # Token does not exist anywhere in archive: 0 matching blocks
                return set(), True

        if matching_sets:
            result = set.intersection(*matching_sets)
            return result, True

        return set(range(self.total_blocks)), False

    def calculate_index_size_bytes(self) -> int:
        """
        Calculates exact index storage in bytes:
        - Vocab bytes: length of unique indexed phrases
        - Postings bytes: 2 bytes per block ID per posting list
        - Header metadata: 4 bytes per posting list
        """
        vocab_bytes = sum(len(term.encode('utf-8', errors='ignore')) for term in self.postings.keys())
        postings_bytes = sum(len(b_ids) * 2 for b_ids in self.postings.values())
        header_bytes = len(self.postings) * 4
        return vocab_bytes + postings_bytes + header_bytes
