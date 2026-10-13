import time
import sys
import os
from typing import List, Dict, Any, Tuple, Optional, Set

# Ensure project root is in sys.path
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
        """
        Two-stage decompression:
        1. Huffman decode bitstream -> LZ78 serialized tokens
        2. LZ78 decode tokens -> original uncompressed text bytes
        """
        lz78_bytes = HuffmanCoder.decompress(
            self.compressed_payload,
            self.huffman_bits,
            self.huffman_codes
        )
        original_bytes = LZ78Coder.decompress(lz78_bytes, original_length=self.uncompressed_size)
        return original_bytes

def safe_div(numerator: float, denominator: float, default: float = 1.0) -> float:
    """Safe division function to avoid zero divisor errors."""
    if not denominator:
        return default
    return float(numerator) / float(denominator)

class BlockCompressorManager:
    """
    Proposed Architecture:
    Log File -> Divide into Blocks -> LZ78 -> Huffman -> Compressed Blocks + Search Index.
    Allows Selective Block Decompression without decompressing the full dataset.
    """

    block_line_size: int
    blocks: List[CompressedBlock]
    index: InvertedSearchIndex
    total_uncompressed_bytes: int
    total_compressed_bytes: int
    total_lz78_bytes: int
    compression_time_seconds: float
    index_overhead_bytes: int

    def __init__(self, block_line_size: int = 100):
        self.block_line_size = int(block_line_size)
        self.blocks = []
        self.index = InvertedSearchIndex()
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

            # Construct block payload string
            block_text = "\n".join(e.raw for e in block_entries) + "\n"
            raw_bytes = block_text.encode('utf-8')
            raw_len = len(raw_bytes)
            self.total_uncompressed_bytes += raw_len

            # 1. Feed block to Inverted Search Index
            self.index.add_block(b_id, block_entries, raw_len)

            # 2. Stage 1 Compression: LZ78 Dictionary Encoding
            lz78_bytes = LZ78Coder.compress(raw_bytes)
            lz78_len = len(lz78_bytes)
            self.total_lz78_bytes += lz78_len

            # 3. Stage 2 Compression: Huffman Entropy Coding on LZ78 token stream
            huff_bytes, total_bits, codes, overhead = HuffmanCoder.compress(lz78_bytes)
            comp_len = len(huff_bytes) + overhead
            self.total_compressed_bytes += comp_len

            # 4. Store Compressed Block
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

        compression_ratio = safe_div(orig_len, comp_len, default=1.0)
        space_saving = safe_div((orig_len - comp_len) * 100.0, orig_len, default=0.0)
        total_compression_ratio = safe_div(orig_len, float(total_storage_with_index), default=1.0)
        space_saving_with_index = safe_div((orig_len - float(total_storage_with_index)) * 100.0, orig_len, default=0.0)

        return {
            "method": "Proposed: Block LZ78 + Huffman + Search Index",
            "block_size": self.block_line_size,
            "total_blocks": len(self.blocks),
            "original_size": self.total_uncompressed_bytes,
            "compressed_size": self.total_compressed_bytes,
            "lz78_intermediate_size": self.total_lz78_bytes,
            "index_size": self.index_overhead_bytes,
            "total_storage": total_storage_with_index,
            "compression_ratio": round(compression_ratio, 3),
            "total_compression_ratio_with_index": round(total_compression_ratio, 3),
            "space_saving_pct": round(space_saving, 2),
            "space_saving_with_index_pct": round(space_saving_with_index, 2),
            "compression_time_ms": round(self.compression_time_seconds * 1000, 2),
            "blocks_summary": [
                {
                    "block_id": b.block_id,
                    "start_line": b.start_line,
                    "end_line": b.end_line,
                    "line_count": b.line_count,
                    "uncompressed_bytes": b.uncompressed_size,
                    "compressed_bytes": b.compressed_size,
                    "ratio": round(safe_div(b.uncompressed_size, b.compressed_size, default=1.0), 2)
                }
                for b in self.blocks
            ]
        }

    def selective_search(
        self,
        query: str,
        level: Optional[str] = None,
        service: Optional[str] = None,
        time_from: Optional[str] = None,
        time_to: Optional[str] = None,
        max_results: int = 200
    ) -> Dict[str, Any]:
        """
        Searches the compressed repository using the selective block decoding paradigm:
        1. Query -> Inverted Search Index
        2. Identify Candidate Blocks (intersection of tokens & filters)
        3. Decode ONLY candidate blocks
        4. Skip all non-candidate blocks
        5. Filter & highlight matched lines
        """
        search_start = time.perf_counter()
        query_terms = LogParser.tokenize(query) if query else []

        # 1. Index lookup for candidate block IDs
        index_lookup_start = time.perf_counter()
        candidate_block_ids: Set[int] = self.index.query_candidate_blocks(
            query_terms=query_terms,
            level=level,
            service=service,
            match_all=True
        )
        index_lookup_time_ms = (time.perf_counter() - index_lookup_start) * 1000

        total_blocks = len(self.blocks)
        blocks_scanned = len(candidate_block_ids)
        blocks_skipped = total_blocks - blocks_scanned

        bytes_decoded = 0
        matching_logs: List[Dict[str, Any]] = []

        decode_start = time.perf_counter()
        # Decode only matching candidate blocks
        for b_id in sorted(candidate_block_ids):
            if b_id >= total_blocks:
                continue
            block = self.blocks[b_id]
            # Decompress THIS block ONLY
            block_bytes = block.decompress()
            bytes_decoded += len(block_bytes)

            # Parse lines from this decompressed block
            block_text = block_bytes.decode('utf-8', errors='replace')
            for line in block_text.splitlines():
                if not line.strip():
                    continue
                # Line-level verification
                parsed = LogParser.parse_line(line, line_no=0)
                
                # Check level filter
                if level and level.strip() and parsed.level != level.strip().upper():
                    continue

                # Check service filter
                if service and service.strip() and service.strip().lower() not in parsed.service:
                    continue

                # Check time range
                if time_from and parsed.timestamp and parsed.timestamp < time_from:
                    continue
                if time_to and parsed.timestamp and parsed.timestamp > time_to:
                    continue

                # Check query terms
                if query_terms:
                    line_lower = line.lower()
                    if not all(term in line_lower for term in query_terms):
                        continue

                matching_logs.append({
                    "block_id": b_id,
                    "timestamp": parsed.timestamp,
                    "level": parsed.level,
                    "service": parsed.service,
                    "pod": parsed.pod,
                    "message": parsed.message,
                    "raw": line
                })

                if len(matching_logs) >= max_results:
                    break
            if len(matching_logs) >= max_results:
                break

        decode_time_ms = (time.perf_counter() - decode_start) * 1000
        total_search_time_ms = (time.perf_counter() - search_start) * 1000

        orig_uncompressed = float(self.total_uncompressed_bytes)
        data_decoded_ratio = safe_div(float(bytes_decoded), orig_uncompressed, default=0.0)
        data_skipped_pct = round((1.0 - data_decoded_ratio) * 100.0, 2)

        return {
            "query": query,
            "level_filter": level,
            "service_filter": service,
            "total_blocks": total_blocks,
            "blocks_scanned": blocks_scanned,
            "blocks_skipped": blocks_skipped,
            "candidate_block_ids": sorted(list(candidate_block_ids)),
            "bytes_decoded": bytes_decoded,
            "total_uncompressed_bytes": self.total_uncompressed_bytes,
            "data_decoded_pct": round(data_decoded_ratio * 100, 2),
            "data_skipped_pct": data_skipped_pct,
            "index_lookup_time_ms": round(index_lookup_time_ms, 3),
            "selective_decode_time_ms": round(decode_time_ms, 3),
            "total_search_latency_ms": round(total_search_time_ms, 3),
            "match_count": len(matching_logs),
            "matching_logs": matching_logs
        }
