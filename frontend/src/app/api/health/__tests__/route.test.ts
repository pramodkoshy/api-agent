/**
 * Tests for the health check API route.
 */

// Mock next/server since it requires Node APIs not available in jsdom
jest.mock("next/server", () => ({
  NextResponse: {
    json: (body: unknown, init?: ResponseInit) => ({
      status: init?.status ?? 200,
      headers: {
        get: (name: string) => {
          if (name.toLowerCase() === "content-type") return "application/json";
          return null;
        },
      },
      json: async () => body,
    }),
  },
}));

import { GET } from "../route";

describe("GET /api/health", () => {
  it("returns JSON with status ok", async () => {
    const response = await GET();
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body).toEqual({ status: "ok" });
  });

  it("returns correct content-type", async () => {
    const response = await GET();
    expect(response.headers.get("content-type")).toContain("application/json");
  });
});
