"use client";

import { useEffect } from "react";
import { useCopilotChat } from "@copilotkit/react-core";
import { CopilotChat } from "@copilotkit/react-ui";

interface ChatPanelProps {
  isConnected: boolean;
  onDataReceived?: (data: string) => void;
}

/**
 * Chat panel using CopilotKit's built-in chat component.
 *
 * All MCP communication goes through the Mastra agent on the server side:
 *   CopilotChat → CopilotRuntime → MastraAgent → Mastra Agent (MCPClient + MongoDB tools)
 *
 * No direct MCP proxy — Mastra is the sole bridge to the Agoda MCP service.
 */
export function ChatPanel({ isConnected, onDataReceived }: ChatPanelProps) {
  const { visibleMessages, isLoading } = useCopilotChat();

  // Track last assistant message for data extraction into the results panel
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
      <div className="flex items-center justify-center h-full text-muted-foreground text-xs sm:text-sm px-4 text-center">
        Connect to an API to start chatting
      </div>
    );
  }

  return (
    <CopilotChat
      className="h-full"
      labels={{
        title: "API Agent",
        initial:
          "Ask a question about your API. I can query data, save results to MongoDB, " +
          "combine datasets from different APIs, and display results as tables and charts.",
        placeholder: "What data would you like to explore?",
      }}
    />
  );
}
