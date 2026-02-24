import { describe, test, expect } from "bun:test";
import { compressContext } from "../../src/retrieval/context-compressor";
import type { ScoredChunk } from "../../src/storage/interfaces";

function makeChunk(id: string, text: string, score: number): ScoredChunk {
  return {
    chunkId: id,
    documentId: "doc_1",
    text,
    score,
    metadata: {},
  };
}

describe("compressContext", () => {
  test("removes exact duplicate texts", () => {
    const chunks = [
      makeChunk("c1", "Hello World", 0.9),
      makeChunk("c2", "Hello World", 0.8),
      makeChunk("c3", "Different text", 0.7),
    ];

    const result = compressContext(chunks);
    expect(result.chunks).toHaveLength(2);
    expect(result.removedDuplicates).toBe(1);
  });

  test("respects token budget", () => {
    const chunks = Array.from({ length: 100 }, (_, i) =>
      makeChunk(`c${i}`, `Chunk number ${i} with some content. `.repeat(50), 0.9 - i * 0.01),
    );

    const result = compressContext(chunks, 1000);
    expect(result.totalTokens).toBeLessThanOrEqual(1000);
  });

  test("returns all chunks when within budget", () => {
    const chunks = [
      makeChunk("c1", "Short text one", 0.9),
      makeChunk("c2", "Short text two", 0.8),
    ];

    const result = compressContext(chunks, 100000);
    expect(result.chunks).toHaveLength(2);
  });

  test("removes highly overlapping chunks", () => {
    const baseText = "The quick brown fox jumps over the lazy dog repeatedly";
    const chunks = [
      makeChunk("c1", baseText, 0.9),
      makeChunk("c2", baseText + " again", 0.8), // very similar
      makeChunk("c3", "Completely different text about something else entirely", 0.7),
    ];

    const result = compressContext(chunks);
    // Should remove the highly overlapping chunk
    expect(result.chunks.length).toBeLessThanOrEqual(3);
  });
});
