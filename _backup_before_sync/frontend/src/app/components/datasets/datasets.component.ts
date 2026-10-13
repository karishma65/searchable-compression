import { Component, inject, signal } from '@angular/core';
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
    <div class="space-y-8 py-6 max-w-7xl mx-auto px-4 sm:px-6">
      
      <!-- Header -->
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 class="text-2xl font-bold text-white tracking-tight">Cloud & Kubernetes Log Datasets</h1>
          <p class="text-xs text-slate-400">Upload custom log files (.log, .txt, .csv) or generate realistic production Kubernetes clusters</p>
        </div>
        <div class="flex items-center gap-2">
          <button (click)="generatePreset(1500)" [disabled]="isGenerating()" class="btn btn-primary text-xs">
            <svg *ngIf="!isGenerating()" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
            </svg>
            <span *ngIf="isGenerating()" class="animate-spin inline-block mr-1">⌛</span>
            Generate K8s Benchmark (1,500 Lines)
          </button>
        </div>
      </div>

      <!-- Action Grid: Upload Card & Synthetic Generator Card -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        <!-- Upload Card -->
        <div class="glass-card p-6 space-y-4">
          <div class="flex items-center justify-between">
            <h2 class="text-base font-bold text-white flex items-center gap-2">
              <svg class="w-5 h-5 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              Upload Log File
            </h2>
            <span class="badge badge-info text-[10px]">.log / .txt / .csv</span>
          </div>
          <p class="text-xs text-slate-400 leading-relaxed">
            Upload raw cloud or Kubernetes logs. The parser extracts timestamp ranges, severity levels, microservices, and token vocabularies.
          </p>

          <div
            (dragover)="onDragOver($event)"
            (dragleave)="onDragLeave($event)"
            (drop)="onFileDrop($event)"
            [class.border-cyan-500]="isDragging"
            class="border-2 border-dashed border-slate-700/80 hover:border-slate-500 rounded-xl p-6 text-center cursor-pointer transition-all bg-slate-900/40">
            <input #fileInput type="file" accept=".log,.txt,.csv" (change)="onFileSelected($event)" class="hidden">
            <div (click)="fileInput.click()" class="space-y-2">
              <div class="w-10 h-10 rounded-full bg-cyan-500/10 text-cyan-400 flex items-center justify-center mx-auto">
                <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
              </div>
              <div class="text-xs text-slate-300 font-medium">Click to browse or drag and drop file here</div>
              <div class="text-[11px] text-slate-500">Supports Kubernetes JSON logs, syslog, Apache/Nginx, or custom formats</div>
            </div>
          </div>

          <div *ngIf="uploadStatus()" class="text-xs p-2.5 rounded-lg bg-cyan-900/30 border border-cyan-500/30 text-cyan-300">
            {{ uploadStatus() }}
          </div>
        </div>

        <!-- Generate K8s Synthetic Dataset Card -->
        <div class="glass-card p-6 space-y-4">
          <div class="flex items-center justify-between">
            <h2 class="text-base font-bold text-white flex items-center gap-2">
              <svg class="w-5 h-5 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              Kubernetes Cluster Generator
            </h2>
            <span class="badge badge-purple text-[10px]">Realistic Microservices</span>
          </div>
          <p class="text-xs text-slate-400 leading-relaxed">
            Instantly synthesize microservice cluster logs containing realistic multi-service errors, database connection timeouts, pod crashloops, and trace IDs.
          </p>

          <div class="space-y-3 pt-1">
            <div>
              <label class="block text-xs font-medium text-slate-300 mb-1">Dataset Name</label>
              <input type="text" [(ngModel)]="genName" class="form-input text-xs font-mono" placeholder="k8s-production-cluster.log">
            </div>

            <div class="grid grid-cols-3 gap-2">
              <button
                type="button"
                (click)="genLineCount = 500"
                [class.border-cyan-500]="genLineCount === 500"
                [class.bg-cyan-900/20]="genLineCount === 500"
                class="p-2 rounded-lg border border-slate-700 bg-slate-900/60 text-center hover:border-slate-500 cursor-pointer">
                <div class="text-xs font-bold text-white">500 Lines</div>
                <div class="text-[10px] text-slate-400">~60 KB</div>
              </button>
              <button
                type="button"
                (click)="genLineCount = 1500"
                [class.border-cyan-500]="genLineCount === 1500"
                [class.bg-cyan-900/20]="genLineCount === 1500"
                class="p-2 rounded-lg border border-slate-700 bg-slate-900/60 text-center hover:border-slate-500 cursor-pointer">
                <div class="text-xs font-bold text-white">1,500 Lines</div>
                <div class="text-[10px] text-slate-400">~180 KB</div>
              </button>
              <button
                type="button"
                (click)="genLineCount = 3000"
                [class.border-cyan-500]="genLineCount === 3000"
                [class.bg-cyan-900/20]="genLineCount === 3000"
                class="p-2 rounded-lg border border-slate-700 bg-slate-900/60 text-center hover:border-slate-500 cursor-pointer">
                <div class="text-xs font-bold text-white">3,000 Lines</div>
                <div class="text-[10px] text-slate-400">~360 KB</div>
              </button>
            </div>

            <button
              (click)="generateCustom()"
              [disabled]="isGenerating()"
              class="w-full btn btn-cyan text-xs">
              {{ isGenerating() ? 'Generating Dataset...' : 'Generate and Load Dataset' }}
            </button>
          </div>
        </div>

      </div>

      <!-- Current Selected Dataset Details & Preview -->
      <div *ngIf="currentDataset" class="glass-card p-6 space-y-6">
        
        <!-- Header & Quick KPIs -->
        <div class="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-[var(--border-subtle)]">
          <div class="space-y-1">
            <div class="flex items-center gap-2">
              <span class="badge badge-success text-[10px]">ACTIVE DATASET</span>
              <h2 class="text-lg font-bold text-white font-mono">{{ currentDataset.name }}</h2>
            </div>
            <p class="text-xs text-slate-400">Source: {{ currentDataset.source }} &bull; Time: {{ currentDataset.first_timestamp }} to {{ currentDataset.last_timestamp }}</p>
          </div>

          <div class="flex items-center gap-3">
            <button (click)="state.setTab('experiment')" class="btn btn-cyan text-xs">
              Configure & Run Compression &rarr;
            </button>
          </div>
        </div>

        <!-- Metric Cards -->
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div class="p-4 rounded-xl bg-slate-900/70 border border-slate-800">
            <div class="text-[11px] text-slate-400 uppercase tracking-wider font-semibold">Total Lines</div>
            <div class="text-2xl font-extrabold text-white font-mono mt-1">{{ currentDataset.line_count | number }}</div>
          </div>
          <div class="p-4 rounded-xl bg-slate-900/70 border border-slate-800">
            <div class="text-[11px] text-slate-400 uppercase tracking-wider font-semibold">Uncompressed Size</div>
            <div class="text-2xl font-extrabold text-cyan-400 font-mono mt-1">{{ currentDataset.size_kb }} KB</div>
            <div class="text-[10px] text-slate-500 font-mono">{{ currentDataset.size_bytes | number }} bytes</div>
          </div>
          <div class="p-4 rounded-xl bg-slate-900/70 border border-slate-800">
            <div class="text-[11px] text-slate-400 uppercase tracking-wider font-semibold">Microservices</div>
            <div class="text-2xl font-extrabold text-indigo-400 font-mono mt-1">{{ currentDataset.unique_services.length }}</div>
            <div class="text-[10px] text-slate-500">Pods & Components</div>
          </div>
          <div class="p-4 rounded-xl bg-slate-900/70 border border-slate-800">
            <div class="text-[11px] text-slate-400 uppercase tracking-wider font-semibold">Severity Levels</div>
            <div class="flex gap-1.5 mt-2 flex-wrap">
              <span *ngFor="let item of getLevelEntries(currentDataset.level_distribution)"
                [class.badge-error]="item.key === 'ERROR' || item.key === 'FATAL'"
                [class.badge-warn]="item.key === 'WARN'"
                [class.badge-info]="item.key === 'INFO' || item.key === 'DEBUG'"
                class="badge text-[10px]">
                {{ item.key }}: {{ item.value }}
              </span>
            </div>
          </div>
        </div>

        <!-- Microservices List Tags -->
        <div class="space-y-2">
          <div class="text-xs font-semibold text-slate-300">Indexed Microservices & Components:</div>
          <div class="flex flex-wrap gap-1.5">
            <span *ngFor="let svc of currentDataset.unique_services" class="px-2.5 py-1 rounded-md bg-slate-800/80 border border-slate-700 text-xs font-mono text-cyan-300">
              {{ svc }}
            </span>
          </div>
        </div>

        <!-- Raw Log Sample Preview -->
        <div class="space-y-2">
          <div class="flex items-center justify-between">
            <span class="text-xs font-semibold text-slate-300">Sample Log Lines Preview:</span>
            <span class="text-[11px] text-slate-500">Showing first 8 records</span>
          </div>

          <div class="bg-black/60 rounded-xl p-4 font-mono text-xs overflow-x-auto border border-slate-800 space-y-1.5">
            <div *ngFor="let line of currentDataset.sample_lines" class="text-slate-300 hover:text-white leading-relaxed">
              <span [innerHTML]="formatLogHighlight(line)"></span>
            </div>
          </div>
        </div>

      </div>

      <!-- Datasets Repository Table -->
      <div class="glass-card p-6 space-y-4">
        <h2 class="text-base font-bold text-white">Available Datasets in Workspace</h2>
        <div class="overflow-x-auto">
          <table class="w-full text-left text-xs text-slate-300">
            <thead class="bg-slate-900/90 text-slate-400 uppercase font-semibold text-[10px] tracking-wider border-b border-slate-800">
              <tr>
                <th class="p-3">Dataset Name</th>
                <th class="p-3">Source</th>
                <th class="p-3">Lines</th>
                <th class="p-3">Size</th>
                <th class="p-3">Services</th>
                <th class="p-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-800/60 font-mono">
              <tr *ngFor="let d of state.datasets()" class="hover:bg-slate-800/40 transition-colors">
                <td class="p-3 font-semibold text-white flex items-center gap-2">
                  <span *ngIf="d.name === state.selectedDatasetName()" class="w-2 h-2 rounded-full bg-cyan-400"></span>
                  {{ d.name }}
                </td>
                <td class="p-3 text-slate-400">{{ d.source }}</td>
                <td class="p-3 text-cyan-400">{{ d.line_count | number }}</td>
                <td class="p-3 text-indigo-300">{{ d.size_kb }} KB</td>
                <td class="p-3 text-slate-400">{{ d.unique_services.length }} services</td>
                <td class="p-3 text-right">
                  <button
                    (click)="state.setSelectedDataset(d)"
                    [class.btn-cyan]="d.name === state.selectedDatasetName()"
                    [class.btn-secondary]="d.name !== state.selectedDatasetName()"
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
  isGenerating = signal<boolean>(false);
  uploadStatus = signal<string>('');

  genName = 'k8s-cluster-bench.log';
  genLineCount = 1500;

  get currentDataset(): DatasetSummary | null {
    return this.state.selectedDataset();
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
    this.uploadStatus.set(`Uploading and analyzing ${file.name}...`);
    this.api.uploadDataset(file).subscribe({
      next: (summary) => {
        this.uploadStatus.set(`Successfully uploaded and indexed ${file.name}!`);
        this.state.loadDatasets();
        this.state.setSelectedDataset(summary);
      },
      error: (err) => {
        this.uploadStatus.set(`Error uploading file: ${err.message || 'Unknown error'}`);
      }
    });
  }

  generatePreset(lines: number): void {
    this.genLineCount = lines;
    this.generateCustom();
  }

  generateCustom(): void {
    this.isGenerating.set(true);
    const name = this.genName.trim() || `k8s-cluster-${Date.now()}.log`;
    this.api.generateSample(name, this.genLineCount).subscribe({
      next: (summary) => {
        this.isGenerating.set(false);
        this.state.loadDatasets();
        this.state.setSelectedDataset(summary);
      },
      error: (err) => {
        this.isGenerating.set(false);
        alert('Failed to generate sample logs: ' + err.message);
      }
    });
  }

  getLevelEntries(dist: Record<string, number>): { key: string; value: number }[] {
    if (!dist) return [];
    return Object.entries(dist).map(([key, value]) => ({ key, value }));
  }

  formatLogHighlight(line: string): string {
    if (!line) return '';
    return line
      .replace(/\b(ERROR|FATAL|CRITICAL)\b/g, '<span class="text-rose-400 font-bold bg-rose-950/40 px-1 rounded">$1</span>')
      .replace(/\b(WARN|WARNING)\b/g, '<span class="text-amber-400 font-bold bg-amber-950/40 px-1 rounded">$1</span>')
      .replace(/\b(INFO|DEBUG)\b/g, '<span class="text-cyan-400 font-bold">$1</span>')
      .replace(/(\[.*?service.*?\])/gi, '<span class="text-indigo-400">$1</span>');
  }
}
