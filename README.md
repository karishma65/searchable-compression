# Searchable Compression of Cloud/Kubernetes Logs Using LZ78 and Huffman Coding

A complete, production-ready research frontend (Angular 21) and companion engine (FastAPI) evaluating **Block-based LZ78 + Huffman Coding with Inverted Index Selective Decompression** against industry standards (Gzip, global LZ78, and uncompressed logs).

---

## 🎯 Research Thesis

In cloud computing and Kubernetes environments, microservices generate gigabytes to petabytes of operational and audit logs daily. While general-purpose stream compression algorithms like **Gzip (DEFLATE)** achieve high compression ratios, they impose a severe drawback during incident response:

> **To search a query such as `ERROR + database-service + timeout` in a conventionally compressed log file, the CPU must decompress 100% of the compressed stream from byte 0 to EOF.**

### The Proposed Paradigm
1. **Partitioning**: Split the incoming log stream into discrete blocks of $k$ lines (e.g., 50, 100, 250 lines).
2. **Inverted Indexing**: Extract tokens (microservices, severity levels, error keywords, timestamps) and map them to Candidate Block IDs.
3. **Two-Stage Compression**:
   - **Stage 1 (LZ78)**: Replaces repetitive multi-line structured patterns with dictionary token tuples $(j, c)$.
   - **Stage 2 (Huffman)**: Encodes LZ78 token frequencies into canonical prefix bitstreams.
4. **Selective Search**:
   $$\text{Query} \longrightarrow \text{Inverted Index} \longrightarrow \text{Candidate Block IDs} \longrightarrow \text{Decode ONLY Matching Blocks}$$
   All irrelevant blocks are completely **bypassed** without consuming CPU cycles or memory allocation for decompression.

---

## 🚀 Quick Start

### 1. Start the FastAPI Backend
```bash
python -m uvicorn backend.main:app --host 127.0.0.1 --port 8000 --reload
```
API Documentation will be live at: `http://127.0.0.1:8000/docs`

### 2. Start the Angular Frontend
```bash
cd frontend
npm start
```
Frontend will be accessible at: `http://localhost:4200`

---

## 📊 Methods Compared

| Method | Compression Strategy | Storage Overhead | Selective Search Support |
| :--- | :--- | :--- | :--- |
| **Raw / Uncompressed** | Plaintext byte stream | 100% (No reduction) | ❌ No (Full disk I/O scan) |
| **LZ78 Baseline** | Global sliding dictionary | ~50% saving | ❌ No (Sequential token decode) |
| **Gzip Baseline** | DEFLATE (LZ77 + Huffman) | ~65-75% saving | ❌ No (Must decompress 100% of bytes) |
| **Proposed Method** | **Block LZ78 + Huffman + Index** | **~60-70% saving** | ✅ **YES (Selective block decompression)** |

---

## 🔬 Core Views & Features

1. **Overview & Architecture**:
   - Visual architectural diagram showing the two-stage compression pipeline and selective search flow.
   - Theoretical comparison between stream decompression and block-pruned retrieval.
2. **Upload & Datasets**:
   - Upload custom `.log`, `.txt`, and `.csv` files.
   - Built-in realistic **Kubernetes Production Cluster Log Generator** (synthesizes multi-service microservices, timeouts, error cascades, and trace IDs).
   - Real-time metadata analysis (line count, uncompressed size, detected microservices, level distribution).
3. **Compression Experiment**:
   - Select dataset, compression method, and block partition granularity ($k = 25, 50, 100, 250, 500$).
   - Real metrics: Original size, Compressed size, Index size, Total storage, Compression ratio, Space saving %, Compression time, Full decompression time.
   - **Interactive Block Visualizer**: Inspect individual blocks with byte sizes and line spans.
4. **Selective Search**:
   - Pre-populated research query: `ERROR + database-service + timeout`.
   - Multi-field filtering: Severity Level (`ERROR`, `WARN`, `INFO`), Microservice pod, Keywords, Time range.
   - **Visual Proof of Selective Decompression**:
     - Visual grid highlighting decoded blocks (green/cyan) vs skipped blocks (dimmed).
     - Head-to-head metrics proving **80-95% data bypassed from CPU decompression** compared to Gzip!
   - Full matched logs table with syntax highlighting.
5. **Comparison & Trade-offs**:
   - Side-by-side experimental matrix across all 4 methods.
   - **Interactive Chart.js Visualizations**: Compression ratio bar chart, Data decoded per query bar chart.
   - **Parametric Sweep (Block Size Trade-off Study)**:
     - Evaluates $k \in \{25, 50, 100, 250, 500, 1000\}$ to study the trade-off between **compression efficiency, index overhead, and search performance**.
