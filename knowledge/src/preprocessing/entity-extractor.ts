import { z } from "zod";
import { config } from "../config.js";
import { createLogger } from "../utils/logger.js";
import { generateId } from "../utils/hash.js";

const logger = createLogger("entity-extractor");

const extractionResultSchema = z.object({
  entities: z.array(
    z.object({
      name: z.string(),
      type: z.enum([
        "Person",
        "Organization",
        "Location",
        "Event",
        "Product",
        "Technology",
        "Concept",
        "Date",
      ]),
      aliases: z.array(z.string()).optional().default([]),
    }),
  ),
});

export type ExtractionResult = z.infer<typeof extractionResultSchema>;

export interface ExtractedEntity {
  id: string;
  name: string;
  type: string;
  aliases: string[];
}

export async function extractEntities(
  text: string,
  documentId: string,
): Promise<ExtractedEntity[]> {
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
            content: `You are an entity extraction system. Extract named entities from the given text.
Return a JSON object with an "entities" array. Each entity should have:
- "name": the canonical name
- "type": one of Person, Organization, Location, Event, Product, Technology, Concept, Date
- "aliases": array of alternative names or abbreviations

Only extract clearly identifiable entities. Be precise and avoid duplicates.
Return ONLY valid JSON, no markdown formatting.`,
          },
          {
            role: "user",
            content: `Extract entities from this text:\n\n${text.slice(0, 8000)}`,
          },
        ],
        temperature: 0,
        response_format: { type: "json_object" },
      }),
    });

    if (!response.ok) {
      logger.error("Entity extraction API error", { status: response.status });
      return [];
    }

    const data = (await response.json()) as {
      choices: Array<{ message: { content: string } }>;
    };

    const content = data.choices[0]?.message?.content;
    if (!content) return [];

    const parsed = extractionResultSchema.parse(JSON.parse(content));

    const entities: ExtractedEntity[] = parsed.entities.map((e) => ({
      id: generateId("entity"),
      name: e.name,
      type: e.type,
      aliases: e.aliases,
    }));

    logger.info("Extracted entities", { documentId, count: entities.length });
    return entities;
  } catch (error) {
    logger.error("Entity extraction failed", { documentId, error: String(error) });
    return [];
  }
}
