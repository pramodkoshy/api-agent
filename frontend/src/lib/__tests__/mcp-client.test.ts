/**
 * Tests for MCP client factory.
 * We mock the MCPClient constructor to verify correct configuration.
 */

// Mock the @mastra/mcp module
jest.mock("@mastra/mcp", () => ({
  MCPClient: jest.fn().mockImplementation((config: Record<string, unknown>) => ({
    ...config,
    connect: jest.fn(),
    disconnect: jest.fn(),
    listTools: jest.fn().mockResolvedValue({}),
  })),
}));

import { createMCPClient } from "../mcp-client";
import { MCPClient } from "@mastra/mcp";
import type { ApiConfig } from "@/types/api-config";

describe("createMCPClient", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("creates an MCPClient with correct ID", () => {
    const config: ApiConfig = {
      targetUrl: "https://api.example.com/graphql",
      apiType: "graphql",
    };
    createMCPClient(config);
    expect(MCPClient).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "mcp-graphql-https://api.example.com/graphql",
        timeout: 120_000,
      })
    );
  });

  it("creates an MCPClient with servers configuration", () => {
    const config: ApiConfig = {
      targetUrl: "https://api.example.com/graphql",
      apiType: "graphql",
    };
    createMCPClient(config);
    const callArgs = (MCPClient as jest.Mock).mock.calls[0][0];
    expect(callArgs.servers).toHaveProperty("api-agent");
    expect(callArgs.servers["api-agent"]).toHaveProperty("url");
    expect(callArgs.servers["api-agent"]).toHaveProperty("fetch");
  });

  it("custom fetch sets X-Target-URL header", async () => {
    const config: ApiConfig = {
      targetUrl: "https://api.example.com/graphql",
      apiType: "graphql",
    };
    createMCPClient(config);
    const callArgs = (MCPClient as jest.Mock).mock.calls[0][0];
    const customFetch = callArgs.servers["api-agent"].fetch;

    // Mock global fetch
    const mockFetch = jest.fn().mockResolvedValue({ ok: true, status: 200 });
    global.fetch = mockFetch;

    await customFetch("http://localhost:3000/mcp", { headers: {} });

    const calledInit = mockFetch.mock.calls[0][1];
    const headers = new Headers(calledInit.headers);
    expect(headers.get("X-Target-URL")).toBe("https://api.example.com/graphql");
    expect(headers.get("X-API-Type")).toBe("graphql");
  });

  it("sets auth header when provided", async () => {
    const config: ApiConfig = {
      targetUrl: "https://api.example.com/graphql",
      apiType: "graphql",
      authHeader: "Bearer token123",
    };
    createMCPClient(config);
    const callArgs = (MCPClient as jest.Mock).mock.calls[0][0];
    const customFetch = callArgs.servers["api-agent"].fetch;

    const mockFetch = jest.fn().mockResolvedValue({ ok: true, status: 200 });
    global.fetch = mockFetch;

    await customFetch("http://localhost:3000/mcp", { headers: {} });

    const calledInit = mockFetch.mock.calls[0][1];
    const headers = new Headers(calledInit.headers);
    const targetHeaders = JSON.parse(headers.get("X-Target-Headers") || "{}");
    expect(targetHeaders).toHaveProperty("Authorization", "Bearer token123");
  });

  it("uses custom auth header name", async () => {
    const config: ApiConfig = {
      targetUrl: "https://api.example.com/rest",
      apiType: "rest",
      authHeader: "my-api-key",
      authHeaderName: "X-API-Key",
    };
    createMCPClient(config);
    const callArgs = (MCPClient as jest.Mock).mock.calls[0][0];
    const customFetch = callArgs.servers["api-agent"].fetch;

    const mockFetch = jest.fn().mockResolvedValue({ ok: true, status: 200 });
    global.fetch = mockFetch;

    await customFetch("http://localhost:3000/mcp", { headers: {} });

    const calledInit = mockFetch.mock.calls[0][1];
    const headers = new Headers(calledInit.headers);
    const targetHeaders = JSON.parse(headers.get("X-Target-Headers") || "{}");
    expect(targetHeaders).toHaveProperty("X-API-Key", "my-api-key");
  });

  it("sets API name header when provided", async () => {
    const config: ApiConfig = {
      targetUrl: "https://api.example.com/graphql",
      apiType: "graphql",
      apiName: "my-api",
    };
    createMCPClient(config);
    const callArgs = (MCPClient as jest.Mock).mock.calls[0][0];
    const customFetch = callArgs.servers["api-agent"].fetch;

    const mockFetch = jest.fn().mockResolvedValue({ ok: true, status: 200 });
    global.fetch = mockFetch;

    await customFetch("http://localhost:3000/mcp", { headers: {} });

    const calledInit = mockFetch.mock.calls[0][1];
    const headers = new Headers(calledInit.headers);
    expect(headers.get("X-API-Name")).toBe("my-api");
  });

  it("sets base URL header when provided", async () => {
    const config: ApiConfig = {
      targetUrl: "https://api.example.com/openapi.json",
      apiType: "rest",
      baseUrl: "https://api.example.com/v1",
    };
    createMCPClient(config);
    const callArgs = (MCPClient as jest.Mock).mock.calls[0][0];
    const customFetch = callArgs.servers["api-agent"].fetch;

    const mockFetch = jest.fn().mockResolvedValue({ ok: true, status: 200 });
    global.fetch = mockFetch;

    await customFetch("http://localhost:3000/mcp", { headers: {} });

    const calledInit = mockFetch.mock.calls[0][1];
    const headers = new Headers(calledInit.headers);
    expect(headers.get("X-Base-URL")).toBe("https://api.example.com/v1");
  });

  it("sets unsafe paths header when provided", async () => {
    const config: ApiConfig = {
      targetUrl: "https://api.example.com/openapi.json",
      apiType: "rest",
      allowUnsafePaths: ["/api/users/*", "/api/orders/*"],
    };
    createMCPClient(config);
    const callArgs = (MCPClient as jest.Mock).mock.calls[0][0];
    const customFetch = callArgs.servers["api-agent"].fetch;

    const mockFetch = jest.fn().mockResolvedValue({ ok: true, status: 200 });
    global.fetch = mockFetch;

    await customFetch("http://localhost:3000/mcp", { headers: {} });

    const calledInit = mockFetch.mock.calls[0][1];
    const headers = new Headers(calledInit.headers);
    const unsafePaths = JSON.parse(headers.get("X-Allow-Unsafe-Paths") || "[]");
    expect(unsafePaths).toEqual(["/api/users/*", "/api/orders/*"]);
  });

  it("sets poll paths header when provided", async () => {
    const config: ApiConfig = {
      targetUrl: "https://api.example.com/openapi.json",
      apiType: "rest",
      pollPaths: ["/api/jobs/*"],
    };
    createMCPClient(config);
    const callArgs = (MCPClient as jest.Mock).mock.calls[0][0];
    const customFetch = callArgs.servers["api-agent"].fetch;

    const mockFetch = jest.fn().mockResolvedValue({ ok: true, status: 200 });
    global.fetch = mockFetch;

    await customFetch("http://localhost:3000/mcp", { headers: {} });

    const calledInit = mockFetch.mock.calls[0][1];
    const headers = new Headers(calledInit.headers);
    const pollPaths = JSON.parse(headers.get("X-Poll-Paths") || "[]");
    expect(pollPaths).toEqual(["/api/jobs/*"]);
  });

  it("omits optional headers when not provided", async () => {
    const config: ApiConfig = {
      targetUrl: "https://api.example.com/graphql",
      apiType: "graphql",
    };
    createMCPClient(config);
    const callArgs = (MCPClient as jest.Mock).mock.calls[0][0];
    const customFetch = callArgs.servers["api-agent"].fetch;

    const mockFetch = jest.fn().mockResolvedValue({ ok: true, status: 200 });
    global.fetch = mockFetch;

    await customFetch("http://localhost:3000/mcp", { headers: {} });

    const calledInit = mockFetch.mock.calls[0][1];
    const headers = new Headers(calledInit.headers);
    expect(headers.get("X-API-Name")).toBeNull();
    expect(headers.get("X-Base-URL")).toBeNull();
    expect(headers.get("X-Allow-Unsafe-Paths")).toBeNull();
    expect(headers.get("X-Poll-Paths")).toBeNull();
  });
});
