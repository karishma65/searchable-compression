import time
import os
import sys
from typing import Optional, List, Dict, Any

# Ensure project root is in sys.path
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
    version="1.0.0"
)

# Enable CORS for Angular frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# State stores
dataset_manager = DatasetManager()
# active_compressors: dataset_name -> BlockCompressorManager
active_block_compressors: Dict[str, BlockCompressorManager] = {}
# active_gzip_compressed: dataset_name -> (compressed_bytes, time)
active_gzip_compressed: Dict[str, bytes] = {}
# active_lz78_compressed: dataset_name -> bytes
active_lz78_compressed: Dict[str, bytes] = {}
# experiments history
experiment_history: List[Dict[str, Any]] = []

class CompressRequest(BaseModel):
    dataset_name: str
    method: str = "all"  # "all", "proposed", "gzip", "lz78", "raw"
    block_size: int = 100  # number of log lines per block

class SearchRequest(BaseModel):
    dataset_name: str
    query: str = ""
    level: Optional[str] = None
    service: Optional[str] = None
    time_from: Optional[str] = None
    time_to: Optional[str] = None
    compare_with_baselines: bool = True

class GenerateSampleRequest(BaseModel):
    name: str = "k8s-cluster-bench.log"
    line_count: int = 2000

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
            "id": "raw",
            "name": "Raw / Uncompressed",
            "type": "Baseline",
            "description": "Sequential scan over raw plaintext byte stream. No storage savings, high search I/O footprint.",
            "selective_search_support": False
        },
        {
            "id": "lz78",
            "name": "LZ78 Baseline",
            "type": "Baseline",
            "description": "Global dictionary LZ78 compression. Requires complete file decompression before query filtering.",
            "selective_search_support": False
        },
        {
            "id": "gzip",
            "name": "Gzip Baseline",
            "type": "Industry Standard",
            "description": "Standard DEFLATE (LZ77 + Huffman) over entire log stream. High compression ratio, but zero selective decoding.",
            "selective_search_support": False
        },
        {
            "id": "proposed",
            "name": "Proposed: Block LZ78 + Huffman + Search Index",
            "type": "Proposed Research Method",
            "description": "Partitioned blocks encoded via LZ78 and secondary Huffman entropy coding, indexed by inverted posting lists for selective block decompression.",
            "selective_search_support": True
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
    
    content_bytes = await file.read()
    content = content_bytes.decode('utf-8', errors='replace')
    
    info = dataset_manager.register_dataset(filename, content, source="User Upload")
    return info

@app.post("/api/datasets/generate-sample")
def generate_sample(req: GenerateSampleRequest):
    info = dataset_manager.generate_k8s_sample_dataset(name=req.name, line_count=req.line_count)
    return info

@app.post("/api/compress")
def run_compression_experiment(req: CompressRequest):
    dataset = dataset_manager.get_dataset(req.dataset_name)
    if not dataset:
        raise HTTPException(status_code=404, detail=f"Dataset {req.dataset_name} not found")

    entries = dataset["entries"]
    raw_content = dataset["raw_content"]
    raw_bytes = raw_content.encode('utf-8')
    orig_size = len(raw_bytes)

    results = []

    # 1. Proposed Method
    if req.method in ("all", "proposed"):
        block_mgr = BlockCompressorManager(block_line_size=req.block_size)
        prop_res = block_mgr.compress_log_entries(entries)
        active_block_compressors[req.dataset_name] = block_mgr

        # Measure baseline full decompression time for reference
        t0 = time.perf_counter()
        _ = b"".join(b.decompress() for b in block_mgr.blocks)
        full_decomp_time_ms = (time.perf_counter() - t0) * 1000

        prop_res["decompression_time_ms"] = round(full_decomp_time_ms, 2)
        prop_res["selective_searchable"] = True
        results.append(prop_res)

    # 2. Gzip Baseline
    if req.method in ("all", "gzip"):
        gzip_data, gzip_comp_sec = GzipCompressor.compress(raw_bytes)
        active_gzip_compressed[req.dataset_name] = gzip_data
        
        _, gzip_decomp_sec = GzipCompressor.decompress(gzip_data)
        gzip_size = len(gzip_data)
        
        results.append({
            "method": "Gzip Baseline",
            "block_size": "N/A (Stream)",
            "total_blocks": 1,
            "original_size": orig_size,
            "compressed_size": gzip_size,
            "index_size": 0,
            "total_storage": gzip_size,
            "compression_ratio": round(orig_size / gzip_size, 3) if gzip_size > 0 else 1.0,
            "total_compression_ratio_with_index": round(orig_size / gzip_size, 3) if gzip_size > 0 else 1.0,
            "space_saving_pct": round(((orig_size - gzip_size) / orig_size * 100), 2) if orig_size > 0 else 0.0,
            "space_saving_with_index_pct": round(((orig_size - gzip_size) / orig_size * 100), 2) if orig_size > 0 else 0.0,
            "compression_time_ms": round(gzip_comp_sec * 1000, 2),
            "decompression_time_ms": round(gzip_decomp_sec * 1000, 2),
            "selective_searchable": False
        })

    # 3. LZ78 Baseline (Global stream)
    if req.method in ("all", "lz78"):
        t0 = time.perf_counter()
        lz78_data = LZ78Coder.compress(raw_bytes)
        lz78_comp_sec = time.perf_counter() - t0
        active_lz78_compressed[req.dataset_name] = lz78_data

        t0 = time.perf_counter()
        _ = LZ78Coder.decompress(lz78_data, original_length=orig_size)
        lz78_decomp_sec = time.perf_counter() - t0
        lz78_size = len(lz78_data)

        results.append({
            "method": "LZ78 Baseline",
            "block_size": "N/A (Global Dictionary)",
            "total_blocks": 1,
            "original_size": orig_size,
            "compressed_size": lz78_size,
            "index_size": 0,
            "total_storage": lz78_size,
            "compression_ratio": round(orig_size / lz78_size, 3) if lz78_size > 0 else 1.0,
            "total_compression_ratio_with_index": round(orig_size / lz78_size, 3) if lz78_size > 0 else 1.0,
            "space_saving_pct": round(((orig_size - lz78_size) / orig_size * 100), 2) if orig_size > 0 else 0.0,
            "space_saving_with_index_pct": round(((orig_size - lz78_size) / orig_size * 100), 2) if orig_size > 0 else 0.0,
            "compression_time_ms": round(lz78_comp_sec * 1000, 2),
            "decompression_time_ms": round(lz78_decomp_sec * 1000, 2),
            "selective_searchable": False
        })

    # 4. Raw Baseline
    if req.method in ("all", "raw"):
        results.append({
            "method": "Raw / Uncompressed",
            "block_size": "N/A",
            "total_blocks": 1,
            "original_size": orig_size,
            "compressed_size": orig_size,
            "index_size": 0,
            "total_storage": orig_size,
            "compression_ratio": 1.0,
            "total_compression_ratio_with_index": 1.0,
            "space_saving_pct": 0.0,
            "space_saving_with_index_pct": 0.0,
            "compression_time_ms": 0.0,
            "decompression_time_ms": 0.0,
            "selective_searchable": False
        })

    experiment_record = {
        "timestamp": time.strftime("%Y-%m-%d %H:%M:%S"),
        "dataset_name": req.dataset_name,
        "line_count": len(entries),
        "block_size": req.block_size,
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

    # If Proposed compression was not yet run for this dataset, auto-run with default block size 100
    if req.dataset_name not in active_block_compressors:
        block_mgr = BlockCompressorManager(block_line_size=100)
        block_mgr.compress_log_entries(dataset["entries"])
        active_block_compressors[req.dataset_name] = block_mgr

    # If Gzip was not compressed yet, compress now
    raw_bytes = dataset["raw_content"].encode('utf-8')
    if req.dataset_name not in active_gzip_compressed:
        gz, _ = GzipCompressor.compress(raw_bytes)
        active_gzip_compressed[req.dataset_name] = gz

    # 1. Proposed Method Selective Search
    block_mgr = active_block_compressors[req.dataset_name]
    proposed_search = block_mgr.selective_search(
        query=req.query,
        level=req.level,
        service=req.service,
        time_from=req.time_from,
        time_to=req.time_to
    )

    # 2. Baseline Comparison Simulation
    # Gzip: To search, must decompress 100% of bytes first, then filter
    gz_start = time.perf_counter()
    decompressed_gz = GzipCompressor.decompress(active_gzip_compressed[req.dataset_name])[0]
    # Filter
    gz_matches = 0
    q_terms = LogParser.tokenize(req.query) if req.query else []
    for line in decompressed_gz.decode('utf-8', errors='replace').splitlines():
        line_low = line.lower()
        if (not q_terms or all(t in line_low for t in q_terms)) and \
           (not req.level or req.level.upper() in line.upper()) and \
           (not req.service or req.service.lower() in line_low):
            gz_matches += 1
    gzip_search_time_ms = round((time.perf_counter() - gz_start) * 1000, 3)

    # Raw search: Full sequential scan over all raw bytes
    raw_start = time.perf_counter()
    raw_matches = 0
    for line in dataset["raw_content"].splitlines():
        line_low = line.lower()
        if (not q_terms or all(t in line_low for t in q_terms)) and \
           (not req.level or req.level.upper() in line.upper()) and \
           (not req.service or req.service.lower() in line_low):
            raw_matches += 1
    raw_search_time_ms = round((time.perf_counter() - raw_start) * 1000, 3)

    # Comparison summary object
    comparison = {
        "methods": [
            {
                "method": "Proposed (Block LZ78+Huffman+Index)",
                "data_decoded_bytes": proposed_search["bytes_decoded"],
                "data_decoded_pct": proposed_search["data_decoded_pct"],
                "blocks_decoded": proposed_search["blocks_scanned"],
                "blocks_skipped": proposed_search["blocks_skipped"],
                "search_latency_ms": proposed_search["total_search_latency_ms"],
                "selective_advantage": f"{proposed_search['data_skipped_pct']}% of data bypassed without decoding!"
            },
            {
                "method": "Gzip Baseline",
                "data_decoded_bytes": len(raw_bytes),
                "data_decoded_pct": 100.0,
                "blocks_decoded": 1,
                "blocks_skipped": 0,
                "search_latency_ms": gzip_search_time_ms,
                "selective_advantage": "0% (must decode entire archive)"
            },
            {
                "method": "Raw / Uncompressed",
                "data_decoded_bytes": len(raw_bytes),
                "data_decoded_pct": 100.0,
                "blocks_decoded": 1,
                "blocks_skipped": 0,
                "search_latency_ms": raw_search_time_ms,
                "selective_advantage": "0% (reads all raw bytes)"
            }
        ],
        "latency_speedup_vs_gzip": round(gzip_search_time_ms / proposed_search["total_search_latency_ms"], 2) if proposed_search["total_search_latency_ms"] > 0 else 1.0,
        "bytes_decoded_reduction_pct": proposed_search["data_skipped_pct"]
    }

    return {
        "dataset_name": req.dataset_name,
        "query_details": {
            "query": req.query,
            "level": req.level,
            "service": req.service,
            "time_from": req.time_from,
            "time_to": req.time_to
        },
        "search_results": proposed_search,
        "comparison": comparison
    }

@app.get("/api/metrics/block-size-tradeoff")
def study_block_size_tradeoff(dataset_name: str = Query(..., description="Dataset name to evaluate")):
    """
    Studies the trade-off between block size, compression ratio, index overhead, and search performance.
    Evaluates block sizes: 25, 50, 100, 200, 500, 1000.
    """
    dataset = dataset_manager.get_dataset(dataset_name)
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")

    entries = dataset["entries"]
    raw_size = dataset["size_bytes"]
    block_sizes = [25, 50, 100, 250, 500, 1000]

    study_points = []
    test_query = "database-service timeout"

    for b_size in block_sizes:
        if b_size > len(entries) and len(study_points) > 0:
            continue
        
        bm = BlockCompressorManager(block_line_size=b_size)
        comp_res = bm.compress_log_entries(entries)
        
        # Test representative search
        srch = bm.selective_search(query=test_query)

        study_points.append({
            "block_size": b_size,
            "block_count": comp_res["total_blocks"],
            "compression_ratio": comp_res["compression_ratio"],
            "total_compression_ratio_with_index": comp_res["total_compression_ratio_with_index"],
            "compressed_size_bytes": comp_res["compressed_size"],
            "index_size_bytes": comp_res["index_size"],
            "index_overhead_pct": round((comp_res["index_size"] / comp_res["compressed_size"]) * 100, 2) if comp_res["compressed_size"] > 0 else 0.0,
            "search_latency_ms": srch["total_search_latency_ms"],
            "blocks_scanned": srch["blocks_scanned"],
            "blocks_skipped": srch["blocks_skipped"],
            "data_decoded_pct": srch["data_decoded_pct"]
        })

    return {
        "dataset_name": dataset_name,
        "original_size": raw_size,
        "total_lines": len(entries),
        "test_query": test_query,
        "tradeoff_analysis": study_points,
        "conclusion": "Smaller block sizes yield fine-grained selective search (fewer bytes decoded per query) at the cost of higher index overhead. Larger block sizes maximize compression ratios but require decompressing more data per query match."
    }
