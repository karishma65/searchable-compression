import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { StateService } from '../../services/state.service';

@Component({
  selector: 'app-overview',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="space-y-10 py-6 max-w-7xl mx-auto px-4 sm:px-6">
      
      <!-- Hero Section -->
      <div class="glass-card p-8 relative overflow-hidden border border-cyan-500/20">
        <div class="absolute -right-20 -top-20 w-80 h-80 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none"></div>
        <div class="absolute -left-20 -bottom-20 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none"></div>

        <div class="max-w-3xl space-y-4 relative z-10">
          <div class="flex items-center gap-2">
            <span class="badge badge-info">Advanced Data Compression Research</span>
            <span class="badge badge-purple">Cloud & Kubernetes Workloads</span>
          </div>
          <h1 class="text-3xl sm:text-4xl font-extrabold tracking-tight text-white leading-tight">
            Searchable Compression of Cloud/Kubernetes Logs Using 
            <span class="gradient-text"> LZ78 and Huffman Coding</span>
          </h1>
          <p class="text-slate-300 text-base leading-relaxed">
            Investigating selective decompression for cloud observability: Can a block-partitioned 
            hybrid of <strong>LZ78 dictionary compression</strong> and <strong>Huffman entropy coding</strong> 
            coupled with an <strong>inverted block index</strong> provide robust compression while enabling 
            lightning-fast log search without decompressing the entire log archive?
          </p>

          <div class="flex flex-wrap gap-3 pt-3">
            <button (click)="state.setTab('experiment')" class="btn btn-cyan">
              <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Run Compression Experiment
            </button>
            <button (click)="state.setTab('search')" class="btn btn-secondary">
              <svg class="w-4 h-4 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              Demo Selective Search
            </button>
            <button (click)="state.setTab('datasets')" class="btn btn-secondary">
              <svg class="w-4 h-4 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
              Upload / Generate Logs
            </button>
          </div>
        </div>
      </div>

      <!-- Core Paradigm Comparison: Gzip vs Proposed Method -->
      <div class="space-y-4">
        <div class="flex items-center justify-between">
          <div>
            <h2 class="text-xl font-bold text-white">The Core Research Difference</h2>
            <p class="text-xs text-slate-400">Why selective block decoding fundamentally outclasses stream decompression</p>
          </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          <!-- Conventional Gzip flow -->
          <div class="glass-card p-6 border-l-4 border-l-amber-500 space-y-4">
            <div class="flex items-center justify-between">
              <span class="text-xs font-mono font-bold text-amber-400 tracking-wider">CONVENTIONAL SEARCH (GZIP / LZ78)</span>
              <span class="badge badge-warn">100% Decompressed</span>
            </div>
            <h3 class="text-lg font-bold text-slate-200">Full Archive Decompression</h3>
            <p class="text-xs text-slate-400">
              When querying for <code class="text-amber-300 font-mono">ERROR + database-service + timeout</code> in a 10 GB compressed archive, standard Gzip DEFLATE or continuous LZ78 stream cannot locate content offsets without decompressing from byte 0 to EOF.
            </p>

            <div class="p-3 bg-slate-900/80 rounded-lg border border-amber-500/20 font-mono text-xs space-y-1.5">
              <div class="text-slate-400">1. Query submitted: <span class="text-amber-300 font-semibold">"database-service timeout"</span></div>
              <div class="text-rose-400">2. CPU must decompress 100% of compressed archive blocks</div>
              <div class="text-rose-400">3. High memory allocation to hold decompressed payload</div>
              <div class="text-amber-400">4. Sequential string regex scan on entire uncompressed file</div>
            </div>

            <div class="flex items-center gap-4 text-xs text-slate-400 pt-2 border-t border-[var(--border-subtle)]">
              <div>Blocks Decoded: <strong class="text-rose-400">All (100%)</strong></div>
              <div>Data Decoded: <strong class="text-rose-400">100%</strong></div>
              <div>I/O Overhead: <strong class="text-rose-400">Maximum</strong></div>
            </div>
          </div>

          <!-- Proposed Block-Based Selective flow -->
          <div class="glass-card p-6 border-l-4 border-l-cyan-500 space-y-4 shadow-lg shadow-cyan-500/5">
            <div class="flex items-center justify-between">
              <span class="text-xs font-mono font-bold text-cyan-400 tracking-wider">PROPOSED RESEARCH PARADIGM</span>
              <span class="badge badge-info">Selective Decoding</span>
            </div>
            <h3 class="text-lg font-bold text-slate-200">Block LZ78 + Huffman + Inverted Index</h3>
            <p class="text-xs text-slate-400">
              Logs are partitioned into discrete chunks (<span class="text-cyan-300 font-mono">k</span> lines). An inverted search index maintains token-to-block postings. The query intersects posting sets and decodes <em>only</em> candidate blocks.
            </p>

            <div class="p-3 bg-slate-900/80 rounded-lg border border-cyan-500/20 font-mono text-xs space-y-1.5">
              <div class="text-slate-400">1. Query submitted: <span class="text-cyan-300 font-semibold">"database-service timeout"</span></div>
              <div class="text-cyan-400">2. Inverted index identifies Candidate Blocks: <span class="text-white bg-cyan-900/50 px-1 py-0.5 rounded">[Block #3, Block #7]</span></div>
              <div class="text-emerald-400">3. Selective decode: Huffman -> LZ78 for ONLY #3 and #7</div>
              <div class="text-emerald-400">4. Non-matching blocks (#0, #1, #2, #4, #5, #6...) completely SKIPPED!</div>
            </div>

            <div class="flex items-center gap-4 text-xs text-slate-400 pt-2 border-t border-[var(--border-subtle)]">
              <div>Blocks Decoded: <strong class="text-emerald-400">Only Relevant</strong></div>
              <div>Data Decoded: <strong class="text-emerald-400">~5% - 15%</strong></div>
              <div>Savings: <strong class="text-emerald-400">85%+ Bypassed</strong></div>
            </div>
          </div>

        </div>
      </div>

      <!-- Visual Pipeline Architecture -->
      <div class="glass-card p-6 space-y-6">
        <div>
          <h2 class="text-xl font-bold text-white">Proposed Compression Pipeline</h2>
          <p class="text-xs text-slate-400">End-to-end two-stage compression and indexing data flow</p>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 relative">
          
          <!-- Stage 1 -->
          <div class="p-4 rounded-xl bg-slate-900/90 border border-slate-700/60 space-y-2 relative">
            <div class="text-xs font-mono text-cyan-400 font-bold">STAGE 01</div>
            <div class="text-sm font-bold text-white">Log Partitioning</div>
            <p class="text-xs text-slate-400">Incoming K8s log file is chunked into discrete blocks of <span class="text-slate-200 font-mono">k</span> lines (e.g. 100 lines/block).</p>
            <div class="text-[11px] font-mono text-slate-500 pt-1">Chunk: Block #i</div>
          </div>

          <!-- Stage 2 -->
          <div class="p-4 rounded-xl bg-slate-900/90 border border-indigo-500/40 space-y-2">
            <div class="text-xs font-mono text-indigo-400 font-bold">STAGE 02</div>
            <div class="text-sm font-bold text-white">Inverted Indexing</div>
            <p class="text-xs text-slate-400">Tokenizes log messages, pod names, levels, and services. Maps tokens to Block IDs in memory.</p>
            <div class="text-[11px] font-mono text-indigo-300 pt-1">Term &rarr; &#123;Block IDs&#125;</div>
          </div>

          <!-- Stage 3 -->
          <div class="p-4 rounded-xl bg-slate-900/90 border border-cyan-500/40 space-y-2">
            <div class="text-xs font-mono text-cyan-400 font-bold">STAGE 03</div>
            <div class="text-sm font-bold text-white">LZ78 Dictionary</div>
            <p class="text-xs text-slate-400">Runs authentic LZ78 dictionary compression per block, producing <span class="text-cyan-300 font-mono">(index, char)</span> tokens.</p>
            <div class="text-[11px] font-mono text-cyan-300 pt-1">Repetitive logs &rarr; Tokens</div>
          </div>

          <!-- Stage 4 -->
          <div class="p-4 rounded-xl bg-slate-900/90 border border-emerald-500/40 space-y-2">
            <div class="text-xs font-mono text-emerald-400 font-bold">STAGE 04</div>
            <div class="text-sm font-bold text-white">Huffman Entropy</div>
            <p class="text-xs text-slate-400">Builds frequency tree of LZ78 tokens, emitting variable-length prefix bitstreams per block.</p>
            <div class="text-[11px] font-mono text-emerald-300 pt-1">Bit-level packing</div>
          </div>

          <!-- Stage 5 -->
          <div class="p-4 rounded-xl bg-slate-900/90 border border-purple-500/40 space-y-2">
            <div class="text-xs font-mono text-purple-400 font-bold">OUTPUT</div>
            <div class="text-sm font-bold text-white">Searchable Archive</div>
            <p class="text-xs text-slate-400">Stores independent compressed blocks + lightweight inverted index ready for selective search.</p>
            <div class="text-[11px] font-mono text-purple-300 pt-1">Selective Query Ready</div>
          </div>

        </div>
      </div>

      <!-- Methods to Compare Grid -->
      <div class="space-y-4">
        <div>
          <h2 class="text-xl font-bold text-white">Benchmark Comparison Methods</h2>
          <p class="text-xs text-slate-400">The four evaluation baselines implemented in this research study</p>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          
          <div class="glass-card p-5 space-y-3 border-t-2 border-t-rose-500">
            <div class="flex items-center justify-between">
              <span class="text-xs font-bold text-rose-400 font-mono">BASELINE 1</span>
              <span class="badge badge-error text-[10px]">Ratio: 1.0x</span>
            </div>
            <h3 class="text-base font-bold text-white">Raw / Uncompressed</h3>
            <p class="text-xs text-slate-400 leading-relaxed">
              Standard plaintext logs. Zero compute overhead for writing, but highest disk footprint and full sequential I/O scan required for searching.
            </p>
            <div class="text-xs text-slate-500 pt-2 border-t border-[var(--border-subtle)]">
              Selective Search: <span class="text-rose-400 font-semibold">No (Reads 100%)</span>
            </div>
          </div>

          <div class="glass-card p-5 space-y-3 border-t-2 border-t-amber-500">
            <div class="flex items-center justify-between">
              <span class="text-xs font-bold text-amber-400 font-mono">BASELINE 2</span>
              <span class="badge badge-warn text-[10px]">Dictionary</span>
            </div>
            <h3 class="text-base font-bold text-white">LZ78 Baseline</h3>
            <p class="text-xs text-slate-400 leading-relaxed">
              Global sliding dictionary LZ78 applied over the entire log file. Excellent for repeating phrases, but search requires decoding from token 0.
            </p>
            <div class="text-xs text-slate-500 pt-2 border-t border-[var(--border-subtle)]">
              Selective Search: <span class="text-rose-400 font-semibold">No (Full Stream)</span>
            </div>
          </div>

          <div class="glass-card p-5 space-y-3 border-t-2 border-t-indigo-500">
            <div class="flex items-center justify-between">
              <span class="text-xs font-bold text-indigo-400 font-mono">BASELINE 3</span>
              <span class="badge badge-purple text-[10px]">Industry Std</span>
            </div>
            <h3 class="text-base font-bold text-white">Gzip Baseline</h3>
            <p class="text-xs text-slate-400 leading-relaxed">
              Standard DEFLATE (LZ77 + Huffman) over the full log stream. Provides industry reference compression, but lacks indexing and selective decoding.
            </p>
            <div class="text-xs text-slate-500 pt-2 border-t border-[var(--border-subtle)]">
              Selective Search: <span class="text-rose-400 font-semibold">No (Full Decomp)</span>
            </div>
          </div>

          <div class="glass-card p-5 space-y-3 border-t-2 border-t-cyan-500 shadow-lg shadow-cyan-500/10">
            <div class="flex items-center justify-between">
              <span class="text-xs font-bold text-cyan-400 font-mono">PROPOSED</span>
              <span class="badge badge-info text-[10px]">Hybrid</span>
            </div>
            <h3 class="text-base font-bold text-white">Block LZ78 + Huffman</h3>
            <p class="text-xs text-slate-400 leading-relaxed">
              Proposed block-partitioned LZ78 dictionary + secondary Huffman entropy bitstream with token inverted index. Enables instant selective decoding.
            </p>
            <div class="text-xs text-slate-500 pt-2 border-t border-[var(--border-subtle)]">
              Selective Search: <span class="text-emerald-400 font-semibold">Yes (Target Blocks)</span>
            </div>
          </div>

        </div>
      </div>

    </div>
  `
})
export class OverviewComponent {
  state = inject(StateService);
}
