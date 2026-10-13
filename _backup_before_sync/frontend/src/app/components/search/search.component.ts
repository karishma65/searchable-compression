import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { StateService } from '../../services/state.service';
import { ApiService } from '../../services/api.service';
import { SearchResponse, ProposedSearchResult } from '../../models/search.model';
import { BlockSummary } from '../../models/compression.model';
import { BlockGridComponent } from '../block-grid/block-grid.component';

@Component({
  selector: 'app-search',
  standalone: true,
  imports: [CommonModule, FormsModule, BlockGridComponent],
  template: `
    <div class="space-y-8 py-6 max-w-7xl mx-auto px-4 sm:px-6">
      
      <!-- Header -->
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 class="text-2xl font-bold text-white tracking-tight">Selective Compressed Log Search</h1>
          <p class="text-xs text-slate-400">
            Query the inverted index, identify candidate blocks, and decompress <strong>only</strong> relevant blocks
          </p>
        </div>
      </div>

      <!-- Search Controls & Presets Card -->
      <div class="glass-card p-6 space-y-5">
        
        <!-- Quick Preset Queries -->
        <div class="space-y-2">
          <div class="flex items-center justify-between">
            <span class="text-xs font-semibold text-slate-300">Research Benchmark Presets:</span>
            <span class="text-[11px] text-slate-500">Click to auto-populate query parameters</span>
          </div>
          <div class="flex flex-wrap gap-2">
            <button
              (click)="applyPreset('database-service timeout', 'ERROR', 'database-service')"
              class="px-3 py-1.5 rounded-lg bg-cyan-950/40 border border-cyan-500/40 hover:bg-cyan-900/50 text-cyan-300 text-xs font-mono font-medium transition-all">
              🎯 ERROR + database-service + timeout
            </button>
            <button
              (click)="applyPreset('slow query', 'WARN', 'database-service')"
              class="px-3 py-1.5 rounded-lg bg-slate-800/80 border border-slate-700 hover:border-slate-500 text-slate-300 text-xs font-mono transition-all">
              WARN + slow query
            </button>
            <button
              (click)="applyPreset('connection refused', 'ERROR', 'payment-service')"
              class="px-3 py-1.5 rounded-lg bg-slate-800/80 border border-slate-700 hover:border-slate-500 text-slate-300 text-xs font-mono transition-all">
              ERROR + payment-service + refused
            </button>
            <button
              (click)="applyPreset('jwt validation timeout', 'ERROR', 'auth-service')"
              class="px-3 py-1.5 rounded-lg bg-slate-800/80 border border-slate-700 hover:border-slate-500 text-slate-300 text-xs font-mono transition-all">
              ERROR + auth-service + timeout
            </button>
          </div>
        </div>

        <!-- Main Query Bar & Filters -->
        <div class="grid grid-cols-1 lg:grid-cols-12 gap-3 pt-2">
          
          <!-- Search keywords input -->
          <div class="lg:col-span-5">
            <label class="block text-xs font-semibold text-slate-300 mb-1">Keywords / Search Terms</label>
            <div class="relative">
              <input
                type="text"
                [(ngModel)]="queryText"
                (keyup.enter)="executeSearch()"
                placeholder="e.g. database-service timeout"
                class="form-input text-xs font-mono pl-9 text-cyan-300">
              <svg class="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
          </div>

          <!-- Log level filter -->
          <div class="lg:col-span-2">
            <label class="block text-xs font-semibold text-slate-300 mb-1">Log Level</label>
            <select [(ngModel)]="levelFilter" class="form-select text-xs">
              <option value="">ALL LEVELS</option>
              <option value="ERROR">ERROR</option>
              <option value="WARN">WARN</option>
              <option value="INFO">INFO</option>
              <option value="DEBUG">DEBUG</option>
              <option value="FATAL">FATAL</option>
            </select>
          </div>

          <!-- Microservice filter -->
          <div class="lg:col-span-3">
            <label class="block text-xs font-semibold text-slate-300 mb-1">Microservice / Pod</label>
            <select [(ngModel)]="serviceFilter" class="form-select text-xs font-mono">
              <option value="">ALL SERVICES</option>
              <option *ngFor="let svc of getAvailableServices()" [value]="svc">{{ svc }}</option>
            </select>
          </div>

          <!-- Action Button -->
          <div class="lg:col-span-2 flex items-end">
            <button
              (click)="executeSearch()"
              [disabled]="isSearching() || !state.selectedDataset()"
              class="w-full btn btn-cyan text-xs h-[38px]">
              <span *ngIf="isSearching()" class="animate-spin inline-block mr-1">⌛</span>
              {{ isSearching() ? 'Searching...' : 'Selective Search' }}
            </button>
          </div>

        </div>

      </div>

      <!-- Real Search Results & Selective Decompression Evidence -->
      <div *ngIf="searchData" class="space-y-6">
        
        <!-- PROOF OF CONCEPT BANNER -->
        <div class="glass-card p-6 border border-emerald-500/40 relative overflow-hidden bg-gradient-to-r from-emerald-950/20 via-slate-900 to-cyan-950/20">
          <div class="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            
            <div class="space-y-2 max-w-xl">
              <div class="flex items-center gap-2">
                <span class="badge badge-success text-[10px]">SELECTIVE DECOMPRESSION VERIFIED</span>
                <span class="text-xs font-mono text-emerald-400 font-bold">
                  {{ searchData.search_results.data_skipped_pct }}% of Compressed Data Bypassed!
                </span>
              </div>
              <h2 class="text-xl font-extrabold text-white">
                Decoded only {{ searchData.search_results.blocks_scanned }} of {{ searchData.search_results.total_blocks }} blocks
              </h2>
              <p class="text-xs text-slate-300 leading-relaxed">
                By consulting the inverted index posting lists, the system safely avoided decompressing 
                <strong class="text-white">{{ searchData.search_results.blocks_skipped }} blocks</strong> 
                ({{ searchData.search_results.total_uncompressed_bytes - searchData.search_results.bytes_decoded | number }} bytes). 
                Gzip or standard compressed search would have been forced to decompress 100% of the archive.
              </p>
            </div>

            <!-- Key Comparison Metrics -->
            <div class="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div class="p-3 rounded-xl bg-slate-900/90 border border-emerald-500/30">
                <div class="text-[10px] text-slate-400 uppercase font-semibold">Blocks Decoded</div>
                <div class="text-xl font-mono font-bold text-emerald-400 mt-1">
                  {{ searchData.search_results.blocks_scanned }} <span class="text-xs text-slate-500">/ {{ searchData.search_results.total_blocks }}</span>
                </div>
                <div class="text-[10px] text-slate-500">Target Candidates</div>
              </div>

              <div class="p-3 rounded-xl bg-slate-900/90 border border-cyan-500/30">
                <div class="text-[10px] text-slate-400 uppercase font-semibold">Data Decoded</div>
                <div class="text-xl font-mono font-bold text-cyan-400 mt-1">
                  {{ searchData.search_results.data_decoded_pct }}%
                </div>
                <div class="text-[10px] text-slate-500">{{ searchData.search_results.bytes_decoded | number }} Bytes</div>
              </div>

              <div class="p-3 rounded-xl bg-slate-900/90 border border-indigo-500/30">
                <div class="text-[10px] text-slate-400 uppercase font-semibold">Search Latency</div>
                <div class="text-xl font-mono font-bold text-indigo-400 mt-1">
                  {{ searchData.search_results.total_search_latency_ms }} ms
                </div>
                <div class="text-[10px] text-slate-500">Index: {{ searchData.search_results.index_lookup_time_ms }} ms</div>
              </div>
            </div>

          </div>
        </div>

        <!-- Visual Block Grid showing Candidate/Decoded Blocks vs Skipped Blocks -->
        <div class="glass-card p-6 space-y-4">
          <div class="flex items-center justify-between">
            <div>
              <h3 class="text-base font-bold text-white">Visual Block Decompression Matrix</h3>
              <p class="text-xs text-slate-400">
                Glowing blocks were selectively decoded. Dimmed blocks were completely bypassed.
              </p>
            </div>
            <div class="text-xs font-mono text-cyan-400">
              Candidate Block IDs: {{ searchData.search_results.candidate_block_ids.join(', ') || 'None' }}
            </div>
          </div>

          <app-block-grid
            [blocks]="getBlocksList(searchData.search_results.total_blocks)"
            [isSearchMode]="true"
            [activeBlockIds]="searchData.search_results.candidate_block_ids">
          </app-block-grid>
        </div>

        <!-- Head-to-Head Latency & I/O Comparison with Gzip and Raw -->
        <div class="glass-card p-6 space-y-4">
          <h3 class="text-base font-bold text-white">Head-to-Head Search Performance vs Baselines</h3>
          
          <div class="overflow-x-auto">
            <table class="w-full text-left text-xs text-slate-300">
              <thead class="bg-slate-900/90 text-slate-400 uppercase font-semibold text-[10px] tracking-wider border-b border-slate-800">
                <tr>
                  <th class="p-3">Method</th>
                  <th class="p-3">Blocks Decoded</th>
                  <th class="p-3">Blocks Skipped</th>
                  <th class="p-3">Data Decoded</th>
                  <th class="p-3">Data Decoded %</th>
                  <th class="p-3">Search Latency</th>
                  <th class="p-3">Selective Advantage</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-800/60 font-mono">
                <tr *ngFor="let m of searchData.comparison.methods"
                  [class.bg-emerald-950/20]="m.method.includes('Proposed')"
                  [class.text-white]="m.method.includes('Proposed')"
                  class="hover:bg-slate-800/40">
                  <td class="p-3 font-semibold flex items-center gap-2">
                    <span
                      [class.bg-emerald-400]="m.method.includes('Proposed')"
                      [class.bg-amber-400]="m.method.includes('Gzip')"
                      [class.bg-slate-600]="m.method.includes('Raw')"
                      class="w-2.5 h-2.5 rounded-full inline-block"></span>
                    {{ m.method }}
                  </td>
                  <td class="p-3 font-bold" [class.text-emerald-400]="m.method.includes('Proposed')">{{ m.blocks_decoded }}</td>
                  <td class="p-3 font-bold" [class.text-cyan-400]="m.method.includes('Proposed')">{{ m.blocks_skipped }}</td>
                  <td class="p-3 text-slate-300">{{ m.data_decoded_bytes | number }} B</td>
                  <td class="p-3 font-bold" [class.text-emerald-400]="m.data_decoded_pct < 100">{{ m.data_decoded_pct }}%</td>
                  <td class="p-3 font-bold" [class.text-cyan-400]="m.method.includes('Proposed')">{{ m.search_latency_ms }} ms</td>
                  <td class="p-3 font-sans text-[11px]" [class.text-emerald-300]="m.method.includes('Proposed')">
                    {{ m.selective_advantage }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- Matched Logs Stream Table -->
        <div class="glass-card p-6 space-y-4">
          <div class="flex items-center justify-between">
            <div>
              <h3 class="text-base font-bold text-white flex items-center gap-2">
                <span>Matching Log Records</span>
                <span class="badge badge-info text-xs">{{ searchData.search_results.match_count }} Matches</span>
              </h3>
              <p class="text-xs text-slate-400">Decoded in real time from compressed blocks</p>
            </div>
          </div>

          <div *ngIf="searchData.search_results.matching_logs.length === 0" class="text-center py-8 text-slate-500 font-mono text-xs">
            No matching log records found in candidate blocks for query: "{{ searchData.query_details.query }}"
          </div>

          <div *ngIf="searchData.search_results.matching_logs.length > 0" class="overflow-x-auto border border-slate-800 rounded-xl bg-black/40">
            <table class="w-full text-left text-xs text-slate-300">
              <thead class="bg-slate-900/90 text-slate-400 uppercase font-semibold text-[10px] tracking-wider border-b border-slate-800">
                <tr>
                  <th class="p-3">Block</th>
                  <th class="p-3">Timestamp</th>
                  <th class="p-3">Level</th>
                  <th class="p-3">Service</th>
                  <th class="p-3">Pod</th>
                  <th class="p-3">Message</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-800/60 font-mono">
                <tr *ngFor="let log of searchData.search_results.matching_logs" class="hover:bg-slate-800/50 transition-colors">
                  <td class="p-3 text-cyan-400 font-bold">#{{ log.block_id }}</td>
                  <td class="p-3 text-slate-400 text-[11px] whitespace-nowrap">{{ log.timestamp }}</td>
                  <td class="p-3">
                    <span
                      [class.badge-error]="log.level === 'ERROR' || log.level === 'FATAL'"
                      [class.badge-warn]="log.level === 'WARN'"
                      [class.badge-info]="log.level === 'INFO' || log.level === 'DEBUG'"
                      class="badge text-[10px]">
                      {{ log.level }}
                    </span>
                  </td>
                  <td class="p-3 text-indigo-300 font-semibold">{{ log.service }}</td>
                  <td class="p-3 text-slate-400 text-[11px] max-w-[140px] truncate" [title]="log.pod">{{ log.pod }}</td>
                  <td class="p-3 text-slate-200">
                    <span [innerHTML]="highlightMatches(log.message, searchData.query_details.query)"></span>
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
export class SearchComponent implements OnInit {
  state = inject(StateService);
  api = inject(ApiService);

  queryText = 'database-service timeout';
  levelFilter = 'ERROR';
  serviceFilter = 'database-service';
  isSearching = signal<boolean>(false);

  get searchData(): SearchResponse | null {
    return this.state.latestSearch();
  }

  ngOnInit(): void {
    if (!this.state.latestSearch() && this.state.selectedDataset()) {
      this.executeSearch();
    }
  }

  applyPreset(q: string, lvl: string, svc: string): void {
    this.queryText = q;
    this.levelFilter = lvl;
    this.serviceFilter = svc;
    this.executeSearch();
  }

  getAvailableServices(): string[] {
    return this.state.selectedDataset()?.unique_services || [];
  }

  executeSearch(): void {
    const dataset = this.state.selectedDataset();
    if (!dataset) return;

    this.isSearching.set(true);
    this.api.searchLogs(
      dataset.name,
      this.queryText,
      this.levelFilter,
      this.serviceFilter
    ).subscribe({
      next: (resp) => {
        this.isSearching.set(false);
        this.state.latestSearch.set(resp);
      },
      error: (err) => {
        this.isSearching.set(false);
        alert('Search failed: ' + err.message);
      }
    });
  }

  getBlocksList(total: number): BlockSummary[] {
    const res: BlockSummary[] = [];
    const exp = this.state.latestExperiment();
    const prop = exp?.results.find(r => r.selective_searchable);
    if (prop && prop.blocks_summary) {
      return prop.blocks_summary;
    }

    for (let i = 0; i < total; i++) {
      res.push({
        block_id: i,
        start_line: i * 100,
        end_line: (i + 1) * 100 - 1,
        line_count: 100,
        uncompressed_bytes: 12000,
        compressed_bytes: 4000,
        ratio: 3.0
      });
    }
    return res;
  }

  highlightMatches(text: string, query: string): string {
    if (!text) return '';
    if (!query) return text;

    const terms = query.split(/\s+/).filter(t => t.length > 1);
    let highlighted = text;
    for (const term of terms) {
      const regex = new RegExp(`(${term})`, 'gi');
      highlighted = highlighted.replace(regex, '<mark class="bg-cyan-500/30 text-cyan-200 px-1 py-0.5 rounded font-bold">$1</mark>');
    }
    return highlighted;
  }
}
