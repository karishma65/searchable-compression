import time
from typing import Tuple

class RawCompressor:
    @staticmethod
    def compress(data: bytes) -> Tuple[bytes, float]:
        start = time.perf_counter()
        duration = time.perf_counter() - start
        return data, duration

    @staticmethod
    def decompress(data: bytes) -> Tuple[bytes, float]:
        start = time.perf_counter()
        duration = time.perf_counter() - start
        return data, duration
