# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

**Setup:**
```bash
uv sync --group dev
```

**Run server:**
```bash
uv run api-agent                    # Local dev
# Or direct (no clone): uvx --from git+https://github.com/agoda-com/api-agent api-agent
# Server starts on http://localhost:3000/mcp
```

**Tests:**
```bash
uv run pytest tests/ -v                             # All tests
uv run pytest tests/test_executor.py -v             # Single test file
uv run pytest tests/test_executor.py::test_bar -v   # Single test
```

**Linting & Formatting:**
```bash
uv run ruff check api_agent/
uv run ruff check --fix api_agent/   # Auto-fix
uv run ruff format api_agent/        # Format
uv run ty check                      # Type check
```

**Docker:**
```bash
docker build -t api-agent .
docker run -p 3000:3000 -e OPENAI_API_KEY="..." api-agent
```

## Architecture

**MCP Server (FastMCP)** receives NL queries + headers → routes to **Agents** (OpenAI Agents SDK) → agents call target APIs + DuckDB for SQL processing.

### Request Flow

1. **Client** sends MCP request w/ headers (`X-Target-URL`, `X-API-Type`, `X-Target-Headers`)
2. **middleware.py**: `DynamicToolNamingMiddleware` transforms tool names per session (e.g., `_query` → `flights_api_query` based on URL) and loads API schema on `list_tools`
3. **context.py**: Extracts `RequestContext` from headers
4. **tools/query.py**: Routes to GraphQL or REST agent based on `X-API-Type`
5. **agent/graphql_agent.py** or **agent/rest_agent.py**:
   - Fetches schema (introspection or OpenAPI 3.x)
   - Searches recipe store for matching cached pipelines
   - Creates agent w/ dynamic tools (`graphql_query`/`rest_call`, `sql_query`, `search_schema`, and any matched recipe tools)
   - Runs agent loop (max 30 turns, configurable)
   - Extracts and saves recipes from successful runs
   - Returns results (optionally as CSV for `return_directly` mode)
6. **executor.py**: DuckDB integration for SQL post-processing via temp JSON files

### Key Modules

- **api_agent/**: Main package
  - **__init__.py**: Package marker
  - **__main__.py**: Entry point, creates FastMCP app with CORS middleware, health endpoint (`/health`), and `DynamicToolNamingMiddleware`
  - **config.py**: `Settings` class via `pydantic-settings` (env vars w/ `API_AGENT_` prefix, `.env` file support)
  - **context.py**: Header parsing → `RequestContext` dataclass (frozen), tool name prefix generation from URL
  - **middleware.py**: `DynamicToolNamingMiddleware` — transforms tool names on `list_tools`/`call_tool`, handles recipe tool routing
  - **executor.py**: DuckDB SQL execution via temp JSON files, table extraction from API responses, context truncation
  - **tracing.py**: OpenTelemetry tracing via OTLP with `openinference` instrumentation for OpenAI Agents SDK (works with Arize Phoenix, Jaeger, Zipkin, Grafana Tempo, etc.)

- **api_agent/tools/**: MCP tool implementations
  - **__init__.py**: `register_all_tools()` — registers `_query` and `_execute`
  - **query.py**: `_query` tool — NL question → agent → structured response; handles `return_directly` as CSV, notifies clients on recipe changes via `send_tool_list_changed()`
  - **execute.py**: `_execute` tool — direct GraphQL/REST call with explicit params (query/variables or method/path/body)

- **api_agent/agent/**: Agent logic (OpenAI Agents SDK)
  - **graphql_agent.py**: GraphQL agent — introspection (full + shallow fallback for depth-limited APIs), compact SDL context, `graphql_query`/`sql_query`/`search_schema` tools, recipe tool creation
  - **rest_agent.py**: REST agent — OpenAPI 3.x parsing, `rest_call`/`sql_query`/`search_schema`/`poll_until_done` tools, recipe tool creation
  - **prompts.py**: Shared system prompt fragments (SQL rules, schema notation, decision guidance for recipe vs. direct calls, tool usage rules, persistence/uncertainty specs)
  - **model.py**: Shared `OpenAIChatCompletionsModel` instance, `RunConfig` with optional reasoning effort, turn injection via `call_model_input_filter`
  - **progress.py**: ContextVar-based turn counter, injected into instructions before each LLM call
  - **schema_search.py**: `create_search_schema_tool()` factory — grep-like regex search on raw schema JSON with pagination (offset), context lines (before/after), char budget truncation
  - **contextvar_utils.py**: `safe_get_contextvar()` and `safe_append_contextvar_list()` helpers for LookupError-safe access

- **api_agent/recipe/**: Parameterized pipeline caching
  - **__init__.py**: Re-exports all public API from submodules
  - **store.py**: `RecipeStore` — thread-safe LRU cache (OrderedDict), `RecipeRecord` dataclass, RapidFuzz-based similarity matching (`token_set_ratio` + `partial_token_set_ratio`), `sha256_hex` with JSON normalization, `render_text_template` (`{{param}}`) and `render_param_refs` (`{"$param": "name"}`)
  - **extractor.py**: LLM-assisted recipe extraction — `extract_recipe()` uses a dedicated agent to convert execution traces into parameterized templates, validates round-trip equivalence (rendered template must match original)
  - **runner.py**: `execute_recipe_tool()` — recipe execution outside agent context for MCP middleware; `load_schema_and_base_url()` for schema fetching
  - **common.py**: Recipe validation (`validate_recipe_params`, `validate_and_prepare_recipe`), execution (`execute_recipe_steps`, `_execute_sql_steps`), `_return_directly_flag` ContextVar, `_tools_to_final_output` callback, `create_params_model` (Pydantic dynamic model), `search_recipes`, `build_recipe_context`, deduplication
  - **naming.py**: `sanitize_tool_name()` — normalizes to safe slug

- **api_agent/utils/**: Shared utilities
  - **csv.py**: `to_csv()` — converts JSON data to CSV via DuckDB `read_json_auto` (for recipe `return_directly` output)

- **api_agent/graphql/**: GraphQL client
  - **client.py**: `execute_query()` — httpx POST with 30s timeout, mutation blocking via regex, error extraction

- **api_agent/rest/**: REST client + OpenAPI loader
  - **client.py**: `execute_request()` — httpx with 30s timeout, unsafe method blocking (POST/PUT/DELETE/PATCH) with glob-pattern allowlist, path param substitution, query param encoding
  - **schema_loader.py**: `load_openapi_spec()` (JSON/YAML), `build_schema_context()` — compact DSL with only required fields/params shown, `get_base_url_from_spec()` fallback from spec URL

### Configuration

All settings are in `api_agent/config.py` via `pydantic-settings`. Prefix env vars with `API_AGENT_` (or use `.env` file).

| Setting | Default | Description |
|---------|---------|-------------|
| `MCP_NAME` | `"API Agent"` | MCP server display name |
| `SERVICE_NAME` | `"api-agent"` | OpenTelemetry service name |
| `OPENAI_API_KEY` | `""` | LLM API key (also reads unprefixed `OPENAI_API_KEY`) |
| `OPENAI_BASE_URL` | `"https://api.openai.com/v1"` | LLM endpoint (also reads unprefixed `OPENAI_BASE_URL`) |
| `MODEL_NAME` | `"gpt-5.2"` | LLM model identifier |
| `REASONING_EFFORT` | `""` | `"low"`, `"medium"`, `"high"`, or empty to disable |
| `MAX_AGENT_TURNS` | `30` | Max agent loop iterations per query |
| `MAX_RESPONSE_CHARS` | `50000` | Max chars for direct execute tool responses |
| `MAX_SCHEMA_CHARS` | `32000` | Max chars for schema context sent to LLM |
| `MAX_PREVIEW_ROWS` | `10` | Rows to show before suggesting pagination |
| `MAX_TOOL_RESPONSE_CHARS` | `32000` | Cap on tool responses for LLM context (~8K tokens) |
| `MAX_POLLS` | `20` | Max polling attempts for `poll_until_done` |
| `DEFAULT_POLL_DELAY_MS` | `3000` | Default delay between polls (ms) |
| `DEBUG` | `False` | Enable debug logging |
| `HOST` | `"0.0.0.0"` | Server bind address |
| `PORT` | `3000` | Server port |
| `TRANSPORT` | `"streamable-http"` | MCP transport (`"http"`, `"streamable-http"`, `"sse"`) |
| `CORS_ALLOWED_ORIGINS` | `"*"` | Comma-separated CORS origins |
| `ENABLE_RECIPES` | `True` | Enable recipe extraction and caching |
| `RECIPE_CACHE_SIZE` | `64` | Max recipes in LRU cache |

### Request Headers

| Header | Required | Description |
|--------|----------|-------------|
| `X-Target-URL` | Yes | GraphQL endpoint or OpenAPI spec URL |
| `X-API-Type` | Yes | `"graphql"` or `"rest"` |
| `X-Target-Headers` | No | JSON object with auth/custom headers to forward |
| `X-API-Name` | No | Override tool name prefix (instead of deriving from URL) |
| `X-Allow-Unsafe-Paths` | No | JSON array of glob patterns enabling POST/PUT/DELETE/PATCH |
| `X-Base-URL` | No | Override base URL for REST API calls |
| `X-Include-Result` | No | Include full uncapped `result` field in output (`"true"`/`"false"`) |
| `X-Poll-Paths` | No | JSON array of paths requiring polling (enables `poll_until_done` tool) |

### Context Management

All outputs capped at ~32k chars (`MAX_TOOL_RESPONSE_CHARS`) to prevent LLM overflow:
- **Query results**: Truncate by char count, show complete rows that fit, include schema hint when truncated
- **Schema**: Truncate large schemas, use `search_schema()` for exploration
- **Single objects**: Wrapped as 1-row table, return DuckDB schema summary instead of full data

Agents use **ContextVar** for request isolation. Each agent module defines its own set: `_graphql_queries`/`_rest_calls`, `_query_results`, `_last_result`, `_raw_schema`, `_recipe_steps`, `_sql_steps`. Use mutable containers (lists/dicts) since `ContextVar.set()` in child tasks (task groups) doesn't propagate to parent — mutate in-place instead.

### Tool Naming

Tools have internal names (`_query`, `_execute`) transformed by middleware per session:
- **Format**: `{prefix}_query`, `{prefix}_execute` — prefix from `X-API-Name` header or hostname
- Skips generic parts: TLDs (`com`, `io`, `net`, `org`), infra (`api`, `qa`, `dev`, `internal`, `privatecloud`)
- Prefix capped at 32 chars
- **Recipe tools**: `r_{slug}` (not API-specific), max 60 chars; `send_tool_list_changed()` notifies clients when new recipes are created

### Safety

- **GraphQL**: Mutations blocked via regex (`^\s*mutation\b`) — queries only
- **REST**: POST/PUT/DELETE/PATCH blocked by default, enable via `X-Allow-Unsafe-Paths` header (glob patterns matched with `fnmatch`)

### Polling (REST only)

Set `X-Poll-Paths` header (JSON array) to enable `poll_until_done` tool:
- Auto-increments `polling.count` in body between polls
- Checks `done_field` (dot-path like `"status"`, `"trips.0.isCompleted"`) against `done_value` (case-insensitive string comparison)
- Validates `done_field` exists on first response
- Max 20 polls (configurable via `MAX_POLLS`), default 3s delay (`DEFAULT_POLL_DELAY_MS`)
- Recipes skip extraction when polling was used

### Recipes

Caches parameterized API call + SQL pipelines from successful agent runs, exposed as MCP tools:

```
Query → Agent executes → Extractor LLM → Validates round-trip → Recipe stored → MCP tool `r_{name}` exposed
```

- **Storage**: LRU in-memory (default 64 entries), keyed by `(api_id, schema_hash)` — auto-invalidates on schema change
- **Matching**: RapidFuzz similarity scoring (token_set_ratio 55% + partial_token_set_ratio 25% + token overlap 20%), top-k=3 suggestions injected into agent system prompt
- **Deduplication**: Skips equivalent recipes (same steps/sql/params), ensures unique tool names via counter suffix
- **Templating**: GraphQL `{{param}}`, REST `{"$param": "name"}`, SQL `{{param}}`
- **Validation**: Extracted recipes must render back to original execution with default param values
- **Param model**: Dynamic Pydantic model with `extra="forbid"`, all params required (stored defaults are examples, not fallbacks)
- **Config**: `ENABLE_RECIPES` (default: True), `RECIPE_CACHE_SIZE` (default: 64)

### Tracing

Set `OTEL_EXPORTER_OTLP_ENDPOINT` env var to enable OpenTelemetry tracing:
- Uses `openinference-instrumentation-openai-agents` for automatic agent span instrumentation
- Exports via OTLP HTTP to `{endpoint}/v1/traces`
- Service name from `SERVICE_NAME` setting (default: `"api-agent"`)
- Span metadata includes `mcp_name` and `agent_type` (`"graphql"` or `"rest"`)
- No-op context managers when tracing is disabled

## Dependencies

| Package | Purpose |
|---------|---------|
| `fastmcp` (>=2.13.3) | MCP server framework with middleware support |
| `openai-agents` (>=0.0.3) | OpenAI Agents SDK (Agent, Runner, function_tool) |
| `httpx` (>=0.28.1) | Async HTTP client for API calls and schema fetching |
| `duckdb` (>=1.0.0) | In-process SQL engine for result post-processing |
| `pydantic` (>=2.12.5) | Data validation, dynamic model creation for recipe params |
| `pydantic-settings` (>=2.12.0) | Environment-based configuration |
| `pyyaml` (>=6.0) | YAML parsing for OpenAPI specs |
| `rapidfuzz` (>=3.0.0) | Fuzzy string matching for recipe similarity |
| `starlette` (>=0.50.0) | CORS middleware, health endpoint routing |
| `uvicorn` (>=0.38.0) | ASGI server |
| `arize-otel` (>=0.11.0) | OpenTelemetry convenience setup |
| `openinference-instrumentation-openai-agents` (>=1.4.0) | Agent tracing instrumentation |

Dev dependencies: `pytest`, `pytest-asyncio`, `ruff`, `ty`

## Testing

Tests use `pytest-asyncio` with mock httpx for HTTP calls. Test files:

| Test file | Covers |
|-----------|--------|
| `test_context.py` | Header parsing, `RequestContext`, tool name prefix generation |
| `test_executor.py` | DuckDB SQL execution, table extraction, truncation |
| `test_middleware.py` | Dynamic tool naming middleware |
| `test_rest_client.py` | REST client, unsafe method blocking, URL building |
| `test_rest_schema.py` | OpenAPI spec loading, compact schema context building |
| `test_schema_context.py` | GraphQL introspection, SDL context building |
| `test_search_schema.py` | Grep-like schema search with pagination |
| `test_query_response.py` | Query tool response building |
| `test_poll_tool.py` | Polling tool behavior |
| `test_recipe_store.py` | Recipe store LRU cache, similarity matching |
| `test_recipe_extraction.py` | LLM recipe extraction and validation |
| `test_recipe_runner.py` | Recipe execution outside agent context |
| `test_recipe_tool_creation.py` | Dynamic recipe tool creation |
| `test_recipe_tool_integration.py` | Recipe tool end-to-end integration |
| `test_individual_recipe_tools.py` | Individual recipe tool generation |

CI runs tests + linting + type checking on Python 3.11/3.12 (`.github/workflows/test.yml`). Docker build is also validated in CI.

## Code Conventions

- **Python 3.11+** required (uses `X | Y` union syntax, `match` statements)
- **Ruff** for linting and formatting — rules: `E`, `F`, `I`, `W`; ignores `E501` (line length) and `E402` (import order); line length target: 100
- **Type hints** throughout; `ty` for type checking
- **Async-first**: all HTTP calls and agent runs are async; tools use `@function_tool` decorator from OpenAI Agents SDK
- **ContextVar pattern**: mutable containers for cross-task propagation; always reset at request start
- **Error handling**: API clients return `{"success": bool, "data"/"error": ...}` dicts; never raise on API failures
- **Logging**: `logging.getLogger(__name__)` in each module; debug-gated verbose logging via `settings.DEBUG` with `_log()` helper functions
- **Build system**: Hatchling with `uv` for dependency management; `uv.lock` for reproducible installs
