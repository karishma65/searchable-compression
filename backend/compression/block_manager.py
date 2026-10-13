import time
import sys
import os
from typing import List, Dict, Any, Tuple, Optional, Set

_current_dir = os.path.dirname(os.path.abspath(__file__))
_project_root = os.path.abspath(os.path.join(_current_dir, "../.."))
if _project_root not in sys.path:
    sys.path.insert(0, _project_root)
_backend_root = os.path.abspath(os.path.join(_current_dir, ".."))
if _backend_root not in sys.path:
    sys.path.insert(0, _backend_root)

try:
    from backend.compression.lz78 import LZ78Coder
    from backend.compression.huffman import HuffmanCoder
    from backend.indexing.log_parser import LogParser, LogEntry
    from backend.indexing.inverted_index import InvertedSearchIndex
except (ImportError, ModuleNotFoundError):
    try:
        from compression.lz78 import LZ78Coder
        from compression.huffman import HuffmanCoder
        from indexing.log_parser import LogParser, LogEntry
        from indexing.inverted_index import InvertedSearchIndex
    except (ImportError, ModuleNotFoundError):
        from .lz78 import LZ78Coder
        from .huffman import HuffmanCoder
        from ..indexing.log_parser import LogParser, LogEntry
        from ..indexing.inverted_index import InvertedSearchIndex

class CompressedBlock:
    def __init__(
        self,
        block_id: int,
        start_line: int,
        end_line: int,
        uncompressed_size: int,
        lz78_size: int,
        compressed_size: int,
        huffman_bits: int,
        huffman_codes: Dict[int, str],
        compressed_payload: bytes,
        line_count: int
    ):
        self.block_id = block_id
        self.start_line = start_line
        self.end_line = end_line
        self.uncompressed_size = uncompressed_size
        self.lz78_size = lz78_size
        self.compressed_size = compressed_size
        self.huffman_bits = huffman_bits
        self.huffman_codes = huffman_codes
        self.compressed_payload = compressed_payload
        self.line_count = line_count

    def decompress(self) -> bytes:
        lz78_bytes = HuffmanCoder.decompress(
            self.compressed_payload,
            self.huffman_bits,
            self.huffman_codes
        )
        raw_bytes = LZ78Coder.decompress(lz78_bytes)
        return raw_bytes

def safe_div(a: float, b: float, default: float = 0.0) -> float:
    return a / b if b != 0 else default

class BlockCompressorManager:
    def __init__(self, block_line_size: int = 100):
        self.block_line_size = block_line_size
        self.blocks: List[CompressedBlock] = []
        self.index: InvertedSearchIndex = InvertedSearchIndex()
        self.total_uncompressed_bytes = 0
        self.total_compressed_bytes = 0
        self.total_lz78_bytes = 0
        self.compression_time_seconds = 0.0
        self.index_overhead_bytes = 0

    def compress_log_entries(self, entries: List[LogEntry]) -> Dict[str, Any]:
        start_time = time.perf_counter()
        self.blocks.clear()
        self.index = InvertedSearchIndex()
        self.total_uncompressed_bytes = 0
        self.total_compressed_bytes = 0
        self.total_lz78_bytes = 0

        total_lines = len(entries)
        block_count = (total_lines + self.block_line_size - 1) // self.block_line_size

        for b_id in range(block_count):
            start_idx = b_id * self.block_line_size
            end_idx = min(start_idx + self.block_line_size, total_lines)
            block_entries = entries[start_idx:end_idx]

            block_text = "\n".join(e.raw for e in block_entries) + "\n"
            raw_bytes = block_text.encode('utf-8')
            raw_len = len(raw_bytes)
            self.total_uncompressed_bytes += raw_len

            self.index.add_block(b_id, block_entries, raw_len)

            lz78_bytes = LZ78Coder.compress(raw_bytes)
            lz78_len = len(lz78_bytes)
            self.total_lz78_bytes += lz78_len

            huff_bytes, total_bits, codes, overhead = HuffmanCoder.compress(lz78_bytes)
            comp_len = len(huff_bytes) + overhead
            self.total_compressed_bytes += comp_len

            compressed_block = CompressedBlock(
                block_id=b_id,
                start_line=block_entries[0].line_no,
                end_line=block_entries[-1].line_no,
                uncompressed_size=raw_len,
                lz78_size=lz78_len,
                compressed_size=comp_len,
                huffman_bits=total_bits,
                huffman_codes=codes,
                compressed_payload=huff_bytes,
                line_count=len(block_entries)
            )
            self.blocks.append(compressed_block)

        self.compression_time_seconds = time.perf_counter() - start_time
        self.index_overhead_bytes = self.index.calculate_index_size_bytes()

        orig_len = float(self.total_uncompressed_bytes)
        comp_len = float(self.total_compressed_bytes)
        idx_len = float(self.index_overhead_bytes)
        total_storage_with_index = int(comp_len + idx_len)

        payload_ratio = safe_div(orig_len, comp_len, default=1.0)
        overall_ratio = safe_div(orig_len, float(total_storage_with_index), default=1.0)
        space_saving = safe_div((orig_len - float(total_storage_with_index)) * 100.0, orig_len, default=0.0)
        storage_overhead = safe_div((float(total_storage_with_index) - orig_len) * 100.0, orig_len, default=0.0) if total_storage_with_index > orig_len else 0.0

        return {
            "method": "Proposed: Block LZ78 + Huffman + Search Index",
            "block_size": self.block_line_size,
            "total_blocks": len(self.blocks),
            "original_size": self.total_uncompressed_bytes,
            "compressed_size": total_storage_with_index,
            "blocks_compressed_size": self.total_compressed_bytes,
            "lz78_intermediate_size": self.total_lz78_bytes,
            "index_size": self.index_overhead_bytes,
            "total_storage": total_storage_with_index,
            "payload_compression_ratio": round(payload_ratio, 3),
            "compression_ratio": round(overall_ratio, 3),
            "space_saving_pct": round(space_saving, 2),
            "storage_overhead_pct": round(storage_overhead, 2),
            "compression_time_ms": round(self.compression_time_seconds * 1000, 2),
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

    def selective_search(
        self,
        query: str,
        max_results: int = 1000
    ) -> Dict[str, Any]:
        search_start = time.perf_counter()
        q_clean = query.strip() if query else ""

        index_lookup_start = time.perf_counter()
        if not q_clean:
            candidate_block_ids: Set[int] = set()
        else:
            candidate_block_ids: Set[int] = self.index.query_candidate_blocks(q_clean)
        index_lookup_time_ms = (time.perf_counter() - index_lookup_start) * 1000

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
            block_bytes = block.decompress()
            decoded_block_ids.append(b_id)
            bytes_decoded += block.uncompressed_size

            block_text = block_bytes.decode('utf-8', errors='replace')
            lines = block_text.splitlines()

            for line_idx, line in enumerate(lines):
                orig_line_no = block.start_line + line_idx
                line_lower = line.lower()

                # Verify matching line against search query (exact phrase or all query tokens)
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

    search = selective_search

BlockManager = BlockCompressorManager
