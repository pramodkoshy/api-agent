import { z } from "zod";
import { crawlMultiple } from "../ingestion/crawler.js";
import { normalizeContent } from "../ingestion/normalizer.js";
import { checkDuplicate } from "../ingestion/deduplicator.js";
import { storeRawDocument } from "../ingestion/raw-store.js";
import type { IMetadataStore, IRawStore, DocumentMetadata } from "../storage/interfaces.js";
import { generateId } from "../utils/hash.js";
import { createLogger } from "../utils/logger.js";

const logger = createLogger("ingest-workflow");

export const ingestInputSchema = z.object({
  urls: z.array(z.string().url()),
  crawlDepth: z.number().min(0).max(3).default(1),
  tags: z.array(z.string()).optional().default([]),
});

export type IngestInput = z.infer<typeof ingestInputSchema>;

export interface IngestResult {
  jobId: string;
  documentsIngested: number;
  documentsSkipped: number;
  documentIds: string[];
  errors: string[];
}

export async function runIngestWorkflow(
  input: IngestInput,
  metadataStore: IMetadataStore,
  rawStore: IRawStore,
): Promise<IngestResult> {
  const jobId = generateId("job");
  const errors: string[] = [];
  const documentIds: string[] = [];
  let skipped = 0;

  // Create job record
  await metadataStore.insertJob({
    id: jobId,
    urls: input.urls,
    crawlDepth: input.crawlDepth,
    tags: input.tags,
    status: "running",
    progress: { total: input.urls.length, processed: 0, failed: 0 },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  try {
    // Step 1: Crawl
    logger.info("Starting crawl", { urls: input.urls.length, depth: input.crawlDepth });
    const crawlResults = await crawlMultiple(input.urls, input.crawlDepth);

    await metadataStore.updateJob(jobId, {
      progress: { total: crawlResults.length, processed: 0, failed: 0 },
    });

    // Step 2-6: Process each crawled page
    for (let i = 0; i < crawlResults.length; i++) {
      const crawl = crawlResults[i];
      try {
        // Normalize
        const normalized = normalizeContent(crawl.content, crawl.contentType, crawl.title);

        // Dedup
        const dedup = await checkDuplicate(normalized.text, metadataStore);
        if (dedup.isDuplicate) {
          skipped++;
          logger.info("Skipped duplicate", { url: crawl.url });
          continue;
        }

        // Store raw
        const stored = await storeRawDocument(
          crawl.content,
          crawl.contentType,
          rawStore,
        );

        // Insert metadata
        const doc: DocumentMetadata = {
          id: stored.id,
          source: new URL(crawl.url).hostname,
          url: crawl.url,
          title: normalized.title,
          contentHash: dedup.contentHash,
          rawStoragePath: stored.storagePath,
          contentType: stored.contentType,
          ingestedAt: new Date().toISOString(),
          chunkIds: [],
          entityIds: [],
          tags: input.tags,
          status: "pending",
        };

        await metadataStore.insertDocument(doc);
        documentIds.push(stored.id);

        await metadataStore.updateJob(jobId, {
          progress: { total: crawlResults.length, processed: i + 1, failed: errors.length },
        });
      } catch (error) {
        const msg = `Failed to process ${crawl.url}: ${error}`;
        errors.push(msg);
        logger.error(msg);
      }
    }

    await metadataStore.updateJob(jobId, {
      status: "completed",
      progress: { total: crawlResults.length, processed: documentIds.length + skipped, failed: errors.length },
    });
  } catch (error) {
    await metadataStore.updateJob(jobId, {
      status: "failed",
      error: String(error),
    });
    throw error;
  }

  logger.info("Ingestion complete", {
    jobId,
    ingested: documentIds.length,
    skipped,
    errors: errors.length,
  });

  return {
    jobId,
    documentsIngested: documentIds.length,
    documentsSkipped: skipped,
    documentIds,
    errors,
  };
}
