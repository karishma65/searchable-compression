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
    <div class="space-y-8 py-6 max-w-7xl mx-auto px-4 sm:px-6">
      
      <!-- Page Header -->
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 class="text-2xl font-bold text-white tracking-tight">Compression & Benchmarking Experiment</h1>
          <p class="text-xs text-slate-400">
            Evaluate Block-based LZ78 + Huffman vs Gzip, LZ78, and Raw Baselines using real backend compression algorithms
          </p>
        </div>
      </div>

      <!-- Experiment Configuration Form Card -->
      <div class="glass-card p-6 space-y-6">
        <h2 class="text-base font-bold text-white flex items-center gap-2">
          <svg class="w-5 h-5 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
          </svg>
          Experiment Parameters
        </h2>

        <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
          
          <!-- 1. Dataset Selection -->
          <div class="space-y-2">
            <label class="block text-xs font-semibold text-slate-300">Target Dataset</label>
            <select
              [value]="state.selectedDatasetName()"
              (change)="onDatasetSelect($event)"
              class="form-select text-xs font-mono">
              <option *ngFor="let d of state.datasets()" [value]="d.name">
                {{ d.name }} ({{ d.line_count }} lines, {{ d.size_kb }} KB)
              </option>
            </select>
            <div *ngIf="state.selectedDataset()" class="text-[11px] text-slate-500 font-mono">
              Raw size: {{ state.selectedDataset()!.size_bytes | number }} bytes &bull; {{ state.selectedDataset()!.unique_services.length }} services
            </div>
          </div>

          <!-- 2. Compression Method -->
          <div class="space-y-2">
            <label class="block text-xs font-semibold text-slate-300">Compression Method</label>
            <select [(ngModel)]="selectedMethod" class="form-select text-xs">
              <option value="all">All Methods (Full Comparative Benchmark)</option>
              <option value="proposed">Proposed: Block LZ78 + Huffman + Index</option>
              <option value="gzip">Gzip Baseline (DEFLATE)</option>
              <option value="lz78">LZ78 Baseline (Global Dictionary)</option>
              <option value="raw">Raw / Uncompressed Baseline</option>
            </select>
            <div class="text-[11px] text-slate-500">
              Run all 4 methods simultaneously for instant head-to-head metrics
            </div>
          </div>

          <!-- 3. Block Size (Chunking) -->
          <div class="space-y-2">
            <div class="flex items-center justify-between">
              <label class="block text-xs font-semibold text-slate-300">Block Size (Lines / Block)</label>
              <span class="text-xs font-mono font-bold text-cyan-400">{{ selectedBlockSize }} lines</span>
            </div>
            
            <div class="grid grid-cols-5 gap-1.5 pt-1">
              <button
                *ngFor="let size of [25, 50, 100, 250, 500]"
                type="button"
                (click)="selectedBlockSize = size"
                [class.border-cyan-500]="selectedBlockSize === size"
                [class.bg-cyan-950/40]="selectedBlockSize === size"
                [class.text-cyan-300]="selectedBlockSize === size"
                class="py-1.5 text-center text-xs font-mono font-semibold rounded-lg border border-slate-700 bg-slate-900/60 hover:border-slate-500 cursor-pointer">
                {{ size }}
              </button>
            </div>
            <div class="text-[11px] text-slate-500">
              Controls partition granularity: fine-grained blocks vs dictionary span
            </div>
          </div>

        </div>

        <div class="pt-2 flex items-center justify-between border-t border-[var(--border-subtle)]">
          <div class="text-xs text-slate-400">
            Backend will calculate exact compression ratios, storage overhead, and timing.
          </div>
          <button
            (click)="runExperiment()"
            [disabled]="isRunning() || !state.selectedDataset()"
            class="btn btn-cyan">
            <svg *ngIf="!isRunning()" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            <span *ngIf="isRunning()" class="animate-spin inline-block mr-1">⌛</span>
            {{ isRunning() ? 'Executing Real Compression...' : 'Execute Compression Experiment' }}
          </button>
        </div>

      </div>

      <!-- Real Benchmark Results -->
      <div *ngIf="exp" class="space-y-6">
        
        <!-- Summary Header & KPIs for Proposed Method -->
        <div *ngIf="prop" class="glass-card p-6 border-cyan-500/30 space-y-6">
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[var(--border-subtle)]">
            <div>
              <div class="flex items-center gap-2">
                <span class="badge badge-info">PROPOSED METHOD PERFORMANCE</span>
                <span class="text-xs text-slate-400 font-mono">{{ exp.dataset_name }} (Block Size: {{ exp.block_size }})</span>
              </div>
              <h2 class="text-xl font-bold text-white mt-1">Block-based LZ78 + Huffman + Search Index</h2>
            </div>
            <div class="flex items-center gap-2">
              <button (click)="state.setTab('search')" class="btn btn-cyan text-xs">
                Test Selective Search with This Model &rarr;
              </button>
            </div>
          </div>

          <!-- KPI Metric Cards Grid -->
          <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            
            <div class="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800">
              <div class="text-[10px] text-slate-400 uppercase font-semibold">Compression Ratio</div>
              <div class="text-xl font-extrabold text-cyan-400 font-mono mt-1">{{ prop.compression_ratio }}x</div>
              <div class="text-[10px] text-slate-500 font-mono">With Index: {{ prop.total_compression_ratio_with_index }}x</div>
            </div>

            <div class="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800">
              <div class="text-[10px] text-slate-400 uppercase font-semibold">Space Saving</div>
              <div class="text-xl font-extrabold text-emerald-400 font-mono mt-1">{{ prop.space_saving_pct }}%</div>
              <div class="text-[10px] text-slate-500 font-mono">Net: {{ prop.space_saving_with_index_pct }}%</div>
            </div>

            <div class="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800">
              <div class="text-[10px] text-slate-400 uppercase font-semibold">Compressed Size</div>
              <div class="text-xl font-extrabold text-white font-mono mt-1">{{ prop.compressed_size | number }} B</div>
              <div class="text-[10px] text-slate-500 font-mono">Orig: {{ prop.original_size | number }} B</div>
            </div>

            <div class="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800">
              <div class="text-[10px] text-slate-400 uppercase font-semibold">Index Size</div>
              <div class="text-xl font-extrabold text-indigo-400 font-mono mt-1">{{ prop.index_size | number }} B</div>
              <div class="text-[10px] text-slate-500 font-mono">Inverted Vocab+Postings</div>
            </div>

            <div class="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800">
              <div class="text-[10px] text-slate-400 uppercase font-semibold">Total Blocks</div>
              <div class="text-xl font-extrabold text-purple-400 font-mono mt-1">{{ prop.total_blocks }}</div>
              <div class="text-[10px] text-slate-500 font-mono">{{ exp.block_size }} lines/block</div>
            </div>

            <div class="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800">
              <div class="text-[10px] text-slate-400 uppercase font-semibold">Compression Time</div>
              <div class="text-xl font-extrabold text-amber-400 font-mono mt-1">{{ prop.compression_time_ms }} ms</div>
              <div class="text-[10px] text-slate-500 font-mono">Decomp: {{ prop.decompression_time_ms }} ms</div>
            </div>

          </div>

          <!-- Interactive Blocks Grid Display -->
          <div *ngIf="prop.blocks_summary && prop.blocks_summary.length > 0" class="space-y-3 pt-2">
            <div class="flex items-center justify-between">
              <div>
                <h3 class="text-sm font-bold text-white">Generated Compressed Blocks</h3>
                <p class="text-xs text-slate-400">Click any block to inspect its individual line boundaries and compression ratio</p>
              </div>
            </div>
            <app-block-grid [blocks]="prop.blocks_summary" [isSearchMode]="false"></app-block-grid>
          </div>
        </div>

        <!-- Comprehensive Methods Comparison Table -->
        <div class="glass-card p-6 space-y-4">
          <div class="flex items-center justify-between">
            <h2 class="text-base font-bold text-white">Comprehensive Baseline Comparison (Actual Backend Data)</h2>
            <span class="text-xs text-slate-400 font-mono">Executed at: {{ exp.timestamp }}</span>
          </div>

          <div class="overflow-x-auto">
            <table class="w-full text-left text-xs text-slate-300">
              <thead class="bg-slate-900/90 text-slate-400 uppercase font-semibold text-[10px] tracking-wider border-b border-slate-800">
                <tr>
                  <th class="p-3">Method</th>
                  <th class="p-3">Original Size</th>
                  <th class="p-3">Compressed Size</th>
                  <th class="p-3">Index Size</th>
                  <th class="p-3">Total Storage</th>
                  <th class="p-3">Ratio</th>
                  <th class="p-3">Space Saving</th>
                  <th class="p-3">Comp. Time</th>
                  <th class="p-3">Selective Search</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-800/60 font-mono">
                <tr *ngFor="let res of exp.results" 
                  [class.bg-cyan-950/20]="res.selective_searchable"
                  [class.text-white]="res.selective_searchable"
                  class="hover:bg-slate-800/40 transition-colors">
                  
                  <td class="p-3 font-semibold flex items-center gap-2">
                    <span
                      [class.bg-cyan-400]="res.selective_searchable"
                      [class.bg-amber-400]="res.method.includes('Gzip')"
                      [class.bg-purple-400]="res.method.includes('LZ78')"
                      [class.bg-slate-600]="res.method.includes('Raw')"
                      class="w-2.5 h-2.5 rounded-full inline-block"></span>
                    {{ res.method }}
                  </td>
                  <td class="p-3 text-slate-400">{{ res.original_size | number }} B</td>
                  <td class="p-3 text-cyan-300 font-bold">{{ res.compressed_size | number }} B</td>
                  <td class="p-3 text-indigo-300">{{ res.index_size | number }} B</td>
                  <td class="p-3 text-slate-200 font-bold">{{ res.total_storage | number }} B</td>
                  <td class="p-3 text-emerald-400 font-bold">{{ res.compression_ratio }}x</td>
                  <td class="p-3 text-emerald-300">{{ res.space_saving_pct }}%</td>
                  <td class="p-3 text-amber-300">{{ res.compression_time_ms }} ms</td>
                  <td class="p-3">
                    <span *ngIf="res.selective_searchable" class="badge badge-success text-[10px]">SUPPORTED (Target Blocks)</span>
                    <span *ngIf="!res.selective_searchable" class="badge badge-error text-[10px]">NO (Full Decompression)</span>
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
