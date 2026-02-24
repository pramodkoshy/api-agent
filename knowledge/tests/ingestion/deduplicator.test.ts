import { describe, test, expect } from "bun:test";
import { computeContentHash } from "../../src/ingestion/deduplicator";

describe("deduplicator", () => {
  test("computes consistent content hash", () => {
    const hash1 = computeContentHash("Hello World");
    const hash2 = computeContentHash("Hello World");
    expect(hash1).toBe(hash2);
  });

  test("different content produces different hashes", () => {
    const hash1 = computeContentHash("Hello World");
    const hash2 = computeContentHash("Hello World!");
    expect(hash1).not.toBe(hash2);
  });

  test("hash starts with sha256 prefix", () => {
    const hash = computeContentHash("test content");
    expect(hash).toMatch(/^sha256:[a-f0-9]{64}$/);
  });
});
