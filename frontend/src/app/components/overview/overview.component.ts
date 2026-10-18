import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { StateService } from '../../services/state.service';

@Component({
  selector: 'app-overview',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="app-container section-spacing flex flex-col gap-8">
      
      <!-- Clean Hero Section -->
      <section class="panel-elevated" style="padding: 2.5rem; background: #ffffff; border-radius: 24px;">
        <div class="grid grid-cols-2 gap-8 items-center">
          
          <!-- Left Column -->
          <div class="flex flex-col gap-4">
            
            <h1 class="heading-hero" style="font-size: 2.75rem; color: #0f172a; line-height: 1.2;">
              Searchable Compression of Cloud/Kubernetes Logs
            </h1>

            <p class="lead-text" style="color: #475569; font-size: 1.05rem;">
              Compress cloud log files into discrete blocks using Gain-Gated Shared-Dictionary Block DEFLATE with integrated search indexing.
              Our cost-aware algorithm evaluates marginal compression gains G(p | S) &gt; 0 to eliminate the small-block cold-start penalty while decoding only candidate blocks during searches.
            </p>

            <!-- Action Buttons -->
            <div class="flex items-center gap-3 flex-wrap" style="margin-top: 0.75rem;">
              <button (click)="state.setTab('upload')" class="btn btn-primary btn-lg">
                <span>Upload Logs</span>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                  <polyline points="17 8 12 3 7 8"></polyline>
                  <line x1="12" y1="3" x2="12" y2="15"></line>
                </svg>
              </button>

              <button (click)="state.setTab('search')" class="btn btn-blue btn-lg">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                  <circle cx="11" cy="11" r="8"></circle>
                  <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                </svg>
                <span>Search Logs</span>
              </button>

              <button (click)="state.setTab('results')" class="btn btn-outline btn-lg">
                <span>View Results</span>
              </button>
            </div>

          </div>

          <!-- Right Column: Visual Picture -->
          <div class="media-card" style="aspect-ratio: 4/3; max-height: 420px; box-shadow: var(--shadow-lg);">
            <img 
              src="assets/k8s-cloud-hero.jpg" 
              alt="Kubernetes Log Compression Illustration"
              loading="eager" />
          </div>

        </div>
      </section>

      <!-- How Selective Search Works & Visual Diagram -->
      <section class="panel" style="padding: 2.25rem; background: #ffffff;">
        <div class="flex flex-col gap-6">
          
          <div>
            <h2 class="heading-section" style="font-size: 1.75rem;">How Selective Search Works</h2>
            <p class="text-muted text-sm" style="margin-top: 0.25rem;">
              The search index locates candidate blocks, decoding only matching data while skipping irrelevant blocks.
            </p>
          </div>

          <!-- Infographic Illustration -->
          <div class="media-card" style="border-radius: 16px; overflow: hidden; border: 1px solid var(--border-light);">
            <img 
              src="assets/selective-search-diagram.jpg" 
              alt="Selective Search Diagram: Only Matching Blocks Decoded"
              loading="lazy" />
          </div>

          <!-- Three Short Steps -->
          <div class="grid grid-cols-3 gap-6" style="margin-top: 0.5rem;">
            
            <div class="metric-box" style="padding: 1.5rem;">
              <span style="font-size: 0.8125rem; font-weight: 700; color: #2563eb;">STEP 1</span>
              <h3 class="heading-sub" style="font-size: 1.1rem; margin-top: 0.25rem;">Upload Logs</h3>
              <p class="text-xs text-muted" style="margin-top: 0.35rem; line-height: 1.6;">
                Select a log file or generate synthetic cluster logs for testing.
              </p>
            </div>

            <div class="metric-box" style="padding: 1.5rem;">
              <span style="font-size: 0.8125rem; font-weight: 700; color: #059669;">STEP 2</span>
              <h3 class="heading-sub" style="font-size: 1.1rem; margin-top: 0.25rem;">Search Logs</h3>
              <p class="text-xs text-muted" style="margin-top: 0.35rem; line-height: 1.6;">
                Search any word, phrase, ID, status code, or timestamp to decode only matching blocks.
              </p>
            </div>

            <div class="metric-box" style="padding: 1.5rem;">
              <span style="font-size: 0.8125rem; font-weight: 700; color: #7c3aed;">STEP 3</span>
              <h3 class="heading-sub" style="font-size: 1.1rem; margin-top: 0.25rem;">View Results</h3>
              <p class="text-xs text-muted" style="margin-top: 0.35rem; line-height: 1.6;">
                Review matching records, space saved, and search efficiency against worst-case baseline (RLE) and sequential scans.
              </p>
            </div>

          </div>

        </div>
      </section>

    </div>
  `
})
export class OverviewComponent {
  state = inject(StateService);
}
