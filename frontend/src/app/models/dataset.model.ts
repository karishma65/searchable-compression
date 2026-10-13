export interface DatasetSummary {
  name: string;
  source: string;
  line_count: number;
  size_bytes: number;
  size_kb: number;
  size_mb: number;
  unique_services: string[];
  level_distribution: Record<string, number>;
  first_timestamp: string;
  last_timestamp: string;
  sample_lines?: string[];
}

export interface CompressionMethodMeta {
  id: string;
  name: string;
  type: string;
  description: string;
  selective_search_support: boolean;
}
