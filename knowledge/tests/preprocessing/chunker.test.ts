import { describe, test, expect } from "bun:test";
import { chunkText } from "../../src/preprocessing/chunker";

describe("chunkText", () => {
  test("returns single chunk for short text", () => {
    const chunks = chunkText("Hello World", "doc_1", 1000, 50);
    expect(chunks).toHaveLength(1);
    expect(chunks[0].text).toBe("Hello World");
    expect(chunks[0].documentId).toBe("doc_1");
    expect(chunks[0].index).toBe(0);
  });

  test("splits long text into multiple chunks", () => {
    const longText = Array(500).fill("This is a sentence.").join(" ");
    const chunks = chunkText(longText, "doc_2", 100, 10);
    expect(chunks.length).toBeGreaterThan(1);
    // Each chunk should have reasonable token count
    for (const chunk of chunks) {
      expect(chunk.tokenCount).toBeGreaterThan(0);
    }
  });

  test("preserves document ID in all chunks", () => {
    const longText = Array(200).fill("Another sentence here.").join("\n\n");
    const chunks = chunkText(longText, "doc_3", 50, 10);
    for (const chunk of chunks) {
      expect(chunk.documentId).toBe("doc_3");
    }
  });

  test("generates unique chunk IDs", () => {
    const longText = Array(100).fill("Some content.").join("\n\n");
    const chunks = chunkText(longText, "doc_4", 50, 10);
    const ids = new Set(chunks.map((c) => c.chunkId));
    expect(ids.size).toBe(chunks.length);
  });

  test("chunks have sequential indexes", () => {
    const longText = Array(100).fill("A paragraph of text.").join("\n\n");
    const chunks = chunkText(longText, "doc_5", 50, 10);
    for (let i = 0; i < chunks.length; i++) {
      expect(chunks[i].index).toBe(i);
    }
  });
});
