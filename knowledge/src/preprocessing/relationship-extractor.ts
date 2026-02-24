import { z } from "zod";
import { config } from "../config.js";
import { createLogger } from "../utils/logger.js";
import type { ExtractedEntity } from "./entity-extractor.js";

const logger = createLogger("relationship-extractor");

const relationshipResultSchema = z.object({
  relationships: z.array(
    z.object({
      source: z.string(),
      target: z.string(),
      type: z.string(),
      context: z.string().optional().default(""),
    }),
  ),
});

export interface ExtractedRelationship {
  sourceEntityName: string;
  targetEntityName: string;
  type: string;
  context: string;
}

export async function extractRelationships(
  text: string,
  entities: ExtractedEntity[],
  documentId: string,
): Promise<ExtractedRelationship[]> {
  if (entities.length < 2) return [];

  const baseUrl = config.openaiBaseUrl || "https://api.openai.com/v1";
  const entityNames = entities.map((e) => `${e.name} (${e.type})`).join(", ");

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
            content: `You are a relationship extraction system. Given text and a list of entities, extract relationships between them.
Return a JSON object with a "relationships" array. Each relationship should have:
- "source": name of the source entity (must be from the provided entity list)
- "target": name of the target entity (must be from the provided entity list)
- "type": relationship type in UPPER_SNAKE_CASE (e.g., ACQUIRED, CEO_OF, LOCATED_IN, WORKS_FOR, COMPETES_WITH, FOUNDED, INVESTED_IN, PARTNERS_WITH, RELATED_TO)
- "context": brief description of the relationship

Only extract clearly stated relationships. Return ONLY valid JSON.`,
          },
          {
            role: "user",
            content: `Entities found: ${entityNames}\n\nText:\n${text.slice(0, 8000)}`,
          },
        ],
        temperature: 0,
        response_format: { type: "json_object" },
      }),
    });

    if (!response.ok) {
      logger.error("Relationship extraction API error", { status: response.status });
      return [];
    }

    const data = (await response.json()) as {
      choices: Array<{ message: { content: string } }>;
    };

    const content = data.choices[0]?.message?.content;
    if (!content) return [];

    const parsed = relationshipResultSchema.parse(JSON.parse(content));

    // Validate entity names exist in our entity list
    const entityNameSet = new Set(entities.map((e) => e.name));
    const relationships: ExtractedRelationship[] = parsed.relationships
      .filter((r) => entityNameSet.has(r.source) && entityNameSet.has(r.target))
      .map((r) => ({
        sourceEntityName: r.source,
        targetEntityName: r.target,
        type: r.type.toUpperCase().replace(/\s+/g, "_"),
        context: r.context,
      }));

    logger.info("Extracted relationships", { documentId, count: relationships.length });
    return relationships;
  } catch (error) {
    logger.error("Relationship extraction failed", { documentId, error: String(error) });
    return [];
  }
}
