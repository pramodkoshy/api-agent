import { describe, test, expect } from "bun:test";
import { estimateTokens, truncateToTokens } from "../../src/utils/token-counter";

describe("estimateTokens", () => {
  test("estimates tokens for text", () => {
    const tokens = estimateTokens("Hello World");
    expect(tokens).toBeGreaterThan(0);
  });

  test("longer text has more tokens", () => {
    const short = estimateTokens("Hello");
    const long = estimateTokens("Hello World, this is a longer sentence");
    expect(long).toBeGreaterThan(short);
  });

  test("empty string has zero tokens", () => {
    expect(estimateTokens("")).toBe(0);
  });
});

describe("truncateToTokens", () => {
  test("does not truncate short text", () => {
    const text = "Hello";
    expect(truncateToTokens(text, 1000)).toBe(text);
  });

  test("truncates long text", () => {
    const text = "A".repeat(10000);
    const truncated = truncateToTokens(text, 100);
    expect(truncated.length).toBeLessThan(text.length);
  });
});
