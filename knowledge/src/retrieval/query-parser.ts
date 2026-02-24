import { z } from "zod";
import { config } from "../config.js";
import { createLogger } from "../utils/logger.js";

const logger = createLogger("query-parser");

const parsedQuerySchema = z.object({
  entities: z.array(z.string()),
  intent: z.enum([
    "factual_lookup",
    "relationship_discovery",
    "comparison",
    "timeline",
    "aggregation",
    "exploration",
  ]),
  filters: z
    .object({
      dateRange: z
        .object({ from: z.string().optional(), to: z.string().optional() })
        .optional(),
      sources: z.array(z.string()).optional(),
      topics: z.array(z.string()).optional(),
      relationTypes: z.array(z.string()).optional(),
    })
    .optional()
    .default({}),
  reformulatedQuery: z.string(),
});

export type ParsedQuery = z.infer<typeof parsedQuerySchema>;

export async function parseQuery(query: string): Promise<ParsedQuery> {
  const baseUrl = config.openaiBaseUrl || "https://api.openai.com/v1";

  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.openaiApiKey}`,
      },
      body: JSON.stringify({
        model: config.knowledgeModel,
        messages: [
          {
            role: "system",
            content: `You are a query parser for a knowledge retrieval system. Analyze the user's natural language query and extract:

1. "entities": named entities mentioned (people, organizations, locations, etc.)
2. "intent": one of: factual_lookup, relationship_discovery, comparison, timeline, aggregation, exploration
3. "filters": optional filters like dateRange, sources, topics, relationTypes
4. "reformulatedQuery": the query rewritten for optimal vector search

Return ONLY valid JSON.`,
          },
          {
            role: "user",
            content: query,
          },
        ],
        temperature: 0,
        response_format: { type: "json_object" },
      }),
    });

    if (!response.ok) {
      throw new Error(`Query parser API error: ${response.status}`);
    }

    const data = (await response.json()) as {
      choices: Array<{ message: { content: string } }>;
    };

    const content = data.choices[0]?.message?.content;
    if (!content) throw new Error("Empty response from query parser");

    const parsed = parsedQuerySchema.parse(JSON.parse(content));
    logger.info("Parsed query", {
      entities: parsed.entities,
      intent: parsed.intent,
    });
    return parsed;
  } catch (error) {
    logger.warn("Query parsing failed, using fallback", { error: String(error) });
    // Fallback: treat entire query as exploration
    return {
      entities: [],
      intent: "exploration",
      filters: {},
      reformulatedQuery: query,
    };
  }
}
