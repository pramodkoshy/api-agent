"use client";

import { useEffect } from "react";
import { useCopilotChat } from "@copilotkit/react-core";
import { CopilotChat } from "@copilotkit/react-ui";
import type { ApiConfig } from "@/types/api-config";

interface ChatPanelProps {
  isConnected: boolean;
  apiConfig: ApiConfig | null;
  onDataReceived?: (data: string) => void;
}

export function ChatPanel({ isConnected, apiConfig, onDataReceived }: ChatPanelProps) {
  const { setMcpServers, visibleMessages, isLoading } = useCopilotChat();

  // Configure MCP server connection when API config changes
  useEffect(() => {
    if (isConnected && apiConfig) {
      const mcpUrl = new URL("/api/mcp-proxy", window.location.origin);
      mcpUrl.searchParams.set("targetUrl", apiConfig.targetUrl);
      mcpUrl.searchParams.set("apiType", apiConfig.apiType);
      if (apiConfig.authHeader) mcpUrl.searchParams.set("authHeader", apiConfig.authHeader);
      if (apiConfig.authHeaderName) mcpUrl.searchParams.set("authHeaderName", apiConfig.authHeaderName);
      if (apiConfig.apiName) mcpUrl.searchParams.set("apiName", apiConfig.apiName);
      if (apiConfig.baseUrl) mcpUrl.searchParams.set("baseUrl", apiConfig.baseUrl);

      setMcpServers([{ endpoint: mcpUrl.toString() }]);
    } else {
      setMcpServers([]);
    }
  }, [isConnected, apiConfig, setMcpServers]);

  // Track last assistant message for data extraction
  useEffect(() => {
    if (!onDataReceived || !visibleMessages?.length) return;
    const last = visibleMessages[visibleMessages.length - 1];
    if (!last || isLoading) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const msg = last as any;
    if (msg.role === "assistant" && typeof msg.content === "string" && msg.content) {
      onDataReceived(msg.content);
    }
  }, [visibleMessages, isLoading, onDataReceived]);

  if (!isConnected) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
        Connect to an API to start chatting
      </div>
    );
  }

  return (
    <CopilotChat
      className="h-full"
      labels={{
        title: "API Agent",
        initial: "Ask a question about your API. Results will appear as tables and charts in the results panel.",
        placeholder: "What data would you like to explore?",
      }}
    />
  );
}
