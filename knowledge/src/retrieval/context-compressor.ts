import type { ScoredChunk } from "../storage/interfaces.js";
import { estimateTokens } from "../utils/token-counter.js";
import { createLogger } from "../utils/logger.js";

const logger = createLogger("context-compressor");

const MAX_CONTEXT_TOKENS = 16000;

export interface CompressedContext {
  chunks: ScoredChunk[];
  totalTokens: number;
  removedDuplicates: number;
}

export function compressContext(
  chunks: ScoredChunk[],
  maxTokens: number = MAX_CONTEXT_TOKENS,
): CompressedContext {
  // Step 1: Remove exact duplicate texts
  const seen = new Set<string>();
  const deduped: ScoredChunk[] = [];
  let removedDuplicates = 0;

  for (const chunk of chunks) {
    const normalized = chunk.text.trim().toLowerCase();
    if (seen.has(normalized)) {
      removedDuplicates++;
      continue;
    }
    seen.add(normalized);
    deduped.push(chunk);
  }

  // Step 2: Remove highly overlapping chunks (>80% token overlap)
  const filtered: ScoredChunk[] = [];
  for (const chunk of deduped) {
    const hasHighOverlap = filtered.some(
      (existing) => computeOverlap(existing.text, chunk.text) > 0.8,
    );
    if (!hasHighOverlap) {
      filtered.push(chunk);
    } else {
      removedDuplicates++;
    }
  }

  // Step 3: Trim to fit within token budget
  const result: ScoredChunk[] = [];
  let totalTokens = 0;

  for (const chunk of filtered) {
    const chunkTokens = estimateTokens(chunk.text);
    if (totalTokens + chunkTokens > maxTokens) break;
    result.push(chunk);
    totalTokens += chunkTokens;
  }

  logger.info("Context compressed", {
    input: chunks.length,
    output: result.length,
    removedDuplicates,
    totalTokens,
  });

  return { chunks: result, totalTokens, removedDuplicates };
}

function computeOverlap(text1: string, text2: string): number {
  const words1 = new Set(text1.toLowerCase().split(/\s+/));
  const words2 = new Set(text2.toLowerCase().split(/\s+/));

  let intersection = 0;
  for (const word of words1) {
    if (words2.has(word)) intersection++;
  }

  const smaller = Math.min(words1.size, words2.size);
  return smaller > 0 ? intersection / smaller : 0;
}
