import type { IVectorStore, IGraphStore, IMetadataStore, ScoredChunk } from "../storage/interfaces.js";
import { parseQuery, type ParsedQuery } from "./query-parser.js";
import { expandFromEntities } from "./graph-expander.js";
import { searchVectors } from "./vector-search.js";
import { rerankChunks } from "./reranker.js";
import { compressContext, type CompressedContext } from "./context-compressor.js";
import { createLogger } from "../utils/logger.js";

const logger = createLogger("hybrid-retriever");

export interface RetrievalOptions {
  maxHops?: number;
  topK?: number;
  filters?: {
    dateRange?: { from?: string; to?: string };
    sources?: string[];
    topics?: string[];
  };
}

export interface RetrievalResult {
  parsedQuery: ParsedQuery;
  context: CompressedContext;
  graphData: {
    entities: Array<{ id: string; name: string; type: string }>;
    relationships: Array<{ source: string; target: string; type: string; context?: string }>;
  };
}

export async function hybridRetrieve(
  query: string,
  vectorStore: IVectorStore,
  graphStore: IGraphStore,
  metadataStore: IMetadataStore,
  options: RetrievalOptions = {},
): Promise<RetrievalResult> {
  const { maxHops = 2, topK = 10 } = options;

  // Step 1: Parse query
  const parsedQuery = await parseQuery(query);
  logger.info("Query parsed", { entities: parsedQuery.entities, intent: parsedQuery.intent });

  // Step 2-3: Graph lookup and expansion (if entities found)
  let graphDocumentIds: string[] = [];
  let graphEntities: RetrievalResult["graphData"]["entities"] = [];
  let graphRelationships: RetrievalResult["graphData"]["relationships"] = [];

  if (parsedQuery.entities.length > 0) {
    const graphExpansion = await expandFromEntities(
      graphStore,
      parsedQuery.entities,
      maxHops,
      parsedQuery.filters.relationTypes,
    );

    graphDocumentIds = graphExpansion.documentIds;
    graphEntities = graphExpansion.entities.map((e) => ({
      id: e.id,
      name: e.name,
      type: e.type,
    }));
    graphRelationships = graphExpansion.relationships;

    logger.info("Graph expansion complete", {
      entities: graphEntities.length,
      relationships: graphRelationships.length,
      documents: graphDocumentIds.length,
    });
  }

  // Step 4: Metadata filtering
  if (options.filters?.sources?.length || options.filters?.dateRange) {
    const filteredDocs = await metadataStore.findDocuments({
      sources: options.filters.sources,
      dateFrom: options.filters.dateRange?.from,
      dateTo: options.filters.dateRange?.to,
      limit: 100,
    });
    const metadataDocIds = filteredDocs.map((d) => d.id);

    // Intersect with graph document IDs if both exist
    if (graphDocumentIds.length > 0) {
      const graphDocSet = new Set(graphDocumentIds);
      graphDocumentIds = metadataDocIds.filter((id) => graphDocSet.has(id));
    } else {
      graphDocumentIds = metadataDocIds;
    }
  }

  // Step 5: Vector search (filtered by graph document IDs if available)
  const vectorResults = await searchVectors(vectorStore, parsedQuery.reformulatedQuery, {
    topK: 50,
    documentIds: graphDocumentIds.length > 0 ? graphDocumentIds : undefined,
  });

  logger.info("Vector search complete", { results: vectorResults.length });

  // Step 6: Rerank
  const reranked = await rerankChunks(query, vectorResults, topK);
  logger.info("Reranking complete", { results: reranked.length });

  // Step 7: Compress context
  const context = compressContext(reranked);

  return {
    parsedQuery,
    context,
    graphData: {
      entities: graphEntities,
      relationships: graphRelationships,
    },
  };
}
