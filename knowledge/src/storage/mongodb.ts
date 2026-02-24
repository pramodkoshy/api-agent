import { MongoClient, type Db, type Collection } from "mongodb";
import type {
  IMetadataStore,
  DocumentMetadata,
  DocumentFilter,
  IngestionJob,
} from "./interfaces.js";
import { config } from "../config.js";
import { createLogger } from "../utils/logger.js";

const logger = createLogger("mongodb");

export class MongoMetadataStore implements IMetadataStore {
  private client: MongoClient;
  private db: Db;
  private documents: Collection<DocumentMetadata>;
  private jobs: Collection<IngestionJob>;

  constructor() {
    this.client = new MongoClient(config.mongodbUri);
    this.db = this.client.db(config.mongodbDb);
    this.documents = this.db.collection<DocumentMetadata>("documents");
    this.jobs = this.db.collection<IngestionJob>("ingestion_jobs");
  }

  async connect(): Promise<void> {
    await this.client.connect();
    await this.documents.createIndex({ id: 1 }, { unique: true });
    await this.documents.createIndex({ contentHash: 1 });
    await this.documents.createIndex({ source: 1 });
    await this.documents.createIndex({ status: 1 });
    await this.documents.createIndex({ ingestedAt: -1 });
    await this.jobs.createIndex({ id: 1 }, { unique: true });
    await this.jobs.createIndex({ status: 1 });
    logger.info("MongoDB connected", { db: config.mongodbDb });
  }

  async insertDocument(doc: DocumentMetadata): Promise<string> {
    await this.documents.insertOne(doc);
    return doc.id;
  }

  async getDocument(id: string): Promise<DocumentMetadata | null> {
    return this.documents.findOne({ id });
  }

  async findDocuments(filter: DocumentFilter): Promise<DocumentMetadata[]> {
    const query: Record<string, unknown> = {};

    if (filter.sources?.length) {
      query.source = { $in: filter.sources };
    }
    if (filter.tags?.length) {
      query.tags = { $in: filter.tags };
    }
    if (filter.status) {
      query.status = filter.status;
    }
    if (filter.dateFrom || filter.dateTo) {
      query.ingestedAt = {};
      if (filter.dateFrom) (query.ingestedAt as Record<string, string>).$gte = filter.dateFrom;
      if (filter.dateTo) (query.ingestedAt as Record<string, string>).$lte = filter.dateTo;
    }

    return this.documents
      .find(query)
      .sort({ ingestedAt: -1 })
      .skip(filter.offset || 0)
      .limit(filter.limit || 50)
      .toArray();
  }

  async updateDocument(id: string, update: Partial<DocumentMetadata>): Promise<void> {
    await this.documents.updateOne({ id }, { $set: update });
  }

  async checkDuplicate(contentHash: string): Promise<boolean> {
    const doc = await this.documents.findOne({ contentHash });
    return doc !== null;
  }

  async insertJob(job: IngestionJob): Promise<string> {
    await this.jobs.insertOne(job);
    return job.id;
  }

  async getJob(id: string): Promise<IngestionJob | null> {
    return this.jobs.findOne({ id });
  }

  async updateJob(id: string, update: Partial<IngestionJob>): Promise<void> {
    await this.jobs.updateOne({ id }, { $set: { ...update, updatedAt: new Date().toISOString() } });
  }

  async getStats(): Promise<{ documentCount: number; entityCount: number; jobCount: number }> {
    const [documentCount, jobCount] = await Promise.all([
      this.documents.countDocuments(),
      this.jobs.countDocuments(),
    ]);
    // Entity count from documents' entityIds
    const entityPipeline = [
      { $unwind: "$entityIds" },
      { $group: { _id: null, count: { $addToSet: "$entityIds" } } },
      { $project: { entityCount: { $size: "$count" } } },
    ];
    const entityResult = await this.documents.aggregate(entityPipeline).toArray();
    const entityCount = entityResult[0]?.entityCount || 0;
    return { documentCount, entityCount, jobCount };
  }

  async close(): Promise<void> {
    await this.client.close();
    logger.info("MongoDB disconnected");
  }
}
