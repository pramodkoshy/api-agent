import type {
  IVectorStore,
  ChunkWithEmbedding,
  ScoredChunk,
} from "./interfaces.js";
import { config } from "../config.js";
import { createLogger } from "../utils/logger.js";
import { withRetry } from "../utils/retry.js";

const logger = createLogger("qdrant");

interface QdrantPoint {
  id: string;
  vector: number[];
  payload: Record<string, unknown>;
}

interface QdrantSearchResult {
  id: string;
  score: number;
  payload: Record<string, unknown>;
}

export class QdrantVectorStore implements IVectorStore {
  private baseUrl: string;

  constructor() {
    this.baseUrl = config.qdrantUrl;
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Qdrant ${method} ${path} failed: ${response.status} ${text}`);
    }

    const data = await response.json();
    return (data as { result: T }).result;
  }

  async createIndex(
    name: string,
    dimension: number,
    metric: "cosine" | "euclidean" | "dot" = "cosine",
  ): Promise<void> {
    try {
      await this.request("PUT", `/collections/${name}`, {
        vectors: {
          size: dimension,
          distance: metric === "cosine" ? "Cosine" : metric === "dot" ? "Dot" : "Euclid",
        },
      });
      logger.info("Created Qdrant collection", { name, dimension, metric });
    } catch (error) {
      // Collection may already exist
      if (String(error).includes("already exists")) {
        logger.info("Qdrant collection already exists", { name });
        return;
      }
      throw error;
    }
  }

  async upsert(indexName: string, chunks: ChunkWithEmbedding[]): Promise<void> {
    if (chunks.length === 0) return;

    const BATCH_SIZE = 100;
    for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
      const batch = chunks.slice(i, i + BATCH_SIZE);
      const points: QdrantPoint[] = batch.map((chunk) => ({
        id: chunk.chunkId,
        vector: chunk.embedding,
        payload: {
          chunkId: chunk.chunkId,
          documentId: chunk.documentId,
          text: chunk.text,
          source: chunk.metadata.source,
          entityIds: chunk.metadata.entityIds,
          topics: chunk.metadata.topics,
          publishedAt: chunk.metadata.publishedAt || "",
        },
      }));

      await withRetry(
        () => this.request("PUT", `/collections/${indexName}/points`, { points }),
        { maxRetries: 2 },
        `qdrant upsert batch ${i / BATCH_SIZE + 1}`,
      );
    }

    logger.info("Upserted chunks to Qdrant", { indexName, count: chunks.length });
  }

  async query(
    indexName: string,
    embedding: number[],
    topK: number,
    filter?: Record<string, unknown>,
  ): Promise<ScoredChunk[]> {
    const body: Record<string, unknown> = {
      vector: embedding,
      limit: topK,
      with_payload: true,
    };

    if (filter) {
      const must: Array<Record<string, unknown>> = [];
      for (const [key, value] of Object.entries(filter)) {
        if (key === "documentId" && typeof value === "object" && value !== null && "$in" in value) {
          must.push({
            key: "documentId",
            match: { any: (value as { $in: string[] }).$in },
          });
        } else if (typeof value === "string") {
          must.push({ key, match: { value } });
        }
      }
      if (must.length > 0) {
        body.filter = { must };
      }
    }

    const results = await this.request<QdrantSearchResult[]>(
      "POST",
      `/collections/${indexName}/points/search`,
      body,
    );

    return results.map((r) => ({
      chunkId: String(r.id),
      documentId: String(r.payload.documentId || ""),
      text: String(r.payload.text || ""),
      score: r.score,
      metadata: r.payload,
    }));
  }

  async delete(indexName: string, ids: string[]): Promise<void> {
    if (ids.length === 0) return;
    await this.request("POST", `/collections/${indexName}/points/delete`, {
      points: ids,
    });
    logger.info("Deleted points from Qdrant", { indexName, count: ids.length });
  }

  async getCollectionInfo(indexName: string): Promise<{ vectorCount: number } | null> {
    try {
      const result = await this.request<{ points_count: number }>(
        "GET",
        `/collections/${indexName}`,
      );
      return { vectorCount: result.points_count };
    } catch {
      return null;
    }
  }
}
