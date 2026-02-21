import { NextRequest } from "next/server";
import {
  CopilotRuntime,
  copilotRuntimeNextJSAppRouterEndpoint,
} from "@copilotkit/runtime";

const MCP_SERVER_URL =
  process.env.MCP_SERVER_URL || "http://localhost:3000/mcp";

export async function POST(req: NextRequest) {
  // Extract API config from custom headers set by the frontend
  const targetUrl = req.headers.get("x-api-target-url") || "";
  const apiType = req.headers.get("x-api-type") || "graphql";
  const authHeader = req.headers.get("x-api-auth-header") || "";
  const authHeaderName =
    req.headers.get("x-api-auth-header-name") || "Authorization";
  const apiName = req.headers.get("x-api-name") || undefined;
  const baseUrl = req.headers.get("x-api-base-url") || undefined;

  // Build the target headers JSON that the Python MCP server expects
  const targetHeaders: Record<string, string> = {};
  if (authHeader) {
    targetHeaders[authHeaderName] = authHeader;
  }

  const customHeaders: Record<string, string> = {
    "X-Target-URL": targetUrl,
    "X-API-Type": apiType,
    "X-Target-Headers": JSON.stringify(targetHeaders),
  };
  if (apiName) customHeaders["X-API-Name"] = apiName;
  if (baseUrl) customHeaders["X-Base-URL"] = baseUrl;

  const runtime = new CopilotRuntime({
    remoteEndpoints: [
      {
        url: MCP_SERVER_URL,
        onBeforeRequest: ({ ctx }) => {
          return {
            headers: customHeaders,
          };
        },
      },
    ],
  });

  const { handleRequest } = copilotRuntimeNextJSAppRouterEndpoint({
    runtime,
    endpoint: "/api/copilotkit",
  });

  return handleRequest(req);
}
