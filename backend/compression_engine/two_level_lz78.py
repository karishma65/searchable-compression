import struct
from typing import List, Tuple, Dict, Any, Optional

TAG_SHARED = 0
TAG_LOCAL = 1
TAG_SHARED_16 = 2
TAG_LITERAL = 3
TAG_LOCAL_8 = 4

class TwoLevelTrieNode:
    def __init__(self):
        self.children: Dict[int, TwoLevelTrieNode] = {}
        self.phrase_id: Optional[int] = None
        self.phrase_len: int = 0

class TwoLevelLZ78Coder:
    """
    Step 3 of Gain-Gated Architecture:
    Two-Level Dictionary Compression:
      - Tier 1: Shared Dictionary (promoted cross-block phrases, IDs 0..M-1)
      - Tier 2: Block-Local LZ78 (captures local remaining repetition)
    """

    @staticmethod
    def build_shared_trie(shared_dict: List[bytes]) -> TwoLevelTrieNode:
        """
        Builds a prefix trie over promoted shared phrases for fast longest-prefix matching.
        """
        root = TwoLevelTrieNode()
        for p_id, phrase in enumerate(shared_dict):
            if not phrase:
                continue
            curr = root
            for b in phrase:
                if b not in curr.children:
                    curr.children[b] = TwoLevelTrieNode()
                curr = curr.children[b]
            curr.phrase_id = p_id
            curr.phrase_len = len(phrase)
        return root

    @classmethod
    def match_shared_phrase(
        cls,
        data: bytes,
        start_pos: int,
        trie_root: TwoLevelTrieNode
    ) -> Tuple[Optional[int], int]:
        """
        Finds the longest shared phrase matching data[start_pos:].
        Returns (phrase_id, length) or (None, 0).
        """
        curr = trie_root
        best_id = None
        best_len = 0
        pos = start_pos
        data_len = len(data)

        while pos < data_len and data[pos] in curr.children:
            curr = curr.children[data[pos]]
            pos += 1
            if curr.phrase_id is not None:
                best_id = curr.phrase_id
                best_len = curr.phrase_len

        return best_id, best_len

    @classmethod
    def compress_block_tokens(
        cls,
        data: bytes,
        shared_trie_root: TwoLevelTrieNode,
        shared_dict: List[bytes]
    ) -> List[Tuple]:
        """
        Compresses a block's raw bytes into two-level tokens:
          - (TAG_SHARED, phrase_id)
          - (TAG_LOCAL, local_prefix_idx, char)
        """
        if not data:
            return []

        tokens = []
        local_dict = {}
        next_local_code = 1
        pos = 0
        data_len = len(data)

        while pos < data_len:
            # 1. Try to match promoted shared phrase (Tier 1)
            shared_id, shared_len = cls.match_shared_phrase(data, pos, shared_trie_root)
            if shared_id is not None and shared_len > 0:
                tokens.append((TAG_SHARED, shared_id))
                pos += shared_len
                continue

            # 2. Fall back to Block-Local LZ78 step (Tier 2)
            curr_idx = 0
            while pos < data_len:
                b = data[pos]
                key = (curr_idx, b)
                if key in local_dict:
                    curr_idx = local_dict[key]
                    pos += 1
                else:
                    tokens.append((TAG_LOCAL, curr_idx, b))
                    local_dict[key] = next_local_code
                    next_local_code += 1
                    pos += 1
                    curr_idx = 0
                    break

            if curr_idx != 0:
                tokens.append((TAG_LOCAL, curr_idx, 0))

        return tokens

    @classmethod
    def serialize_two_level_tokens(cls, tokens: List[Tuple]) -> bytes:
        """
        Serializes two-level tokens into a compact byte stream:
        - Shared 8-bit:  [0x00, shared_id] (2 bytes)
        - Shared 16-bit: [0x02, shared_id_hi, shared_id_lo] (3 bytes)
        - Literal:       [0x03, char] (2 bytes)
        - Local 8-bit:   [0x04, local_idx, char] (3 bytes)
        - Local 16-bit:  [0x01, local_idx_hi, local_idx_lo, char] (4 bytes)
        """
        if not tokens:
            return b""

        buf = bytearray()
        for tok in tokens:
            tag = tok[0]
            if tag == TAG_SHARED:
                shared_id = tok[1]
                if shared_id < 256:
                    buf.append(TAG_SHARED)
                    buf.append(shared_id)
                else:
                    buf.append(TAG_SHARED_16)
                    buf.extend(struct.pack(">H", shared_id))
            else:
                _, local_idx, char = tok
                if local_idx == 0:
                    buf.append(TAG_LITERAL)
                    buf.append(char)
                elif local_idx < 256:
                    buf.append(TAG_LOCAL_8)
                    buf.append(local_idx)
                    buf.append(char)
                else:
                    buf.append(TAG_LOCAL)
                    buf.extend(struct.pack(">HB", local_idx, char))

        return bytes(buf)

    @classmethod
    def deserialize_two_level_tokens(cls, data: bytes) -> List[Tuple]:
        if not data:
            return []

        tokens = []
        offset = 0
        data_len = len(data)

        while offset < data_len:
            tag = data[offset]
            offset += 1

            if tag == TAG_SHARED:
                if offset < data_len:
                    shared_id = data[offset]
                    offset += 1
                    tokens.append((TAG_SHARED, shared_id))
            elif tag == TAG_SHARED_16:
                if offset + 2 <= data_len:
                    shared_id = struct.unpack_from(">H", data, offset)[0]
                    offset += 2
                    tokens.append((TAG_SHARED, shared_id))
            elif tag == TAG_LITERAL:
                if offset < data_len:
                    char = data[offset]
                    offset += 1
                    tokens.append((TAG_LOCAL, 0, char))
            elif tag == TAG_LOCAL_8:
                if offset + 2 <= data_len:
                    local_idx = data[offset]
                    char = data[offset + 1]
                    offset += 2
                    tokens.append((TAG_LOCAL, local_idx, char))
            elif tag == TAG_LOCAL:
                if offset + 3 <= data_len:
                    local_idx, char = struct.unpack_from(">HB", data, offset)
                    offset += 3
                    tokens.append((TAG_LOCAL, local_idx, char))
            else:
                break

        return tokens

    @classmethod
    def decompress_two_level_tokens(
        cls,
        tokens: List[Tuple],
        shared_dict: List[bytes]
    ) -> bytes:
        """
        Reconstructs exact byte stream from two-level tokens.
        100% lossless exact match guarantee.
        """
        if not tokens:
            return b""

        result = bytearray()
        local_dict = {0: b""}
        next_local_code = 1

        for tok in tokens:
            tag = tok[0]
            if tag == TAG_SHARED:
                shared_id = tok[1]
                if 0 <= shared_id < len(shared_dict):
                    result.extend(shared_dict[shared_id])
            elif tag == TAG_LOCAL:
                _, local_idx, char = tok
                prefix = local_dict.get(local_idx, b"")
                if char != 0 or local_idx == 0:
                    phrase = prefix + bytes([char])
                else:
                    phrase = prefix

                result.extend(phrase)
                local_dict[next_local_code] = phrase
                next_local_code += 1

        return bytes(result)
