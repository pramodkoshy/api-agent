/**
 * Dynamic Mastra agent factory.
 *
 * Creates a Mastra Agent that has:
 *   1. MCP tools from the Agoda Python service (dynamic per API config)
 *   2. MongoDB storage tools (save, list, retrieve, combine, delete)
 *
 * The MCPClient is created with custom fetch headers so every MCP request
 * carries the target API configuration (X-Target-URL, X-API-Type, etc).
 */
import { Agent } from "@mastra/core/agent";
import { MCPClient } from "@mastra/mcp";
import type { ApiConfig } from "@/types/api-config";
import { storageTools } from "./tools";

const MCP_SERVER_URL = process.env.MCP_SERVER_URL || "http://localhost:3000/mcp";

/** Build the custom fetch that injects per-session API headers. */
function buildMcpFetch(config: ApiConfig): typeof fetch {
  const targetHeaders: Record<string, string> = {};
  if (config.authHeader) {
    targetHeaders[config.authHeaderName || "Authorization"] = config.authHeader;
  }

  return async (url, init) => {
    const headers = new Headers(init?.headers);
    headers.set("X-Target-URL", config.targetUrl);
    headers.set("X-API-Type", config.apiType);
    headers.set("X-Target-Headers", JSON.stringify(targetHeaders));
    if (config.apiName) headers.set("X-API-Name", config.apiName);
    if (config.baseUrl) headers.set("X-Base-URL", config.baseUrl);
    if (config.allowUnsafePaths?.length) {
      headers.set("X-Allow-Unsafe-Paths", JSON.stringify(config.allowUnsafePaths));
    }
    if (config.pollPaths?.length) {
      headers.set("X-Poll-Paths", JSON.stringify(config.pollPaths));
    }
    return fetch(url, { ...init, headers });
  };
}

/**
 * Create a Mastra MCPClient for a single API config.
 * This connects to the Agoda Python MCP service with the right headers.
 */
export function createMCPClient(config: ApiConfig, serverId: string): MCPClient {
  return new MCPClient({
    id: `mcp-${serverId}`,
    servers: {
      [serverId]: {
        url: new URL(MCP_SERVER_URL),
        fetch: buildMcpFetch(config),
      },
    },
    timeout: 120_000,
  });
}

/**
 * Create the full Mastra agent with both MCP tools and storage tools.
 *
 * Supports multiple API configs — each gets its own MCPClient so the agent
 * can query different APIs in a single conversation.
 */
export async function createApiAgent(apiConfigs: ApiConfig[]): Promise<{
  agent: Agent;
  mcpClients: MCPClient[];
}> {
  const mcpClients: MCPClient[] = [];
  let allMcpTools: Record<string, any> = {};

  // Create an MCPClient for each configured API
  for (let i = 0; i < apiConfigs.length; i++) {
    const config = apiConfigs[i];
    const serverId = config.apiName || `api_${i}`;
    const mcpClient = createMCPClient(config, serverId);
    mcpClients.push(mcpClient);

    try {
      const tools = await mcpClient.listTools();
      allMcpTools = { ...allMcpTools, ...tools };
    } catch (error) {
      console.error(`Failed to list tools for ${serverId}:`, error);
    }
  }

  // Build API description for the agent instructions
  const apiDescriptions = apiConfigs
    .map((c, i) => {
      const name = c.apiName || `api_${i}`;
      return `- ${name}: ${c.apiType.toUpperCase()} at ${c.targetUrl}`;
    })
    .join("\n");

  const agent = new Agent({
    id: "api-explorer",
    name: "API Explorer Agent",
    instructions: `You are an API data exploration agent powered by Mastra. You help users query APIs, store results, and build insights by combining data from multiple sources.

## Connected APIs
${apiDescriptions || "No APIs connected yet."}

## Capabilities

### 1. Query APIs
Use the MCP query/execute tools to ask natural language questions about connected APIs. The tools are dynamically named based on the connected API (e.g., flights_query, hotels_execute).

### 2. Store Results
After retrieving data, you can save it to MongoDB using the save_results tool. Always suggest saving important results so users can retrieve them later.

### 3. Retrieve Stored Data
Use retrieve_dataset to load previously saved results. Use list_datasets to see what's available.

### 4. Combine Datasets
Use combine_datasets to merge data from different API calls:
- "union": Stack rows from two datasets vertically
- "join": Merge datasets on a shared key column

### 5. Visualize Data
When returning data for display, wrap it in a JSON code block with this structure:
\`\`\`json
{
  "type": "table" | "chart" | "both",
  "data": [...],
  "chartConfig": { "type": "bar|line|area|pie", "xKey": "...", "yKeys": [...] }
}
\`\`\`

## Guidelines
- When users ask about data, check stored datasets first before making new API calls
- Proactively suggest saving useful results
- When combining data, explain the join/union strategy
- For charts, infer the best chart type from data shape
- Keep responses concise and data-focused`,
    model: {
      id: `openai/${process.env.FRONTEND_MODEL || "gpt-4o"}` as `${string}/${string}`,
    },
    tools: {
      ...allMcpTools,
      ...storageTools,
    },
  });

  return { agent, mcpClients };
}

/** Disconnect all MCPClients (cleanup). */
export async function disconnectClients(clients: MCPClient[]): Promise<void> {
  await Promise.allSettled(clients.map((c) => c.disconnect()));
}
