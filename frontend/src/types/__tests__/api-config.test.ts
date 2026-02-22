import type { ApiConfig } from "../api-config";

describe("ApiConfig type", () => {
  it("accepts minimal config with required fields", () => {
    const config: ApiConfig = {
      targetUrl: "https://api.example.com/graphql",
      apiType: "graphql",
    };
    expect(config.targetUrl).toBe("https://api.example.com/graphql");
    expect(config.apiType).toBe("graphql");
  });

  it("accepts REST API type", () => {
    const config: ApiConfig = {
      targetUrl: "https://api.example.com/openapi.json",
      apiType: "rest",
    };
    expect(config.apiType).toBe("rest");
  });

  it("accepts full config with all optional fields", () => {
    const config: ApiConfig = {
      targetUrl: "https://api.example.com/graphql",
      apiType: "graphql",
      apiName: "my-api",
      authHeader: "Bearer token123",
      authHeaderName: "Authorization",
      baseUrl: "https://api.example.com",
      allowUnsafePaths: ["/api/mutations/*"],
      pollPaths: ["/api/jobs/*"],
    };
    expect(config.apiName).toBe("my-api");
    expect(config.authHeader).toBe("Bearer token123");
    expect(config.authHeaderName).toBe("Authorization");
    expect(config.baseUrl).toBe("https://api.example.com");
    expect(config.allowUnsafePaths).toEqual(["/api/mutations/*"]);
    expect(config.pollPaths).toEqual(["/api/jobs/*"]);
  });

  it("optional fields default to undefined", () => {
    const config: ApiConfig = {
      targetUrl: "https://api.example.com/graphql",
      apiType: "graphql",
    };
    expect(config.apiName).toBeUndefined();
    expect(config.authHeader).toBeUndefined();
    expect(config.authHeaderName).toBeUndefined();
    expect(config.baseUrl).toBeUndefined();
    expect(config.allowUnsafePaths).toBeUndefined();
    expect(config.pollPaths).toBeUndefined();
  });
});
