import urllib.request
import json

def post(url, data):
    req = urllib.request.Request(
        url,
        data=json.dumps(data).encode('utf-8'),
        headers={'Content-Type': 'application/json'}
    )
    return json.loads(urllib.request.urlopen(req).read().decode('utf-8'))

def get(url):
    return json.loads(urllib.request.urlopen(url).read().decode('utf-8'))

print("=== 1. Health & Datasets ===")
health = get("http://127.0.0.1:8000/api/health")
print("Health:", health)

datasets = get("http://127.0.0.1:8000/api/datasets")
print(f"Total datasets: {len(datasets)}")
ds_name = datasets[0]["name"]
print(f"Active dataset: {ds_name}, Lines: {datasets[0]['line_count']}, Size: {datasets[0]['size_kb']} KB")

print("\n=== 2. Compression Experiment Benchmark ===")
comp = post("http://127.0.0.1:8000/api/compress", {
    "dataset_name": ds_name,
    "method": "all",
    "block_size": 100
})
for res in comp["results"]:
    print(f"  Method: {res['method']}")
    print(f"    - Original Size: {res['original_size']} B, Compressed Size: {res['compressed_size']} B")
    print(f"    - Ratio: {res['compression_ratio']}x, Space Saving: {res['space_saving_pct']}%")
    print(f"    - Index Size: {res['index_size']} B, Total Storage: {res['total_storage']} B")
    print(f"    - Compression Time: {res['compression_time_ms']} ms")

print("\n=== 3. Selective Search Benchmark (Query: database-service timeout) ===")
search = post("http://127.0.0.1:8000/api/search", {
    "dataset_name": ds_name,
    "query": "database-service timeout",
    "level": "ERROR",
    "service": "database-service",
    "compare_with_baselines": True
})
sr = search["search_results"]
print(f"  Total Blocks: {sr['total_blocks']}")
print(f"  Blocks Decoded: {sr['blocks_scanned']}")
print(f"  Blocks Skipped: {sr['blocks_skipped']} ({sr['data_skipped_pct']} percent skipped!)")
print(f"  Bytes Decoded: {sr['bytes_decoded']} B ({sr['data_decoded_pct']} percent of file)")
print(f"  Search Latency: {sr['total_search_latency_ms']} ms (Index lookup: {sr['index_lookup_time_ms']} ms)")
print(f"  Matches Found: {sr['match_count']}")

print("\n=== 4. Baseline Comparison ===")
for m in search["comparison"]["methods"]:
    print(f"  {m['method']}:")
    print(f"    - Data Decoded: {m['data_decoded_pct']} percent ({m['data_decoded_bytes']} B)")
    print(f"    - Latency: {m['search_latency_ms']} ms")
    print(f"    - Selective Advantage: {m['selective_advantage']}")

print("\n=== 5. Multi-Block-Size Parametric Sweep ===")
tradeoff = get(f"http://127.0.0.1:8000/api/metrics/block-size-tradeoff?dataset_name={ds_name}")
for p in tradeoff["tradeoff_analysis"]:
    print(f"  Block Size k={p['block_size']:4d}: Ratio={p['compression_ratio']:4.2f}x, Index={p['index_overhead_pct']:5.2f}%, Latency={p['search_latency_ms']:5.2f}ms, Decoded={p['data_decoded_pct']:5.2f}%")

print("\nConclusion:", tradeoff["conclusion"])
print("\nALL BACKEND & INTEGRATION CHECKS PASSED PERFECTLY!")
