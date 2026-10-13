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
            <span class="pill-badge pill-blue">ACTUAL DATA COMPRESSION BENCHMARKS</span>
          </div>
          <h1 class="heading-section" style="font-size: 2.25rem; margin-top: 0.35rem;">Compression & Benchmarking Run</h1>
          <p class="lead-text text-sm" style="color: #64748b; margin-top: 0.25rem;">
            Benchmark the proposed Block LZ78 + Huffman algorithm against Gzip DEFLATE, standard LZ78, and Raw baselines on authentic log bytes
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
              <option value="all">All Methods (Head-to-Head Benchmark)</option>
              <option value="proposed">Proposed: Block LZ78 + Huffman + Index</option>
              <option value="gzip">Gzip Baseline (DEFLATE)</option>
              <option value="lz78">LZ78 Baseline (Global Dictionary)</option>
              <option value="raw">Raw / Uncompressed Baseline</option>
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
              Chunking granularity controls the selective search pruning ratio
            </div>
          </div>

        </div>

        <div class="flex items-center justify-between flex-wrap gap-4" style="padding-top: 1rem; border-top: 1px solid var(--border-light);">
          <span class="text-muted text-xs">
            FastAPI backend executes actual LZ78 and Huffman algorithms and returns real timings.
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
              <h2 class="heading-sub" style="font-size: 1.5rem; margin-top: 0.35rem;">Block-based LZ78 + Huffman + Search Index</h2>
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
              <span class="metric-label">Compression Ratio</span>
              <span class="metric-value" style="color: #059669;">{{ prop.compression_ratio }}&times;</span>
              <span class="text-xs text-muted">With Index: {{ prop.total_compression_ratio_with_index }}&times;</span>
            </div>

            <div class="metric-box">
              <span class="metric-label">Space Saving</span>
              <span class="metric-value" style="color: #059669;">{{ prop.space_saving_pct }}%</span>
              <span class="text-xs text-muted">Net Saving: {{ prop.space_saving_with_index_pct }}%</span>
            </div>

            <div class="metric-box">
              <span class="metric-label">Compressed Size</span>
              <span class="metric-value" style="color: #0f172a;">{{ prop.compressed_size | number }} B</span>
              <span class="text-xs text-mono text-muted">Raw: {{ prop.original_size | number }} B</span>
            </div>

            <div class="metric-box">
              <span class="metric-label">Index Size</span>
              <span class="metric-value" style="color: #7c3aed;">{{ prop.index_size | number }} B</span>
              <span class="text-xs text-muted">Inverted Postings</span>
            </div>

            <div class="metric-box">
              <span class="metric-label">Total Blocks</span>
              <span class="metric-value" style="color: #2563eb;">{{ prop.total_blocks }}</span>
              <span class="text-xs text-muted">{{ exp.block_size }} lines/block</span>
            </div>

            <div class="metric-box">
              <span class="metric-label">Compression Time</span>
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
              <span class="bracket-tag">[ BENCHMARK RESULTS ]</span>
              <h2 class="heading-section" style="margin-top: 0.25rem;">Comparative Baseline Matrix</h2>
            </div>
            <span class="text-muted text-mono text-xs">Executed at: {{ exp.timestamp }}</span>
          </div>

          <div class="data-table-wrapper">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Method</th>
                  <th>Original Size</th>
                  <th>Compressed Size</th>
                  <th>Index Size</th>
                  <th>Total Storage</th>
                  <th>Ratio</th>
                  <th>Space Saving</th>
                  <th>Compression Time</th>
                  <th>Selective Search</th>
                </tr>
              </thead>
              <tbody class="text-mono">
                <tr *ngFor="let res of exp.results" [style.background]="res.selective_searchable ? '#eff6ff' : 'transparent'">
                  <td style="font-weight: 700; color: #0f172a;">
                    {{ res.method }}
                  </td>
                  <td class="text-muted">{{ res.original_size | number }} B</td>
                  <td style="font-weight: 700; color: #2563eb;">{{ res.compressed_size | number }} B</td>
                  <td class="text-muted">{{ res.index_size | number }} B</td>
                  <td style="font-weight: 700;">{{ res.total_storage | number }} B</td>
                  <td style="color: #059669; font-weight: 700;">{{ res.compression_ratio }}&times;</td>
                  <td style="color: #059669;">{{ res.space_saving_pct }}%</td>
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
    return current.results.find(r => r.selective_searchable || r.method.includes('Proposed'));
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
