import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BlockSummary } from '../../models/compression.model';

@Component({
  selector: 'app-block-grid',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="space-y-4">
      
      <!-- Legend -->
      <div class="flex flex-wrap items-center justify-between gap-4 p-3 bg-slate-900/60 rounded-xl border border-slate-800 text-xs">
        <div class="flex items-center gap-4 flex-wrap font-medium">
          <div *ngIf="isSearchMode" class="flex items-center gap-2">
            <span class="w-3.5 h-3.5 rounded bg-emerald-500/20 border-2 border-emerald-400 inline-block"></span>
            <span class="text-emerald-300 font-semibold">Decoded Block (Matched Query)</span>
          </div>
          <div *ngIf="isSearchMode" class="flex items-center gap-2">
            <span class="w-3.5 h-3.5 rounded bg-slate-800 border border-slate-700 inline-block opacity-60"></span>
            <span class="text-slate-400">Skipped Block (Zero Decompression)</span>
          </div>
          <div *ngIf="!isSearchMode" class="flex items-center gap-2">
            <span class="w-3.5 h-3.5 rounded bg-cyan-500/20 border-2 border-cyan-400 inline-block"></span>
            <span class="text-cyan-300 font-semibold">Indexed Block (LZ78 + Huffman)</span>
          </div>
        </div>

        <div class="text-slate-400 font-mono text-[11px]">
          Total Blocks: <strong class="text-white">{{ blocks.length }}</strong>
          <span *ngIf="isSearchMode && activeBlockIds">
            &bull; Decoded: <strong class="text-emerald-400">{{ activeBlockIds.length }}</strong>
            &bull; Skipped: <strong class="text-slate-300">{{ blocks.length - activeBlockIds.length }}</strong>
          </span>
        </div>
      </div>

      <!-- Blocks Grid -->
      <div class="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2.5 max-h-[380px] overflow-y-auto p-1">
        <div
          *ngFor="let b of blocks"
          (click)="selectBlock(b)"
          [class.block-candidate]="isSearchMode && isCandidate(b.block_id)"
          [class.block-bypassed]="isSearchMode && !isCandidate(b.block_id)"
          [class.block-normal]="!isSearchMode"
          [class.block-selected]="selectedBlock?.block_id === b.block_id"
          class="block-card p-2.5 rounded-xl border transition-all cursor-pointer relative overflow-hidden flex flex-col justify-between">
          
          <div class="flex items-center justify-between">
            <span class="font-mono text-xs font-bold">#{{ b.block_id }}</span>
            <span
              *ngIf="isSearchMode"
              [class.text-emerald-400]="isCandidate(b.block_id)"
              [class.text-slate-500]="!isCandidate(b.block_id)"
              class="text-[9px] font-mono uppercase font-extrabold">
              {{ isCandidate(b.block_id) ? 'DECODED' : 'SKIPPED' }}
            </span>
            <span *ngIf="!isSearchMode" class="text-[10px] font-mono text-cyan-400">
              {{ b.ratio }}x
            </span>
          </div>

          <div class="mt-2 font-mono text-[10px] space-y-0.5">
            <div class="text-slate-400 truncate">L{{ b.start_line }}-{{ b.end_line }}</div>
            <div class="text-slate-500 truncate">{{ b.compressed_bytes }}B / {{ b.uncompressed_bytes }}B</div>
          </div>
        </div>
      </div>

      <!-- Selected Block Detail Popover/Drawer -->
      <div *ngIf="selectedBlock" class="p-4 rounded-xl bg-slate-900 border border-cyan-500/30 flex flex-wrap items-center justify-between gap-4 font-mono text-xs">
        <div class="flex items-center gap-3">
          <div class="w-8 h-8 rounded-lg bg-cyan-500/20 text-cyan-400 font-bold flex items-center justify-center">
            #{{ selectedBlock.block_id }}
          </div>
          <div>
            <div class="font-bold text-white">Block #{{ selectedBlock.block_id }} Details</div>
            <div class="text-slate-400 text-[11px]">Span: Lines {{ selectedBlock.start_line }} to {{ selectedBlock.end_line }} ({{ selectedBlock.line_count }} lines)</div>
          </div>
        </div>

        <div class="flex items-center gap-6 text-slate-300">
          <div>Uncompressed: <strong class="text-white">{{ selectedBlock.uncompressed_bytes }} B</strong></div>
          <div>Compressed: <strong class="text-cyan-400">{{ selectedBlock.compressed_bytes }} B</strong></div>
          <div>Ratio: <strong class="text-emerald-400">{{ selectedBlock.ratio }}x</strong></div>
          <div *ngIf="isSearchMode">
            Status: 
            <strong [class.text-emerald-400]="isCandidate(selectedBlock.block_id)" [class.text-slate-400]="!isCandidate(selectedBlock.block_id)">
              {{ isCandidate(selectedBlock.block_id) ? 'DECODED' : 'SKIPPED FROM DECOMPRESSION' }}
            </strong>
          </div>
        </div>

        <button (click)="selectedBlock = null" class="text-slate-500 hover:text-white text-xs">
          ✕ Close
        </button>
      </div>

    </div>
  `,
  styles: [`
    .block-card {
      min-height: 72px;
      background: rgba(15, 23, 42, 0.7);
    }
    .block-normal {
      border-color: rgba(255, 255, 255, 0.1);
      color: #e2e8f0;
    }
    .block-normal:hover {
      border-color: rgba(6, 182, 212, 0.5);
      background: rgba(6, 182, 212, 0.05);
      transform: translateY(-2px);
    }
    .block-candidate {
      background: rgba(16, 185, 129, 0.12) !important;
      border: 1.5px solid #10b981 !important;
      color: #34d399 !important;
      box-shadow: 0 0 12px rgba(16, 185, 129, 0.25);
    }
    .block-bypassed {
      opacity: 0.35;
      border-color: rgba(255, 255, 255, 0.05);
      color: #64748b;
    }
    .block-bypassed:hover {
      opacity: 0.7;
    }
    .block-selected {
      border-color: #38bdf8 !important;
      box-shadow: 0 0 15px rgba(56, 189, 248, 0.4) !important;
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
