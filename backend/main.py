import time
import os
import sys
from typing import Optional, List, Dict, Any

_current_dir = os.path.dirname(os.path.abspath(__file__))
_project_root = os.path.abspath(os.path.join(_current_dir, ".."))
if _project_root not in sys.path:
    sys.path.insert(0, _project_root)
if _current_dir not in sys.path:
    sys.path.insert(0, _current_dir)

from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

try:
    from backend.datasets import DatasetManager
    from backend.compression.raw_compressor import RawCompressor
    from backend.compression.lz78 import LZ78Coder
    from backend.compression.gzip_compressor import GzipCompressor
    from backend.compression.block_manager import BlockCompressorManager
    from backend.indexing.log_parser import LogParser
except (ImportError, ModuleNotFoundError):
    from datasets import DatasetManager
    from compression.raw_compressor import RawCompressor
    from compression.lz78 import LZ78Coder
    from compression.gzip_compressor import GzipCompressor
    from compression.block_manager import BlockCompressorManager
    from indexing.log_parser import LogParser

app = FastAPI(
    title="Searchable Cloud/K8s Log Compression Research Engine",
    description="Evaluation of Block-based LZ78 + Huffman Coding with Inverted Index vs Baselines",
    version="2.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

dataset_manager = DatasetManager()
active_block_compressors: Dict[str, BlockCompressorManager] = {}
active_gzip_compressed: Dict[str, bytes] = {}
experiment_history: List[Dict[str, Any]] = []

class CompressRequest(BaseModel):
    dataset_name: str
    method: str = "all"
    block_size: int = 100

class SearchRequest(BaseModel):
    dataset_name: str
    query: str = ""
    block_size: Optional[int] = 100
    compare_with_baselines: bool = True

class GenerateSampleRequest(BaseModel):
    name: str = "k8s-cluster-bench.log"
    line_count: int = 1500

@app.get("/api/health")
def health_check():
    return {
        "status": "healthy",
        "service": "Searchable Compression Engine",
        "timestamp": time.time()
    }

@app.get("/api/methods")
def get_methods():
    return [
        {
            "id": "proposed",
            "name": "Proposed: Block LZ78 + Huffman + Search Index",
            "type": "Proposed Method",
            "description": "Partitioned blocks encoded via LZ78 and secondary Huffman entropy coding, indexed by inverted posting lists for selective block decompression.",
            "selective_search_support": True
        },
        {
            "id": "gzip",
            "name": "Standard Gzip Baseline",
            "type": "Industry Standard",
            "description": "Standard DEFLATE (LZ77 + Huffman) over entire log stream. High compression, but requires full archive decompression to search.",
            "selective_search_support": False
        },
        {
            "id": "raw",
            "name": "Raw / Uncompressed",
            "type": "Baseline",
            "description": "Sequential scan over raw plaintext byte stream. No storage savings, full disk I/O footprint.",
            "selective_search_support": False
        }
    ]

@app.get("/api/datasets")
def list_datasets():
    return dataset_manager.list_datasets()

@app.get("/api/datasets/{dataset_name}")
def get_dataset(dataset_name: str):
    data = dataset_manager.get_dataset(dataset_name)
    if not data:
        raise HTTPException(status_code=404, detail="Dataset not found")
    return {k: v for k, v in data.items() if k not in ("raw_content", "entries")}

@app.post("/api/datasets/upload")
async def upload_dataset(file: UploadFile = File(...)):
    filename = file.filename
    if not (filename.endswith('.log') or filename.endswith('.txt') or filename.endswith('.csv')):
        raise HTTPException(status_code=400, detail="Only .log, .txt, and .csv files are supported")
    
    content = (await file.read()).decode('utf-8', errors='replace')
    file_path = os.path.join(dataset_manager.storage_dir, filename)
    with open(file_path, "w", encoding="utf-8") as f:
        f.write(content)
        
    summary = dataset_manager.register_dataset(filename, content, source="Uploaded File")
    
    keys_to_del = [k for k in active_block_compressors if k.startswith(filename)]
    for k in keys_to_del:
        del active_block_compressors[k]
    if filename in active_gzip_compressed:
        del active_gzip_compressed[filename]
        
    return summary

@app.post("/api/datasets/generate-sample")
def generate_sample(req: GenerateSampleRequest):
    return dataset_manager.generate_k8s_sample_dataset(req.name, req.line_count)

@app.post("/api/compress")
def run_compression_experiment(req: CompressRequest):
    dataset = dataset_manager.get_dataset(req.dataset_name)
    if not dataset:
        raise HTTPException(status_code=404, detail=f"Dataset {req.dataset_name} not found")

    entries = dataset["entries"]
    raw_content = dataset["raw_content"]
    raw_bytes = raw_content.encode('utf-8')
    orig_size = len(raw_bytes)

    b_size = req.block_size if req.block_size in (50, 100, 250, 500) else 100
    cache_key = f"{req.dataset_name}:{b_size}"

    results = []

    # 1. Proposed Method (Block LZ78 + Huffman + Inverted Index)
    block_mgr = BlockCompressorManager(block_line_size=b_size)
    prop_res = block_mgr.compress_log_entries(entries)
    active_block_compressors[cache_key] = block_mgr
    active_block_compressors[req.dataset_name] = block_mgr

    t0 = time.perf_counter()
    _ = b"".join(b.decompress() for b in block_mgr.blocks)
    full_decomp_time_ms = (time.perf_counter() - t0) * 1000

    prop_res["decompression_time_ms"] = round(full_decomp_time_ms, 2)
    prop_res["selective_searchable"] = True
    prop_res["search_time_ms"] = None
    prop_res["data_decoded_bytes"] = None
    prop_res["data_decoded_pct"] = None
    results.append(prop_res)

    # 2. Industry Standard Gzip Baseline (Measured dynamically via standard gzip)
    gzip_data, gzip_comp_sec = GzipCompressor.compress(raw_bytes)
    active_gzip_compressed[req.dataset_name] = gzip_data
    gzip_size = len(gzip_data)
    
    results.append({
        "method": "Standard Gzip",
        "block_size": "N/A (Stream)",
        "total_blocks": 1,
        "original_size": orig_size,
        "compressed_size": gzip_size,
        "blocks_compressed_size": gzip_size,
        "index_size": 0,
        "total_storage": gzip_size,
        "payload_compression_ratio": round(orig_size / gzip_size, 3) if gzip_size > 0 else 1.0,
        "compression_ratio": round(orig_size / gzip_size, 3) if gzip_size > 0 else 1.0,
        "space_saving_pct": round(((orig_size - gzip_size) / orig_size * 100), 2) if orig_size > 0 else 0.0,
        "storage_overhead_pct": 0.0,
        "compression_time_ms": round(gzip_comp_sec * 1000, 2),
        "search_time_ms": None,
        "data_decoded_bytes": None,
        "data_decoded_pct": None,
        "selective_searchable": False
    })

    # 3. Raw / Uncompressed Baseline
    results.append({
        "method": "Raw / Uncompressed",
        "block_size": "N/A",
        "total_blocks": 1,
        "original_size": orig_size,
        "compressed_size": orig_size,
        "blocks_compressed_size": orig_size,
        "index_size": 0,
        "total_storage": orig_size,
        "payload_compression_ratio": 1.0,
        "compression_ratio": 1.0,
        "space_saving_pct": 0.0,
        "storage_overhead_pct": 0.0,
        "compression_time_ms": 0.0,
        "search_time_ms": None,
        "data_decoded_bytes": None,
        "data_decoded_pct": None,
        "selective_searchable": False
    })

    experiment_record = {
        "timestamp": time.strftime("%Y-%m-%d %H:%M:%S"),
        "dataset_name": req.dataset_name,
        "line_count": len(entries),
        "block_size": b_size,
        "results": results
    }
    experiment_history.insert(0, experiment_record)
    return experiment_record

@app.get("/api/experiments")
def get_experiments():
    return experiment_history

@app.post("/api/search")
def search_logs(req: SearchRequest):
    dataset = dataset_manager.get_dataset(req.dataset_name)
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")

    b_size = req.block_size or 100
    cache_key = f"{req.dataset_name}:{b_size}"

    if cache_key not in active_block_compressors:
        block_mgr = BlockCompressorManager(block_line_size=b_size)
        block_mgr.compress_log_entries(dataset["entries"])
        active_block_compressors[cache_key] = block_mgr
        active_block_compressors[req.dataset_name] = block_mgr

    raw_bytes = dataset["raw_content"].encode('utf-8')
    if req.dataset_name not in active_gzip_compressed:
        gz, _ = GzipCompressor.compress(raw_bytes)
        active_gzip_compressed[req.dataset_name] = gz

    block_mgr = active_block_compressors[cache_key]
    
    # 1. Proposed Method Search
    proposed_search = block_mgr.selective_search(query=req.query)

    # 2. Standard GZIP Search (Decompress complete file, scan all lines)
    q_clean = req.query.strip().lower() if req.query else ""
    q_tokens = [t.lower() for t in LogParser.tokenize(q_clean)] if q_clean else []
    
    gz_start = time.perf_counter()
    decompressed_gz = GzipCompressor.decompress(active_gzip_compressed[req.dataset_name])[0]
    gz_matches = 0
    if q_clean:
        for line in decompressed_gz.decode('utf-8', errors='replace').splitlines():
            l_low = line.lower()
            if q_clean in l_low or (q_tokens and all(t in l_low for t in q_tokens)):
                gz_matches += 1
    gzip_search_time_ms = round((time.perf_counter() - gz_start) * 1000, 3)

    # 3. Raw / Uncompressed Search (Sequential scan of plaintext)
    raw_start = time.perf_counter()
    raw_matches = 0
    if q_clean:
        for line in dataset["raw_content"].splitlines():
            l_low = line.lower()
            if q_clean in l_low or (q_tokens and all(t in l_low for t in q_tokens)):
                raw_matches += 1
    raw_search_time_ms = round((time.perf_counter() - raw_start) * 1000, 3)

    total_blocks_count = len(block_mgr.blocks)
    comparison = {
        "methods": [
            {
                "method": "Proposed (Block LZ78 + Huffman + Index)",
                "data_decoded_bytes": proposed_search["bytes_decoded"],
                "data_decoded_pct": proposed_search["data_read_pct"],
                "data_not_read_pct": proposed_search["data_not_read_pct"],
                "blocks_decoded": proposed_search["blocks_read"],
                "blocks_skipped": proposed_search["blocks_skipped"],
                "total_blocks": total_blocks_count,
                "search_latency_ms": proposed_search["total_search_latency_ms"],
                "match_count": proposed_search["match_count"],
                "selective_advantage": f"{proposed_search['data_not_read_pct']}% of data bypassed without decoding"
            },
            {
                "method": "Standard Gzip",
                "data_decoded_bytes": len(raw_bytes),
                "data_decoded_pct": 100.0,
                "data_not_read_pct": 0.0,
                "blocks_decoded": total_blocks_count,
                "blocks_skipped": 0,
                "total_blocks": total_blocks_count,
                "search_latency_ms": gzip_search_time_ms,
                "match_count": gz_matches,
                "selective_advantage": "0% (must decompress entire archive)"
            },
            {
                "method": "Raw / Uncompressed",
                "data_decoded_bytes": len(raw_bytes),
                "data_decoded_pct": 100.0,
                "data_not_read_pct": 0.0,
                "blocks_decoded": 0,
                "blocks_skipped": 0,
                "total_blocks": total_blocks_count,
                "search_latency_ms": raw_search_time_ms,
                "match_count": raw_matches,
                "selective_advantage": "0% (scans full uncompressed file)"
            }
        ],
        "latency_speedup_vs_gzip": round(gzip_search_time_ms / proposed_search["total_search_latency_ms"], 2) if proposed_search["total_search_latency_ms"] > 0 else 1.0,
        "bytes_decoded_reduction_pct": proposed_search["data_not_read_pct"]
    }

    return {
        "dataset_name": req.dataset_name,
        "query_details": {
            "query": req.query,
            "block_size": b_size
        },
        "search_results": proposed_search,
        "comparison": comparison
    }
