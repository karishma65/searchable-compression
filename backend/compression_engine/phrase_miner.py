import re
from typing import List, Dict, Set, Tuple, NamedTuple
from collections import defaultdict

class CandidatePhrase(NamedTuple):
    phrase_bytes: bytes
    phrase_str: str
    length: int
    frequency: int
    block_ids: Set[int]

class CandidatePhraseMiner:
    """
    Step 1 of Gain-Gated Architecture:
    Mines recurring multi-token phrases and repetitive patterns across log blocks.
    Filters by minimum occurrence frequency and cross-block spread.
    """

    def __init__(
        self,
        min_length: int = 5,
        max_length: int = 120,
        min_frequency: int = 3,
        min_block_spread: int = 2
    ):
        self.min_length = min_length
        self.max_length = max_length
        self.min_frequency = min_frequency
        self.min_block_spread = min_block_spread

    def mine_candidates(self, blocks_data: List[Tuple[int, bytes]]) -> List[CandidatePhrase]:
        """
        Extracts candidate phrases from a list of (block_id, block_bytes).
        Uses n-gram tokenization and recurring delimiter-separated phrases.
        """
        phrase_occurrences: Dict[bytes, Set[int]] = defaultdict(set)
        phrase_frequencies: Dict[bytes, int] = defaultdict(int)

        # Token pattern: words, identifiers, paths, timestamps, status codes
        token_pattern = re.compile(rb'[a-zA-Z0-9_\-\.\:\/]+')

        for block_id, block_bytes in blocks_data:
            lines = block_bytes.splitlines()

            for line in lines:
                if len(line) < self.min_length:
                    continue

                matches = list(token_pattern.finditer(line))
                num_tokens = len(matches)

                # 1. Mine exact contiguous token sequences (preserving original punctuation/delimiters)
                for n in range(2, min(9, num_tokens + 1)):
                    for i in range(num_tokens - n + 1):
                        s = matches[i].start()
                        e = matches[i + n - 1].end()
                        phrase_slice = line[s:e]

                        if self.min_length <= len(phrase_slice) <= self.max_length:
                            phrase_frequencies[phrase_slice] += 1
                            phrase_occurrences[phrase_slice].add(block_id)

                # 2. Extract notable structural substrings (e.g. error messages after colon)
                if b": " in line:
                    parts = line.split(b": ", 1)
                    if len(parts) > 1 and len(parts[1]) >= self.min_length:
                        sub = parts[1].strip()
                        if len(sub) <= self.max_length:
                            phrase_frequencies[sub] += 1
                            phrase_occurrences[sub].add(block_id)

                # 3. Common single long tokens (service names, URL paths, exceptions)
                for m in matches:
                    tok = m.group()
                    if len(tok) >= 10:  # e.g. "database-service", "ingress-controller"
                        phrase_frequencies[tok] += 1
                        phrase_occurrences[tok].add(block_id)

        candidates: List[CandidatePhrase] = []
        for phrase_b, freq in phrase_frequencies.items():
            b_ids = phrase_occurrences[phrase_b]
            if (
                len(phrase_b) >= self.min_length
                and freq >= self.min_frequency
                and len(b_ids) >= self.min_block_spread
            ):
                try:
                    phrase_str = phrase_b.decode('utf-8', errors='replace')
                except Exception:
                    phrase_str = repr(phrase_b)

                candidates.append(CandidatePhrase(
                    phrase_bytes=phrase_b,
                    phrase_str=phrase_str,
                    length=len(phrase_b),
                    frequency=freq,
                    block_ids=b_ids
                ))

        # Sort candidates primarily by potential savings: frequency * (length - 2)
        candidates.sort(key=lambda c: c.frequency * (c.length - 2), reverse=True)
        return candidates
