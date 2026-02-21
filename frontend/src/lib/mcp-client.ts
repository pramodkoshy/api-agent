import { MCPClient } from "@mastra/mcp";
import type { ApiConfig } from "@/types/api-config";

const MCP_SERVER_URL = process.env.MCP_SERVER_URL || "http://localhost:3000/mcp";

/**
 * Create a Mastra MCPClient that injects per-session headers into every
 * request to the Python MCP server.
 *
 * The Python MCP server uses these headers to determine which external
 * API to connect to (see api_agent/context.py → RequestContext).
 */
export function createMCPClient(config: ApiConfig): MCPClient {
  const targetHeaders: Record<string, string> = {};

  if (config.authHeader) {
    const name = config.authHeaderName || "Authorization";
    targetHeaders[name] = config.authHeader;
  }

  const customFetch: typeof fetch = async (url, init) => {
    const headers = new Headers(init?.headers);

    // Core: configure which API the Python MCP server targets
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

  return new MCPClient({
    id: `mcp-${config.apiType}-${config.targetUrl}`,
    servers: {
      "api-agent": {
        url: new URL(MCP_SERVER_URL),
        fetch: customFetch,
      },
    },
    timeout: 120_000,
  });
}
