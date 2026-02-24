import type { IVectorStore, ScoredChunk } from "../storage/interfaces.js";
import { embedText } from "../preprocessing/embedder.js";
import { createLogger } from "../utils/logger.js";

const logger = createLogger("vector-search");

export interface VectorSearchOptions {
  topK: number;
  documentIds?: string[];
  source?: string;
  topics?: string[];
}

export async function searchVectors(
  vectorStore: IVectorStore,
  query: string,
  options: VectorSearchOptions,
): Promise<ScoredChunk[]> {
  // Embed the query
  const queryEmbedding = await embedText(query);

  // Build filter
  const filter: Record<string, unknown> = {};
  if (options.documentIds?.length) {
    filter.documentId = { $in: options.documentIds };
  }
  if (options.source) {
    filter.source = options.source;
  }

  const results = await vectorStore.query(
    "knowledge-chunks",
    queryEmbedding,
    options.topK,
    Object.keys(filter).length > 0 ? filter : undefined,
  );

  logger.info("Vector search complete", {
    query: query.slice(0, 100),
    topK: options.topK,
    results: results.length,
  });

  return results;
}
