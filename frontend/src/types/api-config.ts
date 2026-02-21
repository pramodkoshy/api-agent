/** Configuration for connecting to a target API via the MCP server. */
export interface ApiConfig {
  /** Target API URL (GraphQL endpoint or OpenAPI spec URL) */
  targetUrl: string;
  /** API type */
  apiType: "graphql" | "rest";
  /** Friendly display name (becomes tool name prefix) */
  apiName?: string;
  /** Auth header value (e.g., "Bearer token123") */
  authHeader?: string;
  /** Auth header name (default: "Authorization") */
  authHeaderName?: string;
  /** Override base URL for REST APIs */
  baseUrl?: string;
  /** Glob patterns for unsafe paths (POST/PUT/DELETE/PATCH) */
  allowUnsafePaths?: string[];
  /** Paths requiring polling (REST only) */
  pollPaths?: string[];
}
