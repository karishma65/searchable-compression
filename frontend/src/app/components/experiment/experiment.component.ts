import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { StateService } from '../../services/state.service';
import { ApiService } from '../../services/api.service';
import { MethodCompressionResult, ExperimentRecord } from '../../models/compression.model';
import { BlockGridComponent } from '../block-grid/block-grid.component';

@Component({
  selector: 'app-experiment',
  standalone: true,
  imports: [CommonModule, FormsModule, BlockGridComponent],
  template: `
    <div class="app-container section-spacing flex flex-col gap-8">
      
      <!-- Page Header -->
      <div class="flex items-center justify-between flex-wrap gap-4">
        <div>
          <div class="flex items-center gap-2">
            <span class="bracket-tag">[ BENCHMARK EXECUTION STUDIO ]</span>
            <span class="pill-badge pill-blue">Path 1: Gain-Gated Shared-Dictionary Block DEFLATE</span>
          </div>
          <h1 class="heading-section" style="font-size: 2.25rem; margin-top: 0.35rem;">Compression &amp; Benchmarking Run</h1>
          <p class="lead-text text-sm" style="color: #64748b; margin-top: 0.25rem;">
            Benchmark the proposed Gain-Gated Shared-Dictionary Block DEFLATE algorithm against unconditional ablation, naive block LZ78, worst baseline (RLE), and raw baselines on authentic log bytes
          </p>
        </div>
      </div>

      <!-- Parameter Selection Panel -->
      <div class="panel flex flex-col gap-6" style="background: #ffffff;">
        <div class="flex items-center justify-between flex-wrap gap-2">
          <div>
            <span class="bracket-tag">[ CONFIGURATION PARAMETERS ]</span>
            <h2 class="heading-sub" style="margin-top: 0.25rem;">Experiment Configuration</h2>
          </div>
          <span class="pill-badge pill-default text-xs">Configurable Chunking</span>
        </div>

        <div class="grid grid-cols-3 gap-6">
          
          <!-- 1. Dataset Selection -->
          <div class="flex flex-col gap-1.5">
            <label class="text-xs font-semibold text-muted uppercase tracking-wider">Active Log Dataset</label>
            <select
              [value]="state.selectedDatasetName()"
              (change)="onDatasetSelect($event)"
              class="input-control text-mono text-sm">
              <option *ngFor="let d of state.datasets()" [value]="d.name">
                {{ d.name }} ({{ d.line_count }} lines, {{ d.size_kb }} KB)
              </option>
            </select>
            <div *ngIf="state.selectedDataset()" class="text-muted text-xs text-mono" style="margin-top: 0.25rem;">
              Raw size: {{ state.selectedDataset()!.size_bytes | number }} bytes &bull; {{ state.selectedDataset()!.unique_services.length }} services
            </div>
          </div>

          <!-- 2. Compression Method -->
          <div class="flex flex-col gap-1.5">
            <label class="text-xs font-semibold text-muted uppercase tracking-wider">Compression Method</label>
            <select [(ngModel)]="selectedMethod" class="input-control text-sm">
              <option value="all">All Methods (5-Way Ablation Benchmark)</option>
              <option value="proposed">Proposed: Gain-Gated Shared-Dictionary Block DEFLATE</option>
              <option value="unconditional">Ablation: Unconditional Shared-Dictionary DEFLATE</option>
              <option value="naive_block">Baseline: Naive Block LZ78 + Huffman</option>
              <option value="rle">Worst Baseline: Run-Length Encoding (RLE)</option>
              <option value="raw">Baseline: Raw / Uncompressed Logs</option>
            </select>
            <div class="text-muted text-xs" style="margin-top: 0.25rem;">
              Runs algorithms side-by-side on exact identical input bytes
            </div>
          </div>

          <!-- 3. Block Size (Chunking) -->
          <div class="flex flex-col gap-1.5">
            <div class="flex items-center justify-between">
              <label class="text-xs font-semibold text-muted uppercase tracking-wider">Block Granularity</label>
              <span class="text-mono text-xs font-bold" style="color: #2563eb;">{{ selectedBlockSize }} lines/block</span>
            </div>
            
            <div class="grid grid-cols-5 gap-1.5" style="margin-top: 0.25rem;">
              <button
                *ngFor="let size of [25, 50, 100, 250, 500]"
                type="button"
                (click)="selectedBlockSize = size"
                [class.btn-primary]="selectedBlockSize === size"
                [class.btn-outline]="selectedBlockSize !== size"
                class="btn btn-sm text-mono">
                {{ size }}
              </button>
            </div>
            <div class="text-muted text-xs" style="margin-top: 0.25rem;">
              Granularity controls search skipping &amp; cold-start mitigation
            </div>
          </div>

        </div>

        <div class="flex items-center justify-between flex-wrap gap-4" style="padding-top: 1rem; border-top: 1px solid var(--border-light);">
          <span class="text-muted text-xs">
            FastAPI backend executes gain-gated phrase mining, shared-dictionary DEFLATE, and integrated indexing.
          </span>
          
          <button
            (click)="runExperiment()"
            [disabled]="isRunning() || !state.selectedDataset()"
            class="btn btn-primary btn-lg">
            <span *ngIf="isRunning()">Executing Compression...</span>
            <span *ngIf="!isRunning()">Execute Compression Experiment</span>
            <svg *ngIf="!isRunning()" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <polygon points="5 3 19 12 5 21 5 3"></polygon>
            </svg>
          </button>
        </div>
      </div>

      <!-- Experiment Results -->
      <div *ngIf="exp" class="flex flex-col gap-6">
        
        <!-- Proposed Method Highlight Box -->
        <div *ngIf="prop" class="panel flex flex-col gap-6" style="border-top: 4px solid #2563eb; background: #ffffff;">
          <div class="flex items-center justify-between flex-wrap gap-3">
            <div>
              <div class="flex items-center gap-2">
                <span class="pill-badge pill-blue">PROPOSED METHOD BENCHMARK</span>
                <span class="text-muted text-mono text-xs">{{ exp.dataset_name }} (Block Size: {{ exp.block_size }})</span>
              </div>
              <h2 class="heading-sub" style="font-size: 1.5rem; margin-top: 0.35rem;">
                Gain-Gated Shared-Dictionary Block DEFLATE + Integrated Index
              </h2>
            </div>

            <button (click)="state.setTab('search')" class="btn btn-blue btn-sm">
              <span>Test Selective Search</span>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M5 12h14"></path>
                <path d="m12 5 7 7-7 7"></path>
              </svg>
            </button>
          </div>

          <!-- 6 Metric Cards -->
          <div class="grid grid-cols-3 gap-4">
            <div class="metric-box">
              <span class="metric-label">Payload Compression Ratio</span>
              <span class="metric-value" style="color: #2563eb;">{{ prop.payload_compression_ratio || prop.compression_ratio }}&times;</span>
              <span class="text-xs text-muted">Blocks: {{ (prop.blocks_compressed_size || prop.compressed_size) | number }} B</span>
            </div>

            <div class="metric-box">
              <span class="metric-label">Overall Ratio (With Index)</span>
              <span class="metric-value" style="color: #059669;">{{ prop.compression_ratio }}&times;</span>
              <span class="text-xs text-muted">Total Storage: {{ prop.total_storage | number }} B</span>
            </div>

            <div class="metric-box">
              <span class="metric-label">Space Saving</span>
              <span class="metric-value" style="color: #059669;">{{ prop.space_saving_pct }}%</span>
              <span class="text-xs text-muted">Original: {{ prop.original_size | number }} B</span>
            </div>

            <div class="metric-box">
              <span class="metric-label">Shared Seed Dictionary</span>
              <span class="metric-value" style="color: #0f172a;">{{ (prop.shared_dictionary_size || 0) | number }} B</span>
              <span class="text-xs text-muted">{{ prop.shared_phrases_count || 0 }} gain-gated phrases</span>
            </div>

            <div class="metric-box">
              <span class="metric-label">Integrated Index Size</span>
              <span class="metric-value" style="color: #7c3aed;">{{ prop.index_size | number }} B</span>
              <span class="text-xs text-muted">Postings for promoted phrases only</span>
            </div>

            <div class="metric-box">
              <span class="metric-label">Execution Latency</span>
              <span class="metric-value" style="color: #d97706;">{{ prop.compression_time_ms }} ms</span>
              <span class="text-xs text-muted">Decomp: {{ prop.decompression_time_ms }} ms</span>
            </div>
          </div>

          <!-- Blocks Visualization Grid -->
          <div *ngIf="prop.blocks_summary && prop.blocks_summary.length > 0" class="flex flex-col gap-3">
            <div>
              <span class="bracket-tag">[ COMPRESSED BLOCKS DISPATCH ]</span>
              <h3 class="heading-sub" style="margin-top: 0.25rem;">Partitioned Compressed Blocks</h3>
              <p class="text-muted text-xs">Click any block to inspect line span and individual block ratio</p>
            </div>
            <app-block-grid [blocks]="prop.blocks_summary" [isSearchMode]="false"></app-block-grid>
          </div>
        </div>

        <!-- Comparative Baselines Table -->
        <div class="panel flex flex-col gap-4" style="background: #ffffff;">
          <div class="flex items-center justify-between flex-wrap gap-2">
            <div>
              <span class="bracket-tag">[ 5-WAY ABLATION BENCHMARK ]</span>
              <h2 class="heading-section" style="margin-top: 0.25rem;">Comparative Baseline Matrix</h2>
            </div>
            <span class="text-muted text-mono text-xs">Executed at: {{ exp.timestamp }}</span>
          </div>

          <div class="data-table-wrapper">
            <table class="data-table">
              <thead>
                <tr>
                  <th style="min-width: 220px;">Method</th>
                  <th>Original Size</th>
                  <th>Data Blocks</th>
                  <th>Shared Dict</th>
                  <th>Search Index</th>
                  <th>Total Archive Storage</th>
                  <th>Ratio</th>
                  <th>Space Saving</th>
                  <th>Time</th>
                  <th>Selective Search</th>
                </tr>
              </thead>
              <tbody class="text-mono">
                <tr *ngFor="let res of exp.results" [style.background]="res.method.includes('Proposed') ? '#eff6ff' : (res.method.includes('Unconditional') ? '#faf5ff' : 'transparent')">
                  <td style="font-weight: 700;" [style.color]="res.method.includes('Proposed') ? '#2563eb' : (res.method.includes('Worst') || res.method.includes('RLE') ? '#dc2626' : '#0f172a')">
                    {{ res.method }}
                  </td>
                  <td class="text-muted">{{ res.original_size | number }} B</td>
                  <td style="font-weight: 600;" [style.color]="res.method.includes('Worst') || res.method.includes('RLE') ? '#dc2626' : '#2563eb'">{{ (res.blocks_compressed_size || res.compressed_size) | number }} B</td>
                  <td class="text-muted">{{ (res.shared_dictionary_size || 0) | number }} B</td>
                  <td [style.color]="res.index_size > 50000 ? '#dc2626' : '#7c3aed'">
                    {{ res.index_size | number }} B
                  </td>
                  <td style="font-weight: 700;" [style.color]="res.method.includes('Proposed') ? '#059669' : (res.method.includes('Worst') || res.method.includes('RLE') ? '#dc2626' : '#0f172a')">
                    {{ res.total_storage | number }} B
                  </td>
                  <td style="font-weight: 700;" [style.color]="res.compression_ratio < 1.0 ? '#dc2626' : '#059669'">{{ res.compression_ratio }}&times;</td>
                  <td>
                    <span [style.color]="res.total_storage > res.original_size ? '#dc2626' : '#059669'" [style.font-weight]="res.total_storage > res.original_size ? '700' : 'normal'">
                      {{ res.total_storage > res.original_size ? '+' + (((res.total_storage - res.original_size) / res.original_size) * 100).toFixed(1) + '% overhead' : res.space_saving_pct + '% saved' }}
                    </span>
                  </td>
                  <td>{{ res.compression_time_ms }} ms</td>
                  <td>
                    <span *ngIf="res.selective_searchable" class="pill-badge pill-emerald text-xs">YES (Candidate Blocks)</span>
                    <span *ngIf="!res.selective_searchable" class="pill-badge pill-crimson text-xs">NO (Full Decompress)</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

      </div>

    </div>
  `
})
export class ExperimentComponent {
  state = inject(StateService);
  api = inject(ApiService);

  selectedMethod = 'all';
  selectedBlockSize = 100;
  isRunning = signal<boolean>(false);

  get exp(): ExperimentRecord | null {
    return this.state.latestExperiment();
  }

  get prop(): MethodCompressionResult | undefined {
    const current = this.exp;
    if (!current) return undefined;
    return current.results.find(r => r.method.includes('Proposed') || (r.selective_searchable && !r.method.includes('Naive') && !r.method.includes('Unconditional')));
  }

  onDatasetSelect(e: Event): void {
    const select = e.target as HTMLSelectElement;
    const found = this.state.datasets().find(d => d.name === select.value);
    if (found) {
      this.state.setSelectedDataset(found);
    }
  }

  runExperiment(): void {
    const dataset = this.state.selectedDataset();
    if (!dataset) return;

    this.isRunning.set(true);
    this.api.runCompression(dataset.name, this.selectedMethod, this.selectedBlockSize).subscribe({
      next: (record) => {
        this.isRunning.set(false);
        this.state.latestExperiment.set(record);
      },
      error: (err) => {
        this.isRunning.set(false);
        alert('Compression experiment failed: ' + err.message);
      }
    });
  }
}
