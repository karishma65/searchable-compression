import { Component, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { StateService } from '../../services/state.service';
import { ApiService } from '../../services/api.service';
import { DatasetSummary } from '../../models/dataset.model';

@Component({
  selector: 'app-datasets',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="app-container section-spacing flex flex-col gap-8">
      
      <!-- Page Header -->
      <div class="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 class="heading-section" style="font-size: 2rem;">Upload Logs</h1>
          <p class="lead-text text-sm" style="color: #64748b; margin-top: 0.25rem;">
            Upload your log files (.log, .txt) to evaluate block-based compression and selective search.
          </p>
        </div>
      </div>

      <!-- Upload Log File Panel (Prioritized Single Card) -->
      <div class="panel flex flex-col gap-4" style="background: #ffffff;">
        <div>
          <h3 class="heading-sub">Upload Log File</h3>
          <p class="text-xs text-muted" style="margin-top: 0.35rem;">
            Select any raw log or plain text file (.log, .txt) from your computer.
          </p>
        </div>

        <div
          (dragover)="onDragOver($event)"
          (dragleave)="onDragLeave($event)"
          (drop)="onFileDrop($event)"
          [style.borderColor]="isDragging ? '#2563eb' : 'var(--border-light)'"
          style="border: 2px dashed var(--border-light); border-radius: var(--radius-lg); padding: 3rem 1.5rem; text-align: center; background: #fafbfc; cursor: pointer;"
          class="flex flex-col items-center justify-center gap-3">
          
          <input #fileInput type="file" accept=".log,.txt" (change)="onFileSelected($event)" style="display: none;">
          
          <div (click)="fileInput.click()" class="flex flex-col items-center gap-2">
            <div style="width: 54px; height: 54px; border-radius: 50%; background: #ffffff; border: 1.5px solid var(--border-light); display: flex; align-items: center; justify-content: center; box-shadow: var(--shadow-sm);">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#2563eb" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                <polyline points="17 8 12 3 7 8"></polyline>
                <line x1="12" y1="3" x2="12" y2="15"></line>
              </svg>
            </div>
            <div style="font-weight: 700; font-size: 1.05rem; color: #0f172a;">
              Click to browse or drop .log / .txt file here
            </div>
            <div class="text-xs text-muted">
              Supports arbitrary log formats, timestamps, IDs, and text up to 50 MB
            </div>
          </div>
        </div>

        <div *ngIf="uploadStatus()" class="pill-badge pill-blue text-xs" style="padding: 0.5rem 0.75rem;">
          {{ uploadStatus() }}
        </div>
      </div>

      <!-- Active Log File Details -->
      <div *ngIf="currentDataset" class="panel flex flex-col gap-6" style="background: #ffffff;">
        
        <div class="flex items-center justify-between flex-wrap gap-4">
          <div>
            <span class="text-xs font-bold text-muted uppercase tracking-wider">Active Log File</span>
            <h2 class="heading-sub text-mono" style="font-size: 1.35rem; margin-top: 0.15rem;">{{ currentDataset.name }}</h2>
          </div>

          <div class="flex items-center gap-3">
            <button (click)="compressAndIndex()" [disabled]="isCompressing()" class="btn btn-primary btn-sm">
              <span *ngIf="isCompressing()">Compressing &amp; Indexing...</span>
              <span *ngIf="!isCompressing()">Compress &amp; Index Logs</span>
              <svg *ngIf="!isCompressing()" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <polygon points="5 3 19 12 5 21 5 3"></polygon>
              </svg>
            </button>
          </div>
        </div>

        <!-- 4 Stats Cards including Block Size Setting & Calculated Total Blocks -->
        <div class="grid grid-cols-4 gap-4">
          <div class="metric-box">
            <span class="metric-label">Total Lines</span>
            <span class="metric-value">{{ currentDataset.line_count | number }}</span>
            <span class="text-xs text-muted">Log entries in file</span>
          </div>

          <div class="metric-box">
            <span class="metric-label">File Size</span>
            <span class="metric-value" style="color: #2563eb;">{{ currentDataset.size_kb }} KB</span>
            <span class="text-xs text-mono text-muted">{{ currentDataset.size_bytes | number }} bytes</span>
          </div>

          <div class="metric-box">
            <span class="metric-label">Block Size Setting</span>
            <div class="flex items-center gap-1" style="margin-top: 0.35rem; margin-bottom: 0.25rem;">
              <button
                *ngFor="let size of [50, 100, 250, 500]"
                type="button"
                (click)="state.setSelectedBlockSize(size)"
                [style.background]="state.selectedBlockSize() === size ? '#2563eb' : '#f1f5f9'"
                [style.color]="state.selectedBlockSize() === size ? '#ffffff' : '#334155'"
                style="padding: 3px 8px; font-size: 0.75rem; font-weight: 700; border-radius: 4px; border: none; cursor: pointer; transition: all 0.15s ease;">
                {{ size }}
              </button>
            </div>
            <span class="text-xs text-muted">Lines per compressed block</span>
          </div>

          <div class="metric-box">
            <span class="metric-label">Calculated Blocks</span>
            <span class="metric-value" style="color: #059669;">
              {{ calculatedBlockCount }} Blocks
            </span>
            <span class="text-xs text-muted">
              {{ currentDataset.line_count | number }} &divide; {{ state.selectedBlockSize() }} lines
            </span>
          </div>
        </div>

        <!-- Small Collapsible Preview (First 5 Lines) -->
        <div class="flex flex-col gap-2">
          <div class="flex items-center justify-between">
            <button
              type="button"
              (click)="togglePreview()"
              class="btn btn-outline btn-sm flex items-center gap-2"
              style="font-size: 0.75rem; padding: 0.35rem 0.75rem;">
              <span>{{ showPreview() ? 'Hide Preview' : 'Show Preview (First 5 Lines)' }}</span>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <path *ngIf="!showPreview()" d="m6 9 6 6 6-6"></path>
                <path *ngIf="showPreview()" d="m18 15-6-6-6 6"></path>
              </svg>
            </button>
            <span class="text-xs text-muted">Preview of first 5 raw records</span>
          </div>

          <div *ngIf="showPreview()" class="log-terminal flex flex-col gap-1.5" style="max-height: 180px; overflow-y: auto;">
            <div *ngFor="let line of previewLines" class="log-line">
              <span [innerHTML]="formatLogHighlight(line)"></span>
            </div>
          </div>
        </div>

      </div>

      <!-- Simplified Available Log Files Table -->
      <div class="panel flex flex-col gap-4" style="background: #ffffff;">
        <div>
          <h2 class="heading-section" style="font-size: 1.5rem;">Available Log Files</h2>
          <p class="text-muted text-xs" style="margin-top: 0.15rem;">Select a log file to run compression or search.</p>
        </div>

        <div class="data-table-wrapper">
          <table class="data-table">
            <thead>
              <tr>
                <th>File Name</th>
                <th>Type</th>
                <th>Lines</th>
                <th>Size</th>
                <th style="text-align: right;">Action</th>
              </tr>
            </thead>
            <tbody class="text-mono">
              <tr *ngFor="let d of state.datasets()" [style.background]="d.name === state.selectedDatasetName() ? '#eff6ff' : 'transparent'">
                <td style="font-weight: 700; color: #0f172a;">
                  {{ d.name }}
                  <span *ngIf="d.name === state.selectedDatasetName()" class="pill-badge pill-emerald text-xs" style="margin-left: 0.5rem;">Active</span>
                </td>
                <td class="text-muted" style="font-family: var(--font-main);">
                  <span [class.pill-blue]="d.source === 'uploaded' || d.source === 'Uploaded File'" [class.pill-default]="d.source !== 'uploaded' && d.source !== 'Uploaded File'" class="pill-badge text-xs">
                    {{ (d.source === 'uploaded' || d.source === 'Uploaded File') ? 'Uploaded' : 'Sample Log' }}
                  </span>
                </td>
                <td>{{ d.line_count | number }}</td>
                <td>{{ d.size_kb }} KB</td>
                <td style="text-align: right;">
                  <button
                    (click)="state.setSelectedDataset(d)"
                    [class.btn-primary]="d.name === state.selectedDatasetName()"
                    [class.btn-outline]="d.name !== state.selectedDatasetName()"
                    class="btn btn-sm">
                    {{ d.name === state.selectedDatasetName() ? 'Selected' : 'Select' }}
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

    </div>
  `
})
export class DatasetsComponent {
  state = inject(StateService);
  api = inject(ApiService);

  isDragging = false;
  isCompressing = signal<boolean>(false);
  uploadStatus = signal<string>('');
  showPreview = signal<boolean>(false);

  compressAndIndex(): void {
    const ds = this.state.selectedDataset();
    if (!ds) return;
    this.isCompressing.set(true);
    const blockSize = this.state.selectedBlockSize();
    this.api.runCompression(ds.name, 'all', blockSize).subscribe({
      next: (rec) => {
        this.isCompressing.set(false);
        this.state.latestExperiment.set(rec);
        this.state.latestSearch.set(null);
        this.state.setTab('results');
      },
      error: (err) => {
        this.isCompressing.set(false);
        alert('Compression and indexing failed: ' + (err.message || 'Error'));
      }
    });
  }

  get currentDataset(): DatasetSummary | null {
    return this.state.selectedDataset();
  }

  get calculatedBlockCount(): number {
    const ds = this.state.selectedDataset();
    if (!ds || ds.line_count === 0) return 0;
    const blockSize = this.state.selectedBlockSize();
    return Math.ceil(ds.line_count / blockSize);
  }

  get previewLines(): string[] {
    const ds = this.state.selectedDataset();
    if (!ds || !ds.sample_lines) return [];
    return ds.sample_lines.slice(0, 5);
  }

  togglePreview(): void {
    this.showPreview.set(!this.showPreview());
  }

  onDragOver(e: DragEvent): void {
    e.preventDefault();
    this.isDragging = true;
  }

  onDragLeave(e: DragEvent): void {
    e.preventDefault();
    this.isDragging = false;
  }

  onFileDrop(e: DragEvent): void {
    e.preventDefault();
    this.isDragging = false;
    if (e.dataTransfer && e.dataTransfer.files.length > 0) {
      this.uploadFile(e.dataTransfer.files[0]);
    }
  }

  onFileSelected(e: Event): void {
    const input = e.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.uploadFile(input.files[0]);
    }
  }

  uploadFile(file: File): void {
    this.uploadStatus.set(`Uploading ${file.name}...`);
    this.api.uploadDataset(file).subscribe({
      next: (summary) => {
        this.uploadStatus.set(`Uploaded ${file.name} successfully!`);
        this.state.loadDatasets();
        this.state.setSelectedDataset(summary);
      },
      error: (err) => {
        this.uploadStatus.set(`Upload failed: ${err.message || 'Error'}`);
      }
    });
  }

  formatLogHighlight(line: string): string {
    if (!line) return '';
    return line
      .replace(/\b(ERROR|FATAL|CRITICAL)\b/g, '<span style="color: #dc2626; font-weight: bold; background: #fee2e2; padding: 1px 4px; border-radius: 4px;">$1</span>')
      .replace(/\b(WARN|WARNING)\b/g, '<span style="color: #d97706; font-weight: bold; background: #fef3c7; padding: 1px 4px; border-radius: 4px;">$1</span>')
      .replace(/\b(INFO|DEBUG)\b/g, '<span style="color: #0284c7; font-weight: bold;">$1</span>')
      .replace(/(\[.*?service.*?\])/gi, '<span style="color: #7c3aed; font-weight: 600;">$1</span>');
  }
}
