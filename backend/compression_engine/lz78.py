import struct
from typing import List, Tuple

class LZ78Coder:
    @staticmethod
    def compress_to_tokens(data: bytes) -> List[Tuple[int, int]]:
        if not data:
            return []

        dictionary = {}
        next_code = 1
        curr_index = 0
        tokens = []

        for b in data:
            key = (curr_index, b)
            if key in dictionary:
                curr_index = dictionary[key]
            else:
                tokens.append((curr_index, b))
                dictionary[key] = next_code
                next_code += 1
                curr_index = 0

        if curr_index != 0:
            tokens.append((curr_index, 0))

        return tokens

    @classmethod
    def serialize_tokens(cls, tokens: List[Tuple[int, int]]) -> bytes:
        if not tokens:
            return b""
        
        max_idx = max(t[0] for t in tokens) if tokens else 0
        use_short = max_idx < 65535

        buf = bytearray()
        buf.append(2 if use_short else 4)

        if use_short:
            for idx, char in tokens:
                buf.extend(struct.pack(">HB", idx, char))
        else:
            for idx, char in tokens:
                buf.extend(struct.pack(">IB", idx, char))

        return bytes(buf)

    @classmethod
    def deserialize_tokens(cls, data: bytes) -> List[Tuple[int, int]]:
        if not data:
            return []
        
        idx_size = data[0]
        offset = 1
        tokens = []

        if idx_size == 2:
            step = 3
            while offset + step <= len(data):
                idx, char = struct.unpack_from(">HB", data, offset)
                tokens.append((idx, char))
                offset += step
        else:
            step = 5
            while offset + step <= len(data):
                idx, char = struct.unpack_from(">IB", data, offset)
                tokens.append((idx, char))
                offset += step

        return tokens

    @classmethod
    def decompress_tokens(cls, tokens: List[Tuple[int, int]], original_length: int = -1) -> bytes:
        if not tokens:
            return b""

        dictionary = {0: b""}
        next_code = 1
        result = bytearray()

        for idx, char in tokens:
            prefix = dictionary.get(idx, b"")
            if char != 0 or idx == 0:
                phrase = prefix + bytes([char])
            else:
                phrase = prefix
            
            result.extend(phrase)
            dictionary[next_code] = phrase
            next_code += 1

        if original_length >= 0 and len(result) > original_length:
            return bytes(result[:original_length])

        return bytes(result)

    @classmethod
    def compress(cls, data: bytes) -> bytes:
        tokens = cls.compress_to_tokens(data)
        return cls.serialize_tokens(tokens)

    @classmethod
    def decompress(cls, data: bytes, original_length: int = -1) -> bytes:
        tokens = cls.deserialize_tokens(data)
        return cls.decompress_tokens(tokens, original_length)

LZ78Compressor = LZ78Coder
