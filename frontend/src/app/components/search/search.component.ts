import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { StateService } from '../../services/state.service';
import { ApiService } from '../../services/api.service';
import { SearchResponse } from '../../models/search.model';
import { BlockSummary } from '../../models/compression.model';
import { BlockGridComponent } from '../block-grid/block-grid.component';

@Component({
  selector: 'app-search',
  standalone: true,
  imports: [CommonModule, FormsModule, BlockGridComponent],
  template: `
    <div class="app-container section-spacing flex flex-col gap-8">
      
      <!-- Page Header -->
      <div class="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 class="heading-section" style="font-size: 2rem;">Search Logs</h1>
          <p class="lead-text text-sm" style="color: #64748b; margin-top: 0.25rem;">
            Search compressed log files using the inverted index to decode only candidate blocks.
          </p>
        </div>
      </div>

      <!-- Single Query Search Box Panel (No active-file/block-size/method strip below input) -->
      <div class="panel flex flex-col gap-4" style="background: #ffffff;">
        <div class="flex flex-col gap-2">
          <label class="text-xs font-semibold text-muted uppercase tracking-wider">Search Query</label>
          <div class="flex gap-3">
            <input
              type="text"
              [(ngModel)]="queryText"
              (keyup.enter)="executeSearch()"
              placeholder="Enter any text to search (words, phrases, timestamps, IDs, status codes, errors)..."
              class="input-control text-sm flex-1">

            <button
              (click)="executeSearch()"
              [disabled]="isSearching() || !state.selectedDataset()"
              class="btn btn-primary btn-lg"
              style="white-space: nowrap;">
              <span *ngIf="isSearching()">Searching...</span>
              <span *ngIf="!isSearching()">Search Logs</span>
              <svg *ngIf="!isSearching()" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="11" cy="11" r="8"></circle>
                <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
              </svg>
            </button>
          </div>
        </div>
      </div>

      <!-- If no search has been executed yet -->
      <div *ngIf="!searchData" class="panel text-center flex flex-col items-center justify-center gap-3" style="background: #ffffff; padding: 3rem 1.5rem;">
        <div style="font-size: 1.15rem; font-weight: 700; color: #0f172a;">Ready to Search</div>
        <p class="text-xs text-muted" style="max-width: 480px;">
          Active file: <strong>{{ state.selectedDatasetName() || 'None' }}</strong>. Type any keyword, error code, timestamp, or phrase into the query box above and click <strong>Search Logs</strong>.
        </p>
      </div>

      <!-- Search Metrics & Results -->
      <div *ngIf="searchData" class="flex flex-col gap-6">
        
        <!-- 4 Core Metrics Display (Renamed labels) -->
        <div class="grid grid-cols-4 gap-4">
          
          <div class="metric-box">
            <span class="metric-label">Matching Entries</span>
            <span class="metric-value" style="color: #059669;">
              {{ searchData.search_results.match_count }}
            </span>
            <span class="text-xs text-muted">Matching lines found</span>
          </div>

          <!-- Renamed: Blocks Decoded -->
          <div class="metric-box">
            <span class="metric-label">Blocks Decoded</span>
            <span class="metric-value" style="color: #2563eb;">
              {{ searchData.search_results.blocks_scanned }} <span style="font-size: 0.9rem; color: #64748b;">/ {{ searchData.search_results.total_blocks }}</span>
            </span>
            <span class="text-xs text-muted">Candidate blocks decompressed</span>
          </div>

          <!-- Renamed: Original Data Skipped -->
          <div class="metric-box">
            <span class="metric-label">Original Data Skipped</span>
            <span class="metric-value" style="color: #059669;">
              {{ searchData.search_results.data_skipped_pct }}%
            </span>
            <span class="text-xs text-muted">Original bytes bypassed via index</span>
          </div>

          <div class="metric-box">
            <span class="metric-label">Search Time</span>
            <span class="metric-value" style="color: #0f172a;">
              {{ searchData.search_results.total_search_latency_ms }} ms
            </span>
            <span class="text-xs text-muted">Live query latency</span>
          </div>
        </div>

        <!-- 3-Method Search Comparison Table -->
        <div class="panel flex flex-col gap-4" style="background: #ffffff;">
          <div>
            <h2 class="heading-sub" style="font-size: 1.15rem;">Search Efficiency Comparison (Proposed vs Baselines)</h2>
            <p class="text-muted text-xs">Live measured performance for query: "<strong>{{ searchData.query_details.query || '(all logs)' }}</strong>"</p>
          </div>

          <div class="data-table-wrapper">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Method</th>
                  <th>Data Decoded during Search</th>
                  <th>Blocks Decoded / Skipped</th>
                  <th>Search Time</th>
                  <th>Selective Advantage</th>
                </tr>
              </thead>
              <tbody class="text-mono" style="font-size: 0.8125rem;">
                
                <!-- Proposed Method -->
                <tr style="background: #eff6ff;">
                  <td style="font-weight: 700; color: #2563eb; font-family: var(--font-main);">
                    Proposed: Gain-Gated Shared-Dictionary Block DEFLATE
                  </td>
                  <td style="font-weight: 700; color: #059669;">
                    {{ formatBytes(searchData.search_results.bytes_decoded) }} ({{ searchData.search_results.data_read_pct }}% of original)
                  </td>
                  <td style="font-weight: 700;">
                    {{ searchData.search_results.blocks_scanned }} decoded &bull; {{ searchData.search_results.blocks_skipped }} skipped
                  </td>
                  <td style="font-weight: 700; color: #0f172a;">
                    {{ searchData.search_results.total_search_latency_ms }} ms
                  </td>
                  <td style="font-family: var(--font-main);">
                    <span class="pill-badge pill-emerald text-xs">
                      {{ searchData.search_results.data_skipped_pct }}% original data bypassed without decoding
                    </span>
                  </td>
                </tr>

                <!-- Worst Baseline: Run-Length Encoding (RLE) -->
                <tr *ngFor="let m of getRleComparison()">
                  <td style="font-weight: 700; color: #dc2626; font-family: var(--font-main);">
                    {{ m.method }}
                  </td>
                  <td>{{ formatBytes(m.data_decoded_bytes) }} (100.0% of original)</td>
                  <td>{{ m.blocks_decoded }} decoded &bull; 0 skipped</td>
                  <td>{{ m.search_latency_ms }} ms</td>
                  <td style="font-family: var(--font-main);">
                    <span class="pill-badge pill-crimson text-xs">0% skipped (must decompress entire archive)</span>
                  </td>
                </tr>

                <!-- Raw / Uncompressed -->
                <tr *ngFor="let m of getRawComparison()">
                  <td style="font-weight: 700; color: #64748b; font-family: var(--font-main);">Uncompressed Logs</td>
                  <td>{{ formatBytes(m.data_decoded_bytes) }} (100.0% of original)</td>
                  <td>Full byte scan</td>
                  <td>{{ m.search_latency_ms }} ms</td>
                  <td style="font-family: var(--font-main);">
                    <span class="pill-badge pill-default text-xs">0% skipped (scans entire raw stream)</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- Renamed: Search Block Breakdown (from Block Decompression Summary) -->
        <div class="panel flex flex-col gap-4" style="background: #ffffff;">
          <div class="flex items-center justify-between flex-wrap gap-2">
            <div>
              <h3 class="heading-sub">Search Block Breakdown</h3>
              <p class="text-muted text-xs">
                Blocks decoded versus skipped for query: "{{ searchData.query_details.query }}"
              </p>
            </div>
            
            <button
              type="button"
              (click)="toggleDetailedBlocks()"
              class="btn btn-outline btn-sm flex items-center gap-1.5"
              style="font-size: 0.75rem;">
              <span>{{ showDetailedBlocks() ? 'Hide Detailed Block Map' : 'View Detailed Block Map' }}</span>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <path *ngIf="!showDetailedBlocks()" d="m6 9 6 6 6-6"></path>
                <path *ngIf="showDetailedBlocks()" d="m18 15-6-6-6 6"></path>
              </svg>
            </button>
          </div>

          <!-- Summary Cards -->
          <div class="grid grid-cols-3 gap-3" style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 1rem;">
            <div class="flex flex-col gap-0.5">
              <span class="text-xs font-semibold text-muted uppercase">Total Blocks</span>
              <span style="font-size: 1.25rem; font-weight: 800; color: #0f172a;">
                {{ searchData.search_results.total_blocks }}
              </span>
              <span class="text-xs text-muted">In compressed file</span>
            </div>

            <!-- Renamed: Blocks Decoded -->
            <div class="flex flex-col gap-0.5">
              <span class="text-xs font-semibold text-muted uppercase" style="color: #059669;">Blocks Decoded</span>
              <span style="font-size: 1.25rem; font-weight: 800; color: #059669;">
                {{ searchData.search_results.blocks_scanned }}
              </span>
              <span class="text-xs text-muted">Decoded to verify matches</span>
            </div>

            <div class="flex flex-col gap-0.5">
              <span class="text-xs font-semibold text-muted uppercase" style="color: #64748b;">Blocks Skipped</span>
              <span style="font-size: 1.25rem; font-weight: 800; color: #64748b;">
                {{ searchData.search_results.blocks_skipped }}
              </span>
              <span class="text-xs text-muted">Bypassed entirely via index</span>
            </div>
          </div>

          <!-- Compact Block Visual Strip -->
          <div class="flex items-center gap-1.5 flex-wrap" style="padding: 0.5rem 0;">
            <div
              *ngFor="let b of getMiniBlocks(searchData.search_results.total_blocks)"
              [style.background]="isCandidateBlock(b) ? '#dcfce7' : '#f1f5f9'"
              [style.borderColor]="isCandidateBlock(b) ? '#16a34a' : '#cbd5e1'"
              [style.color]="isCandidateBlock(b) ? '#15803d' : '#64748b'"
              style="padding: 4px 8px; border: 1.5px solid; border-radius: 6px; font-size: 0.75rem; font-weight: 700; font-family: monospace;"
              title="Block #{{ b }}: {{ isCandidateBlock(b) ? 'Decoded' : 'Skipped' }}">
              #{{ b }} {{ isCandidateBlock(b) ? '✓' : '—' }}
            </div>
          </div>

          <!-- Optional Detailed Block Map -->
          <div *ngIf="showDetailedBlocks()" class="flex flex-col gap-3" style="padding-top: 1rem; border-top: 1px dashed #e2e8f0;">
            <div class="text-xs text-muted text-mono">
              Candidate Block IDs: <strong>{{ searchData.search_results.candidate_block_ids.join(', ') || 'None' }}</strong>
            </div>

            <app-block-grid
              [blocks]="getBlocksList(searchData.search_results.total_blocks)"
              [isSearchMode]="true"
              [activeBlockIds]="searchData.search_results.candidate_block_ids">
            </app-block-grid>
          </div>
        </div>

        <!-- Matching Log Entries -->
        <div class="panel flex flex-col gap-4" style="background: #ffffff;">
          <div class="flex items-center justify-between flex-wrap gap-2">
            <div>
              <h3 class="heading-sub">Matching Log Entries</h3>
              <p class="text-muted text-xs">Genuine log lines verified and decoded from candidate blocks</p>
            </div>
            <span class="pill-badge pill-emerald">{{ searchData.search_results.match_count }} Results</span>
          </div>

          <!-- Empty Results State -->
          <div *ngIf="searchData.search_results.matching_logs.length === 0" class="text-center text-muted" style="padding: 2.5rem;">
            <div style="font-size: 1.1rem; font-weight: 600; color: #0f172a; margin-bottom: 0.25rem;">0 Results Found</div>
            <p class="text-xs text-muted">
              No log lines matched the query "<strong>{{ searchData.query_details.query }}</strong>" in this file.
            </p>
          </div>

          <!-- Matching Logs Table -->
          <div *ngIf="searchData.search_results.matching_logs.length > 0" class="data-table-wrapper" style="max-height: 500px; overflow-y: auto;">
            <table class="data-table">
              <thead>
                <tr>
                  <th style="width: 90px;">Line #</th>
                  <th style="width: 90px;">Block #</th>
                  <th>Log Entry</th>
                </tr>
              </thead>
              <tbody class="text-mono" style="font-size: 0.8125rem;">
                <tr *ngFor="let log of searchData.search_results.matching_logs">
                  <td style="font-weight: 700; color: #64748b;">Line {{ log.line_no }}</td>
                  <td style="font-weight: 700; color: #2563eb;">#{{ log.block_id }}</td>
                  <td style="color: #0f172a; word-break: break-all; white-space: pre-wrap;">
                    <span [innerHTML]="highlightMatches(log.raw, searchData.query_details.query)"></span>
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

  queryText = '';
  isSearching = signal<boolean>(false);
  showDetailedBlocks = signal<boolean>(false);

  get searchData(): SearchResponse | null {
    return this.state.latestSearch();
  }

  ngOnInit(): void {
    // Keep queryText empty and wait for user search input
  }

  executeSearch(): void {
    const dataset = this.state.selectedDataset();
    if (!dataset) return;

    this.isSearching.set(true);
    const blockSize = this.state.selectedBlockSize();
    this.api.searchLogs(
      dataset.name,
      this.queryText.trim(),
      blockSize
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

  getRleComparison() {
    return this.searchData?.comparison?.methods.filter(m => m.method.toLowerCase().includes('rle') || m.method.toLowerCase().includes('worst') || m.method.toLowerCase().includes('gzip')) || [];
  }

  getRawComparison() {
    return this.searchData?.comparison?.methods.filter(m => m.method.toLowerCase().includes('raw') || m.method.toLowerCase().includes('uncompressed')) || [];
  }

  formatBytes(bytes: number): string {
    if (!bytes || bytes === 0) return '0 B';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  }

  toggleDetailedBlocks(): void {
    this.showDetailedBlocks.set(!this.showDetailedBlocks());
  }

  getMiniBlocks(total: number): number[] {
    const arr: number[] = [];
    for (let i = 0; i < total; i++) {
      arr.push(i);
    }
    return arr;
  }

  isCandidateBlock(blockId: number): boolean {
    const s = this.searchData;
    if (!s) return false;
    return s.search_results.candidate_block_ids.includes(blockId);
  }

  getBlocksList(total: number): BlockSummary[] {
    const res: BlockSummary[] = [];
    const exp = this.state.latestExperiment();
    const prop = exp?.results.find(r => r.selective_searchable);
    if (prop && prop.blocks_summary && prop.blocks_summary.length === total) {
      return prop.blocks_summary;
    }

    const blockSize = this.state.selectedBlockSize();
    for (let i = 0; i < total; i++) {
      res.push({
        block_id: i,
        start_line: i * blockSize + 1,
        end_line: (i + 1) * blockSize,
        line_count: blockSize,
        uncompressed_bytes: 12000,
        compressed_bytes: 4000
      });
    }
    return res;
  }

  escapeHtml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  highlightMatches(text: string, query: string): string {
    if (!text) return '';
    const safeText = this.escapeHtml(text);
    if (!query || !query.trim()) return safeText;

    const terms = query.trim().split(/\s+/).filter(t => t.length > 0);
    let highlighted = safeText;
    for (const term of terms) {
      const safeTerm = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`(${safeTerm})`, 'gi');
      highlighted = highlighted.replace(regex, '<mark style="background: #fef08a; color: #854d0e; padding: 1px 3px; border-radius: 2px; font-weight: bold;">$1</mark>');
    }
    return highlighted;
  }
}
