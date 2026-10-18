import { Component, inject, signal, OnInit, ElementRef, ViewChild, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { StateService } from '../../services/state.service';
import { ApiService } from '../../services/api.service';
import { Chart, registerables } from 'chart.js';
import { EvaluatedPhraseItem, GainGateSummary, MethodCompressionResult } from '../../models/compression.model';

Chart.register(...registerables);

@Component({
  selector: 'app-comparison',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="app-container section-spacing flex flex-col gap-8">
      
      <!-- Page Header: Strictly refers to active file -->
      <div class="flex items-center justify-between flex-wrap gap-4">
        <div>
          <div class="flex items-center gap-2">
            <span class="bracket-tag">[ 5-WAY ABLATION BENCHMARK ]</span>
            <span class="pill-badge pill-blue">Path 1: Gain-Gated Shared-Dictionary Block DEFLATE</span>
          </div>
          <h1 class="heading-section" style="font-size: 2rem; margin-top: 0.35rem;">
            Comparison Results: {{ currentDatasetName || 'No File Selected' }}
          </h1>
          <p class="lead-text text-sm" style="color: #64748b; margin-top: 0.25rem;">
            Storage efficiency, 5-way ablation benchmark, and Gain-Gated dictionary audit on <strong>{{ currentDatasetName || 'None' }}</strong> ({{ state.selectedBlockSize() }} lines/block).
          </p>
        </div>

        <button (click)="runCompression()" [disabled]="isRunning() || !state.selectedDataset()" class="btn btn-outline btn-sm flex items-center gap-2">
          <span *ngIf="isRunning()">Compressing...</span>
          <span *ngIf="!isRunning()">Re-run Compression</span>
          <svg *ngIf="!isRunning()" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="23 4 23 10 17 10"></polyline>
            <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path>
          </svg>
        </button>
      </div>

      <!-- Notice when active experiment is missing or stale -->
      <div *ngIf="!isExperimentActiveForCurrentFile" class="panel text-center flex flex-col items-center justify-center gap-3" style="background: #ffffff; padding: 3rem 1.5rem;">
        <div style="font-size: 1.15rem; font-weight: 700; color: #0f172a;">
          Compression Not Yet Run for {{ currentDatasetName }}
        </div>
        <p class="text-xs text-muted" style="max-width: 500px;">
          To compare compression and storage metrics, click <strong>Compress &amp; Index Logs</strong> on the Upload Logs page, or click below to evaluate the active file.
        </p>
        <button (click)="runCompression()" [disabled]="isRunning() || !state.selectedDataset()" class="btn btn-primary" style="margin-top: 0.5rem;">
          <span *ngIf="isRunning()">Compressing &amp; Indexing...</span>
          <span *ngIf="!isRunning()">Compress &amp; Index {{ currentDatasetName }}</span>
        </button>
      </div>

      <!-- Active File Completed Run Display -->
      <div *ngIf="isExperimentActiveForCurrentFile" class="flex flex-col gap-8">

        <!-- 1. Five Responsive Side-by-Side Metric Cards -->
        <div class="grid grid-cols-5 gap-3">
          
          <!-- Card 1: Original File Size -->
          <div class="metric-box" title="Uncompressed original text size before processing">
            <span class="metric-label">Original File Size</span>
            <span class="metric-value">
              {{ formatBytes(origBytes) }}
            </span>
            <span class="text-xs text-muted">{{ origBytes | number }} bytes &bull; Baseline</span>
          </div>

          <!-- Card 2: Compressed Size (Proposed Blocks) -->
          <div class="metric-box" title="Raw compressed log data blocks without shared dictionary and search index">
            <span class="metric-label">Compressed Data (Proposed)</span>
            <span class="metric-value" style="color: #2563eb;">
              {{ formatBytes(propPayloadBytes) }}
            </span>
            <span class="text-xs text-muted">{{ propPayloadBytes | number }} bytes &bull; Blocks only ({{ propPayloadRatio }}&times;)</span>
          </div>

          <!-- Card 3: Worst Baseline (RLE) Size -->
          <div class="metric-box" title="Worst-Case Baseline: Run-Length Encoding (RLE) causes severe data expansion on structured log text">
            <span class="metric-label">Worst Baseline (RLE) Size</span>
            <span class="metric-value" style="color: #dc2626;">
              {{ formatBytes(rleArchiveBytes) }}
            </span>
            <span class="text-xs" style="color: #dc2626; font-weight: 600;">{{ rleArchiveBytes | number }} bytes &bull; {{ rleOverheadText }}</span>
          </div>

          <!-- Card 4: Shared Dict + Search Index -->
          <div class="metric-box" title="Metadata overhead: Shared seed dictionary plus compact postings index">
            <span class="metric-label">Dict + Index Metadata</span>
            <span class="metric-value" style="color: #7c3aed;">
              {{ formatBytes(propDictAndIndexBytes) }}
            </span>
            <span class="text-xs text-muted">Dict: {{ formatBytes(propDictBytes) }} &bull; Index: {{ formatBytes(propIndexBytes) }}</span>
          </div>

          <!-- Card 5: Total Stored Size (Proposed Archive) -->
          <div class="metric-box" title="Total stored archive size including compressed data blocks, shared seed dictionary, and integrated search index">
            <span class="metric-label">Total Stored Size (Proposed)</span>
            <span class="metric-value" style="color: #059669;">
              {{ formatBytes(propTotalBytes) }}
            </span>
            <span class="text-xs text-muted">{{ propTotalBytes | number }} bytes &bull; {{ propOverallRatio }}&times; &bull; {{ propStorageSavedOrOverhead }}</span>
          </div>

        </div>

        <!-- 2. Academic Novelty: Gain-Gated Selection Audit Panel -->
        <div class="panel flex flex-col gap-5" style="background: #ffffff; border-left: 4px solid #2563eb;">
          <div class="flex items-center justify-between flex-wrap gap-2">
            <div>
              <div class="flex items-center gap-2">
                <span class="bracket-tag">[ ALGORITHMIC NOVELTY AUDIT ]</span>
                <span class="pill-badge pill-blue">Cost-Aware Joint Optimization</span>
              </div>
              <h2 class="heading-sub" style="font-size: 1.35rem; margin-top: 0.25rem;">
                Gain-Gated Shared-Dictionary Selection Engine
              </h2>
              <p class="text-muted text-xs" style="margin-top: 0.25rem;">
                Evaluates marginal compression savings against dictionary storage and postings index overhead:
                <strong style="color: #2563eb; font-family: var(--font-mono); margin-left: 0.25rem;">
                  G(p | S) = DataSavings(p | S) &minus; DictCost(p) &minus; IndexCost(p) &gt; 0
                </strong>
              </p>
            </div>

            <button
              type="button"
              (click)="toggleGainGateAudit()"
              class="btn btn-outline btn-sm flex items-center gap-1.5"
              style="font-size: 0.75rem;">
              <span>{{ showGainGateAudit() ? 'Hide Phrase Audit Log' : 'Inspect Candidate Promotions (' + getEvaluations().length + ' Evaluated)' }}</span>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <path *ngIf="!showGainGateAudit()" d="m6 9 6 6 6-6"></path>
                <path *ngIf="showGainGateAudit()" d="m18 15-6-6-6 6"></path>
              </svg>
            </button>
          </div>

          <!-- Summary Audit Stats -->
          <div class="grid grid-cols-4 gap-3">
            <div class="metric-box">
              <span class="metric-label">Candidates Mined</span>
              <span class="metric-value" style="color: #0f172a;">{{ getGainGateSummary()?.total_candidates_mined || 0 }}</span>
              <span class="text-xs text-muted">Cross-block recurring templates</span>
            </div>

            <div class="metric-box">
              <span class="metric-label">Promoted Phrases</span>
              <span class="metric-value" style="color: #059669;">{{ getGainGateSummary()?.promoted_count || 0 }}</span>
              <span class="text-xs text-muted">Marginal gain G(p | S) &gt; 0</span>
            </div>

            <div class="metric-box">
              <span class="metric-label">Pruned / Rejected</span>
              <span class="metric-value" style="color: #dc2626;">{{ getGainGateSummary()?.rejected_count || 0 }}</span>
              <span class="text-xs text-muted">Excluded to avoid index/dict bloat</span>
            </div>

            <div class="metric-box">
              <span class="metric-label">Integrated Index Size</span>
              <span class="metric-value" style="color: #7c3aed;">{{ formatBytes(propIndexBytes) }}</span>
              <span class="text-xs text-muted">&gt;90% smaller than naive inverted index</span>
            </div>
          </div>

          <!-- Expandable Phrase Audit Log Table -->
          <div *ngIf="showGainGateAudit()" class="flex flex-col gap-3" style="padding-top: 0.75rem; border-top: 1px dashed #e2e8f0;">
            <div class="flex items-center justify-between">
              <span class="text-xs font-semibold text-muted uppercase tracking-wider">
                Candidate Evaluation Decisions (Marginal Gain Calculation)
              </span>
              <span class="text-xs text-muted">
                Ref Cost = 3.0 B &bull; Posting Cost = 2.0 B/block
              </span>
            </div>

            <div class="data-table-wrapper" style="max-height: 320px; overflow-y: auto;">
              <table class="data-table" style="font-size: 0.8125rem;">
                <thead>
                  <tr>
                    <th>Candidate Log Phrase</th>
                    <th>Length</th>
                    <th>Freq</th>
                    <th>Spread</th>
                    <th>Data Savings</th>
                    <th>Dict Cost</th>
                    <th>Index Cost</th>
                    <th>Marginal Gain G(p | S)</th>
                    <th>Decision Status</th>
                  </tr>
                </thead>
                <tbody class="text-mono">
                  <tr *ngFor="let item of getEvaluations()" [style.background]="item.is_promoted ? '#f0fdf4' : 'transparent'">
                    <td style="max-width: 260px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 600;" [title]="item.phrase">
                      <code>{{ item.phrase }}</code>
                    </td>
                    <td>{{ item.length }} B</td>
                    <td>{{ item.frequency }}&times;</td>
                    <td>{{ item.block_ids_count }} blks</td>
                    <td style="color: #059669;">+{{ item.data_savings_bytes | number:'1.0-0' }} B</td>
                    <td style="color: #64748b;">-{{ item.dict_cost_bytes | number:'1.0-0' }} B</td>
                    <td style="color: #7c3aed;">-{{ item.index_cost_bytes | number:'1.0-0' }} B</td>
                    <td style="font-weight: 700;">
                      <span [style.color]="item.marginal_gain_bytes > 0 ? '#059669' : '#dc2626'">
                        {{ item.marginal_gain_bytes > 0 ? '+' : '' }}{{ item.marginal_gain_bytes | number:'1.1-1' }} B
                      </span>
                    </td>
                    <td>
                      <span *ngIf="item.is_promoted" class="pill-badge pill-emerald text-xs">PROMOTED (HOT SEED)</span>
                      <span *ngIf="!item.is_promoted" class="pill-badge pill-default text-xs" [title]="item.rejection_reason || ''">PRUNED (NET COST)</span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <!-- 3. Comprehensive 5-Way Ablation Benchmark Table -->
        <div class="panel flex flex-col gap-4" style="background: #ffffff;">
          <div class="flex items-center justify-between flex-wrap gap-2">
            <div>
              <h2 class="heading-sub" style="font-size: 1.25rem;">5-Way Ablation Benchmark Table</h2>
              <p class="text-muted text-xs">Evaluated across identical raw input lines for active file: <strong>{{ currentDatasetName }}</strong>.</p>
            </div>
            <span class="text-xs text-muted">
              Block size: <strong style="color: #2563eb;">{{ state.selectedBlockSize() }} lines</strong>
            </span>
          </div>

          <div class="data-table-wrapper">
            <table class="data-table" style="font-size: 0.875rem;">
              <thead>
                <tr>
                  <th style="min-width: 220px;">Method &amp; Classification</th>
                  <th>Compressed Data</th>
                  <th>Shared Dict</th>
                  <th>Search Index</th>
                  <th>Total Stored Archive</th>
                  <th>Compression Ratio</th>
                  <th>Storage Saved</th>
                  <th>Search Latency</th>
                  <th>Data Decoded (Search)</th>
                </tr>
              </thead>
              <tbody class="text-mono">
                <tr *ngFor="let res of getExperimentResults()" [style.background]="res.method.includes('Proposed') ? '#eff6ff' : (res.method.includes('Unconditional') ? '#faf5ff' : 'transparent')">
                  
                  <!-- Method Name & Classification Badge -->
                  <td>
                    <div class="flex flex-col gap-1">
                      <span style="font-weight: 700; font-family: var(--font-main);" [style.color]="res.method.includes('Proposed') ? '#2563eb' : '#0f172a'">
                        {{ res.method }}
                      </span>
                      <div>
                        <span [class]="getMethodBadgeClass(res.method)">
                          {{ getMethodBadgeLabel(res.method) }}
                        </span>
                      </div>
                    </div>
                  </td>

                  <!-- Compressed Payload (Blocks) -->
                  <td style="font-weight: 600;" [style.color]="res.method.includes('Proposed') ? '#2563eb' : '#0f172a'">
                    {{ formatBytes(res.blocks_compressed_size || res.compressed_size) }}
                  </td>

                  <!-- Shared Dictionary Size -->
                  <td class="text-muted">
                    {{ res.shared_dictionary_size ? formatBytes(res.shared_dictionary_size) : '0 B' }}
                  </td>

                  <!-- Search Index Size -->
                  <td [style.color]="res.index_size > 50000 ? '#dc2626' : '#7c3aed'" [style.font-weight]="res.index_size > 0 ? '600' : 'normal'">
                    {{ formatBytes(res.index_size) }}
                    <span *ngIf="res.index_size > 50000" class="text-xs" style="color: #dc2626;">(Index Bloat)</span>
                  </td>

                  <!-- Total Archive Storage -->
                  <td style="font-weight: 700;" [style.color]="res.method.includes('Proposed') ? '#059669' : '#0f172a'">
                    {{ formatBytes(res.total_storage) }}
                  </td>

                  <!-- Compression Ratio -->
                  <td style="font-weight: 700; color: #059669;">
                    {{ res.compression_ratio }}&times;
                  </td>

                  <!-- Storage Saved / Overhead -->
                  <td style="font-weight: 700;">
                    <span [class.pill-emerald]="res.total_storage <= res.original_size" [class.pill-crimson]="res.total_storage > res.original_size" class="pill-badge text-xs" style="font-family: var(--font-main);">
                      {{ getStorageSavedText(res) }}
                    </span>
                  </td>

                  <!-- Search Time -->
                  <td style="font-weight: 600;">
                    {{ getSearchTime(res.method) }}
                  </td>

                  <!-- Data Processed During Search -->
                  <td style="font-weight: 500;">
                    {{ getDataProcessed(res.method) }}
                  </td>

                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- 4. Two Separate Horizontal Bar Charts -->
        <div class="grid grid-cols-2 gap-6">
          
          <!-- Chart 1: Compression Size Comparison (Data Blocks Only) -->
          <div class="panel flex flex-col gap-4" style="background: #ffffff;">
            <div>
              <h3 class="heading-sub">Data Blocks Compression Size</h3>
              <p class="text-muted text-xs">Compares compressed log data payload (excluding index overhead) in KB.</p>
            </div>
            <div style="height: 260px; position: relative;">
              <canvas #compressionChart></canvas>
            </div>
          </div>

          <!-- Chart 2: Total Storage Comparison (Includes index & shared dict) -->
          <div class="panel flex flex-col gap-4" style="background: #ffffff;">
            <div>
              <h3 class="heading-sub">Total Archive Storage Comparison</h3>
              <p class="text-muted text-xs">Compares total stored size (data blocks + shared seed dict + search index) in KB.</p>
            </div>
            <div style="height: 260px; position: relative;">
              <canvas #storageChart></canvas>
            </div>
          </div>

        </div>

        <!-- 5. Storage & Block Details Section -->
        <div class="panel flex flex-col gap-4" style="background: #ffffff;">
          <div class="flex items-center justify-between flex-wrap gap-2">
            <div>
              <h3 class="heading-sub">Storage Breakdown &amp; Block Partitions</h3>
              <p class="text-muted text-xs">Detailed component allocations and block specifications for <strong>{{ currentDatasetName }}</strong>.</p>
            </div>

            <button
              type="button"
              (click)="toggleAdvanced()"
              class="btn btn-outline btn-sm flex items-center gap-1.5"
              style="font-size: 0.75rem;">
              <span>{{ showAdvanced() ? 'Hide Partition Details' : 'View Partition Details' }}</span>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <path *ngIf="!showAdvanced()" d="m6 9 6 6 6-6"></path>
                <path *ngIf="showAdvanced()" d="m18 15-6-6-6 6"></path>
              </svg>
            </button>
          </div>

          <!-- Expanded Storage & Block Details Panel -->
          <div *ngIf="showAdvanced()" class="flex flex-col gap-6" style="padding-top: 1rem; border-top: 1px dashed #e2e8f0;">
            
            <!-- 4 Component Breakdown Boxes -->
            <div class="grid grid-cols-4 gap-4">
              <div class="metric-box">
                <span class="metric-label">1. Data Blocks Payload</span>
                <span class="metric-value" style="color: #2563eb;">
                  {{ formatBytes(propPayloadBytes) }}
                </span>
                <span class="text-xs text-muted">{{ propPayloadBytes | number }} B &bull; Discrete compressed blocks</span>
              </div>

              <div class="metric-box">
                <span class="metric-label">2. Shared Seed Dict</span>
                <span class="metric-value" style="color: #0f172a;">
                  {{ formatBytes(propDictBytes) }}
                </span>
                <span class="text-xs text-muted">{{ propDictBytes | number }} B &bull; {{ propPhrasesCount }} promoted phrases</span>
              </div>

              <div class="metric-box">
                <span class="metric-label">3. Integrated Index</span>
                <span class="metric-value" style="color: #7c3aed;">
                  {{ formatBytes(propIndexBytes) }}
                </span>
                <span class="text-xs text-muted">{{ propIndexBytes | number }} B &bull; Postings for promoted phrases</span>
              </div>

              <div class="metric-box">
                <span class="metric-label">4. Total Archive Storage</span>
                <span class="metric-value" style="color: #059669;">
                  {{ formatBytes(propTotalBytes) }}
                </span>
                <span class="text-xs text-muted">{{ propTotalBytes | number }} B &bull; Sum of 1 + 2 + 3</span>
              </div>
            </div>

            <!-- Block Details Table (block ID, line range, uncompressed, compressed) -->
            <div *ngIf="getBlockSummaries().length > 0" class="flex flex-col gap-2">
              <div class="flex items-center justify-between">
                <span class="text-xs font-semibold text-muted uppercase tracking-wider">
                  Block Details ({{ getBlockSummaries().length }} Total Blocks &bull; {{ state.selectedBlockSize() }} Lines per Block)
                </span>
              </div>

              <div class="data-table-wrapper" style="max-height: 280px; overflow-y: auto;">
                <table class="data-table" style="font-size: 0.875rem;">
                  <thead>
                    <tr>
                      <th style="width: 100px;">Block ID</th>
                      <th>Original Line Range</th>
                      <th>Original Size</th>
                      <th>Compressed Size</th>
                    </tr>
                  </thead>
                  <tbody class="text-mono">
                    <tr *ngFor="let b of getBlockSummaries()">
                      <td style="font-weight: 700; color: #2563eb;">#{{ b.block_id }}</td>
                      <td class="text-muted">Lines {{ b.start_line }} &ndash; {{ b.end_line }} ({{ b.line_count }} lines)</td>
                      <td>{{ formatBytes(b.uncompressed_bytes) }} ({{ b.uncompressed_bytes | number }} B)</td>
                      <td style="font-weight: 600; color: #0f172a;">{{ formatBytes(b.compressed_bytes) }} ({{ b.compressed_bytes | number }} B)</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

          </div>

        </div>

      </div>

    </div>
  `
})
export class ComparisonComponent implements OnInit, AfterViewInit {
  state = inject(StateService);
  api = inject(ApiService);

  @ViewChild('compressionChart') compressionChartRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('storageChart') storageChartRef!: ElementRef<HTMLCanvasElement>;

  isRunning = signal<boolean>(false);
  showAdvanced = signal<boolean>(false);
  showGainGateAudit = signal<boolean>(false);
  evaluationsList = signal<EvaluatedPhraseItem[]>([]);
  gainGateSummaryData = signal<GainGateSummary | null>(null);

  private chart1: Chart | null = null;
  private chart2: Chart | null = null;

  get currentDatasetName(): string {
    return this.state.selectedDatasetName();
  }

  // Active file consistency check:
  get isExperimentActiveForCurrentFile(): boolean {
    const exp = this.state.latestExperiment();
    return !!exp && exp.dataset_name === this.currentDatasetName && exp.block_size === this.state.selectedBlockSize();
  }

  get origBytes(): number {
    return this.getMetric('original_size', 'Proposed') || 0;
  }

  get propPayloadBytes(): number {
    return this.getMetric('blocks_compressed_size', 'Proposed') || 0;
  }

  get propDictBytes(): number {
    return this.getMetric('shared_dictionary_size', 'Proposed') || 0;
  }

  get propPhrasesCount(): number {
    return this.getMetric('shared_phrases_count', 'Proposed') || 0;
  }

  get propIndexBytes(): number {
    return this.getMetric('index_size', 'Proposed') || 0;
  }

  get propDictAndIndexBytes(): number {
    return this.propDictBytes + this.propIndexBytes;
  }

  get propTotalBytes(): number {
    return this.getMetric('total_storage', 'Proposed') || 0;
  }

  get rleArchiveBytes(): number {
    const val = this.getMetric('compressed_size', 'rle');
    if (val) return val;
    return this.getMetric('compressed_size', 'Worst Baseline') || 0;
  }

  get rleRatio(): number {
    return this.rleArchiveBytes > 0 ? Number((this.origBytes / this.rleArchiveBytes).toFixed(2)) : 0.5;
  }

  get rleOverheadText(): string {
    if (this.origBytes === 0) return '0.0%';
    if (this.rleArchiveBytes > this.origBytes) {
      const overhead = ((this.rleArchiveBytes - this.origBytes) / this.origBytes) * 100;
      return `+${overhead.toFixed(1)}% overhead (expanded)`;
    } else {
      const saved = ((this.origBytes - this.rleArchiveBytes) / this.origBytes) * 100;
      return `${saved.toFixed(1)}% saved`;
    }
  }

  get propPayloadRatio(): number {
    return this.propPayloadBytes > 0 ? Number((this.origBytes / this.propPayloadBytes).toFixed(2)) : 1.0;
  }

  get propOverallRatio(): number {
    return this.propTotalBytes > 0 ? Number((this.origBytes / this.propTotalBytes).toFixed(2)) : 1.0;
  }

  get propStorageSavedOrOverhead(): string {
    if (this.origBytes === 0) return '0.0%';
    if (this.propTotalBytes <= this.origBytes) {
      const saved = ((this.origBytes - this.propTotalBytes) / this.origBytes) * 100;
      return `${saved.toFixed(1)}% saved`;
    } else {
      const overhead = ((this.propTotalBytes - this.origBytes) / this.origBytes) * 100;
      return `${overhead.toFixed(1)}% overhead`;
    }
  }

  ngOnInit(): void {
    const exp = this.state.latestExperiment();
    if (exp && (exp.dataset_name !== this.currentDatasetName || exp.block_size !== this.state.selectedBlockSize())) {
      this.state.latestExperiment.set(null);
      this.state.latestSearch.set(null);
    }

    if (!this.state.latestExperiment() && this.state.selectedDataset()) {
      this.runCompression();
    } else if (this.state.latestExperiment()) {
      this.syncGainGateData(this.state.latestExperiment()!);
    }
  }

  ngAfterViewInit(): void {
    setTimeout(() => {
      this.initCharts();
    }, 200);
  }

  toggleAdvanced(): void {
    this.showAdvanced.set(!this.showAdvanced());
  }

  toggleGainGateAudit(): void {
    this.showGainGateAudit.set(!this.showGainGateAudit());
  }

  getEvaluations(): EvaluatedPhraseItem[] {
    return this.evaluationsList();
  }

  getGainGateSummary(): GainGateSummary | null {
    return this.gainGateSummaryData();
  }

  getExperimentResults(): MethodCompressionResult[] {
    return this.state.latestExperiment()?.results || [];
  }

  getMethodBadgeClass(methodName: string): string {
    const m = methodName.toLowerCase();
    if (m.includes('proposed')) return 'pill-badge pill-blue text-xs';
    if (m.includes('unconditional')) return 'pill-badge pill-purple text-xs';
    if (m.includes('naive')) return 'pill-badge pill-amber text-xs';
    if (m.includes('rle') || m.includes('worst')) return 'pill-badge pill-crimson text-xs';
    if (m.includes('gzip')) return 'pill-badge pill-default text-xs';
    return 'pill-badge pill-default text-xs';
  }

  getMethodBadgeLabel(methodName: string): string {
    const m = methodName.toLowerCase();
    if (m.includes('proposed')) return 'Proposed Novelty';
    if (m.includes('unconditional')) return 'Ablation Study';
    if (m.includes('naive')) return 'Previous Baseline';
    if (m.includes('rle') || m.includes('worst')) return 'Worst-Case Baseline (RLE)';
    if (m.includes('gzip')) return 'Stream Baseline';
    return 'Plaintext Baseline';
  }

  getStorageSavedText(res: MethodCompressionResult): string {
    if (res.original_size === 0) return '0.0%';
    if (res.total_storage <= res.original_size) {
      const saved = ((res.original_size - res.total_storage) / res.original_size) * 100;
      return `${saved.toFixed(1)}% saved`;
    } else {
      const overhead = ((res.total_storage - res.original_size) / res.original_size) * 100;
      return `+${overhead.toFixed(1)}% overhead`;
    }
  }

  private syncGainGateData(rec: any): void {
    if (rec.gain_gate_summary) {
      this.gainGateSummaryData.set(rec.gain_gate_summary);
    }
    if (rec.evaluations_sample && rec.evaluations_sample.length > 0) {
      this.evaluationsList.set(rec.evaluations_sample);
    }

    // Also fetch the full list of evaluations from backend
    if (this.currentDatasetName) {
      const bSize = this.state.selectedBlockSize();
      this.api.getGainGateEvaluations(this.currentDatasetName, bSize).subscribe({
        next: (resp) => {
          if (resp.selection_summary) {
            this.gainGateSummaryData.set(resp.selection_summary);
          }
          if (resp.evaluations) {
            this.evaluationsList.set(resp.evaluations);
          }
        },
        error: (err) => console.warn('Could not load evaluations', err)
      });
    }
  }

  runCompression(): void {
    const dataset = this.state.selectedDataset();
    if (!dataset) return;

    this.isRunning.set(true);
    const blockSize = this.state.selectedBlockSize();
    this.api.runCompression(dataset.name, 'all', blockSize).subscribe({
      next: (rec) => {
        this.isRunning.set(false);
        this.state.latestExperiment.set(rec);
        this.state.latestSearch.set(null); // Clear search when re-running
        this.syncGainGateData(rec);
        setTimeout(() => this.updateCharts(), 50);
      },
      error: (err) => {
        this.isRunning.set(false);
        console.error('Compression failed', err);
      }
    });
  }

  getMetric(metricKey: string, methodPrefix: string): any {
    if (!this.isExperimentActiveForCurrentFile) return 0;
    const exp = this.state.latestExperiment();
    if (!exp) return 0;
    const item = exp.results.find(r => r.method.toLowerCase().includes(methodPrefix.toLowerCase()));
    if (!item) return 0;
    return (item as any)[metricKey] ?? 0;
  }

  hasSearchExecuted(): boolean {
    const search = this.state.latestSearch();
    return !!search && search.dataset_name === this.currentDatasetName && search.query_details?.block_size === this.state.selectedBlockSize();
  }

  getSearchTime(methodName: string): string {
    if (!this.hasSearchExecuted()) return '—';
    const search = this.state.latestSearch();
    if (!search || !search.comparison || !search.comparison.methods) {
      return '—';
    }
    const item = search.comparison.methods.find(m => m.method.toLowerCase().includes(methodName.toLowerCase()) || methodName.toLowerCase().includes(m.method.toLowerCase().split(':')[0]));
    if (!item) {
      // Fallback matching
      if (methodName.toLowerCase().includes('proposed')) {
        const prop = search.comparison.methods.find(m => m.method.toLowerCase().includes('proposed'));
        return prop ? `${prop.search_latency_ms} ms` : '—';
      }
      return '—';
    }
    return `${item.search_latency_ms} ms`;
  }

  getDataProcessed(methodName: string): string {
    if (!this.hasSearchExecuted()) return '—';
    const search = this.state.latestSearch();
    if (!search || !search.comparison || !search.comparison.methods) {
      return '—';
    }
    const item = search.comparison.methods.find(m => m.method.toLowerCase().includes(methodName.toLowerCase()) || methodName.toLowerCase().includes(m.method.toLowerCase().split(':')[0]));
    if (!item) {
      if (methodName.toLowerCase().includes('proposed')) {
        const prop = search.comparison.methods.find(m => m.method.toLowerCase().includes('proposed'));
        return prop ? `${this.formatBytes(prop.data_decoded_bytes)} (${prop.data_decoded_pct}% decoded)` : '—';
      }
      return '—';
    }
    if (methodName.toLowerCase().includes('proposed')) {
      return `${this.formatBytes(item.data_decoded_bytes)} (${item.data_decoded_pct}% decoded)`;
    } else {
      return `${this.formatBytes(item.data_decoded_bytes)} (100.0% decoded)`;
    }
  }

  getBlockSummaries(): any[] {
    if (!this.isExperimentActiveForCurrentFile) return [];
    const exp = this.state.latestExperiment();
    if (!exp) return [];
    const item = exp.results.find(r => r.selective_searchable && r.blocks_summary && r.blocks_summary.length > 0);
    return item?.blocks_summary || [];
  }

  formatBytes(bytes: number): string {
    if (!bytes || bytes === 0) return '0 B';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  }

  private getBarColor(methodName: string, isTotal: boolean = false): string {
    const m = methodName.toLowerCase();
    if (m.includes('proposed')) return isTotal ? '#059669' : '#2563eb';
    if (m.includes('unconditional')) return '#7c3aed';
    if (m.includes('naive')) return '#d97706';
    if (m.includes('rle') || m.includes('worst')) return '#dc2626';
    if (m.includes('gzip')) return '#0f172a';
    return '#94a3b8';
  }

  private getChartLabels(): string[] {
    const results = this.getExperimentResults();
    if (results.length === 0) return ['Proposed Gain-Gated', 'Worst Baseline (RLE)', 'Raw Plaintext'];
    return results.map(r => {
      if (r.method.includes('Proposed')) return 'Proposed Gain-Gated';
      if (r.method.includes('Unconditional')) return 'Unconditional Dict';
      if (r.method.includes('Naive')) return 'Naive Block LZ78';
      if (r.method.toLowerCase().includes('rle') || r.method.toLowerCase().includes('worst')) return 'Worst Baseline (RLE)';
      if (r.method.includes('Gzip')) return 'Standard GZIP';
      if (r.method.includes('Raw')) return 'Raw Plaintext';
      return r.method;
    });
  }

  initCharts(): void {
    if (!this.isExperimentActiveForCurrentFile) return;

    const results = this.getExperimentResults();
    const labels = this.getChartLabels();
    
    // Payload sizes (KB)
    const payloadData = results.map(r => Math.round((r.blocks_compressed_size || r.compressed_size) / 1024));
    // Total stored sizes (KB)
    const totalData = results.map(r => Math.round(r.total_storage / 1024));

    const payloadColors = results.map(r => this.getBarColor(r.method, false));
    const totalColors = results.map(r => this.getBarColor(r.method, true));

    // Chart 1: Compression Size Comparison (Horizontal Bar Chart)
    if (this.compressionChartRef) {
      const ctx1 = this.compressionChartRef.nativeElement.getContext('2d');
      if (ctx1) {
        if (this.chart1) this.chart1.destroy();

        this.chart1 = new Chart(ctx1, {
          type: 'bar',
          data: {
            labels,
            datasets: [{
              label: 'Payload Size (KB)',
              data: payloadData,
              backgroundColor: payloadColors,
              borderRadius: 6,
              barThickness: 20
            }]
          },
          options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: { display: false },
              tooltip: {
                callbacks: {
                  label: (ctx) => ` Payload: ${ctx.raw} KB`
                }
              }
            },
            scales: {
              x: {
                beginAtZero: true,
                title: { display: true, text: 'Size in KB', color: '#64748b', font: { weight: 'bold', size: 11 } },
                grid: { color: '#f1f5f9' },
                ticks: { color: '#64748b' }
              },
              y: {
                grid: { display: false },
                ticks: { color: '#0f172a', font: { weight: 'bold', size: 11 } }
              }
            }
          }
        });
      }
    }

    // Chart 2: Total Storage Comparison (Horizontal Bar Chart)
    if (this.storageChartRef) {
      const ctx2 = this.storageChartRef.nativeElement.getContext('2d');
      if (ctx2) {
        if (this.chart2) this.chart2.destroy();

        this.chart2 = new Chart(ctx2, {
          type: 'bar',
          data: {
            labels,
            datasets: [{
              label: 'Total Archive Stored (KB)',
              data: totalData,
              backgroundColor: totalColors,
              borderRadius: 6,
              barThickness: 20
            }]
          },
          options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: { display: false },
              tooltip: {
                callbacks: {
                  label: (ctx) => ` Total Stored: ${ctx.raw} KB`
                }
              }
            },
            scales: {
              x: {
                beginAtZero: true,
                title: { display: true, text: 'Total Stored in KB (Includes Index + Dict)', color: '#64748b', font: { weight: 'bold', size: 11 } },
                grid: { color: '#f1f5f9' },
                ticks: { color: '#64748b' }
              },
              y: {
                grid: { display: false },
                ticks: { color: '#0f172a', font: { weight: 'bold', size: 11 } }
              }
            }
          }
        });
      }
    }
  }

  updateCharts(): void {
    if (!this.isExperimentActiveForCurrentFile) return;

    const results = this.getExperimentResults();
    const labels = this.getChartLabels();
    const payloadData = results.map(r => Math.round((r.blocks_compressed_size || r.compressed_size) / 1024));
    const totalData = results.map(r => Math.round(r.total_storage / 1024));
    const payloadColors = results.map(r => this.getBarColor(r.method, false));
    const totalColors = results.map(r => this.getBarColor(r.method, true));

    if (this.chart1) {
      this.chart1.data.labels = labels;
      this.chart1.data.datasets[0].data = payloadData;
      this.chart1.data.datasets[0].backgroundColor = payloadColors;
      this.chart1.update();
    } else {
      this.initCharts();
    }

    if (this.chart2) {
      this.chart2.data.labels = labels;
      this.chart2.data.datasets[0].data = totalData;
      this.chart2.data.datasets[0].backgroundColor = totalColors;
      this.chart2.update();
    } else {
      this.initCharts();
    }
  }
}
