import { Hono } from "hono";
import type { IGraphStore, IMetadataStore } from "../storage/interfaces.js";
import { createLogger } from "../utils/logger.js";

const logger = createLogger("knowledge-routes");

export interface KnowledgeRoutesDeps {
  graphStore: IGraphStore;
  metadataStore: IMetadataStore;
}

export function createKnowledgeRoutes(deps: KnowledgeRoutesDeps): Hono {
  const app = new Hono();

  // GET /knowledge/entities?q=name&type=Organization&limit=20
  app.get("/entities", async (c) => {
    const q = c.req.query("q") || "";
    const limit = parseInt(c.req.query("limit") || "20", 10);

    if (!q) {
      return c.json({ error: "Query parameter 'q' is required" }, 400);
    }

    try {
      const entities = await deps.graphStore.findEntities(q, true);
      return c.json({ entities: entities.slice(0, limit) });
    } catch (error) {
      logger.error("Entity search error", { error: String(error) });
      return c.json({ error: String(error) }, 500);
    }
  });

  // GET /knowledge/graph?entityId=e123&hops=2&relTypes=ACQUIRED
  app.get("/graph", async (c) => {
    const entityId = c.req.query("entityId");
    const hops = parseInt(c.req.query("hops") || "2", 10);
    const relTypesParam = c.req.query("relTypes");
    const relTypes = relTypesParam ? relTypesParam.split(",") : undefined;

    if (!entityId) {
      return c.json({ error: "Query parameter 'entityId' is required" }, 400);
    }

    try {
      const expansion = await deps.graphStore.expandFromEntity(entityId, hops, relTypes);

      const graphData = {
        nodes: expansion.entities.map((e) => ({
          id: e.id,
          label: e.name,
          type: e.type,
        })),
        edges: expansion.relationships.map((r) => ({
          from: r.source,
          to: r.target,
          label: r.type,
        })),
        documentIds: expansion.documentIds,
      };

      return c.json(graphData);
    } catch (error) {
      logger.error("Graph query error", { error: String(error) });
      return c.json({ error: String(error) }, 500);
    }
  });

  // GET /knowledge/stats
  app.get("/stats", async (c) => {
    try {
      const [mongoStats, graphStats] = await Promise.all([
        deps.metadataStore.getStats(),
        deps.graphStore.getStats(),
      ]);

      return c.json({
        documents: mongoStats.documentCount,
        entities: mongoStats.entityCount,
        graphNodes: graphStats.nodeCount,
        graphRelationships: graphStats.relationshipCount,
        ingestionJobs: mongoStats.jobCount,
      });
    } catch (error) {
      logger.error("Stats error", { error: String(error) });
      return c.json({ error: String(error) }, 500);
    }
  });

  return app;
}
