import { Hono } from "hono";
import { z } from "zod";
import type { IMetadataStore, IRawStore, IVectorStore, IGraphStore } from "../storage/interfaces.js";
import { runIngestWorkflow, ingestInputSchema } from "../workflows/ingest.workflow.js";
import { runPreprocessWorkflow } from "../workflows/preprocess.workflow.js";
import { createLogger } from "../utils/logger.js";

const logger = createLogger("ingest-routes");

export interface IngestRoutesDeps {
  metadataStore: IMetadataStore;
  rawStore: IRawStore;
  vectorStore: IVectorStore;
  graphStore: IGraphStore;
}

export function createIngestRoutes(deps: IngestRoutesDeps): Hono {
  const app = new Hono();

  // POST /ingest - Submit URLs for ingestion
  app.post("/", async (c) => {
    try {
      const body = await c.req.json();
      const input = ingestInputSchema.parse(body);

      // Run ingestion
      const result = await runIngestWorkflow(input, deps.metadataStore, deps.rawStore);

      // Trigger preprocessing for each ingested document (async, don't wait)
      for (const docId of result.documentIds) {
        runPreprocessWorkflow(
          { documentId: docId },
          deps.metadataStore,
          deps.rawStore,
          deps.vectorStore,
          deps.graphStore,
        ).catch((err) => {
          logger.error("Background preprocessing failed", { docId, error: String(err) });
        });
      }

      return c.json(result, 201);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return c.json({ error: "Validation error", details: error.errors }, 400);
      }
      logger.error("Ingestion error", { error: String(error) });
      return c.json({ error: String(error) }, 500);
    }
  });

  // GET /ingest/:jobId - Get job status
  app.get("/:jobId", async (c) => {
    const jobId = c.req.param("jobId");
    const job = await deps.metadataStore.getJob(jobId);
    if (!job) {
      return c.json({ error: "Job not found" }, 404);
    }
    return c.json(job);
  });

  return app;
}
