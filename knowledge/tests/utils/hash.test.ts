import { describe, test, expect } from "bun:test";
import { contentHash, generateId } from "../../src/utils/hash";

describe("contentHash", () => {
  test("produces sha256 hash", () => {
    const hash = contentHash("test");
    expect(hash).toMatch(/^sha256:[a-f0-9]{64}$/);
  });

  test("is deterministic", () => {
    expect(contentHash("hello")).toBe(contentHash("hello"));
  });

  test("different input produces different hash", () => {
    expect(contentHash("a")).not.toBe(contentHash("b"));
  });
});

describe("generateId", () => {
  test("generates ID with prefix", () => {
    const id = generateId("doc");
    expect(id).toMatch(/^doc_/);
  });

  test("generates unique IDs", () => {
    const ids = new Set(Array.from({ length: 100 }, () => generateId("test")));
    expect(ids.size).toBe(100);
  });
});
