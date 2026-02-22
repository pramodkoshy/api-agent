/**
 * Tests for the CopilotKit API route.
 * Heavy mocking because this depends on external services.
 */

// Create a minimal mock response class for use in test mocks
class MockResponse {
  status: number;
  constructor(_body?: string, init?: { status?: number }) {
    this.status = init?.status ?? 200;
  }
}

// Mock next/server to provide NextRequest/NextResponse
jest.mock("next/server", () => {
  class MockNextRequest {
    url: string;
    method: string;
    _headers: Map<string, string>;

    constructor(url: string, init?: { method?: string; headers?: Record<string, string>; body?: string }) {
      this.url = url;
      this.method = init?.method || "GET";
      this._headers = new Map(Object.entries(init?.headers || {}));
    }

    get headers() {
      return {
        get: (name: string) => this._headers.get(name) || null,
      };
    }
  }

  return {
    NextRequest: MockNextRequest,
    NextResponse: {
      json: (body: unknown) => ({ status: 200, body }),
    },
  };
});

// Mock all external dependencies
jest.mock("@copilotkit/runtime", () => ({
  CopilotRuntime: jest.fn().mockImplementation(() => ({})),
  copilotRuntimeNextJSAppRouterEndpoint: jest.fn().mockReturnValue({
    handleRequest: jest.fn().mockResolvedValue(new MockResponse("ok", { status: 200 })),
  }),
}));

jest.mock("@ag-ui/mastra", () => ({
  MastraAgent: jest.fn().mockImplementation(() => ({})),
}));

jest.mock("@/lib/mastra/agent", () => ({
  createApiAgent: jest.fn().mockResolvedValue({
    agent: { id: "test-agent" },
    mcpClients: [],
  }),
  disconnectClients: jest.fn().mockResolvedValue(undefined),
}));

import { POST } from "../route";
import { NextRequest } from "next/server";
import { createApiAgent, disconnectClients } from "@/lib/mastra/agent";

describe("POST /api/copilotkit", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("handles request with x-api-configs header", async () => {
    const configs = [
      { targetUrl: "https://api.example.com/graphql", apiType: "graphql" },
    ];
    const req = new NextRequest("http://localhost:3000/api/copilotkit", {
      method: "POST",
      headers: {
        "x-api-configs": JSON.stringify(configs),
        "content-type": "application/json",
      },
      body: JSON.stringify({}),
    });

    const response = await POST(req as any);
    expect(response.status).toBe(200);
    expect(createApiAgent).toHaveBeenCalledWith(configs);
    expect(disconnectClients).toHaveBeenCalled();
  });

  it("handles request without API configs", async () => {
    const req = new NextRequest("http://localhost:3000/api/copilotkit", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    });

    const response = await POST(req as any);
    expect(response.status).toBe(200);
    expect(createApiAgent).toHaveBeenCalledWith([]);
  });

  it("falls back to individual headers for backwards compat", async () => {
    const req = new NextRequest("http://localhost:3000/api/copilotkit", {
      method: "POST",
      headers: {
        "x-api-target-url": "https://api.example.com/graphql",
        "x-api-type": "graphql",
        "x-api-auth-header": "Bearer token123",
        "x-api-name": "my-api",
        "content-type": "application/json",
      },
      body: JSON.stringify({}),
    });

    const response = await POST(req as any);
    expect(response.status).toBe(200);
    expect(createApiAgent).toHaveBeenCalledWith([
      expect.objectContaining({
        targetUrl: "https://api.example.com/graphql",
        apiType: "graphql",
        authHeader: "Bearer token123",
        apiName: "my-api",
      }),
    ]);
  });

  it("cleans up MCP clients after request", async () => {
    const req = new NextRequest("http://localhost:3000/api/copilotkit", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    });

    await POST(req as any);
    expect(disconnectClients).toHaveBeenCalledWith([]);
  });

  it("handles invalid JSON in x-api-configs gracefully", async () => {
    const req = new NextRequest("http://localhost:3000/api/copilotkit", {
      method: "POST",
      headers: {
        "x-api-configs": "not-valid-json",
        "content-type": "application/json",
      },
      body: JSON.stringify({}),
    });

    const response = await POST(req as any);
    // Should fallback gracefully, still return 200
    expect(response.status).toBe(200);
  });
});
