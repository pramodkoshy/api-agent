import { z } from "zod";
import { config } from "../config.js";
import { createLogger } from "../utils/logger.js";

const logger = createLogger("topic-classifier");

const topicResultSchema = z.object({
  topics: z.array(z.string()),
});

const TOPIC_TAXONOMY = [
  "Technology",
  "Business",
  "Finance",
  "Healthcare",
  "Science",
  "Politics",
  "Education",
  "Entertainment",
  "Sports",
  "Environment",
  "Legal",
  "Real Estate",
  "Travel",
  "Food",
  "Energy",
  "Transportation",
  "Manufacturing",
  "Retail",
  "Agriculture",
  "Security",
];

export async function classifyTopics(text: string): Promise<string[]> {
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
            content: `You are a topic classification system. Classify the given text into 1-3 topics from this taxonomy:
${TOPIC_TAXONOMY.join(", ")}

Return a JSON object with a "topics" array containing the most relevant topic names.
Return ONLY valid JSON.`,
          },
          {
            role: "user",
            content: text.slice(0, 4000),
          },
        ],
        temperature: 0,
        response_format: { type: "json_object" },
      }),
    });

    if (!response.ok) {
      logger.error("Topic classification API error", { status: response.status });
      return [];
    }

    const data = (await response.json()) as {
      choices: Array<{ message: { content: string } }>;
    };

    const content = data.choices[0]?.message?.content;
    if (!content) return [];

    const parsed = topicResultSchema.parse(JSON.parse(content));
    const validTopics = parsed.topics.filter((t) =>
      TOPIC_TAXONOMY.some((tax) => tax.toLowerCase() === t.toLowerCase()),
    );

    logger.info("Classified topics", { topics: validTopics });
    return validTopics;
  } catch (error) {
    logger.error("Topic classification failed", { error: String(error) });
    return [];
  }
}
