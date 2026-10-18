import time
from typing import Tuple

class RLECompressor:
    """
    Worst-Case Baseline: Byte-Level Run-Length Encoding (RLE).
    Encodes runs of repeated characters as (count, byte).
    Demonstrates worst-case behavior on text logs where consecutive identical
    character runs are extremely rare, causing catastrophic data expansion (~0.52x ratio).
    """

    @staticmethod
    def compress(data: bytes) -> Tuple[bytes, float]:
        t0 = time.perf_counter()
        if not data:
            return b"", 0.0

        out = bytearray()
        i = 0
        n = len(data)

        while i < n:
            b = data[i]
            run_len = 1
            while i + 1 < n and data[i + 1] == b and run_len < 255:
                run_len += 1
                i += 1

            out.append(run_len)
            out.append(b)
            i += 1

        elapsed = time.perf_counter() - t0
        return bytes(out), elapsed

    @staticmethod
    def decompress(compressed: bytes) -> Tuple[bytes, float]:
        t0 = time.perf_counter()
        out = bytearray()
        n = len(compressed)

        for i in range(0, n, 2):
            if i + 1 < n:
                count = compressed[i]
                b = compressed[i + 1]
                out.extend(bytes([b]) * count)

        elapsed = time.perf_counter() - t0
        return bytes(out), elapsed
