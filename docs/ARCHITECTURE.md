# API Agent — Architectural Design Document

> **Status**: Draft — Pending Approval
> **Date**: 2026-02-23
> **Document Owner**: API Agent Contributors
> **License**: MIT (see [LICENSE](../LICENSE))

---

## 1. Executive Summary

API Agent is a universal MCP (Model Context Protocol) server that turns any GraphQL or REST API into a natural-language-queryable service. Users point at an API, ask questions in English, and the system introspects schemas, generates queries, fetches data, and applies SQL post-processing via DuckDB — all without writing custom integration code.

This document defines the system architecture for commercial deployment, with specific attention to ensuring all components use **commercially permissive licenses**.

---

## 2. License & Commercial Viability

### 2.1 Project License

API Agent is released under the **MIT License**, which grants unrestricted rights to use, modify, distribute, sublicense, and sell copies of the software commercially.

### 2.2 Dependency License Audit

Every component in the stack has been audited for commercial compatibility. No AGPL, GPL-linked, or copyleft-viral dependencies exist in the application code.

#### Core Application Dependencies (Python)

| Dependency | License | Commercial Use |
|-----------|---------|----------------|
| FastMCP | MIT | Unrestricted |
| OpenAI Agents SDK | MIT | Unrestricted |
| DuckDB | MIT | Unrestricted |
| httpx | BSD-3 | Unrestricted |
| Pydantic / Pydantic Settings | MIT | Unrestricted |
| uvicorn | BSD-3 | Unrestricted |
| Starlette | BSD-3 | Unrestricted |
| PyYAML | MIT | Unrestricted |
| RapidFuzz | MIT | Unrestricted |
| arize-otel | Apache 2.0 | Unrestricted |
| openinference-instrumentation | Apache 2.0 | Unrestricted |

#### Infrastructure Services

| Service | License | Usage Model | Commercial Impact |
|---------|---------|-------------|-------------------|
| **RustFS** (object storage) | **Apache 2.0** | Docker container, S3-compatible API | Unrestricted. Replaces MinIO (AGPL) to eliminate copyleft risk |
| **MongoDB** | SSPL v1 | Docker container, accessed via standard driver | Safe for commercial use as an internal database backend. SSPL only triggers if you offer MongoDB *itself* as a service to third parties |
| **Neo4j Community** | GPL v3 | Docker container, accessed via Bolt protocol | Safe for commercial use as a standalone server. GPL copyleft applies only to redistribution/modification of Neo4j itself, not to applications that connect to it over the network |
| **Qdrant** | Apache 2.0 | Docker container, REST/gRPC API | Unrestricted |

#### Frontend Dependencies (TypeScript)

| Dependency | License | Commercial Use |
|-----------|---------|----------------|
| Next.js | MIT | Unrestricted |
| React | MIT | Unrestricted |
| CopilotKit | MIT | Unrestricted |
| Mastra | Apache 2.0 | Unrestricted |
| TanStack Table | MIT | Unrestricted |
| Recharts | MIT | Unrestricted |
| shadcn/ui | MIT | Unrestricted |
| Tailwind CSS | MIT | Unrestricted |
| Hono | MIT | Unrestricted |
| Zod | MIT | Unrestricted |

### 2.3 Commercial Deployment Considerations

| Concern | Status | Notes |
|---------|--------|-------|
| Can I sell software built on this? | **Yes** | MIT license permits commercial sale |
| Can I use it as a SaaS? | **Yes** | No AGPL/SSPL in application code |
| Must I open-source my modifications? | **No** | MIT does not require source disclosure |
| Can I rebrand it? | **Yes** | MIT permits sublicensing |
| Are there patent concerns? | **No** | Apache 2.0 deps include explicit patent grants |
| MongoDB SSPL risk? | **Low** | Only applies if you offer MongoDB-as-a-Service to third parties |
| Neo4j GPL risk? | **Low** | Network use of a GPL database does not create a derivative work |

### 2.4 Risk Mitigation

For maximum commercial safety:

1. **Do not redistribute** Neo4j or MongoDB source code — use their official Docker images
2. **Do not offer** MongoDB or Neo4j as standalone managed services to third parties
3. **Use RustFS** (Apache 2.0) instead of MinIO (AGPL) for object storage
4. **Keep the MIT license** on all API Agent source code
5. If using Neo4j Enterprise features, obtain a **commercial license** from Neo4j Inc.

---

## 3. System Architecture

### 3.1 Component Overview

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                           Deployment Boundary                                │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────────┐ │
│  │  Frontend (Next.js + Bun) :3001                                        │ │
│  │                                                                         │ │
│  │  ┌──────────────────────┐     ┌──────────────────────────────────────┐ │ │
│  │  │ CopilotKit Chat UI   │     │ Data Visualization                   │ │ │
│  │  │ API Config Form      │     │ TanStack Table + shadcn/ui Charts    │ │ │
│  │  └──────────┬───────────┘     └──────────────────────────────────────┘ │ │
│  │             │ HTTP                                                      │ │
│  │             ▼                                                           │ │
│  │  ┌──────────────────────────────────────────┐                          │ │
│  │  │ Next.js API Routes                       │                          │ │
│  │  │ CopilotRuntime + Mastra MCPClient        │                          │ │
│  │  └──────────────────┬───────────────────────┘                          │ │
│  └─────────────────────┼───────────────────────────────────────────────────┘ │
│                        │ MCP (Streamable HTTP)                               │
│                        ▼                                                     │
│  ┌─────────────────────────────────────────────────────────────────────────┐ │
│  │  API Agent (Python FastMCP) :3000                                      │ │
│  │                                                                         │ │
│  │  ┌───────────────────┐  ┌──────────────────┐  ┌─────────────────────┐ │ │
│  │  │ MCP Endpoint /mcp │  │ Dynamic Middleware│  │ Recipe Cache (LRU)  │ │ │
│  │  │ Tool: {pfx}_query │  │ Tool Naming       │  │ r_{name} tools      │ │ │
│  │  │ Tool: {pfx}_exec  │  │ Context Extraction│  │ Schema-hash keyed   │ │ │
│  │  └────────┬──────────┘  └──────────────────┘  └─────────────────────┘ │ │
│  │           │                                                             │ │
│  │  ┌────────▼──────────────────────────────────────────────────────────┐ │ │
│  │  │  Agents (OpenAI Agents SDK)                                       │ │ │
│  │  │  ┌─────────────────┐  ┌──────────────────┐  ┌─────────────────┐  │ │ │
│  │  │  │ GraphQL Agent   │  │ REST Agent        │  │ Schema Search   │  │ │ │
│  │  │  │ Introspection   │  │ OpenAPI Parsing   │  │ Grep-like       │  │ │ │
│  │  │  │ Query Generation│  │ Endpoint Discovery│  │                 │  │ │ │
│  │  │  └────────┬────────┘  └────────┬──────────┘  └─────────────────┘  │ │ │
│  │  │           │                    │                                    │ │ │
│  │  │  ┌────────▼────────────────────▼──────────────────────────────┐    │ │ │
│  │  │  │ Executors                                                   │    │ │ │
│  │  │  │ ┌────────────────┐  ┌────────────────────────────────────┐ │    │ │ │
│  │  │  │ │ HTTP Client    │  │ DuckDB (SQL Post-Processing)       │ │    │ │ │
│  │  │  │ │ httpx          │  │ In-memory, per-request isolation   │ │    │ │ │
│  │  │  │ └────────┬───────┘  └────────────────────────────────────┘ │    │ │ │
│  │  │  └──────────┼──────────────────────────────────────────────────┘    │ │ │
│  │  └─────────────┼──────────────────────────────────────────────────────┘ │ │
│  └────────────────┼────────────────────────────────────────────────────────┘ │
│                   │ HTTPS                                                    │
│                   ▼                                                          │
│           Target APIs (External)                                             │
│           GraphQL / REST endpoints                                           │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────────┐ │
│  │  Data Layer                                                             │ │
│  │  ┌──────────────┐  ┌───────────────┐  ┌──────────────────────────────┐ │ │
│  │  │ MongoDB :27017│  │ Qdrant :6333  │  │ Neo4j :7474/:7687           │ │ │
│  │  │ SSPL          │  │ Apache 2.0    │  │ GPL v3 (network use safe)   │ │ │
│  │  │ Metadata      │  │ Vector Search │  │ Knowledge Graph             │ │ │
│  │  └──────────────┘  └───────────────┘  └──────────────────────────────┘ │ │
│  │  ┌──────────────────────────┐                                          │ │
│  │  │ RustFS (S3) :9000/:9001 │                                          │ │
│  │  │ Apache 2.0               │                                          │ │
│  │  │ Raw Document Storage     │                                          │ │
│  │  └──────────────────────────┘                                          │ │
│  └─────────────────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────────────┘
```

### 3.2 Service Inventory

| Service | Language | Port | Purpose | License |
|---------|----------|------|---------|---------|
| `api-agent` | Python 3.11 | 3000 | MCP server, agent orchestration, DuckDB SQL | MIT |
| `frontend` | TypeScript (Bun) | 3001 | Web UI, CopilotKit chat, data visualization | MIT |
| `knowledge-worker` | TypeScript (Bun) | 3002 | Knowledge synthesis engine (enhancement) | MIT |
| `mongodb` | — | 27017 | Document metadata, session state | SSPL (safe) |
| `qdrant` | — | 6333 | Vector embeddings, similarity search | Apache 2.0 |
| `neo4j` | — | 7474/7687 | Knowledge graph, entity relationships | GPL v3 (safe) |
| `rustfs` | — | 9000/9001 | S3-compatible object storage | Apache 2.0 |

---

## 4. Core Request Flow

```
User (Natural Language Question)
    │
    ▼
[1] MCP Client sends request with headers:
    X-Target-URL: https://api.example.com/graphql
    X-API-Type: graphql
    X-Target-Headers: {"Authorization": "Bearer ..."}
    │
    ▼
[2] DynamicToolNamingMiddleware (middleware.py)
    - Extracts RequestContext from HTTP headers
    - Generates session-specific tool names ({prefix}_query, {prefix}_execute)
    │
    ▼
[3] Tool Dispatch (tools/query.py)
    - Routes to GraphQL or REST agent based on X-API-Type
    │
    ▼
[4] Agent Loop (OpenAI Agents SDK, max 30 turns)
    - Schema introspection (GraphQL) or OpenAPI parsing (REST)
    - Dynamic tool creation: graphql_query/rest_call, sql_query, search_schema
    - Iterative query refinement
    │
    ▼
[5] HTTP Execution (httpx)
    - Sends generated query/request to target API
    - Response stored in DuckDB
    │
    ▼
[6] SQL Post-Processing (DuckDB)
    - Rankings, filters, JOINs, aggregations
    - Results truncated to ~32K chars
    │
    ▼
[7] Recipe Extraction (optional)
    - Successful query → parameterized template
    - Cached as reusable MCP tool (r_{name})
    │
    ▼
[8] Response returned to MCP client
    {ok: true, data: [...], queries: [...]}
```

---

## 5. Module Architecture

### 5.1 Python Backend (`api_agent/`)

```
api_agent/
├── __main__.py          # Entry point, FastMCP app with middleware
├── config.py            # Settings via pydantic-settings (API_AGENT_ prefix)
├── context.py           # Header parsing → RequestContext
├── middleware.py         # Dynamic tool naming per session
├── executor.py          # DuckDB SQL execution, table extraction
├── tracing.py           # OpenTelemetry tracing via OTLP
│
├── tools/
│   ├── query.py         # _query tool (NL → agent)
│   └── execute.py       # _execute tool (direct API call)
│
├── agent/
│   ├── graphql_agent.py # GraphQL agent with introspection
│   ├── rest_agent.py    # REST agent with OpenAPI parsing
│   ├── prompts.py       # Shared system prompt fragments
│   ├── model.py         # LLM configuration
│   ├── progress.py      # Turn tracking
│   ├── schema_search.py # Grep-like schema search tool
│   └── contextvar_utils.py
│
├── recipe/
│   ├── store.py         # RecipeStore (LRU in-memory, thread-safe)
│   ├── extractor.py     # Extract reusable recipes from agent runs
│   ├── runner.py        # Execute recipes without agent context
│   ├── common.py        # Recipe validation, parameter binding
│   └── naming.py        # Tool name sanitization
│
├── graphql/             # GraphQL client (httpx)
├── rest/                # REST client (httpx) + OpenAPI loader
└── utils/
    └── csv.py           # CSV conversion via DuckDB
```

### 5.2 Frontend (`frontend/`)

```
frontend/
├── src/
│   ├── app/
│   │   ├── layout.tsx             # CopilotKit provider
│   │   ├── page.tsx               # Main page with tabs
│   │   └── api/
│   │       ├── copilotkit/route.ts  # CopilotRuntime endpoint
│   │       └── health/route.ts
│   │
│   ├── components/
│   │   ├── api-config-form.tsx    # API connection form
│   │   ├── chat-panel.tsx         # CopilotKit chat
│   │   ├── data-table/            # TanStack Table + shadcn/ui
│   │   └── charts/                # Recharts + shadcn/ui Charts
│   │
│   └── lib/
│       ├── mcp-client.ts          # Mastra MCPClient factory
│       ├── mastra-agent.ts        # Mastra Agent with MCP tools
│       └── data-inference.ts      # Column type & chart inference
```

### 5.3 Knowledge Synthesis Engine (`knowledge/`) — Enhancement

```
knowledge/
├── src/
│   ├── index.ts                   # Hono HTTP server
│   ├── config.ts                  # Environment config
│   │
│   ├── ingestion/                 # Crawl, normalize, deduplicate
│   │   └── raw-store.ts           # RustFS/S3 raw document storage
│   │
│   ├── preprocessing/             # Chunk, embed, extract entities
│   ├── storage/
│   │   ├── interfaces.ts          # IVectorStore, IGraphStore, etc.
│   │   ├── mongodb.ts             # MongoDB adapter
│   │   ├── qdrant.ts              # Qdrant adapter
│   │   ├── neo4j.ts               # Neo4j adapter
│   │   └── rustfs.ts              # RustFS/S3 adapter
│   │
│   ├── retrieval/                 # Hybrid retrieval (graph + vector)
│   ├── synthesis/                 # LLM synthesis with citations
│   ├── workflows/                 # Mastra workflow definitions
│   └── agents/                    # Knowledge synthesis agents
```

---

## 6. Data Architecture

### 6.1 DuckDB (Core, In-Process)

- **Scope**: Per-request, in-memory
- **Purpose**: SQL post-processing of API responses
- **License**: MIT
- **Data lifecycle**: Created per agent run, discarded after response

### 6.2 MongoDB (Shared Metadata Store)

- **Purpose**: Document metadata, ingestion jobs, entity records, session state
- **Access**: Standard MongoDB driver over TCP
- **License consideration**: SSPL applies only if offering MongoDB as a managed database service to third parties. Using it as an internal component is explicitly permitted.

### 6.3 Qdrant (Vector Search)

- **Purpose**: Chunk embeddings, similarity search, filtered retrieval
- **Access**: REST/gRPC API
- **License**: Apache 2.0 — no restrictions

### 6.4 Neo4j Community (Knowledge Graph)

- **Purpose**: Entity-relationship storage, multi-hop graph traversal, Cypher queries
- **Access**: Bolt protocol (network)
- **License consideration**: GPL v3 copyleft applies to redistribution of Neo4j source code, not to applications that connect to Neo4j over the network. This is the same model as MySQL (also GPL), which is widely used commercially.

### 6.5 RustFS (Object Storage)

- **Purpose**: Raw document archival, S3-compatible API
- **Access**: S3 API over HTTP
- **License**: Apache 2.0 — no restrictions
- **Why RustFS over MinIO**: MinIO uses AGPL v3, which requires source code disclosure for any network service that uses it. RustFS provides identical S3 compatibility under the commercially permissive Apache 2.0 license.

---

## 7. Safety & Security Architecture

### 7.1 API Safety

| Control | Mechanism |
|---------|-----------|
| Read-only by default | GraphQL mutations blocked; REST POST/PUT/DELETE/PATCH blocked |
| Opt-in writes | `X-Allow-Unsafe-Paths` header with glob patterns |
| Output capping | All responses truncated to ~32K chars (`MAX_TOOL_RESPONSE_CHARS`) |
| Request isolation | ContextVar per request; DuckDB per agent run |

### 7.2 Authentication

| Layer | Method |
|-------|--------|
| Client → MCP Server | HTTP headers (X-Target-Headers) |
| MCP Server → Target API | Forwarded auth headers |
| Frontend → Backend | Server-side proxy (tokens never exposed to browser) |

### 7.3 Data Governance

| Concern | Mitigation |
|---------|-----------|
| Secret exposure | Auth tokens in env vars only, never logged or stored |
| Source provenance | Knowledge synthesis answers include citations with URLs |
| PII handling | Optional PII detection in entity extraction |
| Embedding versioning | Model version stored per chunk; re-index on change |

---

## 8. Deployment Architecture

### 8.1 Docker Compose (Development / Single-Node Production)

```yaml
services:
  api-agent:          # Python FastMCP :3000
  frontend:           # Next.js + Bun :3001
  knowledge-worker:   # TypeScript + Bun :3002 (enhancement)
  mongodb:            # Mongo 7 :27017
  qdrant:             # Qdrant :6333
  neo4j:              # Neo4j Community :7474/:7687
  rustfs:             # RustFS (S3) :9000/:9001
```

### 8.2 Scaling Strategy

| Phase | Scale | Changes |
|-------|-------|---------|
| **MVP** | Single node | All services on one host via Docker Compose |
| **Medium** | 100GB+ data | Qdrant 3-node cluster, Neo4j read replicas, 3+ workers, RustFS distributed |
| **Large** | 1TB+ data | Qdrant multi-shard, Neo4j causal cluster, GPU embedding workers, message queue |

### 8.3 Cloud Deployment Options

All components are containerized and can be deployed to any cloud:

| Component | Self-Hosted | Managed Alternative |
|-----------|-------------|-------------------|
| RustFS | Docker / K8s | AWS S3, GCS, Azure Blob (drop-in S3 replacement) |
| MongoDB | Docker / K8s | MongoDB Atlas |
| Qdrant | Docker / K8s | Qdrant Cloud |
| Neo4j | Docker / K8s | Neo4j Aura |
| Compute | Docker / K8s | ECS, GKE, AKS |

---

## 9. Configuration Reference

### 9.1 Core API Agent

| Variable | Required | Default | Description |
|---------|----------|---------|-------------|
| `OPENAI_API_KEY` | Yes | — | OpenAI API key (or custom LLM key) |
| `OPENAI_BASE_URL` | No | `https://api.openai.com/v1` | Custom LLM endpoint |
| `API_AGENT_MODEL_NAME` | No | `gpt-5.2` | LLM model identifier |
| `API_AGENT_PORT` | No | `3000` | Server port |
| `API_AGENT_ENABLE_RECIPES` | No | `true` | Enable recipe learning |
| `API_AGENT_RECIPE_CACHE_SIZE` | No | `64` | Max cached recipes (LRU) |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | No | — | OpenTelemetry endpoint |

### 9.2 Knowledge Enhancement

| Variable | Required | Default | Description |
|---------|----------|---------|-------------|
| `QDRANT_URL` | No | `http://qdrant:6333` | Qdrant connection URL |
| `NEO4J_URI` | No | `bolt://neo4j:7687` | Neo4j Bolt URI |
| `NEO4J_USER` | No | `neo4j` | Neo4j username |
| `NEO4J_PASSWORD` | No | `knowledge123` | Neo4j password |
| `RUSTFS_ENDPOINT` | No | `rustfs:9000` | RustFS S3 endpoint |
| `RUSTFS_ACCESS_KEY` | No | `rustfsadmin` | RustFS access key |
| `RUSTFS_SECRET_KEY` | No | `rustfsadmin` | RustFS secret key |
| `KNOWLEDGE_MODEL` | No | `gpt-4o` | LLM for extraction & synthesis |

---

## 10. Observability

All services emit OpenTelemetry traces to a shared OTLP collector. Compatible with:

- Jaeger
- Zipkin
- Grafana Tempo
- Arize Phoenix
- Any OTLP-compatible backend

### Metrics Coverage

| Layer | Metrics |
|-------|---------|
| MCP Server | Request latency, tool call counts, agent turns per query |
| Agents | LLM token usage, API call counts, schema introspection time |
| DuckDB | SQL execution time, row counts, truncation events |
| Recipes | Cache hit/miss rate, recipe creation events |
| Knowledge (enhancement) | Ingestion throughput, embedding latency, graph expansion time |

---

## 11. Related Design Documents

| Document | Description |
|----------|-------------|
| [DESIGN-MCP-COPILOTKIT-MASTRA.md](./DESIGN-MCP-COPILOTKIT-MASTRA.md) | Frontend architecture: CopilotKit + Mastra MCP Client integration |
| [ENHANCEMENT-AI-KNOWLEDGE-SYNTHESIS.md](./ENHANCEMENT-AI-KNOWLEDGE-SYNTHESIS.md) | Knowledge synthesis engine: Qdrant, Neo4j, RustFS, Graph RAG |
| [README.md](../README.md) | Quick start, usage examples, API reference |
| [CONTRIBUTING.md](../CONTRIBUTING.md) | Development setup and contribution guidelines |

---

## 12. Decision Log

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Object storage | RustFS (Apache 2.0) over MinIO (AGPL v3) | AGPL requires source disclosure for network services; Apache 2.0 has no such restriction |
| Project license | MIT | Maximum commercial flexibility |
| Graph database | Neo4j Community (GPL v3) | Network use does not trigger copyleft; industry-standard for knowledge graphs |
| Document store | MongoDB (SSPL) | SSPL only applies when offering MongoDB as a service; safe for internal use |
| Vector database | Qdrant (Apache 2.0) | Permissive license, native Mastra integration |
| Agent framework | OpenAI Agents SDK (MIT) | Proven agent loop with tool calling |
| MCP framework | FastMCP (MIT) | Lightweight, streamable-http native |
| SQL engine | DuckDB (MIT) | In-process, zero-dependency analytical SQL |
| Frontend runtime | Bun | Faster installs and builds, Next.js compatible |
| Storage abstraction | Interface-based adapters | Swap any storage backend without code changes |

---

## 13. Approval

This document requires approval before implementation proceeds.

| Role | Name | Date | Signature |
|------|------|------|-----------|
| Technical Lead | | | |
| Product Owner | | | |
| Engineering Manager | | | |
| Legal / Compliance | | | |
