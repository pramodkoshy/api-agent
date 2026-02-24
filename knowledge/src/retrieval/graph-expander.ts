import type { IGraphStore, GraphExpansionResult } from "../storage/interfaces.js";
import { createLogger } from "../utils/logger.js";

const logger = createLogger("graph-expander");

export async function expandFromEntities(
  graphStore: IGraphStore,
  entityNames: string[],
  hops: number = 2,
  relationTypes?: string[],
): Promise<GraphExpansionResult> {
  const allEntities: GraphExpansionResult["entities"] = [];
  const allRelationships: GraphExpansionResult["relationships"] = [];
  const allDocumentIds = new Set<string>();

  for (const name of entityNames) {
    // First, find the entity by name
    const foundEntities = await graphStore.findEntities(name, true);

    for (const entity of foundEntities) {
      const expansion = await graphStore.expandFromEntity(entity.id, hops, relationTypes);

      allEntities.push(...expansion.entities);
      allRelationships.push(...expansion.relationships);
      for (const docId of expansion.documentIds) {
        allDocumentIds.add(docId);
      }
    }
  }

  // Deduplicate entities
  const uniqueEntities = new Map<string, (typeof allEntities)[0]>();
  for (const entity of allEntities) {
    uniqueEntities.set(entity.id, entity);
  }

  // Deduplicate relationships
  const uniqueRels = new Map<string, (typeof allRelationships)[0]>();
  for (const rel of allRelationships) {
    const key = `${rel.source}-${rel.type}-${rel.target}`;
    uniqueRels.set(key, rel);
  }

  const result: GraphExpansionResult = {
    entities: Array.from(uniqueEntities.values()),
    relationships: Array.from(uniqueRels.values()),
    documentIds: Array.from(allDocumentIds),
  };

  logger.info("Graph expansion complete", {
    seedEntities: entityNames.length,
    expandedEntities: result.entities.length,
    relationships: result.relationships.length,
    documents: result.documentIds.length,
  });

  return result;
}
