export interface ChunkWithEmbedding {
  chunkId: string;
  documentId: string;
  text: string;
  embedding: number[];
  metadata: {
    source: string;
    entityIds: string[];
    topics: string[];
    publishedAt?: string;
  };
}

export interface ScoredChunk {
  chunkId: string;
  documentId: string;
  text: string;
  score: number;
  metadata: Record<string, unknown>;
}

export interface Entity {
  id: string;
  name: string;
  type: string;
  aliases: string[];
  firstSeen: string;
  lastSeen: string;
  mentionCount: number;
}

export interface Relationship {
  sourceEntityId: string;
  targetEntityId: string;
  type: string;
  context?: string;
  documentId?: string;
  chunkId?: string;
}

export interface GraphExpansionResult {
  entities: Entity[];
  relationships: Array<{
    source: string;
    target: string;
    type: string;
    context?: string;
  }>;
  documentIds: string[];
}

export interface DocumentMetadata {
  _id?: string;
  id: string;
  source: string;
  url: string;
  title: string;
  contentHash: string;
  rawStoragePath: string;
  contentType: string;
  publishedAt?: string;
  ingestedAt: string;
  chunkIds: string[];
  entityIds: string[];
  tags: string[];
  status: "pending" | "processing" | "processed" | "failed";
}

export interface DocumentFilter {
  sources?: string[];
  tags?: string[];
  status?: string;
  dateFrom?: string;
  dateTo?: string;
  limit?: number;
  offset?: number;
}

export interface IngestionJob {
  id: string;
  urls: string[];
  crawlDepth: number;
  tags: string[];
  status: "queued" | "running" | "completed" | "failed";
  progress: {
    total: number;
    processed: number;
    failed: number;
  };
  createdAt: string;
  updatedAt: string;
  error?: string;
}

export interface IVectorStore {
  upsert(indexName: string, chunks: ChunkWithEmbedding[]): Promise<void>;
  query(
    indexName: string,
    embedding: number[],
    topK: number,
    filter?: Record<string, unknown>,
  ): Promise<ScoredChunk[]>;
  delete(indexName: string, ids: string[]): Promise<void>;
  createIndex(name: string, dimension: number, metric?: "cosine" | "euclidean" | "dot"): Promise<void>;
  getCollectionInfo(indexName: string): Promise<{ vectorCount: number } | null>;
}

export interface IGraphStore {
  mergeEntity(entity: Entity): Promise<string>;
  mergeRelationship(rel: Relationship): Promise<void>;
  findEntities(name: string, fuzzyMatch?: boolean): Promise<Entity[]>;
  expandFromEntity(entityId: string, hops: number, relTypes?: string[]): Promise<GraphExpansionResult>;
  getDocumentEntities(documentId: string): Promise<Entity[]>;
  runCypher(query: string, params?: Record<string, unknown>): Promise<unknown>;
  getStats(): Promise<{ nodeCount: number; relationshipCount: number }>;
  close(): Promise<void>;
}

export interface IMetadataStore {
  insertDocument(doc: DocumentMetadata): Promise<string>;
  getDocument(id: string): Promise<DocumentMetadata | null>;
  findDocuments(filter: DocumentFilter): Promise<DocumentMetadata[]>;
  updateDocument(id: string, update: Partial<DocumentMetadata>): Promise<void>;
  checkDuplicate(contentHash: string): Promise<boolean>;
  insertJob(job: IngestionJob): Promise<string>;
  getJob(id: string): Promise<IngestionJob | null>;
  updateJob(id: string, update: Partial<IngestionJob>): Promise<void>;
  getStats(): Promise<{ documentCount: number; entityCount: number; jobCount: number }>;
  close(): Promise<void>;
}

export interface IRawStore {
  upload(key: string, content: Buffer, contentType: string): Promise<string>;
  download(key: string): Promise<Buffer>;
  delete(key: string): Promise<void>;
  ensureBucket(bucket: string): Promise<void>;
}
