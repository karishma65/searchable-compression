import { Injectable, signal, computed, inject } from '@angular/core';
import { ApiService } from './api.service';
import { DatasetSummary } from '../models/dataset.model';
import { ExperimentRecord } from '../models/compression.model';
import { SearchResponse } from '../models/search.model';

export type AppTab = 'home' | 'upload' | 'search' | 'results';

@Injectable({
  providedIn: 'root'
})
export class StateService {
  private api = inject(ApiService);

  activeTab = signal<AppTab>('home');
  backendConnected = signal<boolean>(false);
  datasets = signal<DatasetSummary[]>([]);
  selectedDataset = signal<DatasetSummary | null>(null);
  latestExperiment = signal<ExperimentRecord | null>(null);
  latestSearch = signal<SearchResponse | null>(null);
  isLoading = signal<boolean>(false);
  statusMessage = signal<string>('');

  selectedBlockSize = signal<number>(100);
  selectedDatasetName = computed(() => this.selectedDataset()?.name || '');

  constructor() {
    this.checkHealthAndLoad();
  }

  checkHealthAndLoad(): void {
    this.api.getHealth().subscribe({
      next: () => {
        this.backendConnected.set(true);
        this.loadDatasets();
      },
      error: () => {
        this.backendConnected.set(false);
      }
    });
  }

  loadDatasets(): void {
    this.api.getDatasets().subscribe({
      next: (list) => {
        this.datasets.set(list);
        if (list.length > 0 && !this.selectedDataset()) {
          this.selectedDataset.set(list[0]);
        }
      },
      error: (err) => console.error('Failed to load datasets', err)
    });
  }

  setSelectedDataset(dataset: DatasetSummary): void {
    if (this.selectedDataset()?.name !== dataset.name) {
      this.latestExperiment.set(null);
      this.latestSearch.set(null);
    }
    this.selectedDataset.set(dataset);
  }

  setSelectedBlockSize(size: number): void {
    if (this.selectedBlockSize() !== size) {
      this.selectedBlockSize.set(size);
      this.latestExperiment.set(null);
      this.latestSearch.set(null);
    }
  }

  setTab(tab: string): void {
    if (tab === 'overview' || tab === 'home') {
      this.activeTab.set('home');
    } else if (tab === 'datasets' || tab === 'upload') {
      this.activeTab.set('upload');
    } else if (tab === 'search') {
      this.activeTab.set('search');
    } else if (tab === 'experiment' || tab === 'comparison' || tab === 'results') {
      this.activeTab.set('results');
    }
  }
}
