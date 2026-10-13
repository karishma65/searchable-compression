import { Component, inject, signal, OnInit, ElementRef, ViewChild, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { StateService } from '../../services/state.service';
import { ApiService } from '../../services/api.service';
import { Chart, registerables } from 'chart.js';

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
          <h1 class="heading-section" style="font-size: 2rem;">Comparison Results: {{ currentDatasetName || 'No File Selected' }}</h1>
          <p class="lead-text text-sm" style="color: #64748b; margin-top: 0.25rem;">
            Storage efficiency and search processing comparison on active file <strong>{{ currentDatasetName || 'None' }}</strong> ({{ state.selectedBlockSize() }} lines/block).
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

        <!-- 1. Five Responsive Side-by-Side Metric Cards with Simple Labels -->
        <div class="grid grid-cols-5 gap-3">
          
          <!-- Card 1: Original File Size -->
          <div class="metric-box" title="Uncompressed original text size before processing">
            <span class="metric-label">Original File Size</span>
            <span class="metric-value">
              {{ formatBytes(origBytes) }}
            </span>
            <span class="text-xs text-muted">{{ origBytes | number }} bytes &bull; Baseline</span>
          </div>

          <!-- Card 2: Compressed Size (Proposed) -->
          <div class="metric-box" title="Raw compressed log data without the search index">
            <span class="metric-label">Compressed Size (Proposed)</span>
            <span class="metric-value" style="color: #2563eb;">
              {{ formatBytes(propPayloadBytes) }}
            </span>
            <span class="text-xs text-muted">{{ propPayloadBytes | number }} bytes &bull; Data blocks only ({{ propPayloadRatio }}&times;)</span>
          </div>

          <!-- Card 3: GZIP Size -->
          <div class="metric-box" title="Standard GZIP compressed archive size">
            <span class="metric-label">GZIP Size</span>
            <span class="metric-value" style="color: #0f172a;">
              {{ formatBytes(gzipArchiveBytes) }}
            </span>
            <span class="text-xs text-muted">{{ gzipArchiveBytes | number }} bytes &bull; {{ gzipStorageSaved }}</span>
          </div>

          <!-- Card 4: Search Index Size -->
          <div class="metric-box" title="Search metadata used for selective block retrieval">
            <span class="metric-label">Search Index Size</span>
            <span class="metric-value" style="color: #7c3aed;">
              {{ formatBytes(propIndexBytes) }}
            </span>
            <span class="text-xs text-muted">{{ propIndexBytes | number }} bytes &bull; Search metadata</span>
          </div>

          <!-- Card 5: Total Stored Size (Proposed) -->
          <div class="metric-box" title="Total stored size including compressed data blocks and search index">
            <span class="metric-label">Total Stored Size (Proposed)</span>
            <span class="metric-value" style="color: #059669;">
              {{ formatBytes(propTotalBytes) }}
            </span>
            <span class="text-xs text-muted">{{ propTotalBytes | number }} bytes &bull; Blocks + index ({{ propOverallRatio }}&times; &bull; {{ propStorageSavedOrOverhead }})</span>
          </div>

        </div>

        <!-- 2. Methods Comparison Table (14px font, simplified headers, clear alignment) -->
        <div class="panel flex flex-col gap-4" style="background: #ffffff;">
          <div class="flex items-center justify-between flex-wrap gap-2">
            <div>
              <h2 class="heading-sub" style="font-size: 1.25rem;">Methods Comparison Table</h2>
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
                  <th style="min-width: 170px;">Method</th>
                  <th>Compressed / Stored Size</th>
                  <th>Compression Ratio</th>
                  <th>Total Stored Size</th>
                  <th>Storage Saved / Overhead</th>
                  <th>Search Time</th>
                  <th>Data Processed During Search</th>
                </tr>
              </thead>
              <tbody class="text-mono">
                
                <!-- Proposed Method -->
                <tr style="background: #eff6ff;">
                  <td style="font-weight: 700; color: #2563eb; font-family: var(--font-main);">
                    Proposed (Block LZ78 + Huffman)
                  </td>
                  <td style="font-weight: 700; color: #2563eb;" title="Data blocks only, excluding index">
                    {{ formatBytes(propPayloadBytes) }}
                  </td>
                  <td style="font-weight: 700; color: #059669;">
                    {{ propPayloadRatio }}&times;
                  </td>
                  <td style="font-weight: 700; color: #0f172a;" title="Compressed data plus search index and metadata">
                    {{ formatBytes(propTotalBytes) }}
                  </td>
                  <td style="font-weight: 700;">
                    <span [class.pill-emerald]="propTotalBytes <= origBytes" [class.pill-default]="propTotalBytes > origBytes" class="pill-badge text-xs" style="font-family: var(--font-main);">
                      {{ propStorageSavedOrOverhead }}
                    </span>
                  </td>
                  <td style="font-weight: 700; color: #059669;">
                    {{ getSearchTime('Proposed') }}
                  </td>
                  <td style="font-weight: 600; color: #059669;">
                    {{ getDataProcessed('Proposed') }}
                  </td>
                </tr>

                <!-- Standard GZIP -->
                <tr>
                  <td style="font-weight: 700; color: #0f172a; font-family: var(--font-main);">
                    Standard GZIP
                  </td>
                  <td style="font-weight: 700;">
                    {{ formatBytes(gzipArchiveBytes) }}
                  </td>
                  <td style="font-weight: 700; color: #059669;">
                    {{ gzipPayloadRatio }}&times;
                  </td>
                  <td style="font-weight: 700;">
                    {{ formatBytes(gzipArchiveBytes) }}
                  </td>
                  <td>
                    <span class="pill-badge pill-emerald text-xs" style="font-family: var(--font-main);">
                      {{ gzipStorageSaved }}
                    </span>
                  </td>
                  <td style="color: #0f172a;">
                    {{ getSearchTime('Gzip') }}
                  </td>
                  <td style="color: #64748b;">
                    {{ getDataProcessed('Gzip') }}
                  </td>
                </tr>

                <!-- Uncompressed Logs -->
                <tr>
                  <td style="font-weight: 700; color: #64748b; font-family: var(--font-main);">
                    Uncompressed Logs
                  </td>
                  <td class="text-muted">
                    {{ formatBytes(origBytes) }}
                  </td>
                  <td class="text-muted">
                    1.00&times;
                  </td>
                  <td class="text-muted">
                    {{ formatBytes(origBytes) }}
                  </td>
                  <td class="text-muted">
                    0.0% (Baseline)
                  </td>
                  <td class="text-muted">
                    {{ getSearchTime('Raw') }}
                  </td>
                  <td class="text-muted">
                    {{ getDataProcessed('Raw') }}
                  </td>
                </tr>

              </tbody>
            </table>
          </div>
        </div>

        <!-- 3. Two Separate Horizontal Bar Charts (No cramped or slanted labels) -->
        <div class="grid grid-cols-2 gap-6">
          
          <!-- Chart 1: Compression Size Comparison (Compressed data only, excluding index) -->
          <div class="panel flex flex-col gap-4" style="background: #ffffff;">
            <div>
              <h3 class="heading-sub">Compression Size Comparison</h3>
              <p class="text-muted text-xs">Compares compressed data size alone (excluding search index) in KB.</p>
            </div>
            <div style="height: 240px; position: relative;">
              <canvas #compressionChart></canvas>
            </div>
          </div>

          <!-- Chart 2: Total Storage Comparison (Includes index & metadata) -->
          <div class="panel flex flex-col gap-4" style="background: #ffffff;">
            <div>
              <h3 class="heading-sub">Total Storage Comparison</h3>
              <p class="text-muted text-xs">Compares total stored size (including search index and metadata) in KB.</p>
            </div>
            <div style="height: 240px; position: relative;">
              <canvas #storageChart></canvas>
            </div>
          </div>

        </div>

        <!-- 4. Storage & Block Details Section -->
        <div class="panel flex flex-col gap-4" style="background: #ffffff;">
          <div class="flex items-center justify-between flex-wrap gap-2">
            <div>
              <h3 class="heading-sub">Storage &amp; Block Details</h3>
              <p class="text-muted text-xs">Component storage breakdown and partitioned block specifications for <strong>{{ currentDatasetName }}</strong>.</p>
            </div>

            <button
              type="button"
              (click)="toggleAdvanced()"
              class="btn btn-outline btn-sm flex items-center gap-1.5"
              style="font-size: 0.75rem;">
              <span>{{ showAdvanced() ? 'Hide Storage & Block Details' : 'View Storage & Block Details' }}</span>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <path *ngIf="!showAdvanced()" d="m6 9 6 6 6-6"></path>
                <path *ngIf="showAdvanced()" d="m18 15-6-6-6 6"></path>
              </svg>
            </button>
          </div>

          <!-- Expanded Storage & Block Details Panel -->
          <div *ngIf="showAdvanced()" class="flex flex-col gap-6" style="padding-top: 1rem; border-top: 1px dashed #e2e8f0;">
            
            <!-- 3 Component Breakdown Boxes -->
            <div class="grid grid-cols-3 gap-4">
              <div class="metric-box">
                <span class="metric-label">Compressed Size (Proposed)</span>
                <span class="metric-value" style="color: #2563eb;">
                  {{ formatBytes(propPayloadBytes) }}
                </span>
                <span class="text-xs text-muted">{{ propPayloadBytes | number }} bytes &bull; Discrete compressed data blocks</span>
              </div>

              <div class="metric-box">
                <span class="metric-label">Search Index Size</span>
                <span class="metric-value" style="color: #7c3aed;">
                  {{ formatBytes(propIndexBytes) }}
                </span>
                <span class="text-xs text-muted">{{ propIndexBytes | number }} bytes &bull; Search metadata &amp; block references</span>
              </div>

              <div class="metric-box">
                <span class="metric-label">Total Stored Size (Proposed)</span>
                <span class="metric-value" style="color: #059669;">
                  {{ formatBytes(propTotalBytes) }}
                </span>
                <span class="text-xs text-muted">{{ propTotalBytes | number }} bytes &bull; Compressed blocks + index</span>
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

  get propIndexBytes(): number {
    return this.getMetric('index_size', 'Proposed') || 0;
  }

  get propTotalBytes(): number {
    return this.getMetric('total_storage', 'Proposed') || 0;
  }

  get gzipArchiveBytes(): number {
    return this.getMetric('compressed_size', 'Gzip') || 0;
  }

  get propPayloadRatio(): number {
    return this.propPayloadBytes > 0 ? Number((this.origBytes / this.propPayloadBytes).toFixed(2)) : 1.0;
  }

  get propOverallRatio(): number {
    return this.propTotalBytes > 0 ? Number((this.origBytes / this.propTotalBytes).toFixed(2)) : 1.0;
  }

  get gzipPayloadRatio(): number {
    return this.gzipArchiveBytes > 0 ? Number((this.origBytes / this.gzipArchiveBytes).toFixed(2)) : 1.0;
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

  get gzipStorageSaved(): string {
    if (this.origBytes === 0) return '0.0%';
    const saved = ((this.origBytes - this.gzipArchiveBytes) / this.origBytes) * 100;
    return `${saved.toFixed(1)}% saved`;
  }

  ngOnInit(): void {
    // If experiment in state belongs to a different dataset or block size, clear it
    const exp = this.state.latestExperiment();
    if (exp && (exp.dataset_name !== this.currentDatasetName || exp.block_size !== this.state.selectedBlockSize())) {
      this.state.latestExperiment.set(null);
      this.state.latestSearch.set(null);
    }

    if (!this.state.latestExperiment() && this.state.selectedDataset()) {
      this.runCompression();
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

  getSearchTime(methodPrefix: string): string {
    if (!this.hasSearchExecuted()) return '—';
    const search = this.state.latestSearch();
    if (!search || !search.comparison || !search.comparison.methods) {
      return '—';
    }
    const item = search.comparison.methods.find(m => m.method.toLowerCase().includes(methodPrefix.toLowerCase()));
    if (!item) return '—';
    return `${item.search_latency_ms} ms`;
  }

  getDataProcessed(methodPrefix: string): string {
    if (!this.hasSearchExecuted()) return '—';
    const search = this.state.latestSearch();
    if (!search || !search.comparison || !search.comparison.methods) {
      return '—';
    }
    const item = search.comparison.methods.find(m => m.method.toLowerCase().includes(methodPrefix.toLowerCase()));
    if (!item) return '—';
    if (methodPrefix === 'Proposed') {
      return `${this.formatBytes(item.data_decoded_bytes)} (${item.data_decoded_pct}% of original)`;
    } else {
      return `${this.formatBytes(item.data_decoded_bytes)} (100.0% of original)`;
    }
  }

  getBlockSummaries(): any[] {
    if (!this.isExperimentActiveForCurrentFile) return [];
    const exp = this.state.latestExperiment();
    if (!exp) return [];
    const item = exp.results.find(r => r.selective_searchable);
    return item?.blocks_summary || [];
  }

  formatBytes(bytes: number): string {
    if (!bytes || bytes === 0) return '0 B';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  }

  initCharts(): void {
    if (!this.isExperimentActiveForCurrentFile) return;

    const origKb = Math.round(this.origBytes / 1024);
    const propCompressedKb = Math.round(this.propPayloadBytes / 1024);
    const gzipKb = Math.round(this.gzipArchiveBytes / 1024);
    const propTotalKb = Math.round(this.propTotalBytes / 1024);

    // Chart 1: Compression Size Comparison (Horizontal Bar Chart)
    if (this.compressionChartRef) {
      const ctx1 = this.compressionChartRef.nativeElement.getContext('2d');
      if (ctx1) {
        if (this.chart1) this.chart1.destroy();

        this.chart1 = new Chart(ctx1, {
          type: 'bar',
          data: {
            labels: ['Original File', 'Proposed Compressed', 'GZIP'],
            datasets: [{
              label: 'Compressed Size (KB)',
              data: [origKb, propCompressedKb, gzipKb],
              backgroundColor: ['#94a3b8', '#2563eb', '#0f172a'],
              borderRadius: 6,
              barThickness: 24
            }]
          },
          options: {
            indexAxis: 'y', // Horizontal layout for clear method labels
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: { display: false },
              tooltip: {
                callbacks: {
                  label: (ctx) => ` Size: ${ctx.raw} KB`
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
                ticks: { color: '#0f172a', font: { weight: 'bold', size: 12 } }
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
            labels: ['Original File', 'Proposed Total Stored', 'GZIP Stored'],
            datasets: [{
              label: 'Total Stored Size (KB)',
              data: [origKb, propTotalKb, gzipKb],
              backgroundColor: ['#94a3b8', '#059669', '#0f172a'],
              borderRadius: 6,
              barThickness: 24
            }]
          },
          options: {
            indexAxis: 'y', // Horizontal layout for clear method labels
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: { display: false },
              tooltip: {
                callbacks: {
                  label: (ctx) => ` Stored: ${ctx.raw} KB`
                }
              }
            },
            scales: {
              x: {
                beginAtZero: true,
                title: { display: true, text: 'Total Stored in KB (Includes Index)', color: '#64748b', font: { weight: 'bold', size: 11 } },
                grid: { color: '#f1f5f9' },
                ticks: { color: '#64748b' }
              },
              y: {
                grid: { display: false },
                ticks: { color: '#0f172a', font: { weight: 'bold', size: 12 } }
              }
            }
          }
        });
      }
    }
  }

  updateCharts(): void {
    if (!this.isExperimentActiveForCurrentFile) return;

    const origKb = Math.round(this.origBytes / 1024);
    const propCompressedKb = Math.round(this.propPayloadBytes / 1024);
    const gzipKb = Math.round(this.gzipArchiveBytes / 1024);
    const propTotalKb = Math.round(this.propTotalBytes / 1024);

    if (this.chart1) {
      this.chart1.data.datasets[0].data = [origKb, propCompressedKb, gzipKb];
      this.chart1.update();
    } else {
      this.initCharts();
    }

    if (this.chart2) {
      this.chart2.data.datasets[0].data = [origKb, propTotalKb, gzipKb];
      this.chart2.update();
    } else {
      this.initCharts();
    }
  }
}
