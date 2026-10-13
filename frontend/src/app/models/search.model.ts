export interface MatchedLogEntry {
  block_id: number;
  line_no: number;
  raw: string;
}

export interface ProposedSearchResult {
  query: string;
  total_blocks: number;
  blocks_scanned: number;
  blocks_skipped: number;
  candidate_block_ids: number[];
  decoded_block_ids: number[];
  bytes_decoded: number;
  bytes_not_read: number;
  total_uncompressed_bytes: number;
  data_read_pct: number;
  data_not_read_pct: number;
  data_decoded_pct: number;
  data_skipped_pct: number;
  index_lookup_time_ms: number;
  selective_decode_time_ms: number;
  total_search_latency_ms: number;
  match_count: number;
  matching_logs: MatchedLogEntry[];
}

export interface SearchMethodComparisonItem {
  method: string;
  data_decoded_bytes: number;
  data_decoded_pct: number;
  data_not_read_pct?: number;
  blocks_decoded: number;
  blocks_skipped: number;
  total_blocks: number;
  search_latency_ms: number;
  match_count: number;
  selective_advantage: string;
}

export interface SearchComparison {
  methods: SearchMethodComparisonItem[];
  latency_speedup_vs_gzip: number;
  bytes_decoded_reduction_pct: number;
}

export interface SearchResponse {
  dataset_name: string;
  query_details: {
    query: string;
    block_size?: number;
  };
  search_results: ProposedSearchResult;
  comparison: SearchComparison;
}
