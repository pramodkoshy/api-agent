import type { ScoredChunk } from "../storage/interfaces.js";
import { config } from "../config.js";
import { createLogger } from "../utils/logger.js";

const logger = createLogger("reranker");

export async function rerankChunks(
  query: string,
  chunks: ScoredChunk[],
  topK: number = 10,
): Promise<ScoredChunk[]> {
  if (chunks.length <= topK) return chunks;

  // If Cohere API key available, use cross-encoder reranking
  if (config.cohereApiKey) {
    return cohereRerank(query, chunks, topK);
  }

  // Fallback: simple relevance-based reranking using existing scores
  return fallbackRerank(query, chunks, topK);
}

async function cohereRerank(
  query: string,
  chunks: ScoredChunk[],
  topK: number,
): Promise<ScoredChunk[]> {
  try {
    const response = await fetch("https://api.cohere.ai/v1/rerank", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.cohereApiKey}`,
      },
      body: JSON.stringify({
        model: "rerank-v3.5",
        query,
        documents: chunks.map((c) => c.text),
        top_n: topK,
      }),
    });

    if (!response.ok) {
      logger.warn("Cohere rerank failed, using fallback", { status: response.status });
      return fallbackRerank(query, chunks, topK);
    }

    const data = (await response.json()) as {
      results: Array<{ index: number; relevance_score: number }>;
    };

    const reranked = data.results.map((r) => ({
      ...chunks[r.index],
      score: r.relevance_score,
    }));

    logger.info("Cohere rerank complete", { input: chunks.length, output: reranked.length });
    return reranked;
  } catch (error) {
    logger.warn("Cohere rerank error, using fallback", { error: String(error) });
    return fallbackRerank(query, chunks, topK);
  }
}

function fallbackRerank(
  query: string,
  chunks: ScoredChunk[],
  topK: number,
): ScoredChunk[] {
  // Simple keyword-boosted reranking
  const queryTerms = query.toLowerCase().split(/\s+/).filter((t) => t.length > 2);

  const scored = chunks.map((chunk) => {
    const text = chunk.text.toLowerCase();
    let boost = 0;
    for (const term of queryTerms) {
      if (text.includes(term)) boost += 0.1;
    }
    return { ...chunk, score: chunk.score + boost };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, topK);
}
