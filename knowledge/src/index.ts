import { Hono } from "hono";
import { cors } from "hono/cors";
import { config } from "./config.js";
import { MongoMetadataStore } from "./storage/mongodb.js";
import { QdrantVectorStore } from "./storage/qdrant.js";
import { Neo4jGraphStore } from "./storage/neo4j.js";
import { RustfsRawStore } from "./storage/rustfs.js";
import { createIngestRoutes } from "./api/ingest.routes.js";
import { createKnowledgeRoutes } from "./api/knowledge.routes.js";
import { createSynthesizeRoutes } from "./api/synthesize.routes.js";
import { createStatusRoutes } from "./api/status.routes.js";
import { processDocumentQueue } from "./agents/extraction-agent.js";
import { createLogger } from "./utils/logger.js";

const logger = createLogger("main");

// Initialize storage adapters
const metadataStore = new MongoMetadataStore();
const vectorStore = new QdrantVectorStore();
const graphStore = new Neo4jGraphStore();
const rawStore = new RustfsRawStore();

// Create Hono app
const app = new Hono();

// Middleware
app.use("*", cors());

// Mount API routes
app.route("/ingest", createIngestRoutes({ metadataStore, rawStore, vectorStore, graphStore }));
app.route("/knowledge", createKnowledgeRoutes({ graphStore, metadataStore }));
app.route("/synthesize", createSynthesizeRoutes({ vectorStore, graphStore, metadataStore }));
app.route("/status", createStatusRoutes({ vectorStore, graphStore, metadataStore }));

// Health check (root)
app.get("/", (c) => c.json({ service: "knowledge-worker", status: "ok" }));

// Background document processing loop
let processingInterval: ReturnType<typeof setInterval> | null = null;

async function startBackgroundProcessing() {
  processingInterval = setInterval(async () => {
    try {
      await processDocumentQueue(
        { metadataStore, rawStore, vectorStore, graphStore },
        5,
      );
    } catch (error) {
      logger.error("Background processing error", { error: String(error) });
    }
  }, 30000); // Check every 30 seconds
}

// Startup
async function start() {
  logger.info("Starting knowledge worker...");

  try {
    // Connect to datastores
    await metadataStore.connect();
    logger.info("MongoDB connected");

    await graphStore.connect();
    logger.info("Neo4j connected");

    // Ensure Qdrant collection exists
    await vectorStore.createIndex("knowledge-chunks", config.embeddingDimensions, "cosine");
    logger.info("Qdrant collection ready");

    // Ensure RustFS bucket exists
    await rawStore.ensureBucket(config.rustfsBucket);
    logger.info("RustFS bucket ready");

    // Start background processing
    await startBackgroundProcessing();
    logger.info("Background document processing started");

    logger.info(`Knowledge worker listening on port ${config.port}`);
  } catch (error) {
    logger.error("Failed to initialize", { error: String(error) });
    logger.warn("Starting in degraded mode - some features may be unavailable");
  }
}

// Graceful shutdown
process.on("SIGTERM", async () => {
  logger.info("Shutting down...");
  if (processingInterval) clearInterval(processingInterval);
  await graphStore.close();
  await metadataStore.close();
  process.exit(0);
});

process.on("SIGINT", async () => {
  logger.info("Shutting down...");
  if (processingInterval) clearInterval(processingInterval);
  await graphStore.close();
  await metadataStore.close();
  process.exit(0);
});

// Start
start();

export default {
  port: config.port,
  fetch: app.fetch,
};
