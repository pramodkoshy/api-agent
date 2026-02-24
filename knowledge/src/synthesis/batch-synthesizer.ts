import type { IVectorStore, IGraphStore, IMetadataStore } from "../storage/interfaces.js";
import { hybridRetrieve } from "../retrieval/hybrid-retriever.js";
import { synthesize, type SynthesisResult } from "./synthesizer.js";
import { createLogger } from "../utils/logger.js";

const logger = createLogger("batch-synthesizer");

export interface BatchSynthesisInput {
  queries: string[];
  outputFormat: "individual" | "aggregated_report";
  filters?: {
    dateRange?: { from?: string; to?: string };
    sources?: string[];
    topics?: string[];
  };
}

export interface BatchSynthesisResult {
  results: Array<{
    query: string;
    synthesis: SynthesisResult;
  }>;
  aggregatedReport?: string;
}

export async function batchSynthesize(
  input: BatchSynthesisInput,
  vectorStore: IVectorStore,
  graphStore: IGraphStore,
  metadataStore: IMetadataStore,
): Promise<BatchSynthesisResult> {
  const results: BatchSynthesisResult["results"] = [];

  // Run queries in parallel (limited concurrency)
  const CONCURRENCY = 3;
  for (let i = 0; i < input.queries.length; i += CONCURRENCY) {
    const batch = input.queries.slice(i, i + CONCURRENCY);
    const batchResults = await Promise.all(
      batch.map(async (query) => {
        const retrieval = await hybridRetrieve(query, vectorStore, graphStore, metadataStore, {
          filters: input.filters,
        });

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

        const synthesis = await synthesize({
          query,
          chunks: retrieval.context.chunks,
          graphContext: retrieval.graphData,
          documentMap,
        });

        return { query, synthesis };
      }),
    );
    results.push(...batchResults);
  }

  logger.info("Batch synthesis complete", { queries: input.queries.length });

  if (input.outputFormat === "aggregated_report") {
    // Simple aggregation: combine all answers
    const report = results
      .map((r, i) => `## Question ${i + 1}: ${r.query}\n\n${r.synthesis.answer}`)
      .join("\n\n---\n\n");

    return { results, aggregatedReport: report };
  }

  return { results };
}
