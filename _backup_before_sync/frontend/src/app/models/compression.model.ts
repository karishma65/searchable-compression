export interface BlockSummary {
  block_id: number;
  start_line: number;
  end_line: number;
  line_count: number;
  uncompressed_bytes: number;
  compressed_bytes: number;
  ratio: number;
}

export interface MethodCompressionResult {
  method: string;
  block_size: number | string;
  total_blocks: number;
  original_size: number;
  compressed_size: number;
  lz78_intermediate_size?: number;
  index_size: number;
  total_storage: number;
  compression_ratio: number;
  total_compression_ratio_with_index: number;
  space_saving_pct: number;
  space_saving_with_index_pct: number;
  compression_time_ms: number;
  decompression_time_ms: number;
  selective_searchable: boolean;
  blocks_summary?: BlockSummary[];
}

export interface ExperimentRecord {
  timestamp: string;
  dataset_name: string;
  line_count: number;
  block_size: number;
  results: MethodCompressionResult[];
}

export interface BlockSizeTradeoffPoint {
  block_size: number;
  block_count: number;
  compression_ratio: number;
  total_compression_ratio_with_index: number;
  compressed_size_bytes: number;
  index_size_bytes: number;
  index_overhead_pct: number;
  search_latency_ms: number;
  blocks_scanned: number;
  blocks_skipped: number;
  data_decoded_pct: number;
}

export interface BlockSizeTradeoffResponse {
  dataset_name: string;
  original_size: number;
  total_lines: number;
  test_query: string;
  tradeoff_analysis: BlockSizeTradeoffPoint[];
  conclusion: string;
}
