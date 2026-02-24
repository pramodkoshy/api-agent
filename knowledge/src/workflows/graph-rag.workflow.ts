import { z } from "zod";
import type { IVectorStore, IGraphStore, IMetadataStore } from "../storage/interfaces.js";
import { hybridRetrieve } from "../retrieval/hybrid-retriever.js";
import { synthesize, type SynthesisResult } from "../synthesis/synthesizer.js";
import { createLogger } from "../utils/logger.js";

const logger = createLogger("graph-rag-workflow");

export const graphRagInputSchema = z.object({
  query: z.string(),
  filters: z
    .object({
      dateRange: z
        .object({ from: z.string().optional(), to: z.string().optional() })
        .optional(),
      sources: z.array(z.string()).optional(),
      topics: z.array(z.string()).optional(),
    })
    .optional(),
  maxHops: z.number().min(1).max(3).default(2),
  topK: z.number().min(1).max(50).default(10),
});

export type GraphRagInput = z.infer<typeof graphRagInputSchema>;

export interface GraphRagResult {
  answer: string;
  citations: Array<{
    source: string;
    url?: string;
    text: string;
    chunkId: string;
    score: number;
  }>;
  entities: Array<{ name: string; type: string; relation?: string }>;
  graphData: {
    nodes: Array<{ id: string; label: string; type: string }>;
    edges: Array<{ from: string; to: string; label: string }>;
  };
  confidence: number;
}

export async function runGraphRagWorkflow(
  input: GraphRagInput,
  vectorStore: IVectorStore,
  graphStore: IGraphStore,
  metadataStore: IMetadataStore,
): Promise<GraphRagResult> {
  logger.info("Starting Graph RAG workflow", { query: input.query.slice(0, 100) });

  // Step 1-7: Hybrid retrieval
  const retrieval = await hybridRetrieve(
    input.query,
    vectorStore,
    graphStore,
    metadataStore,
    {
      maxHops: input.maxHops,
      topK: input.topK,
      filters: input.filters,
    },
  );

  // Build document map for citations
  const documentMap = new Map<string, { source: string; url: string }>();
  for (const chunk of retrieval.context.chunks) {
    if (!documentMap.has(chunk.documentId)) {
      const doc = await metadataStore.getDocument(chunk.documentId);
      if (doc) {
        documentMap.set(chunk.documentId, { source: doc.source, url: doc.url });
      }
    }
  }

  // Step 8: Synthesize
  const synthesis = await synthesize({
    query: input.query,
    chunks: retrieval.context.chunks,
    graphContext: retrieval.graphData,
    documentMap,
  });

  // Build graph visualization data
  const graphData = {
    nodes: retrieval.graphData.entities.map((e) => ({
      id: e.id,
      label: e.name,
      type: e.type,
    })),
    edges: retrieval.graphData.relationships.map((r) => ({
      from: r.source,
      to: r.target,
      label: r.type,
    })),
  };

  logger.info("Graph RAG workflow complete", {
    confidence: synthesis.confidence,
    citations: synthesis.citations.length,
    graphNodes: graphData.nodes.length,
  });

  return {
    answer: synthesis.answer,
    citations: synthesis.citations,
    entities: synthesis.entities,
    graphData,
    confidence: synthesis.confidence,
  };
}
