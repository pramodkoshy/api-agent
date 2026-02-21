"use client";

import { useState } from "react";
import type { ApiConfig } from "@/types/api-config";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Globe, Key, Plug, Plus } from "lucide-react";

interface ApiConfigFormProps {
  onConnect: (config: ApiConfig) => void;
  isConnected: boolean;
  onDisconnect: () => void;
}

export function ApiConfigForm({
  onConnect,
  isConnected,
  onDisconnect,
}: ApiConfigFormProps) {
  const [targetUrl, setTargetUrl] = useState("");
  const [apiType, setApiType] = useState<"graphql" | "rest">("graphql");
  const [apiName, setApiName] = useState("");
  const [authHeader, setAuthHeader] = useState("");
  const [authHeaderName, setAuthHeaderName] = useState("Authorization");
  const [baseUrl, setBaseUrl] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetUrl) return;

    onConnect({
      targetUrl,
      apiType,
      apiName: apiName || undefined,
      authHeader: authHeader || undefined,
      authHeaderName: authHeaderName || "Authorization",
      baseUrl: baseUrl || undefined,
    });

    // Reset form for adding another API
    setTargetUrl("");
    setApiName("");
    setAuthHeader("");
    setBaseUrl("");
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Globe className="h-5 w-5" />
          {isConnected ? "Add Another API" : "API Connection"}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="flex gap-2">
            <div className="flex-1">
              <Label htmlFor="targetUrl" className="sr-only">
                API URL
              </Label>
              <Input
                id="targetUrl"
                placeholder={
                  apiType === "graphql"
                    ? "https://api.example.com/graphql"
                    : "https://api.example.com/openapi.json"
                }
                value={targetUrl}
                onChange={(e) => setTargetUrl(e.target.value)}
              />
            </div>
            <Select
              value={apiType}
              onValueChange={(v) => setApiType(v as "graphql" | "rest")}
            >
              <SelectTrigger className="w-[120px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="graphql">GraphQL</SelectItem>
                <SelectItem value="rest">REST</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex gap-2">
            <div className="flex-1">
              <Label htmlFor="authHeader" className="sr-only">
                Auth Header
              </Label>
              <div className="relative">
                <Key className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  id="authHeader"
                  placeholder="Bearer your-token-here (optional)"
                  value={authHeader}
                  onChange={(e) => setAuthHeader(e.target.value)}
                  className="pl-9"
                  type="password"
                />
              </div>
            </div>
          </div>

          {showAdvanced && (
            <div className="space-y-2 rounded-md border p-3">
              <div className="flex gap-2">
                <div className="flex-1">
                  <Label htmlFor="apiName" className="text-xs text-muted-foreground">
                    API Name
                  </Label>
                  <Input
                    id="apiName"
                    placeholder="my-api"
                    value={apiName}
                    onChange={(e) => setApiName(e.target.value)}
                  />
                </div>
                <div className="flex-1">
                  <Label htmlFor="authHeaderName" className="text-xs text-muted-foreground">
                    Auth Header Name
                  </Label>
                  <Input
                    id="authHeaderName"
                    placeholder="Authorization"
                    value={authHeaderName}
                    onChange={(e) => setAuthHeaderName(e.target.value)}
                  />
                </div>
              </div>
              {apiType === "rest" && (
                <div>
                  <Label htmlFor="baseUrl" className="text-xs text-muted-foreground">
                    Base URL Override
                  </Label>
                  <Input
                    id="baseUrl"
                    placeholder="https://api.example.com/v1"
                    value={baseUrl}
                    onChange={(e) => setBaseUrl(e.target.value)}
                  />
                </div>
              )}
            </div>
          )}

          <div className="flex items-center gap-2">
            <Button type="submit" disabled={!targetUrl} className="w-full">
              {isConnected ? (
                <>
                  <Plus className="mr-2 h-4 w-4" />
                  Add API
                </>
              ) : (
                <>
                  <Plug className="mr-2 h-4 w-4" />
                  Connect
                </>
              )}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setShowAdvanced(!showAdvanced)}
            >
              {showAdvanced ? "Less" : "More"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
