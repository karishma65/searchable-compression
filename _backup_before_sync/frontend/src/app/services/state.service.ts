import { Injectable, signal, computed, inject } from '@angular/core';
import { ApiService } from './api.service';
import { DatasetSummary } from '../models/dataset.model';
import { ExperimentRecord } from '../models/compression.model';
import { SearchResponse } from '../models/search.model';

@Injectable({
  providedIn: 'root'
})
export class StateService {
  private api = inject(ApiService);

  activeTab = signal<'overview' | 'datasets' | 'experiment' | 'search' | 'comparison'>('overview');
  backendConnected = signal<boolean>(false);
  datasets = signal<DatasetSummary[]>([]);
  selectedDataset = signal<DatasetSummary | null>(null);
  latestExperiment = signal<ExperimentRecord | null>(null);
  latestSearch = signal<SearchResponse | null>(null);
  isLoading = signal<boolean>(false);
  statusMessage = signal<string>('');

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
    this.selectedDataset.set(dataset);
  }

  setTab(tab: 'overview' | 'datasets' | 'experiment' | 'search' | 'comparison'): void {
    this.activeTab.set(tab);
  }
}
