import heapq
from collections import Counter
from typing import Dict, Tuple, Optional, List

class HuffmanNode:
    def __init__(self, char: Optional[int], freq: int, left=None, right=None):
        self.char = char  # Byte value (0-255) or None for internal node
        self.freq = freq
        self.left = left
        self.right = right

    def __lt__(self, other):
        return self.freq < other.freq

class HuffmanCoder:
    @staticmethod
    def build_tree(frequencies: Dict[int, int]) -> Optional[HuffmanNode]:
        if not frequencies:
            return None
        
        heap = [HuffmanNode(char, freq) for char, freq in frequencies.items()]
        heapq.heapify(heap)

        if len(heap) == 1:
            node = heapq.heappop(heap)
            return HuffmanNode(None, node.freq, left=node, right=None)

        while len(heap) > 1:
            left = heapq.heappop(heap)
            right = heapq.heappop(heap)
            parent = HuffmanNode(None, left.freq + right.freq, left, right)
            heapq.heappush(heap, parent)

        return heap[0]

    @staticmethod
    def generate_codes(root: Optional[HuffmanNode]) -> Dict[int, str]:
        codes = {}
        if not root:
            return codes

        def _traverse(node: Optional[HuffmanNode], current_code: str):
            if not node:
                return
            if node.char is not None:
                codes[node.char] = current_code if current_code else "0"
                return
            _traverse(node.left, current_code + "0")
            _traverse(node.right, current_code + "1")

        _traverse(root, "")
        return codes

    @classmethod
    def compress(cls, data: bytes) -> Tuple[bytes, int, Dict[int, str], int]:
        if not data:
            return b"", 0, {}, 0

        freqs = Counter(data)
        root = cls.build_tree(freqs)
        codes = cls.generate_codes(root)

        bit_chunks = [codes[b] for b in data]
        bitstring = "".join(bit_chunks)
        total_bits = len(bitstring)

        padded_length = (total_bits + 7) // 8
        out = bytearray(padded_length)
        for i, bit in enumerate(bitstring):
            if bit == '1':
                byte_index = i // 8
                bit_offset = 7 - (i % 8)
                out[byte_index] |= (1 << bit_offset)

        header_overhead = len(freqs) * 3 + 2
        return bytes(out), total_bits, codes, header_overhead

    @classmethod
    def decompress(cls, compressed_data: bytes, total_bits: int, codes: Dict[int, str]) -> bytes:
        if not compressed_data or total_bits == 0:
            return b""

        reverse_codes = {v: k for k, v in codes.items()}
        bits = []
        for i in range(total_bits):
            byte_index = i // 8
            bit_offset = 7 - (i % 8)
            bit = (compressed_data[byte_index] >> bit_offset) & 1
            bits.append(str(bit))

        bitstring = "".join(bits)
        decoded = bytearray()
        cur = ""
        for bit in bitstring:
            cur += bit
            if cur in reverse_codes:
                decoded.append(reverse_codes[cur])
                cur = ""

        return bytes(decoded)

HuffmanCompressor = HuffmanCoder

