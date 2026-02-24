import { Hono } from "hono";
import type { IVectorStore, IGraphStore, IMetadataStore } from "../storage/interfaces.js";
import { createLogger } from "../utils/logger.js";

const logger = createLogger("status-routes");

export interface StatusRoutesDeps {
  vectorStore: IVectorStore;
  graphStore: IGraphStore;
  metadataStore: IMetadataStore;
}

export function createStatusRoutes(deps: StatusRoutesDeps): Hono {
  const app = new Hono();

  // GET /status - Health and connection status
  app.get("/", async (c) => {
    const status: Record<string, unknown> = {
      service: "knowledge-worker",
      status: "ok",
      timestamp: new Date().toISOString(),
      connections: {},
    };

    // Check MongoDB
    try {
      await deps.metadataStore.getStats();
      (status.connections as Record<string, string>).mongodb = "connected";
    } catch {
      (status.connections as Record<string, string>).mongodb = "disconnected";
      status.status = "degraded";
    }

    // Check Qdrant
    try {
      const info = await deps.vectorStore.getCollectionInfo("knowledge-chunks");
      (status.connections as Record<string, unknown>).qdrant = {
        status: "connected",
        vectorCount: info?.vectorCount ?? 0,
      };
    } catch {
      (status.connections as Record<string, string>).qdrant = "disconnected";
      status.status = "degraded";
    }

    // Check Neo4j
    try {
      const graphStats = await deps.graphStore.getStats();
      (status.connections as Record<string, unknown>).neo4j = {
        status: "connected",
        nodes: graphStats.nodeCount,
        relationships: graphStats.relationshipCount,
      };
    } catch {
      (status.connections as Record<string, string>).neo4j = "disconnected";
      status.status = "degraded";
    }

    return c.json(status);
  });

  // GET /status/stats - Detailed statistics
  app.get("/stats", async (c) => {
    try {
      const [mongoStats, graphStats, vectorInfo] = await Promise.all([
        deps.metadataStore.getStats(),
        deps.graphStore.getStats(),
        deps.vectorStore.getCollectionInfo("knowledge-chunks"),
      ]);

      return c.json({
        documents: mongoStats.documentCount,
        entities: mongoStats.entityCount,
        ingestionJobs: mongoStats.jobCount,
        graphNodes: graphStats.nodeCount,
        graphRelationships: graphStats.relationshipCount,
        vectors: vectorInfo?.vectorCount ?? 0,
      });
    } catch (error) {
      logger.error("Stats error", { error: String(error) });
      return c.json({ error: String(error) }, 500);
    }
  });

  return app;
}
