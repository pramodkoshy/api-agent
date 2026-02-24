import { Hono } from "hono";
import { z } from "zod";
import type { IVectorStore, IGraphStore, IMetadataStore } from "../storage/interfaces.js";
import { runGraphRagWorkflow, graphRagInputSchema } from "../workflows/graph-rag.workflow.js";
import { runBatchIntelWorkflow, batchIntelInputSchema } from "../workflows/batch-intel.workflow.js";
import { createLogger } from "../utils/logger.js";

const logger = createLogger("synthesize-routes");

export interface SynthesizeRoutesDeps {
  vectorStore: IVectorStore;
  graphStore: IGraphStore;
  metadataStore: IMetadataStore;
}

export function createSynthesizeRoutes(deps: SynthesizeRoutesDeps): Hono {
  const app = new Hono();

  // POST /synthesize - Single query synthesis
  app.post("/", async (c) => {
    try {
      const body = await c.req.json();
      const input = graphRagInputSchema.parse(body);

      const result = await runGraphRagWorkflow(
        input,
        deps.vectorStore,
        deps.graphStore,
        deps.metadataStore,
      );

      return c.json(result);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return c.json({ error: "Validation error", details: error.errors }, 400);
      }
      logger.error("Synthesis error", { error: String(error) });
      return c.json({ error: String(error) }, 500);
    }
  });

  // POST /synthesize/batch - Batch synthesis
  app.post("/batch", async (c) => {
    try {
      const body = await c.req.json();
      const input = batchIntelInputSchema.parse(body);

      const result = await runBatchIntelWorkflow(
        input,
        deps.vectorStore,
        deps.graphStore,
        deps.metadataStore,
      );

      return c.json(result);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return c.json({ error: "Validation error", details: error.errors }, 400);
      }
      logger.error("Batch synthesis error", { error: String(error) });
      return c.json({ error: String(error) }, 500);
    }
  });

  return app;
}
