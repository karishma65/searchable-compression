export interface BlockSummary {
  block_id: number;
  start_line: number;
  end_line: number;
  line_count: number;
  uncompressed_bytes: number;
  compressed_bytes: number;
  ratio?: number;
}

export interface MethodCompressionResult {
  method: string;
  block_size: number | string;
  total_blocks: number;
  original_size: number;
  compressed_size: number;
  blocks_compressed_size?: number;
  lz78_intermediate_size?: number;
  shared_dictionary_size?: number;
  shared_phrases_count?: number;
  index_size: number;
  total_storage: number;
  payload_compression_ratio?: number;
  compression_ratio: number;
  total_compression_ratio_with_index?: number;
  space_saving_pct: number;
  storage_overhead_pct?: number;
  space_saving_with_index_pct?: number;
  compression_time_ms: number;
  decompression_time_ms?: number;
  search_time_ms?: number | null;
  data_decoded_bytes?: number | null;
  data_decoded_pct?: number | null;
  selective_searchable: boolean;
  blocks_summary?: BlockSummary[];
}

export interface EvaluatedPhraseItem {
  phrase: string;
  length: number;
  frequency: number;
  block_ids_count: number;
  marginal_gain_bytes: number;
  data_savings_bytes: number;
  dict_cost_bytes: number;
  index_cost_bytes: number;
  is_promoted: boolean;
  rejection_reason?: string;
}

export interface GainGateSummary {
  total_candidates_mined: number;
  promoted_count: number;
  rejected_count: number;
  total_projected_gain_bytes: number;
  mode: string;
}

export interface GainGateEvaluationsResponse {
  dataset_name: string;
  block_size: number;
  selection_summary: GainGateSummary;
  evaluations: EvaluatedPhraseItem[];
}

export interface ExperimentRecord {
  timestamp: string;
  dataset_name: string;
  line_count: number;
  block_size: number;
  results: MethodCompressionResult[];
  gain_gate_summary?: GainGateSummary;
  evaluations_sample?: EvaluatedPhraseItem[];
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
