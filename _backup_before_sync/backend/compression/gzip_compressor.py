import gzip
import time
from typing import Tuple, Dict, Any

class GzipCompressor:
    """
    Standard Gzip (DEFLATE) baseline compressor.
    Compresses entire stream.
    To search, the entire compressed payload must be decompressed.
    """

    @staticmethod
    def compress(data: bytes, compresslevel: int = 6) -> Tuple[bytes, float]:
        start = time.perf_counter()
        compressed = gzip.compress(data, compresslevel=compresslevel)
        duration = time.perf_counter() - start
        return compressed, duration

    @staticmethod
    def decompress(compressed_data: bytes) -> Tuple[bytes, float]:
        start = time.perf_counter()
        decompressed = gzip.decompress(compressed_data)
        duration = time.perf_counter() - start
        return decompressed, duration
