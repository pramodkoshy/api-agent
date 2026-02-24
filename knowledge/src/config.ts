import { z } from "zod";

const configSchema = z.object({
  port: z.coerce.number().default(3002),
  openaiApiKey: z.string().min(1),
  openaiBaseUrl: z.string().url().optional(),

  // MongoDB (shared with existing stack)
  mongodbUri: z.string().default("mongodb://mongodb:27017"),
  mongodbDb: z.string().default("api_agent_knowledge"),

  // Qdrant
  qdrantUrl: z.string().default("http://qdrant:6333"),

  // Neo4j
  neo4jUri: z.string().default("bolt://neo4j:7687"),
  neo4jUser: z.string().default("neo4j"),
  neo4jPassword: z.string().default("knowledge123"),

  // RustFS (S3-compatible)
  rustfsEndpoint: z.string().default("http://rustfs:9000"),
  rustfsAccessKey: z.string().default("rustfsadmin"),
  rustfsSecretKey: z.string().default("rustfsadmin"),
  rustfsBucket: z.string().default("raw-documents"),

  // Models
  knowledgeModel: z.string().default("gpt-4o"),
  embeddingModel: z.string().default("text-embedding-3-small"),
  embeddingDimensions: z.coerce.number().default(1536),

  // Processing
  maxCrawlDepth: z.coerce.number().default(2),
  maxChunkTokens: z.coerce.number().default(1000),
  chunkOverlapTokens: z.coerce.number().default(50),

  // Reranker
  cohereApiKey: z.string().optional(),
});

export type Config = z.infer<typeof configSchema>;

function loadConfig(): Config {
  return configSchema.parse({
    port: process.env.PORT,
    openaiApiKey: process.env.OPENAI_API_KEY,
    openaiBaseUrl: process.env.OPENAI_BASE_URL,
    mongodbUri: process.env.MONGODB_URI,
    mongodbDb: process.env.MONGODB_DB,
    qdrantUrl: process.env.QDRANT_URL,
    neo4jUri: process.env.NEO4J_URI,
    neo4jUser: process.env.NEO4J_USER,
    neo4jPassword: process.env.NEO4J_PASSWORD,
    rustfsEndpoint: process.env.RUSTFS_ENDPOINT,
    rustfsAccessKey: process.env.RUSTFS_ACCESS_KEY,
    rustfsSecretKey: process.env.RUSTFS_SECRET_KEY,
    rustfsBucket: process.env.RUSTFS_BUCKET,
    knowledgeModel: process.env.KNOWLEDGE_MODEL,
    embeddingModel: process.env.EMBEDDING_MODEL,
    embeddingDimensions: process.env.EMBEDDING_DIMENSIONS,
    maxCrawlDepth: process.env.MAX_CRAWL_DEPTH,
    maxChunkTokens: process.env.MAX_CHUNK_TOKENS,
    chunkOverlapTokens: process.env.CHUNK_OVERLAP_TOKENS,
    cohereApiKey: process.env.COHERE_API_KEY,
  });
}

export const config = loadConfig();
