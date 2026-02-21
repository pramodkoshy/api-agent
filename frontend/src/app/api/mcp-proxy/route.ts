import { NextRequest, NextResponse } from "next/server";

const MCP_SERVER_URL = process.env.MCP_SERVER_URL || "http://localhost:3000/mcp";

/**
 * MCP proxy that forwards requests to the Python MCP server,
 * injecting the target API configuration as custom headers.
 *
 * CopilotKit's setMcpServers sends MCP protocol messages to this endpoint.
 * We extract the API config from query params and forward to the real MCP server.
 */
export async function POST(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const targetUrl = searchParams.get("targetUrl") || "";
  const apiType = searchParams.get("apiType") || "graphql";
  const authHeader = searchParams.get("authHeader") || "";
  const authHeaderName = searchParams.get("authHeaderName") || "Authorization";
  const apiName = searchParams.get("apiName") || "";
  const baseUrl = searchParams.get("baseUrl") || "";

  // Build X-Target-Headers
  const targetHeaders: Record<string, string> = {};
  if (authHeader) {
    targetHeaders[authHeaderName] = authHeader;
  }

  // Forward the MCP protocol body to the Python server with custom headers
  const body = await req.text();

  const headers: Record<string, string> = {
    "Content-Type": req.headers.get("content-type") || "application/json",
    "X-Target-URL": targetUrl,
    "X-API-Type": apiType,
    "X-Target-Headers": JSON.stringify(targetHeaders),
  };
  if (apiName) headers["X-API-Name"] = apiName;
  if (baseUrl) headers["X-Base-URL"] = baseUrl;

  // Forward MCP session headers if present
  const mcpSession = req.headers.get("mcp-session-id");
  if (mcpSession) headers["MCP-Session-Id"] = mcpSession;

  try {
    const response = await fetch(MCP_SERVER_URL, {
      method: "POST",
      headers,
      body,
    });

    // Stream the response back
    const responseHeaders = new Headers();
    response.headers.forEach((value, key) => {
      responseHeaders.set(key, value);
    });

    return new NextResponse(response.body, {
      status: response.status,
      headers: responseHeaders,
    });
  } catch (error) {
    return NextResponse.json(
      { error: `Failed to connect to MCP server: ${error}` },
      { status: 502 },
    );
  }
}

// Handle SSE/GET for streamable-http transport
export async function GET(req: NextRequest) {
  return POST(req);
}
