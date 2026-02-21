"use client";

import { useState, useCallback } from "react";
import { CopilotKit } from "@copilotkit/react-core";
import type { ApiConfig } from "@/types/api-config";
import type { StructuredData } from "@/types/query-result";
import { ApiConfigForm } from "@/components/api-config-form";
import { ChatPanel } from "@/components/chat-panel";
import { DataDisplay } from "@/components/data-display";
import { parseAgentResponse } from "@/lib/data-inference";
import { Badge } from "@/components/ui/badge";
import { Zap, Database } from "lucide-react";

export default function Home() {
  const [apiConfig, setApiConfig] = useState<ApiConfig | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [lastResult, setLastResult] = useState<StructuredData | null>(null);

  const handleConnect = useCallback((config: ApiConfig) => {
    setApiConfig(config);
    setIsConnected(true);
    setLastResult(null);
  }, []);

  const handleDisconnect = useCallback(() => {
    setApiConfig(null);
    setIsConnected(false);
    setLastResult(null);
  }, []);

  const handleDataReceived = useCallback((content: string) => {
    const parsed = parseAgentResponse(content);
    if (parsed) setLastResult(parsed);
  }, []);

  // Build custom headers to pass API config to our backend route
  const runtimeHeaders: Record<string, string> = {};
  if (apiConfig) {
    runtimeHeaders["x-api-target-url"] = apiConfig.targetUrl;
    runtimeHeaders["x-api-type"] = apiConfig.apiType;
    if (apiConfig.authHeader) {
      runtimeHeaders["x-api-auth-header"] = apiConfig.authHeader;
    }
    if (apiConfig.authHeaderName) {
      runtimeHeaders["x-api-auth-header-name"] = apiConfig.authHeaderName;
    }
    if (apiConfig.apiName) {
      runtimeHeaders["x-api-name"] = apiConfig.apiName;
    }
    if (apiConfig.baseUrl) {
      runtimeHeaders["x-api-base-url"] = apiConfig.baseUrl;
    }
  }

  return (
    <CopilotKit runtimeUrl="/api/copilotkit" headers={runtimeHeaders}>
      <div className="flex flex-col h-screen bg-background">
        {/* Header */}
        <header className="border-b px-4 py-3 flex items-center gap-3">
          <Zap className="h-5 w-5 text-primary" />
          <h1 className="font-semibold text-lg">API Agent Explorer</h1>
          {isConnected && apiConfig && (
            <Badge variant="outline" className="gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-green-500 inline-block" />
              {apiConfig.apiType.toUpperCase()} &middot;{" "}
              {apiConfig.apiName ||
                (() => { try { return new URL(apiConfig.targetUrl).hostname; } catch { return apiConfig.targetUrl; } })()}
            </Badge>
          )}
        </header>

        {/* Main content */}
        <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
          {/* Left: API config + Chat */}
          <div className="flex flex-col w-full lg:w-[420px] border-b lg:border-b-0 lg:border-r overflow-hidden">
            <div className="p-3 border-b">
              <ApiConfigForm
                onConnect={handleConnect}
                isConnected={isConnected}
                onDisconnect={handleDisconnect}
              />
            </div>
            <div className="flex-1 overflow-hidden">
              <ChatPanel
                isConnected={isConnected}
                apiConfig={apiConfig}
                onDataReceived={handleDataReceived}
              />
            </div>
          </div>

          {/* Right: Results panel */}
          <main className="flex-1 overflow-auto p-4">
            {lastResult ? (
              <DataDisplay result={lastResult} />
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-3">
                <Database className="h-12 w-12 opacity-20" />
                <p className="text-sm">
                  {isConnected
                    ? "Query results will appear here as tables and charts"
                    : "Connect to an API and ask a question to see results"}
                </p>
              </div>
            )}
          </main>
        </div>
      </div>
    </CopilotKit>
  );
}
