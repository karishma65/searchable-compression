from typing import List, Dict, Set, Tuple, Optional
from backend.compression_engine.phrase_miner import CandidatePhrase

class EvaluatedPhrase:
    def __init__(
        self,
        candidate: CandidatePhrase,
        marginal_gain_bytes: float,
        data_savings_bytes: float,
        dict_cost_bytes: float,
        index_cost_bytes: float,
        is_promoted: bool,
        rejection_reason: Optional[str] = None
    ):
        self.phrase_str = candidate.phrase_str
        self.phrase_bytes = candidate.phrase_bytes
        self.length = candidate.length
        self.frequency = candidate.frequency
        self.block_ids = candidate.block_ids
        self.block_spread = len(candidate.block_ids)
        self.marginal_gain_bytes = round(marginal_gain_bytes, 1)
        self.data_savings_bytes = round(data_savings_bytes, 1)
        self.dict_cost_bytes = round(dict_cost_bytes, 1)
        self.index_cost_bytes = round(index_cost_bytes, 1)
        self.is_promoted = is_promoted
        self.rejection_reason = rejection_reason

    def to_dict(self) -> Dict:
        return {
            "phrase": self.phrase_str,
            "length": self.length,
            "frequency": self.frequency,
            "block_spread": self.block_spread,
            "marginal_gain_bytes": self.marginal_gain_bytes,
            "data_savings_bytes": self.data_savings_bytes,
            "dict_cost_bytes": self.dict_cost_bytes,
            "index_cost_bytes": self.index_cost_bytes,
            "status": "PROMOTED" if self.is_promoted else "REJECTED",
            "reason": self.rejection_reason or "Marginal gain G(p | S) > 0"
        }

class GainGatedSelector:
    """
    Step 2 of Gain-Gated Architecture:
    Jointly evaluates compression savings against dictionary and index postings overhead.
    G(p | S) = DataSavings(p) - DictCost(p) - IndexCost(p)
    Only promotes candidate phrases where G(p | S) > 0.
    Recomputes candidate frequencies dynamically when overlapping phrases are selected.
    """

    def __init__(
        self,
        ref_cost_bytes: float = 2.0,      # Cost of emitting a shared token reference
        posting_cost_per_block: float = 2.0, # Bytes per block ID in posting list
        max_shared_dictionary_size: int = 256 # Capped shared dict to keep token IDs compact (1 byte)
    ):
        self.ref_cost_bytes = ref_cost_bytes
        self.posting_cost_per_block = posting_cost_per_block
        self.max_shared_dictionary_size = max_shared_dictionary_size

    def compute_marginal_gain(self, length: int, freq: int, block_spread: int) -> Tuple[float, float, float, float]:
        """
        Computes G(p | S) = DataSavings - DictCost - IndexCost
        """
        # Data savings = (bytes saved per occurrence) * frequency
        data_savings = float(freq * max(0.0, length - self.ref_cost_bytes))
        
        # Dictionary storage cost = phrase length in bytes + 2 bytes length prefix
        dict_cost = float(length + 2)
        
        # Search index postings cost = 2 bytes header + (posting_cost_per_block * block_spread)
        index_cost = float(2 + (block_spread * self.posting_cost_per_block))
        
        marginal_gain = data_savings - dict_cost - index_cost
        return marginal_gain, data_savings, dict_cost, index_cost

    def select_promoted_phrases(
        self,
        candidates: List[CandidatePhrase]
    ) -> Tuple[List[CandidatePhrase], List[EvaluatedPhrase], Dict[str, float]]:
        """
        Greedy / lazy-greedy selection loop with dynamic frequency adjustment.
        Promotes candidates only when marginal gain G(p | S) > 0.
        """
        promoted: List[CandidatePhrase] = []
        evaluations: List[EvaluatedPhrase] = []
        total_projected_gain = 0.0

        # Maintain dynamic remaining frequencies to avoid double-counting overlapping sub-phrases
        remaining_freq: Dict[bytes, int] = {c.phrase_bytes: c.frequency for c in candidates}
        candidate_map: Dict[bytes, CandidatePhrase] = {c.phrase_bytes: c for c in candidates}

        # Sort candidates initially by raw marginal gain
        initial_scored = []
        for c in candidates:
            gain, d_sav, d_c, idx_c = self.compute_marginal_gain(c.length, c.frequency, len(c.block_ids))
            initial_scored.append((gain, c))
        
        initial_scored.sort(key=lambda x: x[0], reverse=True)

        for _, cand in initial_scored:
            if len(promoted) >= self.max_shared_dictionary_size:
                evaluations.append(EvaluatedPhrase(
                    candidate=cand,
                    marginal_gain_bytes=0.0,
                    data_savings_bytes=0.0,
                    dict_cost_bytes=cand.length + 2,
                    index_cost_bytes=len(cand.block_ids) * self.posting_cost_per_block,
                    is_promoted=False,
                    rejection_reason="Shared dictionary capacity limit reached"
                ))
                continue

            current_f = remaining_freq.get(cand.phrase_bytes, cand.frequency)
            if current_f < 2:
                evaluations.append(EvaluatedPhrase(
                    candidate=cand,
                    marginal_gain_bytes=-1.0,
                    data_savings_bytes=0.0,
                    dict_cost_bytes=cand.length + 2,
                    index_cost_bytes=len(cand.block_ids) * self.posting_cost_per_block,
                    is_promoted=False,
                    rejection_reason="Frequency dropped below threshold due to superstring promotion"
                ))
                continue

            # Compute actual marginal gain with adjusted frequency
            gain, d_sav, d_c, idx_c = self.compute_marginal_gain(cand.length, current_f, len(cand.block_ids))

            if gain > 0:
                # PROMOTE!
                promoted.append(cand)
                total_projected_gain += gain
                evaluations.append(EvaluatedPhrase(
                    candidate=cand,
                    marginal_gain_bytes=gain,
                    data_savings_bytes=d_sav,
                    dict_cost_bytes=d_c,
                    index_cost_bytes=idx_c,
                    is_promoted=True
                ))

                # Dynamic update: If this phrase contains smaller candidate sub-phrases, decrement their effective frequency
                for other_cand in candidates:
                    if other_cand.phrase_bytes != cand.phrase_bytes and other_cand.phrase_bytes in cand.phrase_bytes:
                        overlap_count = remaining_freq.get(other_cand.phrase_bytes, other_cand.frequency)
                        remaining_freq[other_cand.phrase_bytes] = max(0, overlap_count - current_f)
            else:
                # REJECT! Marginal gain is non-positive
                evaluations.append(EvaluatedPhrase(
                    candidate=cand,
                    marginal_gain_bytes=gain,
                    data_savings_bytes=d_sav,
                    dict_cost_bytes=d_c,
                    index_cost_bytes=idx_c,
                    is_promoted=False,
                    rejection_reason=f"Negative marginal gain G(p | S) = {gain:.1f}B (Dict & Index cost exceeds data savings)"
                ))

        summary = {
            "total_candidates_mined": len(candidates),
            "promoted_count": len(promoted),
            "rejected_count": len(candidates) - len(promoted),
            "total_projected_gain_bytes": round(total_projected_gain, 1)
        }

        return promoted, evaluations, summary
