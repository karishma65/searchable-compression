import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { StateService } from '../../services/state.service';
import { DatasetSummary } from '../../models/dataset.model';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [CommonModule],
  template: `
    <header class="navbar-wrapper">
      <div class="app-container navbar-layout">
        
        <!-- Far Left: Logo -->
        <div class="brand-box" (click)="state.setTab('home')">
          <div class="brand-badge">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242"></path>
              <path d="M12 12v9"></path>
              <path d="m8 17 4 4 4-4"></path>
            </svg>
          </div>
          <span class="brand-title">LogZip</span>
        </div>

        <!-- Center: Project Title -->
        <div class="center-title-container">
          <h1 class="project-title-center">Searchable Compression of Cloud/Kubernetes Logs</h1>
        </div>

        <!-- Right Side: Navigation Tabs & Active File -->
        <div class="nav-right-container">
          <nav class="nav-pill-group">
            <button
              (click)="state.setTab('home')"
              [class.active]="state.activeTab() === 'home'"
              class="nav-tab-btn">
              Home
            </button>
            <button
              (click)="state.setTab('upload')"
              [class.active]="state.activeTab() === 'upload'"
              class="nav-tab-btn">
              Upload Logs
            </button>
            <button
              (click)="state.setTab('search')"
              [class.active]="state.activeTab() === 'search'"
              class="nav-tab-btn">
              Search Logs
            </button>
            <button
              (click)="state.setTab('results')"
              [class.active]="state.activeTab() === 'results'"
              class="nav-tab-btn">
              Results
            </button>
          </nav>

          <!-- Current Log File Picker -->
          <div *ngIf="state.datasets().length > 0" class="file-picker-pill">
            <span class="text-xs text-muted">File:</span>
            <select
              [value]="state.selectedDatasetName()"
              (change)="onDatasetChange($event)"
              class="file-select">
              <option *ngFor="let d of state.datasets()" [value]="d.name">
                {{ d.name }}
              </option>
            </select>
          </div>
        </div>

      </div>
    </header>
  `,
  styles: [`
    .navbar-wrapper {
      background: #ffffff;
      border-bottom: 1px solid var(--border-light);
      position: sticky;
      top: 0;
      z-index: 100;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
    }
    .navbar-layout {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding-top: 0.85rem;
      padding-bottom: 0.85rem;
      gap: 1.5rem;
    }
    .brand-box {
      display: flex;
      align-items: center;
      gap: 0.65rem;
      cursor: pointer;
      user-select: none;
      flex-shrink: 0;
    }
    .brand-badge {
      width: 36px;
      height: 36px;
      border-radius: 10px;
      background: #0f172a;
      color: #ffffff;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .brand-title {
      font-weight: 800;
      font-size: 1.15rem;
      color: #0f172a;
      letter-spacing: -0.02em;
    }
    .center-title-container {
      flex: 1;
      text-align: center;
      padding: 0 0.5rem;
    }
    .project-title-center {
      font-size: 1.05rem;
      font-weight: 700;
      color: #0f172a;
      letter-spacing: -0.015em;
      margin: 0;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .nav-right-container {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      flex-shrink: 0;
    }
    .nav-pill-group {
      display: flex;
      align-items: center;
      background: var(--bg-subtle);
      padding: 0.25rem;
      border-radius: var(--radius-pill);
      border: 1px solid var(--border-light);
      gap: 0.2rem;
    }
    .nav-tab-btn {
      padding: 0.4rem 1rem;
      font-size: 0.875rem;
      font-weight: 600;
      color: var(--text-secondary);
      border-radius: var(--radius-pill);
      border: none;
      background: transparent;
      cursor: pointer;
      transition: all 0.15s ease;
      font-family: var(--font-main);
    }
    .nav-tab-btn:hover {
      color: var(--text-primary);
    }
    .nav-tab-btn.active {
      background: #ffffff;
      color: var(--text-primary);
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
    }
    .file-picker-pill {
      display: flex;
      align-items: center;
      gap: 0.35rem;
      background: #ffffff;
      border: 1px solid var(--border-light);
      padding: 0.35rem 0.75rem;
      border-radius: var(--radius-pill);
      font-size: 0.8125rem;
    }
    .file-select {
      background: transparent;
      border: none;
      outline: none;
      font-weight: 600;
      color: var(--text-primary);
      cursor: pointer;
      font-size: 0.8125rem;
      max-width: 170px;
    }
    @media (max-width: 992px) {
      .project-title-center {
        display: none;
      }
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
