import time
import sys
import os
import zlib
from typing import List, Dict, Any, Tuple, Optional, Set

_current_dir = os.path.dirname(os.path.abspath(__file__))
_project_root = os.path.abspath(os.path.join(_current_dir, "../.."))
if _project_root not in sys.path:
    sys.path.insert(0, _project_root)

from backend.compression_engine.phrase_miner import CandidatePhraseMiner, CandidatePhrase
from backend.compression_engine.gain_gate import GainGatedSelector, EvaluatedPhrase
from backend.compression_engine.integrated_index import IntegratedSearchIndex
from backend.indexing.log_parser import LogParser, LogEntry

class GainGatedBlock:
    def __init__(
        self,
        block_id: int,
        start_line: int,
        end_line: int,
        uncompressed_size: int,
        compressed_size: int,
        compressed_payload: bytes,
        line_count: int
    ):
        self.block_id = block_id
        self.start_line = start_line
        self.end_line = end_line
        self.uncompressed_size = uncompressed_size
        self.compressed_size = compressed_size
        self.compressed_payload = compressed_payload
        self.line_count = line_count

    def decompress(self, shared_seed: bytes) -> bytes:
        do = zlib.decompressobj(wbits=-15, zdict=shared_seed)
        return do.decompress(self.compressed_payload)

def safe_div(a: float, b: float, default: float = 0.0) -> float:
    return a / b if b != 0 else default

class GainGatedBlockManager:
    """
    Gain-Gated Shared-Dictionary Block Compression Engine for Searchable Log Archives.
    Jointly optimizes:
      1. Block Partitioning (independent random-access blocks)
      2. Candidate Phrase Mining (recurring cross-block templates)
      3. Gain-Gated Shared Dictionary Selection (G(p | S) > 0)
      4. Shared-Dictionary Block DEFLATE (eliminates block cold-start penalty)
      5. Integrated Search Indexing (compact postings for promoted phrases)
    """

    def __init__(self, block_line_size: int = 50):
        self.block_line_size = block_line_size
        self.blocks: List[GainGatedBlock] = []
        self.shared_seed: bytes = b""
        self.promoted_phrases: List[CandidatePhrase] = []
        self.index = IntegratedSearchIndex()
        
        self.miner = CandidatePhraseMiner(min_length=8, max_length=120, min_frequency=4, min_block_spread=2)
        self.selector = GainGatedSelector(ref_cost_bytes=3.0, posting_cost_per_block=2.0, max_shared_dictionary_size=64)
        
        self.evaluations: List[EvaluatedPhrase] = []
        self.selection_summary: Dict[str, Any] = {}
        
        self.total_uncompressed_bytes = 0
        self.total_data_compressed_bytes = 0
        self.shared_dict_storage_bytes = 0
        self.index_storage_bytes = 0
        self.compression_time_seconds = 0.0

    @property
    def shared_dict(self) -> bytes:
        return self.shared_seed

    def compress_log_entries(
        self,
        entries: List[LogEntry],
        unconditional_shared_dict: bool = False
    ) -> Dict[str, Any]:
        """
        Runs the full gain-gated shared-dictionary block compression pipeline.
        If unconditional_shared_dict is True, bypasses gain gating (ablation baseline).
        """
        start_time = time.perf_counter()
        self.blocks.clear()
        self.promoted_phrases.clear()
        self.total_uncompressed_bytes = 0
        self.total_data_compressed_bytes = 0

        total_lines = len(entries)
        block_count = (total_lines + self.block_line_size - 1) // self.block_line_size

        # 1. Partition into raw blocks
        raw_blocks: List[Tuple[int, bytes, List[LogEntry]]] = []
        for b_id in range(block_count):
            start_idx = b_id * self.block_line_size
            end_idx = min(start_idx + self.block_line_size, total_lines)
            block_entries = entries[start_idx:end_idx]
            block_text = "\n".join(e.raw for e in block_entries) + "\n"
            raw_bytes = block_text.encode('utf-8')
            self.total_uncompressed_bytes += len(raw_bytes)
            raw_blocks.append((b_id, raw_bytes, block_entries))

        # 2. Candidate Phrase Mining across blocks
        blocks_for_mining = [(b_id, b_bytes) for b_id, b_bytes, _ in raw_blocks]
        candidates = self.miner.mine_candidates(blocks_for_mining)

        # 3. Gain-Gated Selection
        if unconditional_shared_dict:
            # Ablation Baseline: Select top 40 candidates blindly without gain gating
            promoted_cands = candidates[:40]
            self.evaluations = [
                EvaluatedPhrase(
                    candidate=c,
                    marginal_gain_bytes=0.0,
                    data_savings_bytes=0.0,
                    dict_cost_bytes=c.length + 2,
                    index_cost_bytes=len(c.block_ids) * 2,
                    is_promoted=True,
                    rejection_reason="Unconditional promotion without gain gating"
                )
                for c in promoted_cands
            ]
            self.selection_summary = {
                "total_candidates_mined": len(candidates),
                "promoted_count": len(promoted_cands),
                "rejected_count": len(candidates) - len(promoted_cands),
                "total_projected_gain_bytes": 0.0,
                "mode": "Unconditional Shared Dictionary (Ablation)"
            }
        else:
            # Proposed Method: Cost-Aware Joint Optimization (G(p | S) > 0)
            promoted_cands, self.evaluations, self.selection_summary = self.selector.select_promoted_phrases(candidates)
            self.selection_summary["mode"] = "Gain-Gated Joint Optimization"

        self.promoted_phrases = promoted_cands
        self.shared_seed = b"\n".join(c.phrase_bytes for c in promoted_cands)
        self.shared_dict_storage_bytes = len(self.shared_seed) + 4

        # 4. Integrated Search Index Construction
        self.index.build_index(promoted_cands, total_blocks=block_count, raw_blocks=blocks_for_mining)
        self.index_storage_bytes = self.index.calculate_index_size_bytes()

        # 5. Shared-Dictionary Block DEFLATE Compression
        for b_id, raw_bytes, block_entries in raw_blocks:
            co = zlib.compressobj(level=9, wbits=-15, zdict=self.shared_seed)
            compressed_payload = co.compress(raw_bytes) + co.flush()
            comp_len = len(compressed_payload)
            self.total_data_compressed_bytes += comp_len

            # 100% Exact Lossless Reconstruction Verification
            do = zlib.decompressobj(wbits=-15, zdict=self.shared_seed)
            decomp = do.decompress(compressed_payload)
            assert decomp == raw_bytes, f"Lossless verification failed on Block {b_id}"

            self.blocks.append(GainGatedBlock(
                block_id=b_id,
                start_line=block_entries[0].line_no,
                end_line=block_entries[-1].line_no,
                uncompressed_size=len(raw_bytes),
                compressed_size=comp_len,
                compressed_payload=compressed_payload,
                line_count=len(block_entries)
            ))

        self.compression_time_seconds = time.perf_counter() - start_time

        orig_len = float(self.total_uncompressed_bytes)
        data_comp_len = float(self.total_data_compressed_bytes)
        dict_len = float(self.shared_dict_storage_bytes)
        idx_len = float(self.index_storage_bytes)
        
        # Complete Archive Stored Size = Data Blocks + Shared Seed Dict + Search Index
        total_archive_storage = int(data_comp_len + dict_len + idx_len)

        payload_ratio = safe_div(orig_len, data_comp_len, default=1.0)
        overall_ratio = safe_div(orig_len, float(total_archive_storage), default=1.0)
        space_saving = safe_div((orig_len - float(total_archive_storage)) * 100.0, orig_len, default=0.0)

        method_name = "Unconditional Shared-Dict DEFLATE" if unconditional_shared_dict else "Proposed: Gain-Gated Shared-Dictionary Block DEFLATE"

        return {
            "method": method_name,
            "block_size": self.block_line_size,
            "total_blocks": len(self.blocks),
            "original_size": self.total_uncompressed_bytes,
            "compressed_size": total_archive_storage,
            "blocks_compressed_size": self.total_data_compressed_bytes,
            "shared_dictionary_size": self.shared_dict_storage_bytes,
            "shared_phrases_count": len(self.promoted_phrases),
            "index_size": self.index_storage_bytes,
            "total_storage": total_archive_storage,
            "payload_compression_ratio": round(payload_ratio, 3),
            "compression_ratio": round(overall_ratio, 3),
            "total_compression_ratio_with_index": round(overall_ratio, 3),
            "space_saving_pct": round(space_saving, 2),
            "compression_time_ms": round(self.compression_time_seconds * 1000, 2),
            "selection_summary": self.selection_summary,
            "evaluations_sample": [e.to_dict() for e in self.evaluations[:25]],
            "blocks_summary": [
                {
                    "block_id": b.block_id,
                    "start_line": b.start_line,
                    "end_line": b.end_line,
                    "line_count": b.line_count,
                    "uncompressed_bytes": b.uncompressed_size,
                    "compressed_bytes": b.compressed_size
                }
                for b in self.blocks
            ]
        }

    def selective_search(self, query: str, max_results: int = 1000) -> Dict[str, Any]:
        """
        Selective search using the integrated gain-gated index.
        Decompresses ONLY matching candidate blocks.
        """
        search_start = time.perf_counter()
        q_clean = query.strip() if query else ""

        idx_start = time.perf_counter()
        candidate_block_ids, used_promoted_index = self.index.query_candidate_blocks(q_clean)
        index_lookup_time_ms = (time.perf_counter() - idx_start) * 1000

        total_blocks = len(self.blocks)
        decoded_block_ids: List[int] = []
        bytes_decoded = 0
        matching_logs: List[Dict[str, Any]] = []

        decode_start = time.perf_counter()
        query_lower = q_clean.lower()
        query_tokens = [t.lower() for t in LogParser.tokenize(q_clean)] if q_clean else []

        for b_id in sorted(candidate_block_ids):
            if b_id >= total_blocks:
                continue

            block = self.blocks[b_id]
            block_bytes = block.decompress(self.shared_seed)
            decoded_block_ids.append(b_id)
            bytes_decoded += block.uncompressed_size

            block_text = block_bytes.decode('utf-8', errors='replace')
            lines = block_text.splitlines()

            for line_idx, line in enumerate(lines):
                orig_line_no = block.start_line + line_idx
                line_lower = line.lower()

                is_match = False
                if query_lower in line_lower:
                    is_match = True
                elif query_tokens and all(tok in line_lower for tok in query_tokens):
                    is_match = True

                if is_match:
                    matching_logs.append({
                        "block_id": b_id,
                        "line_no": orig_line_no,
                        "raw": line
                    })
                    if len(matching_logs) >= max_results:
                        break
            if len(matching_logs) >= max_results:
                break

        decode_time_ms = (time.perf_counter() - decode_start) * 1000
        total_search_time_ms = (time.perf_counter() - search_start) * 1000

        blocks_read = len(decoded_block_ids)
        blocks_skipped = total_blocks - blocks_read

        orig_uncompressed = float(self.total_uncompressed_bytes)
        bytes_not_read = max(0, int(orig_uncompressed - bytes_decoded))
        data_not_read_pct = round(safe_div(float(bytes_not_read) * 100.0, orig_uncompressed, default=0.0), 1)
        data_read_pct = round(safe_div(float(bytes_decoded) * 100.0, orig_uncompressed, default=100.0), 1)

        return {
            "query": q_clean,
            "used_promoted_index": used_promoted_index,
            "total_blocks": total_blocks,
            "blocks_read": blocks_read,
            "blocks_scanned": blocks_read,
            "blocks_skipped": blocks_skipped,
            "candidate_block_ids": sorted(list(candidate_block_ids)),
            "decoded_block_ids": decoded_block_ids,
            "bytes_decoded": bytes_decoded,
            "bytes_not_read": bytes_not_read,
            "total_uncompressed_bytes": self.total_uncompressed_bytes,
            "data_read_pct": data_read_pct,
            "data_not_read_pct": data_not_read_pct,
            "data_decoded_pct": data_read_pct,
            "data_skipped_pct": data_not_read_pct,
            "index_lookup_time_ms": round(index_lookup_time_ms, 3),
            "selective_decode_time_ms": round(decode_time_ms, 3),
            "total_search_latency_ms": round(total_search_time_ms, 3),
            "match_count": len(matching_logs),
            "matching_logs": matching_logs
        }
