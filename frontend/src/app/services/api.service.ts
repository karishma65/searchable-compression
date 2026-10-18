import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { DatasetSummary, CompressionMethodMeta } from '../models/dataset.model';
import { ExperimentRecord, BlockSizeTradeoffResponse, GainGateEvaluationsResponse } from '../models/compression.model';
import { SearchResponse } from '../models/search.model';

@Injectable({
  providedIn: 'root'
})
export class ApiService {
  private http = inject(HttpClient);
  private readonly baseUrl = 'http://127.0.0.1:8000/api';

  getHealth(): Observable<{ status: string; service: string; timestamp: number }> {
    return this.http.get<{ status: string; service: string; timestamp: number }>(`${this.baseUrl}/health`);
  }

  getMethods(): Observable<CompressionMethodMeta[]> {
    return this.http.get<CompressionMethodMeta[]>(`${this.baseUrl}/methods`);
  }

  getDatasets(): Observable<DatasetSummary[]> {
    return this.http.get<DatasetSummary[]>(`${this.baseUrl}/datasets`);
  }

  getDataset(name: string): Observable<DatasetSummary> {
    return this.http.get<DatasetSummary>(`${this.baseUrl}/datasets/${encodeURIComponent(name)}`);
  }

  uploadDataset(file: File): Observable<DatasetSummary> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post<DatasetSummary>(`${this.baseUrl}/datasets/upload`, formData);
  }

  generateSample(name: string, lineCount: number): Observable<DatasetSummary> {
    return this.http.post<DatasetSummary>(`${this.baseUrl}/datasets/generate-sample`, {
      name,
      line_count: lineCount
    });
  }

  runCompression(datasetName: string, method: string = 'all', blockSize: number = 100): Observable<ExperimentRecord> {
    return this.http.post<ExperimentRecord>(`${this.baseUrl}/compress`, {
      dataset_name: datasetName,
      method,
      block_size: blockSize
    });
  }

  getExperiments(): Observable<ExperimentRecord[]> {
    return this.http.get<ExperimentRecord[]>(`${this.baseUrl}/experiments`);
  }

  searchLogs(
    datasetName: string,
    query: string = '',
    blockSize: number = 100
  ): Observable<SearchResponse> {
    return this.http.post<SearchResponse>(`${this.baseUrl}/search`, {
      dataset_name: datasetName,
      query,
      block_size: blockSize,
      compare_with_baselines: true
    });
  }

  getBlockSizeTradeoff(datasetName: string): Observable<BlockSizeTradeoffResponse> {
    return this.http.get<BlockSizeTradeoffResponse>(
      `${this.baseUrl}/metrics/block-size-tradeoff?dataset_name=${encodeURIComponent(datasetName)}`
    );
  }

  getGainGateEvaluations(datasetName: string, blockSize: number = 100): Observable<GainGateEvaluationsResponse> {
    return this.http.get<GainGateEvaluationsResponse>(
      `${this.baseUrl}/gain-gate/evaluations?dataset_name=${encodeURIComponent(datasetName)}&block_size=${blockSize}`
    );
  }
}
