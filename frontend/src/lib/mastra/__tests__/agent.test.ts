/**
 * Tests for Mastra agent factory.
 */

// Mock dependencies
jest.mock("@mastra/core/agent", () => ({
  Agent: jest.fn().mockImplementation((config: any) => ({
    id: config.id,
    name: config.name,
    tools: config.tools,
  })),
}));

jest.mock("@mastra/mcp", () => ({
  MCPClient: jest.fn().mockImplementation((config: any) => ({
    ...config,
    listTools: jest.fn().mockResolvedValue({ tool_1: {} }),
    disconnect: jest.fn().mockResolvedValue(undefined),
  })),
}));

jest.mock("../tools", () => ({
  storageTools: {
    save_results: { id: "save_results" },
    list_datasets: { id: "list_datasets" },
  },
}));

import { createApiAgent, disconnectClients, createMCPClient } from "../agent";
import { Agent } from "@mastra/core/agent";
import { MCPClient } from "@mastra/mcp";
import type { ApiConfig } from "@/types/api-config";

describe("createMCPClient", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("creates MCPClient with correct config", () => {
    const config: ApiConfig = {
      targetUrl: "https://api.example.com/graphql",
      apiType: "graphql",
    };

    createMCPClient(config, "test-server");

    expect(MCPClient).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "mcp-test-server",
        timeout: 120_000,
      })
    );
  });

  it("creates MCPClient with custom fetch that sets headers", async () => {
    const config: ApiConfig = {
      targetUrl: "https://api.example.com/graphql",
      apiType: "graphql",
      authHeader: "Bearer token",
      apiName: "my-api",
    };

    createMCPClient(config, "test-server");

    const callArgs = (MCPClient as jest.Mock).mock.calls[0][0];
    const customFetch = callArgs.servers["test-server"].fetch;

    const mockFetch = jest.fn().mockResolvedValue({ ok: true, status: 200 });
    global.fetch = mockFetch;

    await customFetch("http://localhost:3000/mcp", { headers: {} });

    const calledInit = mockFetch.mock.calls[0][1];
    // calledInit.headers is already a Headers instance from buildMcpFetch
    const headers = calledInit.headers as Headers;
    expect(headers.get("X-Target-URL")).toBe(
      "https://api.example.com/graphql"
    );
    expect(headers.get("X-API-Type")).toBe("graphql");
    expect(headers.get("X-API-Name")).toBe("my-api");
  });
});

describe("createApiAgent", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("creates agent with no API configs", async () => {
    const { agent, mcpClients } = await createApiAgent([]);
    expect(agent).toBeDefined();
    expect(mcpClients).toEqual([]);
    expect(Agent).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "api-explorer",
        name: "API Explorer Agent",
      })
    );
  });

  it("creates MCPClient for each API config", async () => {
    const configs: ApiConfig[] = [
      { targetUrl: "https://api1.com/graphql", apiType: "graphql" },
      {
        targetUrl: "https://api2.com/openapi.json",
        apiType: "rest",
        apiName: "api2",
      },
    ];

    const { mcpClients } = await createApiAgent(configs);
    expect(mcpClients).toHaveLength(2);
    expect(MCPClient).toHaveBeenCalledTimes(2);
  });

  it("uses apiName as server ID when available", async () => {
    const configs: ApiConfig[] = [
      {
        targetUrl: "https://api.com/graphql",
        apiType: "graphql",
        apiName: "my-custom-name",
      },
    ];

    await createApiAgent(configs);

    const callArgs = (MCPClient as jest.Mock).mock.calls[0][0];
    expect(callArgs.servers).toHaveProperty("my-custom-name");
  });

  it("falls back to api_N for server ID", async () => {
    const configs: ApiConfig[] = [
      { targetUrl: "https://api.com/graphql", apiType: "graphql" },
    ];

    await createApiAgent(configs);

    const callArgs = (MCPClient as jest.Mock).mock.calls[0][0];
    expect(callArgs.servers).toHaveProperty("api_0");
  });

  it("includes storage tools in agent", async () => {
    await createApiAgent([]);
    const agentConfig = (Agent as jest.Mock).mock.calls[0][0];
    expect(agentConfig.tools).toHaveProperty("save_results");
    expect(agentConfig.tools).toHaveProperty("list_datasets");
  });

  it("handles MCPClient.listTools failure gracefully", async () => {
    (MCPClient as jest.Mock).mockImplementationOnce(() => ({
      listTools: jest.fn().mockRejectedValue(new Error("Connection failed")),
      disconnect: jest.fn(),
    }));

    const configs: ApiConfig[] = [
      { targetUrl: "https://api.com/graphql", apiType: "graphql" },
    ];

    // Should not throw
    const { agent } = await createApiAgent(configs);
    expect(agent).toBeDefined();
  });
});

describe("disconnectClients", () => {
  it("disconnects all clients", async () => {
    const mockDisconnect = jest.fn().mockResolvedValue(undefined);
    const clients = [
      { disconnect: mockDisconnect },
      { disconnect: mockDisconnect },
    ] as any[];

    await disconnectClients(clients);
    expect(mockDisconnect).toHaveBeenCalledTimes(2);
  });

  it("handles disconnect errors gracefully", async () => {
    const clients = [
      { disconnect: jest.fn().mockRejectedValue(new Error("fail")) },
    ] as any[];

    // Should not throw (uses allSettled)
    await expect(disconnectClients(clients)).resolves.not.toThrow();
  });

  it("handles empty clients array", async () => {
    await expect(disconnectClients([])).resolves.not.toThrow();
  });
});
