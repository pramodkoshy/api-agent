import { MongoClient, type Db, type Collection, type Document } from "mongodb";

const MONGO_URI = process.env.MONGODB_URI || "mongodb://mongodb:27017";
const DB_NAME = process.env.MONGODB_DB || "api_agent_store";

let client: MongoClient | null = null;
let db: Db | null = null;

/** Get or create the MongoDB connection. */
export async function getDb(): Promise<Db> {
  if (db) return db;
  client = new MongoClient(MONGO_URI);
  await client.connect();
  db = client.db(DB_NAME);
  return db;
}

/** Get a typed collection. */
export async function getCollection<T extends Document = Document>(
  name: string,
): Promise<Collection<T>> {
  const database = await getDb();
  return database.collection<T>(name);
}

// ---------- Dataset store operations ----------

export interface StoredDataset {
  _id?: string;
  /** User-provided name for this dataset */
  name: string;
  /** Which API this came from */
  sourceApi: string;
  /** API type (graphql or rest) */
  apiType: string;
  /** The query/question that produced this data */
  query: string;
  /** The actual data rows */
  data: Record<string, unknown>[];
  /** Column names (inferred from data) */
  columns: string[];
  /** Row count */
  rowCount: number;
  /** When this was stored */
  createdAt: Date;
  /** Optional tags for organization */
  tags: string[];
}

const DATASETS_COLLECTION = "datasets";

/** Save query results to MongoDB. Returns the dataset ID. */
export async function saveDataset(dataset: Omit<StoredDataset, "_id" | "createdAt">): Promise<string> {
  const col = await getCollection(DATASETS_COLLECTION);
  const result = await col.insertOne({
    ...dataset,
    createdAt: new Date(),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- MongoDB Document type mismatch
  } as any);
  return result.insertedId.toString();
}

/** List all stored datasets with metadata (no data rows). */
export async function listDatasets(): Promise<Array<Omit<StoredDataset, "data">>> {
  const col = await getCollection(DATASETS_COLLECTION);
  return col
    .find({}, { projection: { data: 0 } })
    .sort({ createdAt: -1 })
    .limit(50)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- MongoDB Document to StoredDataset cast
    .toArray() as any;
}

/** Retrieve a full dataset by name. */
export async function getDatasetByName(name: string): Promise<StoredDataset | null> {
  const col = await getCollection(DATASETS_COLLECTION);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- MongoDB Document to StoredDataset cast
  return col.findOne({ name }) as any;
}

/** Retrieve a dataset by ID. */
export async function getDatasetById(id: string): Promise<StoredDataset | null> {
  const col = await getCollection(DATASETS_COLLECTION);
  const { ObjectId } = await import("mongodb");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- MongoDB ObjectId type cast
  return col.findOne({ _id: new ObjectId(id) as any }) as any;
}

/** Delete a dataset by name. */
export async function deleteDataset(name: string): Promise<boolean> {
  const col = await getCollection(DATASETS_COLLECTION);
  const result = await col.deleteOne({ name });
  return result.deletedCount > 0;
}
