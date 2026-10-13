import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BlockSummary } from '../../models/compression.model';

@Component({
  selector: 'app-block-grid',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="flex flex-col gap-4">
      
      <!-- Legend Bar -->
      <div class="flex items-center justify-between flex-wrap gap-3 legend-bar">
        <div class="flex items-center gap-4 text-xs font-medium">
          <div *ngIf="isSearchMode" class="flex items-center gap-2">
            <span class="legend-indicator" style="background: #ecfdf5; border-color: #10b981;"></span>
            <span style="font-weight: 700; color: #059669;">Decoded Candidate Block</span>
          </div>
          <div *ngIf="isSearchMode" class="flex items-center gap-2">
            <span class="legend-indicator" style="background: #f8fafc; border-color: #e2e8f0;"></span>
            <span style="color: #64748b;">Skipped Block (0 Bytes Read)</span>
          </div>
          <div *ngIf="!isSearchMode" class="flex items-center gap-2">
            <span class="legend-indicator" style="background: #eff6ff; border-color: #3b82f6;"></span>
            <span style="font-weight: 700; color: #2563eb;">Compressed Block</span>
          </div>
        </div>

        <div class="text-mono text-xs text-muted">
          Total: <strong style="color: #0f172a;">{{ blocks.length }} Blocks</strong>
          <span *ngIf="isSearchMode && activeBlockIds">
            &bull; Decoded: <strong style="color: #059669;">{{ activeBlockIds.length }}</strong>
            &bull; Skipped: <strong style="color: #64748b;">{{ blocks.length - activeBlockIds.length }}</strong>
          </span>
        </div>
      </div>

      <!-- Blocks Grid -->
      <div class="grid-blocks-container">
        <div
          *ngFor="let b of blocks"
          (click)="selectBlock(b)"
          [class.decoded]="isSearchMode && isCandidate(b.block_id)"
          [class.skipped]="isSearchMode && !isCandidate(b.block_id)"
          [class.selected]="selectedBlock?.block_id === b.block_id"
          class="block-card">
          
          <div class="flex items-center justify-between">
            <span class="text-mono font-bold" style="font-size: 0.8125rem; color: #0f172a;">#{{ b.block_id }}</span>
            <span
              *ngIf="isSearchMode"
              [style.color]="isCandidate(b.block_id) ? '#059669' : '#94a3b8'"
              class="text-mono"
              style="font-size: 0.65rem; font-weight: 800; letter-spacing: 0.05em;">
              {{ isCandidate(b.block_id) ? 'DECODED' : 'SKIP' }}
            </span>
            <span *ngIf="!isSearchMode" class="text-mono font-bold" style="font-size: 0.75rem; color: #2563eb;">
              {{ b.ratio }}&times;
            </span>
          </div>

          <div style="font-size: 0.6875rem; margin-top: 0.35rem;" class="flex flex-col gap-0.5 text-muted text-mono">
            <div>Lines {{ b.start_line }}&ndash;{{ b.end_line }}</div>
            <div>{{ b.compressed_bytes }}B / {{ b.uncompressed_bytes }}B</div>
          </div>
        </div>
      </div>

      <!-- Selected Block Detail Card -->
      <div *ngIf="selectedBlock" class="panel flex items-center justify-between flex-wrap gap-4 text-mono text-xs" style="background: #ffffff; border: 1.5px solid #2563eb; padding: 1.25rem;">
        <div class="flex items-center gap-3">
          <div style="width: 36px; height: 36px; border-radius: 10px; background: #0f172a; color: #ffffff; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 0.875rem;">
            #{{ selectedBlock.block_id }}
          </div>
          <div>
            <div style="font-weight: 700; color: #0f172a; font-size: 0.875rem;">Compressed Block #{{ selectedBlock.block_id }} Details</div>
            <div class="text-muted" style="font-size: 0.75rem;">Span: Lines {{ selectedBlock.start_line }} to {{ selectedBlock.end_line }} ({{ selectedBlock.line_count }} lines)</div>
          </div>
        </div>

        <div class="flex items-center gap-6">
          <div>Raw: <strong style="color: #0f172a;">{{ selectedBlock.uncompressed_bytes }} B</strong></div>
          <div>Compressed: <strong style="color: #2563eb;">{{ selectedBlock.compressed_bytes }} B</strong></div>
          <div>Ratio: <strong style="color: #059669;">{{ selectedBlock.ratio }}&times;</strong></div>
          <div *ngIf="isSearchMode">
            Status: 
            <strong [style.color]="isCandidate(selectedBlock.block_id) ? '#059669' : '#64748b'">
              {{ isCandidate(selectedBlock.block_id) ? 'DECODED (TARGET CANDIDATE)' : 'SKIPPED (0 BYTES READ)' }}
            </strong>
          </div>
        </div>

        <button (click)="selectedBlock = null" class="btn btn-outline btn-sm">
          Close
        </button>
      </div>

    </div>
  `,
  styles: [`
    .legend-bar {
      background: #ffffff;
      border: 1px solid var(--border-light);
      padding: 0.75rem 1.25rem;
      border-radius: var(--radius-md);
    }
    .legend-indicator {
      width: 14px;
      height: 14px;
      border-radius: 4px;
      border-width: 1.5px;
      border-style: solid;
      display: inline-block;
    }
    .grid-blocks-container {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(135px, 1fr));
      gap: 0.75rem;
      max-height: 380px;
      overflow-y: auto;
      padding: 4px;
    }
    .block-card {
      background: #ffffff;
      border: 1.5px solid var(--border-light);
      border-radius: var(--radius-md);
      padding: 0.75rem;
      cursor: pointer;
      transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
      box-shadow: 0 1px 2px rgba(0, 0, 0, 0.03);
    }
    .block-card:hover {
      border-color: #94a3b8;
      transform: translateY(-2px);
      box-shadow: 0 4px 10px rgba(0, 0, 0, 0.05);
    }
    .block-card.decoded {
      background: #ecfdf5;
      border-color: #10b981;
      box-shadow: 0 2px 8px rgba(16, 185, 129, 0.15);
    }
    .block-card.skipped {
      background: #fafbfc;
      border-color: #e2e8f0;
      opacity: 0.7;
    }
    .block-card.skipped:hover {
      opacity: 1;
      background: #ffffff;
    }
    .block-card.selected {
      border-color: #0f172a;
      border-width: 2px;
      box-shadow: 0 4px 12px rgba(15, 23, 42, 0.12);
    }
  `]
})
export class BlockGridComponent {
  @Input() blocks: BlockSummary[] = [];
  @Input() isSearchMode = false;
  @Input() activeBlockIds: number[] = [];
  @Output() blockClicked = new EventEmitter<BlockSummary>();

  selectedBlock: BlockSummary | null = null;

  isCandidate(blockId: number): boolean {
    return this.activeBlockIds.includes(blockId);
  }

  selectBlock(block: BlockSummary): void {
    this.selectedBlock = block;
    this.blockClicked.emit(block);
  }
}
