import { z } from "zod";
import type { IMetadataStore, IRawStore, IVectorStore, IGraphStore } from "../storage/interfaces.js";
import { runPreprocessWorkflow } from "./preprocess.workflow.js";
import { createLogger } from "../utils/logger.js";

const logger = createLogger("reindex-workflow");

export const reindexInputSchema = z.object({
  documentIds: z.array(z.string()).optional(),
  reprocessAll: z.boolean().default(false),
});

export type ReindexInput = z.infer<typeof reindexInputSchema>;

export interface ReindexResult {
  documentsReindexed: number;
  errors: string[];
}

export async function runReindexWorkflow(
  input: ReindexInput,
  metadataStore: IMetadataStore,
  rawStore: IRawStore,
  vectorStore: IVectorStore,
  graphStore: IGraphStore,
): Promise<ReindexResult> {
  let documentIds: string[];

  if (input.documentIds?.length) {
    documentIds = input.documentIds;
  } else if (input.reprocessAll) {
    const docs = await metadataStore.findDocuments({ limit: 10000 });
    documentIds = docs.map((d) => d.id);
  } else {
    return { documentsReindexed: 0, errors: ["No documents specified for reindexing"] };
  }

  logger.info("Starting reindex", { documents: documentIds.length });

  const errors: string[] = [];
  let reindexed = 0;

  for (const docId of documentIds) {
    try {
      // Delete existing vectors for this document
      const doc = await metadataStore.getDocument(docId);
      if (doc?.chunkIds?.length) {
        await vectorStore.delete("knowledge-chunks", doc.chunkIds);
      }

      // Reset document status
      await metadataStore.updateDocument(docId, {
        status: "pending",
        chunkIds: [],
        entityIds: [],
      });

      // Re-run preprocessing
      await runPreprocessWorkflow(
        { documentId: docId },
        metadataStore,
        rawStore,
        vectorStore,
        graphStore,
      );

      reindexed++;
    } catch (error) {
      errors.push(`${docId}: ${error}`);
      logger.error("Reindex failed for document", { docId, error: String(error) });
    }
  }

  logger.info("Reindex complete", { reindexed, errors: errors.length });
  return { documentsReindexed: reindexed, errors };
}
