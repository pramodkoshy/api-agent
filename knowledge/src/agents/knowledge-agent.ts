import { z } from "zod";
import type { IVectorStore, IGraphStore, IMetadataStore, IRawStore } from "../storage/interfaces.js";
import { runGraphRagWorkflow, type GraphRagResult } from "../workflows/graph-rag.workflow.js";
import { runIngestWorkflow, type IngestResult } from "../workflows/ingest.workflow.js";
import { expandFromEntities } from "../retrieval/graph-expander.js";
import { createLogger } from "../utils/logger.js";

const logger = createLogger("knowledge-agent");

export interface KnowledgeAgentDeps {
  vectorStore: IVectorStore;
  graphStore: IGraphStore;
  metadataStore: IMetadataStore;
  rawStore: IRawStore;
}

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: z.ZodType;
  execute: (input: unknown) => Promise<unknown>;
}

export function createKnowledgeAgentTools(deps: KnowledgeAgentDeps): ToolDefinition[] {
  return [
    {
      name: "search_knowledge",
      description: "Search the knowledge base using hybrid retrieval (graph + vector + metadata)",
      inputSchema: z.object({
        query: z.string(),
        maxResults: z.number().default(10),
        filters: z
          .object({
            sources: z.array(z.string()).optional(),
            dateFrom: z.string().optional(),
            dateTo: z.string().optional(),
            topics: z.array(z.string()).optional(),
          })
          .optional(),
      }),
      execute: async (input: unknown) => {
        const params = input as {
          query: string;
          maxResults: number;
          filters?: { sources?: string[]; dateFrom?: string; dateTo?: string; topics?: string[] };
        };
        const result = await runGraphRagWorkflow(
          {
            query: params.query,
            topK: params.maxResults,
            filters: {
              sources: params.filters?.sources,
              dateRange:
                params.filters?.dateFrom || params.filters?.dateTo
                  ? { from: params.filters?.dateFrom, to: params.filters?.dateTo }
                  : undefined,
              topics: params.filters?.topics,
            },
          },
          deps.vectorStore,
          deps.graphStore,
          deps.metadataStore,
        );
        return result;
      },
    },
    {
      name: "explore_graph",
      description: "Explore entity relationships in the knowledge graph",
      inputSchema: z.object({
        entityName: z.string(),
        relationTypes: z.array(z.string()).optional(),
        maxHops: z.number().default(2),
      }),
      execute: async (input: unknown) => {
        const params = input as {
          entityName: string;
          relationTypes?: string[];
          maxHops: number;
        };
        const result = await expandFromEntities(
          deps.graphStore,
          [params.entityName],
          params.maxHops,
          params.relationTypes,
        );
        return {
          type: "graph",
          nodes: result.entities.map((e) => ({ id: e.id, label: e.name, type: e.type })),
          edges: result.relationships.map((r) => ({
            from: r.source,
            to: r.target,
            label: r.type,
          })),
          documentIds: result.documentIds,
        };
      },
    },
    {
      name: "synthesize_answer",
      description: "Synthesize a comprehensive answer with citations from the knowledge base",
      inputSchema: z.object({
        query: z.string(),
        maxSources: z.number().default(10),
      }),
      execute: async (input: unknown) => {
        const params = input as { query: string; maxSources: number };
        const result = await runGraphRagWorkflow(
          { query: params.query, topK: params.maxSources },
          deps.vectorStore,
          deps.graphStore,
          deps.metadataStore,
        );
        return result;
      },
    },
    {
      name: "ingest_content",
      description: "Add new content to the knowledge base from URLs",
      inputSchema: z.object({
        urls: z.array(z.string().url()),
        tags: z.array(z.string()).optional(),
      }),
      execute: async (input: unknown) => {
        const params = input as { urls: string[]; tags?: string[] };
        const result = await runIngestWorkflow(
          { urls: params.urls, crawlDepth: 1, tags: params.tags || [] },
          deps.metadataStore,
          deps.rawStore,
        );
        return result;
      },
    },
  ];
}
