import time
from typing import Tuple

class RawCompressor:
    """
    Baseline: Raw uncompressed log data.
    Compression ratio = 1.0, space saving = 0%.
    Search requires reading 100% of bytes.
    """

    @staticmethod
    def compress(data: bytes) -> Tuple[bytes, float]:
        start = time.perf_counter()
        # No transformation
        duration = time.perf_counter() - start
        return data, duration

    @staticmethod
    def decompress(data: bytes) -> Tuple[bytes, float]:
        start = time.perf_counter()
        duration = time.perf_counter() - start
        return data, duration
