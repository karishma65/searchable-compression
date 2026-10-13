import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { StateService } from '../../services/state.service';
import { DatasetSummary } from '../../models/dataset.model';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [CommonModule],
  template: `
    <header class="border-b border-[var(--border-subtle)] bg-[#0b0f19]/90 backdrop-blur-md sticky top-0 z-50">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-4">
        
        <!-- Brand / Title -->
        <div class="flex items-center gap-3 cursor-pointer" (click)="state.setTab('overview')">
          <div class="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 via-indigo-600 to-purple-600 flex items-center justify-center shadow-lg shadow-cyan-500/20">
            <svg class="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
          </div>
          <div>
            <div class="flex items-center gap-2">
              <span class="font-extrabold text-base tracking-tight text-white">K8s-LogZip</span>
              <span class="badge badge-info text-[10px]">LZ78 + Huffman</span>
              <span class="badge badge-purple text-[10px]">Selective Search</span>
            </div>
            <p class="text-xs text-slate-400">Searchable Compression of Cloud/Kubernetes Logs</p>
          </div>
        </div>

        <!-- Navigation Tabs -->
        <nav class="flex items-center gap-1 bg-[#111827] p-1 rounded-xl border border-[var(--border-subtle)]">
          <button
            (click)="state.setTab('overview')"
            [class.nav-active]="state.activeTab() === 'overview'"
            class="nav-btn">
            Overview
          </button>
          <button
            (click)="state.setTab('datasets')"
            [class.nav-active]="state.activeTab() === 'datasets'"
            class="nav-btn">
            Upload & Logs
          </button>
          <button
            (click)="state.setTab('experiment')"
            [class.nav-active]="state.activeTab() === 'experiment'"
            class="nav-btn">
            Compression
          </button>
          <button
            (click)="state.setTab('search')"
            [class.nav-active]="state.activeTab() === 'search'"
            class="nav-btn">
            Selective Search
          </button>
          <button
            (click)="state.setTab('comparison')"
            [class.nav-active]="state.activeTab() === 'comparison'"
            class="nav-btn">
            Metrics & Trade-offs
          </button>
        </nav>

        <!-- Right Side: Active Dataset & Backend Health -->
        <div class="flex items-center gap-3">
          <!-- Dataset Selector -->
          <div class="flex items-center gap-2 bg-[#111827] px-3 py-1.5 rounded-lg border border-[var(--border-subtle)] text-xs">
            <span class="text-slate-400">Dataset:</span>
            <select
              [value]="state.selectedDatasetName()"
              (change)="onDatasetChange($event)"
              class="bg-transparent text-cyan-400 font-semibold focus:outline-none cursor-pointer">
              <option *ngFor="let d of state.datasets()" [value]="d.name" class="bg-[#111827] text-white">
                {{ d.name }} ({{ d.size_kb }} KB)
              </option>
            </select>
          </div>

          <!-- Backend Status Badge -->
          <div
            [class.bg-emerald-500/10]="state.backendConnected()"
            [class.border-emerald-500/30]="state.backendConnected()"
            [class.text-emerald-400]="state.backendConnected()"
            [class.bg-rose-500/10]="!state.backendConnected()"
            [class.border-rose-500/30]="!state.backendConnected()"
            [class.text-rose-400]="!state.backendConnected()"
            class="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-mono">
            <span
              [class.bg-emerald-400]="state.backendConnected()"
              [class.bg-rose-400]="!state.backendConnected()"
              class="w-2 h-2 rounded-full inline-block animate-pulse"></span>
            <span>{{ state.backendConnected() ? 'FastAPI 8000' : 'Disconnected' }}</span>
          </div>
        </div>

      </div>
    </header>
  `,
  styles: [`
    .nav-btn {
      padding: 0.4rem 0.85rem;
      font-size: 0.82rem;
      font-weight: 500;
      color: #94a3b8;
      border-radius: 8px;
      transition: all 0.2s;
      cursor: pointer;
      background: transparent;
      border: none;
    }
    .nav-btn:hover {
      color: #ffffff;
      background: rgba(255, 255, 255, 0.05);
    }
    .nav-active {
      color: #06b6d4 !important;
      background: rgba(6, 182, 212, 0.12) !important;
      font-weight: 600;
      border: 1px solid rgba(6, 182, 212, 0.3);
    }
  `]
})
export class NavbarComponent {
  state = inject(StateService);

  onDatasetChange(event: Event): void {
    const select = event.target as HTMLSelectElement;
    const found = this.state.datasets().find(d => d.name === select.value);
    if (found) {
      this.state.setSelectedDataset(found);
    }
  }
}
