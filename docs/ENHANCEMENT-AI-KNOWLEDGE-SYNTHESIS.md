# AI Knowledge Synthesis Platform — Enhancement Design Document

> **Status**: Draft — Pending Approval
> **Date**: 2026-02-23
> **Scope**: Add a TypeScript-based knowledge synthesis engine to the existing api-agent monorepo, using Mastra workflows, Qdrant vector search, Neo4j knowledge graph, and the existing MongoDB metadata store.
> **Builds On**: [DESIGN-MCP-COPILOTKIT-MASTRA.md](./DESIGN-MCP-COPILOTKIT-MASTRA.md)

---

## 1. Executive Summary

This enhancement adds a **knowledge synthesis engine** to the existing api-agent platform. The engine ingests large-scale heterogeneous internet data (~100GB+), transforms it into structured knowledge via entity/relationship extraction, and performs cross-source reasoning using Graph RAG combined with hybrid retrieval and LLM-based synthesis.

The system integrates into the existing monorepo as a new `knowledge/` TypeScript package alongside the existing `frontend/` and Python `api_agent/`, sharing the MongoDB instance already in the Docker Compose stack and adding Qdrant + Neo4j as new services.

### What Changes

| Component | Change |
|-----------|--------|
| `knowledge/` | **New** — TypeScript package: ingestion workers, preprocessing, Graph RAG engine, Mastra workflows |
| `frontend/` | **Extended** — New "Knowledge" tab with synthesis UI, knowledge graph explorer |
| `docker-compose.yml` | **Extended** — Add Qdrant, Neo4j, MinIO, knowledge-worker services |
| `api_agent/` (Python) | **No changes** — Existing MCP server remains untouched |

### Key Design Principles

1. **Additive only** — Zero modifications to the existing Python MCP server
2. **Shared infrastructure** — Reuses MongoDB already in the stack for metadata
3. **Mastra-native** — Leverages Mastra workflows, agents, and built-in Graph RAG
4. **Horizontally scalable** — Stateless workers, shardable storage
5. **Storage-abstracted** — All DB access behind interfaces for future swap

---

## 2. System Goals

### Functional Goals

| # | Goal | Description |
|---|------|-------------|
| F1 | Multi-source ingestion | Crawl APIs, websites, PDFs, RSS feeds; normalize and deduplicate |
| F2 | Entity extraction | Extract named entities , this could be the columns or the metadata of the api, or the API docs or swagger |
| F3 | Relationship extraction | Extract typed relationships between entities |
| F4 | Knowledge graph storage | Store entities and relationships in Neo4j |
| F5 | Hybrid retrieval | Combine graph traversal + vector similarity + metadata filtering |
| F6 | Batch synthesis | Execute natural language intelligence queries across all ingested data |
| F7 | Cross-source reasoning | Produce answers that synthesize information from multiple sources |
| F8 | Frontend integration | Knowledge tab in existing frontend with graph explorer and synthesis chat |

### Non-Functional Goals

| # | Goal | Target |
|---|------|--------|
| N1 | Scale | 100GB+ ingested data, path to 1TB+ |
| N2 | Latency | Synthesis queries < 30s for cached graph paths |
| N3 | Modularity | Swap embedding model, LLM, or vector DB without code changes |
| N4 | Observability | Per-stage latency, token usage, retrieval precision tracking |
| N5 | Reliability | Dead-letter queues, retry-safe ingestion, idempotent processing |

---

## 3. Architecture Overview

```
┌──────────────────────────────────────────────────────────────────────────┐
│                          Docker Compose                                   │
│                                                                           │
│  ┌───────────────────────────────────────────────────────────────────┐    │
│  │  frontend (Next.js + Bun) :3001                                  │    │
│  │                                                                   │    │
│  │  Existing:                       New:                             │    │
│  │  ┌──────────────────────┐       ┌──────────────────────────────┐ │    │
│  │  │ API Explorer Tab     │       │ Knowledge Synthesis Tab      │ │    │
│  │  │ CopilotKit Chat      │       │ - Ingestion Dashboard        │ │    │
│  │  │ Data Tables / Charts │       │ - Graph Explorer (vis.js)    │ │    │
│  │  │ API Config Form      │       │ - Synthesis Chat (CopilotKit)│ │    │
│  │  └──────────────────────┘       │ - Source Provenance View     │ │    │
│  │                                  └──────────────────────────────┘ │    │
│  └──────────┬──────────────────────────────────┬─────────────────────┘    │
│             │ HTTP                              │ HTTP                     │
│             ▼                                   ▼                          │
│  ┌──────────────────┐  ┌─────────────────────────────────────────────┐    │
│  │ api-agent         │  │ knowledge-worker (TypeScript + Bun) :3002  │    │
│  │ Python :3000      │  │                                             │    │
│  │ (unchanged)       │  │  ┌──────────────┐  ┌────────────────────┐  │    │
│  │                   │  │  │ REST API     │  │ Mastra Workflows   │  │    │
│  │ MCP Server        │  │  │ /ingest      │  │  IngestWorkflow    │  │    │
│  │ GraphQL/REST      │  │  │ /synthesize  │  │  PreprocessWorkflow│  │    │
│  │ Agents            │  │  │ /knowledge   │  │  GraphRAGWorkflow  │  │    │
│  │                   │  │  │ /status      │  │  SynthesisWorkflow │  │    │
│  │                   │  │  └──────────────┘  │  BatchIntelWorkflow│  │    │
│  │                   │  │                     └────────────────────┘  │    │
│  └──────────────────┘  └───────┬──────────┬──────────┬───────────────┘    │
│                                │          │          │                     │
│                    ┌───────────▼──┐ ┌─────▼─────┐ ┌──▼──────────┐         │
│                    │ MongoDB      │ │ Qdrant    │ │ Neo4j       │         │
│                    │ :27017       │ │ :6333     │ │ :7474/:7687 │         │
│                    │ (existing)   │ │ (new)     │ │ (new)       │         │
│                    │              │ │           │ │             │         │
│                    │ Collections: │ │ Vectors:  │ │ Nodes:      │         │
│                    │  datasets    │ │  chunks   │ │  Entity     │         │
│                    │  documents   │ │           │ │  Document   │         │
│                    │  ingestion_  │ │ Indexes:  │ │  Topic      │         │
│                    │   jobs       │ │  by src   │ │             │         │
│                    │  entities    │ │  by tag   │ │ Edges:      │         │
│                    │              │ │           │ │  MENTIONS   │         │
│                    └──────────────┘ └───────────┘ │  RELATED_TO │         │
│                                                    │  etc.       │         │
│                    ┌───────────────────────┐       └─────────────┘         │
│                    │ MinIO (S3) :9000      │                               │
│                    │ raw-documents bucket  │                               │
│                    └───────────────────────┘                               │
└───────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Technology Stack

| Layer | Technology | Justification |
|-------|-----------|---------------|
| Language | TypeScript (Bun runtime) | Matches existing frontend; Mastra is TS-native |
| Orchestration | Mastra Workflows + Agents | Already used in frontend; provides Graph RAG, tool system, agent loops |
| Vector DB | Qdrant | Native Mastra integration via `@mastra/qdrant`; filtered search, clustering |
| Graph DB | Neo4j | Industry-standard for knowledge graphs; Cypher for multi-hop queries |
| Metadata Store | MongoDB (existing) | Already in Docker Compose; stores document metadata, ingestion jobs |
| Object Storage | MinIO (S3-compatible) | Raw document archival; local S3 API, swap to AWS S3 in production |
| Embeddings | `text-embedding-3-small` (OpenAI) | Pluggable via Mastra embedding abstraction; 1536 dimensions |
| Reranker | Cohere `rerank-v3.5` | Cross-encoder reranking for precision; abstracted behind interface |
| LLM | Pluggable (OpenAI default) | For entity extraction and synthesis; configurable via env var |
| Graph RAG | Mastra `GraphRAG` | Built-in knowledge graph from chunks with random-walk retrieval |
| HTTP Framework | Hono | Lightweight, fast, Bun-native HTTP framework for the worker API |

---

## 5. New Package Structure

```
knowledge/
├── package.json
├── tsconfig.json
├── Dockerfile
├── src/
│   ├── index.ts                          # Entry point: Hono HTTP server
│   ├── config.ts                         # Environment config (type-safe)
│   │
│   ├── ingestion/                        # Data ingestion layer
│   │   ├── crawler.ts                    # Web crawler (URLs, sitemaps, RSS)
│   │   ├── pdf-loader.ts                 # PDF text extraction
│   │   ├── api-loader.ts                 # REST/GraphQL API data loader
│   │   ├── normalizer.ts                 # Content normalization (HTML→text)
│   │   ├── deduplicator.ts               # Content-hash deduplication
│   │   └── raw-store.ts                  # MinIO/S3 raw document storage
│   │
│   ├── preprocessing/                    # Content processing pipeline
│   │   ├── chunker.ts                    # Recursive text chunking (512-1000 tokens)
│   │   ├── embedder.ts                   # Embedding generation (abstracted)
│   │   ├── entity-extractor.ts           # LLM-based NER
│   │   ├── relationship-extractor.ts     # LLM-based relationship extraction
│   │   └── topic-classifier.ts           # Topic/category classification
│   │
│   ├── storage/                          # Storage abstraction layer
│   │   ├── interfaces.ts                 # IVectorStore, IGraphStore, IMetadataStore, IRawStore
│   │   ├── mongodb.ts                    # MongoDB adapter (metadata, documents, entities)
│   │   ├── qdrant.ts                     # Qdrant adapter (vector storage + retrieval)
│   │   ├── neo4j.ts                      # Neo4j adapter (knowledge graph CRUD)
│   │   └── minio.ts                      # MinIO/S3 adapter (raw document storage)
│   │
│   ├── retrieval/                        # Hybrid retrieval engine
│   │   ├── query-parser.ts               # NL query → entities + intent + filters
│   │   ├── graph-expander.ts             # Neo4j multi-hop expansion
│   │   ├── vector-search.ts              # Qdrant filtered vector search
│   │   ├── reranker.ts                   # Cross-encoder reranking
│   │   ├── context-compressor.ts         # Redundancy removal, fact merging
│   │   └── hybrid-retriever.ts           # Orchestrates graph + vector + metadata
│   │
│   ├── synthesis/                        # LLM synthesis layer
│   │   ├── synthesizer.ts                # Single-query synthesis with citations
│   │   ├── batch-synthesizer.ts          # Parallel queries → aggregated report
│   │   ├── summarizer.ts                 # Two-level summarization
│   │   └── citation-builder.ts           # Source provenance formatting
│   │
│   ├── workflows/                        # Mastra workflow definitions
│   │   ├── ingest.workflow.ts            # URL → crawl → store raw → metadata
│   │   ├── preprocess.workflow.ts        # Raw → chunk → embed → extract → store
│   │   ├── graph-rag.workflow.ts         # Query → parse → expand → search → rerank → synthesize
│   │   ├── batch-intel.workflow.ts       # Multiple queries → parallel synthesis
│   │   └── reindex.workflow.ts           # Re-embed / re-extract on model change
│   │
│   ├── agents/                           # Mastra agent definitions
│   │   ├── knowledge-agent.ts            # Main synthesis agent
│   │   └── extraction-agent.ts           # Entity/relationship extraction agent
│   │
│   ├── api/                              # HTTP API routes (Hono)
│   │   ├── ingest.routes.ts              # POST /ingest, GET /ingest/:jobId
│   │   ├── knowledge.routes.ts           # GET /knowledge/entities, /knowledge/graph
│   │   ├── synthesize.routes.ts          # POST /synthesize, POST /synthesize/batch
│   │   └── status.routes.ts              # GET /status, GET /status/stats
│   │
│   └── utils/
│       ├── logger.ts                     # Structured logging + OpenTelemetry
│       ├── retry.ts                      # Exponential backoff retry helper
│       ├── token-counter.ts              # Token counting for chunking
│       └── hash.ts                       # Content hashing for dedup
│
└── tests/
    ├── ingestion/
    │   ├── crawler.test.ts
    │   ├── normalizer.test.ts
    │   └── deduplicator.test.ts
    ├── preprocessing/
    │   ├── chunker.test.ts
    │   ├── entity-extractor.test.ts
    │   └── relationship-extractor.test.ts
    ├── retrieval/
    │   ├── query-parser.test.ts
    │   ├── graph-expander.test.ts
    │   ├── vector-search.test.ts
    │   └── hybrid-retriever.test.ts
    ├── synthesis/
    │   ├── synthesizer.test.ts
    │   └── batch-synthesizer.test.ts
    └── workflows/
        ├── ingest.workflow.test.ts
        └── graph-rag.workflow.test.ts
```

---

## 6. Data Flow Design

### 6.1 Ingestion Pipeline

```
User submits URL(s) / uploads
        │
        ▼
┌───────────────────┐
│ IngestWorkflow     │
│ (Mastra)           │
│                    │
│ Step 1: Validate   │──► Check URL, detect type (HTML/PDF/API/RSS)
│ Step 2: Crawl      │──► Fetch content, follow links (configurable depth)
│ Step 3: Normalize  │──► HTML→text, PDF→text, strip boilerplate
│ Step 4: Dedup      │──► Content hash check against MongoDB
│ Step 5: Store Raw  │──► Upload original to MinIO (s3://raw-docs/{docId})
│ Step 6: Metadata   │──► Insert document record into MongoDB
│ Step 7: Trigger    │──► Emit preprocess event for next workflow
└───────────────────┘
```

**MongoDB `documents` collection:**

```json
{
  "_id": "doc_a1b2c3",
  "source": "techcrunch.com",
  "url": "https://techcrunch.com/2026/02/...",
  "title": "Startup X Acquires Company Y",
  "contentHash": "sha256:...",
  "rawStoragePath": "s3://raw-docs/doc_a1b2c3.html",
  "contentType": "text/html",
  "publishedAt": "2026-02-20T...",
  "ingestedAt": "2026-02-23T...",
  "chunkIds": ["c1", "c2", "c3"],
  "entityIds": ["e1", "e2"],
  "tags": ["technology", "acquisition"],
  "status": "processed"
}
```

### 6.2 Preprocessing Pipeline

```
Document from ingestion
        │
        ▼
┌─────────────────────────┐
│ PreprocessWorkflow       │
│ (Mastra)                 │
│                          │
│ Step 1: Load raw content │──► Fetch from MinIO
│ Step 2: Chunk            │──► Recursive splitting, 512-1000 tokens, 50 overlap
│ Step 3: Embed            │──► Generate embeddings (batched, 100 chunks/request)
│ Step 4: Entity Extract   │──► LLM extracts Person, Org, Location, Event
│ Step 5: Relation Extract │──► LLM extracts relationships between entities
│ Step 6: Topic Classify   │──► Classify into topic taxonomy
│ Step 7: Store Vectors    │──► Upsert chunks + embeddings into Qdrant
│ Step 8: Store Graph      │──► Upsert entities + relationships into Neo4j
│ Step 9: Update Metadata  │──► Update MongoDB with chunkIds, entityIds
└─────────────────────────┘
```

**Qdrant payload per chunk:**

```json
{
  "chunkId": "c1",
  "documentId": "doc_a1b2c3",
  "source": "techcrunch.com",
  "text": "Startup X announced today that it has acquired Company Y for $500M...",
  "entityIds": ["e_startup_x", "e_company_y"],
  "topics": ["technology", "acquisition"],
  "publishedAt": "2026-02-20"
}
```

**Neo4j graph schema:**

```cypher
// Node types
(:Entity {id, name, type, aliases[], firstSeen, lastSeen, mentionCount})
(:Document {id, source, url, title, publishedAt})
(:Topic {id, name, parentTopic?})

// Edge types
(:Entity)-[:ACQUIRED {date, amount}]->(:Entity)
(:Entity)-[:CEO_OF {since}]->(:Entity)
(:Entity)-[:LOCATED_IN]->(:Entity)
(:Entity)-[:WORKS_FOR]->(:Entity)
(:Entity)-[:RELATED_TO {context}]->(:Entity)
(:Entity)-[:COMPETES_WITH]->(:Entity)
(:Document)-[:MENTIONS {chunkId, sentiment}]->(:Entity)
(:Document)-[:ABOUT]->(:Topic)
(:Entity)-[:TAGGED]->(:Topic)
```

### 6.3 Entity Extraction (LLM-based)

```typescript
// knowledge/src/preprocessing/entity-extractor.ts
import { z } from "zod";

const extractionSchema = z.object({
  entities: z.array(z.object({
    name: z.string(),
    type: z.enum([This should be the columns in the API docs, schema or the ]),
    aliases: z.array(z.string()).optional(),
  })),
  relationships: z.array(z.object({
    source: z.string(),
    target: z.string(),
    type: z.string(),
    context: z.string().optional(),
  })),
});

// Each chunk is processed through the extraction agent
// Entities are deduplicated by fuzzy name matching (string-similarity-js)
// Merged with existing graph nodes via Neo4j MERGE
```

---

## 7. Retrieval Architecture (Graph RAG)

Combines Mastra's built-in Graph RAG with explicit Neo4j graph traversal for maximum recall and precision.

### 7.1 Hybrid Retrieval Flow

```
User Query: "What companies has Startup X acquired and how are they connected?"
        │
        ▼
┌──────────────────────────────────────────────────────────────────┐
│ GraphRAGWorkflow (Mastra)                                        │
│                                                                  │
│ Step 1: ParseQuery                                               │
│   Input:  "What companies has Startup X acquired..."             │
│   Output: { entities: ["Startup X"],                             │
│             intent: "relationship_discovery",                    │
│             filters: { relationType: "ACQUIRED" } }              │
│                                                                  │
│ Step 2: GraphLookup (Neo4j)                                      │
│   MATCH (e:Entity {name: "Startup X"})                           │
│   → Found: Entity node with id "e_startup_x"                    │
│                                                                  │
│ Step 3: GraphExpansion (Neo4j)                                   │
│   MATCH (e:Entity {id: $id})-[r*1..2]-(related)                 │
│   → Expands 1-2 hops, collects related entities + document IDs  │
│   → Returns: [Company Y, Company Z, CEO Person A, ...]          │
│                                                                  │
│ Step 4: MetadataFilter (MongoDB)                                 │
│   Filter documents by date range, source, tags if specified      │
│                                                                  │
│ Step 5: VectorSearch (Qdrant)                                    │
│   Embed query → search with filter: documentId IN [graph set]   │
│   topK: 50 candidates                                            │
│                                                                  │
│ Step 6: MastraGraphRAG                                           │
│   Built-in GraphRAG for secondary retrieval:                     │
│   - Builds knowledge subgraph from retrieved chunks              │
│   - Random walk (100 steps, restart prob 0.15)                   │
│   - Discovers additional connected chunks                        │
│                                                                  │
│ Step 7: Rerank                                                   │
│   Cross-encoder reranker on top 50 → select top 10              │
│                                                                  │
│ Step 8: ContextCompress                                          │
│   Remove duplicate facts, merge overlapping information          │
│   → Compressed context ≤ 16K tokens                              │
│                                                                  │
│ Step 9: Synthesize (LLM)                                         │
│   Context: [compressed chunks with source citations]             │
│   → Structured answer with inline citations                      │
│                                                                  │
│ Output: {                                                        │
│   answer: "Startup X has acquired 3 companies: ...",             │
│   citations: [{source: "techcrunch.com", url: "..."}],           │
│   entities: [{name: "Company Y", relation: "ACQUIRED"}],         │
│   confidence: 0.92                                               │
│ }                                                                │
└──────────────────────────────────────────────────────────────────┘
```

### 7.2 Mastra Graph RAG Integration

```typescript
// knowledge/src/retrieval/hybrid-retriever.ts
import { GraphRAG } from "@mastra/rag";
import { QdrantVector } from "@mastra/qdrant";

const vectorStore = new QdrantVector({
  url: process.env.QDRANT_URL || "http://qdrant:6333",
});

const graphRag = new GraphRAG({
  dimension: 1536,
  threshold: 0.7,
  randomWalkSteps: 100,
  restartProb: 0.15,
});

// Step 1: Get chunks from Qdrant (filtered by Neo4j graph expansion)
const vectorResults = await vectorStore.query({
  indexName: "knowledge-chunks",
  queryVector: queryEmbedding,
  topK: 50,
  filter: { documentId: { $in: graphExpandedDocIds } },
});

// Step 2: Enrich with Mastra Graph RAG for relationship discovery
const graphResults = graphRag.query({
  query: userQuery,
  topK: 10,
  results: vectorResults,
});
```

### 7.3 Neo4j Multi-Hop Expansion

```typescript
// knowledge/src/retrieval/graph-expander.ts
import neo4j from "neo4j-driver";

export async function expandFromEntities(
  entityNames: string[],
  hops: number = 2,
  relationTypes?: string[],
): Promise<GraphExpansionResult> {
  const session = driver.session({ database: "neo4j" });
  const relFilter = relationTypes ? `:${relationTypes.join("|")}` : "";

  const result = await session.run(
    `MATCH (seed:Entity)
     WHERE seed.name IN $entityNames
     MATCH path = (seed)-[*1..${hops}]-(related)
     WITH DISTINCT related, relationships(path) AS rels
     OPTIONAL MATCH (d:Document)-[:MENTIONS]->(related)
     RETURN related, collect(DISTINCT d.id) AS documentIds, rels`,
    { entityNames }
  );

  return parseExpansionResult(result);
}
```

---

## 8. Mastra Workflow Definitions

### 8.1 Ingest Workflow

```typescript
// knowledge/src/workflows/ingest.workflow.ts
import { Workflow, Step } from "@mastra/core/workflows";
import { z } from "zod";

const validateStep = new Step({
  id: "validate",
  inputSchema: z.object({
    urls: z.array(z.string().url()),
    crawlDepth: z.number().min(0).max(3).default(1),
    tags: z.array(z.string()).optional(),
  }),
  execute: async ({ context }) => {
    // Validate URLs, detect content types, check dedup store
  },
});

const crawlStep = new Step({
  id: "crawl",
  execute: async ({ context }) => {
    // Parallel fetch with rate limiting
    // HTML: cheerio; PDF: pdf-parse; RSS: rss-parser
  },
});

const storeRawStep = new Step({
  id: "store-raw",
  execute: async ({ context }) => {
    // Upload to MinIO, insert metadata into MongoDB
  },
});

const triggerPreprocessStep = new Step({
  id: "trigger-preprocess",
  execute: async ({ context }) => {
    // Start PreprocessWorkflow for each document
  },
});

export const ingestWorkflow = new Workflow({
  name: "IngestWorkflow",
  triggerSchema: z.object({
    urls: z.array(z.string().url()),
    crawlDepth: z.number().default(1),
    tags: z.array(z.string()).optional(),
  }),
})
  .step(validateStep)
  .then(crawlStep)
  .then(storeRawStep)
  .then(triggerPreprocessStep)
  .commit();
```

### 8.2 Preprocess Workflow

```typescript
// knowledge/src/workflows/preprocess.workflow.ts
export const preprocessWorkflow = new Workflow({
  name: "PreprocessWorkflow",
  triggerSchema: z.object({ documentId: z.string() }),
})
  .step(chunkStep)            // Recursive splitting, 512-1000 tokens
  .then(embedStep)            // Batch embed (100 chunks/request)
  .then(extractEntitiesStep)  // LLM NER: Person, Org, Location, Event
  .then(extractRelationsStep) // LLM relation extraction
  .then(storeVectorsStep)     // Upsert to Qdrant
  .then(storeGraphStep)       // MERGE into Neo4j
  .commit();
```

### 8.3 Graph RAG Synthesis Workflow

```typescript
// knowledge/src/workflows/graph-rag.workflow.ts
export const graphRagWorkflow = new Workflow({
  name: "GraphRAGWorkflow",
  triggerSchema: z.object({
    query: z.string(),
    filters: z.object({
      dateRange: z.object({ from: z.string(), to: z.string() }).optional(),
      sources: z.array(z.string()).optional(),
      topics: z.array(z.string()).optional(),
    }).optional(),
    maxHops: z.number().min(1).max(3).default(2),
    topK: z.number().min(1).max(50).default(10),
  }),
})
  .step(parseQueryStep)           // NL → entities + intent + filters
  .then(graphLookupStep)          // Find seed entities in Neo4j
  .then(graphExpansionStep)       // Expand 1-N hops
  .then(metadataFilterStep)       // Date/source/topic filters via MongoDB
  .then(vectorSearchStep)         // Qdrant filtered search
  .then(mastraGraphRagStep)       // Mastra GraphRAG enrichment
  .then(rerankStep)               // Cross-encoder reranking
  .then(contextCompressStep)      // Remove redundancy
  .then(synthesizeStep)           // LLM synthesis with citations
  .commit();
```

### 8.4 Batch Intelligence Workflow

```typescript
// knowledge/src/workflows/batch-intel.workflow.ts
export const batchIntelWorkflow = new Workflow({
  name: "BatchIntelWorkflow",
  triggerSchema: z.object({
    queries: z.array(z.string()),
    outputFormat: z.enum(["individual", "aggregated_report"]).default("individual"),
  }),
})
  .step(parseAllQueriesStep)
  .then(parallelSynthesisStep)    // Runs graphRagWorkflow per query in parallel
  .then(aggregationStep)          // Merge into final report if requested
  .commit();
```

---

## 9. Knowledge Agent (Mastra)

Exposed to the frontend via CopilotKit, alongside the existing API explorer agent:

```typescript
// knowledge/src/agents/knowledge-agent.ts
import { Agent } from "@mastra/core/agent";
import { createTool } from "@mastra/core/tools";
import { z } from "zod";

const searchKnowledgeTool = createTool({
  id: "search_knowledge",
  description: "Search the knowledge base using hybrid retrieval (graph + vector + metadata)",
  inputSchema: z.object({
    query: z.string(),
    maxResults: z.number().default(10),
    filters: z.object({
      sources: z.array(z.string()).optional(),
      dateFrom: z.string().optional(),
      dateTo: z.string().optional(),
      topics: z.array(z.string()).optional(),
    }).optional(),
  }),
  execute: async (input) => {
    // Execute graphRagWorkflow (retrieval only, no synthesis)
  },
});

const exploreGraphTool = createTool({
  id: "explore_graph",
  description: "Explore entity relationships in the knowledge graph",
  inputSchema: z.object({
    entityName: z.string(),
    relationTypes: z.array(z.string()).optional(),
    maxHops: z.number().default(2),
  }),
  execute: async (input) => {
    // Neo4j graph expansion → entities + relationships
  },
});

const synthesizeTool = createTool({
  id: "synthesize_answer",
  description: "Synthesize a comprehensive answer with citations",
  inputSchema: z.object({
    query: z.string(),
    maxSources: z.number().default(10),
  }),
  execute: async (input) => {
    // Full graphRagWorkflow → answer + citations + confidence
  },
});

const ingestContentTool = createTool({
  id: "ingest_content",
  description: "Add new content to the knowledge base from URLs",
  inputSchema: z.object({
    urls: z.array(z.string().url()),
    tags: z.array(z.string()).optional(),
  }),
  execute: async (input) => {
    // Trigger ingestWorkflow → return job status
  },
});

export const knowledgeAgent = new Agent({
  id: "knowledge-synthesizer",
  name: "Knowledge Synthesis Agent",
  instructions: `You are a knowledge synthesis agent. You help users:
1. **Ingest** new content from URLs
2. **Search** the knowledge base using hybrid retrieval
3. **Explore** entity relationships in the knowledge graph
4. **Synthesize** cross-source answers with citations

Always cite sources. Indicate confidence. Highlight conflicting information.

For graph data, format as:
\`\`\`json
{"type":"graph","nodes":[{"id":"...","label":"...","type":"..."}],"edges":[{"from":"...","to":"...","label":"..."}]}
\`\`\``,
  model: { id: `openai/${process.env.KNOWLEDGE_MODEL || "gpt-4o"}` as `${string}/${string}` },
  tools: {
    search_knowledge: searchKnowledgeTool,
    explore_graph: exploreGraphTool,
    synthesize_answer: synthesizeTool,
    ingest_content: ingestContentTool,
  },
});
```

---

## 10. Frontend Integration

### 10.1 New Components

```
frontend/src/
├── app/
│   ├── page.tsx                          # Updated: tab switcher (Explorer | Knowledge)
│   └── api/knowledge/
│       └── route.ts                      # Proxy to knowledge-worker:3002
├── components/knowledge/                 # NEW
│   ├── knowledge-page.tsx                # Main knowledge synthesis page
│   ├── ingestion-form.tsx                # URL input + crawl config
│   ├── ingestion-status.tsx              # Job progress tracker
│   ├── graph-explorer.tsx                # Interactive graph (vis-network)
│   ├── synthesis-chat.tsx                # CopilotKit chat for knowledge queries
│   ├── citation-card.tsx                 # Source citation display
│   ├── entity-card.tsx                   # Entity detail card
│   └── knowledge-stats.tsx               # Dashboard stats
```

### 10.2 Knowledge Page Layout

```
┌──────────────────────────────────────────────────────────────────┐
│  API Agent Explorer       [API Explorer] [Knowledge Synthesis]   │
├──────────────────────────────────────────────────────────────────┤
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  Knowledge Base Stats                                      │  │
│  │  Documents: 12,450 │ Entities: 8,320 │ Relations: 24,100  │  │
│  │  Last ingested: 2 min ago │ Qdrant: 850K vectors          │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌──────────────────────┐  ┌──────────────────────────────────┐  │
│  │  Ingestion & Chat    │  │  Results                         │  │
│  │                      │  │                                  │  │
│  │  ┌────────────────┐  │  │  [Synthesis] [Graph] [Sources]  │  │
│  │  │ Add URLs:      │  │  │                                  │  │
│  │  │ ┌────────────┐ │  │  │  Synthesis:                     │  │
│  │  │ │ url1, url2 │ │  │  │  "Startup X acquired Company Y  │  │
│  │  │ └────────────┘ │  │  │   in Feb 2026 for $500M..."     │  │
│  │  │ [Ingest]       │  │  │   [Source: techcrunch.com]       │  │
│  │  └────────────────┘  │  │                                  │  │
│  │                      │  │  Graph:                          │  │
│  │  Chat:               │  │   (Startup X)──ACQUIRED──►(Y)   │  │
│  │  User: What has      │  │       │                          │  │
│  │  Startup X acquired? │  │       └──ACQUIRED──►(Z)          │  │
│  │                      │  │                                  │  │
│  │  Agent: Based on 12  │  │  Sources:                        │  │
│  │  sources, Startup X  │  │  ┌─────────────────────────┐    │  │
│  │  has acquired 3...   │  │  │ techcrunch.com Feb 2026 │    │  │
│  │                      │  │  │ reuters.com   Feb 2026  │    │  │
│  │  [Ask a question...] │  │  └─────────────────────────┘    │  │
│  └──────────────────────┘  └──────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────┘
```

### 10.3 Graph Explorer Component

```typescript
// frontend/src/components/knowledge/graph-explorer.tsx
"use client";
import { useEffect, useRef } from "react";
import { Network } from "vis-network";

interface GraphData {
  nodes: Array<{ id: string; label: string; type: string }>;
  edges: Array<{ from: string; to: string; label: string }>;
}

const colorMap: Record<string, string> = {
  Person: "#6366f1", Organization: "#22c55e", Location: "#f59e0b",
  Event: "#ef4444", Topic: "#8b5cf6", Document: "#64748b",
};

export function GraphExplorer({ data }: { data: GraphData }) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current || !data.nodes.length) return;
    const nodes = data.nodes.map((n) => ({
      id: n.id, label: n.label,
      color: colorMap[n.type] || "#94a3b8",
      shape: n.type === "Document" ? "box" : "dot", size: 20,
    }));
    const edges = data.edges.map((e) => ({
      from: e.from, to: e.to, label: e.label, arrows: "to", font: { size: 10 },
    }));
    new Network(containerRef.current, { nodes, edges }, {
      physics: { stabilization: { iterations: 100 } },
      interaction: { hover: true, tooltipDelay: 200 },
    });
  }, [data]);

  return <div ref={containerRef} className="w-full h-[500px] border rounded-lg" />;
}
```

---

## 11. Docker Compose Changes

New services added to the existing `docker-compose.yml`:

```yaml
  # --- NEW SERVICES ---

  qdrant:
    image: qdrant/qdrant:v1.13.2
    ports:
      - "6333:6333"
      - "6334:6334"
    volumes:
      - qdrant_data:/qdrant/storage
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:6333/healthz"]
      interval: 15s
      timeout: 5s
      retries: 3

  neo4j:
    image: neo4j:5.26-community
    ports:
      - "7474:7474"
      - "7687:7687"
    environment:
      - NEO4J_AUTH=neo4j/${NEO4J_PASSWORD:-knowledge123}
      - NEO4J_PLUGINS=["apoc"]
      - NEO4J_server_memory_heap_initial__size=512m
      - NEO4J_server_memory_heap_max__size=1G
    volumes:
      - neo4j_data:/data
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "cypher-shell", "-u", "neo4j", "-p", "${NEO4J_PASSWORD:-knowledge123}", "RETURN 1"]
      interval: 15s
      timeout: 10s
      retries: 5
      start_period: 30s

  minio:
    image: minio/minio:latest
    ports:
      - "9000:9000"
      - "9001:9001"
    environment:
      - MINIO_ROOT_USER=${MINIO_ROOT_USER:-minioadmin}
      - MINIO_ROOT_PASSWORD=${MINIO_ROOT_PASSWORD:-minioadmin}
    volumes:
      - minio_data:/data
    command: server /data --console-address ":9001"
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "mc", "ready", "local"]
      interval: 15s
      timeout: 5s
      retries: 3

  knowledge-worker:
    build:
      context: ./knowledge
      dockerfile: Dockerfile
    ports:
      - "3002:3002"
    environment:
      - OPENAI_API_KEY=${OPENAI_API_KEY}
      - MONGODB_URI=mongodb://mongodb:27017
      - QDRANT_URL=http://qdrant:6333
      - NEO4J_URI=bolt://neo4j:7687
      - NEO4J_USER=neo4j
      - NEO4J_PASSWORD=${NEO4J_PASSWORD:-knowledge123}
      - MINIO_ENDPOINT=minio:9000
      - MINIO_ACCESS_KEY=${MINIO_ROOT_USER:-minioadmin}
      - MINIO_SECRET_KEY=${MINIO_ROOT_PASSWORD:-minioadmin}
      - PORT=3002
    depends_on:
      mongodb:
        condition: service_healthy
      qdrant:
        condition: service_healthy
      neo4j:
        condition: service_healthy
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3002/status"]
      interval: 30s
      timeout: 10s
      retries: 3

# Add to existing volumes:
volumes:
  mongo_data:
  qdrant_data:
  neo4j_data:
  minio_data:
```

---

## 12. Environment Variables (New)

| Variable | Service | Default | Description |
|---------|---------|---------|-------------|
| `QDRANT_URL` | knowledge-worker | `http://qdrant:6333` | Qdrant connection URL |
| `NEO4J_URI` | knowledge-worker | `bolt://neo4j:7687` | Neo4j Bolt URI |
| `NEO4J_USER` | knowledge-worker | `neo4j` | Neo4j username |
| `NEO4J_PASSWORD` | knowledge-worker, neo4j | `knowledge123` | Neo4j password |
| `MINIO_ENDPOINT` | knowledge-worker | `minio:9000` | MinIO S3 endpoint |
| `MINIO_ACCESS_KEY` | knowledge-worker | `minioadmin` | MinIO access key |
| `MINIO_SECRET_KEY` | knowledge-worker | `minioadmin` | MinIO secret key |
| `KNOWLEDGE_MODEL` | knowledge-worker | `gpt-4o` | LLM for extraction & synthesis |
| `EMBEDDING_MODEL` | knowledge-worker | `text-embedding-3-small` | Embedding model |
| `EMBEDDING_DIMENSIONS` | knowledge-worker | `1536` | Vector dimensions |
| `COHERE_API_KEY` | knowledge-worker | — | For cross-encoder reranker |
| `KNOWLEDGE_WORKER_URL` | frontend | `http://knowledge-worker:3002` | Worker URL |
| `MAX_CRAWL_DEPTH` | knowledge-worker | `2` | Maximum crawl depth |
| `MAX_CHUNK_TOKENS` | knowledge-worker | `1000` | Max tokens per chunk |
| `CHUNK_OVERLAP_TOKENS` | knowledge-worker | `50` | Overlap between chunks |

---

## 13. Storage Abstraction Layer

All storage access goes through interfaces for future swapability:

```typescript
// knowledge/src/storage/interfaces.ts

export interface IVectorStore {
  upsert(indexName: string, chunks: ChunkWithEmbedding[]): Promise<void>;
  query(indexName: string, embedding: number[], topK: number, filter?: Record<string, unknown>): Promise<ScoredChunk[]>;
  delete(indexName: string, ids: string[]): Promise<void>;
  createIndex(name: string, dimension: number, metric?: "cosine" | "euclidean" | "dot"): Promise<void>;
}

export interface IGraphStore {
  mergeEntity(entity: Entity): Promise<string>;
  mergeRelationship(rel: Relationship): Promise<void>;
  findEntities(name: string, fuzzyMatch?: boolean): Promise<Entity[]>;
  expandFromEntity(entityId: string, hops: number, relTypes?: string[]): Promise<GraphExpansionResult>;
  getDocumentEntities(documentId: string): Promise<Entity[]>;
  runCypher(query: string, params?: Record<string, unknown>): Promise<unknown>;
}

export interface IMetadataStore {
  insertDocument(doc: DocumentMetadata): Promise<string>;
  getDocument(id: string): Promise<DocumentMetadata | null>;
  findDocuments(filter: DocumentFilter): Promise<DocumentMetadata[]>;
  updateDocument(id: string, update: Partial<DocumentMetadata>): Promise<void>;
  checkDuplicate(contentHash: string): Promise<boolean>;
}

export interface IRawStore {
  upload(key: string, content: Buffer, contentType: string): Promise<string>;
  download(key: string): Promise<Buffer>;
  delete(key: string): Promise<void>;
}
```

---

## 14. Scaling Strategy

### Phase 1: MVP (Single Node)

- Qdrant single node (handles ~10M vectors / ~50GB)
- Neo4j Community single node
- MongoDB single node (existing)
- Single knowledge-worker instance

### Phase 2: Medium Scale (100GB+)

- Qdrant distributed mode (3-node cluster, sharded collections)
- Neo4j Enterprise with read replicas
- 3+ knowledge-worker instances behind load balancer
- MinIO distributed mode (4+ nodes)

### Phase 3: Large Scale (1TB+)

- Qdrant multi-shard with separate indexing cluster
- Neo4j causal cluster (3+ cores)
- Dedicated embedding GPU workers
- Message queue (BullMQ/Redis) between ingestion and preprocessing
- Separate ingestion and query worker pools

### Data Growth Estimates

| Data Size | Chunks (~500 tok) | Qdrant Storage | Neo4j Nodes | MongoDB Docs |
|-----------|-------------------|----------------|-------------|-------------|
| 10GB | ~3M | ~18GB | ~500K | ~200K |
| 100GB | ~30M | ~180GB | ~5M | ~2M |
| 1TB | ~300M | ~1.8TB | ~50M | ~20M |

---

## 15. Optimization Strategies

### 15.1 Two-Level Summarization

```
Level 1: Per-source summaries (parallel)
  Source A chunks → Summary A (500 tokens)
  Source B chunks → Summary B (500 tokens)

Level 2: Cross-source synthesis
  [Summary A, B, C] → Final answer (structured)
```

### 15.2 Community Detection (Advanced)

```cypher
-- Pre-compute graph communities via Neo4j GDS
CALL gds.louvain.stream('knowledge-graph')
YIELD nodeId, communityId
SET node.communityId = communityId
```

Embed community summaries for fast topic-level retrieval before individual chunks.

### 15.3 Caching Layer

| Cache Target | Strategy | TTL |
|-------------|----------|-----|
| Graph expansion results | In-memory LRU (1000 entries) | 5 min |
| Reranked chunk sets | Content-hash keyed | 10 min |
| Synthesis answers | Query-hash keyed | 30 min |
| Entity name → ID mapping | In-memory map | Until re-index |

### 15.4 Embedding Batch Processing

- 100 chunks per API call
- OpenAI batch API for large ingestion (50% cost reduction)
- Queue-based processing with configurable concurrency

---

## 16. Observability

### Metrics Per Stage

| Stage | Metrics |
|-------|---------|
| Ingestion | URLs processed/s, dedup hit rate, raw storage size |
| Chunking | Chunks/doc, avg chunk size |
| Embedding | Vectors/s, batch size, latency |
| Entity extraction | Entities/doc, LLM tokens used |
| Graph expansion | Hops traversed, nodes returned, latency |
| Vector search | Query latency, candidates returned |
| Reranking | Rerank latency, score distribution |
| Synthesis | Answer latency, token usage, citation count |

Integrates with existing OpenTelemetry setup — traces exported to same OTLP collector as the Python service.

---

## 17. Security & Governance

| Concern | Mitigation |
|---------|-----------|
| Source provenance | Every answer includes citations with URLs and timestamps |
| Data poisoning | Content hash dedup; source reputation scoring (future) |
| Access control | Role-based query filtering via MongoDB (future) |
| PII handling | Optional PII detection in extraction; configurable redaction |
| Embedding versioning | Model version stored per chunk; re-index workflow on change |
| API key security | Environment variables only; never logged or stored in DB |

---

## 18. Failure Handling

| Failure | Handling |
|---------|---------|
| Crawl failure (404, timeout) | Retry 3x with backoff; mark failed in MongoDB |
| LLM extraction failure | Retry once; store chunk without entities; flag for review |
| Qdrant unavailable | Circuit breaker; queue writes; Neo4j+MongoDB fallback |
| Neo4j unavailable | Circuit breaker; vector-only retrieval (degraded) |
| Embedding drift | Store model version; detect distribution shift; trigger re-index |
| MinIO unavailable | Queue uploads; continue with in-memory raw content |

---

## 19. Implementation Phases

### Phase 1: Foundation (Week 1-2)

- [ ] Initialize `knowledge/` package (Bun, TypeScript, Hono)
- [ ] Storage interfaces and adapters (MongoDB, Qdrant, Neo4j, MinIO)
- [ ] Add Qdrant, Neo4j, MinIO to docker-compose.yml
- [ ] Basic ingestion: URL fetch → normalize → store raw → metadata
- [ ] Chunking and embedding pipeline
- [ ] Unit tests for ingestion, chunking, embedding
- [ ] Health check and status endpoints

### Phase 2: Knowledge Graph (Week 3-4)

- [ ] LLM-based entity extraction (structured output)
- [ ] Relationship extraction
- [ ] Neo4j graph storage (MERGE entities, CREATE relationships)
- [ ] Mastra IngestWorkflow and PreprocessWorkflow
- [ ] Entity deduplication (fuzzy matching)
- [ ] Tests for extraction, graph storage

### Phase 3: Retrieval & Synthesis (Week 5-6)

- [ ] Query parser (NL → entities + intent + filters)
- [ ] Neo4j graph expansion (multi-hop)
- [ ] Qdrant filtered vector search
- [ ] Mastra GraphRAG integration
- [ ] Cross-encoder reranking
- [ ] Context compression
- [ ] LLM synthesis with citations
- [ ] GraphRAGWorkflow and BatchIntelWorkflow
- [ ] Tests for retrieval pipeline

### Phase 4: Frontend Integration (Week 7-8)

- [ ] Knowledge tab in existing frontend
- [ ] Ingestion form and job status components
- [ ] Graph explorer (vis-network)
- [ ] Synthesis chat via CopilotKit
- [ ] Citation cards and entity detail views
- [ ] Knowledge base stats dashboard

### Phase 5: Polish & Optimization (Week 9-10)

- [ ] Two-level summarization
- [ ] Caching layer
- [ ] Observability (OpenTelemetry)
- [ ] Error handling hardening
- [ ] End-to-end integration tests
- [ ] Performance benchmarks

---

## 20. Dependencies (knowledge/package.json)

```json
{
  "name": "knowledge-worker",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "bun run --hot src/index.ts",
    "build": "bun build src/index.ts --outdir dist --target bun",
    "start": "bun dist/index.js",
    "test": "bun test",
    "lint": "eslint src/",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@mastra/core": "^1.5.0",
    "@mastra/qdrant": "^1.0.0",
    "@mastra/rag": "^1.0.0",
    "@ai-sdk/openai": "^3.0.30",
    "hono": "^4.0.0",
    "neo4j-driver": "^5.27.0",
    "mongodb": "^7.1.0",
    "@aws-sdk/client-s3": "^3.700.0",
    "zod": "^3.24.0",
    "cheerio": "^1.0.0",
    "pdf-parse": "^1.1.1",
    "rss-parser": "^3.13.0",
    "@opentelemetry/api": "^1.9.0",
    "@opentelemetry/sdk-node": "^0.57.0",
    "string-similarity-js": "^2.1.4"
  },
  "devDependencies": {
    "@types/bun": "latest",
    "typescript": "^5",
    "eslint": "^9"
  }
}
```

---

## 21. Dockerfile (knowledge-worker)

```dockerfile
FROM oven/bun:latest AS base
WORKDIR /app

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

COPY . .
RUN bun run build

FROM oven/bun:latest AS runner
WORKDIR /app

COPY --from=base /app/dist ./dist
COPY --from=base /app/node_modules ./node_modules
COPY --from=base /app/package.json ./

ENV NODE_ENV=production
ENV PORT=3002
EXPOSE 3002

CMD ["bun", "dist/index.js"]
```

---

## 22. API Endpoints (knowledge-worker)

### Ingestion

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/ingest` | Submit URLs for ingestion. Body: `{urls, crawlDepth?, tags?}` |
| `GET` | `/ingest/:jobId` | Get ingestion job status and progress |

### Knowledge Graph

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/knowledge/entities` | Search entities. Query: `?q=name&type=Organization&limit=20` |
| `GET` | `/knowledge/graph` | Get graph subgraph. Query: `?entityId=e123&hops=2&relTypes=ACQUIRED` |
| `GET` | `/knowledge/stats` | Knowledge base statistics |

### Synthesis

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/synthesize` | Single query synthesis. Body: `{query, filters?, maxSources?}` |
| `POST` | `/synthesize/batch` | Batch synthesis. Body: `{queries[], outputFormat}` |

### Status

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/status` | Health + connection status for all datastores |

---

## 23. Integration with Existing System

### What Stays the Same

- Python `api_agent/` — **zero modifications**
- Frontend API Explorer functionality — **unchanged**
- MongoDB instance — **shared** (new collections added)
- Docker Compose — **extended** (additive only)

### Integration Points

| Point | How |
|-------|-----|
| Frontend navigation | `page.tsx` adds tab switcher; Knowledge tab loads `knowledge-page.tsx` |
| Frontend → Knowledge API | Next.js route `/api/knowledge/` proxies to `knowledge-worker:3002` |
| Knowledge CopilotKit agent | New `knowledge-synthesizer` agent alongside existing `api-explorer` |
| MongoDB sharing | Same instance, separate collections (`documents`, `entities`, `ingestion_jobs`) |
| Observability | Same OTLP collector for traces from both Python and TS services |

---

## 24. Cost Estimation (Cloud, 100GB scale)

| Resource | Spec | Est. Monthly |
|----------|------|-------------|
| Qdrant Cloud | 30M vectors, 3-node | ~$300 |
| Neo4j Aura | 5M nodes, Professional | ~$200 |
| MongoDB Atlas | M10 shared replica | ~$60 |
| MinIO / S3 | 200GB storage | ~$5 |
| OpenAI Embeddings | 30M chunks (one-time) | ~$300 |
| OpenAI GPT-4o | Extraction + synthesis | ~$200-500 |
| Compute (3 workers) | 2 vCPU, 4GB each | ~$150 |
| **Total** | | **~$900-1,200/mo** |

---

## 25. Why This Architecture

This is not just a RAG pipeline. It is a **distributed knowledge synthesis engine** built on:

1. **Graph intelligence** — Neo4j enables multi-hop reasoning that vector search alone cannot
2. **Hybrid retrieval** — Graph + vector + metadata = maximum recall with precision
3. **Mastra orchestration** — Type-safe workflows with retry, parallelism, observability
4. **Additive integration** — Extends the platform without touching working code
5. **Scale-ready** — Single-node MVP with clear path to distributed deployment
6. **Future-proof** — Every storage and model layer behind abstraction interfaces
