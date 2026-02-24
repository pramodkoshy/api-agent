import neo4j, { type Driver, type Session } from "neo4j-driver";
import type {
  IGraphStore,
  Entity,
  Relationship,
  GraphExpansionResult,
} from "./interfaces.js";
import { config } from "../config.js";
import { createLogger } from "../utils/logger.js";

const logger = createLogger("neo4j");

export class Neo4jGraphStore implements IGraphStore {
  private driver: Driver;

  constructor() {
    this.driver = neo4j.driver(
      config.neo4jUri,
      neo4j.auth.basic(config.neo4jUser, config.neo4jPassword),
    );
  }

  async connect(): Promise<void> {
    await this.driver.verifyConnectivity();
    // Create constraints and indexes
    const session = this.driver.session();
    try {
      await session.run(
        "CREATE CONSTRAINT entity_id IF NOT EXISTS FOR (e:Entity) REQUIRE e.id IS UNIQUE",
      );
      await session.run(
        "CREATE CONSTRAINT document_id IF NOT EXISTS FOR (d:Document) REQUIRE d.id IS UNIQUE",
      );
      await session.run(
        "CREATE CONSTRAINT topic_id IF NOT EXISTS FOR (t:Topic) REQUIRE t.id IS UNIQUE",
      );
      await session.run("CREATE INDEX entity_name IF NOT EXISTS FOR (e:Entity) ON (e.name)");
      await session.run("CREATE INDEX entity_type IF NOT EXISTS FOR (e:Entity) ON (e.type)");
      logger.info("Neo4j connected and indexes created");
    } finally {
      await session.close();
    }
  }

  private session(): Session {
    return this.driver.session({ database: "neo4j" });
  }

  async mergeEntity(entity: Entity): Promise<string> {
    const session = this.session();
    try {
      const result = await session.run(
        `MERGE (e:Entity {id: $id})
         ON CREATE SET
           e.name = $name,
           e.type = $type,
           e.aliases = $aliases,
           e.firstSeen = $firstSeen,
           e.lastSeen = $lastSeen,
           e.mentionCount = $mentionCount
         ON MATCH SET
           e.lastSeen = $lastSeen,
           e.mentionCount = e.mentionCount + 1,
           e.aliases = CASE
             WHEN size($aliases) > size(e.aliases) THEN $aliases
             ELSE e.aliases
           END
         RETURN e.id AS id`,
        {
          id: entity.id,
          name: entity.name,
          type: entity.type,
          aliases: entity.aliases,
          firstSeen: entity.firstSeen,
          lastSeen: entity.lastSeen,
          mentionCount: entity.mentionCount,
        },
      );
      return result.records[0]?.get("id") ?? entity.id;
    } finally {
      await session.close();
    }
  }

  async mergeRelationship(rel: Relationship): Promise<void> {
    const session = this.session();
    try {
      await session.run(
        `MATCH (src:Entity {id: $sourceId})
         MATCH (tgt:Entity {id: $targetId})
         MERGE (src)-[r:${this.sanitizeRelType(rel.type)}]->(tgt)
         ON CREATE SET
           r.context = $context,
           r.documentId = $documentId,
           r.chunkId = $chunkId,
           r.createdAt = datetime()
         ON MATCH SET
           r.lastSeen = datetime()`,
        {
          sourceId: rel.sourceEntityId,
          targetId: rel.targetEntityId,
          context: rel.context || "",
          documentId: rel.documentId || "",
          chunkId: rel.chunkId || "",
        },
      );
    } finally {
      await session.close();
    }
  }

  async findEntities(name: string, fuzzyMatch = false): Promise<Entity[]> {
    const session = this.session();
    try {
      const query = fuzzyMatch
        ? `MATCH (e:Entity)
           WHERE toLower(e.name) CONTAINS toLower($name)
              OR ANY(alias IN e.aliases WHERE toLower(alias) CONTAINS toLower($name))
           RETURN e LIMIT 20`
        : `MATCH (e:Entity)
           WHERE e.name = $name
              OR $name IN e.aliases
           RETURN e LIMIT 20`;

      const result = await session.run(query, { name });
      return result.records.map((record) => {
        const node = record.get("e").properties;
        return {
          id: node.id,
          name: node.name,
          type: node.type,
          aliases: node.aliases || [],
          firstSeen: node.firstSeen,
          lastSeen: node.lastSeen,
          mentionCount: typeof node.mentionCount === "object" ? Number(node.mentionCount) : node.mentionCount,
        };
      });
    } finally {
      await session.close();
    }
  }

  async expandFromEntity(
    entityId: string,
    hops: number = 2,
    relTypes?: string[],
  ): Promise<GraphExpansionResult> {
    const session = this.session();
    try {
      const relFilter = relTypes?.length ? `:${relTypes.map((t) => this.sanitizeRelType(t)).join("|")}` : "";

      const result = await session.run(
        `MATCH (seed:Entity {id: $entityId})
         MATCH path = (seed)-[*1..${Math.min(hops, 3)}]-(related:Entity)
         WITH DISTINCT related, relationships(path) AS rels
         OPTIONAL MATCH (d:Document)-[:MENTIONS]->(related)
         RETURN related,
                collect(DISTINCT d.id) AS documentIds,
                [r IN rels | {type: type(r), source: startNode(r).id, target: endNode(r).id, context: r.context}] AS relationships`,
        { entityId },
      );

      const entities: Entity[] = [];
      const relationships: Array<{
        source: string;
        target: string;
        type: string;
        context?: string;
      }> = [];
      const documentIds = new Set<string>();

      for (const record of result.records) {
        const node = record.get("related").properties;
        entities.push({
          id: node.id,
          name: node.name,
          type: node.type,
          aliases: node.aliases || [],
          firstSeen: node.firstSeen,
          lastSeen: node.lastSeen,
          mentionCount: typeof node.mentionCount === "object" ? Number(node.mentionCount) : node.mentionCount,
        });

        const docIds = record.get("documentIds") as string[];
        for (const docId of docIds) {
          if (docId) documentIds.add(docId);
        }

        const rels = record.get("relationships") as Array<Record<string, string>>;
        for (const rel of rels) {
          relationships.push({
            source: rel.source,
            target: rel.target,
            type: rel.type,
            context: rel.context || undefined,
          });
        }
      }

      return {
        entities,
        relationships,
        documentIds: Array.from(documentIds),
      };
    } finally {
      await session.close();
    }
  }

  async getDocumentEntities(documentId: string): Promise<Entity[]> {
    const session = this.session();
    try {
      const result = await session.run(
        `MATCH (d:Document {id: $documentId})-[:MENTIONS]->(e:Entity)
         RETURN e`,
        { documentId },
      );
      return result.records.map((record) => {
        const node = record.get("e").properties;
        return {
          id: node.id,
          name: node.name,
          type: node.type,
          aliases: node.aliases || [],
          firstSeen: node.firstSeen,
          lastSeen: node.lastSeen,
          mentionCount: typeof node.mentionCount === "object" ? Number(node.mentionCount) : node.mentionCount,
        };
      });
    } finally {
      await session.close();
    }
  }

  async runCypher(query: string, params?: Record<string, unknown>): Promise<unknown> {
    const session = this.session();
    try {
      const result = await session.run(query, params);
      return result.records.map((r) => r.toObject());
    } finally {
      await session.close();
    }
  }

  async getStats(): Promise<{ nodeCount: number; relationshipCount: number }> {
    const session = this.session();
    try {
      const nodeResult = await session.run("MATCH (n) RETURN count(n) AS count");
      const relResult = await session.run("MATCH ()-[r]->() RETURN count(r) AS count");
      return {
        nodeCount: Number(nodeResult.records[0]?.get("count") ?? 0),
        relationshipCount: Number(relResult.records[0]?.get("count") ?? 0),
      };
    } finally {
      await session.close();
    }
  }

  async close(): Promise<void> {
    await this.driver.close();
    logger.info("Neo4j disconnected");
  }

  private sanitizeRelType(type: string): string {
    return type.replace(/[^a-zA-Z0-9_]/g, "_").toUpperCase();
  }
}
