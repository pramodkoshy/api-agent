"use client";

import { useState, useCallback, useMemo } from "react";
import { CopilotKit } from "@copilotkit/react-core";
import type { ApiConfig } from "@/types/api-config";
import type { StructuredData } from "@/types/query-result";
import { ApiConfigForm } from "@/components/api-config-form";
import { ChatPanel } from "@/components/chat-panel";
import { DataDisplay } from "@/components/data-display";
import { parseAgentResponse } from "@/lib/data-inference";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Zap, Database, Plus, X } from "lucide-react";

export default function Home() {
  // Support multiple API connections
  const [apiConfigs, setApiConfigs] = useState<ApiConfig[]>([]);
  const [lastResult, setLastResult] = useState<StructuredData | null>(null);
  const [resultHistory, setResultHistory] = useState<StructuredData[]>([]);

  const isConnected = apiConfigs.length > 0;

  const handleConnect = useCallback((config: ApiConfig) => {
    setApiConfigs((prev) => {
      // Avoid duplicates by targetUrl
      if (prev.some((c) => c.targetUrl === config.targetUrl)) return prev;
      return [...prev, config];
    });
  }, []);

  const handleRemoveApi = useCallback((targetUrl: string) => {
    setApiConfigs((prev) => prev.filter((c) => c.targetUrl !== targetUrl));
  }, []);

  const handleDisconnectAll = useCallback(() => {
    setApiConfigs([]);
    setLastResult(null);
    setResultHistory([]);
  }, []);

  const handleDataReceived = useCallback((content: string) => {
    const parsed = parseAgentResponse(content);
    if (parsed) {
      setLastResult(parsed);
      setResultHistory((prev) => [parsed, ...prev].slice(0, 10));
    }
  }, []);

  // Pass all API configs as a JSON header to the backend
  const runtimeHeaders = useMemo((): Record<string, string> => {
    if (apiConfigs.length === 0) return {} as Record<string, string>;
    return { "x-api-configs": JSON.stringify(apiConfigs) } as Record<string, string>;
  }, [apiConfigs]);

  return (
    <CopilotKit
      runtimeUrl="/api/copilotkit"
      headers={runtimeHeaders}
      agent="api-explorer"
    >
      <div className="flex flex-col h-screen bg-background">
        {/* Header */}
        <header className="border-b px-4 py-3 flex items-center gap-2 flex-wrap">
          <Zap className="h-5 w-5 text-primary" />
          <h1 className="font-semibold text-lg">API Agent Explorer</h1>
          {apiConfigs.map((config) => (
            <Badge key={config.targetUrl} variant="outline" className="gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-green-500 inline-block" />
              {config.apiType.toUpperCase()} &middot;{" "}
              {config.apiName ||
                (() => {
                  try { return new URL(config.targetUrl).hostname; }
                  catch { return config.targetUrl; }
                })()}
              <button
                onClick={() => handleRemoveApi(config.targetUrl)}
                className="ml-1 hover:text-destructive"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
          {isConnected && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDisconnectAll}
              className="text-xs text-muted-foreground"
            >
              Disconnect All
            </Button>
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
                onDisconnect={handleDisconnectAll}
              />
              {isConnected && (
                <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                  <Plus className="h-3 w-3" />
                  Add more APIs above to combine data from multiple sources
                </p>
              )}
            </div>
            <div className="flex-1 overflow-hidden">
              <ChatPanel
                isConnected={isConnected}
                onDataReceived={handleDataReceived}
              />
            </div>
          </div>

          {/* Right: Results panel */}
          <main className="flex-1 overflow-auto p-4 space-y-4">
            {lastResult ? (
              <>
                <DataDisplay result={lastResult} />
                {resultHistory.length > 1 && (
                  <div className="space-y-2">
                    <h3 className="text-sm font-medium text-muted-foreground">
                      Previous Results
                    </h3>
                    {resultHistory.slice(1).map((r, i) => (
                      <div key={i} className="opacity-70">
                        <DataDisplay result={r} />
                      </div>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-3">
                <Database className="h-12 w-12 opacity-20" />
                <div className="text-center space-y-1">
                  <p className="text-sm">
                    {isConnected
                      ? "Query results will appear here as tables and charts"
                      : "Connect to an API and ask a question to see results"}
                  </p>
                  {isConnected && (
                    <p className="text-xs opacity-60">
                      Results can be saved to MongoDB, combined, and queried later
                    </p>
                  )}
                </div>
              </div>
            )}
          </main>
        </div>
      </div>
    </CopilotKit>
  );
}
