import type { IMetadataStore, IRawStore, IVectorStore, IGraphStore } from "../storage/interfaces.js";
import { runPreprocessWorkflow, type PreprocessResult } from "../workflows/preprocess.workflow.js";
import { createLogger } from "../utils/logger.js";

const logger = createLogger("extraction-agent");

export interface ExtractionAgentDeps {
  metadataStore: IMetadataStore;
  rawStore: IRawStore;
  vectorStore: IVectorStore;
  graphStore: IGraphStore;
}

/**
 * Processes pending documents through the extraction pipeline.
 * Designed to run as a background worker.
 */
export async function processDocumentQueue(
  deps: ExtractionAgentDeps,
  batchSize: number = 5,
): Promise<PreprocessResult[]> {
  const pendingDocs = await deps.metadataStore.findDocuments({
    status: "pending",
    limit: batchSize,
  });

  if (pendingDocs.length === 0) {
    logger.info("No pending documents to process");
    return [];
  }

  logger.info("Processing document queue", { count: pendingDocs.length });

  const results: PreprocessResult[] = [];

  for (const doc of pendingDocs) {
    try {
      const result = await runPreprocessWorkflow(
        { documentId: doc.id },
        deps.metadataStore,
        deps.rawStore,
        deps.vectorStore,
        deps.graphStore,
      );
      results.push(result);
      logger.info("Processed document", {
        documentId: doc.id,
        chunks: result.chunksCreated,
        entities: result.entitiesExtracted,
      });
    } catch (error) {
      logger.error("Failed to process document", {
        documentId: doc.id,
        error: String(error),
      });
    }
  }

  return results;
}
