# Architectural Design: CopilotKit + Mastra MCP Client + API Agent

> **Status**: Draft — Pending Approval
> **Date**: 2026-02-21
> **Scope**: Add a Next.js frontend (Bun runtime) that uses CopilotKit + Mastra MCPClient to dynamically connect to the existing Python API Agent MCP server, with data visualization via shadcn/ui Charts and TanStack Table.

---

## 1. Problem Statement

The existing **api-agent** Python service is a powerful MCP server that can connect to _any_ GraphQL or REST API and retrieve data via natural language. However, it has no user-facing frontend — it only exposes an MCP endpoint (`/mcp`) that requires an MCP-compatible client to interact with.

**Goal**: Build a web-based frontend where users can:
1. Provide an API URL (GraphQL endpoint or OpenAPI spec) via an input form
2. Chat with the API in natural language via CopilotKit
3. See results rendered as interactive **data tables** (TanStack Table + shadcn/ui) and **charts** (shadcn/ui Charts + Recharts)
4. Have the system dynamically create a Mastra MCPClient connection to the Python MCP server, passing the user-provided API configuration as custom headers

---

## 2. High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Docker Compose                               │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │           frontend (Next.js + Bun)  :3001                   │   │
│  │                                                              │   │
│  │  ┌────────────────────┐  ┌────────────────────────────────┐ │   │
│  │  │  React Frontend    │  │  Next.js API Routes            │ │   │
│  │  │                    │  │                                │ │   │
│  │  │  CopilotKit UI     │  │  /api/copilotkit  ◄────────┐  │ │   │
│  │  │  - Chat Panel      │  │    │                       │  │ │   │
│  │  │  - Data Table      │  │    ▼                       │  │ │   │
│  │  │  - Charts          │  │  CopilotRuntime            │  │ │   │
│  │  │  - API Config Form │  │    │                       │  │ │   │
│  │  │                    │  │    ▼                       │  │ │   │
│  │  │  shadcn/ui +       │  │  Mastra MCPClient ─────┐  │  │ │   │
│  │  │  TanStack Table +  │  │  (dynamic per-session)  │  │  │ │   │
│  │  │  Recharts          │  │                         │  │  │ │   │
│  │  └────────────────────┘  └─────────────────────────┼──┘ │   │
│  │                                                     │    │   │
│  └─────────────────────────────────────────────────────┼────┘   │
│                                                         │        │
│            Streamable HTTP (MCP protocol)               │        │
│            + Custom headers per session                  │        │
│                                                         ▼        │
│  ┌──────────────────────────────────────────────────────────────┐ │
│  │           api-agent (Python FastMCP)  :3000                 │ │
│  │                                                              │ │
│  │  MCP Endpoint: /mcp                                         │ │
│  │  Transport: streamable-http                                 │ │
│  │                                                              │ │
│  │  Headers (per-session):                                     │ │
│  │    X-Target-URL     → GraphQL endpoint / OpenAPI spec URL   │ │
│  │    X-API-Type       → "graphql" | "rest"                    │ │
│  │    X-Target-Headers → JSON auth headers                     │ │
│  │    X-API-Name       → friendly name (optional)              │ │
│  │    X-Base-URL       → override base URL (REST, optional)    │ │
│  │                                                              │ │
│  │  Dynamic Tools (per session):                               │ │
│  │    {prefix}_query   → NL question → agent → data            │ │
│  │    {prefix}_execute → direct API call                       │ │
│  │    r_{name}         → cached recipe tools                   │ │
│  │                                                              │ │
│  │  Agents: GraphQL Agent / REST Agent (OpenAI Agents SDK)     │ │
│  │  Data: DuckDB for SQL post-processing                       │ │
│  └──────────────────────────────────────────────────────────────┘ │
│                          │                                        │
│                          ▼                                        │
│                 Target APIs (external)                             │
│                 GraphQL / REST endpoints                           │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 3. Component Breakdown

### 3.1 Docker Compose Services

| Service | Runtime | Port | Description |
|---------|---------|------|-------------|
| `frontend` | Bun + Next.js | 3001 | CopilotKit UI, Mastra MCPClient, shadcn/ui, TanStack Table |
| `api-agent` | Python 3.11 | 3000 | Existing FastMCP server (unchanged) |

```yaml
# docker-compose.yml (new)
version: "3.8"

services:
  api-agent:
    build:
      context: .
      dockerfile: Dockerfile
    ports:
      - "3000:3000"
    environment:
      - OPENAI_API_KEY=${OPENAI_API_KEY}
      - OPENAI_BASE_URL=${OPENAI_BASE_URL:-https://api.openai.com/v1}
      - API_AGENT_MODEL_NAME=${API_AGENT_MODEL_NAME:-gpt-5.2}
      - API_AGENT_HOST=0.0.0.0
      - API_AGENT_PORT=3000
      - API_AGENT_CORS_ALLOWED_ORIGINS=*
    volumes:
      - ./data:/app/data
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 10s

  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
    ports:
      - "3001:3001"
    environment:
      - OPENAI_API_KEY=${OPENAI_API_KEY}
      - MCP_SERVER_URL=http://api-agent:3000/mcp
      - NEXT_PUBLIC_API_URL=http://localhost:3001
    depends_on:
      api-agent:
        condition: service_healthy
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3001/api/health"]
      interval: 30s
      timeout: 10s
      retries: 3
```

### 3.2 Frontend Service (`./frontend/`)

#### 3.2.1 Technology Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Runtime | **Bun** (latest) | Fast JS/TS runtime, package manager, bundler |
| Framework | **Next.js 15** (App Router) | Full-stack React framework |
| AI Chat | **CopilotKit** (`@copilotkit/react-core`, `@copilotkit/react-ui`, `@copilotkit/runtime`) | Chat UI, agent runtime, message handling |
| MCP Client | **Mastra MCPClient** (`@mastra/mcp`) | Connects to Python MCP server over streamable-http |
| Agent Framework | **Mastra Agent** (`@mastra/core`) | Orchestrates LLM with MCP tools |
| AG-UI Bridge | **@ag-ui/mastra** | CopilotKit ↔ Mastra integration via AG-UI protocol |
| Data Tables | **TanStack Table** (`@tanstack/react-table`) + **shadcn/ui Table** | Sortable, filterable, paginated data grids |
| Charts | **shadcn/ui Chart** (wraps **Recharts**) | Bar, line, area, pie charts |
| UI Components | **shadcn/ui** + **Tailwind CSS** | Buttons, inputs, cards, dialogs, dropdowns |

#### 3.2.2 Directory Structure

```
frontend/
├── Dockerfile
├── bun.lock
├── package.json
├── next.config.ts
├── tailwind.config.ts
├── components.json                  # shadcn/ui config
├── tsconfig.json
│
├── src/
│   ├── app/
│   │   ├── layout.tsx               # Root layout with CopilotKit provider
│   │   ├── page.tsx                 # Main page: API config + chat + results
│   │   │
│   │   └── api/
│   │       ├── copilotkit/
│   │       │   └── route.ts         # POST: CopilotRuntime endpoint
│   │       └── health/
│   │           └── route.ts         # GET: Health check
│   │
│   ├── components/
│   │   ├── api-config-form.tsx      # API connection configuration
│   │   ├── chat-panel.tsx           # CopilotKit chat wrapper
│   │   ├── data-display.tsx         # Orchestrates table vs chart
│   │   ├── data-table/
│   │   │   ├── data-table.tsx       # TanStack Table + shadcn/ui Table
│   │   │   ├── columns.tsx          # Dynamic column definitions
│   │   │   ├── pagination.tsx       # Pagination controls
│   │   │   ├── column-header.tsx    # Sortable column headers
│   │   │   └── toolbar.tsx          # Filter + column visibility
│   │   ├── charts/
│   │   │   ├── auto-chart.tsx       # Automatic chart type selection
│   │   │   ├── bar-chart.tsx        # Bar chart component
│   │   │   ├── line-chart.tsx       # Line chart component
│   │   │   ├── area-chart.tsx       # Area chart component
│   │   │   └── pie-chart.tsx        # Pie chart component
│   │   └── ui/                      # shadcn/ui generated components
│   │       ├── button.tsx
│   │       ├── card.tsx
│   │       ├── chart.tsx
│   │       ├── input.tsx
│   │       ├── select.tsx
│   │       ├── table.tsx
│   │       ├── tabs.tsx
│   │       └── ...
│   │
│   ├── lib/
│   │   ├── mcp-client.ts            # Mastra MCPClient factory (dynamic per-session)
│   │   ├── mastra-agent.ts          # Mastra Agent definition with MCP tools
│   │   ├── copilotkit-runtime.ts    # CopilotRuntime + AG-UI registration
│   │   ├── data-inference.ts        # Infer column types, chart suitability
│   │   └── utils.ts                 # CN utility, formatters
│   │
│   └── types/
│       ├── api-config.ts            # API configuration types
│       └── query-result.ts          # Query result / chart data types
│
└── public/
    └── ...
```

---

## 4. Detailed Design

### 4.1 Dynamic Mastra MCPClient Creation

The key innovation: the Mastra MCPClient is created **dynamically per user session** with custom HTTP headers that configure the Python MCP server's target API.

```typescript
// src/lib/mcp-client.ts
import { MCPClient } from "@mastra/mcp";
import { ApiConfig } from "@/types/api-config";

export function createMCPClient(config: ApiConfig): MCPClient {
  const targetHeaders: Record<string, string> = {};

  // Build X-Target-Headers from user-provided auth
  if (config.authHeader) {
    targetHeaders[config.authHeaderName || "Authorization"] = config.authHeader;
  }

  // Custom fetch to inject per-session headers into every MCP request
  const customFetch = async (url: RequestInfo | URL, init?: RequestInit) => {
    const headers = new Headers(init?.headers);

    // These headers configure which API the Python MCP server connects to
    headers.set("X-Target-URL", config.targetUrl);
    headers.set("X-API-Type", config.apiType);  // "graphql" | "rest"
    headers.set("X-Target-Headers", JSON.stringify(targetHeaders));

    if (config.apiName) {
      headers.set("X-API-Name", config.apiName);
    }
    if (config.baseUrl) {
      headers.set("X-Base-URL", config.baseUrl);
    }
    if (config.allowUnsafePaths?.length) {
      headers.set("X-Allow-Unsafe-Paths", JSON.stringify(config.allowUnsafePaths));
    }
    if (config.pollPaths?.length) {
      headers.set("X-Poll-Paths", JSON.stringify(config.pollPaths));
    }

    return fetch(url, { ...init, headers });
  };

  return new MCPClient({
    id: `mcp-${config.targetUrl}`,
    servers: {
      "api-agent": {
        url: new URL(process.env.MCP_SERVER_URL || "http://localhost:3000/mcp"),
        fetch: customFetch,
      },
    },
    timeout: 120_000,  // 2 minutes for complex queries
  });
}
```

**Why custom `fetch`**: The Python MCP server uses HTTP headers (`X-Target-URL`, `X-API-Type`, `X-Target-Headers`) to determine which external API to connect to. By injecting these headers via Mastra's custom fetch, every MCP protocol message (tool list, tool call) carries the session's API configuration. This maps directly to how the Python `middleware.py` → `context.py` extracts `RequestContext` from headers.

### 4.2 Mastra Agent with Dynamic MCP Tools

```typescript
// src/lib/mastra-agent.ts
import { Agent } from "@mastra/core/agent";
import { MCPClient } from "@mastra/mcp";
import { openai } from "@ai-sdk/openai";

export async function createAgent(mcpClient: MCPClient) {
  const tools = await mcpClient.listTools();

  return new Agent({
    name: "api-explorer",
    instructions: `You are an API data exploration assistant. You help users
query APIs using natural language and present results clearly.

When you receive data results:
- If the data is tabular (arrays of objects), format it for table display
- If the data has numeric fields suitable for visualization, suggest chart types
- Always include the raw data in a structured JSON format

Wrap data responses in a JSON code block with this structure:
\`\`\`json
{
  "type": "table" | "chart" | "both",
  "data": [...],
  "columns": [...],
  "chartConfig": { "type": "bar|line|area|pie", "xKey": "...", "yKeys": [...] }
}
\`\`\``,
    model: openai("gpt-4o"),
    tools,
  });
}
```

### 4.3 CopilotKit Runtime (Next.js API Route)

The API route bridges CopilotKit's frontend with the Mastra agent via the AG-UI protocol.

```typescript
// src/app/api/copilotkit/route.ts
import { NextRequest } from "next/server";
import { CopilotRuntime, copilotRuntimeNextJSAppRouterEndpoint } from "@copilotkit/runtime";
import { createMCPClient } from "@/lib/mcp-client";
import { createAgent } from "@/lib/mastra-agent";

export async function POST(req: NextRequest) {
  // Extract API config from request headers (set by frontend)
  const apiConfig = {
    targetUrl: req.headers.get("x-api-target-url") || "",
    apiType: req.headers.get("x-api-type") as "graphql" | "rest",
    authHeader: req.headers.get("x-api-auth-header") || "",
    authHeaderName: req.headers.get("x-api-auth-header-name") || "Authorization",
    apiName: req.headers.get("x-api-name") || undefined,
    baseUrl: req.headers.get("x-api-base-url") || undefined,
  };

  // Create dynamic MCP client for this session's API config
  const mcpClient = createMCPClient(apiConfig);

  try {
    // Create Mastra agent with dynamically discovered MCP tools
    const agent = await createAgent(mcpClient);

    // Build CopilotRuntime with MCP tools as a toolset
    const runtime = new CopilotRuntime();

    const { handleRequest } = copilotRuntimeNextJSAppRouterEndpoint({
      runtime,
      endpoint: "/api/copilotkit",
      // Provide MCP tools to CopilotKit
      mcpServers: [
        {
          url: new URL(process.env.MCP_SERVER_URL || "http://localhost:3000/mcp"),
          customHeaders: {
            "X-Target-URL": apiConfig.targetUrl,
            "X-API-Type": apiConfig.apiType,
            "X-Target-Headers": JSON.stringify(
              apiConfig.authHeader
                ? { [apiConfig.authHeaderName]: apiConfig.authHeader }
                : {}
            ),
            ...(apiConfig.apiName ? { "X-API-Name": apiConfig.apiName } : {}),
          },
        },
      ],
    });

    return handleRequest(req);
  } finally {
    await mcpClient.disconnect();
  }
}
```

### 4.4 Frontend Layout & CopilotKit Provider

```typescript
// src/app/layout.tsx
import { CopilotKit } from "@copilotkit/react-core";
import "@copilotkit/react-ui/styles.css";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <CopilotKit runtimeUrl="/api/copilotkit">
          {children}
        </CopilotKit>
      </body>
    </html>
  );
}
```

### 4.5 Main Page: API Config + Chat + Results

```
┌────────────────────────────────────────────────────────────┐
│  API Agent Explorer                                        │
├────────────────────────────────────────────────────────────┤
│  ┌──────────────────────────────────────────────────────┐  │
│  │  API Configuration                                   │  │
│  │  ┌─────────────────┐ ┌───────┐ ┌──────────────────┐ │  │
│  │  │ API URL          │ │ Type ▼│ │ Auth Header      │ │  │
│  │  └─────────────────┘ └───────┘ └──────────────────┘ │  │
│  │  [Connect]                                           │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                            │
│  ┌─────────────────────┐  ┌──────────────────────────────┐ │
│  │  Chat               │  │  Results                     │ │
│  │                     │  │                              │ │
│  │  User: Show me all  │  │  ┌──Tab: Table ─┬─ Chart ─┐ │ │
│  │  hotels in Bangkok  │  │  │              │         │ │ │
│  │                     │  │  │ ┌──┬───┬───┐ │         │ │ │
│  │  Agent: Found 24    │  │  │ │ID│Nm │Rt │ │  ▐▌     │ │ │
│  │  hotels. Showing    │  │  │ ├──┼───┼───┤ │  ▐▌ ▐▌  │ │ │
│  │  results as table   │  │  │ │1 │...│4.5│ │  ▐▌ ▐▌  │ │ │
│  │  and bar chart.     │  │  │ │2 │...│4.2│ │  ▐▌ ▐▌  │ │ │
│  │                     │  │  │ └──┴───┴───┘ │  ▐▌ ▐▌  │ │ │
│  │  [Type message...]  │  │  │  < 1 2 3 >   │         │ │ │
│  │                     │  │  └──────────────┴─────────┘ │ │
│  └─────────────────────┘  └──────────────────────────────┘ │
└────────────────────────────────────────────────────────────┘
```

### 4.6 Data Table (TanStack Table + shadcn/ui)

Dynamic column generation from API response data:

```typescript
// src/components/data-table/columns.tsx
import { ColumnDef } from "@tanstack/react-table";

export function generateColumns(data: Record<string, unknown>[]): ColumnDef<Record<string, unknown>>[] {
  if (!data.length) return [];

  const sampleRow = data[0];
  return Object.keys(sampleRow).map((key) => ({
    accessorKey: key,
    header: key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
    cell: ({ getValue }) => {
      const value = getValue();
      if (typeof value === "number") return value.toLocaleString();
      if (typeof value === "boolean") return value ? "Yes" : "No";
      if (value === null || value === undefined) return "—";
      return String(value);
    },
  }));
}
```

```typescript
// src/components/data-table/data-table.tsx
"use client";
import {
  useReactTable,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  flexRender,
} from "@tanstack/react-table";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface DataTableProps {
  data: Record<string, unknown>[];
  columns: ColumnDef<Record<string, unknown>>[];
}

export function DataTable({ data, columns }: DataTableProps) {
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  return (
    <div>
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((hg) => (
            <TableRow key={hg.id}>
              {hg.headers.map((h) => (
                <TableHead key={h.id}>
                  {flexRender(h.column.columnDef.header, h.getContext())}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows.map((row) => (
            <TableRow key={row.id}>
              {row.getVisibleCells().map((cell) => (
                <TableCell key={cell.id}>
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {/* Pagination controls */}
    </div>
  );
}
```

### 4.7 Charts (shadcn/ui Chart + Recharts)

Automatic chart type inference from data shape:

```typescript
// src/lib/data-inference.ts
export interface ChartRecommendation {
  type: "bar" | "line" | "area" | "pie";
  xKey: string;
  yKeys: string[];
  title: string;
}

export function inferChartType(data: Record<string, unknown>[]): ChartRecommendation | null {
  if (!data.length) return null;

  const keys = Object.keys(data[0]);
  const numericKeys = keys.filter((k) =>
    data.every((row) => typeof row[k] === "number")
  );
  const stringKeys = keys.filter((k) =>
    data.every((row) => typeof row[k] === "string")
  );

  if (numericKeys.length === 0) return null;

  // Pie chart: 1 string label + 1 numeric value, ≤10 rows
  if (stringKeys.length >= 1 && numericKeys.length === 1 && data.length <= 10) {
    return { type: "pie", xKey: stringKeys[0], yKeys: numericKeys, title: numericKeys[0] };
  }

  // Line chart: data looks like time series (sorted, >5 rows)
  if (data.length > 5 && stringKeys.length >= 1) {
    return { type: "line", xKey: stringKeys[0], yKeys: numericKeys.slice(0, 3), title: "" };
  }

  // Bar chart: default for categorical + numeric
  if (stringKeys.length >= 1) {
    return { type: "bar", xKey: stringKeys[0], yKeys: numericKeys.slice(0, 3), title: "" };
  }

  return null;
}
```

```typescript
// src/components/charts/auto-chart.tsx
"use client";
import { Bar, BarChart, Line, LineChart, Area, AreaChart, Pie, PieChart, Cell } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { ChartRecommendation } from "@/lib/data-inference";

interface AutoChartProps {
  data: Record<string, unknown>[];
  config: ChartRecommendation;
}

export function AutoChart({ data, config }: AutoChartProps) {
  const chartConfig = Object.fromEntries(
    config.yKeys.map((key, i) => [
      key,
      { label: key.replace(/_/g, " "), color: `hsl(var(--chart-${i + 1}))` },
    ])
  );

  // Render appropriate chart type based on inference
  switch (config.type) {
    case "bar":
      return (
        <ChartContainer config={chartConfig} className="min-h-[300px] w-full">
          <BarChart data={data} accessibilityLayer>
            <ChartTooltip content={<ChartTooltipContent />} />
            {config.yKeys.map((key) => (
              <Bar key={key} dataKey={key} fill={`var(--color-${key})`} radius={4} />
            ))}
          </BarChart>
        </ChartContainer>
      );
    case "line":
      return (
        <ChartContainer config={chartConfig} className="min-h-[300px] w-full">
          <LineChart data={data} accessibilityLayer>
            <ChartTooltip content={<ChartTooltipContent />} />
            {config.yKeys.map((key) => (
              <Line key={key} type="monotone" dataKey={key} stroke={`var(--color-${key})`} />
            ))}
          </LineChart>
        </ChartContainer>
      );
    // ... area, pie cases
  }
}
```

### 4.8 Frontend Dockerfile (Bun)

```dockerfile
# frontend/Dockerfile
FROM oven/bun:latest AS base
WORKDIR /app

# Install dependencies
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

# Build
COPY . .
RUN bun run build

# Production
FROM oven/bun:latest AS runner
WORKDIR /app

COPY --from=base /app/.next/standalone ./
COPY --from=base /app/.next/static ./.next/static
COPY --from=base /app/public ./public

ENV NODE_ENV=production
ENV PORT=3001
EXPOSE 3001

CMD ["bun", "server.js"]
```

---

## 5. Request Flow (End-to-End)

```
User types: "Show me all hotels in Bangkok with ratings above 4"
    │
    ▼
[1] React Frontend (CopilotKit Chat)
    │  CopilotChat sends message to /api/copilotkit
    │  Includes custom headers: X-API-Target-URL, X-API-Type, etc.
    │
    ▼
[2] Next.js API Route (/api/copilotkit)
    │  Extracts API config from headers
    │  Creates Mastra MCPClient with custom fetch (injects X-Target-URL, etc.)
    │  Creates Mastra Agent with tools from MCPClient.listTools()
    │  CopilotRuntime processes message via AG-UI protocol
    │
    ▼
[3] Mastra MCPClient → Python MCP Server (streamable-http)
    │  MCP tool_list request with headers:
    │    X-Target-URL: https://example.com/graphql
    │    X-API-Type: graphql
    │    X-Target-Headers: {"Authorization": "Bearer ..."}
    │
    ▼
[4] Python DynamicToolNamingMiddleware
    │  Extracts RequestContext from headers
    │  Loads schema (GraphQL introspection / OpenAPI)
    │  Returns tools: example_query, example_execute, r_* recipes
    │
    ▼
[5] Mastra Agent decides to call `example_query` tool
    │  Arguments: { "question": "hotels in Bangkok with ratings > 4" }
    │
    ▼
[6] Python MCP Server processes tool call
    │  GraphQL/REST Agent fetches schema, builds query, executes
    │  DuckDB filters: SELECT * FROM data WHERE rating > 4
    │  Returns structured JSON data
    │
    ▼
[7] Mastra Agent receives data, formats response
    │  Wraps in structured JSON: { type: "both", data: [...], chartConfig: {...} }
    │  Streams back via AG-UI events
    │
    ▼
[8] CopilotKit Frontend renders response
    │  Parses structured JSON from agent message
    │  Renders DataTable (TanStack Table + shadcn/ui)
    │  Renders AutoChart (shadcn/ui Chart + Recharts)
    │  User can sort, filter, paginate table; interact with chart
```

---

## 6. API Configuration Types

```typescript
// src/types/api-config.ts
export interface ApiConfig {
  /** Target API URL (GraphQL endpoint or OpenAPI spec URL) */
  targetUrl: string;
  /** API type */
  apiType: "graphql" | "rest";
  /** Friendly display name (becomes tool name prefix) */
  apiName?: string;
  /** Auth header value (e.g., "Bearer token123") */
  authHeader?: string;
  /** Auth header name (default: "Authorization") */
  authHeaderName?: string;
  /** Override base URL for REST APIs */
  baseUrl?: string;
  /** Glob patterns for unsafe paths (POST/PUT/DELETE/PATCH) */
  allowUnsafePaths?: string[];
  /** Paths requiring polling (REST only) */
  pollPaths?: string[];
  /** Any additional custom headers to forward */
  extraHeaders?: Record<string, string>;
}
```

---

## 7. Data Display Strategy

### 7.1 Response Parsing

Agent responses containing structured data are parsed from markdown code blocks:

```typescript
// src/lib/data-inference.ts
export function parseAgentResponse(content: string): {
  type: "table" | "chart" | "both" | "text";
  data?: Record<string, unknown>[];
  chartConfig?: ChartRecommendation;
} {
  const jsonMatch = content.match(/```json\n([\s\S]*?)\n```/);
  if (!jsonMatch) return { type: "text" };

  try {
    const parsed = JSON.parse(jsonMatch[1]);
    if (Array.isArray(parsed.data) && parsed.data.length > 0) {
      return {
        type: parsed.type || "table",
        data: parsed.data,
        chartConfig: parsed.chartConfig || inferChartType(parsed.data),
      };
    }
  } catch { /* fallback */ }

  return { type: "text" };
}
```

### 7.2 Display Rules

| Data Shape | Table | Chart | Chart Type |
|-----------|-------|-------|-----------|
| Array of objects with numeric fields | Yes | Yes (auto) | Bar (default) |
| Time series (sorted, >5 rows) | Yes | Yes | Line |
| Category + single value (≤10 rows) | Yes | Yes | Pie |
| Nested/complex objects | Yes (flattened) | No | — |
| Single scalar value | No | No | Text only |

---

## 8. Key Design Decisions

### 8.1 Mastra MCPClient with Custom Fetch (Not CopilotKit Direct MCP)

**Decision**: Use Mastra's `MCPClient` with custom `fetch` to inject per-session headers, rather than CopilotKit's built-in `setMcpServers`.

**Rationale**: The Python MCP server uses **HTTP headers** (`X-Target-URL`, `X-API-Type`, `X-Target-Headers`) to configure which external API it connects to. This is a per-session configuration that must be injected into every MCP protocol message. Mastra's `MCPClient` supports a `fetch` override that cleanly handles this. CopilotKit's `mcpServers` config also supports `customHeaders`, so we use **both approaches in tandem** — the CopilotRuntime uses CopilotKit's MCP integration with custom headers for the actual tool discovery and execution, while the Mastra agent definition provides the structured agent behavior.

### 8.2 Server-Side MCPClient (Not Browser-Side)

**Decision**: The MCPClient runs in the Next.js API route (server-side), not in the browser.

**Rationale**:
- The MCP server URL (`http://api-agent:3000/mcp`) is only reachable within the Docker network
- Auth tokens should not be exposed to the browser
- Server-side execution avoids CORS issues between browser and MCP server
- MCPClient lifecycle is tied to request handling, not browser tabs

### 8.3 Dynamic Column Generation

**Decision**: Generate TanStack Table `ColumnDef` dynamically from response data shape.

**Rationale**: The Python MCP server can connect to _any_ API — we cannot pre-define columns. Column types are inferred from the first data row at render time.

### 8.4 Chart Type Inference

**Decision**: Automatically infer the best chart type from data shape, with agent-suggested overrides.

**Rationale**: The agent can suggest a chart type in its structured response, but if it doesn't, the frontend uses heuristics (see Section 7.2) to pick the best visualization.

### 8.5 Bun as Runtime

**Decision**: Use Bun for package management, building, and server runtime.

**Rationale**: Bun provides faster installs, builds, and runtime performance compared to Node.js. Next.js has full Bun support. Docker images use `oven/bun:latest`.

---

## 9. Environment Variables

| Variable | Service | Default | Description |
|---------|---------|---------|-------------|
| `OPENAI_API_KEY` | Both | — | LLM API key |
| `OPENAI_BASE_URL` | api-agent | `https://api.openai.com/v1` | LLM endpoint |
| `API_AGENT_MODEL_NAME` | api-agent | `gpt-5.2` | Model for Python agents |
| `MCP_SERVER_URL` | frontend | `http://api-agent:3000/mcp` | Python MCP server URL (internal Docker DNS) |
| `NEXT_PUBLIC_API_URL` | frontend | `http://localhost:3001` | Frontend public URL |

---

## 10. Security Considerations

1. **Auth tokens**: User-provided API auth tokens are forwarded server-side only (never exposed to browser JS)
2. **CORS**: Python MCP server allows `*` origins within Docker network; production should restrict
3. **Mutation safety**: Python MCP server blocks GraphQL mutations and REST POST/PUT/DELETE/PATCH by default. `X-Allow-Unsafe-Paths` must be explicitly set
4. **Input validation**: API config form validates URL format and required fields before creating MCP connections
5. **MCPClient cleanup**: `disconnect()` is called in `finally` block to prevent resource leaks

---

## 11. Implementation Phases

### Phase 1: Foundation
- Initialize Next.js project with Bun
- Set up shadcn/ui, Tailwind CSS
- Create Docker Compose with both services
- Implement API config form

### Phase 2: MCP Integration
- Implement dynamic Mastra MCPClient factory (`mcp-client.ts`)
- Create Next.js API route with CopilotRuntime
- Wire up CopilotKit provider and chat UI
- Test tool discovery and basic queries

### Phase 3: Data Visualization
- Implement dynamic TanStack Table with generated columns
- Add sorting, filtering, pagination
- Implement shadcn/ui Chart components (bar, line, area, pie)
- Build auto-chart inference logic
- Create tabbed results view (Table | Chart)

### Phase 4: Polish
- Error handling and loading states
- Connection status indicators
- Response streaming UX
- Dark mode support (shadcn/ui theming)
- Docker healthchecks and production optimization

---

## 12. Dependencies (frontend/package.json)

```json
{
  "dependencies": {
    "next": "^15",
    "react": "^19",
    "react-dom": "^19",
    "@copilotkit/react-core": "latest",
    "@copilotkit/react-ui": "latest",
    "@copilotkit/runtime": "latest",
    "@mastra/mcp": "latest",
    "@mastra/core": "latest",
    "@ag-ui/mastra": "latest",
    "@ai-sdk/openai": "latest",
    "@tanstack/react-table": "^8",
    "recharts": "^2",
    "tailwindcss": "^4",
    "class-variance-authority": "latest",
    "clsx": "latest",
    "tailwind-merge": "latest",
    "lucide-react": "latest"
  },
  "devDependencies": {
    "typescript": "^5",
    "@types/react": "^19",
    "@types/react-dom": "^19"
  }
}
```

---

## 13. No Changes to Python Service

The existing `api-agent` Python service requires **zero modifications**. The entire integration relies on its existing public contract:
- **Transport**: Streamable HTTP at `/mcp`
- **Headers**: `X-Target-URL`, `X-API-Type`, `X-Target-Headers`, etc.
- **Tools**: `_query`, `_execute` (dynamically renamed per session by middleware)
- **Recipes**: Auto-generated `r_*` tools from successful queries
- **Health**: `/health` endpoint for Docker healthchecks

The frontend simply connects as an MCP client — the Python server doesn't know or care whether it's talking to Claude Desktop, a CLI tool, or our Mastra MCPClient.
