import { z } from "zod";
import type { IVectorStore, IGraphStore, IMetadataStore } from "../storage/interfaces.js";
import { batchSynthesize, type BatchSynthesisResult } from "../synthesis/batch-synthesizer.js";
import { createLogger } from "../utils/logger.js";

const logger = createLogger("batch-intel-workflow");

export const batchIntelInputSchema = z.object({
  queries: z.array(z.string()),
  outputFormat: z.enum(["individual", "aggregated_report"]).default("individual"),
  filters: z
    .object({
      dateRange: z
        .object({ from: z.string().optional(), to: z.string().optional() })
        .optional(),
      sources: z.array(z.string()).optional(),
      topics: z.array(z.string()).optional(),
    })
    .optional(),
});

export type BatchIntelInput = z.infer<typeof batchIntelInputSchema>;

export async function runBatchIntelWorkflow(
  input: BatchIntelInput,
  vectorStore: IVectorStore,
  graphStore: IGraphStore,
  metadataStore: IMetadataStore,
): Promise<BatchSynthesisResult> {
  logger.info("Starting batch intelligence workflow", { queries: input.queries.length });

  const result = await batchSynthesize(
    {
      queries: input.queries,
      outputFormat: input.outputFormat,
      filters: input.filters,
    },
    vectorStore,
    graphStore,
    metadataStore,
  );

  logger.info("Batch intelligence workflow complete", {
    queries: input.queries.length,
    hasReport: !!result.aggregatedReport,
  });

  return result;
}
