import { z } from "zod";
import { chunkText } from "../preprocessing/chunker.js";
import { embedTexts } from "../preprocessing/embedder.js";
import { extractEntities } from "../preprocessing/entity-extractor.js";
import { extractRelationships } from "../preprocessing/relationship-extractor.js";
import { classifyTopics } from "../preprocessing/topic-classifier.js";
import type {
  IMetadataStore,
  IRawStore,
  IVectorStore,
  IGraphStore,
  ChunkWithEmbedding,
  Entity,
} from "../storage/interfaces.js";
import { createLogger } from "../utils/logger.js";

const logger = createLogger("preprocess-workflow");

export const preprocessInputSchema = z.object({
  documentId: z.string(),
});

export type PreprocessInput = z.infer<typeof preprocessInputSchema>;

export interface PreprocessResult {
  documentId: string;
  chunksCreated: number;
  entitiesExtracted: number;
  relationshipsExtracted: number;
  topics: string[];
}

export async function runPreprocessWorkflow(
  input: PreprocessInput,
  metadataStore: IMetadataStore,
  rawStore: IRawStore,
  vectorStore: IVectorStore,
  graphStore: IGraphStore,
): Promise<PreprocessResult> {
  const { documentId } = input;

  // Update status
  await metadataStore.updateDocument(documentId, { status: "processing" });

  try {
    // Step 1: Load raw content
    const doc = await metadataStore.getDocument(documentId);
    if (!doc) throw new Error(`Document not found: ${documentId}`);

    const rawPath = doc.rawStoragePath.replace(`s3://${doc.rawStoragePath.split("/")[2]}/`, "");
    const rawContent = await rawStore.download(rawPath);
    const text = rawContent.toString("utf-8");

    logger.info("Loaded raw content", { documentId, size: text.length });

    // Step 2: Chunk
    const chunks = chunkText(text, documentId);
    logger.info("Chunked document", { documentId, chunks: chunks.length });

    // Step 3: Embed
    const chunkTexts = chunks.map((c) => c.text);
    const embeddings = await embedTexts(chunkTexts);
    logger.info("Generated embeddings", { documentId, count: embeddings.length });

    // Step 4: Entity extraction (on first few chunks for efficiency)
    const extractionText = chunks
      .slice(0, 5)
      .map((c) => c.text)
      .join("\n\n");
    const entities = await extractEntities(extractionText, documentId);
    logger.info("Extracted entities", { documentId, count: entities.length });

    // Step 5: Relationship extraction
    const relationships = await extractRelationships(extractionText, entities, documentId);
    logger.info("Extracted relationships", { documentId, count: relationships.length });

    // Step 6: Topic classification
    const topics = await classifyTopics(extractionText);
    logger.info("Classified topics", { documentId, topics });

    // Step 7: Store vectors in Qdrant
    const chunksWithEmbeddings: ChunkWithEmbedding[] = chunks.map((chunk, i) => ({
      chunkId: chunk.chunkId,
      documentId,
      text: chunk.text,
      embedding: embeddings[i],
      metadata: {
        source: doc.source,
        entityIds: entities.map((e) => e.id),
        topics,
        publishedAt: doc.publishedAt,
      },
    }));

    await vectorStore.upsert("knowledge-chunks", chunksWithEmbeddings);
    logger.info("Stored vectors", { documentId, count: chunksWithEmbeddings.length });

    // Step 8: Store entities and relationships in Neo4j
    const now = new Date().toISOString();
    const entityIdMap = new Map<string, string>();

    // Merge document node
    await graphStore.runCypher(
      `MERGE (d:Document {id: $id})
       ON CREATE SET d.source = $source, d.url = $url, d.title = $title, d.publishedAt = $publishedAt`,
      { id: documentId, source: doc.source, url: doc.url, title: doc.title, publishedAt: doc.publishedAt || "" },
    );

    for (const entity of entities) {
      const graphEntity: Entity = {
        id: entity.id,
        name: entity.name,
        type: entity.type,
        aliases: entity.aliases,
        firstSeen: now,
        lastSeen: now,
        mentionCount: 1,
      };
      const entityId = await graphStore.mergeEntity(graphEntity);
      entityIdMap.set(entity.name, entityId);

      // Create MENTIONS relationship
      await graphStore.runCypher(
        `MATCH (d:Document {id: $docId})
         MATCH (e:Entity {id: $entityId})
         MERGE (d)-[:MENTIONS]->(e)`,
        { docId: documentId, entityId },
      );
    }

    // Store topics as nodes
    for (const topic of topics) {
      await graphStore.runCypher(
        `MERGE (t:Topic {id: $id})
         ON CREATE SET t.name = $name`,
        { id: `topic_${topic.toLowerCase().replace(/\s+/g, "_")}`, name: topic },
      );
      await graphStore.runCypher(
        `MATCH (d:Document {id: $docId})
         MATCH (t:Topic {id: $topicId})
         MERGE (d)-[:ABOUT]->(t)`,
        { docId: documentId, topicId: `topic_${topic.toLowerCase().replace(/\s+/g, "_")}` },
      );
    }

    for (const rel of relationships) {
      const sourceId = entityIdMap.get(rel.sourceEntityName);
      const targetId = entityIdMap.get(rel.targetEntityName);
      if (sourceId && targetId) {
        await graphStore.mergeRelationship({
          sourceEntityId: sourceId,
          targetEntityId: targetId,
          type: rel.type,
          context: rel.context,
          documentId,
        });
      }
    }

    logger.info("Stored graph data", { documentId, entities: entities.length, relationships: relationships.length });

    // Step 9: Update metadata
    await metadataStore.updateDocument(documentId, {
      status: "processed",
      chunkIds: chunks.map((c) => c.chunkId),
      entityIds: entities.map((e) => e.id),
      tags: [...new Set([...doc.tags, ...topics])],
    });

    return {
      documentId,
      chunksCreated: chunks.length,
      entitiesExtracted: entities.length,
      relationshipsExtracted: relationships.length,
      topics,
    };
  } catch (error) {
    await metadataStore.updateDocument(documentId, { status: "failed" });
    logger.error("Preprocessing failed", { documentId, error: String(error) });
    throw error;
  }
}
