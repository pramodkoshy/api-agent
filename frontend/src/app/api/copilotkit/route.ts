import { NextRequest } from "next/server";
import {
  CopilotRuntime,
  copilotRuntimeNextJSAppRouterEndpoint,
} from "@copilotkit/runtime";
import { MastraAgent } from "@ag-ui/mastra";
import { createApiAgent, disconnectClients } from "@/lib/mastra/agent";
import type { ApiConfig } from "@/types/api-config";

/**
 * CopilotKit runtime endpoint.
 *
 * Flow:
 *   CopilotKit Frontend
 *     → This API Route (CopilotRuntime)
 *       → MastraAgent (AG-UI adapter)
 *         → Mastra Agent (with MCPClient tools + MongoDB tools)
 *           → Agoda Python MCP Server (via Mastra MCPClient)
 *           → MongoDB (via Mastra storage tools)
 */
export async function POST(req: NextRequest) {
  // Parse API configs from the custom header (JSON array of configs)
  const apiConfigsRaw = req.headers.get("x-api-configs");
  let apiConfigs: ApiConfig[] = [];

  if (apiConfigsRaw) {
    try {
      apiConfigs = JSON.parse(apiConfigsRaw);
    } catch {
      // Fallback: try single-API headers for backwards compatibility
    }
  }

  // Fallback: extract single API config from individual headers
  if (apiConfigs.length === 0) {
    const targetUrl = req.headers.get("x-api-target-url");
    if (targetUrl) {
      apiConfigs.push({
        targetUrl,
        apiType: (req.headers.get("x-api-type") as "graphql" | "rest") || "graphql",
        authHeader: req.headers.get("x-api-auth-header") || undefined,
        authHeaderName: req.headers.get("x-api-auth-header-name") || "Authorization",
        apiName: req.headers.get("x-api-name") || undefined,
        baseUrl: req.headers.get("x-api-base-url") || undefined,
      });
    }
  }

  // Create the Mastra agent with dynamic MCP tools + storage tools
  const { agent: mastraAgent, mcpClients } = await createApiAgent(apiConfigs);

  // Wrap the Mastra agent as an AG-UI AbstractAgent for CopilotKit
  const aguiAgent = new MastraAgent({
    agentId: "api-explorer",
    description:
      "An API data exploration agent that can query any connected GraphQL or REST API, " +
      "store results in MongoDB, combine datasets, and visualize data as tables and charts.",
    agent: mastraAgent,
    resourceId: "copilotkit-user",
  });

  // Create CopilotRuntime with the Mastra-wrapped agent
  const runtime = new CopilotRuntime({
    agents: {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- CopilotKit runtime requires this cast
      "api-explorer": aguiAgent as any,
    },
  });

  const { handleRequest } = copilotRuntimeNextJSAppRouterEndpoint({
    runtime,
    endpoint: "/api/copilotkit",
  });

  try {
    return await handleRequest(req);
  } finally {
    // Clean up MCP connections
    await disconnectClients(mcpClients);
  }
}
